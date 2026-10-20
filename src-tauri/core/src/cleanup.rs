//! R8: startup cleanup of the scratch folder (SPEC §6.5). Phase 5.
use crate::ScratchEntry;
use std::collections::HashSet;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

/// R8. Returns the entries to delete: tab folders whose tab is not live, and images nothing references,
/// both only when older than `grace`.
pub fn select_for_cleanup(
    entries: &[ScratchEntry],
    live_tabs: &HashSet<String>,
    live_refs: &HashSet<String>,
    now: SystemTime,
    grace: Duration,
) -> Vec<PathBuf> {
    todo!("phase 5")
}
