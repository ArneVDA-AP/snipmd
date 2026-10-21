//! R7: a note's image folder (SPEC §6.3, §6.4).
use std::fs::{self, OpenOptions};
use std::io;
use std::path::{Path, PathBuf};

/// R7. `C:/n/labo-04.md` -> `C:/n/labo-04.assets`.
pub fn assets_dir_for(note: &Path) -> PathBuf {
    note.with_extension("assets")
}

/// R7. Moves a folder: one rename, else (another drive, or `to` exists) file by file, each source file
/// removed only after its copy is synced. A file that arrives in `from` meanwhile is never removed;
/// a source folder that cannot be removed stays behind. Calling it again moves what is left.
pub fn move_dir(from: &Path, to: &Path) -> io::Result<()> {
    fs::symlink_metadata(from)?;
    if !to.exists() && fs::rename(from, to).is_ok() {
        return Ok(());
    }
    walk(from, to, true)?;
    let _ = fs::remove_dir(from); // only when empty
    Ok(())
}

/// R7. Copies a folder recursively; never overwrites existing files. `to`'s parent must exist.
pub fn copy_dir(from: &Path, to: &Path) -> io::Result<()> {
    walk(from, to, false)
}

fn walk(from: &Path, to: &Path, remove: bool) -> io::Result<()> {
    if !from.is_dir() {
        return Err(io::Error::new(io::ErrorKind::NotFound, "source folder not found"));
    }
    if to.starts_with(from) || from.starts_with(to) {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "a folder cannot be copied into itself"));
    }
    match fs::create_dir(to) {
        Ok(()) => {}
        Err(e) if e.kind() == io::ErrorKind::AlreadyExists && to.is_dir() => {}
        Err(e) => return Err(e),
    }
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let (src, dst) = (entry.path(), to.join(entry.file_name()));
        if entry.file_type()?.is_dir() {
            walk(&src, &dst, remove)?;
            if remove {
                let _ = fs::remove_dir(&src);
            }
        } else {
            let mut out = OpenOptions::new().write(true).create_new(true).open(&dst)?;
            io::copy(&mut fs::File::open(&src)?, &mut out)?;
            out.sync_all()?;
            if remove {
                fs::remove_file(&src)?;
            }
        }
    }
    Ok(())
}
