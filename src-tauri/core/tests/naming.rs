use chrono::NaiveDate;
use snipmd_core::atomic::create_unique;
use snipmd_core::naming::{create_snip, image_ext, snip_name};
use std::fs;
use std::path::{Path, PathBuf};

fn dir(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("snipmd-naming-{}-{name}", std::process::id()));
    let _ = fs::remove_dir_all(&d);
    fs::create_dir_all(&d).unwrap();
    d
}

fn t() -> chrono::NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 10, 20).unwrap().and_hms_milli_opt(14, 22, 11, 87).unwrap()
}

#[test]
fn snip_name_formats_and_pads() {
    assert_eq!(snip_name(t(), 0x3fa9, "png"), "snip-20261020-142211-087-3fa9.png");
    assert_eq!(snip_name(t(), 0x000a, "jpg"), "snip-20261020-142211-087-000a.jpg");
}

#[test]
fn create_snip_writes_new_file_and_never_overwrites() {
    let d = dir("snip");
    // Fill many names created in the same moment: every call must produce a new file.
    let mut seen = Vec::new();
    for i in 0..20u8 {
        let p = create_snip(&d, "png", &[i]).unwrap();
        assert_eq!(fs::read(&p).unwrap(), vec![i]);
        assert!(!seen.contains(&p));
        seen.push(p);
    }
    // A scripted name sequence hitting existing files keeps their bytes.
    let (a, _) = create_unique(&d, || "x1.png".into()).unwrap();
    fs::write(&a, b"keep").unwrap();
    let mut names = vec!["x1.png", "x2.png"].into_iter();
    let (b, _) = create_unique(&d, || names.next().unwrap().into()).unwrap();
    assert_eq!(b, d.join("x2.png"));
    assert_eq!(fs::read(&a).unwrap(), b"keep");
}

#[test]
fn create_snip_in_missing_folder_errs_and_creates_nothing() {
    let d = dir("missing").join("nope");
    assert!(create_snip(&d, "png", b"x").is_err());
    assert!(!d.exists());
}

#[test]
fn image_ext_accepts_images_only() {
    assert_eq!(image_ext(Path::new("a/B.PNG")), Some("png"));
    assert_eq!(image_ext(Path::new("a.jpeg")), Some("jpeg"));
    assert_eq!(image_ext(Path::new("a.WebP")), Some("webp"));
    assert_eq!(image_ext(Path::new("a.md")), None);
    assert_eq!(image_ext(Path::new("a.svg")), None);
    assert_eq!(image_ext(Path::new("png")), None);
}
