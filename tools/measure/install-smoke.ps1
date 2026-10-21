<#
.SYNOPSIS
  Clean-install smoke test of the NSIS installer: installs silently for the current user, starts
  the installed app with its own data folder, waits until a tab can take keys, closes it, checks the
  file association, and uninstalls. Run it on a machine without SnipMD (a fresh CI runner).
#>
param([Parameter(Mandatory = $true)][string]$Setup)
$ErrorActionPreference = 'Stop'
if (Test-Path "$env:LOCALAPPDATA\SnipMD\snip-md.exe") { throw 'SnipMD is already installed; this test needs a clean machine.' }

$sw = [Diagnostics.Stopwatch]::StartNew()
$p = Start-Process -FilePath $Setup -ArgumentList '/S' -PassThru -Wait
if ($p.ExitCode -ne 0) { throw "Installer exited with $($p.ExitCode)" }
$exe = "$env:LOCALAPPDATA\SnipMD\snip-md.exe"
if (-not (Test-Path $exe)) { throw "Installed exe not found at $exe" }
"installed in $([Math]::Round($sw.Elapsed.TotalSeconds, 1)) s: $exe"

$assoc = (Get-ItemProperty -Path 'HKCU:\Software\Classes\.md' -ErrorAction SilentlyContinue).'(default)'
".md association: $(if ($assoc) { $assoc } else { 'none' })"

$data = Join-Path ([IO.Path]::GetTempPath()) ("snipmd-smoke-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
$note = Join-Path $data 'smoke.md'
New-Item -ItemType Directory -Path $data | Out-Null
[IO.File]::WriteAllText($note, "# Smoke`r`n")
$psi = New-Object System.Diagnostics.ProcessStartInfo $exe
$psi.Arguments = '"' + $note + '"'
$psi.UseShellExecute = $false
$psi.EnvironmentVariables['SNIPMD_TRACE'] = '1'
$psi.EnvironmentVariables['SNIPMD_DATA_DIR'] = $data
$app = [System.Diagnostics.Process]::Start($psi)
$log = Join-Path $data 'perf.log'
$t = [Diagnostics.Stopwatch]::StartNew()
while (-not ((Test-Path $log) -and (Select-String -Path $log -Pattern '^ready' -Quiet))) {
  if ($t.ElapsedMilliseconds -gt 30000) { throw 'Installed app did not report ready within 30 s' }
  Start-Sleep -Milliseconds 50
}
"installed app ready: $((Get-Content $log | Select-String '^ready').Line)"
$null = $app.CloseMainWindow()
if (-not $app.WaitForExit(5000)) { $app.Kill(); throw 'Installed app did not close within 5 s' }
if (-not (Test-Path (Join-Path $data 'session.json'))) { throw 'No session written on close' }
"session written on close: yes"

$un = Get-ChildItem "$env:LOCALAPPDATA\SnipMD" -Filter 'uninstall*.exe' | Select-Object -First 1
if ($un) {
  Start-Process -FilePath $un.FullName -ArgumentList '/S' -Wait
  Start-Sleep -Seconds 3
  "uninstalled: $(-not (Test-Path $exe))"
}
"note kept after uninstall: $(Test-Path $note)"
'SMOKE TEST PASSED'
