# Final review R4: adversarial pass (branch claude/phase-6d)

Branch `claude/phase-6d` at 97aceb4. Ground truth: SPEC.md and CLAUDE.md. Source files were not edited.

## Checks

Run from the project root; the cargo commands ran in `src-tauri/`.
- `npm test`: exit 0 (20 files, 280 tests)
- `npm run lint`: exit 0
- `cargo test -p snipmd-core`: exit 0
- `cargo check`: exit 0. It compiled the Tauri crate in this Linux container (no gdk error).

Probes are Vitest files in a scratch copy of the current `src/` at
`/tmp/claude-0/-home-user-snipmd/0e169f62-8f5a-5438-a8c8-77076d0852e0/scratchpad/r4/src/`. They run the real tabs, saving, session, external, closedTabs, infobar, titlebar and editor modules. Only `ipc` is mocked, with an in-memory disk and the stamp check of `write_markdown_file` (the R3 harness).
- `zz_r3reload.probe.test.ts`, `zz_r3stale.probe.test.ts`: R3's own B1 and M1 probes, copied unchanged
- `zz_r4.probe.test.ts`: P1 to P4, regressions of `loadText`
- `zz_r4p6.probe.test.ts`: P6, a screenshot that lands in a closed tab the hidden view still holds
- `regex.mjs`: timing and matches of the new screenshot-count pattern

## R3 items

| R3 id | status | evidence |
|---|---|---|
| B1 clean tab, silent reload of a restored tab never shown | closed | `clean: after reload B text: "B original\nLINE ADDED OUTSIDE\n" dirty: false disk: {"mtimeMs":2,"size":2}`, then `shown B doc: "B original\nLINE ADDED OUTSIDE\n"`, then `b.md on disk after edit + flush: "xB original\nLINE ADDED OUTSIDE\n"`. The outside line is kept. |
| B1 dirty tab, conflict bar, Reload | closed | `dirty: after Reload D text: "D outside version\n" dirty: false bar now: ""`, then `d.md on disk after blur: "D outside version\n"`. |
| M1 restore a closed tab while the hidden view holds it | closed for the restore path | `restored A: textOf "A original\nADDED OUTSIDE\n" view doc "A original\nADDED OUTSIDE\n" ... dirty false`, then `a.md on disk after one keystroke + blur: "xA original\nADDED OUTSIDE\n"`. The root that R3 named (the view keeps a closed tab's state, and nothing stores it back) is still open on another path: see M1 below. |
| m2 quadratic screenshot count | closed (linear), with a residue | `!['.repeat(n)`: 200 000 chars 415 ms, 1 000 000 chars 2122 ms, 2 000 000 chars 4326 ms. That is linear, but with a factor of about 2 ms per KB (each `![` scans up to 1000 chars). The forms the tests cover still count: `t.assets/b%20c.png "title"` gives `t.assets/b%20c.png`, `<t.assets/d e.png>` gives `t.assets/d e.png`, and the test file asserts 3 and 1 and passes. See m2 below. |
| m3 data-* in read mode | closed | The test `drops data-* attributes a note writes` passes. `keeps an image the app resolved` still gives `[OWN_URL]` with `ALLOW_DATA_ATTR: false` plus `ADD_ATTR: ['data-own']`. So own images keep their src in read mode, and a note-written `data-own="7"` with a src is still dropped. |
| m4 middle-click on a link | closed in the page | `auxclick` on an `a` is `defaultPrevented` (test). WebView2's behaviour still needs the Windows test. See m4 below for Ctrl+click on `#` links. |

## Regressions asked about (loadText)

- **applyToTab on a tab that is not visible or has no state.** P1 is a clean tab whose state is in the map and is not visible. The change goes through `applyToTab`, so `onDocChange` marks it dirty, and `markSaved` then clears that. Result: `a text "one\nOUT\n" dirty false writes to a 0 conflict false bars ""` (after the 1 s autosave delay). P2 is a visible clean tab: `new writes 0`. A tab with no state takes `content`, and no change event fires. In `reopenClosed` the entry has already left `closedTabs` and is not in `tabs` yet, so `findTab` returns undefined and `onDocChange` returns early. It does not mark the tab dirty and does not start an autosave. No needless write and no wrong conflict was found.
- **reopenClosed when the file equals the text.** P3: `text "same\n" dirty false writes 0 conflict false undoDepth 0`. `loadText` returns early when nothing differs, so no undo step is added.
- **A dirty closed tab keeps its edits.** P4 is a close whose write was refused because the file changed outside. Result: `closed dirty true`, and after the reopen `text "MINE disk v1\n" dirty true conflict true disk "disk v2 OUTSIDE\n"` with the bar "changed outside SnipMD and you have changes too". `diskIsSource` requires `!t.dirty` (`src/tabs.ts:156`), so the read is skipped and the conflict goes through the watch.
- **A view that belongs to another tab.** `applyToTab` dispatches to the view only when `visibleTabId() === tabId` (`src/editor/registry.ts:98`), so `loadText` never edits another tab's view. The opposite case, a view that still holds a closed tab, is M1 below.
- **Undo after a reload.** P2: after a silent reload, `undoDepth 2`. One Ctrl+Z gives `"typed base\n" dirty true`: it removes the outside change, and autosave then writes that. This is the same as the old `replaceMiddle` for tabs that had a state, so it is not a regression (see m1).
- **Other places where file text enters a tab.** `grep readNote|.content =` finds these: `restore` (`tabs.ts:181`, which runs before any state exists), `openPath` (a new tab through `addTab`), `openCopy` (a new untitled tab), `reopenClosed` (`loadText`) and `reload` (`loadText`). None of them bypasses `loadText` for a tab that already has a state.

## Blockers

None.

## Majors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| M1 | major | `src/tabs.ts:141-149` (`captureVisible` stores the view only for an open tab), `src/tabs.ts:212` (`view.setState`), `src/editor/registry.ts:97-100` | **A screenshot that lands in a closed tab while the hidden view still holds it is lost when the view moves on.** Ctrl+V and then Ctrl+W before the image is saved, with a read-mode tab next. The tab is kept (`imageSavesRunning`), and the view keeps its state. `placeImages` lands through `view.dispatch`, which updates only `view.state`. When the user then shows any edit-mode tab, `view.setState` replaces the view's state. `captureVisible` skips the closed tab (`getTab` fails), so the map still holds the state from the close. The flush writes that old text, `markSaved` marks it clean, and a restore reads the file. The link is gone with no bar, and the PNG stays orphaned in `a.assets/`, where cleanup never looks. It is the same root as R3 M1, reached by a path that the restore-only fix does not cover. Not a regression from 97aceb4. | Probe P6: `active after close b.md read A kept closed true`, `after image landed textOf(A) "A\n![snip](a.assets/snip-1.png)\n" dirty true`, then after clicking c.md `textOf(A) "A\n" content "A\n![snip](a.assets/snip-1.png)\n"`, `a.md on disk "A\n" writes [["C:/n/a.md","A\n"]]`, `reopened "A\n"`. |

## Minors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| m1 | minor | `src/tabs.ts:101`, `src/external.ts:26` | A reload, silent or chosen, is an ordinary undo step. After a silent reload, the user's next Ctrl+Z removes the outside change, and autosave writes that 1 s later with no bar. The cursor does jump to the change. This behaviour existed before 97aceb4. | P2: `undoDepth 2`, after one undo `"typed base\n" dirty true`. |
| m2 | minor | `src/closedTabs.ts:13` | The count is linear but slow on hostile text: about 2 s per MB of `![`, run on the Ctrl+W path. It also no longer counts an alt or url that spans a line (`![a\nb](x.png)`, `![](\nx.png)`) or an alt over 1000 chars. CommonMark allows these, so the "with N screenshots" text undercounts. This is only text in the bar. | `regex.mjs`: `1000000 chars 2122 ms`; `"![a\nb](x.png)" []`, `"![](\nx.png)" []`. |
| m3 | minor (inferred) | `src/preview/render.ts:71-79` | The click handler returns without `preventDefault` for `#` links. A Ctrl+click or Shift+click on `[x](#top)` may still ask WebView2 for a new window, which is the m4 class through `click` rather than `auxclick`. | Code read: `if (!href \|\| href.startsWith('#')) return;` comes before `e.preventDefault()`. Needs the Windows test. |
| m4 | minor (inferred) | `src/preview/render.ts:34` | `ADD_ATTR: ['data-own']` lets a note write `data-own` on any element. On an `img`, `data-own="0"` shows the note's first resolved image a second time. No trust is gained beyond what the note already resolves. It does go against "trust is applied after sanitizing, never recognized from an attribute the note could have written". | Code read: lines 65-68 pick `img[data-own]` after sanitizing, so note-written and app-written marks look the same. |

## Verdict

No blocker. One major (M1, a pasted screenshot's link lost after Ctrl+W when the next tab is in read mode) is open and can be verified without Windows. B1, R3's M1 restore path, m2, m3 and m4 are closed.

## Only a Windows run can settle

1. A middle-click, and a Ctrl+click on a `#` link, in read mode open no WebView2 window.
2. `<div data-tauri-drag-region>` in read mode does not drag the window. This is now stripped in the page.
3. The R3 list items 1, 2, 5, 6 and 7 still stand.

## Resolution (main session)
- The major is fixed at its root: `captureVisible` stores the view's state for the tab it holds whenever the view moves on, also when that tab is closed (`findTab`, not `getTab`), so a screenshot that lands in a closed tab survives. Test: the scenario above, failing with the old line.
- Left as minor, by decision: a reload stays an undo step. Undoing it is a deliberate keystroke, the conflict machinery treats the result like any edit, and editors such as VS Code do the same. The bounded screenshot pattern only feeds the count in the close bar; a link split over lines is rare and costs only a lower number. Ctrl/Shift+click on a `#` link and note-written `data-own` marks gain nothing a note could not already show; recorded for the Windows test.
- Verdict after this fix: R1-R4 leave no open blocker or major that can be verified without Windows.
