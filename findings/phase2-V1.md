# Phase 2 V1 findings

| step | input | expected | observed | evidence | verdict |
|---|---|---|---|---|---|
| 1 | npm run lint | exit 0 | exit 0 | tsc clean | pass |
| 2 | npm test | exit 0 | exit 0, 42 tests passed | vitest summary | pass |
| 3 | npm run build | exit 0 | exit 0 | vite build | pass |
| 4 | cd src-tauri && cargo test -p snipmd-core | exit 0 | exit 0, 5+7+6 tests passed | cargo summary | pass |
| 5 | cd src-tauri && cargo check | exit 0 | exit 0 (Linux box, GTK present) | Finished dev profile | pass |
| 6 | read src-tauri/src/lib.rs, grep fs::write | none | no match; note and session.json go through atomic::atomic_write | grep empty | pass |
| 7 | read write_markdown_file (lib.rs 309-320) | no create_dir_all | none in the function; create_dir_all only at lines 160, 271 (assets) and 373 (app data dir in save_session) | grep + sed | pass |
| 8 | grep localStorage/sessionStorage in src/ | none | no match | grep empty | pass |
| 9 | src/app.ts close handler | awaits flushDirty | app.ts passes flushDirty to onCloseRequested; src/ipc.ts line 104 awaits beforeClose() inside the handler | sed | pass |
| 10 | flushDirty in src/saving.ts | awaits flushSession | line 63 awaits Promise.allSettled([first, flushSession()]) | sed | pass |

Counts: pass 10, fail 0, unjudged 0.

Notes: the await of flushDirty is in src/ipc.ts, not app.ts directly; app.ts hands the function over. The close handler swallows errors via catch. Windows behavior of rename over an existing file is not tested here.

Defects: none.
