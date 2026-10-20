> **Outdated.** This describes the original prototype design and is superseded by `SPEC.md`. Kept for reference until the cleanup replaces it.

# SnipMD — Plan-Mode Execution Blueprint (Shared Substrate)

## 1. Authoritative Technical Constraints
- **Stack**: Tauri v2 (Rust) + Vanilla TypeScript + Vite + CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`, `@codemirror/commands`, `@codemirror/language`) + `marked`.
- **Zero UI Frameworks**: Do NOT install React, Vue, Svelte, or Tailwind. Use clean modular TypeScript and vanilla CSS variables (`src/styles/main.css`).
- **Tauri v2 Asset Protocol**: `src-tauri/tauri.conf.json` MUST enable `assetProtocol` with `"allow": ["**/*"]` and `"requireLiteralLeadingDot": false` so `.assets/` folders on any drive letter (`C:\`, `D:\`, etc.) render inside WebView2.

---

## 2. Rust Backend IPC Signatures (`src-tauri/src/lib.rs`)

All commands must be registered in `tauri::generate_handler![]`:

1. `save_clipboard_image(app: tauri::AppHandle, bytes: Vec<u8>, current_file_path: Option<String>) -> Result<SaveImageResult, String>`
   - Struct `SaveImageResult { markdown_rel_path: String, abs_disk_path: String }` (`#[derive(Serialize)]`, `#[serde(rename_all = "camelCase")]`).
   - Resolve target `.assets` directory:
     - If `current_file_path` is `Some(p)`, use `<parent_of_p>/.assets`.
     - If `None`, use `<app_data_dir>/scratchpad/.assets`.
   - Generate filename: `snip-YYYYMMDD-HHMMSS-mmm-XXXX.png` using `chrono::Local::now().format("%Y%m%d-%H%M%S-%3f")` and a 4-char lowercase hex suffix generated from `rand` (or atomic counter + subsec nanos).
   - Write file using `std::fs::OpenOptions::new().write(true).create_new(true)`. Loop with a fresh suffix if `ErrorKind::AlreadyExists`.
   - Return `markdown_rel_path: format!(".assets/{filename}")` and `abs_disk_path`.

2. `resolve_asset_abs_path(app: tauri::AppHandle, rel_path: String, current_file_path: Option<String>) -> Result<String, String>`
   - Resolves `.assets/...` against `current_file_path` parent dir (or `<app_data_dir>/scratchpad` when `None`) and returns the canonical/normalized absolute path string for `convertFileSrc()`.

3. `promote_scratch_assets(app: tauri::AppHandle, content: String, target_md_path: String, remaining_unsaved_contents: Vec<String>) -> Result<(), String>`
   - Regex-scan `content` for `\.assets/(snip-[A-Za-z0-9_-]+\.png)`.
   - Create `<parent_of_target_md_path>/.assets` if any matches exist.
   - For each matched filename present in `<app_data_dir>/scratchpad/.assets/`, move (`std::fs::rename`, falling back to `copy` + `remove_file` across volume boundaries) to `<parent_of_target_md_path>/.assets/<filename>`.
   - Call `gc_scratch_assets(app, remaining_unsaved_contents)` to purge any unreferenced scratchpad snips left over from deleted lines in the promoted tab.

4. `gc_scratch_assets(app: tauri::AppHandle, live_unsaved_contents: Vec<String>) -> Result<usize, String>`
   - Scan all strings in `live_unsaved_contents` for `\.assets/(snip-[A-Za-z0-9_-]+\.png)` and collect into a `HashSet<String>`.
   - Read `<app_data_dir>/scratchpad/.assets/`. For each `snip-*.png` entry whose file name is NOT in the `HashSet`, remove it via `std::fs::remove_file`. Return count of deleted orphan files.

5. `read_markdown_file(path: String) -> Result<String, String>` & `write_markdown_file(path: String, content: String) -> Result<(), String>`

6. `load_session(app: tauri::AppHandle) -> Result<Option<String>, String>` & `save_session(app: tauri::AppHandle, json: String) -> Result<(), String>`
   - Reads/writes `<app_data_dir>/session.json`.
   - Inside `load_session`, if `session.json` exists, deserialize the unsaved tab contents (`filePath == null`) and execute `gc_scratch_assets` automatically so any orphan files from prior crashes are cleaned up on launch.

7. `get_cli_startup_files() -> Vec<String>`
   - Collects existing `.md` file paths from `std::env::args().skip(1)`.

---

## 3. Phased Execution Plan

### [x] Phase 1: Project Scaffold & Rust Backend
- Initialize Tauri v2 + Vanilla TS Vite structure (`package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src-tauri/`).
- Add Rust crates in `src-tauri/Cargo.toml`: `tauri`, `tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-single-instance`, `serde`, `serde_json`, `chrono`, `regex`, `rand`.
- Configure `src-tauri/tauri.conf.json` (`decorations: false`, `assetProtocol` enabled with `requireLiteralLeadingDot: false`).
- Configure capabilities in `src-tauri/capabilities/default.json` (`core:default`, `core:window:allow-minimize`, `core:window:allow-toggle-maximize`, `core:window:allow-close`, `core:window:allow-start-dragging`, `dialog:default`).
- Implement all 7 IPC commands in `src-tauri/src/lib.rs`, including `OpenOptions::create_new(true)` collision protection and `gc_scratch_assets`.
- **Verification Gate 1**: Run `cargo check` inside `src-tauri/` and fix all warnings/errors.

### [x] Phase 2: Frameless UI Shell, TabManager & Hot-Exit Lifecycle
- Build `src/styles/main.css` with minimalist dark styling, 34px frameless header, dirty tab indicator, and `.inline-img-widget` rules (`max-height: 360px`, `.expanded { max-height: none }`).
- Build `src/ui/titlebar.ts` wiring window controls (`getCurrentWindow().minimize()`, `toggleMaximize()`, `close()`), tab switching, middle-click close, and mode badge toggle.
- Build `src/state/TabManager.ts`:
  - Maintain array of tabs (`id`, `title`, `filePath: string | null`, `content`, `dirty`, `mode: 'edit' | 'preview'`, `scrollTop`, `cursorPos`, `editorState`).
  - Wire `Ctrl+T` (new scratch tab), `Ctrl+O` (open file via `@tauri-apps/plugin-dialog`), `Ctrl+S` (save file; if `filePath == null`, open save dialog, call `promote_scratch_assets` with remaining unsaved tab contents, then write file), `Ctrl+W` (close tab; if closing an unsaved tab, invoke `gc_scratch_assets` with remaining unsaved tab contents), `Ctrl+Tab` (cycle tabs).
  - Wire `window.addEventListener('blur')` to write dirty disk-backed tabs and invoke `save_session`.
- **Verification Gate 2**: Run `npm run build` (`tsc && vite build`) with zero errors.

### [x] Phase 3: CodeMirror 6 Editor, Snipping Tool Paste & Block Image Widget
- Implement `src/editor/pasteHandler.ts`:
  - Use `EditorView.domEventHandlers({ paste(event, view) })`.
  - Detect `image/png` in `event.clipboardData.items`, read `arrayBuffer()`, invoke `save_clipboard_image`, and dispatch transaction inserting `![snip](.assets/snip-...)` at selection.
- Implement `src/editor/imageWidget.ts`:
  - Define a CodeMirror 6 `StateField<DecorationSet>` (NOT `ViewPlugin`, as CM6 requires `StateField` for `block: true` decorations).
  - Pre-resolve or cache `.assets/...` paths via `resolve_asset_abs_path` + `convertFileSrc()` and render `<div class="inline-img-widget"><img src="..." /></div>` directly below each `![...](...)` line.
  - Wire click handler on the `<img>` to toggle `.expanded`.
- Assemble CM6 instance in `src/editor/setup.ts` with `@codemirror/lang-markdown`, dark syntax theme, Sublime keymap, paste handler, and image widget field.
- **Verification Gate 3**: Run `npm run build` and `cargo check` with zero errors.

### [x] Phase 4: `Ctrl+E` Rendered View & Drag-and-Drop Polish
- Implement `src/preview/renderer.ts` using `marked` with custom image renderer that rewrites `.assets/...` paths to resolved `convertFileSrc()` URLs and attaches the `360px` click-to-expand handler.
- Bind `Ctrl+E` and the topbar pill to toggle active tab between CM6 Edit view and Rendered HTML view while preserving scroll percentage.
- Register `getCurrentWindow().onDragDropEvent` to open dropped `.md` files in new tabs, plus `listen('open-files')` from `tauri-plugin-single-instance`.
- **Verification Gate 4**: Run `npm run build` and `cargo check` in `src-tauri/`. Mark all phases `[x]` in `PLAN.md`.
