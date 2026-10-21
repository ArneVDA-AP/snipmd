use snipmd_core::cleanup::{clean_scratch, scan_scratch, select_for_cleanup, SCRATCH_GRACE};
use std::collections::HashMap;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

const DAY: Duration = Duration::from_secs(86_400);

fn root(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("snipmd-cleanup-{}-{name}", std::process::id()));
    let _ = fs::remove_dir_all(&d);
    fs::create_dir_all(&d).unwrap();
    d
}

fn age(p: &Path, by: Duration, now: SystemTime) {
    File::open(p).unwrap().set_modified(now - by).unwrap();
}

fn item(scratch: &Path, tab: &str, name: &str, by: Duration, now: SystemTime) -> PathBuf {
    let dir = scratch.join(tab);
    fs::create_dir_all(&dir).unwrap();
    let p = dir.join(name);
    fs::write(&p, b"x").unwrap();
    age(&p, by, now);
    p
}

fn age_dir(scratch: &Path, tab: &str, by: Duration, now: SystemTime) {
    age(&scratch.join(tab), by, now);
}

fn live(pairs: &[(&str, Option<&str>)]) -> HashMap<String, Option<String>> {
    pairs.iter().map(|(k, v)| (k.to_string(), v.map(String::from))).collect()
}

fn selected(s: &Path, l: &HashMap<String, Option<String>>, now: SystemTime) -> Vec<PathBuf> {
    let mut v = select_for_cleanup(&scan_scratch(s).unwrap(), l, now, SCRATCH_GRACE);
    v.sort();
    v
}

#[test]
fn old_folder_of_a_dead_tab_is_selected_alone() {
    let s = root("dead");
    let now = SystemTime::now();
    item(&s, "tab1", "a.png", 20 * DAY, now);
    age_dir(&s, "tab1", 20 * DAY, now);
    assert_eq!(selected(&s, &live(&[]), now), vec![s.join("tab1")]);
}

#[test]
fn one_young_item_keeps_the_whole_folder() {
    let s = root("young-item");
    let now = SystemTime::now();
    item(&s, "tab1", "a.png", 20 * DAY, now);
    item(&s, "tab1", "b.png", DAY, now);
    age_dir(&s, "tab1", 20 * DAY, now);
    assert!(selected(&s, &live(&[]), now).is_empty());
}

#[test]
fn old_folder_of_a_live_tab_is_kept() {
    let s = root("live-folder");
    let now = SystemTime::now();
    fs::create_dir_all(s.join("tab1")).unwrap();
    age_dir(&s, "tab1", 20 * DAY, now);
    assert!(selected(&s, &live(&[("tab1", Some(""))]), now).is_empty());
}

#[test]
fn unreferenced_old_item_is_selected_referenced_ones_are_kept() {
    let s = root("refs");
    let now = SystemTime::now();
    let gone = item(&s, "tab1", "gone.png", 20 * DAY, now);
    item(&s, "tab1", "named.png", 20 * DAY, now);
    item(&s, "tab1", "with space.png", 20 * DAY, now);
    item(&s, "tab1", "other space.png", 20 * DAY, now);
    let text = "![](tab1/named.png) ![](with%20space.png) ![](other space.png)";
    assert_eq!(selected(&s, &live(&[("tab1", Some(text))]), now), vec![gone]);
}

#[test]
fn tab_without_known_text_keeps_every_item() {
    let s = root("none");
    let now = SystemTime::now();
    item(&s, "tab1", "a.png", 30 * DAY, now);
    assert!(selected(&s, &live(&[("tab1", None)]), now).is_empty());
}

#[test]
fn young_and_future_items_are_kept() {
    let s = root("young");
    let now = SystemTime::now();
    item(&s, "tab1", "young.png", 13 * DAY, now);
    let f = item(&s, "tab1", "future.png", Duration::ZERO, now);
    File::open(&f).unwrap().set_modified(now + DAY).unwrap();
    assert!(selected(&s, &live(&[("tab1", Some(""))]), now).is_empty());
}

#[test]
fn loose_files_and_invalid_folder_ids_are_not_listed() {
    let s = root("scan");
    let now = SystemTime::now();
    fs::write(s.join("loose.png"), b"x").unwrap();
    item(&s, "bad id!", "a.png", 20 * DAY, now);
    item(&s, "tab1", "a.png", 20 * DAY, now);
    fs::create_dir_all(s.join("tab1/deeper")).unwrap();
    fs::write(s.join("tab1/deeper/c.png"), b"x").unwrap();
    let mut paths: Vec<_> = scan_scratch(&s).unwrap().into_iter().map(|e| e.path).collect();
    paths.sort();
    assert_eq!(paths, vec![s.join("tab1"), s.join("tab1/a.png"), s.join("tab1/deeper")]);
    assert!(scan_scratch(&s).unwrap().iter().all(|e| e.tab_id == "tab1"));
}

#[test]
fn clean_removes_exactly_the_selected_paths() {
    let s = root("clean");
    let now = SystemTime::now();
    item(&s, "dead", "a.png", 20 * DAY, now);
    age_dir(&s, "dead", 20 * DAY, now);
    let gone = item(&s, "alive", "gone.png", 20 * DAY, now);
    let kept = item(&s, "alive", "kept.png", 20 * DAY, now);
    let young = item(&s, "alive", "young.png", DAY, now);
    fs::write(s.join("loose.txt"), b"x").unwrap();
    let l = live(&[("alive", Some("kept.png"))]);
    assert_eq!(clean_scratch(&s, &l, now, SCRATCH_GRACE), 2);
    assert!(!s.join("dead").exists() && !gone.exists());
    assert!(kept.exists() && young.exists() && s.join("loose.txt").exists());
}

#[test]
fn missing_scratch_gives_zero_and_creates_nothing() {
    let s = root("missing").join("nope");
    assert_eq!(clean_scratch(&s, &live(&[]), SystemTime::now(), SCRATCH_GRACE), 0);
    assert!(!s.exists());
}
