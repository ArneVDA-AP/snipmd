param([int]$Trials = 8)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $here 'target\release\snipmd-probe.exe'
$log = Join-Path $here 'runs\resident.txt'
if (Test-Path $log) { Remove-Item $log }
$epoch = [DateTime]::new(1970, 1, 1, 0, 0, 0, [DateTimeKind]::Utc)
function NowMs { ([DateTime]::UtcNow - $epoch).TotalMilliseconds }
function Launch {
  $psi = New-Object System.Diagnostics.ProcessStartInfo $exe
  $psi.UseShellExecute = $false
  $psi.EnvironmentVariables['PROBE_LOG'] = $log
  $psi.EnvironmentVariables['PROBE_RESIDENT'] = '1'
  $psi.EnvironmentVariables['PROBE_FRAMELESS'] = '1'
  $psi.EnvironmentVariables['PROBE_TRANSPARENT'] = '1'
  [System.Diagnostics.Process]::Start($psi)
}
function WaitFor([string]$name, [int]$count) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt 10000) {
    if ((Test-Path $log) -and @(Select-String -Path $log -Pattern "^$name`t").Count -ge $count) { return (Select-String -Path $log -Pattern "^$name`t")[$count - 1].Line }
    Start-Sleep -Milliseconds 20
  }
  throw "no $name #$count"
}
$first = Launch
[void](WaitFor 'head' 1)
Start-Sleep -Seconds 2
$shown = @(); $secondExit = @()
for ($i = 1; $i -le $Trials; $i++) {
  $t0 = NowMs
  $p = Launch
  $line = WaitFor 'shown' $i
  $shown += [math]::Round([double]($line -split "`t")[1] - $t0, 1)
  [void]$p.WaitForExit(5000); $secondExit += [math]::Round($p.ExitTime.ToUniversalTime().Subtract($epoch).TotalMilliseconds - $t0, 1)
  Start-Sleep -Milliseconds 700
  $h = Launch; [void](WaitFor 'hidden' $i); [void]$h.WaitForExit(5000)
  Start-Sleep -Milliseconds 700
}
Start-Sleep -Seconds 3
$ids = @($first.Id) + @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -match 'com\.snipmd\.probe' } | ForEach-Object ProcessId)
$mb = 0; foreach ($id in $ids) { $c = Get-Counter "\Process(*)\ID Process" -ErrorAction SilentlyContinue; $pp = Get-Process -Id $id -ErrorAction SilentlyContinue; if ($pp) { $mb += $pp.PrivateMemorySize64 } }
"idle hidden, processes: $($ids.Count), private bytes total (MB): " + [math]::Round($mb / 1MB, 1)
$wsTotal = 0; foreach ($id in $ids) { $q = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Filter "IDProcess=$id" -ErrorAction SilentlyContinue; if ($q) { $wsTotal += $q.WorkingSetPrivate } }
"idle hidden, private working set total (MB): " + [math]::Round($wsTotal / 1MB, 1)
$first.Kill()
"shown after second launch (ms): " + ($shown -join ', ')
$s = $shown | Sort-Object; "median: " + (($s[3] + $s[4]) / 2)
"second process exit after launch (ms): " + ($secondExit -join ', ')
