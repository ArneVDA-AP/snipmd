//! Reading `session.json` at startup without ever letting a fresh session overwrite one that could
//! not be read: it holds the only copy of every untitled note.

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, PartialEq, Eq)]
pub enum Loaded {
    /// No session yet.
    Missing,
    /// UTF-8 text that `valid` accepted.
    Text(String),
    /// Could not be read or used; moved to this path, never deleted.
    SetAside(PathBuf),
}

/// Reads the session at `path`. A file that cannot be read, is not UTF-8 or that `valid` rejects
/// is renamed next to it (`session.unreadable-<ms>.json`, never replacing an earlier one). If even
/// that fails (a locked file, an offline folder), the error comes back and the caller must not write
/// a session this run.
pub fn load(path: &Path, valid: impl Fn(&str) -> bool) -> Result<Loaded, String> {
    let why = match fs::read(path) {
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(Loaded::Missing),
        Err(e) => e.to_string(),
        Ok(bytes) => match String::from_utf8(bytes) {
            Ok(text) if valid(&text) => return Ok(Loaded::Text(text)),
            Ok(_) => "not a valid session".into(),
            Err(_) => "not UTF-8 text".into(),
        },
    };
    move_aside(path).map(Loaded::SetAside).map_err(|e| format!("session.json cannot be read ({why}) and could not be kept aside: {e}"))
}

fn move_aside(path: &Path) -> std::io::Result<PathBuf> {
    let dir = path.parent().unwrap_or(Path::new("."));
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_millis());
    for n in 0..100 {
        let aside = dir.join(if n == 0 { format!("session.unreadable-{ms}.json") } else { format!("session.unreadable-{ms}-{n}.json") });
        // `rename` replaces an existing target on Windows, so check first; nothing else writes these names.
        if !aside.try_exists()? {
            fs::rename(path, &aside)?;
            return Ok(aside);
        }
    }
    Err(std::io::Error::new(ErrorKind::AlreadyExists, "no free name to keep it aside"))
}

/// The sessions `load` kept aside in `dir`. Their untitled notes still link screenshots in scratch.
pub fn set_aside(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else { return Vec::new() };
    entries
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.starts_with("session.unreadable-") && n.ends_with(".json")))
        .collect()
}
