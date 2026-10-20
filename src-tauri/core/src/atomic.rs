//! R3: atomic writes (SPEC §6.1). Phase 2.
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// R3. Writes to a temp file in the same folder, flushes, then renames over the target.
/// Never creates folders; on any error the temp file is removed and the target is untouched.
pub fn atomic_write(target: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let name = target.file_name().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidInput, "target has no file name")
    })?;
    let tmp_name = || {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let mut n = std::ffi::OsString::from(".");
        n.push(name);
        n.push(format!(
            ".{}-{}-{}.tmp",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::Relaxed),
            nanos
        ));
        n
    };
    let (tmp, mut file) = create_unique(target.parent().unwrap_or(Path::new("")), tmp_name)?;
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

/// R3b. Creates `dir/<name()>` with create_new; on AlreadyExists asks `name` again (64 attempts at most).
/// Never creates folders. Any other error is returned at once.
pub fn create_unique(
    dir: &Path,
    mut name: impl FnMut() -> std::ffi::OsString,
) -> std::io::Result<(PathBuf, File)> {
    for _ in 0..64 {
        let p = dir.join(name());
        match OpenOptions::new().write(true).create_new(true).open(&p) {
            Ok(f) => return Ok((p, f)),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(e) => return Err(e),
        }
    }
    Err(std::io::Error::new(
        std::io::ErrorKind::AlreadyExists,
        "no free file name",
    ))
}
