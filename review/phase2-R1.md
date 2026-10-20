# Phase 2 review R1 (storage foundation)

Scope: `git diff HEAD` (atomic.rs, text.rs, src-tauri/src/lib.rs, infobar.ts, saving.ts, session.ts, tabs.ts and the new tests) against SPEC §6.1, §7 and CLAUDE.md guardrails 1, 5, 6 and the code conventions.

Probes were run outside the repo: a Vitest file against the real `tabs.ts`, `saving.ts`, `session.ts`, `infobar.ts` and CodeMirror registry, with only `ipc` and `preview/render` mocked, and a scratch Rust binary linked to `snipmd-core`. No repo file other than this review was written.

## Blockers

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| D1 | blocker | src/saving.ts `saveTab` / `inChain`, src/tabs.ts `snapshot`, `closeTab` | A save that is queued behind an in-flight write of the same tab, when that tab is closed meanwhile, writes the text the tab had when it was opened. That overwrites newer text on disk. The queued job holds the old `tab` object. `closeTab` calls `dropState(id)`, so `textOf(tab)` falls back to `tab.content`. Since `snapshot()` now copies tabs and no longer refreshes `tab.content`, that field keeps the open-time text for the tab's whole life. | Probe: restore disk tab `a` (disk text `v1`), edit to `v2`, `saveTab('a')` (write held), edit to `v3`, `saveTab('a')`, `closeTab('a')`, release the write. Output: `WRITES [["/n/a.md","v2"],["/n/a.md","v1"]] TABS [ 'u' ]`. The last write to disk is `v1`, older than the `v2` already written. Blur (flushDirty) followed by Ctrl+S and Ctrl+W within one write reaches this path. Phase 4 autosave will reach it more often. |

## Majors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| D2 | major | src/saving.ts `flushDirty`, src/ipc.ts `onCloseRequested` | A close (Alt+F4) never finishes while one note write hangs, for example on a removed network or USB drive. `flushDirty` awaits every `saveTab` with no timeout, and Tauri destroys the window only after the handler resolves. The first session flush does run before the note writes, so the text is safe. The window just stays open, and every later close request queues behind the hung write in the same tab chain. | Probe: `writeNote` never resolves, then `flushDirty()`. After 50 ms: `FLUSH SETTLED false writeNote calls 1`. node_modules/@tauri-apps/api/window.js:2032-2034: `await handler(evt); if (!evt.isPreventDefault()) { await this.destroy(); }`. |
| D3 | major | src/session.ts `enqueueWrite` (`failing` flag), src/infobar.ts `showInfo`, src/saving.ts `saveTab` | The info bar hides a session write failure that is still going on. The session error is shown only on the first failure (`if (!failing) showError(...)`). Any later message in the top position replaces it, and it is not shown again while writes keep failing. In the same way, `flushDirty` with several failing tabs leaves only the last tab's error visible. The user sees one note error and thinks the session is being saved (guardrail 5). | Probe with the real infobar and session: `saveSessionRaw` always rejects. Output: `BAR1 Could not save the session: disk full×`, then `showError('save a.md', ...)` and two more failing `flushSession()` calls, then `BAR2 Could not save a.md: drive removed×`. The session error is gone even though it is still failing. |
| D4 | major | src-tauri/src/lib.rs `fn write_markdown_file`, `fn save_session`, `fn read_markdown_file` | The note and session commands are synchronous Tauri commands. Tauri runs them inline on the IPC handler (the "blocking" execution context), not on a thread pool. A slow or hung note write, which phase 2 lengthens with `sync_all` and a full `fs::read` before every save, therefore delays `save_session` and every other command and blocks the UI. That goes against "a note write never blocks the session write or another tab". The frontend's separate promise chains do not help here. | lib.rs:309 `fn write_markdown_file(app: AppHandle, path: String, content: String)` and lib.rs:355 `fn save_session(...)`, neither `async` nor `#[tauri::command(async)]`. tauri-macros-2.7.3/src/command/wrapper.rs:245 `ExecutionContext::Blocking => body_blocking(...)` and :258-260 (`sync_threadpool` only for `async` attribute). That this context is the main thread comes from the Tauri docs, not from a run. |

## Minors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| D5 | minor | src-tauri/core/src/text.rs `sniff`/`encode` | A note with mixed line endings is rewritten in the style of its first line break, so the lines that differ change on the first save. | Scratch probe: `a\r\nb\nc\n` saves as `a\r\nb\r\nc\r\n`, and `a\nb\r\nc\r\n` saves as `a\nb\nc\n` (`same=false`). |
| D6 | minor | text.rs `sniff` together with CodeMirror | A note that uses only lone `\r` gets CRLF on save. CodeMirror splits on `\r` (`EditorState.create({doc:'a\rb\r'}).doc.toString()` gives `"a\nb\n"`), and `sniff` reports a file with no `\n` as crlf. The Rust round-trip test for lone `\r` passes, but the whole app does not keep the bytes. | Node check output `"a\nb\n"`. Rust probe: `lone CR: fmt=TextFormat { crlf: true, ... }`. |
| D7 | minor | src-tauri/core/src/atomic.rs | Saving through a symlinked note replaces the link with a regular file and leaves the real note unchanged. | Probe: `symlink: link_is_symlink=false real="old" link="new"`. |
| D8 | minor | atomic.rs | A read-only note is overwritten by the rename on Linux. SPEC §6.1 lists read-only as a write failure. Windows behaviour depends on how std `fs::rename` treats the read-only attribute and was not tested. The rename also drops the original file's ACLs, attributes and alternate streams. | Probe: `readonly: Ok("ok") now="new"`. |
| D9 | minor | atomic.rs temp naming | If the app crashes between create and rename, the temp file `.<name>.<pid>-<n>-<nanos>.tmp` stays next to the user's note for good. Guardrail 4 forbids cleaning there, and a leading dot does not hide a file on Windows. | Code: `tmp_name.push(name); tmp_name.push(format!(".{unique}.tmp"))` in the note's folder. No run. |
| D10 | minor | lib.rs `save_session` together with tabs.ts `snapshot` | `save_session` sets `filePath` to null for a path outside the allowed set, and its comment says "the tab restores as untitled with its text". `snapshot()` now writes `content: ''` for clean disk tabs, so such a tab restores as an empty untitled tab. | lib.rs comment line in `save_session`. tabs.ts:93 `content: t.filePath !== null && !t.dirty ? '' : textOf(t)`. |
| D11 | minor | src/tabs.ts `restore` | SPEC §7 says a dirty disk tab is compared with disk and shows the conflict bar if the file changed. `restore` keeps the session text without reading disk. This may belong to the external-changes work in a later phase. Clean tabs whose file is briefly unreachable at startup are dropped and then saved out of the session. | tabs.ts:99 reads only when `!t.dirty`. tabs.ts:106-110 drops rejected reads. |
| D12 | minor | lib.rs `write_markdown_file` | Every save reads the whole existing file only to sniff its format. That costs O(file) I/O per save, which matters once autosave runs every second in phase 4. | lib.rs: `let fmt = match fs::read(&checked) { Ok(bytes) => text::sniff(&bytes), ...`. |
| D13 | minor | src/infobar.ts `mountInfobar` | `mountInfobar` resets `shown` without clearing pending timers. An old timer then runs `remove` against a reset slot, which is a harmless no-op. | Code reading. |

## Checked and holding

- No `fs::write` is left for notes or the session. The temp file is created with `create_new` in the target's own folder, so the rename never crosses drives. On error the temp file is removed.
- `write_markdown_file` no longer runs `create_dir_all`. A deleted folder makes `create_new` fail with NotFound, so the folder is not created again.
- BOM and CRLF round-trip for single-style files. New files use CRLF with no BOM.
- Writes of one tab are serialized, and `markSaved` marks a tab clean only when its text equals what was written.
- `snapshot()` uses `textOf`, so a tab that was never shown keeps its restored or session text.
- `restore()` reads clean disk tabs from disk in parallel.
- Close awaits `flushDirty`, which flushes the session before any note write.
- `check_path` calls are unchanged on all three commands. No localStorage is used.
