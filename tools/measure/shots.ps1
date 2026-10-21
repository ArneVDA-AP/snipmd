<#
.SYNOPSIS
  Screenshots of the real SnipMD window on Windows, in light and dark: the empty start, a note with
  a screenshot, read mode, and find and replace. Each run uses its own data folder (SNIPMD_DATA_DIR),
  so the user's session is never touched. SnipMD must not be running.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\measure\shots.ps1 -Exe src-tauri\target\release\snip-md.exe -Out findings\ui\windows
#>
param(
  [string]$Exe = "$env:LOCALAPPDATA\SnipMD\snip-md.exe",
  [string]$Out = 'findings\ui\windows'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Win {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public static uint FgPid() { uint p; GetWindowThreadProcessId(GetForegroundWindow(), out p); return p; }
}
'@
[void][Win]::SetProcessDPIAware()

if (-not (Test-Path $Exe)) { throw "No SnipMD exe at $Exe" }
if (Get-Process snip-md -ErrorAction SilentlyContinue) { throw 'Close SnipMD first.' }
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$root = Join-Path ([IO.Path]::GetTempPath()) ("snipmd-shots-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $root | Out-Null
$shell = New-Object -ComObject WScript.Shell

# A note with a screenshot-like image next to it.
$assets = Join-Path $root 'labo-04.assets'
New-Item -ItemType Directory -Path $assets | Out-Null
$bmp = New-Object System.Drawing.Bitmap 900, 360
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(12, 12, 12))
$font = New-Object System.Drawing.Font 'Consolas', 14
$lines = @('PS C:\Users\student> ipconfig', '', 'Windows IP Configuration', '', 'Ethernet adapter Ethernet:', '',
  '   Autoconfiguration IPv4 Address. . : 169.254.12.7', '   Subnet Mask . . . . . . . . . . . : 255.255.0.0', '   Default Gateway . . . . . . . . . :')
$y = 16
foreach ($l in $lines) { $g.DrawString($l, $font, [System.Drawing.Brushes]::Gainsboro, 18, $y); $y += 30 }
$font.Dispose(); $g.Dispose()
$bmp.Save((Join-Path $assets 'snip-20261020-142211-087-3fa9.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$note = Join-Path $root 'labo-04.md'
$text = @'
# Labo 04: DHCP lokaal B

Client krijgt geen adres. **Stap 1**: kabel en switchpoort gecontroleerd, _link up_.

## ipconfig op de client

![snip](labo-04.assets/snip-20261020-142211-087-3fa9.png)

- APIPA-adres `169.254.12.7`: de DHCP-server antwoordt niet.
- Scope op [de server](https://learn.microsoft.com/windows-server/networking/technologies/dhcp/dhcp-top) staat op *inactive*.

> Na activeren van de scope: adres binnen 2 s.

```powershell
Get-DhcpServerv4Scope | Set-DhcpServerv4Scope -State Active
```
'@
[IO.File]::WriteAllText($note, $text.Replace("`n", "`r`n"))

function Start-Snip([string]$data, [string[]]$files) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo $Exe
  $psi.Arguments = ($files | ForEach-Object { '"' + $_ + '"' }) -join ' '
  $psi.UseShellExecute = $false
  $psi.EnvironmentVariables['SNIPMD_TRACE'] = '1'
  $psi.EnvironmentVariables['SNIPMD_DATA_DIR'] = $data
  $p = [System.Diagnostics.Process]::Start($psi)
  $log = Join-Path $data 'perf.log'
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while (-not ((Test-Path $log) -and (Select-String -Path $log -Pattern '^ready' -Quiet))) {
    if ($sw.ElapsedMilliseconds -gt 20000) { throw 'SnipMD did not report ready' }
    Start-Sleep -Milliseconds 50
  }
  while ($p.MainWindowHandle -eq 0) { Start-Sleep -Milliseconds 50; $p.Refresh() }
  Start-Sleep -Milliseconds 700
  return $p
}

function Focus-Snip($p) {
  for ($i = 0; $i -lt 20; $i++) {
    [void][Win]::SetForegroundWindow($p.MainWindowHandle)
    $null = $shell.AppActivate($p.Id)
    Start-Sleep -Milliseconds 150
    if ([Win]::FgPid() -eq $p.Id) { return $true }
  }
  return $false
}

function Shot($p, [string]$name) {
  $r = New-Object Win+RECT
  [void][Win]::GetWindowRect($p.MainWindowHandle, [ref]$r)
  $w = $r.R - $r.L; $h = $r.B - $r.T
  $img = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($img)
  $g.CopyFromScreen($r.L, $r.T, 0, 0, $img.Size)
  $g.Dispose()
  $file = Join-Path $Out "$name.png"
  $img.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $img.Dispose()
  Write-Host "shot $file ($w x $h)"
}

function Keys($p, [string]$keys) {
  if (-not (Focus-Snip $p)) { Write-Host "no foreground for $keys; skipped"; return $false }
  $shell.SendKeys($keys)
  Start-Sleep -Milliseconds 600
  return $true
}

function Stop-Snip($p) {
  $null = $p.CloseMainWindow()
  if (-not $p.WaitForExit(5000)) { $p.Kill() }
}

$themeKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'
if (-not (Test-Path $themeKey)) { New-Item -Path $themeKey -Force | Out-Null }
$before = (Get-ItemProperty -Path $themeKey -Name AppsUseLightTheme -ErrorAction SilentlyContinue).AppsUseLightTheme

try {
  foreach ($theme in 'light', 'dark') {
    Set-ItemProperty -Path $themeKey -Name AppsUseLightTheme -Value ([int]($theme -eq 'light')) -Type DWord
    Start-Sleep -Milliseconds 500

    $p = Start-Snip (Join-Path $root "empty-$theme") @()
    Shot $p "empty-$theme"
    Stop-Snip $p

    $p = Start-Snip (Join-Path $root "note-$theme") @($note)
    Shot $p "write-$theme"
    if (Keys $p '^e') { Shot $p "read-$theme"; [void](Keys $p '^e') }
    if (Keys $p '^h') { $shell.SendKeys('scope'); Start-Sleep -Milliseconds 400; Shot $p "find-$theme"; $shell.SendKeys('{ESC}') }
    if (Keys $p '^n') { if (Keys $p '^s') { Shot $p "firstsave-$theme"; $shell.SendKeys('{ESC}') } }
    Stop-Snip $p
  }
} finally {
  if ($null -ne $before) { Set-ItemProperty -Path $themeKey -Name AppsUseLightTheme -Value $before -Type DWord }
  else { Remove-ItemProperty -Path $themeKey -Name AppsUseLightTheme -ErrorAction SilentlyContinue }
}
Write-Host "Data and fixtures: $root"
