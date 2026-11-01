# Hygiene pass before 1.1.0

Base: `main` at 56c5ee0. Line numbers are on 56c5ee0 unless a row says `52bb123`, the commit `Version 1.1.0` on branch `claude/release-1.1.0`, which another session made in the same checkout during this pass. Read-only: no repo file was edited.

Scope covered: every tracked file (`git ls-files`, 162 files). `.claude/` agent and workflow files were checked only for session links, claude.ai links and model names. `.claude/ROADMAP.md` is session state, not an agent file, so it was checked in full.

## 1. Internal references (links, model names, process ids, local paths)

| id | file:line | what is wrong | replacement or action |
|---|---|---|---|
| I1 | tools/demo/snip-walk/public/mock.js:3 | Personal local path in a tracked file: `var dir = 'C:/Users/arne/Documents/Notes/';` | `var dir = 'C:/Users/demo/Documents/Notes/';` |

Checked, no action needed:
- No `claude.ai` link, no `session_` id, no `/tmp/` or `/home/user` path, and no phase, run, review or finding id (`phase N`, `R1 M1`, `m12`, `run 12`) in any tracked file outside `.claude/`. Every hit of `m1`, `t1`, `f1` and similar is a test fixture id.
- `.claude/agents/thin-*.md:4` have `model: opus`, `model: sonnet` or `model: haiku` in their frontmatter. These are functional config aliases, not version names, so no action.
- README.md:76 and docs/code-signing.md:11 say "written with Claude (Anthropic) as the main author". SPEC.md:251 says "read as Claude's colour". These are deliberate credits and a product reason, with no version-specific model name, so no action.
- Not a tracked file, but for the record: 11 commits in `main`'s history (2026-10-23, from c0ef477 back to b950f49) end with a co-author line that names a model and a session-link line. The rule forbids rewriting `main`, so nothing can be done. 52bb123 follows the rule (`Co-Authored-By: Claude` only).

## 2. Comments, demo data and code that disagree

| id | file:line | what is wrong | replacement or action |
|---|---|---|---|
| C1 | src/external.ts:2 | The header says "This module owns the conflict state of a tab and its bar". That state is not in this file. It is in src/diskState.ts:8 `const conflicts = new Set<string>();`, and it is set by diskState.ts:31 `export function setConflict(...)`. external.ts:7 imports `inConflict, isWriting, setConflict` from `./diskState`. | `// This module decides when a tab is in conflict (the flag is in diskState.ts) and owns its bars; saving asks it through resolveConflict` |
| C2 | tools/demo/snip-walk/public/mock.js:13 | The demo session sets `untitledCounter: 3`. No code reads it: `grep -rn untitledCounter src src-tauri` finds nothing. ARCHITECTURE.md:67 says untitled numbers come "not from a counter in the session". | Delete `untitledCounter: 3, ` from the object. |

## 3. Docs that do not match the code

| id | file:line | what is wrong | replacement or action |
|---|---|---|---|
| D1 | docs/ARCHITECTURE.md:25 | "`commands.ts` is the registry of `Command`s (id, title, keys, run, and `checked` for a toggle); `app.ts` registers the list once and `runCommand(id)` is the one way to run one." There is no `src/commands.ts`, and `git log --all -- src/commands.ts` is empty. The list is `const COMMANDS` in src/app.ts:87, `runCommand` is at app.ts:128, and the `Command` interface is in src/commandMenu.ts:8. | `` - `app.ts` holds the commands (`COMMANDS`: id, title, keys, run, and `checked` for a toggle; the `Command` type is in `commandMenu.ts`); `runCommand(id)` is the one way to run one. `` Keep the rest of the bullet (settings.ts, commandMenu.ts) as it is. |
| D2 | docs/ARCHITECTURE.md:27, docs/CONVENTIONS.md:48 | ARCHITECTURE says "`external.ts` owns conflicts and their bars." CONVENTIONS rule 8 says "Each state has one owner module (conflicts: `src/external.ts`)". The conflict state is in src/diskState.ts:8 and :31 (see C1). `diskState.ts` is not mentioned anywhere in ARCHITECTURE.md (`grep -c diskState docs/ARCHITECTURE.md` gives 0). | ARCHITECTURE:27: replace the last sentence with `` `diskState.ts` holds the per-tab disk state that saving and the watch share (writes in flight, a write generation, the conflict flag), so neither imports the other; `external.ts` decides conflicts and owns their bars. `` CONVENTIONS:48: `(conflicts: the flag in src/diskState.ts, the bars in src/external.ts)`. Or move the `conflicts` set into external.ts so the rule holds as written (a code change, needs a decision). |
| D3 | docs/SPEC.md:49 (Naps) vs src/external.ts:35, src/tabs.ts:514 | The SPEC says "It falls asleep after 10 minutes without a save. The next save brings a friend". A silent reload of a clean tab (external.ts:35 `markSaved(tab.id, { text: file.text, stamp: file.stamp });`) runs `petMoment('saved')` (tabs.ts:514). pet.ts:215-217 then resets the nap timer and wakes Snip with the friend. So a change made by another app counts as a save. ARCHITECTURE.md:31 ("`markSaved` (wakes it…)") matches the code, not the SPEC. | Decision needed. Either SPEC §4: "after 10 minutes without a save or a reload from disk; the next one brings a friend", or move `petMoment('saved')` from `markSaved` into saving.ts, after a successful write. |
| D4 | docs/ARCHITECTURE.md:12-15 (Shape diagram) | The snipmd-core column lists paths, atomic, naming, note, assets, text, session and cleanup, but not `links`. src-tauri/core/src/lib.rs:10 has `pub mod links;`. core/Cargo.toml:5 lists "links". | Add a row to the core column: `links    link path encoding`. |
| D5 | docs/ARCHITECTURE.md:19 | "One store: … `session.json` holds tabs, untitled text, closed tabs and the last folder." It also holds the toggles: SPEC.md:123 ("the command menu's toggles"), src/settings.ts:1-2. | `holds tabs, untitled text, closed tabs, the last folder and the command menu's toggles.` |
| D6 | docs/ARCHITECTURE.md:35-36 | Two bullets about the same file. :35 "Styles live in `main.css`; each feature has its own section at the end." :36 "`styles/main.css` holds the visual system: tokens …". | Merge into one: `` - `styles/main.css` holds the visual system (tokens for type, space, radius, motion and colour in both themes), then one section per feature. `contrast.test.ts` checks every text pair for WCAG AA. `` |
| D7 | docs/SPEC.md:3 (also at 52bb123) | "Applies to SnipMD 1.0." The SPEC already describes 1.1 (§12 "Added after 1.0", §4 Snip, the command menu). | `Applies to SnipMD 1.1. This file is the single source of truth for what SnipMD is and does.` |
| D8 | docs/SPEC.md:90-91 | Line 91 repeats line 90. :90 "A name that is taken or cannot be a file name turns red, turns Save off and says why next to the field". :91 "If the name exists, the field turns red and Save is disabled; no overwrite prompt." | Delete :91 and end :90 with `…points to "Other folder…"); no overwrite prompt.` |
| D9 | README.md:19 (56c5ee0 only) | "Some features below come with 1.1 (…); until then they are in the newest pre-release on the Releases page." This is wrong once 1.1.0 is out. | Already removed in 52bb123. Make sure that commit is what gets merged. |
| D10 | CHANGELOG.md:10 (52bb123, new 1.1.0 section) | "every command and four toggles, kept in the session. Line breaks in read mode (off), clickable tasks in read mode, a Copy button on code blocks and a match count in find (on)." 1.1.0 ships five toggles: src/settings.ts:6-10, including `pet: { title: 'Show Snip', default: true }`. The four-toggle line was right for 1.1.0-1 (:60). | `every command and five toggles, kept in the session: line breaks in read mode (off), clickable tasks in read mode, a Copy button on code blocks, a match count in find and Show Snip (on).` Leave :60 under 1.1.0-1 as it is. |
| D11 | .claude/ROADMAP.md:25, :27 | Open item 1 (#79) and open item 3 ("SPEC §12 promises `Ctrl+P` and TextPack for v1.1; neither is built. Move them…") are both done on main. #79 was fixed in 6eb143c / PR #96. SPEC.md:194 now says "Later, not scheduled: `Ctrl+P` … (#93) … TextPack (#94)" (a96bd23 / PR #97). | Rewrite "Open before 1.1.0": drop items 1 and 3; keep 2 (Windows test plus the short retest of saving and the closed-tab bar) and 4 (release steps), and mark the hygiene pass done. |
| D12 | docs/releasing.md:49-57 | "Last measured … 2026-10-21 (`main` at e951acb)". That is the 1.0 build. SPEC.md:141 says "Every release is checked against this", and 1.1 adds lazy language chunks, Snip and the command menu. | Before tagging, run `tools\measure\measure.ps1` on the 1.1.0 build and replace the table and date. |

## 4. Dead exports

Method: for every `export` in a non-test `src/**/*.ts`, I looked for an importer in other non-test files under `src/` and `tools/`. For every `pub` item in `src-tauri/src` and `src-tauri/core/src`, I looked for a use in another source file.

| id | file:line | what is wrong | replacement or action |
|---|---|---|---|
| X1 | src/types.ts:3 | `export type TabMode` has no importer anywhere, tests included. It is only used at types.ts:32. | Drop `export`. |
| X2 | src/types.ts:62 | `export type InfoKind` has no importer anywhere. It is only used at types.ts:74. | Drop `export`. |
| X3 | src/types.ts:64 | `export interface InfoAction` has no importer anywhere. It is only used at types.ts:76. | Drop `export`. |
| X4 | src/titlebar.ts:10 | `export interface TitlebarHandlers` has no importer anywhere. It is only used at titlebar.ts:92. | Drop `export`. |
| X5 | src/editor/codeLanguages.ts:14 | `export const CODE_LANGUAGES` is imported only by codeLanguages.test.ts. | Decide: keep as a test seam, or drop `export` and test through `languageFor`/the read-mode highlighter. |
| X6 | src/external.ts:127 | `export async function checkTabs` is imported only by tests (2 files). In the module it is called only from startExternalWatch (:136, :139, :152). | Same decision as X5. |
| X7 | src/firstSaveBar.ts:9 | `export type FirstSaveChoice` is imported only by firstSaveBar.test.ts. | Same decision as X5. |
| X8 | src/infobar.ts:157 | `export function errorText` is imported only by infobar.test.ts. In the module it is used at :169. | Same decision as X5. |
| X9 | src/session.ts:102 | `export function parseSession` is imported only by session.test.ts. In the module it is used at :64. | Same decision as X5. |

Rust: no dead `pub` items. The core items used only in their own file plus `core/tests/` (`atomic::create_unique`, `cleanup::scan_scratch`, `cleanup::select_for_cleanup`, `naming::snip_name`, `session::live_tabs`) must be `pub` for the integration tests. `macos::quit::{reply, install}` and `lib.rs SavedImage` are used inside their crate.

## 5. Root folder (repo front)

| id | file:line | what is wrong | replacement or action |
|---|---|---|---|
| R1 | tools/ (root folder) | The rule allows only README, LICENSE, CHANGELOG, build config and source folders at the root. `tools/` holds maintainer tooling. `tools/release/*` and `tools/measure/*` are used by the workflows (windows-run.yml, macos-run.yml, release-macos.yml), but `tools/demo/snip-walk` and `tools/fixtures/evil.md` are maintainer-only (they are referenced only from docs/ARCHITECTURE.md and docs/releasing.md:42). `tools/release/build-win11-release.bat` is referenced by nothing but its own .ps1 sibling. | Decision: either record in ROADMAP "Repo front" that `tools/` counts as build tooling, or move it (for example to `.github/tools/`) and update the paths in 3 workflows, ARCHITECTURE.md, releasing.md, perf.rs:1 and the scripts. |

Every other root entry is allowed: `.github/`, `.gitignore`, CHANGELOG.md, LICENSE, README.md, `docs/`, index.html, package.json, package-lock.json, `src/`, `src-tauri/`, tsconfig.json, vite.config.ts. `.claude/` is allowed by the rule. `dist/` and `node_modules/` are untracked and ignored.

## Counts
- 1 Internal references: 1
- 2 Comments or demo data vs code: 2
- 3 Docs vs code: 12 (D9 already fixed on 52bb123)
- 4 Dead exports: 9 (4 with no importer at all, 5 used only by tests), 0 in Rust
- 5 Root folder: 1
