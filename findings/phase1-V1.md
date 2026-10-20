# Phase 1 V1 findings

| step | input | expected | observed | evidence | verdict |
|---|---|---|---|---|---|
| 1 | npm run lint | exit 0 | exit 0 | tsc --noEmit no output | pass |
| 2 | npm test | exit 0 | exit 0, 2 files, 13 tests passed | vitest output | pass |
| 3 | npm run build | exit 0 | exit 0, chunk >500 kB warning (612 kB) | vite output | pass |
| 4 | cd src-tauri && cargo test -p snipmd-core | exit 0 | exit 0, paths tests 6 passed | cargo output | pass |
| 5 | cd src-tauri && cargo check | exit 0 | exit 0 (Finished dev profile; GTK libs present or cached) | cargo output | pass |
| 6 | tauri.conf.json asset scope | no `**/*` | scope allow is [] | file read | pass |
| 7 | tauri.conf.json csp | non-null, no 'unsafe-inline' in script-src | script-src 'self' only; style-src has 'unsafe-inline' (not script-src) | file read | pass |
| 8 | grep plugin-dialog under src/ | no match | no match | grep output empty | pass |
| 9 | path-taking commands validate path | all validate | read_markdown_file, write_markdown_file, save_session, promote_scratch_assets, resolve_asset_abs_path use check_path. save_clipboard_image does NOT: current_file_path goes to resolve_assets_dir, which creates `<parent>/.assets` and writes a png without check_path | lib.rs lines 150-160 | fail |

Unjudged: the 612 kB chunk size (no limit stated); `devCsp` and `style-src 'unsafe-inline'` (brief only constrains script-src).
Also: fs::write in write_markdown_file is non-atomic (known, later phase). gc_scratch_assets takes no path.

## Defects
- major, step 9: save_clipboard_image (src-tauri/src/lib.rs:150) uses current_file_path without check_path, so a frontend caller can make it create a `.assets` folder and png in any directory. Evidence: lines 156-158 call resolve_assets_dir(&app, current_file_path.as_deref()) with no check_path call; resolve_assets_dir does `Path::new(path_str).parent().join(".assets")`.
