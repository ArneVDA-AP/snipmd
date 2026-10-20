//! R1, R2: path checks (SPEC §8). Phase 1.
use crate::PathError;
use std::path::{Path, PathBuf};

/// R1. Resolves an image link from a note against the note's folder.
/// Percent-decodes; rejects absolute, drive, UNC, `..` escape and `:` streams.
pub fn resolve_image(note_dir: &Path, link: &str) -> Result<PathBuf, PathError> {
    todo!("phase 1")
}

/// R2. The files and folders Rust commands may touch.
#[derive(Debug, Default, Clone)]
pub struct AllowedSet {
    files: Vec<PathBuf>,
    dirs: Vec<PathBuf>,
}

impl AllowedSet {
    pub fn new() -> Self {
        Self::default()
    }

    /// Allows a note and its `<stem>.assets/` folder.
    pub fn allow_note(&mut self, note: &Path) {
        todo!("phase 1")
    }

    /// Allows a folder and everything below it.
    pub fn allow_dir(&mut self, dir: &Path) {
        todo!("phase 1")
    }

    /// Returns the normalized path when it is allowed.
    pub fn check(&self, p: &Path) -> Result<PathBuf, PathError> {
        todo!("phase 1")
    }
}
