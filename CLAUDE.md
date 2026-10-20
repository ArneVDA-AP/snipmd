# CLAUDE.md — SnipMD

## Ground truth
- `SPEC.md` is the single source of truth for behavior. If code and spec disagree, the spec wins; if the spec is unclear or wrong, ask the user and update the spec first.
- `PLAN.md` is the cleanup plan from the prototype to `SPEC.md` v1. Do one phase at a time, on its own branch, and only the phase the user asked for.
- `ARCHITECTURE.md` describes the original prototype design and is **outdated** (shared `.assets/`, GC on tab close, localStorage). Don't follow it.

## Working with the user
- The user writes in Dutch; reply in Dutch. Code, comments, commit messages and repo docs are in English.
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
14. Nothing outside the v1 scope (SPEC §12) without the user's agreement.

## Verification
- Frontend: `npm run lint` (`tsc --noEmit`) and `npm run build`.
- Rust: `cargo check` in `src-tauri/`. On a Linux cloud box this fails on missing GTK system libraries (`gdk-3.0`); that is the environment, not the code. Say so instead of claiming the Rust side compiles.
- Behavior that only exists on Windows (clipboard, Explorer, file association) can't be verified here; give the user a concrete test to run.
