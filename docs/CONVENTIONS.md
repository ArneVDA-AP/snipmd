# Conventions

The rules for every change to SnipMD, whoever writes it. Behaviour is defined in [`SPEC.md`](SPEC.md); how the code is laid out and why is in [`ARCHITECTURE.md`](ARCHITECTURE.md). Setup and pull requests: [CONTRIBUTING](../.github/CONTRIBUTING.md).

## Ground truth
- `docs/SPEC.md` is the single source of truth for behavior. If code and spec disagree, the spec wins; if the spec is unclear or wrong, raise it and update the spec first.
- `docs/ARCHITECTURE.md` explains the code layout as it is now; keep it current when the layout changes.

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
Few rules, each general. A rule that a type, test or lint now enforces is deleted from this list; module details belong in `docs/ARCHITECTURE.md`.

1. **One source of truth.** A tab's text lives in its CodeMirror `EditorState`; read it with `textOf`. `TabState.content` only feeds the session and a restore. Never mirror derived state; a cache keeps one tagged entry per key (`ok` / `pending` / `failed`).
2. **Nothing O(document) per keystroke.** The change listener only marks dirty and schedules; work that needs the text runs at save or session-write time, on debounce or idle.
3. **One path per concern.** Tab-list changes end in `changed()` (`src/tabs.ts`), image redraws in `redrawImages`, saved images enter a tab only through `placeImages`, errors go through `showError`. Reuse `src/paths.ts` and `src/dom.ts`; prefer what CodeMirror, marked or the platform already offer.
4. **Async work is bound to a tab id**, applied through `applyToTab`, never to "the active tab" at completion. A closed tab is a tab without a view: `getTab` finds it, so late work lands in it; `openTab` / `getTabs` are for what the user sees.
5. **Parse like the consumer, trust after sanitizing.** Paths are normalized once where they enter (`src/paths.ts`, `samePath`); URLs and paths are judged with the parser the webview or OS uses, never a prefix match. Content the app vouches for is set on the clean DOM.
6. **Writes are safe by construction.** Every write carries the stamp it expects and Rust refuses a stale one; a first save or Save As writes the new file before images move or links change; saves of one tab run one at a time and merge.
7. **Nothing is lost silently.** Unwritten edits outlive every limit and are reported in a lasting, keyed bar with Restore; a tab's bars have keys ending in `:<tab id>`.
8. **Wired once, from the root.** Each state has one owner module (conflicts: the flag in `src/diskState.ts`, the bars in `src/external.ts`). Modules that need each other get the function passed in at init (`initTabs`, `initRegistry`, `startExternalWatch`); an unwired hook throws. Lifecycle work hangs on the window's close event and Rust's `.setup()`.
9. **Rust commands.** Every command that touches the disk is async; a command resolves its target once into a type (`ImageHome`); a capability is as narrow as the user action that granted it.
10. **Plain code.** Thin layers stay thin (`src/ipc.ts` only wraps); no dead exports or payloads nobody reads; independent I/O runs in parallel and one failure never blocks the rest; a failure never triggers the same work again; a held key acts once (only tab switching repeats). Comments say why, never which plan step, review or phase produced the code.

A recurring lesson goes into an existing rule above or into a test, not into a new bullet.

## Verification
- Frontend: `npm run lint` (`tsc --noEmit`), `npm test` (Vitest, jsdom) and `npm run build`.
- Rust logic: `cargo test -p snipmd-core` in `src-tauri/`. Runs anywhere.
- Tauri crate: `cargo check` in `src-tauri/`. It needs the GTK system libraries on Linux; without them it fails on `gdk-3.0`, which is the environment, not the code. CI checks it on Windows and macOS for every push. Say in the PR which one ran.
- UI in a browser: `npx vite` plus a page with a mocked `window.__TAURI_INTERNALS__` (invoke, transformCallback, convertFileSrc, metadata) gives a quick smoke test; it does not replace the Windows test.
- Behavior that only exists on Windows (clipboard, Explorer, file association) can't be verified on Linux or macOS; write down a concrete Windows test.
- The browser smoke test runs without Tauri's CSP. Anything that injects styles or scripts at run time looks right there and can be blocked in the app; check it in a release build (`windows-run.yml` screenshots the real window on a Windows runner).
