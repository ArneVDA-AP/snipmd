# Final review R3: adversarial pass (branch claude/phase-6d)

Branch `claude/phase-6d` at 392727f. The code under review is the same as at e80ecdc; the two later commits only touch PLAN.md. Ground truth: SPEC.md and CLAUDE.md. R1 and R2 items listed as "Left" are not raised again (see the note under Minors).

## Checks

All commands ran from the project root, and the cargo commands ran in `src-tauri/`:
- `npm test`: exit 0 (20 files, 274 tests)
- `npm run lint`: exit 0
- `cargo test -p snipmd-core`: exit 0
- `cargo check`: exit 0. This compiled the Tauri crate in this Linux container.

The probes are Vitest files that run the real `tabs`, `saving`, `session`, `external`, `closedTabs`, `drop`, `infobar`, `titlebar`, `app` and `editor/*` modules. Only `ipc` is mocked: a small in-memory disk with stamps, and the stamp check that `write_markdown_file` does. They ran in a scratch copy at `/tmp/claude-0/-home-user-snipmd/0e169f62-8f5a-5438-a8c8-77076d0852e0/scratchpad/r3/src/`:
- `zz_r3reload.probe.test.ts`: reloads into restored tabs that were never shown (B1)
- `zz_r3stale.probe.test.ts`: a closed tab is restored while the hidden view still holds its old state (M1)
- `zz_r3keys.probe.test.ts`: Ctrl+F and Ctrl+H outside the note, inside it, held down, and in read mode (R2-N3)
- `zz_r3drop.probe.test.ts`: a drop of a note plus an image, with Alt+F4 and Ctrl+W while the note is still being read (R2-N7)
- `zz_r2drop_rerun.probe.test.ts`: R2's own N1 probe, run against the current code
- `zz_r3perf.probe.test.ts` and `zz_r3perf2.probe.test.ts`: the cost of creating an EditorState for a read tab

## R2 items asked about

| R2 id | status | evidence |
|---|---|---|
| N1 drop on a restored read-mode tab | closed | R2's probe on the current code: `NEW restored-read import called for B: true B text: "# C:/n/b.md\n![snip](b.assets/snip-1.png)\n" B dirty: true`. The link lands, the tab turns dirty, and no stray file is left. |
| N3 Ctrl+F/H outside the note | closed in the page | Probe keys: `strip Ctrl+F prevented: true panel: true`, `strip Ctrl+H prevented: true focus on replace: replace`, `in-note Ctrl+F prevented (by CM keymap): true`, `held Ctrl+F prevented: true`, and in read mode `mode after Ctrl+F in read: edit panel: true`. This matches SPEC §5 and §10. Ctrl+G and Ctrl+Shift+F outside the note are still not ours (`Ctrl+Shift+F prevented: false`). That is minor and needs the Windows test. |
| N7 drop tracked from its start | closed | Probe drop: `flush done before the note opened: false`. Order: `["session","import","session","write C:/n/a.md \"...![snip](a.assets/snip-1.png)\\n\"","session"]`. The close flush waits for the image link. A Ctrl+W on the target tab while the note is still being read keeps the tab, and the link is written: `closed c: text "...![snip](a.assets/snip-1.png)\n" dirty false`. |

Regressions asked about:
- **Drop ordering with notes:** none found. `at` is taken before the notes open, and it is a position in the target tab's own document. The images go to the tab under the drop even when a dropped note becomes active. The only new side effect is that `imageSavesSettled` now also waits for `readNote` of the dropped notes, so a hung read holds the blur flush. This is the same class as N2 (Left), and the close is still capped at 3 s.
- **Find shortcuts vs SPEC §10:** none found (see the N3 row).
- **Memory and performance of states for read tabs:** see m1. The cost is the same full Markdown parse that an edit-mode tab already pays. It is new only for tabs shown in read mode, including the active tab restored at startup.

## Blockers

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| B1 | blocker | `src/external.ts:21-23,36-42`, `src/tabs.ts:146-170,82` | **An outside change to a restored tab that has not been shown yet is acknowledged but never loaded, and the tab's next save overwrites it.** `restore` creates an EditorState only for the active tab (`ensureState` runs in `activate`). For every other tab, `replaceMiddle` hits `if (old === undefined) return;`, so neither the document nor `tab.content` changes. `markSaved` then stores the new stamp, and the text check `textOf(tab) === written.text` fails, so the tab keeps its old text and its old dirty flag. When the tab is shown, its editor is created from the old `content`. The next write carries the new stamp, Rust accepts it, and the outside edit is gone without any bar. The same happens in a conflict: on a restored dirty tab that was never shown, "Reload" changes nothing, the bar goes away, and the next blur writes "mine" over the disk version the user chose to keep. This is the ordinary workflow: restart with several tabs, edit one of them in VS Code or pull it with git, then come back. It breaks SPEC §6.1 (reload silently, conflict choice) and §1 "never loses anything". | Probe `zz_r3reload`, clean tab: `after reload B text: "B original\n" dirty: false disk: {"mtimeMs":2,"size":2} bars: ""`, then `shown B doc: "B original\n"`, then after one keystroke and a flush `b.md on disk after edit + flush: "xB original\n"`. The line `LINE ADDED OUTSIDE` is lost. Dirty tab: `bar: "D.md was changed outside SnipMD and you have changes too.Open disk versionReloadKeep mine"`, then after a click on Reload `D text: "D mine\n" dirty: true bar now: ""`, then after blur `d.md on disk after blur: "D mine\n"`. |

Fix for B1: give tabs.ts one way to set a tab's text from a file, for example `loadText(id, text)`. It edits the EditorState when there is one, and otherwise sets `tab.content`. `reload` calls it instead of `replaceMiddle` returning early. A simpler alternative is to create the state for every tab in `restore` and `addTab`, which costs one parse per tab at startup (see m1). Add a test: a restored background tab is reloaded, and then its shown text equals the file.

## Majors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| M1 | major | `src/tabs.ts:344-354`, `src/editor/registry.ts:59-62` | **Restoring a closed note while the hidden editor view still holds it shows the old text with the new stamp, and the next keystroke overwrites the outside change.** Close tab A when the tab that becomes active is in read mode. `activate` does not mount the editor, so the hidden view keeps A's state. If a.md changes outside, Ctrl+Shift+T (or opening a.md again, which goes through `reopenClosed`) reads the new text and calls `dropState(A)`. But `getState(A)` returns `view.state` while `visibleTabId() === A`, so `ensureState` reuses the old state, and `mountEditor` skips `setState` because A is already "visible". `tab.disk` holds the new stamp, so the write is accepted. This is the same loss as B1 through a different path: `dropState` does nothing while the view holds the state. | Probe `zz_r3stale`: `after close active: b.md read`, then `restored A: textOf "A original\n" view doc "A original\n" disk stamp {"mtimeMs":2,"size":2} dirty false`, then `a.md on disk after one keystroke + blur: "xA original\n"`. The line `ADDED OUTSIDE` is lost. |

Fix for M1: when a tab's state is replaced or dropped, the view must not keep it. One option is for `dropState(id)` to clear `view`'s claim when `visibleTabId() === id`, for example by having `mountEditor` always `setState` when the state it gets is not `view.state`. Another is for `reopenClosed` to build the new state through the same `loadText` helper as in B1. Add a test with this exact sequence.

## Minors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| m1 | minor | `src/tabs.ts:219` | `ensureState` now gives every tab shown in read mode a full CodeMirror parse and an image widget build, including the active tab restored at startup in read mode. The parse is not bounded by CM's 20 ms budget: the whole tree exists right after `create`. The cost is the same as in edit mode, so it is acceptable for normal notes, but it adds to "double-click to typing" (SPEC §9) when the restored tab is in read mode. | Node, not WebView2: `lines 2000 chars 106674: create 130.3 ms`, and for 1 MB `lang only 3347 ms tree len 1066894 of 1066894` vs `full create 3475 ms`. Almost all of it is the Markdown parse. Image lookups at create equal the image count (`resolve IPC calls at create: 200`); they share the cache with the read render. |
| m2 | minor | `src/closedTabs.ts:10,14-21` | The `IMAGE` regex is quadratic on text with many `![` and no `]`. A hostile or pasted note freezes the window when it is closed with Ctrl+W. Nothing is lost. | `node`: `40000 chars 537 ms`, `80000 chars 2376 ms`, `160000 chars 9180 ms`. |
| m3 | minor | `src/preview/render.ts:15-33` (DOMPurify hook and config) | `data-*` attributes survive sanitizing, so a note in read mode can put `data-tauri-drag-region` on its text. A mousedown there then drags the window, and a double-click maximizes it. It can also borrow app classes such as `infobar error` to look like an error bar, in the flow of the text. No code runs and no file is touched. | `DOMPurify.sanitize('<div data-tauri-drag-region class=infobar>y</div>')` returns `<div data-tauri-drag-region="" class="infobar">y</div>`. The drag effect is inferred from Tauri's drag script and needs the Windows test. |
| m4 | minor (inferred) | `src/preview/render.ts:69-77` | Read-mode links are intercepted on `click` only. A middle-click fires `auxclick`, and WebView2's default may open the link in a new popup window outside the navigation guard (`links::app_url` covers the main webview). | Code read. Nothing in `src/` handles `auxclick` except the tab strip (`grep`: `src/titlebar.ts:112` only). The Tauri v2 default for new-window requests on WebView2 needs the Windows test. |
| m5 | minor (inferred) | `src/saving.ts:74-115`, `src/editor/paste.ts:38-47` | An image save that is still running when a first save or Save As rewrites the links lands afterwards with the old prefix: `untitled.assets/…` in a note that is now on disk, or `old.assets/…`. The image stays in scratch, or in the old folder, and the link shows "Image not found". It needs Ctrl+V, Ctrl+S and Enter within one image save, so it is rare. | Code order: `promoteUntitled` and `rewriteImagePrefix` do not wait for `imageSavesRunning(tab.id)`. Not probed. |
| m6 | minor (inferred) | `src-tauri/core/src/paths.rs:80-105` | `resolve_image` refuses trimmed components but not Windows device names, so `![x](com1.png)` or `![x](nul.png)` resolves to `<note dir>/com1.png` and is granted. Older Windows builds open the device for such a name, and the asset handler could block on it. `valid_note_name` and `valid_tab_id` already check `windows_device`. | Code read. The behaviour on Windows 11 needs the Windows test. |

Not raised again: N4 (Left). A sharing-violation read error on `session.json` at startup makes `loadSession().catch(() => null)` start a fresh session that overwrites every untitled tab and the closed list. This is still the only whole-session loss path I found. It needs another process to hold the file without read sharing, so I agree that it is rare. The decision is the owner's, so I list it under for_coordinator and do not grade it again.

## Checked and sound

- **Drop:** the target is the active tab. `at` is taken before notes open. The work is tracked from its start, and the read pane is re-rendered only when the tab is still the active one (`drop.ts:194-212`, probes above).
- **Close:** `flushDirty` writes the session first, then waits for image saves, then writes dirty notes, open and closed, then writes the session again. The 3 s race wraps all of it (`app.ts:169`). A closed tab with a running save is kept (`tabs.ts:309`).
- **Writes:** writes of one tab never overlap, and a save asked for during a write joins the queued one, which reads the newest text (`saving.ts:42-68`). The stamp check happens in Rust before every write except a new file the user chose (`lib.rs:400-405`). The atomic write uses a temp file in the same folder, sync, and rename, and removes the temp file on failure (`atomic.rs`).
- **Hostile .md, read mode:** sanitized with DOMPurify. Own images get their src only after sanitizing, through `data-own`, and a note-written `src` on a `data-own` image is removed. Web URLs are decided with `new URL`, and the app hosts are refused with a trailing dot stripped. Links open through `open_link`, which uses `Url::parse` and the same host list. The CSP has no inline script.
- **Hostile .md, edit mode:** `resolve_image` decodes first, then refuses absolute, drive, UNC, `:`, NUL, `..` escapes and Windows-trimmed components in one walk. Only png/jpg/jpeg/gif/webp get an asset grant, one file at a time.
- **Rust allowed set:** every command that takes a path calls `check_path`. `import_image` only copies files from the latest drop. `save_session` drops paths outside the set. Every disk command is `async` or `#[tauri::command(async)]`. Cleanup runs from `.setup()` on its own thread, only under `scratch/`, and only on old, unreferenced, decoded and case-folded names.
- **Closed tabs:** an entry keeps its EditorState. Entries with unwritten edits never age out. A close that could not write leaves a lasting bar with Restore.
- **Keys:** a held key acts once, except tab moves. The browser keys are cancelled after CodeMirror has handled the event.

## Verdict

One blocker (B1) and one major (M1) are open. Both are verifiable without Windows. They are the same loss through two paths: an outside change to a note is acknowledged, its stamp is stored, but the text the tab shows and writes stays old, so the next save silently overwrites the other program's edit.

## Only a Windows run can settle

1. F5, Ctrl+R and right-click outside the text do nothing in the real window (R1 M3, still open).
2. Ctrl+F and Ctrl+H from the tab strip or a bar open CodeMirror's panel with focus in its field, and WebView2's find bar never shows. Also Ctrl+G and Ctrl+Shift+F outside the note.
3. A middle-click on a link in read mode does not open a WebView2 popup window (m4).
4. In read mode, a note with `<div data-tauri-drag-region>` does not drag the window (m3).
5. `![x](com1.png)` and `![x](nul.png)` in a note do not hang the asset handler (m6).
6. Alt+F4, the title bar close and logoff each wait for the flush (up to 3 s) and lose nothing. WM_QUERYENDSESSION is Windows-only.
7. Clipboard paste, Explorer drag-drop, the file association and the Mica backdrop.

## Resolution (main session)
- B1 and M1 fixed at their shared root: `loadText(tab, text)` in `src/tabs.ts` is now the one way file text enters a tab. It replaces the changed middle through the tab's editor (the visible view when that holds the tab, so a stale view can no longer shadow it) or, for a tab whose editor was never created, sets its content. `external.ts` reload and `reopenClosed` both use it; the old `dropState` on restore is gone. Tests: the outside line survives on a restored never-shown tab, and on a closed tab restored while the read-mode neighbour kept its view (the test fails with the old code).
- m2 fixed: the screenshot count's pattern is bounded and line-local; a note of 100 000 unclosed `![` closes in well under a second (test).
- m3 fixed: read mode drops every `data-*` attribute a note writes; only the app's own `data-own` mark is kept.
- m4 fixed: a middle-click on a read-mode link does nothing in the webview.
- Left: m1 (a read-mode tab now builds its editor state, the same cost edit mode has); m5 (an image save running during a first save lands with the old prefix: the bar can retry the move, and SPEC never promises it); m6 (Windows device names in image links: resolving `nul.png` reads nothing and writes nothing; a Windows test).
