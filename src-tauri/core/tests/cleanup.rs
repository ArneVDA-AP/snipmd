use snipmd_core::cleanup::{clean_scratch, scan_scratch, select_for_cleanup, SCRATCH_GRACE};
use std::collections::HashMap;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

const DAY: Duration = Duration::from_secs(24 * 60 * 60);

fn now() -> SystemTime {
    SystemTime::now()
}

fn scratch(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("snipmd-cleanup-{}-{name}", std::process::id()));
    let _ = fs::remove_dir_all(&d);
    fs::create_dir_all(&d).unwrap();
    d
}

fn set_age(p: &Path, age: Duration) {
    let t = now() - age;
    File::options().write(true).open(p).unwrap().set_modified(t).unwrap();
}

/// Windows opens a folder only with backup semantics, and setting its time needs write-attributes access.
fn age_dir(p: &Path, age: Duration) {
    #[cfg(windows)]
    let dir = {
        use std::os::windows::fs::OpenOptionsExt;
        const FILE_WRITE_ATTRIBUTES: u32 = 0x100;
        const FILE_FLAG_BACKUP_SEMANTICS: u32 = 0x0200_0000;
        fs::OpenOptions::new().access_mode(FILE_WRITE_ATTRIBUTES).custom_flags(FILE_FLAG_BACKUP_SEMANTICS).open(p).unwrap()
    };
    #[cfg(not(windows))]
    let dir = File::open(p).unwrap();
    dir.set_modified(now() - age).unwrap();
}

/// A tab folder with the given items, each at its own age; the folder itself gets `dir_age`.
fn tab(root: &Path, id: &str, dir_age: Duration, items: &[(&str, Duration)]) -> PathBuf {
    let dir = root.join(id);
    fs::create_dir_all(&dir).unwrap();
    for (name, age) in items {
        let p = dir.join(name);
        fs::write(&p, b"png").unwrap();
        set_age(&p, *age);
    }
    age_dir(&dir, dir_age);
    dir
}

fn selected(root: &Path, live: &HashMap<String, Option<String>>) -> Vec<PathBuf> {
    let entries = scan_scratch(root).unwrap();
    let mut v: Vec<PathBuf> = select_for_cleanup(&entries, live, now(), SCRATCH_GRACE).into_iter().map(|e| e.path.clone()).collect();
    v.sort();
    v
}

fn live(pairs: &[(&str, Option<&str>)]) -> HashMap<String, Option<String>> {
    pairs.iter().map(|(k, v)| (k.to_string(), v.map(str::to_string))).collect()
}

#[test]
fn grace_is_fourteen_days() {
    assert_eq!(SCRATCH_GRACE, 14 * DAY);
}

#[test]
fn old_folder_of_a_dead_tab_is_selected_alone() {
    let root = scratch("deadold");
    let dir = tab(&root, "t1", 20 * DAY, &[("a.png", 20 * DAY), ("b.png", 15 * DAY)]);
    assert_eq!(selected(&root, &live(&[])), vec![dir]);
}

#[test]
fn dead_folder_with_one_young_item_is_kept() {
    let root = scratch("deadyoung");
    tab(&root, "t1", 20 * DAY, &[("a.png", 20 * DAY), ("b.png", 2 * DAY)]);
    assert!(selected(&root, &live(&[])).is_empty());
}

#[test]
fn young_dead_folder_is_kept() {
    let root = scratch("deadyoungdir");
    tab(&root, "t1", DAY, &[("a.png", 20 * DAY)]);
    assert!(selected(&root, &live(&[])).is_empty());
}

#[test]
fn old_folder_of_a_live_tab_is_kept() {
    let root = scratch("liveold");
    tab(&root, "t1", 20 * DAY, &[]);
    assert!(selected(&root, &live(&[("t1", Some(""))])).is_empty());
    assert!(selected(&root, &live(&[("t1", None)])).is_empty());
}

#[test]
fn unreferenced_old_item_of_a_tab_with_text_is_selected() {
    let root = scratch("unref");
    let dir = tab(&root, "t1", 20 * DAY, &[("a.png", 20 * DAY), ("lab shot.png", 20 * DAY), ("c.png", 20 * DAY)]);
    let text = "![](t1/a.png) and ![](t1/lab%20shot.png)";
    assert_eq!(selected(&root, &live(&[("t1", Some(text))])), vec![dir.join("c.png")]);
    let plain = "![](t1/a.png) ![](<t1/lab shot.png>) ![](t1/c.png)";
    assert!(selected(&root, &live(&[("t1", Some(plain))])).is_empty());
}

#[test]
fn items_of_a_tab_without_known_text_are_kept() {
    let root = scratch("none");
    tab(&root, "t1", 20 * DAY, &[("a.png", 20 * DAY), ("b.png", 30 * DAY)]);
    assert!(selected(&root, &live(&[("t1", None)])).is_empty());
}

#[test]
fn young_and_future_items_are_kept() {
    let root = scratch("young");
    let dir = tab(&root, "t1", 20 * DAY, &[("young.png", 13 * DAY)]);
    let future = dir.join("future.png");
    fs::write(&future, b"png").unwrap();
    File::options().write(true).open(&future).unwrap().set_modified(now() + 30 * DAY).unwrap();
    age_dir(&dir, 20 * DAY);
    assert!(selected(&root, &live(&[("t1", Some(""))])).is_empty());
    // A dead folder holding a future item is kept as well.
    assert!(selected(&root, &live(&[])).is_empty());
}

#[test]
fn loose_files_and_invalid_folder_names_are_never_listed() {
    let root = scratch("loose");
    let loose = root.join("loose.png");
    fs::write(&loose, b"png").unwrap();
    set_age(&loose, 30 * DAY);
    tab(&root, "not valid", 30 * DAY, &[("a.png", 30 * DAY)]);
    tab(&root, "CON", 30 * DAY, &[("a.png", 30 * DAY)]);
    let entries = scan_scratch(&root).unwrap();
    assert!(entries.is_empty(), "{entries:?}");
    assert_eq!(clean_scratch(&root, &live(&[]), now(), SCRATCH_GRACE), 0);
    assert!(loose.exists() && root.join("not valid/a.png").exists());
}

#[test]
fn scan_lists_folder_and_direct_items_only() {
    let root = scratch("scan");
    let dir = tab(&root, "t1", 20 * DAY, &[("a.png", 20 * DAY)]);
    fs::create_dir_all(dir.join("sub")).unwrap();
    fs::write(dir.join("sub/deep.png"), b"png").unwrap();
    let mut paths: Vec<_> = scan_scratch(&root).unwrap().into_iter().map(|e| (e.path, e.is_dir)).collect();
    paths.sort();
    assert_eq!(paths, vec![(dir.clone(), true), (dir.join("a.png"), false), (dir.join("sub"), false)]);
}

#[test]
fn clean_removes_exactly_the_selected_paths() {
    let root = scratch("clean");
    let dead = tab(&root, "dead", 20 * DAY, &[("a.png", 20 * DAY)]);
    let kept = tab(&root, "deadyoung", 20 * DAY, &[("a.png", DAY)]);
    let alive = tab(&root, "alive", 20 * DAY, &[("used.png", 20 * DAY), ("unused.png", 20 * DAY)]);
    let unknown = tab(&root, "disk", 20 * DAY, &[("x.png", 20 * DAY)]);
    let l = live(&[("alive", Some("![](alive/used.png)")), ("disk", None)]);
    assert_eq!(clean_scratch(&root, &l, now(), SCRATCH_GRACE), 2);
    assert!(!dead.exists());
    assert!(kept.join("a.png").exists());
    assert!(alive.join("used.png").exists() && !alive.join("unused.png").exists());
    assert!(unknown.join("x.png").exists());
}

#[test]
fn missing_scratch_gives_zero_and_creates_nothing() {
    let root = scratch("missing").join("nope");
    assert!(scan_scratch(&root).unwrap().is_empty());
    assert_eq!(clean_scratch(&root, &live(&[]), now(), SCRATCH_GRACE), 0);
    assert!(!root.exists());
}

#[test]
fn a_name_is_matched_as_the_resolver_reads_the_link() {
    let root = scratch("resolved");
    let old = 20 * DAY;
    let dir = tab(&root, "t7", old, &[("snip-1.png", old), ("my pic (1).png", old), ("Shot.png", old), ("gone.png", old)]);
    let text = "![](untitled.assets/snip%2D1.png)\n![](untitled.assets/my%20pic%20(1).png)\n![](untitled.assets/shot.PNG) 50% done";
    assert_eq!(selected(&root, &live(&[("t7", Some(text))])), vec![dir.join("gone.png")]);
}

#[test]
fn a_dead_folder_with_a_young_file_deeper_down_is_kept() {
    let root = scratch("deeper");
    let old = 20 * DAY;
    let dir = tab(&root, "t8", old, &[("a.png", old)]);
    let sub = dir.join("sub");
    fs::create_dir(&sub).unwrap();
    fs::write(sub.join("young.png"), b"png").unwrap();
    age_dir(&sub, old);
    age_dir(&dir, old);
    assert!(selected(&root, &live(&[])).is_empty());
}
