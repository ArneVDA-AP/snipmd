# Plan (minimal lens): SnipMD 1.1.0 from candidate 1a3e086 to a stable release on Windows

Goal: tag and publish SnipMD 1.1.0. Before that, every gate the repo already sets must pass. The gates are the two Windows test rounds, the budgets on the owner's PC, the tag, Release macOS with publish (a preview), and smoke step 8. Nothing new is built. A FOUT is fixed only when it is in scope and small. Every other FOUT becomes an issue.

## Labels and short names
- [cited X:n] means file X, line n. [computed: inputs] means arithmetic from the named inputs. [conj] means a conjecture. [inferred] means a conclusion from cited facts that no command has confirmed. Every minute figure in this plan is [conj], unless a step says otherwise.
- RC = the candidate worktree (branch `claude/release-1.1.0`, commit 1a3e086). IN = the coordinator's input folder. OUT = this folder.
- P27 = `IN\TESTPLAN-WIN11-20261027.md` (the round of v1.1.0-4, never run [cited IN\facts.md:17]). P31 = `IN\TESTPLAN-WIN11-20261031.md` (the retest of the candidate, never run [cited IN\facts.md:18]).
- DC = `OUT\diff-coverage.md`. SW = `OUT\snip-walk-review.md`. OM = `OUT\offscreen-map.md`. RM = `OUT\release-mechanics.md`. SC = `OUT\scope.md`.
- "Run 16" = Release Windows run 41255262735 on 1a3e086. Its artifact `SnipMD-windows-x64` is 5 299 530 bytes and expires 2027-01-30 [cited IN\ci-runs.md:2, 19].
- RCDIR = `%USERPROFILE%\Downloads\snipmd-1.1.0-rc\`, the folder that step 2.3 fills.

## Starting state
- PR #100 is open, mergeable and CI green. It is 0 commits behind `main` [cited IN\facts.md:8].
- The tag-time checks of both release workflows pass on the RC. Versions read 1.1.0, and `CHANGELOG.md:5` has `## [1.1.0]` [cited RM 1.1, rows 1 to 6].
- No Release macOS run exists on the RC [cited IN\ci-runs.md:12-16].
- The owner's PC has SnipMD 1.1.0-3 installed, and it is running with the owner's tabs [cited IN\facts.md:23-24].
- The reviews found no blocker. They found these majors:
  - DC M1: an open can still add a second tab while a first save or Save As runs.
  - DC M2: no plan step covers the "absent" write of Save again.
  - DC M3: P31 relies on P27, and P27 never ran.
  - SW M1, M2: two Snip nap edge cases.
  - SW M3: the W1 expectation contradicts the 1.4 s cap.
- No review finding loses an edit silently. The stale stamp refuses the overwrite [cited DC M1 statement].

## Design choices of this plan
1. The P31 retest runs before the P27 round. Reason: saving and opening changed after v1.1.0-4 [cited IN\facts.md:12]. Every review major in product code sits there [cited DC M1]. A FOUT found early leaves time for the fix, the rebuild and the reinstall today.
2. The P27 round runs on the RC build, not on v1.1.0-4 (option B, decision D4). Reason: `src/pet.ts`, `src/petSprite.ts` and `main.css` are the same in v1.1.0-4 and the RC [cited SW:6]. The RC is the code that ships.
3. W1 to W9 and N1 to N3 run in the real window by computer use, as P27 writes them. Reason: a browser demo "does not replace the Windows test" [cited RC\docs\CONVENTIONS.md:58]. The vite demo check is an optional parallel pre-check (step 2.6). It never counts as a Windows result.
4. Every decision that changes the binary (D1, D2, D3, D9) closes before the install (step 3.1). Reason: P31 says "Test only the build that the PR names" [cited P31:23].
5. The budgets script runs in the owner's own PowerShell, not in this session's shell. Reason: a setup that started from the session shell wrote into the Claude app's package folder [cited IN\findings-w11-20261026.md:88]. Also, the script stops while SnipMD runs [cited RC\tools\measure\measure.ps1:45].
6. Smoke step 8 uses a separate data folder (`SNIPMD_DATA_DIR`) for each leg. Reason: the owner's real session must never be read by 1.0.0 or 1.1.0-4. Both versions read that variable [cited `git show v1.0.0:src-tauri/src/lib.rs` line 154; `git show v1.1.0-4:src-tauri/src/lib.rs` line 133].
7. T3 (a day of use) starts only after the budgets (7.1). Reason: normal use saves notes, and a save resets the naps of 5.2, 5.3 and 6.3. Normal use also collides with the computer-use blocks, and 7.1 needs SnipMD closed.

## Phase 1. Owner decisions (today, before any install)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 1.1 | The owner answers D1 to D13 (see "Owner decisions"). D1, D2, D3 and D9 come first, because they decide which build is tested. | owner-only | none | 15 | D1, D2, D3, D9 have an answer. D7 says which commits and text edits this session may make. D10 says which computer-use blocks have a go-ahead. | ROADMAP.md:25-27; this plan |
| 1.2 | Only if D1, D2, D3 or D9 changes code: a cloud session makes the change on `claude/release-1.1.0` with a unit test (session card S1). This session then dispatches Release Windows (build only) and Windows run on the new head. The new run replaces run 16 in every step below. Default 0 min; 150 min if a fix is chosen. | cloud-session | 1.1 | 0 | CI `check` and `check-macos` are green on the new head. Release Windows and Windows run are green on it. The PR text names the new run. | ROADMAP.md:53; P31:23; DC recommendations |

## Phase 2. Preparation (today, no screen, in parallel)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 2.1 | Dispatch Release macOS on the branch `claude/release-1.1.0` without publish (dry run). | runner | 1.2 | 30 | The run is green. No probe line has `FAIL` or `BLOCKED`. The `.dmg` is under 10 485 760 bytes. | RM 1.2; release-macos.yml:63, 83-88, 109-113 |
| 2.2 | Read the results of Windows run 41255265008 on `test/windows-run-<n>`. Check whether it shot Snip asleep. If it did, compare the blob ids of `snip-sleep-light.png` and `snip-sleep-dark.png`. If it did not, dispatch Windows run with `snip_sleep=true` on the branch (35 more runner minutes). | this-session-offscreen | 1.2 | 5 | Both sleep shots exist on the tested head, and their blob ids differ. This is the N4 reference. | P27:81; OM row N4; windows-run.yml:11-15 |
| 2.3 | Download the artifact with `gh run download 41255262735 -n SnipMD-windows-x64` into RCDIR. Read the size and the FileVersion of the setup. Write the 1a3e086 copy of the budgets script to `RCDIR\measure.ps1` with `MSYS_NO_PATHCONV=1 git show 1a3e086:tools/measure/measure.ps1`. | this-session-offscreen | 1.2 | 3 | `SnipMD_1.1.0_x64-setup.exe` exists, is under 10 MB, and reads version 1.1.0. `RCDIR\measure.ps1` exists. | P31:41; IN\facts.md:25; OM row I2 (P31); measure.ps1:22 |
| 2.4 | Write the plan addendum in Dutch, in the plan format. It holds these rows: (a) W1 expected text: each walk lasts `min(1400, steps/40*1000)` ms within one capture interval, and "geen sprongen" applies only to walks under about 53 cells. (b) O1 corrected: double-click `hertest-twee.md` twice (open), then `hertest-een.md` twice (on disk since S3, not open). (c) S4b from DC. (d) P1 from DC, merged into the first nap (step 5.2). (e) Nap rule: after a nap, one save only, then no key for 6 s. (f) P27 I2 to I4: NIET GETEST, superseded by the RC install (if D4 is B). (g) The optional rows chosen in D6, each at its DC position. | this-session-offscreen | 1.1 | 20 | Every row in the addendum names the plan ID that it replaces or follows. | SW M3; DC m1, S4b, P1; SW M1; OM "Open option for the I steps" |
| 2.5 | Record step 0 of both plans: Windows build, scale, keyboard, theme, Animation effects, the installed version. Copy `%APPDATA%\com.snipmd.desktop\` to `Desktop\snipmd-backup-20261109\` with `robocopy /E`. Keep a copy of `session.json` for the tab diff. | this-session-offscreen | 1.1 | 6 | The file count and the byte sum are equal on both sides. | P27:48, 55; P31:35, 40; OM rows 0 and I1 |
| 2.6 | Optional: the headless Snip pre-check in the vite demo (OM section 2). It gives exact walk timing that 50 ms screenshots cannot give. 60 to 75 min. | this-session-offscreen | 1.1 | 75 | `document.hasFocus()` is true before the first sample. Each walk matches `min(1400, steps/40*1000)` ms within one frame. The report labels every result "demo, not Windows". | OM 2.1-2.4; CONVENTIONS.md:58 |

## Phase 3. Install the candidate on the owner's PC (today)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 3.1 | Leave SnipMD open with the owner's tabs. Double-click `RCDIR\SnipMD_1.1.0_x64-setup.exe` in Explorer. Pick **Do not uninstall** on *Already Installed*. Answer the close prompt. Take one screenshot per page. | owner-hand | 1.1, 1.2, 2.3, 2.5 | 4 | D1, D2, D3 and D9 are closed. The setup finishes without a UAC prompt. Every page text is copied verbatim. | P31:41; IN\findings-w11-20261026.md:82-83 |
| 3.2 | Read the FileVersion of `%LOCALAPPDATA%\SnipMD\snip-md.exe` (primary). Read the HKCU Uninstall key `DisplayVersion` and count the SnipMD keys (secondary). Check that nothing new is under `Packages\Claude_*\LocalCache\Local\SnipMD`. If the two sources disagree, the owner reads Settings, Apps (30 s). | this-session-offscreen | 3.1 | 2 | One SnipMD, version 1.1.0. | P31:42; OM row I3; IN\findings-w11-20261026.md:88 |
| 3.3 | The owner starts SnipMD from the Start menu. This session diffs `session.json` against the copy from 2.5. The owner says whether Snip stands at home. | owner-hand | 3.2 | 3 | The same tab ids and titles come back. Snip stands at home. | P31:42; P27:58 |

## Phase 4. Retest of the candidate, P31 (today, computer-use block CU-2)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 4.1 | S1 to S7, with S4b after S4. Follow the session rules of P31:25-32. Copy every bar text verbatim. | claude-computer-use | 3.3, 2.4 | 30 | Each ID is OK against P31:47-53 and DC S4b. In S4b, `u2.md` is back on disk with `twee` and the bar is gone. In S5 the error bar reads `Could not save Untitled-…: u1.md is open in another tab`. | P31:47-53; DC S4b |
| 4.2 | G1 to G5, then O1 as corrected in 2.4(b). | claude-computer-use | 4.1 | 20 | Each ID is OK against P31:58-62. O1 gives one tab per note each time. | P31:58-63; DC m1 |
| 4.3 | Optional rows from D6. They run inline, not as a block: S5b and S5c right after S5, S6b between S6 and S7, K0 right after G5, O2 right after O1 (O2 is an owner-hand Win+R step). Their minutes join 4.1 and 4.2: up to 18 min. Reason: S5b needs `u1.md` in the Recycle Bin, and G4 recreates it. | claude-computer-use | 3.3 | 0 | Each chosen row is OK against DC "Proposed plan additions". | DC S5b, S5c, S6b, K0, O2 |

## Phase 5. The P27 round on the candidate, real window (today, computer-use block CU-1)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 5.1 | W preparation (`w1`, `w2`, `w3` in `zz-w11-test`, `w1` dragged to the front), then W1 to W9. Capture the tab bar about every 50 ms for each W step. Use the W1 expectation of 2.4(a). | claude-computer-use | 4.2 | 45 | Each ID is OK against P27:65-73, with W1 as amended. Each walk direction lasts at most 1400 ms. | P27:61-73; SW M3; OM 0.5 |
| 5.2 | Nap 1, which covers N1, P1 and N2. Nothing is saved in SnipMD for 10 minutes. Capture N1. Then this session appends one line to `zz-w11-test\w2.md` from its shell. [inferred] Documents is not under AppData, so the write reaches the real file; the reload in the tab confirms it. Then press `Ctrl+S` once in `w1`, and press no other key for 6 s. | claude-computer-use | 5.1 | 15 | N1: Snip sleeps with the loose Z. P1: after the reload Snip keeps sleeping and no friend comes. N2: the friend walks in, taps, claps, waves and leaves. The whole visit lasts at most 5.5 s. | P27:78-79; DC P1; SW M1, m12; OM 0.5 |
| 5.3 | Nap 2 for N3. Then compare the N1 crops with the 2.2 reference (N4). | claude-computer-use | 5.2, 2.2 | 14 | N3 and N4 are OK against P27:80-81. If the friend first finishes its walk-in before it leaves, note it as SW m3. It is not a FOUT against P27:80. | P27:80-81, 84; SW m3 |

## Phase 6. Steps that need the owner (today, T3 from the evening)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 6.1 | CT1 (light theme and back, W1 again). CT2 (125 %, then 150 %, then 200 %; W1 after each; 8x crops). CT3 (restart at a scale that shrinks the first window). Set 100 % back. The owner changes the settings. Claude captures with the owner's consent. | owner-hand | 5.3 | 25 | Each ID is OK against P27:89-91. At 125 % the top edge is at 10.25 device px [computed: SW m6]. Judge it by eye in the 8x crop. Blur is a FOUT. A fraction alone is not. | P27:89-91; SW m6, m8 |
| 6.2 | CT4: a USB stick is plugged in, pulled out and plugged in again, as Claude asks. | owner-hand | 6.1 | 6 | OK against P27:92. | P27:92; ROADMAP.md:12 |
| 6.3 | CT5: the owner switches Animation effects off. Claude runs W1, W3, and nap 3 with N1 to N2. The owner switches the effects on, and Claude runs W1 again. | owner-hand | 6.2 | 15 | OK against P27:93. Record whether the idle breath stops right after the toggle or only at the next state (SW m5). | P27:93; SW m5 |
| 6.4 | T1 (hold Enter for 2 s on a toggle). T2 only with an AZERTY keyboard, otherwise NIET GETEST. | owner-only | 6.3 | 2 | T1: the toggle changes once. | P27:98-99 |
| 6.5 | K1 for both plans, once. The owner closes SnipMD and starts it from the Start menu. Press `Ctrl+Shift+T` until nothing comes back. This session diffs `session.json` and reads `u1.md`. | owner-hand | 6.4, 4.3 | 4 | The tabs come back, the test tabs too. `u1.md` still holds `nieuw`. Snip stands at home. | P31:64; P27:82 |
| 6.6 | T3: the owner works with the candidate and writes what he notices. It starts when he reopens SnipMD after 7.1. Under path B it covers this evening and tomorrow morning. | owner-only | 7.1 | 0 | The owner's note says that Snip does not disturb and that the titles stay readable. | P27:100 |

## Phase 7. Budgets, reports, text corrections (today)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 7.1 | The owner closes SnipMD. In his own PowerShell he runs `powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\snipmd-1.1.0-rc\measure.ps1"`. The default exe is the installed `%LOCALAPPDATA%\SnipMD\snip-md.exe`. He does not touch the PC while it runs, and saves the output to a file. The script overwrites the clipboard. The installer size comes from the setup file of 2.3, because the script reports it only for a setup next to the exe. | owner-hand | 6.5 | 10 | Paste is under 150 ms. Memory is under 120 MB. Own start is under 150 ms. Cold start is under 1 s. The setup from 2.3 is under 10 MB. | IN\pr100.md:24; releasing.md:47-57; measure.ps1:20-22, 28, 45 |
| 7.2 | Write `findings/windows/w11-20261031.md` and `findings/windows/w11-20261027.md` in Dutch, in the report format of each plan. Add the addendum of 2.4. Commit each report to its test branch. | this-session-offscreen | 7.1, 4.3, 5.3, 6.4 | 30 | Every ID reads OK, FOUT or NIET GETEST with a reason. No FOUT in 1.1 scope is open. | P31:66-72; P27:102-108; ROADMAP.md:25-26 |
| 7.3 | One docs-only commit on `claude/release-1.1.0`: replace the budgets table in `docs/releasing.md`, set `CHANGELOG.md:5` to the tag day, and add the CHANGELOG line of D8. The message ends with `Co-Authored-By: Claude` only. Update the PR #100 body: run 16 is the tested build, the head differs from 1a3e086 in docs only, and the sentence at line 13 is corrected (see 7.4). Set the body again and read it back. 15 min plus 10 min CI. | this-session-offscreen | 7.2 | 25 | CI `check` and `check-macos` are green on the new head. `git diff 1a3e086 HEAD --stat` lists only `CHANGELOG.md` and `docs/releasing.md`. | RM 1.3; IN\pr100.md:10, 13; RC\.claude\CLAUDE.md "Public-repo rules" |
| 7.4 | Correct the public text that is now false. PR #100 line 13 and the #98 intro say that an open during a save keeps one tab. DC M1 shows that this holds only after the save has finished its write. Append that case to #98 item 1 (same root cause: the path is held only from `markSaved`). File one issue for SW M1, M2 and its minors, and one for DC m5. No model names and no session links. | this-session-offscreen | 1.1 | 15 | The edited texts contain no claim that DC M1 contradicts. Each new issue names its probe file. | DC M1, m5; SW M1, M2; IN\issues.md #98; RC\.claude\CLAUDE.md |

## Phase 8. Release (tomorrow by default, after T3; see D11)

Guards for every install leg in 8.2 and 8.6 on the owner's PC. Each guard is part of the gate of its step.
- G-a. Take a fresh backup as in 2.5 right before the first leg.
- G-b. The owner's SnipMD stays closed for the whole step.
- G-c. Each leg starts with an uninstall of the current version from Settings, Apps, with *Delete the application data* unticked [cited RC\README.md:60].
- G-d. Untick the launch option on the finish page of every setup, the 1.1.0 setup included. Single instance does not depend on `SNIPMD_DATA_DIR` [cited OM 0.1; RC\src-tauri\src\lib.rs:466], so an auto-started copy would capture the test launch.
- G-e. Start the old version and then the new 1.1.0 only from the owner's own PowerShell, with the same `SNIPMD_DATA_DIR` set to a new empty folder for that leg.
- G-f. Double-click no `.md` file while an old version is installed. The file association would start it on the real session.
- G-g. The last sub-step installs the shipped 1.1.0 (8.6) or the RC (8.2) and starts it from the Start menu.

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 8.1 | Go or no-go. The owner reads both reports, the budgets, the macOS dry run and his T3 note. | owner-only | 7.2, 7.3, 2.1, 6.6 | 10 | No open FOUT in 1.1 scope. CI is green on the PR head. | releasing.md:6; ROADMAP.md:25 |
| 8.2 | Optional (D5, default yes): a dry run of the update from 1.0.0 with the RC setup, under guards G-a to G-g. This session prepares the commands and checks the versions and the test session offscreen. | owner-hand | 8.1 | 12 | Guards G-a to G-g hold. The setup asks to close SnipMD. There is no downgrade prompt. Settings, Apps lists one SnipMD 1.1.0. The test tabs come back. After G-g the owner's real tab ids and titles in `session.json` equal those in the fresh backup. | releasing.md:43; IN\findings-w11-20261023.md:25 |
| 8.3 | The owner merges PR #100. 5 min plus 10 min CI. | owner-hand | 8.1, 8.2 | 15 | CI on the merge commit is green. The three version files on `main` read 1.1.0. | RM section 2, step 1; IN\pr100.md:6 |
| 8.4 | The owner pushes the tag `v1.1.0` on the merge commit. Release Windows runs `build`, `publish` and `notes`. | owner-hand | 8.3 | 25 | All three jobs are green. The release has `SnipMD_1.1.0_x64-setup.exe`, the MSI and the portable exe. It is not marked as a pre-release. The body starts with the CHANGELOG section. | RM section 2, step 2; release-win11.yml:54-61, 91, 106 |
| 8.5 | Run Release macOS from Tags, `v1.1.0`, with **publish** on. This session may dispatch it on the owner's go. Do not start it from `main`: a run from `main` is green and publishes nothing. | owner-hand | 8.4 | 30 | No `FAIL` or `BLOCKED` probe line. The release has four files. The body has the preview text and one Download block. | RM section 2, step 3; release-macos.yml:124; ROADMAP.md:55 |
| 8.6 | Smoke step 8 with the shipped setup: one leg over 1.0.0 and one over 1.1.0-4, on the machine of D5, under guards G-a to G-g. This session downloads the setups with `gh release download` and checks versions and test sessions offscreen. | owner-hand | 8.4 | 25 | For each leg: the setup asks to close SnipMD, there is no downgrade prompt, Settings, Apps lists one SnipMD 1.1.0, and the test tabs come back under the leg's `SNIPMD_DATA_DIR`. Final gate: after G-g the owner's real tab ids and titles in `session.json` equal those in the fresh backup. | releasing.md:43; IN\pr100.md:25; this plan, choice 6 |
| 8.7 | Rewrite the 1.1 section of `.claude/ROADMAP.md` and record the Dependabot rule of D2 under "Decisions in force". Move the process records (reports, run args) to `archive/1.1-process`. Do this on a branch with a PR. | this-session-offscreen | 8.6 | 30 | A cold session can read the state from ROADMAP.md. Nothing goes to `main` directly. | RM 2, step 5; RC\.claude\CLAUDE.md "Process records" |

## Critical path

Path A, T3 not blocking (tag today): 1.1, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6.
- Total: about 388 minutes, so 6.5 hours of wall clock [computed: 15+6+4+2+3+30+20+45+15+14+25+6+15+2+4+10+30+25+10+12+15+25+30+25; all inputs conj].
- Three nap waits make up 30 minutes of that time. During each wait this session drafts the reports.
- 2.1 (macOS dry run), 2.2, 2.3, 2.4 and 7.4 run in parallel and stay off the path.
- Step 2.6 is optional. Step 8.7 comes after the release.

Path B, T3 blocking (default, D11):
- Today: 1.1 to 7.3. That is about 271 minutes, so 4.5 hours [computed: the first 18 terms above].
- T3 runs from the end of 7.1 through this evening and tomorrow morning.
- Tomorrow (2026-11-10, after the quota reset): 8.1 to 8.6. That is about 117 minutes [computed: 10+12+15+25+30+25].
- Step 7.3 then sets the CHANGELOG date to 2026-11-10.

Owner time: about 146 minutes of hand actions over both days [computed: 1.1 15, 3.1 4, 3.3 3, 6.1 25, 6.2 6, 6.3 15, 6.4 2, 6.5 4, 7.1 10, 8.1 10, 8.2 12, 8.3 5, 8.4 5, 8.5 5, 8.6 25; all inputs conj]. The owner also stays reachable for prompts during CU-2 (about 50 min) and CU-1 (about 74 min). Add the T3 use.

## Session cards

| Card | Steps | Model | Effort | Worktree | Where | Reason |
|---|---|---|---|---|---|---|
| S1 `<ddmon>-snipmd-rc-fix` | 1.2 and the failure branch, only when a fix is needed | the large model | high | yes, on `claude/release-1.1.0` | cloud | ROADMAP.md:53 keeps one writer for the code. A fix in the save path or in `pet.ts` needs a careful test. |
| S2 `09nov-snipmd-w11-test` | CU-2 (phase 4), CU-1 (phase 5), the capture parts of phase 6, the report 7.2 | the large model | medium | no (it changes no code) | local, on the owner's PC | Computer use needs the owner's desktop. A child session keeps the coordinator's context free. The coordinator may also run these blocks itself. |
| This session | 2.x, 3.2, 7.3, 7.4, 8.7, the offscreen checks | (as now) | (as now) | no | local | It holds `gh` and git access and the full context. |

## Failure branch

When a test step reports a FOUT:
1. This session classifies the FOUT in the report:
   - In 1.1 scope and small: it is fixed on the candidate.
   - Outside scope, or not small: it becomes an issue labelled for 1.1.1.
   - It needs a product decision: it goes to the owner.
   These rules come from ROADMAP.md:25.
2. Fix on the candidate:
   - Session card S1 makes the fix on `claude/release-1.1.0`, with a unit test. ROADMAP.md:53 keeps one writer for the code. S1 runs `npm run lint`, `npm test` and `cargo test -p snipmd-core`.
   - Rebuild: this session dispatches Release Windows (build only) and Windows run on the new head. If `src/` or `src-tauri/` changed, it also dispatches Release macOS without publish.
   - This session downloads the new artifact (as in 2.3). The owner installs it (3.1 to 3.3).
3. Retest: the failed step, plus every step that exercises the changed module.
   - `src/saving.ts`, `src/tabs.ts`, `src/external.ts`, `src/paths.ts`: S1 to S7, S4b, G1 to G5, O1, K1.
   - `src/pet.ts`, `src/petSprite.ts`: W1, W3, nap 1 (5.2), CT5.
   - `src-tauri/`: all S, G and O steps, plus a fresh 7.1 if start-up code changed.
   - A Snip FOUT does not stop the P31 round. A saving FOUT does not stop the P27 round. Steps on unrelated code keep their result from the first build.
4. Release-time failures:
   - 8.4 fails its tag check: the owner deletes the tag, fixes the cause, and tags again [cited RM section 2, "What can fail"].
   - 8.5 ends BLOCKED: run it again once.
   - 8.5 ends FAIL: comment on #30. macOS stays a preview and does not block 1.1.0 [cited ROADMAP.md:33]. The owner decides whether the Windows release stands without a dmg.
   - 8.6 fails: the release is public. The fix goes to 1.1.1. Until then the release notes say what to do. Step 8.2 exists to find this case before the tag.
5. A budget over its target in 7.1 goes to the owner (D13).

## Owner decisions

| ID | Decision | Options and consequences | Default and why |
|---|---|---|---|
| D1 | DC M1: an open during a running first save or Save As adds a second tab. | (a) Ship it and document it in #98 item 1. Nothing is lost silently, because the stale stamp refuses the write. The trigger is an Explorer open of the same file during the write. (b) Fix it before the install: hold the target path from the start of the save, with `OUT\probe-race.test.ts` as the test. This adds about 2 hours (step 1.2) and one rebuild. | (a). The fix touches the save path that P31 tests. Its root cause is already deferred as #98 item 1. |
| D2 | Dependabot #101 (marked) and #102 (dialog with rfd 0.17, single-instance). | (a) Merge both before the install and rebuild: +1 rebuild, and the dialogs and the second instance are tested on the new crates. (b) Wait for 1.1.1, with a freeze on bumps until the tag. (c) #101 only. | (b). The tag then equals the tested source. No advisory is named [cited RM 3.4]. Record the freeze rule in ROADMAP. |
| D3 | The asset pack (new icons). | (a) Put it in 1.1.0 before the install: one more artifact and an icon test. (b) 1.1.1. (c) A separate decision with no date. | (b). It changes the binary and needs its own visual test [cited SC section 2]. |
| D4 | The install path for the tests. | (A) 1.1.0-3, then 1.1.0-4, then the RC: +5 owner minutes, and a path no user takes after the tag. (B) 1.1.0-3 straight to the RC. P27 I2 to I4 then read NIET GETEST, superseded. | (B). Release step 8 names this update [cited releasing.md:43]. Snip code is the same [cited SW:6]. |
| D5 | Smoke step 8: where, and whether there is a dry run before the tag. | (a) The owner's PC after the tag only, under guards G-a to G-g. (b) As (a), plus the dry run 8.2 over 1.0.0 with the RC setup before the tag (+12 min). (c) Another machine or a VM for the old versions: no risk to the owner's data, if one is at hand. | (b). No report in IN records an update from 1.0.0 to a 1.1 build (the 23 Oct round did not reinstall, because 1.1.0-1 was already there [cited IN\findings-w11-20261023.md:25]). 1.0.0 is `Latest`, so most users take that path. |
| D6 | Optional retest rows S5b, S5c, S6b, K0, O2. | Include: up to 18 min, run inline at their DC positions (step 4.3), and two extra restarts of the owner's app (S6b, K0). Leave out: these behaviours keep only their unit and integration tests [cited OM 0.4]. B3 ("absent" kept across a restart) then has no Windows step. | Leave out. They are minor in DC. S4b and P1, the two gaps that DC rates highest, are in the default path. |
| D7 | What this session may commit and edit. | (a) Reports to the two test branches, the docs-only commit on the PR branch, the PR #100 body, #98 and two new issues. The merge and the tag stay with the owner. (b) The owner approves each commit. | (a). It is the smallest number of hand-offs. Merge and tag stay with the owner [cited IN\pr100.md:6]. |
| D8 | A CHANGELOG line for "one tab per note on open". | Add it, or leave the section as it is. | Add it. Word it to cover `.` and `..` paths and two opens at once only. It must not claim the open-during-save case [cited SC section 3; DC M1]. |
| D9 | SW M1 and M2 (Snip stays asleep after two quick saves; Snip parked over a tab after a nap during a moment). | (a) Issues for 1.1.1. (b) A fix before the install (step 1.2). | (a). The effect is visual. The next save or the next moment ends it [inferred from SW M1, M2]. The code is the same as in v1.1.0-4. |
| D10 | Computer use on the owner's desktop. | (a) A go-ahead for CU-2 (phase 4, about 50 min) and CU-1 (phase 5, about 74 min), each announced before it starts. (b) The owner does those steps by hand. Claude checks offscreen. (c) The vite demo only: W and N then read "demo OK, NIET GETEST on Windows". | (a). Option (c) does not pass the gate [cited CONVENTIONS.md:58]. Option (b) costs the owner about 2 hours more [conj]. |
| D11 | Does T3 block the tag? | Blocking: the tag is tomorrow. T3 then covers this evening and tomorrow morning, not a full day. Not blocking: the tag is today, and T3 feeds 1.1.1. | Blocking. T3 asks whether a walking Snip is calm enough (#72) [cited P27:100]. That is a judgement on a feature that ships in a final release. |
| D12 | The Apple Developer ID before the tag. | Buy it first: the tag waits for secrets and a first signed run. Ship the preview dmg. | The preview dmg [cited ROADMAP.md:33, 57]. |
| D13 | A budget over its target in 7.1. | Ship and record it, or fix it first (back to step 1.2). | Decide when it happens. The 1.0 values had margin [cited releasing.md:53-57]. |

## Risks
- DC M1 ships if D1 stays (a). A user who opens a note from Explorer while it is being saved gets two tabs. The second tab's stale stamp prevents data loss [cited DC M1].
- SW M1 can show up in T3 when two saves come within about 2 s after a nap. Step 5.2 limits the input to one save, so a FOUT there is a new finding, not SW M1.
- The MSI update from 1.1.0-4 to 1.1.0 is untested. Windows Installer may treat both as the same version [conj, RM 1.2]. The smoke test covers the NSIS setup only.
- Release Windows at the tag is a fresh build, so the shipped bytes are never the bytes of run 16 [computed: RM 1.2]. Smoke step 8 on the shipped setup closes this gap after the release.
- Dependabot opens new PRs every Monday [cited RM 3.1]. Without the freeze rule of D2, the candidate can move again.
- The owner's PC runs the candidate from step 3.1 on. A FOUT that hurts daily use is the owner's to judge. The backup from 2.5 allows a return to the old data folder.
- Smoke legs on the owner's PC uninstall and reinstall his daily app. Guards G-a to G-g keep old versions away from his real session. A missed guard G-d or G-f lets an old version read it.
- Computer use pastes overwrite the owner's clipboard [cited IN\findings-w11-20261023.md:83]. The budgets script does the same [cited measure.ps1:20].
- The linked `node_modules` in RC lacks seven packages, so `src/tabs.test.ts` does not load locally [cited DC "Checks run"]. The full `npm test` evidence for 1a3e086 comes from CI and run 16, not from this machine.
