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

#[test]
fn create_unique_skips_taken_and_gives_up_after_64() {
    use snipmd_core::atomic::create_unique;
    let d = dir("unique");
    fs::write(d.join("a"), b"old").unwrap();
    let mut n = vec!["a", "b"].into_iter();
    let (p, _) = create_unique(&d, || n.next().unwrap().into()).unwrap();
    assert_eq!(p, d.join("b"));
    assert_eq!(fs::read(d.join("a")).unwrap(), b"old");
    let mut calls = 0;
    let e = create_unique(&d, || { calls += 1; "a".into() }).unwrap_err();
    assert_eq!(e.kind(), std::io::ErrorKind::AlreadyExists);
    assert_eq!(calls, 64);
}

#[cfg(unix)]
#[test]
fn write_through_symlink_keeps_the_link() {
    let d = dir("symlink");
    fs::write(d.join("real.md"), b"old").unwrap();
    std::os::unix::fs::symlink(d.join("real.md"), d.join("link.md")).unwrap();
    atomic_write(&d.join("link.md"), b"new").unwrap();
    assert!(fs::symlink_metadata(d.join("link.md")).unwrap().file_type().is_symlink());
    assert_eq!(fs::read(d.join("real.md")).unwrap(), b"new");
}

#[test]
fn read_only_target_is_refused_and_kept() {
    let d = dir("readonly");
    let t = d.join("a.md");
    fs::write(&t, b"keep").unwrap();
    let mut perm = fs::metadata(&t).unwrap().permissions();
    perm.set_readonly(true);
    fs::set_permissions(&t, perm).unwrap();
    let e = atomic_write(&t, b"new").unwrap_err();
    assert_eq!(e.kind(), std::io::ErrorKind::PermissionDenied);
    assert_eq!(fs::read(&t).unwrap(), b"keep");
    assert_eq!(fs::read_dir(&d).unwrap().count(), 1);
}
