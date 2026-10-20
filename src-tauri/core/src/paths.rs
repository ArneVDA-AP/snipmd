//! R1, R2: path checks (SPEC §8). Purely lexical, no file system access.
use crate::PathError;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

fn hex(b: u8) -> Option<u8> {
    (b as char).to_digit(16).map(|d| d as u8)
}

pub fn percent_decode(s: &str) -> Result<String, PathError> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' {
            let h = b.get(i + 1).copied().and_then(hex);
            let l = b.get(i + 2).copied().and_then(hex);
            match (h, l) {
                (Some(h), Some(l)) => out.push(h * 16 + l),
                _ => return Err(PathError::Invalid(s.to_string())),
            }
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).map_err(|_| PathError::Invalid(s.to_string()))
}

/// Windows drops trailing dots and spaces from a path component, so `.. ` would act as `..`
/// and `a.png.` as `a.png`. Such components are refused outright.
fn windows_trimmed(c: &str) -> bool {
    c != "." && c != ".." && (c.ends_with('.') || c.ends_with(' '))
}

enum Walk {
    Escapes,
    Trimmed,
}

/// The one lexical walk over path components (either separator): drops `.` and empty parts,
/// applies `..`, refuses components Windows would trim. `..` above the start is clamped for
/// absolute paths (`clamp`) and an escape for links.
fn components(rest: &str, clamp: bool) -> Result<Vec<&str>, Walk> {
    let mut comps = Vec::new();
    for part in rest.split(['/', '\\']) {
        match part {
            "" | "." => {}
            ".." => {
                if comps.pop().is_none() && !clamp {
                    return Err(Walk::Escapes);
                }
            }
            c if windows_trimmed(c) => return Err(Walk::Trimmed),
            c => comps.push(c),
        }
    }
    Ok(comps)
}

fn has_drive(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() >= 2 && b[0].is_ascii_alphabetic() && b[1] == b':'
}

/// R1. Resolves an image link from a note against the note's folder.
/// Percent-decodes; rejects absolute, drive, UNC, `..` escape and `:` streams.
pub fn resolve_image(note_dir: &Path, link: &str) -> Result<PathBuf, PathError> {
    let dec = percent_decode(link)?;
    if dec.is_empty() {
        return Err(PathError::Invalid(link.to_string()));
    }
    if dec.contains('\0') {
        return Err(PathError::Forbidden(link.to_string()));
    }
    if dec.starts_with('/') || dec.starts_with('\\') || has_drive(&dec) {
        return Err(PathError::NotRelative(link.to_string()));
    }
    if dec.contains(':') {
        return Err(PathError::Forbidden(link.to_string()));
    }
    let comps = match components(&dec, false) {
        Ok(c) => c,
        Err(Walk::Escapes) => return Err(PathError::Escapes(link.to_string())),
        Err(Walk::Trimmed) => return Err(PathError::Forbidden(link.to_string())),
    };
    if comps.is_empty() {
        return Err(PathError::Invalid(link.to_string()));
    }
    let mut out = note_dir.to_path_buf();
    out.extend(comps);
    Ok(out)
}

/// R1b. Resolves `untitled.assets/<file>` against the tab's scratch folder.
pub fn resolve_untitled(tab_dir: &Path, link: &str) -> Result<PathBuf, PathError> {
    let p = resolve_image(Path::new(""), link)?;
    let mut it = p.components();
    match it.next() {
        Some(c) if c.as_os_str() == "untitled.assets" => {}
        _ => return Err(PathError::NotAllowed(PathBuf::from(link))),
    }
    let rest = it.as_path();
    if rest.as_os_str().is_empty() {
        return Err(PathError::NotAllowed(PathBuf::from(link)));
    }
    Ok(tab_dir.join(rest))
}

/// R1b. 1 to 64 chars of `[A-Za-z0-9_-]`.
pub fn valid_tab_id(id: &str) -> bool {
    (1..=64).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

/// Lexically normalizes an absolute path to a string with `/` separators.
/// Returns None for relative paths and for components Windows would trim.
fn normalize(p: &Path) -> Option<String> {
    let s = p.to_string_lossy().replace('\\', "/");
    let (prefix, rest) = if let Some(r) = s.strip_prefix("//") {
        ("//", r)
    } else if let Some(r) = s.strip_prefix('/') {
        ("/", r)
    } else if has_drive(&s) {
        let r = &s[2..];
        if !r.starts_with('/') {
            return None; // drive-relative
        }
        (&s[..2], r)
    } else {
        return None;
    };
    let comps = components(rest, true).ok()?;
    let sep = if prefix.ends_with('/') { "" } else { "/" };
    Some(format!("{prefix}{sep}{}", comps.join("/")))
}

fn fold(s: &str) -> String {
    if cfg!(windows) {
        s.to_lowercase()
    } else {
        s.to_string()
    }
}

/// Folder keys end in `/`, so `C:/notes` never matches `C:/notes-other`.
fn dir_key(n: &str) -> String {
    let k = fold(n);
    if k.ends_with('/') { k } else { k + "/" }
}

/// R2. The files and folders Rust commands may touch.
#[derive(Debug, Default, Clone)]
pub struct AllowedSet {
    files: HashSet<String>,
    dirs: HashSet<String>,
}

impl AllowedSet {
    pub fn new() -> Self {
        Self::default()
    }

    /// Allows a note and its `<stem>.assets/` folder.
    pub fn allow_note(&mut self, note: &Path) {
        let Some(n) = normalize(note) else { return };
        let (parent, name) = n.rsplit_once('/').unwrap_or(("", &n));
        if name.is_empty() {
            return;
        }
        let stem = match name.rfind('.') {
            Some(i) if i > 0 => &name[..i],
            _ => name,
        };
        self.dirs.insert(dir_key(&format!("{parent}/{stem}.assets")));
        self.files.insert(fold(&n));
    }

    /// Allows exactly this file, no folder.
    pub fn allow_file(&mut self, p: &Path) {
        if let Some(n) = normalize(p) {
            self.files.insert(fold(&n));
        }
    }

    /// Allows a folder and everything below it.
    pub fn allow_dir(&mut self, dir: &Path) {
        if let Some(n) = normalize(dir) {
            self.dirs.insert(dir_key(&n));
        }
    }

    /// Returns the normalized path when it is allowed.
    pub fn check(&self, p: &Path) -> Result<PathBuf, PathError> {
        let n = normalize(p).ok_or_else(|| PathError::NotRelative(p.display().to_string()))?;
        let key = fold(&n);
        let as_dir = dir_key(&n);
        if self.files.contains(&key) || self.dirs.iter().any(|d| as_dir.starts_with(d.as_str())) {
            Ok(PathBuf::from(n))
        } else {
            Err(PathError::NotAllowed(p.to_path_buf()))
        }
    }
}
