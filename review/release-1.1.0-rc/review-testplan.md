# Review: TESTPLAN-WIN11-final.md (Windows 11 test plan, 1.1.0 candidate)

Reviewed file: `scratchpad\out\TESTPLAN-WIN11-final.md` (238 lines). Line numbers below are lines of that file.
Sources opened: P27, P31, facts.md, findings-w11-20261026.md, headless-snip\findings.md, offscreen-map.md, plan-minimal.md (guards G-a..G-g, lines 100-115), rc\docs\releasing.md, rc\.github\workflows\windows-run.yml, rc\tools\measure\measure.ps1 and shots.ps1, rc\src\saving.ts, diskState.ts, pet.ts, lib.rs at RC, v1.1.0-4, v1.1.0-3 and v1.0.0, and the PR #105 diff (`git diff 1a3e086 cd7adc6`).
Nothing was started, installed or downloaded. Read-only commands only: git, `gh ... --help`, `gh release view` (asset names), PowerShell parsing in memory, and one read of the installed exe's version and the Uninstall key.

## Verdict

**Release to the owner after fixes.** No blocker: no step as written deletes, overwrites or moves the owner's notes, `session.json` or `%APPDATA%\com.snipmd.desktop`, and `SNIPMD_DATA_DIR` does what the plan says on all three versions. Seven majors must be fixed first. Four of them change what a test row measures or proves: M1 stale headless results, M2 runner coverage that no row names, M3 the N2 bound, M4 the CT3 order. M5 is a PC state that differs from row 0. M6 is smoke step 8. M7 is form.

### Question A, data safety: what was verified
- `SNIPMD_DATA_DIR` (observed in code). RC `lib.rs:132-137`, v1.1.0-4 `lib.rs:132-137`, v1.1.0-3 `lib.rs:132-137` and v1.0.0 `lib.rs:153-158` hold the same function: `if let Some(dir) = std::env::var_os("SNIPMD_DATA_DIR")` ... `return if dir.is_absolute() { Ok(dir) } else { Err(...) }`. A relative or empty value is an error and never falls back. In all four versions every data path goes through `app_data()`: session load and save, `scratch/<tab id>` (RC :163, v1.0.0 :184), the startup cleanup `start_cleanup(dir)` (RC :491-493, v1.0.0 :660) and perf. No other `app_data_dir()` call exists in `src-tauri/src` of v1.0.0 or v1.1.0-4. A **missing** value falls back to `%APPDATA%` silently by design. The plan guards that by procedure only (see m4).
- Single instance does not depend on the variable (RC `lib.rs:466`). The plan's G-d and Commando step 1 cover this.
- Writes into the owner's areas: W0, the S block, K0, O2 and SM7 write only in `zz-w11-test\`. SM4 writes a new note into `Documents\Notes` and leaves the choice to the owner. That is safe because the first save claims the name with create-new (`lib.rs:375-376`, "already exists"). Robocopy (I1) copies from `%APPDATA%` to the Desktop with `/E`, not `/MIR`. `Remove-Item Env:SNIPMD_DATA_DIR` removes only the variable. `measure.ps1` uses its own temp data folder (`measure.ps1:6-7, 47, 79`). Every uninstall keeps *Delete the application data* unticked (rule 4, G-c, SM9).
- Residual risks are minors: m4 (missing value), m7 (the old uninstaller's box on *Already Installed*), m8 (no restore step after a missed guard), m13 (owner's tab titles in a public report).

### Question B, commands: what was verified
- PowerShell parse, in memory: the Commando block (lines 176-184) has 0 errors and the check block (188-190) has 0. Inline commands on lines 58, 119, 195, 204 and 210 have 0 errors. Lines 59 and 148 fail only on the `<RUN>` placeholder and on Win+R syntax, which is not PowerShell.
- Flags exist (gh 2.97.0 help): `gh run download -n/-D`, `gh run view --json headSha`, `gh release download --pattern/--dir`, and `gh release view --json tagName,isPrerelease,isDraft,assets`. The asset names exist: `SnipMD_1.0.0_x64-setup.exe` and `SnipMD_1.1.0-4_x64-setup.exe` (`gh release view`). `gh release view` without a tag returns `v1.0.0`, so line 164 ("1.0.0 is Latest") holds.
- No block starts SnipMD or a setup from the session shell. The Commando block, B2 and O2 run in the owner's own PowerShell or Win+R, as rule 2 allows. No command needs elevation.
- Download folders are not guaranteed new and empty (m2).

## Blockers

None.

## Majors

| id | severity | location | statement | evidence | replacement |
|---|---|---|---|---|---|
| M1 | major | lines 67, 86, 90-91; HL table 69-75; CT5a-c 102-104 | The headless OK for N1, N2, N3 and CT5 comes from 1a3e086. PR #105 rewrites exactly the nap and wake code, and the plan reruns only HM1 and HM2. On that old result the owner skips N3 and CT5 becomes optional. The third code major (the path hold race in `saving.ts`) has no retest row anywhere. Line 86 says the M1/M2 rows stay "bekend en open" if `<SHA>` lacks the fix. That contradicts line 3 ("nadat de fix-PR's gemerged zijn") and the decision that the fixes land before the tag. No row gates the tag on HM1/HM2. | `git diff 1a3e086 cd7adc6 -- src/pet.ts src/saving.ts` (PR #105 head cd7adc6). In napCheck, `-  if (left <= 0) {` becomes `+  if (left <= 0 && state === 'idle') show('sleep');`. In petMoment, `+    if (state === 'sleep' && snip && (friend?.svg.classList.contains('gone') ?? true)) void wakeUp();` is added. In wakeUp, `-  if (!(await walk(f, snip.x + cell * (CELLS + 1))) \|\| me !== visit) return leave();` becomes `+  await walk(f, snip.x + cell * (CELLS + 1));`. In saving.ts, `refuseHeld` becomes `hold` plus `holdPath(tab.id)` in `finally`. Plan 67: "De headless-meting op RC 1a3e086 ... gaf OK voor W3, W6, W7, W9, N1, N2, N3, CT1 en CT5." Plan 86: "anders blijven ze bekend en open." | Line 86, last two sentences: "Na de merge herhaalt de coördinator HM1, HM2 en de headless-gevallen N1, N2, N3 en CT5 op `<SHA>`. Blok W/N begint pas als die OK zijn; zonder de fix in `<SHA>` komt er geen tag." Add a row HM3 for N1, N2, N3 and CT5 on `<SHA>`. Name the PR #105 unit tests (`saving.test.ts`, `tabs.test.ts`) as the retest of the path hold, or move S5b and S5c into the required path. |
| M2 | major | lines 65, 125, 154; no R rows | The plan claims runner coverage, but no row names a run, a SHA or a pass criterion. (1) The S/G/O/K1f runner script that decision 3 relies on does not exist at RC. `windows-run.yml` runs only `measure.ps1`, `shots.ps1` and `install-smoke.ps1`, and `shots.ps1` has no save, Recycle Bin or closed-tab step. (2) Line 154 counts W8 as covered ("de runner of de demo dekte (W5, W8, N4 ...)"), but the headless findings have no W8. Line 65 says the same for W1-W9, and W4 and W8 are missing there. (3) N4 needs the snip-sleep shots of a Windows run with `snip_sleep` on `<SHA>`, and no row names one. (4) P27 R1-R5 and P31 R1-R2 are dropped without a reason, so nothing requires a clean-install smoke or real-window screenshots on `<SHA>`. | `windows-run.yml:41-71` has the steps "Build", "Windows version", "Measure budgets", "Screenshots" and "Clean-install smoke test", and nothing else. `grep -n "Save again\|Recycle\|closed\|u1\|hertest" rc/tools/measure/shots.ps1` returns nothing. findings.md Results has the rows W1, W2, W3, W5, W6, W7, W9, N1, N2, N3, M1, M2, CT5, CT1 and CT2, with no W4 and no W8. offscreen-map.md:83 calls the S rows "runner (new script)". The plan has no row with ID R1 or R2. | Add before block I: "R1 \| C-off \| Lees de *Windows run* op `<SHA>` (met `snip_sleep`): de *Clean-install smoke test* is geslaagd, `ui/snip-sleep-light.png` en `ui/snip-sleep-dark.png` verschillen (N4), en het opslaanscript gaf S1 tot K1f. Ontbreekt een van de drie, dan vraagt de coördinator het terugvalblok of laat hij de run opnieuw lopen." In line 154, remove W8 from the covered list. Until a headless W8 run exists, W8 is NIET GETEST, with that reason. |
| M3 | major | line 84 (N2) | The bound "hoogstens 5,5 s" is lower than what the plan's own source measured for this sequence, a run the coordinator ruled OK. Under rule 10 a correct real-window run therefore reads as FOUT. In the app the friend starts only after the write returns, which adds more time. | findings.md:35 (N2, verdict OK): "Total from the save to Snip's last turn: 5557 ms." rc/src/saving.ts:30-32 calls `const out = await writeNote(...)` and only then `petMoment('saved')`. | "Het geheel duurt ongeveer 5,6 s vanaf de toetsdruk (headless 5,56 s). Noteer de gemeten duur. FOUT is een ontbrekende of verwisselde fase, of een duur boven 5,6 s plus één beeldinterval (zoals in W1)." The bound is derived from findings.md:35 plus the frame margin W1 already uses; a looser bound is a decision for the coordinator. |
| M4 | major | line 100 (CT3) | The owner sets the scale back to 100 % before Claude reads the window rectangle. The read then measures the window after Windows rescaled it, not the first-start fit this step checks (#38). | Line 100: "start het via het Startmenu en zet daarna de schaal terug op 100 %. Claude leest de vensterrechthoek (`GetWindowRect`) en de werkruimte van het scherm." | "De eigenaar sluit SnipMD (met zijn toestemming) en start het via het Startmenu, met het hoofdscherm nog op 200 %. Claude leest nu de vensterrechthoek (`GetWindowRect`) en de werkruimte van het scherm. Daarna zet de eigenaar de schaal terug op 100 %." |
| M5 | major | line 51 (row 0), line 54, I3 line 61, line 173 | The PC is not in the state that row 0 expects. The exe on disk is 1.1.0-4, written 27 Oct, while the Uninstall key read from the session shell says 1.1.0-3. Row 0 expects "1.1.0-3 geïnstalleerd", and block I describes the route as "1.1.0-3 rechtstreeks naar de kandidaat", but the version actually installed is 1.1.0-4. The session's view of the registry is not reliable evidence. The 26 Oct report records a SnipMD key left in the Claude package's virtual registry, and the session's reads probably go through that package (inferred). Row 0, I3 and the Commando block (line 173, InstallLocation) treat the session's HKCU read as proof. | Read-only, this session: `(Get-Item "$env:LOCALAPPDATA\SnipMD\snip-md.exe").VersionInfo` gave `FileVersion=[1.1.0-4] ProductVersion=[1.1.0-4]`, LastWriteTime 27-Oct-26 01:43:16. `(Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SnipMD").DisplayVersion` gave `1.1.0-3`. `Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\SnipMD` does not exist. F26:88: "In het virtuele register van het Claude-pakket staat nog een SnipMD-sleutel; die is niet aangeraakt." facts.md:23: "Installed SnipMD: 1.1.0-3 (HKCU Uninstall key ...)". | Row 0, Verwacht: "De exe is 1.1.0-4 (geschreven 27 okt); het register, gelezen vanuit de sessie, zegt 1.1.0-3. De versie in Instellingen → Apps (E) beslist; noteer alle drie." In I3 and above the Commando block: "Een registerwaarde die Claude leest, telt alleen als ze gelijk is aan wat Instellingen → Apps toont." Line 54: "De route is de geïnstalleerde versie (volgens de exe 1.1.0-4) rechtstreeks naar de kandidaat." The coordinator decides whether decision 4 still stands. |
| M6 | major | lines 207 and 213 (SM8a-4, SM8b-4) | Smoke step 8 requires that the setup asks to close SnipMD. The plan makes "dicht" the default, so by default neither leg checks this. The reason given ("komt hier niet in beeld omdat 1.0.0 dicht is") only restates the choice. Keeping the old version open is safe here, because it reads only the leg's test folder. | releasing.md:43: "with the last published version installed and a few tabs open, run the new setup. It asks to close SnipMD". plan-minimal.md:115: "For each leg: the setup asks to close SnipMD". Plan 207: "De eigenaar kiest; standaard dicht." | SM8a-4 Doe: "Laat 1.0.0 open met zijn twee tabs (hij leest alleen de testmap). Dubbelklik de gepubliceerde 1.1.0-setup in Verkenner. Op *Already Installed* kiest de eigenaar *Uninstall before installing* (de standaard, de weg van de meeste gebruikers) of *Do not uninstall*, en noteert welke; *Delete the application data* blijft uit. Vink op de laatste pagina de startoptie uit." Verwacht: "De setup vraagt SnipMD te sluiten (tekst letterlijk overschrijven) en installeert zonder downgrade-prompt. Instellingen → Apps toont één SnipMD 1.1.0." Make the same change in SM8b-4, with 1.1.0-4. |
| M7 | major | lines 3, 16, 37, 46, 54, 65, 86, 94, 111, 125, 152, 164, 217, 220, 229-237 and the Bron column | The plan is full of the process talk the brief excludes. "coördinator" appears 18 times, mostly as "beslissing coördinator N". Rows point to working files the owner does not have: `diff-coverage.md` M3, `plans-review.md` "Missing from both" punt 4, SW M1, PR m7, OM rij. Other examples are "de twee defecten uit de review", "mijn schatting" and "niet uit de bronplannen". Several decision numbers are also wrong. Lines 94 and 111 cite decision 6 for CT3/CT4/T3, which is decision 5. Lines 152 and 217 cite decision 9 for the report, but decision 9 is "never start SnipMD from a session shell". Line 16 cites decision 5 for "de eigenaar doet zoveel mogelijk". | `grep -c "coördinator"` gives 18. Line 86: "De headless-meting reproduceerde de twee defecten uit de review". Line 46: "anders mijn schatting". Line 37: "(gewone Windows-sneltoets, niet uit de bronplannen)". Line 217: "(`plans-review.md`, "Missing from both" punt 4)". | Remove the Bron column and the Bronnen section from the owner's copy and keep them in an internal file. Remove every "(beslissing coördinator N)". Where a person acts, write "Claude" or "de eigenaar" instead of "de coördinator". Line 86, first sentence: "Twee fouten in Snips dutje zijn in PR #105 opgelost." Line 46: "Het zijn schattingen." |

## Minors

| id | severity | location | statement | evidence | replacement |
|---|---|---|---|---|---|
| m1 | minor | Bron of SM1-SM7 (lines 196-202) | The REL line numbers for smoke steps 1-7 are off by one. Step 1 is releasing.md:36 and step 7 is :42. Steps 8 (:43) and 9 (:44) are right. | rc/docs/releasing.md:35 "On a machine without SnipMD ...", :36 "1. Run the setup." | REL 36 stap 1, 37 stap 2, 38 stap 3, 39 stap 4, 40 stap 5, 41 stap 6, 42 stap 7. |
| m2 | minor | lines 11, 59, 179-180, 195, 204, 210 | The download folders have fixed names, and nothing checks that they are new and empty. Line 11 reruns I1b for a new `<RUN>` into the folder that already holds the previous setup. `gh release download` refuses existing files without `--clobber`, so it fails loudly. For `gh run download` a failure is inferred. `New-Item -Force` does not empty the leg folder, although the comment says "Lege". | gh 2.97.0 `release download --help`: "--clobber Overwrite existing files of the same name". Line 180 uses `New-Item -ItemType Directory -Force`. | I1b: `-D "$env:USERPROFILE\Downloads\snipmd-1.1.0-<RUN>"`, plus "De map bestaat vooraf niet (`Test-Path` geeft False)." Commando 2: drop `-Force`, so an existing folder stops the leg. |
| m3 | minor | lines 58-59, 186-190 | C-off commands use PowerShell syntax, but the plan never says they run in PowerShell. In the session's Git Bash, `$env:APPDATA` becomes `:APPDATA` (inferred from shell rules). | Line 58: `robocopy "$env:APPDATA\com.snipmd.desktop" ...` | C-off definition, line 21: "Claude voert elk commando uit in PowerShell, niet in bash." |
| m4 | minor | lines 176-184, 212 | A missing `SNIPMD_DATA_DIR` falls back to the real data silently. Step 3 has no check. SM8b-3 does not point to "Commando's 1 tot 3", and no text says to fill in `<naam>`. | RC lib.rs:133-137: the fallback `app.path().app_data_dir()` runs when the variable is absent. Line 212: "Start 1.1.0-4 één keer met `SNIPMD_DATA_DIR` = `snipmd-leg-1104`." | Commando 3: `if (-not [IO.Path]::IsPathRooted("$env:SNIPMD_DATA_DIR")) { throw 'SNIPMD_DATA_DIR ontbreekt' }; & "<InstallLocation>\snip-md.exe"`. SM8b-3: "(Commando's 1 tot 3, met `<naam>` = `1104`)". Do the same in SM2 (`smoke`) and SM8a-3 (`100`). |
| m5 | minor | line 177 | "moet niets tonen" gives no action for when it does. | Line 177. | "Toont dit een proces, stop dan: sluit SnipMD eerst." |
| m6 | minor | line 166 vs line 209 | G-b keeps the owner's SnipMD closed to the end of the block, but SM8a-6 starts it in the middle of the block. | Line 166, line 209. | G-b: "... blijft dicht tot het einde van dit blok, behalve in SM8a-6." |
| m7 | minor | SM8a-2/-4, SM8b-2/-4 (lines 205-213) | The legs never name the choice on *Already Installed*. The default starts the old uninstaller, which shows the *Delete the application data* box. Rule 4 covers the box, but the step does not repeat it. | F26:72: "Met de standaardkeuze start de uninstaller van 1.1.0-1 als gewoon venster, met het vakje *Delete the application data* (uit)". | Name both options in the step, say which one users hit by default, and repeat "*Delete the application data* blijft uit" (see M6). Which option to test is for the coordinator or the owner. |
| m8 | minor | lines 165-171 | No step says what to do when a guard is missed and an old version runs on the real session. In that case 1.0.0 rewrites `session.json` and runs its scratch cleanup there (inferred from v1.0.0 lib.rs:513-529). | v1.0.0 lib.rs:529 calls `cleanup::clean_scratch(&app_data.join("scratch"), ...)`. | After G-g: "Start een oude versie toch op de echte sessie: sluit hem meteen en zet `session.json` en `scratch\` terug uit de back-up van G-a, vóór een volgende start." |
| m9 | minor | rules 9-10 (lines 38-39) | The second half of the FOUT rule is missing: nobody fixes anything during the test. | grep finds no such sentence. Rule 9 says only "ga verder". | Add to rule 10: "Tijdens de test verandert niemand iets aan de code of de build; een FOUT wordt alleen gemeld." |
| m10 | minor | line 196 (SM1) | Option A, installing over the same-version candidate, does not meet the smoke precondition "On a machine without SnipMD". | releasing.md:35. | "Kies B; A alleen als de eigenaar dat uitdrukkelijk wil." |
| m11 | minor | line 99 (CT2) | "Kan of wil hij dat niet" widens the amendment, which allows NIET GETEST only when no display at that scale exists. The row also does not name the screen. | Coordinator amendment to decision 5. | "Zet het hoofdscherm op 125 % en 150 %. NIET GETEST alleen als Windows die schaal op geen scherm aanbiedt." |
| m12 | minor | throughout | The address is mixed: "je" in rules 1, 5 and 6, "hij", "de eigenaar", and imperatives with no actor in the S rows ("Typ ..."). Many rows hold several instructions (W1, W4, K0, S6b, SM8a-3). Line 183: "Na het laatste start" is wrong Dutch. | Line 30: "werk alleen in tabs die je zelf opent". Line 34: "Zet niets op het klembord dat je wilt bewaren". | Address the owner as "je" throughout and name Claude where Claude acts. Line 183: "Na de laatste start van dit been:". |
| m13 | minor | lines 62, 122, 152-154 | The report goes to a `test/` branch of the public repo. Nothing keeps the owner's tab titles or note text out of it, while I4, K1 and SM8a-6 compare titles. | Line 152: "`findings/windows/w11-<datum>.md` op de branch `test/w11-<datum>`". facts.md:6: the repo is public. | Report, point 2: "Noem voor de tabs van de eigenaar alleen aantallen en id's, geen titels of tekst." |
| m14 | minor | line 119 (B2) | `measure.ps1` runs from the main checkout, whose branch can change. Observed: HEAD moved from `review-105` to `test/w11-20261026` during this review. Today the script is identical to RC. | `git rev-parse --abbrev-ref HEAD` gave `test/w11-20261026`. `diff tools/measure/measure.ps1 rc/...` printed nothing (identical). | "... `measure.ps1` uit een checkout op `<SHA>`". |
| m15 | minor | lines 102-104 | CT5 drops the W3 repeat from P27 CT5 without saying so. | P27:93 "Herhaal W1, W3 en N1 tot N2 met de effecten uit." | Add to CT5a: "W3 met effecten uit vervalt: headless gedekt." |
| m16 | minor | line 43 vs P1 (line 83) | The definition of "Moment" includes "een notitie veranderde buiten SnipMD". The code plays a moment only for a conflict, and P1 expects nothing to happen. The definition misleads whoever judges P1. | rc/src/diskState.ts:32: `if (on && !conflicts.has(id)) petMoment('worried', id);` | "... of een notitie met onbewaarde wijzigingen veranderde buiten SnipMD." |
| m17 | minor | line 80 (W1) | "40 cellen per seconde (`WALK_MAX_MS`)" gives the wrong constant: `WALK_MAX_MS` is the 1400 ms cap, and 40 cells per second is `CELLS_PER_S`. | findings.md:52: "steps/CELLS_PER_S is capped at WALK_MAX_MS 1400". | "... op 1,4 s (`WALK_MAX_MS`) met 40 cellen per seconde." |

## Coverage (question C)

Status: **present** (same ID), **folded** (the plan names the fold), **dropped, reason** (the reason is in the plan), **lost** (no row and no reason, or a coverage claim without a source).

| Source | ID | Status in the final plan | Expected result vs source |
|---|---|---|---|
| P27 | R1-R5 | **lost** (M2) | No R row and no reason. They are about v1.1.0-4 runs; nothing replaces them on `<SHA>`. |
| P27 | 0 | present, row 0 | Expected is now the facts.md state, which is wrong for the exe (M5). |
| P27 | I1 | present, I1 | Same. |
| P27 | I2 | dropped, reason (line 54: the 1.1.0-4 step is removed) | n/a |
| P27 | I3 | present, I3 | Version 1.1.0 instead of 1.1.0-4; follows from the route. |
| P27 | I4 | present, I4 | Same. |
| P27 | W1 | present, W1 | Changed with a reason: cell skipping allowed (the cap). |
| P27 | W2 | folded into W1 (named) | Plus the known 1 px, with a reason. |
| P27 | W3 | headless (HL table) | Stale for `<SHA>` (M1). |
| P27 | W4 | present, W4 | Adds the *Save again* result; source S4b named. |
| P27 | W5 | runner/demo (line 154) | The headless W5 was FOUT and ruled OK. The plan does not say so. |
| P27 | W6 | headless (HL table) | Same. |
| P27 | W7 | headless (HL table) | Same. |
| P27 | W8 | **lost** (M2) | Line 154 claims coverage, but findings.md has no W8. |
| P27 | W9 | headless (HL table) | Same. |
| P27 | N1 | present, N1 | Same. |
| P27 | N2 | present, N2 | Adds a 5.5 s bound that its own source exceeds (M3). |
| P27 | N3 | headless (HL table) | Stale for `<SHA>` (M1). |
| P27 | N4 | **lost** (M2) | Line 154 claims the runner, but no run or SHA is named. |
| P27 | K1 | present, K1 | Same. |
| P27 | CT1 | present, optional | Same; the dark half was done on 26 Oct. |
| P27 | CT2 | present | NIET GETEST widened (m11). |
| P27 | CT3 | present | 200 % made concrete; read order wrong (M4). |
| P27 | CT4 | present | The owner acts, Claude reads; follows decision 5. |
| P27 | CT5 | split into CT5a-c, optional | W3 part dropped silently (m15). |
| P27 | T1 | present | Same. |
| P27 | T2 | present | Same. |
| P27 | T3 | present | Gates the tag; follows decision 5. |
| P31 | R1 | replaced by the `<RUN>` table and I1b (implicit) | No stated reason (M2). |
| P31 | R2 | **lost** (M2) | No Windows run on `<SHA>` is required. |
| P31 | 0 | present, row 0 | See M5. |
| P31 | I1 | present, I1 | Same. |
| P31 | I2 | folded into I1b and I2 | Download via `gh`; reason stated (no login needed). |
| P31 | I3 | folded into I3 and I4 | Same. |
| P31 | S1-S7 | present in the fallback block (on request only) | Notepad checks replaced by `Get-Content` (reason in the offscreen map). Runner coverage not named (M2). |
| P31 | G1-G5 | present in the fallback block | Same as the source. |
| P31 | O1 | present in the fallback block | Target files corrected, with a stated reason (diff-coverage m1). |
| P31 | K1 | present as K1f (rename stated, line 125) | Same. |

No P27 or P31 ID is missing from the text entirely. The lost IDs are R1-R5 (P27), R2 (P31), W8 and N4. The R rows have no row and no reason. W8 and N4 rest on a coverage claim with no source behind it.

## Recomputed minutes (question D)

Recomputed by hand from the Min column of every row.

| Part | E (plan / recomputed) | C-off (plan / recomputed) | C-cu (plan / recomputed) |
|---|---|---|---|
| Before the tag, required: 0 (C-off 3); I (E 7, C-off 9); W/N incl. W0, P1 (E 25, C-off 4, C-cu 16); CT2-CT4 (E 22, C-off 4, C-cu 10); T1 (E 1); B1-B4 and K1 (E 15, C-off 9); report (E 2, C-off 20) | 72 / 72 | 49 / 49 | 26 / 26 |
| Before the tag, optional: CT1, CT5a, CT5b, CT5c | 23 / 23 | 0 / 0 | 14 / 14 |
| Fallback block S/G/O (F0 to K1f, 21 rows) | 19 / 19 | 17 / 17 | 31 / 31 |
| After the release (SM0 to SM8b-6, 21 rows) | 53 / 53 | 31 / 31 | 0 / 0 |

All twelve sums match. The arithmetic is right. Two remarks on content: the required total includes P1 (E 3, C-off 1), which decision 2 does not list, and N1 counts the 10-minute wait as owner time, as line 220 says.

## Re-audit (revised plan, 254 lines, 2026-11-09)

Line numbers in this section are lines of the revised `TESTPLAN-WIN11-final.md`.

### Verdict

**Release to the owner after these fixes.** All seven majors are closed as the rulings say. One new major: W5 dropped out of the plan without a word. There are eight new minors, and one old minor is partly open. Each fix is one or two sentences. No blocker, and no new data-safety risk that the guards leave open. The nearest is R9 (the release-block backup reuses the I1 folder).

### What was checked (read-only)
- `certutil -hashfile "C:\Users\Admin\Downloads\snipmd-1.1.0-rc\SnipMD_1.1.0_x64-setup.exe" SHA256` printed `f3e1e50669e1da16e65a9eed721494785f4af6537df28fb085e2d80d8cd87ebe` and "completed successfully" (exit 0). `Get-Item` gave Length 1551498, FileVersion 1.1.0, LastWriteTime 09-Nov-26 03:18:41. Line 68 matches on size, hash and FileVersion (observed).
- `gh run view 42549469763 --json headSha,conclusion,...` gave headSha `6e62404727bd...`, conclusion success, created 2026-11-09T02:10:47Z. Its artifact `SnipMD-windows-x64` was created 02:17:14Z. Run 42549472467 ("Windows run") gave the same headSha and success. The setup file was written at 03:18:41 local (02:18:41Z), one minute after the artifact. That fits line 68's "de setup van run 42549469763", but no hash ties the exe to the artifact (inferred). This `gh run view` is in effect R-A's own command; it was read-only.
- `git log origin/claude/release-1.1.0`: 2426ed9 (docs) on top of 6e62404 (merge of PR #105). `git diff --stat 6e62404 2426ed9` lists only CHANGELOG.md, README.md and docs/releasing.md, so line 8 holds. lib.rs at 6e62404 still has the `SNIPMD_DATA_DIR` check (133-135) and the single instance plugin (466). releasing.md at 2426ed9 has the smoke steps on 36-44, measuring on 47 and the table on 49-57, so the references on lines 129-133, 180 and 213-233 hold.
- `rerun-eb42ce6\findings.md`: M1, M2, N1, N2 (5553 ms), N3, W1, CT5 and W8 are OK on eb42ce6 (merged as 6e62404). W8 had 3 glances in 2 min. M2 began its nap 420 ms after arriving home. Lines 76, 83, 94, 101 and 102 match.
- PowerShell: `New-Item -ItemType Directory -Path $env:TEMP | Out-Null; "continued after New-Item error"` printed the error "An item with the specified name C:\Users\Admin\AppData\Local\Temp already exists." and then "continued after New-Item error" (observed; see R4).

### (1) The seven majors

| id | status | new line(s) |
|---|---|---|
| M1 | closed | 76: "Op 2026-11-09 is Snips dutje opnieuw gemeten op de code van `6e62404`, met de fixes uit PR #105 ... W1, N1, N2, N3 en CT5 gaven OK." 97: "Gedaan op 2026-11-09, code van `6e62404`, headless: beide gaven OK." 173: "De fix van de pad-hold ... is gedekt door unit-tests en code-proeven; ... dus er is geen rij voor jou." The old line 86 contradiction is gone. Residual: R6. |
| M2 | closed | 53-55: R-A (run `42549469763`), R-B (run `42549472467`, snip_sleep, smoke, sleep shots), R-C (`<RUN2>` op `<SHA2>`). 136: "Terugvalblok opslaan (verplicht zolang `<RUN2>` leeg is)". 83: W8 "OK (headless 2026-11-09, 3 blikken in 2 min)". 95: N4 is a row. Residual: R2, R3. |
| M3 | closed as ruled | 94: "Het geheel duurt ongeveer 5 tot 6 s (headless 5557 ms). FOUT alleen als het na 10 s niet klaar is of Snip niet thuis eindigt." Residual: R5. |
| M4 | closed | 111: "(1) Het hoofdscherm staat op 200 %. ... (2) Claude leest nu de vensterrechthoek (`GetWindowRect`) en de werkruimte van het scherm. (3) Zet daarna de schaal terug op 100 %." |
| M5 | closed | 60: "Gemeten op 2026-11-09: de exe is 1.1.0-4 (geschreven 2026-10-27 01:43) ... Instellingen → Apps hoort 1.1.0-4 te tonen." 63: "De route is 1.1.0-4 rechtstreeks naar de kandidaat, met *Do not uninstall*." 39 (rule 11): "Een registerwaarde die Claude via een shell leest, telt niet". 70 (I3) and 190 now read the exe, not the registry. Residual: R8. |
| M6 | closed | 224: "(3) Laat SnipMD open: het blijft open tot SM8a-4." 225: "De setup vraagt SnipMD te sluiten (tekst letterlijk overschrijven) en installeert zonder downgrade-prompt." 230-231 do the same for 1.1.0-4. |
| M7 | closed | `grep -n "coördinator\|beslissing\|review\|mijn schatting\|diff-coverage\|plans-review\|SW \|OM "` on the revised plan returns nothing. The Bron column now cites only P27/P31 line numbers, docs and the 26 Oct report. |

### (2) The 17 minors

Closed (16):
- m1 (lines 213-221)
- m3 (21)
- m4 (190, 199, 215, 224, 230)
- m5 (193)
- m6 (182)
- m7 (225, 231)
- m8 (188, G-h)
- m9 (38)
- m10 (214)
- m11 (110)
- m12 (address is "jij/je" throughout, numbered steps per line 46, and line 201 reads "Na de laatste start")
- m13 (166)
- m14 (129, B0)
- m15 (113)
- m16 (43)
- m17 (90)

Partly open (1):
- m2. The download folders are fixed: SM0, SM8a-1 and SM8b-1 check `Test-Path`, and I1b no longer downloads. The leg folder is still open. Line 195 says "Bestaat de map al, dan stopt het commando", but `New-Item` without `-ErrorAction Stop` does not stop (R4).

### (3) New text: findings

| id | severity | location | statement | evidence | replacement |
|---|---|---|---|---|---|
| R1 | major | HL table 78-85; report line 166 | P27 W5 (two moments in quick succession, the cut walk) is no longer anywhere in the plan. The previous version had it in the covered list (old line 154). The 1a3e086 run measured it as FOUT on the "one cell per sample" rule, and the coordinator ruled it OK. The rerun did not repeat it. That leaves a P27 ID lost without a reason. | `grep -n "W5" TESTPLAN-WIN11-final.md` returns nothing (exit 1). headless-snip\findings.md:30 (W5 FOUT, "no jump") and :45 ("W1 and W5 count as OK"). | Add to the HL table: "\| W5 \| headless OK (1a3e086) \| FOUT alleen op de regel 'één cel per beeld', als OK beoordeeld; de afgekapte wandeling loopt zonder sprong verder \| Twee momenten kort na elkaar: Snip loopt vanaf waar hij staat naar de tweede tab, zonder eerst naar huis (P27:69). \|" Add W5 to the list on line 166. |
| R2 | minor | line 54 (R-B) | The run's green conclusion does not show that the smoke test or the screenshots passed. In windows-run.yml those steps run with `continue-on-error: true`, so the run succeeds even when they fail. | windows-run.yml:54, 60 and 67: `continue-on-error: true`. The 26 Oct report checked the text (F26 R3: "`SMOKE TEST PASSED`"). | "Claude leest `results/windows-ci/install-smoke.txt` op `test/windows-run-<n>`: daar staat `SMOKE TEST PASSED`. Het groene vinkje van de run alleen telt niet." |
| R3 | minor | line 55 (R-C) | `<SHA2>` is the head of PR #108, not 6e62404. Under P31:23 ("Test alleen de build die de PR noemt"), its S/G/O results count only if the app code is the same. | Line 11 and line 55. | Add to R-C: "Dit telt alleen als `git diff --stat 6e62404 <SHA2> -- src src-tauri` niets toont." |
| R4 | minor | lines 195-200 (Commando 2 and 3) | The comment "Bestaat de map al, dan stopt het commando" is wrong. `New-Item` on an existing folder writes an error and the next line still runs, so step 3 starts SnipMD on a used leg folder. No real data is at risk, but SM2's "één lege tab" and the leg results become unreliable. The check on line 199 and the start on line 200 are separate lines, so pasted line by line, the start still runs after the `throw`. | Observed: "New-Item: An item with the specified name C:\Users\Admin\AppData\Local\Temp already exists." followed by "continued after New-Item error". | Line 197: `New-Item -ItemType Directory -Path $env:SNIPMD_DATA_DIR -ErrorAction Stop \| Out-Null`. Lines 199-200 as one line: `if (-not [IO.Path]::IsPathRooted($env:SNIPMD_DATA_DIR)) { throw 'SNIPMD_DATA_DIR ontbreekt' } else { & "$env:LOCALAPPDATA\SnipMD\snip-md.exe" }`. |
| R5 | minor | line 94 (N2) | "FOUT alleen als" limits FOUT to "not done after 10 s" and "Snip not home". A run where no friend comes, or Snip wakes without the visit, would then pass. Yet N2 is the real-window confirmation of HM1 (line 101: "Je bevestigt dit met N1 en N2"). | Line 94; line 101. | "FOUT als een fase ontbreekt, als Snip niet wakker wordt of niet thuis eindigt, of als het na 10 s niet klaar is." |
| R6 | minor | lines 80-84, 105, 109; line 74 | The Stand column says "headless OK" for W3, W6, W7 and W9, and CT1 says "Headless OK". The rerun findings hold no verdict for these yet. They are OK only on 1a3e086. Line 74 also says W1-W9 are measured headless, but W4 never was. | rerun-eb42ce6\findings.md Results: M1, M2, N1, N2, N3, W1, CT5, W8 only. | Stand: "OK op 1a3e086; herloop: `<HL-RERUN>`". Line 74: "W1 tot W9 behalve W4". |
| R7 | minor | line 129 (B0) | "de andere werkmap opgeruimd" does not say which worktree or how. The checkout holds the owner's untracked `assets/` (58 files, not in git), which `git clean` or a hard reset would delete. The checkout is now on `test/w11-20261026`, so B0 is still to do. The row is C-off but tells "je" to stop. | facts.md:28. `git rev-parse --abbrev-ref HEAD` gave `test/w11-20261026` (observed). `git ls-tree origin/claude/release-1.1.0 assets` is empty, so a switch does not touch `assets/`. | "Claude zet de checkout met `git switch claude/release-1.1.0` en verwijdert alleen de RC-werkmap met `git worktree remove`; de ongetrackte map `assets/` blijft staan. Is het antwoord niet `claude/release-1.1.0`, dan stopt Claude en meldt het." |
| R8 | minor | line 39 (rule 11) | The rule states virtualization as a fact. The mismatch is observed; the cause is inferred. | Review M5 evidence (1.1.0-3 in the session's registry read, 1.1.0-4 in the exe). | "... telt niet: die sessie zag op 2026-11-09 1.1.0-3 in het register terwijl de exe 1.1.0-4 is (waarschijnlijk een gevirtualiseerde kopie)." |
| R9 | minor | lines 181 (G-a), 213 (SM0 step 4), 67 (I1) | "Verse back-up (zoals I1)" goes to `Desktop\snipmd-backup-20261109` if it runs the same day. `robocopy /E` then merges into the I1 copy. SM9's file count, the SM8a-6 and SM8b-6 comparisons, and the G-h restore would all use a mixed backup. | Line 67: `robocopy ... "$env:USERPROFILE\Desktop\snipmd-backup-20261109" /E`. Line 181: "Maak vlak voor het eerste been een verse back-up (zoals I1)". | G-a: "robocopy naar `Desktop\snipmd-backup-release` (een nieuwe map; `Test-Path` geeft False) en een kopie van `session.json` als `Desktop\snipmd-session-voor-release.json`." |

No new data-safety risk beyond R9 (data adjacent):
- SM8a-4's default path runs the 1.0.0 uninstaller, and the step keeps *Delete the application data* off.
- The hard kill hits only the test instance.
- Commando 3 starts the exe at its observed install path.
- G-h covers a missed guard.

No new command starts SnipMD or a setup from the session shell, and none needs elevation.

### (4) Recomputed minutes

| Part | E (plan / recomputed) | C-off (plan / recomputed) | C-cu (plan / recomputed) |
|---|---|---|---|
| Before the tag, required: R (C-off 7); 0 (E 1, C-off 3); I (E 7, C-off 7); W/N incl. W0, P1, N4 (E 25, C-off 7, C-cu 16); CT2-CT4 (E 22, C-off 4, C-cu 10); T1 (E 1); B0-B4 and K1 (E 15, C-off 10); RA (E 2, C-off 20) | 73 / 73 | 58 / 58 | 26 / 26 |
| Optional: CT1, CT5a-c | 23 / 23 | 0 / 0 | 14 / 14 |
| S/G/O (21 rows) | 19 / 19 | 17 / 17 | 31 / 31 |
| After the release (21 rows) | 53 / 53 | 31 / 31 | 0 / 0 |

All twelve sums match. S/G/O is required while `<RUN2>` is empty, so until then the real pre-tag load is E 92, C-off 75, C-cu 57. The first row's label does not include it.
