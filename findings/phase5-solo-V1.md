# Phase 5 (solo) — V1 verification

Run from the worktree root on branch `claude/phase-5-solo` (base a4bf6f0), Linux with GTK libraries installed.

| Command | Exit | Result |
|---|---|---|
| `npm run lint` | 0 | `tsc --noEmit` clean |
| `npm test` | 0 | 14 files, 155 tests passed (new: `src/closedTabs.test.ts` 10, `src/app.test.ts` 23) |
| `npm run build` | 0 | Vite build OK |
| `cd src-tauri && cargo test -p snipmd-core` | 0 | 55 tests passed (new: `core/tests/cleanup.rs` 12) |
| `cd src-tauri && cargo check` | 0 | Tauri crate compiles, no warnings |
| `cd src-tauri && cargo build -p snipmd-core 2>&1 \| grep -c warning` | prints 0 | core builds without warnings |

## Code confirmations

- **Cleanup only from `load_session`, once, on a thread, only after `session.json` parsed.** `start_cleanup` (`src-tauri/src/lib.rs`) has a single caller, inside the `if let Ok(mut parsed) = serde_json::from_str(..)` branch of `load_session`. A missing `session.json` returns before it, a read error returns through `?` before it, a parse failure skips the branch. A `static STARTED: AtomicBool` with `swap(true)` makes it run once per process; the work runs in `std::thread::spawn`, so `load_session` returns without waiting.
- **`clean_scratch` removes only paths under scratch that `select_for_cleanup` chose.** It iterates the result of `select_for_cleanup` on `scan_scratch(scratch)`, filters `p.starts_with(scratch)`, then uses `remove_dir_all` (paths listed as tab folders) or `remove_file`. A scan error returns 0 before any removal. `scan_scratch` only lists real directories (DirEntry metadata, symlinks not followed) with a valid tab id directly in scratch, plus their direct items.
- **No other `remove_dir_all` / `remove_file` touches user folders.** The others are pre-existing: `assets.rs` removes the partial file it just created in `copy_new`, and the source only after a successful copy in `move_dir`; `atomic.rs` removes its own temp file and a file it just created when the write failed. No `remove_dir_all` exists outside `cleanup.rs`.
- **`core/src/lib.rs` has no `allow(dead_code)`**: `grep -rn "allow(dead_code)" src-tauri/core/src` finds nothing; core builds with 0 warnings.
- **`closeTabWithRestore` never saves a tab in conflict**: its only `saveTab` call is guarded by `tab.dirty && tab.filePath && !inConflict(id)`; test "does not save a tab in conflict and leaves its conflict alone".
- **Every close path in `app.ts` and the titlebar goes through `closeTabWithRestore`**: Ctrl+W (`onActive(closeTabWithRestore)`) and the titlebar `close` handler, which both × and middle-click (`auxclick` button 1) in `titlebar.ts` call. `closeAndSave` is deleted; `app.ts` no longer imports `closeTab`.
- **Ctrl+1..9 match on `e.code`**: `DIGIT = /^(?:Digit|Numpad)([1-9])$/` is tested against `e.code`; test "Ctrl+1 matches on the key position (AZERTY gives key "&")".
