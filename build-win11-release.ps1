<#
.SYNOPSIS
  Builds the SnipMD Windows release locally: typecheck, tests, NSIS and MSI installers, and the bare
  exe, copied to .\release-win11\. Same steps as .github/workflows/release-win11.yml.
#>
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

foreach ($cmd in 'node', 'npm', 'cargo') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "'$cmd' is not on PATH (see RELEASE-WIN11.md)" }
}
$version = (Get-Content package.json | ConvertFrom-Json).version

npm ci
npm run lint
npm test
npx tauri build --bundles nsis,msi
if ($LASTEXITCODE -ne 0) { throw 'tauri build failed' }

$out = Join-Path $PSScriptRoot 'release-win11'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$target = Join-Path $PSScriptRoot 'src-tauri\target\release'
Copy-Item (Join-Path $target 'snip-md.exe') (Join-Path $out "SnipMD_${version}_x64_portable.exe")
Copy-Item (Join-Path $target 'bundle\nsis\*.exe') $out
Copy-Item (Join-Path $target 'bundle\msi\*.msi') $out
Get-ChildItem $out | ForEach-Object { '{0,-44} {1,8:N2} MB' -f $_.Name, ($_.Length / 1MB) }
