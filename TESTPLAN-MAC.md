# SnipMD – testplan Mac (23 oktober 2026)

Voor de Mac-tester en zijn Claude-sessie met computer use. Het plan test de build van `main` na PR #47 en #48:
- **Hertest:** de 12 punten uit het testrapport van 23 oktober.
- **Nieuw:** het commandomenu, syntax highlighting, de extra's in leesmodus, tabs verslepen en de zoekteller.
- **Checklist:** de handmatige macOS-checklist, die nog nooit gedaan is.

Elke stap heeft een ID, wat je doet en wat je hoort te zien. Rapporteer elke ID als **OK**, **FOUT** (met wat er wel gebeurde) of **NIET GETEST** (met de reden).

## Regels voor de Claude-sessie
- Werk alleen in SnipMD, Finder, Terminal, Activity Monitor en, voor P5, Safari.
- Bewaar testnotities alleen in `~/Documents/Notes/zz-mac-test/`. Open, bewerk of verwijder geen andere bestanden.
- Wijzig geen systeeminstellingen. De enige uitzondering is *Open Anyway* bij de eerste start (I3). Verschijnt er een andere prompt (toegang tot Documents, toegankelijkheid, schermopname), stop dan, schrijf de tekst letterlijk over en vraag de mens wat te doen.
- Maak na elke stap een screenshot. Bewaar ze als `<ID>.png` in `~/Desktop/snipmd-mac-test/`.
- Tik toetsen precies zoals ze er staan. ⌘ = Command, ⌥ = Option, ⇧ = Shift, ⌃ = Control.
- Wacht na een actie die laadt (leesmodus, een codeblok) 2 seconden voor je beoordeelt.
- Iets onverwachts (een crash, een venster dat niet reageert)? Noteer het, maak een screenshot, herstart SnipMD en ga verder.

## 0. Gegevens
Noteer bovenaan het rapport:
- het Mac-model;
- de chip (Apple Silicon of Intel);
- de macOS-versie;
- de schermresolutie en of het een Retina-scherm is;
- of *Desktop & Documents* met iCloud synchroniseert.

## I. Installatie
| ID | Doe | Verwacht |
|---|---|---|
| I1 | Verwijder een eventuele oude SnipMD uit Applications. Laat `~/Library/Application Support/com.snipmd.desktop/` staan, maar kopieer die map eerst naar `~/Desktop/snipmd-backup/`. | Er is een backup. |
| I2 | Open de `.dmg` die de eigenaar doorgaf: artifact `SnipMD-macos-universal` van de run *Release macOS* op `main` van 23 oktober. Sleep SnipMD naar Applications. | SnipMD staat in Applications. |
| I3 | Start SnipMD. Weigert macOS de start, ga dan naar System Settings → Privacy & Security → *Open Anyway*. | SnipMD start. |
| I4 | Druk ⇧⌘P. | Bovenaan, onder de tabbalk, verschijnt een balk met een tekstveld "Type a command" en een lijst. Dat bewijst dat dit de nieuwe build is. Druk Esc. |

## A. Hertest van het rapport
Werk in een nieuwe tab (⌘T).

| ID | Doe | Verwacht |
|---|---|---|
| A1 | Typ `> een citaat`, Enter, nog eens Enter, typ `verder`. | Na de tweede Enter is het citaat voorbij: er volgt een lege regel, en `verder` staat zonder `>` op de regel daarna. |
| A2 | Typ `- item een`, Enter, `item twee`, Enter, Tab, `genest item`, Enter, Enter. | Na de laatste Enter springt het lege geneste item terug naar het hoogste niveau (`- `), zonder lege regel ertussen. |
| A3 | Zet in de tekst `- [ ] taak open` en `- [x] taak klaar` onder elkaar, druk ⌘E. | In leesmodus staat bij elke taak alleen een vinkvak, geen bolletje ervoor. Druk ⌘E terug. |
| A4 | ⌘F, typ `item`. Klik in het vervangveld, typ `punt`, klik *Replace all*, druk Esc. | De zoekbalk sluit. |
| A5 | ⌘F, typ `item` in het zoekveld. | macOS stelt geen autocorrectie voor (zoals `Item`), en er komt geen rode spellingslijn. Druk Esc. |
| A6 | Typ een genummerde lijst: `1. een`, Enter, `twee`, Enter, `drie`, Enter, `vier`, Enter, `vijf`. Selecteer de hele regel `3. drie` (klik ervoor, ⇧↓) en druk Backspace. | De nummers lopen 1, 2, 3, 4: `vier` heet nu `3.` en `vijf` heet `4.`. |
| A7 | Ga in die lijst naar het einde van `4. vijf`, Enter, Tab, typ `sub a`, Enter, `sub b`, Enter, ⇧Tab, typ `terug`. | Je ziet `   1. sub a` en `   2. sub b`, drie spaties ingesprongen, en daarna `5. terug`. ⌘E toont in leesmodus een echte sublijst onder `vijf`. Druk ⌘E terug. |
| A8 | Zet `1. a`, `2. b`, `3. c` onder elkaar. Maak `b` leeg, zodat `2. ` overblijft, en druk Backspace tot de regel weg is. Tel de keren. | Na de eerste Backspace is de regel leeg; de tweede voegt hem samen met de regel erboven. Daarna heet `c` weer `2.`. |
| A9 | Zet twee regels zonder lege regel ertussen. ⌘E. | Ze staan in leesmodus op één regel; zo werkt CommonMark. Ga terug, ⇧⌘P, typ `line`, Enter, Esc, ⌘E: nu staan ze op twee regels. Zet de toggle daarna terug uit. |
| A10 | Open drie nieuwe tabs (⌘T) en sluit ze alle drie (⌘W). Open dan een nieuwe tab. | De nieuwe tab heet `Untitled-N` met het laagste nummer dat geen andere tab gebruikt, ook geen gesloten tab die nog te herstellen is. Niet `Untitled-54`. |
| A11 | Open drie tabs. Sleep met de muis de laatste tab naar links, op de eerste. | Tijdens het slepen staat er een blauwe streep op de plek waar de tab landt. Na het loslaten staat de tab vooraan. |
| A12 | Druk ⇧⌘PageDown; zonder PageDown-toets is dat fn⇧⌘↓. | De actieve tab schuift één plaats naar rechts. ⇧⌘PageUp (fn⇧⌘↑) schuift hem terug. Sluit SnipMD (⌘Q) en start opnieuw: de volgorde is bewaard. |

## B. Nieuwe functies
| ID | Doe | Verwacht |
|---|---|---|
| B1 | ⇧⌘P. Typ `save`. | Alleen rijen met "save" erin, en elke rij toont zijn toets (⌘S, ⇧⌘S). |
| B2 | Wis het veld, gebruik ↓ en ↑, kies *New Tab* met Enter. | Het menu sluit en er opent een nieuwe tab. |
| B3 | ⇧⌘P, typ `copy`, druk Enter op *Copy button on code blocks*. | Het vinkje verdwijnt en het menu blijft open. Druk nog eens Enter: het vinkje is terug. Esc sluit het menu, en de cursor staat weer in de notitie. |
| B4 | ⇧⌘P, en houd Enter 2 seconden ingedrukt op een toggle. | De toggle verandert één keer, niet heen en weer. |
| B5 | Klik een rij in het menu aan met de muis. | Die rij wordt uitgevoerd. De focus blijft in het tekstveld (je kunt meteen verder typen). |
| B6 | Typ een codeblok: ```` ```js ````, Enter, `const x = 1;`, Enter, ```` ``` ````. Doe hetzelfde met `python` (`def f(): return 1`) en `bash` (`echo "hi" # note`). | Binnen 2 seconden staan sleutelwoorden (`const`, `def`, `return`), strings en commentaar in kleur, in licht en in donker thema. |
| B7 | Een codeblok met ```` ```scss ```` en een met ```` ```klingon ````. | Beide blijven één kleur (SPEC: andere namen blijven platte code). |
| B8 | ⌘E. | De codeblokken zijn in leesmodus op dezelfde manier gekleurd. Ga met de muis over een codeblok: rechtsboven verschijnt *Copy*. |
| B9 | Klik *Copy* op het js-blok en plak (⌘V) in TextEdit. | Er komt precies `const x = 1;` in TextEdit, en de knop toonde kort *Copied*. Lukt het kopiëren niet, dan verschijnt een foutbalk in SnipMD; noteer de tekst. |
| B10 | Zet in een notitie `- [ ] a` en `- [ ] b`, ⌘E, klik het vakje van `a`. | Het vakje wordt aangevinkt. ⌘E terug: de tekst is `- [x] a`, en ⌘Z maakt het ongedaan. |
| B11 | Bewaar de notitie (⌘S, naam `zz-mac-test/taken`). Ga naar leesmodus (⌘E). Wijzig het bestand intussen buiten SnipMD in TextEdit: zet `- [ ] b` bovenaan en `- [ ] a` eronder, bewaar. Ga terug naar SnipMD en wacht 3 seconden. | De leesmodus toont de nieuwe volgorde. Klik het vakje van `b`: alleen `b` wordt aangevinkt, nooit `a`. |
| B12 | ⌘F, typ `a` in een notitie met een paar a's, en wacht een halve seconde. | Rechts van het zoekveld staat bijvoorbeeld "3 matches". Druk Enter (volgende): het wordt "1 of 3", "2 of 3" enzovoort. |
| B13 | ⇧⌘P, zet *Match count in find* uit, Esc. Sluit en open de zoekbalk (Esc, ⌘F). | Er is geen teller meer. Zet de toggle daarna weer aan. |
| B14 | Zet *Line breaks in read mode* aan, sluit SnipMD (⌘Q) en start opnieuw. ⇧⌘P. | De toggle staat nog aan; toggles worden bewaard. Zet hem terug uit. |

## C. Alleen op een echte Mac te zien
| ID | Doe | Verwacht |
|---|---|---|
| C1 | ⇧⌘P één keer, terwijl de cursor in de notitie staat. | Het menu gaat open en blijft open. Gaat het open en meteen weer dicht, dan vuren zowel de menubalk als de app op de toets: noteer dat als FOUT. |
| C2 | Menubalk → View → *Command Menu…*. | Het menu gaat open. |
| C3 | Kijk naar de kleuren van het menu, de codeblokken en de Copy-knop, in licht én donker thema (System Settings → Appearance, of laat de mens dat omzetten). | Alles is leesbaar en hoort bij het thema. Niets ziet er ongestijld uit (zwarte standaardtekst op wit in donker thema, een knop zonder rand). Ongestijlde onderdelen wijzen op de CSP van de release-build. |
| C4 | Sleep een tab met de trackpad en met een muis, als die er is. Laat ook eens los boven de notitie, naast de tabbalk. | De tab verplaatst zich, of blijft staan als je naast de balk loslaat. Daarna werkt een gewone klik op een tab nog. |

## D. macOS-checklist (RELEASE-MACOS.md)
Dit is de lijst die de CI-runner niet kan beoordelen. Volg elk punt uit `RELEASE-MACOS.md` → *Manual checklist*:
- **D1 Eerste start:** de knoppen links in de balk, het thema, slepen aan de balk, volledig scherm.
- **D2 Screenshot via het klembord:** ⌃⇧⌘4, ⌘V.
- **D3 Screenshot via de thumbnail:** ⇧⌘4, sleep de thumbnail in de notitie.
- **D4 Eerste keer bewaren:** ⌘S, Enter. Schrijf een prompt over toegang tot Documents letterlijk over en vraag de mens.
- **D5 iCloud:** enkel als Documents synchroniseert. Bewerk een bewaarde notitie een paar minuten; er mag geen balk "changed outside SnipMD" verschijnen.
- **D6 Notities openen:** dubbelklik in Finder (via *Open With → SnipMD*), slepen op het Dock-icoon, slepen op het venster, `open -a SnipMD ~/Documents/Notes/zz-mac-test/taken.md`.
- **D7 Toetsen:** de hele lijst in punt 7 van de checklist.
- **D8 Niets kwijt:** typ en druk meteen ⌘Q, start opnieuw. Doe hetzelfde met afmelden alleen als de mens dat toelaat.
- **D9 Retina-scherpte.**
- **D10 Snelheid en geheugen:** met 5 tabs en 20 screenshots minder dan 120 MB voor *SnipMD* plus *SnipMD Web Content* samen in Activity Monitor.
- **D11 Intel:** D1, D2 en D8 op een Intel-Mac, als die er is.

## Rapport
Eén Markdown-bestand `snipmd-mac-test-<datum>.md`:
1. de gegevens uit stap 0;
2. een tabel `| ID | OK/FOUT/NIET GETEST | wat je zag | screenshot |` met elke ID van I, A, B, C en D;
3. per FOUT: de stappen om het te herhalen, wat je verwachtte, wat er gebeurde, en het screenshot;
4. elke prompt van macOS, letterlijk;
5. wat opviel en nergens in staat (feel naast native apps, iets dat traag aanvoelt).

Geef het bestand en de map `~/Desktop/snipmd-mac-test/` aan de eigenaar. De backup uit I1 mag blijven staan tot de eigenaar zegt dat hij weg mag.
