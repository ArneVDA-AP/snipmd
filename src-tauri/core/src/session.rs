//! Reading `session.json` at startup without ever letting a fresh session overwrite one that could
//! not be read: it holds the only copy of every untitled note. The session's shape is the page's
//! (`src/session.ts` parses it); Rust reads it leniently, only for file paths and texts, and must
//! never refuse one.

use crate::paths::AllowedSet;
use serde_json::Value;
use std::collections::HashMap;
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

/// Every tab object in a session: `tabs[]` and `closedTabs[].tab`.
pub fn tabs(session: &Value) -> Vec<&Value> {
    let Some(obj) = session.as_object() else { return Vec::new() };
    let mut out = Vec::new();
    for (key, val) in obj {
        let Some(list) = val.as_array() else { continue };
        match key.as_str() {
            "tabs" => out.extend(list.iter()),
            "closedTabs" => out.extend(list.iter().filter_map(|c| c.get("tab"))),
            _ => {}
        }
    }
    out
}

fn tabs_mut(session: &mut Value) -> Vec<&mut Value> {
    let Some(obj) = session.as_object_mut() else { return Vec::new() };
    let mut out = Vec::new();
    for (key, val) in obj.iter_mut() {
        let Some(list) = val.as_array_mut() else { continue };
        match key.as_str() {
            "tabs" => out.extend(list.iter_mut()),
            "closedTabs" => out.extend(list.iter_mut().filter_map(|c| c.get_mut("tab"))),
            _ => {}
        }
    }
    out
}

/// The note a tab is bound to, if any.
pub fn file_path(tab: &Value) -> Option<&str> {
    tab.get("filePath").and_then(Value::as_str)
}

/// Every session tab id (open and closed) with its text when the session holds it: an untitled
/// tab's text is its content; a tab with a file path has no known text (None), so cleanup keeps
/// its scratch items. An id seen twice keeps both texts; once None, it stays None.
pub fn live_tabs(session: &Value) -> HashMap<String, Option<String>> {
    let mut live: HashMap<String, Option<String>> = HashMap::new();
    for tab in tabs(session) {
        let Some(id) = tab.get("id").and_then(Value::as_str) else { continue };
        let text = file_path(tab).is_none().then(|| tab.get("content").and_then(Value::as_str).unwrap_or(""));
        match (live.entry(id.to_string()).or_insert_with(|| Some(String::new())), text) {
            (Some(all), Some(t)) => all.extend(["\n", t]),
            (known, _) => *known = None,
        }
    }
    live
}

/// The texts the startup cleanup (SPEC §6.5) may trust, read from `session.json` in `app_data`.
/// None means nothing may be cleaned this run: no session, one that cannot be read or parsed, one
/// without open tabs (the page discards it), or a set-aside session that cannot be read (it names
/// unknown images). A set-aside session that can be read counts as one more known text: it was set
/// aside because it does not parse, but its raw text still spells every name it links.
pub fn known_texts(app_data: &Path) -> Option<HashMap<String, Option<String>>> {
    let raw = fs::read_to_string(app_data.join("session.json")).ok()?;
    let session = serde_json::from_str::<Value>(&raw).ok()?;
    if !session.get("tabs").and_then(Value::as_array).is_some_and(|t| !t.is_empty()) {
        return None;
    }
    let mut live = live_tabs(&session);
    for aside in set_aside(app_data) {
        let bytes = fs::read(&aside).ok()?;
        live.insert(format!("set-aside:{}", aside.display()), Some(String::from_utf8_lossy(&bytes).into_owned()));
    }
    Some(live)
}

/// Nulls every file path (open and closed tabs) and `lastFolder` outside `allowed`, so a compromised
/// page cannot plant paths for the next start; a tab without a path restores as untitled. Returns
/// how many were dropped.
pub fn drop_unallowed(session: &mut Value, allowed: &AllowedSet) -> usize {
    let mut dropped = 0;
    if session.get("lastFolder").and_then(Value::as_str).is_some_and(|f| !allowed.may_create_in(Path::new(f))) {
        session["lastFolder"] = Value::Null;
        dropped += 1;
    }
    for tab in tabs_mut(session) {
        if file_path(tab).is_some_and(|p| allowed.check(Path::new(p)).is_err()) {
            tab["filePath"] = Value::Null;
            dropped += 1;
        }
    }
    dropped
}
