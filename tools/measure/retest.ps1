<#
.SYNOPSIS
  Drives the real SnipMD through the saving, Save again, one-tab-per-note and closed-tab scenarios
  of the Windows test plan, and judges each one by what is on disk and in session.json.

.DESCRIPTION
  The app gets its own data folder (SNIPMD_DATA_DIR) and notes folder under %TEMP%, with a seeded
  session.json: one empty untitled tab and lastFolder set to that notes folder, so the first-save bar
  proposes it. Keys are only sent while SnipMD has the foreground. Nothing is read from the window:
  bar texts, dialogs and the look are not judged. Each block writes OK, FOUT or SKIPPED with its
  evidence to <Out>\retest.txt (UTF-16, like the other result files) and copies session.json to
  <Out>\retest-session\; a block that is not OK also gets a window shot in <Out>. The script exits 1
  when any block is FOUT. SnipMD must not be running (single instance would forward to it).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\measure\retest.ps1 -Exe src-tauri\target\release\snip-md.exe -Out results\windows-ci
#>
param(
  [Parameter(Mandatory = $true)][string]$Exe,
  [Parameter(Mandatory = $true)][string]$Out
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class RWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern uint GetLongPathName(string s, StringBuilder l, uint n);
  public static uint FgPid() { uint p; GetWindowThreadProcessId(GetForegroundWindow(), out p); return p; }
  public static string Long(string s) { var b = new StringBuilder(1024); return GetLongPathName(s, b, 1024) > 0 ? b.ToString() : s; }
}
'@
[void][RWin]::SetProcessDPIAware()

if (-not (Test-Path $Exe)) { throw "No SnipMD exe at $Exe" }
$Exe = (Resolve-Path $Exe).Path
if (Get-Process snip-md -ErrorAction SilentlyContinue) { throw 'Close SnipMD first: a running instance would take the launches.' }
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$Out = (Resolve-Path $Out).Path
$report = Join-Path $Out 'retest.txt'
$snapDir = Join-Path $Out 'retest-session'
# Results of an earlier run in the same folder must not sit next to this run's verdicts.
Remove-Item -Recurse -Force $report, $snapDir, (Join-Path $Out 'retest-*.png') -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $snapDir | Out-Null

# One spelling of every path (the long one, not RUNNER~1): the app compares paths as strings.
$tmp = [RWin]::Long([IO.Path]::GetTempPath().TrimEnd('\'))
$root = Join-Path $tmp ('snipmd-retest-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
$data = Join-Path $root 'data'
$notes = Join-Path $root 'notes'
New-Item -ItemType Directory -Path $data, $notes, (Join-Path $notes 'sub') | Out-Null
$sessionFile = Join-Path $data 'session.json'
$perfLog = Join-Path $data 'perf.log'
$shell = New-Object -ComObject WScript.Shell

function Say([string]$line) {
  Write-Host $line
  $line | Out-File -FilePath $report -Append -Encoding Unicode
}

# ---- the app ----
$script:app = $null
$script:hwnd = [IntPtr]::Zero
# Every snip-md this script started. Cleanup stops only these, never an instance someone else started.
$script:started = New-Object System.Collections.Generic.List[int]

function Foreign { @(Get-Process snip-md -ErrorAction SilentlyContinue | Where-Object { -not $script:started.Contains($_.Id) }) }

# A launch next to an instance the script did not start would be forwarded to it (single instance).
function Start-Snip([string[]]$files) {
  if ((Foreign).Count -gt 0) { throw 'a SnipMD this script did not start is running; nothing was launched' }
  $p = [System.Diagnostics.Process]::Start((New-Psi $files))
  $script:started.Add($p.Id)
  return $p
}

function Ready-Count { if (Test-Path $perfLog) { @(Get-Content $perfLog | Where-Object { $_ -like "ready`t*" }).Count } else { 0 } }

function New-Psi([string[]]$files) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo $Exe
  $psi.Arguments = ($files | ForEach-Object { '"' + $_ + '"' }) -join ' '
  $psi.UseShellExecute = $false
  $psi.EnvironmentVariables['SNIPMD_TRACE'] = '1'
  $psi.EnvironmentVariables['SNIPMD_DATA_DIR'] = $data
  return $psi
}

function Start-App {
  $before = Ready-Count
  $script:app = Start-Snip @()
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ((Ready-Count) -le $before) {
    if ($sw.ElapsedMilliseconds -gt 30000) { throw 'SnipMD did not report ready within 30 s' }
    Start-Sleep -Milliseconds 50
  }
  while ($script:app.MainWindowHandle -eq [IntPtr]::Zero) {
    if ($sw.ElapsedMilliseconds -gt 35000) { throw 'SnipMD has no window' }
    Start-Sleep -Milliseconds 50; $script:app.Refresh()
  }
  $script:hwnd = $script:app.MainWindowHandle
  Start-Sleep -Milliseconds 700
}

function Stop-App {
  if (-not $script:app -or $script:app.HasExited) { return 'not running' }
  $null = $script:app.CloseMainWindow()
  if ($script:app.WaitForExit(10000)) { return 'closed' }
  $script:app.Kill(); return 'killed after 10 s'
}

function Focus-Snip {
  for ($i = 0; $i -lt 20; $i++) {
    [void][RWin]::SetForegroundWindow($script:hwnd)
    $null = $shell.AppActivate($script:app.Id)
    Start-Sleep -Milliseconds 150
    if ([RWin]::FgPid() -eq $script:app.Id) { return }
  }
  throw 'SKIP: SnipMD did not get the foreground; no keys were sent'
}

function Keys([string]$keys, [int]$after = 250) {
  Focus-Snip
  $shell.SendKeys($keys)
  Start-Sleep -Milliseconds $after
}

# Text typed as text: SendKeys' own characters are escaped.
function Type-Text([string]$text) { Keys ([regex]::Replace($text, '[+^%~(){}\[\]]', '{$0}')) 400 }

# Window blur and focus: minimize and restore. The page writes dirty notes and the session on blur.
function Blur-Snip {
  [void][RWin]::ShowWindow($script:hwnd, 6)
  Start-Sleep -Milliseconds 900
  [void][RWin]::ShowWindow($script:hwnd, 9)
  Start-Sleep -Milliseconds 300
  Focus-Snip
  Start-Sleep -Milliseconds 900
}

function Shot([string]$name) {
  try {
    $r = New-Object RWin+RECT
    [void][RWin]::GetWindowRect($script:hwnd, [ref]$r)
    $w = $r.R - $r.L; $h = $r.B - $r.T
    if ($w -le 0 -or $h -le 0) { return }
    $img = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($img)
    $g.CopyFromScreen($r.L, $r.T, 0, 0, $img.Size)
    $g.Dispose()
    $img.Save((Join-Path $Out "retest-$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Dispose()
  } catch { Write-Host "no shot for ${name}: $_" }
}

# ---- disk and session ----
function Norm([string]$p) { if ($p) { $p.Replace('\', '/').TrimEnd('/') } else { '' } }
function Same([string]$a, [string]$b) { $a -and $b -and ((Norm $a) -eq (Norm $b)) } # -eq ignores case, as Windows does

function Read-Session {
  for ($i = 0; $i -lt 5; $i++) {
    try { return ([IO.File]::ReadAllText($sessionFile) | ConvertFrom-Json) } catch { Start-Sleep -Milliseconds 60 }
  }
  return $null
}
# Always an array (the comma keeps it one): in Windows PowerShell 5.1 a lone object has no .Count.
function OpenAt($s, [string]$path) { , @(@($s.tabs) | Where-Object { Same $_.filePath $path }) }
function ClosedAt($s, [string]$path) { , @(@($s.closedTabs) | Where-Object { Same $_.tab.filePath $path }) }
function Titled($s, [string]$title) { , @(@($s.tabs) | Where-Object { $_.title -eq $title }) }

# Polls session.json until $cond holds; the session or $null after the timeout.
function Wait-Session([scriptblock]$cond, [int]$timeoutMs = 6000) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  do {
    $s = Read-Session
    if ($s -and (& $cond $s)) { return $s }
    Start-Sleep -Milliseconds 100
  } while ($sw.ElapsedMilliseconds -lt $timeoutMs)
  return $null
}

function Read-Note([string]$path) {
  for ($i = 0; $i -lt 5; $i++) {
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    try { return [IO.File]::ReadAllText($path) } catch { Start-Sleep -Milliseconds 60 }
  }
  return $null
}
function Show([string]$text) {
  if ($null -eq $text) { return '(no file)' }
  $t = $text.Replace("`r", '\r').Replace("`n", '\n')
  if ($t.Length -gt 100) { $t = $t.Substring(0, 100) + '...' }
  return '"' + $t + '"'
}
function Note-Path([string]$name) { Join-Path $notes $name }

# ---- blocks ----
$script:ev = $null
$script:bad = $false
$passed = @{}
$verdicts = New-Object System.Collections.Generic.List[string]

function Note([string]$s) { $script:ev.Add($s) }
function Expect($ok, [string]$what) {
  if (-not $ok) { $script:bad = $true }
  if ($ok) { Note "[ok] $what" } else { Note "[x]  $what" }
}
function Note-File([string]$label, [string]$path) {
  $t = Read-Note $path
  $size = if ($null -eq $t) { '-' } else { (Get-Item -LiteralPath $path).Length }
  Note ("{0}: {1} bytes {2}" -f $label, $size, (Show $t))
}

function Block([string]$id, [string]$title, [string[]]$needs, [scriptblock]$body) {
  $script:ev = New-Object System.Collections.Generic.List[string]
  $script:bad = $false
  $verdict = 'OK'
  $missing = @($needs | Where-Object { $_ -and -not $passed[$_] })
  if ($missing.Count -gt 0) {
    $verdict = 'SKIPPED'; Note ("needs {0}, which was not OK" -f ($missing -join ', '))
  } else {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try {
      if (-not $script:app -or $script:app.HasExited) { Note 'app was not running; started it'; Start-App }
      & $body
      if ($script:bad) { $verdict = 'FOUT' }
    } catch {
      $msg = "$($_.Exception.Message)"
      if ($msg.StartsWith('SKIP: ')) { $verdict = 'SKIPPED'; Note $msg.Substring(6) }
      else { $verdict = 'FOUT'; Note "error: $msg" }
    }
    Note ("took {0:N1} s" -f $sw.Elapsed.TotalSeconds)
    if ($verdict -ne 'OK') { Shot ($id -replace '[^A-Za-z0-9-]', '-') }
    # A hung app would take every later block with it: kill it, the next block starts it again.
    if ($script:app -and -not $script:app.HasExited) {
      $script:app.Refresh()
      if (-not $script:app.Responding) { $script:app.Kill(); Note 'app stopped responding; killed it' }
    }
  }
  if (Test-Path $sessionFile) { Copy-Item $sessionFile (Join-Path $snapDir (($id -replace '[^A-Za-z0-9-]', '-') + '.json')) -Force }
  if ($verdict -eq 'OK') { $passed[$id] = $true }
  $verdicts.Add($verdict)
  Say ("{0,-8} {1} {2}" -f $verdict, $id, $title)
  foreach ($e in $script:ev) { Say "         $e" }
}

# The tab with this file becomes the active one, through Ctrl+<its place in the strip>.
function Select-Tab([string]$path) {
  $s = Read-Session
  $tabs = @($s.tabs)
  for ($i = 0; $i -lt $tabs.Count; $i++) {
    if (Same $tabs[$i].filePath $path) {
      if ($s.activeTabId -eq $tabs[$i].id) { return }
      if ($i -ge 9) { throw "tab $path is past Ctrl+9" }
      Keys ('^' + ($i + 1))
      $id = $tabs[$i].id
      if (-not (Wait-Session { param($x) $x.activeTabId -eq $id } 3000)) { throw "could not make $path the active tab" }
      return
    }
  }
  throw "no open tab for $path"
}

# A new tab with $text, saved through the first-save bar under $name (the proposed name when empty).
function New-SavedNote([string]$text, [string]$name) {
  Keys '^t' 500
  Type-Text $text
  Keys '^s' 900
  if ($name) { Keys '^a' 150; Type-Text $name; Start-Sleep -Milliseconds 600 }
  Keys '{ENTER}' 300
}

# Saves a new note (typed name $name, or the proposed one when empty) and waits for its tab on $file;
# retries Enter once when the bar had not enabled Save yet. The session or $null.
function Save-Note([string]$text, [string]$name, [string]$file = $name) {
  New-SavedNote $text $name
  $path = Note-Path $file
  $s = Wait-Session { param($x) (OpenAt $x $path).Count -ge 1 } 5000
  if (-not $s) { Keys '{ENTER}' 300; $s = Wait-Session { param($x) (OpenAt $x $path).Count -ge 1 } 5000 }
  return $s
}

# Deletes a note and waits until its tab turns dirty: the gone bar was raised (it marks the tab dirty).
function Remove-AndWaitGone([string]$path) {
  Remove-Item -LiteralPath $path
  Focus-Snip # the watcher only checks while the window has focus
  return Wait-Session { param($x) $t = OpenAt $x $path; $t.Count -eq 1 -and $t[0].dirty -eq $true } 8000
}

function Session-Time { (Get-Item -LiteralPath $sessionFile).LastWriteTimeUtc }
function Ms-Of([string]$path) { ([DateTimeOffset](Get-Item -LiteralPath $path).LastWriteTimeUtc).ToUnixTimeMilliseconds() }

$seedId = 'seed-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
# Written as text: a tabs list of one must stay a list (the page ignores a session without tabs).
$seed = '{"version":3,"activeTabId":"ID","lastFolder":FOLDER,"tabs":[{"id":"ID","title":"Untitled-1","filePath":null,"content":"","dirty":false,"mode":"edit","cursor":0,"scrollTop":0,"disk":null,"format":null}],"closedTabs":[],"settings":{}}'
[IO.File]::WriteAllText($sessionFile, $seed.Replace('ID', $seedId).Replace('FOLDER', ($notes | ConvertTo-Json)))
$scriptStart = Get-Date

Say "SnipMD retest $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Say "exe: $Exe ($((Get-Item $Exe).VersionInfo.ProductVersion))"
Say "data: $data"
Say "notes: $notes"
Say "seeded session.json: one empty untitled tab ($seedId), lastFolder = the notes folder"
Say 'S4b, S5b and O2 are additions to the test plan, not rows of it.'
Say ''

$hertest = Note-Path 'hertest-een.md'
$u1 = Note-Path 'u1.md'; $u2 = Note-Path 'u2.md'; $u3 = Note-Path 'u3.md'; $u4 = Note-Path 'u4.md'
$w1 = Note-Path 'w1.md'

try {
  $seeded = Session-Time
  Start-App
  # Every first save below goes to lastFolder: if the app did not take the seed, it would save into
  # Documents\Notes instead. Its own rewrite of session.json with the seed shows it took it.
  $taken = Wait-Session { param($x) (Session-Time) -gt $seeded -and @(@($x.tabs) | Where-Object { $_.id -eq $seedId }).Count -eq 1 -and (Same $x.lastFolder $notes) } 8000
  if (-not $taken) {
    Say 'FOUT     setup: the app did not rewrite session.json with the seeded tab and lastFolder; no block ran'
    $verdicts.Add('FOUT')
    throw 'seeded session not taken'
  }

  Block 'S1' 'first save through the bar' @() {
    $s = Save-Note '# Hertest een' '' 'hertest-een.md'
    $t = Read-Note $hertest
    Note-File 'hertest-een.md' $hertest
    Expect ($null -ne $t -and $t.Contains('# Hertest een')) 'hertest-een.md is in the notes folder with the heading'
    $tab = if ($s) { (OpenAt $s $hertest)[0] } else { $null }
    Expect ($tab -and $tab.title -eq 'hertest-een.md' -and $tab.dirty -eq $false) "session: a clean tab titled hertest-een.md on that file (title: $($tab.title))"
  }

  Block 'S2' 'autosave' @('S1') {
    Select-Tab $hertest
    Keys '^{END}' 150; Keys '{ENTER}' 150; Type-Text 'Autosave regel'
    Start-Sleep -Milliseconds 2500
    $t = Read-Note $hertest
    Note-File 'hertest-een.md after 2.5 s' $hertest
    Expect ($null -ne $t -and $t.Contains('Autosave regel')) 'the file holds the typed line'
    # The session must have been written after that save: the tab's stamp is the file's size and mtime now.
    $s = Wait-Session { param($x) $a = OpenAt $x $hertest; $a.Count -eq 1 -and $a[0].dirty -eq $false -and $a[0].disk -and
      [long]$a[0].disk.size -eq (Get-Item -LiteralPath $hertest).Length -and [Math]::Abs([double]$a[0].disk.mtimeMs - (Ms-Of $hertest)) -le 1 } 3000
    $d = (OpenAt (Read-Session) $hertest)[0].disk
    Note ("session stamp: size {0}, mtimeMs {1}; file: size {2}, mtimeMs {3}" -f $d.size, $d.mtimeMs, (Get-Item -LiteralPath $hertest).Length, (Ms-Of $hertest))
    Expect ($null -ne $s) 'session rewritten after the autosave: the tab is clean with the stamp of the new file'
  }

  Block 'G1-G2' 'closed tab comes back' @('S1') {
    $s0 = Read-Session
    $tabs0 = @($s0.tabs).Count; $closed0 = @($s0.closedTabs).Count
    Select-Tab $hertest
    Keys '^w' 300
    $s1 = Wait-Session { param($x) (ClosedAt $x $hertest).Count -eq 1 -and (OpenAt $x $hertest).Count -eq 0 } 4000
    if ($s1) { Note ("after Ctrl+W: tabs {0} -> {1}, closedTabs {2} -> {3}" -f $tabs0, @($s1.tabs).Count, $closed0, @($s1.closedTabs).Count) }
    Expect ($s1 -and @($s1.closedTabs).Count -eq $closed0 + 1 -and @($s1.tabs).Count -eq $tabs0 - 1) 'Ctrl+W: closedTabs grows by one with hertest-een.md, tabs shrinks by one'
    $cursor = if ($s1) { (ClosedAt $s1 $hertest)[0].tab.cursor } else { $null }
    Keys '^+t' 300
    $s2 = Wait-Session { param($x) (OpenAt $x $hertest).Count -eq 1 -and (ClosedAt $x $hertest).Count -eq 0 } 4000
    if ($s2) { Note ("after Ctrl+Shift+T: tabs {0}, closedTabs {1}" -f @($s2.tabs).Count, @($s2.closedTabs).Count) }
    Expect ($s2 -and @($s2.closedTabs).Count -eq $closed0 -and @($s2.tabs).Count -eq $tabs0) 'Ctrl+Shift+T: the tab is back on the same filePath, both counts as before'
    $back = if ($s2) { (OpenAt $s2 $hertest)[0].cursor } else { $null }
    Expect ($cursor -gt 0 -and $back -eq $cursor) "the cursor is where it was: $cursor at the close, $back after the restore"
  }

  Block 'S4b' '(addition, not a plan row) Save again writes a gone note back' @() {
    $s = Save-Note 'twee' 'u2.md'
    Note-File 'u2.md after the save' $u2
    if (-not $s -or $null -eq (Read-Note $u2)) { throw 'could not create u2.md through the bar' }
    $g = Remove-AndWaitGone $u2
    Expect ($null -ne $g) 'after deleting u2.md the tab turned dirty (the gone bar was raised)'
    if (-not $g) { return }
    # The gone bar is the newest top bar; F6 focuses its only button, Save again.
    Keys '{F6}' 400; Keys '{ENTER}' 300
    $s2 = Wait-Session { param($x) $a = OpenAt $x $u2; $a.Count -eq 1 -and $a[0].dirty -eq $false } 5000
    $t = Read-Note $u2
    Note-File 'u2.md after F6, Enter' $u2
    Expect ($null -ne $t -and $t.Contains('twee')) 'u2.md is back with the tab''s text'
    Expect ($null -ne $s2) 'session: the u2.md tab is clean'
  }

  Block 'S4' 'a deleted note raises the gone state' @() {
    $s = Save-Note 'oud' 'u1.md'
    Note-File 'u1.md after the save' $u1
    if (-not $s -or $null -eq (Read-Note $u1)) { throw 'could not create u1.md through the bar' }
    $g = Remove-AndWaitGone $u1
    Expect ($null -ne $g) 'session: the u1.md tab turned dirty (the gone bar was raised)'
    $content = if ($g) { (OpenAt $g $u1)[0].content } else { $null }
    Expect ($content -eq 'oud') "the tab keeps its text: $(Show $content)"
    # The tab is in conflict now: neither the watch, autosave nor the blur flush may write it back.
    Start-Sleep -Milliseconds 2500
    Blur-Snip
    Expect (-not (Test-Path -LiteralPath $u1)) 'u1.md is still gone 2.5 s and a blur later: the app did not recreate it'
  }

  Block 'S5/S5b' 'a new tab cannot be saved onto the path of an open tab (S5b is an addition)' @('S4') {
    New-SavedNote 'nieuw-s5' 'u1.md'
    Start-Sleep -Milliseconds 1500
    # While the bar is open, typing goes into its name field; once Enter closed it, back into the note.
    # So ' na' in the note's text proves the save was tried (and, with no filePath, refused).
    Type-Text ' na'
    Blur-Snip
    $s = Wait-Session { param($x) @(@($x.tabs) | Where-Object { "$($_.content)".Contains('nieuw-s5 na') }).Count -ge 1 } 4000
    Expect ($null -ne $s) 'the bar closed on Enter: typing after it went back into the note (text "nieuw-s5 na")'
    if (-not $s) { $s = Read-Session }
    Note-File 'u1.md' $u1
    Expect (-not (Test-Path -LiteralPath $u1)) 'no u1.md appeared on disk'
    $new = @(@($s.tabs) | Where-Object { "$($_.content)".Contains('nieuw-s5') })[0]
    Expect ($new -and $null -eq $new.filePath -and $new.title -like 'Untitled-*') "session after a blur: the new tab is still untitled with its text (title: $($new.title), filePath: $($new.filePath))"
    Expect ($s -and (OpenAt $s $u1).Count -eq 1) 'session: still exactly one tab on u1.md'
    # Closing the refused tab also removes its error bar, so u1.md's gone bar is the newest again (S6).
    if ($new) {
      Keys '^w' 300
      $null = Wait-Session { param($x) @(@($x.tabs) | Where-Object { $_.id -eq $new.id }).Count -eq 0 } 3000
    }
  }

  Block 'S6' 'Save again does not overwrite a newer file' @('S4', 'S5/S5b') {
    [IO.File]::WriteAllText($u1, "van buiten`r`n")
    $stamp = (Get-Item -LiteralPath $u1).LastWriteTimeUtc
    Note "wrote u1.md from outside: $(Show (Read-Note $u1))"
    Keys '{F6}' 400; Keys '{ENTER}' 300 # Save again on the gone bar
    Start-Sleep -Milliseconds 2500
    Blur-Snip
    Note-File 'u1.md after Save again and a blur' $u1
    $t = Read-Note $u1
    Expect ($t -eq "van buiten`r`n" -and (Get-Item -LiteralPath $u1).LastWriteTimeUtc -eq $stamp) 'u1.md keeps the outside content, unwritten'
    $s = Read-Session
    $tab = (OpenAt $s $u1)[0]
    Expect ($tab -and $tab.dirty -eq $true -and "$($tab.content)".Contains('oud')) 'session: the u1.md tab is still dirty with its own text'
    # The refused write raises the changed bar (only Save again can raise it now: the watch skips a tab
    # in conflict). Its first button, Open disk version, opens the file in a read tab: proof it was pressed.
    Keys '{F6}' 400; Keys '{ENTER}' 300
    $d = Wait-Session { param($x) (Titled $x 'u1.md (disk)').Count -ge 1 } 4000
    $copy = if ($d) { (Titled $d 'u1.md (disk)')[0] } else { $null }
    Expect ($copy -and "$($copy.content)".Contains('van buiten')) "the changed bar was up: Open disk version opened 'u1.md (disk)' with $(if ($copy) { Show $copy.content } else { 'nothing' })"
  }

  Block 'G3-G5' 'closed tab with unwritten edits, then a new note on its path, then restore' @() {
    $s = Save-Note 'drie' 'u3.md'
    if (-not $s -or $null -eq (Read-Note $u3)) { throw 'could not create u3.md through the bar' }
    $g = Remove-AndWaitGone $u3
    if (-not $g) { throw 'u3.md tab did not turn dirty after the delete' }
    Select-Tab $u3
    Keys '^{END}' 150; Type-Text ' nog oud'
    $null = Wait-Session { param($x) $a = OpenAt $x $u3; $a.Count -eq 1 -and "$($a[0].content)".Contains('nog oud') } 3000
    Keys '^w' 300
    $c = Wait-Session { param($x) (ClosedAt $x $u3).Count -eq 1 } 4000
    $closed = if ($c) { (ClosedAt $c $u3)[0].tab } else { $null }
    Expect ($closed -and $closed.dirty -eq $true -and "$($closed.content)".Contains('nog oud')) "G3: closedTabs holds u3.md, dirty, with $(if ($closed) { Show $closed.content } else { 'nothing' })"
    Expect (-not (Test-Path -LiteralPath $u3)) 'G3: the close wrote no u3.md'
    $s4 = Save-Note 'nieuw-g4' 'u3.md'
    $t = Read-Note $u3
    Note-File 'u3.md after G4' $u3
    Expect ($s4 -and $null -ne $t -and $t.Contains('nieuw-g4')) 'G4: the new tab saved as u3.md holds its text'
    # Ctrl+Shift+T, where the plan clicks Restore in the G3 warning: both call the same restore.
    Keys '^+t' 300
    $null = Wait-Session { param($x) (Titled $x 'u3.md (closed)').Count -ge 1 } 5000
    Blur-Snip
    $s5 = Read-Session
    $copy = (Titled $s5 'u3.md (closed)')[0]
    Note ("G5: tabs on u3.md: {0}, closed entries on u3.md: {1}" -f (OpenAt $s5 $u3).Count, (ClosedAt $s5 $u3).Count)
    Expect ((OpenAt $s5 $u3).Count -eq 1 -and (ClosedAt $s5 $u3).Count -eq 0) 'G5: no second tab on u3.md, the closed entry is used up'
    Expect ($copy -and $null -eq $copy.filePath -and $copy.mode -eq 'read' -and "$($copy.content)".Contains('nog oud')) "G5: its unsaved text is in an untitled read-only tab u3.md (closed) (mode: $($copy.mode))"
    Note-File 'u3.md after G5 and a blur' $u3
    $t = Read-Note $u3
    Expect ($null -ne $t -and $t.Contains('nieuw-g4') -and -not $t.Contains('nog oud')) 'G5: u3.md still holds the newer tab''s text'
  }

  Block 'O1/O2' 'one tab per note on open, second launch forwarded (O2 is an addition)' @('S1') {
    function Done($procs) {
      foreach ($p in $procs) {
        if ($p.WaitForExit(10000)) { continue }
        $p.Kill(); Expect $false "a second launch ($($p.Id)) did not exit within 10 s: it became a second instance; killed it"
      }
    }
    $h = (OpenAt (Read-Session) $hertest)[0].id
    Done @((Start-Snip @($hertest)), (Start-Snip @($hertest)))
    $null = Wait-Session { param($x) $x.activeTabId -eq $h } 5000
    Start-Sleep -Milliseconds 1200
    $s = Read-Session
    Expect ($s -and $s.activeTabId -eq $h -and (OpenAt $s $hertest).Count -eq 1) "O1 open note twice: one tab on hertest-een.md ($((OpenAt $s $hertest).Count)), and it is active"
    [IO.File]::WriteAllText($w1, "# W1`r`n")
    Done @((Start-Snip @($w1)), (Start-Snip @($w1)))
    $null = Wait-Session { param($x) (OpenAt $x $w1).Count -ge 1 } 6000
    Start-Sleep -Milliseconds 1500
    $s = Read-Session
    Expect ((OpenAt $s $w1).Count -eq 1) "O1 new note twice: one tab on w1.md ($((OpenAt $s $w1).Count))"
    $dots = Join-Path $notes 'sub\..\hertest-een.md'
    Done @(Start-Snip @($dots))
    $null = Wait-Session { param($x) $x.activeTabId -eq $h } 5000
    Start-Sleep -Milliseconds 1200
    $s = Read-Session
    Expect ($s -and $s.activeTabId -eq $h -and (OpenAt $s $hertest).Count -eq 1 -and @(@($s.tabs) | Where-Object { "$($_.filePath)" -like '*..*' }).Count -eq 0) "O2 $dots : the open tab became active, still one tab ($((OpenAt $s $hertest).Count)), no path with .. in the session"
    Expect (@(Get-Process snip-md -ErrorAction SilentlyContinue).Count -eq 1) 'one snip-md process left'
  }

  Block 'K1' 'restart brings the same tabs back; no gone or closed note is written' @() {
    $s = Save-Note 'vier' 'u4.md'
    if (-not $s -or $null -eq (Read-Note $u4)) { throw 'could not create u4.md through the bar' }
    if (-not (Remove-AndWaitGone $u4)) { throw 'u4.md tab did not turn dirty after the delete' }
    # Closed with its unwritten text, so a closed entry with a path crosses the restart.
    Select-Tab $u4
    Keys '^w' 300
    if (-not (Wait-Session { param($x) $c = ClosedAt $x $u4; $c.Count -eq 1 -and $c[0].tab.dirty -eq $true } 4000)) { throw 'u4.md did not become a dirty closed entry' }
    $u1Before = Read-Note $u1; $u3Before = Read-Note $u3
    $tag = { param($t) $(if ($t.filePath) { Norm $t.filePath } else { $t.title }) + $(if ($t.dirty) { ' (dirty)' } else { '' }) }
    $key = { param($x) ((@($x.tabs) | ForEach-Object { & $tag $_ }) -join ' | ') + ' || closed: ' + ((@($x.closedTabs) | ForEach-Object { & $tag $_.tab }) -join ' | ') }
    $how = Stop-App
    Note "close: $how"
    Expect ($how -eq 'closed') 'the window closed within 10 s'
    $before = & $key (Read-Session)
    $closedWrite = Session-Time
    Start-App
    # The restarted app writes the session once its restore is done; until then the file is the old one.
    $fresh = Wait-Session { param($x) (Session-Time) -gt $closedWrite } 8000
    Note "tabs before: $before"
    if ($fresh) {
      $after = & $key $fresh
      Note "tabs after:  $after"
      Expect ($before -eq $after) 'the restarted app wrote the same tabs and closed entries, in the same order, with the same dirty flags'
    } else {
      Expect $false 'session.json not rewritten after restart'
    }
    for ($i = 0; $i -lt 3; $i++) { Blur-Snip }
    # Ctrl+Shift+T until the closed list is empty: no reopened tab may write over a note.
    for ($i = 0; $i -lt 6 -and @((Read-Session).closedTabs).Count -gt 0; $i++) { Keys '^+t' 1200 }
    Blur-Snip
    $s = Read-Session
    Note ("closedTabs left: {0}" -f @($s.closedTabs).Count)
    Expect ((OpenAt $s $u4).Count -eq 1) 'the sweep reopened the closed u4.md tab'
    Expect (-not (Test-Path -LiteralPath $u4)) 'u4.md (gone and closed before the restart) was not written'
    Expect ((Read-Note $u1) -eq $u1Before) "u1.md unchanged: $(Show (Read-Note $u1))"
    Expect ((Read-Note $u3) -eq $u3Before) "u3.md unchanged: $(Show (Read-Note $u3))"
  }
} finally {
  $how = Stop-App
  Write-Host "final close: $how"
  # Only what this script started (its name and start time guard against a reused process id).
  foreach ($id in $script:started) {
    $p = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($p -and $p.ProcessName -eq 'snip-md' -and $p.StartTime -ge $scriptStart) { $p.Kill() }
  }
  foreach ($p in (Foreign)) { Say "left running: snip-md $($p.Id), which this script did not start" }
  Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
}

$fout = @($verdicts | Where-Object { $_ -eq 'FOUT' }).Count
$ok = @($verdicts | Where-Object { $_ -eq 'OK' }).Count
$skipped = @($verdicts | Where-Object { $_ -eq 'SKIPPED' }).Count
Say ''
Say "retest: $ok OK, $fout FOUT, $skipped SKIPPED"
if ($fout -gt 0) { exit 1 }
exit 0
