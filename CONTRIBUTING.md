# Contributing to SnipMD

Thank you for your interest in contributing to **SnipMD**! This document outlines the development setup, architectural invariants, and pull request workflow.

---

## 1. Development Environment Setup

### Prerequisites
- **Node.js** `>= 20.19.0` (Node 22 LTS recommended)
- **Rust Stable** (`rustup` with `x86_64-pc-windows-msvc` on Windows, or platform default for `cargo check`)

### Local Workflow
1. Clone the repository and install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
2. Start the live browser preview (uses the Virtual FS parity bridge in `src/ipc/bridge.ts`):
   ```bash
   npm run dev
   ```
3. Or start the native Tauri v2 desktop window:
   ```bash
   npm run tauri:dev
   ```

---

## 2. Core Architectural Guardrails

Before submitting changes to the editor or Rust backend, ensure your code upholds these invariants (see [`SPEC.md`](./SPEC.md) and [`ARCHITECTURE.md`](./ARCHITECTURE.md)):

1. **CodeMirror 6 Block Widgets Must Use `StateField`**:
   - Inline screenshot previews (`Decoration.widget({ block: true, side: 1 })`) in `src/editor/imageWidget.ts` **must** be provided via a `StateField<DecorationSet>`, never a `ViewPlugin`. CodeMirror 6 throws a runtime exception if block decorations are provided from a `ViewPlugin`.
2. **Synchronous Asset URL Cache**:
   - `StateField.update` is strictly synchronous. All asynchronous IPC path resolutions (`resolve_asset_abs_path` + `convertFileSrc`) must populate `assetUrlCache` first and then dispatch `assetResolvedEffect` to trigger a decoration rebuild.
3. **Atomic Collision-Free Snip Creation**:
   - `save_clipboard_image` in `src-tauri/src/lib.rs` must use `OpenOptions::new().write(true).create_new(true)` with `snip-YYYYMMDD-HHMMSS-mmm-XXXX.png` naming so rapid pastes never overwrite existing images.
4. **Cross-Volume Scratchpad Promotion**:
   - `promote_scratch_assets` must fall back from `fs::rename` to `fs::copy` + `fs::remove_file` when moving screenshots from `%APPDATA%/snip-md/scratchpad/.assets/` (`C:\`) to notes saved on secondary drives (`D:\`, `E:\`).
5. **Safe Garbage Collection Boundaries**:
   - `gc_scratch_assets` runs **only** on `load_session`, `promote_scratch_assets` (`Ctrl + S`), and `closeTab` (`Ctrl + W`)—never on `window.blur` or keystroke timers, preserving `Ctrl + Z` undo history for recently deleted snip links in open scratch tabs.
6. **Theme Variable Purity**:
   - All UI surfaces must consume semantic CSS custom properties (`var(--bg-main)`, `var(--bg-bar)`, `var(--text-main)`, `var(--accent)`, etc.) defined in `src/styles/themes.ts` so all 8 themes render with full fidelity.

---

## 3. Pre-PR Verification Checklist

Before opening a Pull Request, verify that all checks pass:

```bash
# 1. TypeScript strict type-checking
npm run lint

# 2. Production Vite bundle compilation
npm run build

# 3. Rust crate compilation check (if modifying src-tauri/)
cd src-tauri && cargo check
```
