# SnipMD v0.1.0 — Windows 11 Release Packaging Guide

SnipMD is configured out-of-the-box to package into three native **Windows 11 (x64)** distribution formats using **Tauri v2** and **Rust (`x86_64-pc-windows-msvc`)**:

| Artifact | Output Filename | Best For |
| :--- | :--- | :--- |
| **NSIS Installer** | `SnipMD_0.1.0_x64-setup.exe` | Daily-driver Windows 11 setup (`currentUser` mode, registers `.md` & `.markdown` Explorer file associations, auto-bootstraps WebView2 if missing). |
| **WiX MSI Package** | `SnipMD_0.1.0_x64_en-US.msi` | Enterprise / Group Policy deployment on Windows 11 workstations. |
| **Portable Binary** | `SnipMD_0.1.0_x64_Portable.exe` (`snip-md.exe`) | Zero-install single binary (~3.5 MB with LTO + symbol stripping) using native Windows 11 WebView2. |

---

## Option A — 1-Click Local Build on Windows 11 (Recommended)

1. Download **`SnipMD-v0.1.0-Win11-x64-Release-Kit.zip`** from the **Win11 Release** modal inside the app (or clone this project).
2. Extract the archive on your Windows 11 PC.
3. Ensure prerequisites are installed (one-time setup in PowerShell):
   ```powershell
   winget install OpenJS.NodeJS.LTS
   winget install Rustlang.Rustup
   ```
   *(Make sure "Desktop development with C++" is enabled in Visual Studio Build Tools).*
4. Double-click **`build-win11-release.bat`** (or run `.\build-win11-release.ps1` in PowerShell).
5. The script automatically compiles the frontend + Rust crate with LTO optimizations, stages all 3 Windows 11 executables into **`./release-win11/`**, and opens Windows Explorer to the folder.

---

## Option B — Zero-Install Cloud Build via GitHub Actions

If you do not want to install the Rust/MSVC C++ toolchain locally on your PC:

1. Push this repository to GitHub.
2. Open the **Actions** tab → **"Release Windows 11 (x64 NSIS, MSI & Portable)"** → click **Run workflow** (or push tag `v0.1.0`).
3. GitHub's `windows-latest` runner compiles `SnipMD_0.1.0_x64-setup.exe`, `SnipMD_0.1.0_x64_en-US.msi`, and `snip-md.exe` and attaches them to your GitHub Release & workflow artifacts.

---

## Windows 11 Native Capabilities Included in the Release Build

- **Frameless Windows 11 Shell (`decorations: false`)**: Native window drag region (`data-tauri-drag-region`) + minimize/maximize/close controls.
- **Single-Instance File Association (`tauri-plugin-single-instance`)**: Double-clicking any `.md` or `.markdown` file in Windows 11 File Explorer opens it as a new tab inside your already-running SnipMD window (`external-open-files` event) rather than spawning duplicate processes.
- **Atomic `Win + Shift + S` → `Ctrl + V` Snipping**: Intercepts `image/png` clipboard payloads and writes them atomically (`OpenOptions::new().write(true).create_new(true)`) to `<note-dir>/.assets/snip-YYYYMMDD-HHMMSS-mmm-XXXX.png` or `%APPDATA%\snip-md\scratchpad\.assets\`.
- **Cross-Drive Safe Promotion**: Promoting a scratchpad tab from `C:\Users\<User>\AppData\Roaming\snip-md\scratchpad\.assets\` to a note saved on `D:\` or `E:\` automatically falls back to `fs::copy` + `fs::remove_file` across Windows drive volumes.
