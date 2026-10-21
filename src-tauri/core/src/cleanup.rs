//! R8: startup cleanup of the scratch folder (SPEC §6.5). Phase 5.
use crate::{links::encode_link_path, paths::valid_tab_id, ScratchEntry};
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

/// R8. Nothing in the scratch folder is removed before it is this old.
pub const SCRATCH_GRACE: Duration = Duration::from_secs(14 * 24 * 60 * 60);

/// R8. Lists every tab folder directly in `scratch` (valid tab id only) and every item directly inside one.
/// Loose files, other folders and deeper levels are not listed; a missing `scratch` gives an empty list.
pub fn scan_scratch(scratch: &Path) -> io::Result<Vec<ScratchEntry>> {
    let top = match fs::read_dir(scratch) {
        Ok(rd) => rd,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e),
    };
    let mut out = Vec::new();
    for dir in top.flatten() {
        let tab_id = dir.file_name().to_string_lossy().into_owned();
        if !valid_tab_id(&tab_id) || !dir.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let Some(modified) = dir.metadata().ok().and_then(|m| m.modified().ok()) else { continue };
        out.push(ScratchEntry { path: dir.path(), tab_id: tab_id.clone(), is_dir: true, modified });
        let Ok(items) = fs::read_dir(dir.path()) else { continue };
        for item in items.flatten() {
            if let Some(modified) = item.metadata().ok().and_then(|m| m.modified().ok()) {
                out.push(ScratchEntry { path: item.path(), tab_id: tab_id.clone(), is_dir: false, modified });
            }
        }
    }
    Ok(out)
}

/// R8. Returns the paths to delete: tab folders whose tab is not in `live` and whose folder and items are all
/// at least `grace` old, and old items of a live tab whose text is known and never names them.
/// A modified time after `now` counts as young.
pub fn select_for_cleanup(
    entries: &[ScratchEntry],
    live: &HashMap<String, Option<String>>,
    now: SystemTime,
    grace: Duration,
) -> Vec<PathBuf> {
    let old = |e: &ScratchEntry| now.duration_since(e.modified).is_ok_and(|d| d >= grace);
    let mut out = Vec::new();
    for e in entries {
        match live.get(&e.tab_id) {
            None if e.is_dir => {
                if entries.iter().filter(|x| x.tab_id == e.tab_id).all(old) {
                    out.push(e.path.clone());
                }
            }
            Some(Some(text)) if !e.is_dir && old(e) => {
                let name = e.path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
                if !text.contains(&name) && !text.contains(&encode_link_path(&name)) {
                    out.push(e.path.clone());
                }
            }
            _ => {}
        }
    }
    out
}

/// R8. Scans, selects and removes. Only paths under `scratch` are touched; a failed removal is skipped.
/// Returns how many were removed; a scan error removes nothing.
pub fn clean_scratch(
    scratch: &Path,
    live: &HashMap<String, Option<String>>,
    now: SystemTime,
    grace: Duration,
) -> usize {
    let Ok(entries) = scan_scratch(scratch) else { return 0 };
    let is_dir = |p: &PathBuf| entries.iter().any(|e| e.is_dir && &e.path == p);
    select_for_cleanup(&entries, live, now, grace)
        .into_iter()
        .filter(|p| p.starts_with(scratch))
        .filter(|p| if is_dir(p) { fs::remove_dir_all(p) } else { fs::remove_file(p) }.is_ok())
        .count()
}
