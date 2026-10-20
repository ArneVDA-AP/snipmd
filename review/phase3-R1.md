# Phase 3 review R1 (images and paste)

Scope: commit 2c11915 plus the uncommitted working tree on `claude/phase-3`, compared with 1fcab0b (main after phase 2). Checked against SPEC.md §5, §6.3, §8, §9 and the CLAUDE.md guardrails 2, 7, 8, 9, 10, 11 and 12, plus the code conventions.

These hold (I tried to break them and could not):
- Tab ids reach a path only after `valid_tab_id`.
- `untitled.assets/` links that use `..`, `%2F..`, a drive letter, `:` or a trailing dot are refused.
- `import_image` reads only paths that are in the `Dropped` set.
- The asset scope gets only `allow_file`, and Tauri escapes glob characters in it.
- Snips use `create_new` with a retry, so nothing is overwritten.
- Text wins on paste, and Ctrl+Shift+V never saves an image.
- A paste is bound to its tab id.
- Block widgets come from a StateField and are built from the syntax tree, so none appear in code blocks.
- Untitled cache keys include the tab id.
- The raw session body is checked as UTF-8.

`npm test` and `cargo test -p snipmd-core` were run as a baseline and pass.

## Blockers

None.

## Majors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| M1 | major | src/drop.ts:30-33 with src/editor/paste.ts:10-25 | When several images are dropped, the second and later images do not land below the first. `insertSnip` leaves the cursor at the start of the user line after the link, and the next call inserts below that line. So an existing line of user text ends up between the dropped images. The drop test mocks `insertSnip`, so it never catches this. | Probe in the scratchpad: doc `A\nB\nC`, then `insertSnip('a','one.png',0); insertSnip('a','two.png',undefined)`, the same calls `handleDrop` makes. The output is `"A\n![snip](one.png)\nB\n![snip](two.png)\nC"`. |
| M2 | major | src-tauri/core/src/naming.rs:12-20 (`create_snip`) | The image bytes are never synced to disk before the link is returned and stored. The note and session writes are fsynced (atomic.rs), but the image is not. After a power loss, a note can therefore point to an empty or truncated snip under its final name. SPEC §9 requires 0 data loss on power loss. If the write fails, the remove result is ignored (`let _ =`), so a half-written file can also stay behind, for example when a drive is pulled. | grep: `naming.rs:15: if let Err(e) = file.write_all(bytes) {`, `naming.rs:17: let _ = std::fs::remove_file(&path);`, and no `sync_all`. In contrast, `atomic.rs:34: .and_then(\|_\| file.sync_all())`. |
| M3 | major | src-tauri/src/lib.rs:181-183 (`header`), 210-213 (`save_image`) | If the `x-note-path` header cannot be read, Rust quietly treats the tab as untitled instead of failing. `header()` maps `to_str()` errors to `None`, and `None` means "untitled". A raw non-ASCII path, or any non-visible-ASCII byte, therefore saves the image into `scratch/<tab-id>/` and returns an `untitled.assets/...` link for a disk note. That link is broken, and the startup cleanup (§6.5) will later delete the image. The rule only holds because today's frontend always calls `encodeURIComponent`. Rust should refuse a header that is present but unreadable. | lib.rs:182 `request.headers().get(name).and_then(\|v\| v.to_str().ok())`. http-1.x `HeaderValue::to_str` doc: "Yields a `&str` slice if the `HeaderValue` only contains visible ASCII chars", otherwise Err. lib.rs:210-213: the `None` branch gives `note_path = None`, then `image_folder` takes the `tab_scratch_dir` branch. |

## Minors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| m1 | minor | src/editor/paste.ts:14, 27-33 | A pasted image goes below the cursor as it is when the save finishes, not where it was at paste time. If the user types or clicks during a slow save, the link lands on another line. | `const line = doc.lineAt(Math.min(at ?? state.selection.main.head, doc.length));` is read after `await saveImage(...)`, and `pasteImage` passes no `at`. |
| m2 | minor | src/drop.ts:22-33 | The drop position is taken before `await openPaths` and `await importImage`, then used as an absolute offset. Typing in that tab in the meantime shifts the target line. | `const at = tabId ? dropPosition(tabId, d) : undefined;` is computed before both awaits, and `insertSnip(tabId, r.value.link, first ? at : undefined)` runs after them. |
| m3 | minor | src/editor/paste.ts:10-12 | If the tab is closed (Ctrl+W) while a paste is still saving, the link is dropped without any message. The image stays on disk but is not referenced, and restoring the closed tab does not bring the link back. | `const state = getState(tabId); if (!state) return;`. `closeTab` calls `dropState(id)` (tabs.ts), and the `applyToTab` return value is ignored. |
| m4 | minor | src-tauri/src/lib.rs:229-244 (`resolve_asset_abs_path`) | For a disk note, any relative link inside the note's folder is granted to the asset scope. That includes non-image files and files outside `<stem>.assets/`. There is no `image_ext` check, no allowed-set check and no existence check. A hostile note `![](private.txt)` gets that file into the scope. It is still a single file, and it is lexically confined to the folder. | `resolve_image(dir, &rel_path)` is followed directly by `displayable(&app, &resolved)`, which calls `allow_file`. |
| m5 | minor | src/editor/imageWidget.ts:66-72, src-tauri/src/lib.rs:229-244 | The "looked up once" guarantee only covers Rust errors. A missing file still resolves (Rust does not check existence), so the browser fetches it again and replaces it with the placeholder each time CodeMirror rebuilds the widget DOM. Read mode (`render.ts:45`) calls `ensureResolved` on failed keys at every render. `failed` is only cleared by `primeAssetCache`. | The B4 test mocks a rejected `resolveAssetPath`, which is not what Rust does for a missing file. `img.addEventListener('error', ...)` at imageWidget.ts:109 is the real path. |
| m6 | minor | src/editor/imageWidget.ts:145, 170 | `build` walks the whole syntax tree on every document change and every tree update, which is O(document) per keystroke. This is already deferred to phase 6 in PLAN.md ("incremental image decorations"). | `syntaxTree(state).iterate({ enter(ref) {...} })` has no range, and `if (tr.docChanged \|\| ...) return build(tr.state);`. |
| m7 | minor | src-tauri/core/src/links.rs:4-17 | `encode_link_path` encodes only space, `( ) # %`. CommonMark also decodes entity references and backslash escapes in a destination. So a stem like `R&amp;D` is read by marked and GitHub as `R&D.assets`, while the editor widget and Rust read `R&amp;D.assets`. This is rare on Windows, where `\ < >` cannot occur in names. | `node -e` with marked: `![snip](R&amp;D.assets/x.png)` gives `<img src="R&amp;D.assets/x.png">`, which the HTML attribute decodes to `R&D`. `a\_b.assets` gives `a_b.assets`. |
| m8 | minor | src/editor/paste.ts:43 | The Ctrl+Shift+V detection uses `event.key`. On a non-Latin layout (for example Cyrillic, where `key` is `м`) the flag is never set, so Ctrl+Shift+V with only an image on the clipboard saves it. `event.code === 'KeyV'` matches the physical key. | `event.key.toLowerCase() === 'v'`. |
| m9 | minor | src-tauri/core/src/paths.rs (`valid_tab_id`) | Windows device names (`CON`, `NUL`, `AUX`, ...) pass as tab ids. A hand-edited session or a compromised frontend could then direct image writes to `scratch\NUL`. This is inferred, not run on Windows. | `(1..=64).contains(&id.len()) && id.bytes().all(\|b\| b.is_ascii_alphanumeric() \|\| b == b'_' \|\| b == b'-')` |
| m10 | minor | src/editor/paste.ts:33, src/drop.ts:35 | `scheduleSessionSave` is called directly at feature call sites. The convention is one path per concern. The immediate save after a paste is required by SPEC §7, but it goes around `changed()`. | `scheduleSessionSave({ immediate: true });` in both files. |
| m11 | minor | src-tauri/core/src/lib.rs:4 | `#![allow(unused_variables, dead_code)]` stays on the whole crate, so dead code in the implemented modules goes unreported. | `#![allow(unused_variables, dead_code)] // removed once every stub is implemented` |
| m12 | minor | src/drop.ts:23-25 | Dropped images are ignored with no message when no tab is visible. Dropped files over any size are read fully into memory (`fs::read` in `import_image`). | `if (!tabId) return;` and lib.rs `let bytes = fs::read(&src_path)`. |

Needs a Windows run (not verifiable here):
- Physical drop coordinates divided by `devicePixelRatio` match `posAtCoords`.
- The raw body and custom headers reach Rust through WebView2.
- Asset URLs built from mixed-separator paths (`C:/notes\x.assets\snip.png`) load.
