//! SnipMD logic without Tauri, so it builds and tests on any machine.

use std::fmt;
use std::path::PathBuf;
use std::time::SystemTime;

pub mod assets;
pub mod atomic;
pub mod cleanup;
pub mod links;
pub mod naming;
pub mod paths;
pub mod session;
pub mod text;

/// Why a path was refused.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PathError {
    /// Absolute, drive-relative or UNC path where a relative link was expected.
    NotRelative(String),
    /// Resolves outside the folder it must stay in (`..`).
    Escapes(String),
    /// Contains an NTFS alternate data stream (`:`) or another forbidden form.
    Forbidden(String),
    /// Not in the allowed set.
    NotAllowed(PathBuf),
    /// Malformed percent-encoding or other unreadable link.
    Invalid(String),
}

impl fmt::Display for PathError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PathError::NotRelative(s) => write!(f, "not a relative path: {s}"),
            PathError::Escapes(s) => write!(f, "path leaves its folder: {s}"),
            PathError::Forbidden(s) => write!(f, "forbidden path: {s}"),
            PathError::NotAllowed(p) => write!(f, "path not allowed: {}", p.display()),
            PathError::Invalid(s) => write!(f, "invalid path: {s}"),
        }
    }
}

impl std::error::Error for PathError {}

/// Why a note's bytes could not be decoded as text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TextError {
    NotUtf8,
}

impl fmt::Display for TextError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TextError::NotUtf8 => write!(f, "file is not valid UTF-8"),
        }
    }
}

impl std::error::Error for TextError {}

/// One item in `%APPDATA%/com.snipmd.desktop/scratch/`: a tab folder (`is_dir`) or an item directly inside one.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScratchEntry {
    pub path: PathBuf,
    /// Name of the tab folder the entry belongs to (the folder itself for `is_dir`).
    pub tab_id: String,
    pub is_dir: bool,
    pub modified: SystemTime,
}
