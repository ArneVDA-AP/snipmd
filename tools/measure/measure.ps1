<#
.SYNOPSIS
  Measures the SPEC §9 budgets of a SnipMD build on Windows and prints one table.

.DESCRIPTION
  Every run uses its own data folder (SNIPMD_DATA_DIR) and fixture notes in a temp folder, so the
  user's session and notes are never touched. SnipMD must not be running (single instance would
  forward to it).

  - ready:   double-click to typing, as SnipMD is normally started: with a note as argument and a
             session from the run before (the first run has none). Process start to the first tab
             taking keys (perf mark 'ready'), and the same from Start-Process (includes loading the
             exe). The first run is reported alone; the others as a median. The WebView2 profile is
             the user's own, as in normal use. SnipMD's own part (page load start to 'ready') is the
             median over all runs.
  - paste:   a 3840x2160 PNG on the clipboard, Ctrl+V into an untitled tab, to the image decoded and
             painted (perf mark 'paste'), median of -Pastes.
  - memory:  5 notes with 4 screenshots each open in tabs, every tab visited once; private working
             set (Task Manager's 'Memory') and private bytes of snip-md.exe plus its WebView2 processes.
  The script puts images on the clipboard, so whatever was on it is gone afterwards. Keys are only
  sent while SnipMD has the foreground; otherwise the script stops.
  - installer: size of the NSIS setup next to the exe, when there is one.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\measure\measure.ps1 -Exe src-tauri\target\release\snip-md.exe
#>
param(
  [string]$Exe = "$env:LOCALAPPDATA\SnipMD\snip-md.exe",
  [int]$Runs = 7,
  [int]$Pastes = 5
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Fg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  public static uint Pid() { uint pid; GetWindowThreadProcessId(GetForegroundWindow(), out pid); return pid; }
}
'@

if (-not (Test-Path $Exe)) { throw "No SnipMD exe at $Exe" }
if (Get-Process snip-md -ErrorAction SilentlyContinue) { throw 'Close SnipMD first: a running instance would take the launches.' }

$root = Join-Path ([IO.Path]::GetTempPath()) ("snipmd-measure-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $root | Out-Null
$notes = Join-Path $root 'notes'
New-Item -ItemType Directory -Path $notes | Out-Null

function New-Shot([string]$path, [int]$w, [int]$h, [int]$seed) {
  # A screenshot-like image: flat panels, text lines and noise, so PNG size is realistic.
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $rnd = New-Object System.Random $seed
  $g.Clear([System.Drawing.Color]::FromArgb(243, 243, 243))
  $font = New-Object System.Drawing.Font 'Segoe UI', 14
  for ($y = 40; $y -lt $h; $y += 28) {
    $text = -join (1..($rnd.Next(20, 120)) | ForEach-Object { [char]$rnd.Next(97, 123) })
    $g.DrawString($text, $font, [System.Drawing.Brushes]::Black, 30 + $rnd.Next(0, 400), $y)
  }
  for ($i = 0; $i -lt 40; $i++) {
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($rnd.Next(256), $rnd.Next(256), $rnd.Next(256)))
    $g.FillRectangle($brush, $rnd.Next($w), $rnd.Next($h), $rnd.Next(40, 400), $rnd.Next(20, 200))
    $brush.Dispose()
  }
  $font.Dispose()
  $g.Dispose()
  if ($path) { $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); return }
  return $bmp
}

function Start-Snip([string]$dataDir, [string[]]$files) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo $Exe
  $psi.Arguments = ($files | ForEach-Object { '"' + $_ + '"' }) -join ' '
  $psi.UseShellExecute = $false
  $psi.EnvironmentVariables['SNIPMD_TRACE'] = '1'
  $psi.EnvironmentVariables['SNIPMD_DATA_DIR'] = $dataDir
  return [System.Diagnostics.Process]::Start($psi)
}

function Wait-Mark([string]$dataDir, [string]$name, [int]$count, [int]$timeoutMs = 15000) {
  $log = Join-Path $dataDir 'perf.log'
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $timeoutMs) {
    if (Test-Path $log) {
      $marks = @(Get-Content $log | Where-Object { $_ -like "$name`t*" })
      if ($marks.Count -ge $count) { return [double]($marks[$count - 1].Split("`t")[1]) }
    }
    Start-Sleep -Milliseconds 2
  }
  throw "No '$name' mark #$count within $timeoutMs ms"
}

function Stop-Snip($proc) {
  # CloseMainWindow goes through close-requested like Alt+F4; kill only if it hangs.
  $null = $proc.CloseMainWindow()
  if (-not $proc.WaitForExit(5000)) { $proc.Kill() }
}

# Keys go to the foreground window, so they are only sent when that is SnipMD.
function Focus-Snip($proc) {
  for ($i = 0; $i -lt 20; $i++) {
    $null = $script:shell.AppActivate($proc.Id)
    Start-Sleep -Milliseconds 150
    if ([Fg]::Pid() -eq $proc.Id) { return }
  }
  Stop-Snip $proc
  throw 'SnipMD did not get the foreground; no keys were sent. Run the script from a desktop session.'
}

function Median([double[]]$xs) { $s = $xs | Sort-Object; $s[[int][Math]::Floor(($s.Count - 1) / 2)] }

# Memory of snip-md.exe and every process under it (WebView2), in MB: the private working set
# (what Task Manager shows as Memory) and private bytes (commit, an upper bound).
function Tree-Memory([int]$parentId) {
  $all = Get-CimInstance Win32_Process
  $ids = New-Object System.Collections.Generic.List[int]
  $ids.Add($parentId)
  for ($i = 0; $i -lt $ids.Count; $i++) {
    $all | Where-Object { $_.ParentProcessId -eq $ids[$i] } | ForEach-Object { $ids.Add([int]$_.ProcessId) }
  }
  $perf = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object { $ids -contains [int]$_.IDProcess }
  $ws = ($perf | Measure-Object -Property WorkingSetPrivate -Sum).Sum
  $commit = 0
  foreach ($id in $ids) { $p = Get-Process -Id $id -ErrorAction SilentlyContinue; if ($p) { $commit += $p.PrivateMemorySize64 } }
  return '{0:N1} / {1:N1}' -f ($ws / 1MB), ($commit / 1MB)
}

$results = [ordered]@{}

$shell = New-Object -ComObject WScript.Shell

# 1. Double-click to typing: a note as argument, the session of the run before.
$startNote = Join-Path $notes 'start.md'
[IO.File]::WriteAllText($startNote, "# Start`r`n`r`nA note opened by double-click.`r`n")
$data = Join-Path $root 'start'
$inside = @(); $outside = @(); $own = @()
for ($i = 1; $i -le $Runs; $i++) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = Start-Snip $data @($startNote)
  $inside += Wait-Mark $data 'ready' $i
  $outside += $sw.Elapsed.TotalMilliseconds
  $own += $inside[-1] - (Wait-Mark $data 'page' $i)
  Start-Sleep -Milliseconds 500
  Stop-Snip $p
}
# Where the time of the last start went, from process start: the page load began (WebView2 is up),
# its HTML arrived, the script ran, the session was read, the first tab took keys.
$log = Get-Content (Join-Path $data 'perf.log')
$last = { param($n) $l = $log | Where-Object { $_ -like "$n`t*" } | Select-Object -Last 1; if ($l) { $l.Split("`t")[1] } else { '-' } }
$results['Last start: page / html / script / session / ready (ms from process start)'] =
  (('page', 'html', 'script', 'session', 'ready') | ForEach-Object { & $last $_ }) -join ' / '
$results['Double-click to typing, first start (ms, in process / from launch)'] = '{0} / {1:N0}' -f $inside[0], $outside[0]
if ($Runs -gt 1) {
  $results['Double-click to typing, later starts (ms, median in process / from launch)'] =
    '{0} / {1:N0}' -f (Median $inside[1..($Runs - 1)]), (Median $outside[1..($Runs - 1)])
}
# The budgeted part: from the page load starting (WebView2 is up) to typing. Before it is WebView2's start.
$results["SnipMD's own start, page to ready (ms, median of all starts)"] = '{0:N1}' -f (Median $own)

# 2. Paste a 4K screenshot.
$data = Join-Path $root 'paste'
$p = Start-Snip $data @()
$null = Wait-Mark $data 'ready' 1
$times = @()
for ($i = 1; $i -le $Pastes; $i++) {
  $bmp = New-Shot $null 3840 2160 $i
  [System.Windows.Forms.Clipboard]::SetImage($bmp)
  $bmp.Dispose()
  Focus-Snip $p
  $shell.SendKeys('^v')
  $times += Wait-Mark $data 'paste' $i
}
Stop-Snip $p
$results['Ctrl+V to 4K screenshot visible (ms, median)'] = Median $times

# 3. Memory with 5 tabs and 20 images.
$files = @()
for ($n = 1; $n -le 5; $n++) {
  $assets = Join-Path $notes "note-$n.assets"
  New-Item -ItemType Directory -Path $assets | Out-Null
  $body = "# Note $n`r`n`r`n"
  for ($k = 1; $k -le 4; $k++) {
    New-Shot (Join-Path $assets "shot-$k.png") 1920 1080 ($n * 10 + $k)
    $body += "Step $k`r`n![snip](note-$n.assets/shot-$k.png)`r`n`r`n"
  }
  $file = Join-Path $notes "note-$n.md"
  [IO.File]::WriteAllText($file, $body)
  $files += $file
}
$data = Join-Path $root 'memory'
$p = Start-Snip $data $files
$null = Wait-Mark $data 'ready' 1
for ($n = 1; $n -le 5; $n++) { Start-Sleep -Milliseconds 600; Focus-Snip $p; $shell.SendKeys("^$n") }
Start-Sleep -Seconds 3
$results['Memory, 5 tabs and 20 images (MB, private working set / private bytes)'] = Tree-Memory $p.Id
Stop-Snip $p

# 4. Installer.
$setup = Get-ChildItem (Join-Path (Split-Path $Exe) 'bundle\nsis\*.exe') -ErrorAction SilentlyContinue | Select-Object -First 1
if ($setup) { $results['Installer (MB)'] = [Math]::Round($setup.Length / 1MB, 2) }

$results.GetEnumerator() | ForEach-Object { '{0,-58} {1}' -f $_.Key, $_.Value }
Write-Host "Data and fixtures: $root (delete when done)"
