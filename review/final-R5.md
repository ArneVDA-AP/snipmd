# Final review R5: narrow pass on f516337 (branch claude/phase-6d)

Scope: commit f516337 only. `captureVisible` (`src/tabs.ts:144-156`) now looks up the tab the view holds with `findTab` instead of `getTab`, and `src/tabs.test.ts:265-279` adds a test. Ground truth: SPEC.md and CLAUDE.md. No source file was edited.

## Checks

Both were run from the project root.
- `npm test`: exit 0 (20 files, 281 tests)
- `npm run lint`: exit 0

Probes are in a scratch copy of the current `src/` at
`/tmp/claude-0/-home-user-snipmd/0e169f62-8f5a-5438-a8c8-77076d0852e0/scratchpad/r5/src/`. It uses the R4 harness: the real modules, with only `ipc` mocked by an in-memory disk.
- `zz_r4p6.probe.test.ts`: R4's P6, copied unchanged
- `zz_r5b.probe.test.ts`: Q1 to Q3, the regressions asked about

## R4 major M1: closed

- P6 re-run on the current code gives: `after image landed textOf(A) "A\n![snip](a.assets/snip-1.png)\n" dirty true`, then after clicking c.md `textOf(A) "A\n![snip](a.assets/snip-1.png)\n"`, then `a.md on disk "A\n![snip](a.assets/snip-1.png)\n"` and `reopened "A\n![snip](a.assets/snip-1.png)\n"`. With 97aceb4 the same probe gave `a.md on disk "A\n"`.
- The new test fails with the old line. With `src/tabs.ts:146` set back to `getTab(...)` in the scratch copy, `tabs.test.ts` gives `× keeps a screenshot that lands after the close when another tab is shown` and `1 failed | 22 passed`.

## Regressions asked about

- **Can a dropped tab come back?** No. `findTab` only finds tabs in `tabs` or `closedTabs`, and both drop paths take the tab out of those lists before the next `captureVisible`.
  - Q1 is an empty untitled tab, dropped on close while the view holds it. Before: `view holds U ... findTab(U) false`. After showing E: `getState(U) undefined snapshot closed ids []`.
- **Does a dropped tab's state stay forever (a leak)?** No. Q2 is a closed tab A that the view holds while 20 more closes push it out of the list (`recent` calls `dropState`). After showing E: `findTab(A) false getState(A) undefined closed count 20`.
  - The `open` branch of `reopenClosed` (`src/tabs.ts:359-366`) takes the entry out of `closedTabs` before `dropState` and `activate`. So `findTab` gives undefined there too, and the state is not stored again. This was checked by reading the code.
- **Can it overwrite a newer state set elsewhere?** No. The only writes to the state map are `applyToTab` (`registry.ts:100-103`), `ensureState` (`tabs.ts:203-204`) and `captureVisible` (`tabs.ts:148`).
  - `applyToTab` only writes the map when the view does not hold the tab. `ensureState` only writes when the map has no entry.
  - So while the view holds tab X, `view.state` is the newest state of X. Storing it can only replace an older entry. This covers `loadText` from `reopenClosed` or a reload, and a link rewrite or `placeImages` into a closed tab.
  - Q3 reopens A while the view still holds it, with the file changed outside. After showing E: `map state(A) "A\nOUTSIDE\n" cursor 1 disk {"mtimeMs":2,"size":2} dirty false`.
- **Cursor and scroll written into a closed TabState.** The cursor is read from `view.state`, which is the newest state of that tab, so it is correct. The scroll is not always correct: see m1.

## Blockers

None.

## Majors

None.

## Minors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| m1 | minor (inferred) | `src/tabs.ts:149-151` with `src/tabs.ts:244`, `src/styles/main.css:107` | `captureVisible` reads `view.scrollDOM.scrollTop` without checking that the editor pane is shown. When the active tab is in read mode, the editor pane is `display: none`, so the read gives 0. The view can still hold an edit tab there, and since this commit that also includes a closed one. Each later `activate` or session `snapshot()` then sets that tab's `scrollTop` to 0, and the closed entry carries it into `session.json`. A restored closed tab opens at the top. The same thing already happened to open tabs before f516337, and only position is lost. The read-mode line next to it does check (`!panes.read.hidden`, line 155). | Code read: line 151 `tab.scrollTop = view.scrollDOM.scrollTop;` has no `panes.editor.hidden` guard. Line 244 sets `panes.editor.hidden = tab.mode !== 'edit'`, and main.css:107 has `[hidden] { display: none !important; }`. CSSOM says scrollTop is 0 for an element without a layout box. jsdom does not lay out, so this needs a check in WebView2. |

## Verdict

R4 M1 is closed, f516337 adds no regression, and there is no open blocker or major. One inferred minor (m1) is about scroll position only.

## Resolution (main session)
- m1 fixed: the editor's scroll is only captured while its pane is shown.
- Verdict: R1-R5 leave no open blocker or major that the cloud can verify; what remains needs the Windows machine (PLAN.md Status, phase 6).
