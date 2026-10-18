<#
.SYNOPSIS
  SnipMD v0.1.0 — Automated Windows 11 Release Packager (NSIS + WiX MSI + Portable .exe)
.DESCRIPTION
  Verifies Node.js & Rust MSVC toolchain, compiles the Vite + CodeMirror 6 frontend bundle,
  invokes Tauri v2 release bundler for Windows 11 x64, and collects all release artifacts
  into ./release-win11/.
#>

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SnipMD v0.1.0 — Windows 11 Release Packager (Tauri v2)    " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

function Assert-Command($cmd, $installHint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] '$cmd' is not installed or not in PATH." -ForegroundColor Red
    Write-Host "        Install hint: $installHint" -ForegroundColor Yellow
    exit 1
  }
}

Assert-Command "node" "winget install OpenJS.NodeJS.LTS"
Assert-Command "npm"  "winget install OpenJS.NodeJS.LTS"
Assert-Command "cargo" "winget install Rustlang.Rustup (with MSVC C++ Build Tools)"

Write-Host "`n[1/4] Cleaning cross-OS lockfiles & installing Windows native dependencies..." -ForegroundColor Green
if (Test-Path (Join-Path $PSScriptRoot "package-lock.json")) {
  Remove-Item -Force (Join-Path $PSScriptRoot "package-lock.json")
}
npm install --include=optional --legacy-peer-deps
npm install --no-save --legacy-peer-deps @rolldown/binding-win32-x64-msvc @tauri-apps/cli@^2.5.0

Write-Host "`n[2/4] Type-checking & building production frontend (dist/)..." -ForegroundColor Green
npm run lint
npm run build

Write-Host "`n[3/4] Compiling Tauri v2 Rust crate (LTO + Strip) & bundling Windows 11 installers..." -ForegroundColor Green
npx --yes @tauri-apps/cli@2 build --bundles nsis,msi

$OutDir = Join-Path $PSScriptRoot "release-win11"
if (Test-Path $OutDir) {
  Remove-Item -Recurse -Force $OutDir
}
New-Item -ItemType Directory -Path $OutDir | Out-Null

$ReleaseTarget = Join-Path $PSScriptRoot "src-tauri\target\release"
$PortableExe   = Join-Path $ReleaseTarget "snip-md.exe"
$NsisDir       = Join-Path $ReleaseTarget "bundle\nsis"
$MsiDir        = Join-Path $ReleaseTarget "bundle\msi"

Write-Host "`n[4/4] Staging Windows 11 artifacts into ./release-win11/..." -ForegroundColor Green

if (Test-Path $PortableExe) {
  Copy-Item $PortableExe (Join-Path $OutDir "SnipMD_0.1.0_x64_Portable.exe")
  Write-Host "  -> Staged Portable Binary: SnipMD_0.1.0_x64_Portable.exe" -ForegroundColor Cyan
}

if (Test-Path $NsisDir) {
  Get-ChildItem -Path $NsisDir -Filter "*.exe" | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $OutDir $_.Name)
    Write-Host "  -> Staged NSIS Setup:      $($_.Name)" -ForegroundColor Cyan
  }
}

if (Test-Path $MsiDir) {
  Get-ChildItem -Path $MsiDir -Filter "*.msi" | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $OutDir $_.Name)
    Write-Host "  -> Staged WiX MSI:         $($_.Name)" -ForegroundColor Cyan
  }
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  Windows 11 Release Build Complete!                        " -ForegroundColor Green
Write-Host "  Artifacts folder: $OutDir" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green

Invoke-Item $OutDir
