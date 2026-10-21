//! Startup cleanup of the scratch folder (SPEC §6.5).
use crate::paths::{percent_decode_lossy, valid_tab_id};
use crate::ScratchEntry;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::time::{Duration, SystemTime};

/// How long an unused scratch folder or image is kept: 14 days.
pub const SCRATCH_GRACE: Duration = Duration::from_secs(14 * 24 * 60 * 60);

/// Lists every tab folder directly in `scratch` (a valid tab id, not a symlink) and every item
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

/// At least `grace` old; a time after `now` counts as young.
fn is_old(modified: SystemTime, now: SystemTime, grace: Duration) -> bool {
    now.duration_since(modified).is_ok_and(|age| age >= grace)
}

/// `live` maps every session tab id (open and closed) to its text, or None when the text is
/// unknown. Selects a non-live tab folder when it and everything in it are old and no known text
/// names any of its items (its items are then not listed), and an old item of a tab with known
/// text that no known text names. Names are matched decoded and case folded, like the resolver
/// reads them, and across all tabs: snip names are unique, and a tab whose id changed (an old
/// session with a repeated id) still keeps its images.
pub fn select_for_cleanup<'a>(
    entries: &'a [ScratchEntry],
    live: &HashMap<String, Option<String>>,
    now: SystemTime,
    grace: Duration,
) -> Vec<&'a ScratchEntry> {
    let old = |e: &ScratchEntry| is_old(e.modified, now, grace);
    let has_young: HashSet<&str> = entries.iter().filter(|e| !old(e)).map(|e| e.tab_id.as_str()).collect();
    // Every known text, decoded and case folded like the resolver reads links (Windows names ignore case).
    let texts: Vec<String> = live.values().filter_map(|t| Some(percent_decode_lossy(t.as_deref()?).to_lowercase())).collect();
    let named = |e: &ScratchEntry| {
        e.path.file_name().and_then(|n| n.to_str()).is_some_and(|name| {
            let name = name.to_lowercase();
            texts.iter().any(|t| t.contains(&name))
        })
    };
    let named_in: HashSet<&str> = entries.iter().filter(|e| !e.is_dir && named(e)).map(|e| e.tab_id.as_str()).collect();
    entries
        .iter()
        .filter(|e| match (e.is_dir, live.get(&e.tab_id)) {
            (true, None) => !has_young.contains(e.tab_id.as_str()) && !named_in.contains(e.tab_id.as_str()),
            (false, Some(Some(_))) if old(e) => !named(e),
            _ => false,
        })
        .collect()
}

/// Scans, selects and removes each selected path under `scratch` (a folder with everything in it,
/// an item on its own). A failure skips that path; a scan error removes nothing. Returns the count removed.
pub fn clean_scratch(
    scratch: &Path,
    live: &HashMap<String, Option<String>>,
    now: SystemTime,
    grace: Duration,
) -> usize {
    let Ok(entries) = scan_scratch(scratch) else { return 0 };
    select_for_cleanup(&entries, live, now, grace)
        .into_iter()
        .filter(|e| e.path.starts_with(scratch)) // the scan only lists paths under scratch; kept as the last guard
        .filter(|e| if e.is_dir { fs::remove_dir_all(&e.path) } else { fs::remove_file(&e.path) }.is_ok())
        .count()
}
