param([int]$Rounds = 8, [string]$Only = '')
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $here 'target\release\snipmd-probe.exe'
$work = Join-Path $here 'runs'
New-Item -ItemType Directory -Force $work | Out-Null
$epoch = [DateTime]::new(1970, 1, 1, 0, 0, 0, [DateTimeKind]::Utc)
function NowMs { ([DateTime]::UtcNow - $epoch).TotalMilliseconds }

$tauriDefault = '--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection'
$lean = '--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,Translate,OptimizationHints,MediaRouter,AutofillServerCommunication --disable-background-networking --disable-component-update --disable-extensions --disable-sync --no-first-run --disable-default-apps'

$variants = [ordered]@{
  'A plain window, empty page'             = @{ }
  'B SnipMD window (frameless+transparent)' = @{ PROBE_FRAMELESS = '1'; PROBE_TRANSPARENT = '1' }
  'C B + lean browser args'                = @{ PROBE_FRAMELESS = '1'; PROBE_TRANSPARENT = '1'; PROBE_ARGS = $lean }
  'D B + --disable-gpu (diagnostic)'       = @{ PROBE_FRAMELESS = '1'; PROBE_TRANSPARENT = '1'; PROBE_ARGS = "$tauriDefault --disable-gpu" }
  'E B + SnipMD bundle'                    = @{ PROBE_FRAMELESS = '1'; PROBE_TRANSPARENT = '1'; PROBE_PAGE = 'bundle.html' }
}
if ($Only) { $keep = $variants.Keys | Where-Object { $_ -like "$Only*" }; $v2 = [ordered]@{}; foreach ($k in $keep) { $v2[$k] = $variants[$k] }; $variants = $v2 }

function Run-Once([string]$name, [hashtable]$envs) {
  $log = Join-Path $work ('log-' + [Guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt')
  $psi = New-Object System.Diagnostics.ProcessStartInfo $exe
  $psi.UseShellExecute = $false
  $psi.EnvironmentVariables['PROBE_LOG'] = $log
  foreach ($k in $envs.Keys) { $psi.EnvironmentVariables[$k] = $envs[$k] }
  $t0 = NowMs
  $p = [System.Diagnostics.Process]::Start($psi)
  if (-not $p.WaitForExit(20000)) { $p.Kill(); Write-Host "timeout in $name" }
  $row = [ordered]@{ variant = $name }
  if (Test-Path $log) {
    foreach ($line in Get-Content $log) {
      $f = $line -split "`t"
      $row[$f[0]] = [math]::Round([double]$f[1] - $t0, 1)
    }
    Remove-Item $log
  }
  # Let the WebView2 browser processes of this run exit before the next start.
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ((Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -match 'com\.snipmd\.probe' }) -and $sw.ElapsedMilliseconds -lt 5000) { Start-Sleep -Milliseconds 100 }
  Start-Sleep -Milliseconds 400
  [pscustomobject]$row
}

$rows = @()
# One warm-up start per variant, not counted.
foreach ($k in $variants.Keys) { [void](Run-Once $k $variants[$k]) }
for ($r = 1; $r -le $Rounds; $r++) {
  foreach ($k in $variants.Keys) { $rows += Run-Once $k $variants[$k] }
}
$rows | Export-Csv (Join-Path $work 'starts.csv') -NoTypeInformation

function Median($xs) { $s = @($xs | Where-Object { $_ -ne $null } | Sort-Object); if ($s.Count -eq 0) { return $null }; $m = [int][math]::Floor($s.Count / 2); if ($s.Count % 2) { $s[$m] } else { [math]::Round(($s[$m - 1] + $s[$m]) / 2, 1) } }
$cols = 'main', 'setup', 'build-start', 'build-end', 'head', 'snip-script', 'afterbundle', 'paint'
$summary = foreach ($k in $variants.Keys) {
  $g = $rows | Where-Object variant -eq $k
  $o = [ordered]@{ variant = $k; n = @($g).Count }
  foreach ($c in $cols) { $o[$c] = Median ($g | ForEach-Object { $_.$c }) }
  [pscustomobject]$o
}
$summary | Format-Table -AutoSize | Out-String -Width 250
