use snipmd_core::session::{load, Loaded};
use std::fs;
use std::path::PathBuf;

fn dir(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("snipmd-session-{}-{name}", std::process::id()));
    let _ = fs::remove_dir_all(&d);
    fs::create_dir_all(&d).unwrap();
    d
}

fn json(s: &str) -> bool {
    s.trim_start().starts_with('{')
}

fn names(d: &PathBuf) -> Vec<String> {
    let mut v: Vec<String> = fs::read_dir(d).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
    v.sort();
    v
}

#[test]
fn missing_session_is_missing() {
    let d = dir("missing");
    assert_eq!(load(&d.join("session.json"), json).unwrap(), Loaded::Missing);
}

#[test]
fn valid_session_is_returned_and_left_in_place() {
    let d = dir("valid");
    fs::write(d.join("session.json"), "{\"tabs\":[]}").unwrap();
    assert_eq!(load(&d.join("session.json"), json).unwrap(), Loaded::Text("{\"tabs\":[]}".into()));
    assert_eq!(names(&d), ["session.json"]);
}

#[test]
fn a_session_that_is_not_utf8_is_kept_aside_with_its_bytes() {
    let d = dir("utf8");
    let bytes = b"{\"tabs\":[{\"content\":\"caf\xe9\"}]}";
    fs::write(d.join("session.json"), bytes).unwrap();
    let Loaded::SetAside(aside) = load(&d.join("session.json"), json).unwrap() else { panic!("not set aside") };
    assert!(!d.join("session.json").exists());
    assert_eq!(fs::read(aside).unwrap(), bytes);
}

#[test]
fn a_rejected_session_is_kept_aside() {
    let d = dir("invalid");
    fs::write(d.join("session.json"), "garbage").unwrap();
    assert!(matches!(load(&d.join("session.json"), json).unwrap(), Loaded::SetAside(_)));
    assert!(!d.join("session.json").exists());
}

#[test]
fn two_set_asides_in_a_row_keep_both() {
    let d = dir("twice");
    fs::write(d.join("session.json"), "one").unwrap();
    load(&d.join("session.json"), json).unwrap();
    fs::write(d.join("session.json"), "two").unwrap();
    load(&d.join("session.json"), json).unwrap();
    let kept: Vec<String> = names(&d).iter().map(|n| fs::read_to_string(d.join(n)).unwrap()).collect();
    assert_eq!(kept.len(), 2);
    assert!(kept.contains(&"one".into()) && kept.contains(&"two".into()));
}

// A path under a file fails to read with "not a directory" (not NotFound) and cannot be moved either.
// Windows reports that path as not found, so the case is checked on Unix only.
#[cfg(unix)]
#[test]
fn a_session_that_cannot_be_read_or_moved_is_an_error() {
    let d = dir("unmovable");
    fs::write(d.join("blocker"), "x").unwrap();
    let err = load(&d.join("blocker").join("session.json"), json);
    assert!(err.is_err(), "{err:?}");
}
