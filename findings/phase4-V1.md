# Phase 4 whole-project checks (V1), branch claude/phase-4

## Commands (run from /home/user/snipmd)
| cmd | exit | note |
|---|---|---|
| npm run lint | 0 | tsc --noEmit clean |
| npm test | 0 | Vitest, jsdom, all files pass |
| npm run build | 0 | |
| cd src-tauri && cargo test -p snipmd-core | 0 | doc-tests 0, all unit/integration ok |
| cd src-tauri && cargo check | 0 | full Tauri crate (GTK present); 1 warning: unused_mut in snipmd-core (lib) |

## Confirmations (read from code)
1. No promote_scratch_assets, gc_scratch_assets, scratchpad, regex in src-tauri/ src, core/src, Cargo.toml files: Grep returned no matches (pattern also covered fs::copy).
2. No fs::copy for user files: grep for fs::copy in src-tauri (excluding target) has no hit. Images are copied by src-tauri/core/src/assets.rs:36-39 with OpenOptions create_new + io::copy + sync_all (never overwrites).
3. write_markdown_file takes the format: src-tauri/src/lib.rs:317 `format: Option<Format>`; None sniffs the head or uses NEW_FILE (lib.rs:319-325); write is atomic_write (lib.rs:326).
4. New commands are async and check paths:
   - stat_note lib.rs:332 async, check_path :334
   - promote_untitled :347 async, valid_tab_id :349, check_path :352
   - copy_assets :367 async, check_path :369-370
   - default_note_folder :382 async; takes no path argument, builds Documents/Notes itself and registers it via allow_note_folder (:386)
   - pick_folder :390 `(async)` and `async fn`; path comes from the OS dialog, registered via allow_note_folder (:400)
   - note_name_free :418 async, via new_note_path (:407-414): valid_note_name :409, may_create_in :412
   - claim_new_note :424 async, same new_note_path; create_new(true) with AlreadyExists handled (:427-429)
5. src/saving.ts never writes an inConflict tab: writeTab checks inConflict(tab.id) at :33 right before writeNote (:34), after the queue wait; saveTab :124 returns early; autosave-all filter :158. firstSave (:50-75) writes a new target with null format, and copyTo (:79-105) writes a new target; neither writes the conflicted original. copyTo clears conflict only after the new file is written (:97-98).
6. First-save and Save As rewrites go through rewriteImagePrefix: saving.ts:60 (firstSave) and :89 (copyTo). links.ts:11-34 collects all changes and issues one applyToTab call (:31), a single transaction.
7. Nothing deletes a user note or image folder: the only deletes in Rust are assets.rs:18 (remove_dir_all(from) in move_dir, after copy_dir succeeded at :17, called only by promote_untitled lib.rs:363 with from = app_data/scratch/<valid tab id>) and atomic.rs:43,57 (remove_file of own temp file). copy_assets only copies (lib.rs:376). Test-only remove_dir_all in core/tests.

## Observations (unjudged, no expectation in brief)
- move_dir (assets.rs:15-19) uses rename only when `to` does not exist, else copy_dir then remove; if `to` exists, existing files are not overwritten and copy fails with AlreadyExists, so the scratch folder is kept.
- In firstSave, if the images moved and the links were rewritten but writeNote then fails (saving.ts:60-65), the tab stays untitled with links already pointing at the new folder; not tested at runtime.
- cargo check warning: unused_mut in snipmd-core.

## Counts
checks run 5, exit 0: 5, non-zero: 0. Confirmations 7 of 7 confirmed.

## Defects
None.
