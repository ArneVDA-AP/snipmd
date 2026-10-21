param([int]$Rounds = 6, [string]$SnipExe = '')
# Broker follow-ups: memory per process type, an about:blank broker, the "same folder and options"
# condition, and the real SnipMD next to a broker in SnipMD's own WebView2 folder.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $here 'target\release\snipmd-probe.exe'
$work = Join-Path $here 'runs'
New-Item -ItemType Directory -Force $work | Out-Null
$epoch = [DateTime]::new(1970, 1, 1, 0, 0, 0, [DateTimeKind]::Utc)
function NowMs { ([DateTime]::UtcNow - $epoch).TotalMilliseconds }
$base = @{ PROBE_FRAMELESS = '1'; PROBE_TRANSPARENT = '1' }
$lean = '--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,Translate --disable-extensions'
$otherUdf = Join-Path $work 'other-udf'

function WvProcs([string]$pattern) { @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -match $pattern }) }

function Launch([hashtable]$envs, [string]$log) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo $exe
  $psi.UseShellExecute = $false
  $psi.EnvironmentVariables['PROBE_LOG'] = $log
  foreach ($k in $base.Keys) { $psi.EnvironmentVariables[$k] = $base[$k] }
  foreach ($k in $envs.Keys) { $psi.EnvironmentVariables[$k] = $envs[$k] }
  [System.Diagnostics.Process]::Start($psi)
}

function Start-Broker([hashtable]$envs, [string]$pattern) {
  $blog = Join-Path $work ('broker-' + [Guid]::NewGuid().ToString('N').Substring(0, 6) + '.txt')
  $e = @{ PROBE_HOLD = '1' }; foreach ($k in $envs.Keys) { $e[$k] = $envs[$k] }
  $b = Launch $e $blog
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while (-not ((Test-Path $blog) -and (Select-String -Path $blog -Pattern '^build-end' -Quiet)) -and $sw.ElapsedMilliseconds -lt 15000) { Start-Sleep -Milliseconds 50 }
  Start-Sleep -Seconds 4
  $b
}

function Breakdown($host_, [string]$pattern) {
  $rows = foreach ($p in (WvProcs $pattern)) {
    $type = if ($p.CommandLine -match '--type=([a-z-]+)') { $Matches[1] } else { 'browser' }
    if ($type -eq 'utility' -and $p.CommandLine -match '--utility-sub-type=([\w\.]+)') { $type = 'utility:' + ($Matches[1] -split '\.')[-1] }
    $q = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Filter "IDProcess=$($p.ProcessId)" -ErrorAction SilentlyContinue
    [pscustomobject]@{ type = $type; mb = if ($q) { [math]::Round($q.WorkingSetPrivate / 1MB, 1) } else { 0 } }
  }
  $q = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Filter "IDProcess=$($host_.Id)"
  $rows += [pscustomobject]@{ type = 'host (snipmd-probe.exe)'; mb = [math]::Round($q.WorkingSetPrivate / 1MB, 1) }
  $rows
}

function Start-Once([hashtable]$envs, [string]$pattern, [bool]$broker) {
  $log = Join-Path $work ('log-' + [Guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt')
  $t0 = NowMs
  $p = Launch $envs $log
  if (-not $p.WaitForExit(20000)) { $p.Kill() }
  $row = @{}
  if (Test-Path $log) { foreach ($line in Get-Content $log) { $f = $line -split "`t"; $row[$f[0]] = [math]::Round([double]$f[1] - $t0, 1) }; Remove-Item $log }
  if (-not $broker) { $sw = [Diagnostics.Stopwatch]::StartNew(); while ((WvProcs $pattern).Count -gt 0 -and $sw.ElapsedMilliseconds -lt 5000) { Start-Sleep -Milliseconds 100 } }
  Start-Sleep -Milliseconds 500
  $row
}
function Median($xs) { $s = @($xs | Where-Object { $_ -ne $null } | Sort-Object); if ($s.Count -eq 0) { return $null }; $m = [int][math]::Floor($s.Count / 2); if ($s.Count % 2) { $s[$m] } else { [math]::Round(($s[$m - 1] + $s[$m]) / 2, 1) } }
function Series([string]$label, [hashtable]$envs, [string]$pattern, [bool]$broker) {
  [void](Start-Once $envs $pattern $broker)
  $rs = @(); for ($i = 1; $i -le $Rounds; $i++) { $rs += Start-Once $envs $pattern $broker }
  [pscustomobject]@{ series = $label; n = $rs.Count; 'webview built' = Median ($rs | % { $_['build-end'] }); 'bundle run' = Median ($rs | % { $_['snip-script'] }); painted = Median ($rs | % { $_['paint'] }) }
}

$probePat = 'com\.snipmd\.probe\\EBWebView'
$bundle = @{ PROBE_PAGE = 'bundle.html' }
$results = @()

# 1. Memory per process type, broker with the empty page vs about:blank; speed with each.
foreach ($bp in 'index.html', 'about:blank') {
  $b = Start-Broker @{ PROBE_PAGE = $bp } $probePat
  "== broker page: $bp"
  $bd = Breakdown $b $probePat
  $bd | Sort-Object type | Format-Table -AutoSize | Out-String
  "total MB: " + [math]::Round(($bd | Measure-Object mb -Sum).Sum, 1)
  $results += Series "broker $bp, start with bundle" $bundle $probePat $true
  $b.Kill(); Start-Sleep -Seconds 2
}

# 2. The condition: broker with default options; starts with other args, or another folder.
$b = Start-Broker @{} $probePat
$results += Series 'broker default, start same options' $bundle $probePat $true
$e = @{ PROBE_ARGS = $lean }; foreach ($k in $bundle.Keys) { $e[$k] = $bundle[$k] }
$results += Series 'broker default, start with other browser args' $e $probePat $true
$e = @{ PROBE_UDF = $otherUdf }; foreach ($k in $bundle.Keys) { $e[$k] = $bundle[$k] }
$results += Series 'broker default, start with other data folder' $e $probePat $true
$b.Kill(); Start-Sleep -Seconds 2
$results | Format-Table -AutoSize | Out-String -Width 200

# 3. The real SnipMD next to a broker in SnipMD's own WebView2 folder.
if ($SnipExe) {
  $snipPat = 'com\.snipmd\.desktop\\EBWebView'
  $repo = Split-Path (Split-Path (Split-Path (Split-Path $SnipExe)))
  "== real SnipMD, no broker"
  & powershell -ExecutionPolicy Bypass -File (Join-Path $repo 'tools\measure\measure.ps1') -Exe $SnipExe 2>&1 | Select-String 'Last start|Double-click'
  $b = Start-Broker @{ PROBE_UDF = (Join-Path $env:LOCALAPPDATA 'com.snipmd.desktop'); PROBE_PAGE = 'about:blank' } $snipPat
  "broker WebView2 processes in SnipMD's folder: " + (WvProcs $snipPat).Count
  foreach ($i in 1, 2) {
    "== real SnipMD with broker, run $i"
    & powershell -ExecutionPolicy Bypass -File (Join-Path $repo 'tools\measure\measure.ps1') -Exe $SnipExe 2>&1 | Select-String 'Last start|Double-click|Data and'
  }
  "broker still alive: " + (-not $b.HasExited) + ", WebView2 processes: " + (WvProcs $snipPat).Count
  $b.Kill()
}
