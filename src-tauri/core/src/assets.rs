//! R7: a note's image folder (SPEC §6.3, §6.4). assets_dir_for in phase 3, the moves in phase 4.
use std::path::{Path, PathBuf};

/// R7. `C:/n/labo-04.md` -> `C:/n/labo-04.assets`.
pub fn assets_dir_for(note: &Path) -> PathBuf {
    note.with_extension("assets")
}

/// R7. Moves a folder: rename, else copy then remove (across drives). Removes only after the copy succeeded.
pub fn move_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    todo!("phase 4")
}

/// R7. Copies a folder recursively; never overwrites existing files.
pub fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    todo!("phase 4")
}
