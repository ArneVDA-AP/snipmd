//! R4: screenshot file names (SPEC §6.3). Phase 3.
use crate::atomic::create_unique;
use std::io::Write;
use std::path::{Path, PathBuf};

/// R4. `snip-YYYYMMDD-HHMMSS-mmm-XXXX.<ext>`, XXXX = `rand4` as 4 lowercase hex digits.
pub fn snip_name(now: chrono::NaiveDateTime, rand4: u16, ext: &str) -> String {
    format!("{}-{rand4:04x}.{ext}", now.format("snip-%Y%m%d-%H%M%S-%3f"))
}

/// R4. Creates a new snip file in `dir` and writes `bytes`. Never overwrites, never creates `dir`.
pub fn create_snip(dir: &Path, ext: &str, bytes: &[u8]) -> std::io::Result<PathBuf> {
    let name = || snip_name(chrono::Local::now().naive_local(), rand::random(), ext).into();
    let (path, mut file) = create_unique(dir, name)?;
    if let Err(e) = file.write_all(bytes) {
        drop(file);
        let _ = std::fs::remove_file(&path);
        return Err(e);
    }
    Ok(path)
}

/// R4. The lower-case extension when it is an image type we accept.
pub fn image_ext(p: &Path) -> Option<&'static str> {
    let e = p.extension()?.to_str()?.to_ascii_lowercase();
    ["png", "jpg", "jpeg", "gif", "webp"].into_iter().find(|x| *x == e)
}
