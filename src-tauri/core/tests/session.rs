use snipmd_core::session::{load, set_aside, Loaded};
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
    let Loaded::SetAside(aside) = load(&d.join("session.json"), json).unwrap() else { panic!("not set aside") };
    assert!(!d.join("session.json").exists());
    // The name the bar shows (SPEC §6.5): `session.unreadable-<time>.json`, no suffix on the first.
    let name = aside.file_name().unwrap().to_str().unwrap();
    let time = name.strip_prefix("session.unreadable-").and_then(|n| n.strip_suffix(".json")).unwrap_or("");
    assert!(!time.is_empty() && time.bytes().all(|b| b.is_ascii_digit()), "{name}");
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

#[test]
fn set_aside_lists_what_load_moved_and_nothing_else() {
    let d = dir("list");
    fs::write(d.join("session.json"), "bad").unwrap();
    let Loaded::SetAside(moved) = load(&d.join("session.json"), json).unwrap() else { panic!("not set aside") };
    fs::write(d.join("session.json"), "{}").unwrap();
    fs::write(d.join("perf.log"), "").unwrap();
    assert_eq!(set_aside(&d), vec![moved]);
}

mod texts {
    use super::dir;
    use serde_json::{json, Value};
    use snipmd_core::paths::AllowedSet;
    use snipmd_core::session::{drop_unallowed, known_texts, live_tabs, tabs, file_path};
    use std::fs;
    use std::path::Path;

    fn session() -> Value {
        json!({
            "tabs": [
                { "id": "u1", "filePath": null, "content": "![s](untitled.assets/one.png)" },
                { "id": "d1", "filePath": "C:/n/d1.md", "content": "" },
                { "id": "u2", "content": "no filePath key at all" }
            ],
            "closedTabs": [
                { "tab": { "id": "c1", "filePath": null, "content": "closed text" }, "closedAt": 1 },
                { "tab": { "id": "c2", "filePath": "C:/n/c2.md", "content": "stale" }, "closedAt": 2 },
                7
            ],
            "lastFolder": "C:/n"
        })
    }

    #[test]
    fn every_tab_open_and_closed_is_listed_with_its_path() {
        let s = session();
        let mut paths: Vec<Option<&str>> = tabs(&s).into_iter().map(file_path).collect();
        paths.sort();
        assert_eq!(paths, vec![None, None, None, Some("C:/n/c2.md"), Some("C:/n/d1.md")]);
        assert!(tabs(&json!([1, 2])).is_empty());
        assert!(tabs(&json!({ "tabs": "not a list" })).is_empty());
    }

    #[test]
    fn untitled_tabs_open_and_closed_have_known_text_and_disk_tabs_have_none() {
        let live = live_tabs(&session());
        let mut ids: Vec<_> = live.keys().cloned().collect();
        ids.sort();
        assert_eq!(ids, ["c1", "c2", "d1", "u1", "u2"]);
        assert_eq!(live["u1"].as_deref(), Some("\n![s](untitled.assets/one.png)"));
        assert_eq!(live["u2"].as_deref(), Some("\nno filePath key at all"));
        assert_eq!(live["c1"].as_deref(), Some("\nclosed text"));
        assert_eq!(live["d1"], None);
        assert_eq!(live["c2"], None);
    }

    #[test]
    fn an_id_seen_twice_keeps_both_texts_and_stays_unknown_once_a_disk_tab_had_it() {
        let s = json!({ "tabs": [{ "id": "x", "content": "a" }, { "id": "y", "content": "b" }],
                        "closedTabs": [{ "tab": { "id": "x", "content": "c" } }, { "tab": { "id": "y", "filePath": "C:/y.md" } }, { "tab": { "id": "y", "content": "d" } }] });
        let live = live_tabs(&s);
        let mut x: Vec<&str> = live["x"].as_deref().unwrap().lines().collect();
        x.sort();
        assert_eq!(x, ["", "a", "c"]);
        assert_eq!(live["y"], None);
        let s = json!({ "tabs": [{ "content": "no id" }, { "id": "" , "content": "empty id" }] });
        assert_eq!(live_tabs(&s).keys().collect::<Vec<_>>(), vec![""]);
    }

    #[test]
    fn nothing_may_be_cleaned_without_a_session_with_open_tabs() {
        let d = dir("texts-none");
        assert_eq!(known_texts(&d), None);
        fs::write(d.join("session.json"), "{not json").unwrap();
        assert_eq!(known_texts(&d), None);
        fs::write(d.join("session.json"), r#"{"tabs":[],"closedTabs":[{"tab":{"id":"c","content":"x"}}]}"#).unwrap();
        assert_eq!(known_texts(&d), None);
        fs::write(d.join("session.json"), r#"{"closedTabs":[]}"#).unwrap();
        assert_eq!(known_texts(&d), None);
    }

    #[test]
    fn the_texts_of_the_session_and_of_every_set_aside_session_are_known() {
        let d = dir("texts-aside");
        fs::write(d.join("session.json"), session().to_string()).unwrap();
        fs::write(d.join("session.unreadable-5.json"), b"{\"tabs\":[{\"id\":\"old\",\"content\":\"caf\xe9 snip-old.png\"").unwrap();
        fs::write(d.join("perf.log"), "snip-perf.png").unwrap();
        let live = known_texts(&d).unwrap();
        assert_eq!(live.len(), 6);
        assert_eq!(live["u1"].as_deref(), Some("\n![s](untitled.assets/one.png)"));
        let aside = live.iter().find(|(k, _)| k.starts_with("set-aside:")).map(|(_, v)| v.clone()).unwrap();
        assert_eq!(aside.as_deref(), Some("{\"tabs\":[{\"id\":\"old\",\"content\":\"caf\u{FFFD} snip-old.png\""));
    }

    #[test]
    fn a_set_aside_session_that_cannot_be_read_stops_the_cleanup() {
        let d = dir("texts-locked");
        fs::write(d.join("session.json"), session().to_string()).unwrap();
        fs::create_dir(d.join("session.unreadable-9.json")).unwrap(); // a folder: read fails, like a locked file
        assert_eq!(known_texts(&d), None);
    }

    #[test]
    fn paths_outside_the_allowed_set_are_nulled_and_counted() {
        let mut allowed = AllowedSet::new();
        allowed.allow_note(Path::new("C:/n/d1.md"));
        let mut s = session();
        assert_eq!(drop_unallowed(&mut s, &allowed), 1); // the closed c2.md; lastFolder is d1's folder
        assert_eq!(s["tabs"][1]["filePath"], "C:/n/d1.md");
        assert_eq!(s["lastFolder"], "C:/n");
        assert_eq!(s["closedTabs"][1]["tab"]["filePath"], Value::Null);
        assert_eq!(s["closedTabs"][1]["closedAt"], 2);
        assert_eq!(s["closedTabs"][2], 7);
        let mut planted = json!({ "tabs": [{ "id": "t", "filePath": "C:/Windows/win.ini" }], "lastFolder": "D:/elsewhere" });
        assert_eq!(drop_unallowed(&mut planted, &allowed), 2);
        assert_eq!(planted, json!({ "tabs": [{ "id": "t", "filePath": null }], "lastFolder": null }));
        assert_eq!(drop_unallowed(&mut planted, &allowed), 0);
    }
}
