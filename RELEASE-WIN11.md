# Releasing SnipMD for Windows

SnipMD ships as a per-user NSIS installer (`SnipMD_<version>_x64-setup.exe`), an MSI for managed installs, and a portable `SnipMD_<version>_x64_portable.exe`. All three run on Windows 10 and 11 (x64) with WebView2; the installer fetches WebView2 when it is missing. Target size: under 10 MB (SPEC §9).

## From a tag (the normal way)
1. Set the version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, and add a `## [<version>] - <date>` section to `CHANGELOG.md`.
2. Merge to `main` with CI green.
3. Push a tag `v<version>` on that commit. The workflow *Release Windows* (`.github/workflows/release-win11.yml`) has two jobs. `build` (read-only token) checks the tag against `package.json`, runs the typecheck and tests, builds on `windows-latest`, checks the installer size and uploads the three files as an artifact. `publish` (the only job with write access) downloads that artifact and publishes a GitHub release.

A manual run of the same workflow (Actions → Run workflow) runs `build` only: the files are workflow artifacts and nothing is published.

## Locally
Requires Node.js 22, Rust stable with the MSVC toolchain, and the Visual Studio C++ build tools.

```powershell
.\build-win11-release.ps1
```
It runs `npm ci`, the typecheck, the tests and the release build, and copies the files to `release-win11\`. It stops at the first command that fails.

The files are not code-signed: SmartScreen warns on the first run of the setup until a signing certificate is added to the build job (README says how to get past it).

## Smoke test of an installer
On a machine without SnipMD (or after uninstalling it and removing `%APPDATA%\com.snipmd.desktop`):
1. Run the setup. It installs without admin rights; the Start menu has SnipMD.
2. Start SnipMD: one empty tab with the core-loop hint, in the Windows theme.
3. `Win+Shift+S`, `Ctrl+V`: the screenshot shows below the cursor; type on.
4. `Ctrl+S`, Enter: `Documents\Notes\<name>.md` and `<name>.assets\` exist side by side.
5. Double-click a `.md` file in Explorer: it opens as a tab in the running window.
6. Close and start again: the tabs are back.
7. Uninstall from Settings → Apps: notes and images in `Documents\Notes` stay.

## Measuring the budgets
`tools\measure\measure.ps1 -Exe <path to snip-md.exe>` measures start to typing, paste of a 4K screenshot, memory with 5 tabs and 20 images, and the installer size, in its own data folder. Record the values in `ROADMAP.md`.
