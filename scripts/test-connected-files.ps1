# Test: koppelt Verkenner een notitie aan haar beeldenmap, zoals bij pagina.htm + pagina_files?
# Uitvoeren in PowerShell op Windows:  powershell -ExecutionPolicy Bypass -File scripts\test-connected-files.ps1
# Verplaatst via de Verkenner-engine (Shell.Application), niet via Move-Item, want alleen de Verkenner kent deze koppeling.

$root = Join-Path $env:TEMP "snipmd-connected-test"
$src  = Join-Path $root "bron"
$dst  = Join-Path $root "doel"
Remove-Item $root -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $src, $dst | Out-Null

# Kandidaten: bestand + map. De htm-paren zijn de controlegroep die zou moeten werken.
$cases = @(
  @{ File = "controle.htm"; Folder = "controle_files" },
  @{ File = "notitie1.md";  Folder = "notitie1_files" },
  @{ File = "notitie2.md";  Folder = "notitie2.files" },
  @{ File = "notitie3.md";  Folder = "notitie3.assets" }
)

foreach ($c in $cases) {
  Set-Content (Join-Path $src $c.File) "# test"
  $f = New-Item -ItemType Directory (Join-Path $src $c.Folder)
  Set-Content (Join-Path $f "snip.png") "x"
}

$shell = New-Object -ComObject Shell.Application
$target = $shell.NameSpace($dst)
foreach ($c in $cases) {
  # 0x14 = geen dialogen, geen bevestiging
  $target.MoveHere((Join-Path $src $c.File), 0x14)
}
Start-Sleep -Seconds 3

foreach ($c in $cases) {
  $moved = Test-Path (Join-Path $dst $c.Folder)
  $status = if ($moved) { "MAP MEEVERHUISD" } else { "map achtergebleven" }
  "{0,-14} + {1,-16} -> {2}" -f $c.File, $c.Folder, $status
}
"`nTestmap: $root  (handmatige test: sleep de bestanden in Verkenner van 'bron' naar 'doel')"
