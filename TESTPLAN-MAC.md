# SnipMD – testplan Mac (26 oktober 2026)

Voor de Mac-tester en zijn Claude-sessie met computer use. Het plan test de pre-release **SnipMD v1.1.0-3**. Het vorige plan (voor 1.1.0-1) is nooit uitgevoerd; dit plan vervangt het en voegt Snip toe.

## Wie doet wat
Zoveel mogelijk doet Claude. Elke stap staat in één van vier delen:

| Deel | Wie | Wanneer |
|---|---|---|
| **R** | Runner | Een macOS-runner op GitHub deed het al bij de release. Er is niemand nodig. |
| **C** | Claude op de Mac | De Claude-sessie met computer use doet en beoordeelt de stap. De tester is bereikbaar voor prompts. |
| **CT** | Claude met de tester | De tester doet één handeling die Claude niet mag of kan doen (een systeeminstelling, een prompt van macOS). Claude doet de rest en beoordeelt. |
| **T** | Alleen de tester | Claude kan het niet doen of niet beoordelen. De reden staat bij de stap. |

Een stap staat alleen in CT of T als de reden erbij staat. Rapporteer elke ID als **OK**, **FOUT** (met wat er wel gebeurde) of **NIET GETEST** (met de reden).

## R. Runner (gedaan bij de release)
*Release macOS* run 9 op `v1.1.0-3` installeerde de app uit de `.dmg` zoals een gebruiker dat doet en liet de probes erop los. Alles PASS:
- starten;
- openen vanuit Finder;
- niets kwijt bij ⌘Q en bij *Quit* in het Dock;
- ⌘W sluit één tab;
- plakken en plakken als platte tekst;
- vervangen;
- ⌘H;
- de knoppen links in de balk.

Typecheck, unit tests en core tests liepen op macOS. De `.dmg` is 4,2 MB. Die stappen hoeven hieronder niet opnieuw.

## Regels voor de Claude-sessie
- Werk alleen in SnipMD, Finder, Terminal, TextEdit, Activity Monitor en, voor de download, Safari.
- Bewaar testnotities alleen in `~/Documents/Notes/zz-mac-test/`. Open, bewerk of verwijder geen andere bestanden.
- Wijzig geen systeeminstellingen; dat doet de tester in de CT-stappen. Verschijnt er een prompt (toegang tot Documents, toegankelijkheid, schermopname, Gatekeeper), stop dan, schrijf de tekst letterlijk over en vraag de tester.
- Maak na elke stap een screenshot. Bewaar ze als `<ID>.png` in `~/Desktop/snipmd-mac-test/`. Snip is 22 punten hoog: knip voor elke S-stap ook een uitsnede rond Snip en vergroot die 8× (naaste buur, niet vervaagd).
- Tik toetsen precies zoals ze er staan. ⌘ = Command, ⌥ = Option, ⇧ = Shift, ⌃ = Control.
- Wacht na een actie die laadt (leesmodus, een codeblok) 2 seconden voor je beoordeelt.
- Snip speelt alleen in een venster met focus. Zet SnipMD vooraan voor je een animatie beoordeelt.
- Iets onverwachts (een crash, een venster dat niet reageert)? Noteer het, maak een screenshot, herstart SnipMD en ga verder.

## 0. Gegevens (C)
Noteer: het Mac-model, de chip (Apple Silicon of Intel), de macOS-versie, de schermresolutie en of het Retina is, en of *Desktop & Documents* met iCloud synchroniseert.

## I. Installatie
| ID | Deel | Doe | Verwacht |
|---|---|---|---|
| I1 | C | Kopieer `~/Library/Application Support/com.snipmd.desktop/`, als die bestaat, naar `~/Desktop/snipmd-backup/`. | Er is een backup, of er was niets. |
| I2 | C | Ga naar https://github.com/ArneVDA-AP/snipmd/releases. Neem **SnipMD v1.1.0-3**, gemarkeerd *Pre-release* (niet *Latest*). Download `SnipMD_1.1.0-3_universal.preview.dmg`, open hem en sleep SnipMD naar Applications. Staat er al een SnipMD, kies *Replace*. | SnipMD staat in Applications. |
| I3 | CT | Claude start SnipMD. Weigert macOS de start, dan klikt de tester System Settings → Privacy & Security → *Open Anyway* (zie [Installing on macOS](https://github.com/ArneVDA-AP/snipmd/blob/main/docs/install-macos.md)). Waarom de tester: een systeeminstelling. | SnipMD start. |
| I4 | C | Menubalk SnipMD → *About SnipMD*. Sluit dat venster, druk ⇧⌘P. | Versie 1.1.0-3. Onder de tabbalk verschijnt een balk met "Type a command" en een lijst. Esc. Rechts van de `+`-knop staat Snip. |

## S. Snip (C)
Werk in een nieuwe tab (⌘T).

| ID | Doe | Verwacht |
|---|---|---|
| S1 | Bekijk Snip 10 seconden, met SnipMD vooraan. Maak drie uitsneden. | Een paarse krab met limoengroene scharen op de schouders, twee grote ogen op het lijf en pootjes naar buiten. Hij ademt (de scharen gaan even omhoog) en knippert. |
| S2 | Vergroot een uitsnede 8×. | Op Retina is elke cel een even groot blok van 2×2 schermpixels: geen vage of halve randen. |
| S3 | ⌃⇧⌘4, selecteer een stuk scherm, ⌘V in de testtab. | Het beeld verschijnt. Snip klapt: de scharen gaan een paar keer naar elkaar toe. |
| S4 | Sluit de testtab (⌘W), druk ⇧⌘T. | De tab komt terug. Snip is even opgelucht: de ogen dicht, de scharen omlaag. |
| S5 | Bewaar de testtab als `snip` in `zz-mac-test` (⌘S; kies de map via *Other folder…* als dat nodig is). Verplaats `snip.md` in Finder naar de Prullenmand. Ga terug naar SnipMD en wacht 3 seconden. | De balk zegt "snip is no longer on disk." met *Save again*. Snip kijkt ongerust (een grimas, trillende scharen) en stopt na ongeveer 4 seconden; de balk blijft. Klik *Save again*: het bestand staat er weer. |
| S6 | ⇧⌘P, typ `snip`, Enter op *Show Snip*, Esc. Daarna nog eens. | Snip verdwijnt, en komt terug. |
| S7 | Bewaar niets gedurende 10 minuten. Zet SnipMD vooraan. Druk daarna ⌘S. | Na 10 minuten slaapt Snip: liggend, ogen dicht, een Z erboven. Na het bewaren is hij wakker. |

## A. Hertest van het Mac-rapport van 23 oktober (C)
| ID | Doe | Verwacht |
|---|---|---|
| A1 | Typ `> een citaat`, Enter, nog eens Enter, typ `verder`. | Het citaat stopt: een lege regel, en `verder` staat zonder `>`. |
| A2 | `- item een`, Enter, `item twee`, Enter, Tab, `genest item`, Enter, Enter. | Het lege geneste item springt terug naar `- `, zonder lege regel. |
| A3 | `- [ ] taak open` en `- [x] taak klaar`, ⌘E. | Alleen een vinkvak, geen bolletje. ⌘E terug. |
| A4 | ⌘F, `item`. Klik in het vervangveld (of ⌘⌥F), typ `punt`, klik *Replace all*, Esc. | De zoekbalk sluit. |
| A5 | ⌘F, typ `item`. | Geen autocorrectie (zoals `Item`) en geen rode spellingslijn. Esc. |
| A6 | `1. een` … `5. vijf` (Enter tussen elk). Selecteer de regel `3. drie` (klik ervoor, ⇧↓), Backspace. | De nummers lopen 1, 2, 3, 4. |
| A7 | Aan het einde van `4. vijf`: Enter, Tab, `sub a`, Enter, `sub b`, Enter, ⇧Tab, `terug`. | `   1. sub a`, `   2. sub b`, `5. terug`. ⌘E toont een echte sublijst. ⌘E terug. |
| A8 | Begin na een alinea een nieuwe lijst `1. a`, `2. b`, `3. c`. Maak `b` leeg, zodat `2. ` overblijft, en druk Backspace tot de regel weg is. Tel de keren. | Twee keer. Daarna heet `c` weer `2.`. |
| A9 | Twee regels zonder lege regel ertussen, ⌘E. | Eén regel in leesmodus. ⌘E, ⇧⌘P, `line`, Enter, Esc, ⌘E: twee regels. Zet de toggle terug uit. |
| A10 | Open drie tabs (⌘T), sluit ze (⌘W), ⌘T. | `Untitled-N` met het laagste vrije nummer. |
| A11 | Open drie tabs, sleep de laatste links op de eerste. | Een blauwe streep op de landingsplek; de tab staat daarna vooraan. |
| A12 | ⇧⌘PageDown (zonder PageDown: fn⇧⌘↓), daarna ⇧⌘PageUp (fn⇧⌘↑). | De tab schuift één plaats naar rechts en terug. |

## B. Functies van 1.1 (C)
| ID | Doe | Verwacht |
|---|---|---|
| B1 | ⇧⌘P, typ `save`. | Alleen rijen met "save", elk met zijn toets (⌘S, ⇧⌘S). |
| B2 | Wis het veld, ↓/↑, Enter op *New Tab*. | Het menu sluit en er opent een tab. |
| B3 | ⇧⌘P, `copy`, Enter op *Copy button on code blocks*. | Het vinkje gaat weg, het menu blijft open. Enter: terug. Esc: de cursor staat in de notitie. |
| B4 | Klik een rij in het menu met de muis. | Die rij wordt uitgevoerd; de focus blijft in het tekstveld. |
| B5 | Codeblokken ```` ```js ```` (`const x = 1;`), ```` ```python ```` (`def f(): return 1`), ```` ```bash ```` (`echo "hi" # note`). | Kleur binnen 2 seconden. Geen rode golflijn onder de taalnaam of de code. |
| B6 | ```` ```scss ```` en ```` ```klingon ````, dan ⌘E en terug. | Eén kleur, en dezelfde tekstkleur in schrijf- en leesmodus. |
| B7 | ⌘E, muis over het js-blok, klik *Copy*, plak (⌘V) in TextEdit. | Precies `const x = 1;`; de knop toonde kort *Copied*. |
| B8 | `- [ ] a` en `- [ ] b`, ⌘E, klik het vakje van `a`. | Aangevinkt. ⌘E: `- [x] a`; ⌘Z draait het terug. |
| B9 | Bewaar als `taken` in `zz-mac-test`. ⌘E. Zet in TextEdit `- [ ] b` bovenaan en bewaar. Terug naar SnipMD, wacht 3 seconden. | De leesmodus toont de nieuwe volgorde. Klik het vakje van `b`: alleen `b` wordt aangevinkt. |
| B10 | ⌘F, `a`, wacht even, Enter een paar keer. | "N matches", daarna "1 of N", "2 of N". Zet *Match count in find* uit en weer aan: de teller verdwijnt en komt terug. |
| B11 | Zet *Line breaks in read mode* aan, ⌘Q, start opnieuw, ⇧⌘P. | De toggle staat nog aan, en de tabvolgorde uit A11 is bewaard. Zet de toggle terug uit. |
| B12 | Nieuwe tab, typ iets, ⌘S. Typ in het naamveld `zz-mac-test/x` en daarna de naam van een notitie die al bestaat. Esc. | *Save* is uit en de balk zegt waarom: een map in de naam (gebruik *Other folder…*), een naam die al bestaat. |

## M. Alleen op een echte Mac (C)
De punten van `docs/releasing.md` → *Manual checklist* die de runner niet kan beoordelen.

| ID | Doe | Verwacht |
|---|---|---|
| M1 | ⇧⌘P één keer, met de cursor in de notitie. Daarna menubalk → View → *Command Menu…*. | Het menu opent en blijft open, beide keren. |
| M2 | Eerste start: sluit alle testtabs met ⌘W tot er één lege tab is. | Een hint met ⌃⇧⌘4, ⌘V, ⌘S en de thumbnail-tip. De knoppen sluiten, minimaliseren en zoomen staan links in de balk. Het venster sleept aan het lege deel van de balk; de groene knop gaat naar volledig scherm en terug. |
| M3 | ⇧⌘4, selecteer een stuk, sleep de zwevende thumbnail in de notitie. | Het beeld landt waar je het loslaat. |
| M4 | Sleep een `.md` uit `zz-mac-test` op het Dock-icoon, en daarna op het venster. In Terminal: `open -a SnipMD ~/Documents/Notes/zz-mac-test/taken.md`. | Elke keer een tab in het lopende venster. |
| M5 | De toetsen: ⌘T en ⌘N, ⌘W, ⇧⌘T, ⌃Tab, ⌘1…⌘9, ⌘E, ⌘F, ⌘⌥F, ⇧⌘V (tekst van een webpagina), en in een notitie ⌃A en ⌃E. | Elke toets doet wat `docs/releasing.md` punt 7 zegt. |
| M6 | Open 5 tabs met samen 20 screenshots. Kijk in Activity Monitor naar *SnipMD* en *SnipMD Web Content*. | Samen minder dan 120 MB. |
| M7 | Licht en donker: alleen als de tester het thema omzet (CT1). Anders: beoordeel wat er is. | Menu, codekleuren, Copy-knop en Snip gestijld en leesbaar. |

## CT. Claude met de tester
| ID | De tester doet | Claude doet en verwacht | Waarom de tester |
|---|---|---|---|
| CT1 | Zet System Settings → Appearance op Light, en later op Dark. | Screenshots van het menu, een codeblok met *Copy* en Snip in beide. Snip heeft in licht witte ogen met een donkere pupil, in donker donkere ogen met een witte glans. | Een systeeminstelling. |
| CT2 | Beantwoordt de prompt over toegang tot Documents, als die komt bij de eerste opslag. | Claude schrijft de tekst letterlijk over en bewaart daarna. Een `.md` en een `.assets`-map staan naast elkaar in Finder. | Een prompt van macOS. |
| CT3 | Alleen als Documents met iCloud synchroniseert: niets. | Claude bewerkt een bewaarde notitie 5 minuten lang, af en toe. Er verschijnt geen balk dat de notitie buiten SnipMD veranderde. | Alleen een iCloud-Mac. |

## T. Alleen de tester
| ID | Doe | Verwacht | Waarom niet Claude |
|---|---|---|---|
| T1 | ⇧⌘P, houd Enter 2 seconden ingedrukt op een toggle. | De toggle verandert één keer. | Computer use kan geen toets vasthouden. |
| T2 | Typ iets en meld je meteen af (Apple-menu → Log Out), terwijl SnipMD open is. Meld je aan en start SnipMD. | De tekst is terug. | Afmelden beëindigt de Claude-sessie. |
| T3 | Gebruik SnipMD een tijdje naast native apps. | Noteer wat traag of vreemd aanvoelt, en of Snip leest als een krab. | Een oordeel over gevoel. |
| T4 | Alleen met een Intel-Mac: I2, I4, S3 en een ⌘Q direct na typen. | Hetzelfde als op Apple Silicon. | Een tweede Mac. |

## Rapport
Claude schrijft één Markdown-bestand `snipmd-mac-test-<datum>.md`:
1. de gegevens uit stap 0;
2. een tabel `| ID | OK/FOUT/NIET GETEST | wat je zag | screenshot |` voor I, S, A, B, M en CT;
3. per FOUT: de stappen om het te herhalen, wat je verwachtte, wat er gebeurde, en het screenshot;
4. elke prompt van macOS, letterlijk;
5. wat opviel en nergens in staat.

De tester vult T1 tot T4 aan en geeft het bestand en `~/Desktop/snipmd-mac-test/` aan de eigenaar, of zet het als reactie op [#30](https://github.com/ArneVDA-AP/snipmd/issues/30). De backup uit I1 mag blijven staan tot de eigenaar zegt dat hij weg mag.
