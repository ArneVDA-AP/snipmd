//! R3: atomic writes (SPEC §6.1). Phase 2.
use std::path::Path;

/// R3. Writes to a temp file in the same folder, flushes, then renames over the target.
pub fn atomic_write(target: &Path, bytes: &[u8]) -> std::io::Result<()> {
    todo!("phase 2")
}
