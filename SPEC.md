# SnipMD — System & Design Specification

## 1. Overview & Goals
SnipMD is an ultra-lightweight, frameless Windows 11 Markdown note-taking application built with **Tauri v2 (Rust)** and **Vanilla TypeScript + CodeMirror 6**. It replicates Sublime Text's instant cold-start, multi-tab ergonomics, and hot-exit session persistence while adding native `Win+Shift+S` clipboard screenshot pasting and always-on inline image rendering.

## 2. Core Functional Requirements

### 2.1 Snipping Tool (`Win+Shift+S` -> `Ctrl+V`) Pipeline
- **Clipboard Interception**: When `paste` occurs inside CodeMirror 6, inspect `event.clipboardData.items`. If an `image/png` (or `image/*`) item exists, intercept default paste behavior, extract the raw bytes as `Uint8Array`, and call the Rust IPC command `save_clipboard_image`.
- **Collision-Free Naming**:
  - Format: `snip-YYYYMMDD-HHMMSS-mmm-XXXX.png` (UTC or local time to milliseconds + 4-character lowercase hex random suffix, e.g., `snip-20261016-223804-419-7f2a.png`).
  - File creation MUST use `std::fs::OpenOptions::new().write(true).create_new(true)` inside a retry loop so existing files are never silently overwritten.
- **Storage Routing**:
  - **Disk-Backed Tab** (`filePath != null`, e.g., `D:\work\notes.md`): Write image to `<parent_dir>/.assets/snip-YYYYMMDD-HHMMSS-mmm-XXXX.png`. Insert `![snip](.assets/snip-YYYYMMDD-HHMMSS-mmm-XXXX.png)` at the current cursor selection.
  - **Unsaved Scratchpad Tab** (`filePath == null`): Write image to `%APPDATA%/snip-md/scratchpad/.assets/snip-YYYYMMDD-HHMMSS-mmm-XXXX.png`. Insert `![snip](.assets/snip-YYYYMMDD-HHMMSS-mmm-XXXX.png)`.

### 2.2 Scratchpad Promotion & Orphan Garbage Collection
- **Scratch Promotion (`promote_scratch_assets`)**:
  - When an unsaved tab (`filePath == null`) is saved to disk via `Ctrl+S`, scan its Markdown content for `.assets/(snip-[A-Za-z0-9_-]+\.png)`.
  - Move every referenced file from `%APPDATA%/snip-md/scratchpad/.assets/` to `<target_md_parent_dir>/.assets/`.
  - Immediately run `gc_scratch_assets` passing the content of all *remaining* open unsaved tabs so any screenshot pasted and subsequently deleted during the scratch session is purged from `%APPDATA%`.
- **Mark-and-Sweep GC (`gc_scratch_assets`)**:
  - Accepts `live_unsaved_contents: Vec<String>` (the raw text of all currently open unsaved tabs).
  - Extracts the union of all referenced `snip-*.png` filenames across those buffers.
  - Iterates over `%APPDATA%/snip-md/scratchpad/.assets/` and deletes any `snip-*.png` file not present in the live reference set.
  - **Execution Triggers**:
    1. Automatically inside `promote_scratch_assets` (`Ctrl+S` on an unsaved tab).
    2. Whenever an unsaved tab is closed (`Ctrl+W` or middle-click).
    3. Automatically inside `load_session` on application startup (preserving `Ctrl+Z` undo history during active editing while preventing orphan accumulation across sessions).

### 2.3 Always-On Inline Image Rendering & Sizing
- **Edit Mode (CodeMirror 6)**:
  - A CM6 `StateField` parses lines matching `![alt](path)` and injects a block `WidgetType` (`Decoration.widget({ widget, block: true, side: 1 })`) directly below the line.
  - Relative `.assets/...` paths are resolved against the active tab's parent folder (or `%APPDATA%/snip-md/scratchpad` if unsaved) and converted to `asset://` URLs via `@tauri-apps/api/core`'s `convertFileSrc()`.
- **Rendered Mode (`Ctrl+E`)**:
  - Converts the buffer via `marked` into clean HTML typography with resolved `convertFileSrc()` image URLs.
- **Image Sizing Contract**:
  - Both Edit Mode widgets and Rendered Mode images enforce `max-height: 360px; max-width: 100%; width: auto; border-radius: 6px; cursor: zoom-in;`.
  - Clicking an image toggles the `.expanded` CSS class (`max-height: none; cursor: zoom-out;`).

### 2.4 Frameless Shell, Tabs & Auto-Save Lifecycle
- **Frameless Window**: `decorations: false` in `tauri.conf.json`. Single 34px top bar containing:
  - Horizontal scrollable tab strip (`filename.md` or `Untitled-N`, purple dirty dot indicator, middle-click or `Ctrl+W` to close).
  - `+` new tab button (`Ctrl+T`).
  - Drag region (`data-tauri-drag-region`).
  - Mode toggle pill (`RAW` / `MD`, bound to `Ctrl+E`).
  - Window controls (`─`, `□`, `✕`).
- **Auto-Save on Focus Loss & Hot-Exit**:
  - On `window.addEventListener('blur')`:
    1. All dirty disk-backed tabs (`filePath != null`) write silently to their `filePath` via `write_markdown_file`.
    2. All open tabs (including unsaved buffers, active tab ID, cursor offset, and scroll top) serialize to `%APPDATA%/snip-md/session.json` via `save_session`.
