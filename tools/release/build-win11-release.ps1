<#
.SYNOPSIS
  Builds the SnipMD Windows release locally: typecheck, tests, NSIS and MSI installers, and the bare
  exe, copied to release-win11\ at the repo root. Same steps as .github/workflows/release-win11.yml.
#>
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $root

# Runs a native command and stops the script when it exits with a non-zero code.
function Invoke-Native {
  param([string]$Name, [scriptblock]$Command)
  Write-Host "> $Name"
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "'$Name' failed with exit code $LASTEXITCODE" }
}

foreach ($cmd in 'node', 'npm', 'cargo') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "'$cmd' is not on PATH (see docs/releasing.md)" }
}
$version = (Get-Content package.json | ConvertFrom-Json).version

Invoke-Native 'npm ci' { npm ci }
Invoke-Native 'npm run lint' { npm run lint }
Invoke-Native 'npm test' { npm test }
Invoke-Native 'npx tauri build' { npx tauri build --bundles nsis,msi }

$out = Join-Path $root 'release-win11'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$target = Join-Path $root 'src-tauri\target\release'
Copy-Item (Join-Path $target 'snip-md.exe') (Join-Path $out "SnipMD_${version}_x64_portable.exe")
Copy-Item (Join-Path $target 'bundle\nsis\*.exe') $out
Copy-Item (Join-Path $target 'bundle\msi\*.msi') $out
Get-ChildItem $out | ForEach-Object { '{0,-44} {1,8:N2} MB' -f $_.Name, ($_.Length / 1MB) }
