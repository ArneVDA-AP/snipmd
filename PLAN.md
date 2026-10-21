# SnipMD — Cleanup Plan (thin-standard)

Goal: get the prototype to `SPEC.md` v1. One phase = one branch + PR + one run.
Phase 0 is solo: the main session builds the shared foundation and the contract stubs.
Phases 1-5 run as `thin-standard` workflows. The main session writes the `args` JSON for a phase only after the previous phase is merged, and shows it for approval before the run.

## Goal (v1)
Make SnipMD v1 the best small Markdown-and-screenshot notes app on Windows. SPEC.md is the scope (§12): go deep, not wide; ideas beyond it go to `PROPOSALS.md`, not into code. Done when all of this holds on `main` with CI green:
1. Phases 5 and 6 merged; every open Windows test in Status run on the Windows machine and passed; every defect found fixed and counted in the run log's "Later" column.
2. UI/UX at product level, judged on screenshots of the running app on Windows: one visual system (type scale, spacing, colour tokens; light and dark follow Windows; Windows 11 Mica where Tauri offers it); a polished tab strip, info bar, first-save bar, conflict bar and read mode; motion under 150 ms that respects reduced motion; an empty state that teaches the core loop; every action reachable by keyboard with visible focus; WCAG AA contrast; correct at 100-200% scaling. Before and after screenshots in `findings/ui/`.
3. Find and replace (`Ctrl+F` / `Ctrl+H`) and light Markdown styling (SPEC §5, §10).
4. Every SPEC §9 budget measured on Windows, recorded here and within target; the bundle split so startup loads only what the first paint needs.
5. README, CHANGELOG and RELEASE-WIN11.md describe the app as it is; an installer under 10 MB built from tag `v1.0.0`, smoke-tested from a clean install.
6. A final adversarial review (thin-review) of the whole app against SPEC.md and CLAUDE.md with no open blocker or major.

Autonomous runs work toward this goal with the owner's authority (CLAUDE.md, Workflow). Each decision is recorded with its reason under Decisions below. Windows checks by computer use only between 04:30 and 09:00 Brussels time, when the Windows machine is free.

## Why this shape
- Today `src/state/TabManager.ts` (924 lines) touches everything. Parallel units need disjoint files, so phase 0 splits the code into modules and freezes the seams as stubs. Without that, phases 1-5 cannot run in parallel.
- `cargo check` of the Tauri crate fails on a Linux cloud box (no GTK). Pure logic therefore lives in a separate crate `snipmd-core` without Tauri. `cargo test -p snipmd-core` runs everywhere; that is what unit checks use.
- Parallel units cannot use whole-project checks (`npm run lint`, `npm run build`, `cargo check`): a half-finished file of another unit breaks them. Builder checks are scoped to the unit's own tests. Whole-project checks run in the Verify phase, after all builders.
- A unit that adds a dependency also owns the lockfile (`package-lock.json` or `Cargo.lock`); otherwise the disk check stops the run.

## Run card per phase
| Phase | Mode | Main session | Where | Worktree | Reason |
|---|---|---|---|---|---|
| 0 | solo | Opus, medium | cloud or local | no | Foundation and contract must be one coherent hand; CI on `windows-latest` checks the Tauri crate |
| 1-5 | thin-standard | Opus, medium | local (Windows) | yes | thin-* agents are installed there; `cargo check` and a real app run need Windows |
| 6 | solo | Opus, medium | local (Windows) | no | Measuring the budgets needs a Windows machine |

## Phase 0. Strip and foundation (solo)
Remove:
- `src/ipc/bridge.ts` browser fallback and demo content; `src/utils/snipSimulator.ts`, `src/ui/inspector.ts`, `src/ui/modal.ts`, `src/styles/themes.ts`; export, split view, status bar, demo tabs.
- `.aistudio/`, `metadata.json`, `.env.example`, `public/releases/`, `scripts/test-connected-files.ps1`.
- React, Tailwind, Express, `@google/genai`, `motion`, `lucide-react`, `dotenv`, `tsx`, their Vite plugins and the `jsx` tsconfig setting; `tauri-plugin-fs` and `fs:default`; Google Fonts.

Build:
- Module layout (existing behaviour moved, not rewritten):
  ```
  src/types.ts            shared types (contract.shared)
  src/ipc.ts              typed invoke wrappers
  src/app.ts              wiring, keyboard
  src/tabs.ts             tab list state
  src/session.ts          session load/save
  src/saving.ts           save, autosave, first save
  src/infobar.ts          info bar (stub)
  src/titlebar.ts
  src/editor/{setup,imageWidget,paste}.ts
  src/preview/render.ts
  src/styles/main.css     light + dark via prefers-color-scheme, system fonts
  src-tauri/core/         crate snipmd-core, no Tauri
  src-tauri/src/lib.rs    Tauri commands only
  ```
- `snipmd-core` with every signature from the contract below as a stub (`todo!()`), so all later units compile against it.
- Test runners: `cargo test -p snipmd-core`; Vitest with jsdom (`npm test`).
- `package-lock.json` and `Cargo.lock` committed; CI uses `npm ci` and adds `cargo test -p snipmd-core` and `npm test`.

Done when: `npm run lint`, `npm run build`, `npm test`, `cargo test -p snipmd-core` pass here; CI `cargo check` passes on Windows; the app starts on one empty untitled tab.

## Contract (frozen in phase 0)
`contract.shared`: `src/types.ts`, `src/paths.ts` (path helpers), `src/dom.ts` (DOM helpers), `src-tauri/core/src/lib.rs` (module declarations and shared error types only).

Rust, crate `snipmd_core`:
| Id | Module | Signature |
|---|---|---|
| R1 | `paths` | `pub fn resolve_image(note_dir: &Path, link: &str) -> Result<PathBuf, PathError>`: percent-decodes; rejects absolute, drive, UNC, `..` escape and `:` streams |
| R2 | `paths` | `pub struct AllowedSet`; `pub fn allow_note(&mut self, note: &Path)` (also allows its `<stem>.assets/`); `pub fn allow_dir(&mut self, dir: &Path)`; `pub fn check(&self, p: &Path) -> Result<PathBuf, PathError>` |
| R3 | `atomic` | `pub fn atomic_write(target: &Path, bytes: &[u8]) -> std::io::Result<()>` |
| R4 | `naming` | `pub fn snip_name(now: chrono::NaiveDateTime, rand4: u16) -> String`; `pub fn create_snip(dir: &Path, bytes: &[u8]) -> std::io::Result<PathBuf>` |
| R5 | `links` | `pub fn encode_link_path(p: &str) -> String`; `pub fn rewrite_prefix(text: &str, old: &str, new: &str) -> (String, usize)` |
| R6 | `text` | `pub struct TextFormat { pub crlf: bool, pub bom: bool }`; `pub fn decode(bytes: &[u8]) -> Result<(String, TextFormat), TextError>`; `pub fn encode(text: &str, fmt: TextFormat) -> Vec<u8>` |
| R7 | `assets` | `pub fn assets_dir_for(note: &Path) -> PathBuf`; `pub fn move_dir(from: &Path, to: &Path) -> std::io::Result<()>` (rename, else copy then remove) ; `pub fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()>` |
| R8 | `cleanup` | `pub fn select_for_cleanup(entries: &[ScratchEntry], live_tabs: &HashSet<String>, live_refs: &HashSet<String>, now: SystemTime, grace: Duration) -> Vec<PathBuf>` |

TypeScript:
| Id | File | Signature |
|---|---|---|
| T1 | `src/infobar.ts` | `export function showInfo(msg: InfoMessage): () => void`; `export function showError(what: string, err: unknown): () => void` |
| T2 | `src/session.ts` | `export function scheduleSessionSave(opts?: { immediate?: boolean }): void` |
| T3 | `src/ipc.ts` | `export function saveImage(tabId: string, notePath: string \| null, bytes: Uint8Array): Promise<SavedImage>` |
| T4 | `src/ipc.ts` | `export function writeNote(path: string, text: string): Promise<void>`; `export function readNote(path: string): Promise<NoteFile>` |
| T5 | `src/editor/paste.ts` | `export function insertSnip(tabId: string, link: string): void` (inserts into that tab's state, also when it is not visible) |

## Phases 1-5 (thin-standard)
Each phase runs Build (the table), then:
- **Integrate** `I1` thin-builder, `inputs_from` all builders: wires the new modules into `src/app.ts` (its only owned file). In phase 5, B4 owns `src/app.ts` and does this.
- **Verify** `V1` thin-verifier: runs `npm run lint`, `npm run build`, `npm test`, `cargo test -p snipmd-core`, `cargo check` (src-tauri) and the phase fixtures; owns `findings/<phase>-V1.md`.
- **Review** `R1` thin-review (findings): adversarial review of the phase diff against `SPEC.md`; owns `review/<phase>-R1.md`. A blocker or major returns to the main session.
- **Windows test**, listed per phase.

### Phase 1. Security (SPEC §8)
| Unit | Agent | Owns | Task | Check |
|---|---|---|---|---|
| B1 | thin-builder | `src-tauri/core/src/paths.rs`, `src-tauri/core/tests/paths.rs` | R1, R2 | `cargo test -p snipmd-core paths`: `../`, absolute, UNC, `C:` and `:stream` are rejected |
| B2 | thin-builder | `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/` | every command validates through R2; asset scope granted per folder at runtime; strict CSP | none in parallel (Verify runs `cargo check`) |
| B3 | thin-builder | `src/preview/`, `src/titlebar.ts`, `package.json`, `package-lock.json`, `fixtures/evil.md` | sanitize with DOMPurify; escape names in `innerHTML` | `npx vitest run src/preview`: `<img onerror>`, `<script>`, `javascript:` links are removed |

Windows test: open `fixtures/evil.md` in both modes; nothing runs, no file outside the note folder loads.

### Phase 2. Storage foundation (SPEC §6.1, §7)
| Unit | Agent | Owns | Task | Check |
|---|---|---|---|---|
| B1 | thin-builder | `core/src/atomic.rs`, `core/src/text.rs`, tests | R3, R6 | `cargo test -p snipmd-core atomic text`: target never truncated on a failed write; CRLF and BOM round-trip |
| B2 | thin-builder | `src-tauri/src/lib.rs` | notes and `session.json` through R3 and R6 | none in parallel |
| B3 | thin-builder | `src/session.ts`, `src/session.test.ts` | T2; `session.json` only, no localStorage; §7 write triggers | `npx vitest run src/session`: a paste triggers an immediate save |
| B4 | thin-builder | `src/infobar.ts`, `src/styles/infobar.css`, `src/infobar.test.ts` | T1 | `npx vitest run src/infobar` |
| B5 | thin-builder | `src/saving.ts`, `src/saving.test.ts` | a failing write marks only that tab and calls T1; session save still runs | `npx vitest run src/saving`: one rejected write does not stop the others |

Windows test: paste, Alt+F4 at once, restart: image and text are there. Pull a USB stick with an open note: error bar, other tabs keep saving.

### Phase 3. Images and paste (SPEC §6.3)
| Unit | Agent | Owns | Task | Check |
|---|---|---|---|---|
| B1 | thin-builder | `core/src/naming.rs`, `core/src/links.rs`, tests | R4, R5 (encode) | `cargo test -p snipmd-core naming links`: no overwrite on collision; spaces and `( ) # %` encoded |
| B2 | thin-builder | `src-tauri/src/lib.rs` | save image from a raw IPC body; per-note `<stem>.assets/`; `scratch/<tab-id>/` as `untitled.assets/` | none in parallel |
| B3 | thin-builder | `src/editor/paste.ts`, `src/editor/paste.test.ts`, `src/ipc.ts` | T3, T5; text wins; `Ctrl+Shift+V`; paste bound to its tab | `npx vitest run src/editor/paste`: text+image pastes text; a tab switch mid-paste inserts into the original tab |
| B4 | thin-builder | `src/editor/imageWidget.ts`, `src/editor/imageWidget.test.ts` | missing-image placeholder; no images in code blocks | `npx vitest run src/editor/imageWidget` |
| B5 | thin-builder | `src/drop.ts` | image drop via Tauri drag-drop, insert at drop position | none in parallel |

Windows test: 4K screenshot visible in under 150 ms; Excel cells paste as text.

### Phase 4. Saving flows (SPEC §6.1, §6.2, §6.4)
| Unit | Agent | Owns | Task | Check |
|---|---|---|---|---|
| B1 | thin-builder | `core/src/links.rs` (rewrite part), `core/src/assets.rs`, tests | R5 (rewrite), R7 | `cargo test -p snipmd-core links assets`: only the exact prefix is rewritten; cross-drive move falls back to copy |
| B2 | thin-builder | `src-tauri/src/lib.rs` | promote, Save As, rename commands; mtime/size check command | none in parallel |
| B3 | thin-builder | `src/saving.ts`, tests | autosave 1 s, blur, close; first-save bar; `Ctrl+Shift+S`; undo survives first save | `npx vitest run src/saving` |
| B4 | thin-builder | `src/external.ts`, tests | silent reload when clean, conflict bar when dirty | `npx vitest run src/external` |

Windows test: untitled note with screenshots, Ctrl+S, Enter: file and folder side by side; opens correctly in VS Code and on GitHub.

### Phase 5. Tabs and recovery (SPEC §6.5, §7, §10, §11)
| Unit | Agent | Owns | Task | Check |
|---|---|---|---|---|
| B1 | thin-builder | `core/src/cleanup.rs`, tests | R8 | `cargo test -p snipmd-core cleanup`: nothing younger than 14 days or referenced is selected; nothing outside scratch |
| B2 | thin-builder | `src-tauri/src/lib.rs` | startup cleanup; single instance resolves relative paths against the caller's cwd | none in parallel |
| B3 | thin-builder | `src/closedTabs.ts`, tests | closed-tabs list in the session; restore bar; `Ctrl+Shift+T` | `npx vitest run src/closedTabs` |
| B4 | thin-mech | `src/app.ts` | the keyboard table of SPEC §10, exactly as listed | `npx vitest run src/app` |

Windows test: Ctrl+W on an untitled tab with images, restart, Ctrl+Shift+T: tab and images are back.

Comparison run: phase 5 is also built solo (one session, same args as the brief, no workflow) in a separate worktree from the same base commit. Only the better of the two is merged; both get the same R1 review brief and are recorded in the run log below.

## Phase 6. Editor and measuring (solo)
Goal items 2-5. Split into its own branches as the work shows (UI system, find and replace, measuring and bundle, release); each gets its own PR.
Light Markdown styling, find and replace, read mode via `Ctrl+E`. Measure every SPEC §9 budget on Windows and record the values here. Anything over budget is fixed before v1.

## Run log
One row per phase, filled when its PR merges. "Later" counts defects found after the merge (Windows test, a later phase); it is the quality measure and is updated when one turns up.

| Phase | Mode | Workflow agents / tokens / minutes | Main session | Review (blocker / major / minor) | Later |
|---|---|---|---|---|---|
| 2 | thin-standard | not recorded | contract, fixes, /simplify | 1 / 3 / 9 | open (Windows test) |
| 3 | thin-standard | 12 / 317k / 10 | foundation (ipc signatures), contract, fixes, /simplify; not measured | 0 / 3 / 12 | open (Windows test) |
| 4 | thin-standard | 8 / 216k / 5 build, then V1 + R1 as agents 2 / 159k / 10 (the run stopped at the disk gate on the Cargo.lock regeneration) | foundation (types, ipc, diskState, infobar body), contract, 12 review fixes, /simplify; not measured | 2 / 10 / 12 | open (Windows test) |
| 5 | thin-standard (comparison, not merged) | 11 / 292k / 10; about $1.40: builders and V1 on Sonnet $0.47, gates on Haiku $0.01, R1 on Opus $0.93 | foundation (closed-tabs list in tabs.ts, clearTabInfo), contract | 0 / 3 / 11 | n/a |
| 5 | solo, merged | 1 build + 1 R1 / 110k + 122k / 6 + 9; about $2.50: build $1.30 and R1 $1.20, both Opus | same foundation and contract; fixes for both reviews, /simplify; not measured | 0 / 4 / 8 | open (Windows test) |

Phase 5 comparison. Tokens are the final context per agent; dollars come from each turn's input, cache-write and cache-read tokens at list prices (Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50 per MTok in/out), with output estimated from the visible text and tool inputs. Thinking tokens are not in the transcripts, so both figures are low, the Opus-only solo run more so. Build quality came out about even: most majors in both reviews came from the shared foundation and contract (closed tabs losing late edits, unsaved closes not reported, the cleanup's reference test), so they applied to both builds. The thin build had one defect of its own (a repeated tab id dropped image references); the solo build joined the texts. Solo was cheaper in tokens (232k against 292k) and dearer in money (about 1.8x), because every token was Opus; the thin build ran its builders on Sonnet. The solo build was merged as the better of the two, because it had the fewest build defects; the thin run's review file (`review/phase5-R1.md`) stays as the record. Both reviews diffed against a stale local `main` (phase 1), so they read more than phase 5; their phase 5 findings stand.

## Status
- [x] 0 Strip and foundation: branch `claude/phase-0`, CI green, Windows test passed (`npm ci`, `npm run tauri dev`: one empty tab on start; Win+Shift+S + Ctrl+V works; tabs come back after restart). PR to `main`.
- [x] 1 Security: PR #2 merged (reviews R1-R3 in `review/`, R2-M1 closed). **Windows test open** (does not block phase 2): open `fixtures/evil.md` in edit and read mode; nothing runs, no file outside the note folder loads, links open in the browser, the app does not navigate away.
- [x] 2 Storage foundation: PR #3 merged (review `review/phase2-R1.md`: D1-D4 fixed). **Windows test open**: paste, Alt+F4 at once, restart: image and text are there. Pull a USB stick with an open note: error bar, other tabs keep saving.
- [x] 3 Images and paste: PR #4 merged (review `review/phase3-R1.md`: M1-M3 fixed, m4 m7 m8 m9 m10 fixed). **Windows test open**: 4K screenshot visible in under 150 ms; Excel cells paste as text; Ctrl+Shift+V with only an image does nothing; a jpg dropped mid-text lands on the drop line; two dropped images sit together. Until phase 4: do not first-save an untitled tab with images (its links stay `untitled.assets/`).
- [x] 4 Saving flows: PR #5 merged (review `review/phase4-R1.md`: B1-B2 and M1-M10 fixed). **Windows test open**: untitled note with screenshots, Ctrl+S, Enter: file and folder side by side, `attrib` shows no H on the note; opens correctly in VS Code and on GitHub. Edit the note in Notepad while SnipMD has it open: a clean tab reloads, a dirty one shows the conflict bar. Save As to another drive copies the images.
- [x] 5 Tabs and recovery: PR #6 merged (solo build; reviews `review/phase5-R1.md` thin and `review/phase5-solo-R1.md` solo, majors of both fixed). **Windows test open**: untitled tab with screenshots, Ctrl+W, restart, Ctrl+Shift+T: tab and images are back. Edit a note in Notepad while SnipMD has unsaved edits in it, then Ctrl+W: the warning bar "… closed with changes that are not on disk" with Restore. Ctrl+1 on AZERTY goes to the first tab; holding Ctrl+W closes one tab.
- [ ] 6 Editor and measuring: merged in the cloud: 6a (PR #8: UI system, find and replace, Markdown styling), 6b (PR #9: bundle split, budget marks, measuring script), 6c (PR #10: docs, release workflow), 6d (PR #11: whole-app review fixes). Whole-app reviews `review/final-R1.md` to `final-R6.md`: every blocker and major fixed; R6 on merged main (3e1cefe) found none open that can be checked without Windows; R1-M3 (WebView2 reload keys) still needs its Windows test. **Windows tests open** (phase 6): Mica on Windows 11 and an opaque bar on Windows 10, no desktop showing through on start or resize; F5 and a right-click outside the text do nothing; paste a screenshot then Alt+F4 at once, and Ctrl+W on a fresh tab right after a paste, then restart / Ctrl+Shift+T: link and image are there; F6 from the note reaches a bar's buttons, then the tabs; Ctrl+H opens replace; 150% and 200% scaling.
  SPEC §9 budgets, measured:
  | Measure | Target | Value | Where |
  |---|---|---|---|
  | Installer size | < 10 MB | 1.36 MB (NSIS); MSI 1.89 MB, bare exe 3.60 MB | Release workflow on `windows-latest`, 2026-10-21, phase 6c code |
  | Startup JS (first paint) | as small as the first paint needs | 397 KB (130 KB gzip); read mode 76 KB loaded later | `npm run build`, phase 6b |
  | Double-click to typing | < 300 ms | open: `measure.ps1` on the Windows machine | |
  | Ctrl+V to 4K screenshot visible | < 150 ms | open: `measure.ps1` | |
  | Memory, 5 tabs and 20 images | < 120 MB | open: `measure.ps1` | |

## Decisions
Autonomous runs add one line per decision: date, what, why.

- 2026-10-21. Phase 6 runs as three PRs: 6a UI system with find and replace and the Markdown styling (the styling is part of the visual system, so one PR keeps it coherent), 6b bundle and measuring, 6c docs and release. Solo, as the run card says: the units share one stylesheet and one design.
- 2026-10-21. This session has no computer use, so the Windows tests and the Windows screenshots wait for a session linked to the Windows machine (04:30-09:00). Cloud work is verified with unit tests, CI on `windows-latest` and the browser tour (`tools/ui-tour/`).
- 2026-10-21. Visual system modelled on Windows 11 Fluent: neutral greys, the default Fluent accent (#005fb8 light, #60cdff dark), Fluent InfoBar colours, 4px spacing grid, radii 4/6/8, motion 80-140 ms off under reduced motion. Tokens live in `main.css`; `contrast.test.ts` checks every text and control pair for WCAG AA in both themes. Why: the app should look native next to Notepad and Explorer without a theme of its own (SPEC §4).
- 2026-10-21. The editor writes in Segoe UI Variable, code in Cascadia Mono. Why: SnipMD is a notes app, not a code editor; raw Markdown in a proportional face reads like the note it is. SPEC §4 names both fonts.
- 2026-10-21. Dimmed Markdown marks (`#`, `**`, link URLs) are held to 3:1, not 4.5:1. Why: they repeat what the styling already shows (size, weight, colour); WCAG treats such text as incidental. All other text is 4.5:1 or more.
- 2026-10-21. Windows 11 Mica behind the top bar: Rust applies it at startup when the build is 22000 or later and tells the page through `window_backdrop`; only then does the bar go transparent. The window is `transparent: true`; the page itself stays opaque, so Windows 10 looks as before. Why: the goal asks for Mica where Tauri offers it, and a wrong guess must never show the desktop through the window.
- 2026-10-21. Keyboard: F6 / Shift+F6 cycle page, info bar and tab strip (Windows convention); the tab strip has one tab stop with arrows, Home, End, Enter and Delete; Esc dismisses a non-sticky bar; window buttons are not tab stops (Alt+Space and Alt+F4 reach them). Ctrl+F or Ctrl+H in read mode switches to writing and opens the panel.
- 2026-10-21. The editor parses GFM without embedded HTML, CSS or JavaScript (bundle 658 to 398 KB). HTML tag completion and auto-closing tags go with it; SnipMD notes are Markdown, and SPEC §5 asks for neither. An image's target is found after its `(` mark, because GFM makes URLs in alt text nodes of their own.
- 2026-10-21. Budget marks stay in the shipped build but cost one IPC call at start when tracing is off; `SNIPMD_TRACE` and `SNIPMD_DATA_DIR` are developer switches, documented in ARCHITECTURE.md, not in the SPEC (they do not change what a note can reach).
- 2026-10-21. A paste in the middle of a note leaves the cursor on an empty line below the image, adding one when the next line has text: the core loop is "paste, keep typing", and typing must not join the next paragraph.
- 2026-10-21. WebView2's browser keys (reload, print, history) and its page menu are switched off in the page; the menu stays over text for spelling and clipboard. Tauri 2.12 does not expose the WebView2 setting, and a reload loses undo history and in-flight screenshots.
- 2026-10-21. The window title does not follow the active tab: it needs a new window permission. Moved to `PROPOSALS.md`.

## Handoff
- State (2026-10-21 05:00, autonomous run without computer use): `main` has phases 0-5, the v1 goal and all cloud work of phase 6 (PRs #8-#11). Goal items 2 (UI), 3 (find and replace, styling) and 6 (whole-app review) are done as far as the cloud can verify them; what is left needs the Windows machine: the open Windows tests, real-machine screenshots, the three §9 budgets that need a running app, and the v1.0.0 tag with a clean-install smoke test.
- Run log of this session: per-PR reviews 6a (0/3/14), 6b (0/3/10), whole app R1 (0/3/10), R2 (0/1/6), R3 (1/1/6) and R4 (0/1/4); every blocker and major fixed with a test that fails without the fix. Seven review agents (Opus); the builds ran solo in the main session, because the units shared one stylesheet and one design.
- **Next Windows window (04:30-09:00, computer use on the Windows machine)**, in this order:
  1. `git pull`, `npm ci`, `npm run tauri dev` on the newest merged `main`. Run every open Windows test in Status (phases 1-5) and the phase 6a test in PR #8; fix what fails, count each defect in the run log's "Later" column.
  2. Screenshots of the real app into `findings/ui/windows/` (same scenes as `findings/ui/README.md`, light and dark, 100/150/200% scaling); judge them against Goal item 2 and fix what looks wrong.
  3. `npx tauri build`, then `tools\measure\measure.ps1 -Exe src-tauri\target\release\snip-md.exe`; record the values under Status (phase 6). Over budget: fix before v1 (paste: show the image from a blob URL before the save ends; start: look at what blocks the first paint).
  4. When everything holds: version 1.0.0 in `package.json`, `tauri.conf.json`, `Cargo.toml`, CHANGELOG dated, merge, tag `v1.0.0`; smoke-test the published installer from a clean install (RELEASE-WIN11.md); then the final thin-review of the whole app (Goal item 6).
- Phases 1-5 ran as thin-standard (Workflow tool, name `thin-standard`); args per phase live in `.claude/runs/`.
- Rust: a local Windows session compiles everything; in the cloud only `snipmd-core` compiles and CI checks the Tauri crate. Releases publish only from version tags; a manual run of *Release Windows* builds the files and checks the installer size.
- Browser smoke test without Tauri: `npx vite`, then `tools/ui-tour/tour.cjs` (needs `playwright-core`; Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in cloud sessions).
- Open items outside the phases:
  - Done in phase 6b: startup bundle 658 KB to 398 KB (GFM language without embedded parsers; read mode loaded on first use).
  - Done in phase 6c: README, CHANGELOG, RELEASE-WIN11.md, ARCHITECTURE.md, CONTRIBUTING, SECURITY and the build scripts describe the v1 app.
- Deferred review findings, by phase:
  - Phase 1: `escapeAttr` in `src/preview/render.ts` becomes part of the sanitizer work.
  - Phase 6 (from phase 5, /simplify skips): one tab store where a closed tab is an entry with `closedAt`, instead of `findTab` next to `getTab` (external.ts still sees only open tabs); the save, conflict and "not on disk" bars of a closed tab could be one owner's bar with Restore instead of clearTabInfo plus a third bar; the screenshot count uses a regex, not the syntax tree (a parse on the close path can block); a first save is cancelled through the bar's onClose plus a guard in firstSaveBar, not by saving.ts.
  - Phase 6 (from phase 5): the "not on disk" warning stays when a later write of the closed tab succeeds; a clock more than 14 days fast at one start drops the closed entries that have no unwritten edits; the restore bar puts the shortcut before the button; the "(closed)" read copy of a note that is open again has its own id, so its relative images do not show; lib.rs is 696 lines (limit 690).
  - Phase 5 (from phase 4, done): closing a tab in conflict, or one whose last write fails, drops its edits; the closed-tabs list must keep them (R1 m5). Clear a closed tab's bars (`external:`, `external-error:`, `images:`, `firstsave:`) in `closeTab` (m8).
  - Phase 5/6 (from phase 4): "Save again" writes without a stamp, so a file recreated in that instant is overwritten; an `expected: 'absent'` mode would close it (simplify altitude 3). First save and Save As write outside the per-tab write queue; a guard keeps a late write to the old path from setting the new stamp (altitude 2). An image pasted while a first save is moving the scratch folder can land in scratch afterwards: it is kept, its link is broken until moved by hand. A failed first-save write leaves the claimed empty note (m1). Dirty tabs from sessions before phase 4 have no stamp and are not compared (m4). Saving to a drive root makes the last folder `E:`, which the bar then refuses (m2). Reference-style image definitions and `<…>` URLs are not rewritten (m6). A symlinked note is written at its target, which may be outside the allowed set (m10). No hidden attribute on temp files (dropped D9: the rename would hide the note); a crash between write and rename leaves a visible `.tmp`.
  - Phase 6 (from phase 4): one batched `stat_notes` per 2 s tick instead of one IPC per tab; `markSaved` compares the whole text, a doc identity check would do; `ensureSyntaxTree` can block up to 1 s on a huge note during a rewrite; `may_create_in` scans all allowed files and the name field checks on every keystroke; a save does four stats; the first-save bar serializes the whole doc for its heading. Core tests leave temp folders behind (m11).
  - Phase 4 (from phase 3, done): first save of an untitled tab moves `scratch/<tab-id>/` to `<stem>.assets/` and rewrites `untitled.assets/`; then delete `promote_scratch_assets`, `resolve_scratchpad_dir` and the `scratchpad/.assets` regex code. Phase 5 replaces `gc_scratch_assets` (still called on close in `tabs.ts`, on a folder nothing writes to now) with R8, then removes `#![allow(dead_code)]` from core.
  - Phase 5 (from phase 3, done): a tab closed while its paste saves loses the link silently (R1 m3); closed tabs now keep their editor state, so the link lands. The close write lives in `closedTabs.ts`; `closeAndSave` is gone.
  - Phase 6 (from phase 3): a paste or drop lands at the cursor/drop line as it is when the save ends, not mapped through edits made meanwhile (R1 m1, m2). Failed image lookups are final for the session: an image that appears later shows after a restart (m5). Batch the redraws after lookups and skip rebuilds on parser progress outside the viewport, with the incremental decorations. If the 150 ms paste budget fails: show the pasted image from a blob URL before the save ends. Stream dropped images (`io::copy`) and cap their size (m12); a drop with no visible tab is ignored silently. `save_session` parses the whole JSON to check paths: a typed struct that skips `content`. `read_markdown_file` copies the bytes in `decode`.
  - Phase 4: carry the note's format from `read_markdown_file` with the tab and send it on write, instead of sniffing the file before every save; mixed line endings are rewritten to the first one (R1 D5), lone-CR files get CRLF (D6).
  - Phase 4: atomic writes replace a symlinked note with a file (D7) and drop ACLs/attributes (D8); a crash between write and rename leaves a `.tmp` next to the note (D9; set the hidden attribute on Windows).
  - Phase 4/5: compare dirty tabs with disk on restore (SPEC §7, D11); a clean tab whose drive is briefly missing at start is dropped for good, and restore waits for the slowest read before the first paint.
  - Phase 6: session.json is fsynced on every debounced write; measure. Test mocks and fixtures are written per file; share them once a third test needs them.
  - Phase 4: consider keeping the note path in the EditorState (StateField + effect) once Save As and rename add more path changes.
  - Phase 6: incremental image decorations (only changed lines); titlebar updates in place instead of a full rebuild; bundle size.
