# Final review R2: verification of the R1 fixes (branch claude/phase-6d)

Branch `claude/phase-6d` at 09b6eea, compared with `git diff origin/main...claude/phase-6d` after `git fetch origin main`. Ground truth: SPEC.md and CLAUDE.md.

## Checks

Run from the project root. The cargo commands ran in `src-tauri/`.
- `npm test`: exit 0 (273 tests)
- `npm run lint`: exit 0
- `cargo check`: exit 0. This is the Tauri crate, compiled in this Linux container.
- `cargo test -p snipmd-core`: exit 0

The probes are Vitest files that use the real `tabs`, `saving`, `session`, `closedTabs`, `drop`, `infobar`, `titlebar`, `app` and `editor/*` modules, with only `ipc` mocked. They ran in a scratch copy of the branch at `/tmp/claude-0/-home-user-snipmd/0e169f62-8f5a-5438-a8c8-77076d0852e0/scratchpad/r2/src/zz_r2*.probe.test.ts`:
- `zz_r2close.probe.test.ts`: M1 (Alt+F4 and Ctrl+W) and a hung image save during the close.
- `zz_r2drop.probe.test.ts`: M2, plus a read-mode tab that has no editor state yet.
- `zz_r2keys.probe.test.ts`: `startApp` with the real editor. Checks that F3, Ctrl+U and Ctrl+F still work.
- `zz_r2paste.probe.test.ts`: the paste cursor rule.

## R1 findings

| R1 id | status | evidence |
|---|---|---|
| M1 Alt+F4 during a paste | closed | Probe M1a: paste with `saveImage` held pending, then `flushDirty()`. Output: `M1a flush done before image landed: false`. After the image resolves: `M1a last session has link: true`. The 3 s race in `src/app.ts:161` still bounds the close. |
| M1 Ctrl+W on a fresh untitled tab during a paste | closed | Probe M1b: the image resolves after `closeTabWithRestore`. Output: `M1b closed entry content: "![snip](untitled.assets/snip-2.png)\n" dirty true bar: "Untitled-2 closed.Ctrl+Shift+TRestore"`. The session's closed entry carries the link (`onDocChange` refreshes `content` for closed tabs, `src/tabs.ts:67`). |
| M2 drop in read mode goes to the hidden note | closed for the R1 scenario, but the fix is incomplete (see N1) | Probe, R1 scenario (A in edit mode, then B in read mode): `R1 scen import tab is B: true A has link: false B has link: true read pane shows img: true`. |
| M3 F5, Ctrl+R, Ctrl+P and the right-click Reload | closed in the page. A Windows test is still needed. | `src/app.ts:92-112`: `isBrowserKey` calls `preventDefault` on F3, F5, F7, Ctrl+R, Ctrl+Shift+R, Ctrl+P, Ctrl+J, Ctrl+U and Alt+Left/Right. The contextmenu handler allows the menu only over `.cm-content`, inputs and selected read-view text. The window listener is in the bubble phase, so CodeMirror acts first. Probe keys: `F3 opened CM search panel: true`, and Ctrl+U undoSelection moved the cursor back (`9`). CM's Mod-g, Shift-F3 and Alt-ArrowLeft (cursorSyntaxLeft) are bound on the content DOM in the same way. Inferred, not verified: that WebView2 skips its accelerator when the page cancels keydown. I could not reach the Microsoft docs from here, so the Windows test in the Resolution is required. The Ctrl+F part of R1 M3 is still open (see N3). |
| m1 unreadable session overwritten | partly closed | `src-tauri/src/lib.rs:553-560` keeps the file aside only when `serde_json` fails. `lib.rs:550-551`: `fs::read_to_string(...).map_err(...)?` still returns Err for non-UTF-8 bytes or an I/O error, and so does a failed rename at `lib.rs:558`. `src/app.ts:147` `loadSession().catch(() => null)` turns that into a fresh session that overwrites the file. Valid JSON that `parseSession` rejects (`src/session.ts:110`, `if (tabs.length === 0) return null`) is overwritten as well. The user is not told in either case. Still minor (see N4). |
| m2 paste cursor mid-note | closed | Probe paste: `"A\nB"` at 1, then typing `foo`, gives `"A\n![snip](u/s.png)\nfoo\nB"`. `"A\n\nB"` gives `"A\n![snip](u/s.png)\nfoo\nB"`. `"A"` gives `"A\n![snip](u/s.png)\nfoo"`. `""` gives `"![snip](u/s.png)\nfoo"`. Typing never joins an existing line, and the image sits on its own line below the cursor (SPEC §6.3). |
| m3 read mode not re-rendered after a reload | left, honestly minor | Stale display only. Ctrl+E twice refreshes it, and the text on disk is right. |
| m4 session written right after a save | closed (one stale comment, N5) | `src/tabs.ts:392` `changed({ immediate: true })`. The second part of R1's suggestion (equal text in `outside()` is not a conflict) was not done. With the immediate write, the window for that false conflict is now one IPC round trip. |
| m5 copies open next to their tab | closed | `src/tabs.ts:251-253` splices after `after`. `external.ts:76` and `tabs.ts:329` pass the source id. |
| m6 first-save name without `.md` | partly closed | `noteFileName` adds `.md`. A name with `/` or `:`, or one ending `.markdown`, still shows the red "taken" state with no explanation. `noteFileName` keeps `.markdown` (`src/firstSaveBar.ts:31`), and `valid_note_name` accepts only `.md` (`src-tauri/core/src/paths.rs:131`). Minor. |
| m7 `#` comment in a code block taken as the heading | closed for the common case | Node run of `firstHeading`: ```` ```sh\n# comment\n```\n# Real ```` gives `"Real"`, and an unclosed fence gives `""`. One edge case remains: a 4-backtick fence that contains a 3-backtick line gives `"inside"`. This only affects the proposed name, so it is minor. |
| m8 `write_markdown_file` can reach `session.json` | left, honestly minor | It needs a compromised webview, and the target is still inside the SPEC §8 allowed set. |
| m9 failed image move after a first save | left, minor but borderline | The lasting keyed bar offers Try again until restart (`src/saving.ts:106-113`). After a restart the links are broken and visible at once, which the user notices. The scratch images survive while the tab is in the session or the closed list, and are only lost once it ages out of that list. That takes two rare events, so minor is fair. It is still the only "Left" item that can end in a lost screenshot. |
| m10 late-bound hooks with no-op defaults | left, honestly minor | A convention issue with no failure path. |

## Blockers

None.

## Majors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| N1 | major | `src/drop.ts:21`, `src/editor/paste.ts:13-14`, `src/tabs.ts:214-223` | **A drop on a read-mode tab that has not been in edit mode during this run writes the image next to the note and inserts no link, without telling the user.** This is the common case after a restart, because the session restores a tab's read mode, and it also applies to every "(disk)" or "(closed)" copy. `activate` never creates an EditorState for a read-mode tab. `handleDrop` now targets that tab: `importImage` copies the file into `<note>.assets/`, and then `insertLinks` hits `if (!state) return;`. No bar appears. The re-render shows the unchanged note. The copied file sits next to the user's note with nothing pointing to it, and cleanup never touches it (guardrail 4). Each retry adds another copy. The fix claims "a tab in read mode is rendered again with its new images", which does not hold here. Before the fix, this case did nothing at all (no view, so `visibleTabId()` was null). The stray file is new. | Probe `zz_r2drop`, "restored read-mode tab": restore A (edit) and B (read, active), then `handleDrop({images:['C:/pics/shot.png']})`. Output: `NEW restored-read import called for B: true B text: "# C:/n/b.md\n" B dirty: false info bars: "\|"`. |

## Minors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| N2 | minor | `src/saving.ts:196` | `flushDirty` waits for every image save in every tab before it writes any note, so one hung image write (an SMB share or a USB stick that hangs) holds back the note writes of all other tabs on blur and close. This goes against the letter of guardrail 5 and "one failure never blocks the rest". In practice autosave (1 s, `saving.ts:18`) still writes them within the 3 s close wait, and the session was flushed first, so I found no loss. A never-settling save also leaves every later blur flush pending forever. | Probe `zz_r2close` "hung image save": dirty `other.md`, and a paste whose `saveImage` never resolves. After the 3 s race: `writes: [ 'C:/n/other.md' ]`. That write came from the autosave timer, not from the close flush. |
| N3 | minor | `src/app.ts:72` | Ctrl+F or Ctrl+H in edit mode with focus outside the editor (tab strip, info bar) is not handled, so WebView2's own find bar can open. Ctrl+G is not blocked either. This is the R1 M3 sub-point "route Ctrl+F/H to openFind", which the Resolution does not mention. | Probe `zz_r2keys`: `Ctrl+F from tab strip in edit mode prevented (WebView2 find bar suppressed): false`, `Ctrl+G outside editor prevented: false`. |
| N4 | minor | `src-tauri/src/lib.rs:550-551,558`, `src/app.ts:147` | The m1 fix covers only invalid JSON. A non-UTF-8 file, a read error or a failed rename still overwrites `session.json`, and nothing is said in the info bar. Its error text "could not be kept aside" is swallowed by `.catch(() => null)`. Scratch images of the tabs in a session that was kept aside are still deleted after 14 days, because the next session no longer names them. | Lines quoted in the m1 row. |
| N5 | minor | `src/saving.ts:187` | Stale comment: "markSaved's tab-list change schedules the debounced session write; no immediate one per pause." Since `tabs.ts:392`, every autosave pause makes an immediate session write. That cost is acceptable, because the debounced write already happened on every edit, but the comment now says the opposite of the code. | Both lines quoted. |
| N6 | minor | `src/app.ts:101-105` | The menu rule follows elements, not "text". Right-clicking in the margins beside the 800 px text column (`.cm-content` has `max-width: 800px; margin: 0 auto`, `src/styles/main.css:199`) gives no menu at all, so there is no Paste there. Over an image widget inside `.cm-content`, or over a selected link in read mode, the browser's image or link menu still offers "Save image as…" and "Save link as…", which open a native modal dialog (guardrail 13). Spell-check and Paste over the text itself work. | CSS and selector quoted. Behaviour of the WebView2 menu inferred, needs the Windows test. |
| N7 | minor | `src/drop.ts:25-33` | The image import starts, and is tracked, only after `await openPaths(d.notes)`. An Alt+F4 while the dropped notes are still being read skips the images. Nothing is lost, because the dropped source files remain. | Code order quoted. |

## Regressions asked about

- **Close path beyond 3 s:** none. The `Promise.race` at `src/app.ts:161` still wraps the whole `flushDirty`, including the new wait.
- **Tab kept forever by a never-settling save:** the empty closed entry is not dirty, so `recent()` ages it out like any other entry. Only the blur flush stays pending (N2).
- **Drop into read mode:** see N1.
- **Keys:** CodeMirror's F3, Ctrl+G, Shift+F3, Ctrl+U and Alt+Arrow still work, because the window listener only runs after CM has handled the event (probe `zz_r2keys`). SPEC §10 has no key in the blocked list.
- **Context menu:** spelling and paste are kept over the text. For the margin and image cases, see N6.
- **Session kept aside:** the rename never deletes, and the startup cleanup sees either the old unparsable file or no file. Both delete nothing (`lib.rs:509-514`). For the gaps, see N4.
- **Paste cursor rule:** matches SPEC §2 step 3 and §6.3 (m2 row).

Verdict: one major is open (N1, a drop on a restored read-mode tab writes a stray image and inserts no link, silently). There is no blocker, and R1's three majors are closed for their stated scenarios.

## Resolution (main session)
- N1 fixed at the root: every tab that is shown gets its EditorState (`ensureState` in `activate`), also in read mode, so a drop, a reload or a link rewrite always has a document to land in. Test: a tab restored in read mode takes a link.
- N3 fixed: Ctrl+F / Ctrl+H with focus outside the note (tab strip, a bar) open CodeMirror's panel, so WebView2's find bar never shows. Ctrl+G stays CodeMirror's in the note and does nothing elsewhere.
- N5 fixed (comment). N7 fixed: a drop's image work is tracked from the start, before dropped notes open.
- Left as minor: N2 (a hung image write holds the blur flush; autosave still writes the other notes, and the close is capped at 3 s), N4 (only unparsable JSON is kept aside; a read error or a valid-but-rejected session is still replaced: rare, and a separate session-recovery design), N6 (no browser menu in the margins; a WebView2 "Save image as" over an image is a native dialog but not a data risk).
- Verdict after these fixes: no open blocker or major found by R1 and R2 that can be closed from the cloud. M3 still needs its Windows test (F5 while typing, right-click outside the text).
