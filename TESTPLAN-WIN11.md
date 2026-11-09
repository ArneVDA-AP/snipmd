# SnipMD: testplan Windows 11 voor de definitieve 1.1.0-kandidaat (2026-11-09)

Dit plan vervangt het plan van 27 oktober (v1.1.0-4) en dat van 31 oktober (kandidaat 1a3e086). Geen van beide is ooit uitgevoerd, en het tweede leunde op het eerste. Je test de *Release Windows*-artifact van de definitieve kop van PR #100, nadat de fix-PR's zijn gemerged, op je eigen pc.

| Build onder test | Waarde |
|---|---|
| *Release Windows* run | `42549469763` |
| Commit (code) | `6e62404`; de branch eindigt op `2426ed9`, dat alleen docs wijzigt |
| Artifact | `SnipMD-windows-x64`, met `SnipMD_1.1.0_x64-setup.exe` |

Test alleen de build die de PR noemt (P31:23). Krijgt de PR nog een commit met code, dan vervangen een nieuwe run en commit deze waarden en begint I1b opnieuw.

Volgorde: R, 0, I, W/N, CT, T1 (mag tijdens de wachttijd van CT5b of los), B, K1, Rapport; T3 loopt vanaf K1. Het blok "S/G/O" hoort erbij zolang `<RUN2>` leeg is. "Na de release" volgt pas na de tag en de publicatie.

## Wie doet wat
Zoveel mogelijk doe jij met je eigen hand; Claude controleert daarna offscreen.

| Code | Wie | Wat |
|---|---|---|
| **E** | Jij | Jij doet de handeling: dubbelklikken, een Windows-instelling, een USB-stick, een toets, een oordeel. |
| **C-off** | Claude, offscreen | Claude opent geen venster en wijzigt niets aan Windows. Claude leest bestanden, `session.json`, de FileVersion van de exe en de uitvoer van `gh`. Claude voert elk commando uit in PowerShell, niet in bash. |
| **C-cu** | Claude met computer use | Claude bedient of filmt jouw scherm. **Alleen met jouw go-ahead voor dat blok**, gevraagd aan het begin van het blok, nooit eenmalig voor het hele plan. Een opnamelus van het scherm telt ook als C-cu. |

- De blokken met C-cu zijn: **W/N**, **CT1 en CT2**, **CT5** en **S/G/O**. Claude vraagt aan het begin van elk blok: "Mag ik in dit blok (naam) je scherm opnemen en in SnipMD klikken en typen?"
- Zonder go-ahead voor een blok doe jij die handelingen zelf en beoordeel je met het oog; de stap meldt dan "zonder opname". De C-cu-minuten van dat blok komen dan bij E erbij.
- Computer use kan in Verkenner alleen klikken (rapport 26 okt, opmerking 4). Alles in Verkenner (dubbelklik, naar de Prullenbak, terugzetten) doe jij.

## Regels
1. Jij gebruikt SnipMD elke dag en de sessie bevat je tabs: werk alleen in tabs die je zelf opent, en sluit alleen die. Bewaar testnotities alleen in `Documents\Notes\zz-w11-test\`. Verander niets aan de standaard-app voor `.md`.
2. **Start de setup en SnipMD alleen via Verkenner of het Startmenu, of vanuit je eigen PowerShell waar dit plan dat voorschrijft, nooit vanuit de shell van de Claude-sessie.** Op 26 oktober leidde Windows een setup uit die shell om naar het pakket van de Claude-app (P27:35; rapport 26 okt, opmerking 1).
3. Claude wijzigt geen Windows-instellingen; dat doe jij in de CT-stappen. Verschijnt er een prompt van SmartScreen, UAC of iets anders, dan stopt Claude, schrijft de tekst letterlijk over en vraagt jou.
4. Vink bij het verwijderen van SnipMD nooit *Delete the application data* aan en verwijder nooit `%APPDATA%\com.snipmd.desktop\`.
5. Het klembord wordt overschreven: door elke `Win+Shift+S` en door `measure.ps1` (blok B). Zet niets op het klembord dat je wilt bewaren.
6. Snip speelt alleen in een venster met focus. Zet SnipMD vooraan voor je een beweging beoordeelt en houd het daar tot de beweging klaar is.
7. **Bewegingen vastleggen (C-cu, met go-ahead).** Snip is 22 px hoog en een wandeling duurt hoogstens 1,4 s. Claude neemt een reeks beelden van de tabbalk, ongeveer om de 50 ms. Claude begint vóór de handeling en stopt als Snip weer thuis staat. Claude bewaart `<ID>-<nnn>.png`, vergroot uitsneden rond Snip 8× (naaste buur, niet vervaagd) en berekent tijden uit de tijdstempels. De nauwkeurigheid is één beeldinterval (P27:38).
8. Claude maakt na elke stap een screenshot als `<ID>.png` in `Desktop\snipmd-w11-test\20261109\` (P27:39). Van de pagina's van een setup maak jij met `Win+PrtSc` een screenshot (gewone Windows-sneltoets); Claude leest ze in `Pictures\Screenshots`.
9. Claude schrijft balktekst en prompts letterlijk over. Iets onverwachts: noteer het, maak een screenshot en ga verder. Herstart SnipMD alleen als jij dat goedkeurt.
10. Rapporteer elke ID als **OK**, **FOUT** (met wat er wel gebeurde) of **NIET GETEST** (met de reden). Tijdens de test verandert niemand iets aan de code of de build; een FOUT wordt alleen gemeld.
11. Een registerwaarde die Claude via een shell leest, telt niet: op 2026-11-09 zag die sessie 1.1.0-3 in het register terwijl de exe 1.1.0-4 is, vermoedelijk door virtualisatie van het register voor die shell. Voor de geïnstalleerde versie tellen alleen de exe op schijf en wat jij leest in Instellingen → Apps.

## Begrippen
- **Thuis**: Snips vaste plek, rechts van de `+`-knop.
- **Moment**: een beeld komt in een notitie (plakken of slepen), een gesloten tab komt terug, of een notitie met onbewaarde wijzigingen veranderde buiten SnipMD. Typen is nooit een moment.
- **Plek op een tab**: net links van het sluitkruisje (×) van die tab. Het kruisje blijft vrij.

Minuten staan in de kolom *Min* als `E n`, `C-off n` of `C-cu n`. Het zijn schattingen. C-cu-minuten lopen naast de E-minuten van dezelfde stap. Bestaat een stap uit meer handelingen, dan staan ze genummerd (1), (2) in de kolom *Doe*, in de volgorde waarin ze gebeuren.

## R. Runs op de kandidaat
De runners hebben op `6e62404` al gedraaid. Claude leest de uitkomst (C-off); jij hoeft niets te doen.

| ID | Wie | Doe | Verwacht | Min | Bron |
|---|---|---|---|---|---|
| R-A | C-off | Lees *Release Windows* run `42549469763`: `gh run view 42549469763 --json headSha,conclusion`. | De kop begint met `6e62404` en de run is geslaagd. Dit vervangt R1 en R2 van P27 (typecheck, tests, bouw, installer onder 10 MB). | C-off 2 | P27:22-23; P31:20 |
| R-B | C-off | Lees *Windows run* `42549472467` op `6e62404`, gestart met `snip_sleep` aan: de smoke- en screenshotstappen hebben `continue-on-error`, dus de groene status van de run bewijst niets. Het bewijs is `install-smoke.txt` met "SMOKE TEST PASSED" en `shots.txt` met 12 shots, beide op de branch `test/windows-run-18`. Claude leest ook de budgets in `results/windows-ci/` (alleen als referentie, een runner is geen laptop) en de screenshots van het echte venster in licht en donker, ook Snip slapend. Resultaat: `geslaagd (run 18 op 6e62404): 12 screenshots, ook snip-sleep licht en donker; clean-install smoke PASSED; runnerbudgets als referentie: plakken 103 ms, geheugen 91,6 MB, installer 1,48 MB, pagina tot klaar 193 ms`. | `install-smoke.txt` bevat "SMOKE TEST PASSED" en `shots.txt` telt 12 shots. `ui/snip-sleep-light.png` en `ui/snip-sleep-dark.png` verschillen van elkaar. Dit vervangt R3 tot R5 van P27. | C-off 3 | P27:24-26; P31:21; rapport 26 okt R5 |
| R-C | C-off | Lees de tweede *Windows run* met het hertestscript voor S, G, O1 en K1f: `<RUN2>` op `<SHA2>`. | Elke rij S1 tot K1f van het blok "S/G/O" staat in de uitvoer als geslaagd, of Claude noteert welke rij ontbreekt. Dit telt alleen als `<SHA2>` dezelfde app-code heeft als `6e62404`: `git diff --stat 6e62404 <SHA2> -- src src-tauri` toont niets (alleen tools, workflow en docs mogen verschillen). Zolang `<RUN2>` leeg is, doe jij het hele blok "S/G/O". | C-off 2 | P31:44-64 |

## 0. Gegevens
| ID | Wie | Doe | Verwacht | Min | Bron |
|---|---|---|---|---|---|
| 0 | C-off, E | (1) Claude noteert: Windows-versie en build, schermschaal per scherm, toetsenbord, muis of touchpad, thema, de stand van *Animatie-effecten*, de FileVersion van `%LOCALAPPDATA%\SnipMD\snip-md.exe`, en of SnipMD draait. (2) Jij leest de versie in Instellingen → Apps → Geïnstalleerde apps (zoek `SnipMD`). | Gemeten op 2026-11-09: de exe is 1.1.0-4 (geschreven 2026-10-27 01:43) en het draaiende proces is die exe, gestart 2026-11-08 21:13. Schaal 100 % op 3440×1440 (tweede scherm 1440×2560 staand), donker thema, US-International QWERTY, geen AZERTY. Instellingen → Apps hoort 1.1.0-4 te tonen. Elke afwijking noteren. | C-off 3 · E 1 | P27:48; P31:35; meting op de pc 2026-11-09; rapport 26 okt, gegevens |

## I. Installeren
De setup toont bij elke update de pagina *Already Installed*. De route is 1.1.0-4 rechtstreeks naar de kandidaat, met *Do not uninstall*.

| ID | Wie | Doe | Verwacht | Min | Bron |
|---|---|---|---|---|---|
| I1 | C-off | Back-up: `robocopy "$env:APPDATA\com.snipmd.desktop" "$env:USERPROFILE\Desktop\snipmd-backup-20261109" /E`. Claude vergelijkt aantal bestanden en bytes en bewaart `session.json` apart als `Desktop\snipmd-session-voor-20261109.json`. | Een volledige back-up: bestandsaantal en bytes gelijk aan beide kanten (26 okt: 60 bestanden en 2 850 700 bytes, alleen ter vergelijking). | C-off 3 | P27:55; P31:40 |
| I1b | C-off | De setup staat al gedownload. Claude controleert `C:\Users\Admin\Downloads\snipmd-1.1.0-rc\SnipMD_1.1.0_x64-setup.exe`: grootte, `Get-FileHash` en FileVersion. | Het bestand bestaat, is 1 551 498 bytes groot, heeft SHA256 `f3e1e50669e1da16e65a9eed721494785f4af6537df28fb085e2d80d8cd87ebe` en de FileVersion 1.1.0. Dit is de setup van run `42549469763`. | C-off 1 | P31:41 |
| I2 | E, C-off | (1) Laat SnipMD open met je tabs. (2) Start de setup met een dubbelklik in Verkenner en klik *Next*. (3) Kies op *Already Installed* **Do not uninstall**. (4) Vink op de laatste pagina de startoptie uit. (5) Maak van elke pagina een screenshot (`Win+PrtSc`). (6) Claude schrijft elke pagina en prompt letterlijk over uit de screenshots. | De setup vraagt SnipMD te sluiten, of sluit het. De installatie lukt zonder UAC-prompt. SmartScreen kan waarschuwen: Claude vraagt jou. De pagina *Already Installed* leest (26 okt): "An older version of SnipMD is installed on your system. It's recommended that you uninstall the current version before installing. Select the operation you want to perform and click Next to continue." met *Uninstall before installing* (standaard) en *Do not uninstall*. Verschijnt "SnipMD is running! Click OK to kill it", dan kies je: OK sluit SnipMD hard, zonder normale afsluiting (26 okt); de andere keuze is SnipMD zelf sluiten met het kruisje. | E 4 · C-off 1 | P27:56; P31:41; rapport 26 okt I2 en prompts |
| I3 | E, C-off | (1) Open Instellingen → Apps → Geïnstalleerde apps en zoek `SnipMD`. (2) Claude leest de FileVersion en `ProductVersion` van `%LOCALAPPDATA%\SnipMD\snip-md.exe` en kijkt of er niets nieuws staat onder `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Local\SnipMD`. | Eén SnipMD, versie 1.1.0, in de exe en in Instellingen. Niets in de pakketmap van de Claude-app. | E 1 · C-off 1 | P27:57; P31:42; rapport 26 okt, opmerking 1 |
| I4 | E, C-off | (1) Start SnipMD via het Startmenu. (2) Claude vergelijkt tab-id's en het aantal tabs in `session.json` met de kopie uit I1. (3) Jij zegt of Snip rechts van `+` staat en scherp is. | Je tabs komen terug. Snip staat thuis. | E 2 · C-off 1 | P27:58; P31:42 |

## W/N. Snip in het echte venster (kort)
Snips wandeling, dutje en vriendje (W1 tot W9 zonder W4, en N1 tot N3) worden headless gemeten op de demo en op de screenshots van de runner, behalve W4: dat is alleen een echt-venster-rij. In je eigen venster volgen alleen W1 en W4 één keer en het dutje met vriendje (N1, N2) één keer, omdat de rendering van WebView2, je schermschaal en je thema alleen daar bestaan. **Claude vraagt hier de go-ahead voor blok W/N.**

**Headless gedekt (HL).** Gemeten in Chromium op de demo-pagina (1280×720, 100 Hz). Op 2026-11-09 is Snips dutje opnieuw gemeten op de code van `6e62404`, met de fixes uit PR #105: de twee defecten uit de eerdere meting (een tweede bewaring terwijl het vriendje binnenloopt, en een dutje tijdens een moment bij een tab) zijn gefixt en headless bevestigd; W1, N1, N2, N3 en CT5 gaven OK. In die meting loopt Snip eerst naar huis en begint het dutje 420 ms na aankomst. Je hoeft W3, W5, W6, W7, W9 en N3 niet te doen; CT1 en CT5 staan als optioneel in blok CT. W1, W4, N1 en N2 blijven echt-venster-checks: W1 en W4 om de rendering in WebView2 te zien, N1 en N2 omdat alleen daar de echte 10-minutentimer en een echte bewaring bestaan.

| ID | Stand | Headless-meting | Regel |
|---|---|---|---|
| W3 | headless OK | OK (headless 2026-11-09 op de gefixte code, gelijk aan 26 okt) | Gesloten tab terughalen: Snip loopt, is opgelucht en loopt terug (P27:67). Alleen als er tijd is. |
| W5 | headless OK | OK (headless 26 okt op 1a3e086: een tweede moment 400 ms in een wandeling gaat zonder sprong door vanaf de bereikte cel; hertest op de gefixte code loopt: OK op 2026-11-09, zelfde gedrag, geen tweede wandeling naar huis) | Twee momenten kort na elkaar: Snip loopt vanaf waar hij staat naar de andere tab, zonder eerst naar huis (P27:69). Alleen als er tijd is. |
| W6 | headless OK | OK (headless 2026-11-09 op de gefixte code, gelijk aan 26 okt) | Tab buiten beeld: Snip loopt niet (P27:70). Alleen als er tijd is. |
| W7 | headless OK | OK (headless 2026-11-09 op de gefixte code, gelijk aan 26 okt) | Typen is geen moment: Snip blijft thuis (P27:71). Alleen als er tijd is. |
| W8 | headless OK | OK (headless 2026-11-09, 3 blikken in 2 min) | 2 minuten stil: 2 tot 6 blikken naar rechts, 20 tot 45 s uit elkaar (P27:72). |
| W9 | headless OK | OK (headless 2026-11-09 op de gefixte code, gelijk aan 26 okt) | Show Snip uit en aan (P27:73). Alleen als er tijd is. |
| N3 | headless OK | 2026-11-09, code 6e62404 | Bewaren en direct plakken terwijl het vriendje er is (P27:80). Alleen als er tijd is. |

| ID | Wie | Doe | Verwacht | Min | Bron |
|---|---|---|---|---|---|
| W0 | C-off, E | (1) Claude maakt `w1.md`, `w2.md` en `w3.md` met elk één regel tekst in `Documents\Notes\zz-w11-test\`. (2) Jij opent ze in die volgorde met een dubbelklik in Verkenner en sleept daarna `w1` met de muis vooraan in de rij, zodat `w1` ver van Snip staat en `w3` er het dichtst bij. Alle tabs zijn schoon (alles bewaard). | Drie testtabs, `w1` vooraan, `w3` naast Snip. Geen tab van jou is gewijzigd. | C-off 2 · E 4 | P27:61 |
| W1 | E, C-cu | (1) `w1` is actief. (2) Knip een stuk scherm (`Win+Shift+S`) en plak met `Ctrl+V`. (3) Claude neemt de tabbalk op (regel 7) en meet elke richting. | Het beeld verschijnt. Snip loopt zijwaarts naar `w1`, kijkt in de looprichting en is traag bij vertrek en stop. Elke verplaatsing is een heel aantal cellen (bij 100 % is een cel 2 CSS px): geen halve cellen, geen vage randen. **Elke richting duurt hoogstens 1,4 s** (met één beeldinterval marge, ongeveer 50 ms): de code kapt elke wandeling af op 1,4 s (`WALK_MAX_MS`) met 40 cellen per seconde. Een wandeling naar de verste tab slaat daardoor cellen over per beeld; dat is zo ontworpen en geen FOUT. De regel "één cel per beeld" geldt dus niet, ook niet voor de beelden van 50 ms. **Jij beoordeelt of de wandeling vloeiend leest op 60 Hz**; Claude meet de duur uit de tijdstempels. FOUT is: een wandeling langer dan 1,4 s, een sprong naar de eindplek zonder tussenbeelden, of een stop thuis tussen heenweg en terugweg. Hij stopt net links van het × van `w1` en klapt (W2: het × is op een 8× uitsnede zichtbaar en Snip staat op dezelfde hoogte als thuis). **Bekend, niet blokkerend (headless gemeten):** Snip staat 1 px in het vak van de sluitknop van de verste tab; het kruisje zelf blijft 5 px vrij. Meld dat niet als nieuw defect. Daarna loopt hij terug, staat thuis even stil met de blik over de balk en draait dan om. | E 3 · C-cu 5 | P27:65-66; docs/SPEC.md:48; headless-meting 2026-11-09 (W1 OK op 6e62404, W2 1 px op 1a3e086) |
| W4 | E, C-cu | (1) `w1` is actief. (2) Verplaats `w2.md` in Verkenner naar de Prullenbak en ga terug naar SnipMD. (3) Klik, terwijl Snip bij `w2` staat, op de titel van `w2`, op de plek waar Snip staat. (4) Klik daarna *Save again*. (5) Claude neemt op en leest daarna het bestand met `Get-Content`. | De balk zegt `w2.md is no longer on disk.` met *Save again*. Snip loopt naar `w2` en kijkt daar ongerust, ongeveer 4 s; de balk blijft. De klik maakt `w2` actief: Snip zit de klik niet in de weg. Daarna loopt hij terug. Na *Save again* is de balk weg, staat `w2.md` weer in `zz-w11-test\` met de eigen regel, en blijft de kopie in de Prullenbak staan. | E 4 · C-cu 5 · C-off 1 | P27:68; P31:50 |
| N1 | E, C-cu | Echt-venster-check: de echte 10-minutentimer. (1) Alle tabs zijn schoon. (2) Bewaar 10 minuten niets en typ niets in SnipMD (andere vensters mogen; SnipMD bewaart alleen bij typen en bij het wisselen van venster, en alleen wat gewijzigd is). (3) Zet SnipMD daarna vooraan; Claude neemt Snip op. | Snip slaapt: liggend, ogen dicht, met een losse Z boven zijn rug die de rug niet raakt. | E 10 · C-cu 2 | P27:78 |
| P1 | E, C-off | (1) Open `w3.md` (schone tab, bewaard) in Kladblok, voeg een regel toe, bewaar en sluit Kladblok. (2) Ga terug naar SnipMD. (3) Claude leest `w3.md` met `Get-Content`. | De tab `w3` toont de nieuwe regel en Snip blijft slapen: er komt geen vriendje, want een herlading van schijf is geen bewaring. | E 3 · C-off 1 | docs/SPEC.md §4; P31:3 |
| N2 | E, C-cu | Echt-venster-check: een echte bewaring. (1) Druk één keer `Ctrl+S` in `w1`. (2) Druk daarna 6 s geen enkele toets. (3) Claude neemt de tabbalk en het venster op en meet de duur van het geheel. | Er komt een vriendje van rechts binnen, vanaf de rand van het venster: dezelfde krab met de kleuren omgewisseld (limoengroen lijf, paarse scharen). Het tikt Snip wakker, Snip draait zich naar het vriendje, ze klappen samen en ze zwaaien. Het vriendje loopt naar rechts weg en Snip kijkt het na. Daarna staat Snip thuis zoals gewoonlijk, zonder vriendje. Het geheel duurt ongeveer 5 tot 6 s (headless 5557 ms). FOUT als het vriendje niet verschijnt, als Snip niet wakker wordt na de bewaring, als een fase ontbreekt, als Snip niet thuis eindigt, of als het na 10 s niet klaar is. Noteer de gemeten duur. | E 1 · C-cu 4 | P27:79; headless-meting 2026-11-09 (N2 OK op 6e62404) |
| N4 | C-off | Claude vergelijkt de slaapuitsneden van R-B (licht en donker) met de tekening uit N1. Jij doet niets. | Dezelfde tekening; de twee screenshots van R-B verschillen van elkaar (licht en donker), en de uitsnede uit N1 komt overeen met die in je eigen thema. | C-off 3 | P27:81 |

**Hertest na fix (PR #105).** Gedaan op 2026-11-09, code van `6e62404`, headless: beide gaven OK. Jij bevestigt ze met N1 en N2 hierboven in het echte venster.

| ID | Wie | Doe | Verwacht | Min | Bron |
|---|---|---|---|---|---|
| HM1 | headless gedaan, OK | Na een dutje twee bewaringen kort na elkaar. | De eerste bewaring na een dutje wekt Snip ook als er snel een tweede volgt: het vriendje komt, tikt Snip wakker en Snip staat daarna thuis zonder vriendje. Je bevestigt dit met N1 en N2. | – | headless-meting 2026-11-09 (M1 OK op 6e62404) |
| HM2 | headless gedaan, OK | Een dutje dat begint terwijl Snip een moment bij een tab speelt. | Het dutje eindigt met Snip thuis, niet geparkeerd boven een tabtitel: Snip loopt eerst naar huis en het dutje begint 420 ms na aankomst. Je bevestigt dit met N1. | – | headless-meting 2026-11-09 (M2 OK op 6e62404) |

## CT. Met de eigenaar
Jij doet de handeling die Claude niet mag of kan doen (een Windows-instelling, een USB-stick). Claude doet de rest en beoordeelt. CT3 en CT4 mogen NIET GETEST worden bij gebrek aan hardware, zonder dat dit de tag blokkeert; T2 idem zonder AZERTY. CT1 wordt headless herlopen op de gefixte code (`OK (headless 2026-11-09 op de gefixte code, gelijk aan 26 okt)`) en CT5 is OK op 6e62404: je doet ze alleen als er tijd is; ze staan als `[optioneel]` apart in het totaal. CT2 blijft nodig, want WebView2 is niet gemeten. **Claude vraagt de go-ahead voor CT1 en CT2 samen aan het begin van het eerste CT-blok dat loopt, en voor CT5 apart aan het begin van CT5.**

| ID | Wie | Doe | Verwacht | Min | Bron |
|---|---|---|---|---|---|
| CT1 | E, C-cu | *Headless OK, alleen als er tijd is.* (1) Zet Windows op licht thema. (2) Plak één keer in `w1` (W1 opnieuw). (3) Claude maakt screenshots van het menu (`Ctrl+Shift+P`), een codeblok met *Copy* en Snip, en neemt de wandeling op. (4) Zet Windows terug op donker. | Alles is gestijld en leesbaar. Snip heeft in licht witte ogen met een donkere pupil, in donker donkere ogen met een witte glans, ook tijdens het lopen. Het donkere deel is op 26 okt al gedaan; het lichte deel was nog open. | E 5 · C-cu 5 [optioneel] | P27:89; rapport 26 okt CT1; headless-meting `OK (headless 2026-11-09 op de gefixte code, gelijk aan 26 okt)` |
| CT2 | E, C-cu | (1) Zet het hoofdscherm op 125 %, dan op 150 % en dan op 200 %, telkens terwijl Snip thuis staat. (2) Plak na elke stap één keer in `w1` (`Win+Shift+S`, `Ctrl+V`). (3) Claude neemt de tabbalk op en maakt 8× uitsneden van Snip thuis en bij `w1`. **Laat de schaal na 200 % staan voor CT3.** Kijk expliciet op 125 % en 150 %: NIET GETEST alleen als Windows die schaal op geen scherm aanbiedt. | Verwachting: scherpe randen, elke cel even groot, zonder vage of halve pixels, ook midden in een wandeling. Headless (geëmuleerde schaal) waren de randen bij 1,25 en 1,5 zacht en bij 1 en 2 scherp; WebView2 is niet gemeten, dus zacht op 125 % of 150 % in het echte venster is precies wat deze stap moet vastleggen (met 8× uitsnede). Snip stopt telkens links van het × zonder het te raken. Op 125 % ligt de bovenrand van Snip op 10,25 apparaatpixels: een breuk alleen is geen FOUT, vage randen op de 8× uitsnede wel. Verschuift Snip van het cellenraster nadat de schaal veranderde terwijl hij weg was, noteer dat. | E 12 · C-cu 10 | P27:90; headless-meting 2026-11-09 (CT2) |
| CT3 | E, C-off | (1) Het hoofdscherm staat op 200 %. Sluit SnipMD (met je toestemming) en start het via het Startmenu. (2) Claude leest nu de vensterrechthoek (`GetWindowRect`) en de werkruimte van het scherm. (3) Zet daarna de schaal terug op 100 %. | Het eerste venster (1200×820) valt volledig binnen het scherm, ook de bovenrand: op 200 % is het hoofdscherm 1720×720 logische px, dus het venster moet verkleind worden. De eerdere fout (venster 7 px boven het scherm, #38) is nog niet op een echt scherm gezien. | E 4 · C-off 2 | P27:91 |
| CT4 | E, C-off | (1) Steek een USB-stick in en bewaar een testnotitie op de stick. (2) Typ verder, trek de stick uit wanneer Claude dat vraagt, typ nog wat en steek hem terug wanneer Claude dat vraagt. (3) Claude leest daarna met `Get-Content` de notitie op de stick en de bestandstijden van de andere tabs. | Na het uittrekken meldt een foutbalk dat het schrijven mislukte. De tab blijft onbewaard, de tekst blijft staan en de andere tabs werken door. Na het terugsteken lukt bewaren weer. | E 6 · C-off 2 | P27:92 |
| CT5a | E, C-cu | *Headless OK, alleen als er tijd is. W3 met effecten uit vervalt: headless gedekt.* (1) Schaal 100 %, thema donker. (2) Zet *Animatie-effecten* uit (Instellingen → Toegankelijkheid → Visuele effecten). (3) Plak één keer in `w1`. (4) Claude neemt op. | Snip loopt niet: hij speelt het moment thuis en toont van elke beweging één stilstaand beeld. Hij kijkt niet rond. Noteer of de ademhaling meteen stopt na het omzetten of pas bij het eerste moment. | E 3 · C-cu 3 [optioneel] | P27:93; headless-meting 2026-11-09 (CT5 OK op 6e62404) |
| CT5b | E, C-cu | *Headless OK, alleen als er tijd is.* (1) Met de effecten nog uit: bewaar 10 minuten niets in SnipMD (alle tabs schoon). (2) Zet SnipMD vooraan en druk `Ctrl+S` in `w1`. (3) Claude neemt op. **T1 mag in deze wachttijd**, zolang je geen notitie wijzigt. | Snip slaapt en wordt gewoon wakker, zonder vriendje. | E 12 · C-cu 3 [optioneel] | P27:93 |
| CT5c | E, C-cu | *Headless OK, alleen als er tijd is.* Zet *Animatie-effecten* weer aan en plak één keer in `w1`. | Snip loopt weer (zoals W1). | E 3 · C-cu 3 [optioneel] | P27:93 |

## T. Alleen de eigenaar
| ID | Wie | Doe | Verwacht | Min | Bron |
|---|---|---|---|---|---|
| T1 | E | `Ctrl+Shift+P`, houd Enter 2 seconden ingedrukt op een toggle en zet de toggle daarna terug. Reden: computer use kan geen toets vasthouden. | De toggle verandert één keer. | E 1 | P27:98 |
| T2 | E | Alleen met een AZERTY-toetsenbord: `Ctrl+1` en `Ctrl+2` (de toetsen `&` en `é`). Reden: Claude stuurt geen fysieke toetsen van een andere layout. | Tab 1 en tab 2. Zonder AZERTY (je hebt er geen): NIET GETEST, geen blokkade. | E 0 | P27:99 |
| T3 | E | Werk een dag gewoon met SnipMD, met veel geplakte screenshots. Begin na K1. Noteer wat opvalt, onder meer: Snip geparkeerd boven een tabtitel, Snip die slaapt terwijl je in een naamloze tab typt (dat telt niet als bewaring), het vriendje als een streep op een breed venster. Reden: een oordeel over gevoel; dit is de vraag uit #72. | Snip stoort niet, ook niet als hij vaak loopt. De titels blijven leesbaar en de balk voelt niet onrustig tijdens het typen. Het vriendje is leuk, niet storend. **T3 houdt de tag tegen, tenzij jij het kwijtscheldt.** | E 0 (een dag) | P27:100; docs/SPEC.md:49 |

## B. Budgets
Je meet op de geïnstalleerde kandidaat, in je eigen PowerShell-venster, niet in een shell van Claude. Voor de meting: schaal terug op 100 %, donker thema, *Animatie-effecten* aan. **Let op:** het script overschrijft het klembord, het venster van SnipMD neemt een paar minuten de focus, en de toetsen gaan alleen naar SnipMD zolang het vooraan staat. Raak toetsenbord en muis niet aan tot het klaar is.

| ID | Wie | Doe | Verwacht | Min | Bron |
|---|---|---|---|---|---|
| B0 | C-off | Vooraf doet Claude dit: de tijdelijke worktree in de sessiemap verwijderen (`git worktree remove`) en de checkout `C:\dev\snipmd-claude-north-star\snipmd` op `claude/release-1.1.0` zetten (`git switch claude/release-1.1.0`). De ongevolgde map `assets\` blijft staan: geen `git clean`, geen hard reset. Daarna controleert Claude alleen de branchnaam met `git -C C:\dev\snipmd-claude-north-star\snipmd rev-parse --abbrev-ref HEAD`. Is het antwoord een andere branch, dan stopt Claude en meldt het. | Het antwoord is `claude/release-1.1.0`. | C-off 1 | docs/releasing.md:47 |
| B1 | E | Sluit SnipMD en open PowerShell via het Startmenu. | Er draait geen `snip-md` (het script stopt anders met "Close SnipMD first"). | E 1 | docs/releasing.md:47 |
| B2 | E | Voer uit: `powershell -ExecutionPolicy Bypass -File C:\dev\snipmd-claude-north-star\snipmd\tools\measure\measure.ps1 -Exe "$env:LOCALAPPDATA\SnipMD\snip-md.exe"` | Het script drukt één tabel af, in een eigen datamap en met testnotities in een tijdelijke map, dus je sessie blijft ongemoeid. | E 10 | docs/releasing.md:46-47 |
| B3 | E | Markeer de tabel in het venster, kopieer hem (het klembord van vóór de meting is weg) en plak hem bij Claude. | Claude heeft de tabel letterlijk. | E 2 | docs/releasing.md:47 |
| B4 | C-off | Claude leest de grootte van `SnipMD_1.1.0_x64-setup.exe` uit I1b (het script geeft geen installer-rij voor een geïnstalleerde exe), zet de tabel in `docs/releasing.md` in plaats van de vorige meting en vergelijkt met de doelen. | Doelen: Ctrl+V van een 4K-screenshot < 150 ms; geheugen < 120 MB; installer < 10 MB; eigen start < 150 ms; dubbelklik tot typen (koud) < 1 s. De vorige meting (1.0, 21 okt): 62-70 ms, 98-104 MB, 1,37 MB, 131-139 ms, 722-784 ms. Een waarde boven het doel gaat naar jou. | C-off 8 | docs/releasing.md:49-57 |
| K1 | E, C-off | (1) Start SnipMD via het Startmenu. (2) Claude vergelijkt `session.json` met de kopie uit I1. (3) Jij zegt of Snip thuis staat. | Je tabs en de testtabs komen terug. Snip staat thuis. | E 2 · C-off 1 | P27:82 |

## S/G/O. Terugvalblok opslaan (verplicht zolang `<RUN2>` leeg is)
Dit blok dekt opslaan, *Save again*, één tab per notitie en gesloten tabs. Zolang `<RUN2>` leeg is, doe je het hele blok vóór de tag. Is `<RUN2>` ingevuld en dekte de run een rij, dan vervalt die rij; Claude noemt welke rijen overblijven (R-C). Het draait na I4. **Claude vraagt de go-ahead voor dit blok aan het begin.** Zonder go-ahead doe jij ook het typen in SnipMD. Alles in Verkenner of Kladblok doe jij. Claude controleert bestandsinhoud met `Get-Content` (C-off) en schrijft balktekst letterlijk over. De rijen staan in de volgorde waarin ze op elkaar voortbouwen. De ID's S1 tot S7, G1 tot G5, O1 en K1f komen uit P31 (daar heet K1f "K1").

| ID | Wie | Doe | Verwacht | Min | Bron |
|---|---|---|---|---|---|
| F0 | C-off | Claude zorgt dat `Documents\Notes\zz-w11-test\` bestaat. | De map bestaat. | C-off 1 | P31:28 |
| S1 | C-cu, C-off | (1) Nieuwe tab (`Ctrl+T`), typ `# Hertest een`, `Ctrl+S`. (2) Kies de map `zz-w11-test` in de balk, Enter. (3) Claude leest het bestand. | `zz-w11-test\hertest-een.md` bestaat en bevat `# Hertest een`. De tabtitel is `hertest-een.md`. | C-cu 2 · C-off 1 | P31:47 |
| S2 | C-cu, C-off | (1) Typ een regel in `hertest-een.md`, wacht 2 s. (2) Claude leest het bestand. | De nieuwe regel staat in het bestand. | C-cu 1 · C-off 1 | P31:48 |
| S3 | E, C-cu, C-off | (1) Plak een knipsel (`Win+Shift+S`, `Ctrl+V`) in `hertest-een.md`. (2) `Ctrl+Shift+S`, bewaar als `zz-w11-test\hertest-twee.md`. (3) Claude leest de mappen. | `hertest-twee.assets\` bestaat met het beeld; `hertest-een.md` en `hertest-een.assets\` staan er nog. De tab heet `hertest-twee.md` en toont het beeld. | E 2 · C-cu 2 · C-off 1 | P31:49 |
| S4 | C-cu, E | (1) Nieuwe tab, typ `oud`. (2) `Ctrl+S`, klik *Other folder…*, bewaar als `zz-w11-test\u1.md`. (3) Verplaats `u1.md` in Verkenner naar de Prullenbak en ga terug naar SnipMD. | Een balk: `u1.md is no longer on disk.` met *Save again*. De tab houdt `oud`. | C-cu 2 · E 1 | P31:50 |
| S4b | C-cu, E, C-off | (1) Nieuwe tab, typ `twee`. (2) `Ctrl+S`, klik *Other folder…*, bewaar als `zz-w11-test\u2.md`. (3) Verplaats `u2.md` naar de Prullenbak en ga terug naar SnipMD. (4) Klik *Save again* in de balk van `u2.md`. (5) Kijk of de kopie in de Prullenbak blijft; Claude leest `u2.md`. | Eerst de balk `u2.md is no longer on disk.` met *Save again*. Na de klik is de balk weg, staat `u2.md` weer in `zz-w11-test\` met `twee`, en toont de tab geen onbewaard-teken. De kopie in de Prullenbak blijft. | C-cu 2 · E 1 · C-off 1 | P31:3 (nieuwe rij) |
| S5 | C-cu, C-off | (1) Laat de tab van `u1.md` open. (2) Nieuwe tab, typ `nieuw`. (3) `Ctrl+S`, *Other folder…*, kies `zz-w11-test\u1.md`. (4) Claude kijkt of `u1.md` ontbreekt. | Een foutbalk: `Could not save Untitled-…: u1.md is open in another tab`. `u1.md` bestaat niet in Verkenner. De nieuwe tab blijft `Untitled-…` met `nieuw`. | C-cu 2 · C-off 1 | P31:51 |
| S5b | C-cu, C-off | (1) Laat de tab van `u1.md` open met zijn balk. (2) Nieuwe tab, typ `nieuw2`. (3) `Ctrl+S`; kies in de balk de map `zz-w11-test` en typ de naam `u1.md` (het veld is niet rood: het bestand staat in de Prullenbak). (4) Enter. (5) Claude kijkt of `u1.md` ontbreekt. | Een foutbalk: `Could not save Untitled-…: u1.md is open in another tab` (letterlijk overschrijven). Verkenner toont geen `u1.md`, ook geen leeg bestand. De tab blijft `Untitled-…` met `nieuw2`. | C-cu 2 · C-off 1 | P31:3 (nieuwe rij) |
| S5c | C-cu, C-off | (1) Ga naar `hertest-twee.md`. (2) `Ctrl+Shift+S`, kies `zz-w11-test\u1.md`. (3) Claude kijkt of `u1.md` en `u1.assets\` ontbreken. | Een foutbalk: `Could not save hertest-twee.md: u1.md is open in another tab`. Verkenner toont geen `u1.md` en geen `u1.assets\`. De tab is nog `hertest-twee.md` en toont zijn beeld. | C-cu 2 · C-off 1 | P31:3 (nieuwe rij) |
| S6 | E, C-cu, C-off | (1) Zet `u1.md` terug uit de Prullenbak (rechtsklik, Terugzetten). (2) Open het in Kladblok, verander `oud` in `van buiten`, bewaar en sluit Kladblok. (3) Klik in SnipMD in de balk van `u1.md` op *Save again*. (4) Claude leest `u1.md`. | `u1.md` blijft `van buiten`. Een balk: `u1.md was changed outside SnipMD and you have changes too.` met *Open disk version · Reload · Keep mine*. | E 3 · C-cu 1 · C-off 1 | P31:52 |
| S6b | E, C-cu, C-off | (1) Sluit SnipMD (met je toestemming) en start het opnieuw via het Startmenu. (2) Ga naar `u1.md`. (3) Wissel twee keer van venster. (4) Claude leest `u1.md`. | De balk `u1.md was changed outside SnipMD and you have changes too.` komt terug met *Open disk version · Reload · Keep mine*. `u1.md` bevat nog `van buiten`, ook na het wisselen. | E 2 · C-cu 1 · C-off 1 | P31:3 (nieuwe rij) |
| S7 | C-cu, C-off | (1) Klik *Open disk version*, daarna *Keep mine*. (2) Claude leest `u1.md`. | Een leestab `u1.md (disk)` met `van buiten` naast de tab. Na *Keep mine* staat `oud` in `u1.md` en is de balk weg. | C-cu 2 · C-off 1 | P31:53 |
| G1 | C-cu | Sluit `hertest-twee.md` met `Ctrl+W`. | Onderaan: `hertest-twee.md closed, with 1 screenshot.` met *Restore* en de toets `Ctrl+Shift+T`. De balk gaat na ongeveer 8 s weg. | C-cu 1 | P31:58 |
| G2 | C-cu | `Ctrl+Shift+T`. | `hertest-twee.md` komt terug met het beeld en de cursor waar hij stond. | C-cu 1 | P31:59 |
| G3 | E, C-cu | (1) Verplaats `u1.md` weer naar de Prullenbak en ga terug naar SnipMD (balk *no longer on disk*). (2) Typ `nog oud` in de tab. (3) Sluit hem met `Ctrl+W`. | De onderste balk `u1.md closed.` en een blijvende waarschuwing `u1.md was closed with changes that are not on disk.` met *Restore*. | E 1 · C-cu 2 | P31:60 |
| G4 | C-cu, C-off | (1) Nieuwe tab, typ `nieuw`. (2) `Ctrl+S`, *Other folder…*, bewaar als `zz-w11-test\u1.md`. (3) Claude leest het bestand. | Dat lukt nu (de oude tab is dicht). `u1.md` bevat `nieuw`. | C-cu 2 · C-off 1 | P31:61 |
| G5 | C-cu, C-off | (1) Klik *Restore* in de waarschuwing van G3. (2) Claude leest `u1.md`. | Geen tweede tab op `u1.md`: de tab met `nieuw` wordt actief en ernaast opent een leestab `u1.md (closed)` met `nog oud`. `u1.md` bevat nog altijd `nieuw`. | C-cu 2 · C-off 1 | P31:62 |
| K0 | E, C-cu, C-off | (1) Nieuwe tab, typ `drie`, bewaar als `zz-w11-test\u3.md` (*Other folder…*). (2) Verplaats `u3.md` naar de Prullenbak en ga terug naar SnipMD. (3) Typ `nog drie` in de tab, `Ctrl+W`. (4) Nieuwe tab, typ `nieuw3`, bewaar als `zz-w11-test\u3.md`. (5) Herstel de gesloten tab niet. (6) Doe K1f. (7) Wissel na de herstart drie keer naar Verkenner en terug; Claude leest `u3.md` na elke wissel. | `u3.md` bevat na elke wissel `nieuw3`. `Ctrl+Shift+T` tot de `u3.md`-ingang terugkomt: de tab met `nieuw3` wordt actief en een leestab `u3.md (closed)` met `nog drie` opent ernaast. | E 2 · C-cu 3 · C-off 1 | P31:3 (nieuwe rij) |
| O1 | E, C-off | (1) Laat de tabs van `u1.md` open. (2) Dubbelklik in Verkenner twee keer snel na elkaar op `zz-w11-test\hertest-twee.md` (staat open). (3) Dubbelklik daarna twee keer snel op `zz-w11-test\hertest-een.md` (staat op schijf sinds S3, is niet open). (4) Claude telt de tabs in `session.json`, of jij telt ze. | Telkens één tab: de open tab wordt actief en de notitie die nog niet open was opent één keer. | E 3 · C-off 1 | P31:63 |
| O2 | E, C-off | (1) Claude controleert dat `%LOCALAPPDATA%\SnipMD\snip-md.exe` bestaat. (2) Laat `hertest-twee.md` open. (3) Druk `Win+R` en voer in: `"%LOCALAPPDATA%\SnipMD\snip-md.exe" "%USERPROFILE%\Documents\Notes\zz-w11-test\..\zz-w11-test\.\hertest-twee.md"`. Jij start dit zelf: Claude start SnipMD niet vanuit zijn shell. | Geen nieuwe tab. `hertest-twee.md` wordt actief en het venster komt naar voren. | E 2 · C-off 1 | P31:3 (nieuwe rij) |
| K1f | E, C-cu, C-off | (1) Sluit SnipMD (met je toestemming) en start het opnieuw via het Startmenu. (2) Druk `Ctrl+Shift+T` tot er niets meer terugkomt. (3) Claude leest `u1.md`. | De tabs komen terug. Geen gesloten tab schrijft over `u1.md`: dat bevat nog `nieuw`. | E 2 · C-cu 1 · C-off 1 | P31:64 |

## Rapport
Claude schrijft één bestand `findings/windows/w11-20261109.md` op de branch `test/w11-20261109` (of geeft het aan jou als de sessie niet kan pushen), in de vorm van het rapport van 26 oktober, uit jouw antwoorden en Claudes offscreen-controles:
1. **0. Gegevens**: tabel `| Gegeven | Waarde |` met de gegevens uit stap 0, run `42549469763` en commit `6e62404`.
2. **Resultaten**: tabel `| ID | Resultaat | Wat ik zag | Screenshot |` met OK, FOUT of NIET GETEST voor R, I, W/N, P1, CT, B, K1, en S/G/O als dat blok liep. Rijen die de headless-meting (W3, W5, W6, W7, W9, N3, CT1, CT5 en W8) of de runner dekte, en de bekende afwijkingen (W2: 1 px, CT2: zachte randen headless), neemt Claude over met de bron (run-id of "headless, niet Windows"). Bij W1, W4 en N2 staan de gemeten tijden. Voor je tabs noemt het rapport alleen aantallen en id's, nooit titels of tekst.
3. **Budgets**: tabel `| Meting | Waarde |` uit B2, met de pc als regel eronder.
4. **FOUT**: per FOUT de stappen, wat je verwachtte en wat er gebeurde.
5. **Prompts letterlijk**: de setup-pagina's uit I2 en elke balktekst.
6. **Wat opviel**.
7. **T**: jij vult T1 en T3 aan; T2 is NIET GETEST zonder AZERTY.

De fix van de pad-hold (een opslag kan geen pad nemen dat een andere tab aan het opslaan is) is gedekt door unit-tests en code-proeven; ze is met de hand niet betrouwbaar te reproduceren, dus er is geen rij voor jou.

| ID | Wie | Doe | Verwacht | Min | Bron |
|---|---|---|---|---|---|
| RA | E, C-off | Sluit op het einde de testtabs. De notities in `zz-w11-test\` blijven staan. Claude schrijft het rapport. De back-up uit I1 blijft staan tot jij zegt dat hij weg mag. | Het rapport staat op de branch of bij jou. | E 2 · C-off 20 | P27:110 |

## Na de release: smoke test op de gepubliceerde setup
Dit blok loopt pas als de tag `v1.1.0` gepusht is en *Release Windows* de setup publiceerde. **Tot dan is 1.0.0 *Latest*:** geef `gh release download` daarom altijd de tag mee. Het gaat om stappen 1 tot 7 en 9 van de smoke test (docs/releasing.md:36-42 en :44) op de gepubliceerde setup, en stap 8 (:43) in beide richtingen: over 1.0.0 en over 1.1.0-4. Op je pc mag geen enkele oude versie je echte sessie lezen. De waarborgen:
- **G-a** Maak vlak voor het eerste been een verse back-up in een nieuwe, eigen map met een datum-tijdstempel, nooit in de map van I1: `$stamp = Get-Date -Format yyyyMMdd-HHmm`, `Test-Path "$env:USERPROFILE\Desktop\snipmd-backup-release-$stamp"` geeft False, dan `robocopy "$env:APPDATA\com.snipmd.desktop" "$env:USERPROFILE\Desktop\snipmd-backup-release-$stamp" /E` en een kopie van `session.json` als `Desktop\snipmd-session-voor-release-$stamp.json`. `robocopy /E` mag niet in de I1-map samenvoegen.
- **G-b** Je echte SnipMD blijft dicht tot het einde van dit blok, behalve in SM8a-6.
- **G-c** Elk been begint met het verwijderen van de huidige versie via Instellingen → Apps, met *Delete the application data* uit.
- **G-d** Vink op de laatste pagina van elke setup de startoptie uit, ook bij de 1.1.0-setup. De single-instance-functie hangt niet af van `SNIPMD_DATA_DIR` (src-tauri/src/lib.rs), dus een automatisch gestarte kopie zou latere starts overnemen.
- **G-e** Start de oude en daarna de nieuwe versie alleen vanuit je eigen PowerShell, met dezelfde `SNIPMD_DATA_DIR` voor het been.
- **G-f** Dubbelklik geen `.md` zolang een oude versie geïnstalleerd is: de bestandskoppeling start die op de echte sessie.
- **G-g** De laatste handeling van het blok is de gepubliceerde 1.1.0 starten via het Startmenu.
- **G-h** Start een oude versie toch op de echte sessie: sluit hem meteen en zet `session.json` en `scratch\` terug uit de back-up van G-a, vóór een volgende start.

**Commando's** (je eigen PowerShell, geopend via het Startmenu; sluit het venster na het been of voer Commando 4 uit). Claude controleert eerst dat `%LOCALAPPDATA%\SnipMD\snip-md.exe` bestaat en leest de FileVersion. Staat de exe daar niet, dan zoek jij de map via de eigenschappen van de Startmenu-snelkoppeling. Plak de regels één voor één: geeft een regel een fout, plak dan niets meer en meld het aan Claude. Vul `<naam>` in zoals de stap zegt (`smoke`, `100`, `1104`).

```powershell
# 1. Geen SnipMD mag draaien. Toont dit een proces, stop dan: sluit SnipMD eerst.
Get-Process snip-md -ErrorAction SilentlyContinue
# 2. Lege, absolute testmap voor dit been. Bestaat de map al, dan stopt -ErrorAction Stop de rest.
$env:SNIPMD_DATA_DIR = Join-Path $env:TEMP "snipmd-leg-<naam>"
New-Item -ItemType Directory -Path $env:SNIPMD_DATA_DIR -ErrorAction Stop | Out-Null
# 3. Start de geïnstalleerde versie, alleen met een absolute SNIPMD_DATA_DIR:
if (-not [IO.Path]::IsPathRooted($env:SNIPMD_DATA_DIR)) { throw 'SNIPMD_DATA_DIR ontbreekt' } else { & "$env:LOCALAPPDATA\SnipMD\snip-md.exe" }
# 4. Na de laatste start van dit been:
Remove-Item Env:SNIPMD_DATA_DIR
```
Claude controleert offscreen met:
```powershell
(Get-Item "$env:LOCALAPPDATA\SnipMD\snip-md.exe").VersionInfo.FileVersion
Get-Content "$env:TEMP\snipmd-leg-<naam>\session.json"
```
Bij een tweede start van hetzelfde been sla je stap 2 over: de map bestaat dan al en moet blijven bestaan.

| ID | Wie | Doe | Verwacht | Min | Bron |
|---|---|---|---|---|---|
| SM0 | C-off | (1) `gh release download v1.1.0 --repo ArneVDA-AP/snipmd --pattern "*_x64-setup.exe" --dir "$env:USERPROFILE\Downloads\snipmd-1.1.0-published"`; de map bestaat vooraf niet (`Test-Path` geeft False). (2) `gh release view v1.1.0 --repo ArneVDA-AP/snipmd --json tagName,isPrerelease,isDraft,assets`. (3) Claude leest grootte en FileVersion. (4) Verse back-up in een nieuwe map met tijdstempel en kopie van `session.json`, zoals G-a zegt. | De release is geen pre-release en geen concept en heeft de drie Windows-bestanden. De setup is kleiner dan 10 MB en heet 1.1.0. | C-off 5 | docs/releasing.md:43 |
| SM1 | E, C-off | (1) Sluit SnipMD. (2) Kies **B**: verwijder eerst de kandidaat 1.1.0 (zoals G-c) en installeer dan de gepubliceerde setup met een dubbelklik in Verkenner. **A** (eroverheen installeren met *Do not uninstall*) alleen als jij dat uitdrukkelijk wilt. (3) Schrijf elke pagina letterlijk op; startoptie uit (G-d). | Installeert zonder adminrechten; het Startmenu heeft SnipMD. Een setup van dezelfde versie kan een andere pagina tonen dan *Already Installed*: schrijf hem letterlijk op. FileVersion 1.1.0, één SnipMD in Instellingen → Apps. | E 4 · C-off 1 | docs/releasing.md:36 |
| SM2 | E | Start SnipMD met de testmap `snipmd-leg-smoke` (Commando's 1 tot 3, `<naam>` = `smoke`). | Eén lege tab met de core-loop-hint, in het Windows-thema. | E 2 | docs/releasing.md:37 |
| SM3 | E | `Win+Shift+S`, `Ctrl+V`. Typ door. | Het screenshot verschijnt onder de cursor. | E 1 | docs/releasing.md:38 |
| SM4 | E, C-off | (1) `Ctrl+S`, Enter. (2) Claude controleert de map. | `Documents\Notes\<naam>.md` en `<naam>.assets\` staan naast elkaar. Jij beslist of ze blijven. | E 1 · C-off 1 | docs/releasing.md:39 |
| SM5 | E | Dubbelklik in Verkenner op een `.md` uit `zz-w11-test\` terwijl dit exemplaar draait. | Het opent als tab in het draaiende venster (er komt geen tweede SnipMD-proces). | E 1 | docs/releasing.md:40 |
| SM6 | E | Sluit SnipMD en start het opnieuw met dezelfde `SNIPMD_DATA_DIR` (Commando's 1 en 3). | De tabs zijn terug. | E 2 | docs/releasing.md:41 |
| SM7 | C-off, E | (1) Claude kopieert `tools\fixtures\evil.md` van `C:\dev\snipmd-claude-north-star\snipmd\` naar `zz-w11-test\`. (2) Open het en druk `Ctrl+E` (leesmodus). (3) Klik op *click me* en op *remote page*. (4) Sluit het browsertabblad dat opent. | Er draait niets, er laadt geen beeld van buiten de map van de notitie en een klik op een link opent de browser, nooit het appvenster. Leesmodus idem. | C-off 1 · E 3 | docs/releasing.md:42; rapport 26 okt K2 |
| SM9 | E, C-off | (1) Verwijder SnipMD via Instellingen → Apps, met *Delete the application data* uit. (2) Claude controleert. | De notities en afbeeldingen in `Documents\Notes` staan er nog; `%APPDATA%\com.snipmd.desktop\` bestaat nog met hetzelfde aantal bestanden als de back-up. Er is nu niets geïnstalleerd; dit is ook G-c voor het eerste been. | E 3 · C-off 2 | docs/releasing.md:44 |
| SM8a-1 | C-off | `gh release download v1.0.0 --repo ArneVDA-AP/snipmd --pattern "SnipMD_1.0.0_x64-setup.exe" --dir "$env:USERPROFILE\Downloads\snipmd-1.0.0"`; de map bestaat vooraf niet (`Test-Path` geeft False). | Eén setup, `SnipMD_1.0.0_x64-setup.exe`. | C-off 2 | docs/releasing.md:43 |
| SM8a-2 | E, C-off | (1) Dubbelklik de 1.0.0-setup in Verkenner; startoptie uit (G-d). (2) Claude leest de FileVersion. | FileVersion 1.0.0. Geen `.md` dubbelklikken (G-f). | E 4 · C-off 1 | docs/releasing.md:43 |
| SM8a-3 | E, C-off | (1) Start 1.0.0 één keer met `SNIPMD_DATA_DIR` = `snipmd-leg-100` (Commando's 1 tot 3, `<naam>` = `100`). (2) Open twee tabs (`Ctrl+T`), typ `been een` en `been twee`. (3) Laat SnipMD open: het blijft open tot SM8a-4. (4) Claude leest `session.json` in de testmap. (5) Voer Commando 4 nog niet uit. | De testmap bevat een sessie met de tabs. Je echte sessie is niet gelezen (`%APPDATA%\com.snipmd.desktop\session.json` ongewijzigd). | E 4 · C-off 2 | docs/releasing.md:43 |
| SM8a-4 | E, C-off | (1) Laat 1.0.0 open met zijn twee tabs; hij leest alleen de testmap. (2) Dubbelklik de gepubliceerde 1.1.0-setup in Verkenner. (3) Kies op *Already Installed* **Uninstall before installing** (de standaard, de weg van de meeste gebruikers) of **Do not uninstall**, en noteer welke; *Delete the application data* blijft uit. (4) Vink op de laatste pagina de startoptie uit. (5) Claude controleert. | De setup vraagt SnipMD te sluiten (tekst letterlijk overschrijven) en installeert zonder downgrade-prompt. Kies je de standaard, dan kan de oude uninstaller "SnipMD is running! Click OK to kill it" tonen: OK sluit hem hard en dat is hier veilig, want die instantie leest alleen de testmap. Instellingen → Apps toont één SnipMD met versie 1.1.0. | E 4 · C-off 2 | docs/releasing.md:43; rapport 26 okt I2 |
| SM8a-5 | E, C-off | Start 1.1.0 vanuit dezelfde PowerShell met dezelfde `SNIPMD_DATA_DIR` (Commando's 1 en 3; stap 2 niet herhalen). Sluit hem, voer dan Commando 4 uit. | De tabs `been een` en `been twee` zijn terug: de update behoudt de sessie. | E 3 · C-off 1 | docs/releasing.md:43 |
| SM8a-6 | E, C-off | (1) Start SnipMD via het Startmenu. (2) Claude vergelijkt tab-id's en aantal tabs in `session.json` met de verse back-up. | Je tabs komen terug en zijn gelijk aan die in de back-up. | E 2 · C-off 1 | docs/releasing.md:43 |
| SM8b-1 | C-off | `gh release download v1.1.0-4 --repo ArneVDA-AP/snipmd --pattern "SnipMD_1.1.0-4_x64-setup.exe" --dir "$env:USERPROFILE\Downloads\snipmd-1.1.0-4"`; de map bestaat vooraf niet (`Test-Path` geeft False). | Eén setup van 1.1.0-4. | C-off 2 | P27:56 |
| SM8b-2 | E, C-off | (1) Sluit SnipMD en verwijder 1.1.0 via Instellingen → Apps, met *Delete the application data* uit (G-c). (2) Installeer de 1.1.0-4-setup (startoptie uit). (3) Claude controleert. | FileVersion 1.1.0-4, één SnipMD in Instellingen → Apps. Geen `.md` dubbelklikken. | E 6 · C-off 2 | docs/releasing.md:43 |
| SM8b-3 | E, C-off | (1) Start 1.1.0-4 één keer met `SNIPMD_DATA_DIR` = `snipmd-leg-1104` (Commando's 1 tot 3, `<naam>` = `1104`). (2) Open twee tabs, typ `been drie` en `been vier`. (3) Laat SnipMD open tot SM8b-4. (4) Claude leest `session.json`. | De testmap bevat de sessie. Je echte sessie is niet gelezen (1.1.0-4 leest `SNIPMD_DATA_DIR` ook). | E 4 · C-off 2 | docs/releasing.md:43 |
| SM8b-4 | E, C-off | (1) Laat 1.1.0-4 open met zijn twee tabs. (2) Dubbelklik de gepubliceerde 1.1.0-setup in Verkenner. (3) Kies op *Already Installed* dezelfde optie als in SM8a-4 en noteer welke; *Delete the application data* blijft uit. (4) Startoptie uit. (5) Claude controleert. | De setup vraagt SnipMD te sluiten (tekst letterlijk overschrijven) en installeert zonder downgrade-prompt. Eén SnipMD, versie 1.1.0. | E 4 · C-off 2 | docs/releasing.md:43 |
| SM8b-5 | E, C-off | Start 1.1.0 met dezelfde `SNIPMD_DATA_DIR` (Commando's 1 en 3; stap 2 niet herhalen), sluit hem, voer Commando 4 uit. | De tabs `been drie` en `been vier` zijn terug. | E 3 · C-off 1 | docs/releasing.md:43 |
| SM8b-6 | E, C-off | (1) Start SnipMD via het Startmenu. (2) Claude vergelijkt `session.json` met de verse back-up en schrijft op wat er na het blok geïnstalleerd staat. | Je tabs zijn terug en gelijk aan de back-up. Er staat één SnipMD 1.1.0 (gepubliceerd). | E 2 · C-off 3 | docs/releasing.md:43 |

De uitkomst van dit blok komt als aanvulling "Na de release" in hetzelfde rapport. Faalt SM8a of SM8b na de publicatie, dan beslis jij of 1.1.0 *Latest* blijft; daarvoor bestaat nog geen regel.

## Totaal aan minuten per partij
Alle getallen zijn schattingen in minuten, door een script uit de kolom *Min* opgeteld. C-cu-minuten gelden alleen met jouw go-ahead en lopen naast de E-minuten van dezelfde stap; zonder go-ahead komen ze bij E erbij. In E zitten ook de wachttijd van N1 (10 minuten) en, als CT5b loopt, die van CT5b (10 minuten). T3 (een dag) en T2 tellen niet mee.

| Deel | Jij (E) | Claude offscreen (C-off) | Claude computer use (C-cu, alleen met go-ahead) |
|---|---|---|---|
| Voor de tag, verplicht (R, 0, I, W/N, CT2 tot CT4, T1, B, K1, rapport en afronden) | 73 | 58 | 26 |
| Voor de tag, optioneel (headless gedekt: CT1, CT5a, CT5b, CT5c) | 23 | 0 | 14 |
| Blok S/G/O (verplicht zolang `<RUN2>` leeg is) | 19 | 17 | 31 |
| Na de release (SM0 tot SM8b-6) | 53 | 31 | 0 |

## Bronnen
Afkortingen in de laatste kolom van elke tabel.
- **P27**, **P31**: het plan van 27 oktober (`TESTPLAN-WIN11-20261027.md`, v1.1.0-4) en dat van 31 oktober (`TESTPLAN-WIN11-20261031.md`, kandidaat 1a3e086), met regelnummer; ID's blijven behouden waar de stap overleeft. "P31:3 (nieuwe rij)" betekent: de wijziging staat in de inleiding van P31, de rij is nieuw.
- **docs/releasing.md**, **docs/SPEC.md**: de repo-documenten, met regelnummer of paragraaf.
- **rapport 26 okt**: `findings/windows/w11-20261026.md` op `test/w11-20261026`.
- **headless-meting 2026-11-09**: Snip headless gemeten in Chromium op de demo-pagina (1280×720, 100 Hz), op de codes `1a3e086` en `6e62404`. Geen WebView2-meting.
- **meting op de pc 2026-11-09**: de versie van de exe en het draaiende proces, gemeten op je pc.
