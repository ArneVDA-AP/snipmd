use snipmd_core::atomic::atomic_write;
use std::fs;
use std::path::PathBuf;

fn dir(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("snipmd-atomic-{}-{name}", std::process::id()));
    let _ = fs::remove_dir_all(&d);
    fs::create_dir_all(&d).unwrap();
    d
}

#[test]
fn creates_new_target() {
    let d = dir("new");
    atomic_write(&d.join("a.md"), b"hello").unwrap();
    assert_eq!(fs::read(d.join("a.md")).unwrap(), b"hello");
    assert_eq!(fs::read_dir(&d).unwrap().count(), 1);
}

#[test]
fn replaces_existing_completely() {
    let d = dir("replace");
    fs::write(d.join("a.md"), b"long old content").unwrap();
    atomic_write(&d.join("a.md"), b"new").unwrap();
    assert_eq!(fs::read(d.join("a.md")).unwrap(), b"new");
}

#[test]
fn failed_rename_leaves_target_and_no_tmp() {
    let d = dir("fail");
    let target = d.join("a.md");
    fs::create_dir(&target).unwrap();
    fs::write(target.join("keep.txt"), b"x").unwrap();
    assert!(atomic_write(&target, b"data").is_err());
    assert!(target.is_dir());
    assert_eq!(fs::read(target.join("keep.txt")).unwrap(), b"x");
    let names: Vec<_> = fs::read_dir(&d).unwrap().map(|e| e.unwrap().file_name()).collect();
    assert_eq!(names.len(), 1, "unexpected entries: {names:?}");
}

#[test]
fn missing_parent_errs_and_creates_nothing() {
    let d = dir("missing");
    let target = d.join("nope").join("a.md");
    assert!(atomic_write(&target, b"data").is_err());
    assert_eq!(fs::read_dir(&d).unwrap().count(), 0);
}

#[test]
fn two_writes_keep_the_second() {
    let d = dir("twice");
    atomic_write(&d.join("a.md"), b"first content").unwrap();
    atomic_write(&d.join("a.md"), b"2nd").unwrap();
    assert_eq!(fs::read(d.join("a.md")).unwrap(), b"2nd");
    assert_eq!(fs::read_dir(&d).unwrap().count(), 1);
}
