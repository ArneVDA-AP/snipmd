param([int]$Rounds = 8)
# Idea 4: does a hidden broker that keeps the WebView2 browser process alive (same user data folder,
# same options) make a separate, cold SnipMD-like start faster?
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $here 'target\release\snipmd-probe.exe'
$work = Join-Path $here 'runs'
New-Item -ItemType Directory -Force $work | Out-Null
$epoch = [DateTime]::new(1970, 1, 1, 0, 0, 0, [DateTimeKind]::Utc)
function NowMs { ([DateTime]::UtcNow - $epoch).TotalMilliseconds }
$base = @{ PROBE_FRAMELESS = '1'; PROBE_TRANSPARENT = '1' }
$variants = [ordered]@{ 'empty page' = @{}; 'SnipMD bundle' = @{ PROBE_PAGE = 'bundle.html' } }

function WebviewPids { @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -match 'com\.snipmd\.probe' } | ForEach-Object ProcessId) }

function Launch([hashtable]$envs, [string]$log) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo $exe
  $psi.UseShellExecute = $false
  $psi.EnvironmentVariables['PROBE_LOG'] = $log
  foreach ($k in $base.Keys) { $psi.EnvironmentVariables[$k] = $base[$k] }
  foreach ($k in $envs.Keys) { $psi.EnvironmentVariables[$k] = $envs[$k] }
  [System.Diagnostics.Process]::Start($psi)
}

function Run-Once([string]$phase, [string]$name, [hashtable]$envs, [bool]$broker) {
  $log = Join-Path $work ('log-' + [Guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt')
  $t0 = NowMs
  $p = Launch $envs $log
  if (-not $p.WaitForExit(20000)) { $p.Kill(); Write-Host "timeout $phase $name" }
  $row = [ordered]@{ phase = $phase; variant = $name }
  if (Test-Path $log) {
    foreach ($line in Get-Content $log) { $f = $line -split "`t"; $row[$f[0]] = [math]::Round([double]$f[1] - $t0, 1) }
    Remove-Item $log
  }
  if (-not $broker) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ((WebviewPids).Count -gt 0 -and $sw.ElapsedMilliseconds -lt 5000) { Start-Sleep -Milliseconds 100 }
  }
  Start-Sleep -Milliseconds 500
  [pscustomobject]$row
}

function Phase([string]$phase, [bool]$broker) {
  $out = @()
  foreach ($k in $variants.Keys) { [void](Run-Once $phase $k $variants[$k] $broker) }  # warm-up, not counted
  for ($r = 1; $r -le $Rounds; $r++) { foreach ($k in $variants.Keys) { $out += Run-Once $phase $k $variants[$k] $broker } }
  $out
}

$rows = @()
$rows += Phase '1 no broker' $false

$blog = Join-Path $work 'broker.txt'; if (Test-Path $blog) { Remove-Item $blog }
$broker = Launch @{ PROBE_HOLD = '1' } $blog
$sw = [Diagnostics.Stopwatch]::StartNew()
while (-not ((Test-Path $blog) -and (Select-String -Path $blog -Pattern '^head' -Quiet)) -and $sw.ElapsedMilliseconds -lt 15000) { Start-Sleep -Milliseconds 50 }
Start-Sleep -Seconds 3
$bp = WebviewPids
$bws = 0; foreach ($id in @($broker.Id) + $bp) { $q = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Filter "IDProcess=$id" -ErrorAction SilentlyContinue; if ($q) { $bws += $q.WorkingSetPrivate } }
$brokerInfo = "broker idle: $(@($bp).Count) WebView2 processes, private working set incl. host $([math]::Round($bws / 1MB, 1)) MB"
$rows += Phase '2 with broker' $true
$browserShared = @(Compare-Object $bp (WebviewPids) -IncludeEqual -ExcludeDifferent).Count
$broker.Kill()
Start-Sleep -Seconds 2

$rows += Phase '3 no broker again' $false
$rows | Export-Csv (Join-Path $work 'shared.csv') -NoTypeInformation

function Median($xs) { $s = @($xs | Where-Object { $_ -ne $null } | Sort-Object); if ($s.Count -eq 0) { return $null }; $m = [int][math]::Floor($s.Count / 2); if ($s.Count % 2) { $s[$m] } else { [math]::Round(($s[$m - 1] + $s[$m]) / 2, 1) } }
$cols = 'setup', 'build-end', 'head', 'snip-script', 'paint'
$summary = foreach ($ph in ($rows.phase | Select-Object -Unique)) { foreach ($k in $variants.Keys) {
  $g = $rows | Where-Object { $_.phase -eq $ph -and $_.variant -eq $k }
  $o = [ordered]@{ phase = $ph; variant = $k; n = @($g).Count }
  foreach ($c in $cols) { $o[$c] = Median ($g | ForEach-Object { $_.$c }) }
  $o['paint min'] = ($g | ForEach-Object { $_.paint } | Measure-Object -Minimum).Minimum
  $o['paint max'] = ($g | ForEach-Object { $_.paint } | Measure-Object -Maximum).Maximum
  [pscustomobject]$o
} }
$summary | Format-Table -AutoSize | Out-String -Width 250
$brokerInfo
"broker WebView2 processes still alive at the end of phase 2: $browserShared of $(@($bp).Count)"
