//! R1, R2: path checks (SPEC §8). Purely lexical, no file system access.
use crate::PathError;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

fn hex(b: u8) -> Option<u8> {
    (b as char).to_digit(16).map(|d| d as u8)
}

/// `%XX` decoded; a `%` without two hex digits is an error when `strict`, else kept as it is.
fn decode_bytes(s: &str, strict: bool) -> Option<Vec<u8>> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match (b[i], b.get(i + 1).copied().and_then(hex), b.get(i + 2).copied().and_then(hex)) {
            (b'%', Some(h), Some(l)) => {
                out.push(h * 16 + l);
                i += 3;
            }
            (b'%', _, _) if strict => return None,
            (c, _, _) => {
                out.push(c);
                i += 1;
            }
        }
    }
    Some(out)
}

pub fn percent_decode(s: &str) -> Result<String, PathError> {
    decode_bytes(s, true)
        .and_then(|b| String::from_utf8(b).ok())
        .ok_or_else(|| PathError::Invalid(s.to_string()))
}

/// Free text (a whole note) with every valid `%XX` decoded, like the resolver decodes the links in it.
pub fn percent_decode_lossy(s: &str) -> String {
    String::from_utf8_lossy(&decode_bytes(s, false).unwrap_or_default()).into_owned()
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
    match p.strip_prefix("untitled.assets") {
        Ok(rest) if !rest.as_os_str().is_empty() => Ok(tab_dir.join(rest)),
        _ => Err(PathError::NotAllowed(PathBuf::from(link))),
    }
}

/// R1b. 1 to 64 chars of `[A-Za-z0-9_-]`.
pub fn valid_tab_id(id: &str) -> bool {
    (1..=64).contains(&id.len())
        && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        && !windows_device(id)
}

/// R2b. A plain `.md` file name for a new note.
pub fn valid_note_name(name: &str) -> bool {
    if name.chars().count() > 255 || name.ends_with('.') || name.ends_with(' ') {
        return false;
    }
    if name.chars().any(|c| c.is_control() || "/\\:*?\"<>|".contains(c)) {
        return false;
    }
    let n = name.len();
    if n < 4 || !name.is_char_boundary(n - 3) || !name[n - 3..].eq_ignore_ascii_case(".md") {
        return false;
    }
    let stem = &name[..n - 3];
    !stem.ends_with(['.', ' ']) && !windows_device(stem)
}

/// CON, NUL, COM1 and the like name a device on Windows, also with an extension (`con.txt`) and
/// trailing spaces before it; COM/LPT also take the superscript digits ¹ ² ³.
fn windows_device(name: &str) -> bool {
    let base = name.split('.').next().unwrap_or("").trim_end().to_uppercase();
    if matches!(base.as_str(), "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$") {
        return true;
    }
    let mut chars = base.chars();
    let head: String = chars.by_ref().take(3).collect();
    let (digit, rest) = (chars.next(), chars.next());
    (head == "COM" || head == "LPT") && rest.is_none() && digit.is_some_and(|d| ('1'..='9').contains(&d) || "¹²³".contains(d))
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
    /// Folders where new notes may be created (not their contents).
    note_dirs: HashSet<String>,
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

    /// Allows creating new notes in this folder; the files inside stay unallowed.
    pub fn allow_note_folder(&mut self, dir: &Path) {
        if let Some(n) = normalize(dir) {
            self.note_dirs.insert(dir_key(&n));
        }
    }

    /// True for a folder given to `allow_note_folder` or the folder of an allowed note.
    pub fn may_create_in(&self, dir: &Path) -> bool {
        let Some(n) = normalize(dir) else { return false };
        let k = dir_key(&n);
        self.note_dirs.contains(&k)
            || self.files.iter().any(|f| f.rsplit_once('/').is_some_and(|(p, _)| dir_key(p) == k))
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
