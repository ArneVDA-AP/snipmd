# Phase 3 V1 findings

## Commands
| step | cmd | exit | observed |
|---|---|---|---|
| 1 | npm run lint | 0 | tsc --noEmit clean |
| 2 | npm test | 0 | 68 tests passed |
| 3 | npm run build | 0 | built; chunk over 500 kB warning only |
| 4 | cd src-tauri && cargo test -p snipmd-core | 0 | all test results ok (6, 2, 4, 10, 6 passed, 0 failed) |
| 5 | cd src-tauri && cargo check | 0 | Finished dev profile (Linux; GTK libs present) |

## Confirmations by reading code
| step | expected | observed | verdict |
|---|---|---|---|
| 6 | no Array.from(bytes) or number-array payload in src/ | only hit: src/editor/paste.ts:51 Array.from(data.items) on a DataTransferItemList to find an image item, not a payload. No number[] anywhere. ipc.ts sends Uint8Array via invoke('save_image', bytes, {headers}) | pass |
| 7 | save_image and save_session read InvokeBody::Raw | both call raw_body(&request) (lib.rs:185-190, 205, 396), which matches InvokeBody::Raw only; ipc.ts save_session sends TextEncoder bytes | pass |
| 8 | only <stem>.assets built in lib.rs besides legacy | lib.rs:151 format!("{stem}.assets"); untitled uses "untitled.assets" link prefix only (line 162). Other ".assets" at 193 (regex for legacy snip extraction), 252, 297, 301, 303 (gc_scratch_assets, promote_scratch_assets) | pass |
| 9 | every tab id reaching a path passes valid_tab_id | only path join of a tab id is tab_scratch_dir (lines 133-138), which checks paths::valid_tab_id first; used by image_folder and resolve_asset_abs_path | pass |
| 10 | import_image refuses a path not dropped | lib.rs:219-220 checks the Dropped set, error "That file was not dropped on the window" before any read. No Rust test covers it (needs AppHandle) | pass (by reading) |
| 11 | imageWidget.ts has no line regex | grep for RegExp, regex literals, .match, .test, split finds nothing | pass |

## Defects
none

## Notes
- The new Tauri commands (save_image, import_image, raw-body save_session, files-dropped) are only compile-checked here. A Windows run is needed: paste into a disk note and an untitled tab, drop an image on the window.
- The window drop handler (lib.rs:504-510) adds only image-extension paths to the Dropped set before emitting files-dropped.

Counts: pass 11, fail 0, unjudged 0.
