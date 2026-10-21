//! R7: a note's image folder (SPEC §6.3, §6.4).
use std::fs::{self, OpenOptions};
use std::io;
use std::path::{Path, PathBuf};

/// R7. `C:/n/labo-04.md` -> `C:/n/labo-04.assets`.
pub fn assets_dir_for(note: &Path) -> PathBuf {
    note.with_extension("assets")
}

/// R7. Moves a folder: rename, else copy then remove (across drives). Removes only after the copy succeeded.
pub fn move_dir(from: &Path, to: &Path) -> io::Result<()> {
    fs::symlink_metadata(from)?;
    if !to.exists() && fs::rename(from, to).is_ok() {
        return Ok(());
    }
    copy_dir(from, to)?;
    fs::remove_dir_all(from)
}

/// R7. Copies a folder recursively; never overwrites existing files. `to`'s parent must exist.
pub fn copy_dir(from: &Path, to: &Path) -> io::Result<()> {
    if !from.is_dir() {
        return Err(io::Error::new(io::ErrorKind::NotFound, "source folder not found"));
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
            copy_dir(&src, &dst)?;
        } else {
            let mut out = OpenOptions::new().write(true).create_new(true).open(&dst)?;
            io::copy(&mut fs::File::open(&src)?, &mut out)?;
            out.sync_all()?;
        }
    }
    Ok(())
}
