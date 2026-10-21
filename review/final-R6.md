# Final review R6: sign-off on merged main 3e1cefe

Scope: merged `main` at 3e1cefe (detached checkout of origin/main). First the R5 fix d9fdfc8 (`src/tabs.ts:151`), then a quick independent sweep of the whole app. Ground truth: SPEC.md and CLAUDE.md. No source file was edited.

## Checks

All were run on 3e1cefe. node_modules was present, so `npm ci` was not run.
- `npm test`: exit 0 (20 files, 281 tests)
- `npm run lint`: exit 0
- `npm run build`: exit 0 (`dist/assets/index-*.js` 398.61 kB, gzip 130.52 kB)
- `cargo check` in `src-tauri/`: exit 0. The Tauri crate itself was checked here, because the GTK libraries are installed in this environment.
- `cargo test -p snipmd-core` in `src-tauri/`: exit 0 (57 tests across the suites, 0 failed)

Probes ran in a scratch copy of `src/` at `/tmp/claude-0/-home-user-snipmd/0e169f62-8f5a-5438-a8c8-77076d0852e0/scratchpad/r6/`:
- `src/zz_scroll.probe.test.ts`: the real `tabs.ts` and registry, with the ipc, infobar and titlebar mocks from `tabs.test.ts`. The view's `scrollDOM.scrollTop` is patched to read 0 and ignore writes while `panes.editor.hidden` is set. That is how CSSOM treats a `display: none` box, and jsdom does not do it by itself.
- `src/preview/zz.probe.test.ts`: the real `renderRead` with the `render.test.ts` mocks, fed 17 hostile inputs.

## d9fdfc8: correct, no regression

Tabs A and B are edit tabs, R is a read tab. A's editor is scrolled to 300.

| scenario | with d9fdfc8 | with the old line |
|---|---|---|
| S1 A to B (edit to edit) | A.scrollTop 300 | 300 |
| S2 A to R, then snapshot | 300, snapshot 300 | 0, snapshot 0 |
| S3 toggle A to read, read pane at 120, toggle back to edit | 300, then 120, then 120 | 300, then 120, then 0 |
| S4 A to R to A | 300 | 0 |

- Edit to edit is unchanged. `activate` calls `captureVisible` (line 240) before it sets `panes.editor.hidden` (line 244), so the editor pane is still shown when its scroll is read.
- Read mode of the same tab works through `toggleMode` (lines 391-396). The edit scroll is captured while the pane is still shown, and the mode switches after that.
- On the way back from read mode, the fix now keeps the read-mode position. The old line overwrote it with 0 from the hidden pane (S3).
- The guard can only skip a read from a hidden pane. A hidden pane cannot be scrolled, so no real value is lost.

## Sweep

- **Hostile .md, read mode** (`src/preview/render.ts`). Every one of these came out inert:
  - `javascript:` links, including with whitespace or a tab inside the scheme and in `<...>` form, and `file:` links
  - asset and ipc host links, asset `img src`
  - SVG `xlink:href`, the mXSS `math/mglyph/style` payload
  - iframe, embed and object
  - `meta refresh`, `base` and `link`
  - `ontoggle`, `area href`
  - video and input `src`/`poster`

  `https:\\evil` keeps its href. It is only reachable through `open_link` (`src-tauri/src/links.rs:7-17`), which parses it with `Url::parse` and checks the scheme and app hosts. A note-written `data-own="0"` shows the note's own first image again. That is R4 m4, left by decision, and not raised again.
- **Writes** (`src-tauri/src/lib.rs:389-421`, `src-tauri/core/src/atomic.rs`). The path is checked against the allowed set. The stamp is compared before writing, and a changed file gives `Changed` with no write. The write is temp file plus `sync_all` plus rename in the same folder, and the temp file is removed on error. This matches guardrails 1 and 8 and SPEC §6.1.
- No new blocker or major found.

## Blockers

None.

## Majors

None.

## Minors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| m1 | minor | `src/tabs.ts:151`, `src/tabs.test.ts` | No repo test covers the d9fdfc8 guard. Putting back the old line leaves all 281 tests green. jsdom keeps `scrollTop` on hidden elements, so a test needs a CSSOM-like getter, as in the probe. | `grep -n scrollTop src/*.test.ts` shows only fixtures. The probe with the old line gives S2 `A 0`, S4 `A 0`, and `Tests 4 passed`, because the probe only prints values. |
| m2 | minor (inferred) | `src/tabs.ts:207-222` | The scroll is restored in `requestAnimationFrame`. A `captureVisible` that runs between `setState` and that frame (a session snapshot or a second tab switch) stores the view's interim scroll as the new tab's position. This came before d9fdfc8, costs position only, and was not reproduced. | Code read: `mountEditor` calls `view.setState(state)` on line 216, then sets `v.scrollDOM.scrollTop = tab.scrollTop` inside `requestAnimationFrame` on lines 220-221. `captureVisible` has no guard for a pending restore. |

## Verdict

Open blockers/majors verifiable without Windows: no.
