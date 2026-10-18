# SnipMD — Frameless Markdown & Instant Snipping Workspace

SnipMD is an ultra-lightweight, frameless Markdown note-taking application engineered for instant cold-start, Sublime-style multi-tab ergonomics, hot-exit session persistence, and zero-friction `Win+Shift+S` (`Ctrl+V`) screenshot capture with always-on inline image rendering.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and product choices have been confirmed from your answers and integrated with the SnipMD specification:

- **Confirmed Decision 1 — Dual-Mode Tauri v2 + Live Browser Preview**: We will build the complete Tauri v2 Rust backend crate (implementing all 7 IPC commands, atomic `create_new(true)` writes, cross-volume promotion fallback, and mark-and-sweep orphan garbage collection) alongside a transparent Dual-Mode Runtime Bridge. When running inside the desktop Tauri shell, calls route to `@tauri-apps/api/core` and `@tauri-apps/api/window`; when running in the web preview environment, calls route seamlessly to a full-parity virtual filesystem backed by persistent browser storage so every feature (`Ctrl+V` snip paste, `.assets/` promotion, orphan GC, file open/save dialogs, drag-and-drop `.md` files, and `window.blur` hot-exit) works out-of-the-box in both environments.
- **Confirmed Decision 2 — Zero-Framework Vanilla TypeScript + CodeMirror 6**: The frontend uses modular Vanilla TypeScript, native CSS custom properties, CodeMirror 6 (`StateField` block image widgets, Markdown syntax highlighting, Sublime keymap, and DOM paste interception), and `marked` for `Ctrl+E` rendered preview—avoiding React/Tailwind overhead.
- **Confirmed Decision 3 — Built-in Snip Simulator**: Alongside native `Win+Shift+S` -> `Ctrl+V` clipboard image pasting, the 34px frameless titlebar includes a single-line **Simulate Snip** action that synthesizes a realistic high-DPI diagram/terminal screenshot PNG buffer and runs it through the exact same `save_clipboard_image` IPC pipeline for effortless testing in the browser preview.

---

## 1. Overview & Core Concept

- **What It Does**: SnipMD lets engineers and technical writers capture notes and paste clipboard screenshots (`Win+Shift+S` then `Ctrl+V`) directly into Markdown buffers without manual file-saving dialogs. Screenshots are automatically named with collision-proof millisecond + hex timestamps (`snip-YYYYMMDD-HHMMSS-mmm-XXXX.png`), routed to either a sidecar `.assets/` directory (for saved files) or `%APPDATA%/snip-md/scratchpad/.assets/` (for unsaved scratch tabs), and rendered inline immediately below the Markdown `![snip](.assets/...)` syntax inside CodeMirror 6.
- **Target Audience / Persona**: Developers, systems architects, QA engineers, and technical note-takers who live in keyboard-driven editors and frequently capture visual evidence alongside structured Markdown notes.
- **Key Value**: Eliminates the manual "take screenshot -> save to folder -> copy relative path -> write Markdown syntax -> switch to preview pane" loop, while keeping `.assets/` directories and `%APPDATA%` completely free of orphaned image files when scratchpad lines are edited or deleted.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Instant Scratchpad & Snipping (`Ctrl+T` -> `Win+Shift+S` -> `Ctrl+V`)**:
   - User opens SnipMD or presses `Ctrl+T` to create an unsaved `Untitled-N` scratch tab.
   - User captures a screenshot (`Win+Shift+S`) and presses `Ctrl+V` in the editor (or clicks **Simulate Snip** in the top bar).
   - The paste interceptor extracts the PNG `Uint8Array`, invokes `save_clipboard_image`, inserts `![snip](.assets/snip-YYYYMMDD-HHMMSS-mmm-XXXX.png)` at the cursor, pre-populates the synchronous URL resolution cache, and renders a capped `360px` inline image widget directly underneath the Markdown line.
2. **Inline Image Inspection & `Ctrl+E` Rendered Mode**:
   - In CodeMirror 6 Edit Mode, every `![alt](path)` line displays a live block widget below the source line showing the image and its resolved `.assets/...` metadata caption.
   - Clicking any inline image (in either Edit Mode or `Ctrl+E` Rendered Mode) smoothly toggles `.expanded` (`max-height: 360px` with `zoom-in` cursor $\leftrightarrow$ `max-height: none` with `zoom-out` cursor).
   - Pressing `Ctrl+E` or clicking the mode toggle switches between CodeMirror 6 Edit Mode and full `marked` HTML Rendered Mode while preserving exact vertical scroll percentage.
3. **Scratchpad Promotion (`Ctrl+S`) & Mark-and-Sweep GC (`Ctrl+W` / Startup)**:
   - Pressing `Ctrl+S` on an unsaved tab opens a save dialog (native Tauri dialog on desktop; clean filename/path modal in browser preview).
   - `promote_scratch_assets` scans the buffer for referenced `.assets/snip-*.png` tokens, moves them from `scratchpad/.assets/` into `<target_md_dir>/.assets/` (with cross-drive copy+remove fallback), writes the Markdown file, and immediately runs `gc_scratch_assets` across remaining unsaved tabs so any snips deleted before saving are swept away.
   - Closing an unsaved tab (`Ctrl+W` or middle-click) or launching the app (`load_session`) also triggers `gc_scratch_assets` against live unsaved buffers.
4. **Hot-Exit & Focus-Loss Auto-Save (`window.blur`)**:
   - Clicking outside the window automatically flushes all dirty disk-backed tabs (`filePath != null`) to disk and serializes the entire workspace state (tabs, unsaved buffers, active tab ID, cursor position, scroll offset) to `session.json` with a subtle status confirmation—without sweeping scratchpad assets on blur so `Ctrl+Z` (Undo) remains intact during active editing.

### Visual Identity & Theme
- **Aesthetic Direction**: Utilitarian dark code editor inspired by Sublime Text and Zed—zero decorative chrome, razor-sharp 1px structural borders, high-contrast syntax tokens, and responsive keyboard-first affordances.
- **Color Palette & Mood**:
  - **60% Dominant Neutral Canvas**: Deep zinc editor surface (`--bg-main: #18181b`) with outer frame (`#09090b`).
  - **30% Structural Surfaces**: Recessed 34px titlebar (`--bg-bar: #121215`), tab hover surface (`--bg-tab-hover: #222227`), subtle hairline borders (`--border: #27272c`), primary prose (`--text-main: #e4e4e7`), and muted metadata (`--text-muted: #71717a`).
  - **10% Accent & Syntax Budget**: Active tab indicator and Rendered Mode accent (`--accent: #a855f7`), Markdown heading token (`--syn-h: #f472b6`), inline code token (`--syn-code: #38bdf8`), image link token and save confirmation (`--syn-img: #4ade80`), and window close hover (`#dc2626`).
- **Typography & Hierarchy**:
  - **UI & Rendered Prose (`--font-sans`)**: `Plus Jakarta Sans` / system sans-serif for crisp 12px tab labels and clean rendered Markdown typography (`1.6rem` H1 with bottom border, `1.25rem` H2, `1.7` line-height body prose).
  - **Editor & Telemetry (`--font-mono`)**: `JetBrains Mono` / `Cascadia Code` at `14px` (`1.65` line-height) with `tabular-nums` for line editing, inline code spans, and `.assets/` image metadata captions.
- **Component Styling & Layout**:
  - Single 34px frameless top bar (`decorations: false`) containing the horizontal scrollable tab strip (with dirty indicator dot and middle-click close), `+` new tab button (`Ctrl+T`), draggable window region (`data-tauri-drag-region`), auto-save toast, **Simulate Snip** button, mode toggle button (`RAW + INLINE IMG` / `RENDERED MD`), and native window controls (`─`, `□`, `✕`).
  - Centered, distraction-free editor workspace (`padding: 28px 12%`) supporting full 1440px desktop width.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — CodeMirror 6 `StateField` with Synchronous Asset URL Cache**:
  - *Chosen Approach*: Provide inline image widgets via `StateField.define<DecorationSet>({ provide: f => EditorView.decorations.from(f) })` backed by a module-level synchronous `Map<string, string>` cache (`cacheKey = "${filePath ?? 'scratchpad'}::${relPath}"`) and a ` StateEffect` trigger when new paths resolve asynchronously.
  - *Why*: CodeMirror 6 strictly prohibits `Decoration.widget({ block: true })` inside a `ViewPlugin` (throwing a runtime error), and `StateField.update` is synchronous whereas IPC (`resolve_asset_abs_path`) is asynchronous. Pre-populating the cache on paste/tab-load and dispatching a lightweight state effect on async resolution gives zero-flicker inline rendering without violating CM6 invariants.
- **Decision 2 — Collision-Proof Atomic Snip Creation & Cross-Volume Fallback**:
  - *Chosen Approach*: Format filenames as `snip-YYYYMMDD-HHMMSS-mmm-XXXX.png` and open target files exclusively with `OpenOptions::new().write(true).create_new(true)` inside a retry loop; in `promote_scratch_assets`, fall back from `std::fs::rename` to `std::fs::copy` + `std::fs::remove_file` on cross-drive (`EXDEV` / `ERROR_NOT_SAME_DEVICE`) errors.
  - *Why*: Guarantees zero silent overwrites even under rapid automated pastes and ensures saving a scratch tab from `%APPDATA%` on `C:\` to a project folder on `D:\` never fails.
- **Decision 3 — Dual-Mode IPC Bridge for Browser Preview + Desktop Parity**:
  - *Chosen Approach*: Centralize all 7 backend commands in an IPC adapter that detects `window.__TAURI_INTERNALS__`. In Tauri, it invokes the Rust backend directly; in the browser preview, it executes an isomorphic TypeScript implementation of the exact same 7 commands over persistent storage (with realistic initial demo notes and a virtual filesystem dialog).
  - *Why*: Satisfies all Rust/Tauri v2 compilation gates while letting you test every keyboard shortcut, snip paste, scratchpad promotion, and garbage collection flow directly in the live preview.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     34px Frameless Titlebar & Tab Strip                      │
│  [Tab 1 •] [Untitled-1 •] [+]   <drag-region>   [+ Snip] [RAW/MD] [─][□][✕]  │
└──────────────────┬────────────────────────────────────────┬──────────────────┘
                   │                                        │
                   ▼                                        ▼
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│     TabManager & Session Engine     │  │      Workspace Viewport Router      │
│  • Multi-tab state & dirty tracking │  │  • Preserves scroll % across modes  │
│  • Ctrl+T / O / S / W / E / Tab     │  │  • Drag & drop .md file listener    │
│  • window.blur auto-save & hot-exit │  │  • Single-instance open-files hook  │
└─────────┬─────────────────┬─────────┘  └──────────┬───────────────┬──────────┘
          │                 │                       │               │
          │                 │            ┌──────────▼─────┐  ┌──────▼──────────┐
          │                 │            │ CodeMirror 6   │  │ Marked HTML     │
          │                 │            │ Edit View      │  │ Rendered View   │
          │                 │            │ • pasteHandler │  │ • Custom img    │
          │                 │            │ • imageWidget  │  │   renderer      │
          │                 │            │   (StateField) │  │ • 360px/expand  │
          │                 │            └───────┬────────┘  └────────┬────────┘
          ▼                 ▼                    │                    │
┌────────────────────────────────────────────────▼────────────────────▼────────┐
│            Dual-Mode IPC Bridge (Tauri v2 invoke / Web FS Adapter)           │
│  1. save_clipboard_image          5. read_markdown_file / write_markdown_file│
│  2. resolve_asset_abs_path        6. load_session / save_session (+ boot GC) │
│  3. promote_scratch_assets        7. get_cli_startup_files                   │
│  4. gc_scratch_assets                                                        │
└──────────────────────┬────────────────────────────────────┬──────────────────┘
                       ▼                                    ▼
┌─────────────────────────────────────────┐  ┌─────────────────────────────────┐
│     Tauri v2 Rust Core (src-tauri)      │  │   Browser Preview Storage VFS   │
│  • OpenOptions::create_new(true)        │  │  • LocalStorage / Blob URL VFS  │
│  • Cross-drive rename -> copy+remove    │  │  • Virtual Save/Open Modal      │
│  • Regex mark-and-sweep orphan GC       │  │  • Synthetic PNG Snip Generator │
└─────────────────────────────────────────┘  └─────────────────────────────────┘
```

### Data Model & State
- **`TabState`**:
  - `id: string` — Unique tab identifier.
  - `title: string` — Filename (e.g., `architecture-notes.md`) or `Untitled-N`.
  - `filePath: string | null` — Absolute disk path when saved, or `null` for scratchpad tabs.
  - `content: string` — Raw Markdown buffer text.
  - `dirty: boolean` — Unsaved modification indicator (purple dot in tab strip).
  - `mode: 'edit' | 'preview'` — Per-tab or global toggle between CM6 Edit Mode and Marked Rendered Mode.
  - `scrollTop: number` & `scrollRatio: number` — Preserved vertical scroll position across tab switches and `Ctrl+E` mode flips.
  - `cursorPos: number` — Caret offset persisted across sessions.
- **Asset URL Resolution Cache (`Map<string, string>`)**:
  - Maps `${filePath ?? '__scratch__'}::${markdownRelPath}` to a resolved `asset://` URL (via `convertFileSrc(absDiskPath)`) or Blob/Data URL in web preview.
  - Synchronously read by CodeMirror 6's `imageWidgetField` (`StateField<DecorationSet>`) to construct `<div class="inline-img-widget"><img src="..." /><div class="img-meta">...</div></div>` block decorations below every `![alt](path)` line.

### Interactive Component & State Mapping
- **Clipboard & Simulated Snip Paste (`pasteHandler.ts`)**:
  - Intercepts `paste` events containing `image/*` items (or receives a synthesized PNG `Uint8Array` from the **Simulate Snip** button).
  - Calls `save_clipboard_image(bytes, currentFilePath)` $\rightarrow$ receives `{ markdownRelPath, absDiskPath }`.
  - Immediately registers `convertFileSrc(absDiskPath)` in the synchronous asset cache, inserts `![snip](.assets/snip-...)` at the current selection, and marks the tab `dirty: true`.
- **Save & Scratchpad Promotion (`Ctrl+S` in `TabManager.ts`)**:
  - If `filePath !== null`: invokes `write_markdown_file(filePath, content)` and clears `dirty`.
  - If `filePath === null`: prompts for target `.md` path $\rightarrow$ collects `remainingUnsavedContents` from all other `filePath === null` tabs $\rightarrow$ invokes `promote_scratch_assets(content, targetMdPath, remainingUnsavedContents)` $\rightarrow$ invokes `write_markdown_file(targetMdPath, content)` $\rightarrow$ updates tab `filePath`, `title`, clears `dirty`, and re-keys cached asset URLs to the new `targetMdPath`.
- **Tab Close & Orphan Sweep (`Ctrl+W` / Middle-Click)**:
  - Removes the closed tab from `TabManager`. If the closed tab had `filePath === null`, invokes `gc_scratch_assets(remainingUnsavedContents)` to delete any unreferenced `snip-*.png` files from `scratchpad/.assets/`. If the last tab is closed, automatically opens a fresh `Untitled-1` scratch tab.
- **Window Blur Auto-Save (`window.blur`)**:
  - Writes all dirty disk-backed tabs (`filePath !== null`) via `write_markdown_file`, updates `session.json` via `save_session` (including unsaved buffer contents), and flashes the subtle `"Auto-saved on blur"` indicator in the titlebar without running `gc_scratch_assets` so active `Ctrl+Z` undo history stays valid.
