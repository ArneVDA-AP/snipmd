# CLAUDE.md — SnipMD

## Ground truth
- `SPEC.md` is the single source of truth for behavior. If code and spec disagree, the spec wins; if the spec is unclear or wrong, raise it and update the spec first.
- `PLAN.md` is the cleanup plan from the prototype to `SPEC.md` v1. Do one phase at a time, on its own branch, and only the phase that was asked for.
- `ARCHITECTURE.md` describes the original prototype design and is **outdated** (shared `.assets/`, GC on tab close, localStorage). Don't follow it.

## Workflow
- Work on a branch, never directly on `main`. Commit and open PRs only when asked.

## Stack
- Tauri v2 (Rust) + vanilla TypeScript + Vite + CodeMirror 6 + `marked`.
- No UI frameworks (React, Vue, Svelte), no Tailwind, no web fonts. New dependencies need a reason that fits §9 of the spec (size, startup time).
- Tauri v2 imports only: `@tauri-apps/api/core` (`invoke`, `convertFileSrc`), `@tauri-apps/api/window`, `@tauri-apps/api/event`. Never `@tauri-apps/api/tauri`.

## Guardrails (do not violate)

### Data safety
1. Every write of a note or `session.json` is atomic: temp file in the same directory, flush, rename. Never `fs::write` straight onto the target.
2. New images use `OpenOptions::new().write(true).create_new(true)` with the `snip-YYYYMMDD-HHMMSS-mmm-XXXX.png` name, retrying on `AlreadyExists`.
3. Moving files across drives: if `fs::rename` fails, fall back to `fs::copy` + `fs::remove_file`, and only remove after the copy succeeded.
4. Cleanup only runs at startup, only inside `%APPDATA%/snip-md/scratch/`, and only deletes things older than 14 days that nothing in the session or the closed-tabs list references (SPEC §6.5). Never delete anything next to a user's note.
5. One failing file write must never block other tabs or the session save. Surface it in the info bar.
6. The session lives in `session.json` only. No localStorage for anything that must survive.

### Security
7. Treat every opened `.md` as untrusted. Sanitize read-mode HTML; keep a strict CSP; never use `innerHTML` with unescaped user content (file names, paths, note text).
8. Rust commands only touch paths in the allowed set (SPEC §8). Validate every path argument in Rust; never trust the frontend.
9. No `tauri-plugin-fs`. Asset protocol scope is granted per folder at runtime, never `**/*`.

### Editor
10. CodeMirror block widgets (`Decoration.widget({ block: true })`) must come from a `StateField`, not a `ViewPlugin`; CM6 throws otherwise.
11. `StateField.update` is synchronous, so resolved image URLs live in a cache; resolve asynchronously and dispatch an effect when a path resolves.
12. Async work started from a tab (paste, save) must be bound to that tab's id/state, not to "the active tab" at completion time.

### UX
13. No modal dialogs, toasts or `alert()`. All messages and choices go through the info bar (SPEC §4).
14. Nothing outside the v1 scope (SPEC §12) without agreement.

## Code conventions (apply them so later reviews find less)
- **One source of truth.** A tab's text lives in its CodeMirror `EditorState`; read it with `textOf(tab)` (`src/tabs.ts`). `TabState.content` is only filled by `snapshot()` for the session and used to create the editor on restore. Never mirror derived state.
- **Nothing O(document) per keystroke.** The change listener only marks dirty and schedules; work that needs the text runs at save or session-write time. Expensive work goes on debounce or idle, never on the typing or paste path.
- **One path per concern.** Tab-list changes end in `changed()` in `src/tabs.ts` (tab strip + session save). Image redraws go through `redrawImages(tabId)`. Errors go through `showError(what, err)` (`src/infobar.ts`). Don't sprinkle `scheduleSessionSave`, re-renders or hand-formatted error strings across call sites.
- **Async work is bound to a tab id**, applied through `applyToTab` (`src/editor/registry.ts`), never to "the active tab" at completion time.
- **Normalize at the edge.** Paths are normalized once where they enter (open, save target, session restore) with `src/paths.ts`; compare with `samePath`. No ad-hoc `replace(/\\/g, '/')`.
- **Reuse the shared helpers**: `src/paths.ts` (paths, web URLs), `src/dom.ts` (`button`), `showError`. One constant for any list used twice. Prefer what the library already does (CodeMirror facets/effects, marked `walkTokens`, `crypto.randomUUID`).
- **Thin layers stay thin.** `src/ipc.ts` only wraps commands and raw events; policy (which dropped files open, what happens on close) lives in `src/app.ts` or the feature module.
- **No magic payloads, no dead exports.** Effects carry data only when someone reads it. Export only what another module imports. Delete code instead of leaving it for later.
- **Independent I/O runs in parallel** (`Promise.all` / `allSettled`); one failure never blocks the rest.
- **No retry loops by accident.** A failure path must not trigger the same work again (e.g. no redraw after a failed image lookup).
- **Security checks parse like the consumer.** Decide on URLs and paths with the same parser the webview or OS uses (`new URL`, `Url::parse`, one lexical walk in `snipmd_core::paths`), never with a prefix match; `:80`, `\\`, a newline or a trailing dot/space disguises a prefix.
- **Trust is applied after sanitizing.** Content the app vouches for (resolved image URLs) is set on the clean DOM, never recognized from a string or attribute the note could have written.
- **File-system commands run off the main thread.** Every Tauri command that touches the disk is `#[tauri::command(async)]` (or `async fn`); a plain sync command runs on the main thread, so a removed drive freezes the window.
- **Lasting messages are keyed.** An error that holds until its cause is fixed uses `showError(what, err, key)` and `clearInfo(key)` (`src/infobar.ts`); the info bar keeps it under newer messages. No module-level map of dismiss handles.
- **Closed tabs keep their text.** `closeTab` stores the latest text in `TabState.content` before dropping the editor state, so work still queued for that tab reads it through `textOf`. Don't capture text at call time to work around it.
- **Repeated work merges.** Saves of one tab run one at a time and a save asked for during a write joins the one queued behind it; it reads the newest text when it starts.
- **One landing point per effect.** Saved images enter a tab only through `placeImages` (`src/editor/paste.ts`): it primes the cache, inserts all links in one transaction and asks for the immediate session write. Paste and drop call it; neither repeats those steps.
- **One state per key.** A cache keeps one tagged entry per key (`ok` / `pending` / `failed`), not parallel maps and sets that each need clearing.
- **Decide once per command.** A Rust command resolves its target once into a type (`ImageHome`: note or untitled tab) and asks that type for folder, link prefix, name and resolver; no repeated `Option` checks down the call chain.
- **Capabilities are as narrow as the event.** A grant from a user action (dropped files) covers that action only: each drop replaces the set, and the asset scope only ever gets single image files.
- **Write first, then move the pointers.** A first save or Save As writes the new file before images move and links are rewritten; until that write succeeds the tab, its links and the original stay as they were. A folder move goes file by file and can be called again to finish.
- **Writes carry what they expect.** A note write sends the stamp the tab last saw; Rust refuses it when the file changed or went away, and the external-change module decides what happens. No write path skips that check except a new file the user just chose.
- **One owner per state, wired from the root.** Conflict state and its bars belong to `src/external.ts`; others call `resolveConflict` / `handleRefusedWrite`. When two modules need each other, `app.ts` passes the function in (`startExternalWatch(saveTab)`); no late-bound hooks with silent no-op defaults.
- **Bars report their own end.** A bar that stands for a pending choice uses `onClose` (fires for every way it goes) and `keepOpen` actions; nothing reaches into the info bar's DOM.
- **Lifecycle hooks at the root.** Flush-on-close hangs on the window's close-requested event, not on one button.
- Before finishing a phase, run `/simplify` and fold any new recurring lesson into this list.

## Verification
- Frontend: `npm run lint` (`tsc --noEmit`), `npm test` (Vitest, jsdom) and `npm run build`.
- Rust logic: `cargo test -p snipmd-core` in `src-tauri/`. Runs anywhere.
- Tauri crate: `cargo check` in `src-tauri/`. It needs the GTK system libraries on Linux; without them it fails on `gdk-3.0`, which is the environment, not the code. CI checks it on Windows for every push. Say which one ran.
- UI in a browser: `npx vite` plus a page with a mocked `window.__TAURI_INTERNALS__` (invoke, transformCallback, convertFileSrc, metadata) gives a quick smoke test; it does not replace the Windows test.
- Behavior that only exists on Windows (clipboard, Explorer, file association) can't be verified here; write down a concrete Windows test.

## Delegation
- The `thin-*` agents and the `thin-standard` workflow live in this repo: `.claude/agents/`, `.claude/workflows/thin-standard.js`. They load at session start, also in cloud sessions. Self-test (no tokens):
  `THIN_SCRIPT=.claude/workflows/thin-standard.js node .claude/workflows-tests/thin-standard/thin-standard.test.cjs` → `59/59 as expected`.
- Before a large task (audit, analysis, build, plan), state in one or two lines the deliverable ("done is when I see ...") and the scale, and match the process weight to the stakes.
- The main session owns design and integration. Subagents get a narrow brief: named files, a stated output, nothing open-ended. Prefer the `thin-*` agents when one fits; the built-in read-only agents (Explore, Plan) are fine for search.
- Contract first (file-ownership map plus exact interface signatures) before parallel writers; build the shared foundation yourself; one integrator makes it cohere.
- Standard workflow shape: `thin-standard`. The main session passes contract and briefs in `args`; the script only validates, dispatches thin-* units phase by phase, and stops at the first red gate. Show the `args` for approval before each run. A bespoke script only when the standard cannot express the task; show it first.
- Before a large design (3+ units, or a choice between architectures), run two thin-analyst units in parallel with different lenses (minimal change vs clean structure) and pick one; then write the contract.
- Propose thin-standard for coding work of 3+ units, disjoint files, runnable checks, solo above ~$1.50. Measured equal quality at -10 to -52% cost vs solo (N=1 per task); see `.claude/workflows-tests/thin-standard/CONCLUSION.md`.
- Every session or task card you propose states: recommended model, effort, worktree yes/no, local or cloud, with a one-line reason.
- `thin-web` needs the Claude in Chrome extension; it does not work in cloud sessions.
