# SnipMD – testplan Windows 11 (27 oktober 2026)

Dit plan test de pre-release **SnipMD v1.1.0-4**. Nieuw in deze versie zijn Snips bewegingen: hij loopt naar de tab waar iets gebeurt, er komt een vriendje na een dutje, en hij kijkt af en toe rond. Verder test het plan de update vanaf 1.1.0-3 en de stappen die in de test van 26 oktober bleven liggen (`findings/windows/w11-20261026.md` op `test/w11-20261026`).

De app-code is sinds 1.1.0-3 alleen in Snip veranderd (#71, #73). De kern (opslaan, beelden, `evil.md`, leesmodus) en de hertest van de naamcontrole slaagden op 26 oktober en staan daarom niet opnieuw in dit plan. Alleen het herstarten (K1) blijft.

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
| R1 | Typecheck, unit tests en core tests op de tag. | *Release Windows* run 14 op `v1.1.0-4` (8aed99b). |
| R2 | Bouw van de release op `windows-latest`, installer onder 10 MB. | Zelfde run: `SnipMD_1.1.0-4_x64-setup.exe` is 1,55 MB. |
| R3 | Schone installatie: stil installeren, starten, verwijderen. | *Windows run* 13 op `main` (8aed99b, met `snip_sleep`), stap *Clean-install smoke test*. |
| R4 | Budgets uit SPEC §9 (start, plakken, geheugen) als referentie. Een runner is geen laptop. | Zelfde run, `results/windows-ci/`. |
| R5 | Screenshots van het echte venster in licht en donker, met Snip slapend in beide thema's. | Zelfde run, branch `test/windows-run-13`. |

Run 13 bouwt `main` op 8aed99b, dezelfde commit als de tag. Een runner maakt stilstaande beelden: of het lopen goed oogt, beoordeelt alleen deel W.

## Regels voor de Claude-sessie
- De tester gebruikt SnipMD elke dag, en de sessie bevat de tabs van de tester:
  - Werk alleen in tabs die je zelf opent, en sluit alleen die.
  - Bewaar testnotities alleen in `Documents\Notes\zz-w11-test\`.
  - Verander niets aan de standaard-app voor `.md`.
- **Start de setup en SnipMD altijd via Verkenner of het Startmenu, nooit vanuit de shell van de Claude-sessie.** Op 26 oktober leidde Windows een setup die vanuit die shell startte om naar het pakket van de Claude-app (opmerking 1 van dat rapport).
- Wijzig geen Windows-instellingen; dat doet de tester in de CT-stappen. Verschijnt er een prompt van SmartScreen, UAC of iets anders, stop dan, schrijf de tekst letterlijk over en vraag de tester.
- Snip speelt alleen in een venster met focus. Zet SnipMD vooraan voor je een beweging beoordeelt, en houd het daar tot de beweging klaar is.
- **Bewegingen vastleggen.** Snip is 22 px hoog en een wandeling duurt hoogstens 1,4 s. Neem voor elke W-stap een reeks beelden van de tabbalk, ongeveer om de 50 ms, zoals op 26 oktober. Begin vóór de handeling en stop als Snip weer thuis staat. Bewaar de reeks als `<ID>-<nnn>.png` en kies er de beelden uit die het verloop tonen. Vergroot uitsneden rond Snip 8× (naaste buur, niet vervaagd). Bereken tijden uit de tijdstempels van de beelden.
- Maak na elke stap een screenshot. Bewaar ze als `<ID>.png` in `Desktop\snipmd-w11-test\20261027\`.
- Iets onverwachts? Noteer het, maak een screenshot, en ga verder. Herstart SnipMD alleen als de tester dat goedkeurt.

## Begrippen
- **Thuis**: Snips vaste plek, rechts van de `+`-knop.
- **Moment**: een beeld komt in een notitie (plakken of slepen), een gesloten tab komt terug, of een notitie veranderde buiten SnipMD. Typen is nooit een moment.
- **Plek op een tab**: net links van het sluitkruisje (×) van die tab. Het kruisje blijft vrij.

## 0. Gegevens (C)
Noteer: de Windows-versie en build, de schermschaal per scherm, het toetsenbord, muis of touchpad, het thema, de stand van *Animatie-effecten* (Instellingen → Toegankelijkheid → Visuele effecten), en de SnipMD-versie die nu geïnstalleerd is.

## I. Installeren over de vorige versie (C)
De setup toont bij elke update de pagina *Already Installed* (#74). Op 26 oktober is de standaardkeuze *Uninstall before installing* getest. Deze keer volgt de test de andere keuze.

| ID | Doe | Verwacht |
|---|---|---|
| I1 | Kopieer `%APPDATA%\com.snipmd.desktop\` naar `Desktop\snipmd-backup-20261027\`. Vergelijk het aantal bestanden en bytes. | Een volledige backup. |
| I2 | Laat SnipMD open met de tabs van de tester. Download van https://github.com/ArneVDA-AP/snipmd/releases de pre-release **SnipMD v1.1.0-4** (niet *Latest*), bestand `SnipMD_1.1.0-4_x64-setup.exe`. Start het met een dubbelklik in Verkenner. Kies op *Already Installed* **Do not uninstall**. | De setup vraagt SnipMD te sluiten, of sluit het. De installatie lukt zonder UAC-prompt. SmartScreen kan waarschuwen: vraag de tester. Schrijf elke pagina en prompt letterlijk over. |
| I3 | Instellingen → Apps → Geïnstalleerde apps, zoek `SnipMD`. | Eén SnipMD, versie 1.1.0-4. |
| I4 | Start SnipMD via het Startmenu. | De tabs van de tester komen terug. Snip staat thuis. |

## W. Snip loopt (C)
Voorbereiding: open drie testtabs (Ctrl+T), elk met een regel tekst. Bewaar ze als `zz-w11-test\w1`, `w2` en `w3`. Ze staan nu rechts in de tabbalk, met `w3` het dichtst bij Snip. Zet daarna met de muis `w1` vooraan in de rij (slepen), zodat `w1` ver van Snip staat.

| ID | Doe | Verwacht |
|---|---|---|
| W1 | Maak `w1` actief. `Win+Shift+S`, knip een stuk scherm, `Ctrl+V`. | Het beeld verschijnt. Snip loopt zijwaarts naar `w1`: één cel per stap, traag bij het vertrekken en het stoppen, en hij kijkt in de looprichting. Hij stopt net links van het × van `w1` en klapt daar. Daarna loopt hij terug, staat thuis even stil met de blik over de balk, en draait dan om. Elke richting duurt hoogstens 1,4 s. Geen sprongen, geen vage randen tijdens het lopen. |
| W2 | Maak een beeld uit de reeks van W1 waarin Snip bij `w1` staat, en vergroot het. | Het × van `w1` is volledig zichtbaar; Snip bedekt het niet. Snip staat op dezelfde hoogte als thuis. |
| W3 | Sluit `w3` (Ctrl+W), maak `w1` actief, druk `Ctrl+Shift+T`. | `w3` komt terug. Snip loopt naar `w3`, is daar opgelucht (ogen dicht, scharen omlaag) en loopt terug. De korte afstand duurt korter dan W1. |
| W4 | Maak `w1` actief. Verplaats `w2.md` in Verkenner naar de Prullenbak. Ga terug naar SnipMD. Klik, terwijl Snip bij `w2` staat, op de titel van `w2`, op de plek waar Snip staat. | De balk zegt dat `w2.md` niet meer op schijf staat, met *Save again*. Snip loopt naar `w2` en kijkt daar ongerust, ongeveer 4 s; de balk blijft staan. De klik maakt `w2` actief: Snip zit de klik niet in de weg. Daarna loopt hij terug. Klik *Save again*. |
| W5 | Verplaats `w1.md` en `w3.md` samen in Verkenner naar de Prullenbak (één selectie). Ga terug naar SnipMD. | Twee balken. Snip vertrekt naar één van de twee tabs. Komt het tweede moment terwijl hij loopt, dan loopt hij vanaf waar hij staat naar de andere tab, zonder sprong en zonder eerst naar huis te gaan. Hij kijkt ongerust bij de tab van het laatste moment en komt daarna één keer thuis. Noteer welke tab hij eerst koos. Klik in beide balken *Save again*. |
| W6 | Open zoveel tabs (Ctrl+T) dat de tabbalk scrollt en `w1` niet meer zichtbaar is. Verplaats `w1.md` naar de Prullenbak en ga terug naar SnipMD. | Snip loopt niet: hij kijkt thuis ongerust. Klik *Save again* en sluit de extra tabs. |
| W7 | Typ 30 s in `w1`, met SnipMD vooraan. | Snip blijft thuis. Typen is geen moment; ademen, knipperen en rondkijken mogen. |
| W8 | Doe 2 minuten niets, met SnipMD vooraan. Neem om de 250 ms een beeld van Snip. | Snip ademt en knippert. Af en toe kijkt hij ongeveer 1 s naar rechts, op onregelmatige tijden 20 tot 45 s uit elkaar: in 2 minuten 2 tot 6 keer. Noteer de tijden. |
| W9 | Zet Snip uit (`Ctrl+Shift+P`, `snip`, Enter op *Show Snip*, Esc) en plak een beeld in `w1`. Zet Snip weer aan. | Uit: Snip en zijn plek zijn weg, en er loopt niets door de balk. Aan: Snip staat thuis. |

## N. Dutje en vriendje (C)
| ID | Doe | Verwacht |
|---|---|---|
| N1 | Bewaar 10 minuten niets: typ niet en plak niets. SnipMD bewaart 1 s na het typen en bij het wisselen van venster, dus elke toets herstart de klok. Zet SnipMD daarna vooraan. | Snip slaapt: liggend, ogen dicht, met een losse Z boven zijn rug die de rug niet raakt. |
| N2 | Neem een beeldreeks en druk `Ctrl+S` in `w1`. | Er komt een vriendje van rechts binnen, vanaf de rand van het venster: dezelfde krab met de kleuren omgewisseld (limoengroen lijf, paarse scharen). Het tikt Snip wakker, Snip draait zich naar het vriendje, ze klappen samen en ze zwaaien. Het vriendje loopt naar rechts weg en Snip kijkt het na. Daarna staat Snip thuis zoals gewoonlijk, zonder vriendje. Noteer hoe lang het geheel duurt. |
| N3 | Zet eerst een knipsel op het klembord (`Win+Shift+S`). Wacht weer op het dutje, zoals in N1. Druk `Ctrl+S` in `w1` en direct daarna, terwijl het vriendje er is, `Ctrl+V`. | Het beeld verschijnt. Snip loopt naar `w1` en klapt. Het vriendje loopt weg zonder dat iets blijft hangen. Op het einde staat er één Snip thuis en geen vriendje. |
| N4 | Vergelijk je uitsneden uit N1 met `snip-sleep-light` en `snip-sleep-dark` uit R5. | Dezelfde tekening; beide screenshots verschillen van elkaar (licht en donker). |
| K1 | Sluit SnipMD (met toestemming) en start het opnieuw via het Startmenu. | De tabs komen terug, de testtabs ook. Snip staat thuis. |

N3 hangt van een snelle tweede toets af. Lukt de timing niet, noteer dan hoeveel seconden er tussen `Ctrl+S` en `Ctrl+V` zat.

## CT. Claude met de tester
| ID | De tester doet | Claude doet en verwacht | Waarom de tester |
|---|---|---|---|
| CT1 | Zet Windows op licht thema, en later terug op donker. | Screenshots van het menu, een codeblok met *Copy* en Snip. Herhaal W1 in licht thema. Alles is gestijld en leesbaar. Snip heeft in licht witte ogen met een donkere pupil, in donker donkere ogen met een witte glans; ook tijdens het lopen. | Claude wijzigt geen Windows-instellingen. Bleef open op 26 oktober. |
| CT2 | Zet de schermschaal achtereenvolgens op 125, 150 en 200%. | Herhaal na elke stap W1 en neem uitsneden van Snip thuis en bij `w1`, 8× vergroot. Elke cel is even groot, zonder vage of halve pixels, ook midden in een wandeling. Snip stopt telkens links van het × zonder het te raken. | Instelling. |
| CT3 | Zet de schermschaal zo dat het venster bij de eerste start verkleind moet worden, en start SnipMD. | Het venster valt volledig binnen het scherm. | Instelling. |
| CT4 | Steek een USB-stick in. Trek hem uit wanneer Claude dat vraagt, en steek hem terug wanneer Claude dat vraagt. | Claude bewaart een testnotitie op de stick en typt verder; na het uittrekken typt hij nog wat. Een foutbalk meldt dat het schrijven mislukte. De tab blijft onbewaard, de tekst blijft staan en de andere tabs werken door. Na het terugsteken lukt bewaren weer. | Fysieke handeling. |
| CT5 | Zet *Animatie-effecten* uit (Instellingen → Toegankelijkheid → Visuele effecten). Later weer aan. | Herhaal W1, W3 en N1 tot N2 met de effecten uit. Snip loopt niet: hij speelt elk moment thuis en toont van elke beweging één stilstaand beeld. Hij kijkt niet rond. Na het dutje wordt hij gewoon wakker, zonder vriendje. Met de effecten weer aan loopt hij weer (W1). | Instelling. |

## T. Alleen de tester
| ID | Doe | Verwacht | Waarom niet Claude |
|---|---|---|---|
| T1 | `Ctrl+Shift+P`, houd Enter 2 seconden ingedrukt op een toggle. | De toggle verandert één keer. | Computer use kan geen toets vasthouden. |
| T2 | Alleen met een AZERTY-toetsenbord: `Ctrl+1` en `Ctrl+2` (de toetsen `&` en `é`). | Tab 1 en tab 2. | Claude stuurt geen fysieke toetsen van een andere layout. Zonder AZERTY: NIET GETEST. |
| T3 | Werk een dag gewoon met SnipMD, met veel geplakte screenshots. | Snip stoort niet, ook niet als hij vaak loopt. De titels blijven leesbaar en de balk voelt niet onrustig tijdens het typen. Het vriendje is leuk, niet storend. Noteer wat opvalt. | Een oordeel over gevoel. Dit is de vraag uit #72: is één lopende Snip rustig genoeg? |

## Rapport
Claude schrijft één bestand `findings/windows/w11-20261027.md` op de branch `test/w11-20261027`, of geeft het aan de tester als de sessie niet kan pushen:
1. de gegevens uit stap 0;
2. een tabel `| ID | OK/FOUT/NIET GETEST | wat je zag | screenshot |` voor R, I, W, N, K1 en CT, met de gemeten tijden van elke wandeling;
3. per FOUT: de stappen, wat je verwachtte en wat er gebeurde;
4. prompts letterlijk;
5. wat opviel.

De tester vult T1 tot T3 aan in hetzelfde bestand. Laat de backup uit I1 staan tot de tester zegt dat hij weg mag. Sluit op het einde de testtabs en laat de notities in `zz-w11-test\` staan.
