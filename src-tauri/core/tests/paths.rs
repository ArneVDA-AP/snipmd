use snipmd_core::paths::{resolve_image, AllowedSet};
use snipmd_core::PathError;
use std::path::Path;

fn dir() -> &'static Path {
    Path::new("/notes")
}

#[test]
fn rejects_bad_links() {
    let cases: &[(&str, fn(&PathError) -> bool)] = &[
        ("../x.png", |e| matches!(e, PathError::Escapes(_))),
        ("a/../../x.png", |e| matches!(e, PathError::Escapes(_))),
        ("%2e%2e/x.png", |e| matches!(e, PathError::Escapes(_))),
        ("/etc/x", |e| matches!(e, PathError::NotRelative(_))),
        ("C:\\x.png", |e| matches!(e, PathError::NotRelative(_))),
        ("C:x.png", |e| matches!(e, PathError::NotRelative(_))),
        ("\\\\srv\\share\\x.png", |e| matches!(e, PathError::NotRelative(_))),
        ("//srv/share/x.png", |e| matches!(e, PathError::NotRelative(_))),
        ("a.png:evil", |e| matches!(e, PathError::Forbidden(_))),
        ("a%3Aevil", |e| matches!(e, PathError::NotRelative(_))),
        ("ab%3Aevil", |e| matches!(e, PathError::Forbidden(_))),
        ("%zz", |e| matches!(e, PathError::Invalid(_))),
        ("a%2", |e| matches!(e, PathError::Invalid(_))),
        ("", |e| matches!(e, PathError::Invalid(_))),
        ("a%00b", |e| matches!(e, PathError::Forbidden(_))),
        ("..%5Cx.png", |e| matches!(e, PathError::Escapes(_))),
    ];
    for (link, ok) in cases {
        let r = resolve_image(dir(), link);
        assert!(r.as_ref().err().is_some_and(ok), "{link:?} gave {r:?}");
    }
}

#[test]
fn accepts_inside_links() {
    let d = dir();
    assert_eq!(resolve_image(d, "a.png").unwrap(), d.join("a.png"));
    assert_eq!(resolve_image(d, "./sub/a.png").unwrap(), d.join("sub").join("a.png"));
    assert_eq!(resolve_image(d, "sub/../a.png").unwrap(), d.join("a.png"));
    assert_eq!(resolve_image(d, "sub\\a.png").unwrap(), d.join("sub").join("a.png"));
    assert_eq!(
        resolve_image(d, "labo%2004.assets/snip.png").unwrap(),
        d.join("labo 04.assets").join("snip.png")
    );
}

fn set() -> AllowedSet {
    let mut s = AllowedSet::new();
    s.allow_note(Path::new("C:\\notes\\a.md"));
    s
}

#[test]
fn note_and_assets_pass() {
    let s = set();
    assert!(s.check(Path::new("C:\\notes\\a.md")).is_ok());
    assert!(s.check(Path::new("C:/notes/./x/../a.md")).is_ok());
    assert!(s.check(Path::new("C:\\notes\\a.assets")).is_ok());
    assert!(s.check(Path::new("C:\\notes\\a.assets\\sub\\snip.png")).is_ok());
    assert_eq!(
        s.check(Path::new("C:\\notes\\a.assets\\snip.png")).unwrap(),
        Path::new("C:/notes/a.assets/snip.png")
    );
}

#[test]
fn everything_else_fails() {
    let s = set();
    for p in [
        "C:\\notes\\b.md",
        "C:\\notes\\a.md.evil",
        "C:\\notes-other\\x",
        "C:\\notes\\a.assets-x\\y.png",
        "C:\\notes\\a.assets\\..\\b.md",
        "C:\\notes\\..\\secret.txt",
        "C:\\notes",
    ] {
        assert!(
            matches!(s.check(Path::new(p)), Err(PathError::NotAllowed(_))),
            "{p}"
        );
    }
}

#[test]
fn relative_input_is_not_relative_error() {
    let s = set();
    for p in ["a.md", "..\\a.md", "C:a.md"] {
        assert!(matches!(s.check(Path::new(p)), Err(PathError::NotRelative(_))), "{p}");
    }
}

#[test]
fn allow_dir_covers_subfolders() {
    let mut s = AllowedSet::new();
    s.allow_dir(Path::new("/data/scratch"));
    assert!(s.check(Path::new("/data/scratch")).is_ok());
    assert!(s.check(Path::new("/data/scratch/t1/x.png")).is_ok());
    assert!(s.check(Path::new("/data/scratch2/x.png")).is_err());
    assert!(s.check(Path::new("/data/scratch/../x.png")).is_err());
}

#[test]
fn windows_trimmed_components_are_refused() {
    // Windows strips trailing dots and spaces, so `.. ` would escape like `..`.
    for link in [".. /x.png", "a/.. /.. /x.png", "..%20/x.png", "a.png.", "sub./a.png", "a.png "] {
        assert!(resolve_image(dir(), link).is_err(), "{link}");
    }
    let s = set();
    for p in [
        "C:\\notes\\a.assets\\.. \\.. \\Windows\\win.ini",
        "C:\\notes\\a.assets\\x.png.",
        "C:\\notes\\a.md ",
    ] {
        assert!(s.check(Path::new(p)).is_err(), "{p}");
    }
}

#[test]
fn resolve_untitled_stays_in_tab_folder() {
    use snipmd_core::paths::resolve_untitled;
    let tab = Path::new("/scratch/abc");
    assert_eq!(resolve_untitled(tab, "untitled.assets/x.png").unwrap(), tab.join("x.png"));
    for bad in ["../x.png", "x.png", "other.assets/x.png", "untitled.assets/", "untitled.assets", "untitled.assets/../x"] {
        assert!(resolve_untitled(tab, bad).is_err(), "{bad}");
    }
}

#[test]
fn valid_tab_id_rules() {
    use snipmd_core::paths::valid_tab_id;
    assert!(valid_tab_id("123e4567-e89b-12d3-a456-426614174000"));
    for bad in ["", "..", "a/b", "a:b", "a\\b"] {
        assert!(!valid_tab_id(bad), "{bad}");
    }
    assert!(valid_tab_id(&"a".repeat(64)));
    assert!(!valid_tab_id(&"a".repeat(65)));
}

#[test]
fn allow_file_allows_only_that_file() {
    let mut a = AllowedSet::new();
    a.allow_file(Path::new("/n/a.png"));
    assert!(a.check(Path::new("/n/a.png")).is_ok());
    assert!(a.check(Path::new("/n/b.png")).is_err());
    assert!(a.check(Path::new("/n")).is_err());
}
