# SnipMD — Cleanup Plan

Goal: get the prototype to `SPEC.md` v1. One phase = one branch + PR. Each phase ends with `npm run lint`, `npm run build`, `cargo check` (on Windows or CI), and a short Windows test the user runs. Update the checkbox when a phase is merged.

Order: remove first, so later phases touch less code. Then security and storage, because every later feature depends on them.

## [ ] 0. Strip
Remove what is outside v1 scope or only exists for the browser demo.
- Delete: browser fake filesystem and demo content in `src/ipc/bridge.ts` (bridge keeps only `invoke` wrappers), `src/utils/snipSimulator.ts`, `src/ui/inspector.ts`, `src/ui/modal.ts`, `src/styles/themes.ts`, export, split view, status bar, demo tabs in `TabManager`.
- Delete: `.aistudio/`, `metadata.json`, `.env.example`, `public/releases/`, `scripts/test-connected-files.ps1`.
- Dependencies: drop React, Tailwind, Express, `@google/genai`, `motion`, `lucide-react`, `dotenv`, `tsx`, their Vite plugins and the `jsx` tsconfig setting. Drop `tauri-plugin-fs` and its `fs:default` permission.
- CSS: one light and one dark palette following `prefers-color-scheme`, system fonts, no Google Fonts.
- Commit `package-lock.json` and `src-tauri/Cargo.lock`; CI uses `npm ci` instead of deleting the lockfile.

Done when: the app starts on one empty untitled tab; bundle and dependency list contain nothing from the list above.

## [ ] 1. Security (SPEC §8)
- Rust: an allowed-paths registry (opened files, their `<stem>.assets/`, `%APPDATA%/snip-md/`). Every command validates its path arguments against it; relative image paths may not escape the note folder.
- Asset protocol: scope empty in config, granted per folder at runtime.
- Read mode: sanitize `marked` output (DOMPurify); escape file names and paths in all `innerHTML`.
- Strict CSP in `tauri.conf.json`.
- Pure logic (path checks, file naming, link rewriting, cleanup selection) lives in a Rust module without Tauri imports, with `cargo test` unit tests, so it runs on any machine.

Done when: a test note with `<img onerror>`, `javascript:` links and `../../` image paths opens harmlessly in both modes.

## [ ] 2. Storage foundation (SPEC §6.1, §7)
- Atomic writes for notes and `session.json`.
- `session.json` is the only session store; remove localStorage. Write rules per §7 (debounced 500 ms, immediate after paste, tab change, save, blur, close).
- Info bar component (SPEC §4). Write failures show there and never block other tabs or the session save.
- Startup restores clean disk tabs from disk, not from the cache.

Done when: paste, Alt+F4 immediately, restart → image and text are there. Pull a USB stick with an open note → error bar, other tabs keep saving.

## [ ] 3. Images and paste (SPEC §6.3)
- Per-note `<stem>.assets/`; untitled tabs use `scratch/<tab-id>/` linked as `untitled.assets/`.
- Raw binary IPC for image bytes.
- Paste rules: text wins, image only when the clipboard has no text, `Ctrl+Shift+V` plain.
- Paste bound to its tab; link encoding for spaces and `( ) # %`.
- Image drop through Tauri's drag-drop event, inserted at the drop position.
- Missing-image placeholder; no images rendered inside code blocks.

Done when: a 4K screenshot appears in under 150 ms; copying Excel cells pastes text; a tab switch mid-paste puts the link in the right tab.

## [ ] 4. Saving flows (SPEC §6.1, §6.2, §6.4)
- Autosave 1 s after typing, plus on blur and close.
- First-save info bar (name from first heading, last-used folder), `Ctrl+Shift+S` Save As.
- Moving the scratch folder to `<stem>.assets/` and rewriting links as one undoable transaction; Save As copies the folder.
- Preserve line endings and BOM.
- External change detection: silent reload when clean, conflict bar when dirty.
- Undo history survives the first save.

Done when: untitled note with screenshots → Ctrl+S → Enter → file and folder sit side by side and open correctly in VS Code and on GitHub.

## [ ] 5. Tabs and recovery (SPEC §7, §10, §11)
- Closed-tabs list in the session, restore bar, `Ctrl+Shift+T` after restart too.
- Startup cleanup with the 14-day rule (§6.5).
- Full keyboard table; single instance resolves relative paths against the caller's working directory.

Done when: Ctrl+W on an untitled tab with images, restart the app, Ctrl+Shift+T → tab and images are back.

## [ ] 6. Editor and measuring (SPEC §5, §9)
- Light Markdown styling, find and replace, read mode via `Ctrl+E`.
- Measure the §9 budgets on Windows and record them in this file. Anything over budget gets fixed before v1.

Done when: every row in SPEC §9 has a measured value under its target.
