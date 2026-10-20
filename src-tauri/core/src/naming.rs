//! R4: screenshot file names (SPEC §6.3). Phase 3.
use std::path::{Path, PathBuf};

/// R4. `snip-YYYYMMDD-HHMMSS-mmm-XXXX.png`, XXXX = `rand4` as 4 lowercase hex digits.
pub fn snip_name(now: chrono::NaiveDateTime, rand4: u16) -> String {
    todo!("phase 3")
}

/// R4. Creates a new snip file in `dir` with `create_new(true)`, retrying on a name collision. Never overwrites.
pub fn create_snip(dir: &Path, bytes: &[u8]) -> std::io::Result<PathBuf> {
    todo!("phase 3")
}
