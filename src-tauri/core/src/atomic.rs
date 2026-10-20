//! R3: atomic writes (SPEC §6.1). Phase 2.
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// R3. Writes to a temp file in the same folder, flushes, then renames over the target.
/// Never creates folders; on any error the temp file is removed and the target is untouched.
pub fn atomic_write(target: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let name = target.file_name().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidInput, "target has no file name")
    })?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let unique = format!(
        "{}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed),
        nanos
    );
    let mut tmp_name = std::ffi::OsString::from(".");
    tmp_name.push(name);
    tmp_name.push(format!(".{unique}.tmp"));
    let tmp = target.with_file_name(tmp_name);

    let mut file = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
    let result = file
        .write_all(bytes)
        .and_then(|_| file.sync_all())
        .and_then(|_| {
            drop(file);
            fs::rename(&tmp, target)
        });
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}
