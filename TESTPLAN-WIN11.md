# SnipMD – testplan Windows 11 (31 oktober 2026): hertest voor 1.1.0

Dit plan test de release-kandidaat **SnipMD 1.1.0** (PR `claude/release-1.1.0`) vóór de tag. Na de test van `v1.1.0-4` (`TESTPLAN-WIN11.md` op `test/w11-20261027`) veranderde er code op één plek: opslaan (#79, PR #96). *Save again* bij een verwijderde notitie schrijft niet meer over een nieuwere notitie op hetzelfde pad. Ook kan een notitie niet meer bewaard worden op een pad dat al in een andere tab open staat. Dit plan hertest daarom opslaan en de balk van een gesloten tab. Al de rest dekt het plan van 27 oktober.

## Wie doet wat
Zelfde indeling als op 27 oktober:

| Deel | Wie | Wanneer |
|---|---|---|
| **R** | Runner | Claude start een workflow op GitHub. Er is niemand nodig. |
| **C** | Claude op de pc | Een Claude-sessie met computer use doet en beoordeelt de stap. De tester is bereikbaar voor prompts. |
| **CT** | Claude met de tester | De tester doet één handeling die Claude niet mag of kan doen. Claude doet de rest en beoordeelt. |
| **T** | Alleen de tester | Claude kan het niet doen of niet beoordelen. De reden staat bij de stap. |

Rapporteer elke ID als **OK**, **FOUT** (met wat er wel gebeurde) of **NIET GETEST** (met de reden).

## R. Runner (al gestart door Claude)
| ID | Wat | Waar |
|---|---|---|
| R1 | Typecheck, unit tests en core tests; bouw op `windows-latest`; installer onder 10 MB. | *Release Windows*, handmatige run op `claude/release-1.1.0` (alleen `build`, niets gepubliceerd). Het artifact bevat de setup. |
| R2 | Schone installatie: stil installeren, starten, verwijderen; screenshots van het echte venster. | *Windows run* op `claude/release-1.1.0`. |

De PR van de kandidaat noemt het runnummer en de commit van de build die getest wordt. Test alleen die build.

## Regels voor de Claude-sessie
Dezelfde regels als op 27 oktober:
- Werk alleen in tabs die je zelf opent, en sluit alleen die.
- Bewaar testnotities alleen in `Documents\Notes\zz-w11-test\`.
- Start de setup en SnipMD altijd via Verkenner of het Startmenu, nooit vanuit de shell van de Claude-sessie.
- Wijzig geen Windows-instellingen. Verschijnt er een prompt van SmartScreen, UAC of iets anders, stop dan, schrijf de tekst letterlijk over en vraag de tester.
- Maak na elke stap een screenshot. Bewaar ze als `<ID>.png` in `Desktop\snipmd-w11-test\20261031\`.
- Schrijf elke balktekst letterlijk over.

## 0. Gegevens (C)
Noteer de Windows-versie en build, de schermschaal, en de SnipMD-versie die nu geïnstalleerd is.

## I. Installeren (CT)
| ID | De tester doet | Claude doet en verwacht | Waarom de tester |
|---|---|---|---|
| I1 | – | Kopieer `%APPDATA%\com.snipmd.desktop\` naar `Desktop\snipmd-backup-20261031\`. Vergelijk het aantal bestanden en bytes. | – (Claude) |
| I2 | Download het artifact van de run uit R1 (GitHub, ingelogd) en pak het uit in `Downloads\snipmd-1.1.0-rc\`. | Laat SnipMD open met de tabs van de tester. Start `SnipMD_1.1.0_x64-setup.exe` met een dubbelklik in Verkenner. Kies op *Already Installed* **Do not uninstall**. De installatie lukt zonder UAC-prompt. Schrijf elke pagina en prompt letterlijk over. | Een artifact downloaden vraagt een GitHub-login. |
| I3 | – | Instellingen → Apps: één SnipMD, versie 1.1.0. Start SnipMD via het Startmenu: de tabs van de tester komen terug. | – (Claude) |

## S. Opslaan (C)
| ID | Doe | Verwacht |
|---|---|---|
| S1 | Nieuwe tab (`Ctrl+T`), typ `# Hertest een`, `Ctrl+S`. Kies de map `zz-w11-test` in de balk, Enter. | `zz-w11-test\hertest-een.md` bestaat. De tabtitel is `hertest-een.md`. |
| S2 | Typ een regel in `hertest-een.md`, wacht 2 s. Open het bestand in Kladblok, sluit Kladblok. | De nieuwe regel staat in het bestand. |
| S3 | Plak een knipsel (`Win+Shift+S`, `Ctrl+V`) in `hertest-een.md`. `Ctrl+Shift+S`, bewaar als `zz-w11-test\hertest-twee.md`. | `hertest-twee.assets\` bestaat met het beeld; `hertest-een.md` en `hertest-een.assets\` staan er nog. De tab heet `hertest-twee.md` en toont het beeld. |
| S4 | Nieuwe tab, typ `oud`. `Ctrl+S`, klik *Other folder…*, bewaar als `zz-w11-test\u1.md`. Verplaats `u1.md` in Verkenner naar de Prullenbak. Ga terug naar SnipMD. | Een balk: `u1.md is no longer on disk.` met *Save again*. De tab houdt `oud`. |
| S5 | Laat die tab open. Nieuwe tab, typ `nieuw`. `Ctrl+S`, *Other folder…*, kies `zz-w11-test\u1.md`. | Een foutbalk: `Could not save Untitled-…: u1.md is open in another tab` (letterlijk overschrijven). `u1.md` bestaat niet in Verkenner. De nieuwe tab blijft `Untitled-…` met `nieuw`. |
| S6 | Zet `u1.md` terug uit de Prullenbak (rechtsklik → Terugzetten). Open het in Kladblok en verander `oud` in `van buiten`, bewaar, sluit Kladblok. Klik in SnipMD in de balk van `u1.md` op *Save again*. | `u1.md` blijft `van buiten` (controleer in Kladblok). Een balk: `u1.md was changed outside SnipMD and you have changes too.` met *Open disk version · Reload · Keep mine*. |
| S7 | Klik *Open disk version*, daarna *Keep mine*. | Een leestab `u1.md (disk)` met `van buiten` naast de tab. Na *Keep mine* staat `oud` in `u1.md` (Kladblok) en de balk is weg. |

## G. Gesloten tab (C)
| ID | Doe | Verwacht |
|---|---|---|
| G1 | Sluit `hertest-twee.md` met `Ctrl+W`. | Onderaan: `hertest-twee.md closed, with 1 screenshot.` met *Restore* en de toets `Ctrl+Shift+T`. De balk gaat na ongeveer 8 s weg. |
| G2 | `Ctrl+Shift+T`. | `hertest-twee.md` komt terug met het beeld en de cursor waar hij stond. |
| G3 | Verplaats `u1.md` weer naar de Prullenbak, ga terug naar SnipMD (balk *no longer on disk*). Typ `nog oud` in de tab. Sluit hem met `Ctrl+W`. | De onderste balk `u1.md closed.` en een blijvende waarschuwing `u1.md was closed with changes that are not on disk.` met *Restore*. |
| G4 | Nieuwe tab, typ `nieuw`. `Ctrl+S`, *Other folder…*, bewaar als `zz-w11-test\u1.md`. | Dat lukt nu (de oude tab is dicht). `u1.md` bevat `nieuw`. |
| G5 | Klik *Restore* in de waarschuwing van G3. | Geen tweede tab op `u1.md`: de tab met `nieuw` wordt actief, en ernaast opent een leestab `u1.md (closed)` met `nog oud`. `u1.md` bevat nog altijd `nieuw`. |
| K1 | Sluit SnipMD (met toestemming van de tester) en start het opnieuw via het Startmenu. Druk `Ctrl+Shift+T` tot er niets meer terugkomt. | De tabs komen terug. Geen gesloten tab schrijft over `u1.md`: dat bevat nog `nieuw`. |

## Rapport
Claude schrijft één bestand `findings/windows/w11-20261031.md` op de branch `test/w11-20261031`, of geeft het aan de tester als de sessie niet kan pushen:
1. de gegevens uit stap 0 en de getest build (runnummer en commit);
2. een tabel `| ID | OK/FOUT/NIET GETEST | wat je zag | screenshot |` voor R, I, S, G en K1;
3. per FOUT: de stappen, wat je verwachtte en wat er gebeurde;
4. prompts en balkteksten letterlijk;
5. wat opviel.

Laat de backup uit I1 staan tot de tester zegt dat hij weg mag. Sluit op het einde de testtabs en laat de notities in `zz-w11-test\` staan.
