# Changelog

All notable changes to **SnipMD** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-10-17

### Added
- **Tauri v2 (Rust) Backend (`src-tauri/`)**:
  - Implemented `save_clipboard_image` with atomic `OpenOptions::new().write(true).create_new(true)` and `snip-YYYYMMDD-HHMMSS-mmm-XXXX.png` naming.
  - Implemented `promote_scratch_assets` with cross-drive (`EXDEV` / `ERROR_NOT_SAME_DEVICE`) `fs::copy` + `fs::remove_file` fallback.
  - Implemented `gc_scratch_assets` mark-and-sweep garbage collector for orphaned scratchpad screenshots.
  - Added `tauri-plugin-single-instance` routing for `.md` and `.markdown` files opened from Windows 11 File Explorer or CLI arguments.
- **CodeMirror 6 Editor & Inline Image Widgets (`src/editor/`)**:
  - Built multi-line safe `StateField<DecorationSet>` block widget rendering `.assets/snip-*.png` images directly below `![...]()` lines.
  - Enforced `360px` default height cap with one-click toggle to `100%` natural resolution, full-screen Lightbox Zoom modal, and Markdown link copy button.
  - Added `Ctrl + V` `image/png` clipboard interception and one-click **+ Simulate Snip** high-DPI diagram generator for browser testing.
- **Workspace Shell, Modes & Persistence (`src/state/`, `src/ui/`)**:
  - Built frameless `34px` Windows 11 titlebar with Sublime-style dirty tab indicators, middle-click tab close, and keyboard shortcuts (`Ctrl+T`, `Ctrl+O`, `Ctrl+S`, `Ctrl+W`, `Ctrl+E`, `Ctrl+\`, `Ctrl+Tab`).
  - Added three workspace view modes: **RAW + IMG**, **SPLIT** (side-by-side live editor + rendered preview), and **RENDERED** (`marked`).
  - Implemented real-time `localStorage` persistence (120ms debounce + synchronous `beforeunload` / `visibilitychange` flush) and Tauri `session.json` hot-exit storage.
  - Added collapsible right-hand **Virtual `.assets/` Browser, Document Outline, Export (.md / self-contained .html) & Theme Studio** drawer.
- **8 Full-Spectrum Themes (`src/styles/themes.ts`)**:
  - Added *01. Alabaster Daylight*, *02. Warm Parchment*, *03. Botanical Mist*, *04. Nordic Polar Dusk*, *05. Tokyo Twilight*, *06. Linear Spatial*, *07. Obsidian Stealth*, and *08. Carbon OLED Terminal*.
- **Windows 11 Release Packaging**:
  - Configured NSIS (`-setup.exe`), WiX (`.msi`), and LTO portable binary targets along with automated local PowerShell (`build-win11-release.ps1`) and GitHub Actions (`.github/workflows/release-win11.yml`) pipelines.
