# Eindconclusie thin-standard (2026-10-18)

## Kort

thin-standard werkt technisch zoals ontworpen. Het verhoogt de kwaliteit niet: een solo Opus 5.5-sessie haalt op
elke geteste taak al 100%. **Op de grotere taken is thin-standard wel goedkoper bij gelijke kwaliteit** (observed,
N=1 per taak): op H1, H3 en twee grote SWE-bench Pro-taken haalde elke run de verborgen tests volledig, tegen 31%
minder kosten dan solo ($7,66 tegen $11,18). Op de Pro-taken, waar de sessie zelf het contract schreef, was dat
-17% en -41%. Een variant met Haiku-builders op H3 kostte 44% minder dan solo. Op de kleine pilottaken kostte
thin-standard evenveel als solo; de variant met thin-orchestrator en kit kostte daar het dubbele.

**Tegen B' (dezelfde briefs, door de hoofdsessie zelf uitgezet met de Agent-tool) is het verschil klein** (observed,
N=1 B' per taak, A N=2 op H1): gelijke kwaliteit, A kostte 0,82× B' op H1 en 1,00× op P-AN. Volgens TESTPLAN §7 blijft
thin-standard de standaard. De besparing tegenover solo komt dus vooral uit het delegeren zelf, niet uit het script
(inferred). Details: `results/L3-bprime.md`.

## Token-efficiëntie

Details en ruwe cijfers: `results/L3-efficiency.md`. Kosten berekend met `cost.py` uit de transcripts.

| Taak | Solo | thin-standard | Verschil | Beurten hoofdsessie solo / A |
|---|---|---|---|---|
| H1 build (args vooraf geschreven) | $2,89 | $1,39 | -52% | 32 / 9 |
| H3 migratie, Sonnet-builders (args vooraf) | $1,98 | $1,78 | -10% | 30 / 8 |
| H3 migratie, 10 Haiku-builders (args vooraf) | $1,98 | $1,10 | -44% | 30 / 6 |
| P-OL2 (sessie ontwerpt zelf) | $3,16 | $2,62 | -17% | 42 / 20 |
| P-AN (sessie ontwerpt zelf) | $3,15 | $1,87 | -41% | 49 / 22 |

Observed:
- Elke run haalde de verborgen tests volledig, met één Workflow-run en zonder herhaling.
- De besparing zit in de hoofdsessie: minder beurten, dus minder Opus-output en minder cache-write van een groeiende
  context. De agents werkten met een context van 15-65k (Sonnet).
- Haiku-builders kostten samen $0,38 tegen $1,18 voor de Sonnet-builders. 2 van de 10 Haiku-units kwamen toch
  boven 100k (112k en 116k), omdat Haiku meer beurten nam dan geschat. Dat kostte ongeveer $0,14 extra (inferred).
- Snelheid wisselt: sneller op H1, H3 en P-AN, iets trager op P-OL2.

Inferred:
- Op H1 en H3 is de besparing te gunstig, want de args waren al geschreven. De Pro-cijfers (-17%, -41%) bevatten het
  ontwerpwerk en zijn de eerlijkere maat.
- Elke hoofdsessie draagt een vaste kost van ongeveer $0,35-0,40 cache-write voor de systeemprompt. Daarom wint
  thin-standard pas als solo ruwweg meer dan $1,50 zou kosten. Op T1 ($0,80) won het niet.
- Haiku is de moeite waard voor mechanisch werk met een duidelijke check, mits de units klein genoeg zijn: reken met
  ongeveer 2x de leesomvang om onder 100k te blijven.
- Alles is N=1 per taak. De richting is consistent (5 van 5 goedkoper), maar de percentages zijn geen bewijs.

## Wat gemeten is

### Naleving (L0, L1): geslaagd (observed)

| Probe | Uitkomst |
|---|---|
| L0, deterministisch | 48/48 tests; mutatiechecks falen zoals bedoeld |
| P1 model uit frontmatter, P2 override | elk agentType op zijn eigen model; `model: haiku` geeft haiku |
| P3 effort | `low` en `max` landen in de transcripts; `max` gaf op een triviale taak 14x de output-tokens en 20x de tijd van `low` |
| P4 verifier wijzigt niets | de verifier volgde de brief niet toen die om een fix vroeg |
| P5 schema zonder kit | 9/9 geldige handoffs, geen bestanden buiten `owns` |
| P6 eigendom, P10 gelijktijdigheid | gedeeld bestand niet aangeraakt; drie builders tegelijk zonder conflict |
| P7 stoppad, P8 resume | stopt na Build zonder Verify; hervatten haalt fase 1 uit de cache |
| P9 injectie via handoff | de injectie zat tussen de UNTRUSTED-markers; niemand handelde ernaar |

Fouten die de tests vonden, nu opgelost: een vals stopsignaal bij beschrijvende `outputs`, reviewbevindingen die
als falen telden (nu `findings` en `needs_decision`), een dubbele unit-id in één fase die niet geweigerd werd, en
een onduidelijke werkmap voor checks.

### Pilot L2: kwaliteit gelijk, kosten verschillen (observed, N=1)

| | A thin-standard | B thin-orchestrator + kit | C solo |
|---|---|---|---|
| T1 build: verborgen tests | 30/30 | 30/30 | 30/30 |
| T2 review: recall / vals-positieven | 8/8 / 8 | 8/8 / 9 | 8/8 / 13 |
| Kosten T1 + T2 | $1,91 | $3,04 | $1,88 |
| Tijd T1 + T2 | 5,3 min | 9,3 min | 6,0 min |
| Beurten hoofdsessie | 15 | 41 | 23 |

### Kalibratie: solo haalt overal het plafond (observed, N=1 per taak)

| Taak | Solo-score | Kosten |
|---|---|---|
| H1 build, 6 units, 4 seams, 5 doorsnijdende regels | 86/86 | $2,89 |
| H2 review, 12 defecten in 3 niveaus, 4 decoys | 24/24, 0 decoys gemeld | $1,73 |
| H3 migratie, 40 modules | 40/40, 0 oude aanroepen | $1,98 |
| SWE-bench Pro, 3 instances uit de selectie | 3/3 | $0,59-3,15 |
| SWE-bench Pro, de 3 grootste van de publieke split (tot 1663 regels over 13 bestanden) | 3/3 | $1,24-3,16 |

De grootste solo-run gebruikte maximaal 176k context en 8 van de 60 minuten.

### Externe bron (cited)

Google et al. (arXiv 2512.08296) vond multi-agent op code neutraal tot slechter dan single-agent. Op SWE-bench
Verified scoorde single-agent 0,522 en gecentraliseerd multi-agent 0,506; op Terminal-Bench 0,344 en 0,278. Dat
past bij wat wij zagen.

## Wat dit betekent (inferred)

1. **Kwaliteit**: op codeertaken tot minstens ~1700 gewijzigde regels en ~176k context kan opdeling solo niet
   verbeteren, want solo scoort al 100%. Een eventueel kwaliteitsvoordeel ligt alleen buiten die grens. Die grens
   hebben we niet bereikt: er is geen taak gevonden waar solo faalt.
2. **Kosten**: één beurt van de hoofdsessie kost ongeveer 80k context, omdat de volledige systeemprompt
   meegaat. Daarom bepaalt het aantal coördinatorbeurten de kosten. Op kleine taken ligt het aantal bij
   thin-standard ongeveer even hoog als bij solo; op de grotere taken was het 2-5x lager, en daar komt de besparing
   van 10-52% vandaan. De kit-route verdubbelt het aantal en verdubbelt zo ook de kosten.
3. **Mogelijke winst van thin-standard**, gezien maar niet bewezen bij N=1:
   - lagere kosten op taken waar solo meer dan ongeveer $1,50 kost (5 van 5 runs, -10% tot -52%);
   - meer parallelle snelheid (op T1, H1, H3 en P-AN sneller, op P-OL2 niet);
   - minder vals-positieven met twee onafhankelijke reviewers (8 tegenover 13);
   - afdwingbare discipline, zoals een contract, `owns`, gates en een stop bij blockers.
4. **De kit-route (arm B)** levert niets op wat thin-standard niet levert, tegen ongeveer het dubbele van de
   kosten. Ze gaf ook wrijving: alle 11 voorgestelde facts werden geweigerd door statuswaarden die buiten de
   ontology vielen.
5. **Effort**: `max` op een kleine taak is verspilling. Een hoge effort hoort bij taken die het nodig hebben.

## Wat niet getest is

- thin-standard op H2 (review) en op de kleinere Pro-taken.
- Haiku-units op werk dat meer oordeel vraagt dan de H3-migratie.
- Taken die niet in één context passen. Daar zou fan-out moeten winnen, maar geen enkele kandidaat bleek zo groot.
- Effort high voor de hoofdsessie: alle efficiëntie- en B'-runs liepen op `medium` (observed in de transcripts),
  ook al vroeg de opzet om high.
- B' op meer dan twee taken, en B' met een hoofdsessie die zelf ontwerpt (op P-AN kregen B' en A2 de briefs van
  E-AN-A).
- Herhaling: alleen A op H1 heeft N=2 ($1,39 en $1,83). Al het andere is N=1 per taak en arm. De verschillen in
  kosten en tijd zijn richting, geen bewijs.
- Breed onderzoek, waar Anthropic wel een grote winst voor multi-agent rapporteert. Dat cijfer is niet door mij
  nagekeken.

## Kosten van het testprogramma (berekend uit transcripts)

| Onderdeel | Kosten |
|---|---|
| Coördinerende sessie (incl. L1-workflows, beoordelaars, research) | $36,68 |
| Bouwsessies (fixtures, bench) | $16,09 |
| Pilot L2 (6 runs) | $6,84 |
| Kalibratie H1-H3 | $6,61 |
| Kalibratie SWE-bench Pro (6 runs) | $10,55 |
| Efficiëntietest (5 runs, arm A) | $8,76 |
| B' en herhaling A (4 runs) | $5,90 |
| **Totaal** | **$91,43** |

Coördinatie van de B'-test zelf (sessie local_3b3c3601) zit niet in dit totaal.

De coördinerende sessie kostte bijna de helft. Dat bevestigt punt 2: lange hoofdsessies met veel beurten zijn de
grootste kostenpost.

## Wat blijft staan

`~/.claude/workflows/thin-standard.js` (met L0), `~/.claude/orchestration-kit/` (kit-3.1),
`~/.claude/workflows-tests/thin-standard/` (plan, fixtures, antwoorden, scripts, resultaten),
`C:\dev\l3-bench` (SWE-bench Pro-harness, 54 GB images in WSL) en de run-mappen onder `C:\dev\l2-runs` en
`C:\dev\l3-runs`.
