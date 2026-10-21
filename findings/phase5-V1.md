# Phase 5 verify V1

## Commands (run from project root)
| cmd | exit |
|---|---|
| npm run lint | 0 |
| npm test (153 tests passed) | 0 |
| npm run build | 0 |
| cd src-tauri && cargo test -p snipmd-core | 0 |
| cd src-tauri && cargo check (real Tauri crate, compiled here) | 0 |

## Confirmations by reading code
- Cleanup starts only from start_scratch_cleanup, called once in load_session (src-tauri/src/lib.rs:542), inside `if let Ok(..) = from_str(raw)`, so only when session.json parsed. CLEANUP_STARTED AtomicBool swap makes it once per process. It runs on std::thread::spawn. load_session is `#[tauri::command(async)]`. Confirmed.
- clean_scratch (core/src/cleanup.rs) removes only paths returned by select_for_cleanup, filtered again by starts_with(scratch). Scan lists only valid tab id folders and their direct items. Confirmed. Caveat: starts_with is lexical, no symlink check (scan uses file_type of the dir entry, which does not follow symlinks, so a symlinked tab folder is not listed).
- remove_dir_all appears only in cleanup.rs:81. remove_file / remove_dir elsewhere: core/src/assets.rs (image move, after copy; remove_dir only when empty) and core/src/atomic.rs (own temp files). None in src-tauri/src. Confirmed, no other deletion in user folders by this grep (assets.rs moves are the SPEC folder move, not reviewed for scope here).
- core/src has no allow(dead_code) (grep empty). `cargo build -p snipmd-core` after touching lib.rs: 0 warnings. Confirmed.
- closeTabWithRestore (src/closedTabs.ts) saves only when `tab.dirty && tab.filePath && !inConflict(id)`. Confirmed. Note the save is `void saveTab(id)`, not awaited; closeTab stores the latest text per CLAUDE.md.
- Close paths: Ctrl+W in app.ts and the titlebar handler (tab x button, middle click) call closeTabWithRestore. The only closeTab( caller outside tabs.ts is closedTabs.ts. The window close button goes via appWindow.close() into onCloseRequested flushDirty, which closes the window, not a tab. Confirmed.
- Ctrl+1..9 match on e.code via /^(?:Digit|Numpad)([1-9])$/ (app.ts). Confirmed.
- Session key names: Rust reads tab `id` and `content`, closed tabs via `closedTabs[].tab`; src/session.ts uses id, content, closedTabs[].tab. Match. Resolves B2's open question.

## Observations (unjudged)
- Ctrl+Shift+digit is unhandled (falls through, not prevented). SPEC §10 not checked for it.
- A live disk tab (None) keeps its whole folder items, by design of select_for_cleanup.

## Defects
none
