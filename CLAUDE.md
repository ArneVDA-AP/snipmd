# CLAUDE.md — SnipMD Agent Rules & Pitfall Guardrails

## Authority & Workflow
- `PLAN.md`, `SPEC.md`, and `ARCHITECTURE.md` are the authoritative ground truth for this repository.
- Execute `PLAN.md` Phases 1 through 4 in order. After each phase, run the required compiler check (`cargo check` / `npm run build`) and update the phase checkbox `[x]` in `PLAN.md`.

## Critical Stack Guardrails (Do Not Violate)

1. **Tauri v2 Imports Only**:
   - Use `@tauri-apps/api/core` (`invoke`, `convertFileSrc`) and `@tauri-apps/api/window` (`getCurrentWindow`).
   - Do NOT use deprecated Tauri v1 `@tauri-apps/api/tauri` imports.

2. **CodeMirror 6 Block Widgets MUST Use `StateField`**:
   - CodeMirror 6 throws a runtime error if `Decoration.widget({ block: true })` is provided by a `ViewPlugin`.
   - You MUST provide the inline screenshot `DecorationSet` via `StateField.define<DecorationSet>({ ... provide: f => EditorView.decorations.from(f) })`.
   - Because `StateField.update` is synchronous and `invoke('resolve_asset_abs_path')` is async, cache resolved `.assets/...` -> `convertFileSrc(absPath)` URLs in a module-level `Map<string, string>` (pre-populated on paste, tab load, and via an async listener that dispatches a no-op state effect once new paths resolve).

3. **Collision-Proof Snip Naming & Atomic Creation**:
   - Snip filenames MUST follow `snip-YYYYMMDD-HHMMSS-mmm-XXXX.png` (milliseconds + 4-char random hex).
   - Always open the target file with `OpenOptions::new().write(true).create_new(true)`. Never use `std::fs::write` for new snips.
   - Across Windows drives (`C:\` to `D:\`), `std::fs::rename` fails with `EXDEV` / `ERROR_NOT_SAME_DEVICE`. In `promote_scratch_assets`, always fall back to `std::fs::copy` + `std::fs::remove_file` if `std::fs::rename` returns an error.

4. **Scratchpad Orphan Garbage Collection**:
   - Whenever an unsaved tab is promoted (`Ctrl+S`), closed (`Ctrl+W`), or restored at startup (`load_session`), ensure `gc_scratch_assets` sweeps `%APPDATA%/snip-md/scratchpad/.assets/` against the remaining live unsaved tab buffers so deleted snips never accumulate.
   - Do NOT trigger `gc_scratch_assets` on `window.blur` while unsaved tabs remain open, so `Ctrl+Z` (Undo) inside an active unsaved tab never points to a swept file.
