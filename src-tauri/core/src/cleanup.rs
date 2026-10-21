//! R8: startup cleanup of the scratch folder (SPEC §6.5).
use crate::links::encode_link_path;
use crate::paths::valid_tab_id;
use crate::ScratchEntry;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

/// R8. How long an unused scratch folder or image is kept: 14 days.
pub const SCRATCH_GRACE: Duration = Duration::from_secs(14 * 24 * 60 * 60);

/// R8. Lists every tab folder directly in `scratch` (a valid tab id, not a symlink) and every item
/// directly inside one. Loose files, other names and deeper levels are not listed; an entry whose
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
                if let Some(modified) = item.metadata().and_then(|m| m.modified()).ok() {
                    out.push(ScratchEntry { path: item.path(), tab_id: tab_id.clone(), is_dir: false, modified });
                }
            }
        }
        out.push(ScratchEntry { path: dir.path(), tab_id, is_dir: true, modified });
    }
    Ok(out)
}

/// At least `grace` old; a time after `now` counts as young.
fn is_old(modified: SystemTime, now: SystemTime, grace: Duration) -> bool {
    now.duration_since(modified).is_ok_and(|age| age >= grace)
}

/// R8 (pure). `live` maps every session tab id (open and closed) to its text, or None when the text is
/// unknown. Selects a non-live tab folder when it and everything in it are old (its items are then not
/// listed), and an old item of a tab with known text that the text names neither plainly nor encoded.
pub fn select_for_cleanup(
    entries: &[ScratchEntry],
    live: &HashMap<String, Option<String>>,
    now: SystemTime,
    grace: Duration,
) -> Vec<PathBuf> {
    let old = |e: &ScratchEntry| is_old(e.modified, now, grace);
    let mut out = Vec::new();
    for e in entries {
        match (e.is_dir, live.get(&e.tab_id)) {
            (true, None) => {
                if entries.iter().filter(|o| o.tab_id == e.tab_id).all(old) {
                    out.push(e.path.clone());
                }
            }
            (false, Some(Some(text))) if old(e) => {
                let Some(name) = e.path.file_name().and_then(|n| n.to_str()) else { continue };
                if !text.contains(name) && !text.contains(&encode_link_path(name)) {
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
