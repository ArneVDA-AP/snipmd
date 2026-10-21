use snipmd_core::assets::assets_dir_for;
use std::path::Path;

#[test]
fn image_folder_sits_next_to_the_note_under_its_stem() {
    assert_eq!(assets_dir_for(Path::new("/n/labo-04.md")), Path::new("/n/labo-04.assets"));
    assert_eq!(assets_dir_for(Path::new("/n/a.b.markdown")), Path::new("/n/a.b.assets"));
    assert_eq!(assets_dir_for(Path::new("/n/lab notes.md")), Path::new("/n/lab notes.assets"));
}

mod dirs {
    use snipmd_core::assets::{copy_dir, move_dir};
    use std::fs;
    use std::io::ErrorKind;
    use std::path::PathBuf;

    fn dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("snipmd-assets-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(d.join("from/sub")).unwrap();
        fs::write(d.join("from/a.png"), b"A").unwrap();
        fs::write(d.join("from/sub/b.png"), b"B").unwrap();
        d
    }

    #[test]
    fn copy_copies_nested_and_keeps_source() {
        let d = dir("copy");
        copy_dir(&d.join("from"), &d.join("to")).unwrap();
        assert_eq!(fs::read(d.join("to/a.png")).unwrap(), b"A");
        assert_eq!(fs::read(d.join("to/sub/b.png")).unwrap(), b"B");
        assert_eq!(fs::read(d.join("from/sub/b.png")).unwrap(), b"B");
    }

    #[test]
    fn copy_never_overwrites() {
        let d = dir("nooverwrite");
        fs::create_dir(d.join("to")).unwrap();
        fs::write(d.join("to/a.png"), b"MINE").unwrap();
        let e = copy_dir(&d.join("from"), &d.join("to")).unwrap_err();
        assert_eq!(e.kind(), ErrorKind::AlreadyExists);
        assert_eq!(fs::read(d.join("to/a.png")).unwrap(), b"MINE");
    }

    #[test]
    fn copy_with_missing_parent_errs_and_creates_nothing() {
        let d = dir("noparent");
        assert!(copy_dir(&d.join("from"), &d.join("x/y/to")).is_err());
        assert!(!d.join("x").exists());
    }

    #[test]
    fn move_to_new_folder() {
        let d = dir("move");
        move_dir(&d.join("from"), &d.join("to")).unwrap();
        assert!(!d.join("from").exists());
        assert_eq!(fs::read(d.join("to/sub/b.png")).unwrap(), b"B");
    }

    #[test]
    fn move_into_existing_merges_and_removes_source() {
        let d = dir("merge");
        fs::create_dir(d.join("to")).unwrap();
        fs::write(d.join("to/other.png"), b"O").unwrap();
        move_dir(&d.join("from"), &d.join("to")).unwrap();
        assert!(!d.join("from").exists());
        assert_eq!(fs::read(d.join("to/other.png")).unwrap(), b"O");
        assert_eq!(fs::read(d.join("to/a.png")).unwrap(), b"A");
    }

    #[test]
    fn move_with_a_clash_keeps_the_source() {
        let d = dir("clash");
        fs::create_dir(d.join("to")).unwrap();
        fs::write(d.join("to/a.png"), b"MINE").unwrap();
        assert!(move_dir(&d.join("from"), &d.join("to")).is_err());
        assert_eq!(fs::read(d.join("from/a.png")).unwrap(), b"A");
        assert_eq!(fs::read(d.join("to/a.png")).unwrap(), b"MINE");
    }

    #[test]
    fn move_of_missing_source_is_not_found() {
        let d = dir("missing");
        let e = move_dir(&d.join("nope"), &d.join("to")).unwrap_err();
        assert_eq!(e.kind(), ErrorKind::NotFound);
    }

    #[test]
    fn copy_into_its_own_subfolder_is_refused_and_creates_nothing() {
        let d = dir("self");
        let e = copy_dir(&d.join("from"), &d.join("from/sub/inner")).unwrap_err();
        assert_eq!(e.kind(), ErrorKind::InvalidInput);
        assert!(!d.join("from/sub/inner").exists());
        assert!(copy_dir(&d.join("from"), &d.join("from")).is_err());
    }

    #[test]
    fn a_move_called_again_moves_what_is_left() {
        let d = dir("again");
        fs::create_dir(d.join("to")).unwrap();
        fs::write(d.join("to/a.png"), b"MINE").unwrap();
        assert!(move_dir(&d.join("from"), &d.join("to")).is_err());
        fs::remove_file(d.join("to/a.png")).unwrap();
        move_dir(&d.join("from"), &d.join("to")).unwrap();
        assert_eq!(fs::read(d.join("to/a.png")).unwrap(), b"A");
        assert_eq!(fs::read(d.join("to/sub/b.png")).unwrap(), b"B");
        assert!(!d.join("from").exists());
    }
}
