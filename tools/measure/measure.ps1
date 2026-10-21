<#
.SYNOPSIS
  Measures the SPEC §9 budgets of a SnipMD build on Windows and prints one table.

.DESCRIPTION
  Every run uses its own data folder (SNIPMD_DATA_DIR) and fixture notes in a temp folder, so the
  user's session and notes are never touched. SnipMD must not be running (single instance would
  forward to it).

  - ready:   process start to the first tab taking keys (perf mark 'ready'), and the same from
             Start-Process as seen outside (includes loading the exe), median of -Runs cold starts.
  - paste:   a 3840x2160 PNG on the clipboard, Ctrl+V into an untitled tab, to the image decoded and
             painted (perf mark 'paste'), median of -Pastes.
  - memory:  5 notes with 4 screenshots each open in tabs, every tab visited once; private working
             set of snip-md.exe plus its WebView2 processes.
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
  }
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

function Median([double[]]$xs) { $s = $xs | Sort-Object; $s[[int][Math]::Floor(($s.Count - 1) / 2)] }

function Tree-Memory([int]$parentId) {
  $all = Get-CimInstance Win32_Process
  $ids = New-Object System.Collections.Generic.List[int]
  $ids.Add($parentId)
  for ($i = 0; $i -lt $ids.Count; $i++) {
    $all | Where-Object { $_.ParentProcessId -eq $ids[$i] } | ForEach-Object { $ids.Add([int]$_.ProcessId) }
  }
  $bytes = 0
  foreach ($id in $ids) { $p = Get-Process -Id $id -ErrorAction SilentlyContinue; if ($p) { $bytes += $p.PrivateMemorySize64 } }
  return [Math]::Round($bytes / 1MB, 1)
}

$results = [ordered]@{}

# 1. Cold start to typing.
$inside = @(); $outside = @()
for ($i = 1; $i -le $Runs; $i++) {
  $data = Join-Path $root "start-$i"
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = Start-Snip $data @()
  $inside += Wait-Mark $data 'ready' 1
  $outside += $sw.Elapsed.TotalMilliseconds
  Start-Sleep -Milliseconds 300
  Stop-Snip $p
}
$results['Start to typing, in process (ms, median)'] = Median $inside
$results['Start to typing, from launch incl. log poll (ms, median)'] = [Math]::Round((Median $outside), 0)

# 2. Paste a 4K screenshot.
$data = Join-Path $root 'paste'
$p = Start-Snip $data @()
$null = Wait-Mark $data 'ready' 1
$shell = New-Object -ComObject WScript.Shell
$times = @()
for ($i = 1; $i -le $Pastes; $i++) {
  $bmp = New-Shot $null 3840 2160 $i
  [System.Windows.Forms.Clipboard]::SetImage($bmp)
  $bmp.Dispose()
  $null = $shell.AppActivate($p.Id)
  Start-Sleep -Milliseconds 300
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
$null = $shell.AppActivate($p.Id)
for ($n = 1; $n -le 5; $n++) { Start-Sleep -Milliseconds 600; $shell.SendKeys("^$n") }
Start-Sleep -Seconds 3
$results['Memory, 5 tabs and 20 images (MB private)'] = Tree-Memory $p.Id
Stop-Snip $p

# 4. Installer.
$setup = Get-ChildItem (Join-Path (Split-Path $Exe) 'bundle\nsis\*.exe') -ErrorAction SilentlyContinue | Select-Object -First 1
if ($setup) { $results['Installer (MB)'] = [Math]::Round($setup.Length / 1MB, 2) }

$results.GetEnumerator() | ForEach-Object { '{0,-58} {1}' -f $_.Key, $_.Value }
Write-Host "Data and fixtures: $root (delete when done)"
