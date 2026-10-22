use snipmd_core::note::{read, stamp, write, DiskStamp, WriteOutcome};
use snipmd_core::text::TextFormat;
use std::fs::{self, File};
use std::path::PathBuf;
use std::time::Duration;

fn dir(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("snipmd-note-{}-{name}", std::process::id()));
    let _ = fs::remove_dir_all(&d);
    fs::create_dir_all(&d).unwrap();
    d
}

fn written(out: WriteOutcome) -> DiskStamp {
    match out {
        WriteOutcome::Written { written } => written,
        other => panic!("not written: {other:?}"),
    }
}

#[test]
fn a_new_note_gets_the_new_file_format_and_comes_back_with_the_stamp_it_reports() {
    let d = dir("new");
    let p = d.join("a.md");
    let s = written(write(&p, "a\nb", None, None).unwrap());
    assert_eq!(fs::read(&p).unwrap(), snipmd_core::text::encode("a\nb", TextFormat::NEW_FILE));
    assert_eq!(stamp(&p).unwrap(), Some(s));
    let note = read(&p).unwrap();
    assert_eq!((note.text.as_str(), note.format, note.stamp), ("a\nb", TextFormat::NEW_FILE, s));
}

#[test]
fn a_write_without_a_format_keeps_the_file_s_line_endings_and_bom() {
    let d = dir("keep");
    let p = d.join("a.md");
    fs::write(&p, b"\xEF\xBB\xBFold\r\n").unwrap();
    write(&p, "x\ny", None, None).unwrap();
    assert_eq!(fs::read(&p).unwrap(), b"\xEF\xBB\xBFx\r\ny");
    write(&p, "x\ny", Some(TextFormat { crlf: false, bom: false }), None).unwrap();
    assert_eq!(fs::read(&p).unwrap(), b"x\ny");
}

#[test]
fn a_write_with_the_stamp_the_tab_knows_goes_through() {
    let d = dir("match");
    let p = d.join("a.md");
    let s = written(write(&p, "one", None, None).unwrap());
    assert!(matches!(write(&p, "two", None, Some(s)).unwrap(), WriteOutcome::Written { .. }));
    assert_eq!(read(&p).unwrap().text, "two");
}

#[test]
fn a_file_changed_outside_is_not_written_and_its_stamp_now_comes_back() {
    let d = dir("changed");
    let p = d.join("a.md");
    let s = written(write(&p, "mine", None, None).unwrap());
    fs::write(&p, "changed outside, longer").unwrap();
    let now = stamp(&p).unwrap();
    assert_ne!(now, Some(s));
    assert_eq!(write(&p, "mine again", None, Some(s)).unwrap(), WriteOutcome::Changed { changed: now });
    assert_eq!(fs::read_to_string(&p).unwrap(), "changed outside, longer");
}

#[test]
fn a_change_that_keeps_the_size_but_moves_the_time_is_a_change_too() {
    let d = dir("mtime");
    let p = d.join("a.md");
    let s = written(write(&p, "mine", None, None).unwrap());
    let f = File::options().write(true).open(&p).unwrap();
    f.set_modified(f.metadata().unwrap().modified().unwrap() + Duration::from_secs(2)).unwrap();
    assert!(matches!(write(&p, "mine again", None, Some(s)).unwrap(), WriteOutcome::Changed { changed: Some(_) }));
    assert_eq!(fs::read_to_string(&p).unwrap(), "mine");
}

#[test]
fn a_file_gone_outside_is_not_recreated_by_a_stamped_write_but_is_by_save_again() {
    let d = dir("gone");
    let p = d.join("a.md");
    let s = written(write(&p, "mine", None, None).unwrap());
    fs::remove_file(&p).unwrap();
    assert_eq!(write(&p, "mine", None, Some(s)).unwrap(), WriteOutcome::Changed { changed: None });
    assert!(!p.exists());
    // Save again: the tab dropped its stamp, so the write recreates the file.
    written(write(&p, "mine", None, None).unwrap());
    assert_eq!(read(&p).unwrap().text, "mine");
}

#[test]
fn a_stamp_is_whole_milliseconds_and_none_for_a_missing_file() {
    let d = dir("stamp");
    let p = d.join("a.md");
    assert_eq!(stamp(&p).unwrap(), None);
    fs::write(&p, "abc").unwrap();
    let s = stamp(&p).unwrap().unwrap();
    assert_eq!(s.mtime_ms.fract(), 0.0);
    assert_eq!(s.size, 3);
}

#[test]
fn a_note_that_is_not_utf8_is_refused_by_name() {
    let d = dir("utf8");
    let p = d.join("caf.md");
    fs::write(&p, b"caf\xe9").unwrap();
    assert_eq!(read(&p).unwrap_err(), "caf.md is not UTF-8 text");
    assert!(read(&d.join("nope.md")).unwrap_err().starts_with("Failed to read nope.md: "));
}

#[test]
fn a_failed_write_names_the_note_and_leaves_no_file() {
    let d = dir("fail");
    let p = d.join("missing").join("a.md");
    let err = write(&p, "x", None, None).unwrap_err();
    assert!(err.starts_with("Failed to write a.md: "), "{err}");
    assert!(!d.join("missing").exists());
}

#[test]
fn a_stamp_is_the_file_time_in_milliseconds() {
    let d = dir("ms");
    let p = d.join("a.md");
    fs::write(&p, "abc").unwrap();
    File::options().write(true).open(&p).unwrap().set_modified(std::time::UNIX_EPOCH + Duration::from_millis(1_700_000_000_123)).unwrap();
    assert_eq!(stamp(&p).unwrap().unwrap(), DiskStamp { mtime_ms: 1_700_000_000_123.0, size: 3 });
}

// A path under a file cannot be stat'ed ("not a directory"), which is not the same as a file that is
// gone: the write must report the error, not act as if the note was deleted. Windows reports that
// path as not found, so the case is checked on Unix only.
#[cfg(unix)]
#[test]
fn a_stat_that_fails_is_an_error_not_a_gone_file() {
    let d = dir("enotdir");
    fs::write(d.join("file"), "x").unwrap();
    let p = d.join("file").join("a.md");
    assert!(stamp(&p).is_err());
    let err = write(&p, "x", None, Some(DiskStamp { mtime_ms: 1.0, size: 1 })).unwrap_err();
    assert!(err.starts_with("Failed to check a.md before saving: "), "{err}");
}

#[test]
fn the_format_is_read_past_a_long_first_line() {
    let d = dir("longline");
    let p = d.join("a.md");
    let line = "a".repeat(5000);
    fs::write(&p, format!("{line}\r\nb\r\n")).unwrap();
    write(&p, "x\ny", None, None).unwrap();
    assert_eq!(fs::read(&p).unwrap(), b"x\r\ny");
}
