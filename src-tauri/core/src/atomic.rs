//! R3: atomic writes (SPEC §6.1). Phase 2.
use std::fs::{self, File, OpenOptions};
use std::ffi::OsString;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// R3. Writes to a temp file in the same folder, flushes, then renames over the target.
/// Never creates folders; on any error the temp file is removed and the target is untouched.
pub fn atomic_write(target: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let real = match fs::symlink_metadata(target) {
        Ok(m) if m.file_type().is_symlink() => fs::canonicalize(target)?, // D7: the link stays a link
        _ => target.to_path_buf(),
    };
    let target = real.as_path();
    if fs::metadata(target).is_ok_and(|m| m.permissions().readonly()) {
        return Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied, "read-only")); // D8
    }
    let name = target.file_name().ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "target has no file name"))?;
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
    let mut opts = OpenOptions::new();
    #[cfg(windows)]
    std::os::windows::fs::OpenOptionsExt::attributes(&mut opts, 0x2); // D9: hidden temp file
    let tmp = write_with(target.parent().unwrap_or(Path::new("")), tmp_name, opts, bytes)?;
    fs::rename(&tmp, target).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

/// A new file from `create_unique` with all of `bytes`, synced and closed. On error it is removed,
/// so no partly written file stays behind.
pub fn write_new(dir: &Path, name: impl FnMut() -> std::ffi::OsString, bytes: &[u8]) -> std::io::Result<PathBuf> {
    write_with(dir, name, OpenOptions::new(), bytes)
}

fn write_with(dir: &Path, name: impl FnMut() -> OsString, opts: OpenOptions, bytes: &[u8]) -> io::Result<PathBuf> {
    let (path, mut file) = create_unique_with(dir, name, opts)?;
    file.write_all(bytes).and_then(|_| file.sync_all()).map(|_| path.clone()).inspect_err(|_| {
        drop(file);
        let _ = fs::remove_file(&path);
    })
}

/// R3b. Creates `dir/<name()>` with create_new; on AlreadyExists asks `name` again (64 attempts at most).
/// Never creates folders. Any other error is returned at once.
pub fn create_unique(
    dir: &Path,
    name: impl FnMut() -> std::ffi::OsString,
) -> std::io::Result<(PathBuf, File)> {
    create_unique_with(dir, name, OpenOptions::new())
}

fn create_unique_with(
    dir: &Path,
    mut name: impl FnMut() -> std::ffi::OsString,
    mut opts: OpenOptions,
) -> std::io::Result<(PathBuf, File)> {
    for _ in 0..64 {
        let p = dir.join(name());
        match opts.write(true).create_new(true).open(&p) {
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
