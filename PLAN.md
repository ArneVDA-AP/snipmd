# SnipMD — Cleanup Plan (thin-standard)

Goal: get the prototype to `SPEC.md` v1. One phase = one branch + PR + one run.
Phase 0 is solo: the main session builds the shared foundation and the contract stubs.
Phases 1-5 run as `thin-standard` workflows. The main session writes the `args` JSON for a phase only after the previous phase is merged, and shows it for approval before the run.

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
Light Markdown styling, find and replace, read mode via `Ctrl+E`. Measure every SPEC §9 budget on Windows and record the values here. Anything over budget is fixed before v1.

## Run log
One row per phase, filled when its PR merges. "Later" counts defects found after the merge (Windows test, a later phase); it is the quality measure and is updated when one turns up.

| Phase | Mode | Workflow agents / tokens / minutes | Main session | Review (blocker / major / minor) | Later |
|---|---|---|---|---|---|
| 2 | thin-standard | not recorded | contract, fixes, /simplify | 1 / 3 / 9 | open (Windows test) |
| 3 | thin-standard | 12 / 317k / 10 | foundation (ipc signatures), contract, fixes, /simplify; not measured | 0 / 3 / 12 | open (Windows test) |
| 4 | thin-standard | 8 / 216k / 5 build, then V1 + R1 as agents 2 / 159k / 10 (the run stopped at the disk gate on the Cargo.lock regeneration) | foundation (types, ipc, diskState, infobar body), contract, 12 review fixes, /simplify; not measured | 2 / 10 / 12 | open (Windows test) |

## Status
- [x] 0 Strip and foundation: branch `claude/phase-0`, CI green, Windows test passed (`npm ci`, `npm run tauri dev`: one empty tab on start; Win+Shift+S + Ctrl+V works; tabs come back after restart). PR to `main`.
- [x] 1 Security: PR #2 merged (reviews R1-R3 in `review/`, R2-M1 closed). **Windows test open** (does not block phase 2): open `fixtures/evil.md` in edit and read mode; nothing runs, no file outside the note folder loads, links open in the browser, the app does not navigate away.
- [x] 2 Storage foundation: PR #3 merged (review `review/phase2-R1.md`: D1-D4 fixed). **Windows test open**: paste, Alt+F4 at once, restart: image and text are there. Pull a USB stick with an open note: error bar, other tabs keep saving.
- [x] 3 Images and paste: PR #4 merged (review `review/phase3-R1.md`: M1-M3 fixed, m4 m7 m8 m9 m10 fixed). **Windows test open**: 4K screenshot visible in under 150 ms; Excel cells paste as text; Ctrl+Shift+V with only an image does nothing; a jpg dropped mid-text lands on the drop line; two dropped images sit together. Until phase 4: do not first-save an untitled tab with images (its links stay `untitled.assets/`).
- [x] 4 Saving flows: PR open (review `review/phase4-R1.md`: B1-B2 and M1-M10 fixed). **Windows test open**: untitled note with screenshots, Ctrl+S, Enter: file and folder side by side, `attrib` shows no H on the note; opens correctly in VS Code and on GitHub. Edit the note in Notepad while SnipMD has it open: a clean tab reloads, a dirty one shows the conflict bar. Save As to another drive copies the images.
- [ ] 5 Tabs and recovery
- [ ] 6 Editor and measuring

## Handoff
- Branches: `main` has phases 0-3: SPEC.md, CLAUDE.md, PLAN.md, `.claude/` (thin-* agents, thin-standard workflow), the module layout, the security layer, the storage foundation, images and paste. Phase 4 runs on `claude/phase-4`.
- Phases 1-5 run as thin-standard (Workflow tool, name `thin-standard`). Args per phase live in `.claude/runs/`; `phase-1.args.json` is the template (its `root` is the cloud checkout; change it for a local run). Write `phase-<n>.args.json` from the phase table and show it for approval before the run.
- Rust: a local Windows session compiles everything; in the cloud only `snipmd-core` compiles and CI checks the Tauri crate. Releases publish only from version tags.
- Browser smoke test without Tauri: `npx vite`, then a Playwright page with a mocked `window.__TAURI_INTERNALS__` (see CLAUDE.md Verification). Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in cloud sessions.
- Open items outside the phases:
  - Bundle 583 KB: `@codemirror/lang-markdown` pulls in lang-html/javascript and autocomplete. Phase 6.
  - README, CHANGELOG, RELEASE-WIN11.md, ARCHITECTURE.md and the build scripts still partly describe the prototype.
- Deferred review findings, by phase:
  - Phase 1: `escapeAttr` in `src/preview/render.ts` becomes part of the sanitizer work.
  - Phase 5 (from phase 4): closing a tab in conflict, or one whose last write fails, drops its edits; the closed-tabs list must keep them (R1 m5). Clear a closed tab's bars (`external:`, `external-error:`, `images:`, `firstsave:`) in `closeTab` (m8).
  - Phase 5/6 (from phase 4): "Save again" writes without a stamp, so a file recreated in that instant is overwritten; an `expected: 'absent'` mode would close it (simplify altitude 3). First save and Save As write outside the per-tab write queue; a guard keeps a late write to the old path from setting the new stamp (altitude 2). An image pasted while a first save is moving the scratch folder can land in scratch afterwards: it is kept, its link is broken until moved by hand. A failed first-save write leaves the claimed empty note (m1). Dirty tabs from sessions before phase 4 have no stamp and are not compared (m4). Saving to a drive root makes the last folder `E:`, which the bar then refuses (m2). Reference-style image definitions and `<…>` URLs are not rewritten (m6). A symlinked note is written at its target, which may be outside the allowed set (m10). No hidden attribute on temp files (dropped D9: the rename would hide the note); a crash between write and rename leaves a visible `.tmp`.
  - Phase 6 (from phase 4): one batched `stat_notes` per 2 s tick instead of one IPC per tab; `markSaved` compares the whole text, a doc identity check would do; `ensureSyntaxTree` can block up to 1 s on a huge note during a rewrite; `may_create_in` scans all allowed files and the name field checks on every keystroke; a save does four stats; the first-save bar serializes the whole doc for its heading. Core tests leave temp folders behind (m11).
  - Phase 4 (from phase 3, done): first save of an untitled tab moves `scratch/<tab-id>/` to `<stem>.assets/` and rewrites `untitled.assets/`; then delete `promote_scratch_assets`, `resolve_scratchpad_dir` and the `scratchpad/.assets` regex code. Phase 5 replaces `gc_scratch_assets` (still called on close in `tabs.ts`, on a folder nothing writes to now) with R8, then removes `#![allow(dead_code)]` from core.
  - Phase 5 (from phase 3): a tab closed while its paste saves loses the link silently (R1 m3); the closed-tabs list should take it. Make "a dirty disk tab is written on close" part of `closeTab` (a bound hook) instead of the `closeAndSave` wrapper in `app.ts`.
  - Phase 6 (from phase 3): a paste or drop lands at the cursor/drop line as it is when the save ends, not mapped through edits made meanwhile (R1 m1, m2). Failed image lookups are final for the session: an image that appears later shows after a restart (m5). Batch the redraws after lookups and skip rebuilds on parser progress outside the viewport, with the incremental decorations. If the 150 ms paste budget fails: show the pasted image from a blob URL before the save ends. Stream dropped images (`io::copy`) and cap their size (m12); a drop with no visible tab is ignored silently. `save_session` parses the whole JSON to check paths: a typed struct that skips `content`. `read_markdown_file` copies the bytes in `decode`.
  - Phase 4: carry the note's format from `read_markdown_file` with the tab and send it on write, instead of sniffing the file before every save; mixed line endings are rewritten to the first one (R1 D5), lone-CR files get CRLF (D6).
  - Phase 4: atomic writes replace a symlinked note with a file (D7) and drop ACLs/attributes (D8); a crash between write and rename leaves a `.tmp` next to the note (D9; set the hidden attribute on Windows).
  - Phase 4/5: compare dirty tabs with disk on restore (SPEC §7, D11); a clean tab whose drive is briefly missing at start is dropped for good, and restore waits for the slowest read before the first paint.
  - Phase 6: session.json is fsynced on every debounced write; measure. Test mocks and fixtures are written per file; share them once a third test needs them.
  - Phase 4: consider keeping the note path in the EditorState (StateField + effect) once Save As and rename add more path changes.
  - Phase 6: incremental image decorations (only changed lines); titlebar updates in place instead of a full rebuild; bundle size.
