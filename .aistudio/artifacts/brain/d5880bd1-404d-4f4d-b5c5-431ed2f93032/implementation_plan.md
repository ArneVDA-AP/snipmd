# Fix Windows 11 Release Build (`@rolldown/binding-win32-x64-msvc` & Tauri Identifier)

## Root Cause Analysis
1. **Cross-OS Lockfile Optional Dependency Bug (`npm` Issue #4828)**:
   - Vite 8 uses Rolldown under the hood, which requires platform-specific native bindings (`@rolldown/binding-win32-x64-msvc` on Windows).
   - Generating `package-lock.json` on Linux caused `npm install` on `windows-latest` to skip the Windows native optional dependency (`@rolldown/binding-win32-x64-msvc`), and running a second `npm install --no-save @tauri-apps/cli@^2.0.0` further pruned optional native packages.
2. **Tauri Bundle Identifier Warning**:
   - `"identifier": "com.snipmd.app"` in `src-tauri/tauri.conf.json` triggers a Tauri CLI warning because `.app` conflicts with bundle extensions.

---

## Planned Changes

### 1. `package.json` & Lockfile Cleanup
- Remove the Linux-generated `package-lock.json` from the repository and release archive so Windows never inherits Linux-only optional dependency trees.
- Add `"@tauri-apps/cli": "^2.5.0"` directly into `devDependencies` in `package.json` so only a **single** `npm install` pass runs.

### 2. `.github/workflows/release-win11.yml` & `build-win11-release.ps1`
- Remove `if (Test-Path package-lock.json) { Remove-Item package-lock.json }` prior to installing on Windows.
- Run a single install command that explicitly ensures Windows native bindings are present:
  ```powershell
  if (Test-Path package-lock.json) { Remove-Item -Force package-lock.json }
  npm install --include=optional --legacy-peer-deps
  npm install --no-save --legacy-peer-deps @rolldown/binding-win32-x64-msvc
  ```

### 3. `src-tauri/tauri.conf.json`
- Update `"identifier"` from `"com.snipmd.app"` to `"com.snipmd.desktop"` to eliminate the Tauri bundle identifier warning.

### 4. Rebuild `SnipMD-v0.1.0-Win11-x64-Release-Kit.zip` & In-App Modal
- Update the "Copy Fixed GitHub Workflow YAML" button in the **Win11 Release** modal and regenerate `public/releases/SnipMD-v0.1.0-Win11-x64-Release-Kit.zip` without `package-lock.json`.
