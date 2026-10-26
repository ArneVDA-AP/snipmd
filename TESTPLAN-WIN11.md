# SnipMD – testplan Windows 11 (26 oktober 2026)

Het plan test de pre-release **SnipMD v1.1.0-3**: Snip, de vier opmerkingen uit de vorige Windows-test (opgelost in 1.1.0-2), installeren over een vorige versie, en wat van de vorige test bleef liggen.

## Wie doet wat
Zoveel mogelijk doet Claude. Elke stap staat in één van vier delen:

| Deel | Wie | Wanneer |
|---|---|---|
| **R** | Runner | Claude start een workflow op GitHub. Er is niemand nodig. |
| **C** | Claude op de pc | Een Claude-sessie met computer use doet en beoordeelt de stap. De tester is bereikbaar voor prompts. |
| **CT** | Claude met de tester | De tester doet één handeling die Claude niet mag of kan doen (een Windows-instelling, een USB-stick). Claude doet de rest en beoordeelt. |
| **T** | Alleen de tester | Claude kan het niet doen of niet beoordelen. De reden staat bij de stap. |

Een stap staat alleen in CT of T als de reden erbij staat. Rapporteer elke ID als **OK**, **FOUT** (met wat er wel gebeurde) of **NIET GETEST** (met de reden).

## R. Runner (al gestart door Claude)
| ID | Wat | Waar |
|---|---|---|
| R1 | Typecheck, unit tests en core tests op `main` en op de tag. | CI op `main`; *Release Windows* run 13 op `v1.1.0-3`. |
| R2 | Bouw van de release op `windows-latest`, installergrootte onder 10 MB. | *Release Windows* run 13: 1,55 MB. |
| R3 | Schone installatie: stil installeren, starten, verwijderen. | *Windows run* op `main` met `snip_sleep`, stap *Clean-install smoke test*. |
| R4 | Budgets uit SPEC §9 (start, plakken, geheugen) als referentie. Een runner is geen laptop. | Zelfde run, `results/windows-ci/`. |
| R5 | Screenshots van het echte venster in licht en donker: leeg, schrijven, lezen, zoeken, eerste opslag, en Snip slapend. | Zelfde run, branch `test/windows-run-<nummer>`. |

De run bouwt `main`. Dat is dezelfde app-code als `v1.1.0-3`, met daarbovenop alleen de dev-dependency-updates (#64, #65) en docs.

## Regels voor de Claude-sessie
- De tester gebruikt SnipMD dagelijks, en zijn sessie bevat zijn eigen tabs:
  - Werk alleen in tabs die je zelf opent, en sluit alleen die.
  - Bewaar testnotities alleen in `Documents\Notes\zz-w11-test\`.
  - Verander niets aan de standaard-app voor `.md`.
- Wijzig geen Windows-instellingen; dat doet de tester in de CT-stappen. Verschijnt er een prompt van SmartScreen, UAC of iets anders, stop dan, schrijf de tekst letterlijk over en vraag de tester.
- Maak na elke stap een screenshot. Bewaar ze als `<ID>.png` in `Desktop\snipmd-w11-test\`. Snip is 22 px hoog: knip voor elke S-stap ook een uitsnede rond Snip en vergroot die 8× (naaste buur, niet vervaagd).
- Wacht na een actie die laadt (leesmodus, een codeblok) 2 seconden voor je beoordeelt.
- Snip speelt alleen in een venster met focus. Zet SnipMD vooraan voor je een animatie beoordeelt.
- Iets onverwachts? Noteer het, maak een screenshot, en ga verder. Herstart SnipMD alleen als de tester dat goedkeurt.

## 0. Gegevens (C)
Noteer: de Windows-versie en build, de schermschaal per scherm, het toetsenbord (AZERTY of QWERTY), muis of touchpad, het thema, en de SnipMD-versie die nu geïnstalleerd is.

## I. Installeren over de vorige versie (C)
| ID | Doe | Verwacht |
|---|---|---|
| I1 | Kopieer `%APPDATA%\com.snipmd.desktop\` naar `Desktop\snipmd-backup-20261026\`. Vergelijk het aantal bestanden en bytes. | Er is een volledige backup. |
| I2 | Laat SnipMD open met de tabs van de tester. Download van https://github.com/ArneVDA-AP/snipmd/releases de pre-release **SnipMD v1.1.0-3** (niet *Latest*), bestand `SnipMD_1.1.0-3_x64-setup.exe`, en start het. | De setup vraagt SnipMD te sluiten. Er komt geen melding over een oudere of nieuwere versie. SmartScreen kan waarschuwen: vraag de tester. De installatie lukt zonder UAC-prompt. |
| I3 | Instellingen → Apps → Geïnstalleerde apps, zoek `SnipMD`. | Eén SnipMD, versie 1.1.0-3. |
| I4 | Start SnipMD via de snelkoppeling. | De tabs van de tester komen terug. Rechts van de `+`-knop staat Snip. |

## S. Snip (C)
Werk in een testtab (Ctrl+T).

| ID | Doe | Verwacht |
|---|---|---|
| S1 | Bekijk Snip 10 seconden, met SnipMD vooraan. Maak drie uitsneden. | Een paarse krab met limoengroene scharen op de schouders, twee grote ogen op het lijf en pootjes naar buiten. Hij ademt (de scharen gaan even omhoog) en knippert. Scherp: geen vage randen. |
| S2 | `Win+Shift+S`, knip een stuk scherm, `Ctrl+V` in de testtab. | Het beeld verschijnt. Snip klapt: de scharen gaan een paar keer naar elkaar toe, daarna wordt hij weer gewoon. |
| S3 | Sluit de testtab (Ctrl+W), druk `Ctrl+Shift+T`. | De tab komt terug. Snip is even opgelucht: de ogen dicht, de scharen omlaag. |
| S4 | Bewaar de testtab als `zz-w11-test\snip` (via *Other folder…* als dat nodig is). Verplaats `snip.md` in Verkenner naar de Prullenbak. Ga terug naar SnipMD en wacht 3 seconden. | De balk zegt "snip is no longer on disk." met *Save again*. Snip kijkt ongerust (een grimas, trillende scharen) en stopt daarmee na ongeveer 4 seconden; de balk blijft. Klik *Save again*: het bestand staat er weer. (Een wijziging in Kladblok geeft geen keuze: SnipMD bewaart 1 seconde na het typen en bij het wisselen van venster, dus de tab heeft dan geen onbewaarde wijzigingen.) |
| S5 | `Ctrl+Shift+P`, typ `snip`, Enter op *Show Snip*. Esc. Daarna nog eens. | Snip verdwijnt, en komt terug. |
| S6 | Bewaar niets gedurende 10 minuten. Zet SnipMD vooraan. Druk daarna `Ctrl+S` in de testtab. | Na 10 minuten slaapt Snip: liggend, ogen dicht, met een Z erboven. Na het bewaren is hij wakker. |
| S7 | Vergelijk je uitsneden met de screenshots `snip-sleep-light` en `snip-sleep-dark` uit R5. | Dezelfde tekening. |

## H. Hertest van de vier opmerkingen (C)
| ID | Doe | Verwacht |
|---|---|---|
| H1 | Nieuwe testtab, typ iets, `Ctrl+S`. Typ in het naamveld achtereenvolgens `zz-w11-test\taken`, `a:b`, en de naam van een notitie die al in `Documents\Notes` bestaat. Esc. | Bij elke naam is *Save* uit en zegt de balk waarom: een map in de naam (gebruik *Other folder…*), een teken dat een bestandsnaam niet kan bevatten, een naam die al bestaat. |
| H2 | Codeblokken ```` ```js ```` met `const x = 1;` en ```` ```powershell ```` met `Get-Item .`. | Geen rode golflijn onder `js`, `powershell` of de code. |
| H3 | Vergelijk het powershell-blok in schrijfmodus en in leesmodus (Ctrl+E). | De code heeft in beide de gewone tekstkleur, niet oranje in schrijfmodus. |

## K. Kern (C)
De stappen uit `docs/releasing.md` → *Smoke test of an installer* die R3 niet dekt.

| ID | Doe | Verwacht |
|---|---|---|
| K1 | Dubbelklik een `.md` in `Documents\Notes\zz-w11-test\` in Verkenner. Is SnipMD niet de standaard-app, gebruik dan *Openen met → SnipMD*. | De notitie opent als tab in het lopende venster. |
| K2 | Download `tools/fixtures/evil.md` van de repo naar `zz-w11-test\` en open het. Ctrl+E. | Er draait niets, er laadt geen beeld van buiten de map van de notitie, en een klik op een link opent de browser, nooit het app-venster. |
| K3 | Sluit SnipMD (met toestemming) en start opnieuw. | De tabs, ook de testtabs, komen terug. |

## CT. Claude met de tester
| ID | De tester doet | Claude doet en verwacht | Waarom de tester |
|---|---|---|---|
| CT1 | Zet Windows op licht thema, en later terug op donker. | Screenshot van het menu, een codeblok met *Copy* en Snip in beide thema's. Alles is gestijld en leesbaar; Snip heeft in licht witte ogen met een donkere pupil, in donker donkere ogen met een witte glans. | Claude wijzigt geen Windows-instellingen. Was C2 in de vorige test. |
| CT2 | Zet de schermschaal achtereenvolgens op 125, 150 en 200%. | Na elke stap een uitsnede rond Snip, 8× vergroot: elke cel even groot, geen vage of halve pixels. | Instelling. |
| CT3 | Zet de schermschaal zo dat het venster bij de eerste start verkleind moet worden, en start SnipMD. | Het venster valt volledig binnen het scherm. | Instelling. Was E3. |
| CT4 | Steek een USB-stick in. Trek hem uit wanneer Claude dat vraagt, en steek hem terug wanneer Claude dat vraagt. | Claude bewaart een testnotitie op de stick en typt verder; na het uittrekken typt hij nog wat. Een foutbalk meldt dat het schrijven mislukte, de tab blijft onbewaard, de tekst blijft staan, en andere tabs werken door. Na het terugsteken lukt bewaren weer. | Fysieke handeling. Was E2. |

## T. Alleen de tester
| ID | Doe | Verwacht | Waarom niet Claude |
|---|---|---|---|
| T1 | `Ctrl+Shift+P`, houd Enter 2 seconden ingedrukt op een toggle. | De toggle verandert één keer. | Computer use kan geen toets vasthouden (vorige test, B4). |
| T2 | Alleen met een AZERTY-toetsenbord: `Ctrl+1` en `Ctrl+2` (de toetsen `&` en `é`). | Tab 1 en tab 2. | Claude stuurt geen fysieke toetsen van een andere layout. Zonder AZERTY: NIET GETEST. |
| T3 | Werk een dag gewoon met SnipMD. | Snip stoort niet en leest als een krab. Noteer wat opvalt. | Een oordeel over gevoel. |

## Rapport
Claude schrijft één bestand `findings/windows/w11-20261026.md` op de branch `test/w11-20261026`, of geeft het aan de tester als de sessie niet kan pushen:
1. de gegevens uit stap 0;
2. een tabel `| ID | OK/FOUT/NIET GETEST | wat je zag | screenshot |` voor I, S, H, K en CT;
3. per FOUT: de stappen, wat je verwachtte, wat er gebeurde;
4. prompts letterlijk;
5. wat opviel.

De tester vult T1 tot T3 aan in hetzelfde bestand. Laat de backup uit I1 staan tot de tester zegt dat hij weg mag.
