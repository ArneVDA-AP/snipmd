//! R8: startup cleanup of the scratch folder (SPEC §6.5).
use crate::paths::valid_tab_id;
use crate::ScratchEntry;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

/// R8. How long an unused scratch folder or image is kept: 14 days.
pub const SCRATCH_GRACE: Duration = Duration::from_secs(14 * 24 * 60 * 60);

/// R8. Lists every tab folder directly in `scratch` (a valid tab id, not a symlink) and every item
/// directly inside one; a subfolder item carries the newest time of everything under it. Loose files, other names and deeper levels are not listed; an entry whose
/// metadata fails is left out. A missing `scratch` gives an empty list.
pub fn scan_scratch(scratch: &Path) -> std::io::Result<Vec<ScratchEntry>> {
    let top = match fs::read_dir(scratch) {
        Ok(rd) => rd,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e),
    };
    let mut out = Vec::new();
    for dir in top.flatten() {
        let Some(tab_id) = dir.file_name().to_str().map(str::to_owned) else { continue };
        let Ok(meta) = dir.metadata() else { continue };
        if !meta.is_dir() || !valid_tab_id(&tab_id) {
            continue;
        }
        let Ok(modified) = meta.modified() else { continue };
        if let Ok(items) = fs::read_dir(dir.path()) {
            for item in items.flatten() {
                if let Some(modified) = newest(&item.path()) {
                    out.push(ScratchEntry { path: item.path(), tab_id: tab_id.clone(), is_dir: false, modified });
                }
            }
        }
        out.push(ScratchEntry { path: dir.path(), tab_id, is_dir: true, modified });
    }
    Ok(out)
}

/// The newest modified time of a path and, for a folder, of everything under it (links not followed).
fn newest(p: &Path) -> Option<SystemTime> {
    let meta = fs::symlink_metadata(p).ok()?;
    let own = meta.modified().ok()?;
    if !meta.is_dir() {
        return Some(own);
    }
    let mut max = own;
    for child in fs::read_dir(p).ok()?.flatten() {
        max = max.max(newest(&child.path())?); // an unreadable child keeps the whole item
    }
    Some(max)
}

/// The text as the resolver reads link targets: every valid `%XX` decoded, case folded (Windows
/// file names ignore case). A name found in it may be referenced; one not found is not.
fn as_resolved(text: &str) -> String {
    let hex = |c: u8| (c as char).to_digit(16).map(|d| d as u8);
    let b = text.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match (b[i], b.get(i + 1).copied().and_then(hex), b.get(i + 2).copied().and_then(hex)) {
            (b'%', Some(h), Some(l)) => {
                out.push(h * 16 + l);
                i += 3;
            }
            (c, _, _) => {
                out.push(c);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).to_lowercase()
}

/// At least `grace` old; a time after `now` counts as young.
fn is_old(modified: SystemTime, now: SystemTime, grace: Duration) -> bool {
    now.duration_since(modified).is_ok_and(|age| age >= grace)
}

/// R8 (pure). `live` maps every session tab id (open and closed) to its text, or None when the text is
/// unknown. Selects a non-live tab folder when it and everything in it are old (its items are then not
/// listed), and an old item of a tab with known text that the text does not name, decoded and
/// case folded like the resolver reads it.
pub fn select_for_cleanup(
    entries: &[ScratchEntry],
    live: &HashMap<String, Option<String>>,
    now: SystemTime,
    grace: Duration,
) -> Vec<PathBuf> {
    let old = |e: &ScratchEntry| is_old(e.modified, now, grace);
    let resolved: HashMap<&str, String> =
        live.iter().filter_map(|(id, t)| Some((id.as_str(), as_resolved(t.as_deref()?)))).collect();
    let mut out = Vec::new();
    for e in entries {
        match (e.is_dir, live.get(&e.tab_id)) {
            (true, None) => {
                if entries.iter().filter(|o| o.tab_id == e.tab_id).all(old) {
                    out.push(e.path.clone());
                }
            }
            (false, Some(Some(_))) if old(e) => {
                let Some(name) = e.path.file_name().and_then(|n| n.to_str()) else { continue };
                if !resolved[e.tab_id.as_str()].contains(&name.to_lowercase()) {
                    out.push(e.path.clone());
                }
            }
            _ => {}
        }
    }
    out
}

/// R8. Scans, selects and removes each selected path under `scratch` (a folder with everything in it,
/// an item on its own). A failure skips that path; a scan error removes nothing. Returns the count removed.
pub fn clean_scratch(
    scratch: &Path,
    live: &HashMap<String, Option<String>>,
    now: SystemTime,
    grace: Duration,
) -> usize {
    let Ok(entries) = scan_scratch(scratch) else { return 0 };
    let dirs: Vec<&Path> = entries.iter().filter(|e| e.is_dir).map(|e| e.path.as_path()).collect();
    select_for_cleanup(&entries, live, now, grace)
        .into_iter()
        .filter(|p| p.starts_with(scratch))
        .filter(|p| {
            let removed = if dirs.contains(&p.as_path()) { fs::remove_dir_all(p) } else { fs::remove_file(p) };
            removed.is_ok()
        })
        .count()
}
