# SnipMD – testplan Windows 11 (23 oktober 2026)

Voor de testsessie op de pc van de eigenaar: Claude met computer use, met de eigenaar erbij. Het plan test de pre-release **SnipMD v1.1.0-1**.
- **A:** de punten uit het Mac-rapport, nu op Windows.
- **B:** de nieuwe functies.
- **C:** wat alleen in de echte app te zien is.
- **E:** de drie restpunten uit de vorige Windows-test.

Elke stap heeft een ID, wat je doet en wat je hoort te zien. Rapporteer elke ID als **OK**, **FOUT** (met wat er wel gebeurde) of **NIET GETEST** (met de reden).

## Regels voor de Claude-sessie
- De eigenaar gebruikt SnipMD dagelijks, en zijn sessie bevat zijn eigen tabs:
  - Werk alleen in tabs die je zelf opent, en sluit alleen die.
  - Bewaar testnotities alleen in `Documents\Notes\zz-w11-test\`.
  - Verander niets aan de standaard-app voor `.md`; dat is Sublime Text.
- Wijzig geen Windows-instellingen. Verschijnt er een prompt van SmartScreen, UAC of iets anders, stop dan, schrijf de tekst letterlijk over en vraag de eigenaar.
- Maak na elke stap een screenshot. Bewaar ze als `<ID>.png` in `Desktop\snipmd-w11-test\`.
- Wacht na een actie die laadt (leesmodus, een codeblok) 2 seconden voor je beoordeelt.
- Iets onverwachts? Noteer het, maak een screenshot, en ga verder. Herstart SnipMD alleen als de eigenaar dat goedkeurt: zijn tabs komen terug, maar het is zijn werk.

## 0. Gegevens
Noteer:
- Windows-versie en build;
- schermschaal (100, 150 of 200%);
- toetsenbord (AZERTY of QWERTY);
- muis, touchpad of beide;
- de SnipMD-versie die nu geïnstalleerd is.

## I. Installatie
| ID | Doe | Verwacht |
|---|---|---|
| I1 | Kopieer `%APPDATA%\com.snipmd.desktop\` naar `Desktop\snipmd-backup-20261023\`. Vergelijk het aantal bestanden en bytes. | Er is een volledige backup. |
| I2 | Sluit SnipMD. Ga naar https://github.com/ArneVDA-AP/snipmd/releases en neem **SnipMD v1.1.0-1**, gemarkeerd *Pre-release*, bovenaan de lijst. Neem niet *Latest*: dat is nog v1.0.0. Download `SnipMD_1.1.0-1_x64-setup.exe` en installeer over de bestaande versie heen. | Geen UAC-prompt; SmartScreen kan waarschuwen: vraag de eigenaar. De installatie lukt. |
| I3 | Start SnipMD via de snelkoppeling. | De tabs van de eigenaar komen terug. |
| I4 | Ctrl+T voor een testtab, dan Ctrl+Shift+P. | Bovenaan, onder de tabbalk, verschijnt een balk met "Type a command" en een lijst. Dat bewijst dat dit de nieuwe build is. Druk Esc. |

## A. Editor (punten uit het Mac-rapport)
Werk in een testtab.

| ID | Doe | Verwacht |
|---|---|---|
| A1 | Typ `> een citaat`, Enter, nog eens Enter, typ `verder`. | Het citaat stopt: er volgt een lege regel, en `verder` staat zonder `>`. |
| A2 | `- item een`, Enter, `item twee`, Enter, Tab, `genest item`, Enter, Enter. | Het lege geneste item springt terug naar `- `, zonder lege regel. |
| A3 | `- [ ] taak open` en `- [x] taak klaar`, Ctrl+E. | Alleen een vinkvak, geen bolletje. Ctrl+E terug. |
| A4 | Ctrl+F, `item`, klik in het vervangveld, typ `punt`, klik *Replace all*, Esc. | De zoekbalk sluit. |
| A5 | Ctrl+F, typ `item`. | Geen rode spellingslijn en geen voorstellen van het "Saved info"-venster. Esc. |
| A6 | Typ `1. een` … `5. vijf` (Enter tussen elk). Selecteer de regel `3. drie` (Home, Shift+↓) en druk Backspace. | De nummers lopen 1, 2, 3, 4. |
| A7 | Aan het einde van `4. vijf`: Enter, Tab, `sub a`, Enter, `sub b`, Enter, Shift+Tab, `terug`. | `   1. sub a`, `   2. sub b`, `5. terug`. Ctrl+E toont een echte sublijst. Ctrl+E terug. |
| A8 | `1. a`, `2. b`, `3. c`. Maak `b` leeg, zodat `2. ` overblijft, en druk Backspace tot de regel weg is. Tel de keren. | Twee keer. Daarna heet `c` weer `2.`. |
| A9 | Twee regels zonder lege regel ertussen, Ctrl+E. | Eén regel in leesmodus. Ctrl+E, Ctrl+Shift+P, typ `line`, Enter, Esc, Ctrl+E: nu twee regels. Zet de toggle terug uit. |
| A10 | Open drie testtabs (Ctrl+T) en sluit ze (Ctrl+W). Ctrl+T. | `Untitled-N` met het laagste vrije nummer, niet steeds hoger. |
| A11 | Open drie testtabs. Sleep met de muis de laatste testtab links op de eerste testtab. | Tijdens het slepen staat er een blauwe streep op de landingsplek. De tab staat daarna op die plek. |
| A12 | Ctrl+Shift+PageDown, daarna Ctrl+Shift+PageUp. | De actieve tab schuift één plaats naar rechts en dan terug. |

## B. Nieuwe functies
| ID | Doe | Verwacht |
|---|---|---|
| B1 | Ctrl+Shift+P, typ `save`. | Alleen rijen met "save", elk met zijn toets (Ctrl+S, Ctrl+Shift+S). |
| B2 | Wis het veld, ↓/↑, Enter op *New Tab*. | Het menu sluit en er opent een tab. |
| B3 | Ctrl+Shift+P, `copy`, Enter op *Copy button on code blocks*. | Het vinkje gaat weg en het menu blijft open. Enter: het vinkje is terug. Esc: de cursor staat in de notitie. |
| B4 | Ctrl+Shift+P, houd Enter 2 seconden ingedrukt op een toggle. | De toggle verandert één keer. |
| B5 | Klik met de muis een rij in het menu. | Die rij wordt uitgevoerd, en de focus blijft in het tekstveld. |
| B6 | Codeblokken ```` ```js ```` (`const x = 1;`), ```` ```python ```` (`def f(): return 1`) en ```` ```powershell ````. | `js` en `python` krijgen kleur binnen 2 seconden. `powershell` blijft één kleur: het staat niet in de lijst. |
| B7 | ```` ```scss ```` en ```` ```klingon ````. | Eén kleur. |
| B8 | Ctrl+E. | Dezelfde kleuren. Met de muis over een blok verschijnt *Copy* rechtsboven. |
| B9 | Klik *Copy* op het js-blok, plak (Ctrl+V) in Kladblok. | Precies `const x = 1;`, en de knop toonde kort *Copied*. Lukt het niet, dan verschijnt een foutbalk in SnipMD: noteer de tekst. |
| B10 | `- [ ] a` en `- [ ] b`, Ctrl+E, klik het vakje van `a`. | Aangevinkt. Ctrl+E: `- [x] a`, en Ctrl+Z draait het terug. |
| B11 | Bewaar de testnotitie (Ctrl+S, `zz-w11-test\taken`). Zet ze in leesmodus. Wijzig het bestand in Kladblok: `- [ ] b` bovenaan, bewaar. Terug naar SnipMD, en wacht 3 seconden. | De leesmodus toont de nieuwe volgorde. Klik het vakje van `b`: alleen `b` wordt aangevinkt. |
| B12 | Ctrl+F, `a`, wacht even, druk Enter een paar keer. | "N matches", daarna "1 of N", "2 of N". |
| B13 | Zet *Match count in find* uit, Esc, Ctrl+F. | Geen teller. Zet hem terug aan. |
| B14 | Zet *Line breaks in read mode* aan, sluit SnipMD en start opnieuw (met toestemming van de eigenaar), Ctrl+Shift+P. | De toggle staat nog aan. Zet hem terug uit. |
| B15 | Sluit SnipMD na A11 en start opnieuw (met toestemming). | De nieuwe tabvolgorde is bewaard. |

## C. Alleen in de echte app
| ID | Doe | Verwacht |
|---|---|---|
| C1 | Ctrl+P zonder Shift. | Er gebeurt niets: geen afdrukvenster. |
| C2 | Bekijk het menu, de codekleuren en de Copy-knop in licht en donker (Instellingen → Persoonlijke instellingen → Kleuren; laat de eigenaar dat omzetten). | Alles is gestijld en leesbaar en hoort bij het thema. Een ongestijld onderdeel (standaardknop, zwarte tekst in donker) wijst op de CSP van de release-build. |
| C3 | Sleep een testtab met de muis en met het touchpad. Laat één keer los boven de notitie. | De tab verplaatst zich, of blijft staan. Een gewone klik op een tab werkt daarna nog. Middenklik sluit nog. |
| C4 | F6 met het menu open (Ctrl+Shift+P). | De focus gaat tussen de notitie, het menu en de tabbalk. Esc sluit het menu. |
| C5 | Plak een screenshot (Win+Shift+S, Ctrl+V) in een testtab met een codeblok erboven. | Het beeld verschijnt zoals vroeger, en de codekleuren blijven staan. |

## E. Restpunten uit de vorige Windows-test (ROADMAP)
| ID | Doe | Verwacht |
|---|---|---|
| E1 | Op een AZERTY-toetsenbord: Ctrl+1 en Ctrl+2 (de toetsen `&` en `é`). | Ctrl+1 gaat naar tab 1, Ctrl+2 naar tab 2. |
| E2 | Alleen met de eigenaar: bewaar een testnotitie op een USB-stick, typ verder en trek de stick uit. Typ nog wat, steek de stick terug. | Een foutbalk meldt dat het schrijven mislukte. De tab blijft onbewaard, de tekst blijft staan, en andere tabs en de sessie werken door. Na het terugsteken lukt bewaren weer. |
| E3 | Zet de schermschaal zo dat het venster bij de eerste start verkleind moet worden. Dit vraagt de eigenaar; anders NIET GETEST. Start SnipMD. | Het venster valt volledig binnen het scherm, niet 7 px te hoog. |

## Rapport
Eén Markdown-bestand `findings/windows/w11-20261023.md` op de branch `test/w11-20261023`. Of geef het bestand aan de eigenaar als de sessie niet kan pushen.

Inhoud:
1. de gegevens uit stap 0;
2. een tabel `| ID | OK/FOUT/NIET GETEST | wat je zag | screenshot |` voor I, A, B, C en E;
3. per FOUT: de stappen, wat je verwachtte, wat er gebeurde;
4. prompts letterlijk;
5. wat opviel.

Laat de backup uit I1 staan tot de eigenaar zegt dat hij weg mag.

De runner-run *Windows run* op `main` van 23 oktober maakt al screenshots van het echte venster. Vergelijk C2 daarmee als je twijfelt of iets aan de CSP ligt.
