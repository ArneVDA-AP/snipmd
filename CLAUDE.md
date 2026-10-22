# CLAUDE.md — SnipMD

## Ground truth
- `SPEC.md` is the single source of truth for behavior. If code and spec disagree, the spec wins; if the spec is unclear or wrong, raise it and update the spec first.
- `ROADMAP.md` holds what is open and the decisions in force. Rewrite its sections when they change; don't append history. Deferred findings are GitHub issues.
- `ARCHITECTURE.md` explains the code layout as it is now; keep it current when the layout changes.

## Workflow
- Work on a branch, never directly on `main`. Commit and open PRs only when asked, or in an autonomous run.
- **Autonomous runs.** When the owner has handed over authority, the session decides: it commits, opens PRs and merges each once CI is green and its review has no open blocker or major. thin-standard args are written to `.claude/runs/` and used, not held for approval. Every decision gets a line in ROADMAP.md "Decisions in force"; the session ends with ROADMAP.md current, so a cold session can continue. The guardrails, the public-repo commit rules and "never rewrite `main`, never delete user data, never widen permissions" still hold.
- **Process records stay off `main` once their work is merged.** Reviews (`review/`), findings (`findings/`) and run args (`.claude/runs/`) live on the working branch; at each milestone they move to an archive branch (`archive/v1-process` holds v1). Screenshots for a review are workflow artifacts or files on a `test/` branch, not commits to `main`.

## Stack
- Tauri v2 (Rust) + vanilla TypeScript + Vite + CodeMirror 6 + `marked`.
- No UI frameworks (React, Vue, Svelte), no Tailwind, no web fonts. New dependencies need a reason that fits §9 of the spec (size, startup time).
- Tauri v2 imports only: `@tauri-apps/api/core` (`invoke`, `convertFileSrc`), `@tauri-apps/api/window`, `@tauri-apps/api/event`. Never `@tauri-apps/api/tauri`.

## Guardrails (do not violate)

### Data safety
1. Every write of a note or `session.json` is atomic: temp file in the same directory, flush, rename. Never `fs::write` straight onto the target.
2. New images use `OpenOptions::new().write(true).create_new(true)` with the `snip-YYYYMMDD-HHMMSS-mmm-XXXX.png` name, retrying on `AlreadyExists`.
3. Moving files across drives: if `fs::rename` fails, fall back to `fs::copy` + `fs::remove_file`, and only remove after the copy succeeded.
4. Cleanup only runs at startup, only inside `%APPDATA%/com.snipmd.desktop/scratch/`, and only deletes things older than 14 days that nothing in the session or the closed-tabs list references, nor a session kept aside as unreadable (SPEC §6.5). Never delete anything next to a user's note.
5. One failing file write must never block other tabs or the session save. Surface it in the info bar.
6. The session lives in `session.json` only. No localStorage for anything that must survive.

### Security
7. Treat every opened `.md` as untrusted. Sanitize read-mode HTML; keep a strict CSP; never use `innerHTML` with unescaped user content (file names, paths, note text).
8. Rust commands only touch paths in the allowed set (SPEC §8). Validate every path argument in Rust; never trust the frontend.
9. No `tauri-plugin-fs`. Asset protocol scope is granted per image file at runtime, never a folder or `**/*`.

### Editor
10. CodeMirror block widgets (`Decoration.widget({ block: true })`) must come from a `StateField`, not a `ViewPlugin`; CM6 throws otherwise.
11. `StateField.update` is synchronous, so resolved image URLs live in a cache; resolve asynchronously and dispatch an effect when a path resolves.
12. Async work started from a tab (paste, save) must be bound to that tab's id/state, not to "the active tab" at completion time.

### UX
13. No modal dialogs, toasts or `alert()`. All messages and choices go through the info bar (SPEC §4).
14. Nothing outside the v1 scope (SPEC §12) without agreement.

## Code conventions
Few rules, each general. A rule that a type, test or lint now enforces is deleted from this list; module details belong in ARCHITECTURE.md.

1. **One source of truth.** A tab's text lives in its CodeMirror `EditorState`; read it with `textOf`. `TabState.content` only feeds the session and a restore. Never mirror derived state; a cache keeps one tagged entry per key (`ok` / `pending` / `failed`).
2. **Nothing O(document) per keystroke.** The change listener only marks dirty and schedules; work that needs the text runs at save or session-write time, on debounce or idle.
3. **One path per concern.** Tab-list changes end in `changed()` (`src/tabs.ts`), image redraws in `redrawImages`, saved images enter a tab only through `placeImages`, errors go through `showError`. Reuse `src/paths.ts` and `src/dom.ts`; prefer what CodeMirror, marked or the platform already offer.
4. **Async work is bound to a tab id**, applied through `applyToTab`, never to "the active tab" at completion. A closed tab is a tab without a view: `getTab` finds it, so late work lands in it; `openTab` / `getTabs` are for what the user sees.
5. **Parse like the consumer, trust after sanitizing.** Paths are normalized once where they enter (`src/paths.ts`, `samePath`); URLs and paths are judged with the parser the webview or OS uses, never a prefix match. Content the app vouches for is set on the clean DOM.
6. **Writes are safe by construction.** Every write carries the stamp it expects and Rust refuses a stale one; a first save or Save As writes the new file before images move or links change; saves of one tab run one at a time and merge.
7. **Nothing is lost silently.** Unwritten edits outlive every limit and are reported in a lasting, keyed bar with Restore; a tab's bars have keys ending in `:<tab id>`.
8. **Wired once, from the root.** Each state has one owner module (conflicts: `src/external.ts`). Modules that need each other get the function passed in at init (`initTabs`, `initRegistry`, `startExternalWatch`); an unwired hook throws. Lifecycle work hangs on the window's close event and Rust's `.setup()`.
9. **Rust commands.** Every command that touches the disk is async; a command resolves its target once into a type (`ImageHome`); a capability is as narrow as the user action that granted it.
10. **Plain code.** Thin layers stay thin (`src/ipc.ts` only wraps); no dead exports or payloads nobody reads; independent I/O runs in parallel and one failure never blocks the rest; a failure never triggers the same work again; a held key acts once (only tab switching repeats). Comments say why, never which plan step, review or phase produced the code.

Before finishing a change, run `/simplify`. A recurring lesson goes into an existing rule above or into a test, not into a new bullet.

## Verification
- Frontend: `npm run lint` (`tsc --noEmit`), `npm test` (Vitest, jsdom) and `npm run build`.
- Rust logic: `cargo test -p snipmd-core` in `src-tauri/`. Runs anywhere.
- Tauri crate: `cargo check` in `src-tauri/`. It needs the GTK system libraries on Linux; without them it fails on `gdk-3.0`, which is the environment, not the code. CI checks it on Windows and macOS for every push. Say which one ran.
- UI in a browser: `npx vite` plus a page with a mocked `window.__TAURI_INTERNALS__` (invoke, transformCallback, convertFileSrc, metadata) gives a quick smoke test; it does not replace the Windows test.
- Behavior that only exists on Windows (clipboard, Explorer, file association) can't be verified here; write down a concrete Windows test.
- The browser smoke test runs without Tauri's CSP. Anything that injects styles or scripts at run time looks right there and can be blocked in the app; check it in a release build (`windows-run.yml` screenshots the real window on a Windows runner).

## Delegation
- The `thin-*` agents and the `thin-standard` workflow live in this repo: `.claude/agents/`, `.claude/workflows/thin-standard.js`. They load at session start, also in cloud sessions. Self-test (no tokens):
  `THIN_SCRIPT=.claude/workflows/thin-standard.js node .claude/workflows-tests/thin-standard/thin-standard.test.cjs` → `59/59 as expected`.
- Before a large task (audit, analysis, build, plan), state in one or two lines the deliverable ("done is when I see ...") and the scale, and match the process weight to the stakes.
- The main session owns design and integration. Subagents get a narrow brief: named files, a stated output, nothing open-ended. Prefer the `thin-*` agents when one fits; the built-in read-only agents (Explore, Plan) are fine for search.
- Contract first (file-ownership map plus exact interface signatures) before parallel writers; build the shared foundation yourself; one integrator makes it cohere.
- Standard workflow shape: `thin-standard`. The main session passes contract and briefs in `args`; the script only validates, dispatches thin-* units phase by phase, and stops at the first red gate. Show the `args` for approval before each run (in an autonomous run: record them, see Workflow). A bespoke script only when the standard cannot express the task; show it first.
- Before a large design (3+ units, or a choice between architectures), run two thin-analyst units in parallel with different lenses (minimal change vs clean structure) and pick one; then write the contract.
- Propose thin-standard for coding work of 3+ units, disjoint files, runnable checks, solo above ~$1.50. Measured equal quality at -10 to -52% cost vs solo (N=1 per task); see `.claude/workflows-tests/thin-standard/CONCLUSION.md`.
- Every session or task card you propose states: recommended model, effort, worktree yes/no, local or cloud, with a one-line reason.
- `thin-web` needs the Claude in Chrome extension; it does not work in cloud sessions.
