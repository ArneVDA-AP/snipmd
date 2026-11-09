# Plan: a stable, clean SnipMD 1.1.0 and a tidy repo after it

Goal: ship 1.1.0 from a head that the Windows tests ran on, and leave the repo so that a cold session can continue and nobody has to touch 1.1.0 again next week.

Date of the plan: Monday 2026-11-09. The quota resets on 2026-11-10.

Labels. [cited X:n] is a file and a line. [computed: inputs] is derived from the named inputs. [inferred] needs the confirmation that is named. Short names: IN, OUT and RC are the folders of the brief. DC = OUT\diff-coverage.md. SW = OUT\snip-walk-review.md. OM = OUT\offscreen-map.md. RM = OUT\release-mechanics.md. SC = OUT\scope.md. P27 = IN\TESTPLAN-WIN11-20261027.md. P31 = IN\TESTPLAN-WIN11-20261031.md. All minute figures are estimates [inferred], except where a figure is cited.

## 1. Starting state (what the plan rests on)

- PR #100 (branch `claude/release-1.1.0`, head 1a3e086) is open, mergeable, CI green, and 0 commits behind `main` [cited IN\facts.md:8].
- Release Windows run 41255262735 built 1a3e086. The artifact is 5 299 530 bytes and expires 2027-01-30 [cited IN\facts.md:9].
- No Windows report exists for v1.1.0-4 or for the RC. P27 never ran [cited IN\facts.md:17-18].
- The owner's PC has 1.1.0-3 installed, and the owner's SnipMD runs with his own tabs [cited IN\facts.md:23-24].
- No Release macOS run exists on the RC [cited IN\ci-runs.md:12-16].
- The readers found no blocker. They found these majors:
  - DC M1: an open whose read ends before a running first save or Save As ends its write adds a second tab on the same note. Probe `OUT\probe-race.test.ts` shows it (observed by the reader) [cited DC:62].
  - PR #100 says the opposite: "An open that reads while a save takes the same path also keeps one tab" [cited IN\pr100.md:13]. The #98 intro says the same [cited IN\issues.md:39].
  - SW M1: a second note write during the friend's walk-in leaves Snip asleep [cited SW:19].
  - SW M2: a nap that starts during a moment leaves Snip asleep over a tab title [cited SW:20].
  - SW M3: the W1 expectation "geen sprongen" cannot hold for a far tab, because every walk is capped at 1.4 s [cited SW:21]. SPEC already says "A walk takes at most 1.4 s, however far the tab" [cited RC\docs\SPEC.md:48]. The plan text is wrong, not the code.
  - DC M2 and M3: P31 has no step for *Save again* while the note is still gone, and P31 hands the rest to P27, which never ran [cited DC:63-64].
- The linked node_modules in RC lacks 7 packages, so `src/tabs.test.ts` and `src/integration.test.ts` did not load in the reader's check [cited DC:11, 77].

## 2. The tag rule

A step gates the tag only if it checks code that changed in 1.1, or the artifact that ships. Every other step follows the tag.

| Group | Gates the tag? | Reason |
|---|---|---|
| Install over 1.1.0-x, version check, restart (I, K) | Yes | It checks the update path to the shipped version. |
| S, G, O, P1, K0 (saving, closed tab, one tab per note, wake rule) | Yes | The code changed in the RC [cited DC:21-34]. |
| W1-W9, N1-N3 (Snip walk, nap, friend) | Yes | New in 1.1.0-4 and never tested on Windows [cited IN\facts.md:17]. |
| CT1 (light and dark), CT2 (scale), CT5 (reduced motion), T1 (held key) | Yes | They touch Snip, the command menu and the Copy button, which are new in 1.1 [cited P27:89-98]. |
| Budgets with measure.ps1 | Yes | PR #100 and ROADMAP make it a step before the tag [cited IN\pr100.md:24; RC\.claude\ROADMAP.md:27]. It is a docs table, so it does not block the build. |
| CT3 (first window inside the screen), CT4 (USB stick), T2 (AZERTY) | No | They are leftovers from the 1.0 tests and cover code that 1.0.0 already shipped [cited RC\.claude\ROADMAP.md:12]. |
| T3 (a day of use) | No (default) | It is a judgement of feel, the question of #72 [cited P27:100]. It feeds 1.1.1. Owner option D8 makes it a gate. |
| Asset pack, Mac test hand-off, ROADMAP rewrite, archive, issue cleanup | No | They change no shipped code of 1.1.0. |
| Dependabot #101 and #102 | No, unless folded into a rebuild | See D3. |

## 3. Two paths

The owner picks one with D1 and D2 (section 7). The deadline for that choice is the start of Phase 4 (the test block on the owner's PC). Before Phase 4 a fix costs one rebuild and one review. After Phase 4 a fix also costs a retest of the touched steps [computed: no Windows evidence exists yet, IN\facts.md:17-18].

- **Path F (fix first, the default).** Fix DC M1, SW M1 and SW M2 on the RC branch. Fold in #101 and #102. Rebuild once. Test the new head.
- **Path S (ship 1a3e086).** Test 1a3e086 as it is. Correct the public text of PR #100 and #98. Take the fixes and the bumps in 1.1.1.

Steps marked [F] run only on path F. Steps marked [S] run only on path S. Unmarked steps run on both paths.

## 4. Phases and steps

### Phase 0. Decisions (today, now)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 0.1 | The owner reads this plan and picks D1 to D11 (section 7). | owner-only | none | 15 | Each decision has an answer or the default stands. | brief "Plan rules" |
| 0.2 | The owner says whether this session has bounded authority for this release: commits on branches, PR body edits, workflow dispatch, the report. Merges into `main`, the tag, Windows settings and computer use stay with the owner. | owner-only | none | 2 | A yes or a no is recorded. | RC\.claude\CLAUDE.md "Autonomous runs"; IN\pr100.md:6 |

### Phase 1. The final candidate (today)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 1.1 | Make a fresh worktree of `claude/release-1.1.0` with its own `npm ci`. Run `npm run lint`, the full `npm test`, `npm run build` and `cargo test -p snipmd-core` in `src-tauri/`. | this-session-offscreen | 0.1 | 20 | All pass. `src/tabs.test.ts` and `src/integration.test.ts` load and pass unstubbed. | DC m8 (DC:77); RC\docs\CONVENTIONS.md "Verification" |
| 1.2 [F] | Merge #101 (marked) and #102 (dialog, single-instance) into `main` on GitHub. Wait for CI on `main`. | owner-hand | 0.1 | 15 | CI `check` and `check-macos` on `main` are green. | RM 3.3 (RM:90-100); IN\facts.md:10 |
| 1.3 [F] | Fix session on `claude/release-1.1.0`. (a) Merge `main` into the branch. (b) DC M1: a running first save or Save As holds its target path from the start of the write until `markSaved`; `openNote` and `refuseHeld` consult it. (c) SW M1: `wakeUp` does nothing while a visit runs. (d) SW M2: the nap bumps `visit` and sends Snip home. (e) Turn `OUT\probe-race.test.ts` and probes P1 and P6 of `OUT\probe-pet-nap.test.ts` into regression tests that assert the fixed behaviour. Add one test with two saves to one path. (f) #98 item 7 tests (a reload does not wake Snip; a first save and Save As do). (g) One CHANGELOG `Fixed` line for one tab per note on open. (h) Run `/simplify`. Card: cloud, model: large, effort high, no worktree (cloud branch). Reason: ROADMAP keeps one code writer, the cloud session. | cloud-session | 1.2 | 120 | `npm run lint`, `npm test`, `npm run build`, `cargo test -p snipmd-core` pass. CI `check` and `check-macos` on the new head are green. The regression tests fail on 1a3e086 and pass on the new head. | DC:95; SW "Recommendations"; SC:87; RC\.claude\ROADMAP.md:53 |
| 1.4 [F] | Review the fix diff with a thin-review unit that did not write it. Question: does the change keep every SPEC behaviour, and does the pending path also close #98 item 1 (two saves to one path)? | this-session-offscreen | 1.3 | 20 | No open blocker or major. The #98 item 1 claim [inferred] holds only if the two-saves test passes. | RC\.claude\CLAUDE.md "Finishing a change" |
| 1.5F | On the new head, dispatch Release Windows (build only), Windows run with `snip_sleep=true`, and Release macOS without publish. | runner | 1.4 | 35 | All three green. The setup is under 10 MB. No `FAIL` or `BLOCKED` probe line on macOS. The blobs `snip-sleep-light.png` and `snip-sleep-dark.png` differ (N4). | RM 1.2 (RM:34-35); OM N4 (OM:70) |
| 1.5S | Dispatch Release macOS without publish on 1a3e086. | runner | 0.1 | 30 | No `FAIL` or `BLOCKED` line. The dmg is under 10 MB. | RM:113-118 |
| 1.6 | Rewrite the PR #100 body. Name the run that built the tested head. Correct line 13: on path F say the race is fixed with its test; on path S remove the claim. Replace "Before the tag" items 1 and 2 with the one combined test of Phase 2. Set the body again after any tool edit and read it back. On path S this step depends on 0.2 only. | this-session-offscreen | 1.5F | 10 | The body names the tested head and its run. No session link and no model name. The footer is only `Co-Authored-By: Claude`. | IN\pr100.md:13, 19-25; RC\.claude\CLAUDE.md "Public-repo rules" |
| 1.7 [S] | Edit #98: item 1 also covers an open whose read ends during a running first save or Save As. Remove "as is an open that reads while a save takes the same path" from the intro. | this-session-offscreen | 0.1 | 5 | The issue text matches probe-race. | IN\issues.md:39-41; DC:62 |

### Phase 2. One test plan for the head that ships (today, parallel with Phase 1)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 2.1 | Write one Dutch plan `TESTPLAN-WIN11.md` on a new branch `test/w11-20261109`, built from P31 and P27. Install route per D4. Add the rows S4b, S5b, S5c, S6b, K0, O2 and P1 from DC (translated). Add N2b: after a nap, two saves within 2 s. Correct O1: use `hertest-twee.md` and a note that the plan itself creates. Reword W1: judge each direction against the 1.4 s cap and whole-cell steps, not "geen sprongen". Mark each step that the headless check (3.1) or the runner (2.3) already covers. Drop the phrase "Al de rest dekt het plan van 27 oktober". | this-session-offscreen | 0.1 | 45 | Each changed behaviour B1 to B12 (DC:21-34) and SW M1, M2 and m12 has a step. No step depends on a plan that never ran. | DC:79-93; SW:42-56; P31:3, 63 |
| 2.2 | Audit the plan with a thin-review unit that did not write it. | this-session-offscreen | 2.1 | 15 | No open major. | ~/.claude/CLAUDE.md "audited by an agent that did not build it" |
| 2.3 | Optional (D5). Write a runner retest script on a test branch: install the setup, run S1 to G5, O1 and the runner part of K1 with window shots, and a silent install over 1.0.0 that checks the version and the session. Card: local, model: large, effort medium, worktree yes. Reason: it needs `gh` and a push of a workflow step, and the workflow scope of a cloud token is not confirmed [inferred]. | local-session | 2.1 | 90 | The run is green. The report says which bytes were installed: the setup of the named run, or a fresh build of the same commit. The session opened each window shot and says what it saw. | OM 0.2 (OM:16); OM S1-K1 rows (OM:83-96) |
| 2.4 | Run the script of 2.3 on the tested head. | runner | 2.3, 1.5F | 25 | As 2.3. If it is not green before 4.4 starts, 4.4 falls back to the owner's hand. | OM:83-96 |

### Phase 3. Offscreen checks on the head that ships (today)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 3.1 | Headless Snip check (OM section 2) from the worktree of 1.1, on the tested head: W1 to W9, N1 to N3 and N2b, the CT1, CT2 and CT5 pre-checks. Stop vite and playwright at the end. | this-session-offscreen | 1.1, 1.4 [F] | 45 | `document.hasFocus()` is true before any sample. Each walk lasts min(1400, steps/40*1000) ms within one frame. Every change of x is a whole number of cells. A friend visit lasts at most 5500 ms. On path F, Snip ends idle after two saves in N2b. With reduced motion, Snip does not walk. | OM:102-180 |
| 3.2 | Read the Windows run of the tested head: install smoke, window shots, runner budgets as a reference. | this-session-offscreen | 1.5F | 10 | The install smoke passed. The session opened the shots and says what it saw. | OM R1-R2 row (OM:53) |

### Phase 4. The owner's PC (today if the owner has about 2 hours, else tomorrow morning)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 4.1 | Record step 0 (Windows build, scale, keyboard, theme, Animation effects, installed version). Copy `%APPDATA%\com.snipmd.desktop\` to a dated backup folder on the Desktop. Copy `session.json` for the later diff. | this-session-offscreen | 2.2 | 5 | The file count and the byte sum of the backup equal the source. | OM 0 and I1 rows (OM:51, 54) |
| 4.2 | Under option B (D4) this step is skipped. Download the v1.1.0-4 setup with `gh`. The owner starts it from Explorer and picks **Do not uninstall**. The session checks the exe FileVersion first and HKCU second, and diffs `session.json`. | owner-hand | 4.1 | 5 | One SnipMD at 1.1.0-4. The owner's tabs are back. Nothing went into the Claude package folder. | P27:56-58; OM I2-I3 rows (OM:55-56) |
| 4.3 | Download the setup of the tested head with `gh run download`. The owner starts it from Explorer. Under A' he picks the default **Uninstall before installing** with *Delete the application data* unticked. Under B he picks **Do not uninstall**. The session checks as in 4.2. On path S the setup is the artifact of run 41255262735. | owner-hand | 4.2, 1.5F | 5 | One SnipMD at 1.1.0. The owner's tabs are back. Under A' both setup choices now have evidence on this PC. | P31:41-42; SC:73; RM:59 |
| 4.4 | The S, G, O, K0, P1 and N2b steps of the 2.1 plan. If 2.4 is green, only O2, P1, N2b and K1 remain here. Otherwise the owner does them by hand, or a computer-use session does them after the owner's explicit go-ahead. With 2.4 green, this step takes about 25 minutes. | owner-hand | 4.3 | 60 | Each ID is OK, FOUT or NIET GETEST with what was seen. | DC:83-91; OM section 3 (OM:182-195) |
| 4.5 | CT1, CT2 (125 % first, then 150 % and 200 %, plus one W1 paste at 100 %), CT5 and T1. The owner changes the setting or holds the key. The session records and checks the captures. | owner-hand | 4.3 | 30 | Each ID is OK, FOUT or NIET GETEST. | OM section 4 (OM:197-202); SW:47-48 |
| 4.6 | Budgets. The owner closes his SnipMD and runs `tools\measure\measure.ps1 -Exe "%LOCALAPPDATA%\SnipMD\snip-md.exe"` from his own PowerShell, on the installed tested exe. The session writes the table. | owner-hand | 4.4, 4.5 | 15 | Each value is under its SPEC section 9 target. | RC\docs\releasing.md:46-57; OM:10-15 |
| 4.7 | Write `findings/windows/w11-20261109.md` on `test/w11-20261109`: step 0, the tested run and commit, a table for every ID, each FOUT with steps, bar texts literally. | this-session-offscreen | 4.4, 4.5, 3.1 | 20 | No ID is missing. Every FOUT is classified by the failure branch (section 6). | P31:66-72 |

### Phase 5. The release (tomorrow 2026-11-10 by default; today if Phase 4 ends early)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 5.1 | One docs-only commit on `claude/release-1.1.0`: CHANGELOG.md:5 gets the tag date, docs/releasing.md gets the budgets table. On path S, add here the #98 item 7 tests and a CHANGELOG line that names only what the RC fixes: a path with `.` or `..` and two opens at once no longer give a second tab. On path S the line must not claim one tab in every case, because the open-during-save race stays open. Tick the PR #100 checklist with the report path. | this-session-offscreen | 4.7, 4.6 | 15 | CI on the new head is green. `git diff --stat <tested sha> HEAD` lists only CHANGELOG.md and docs/releasing.md (on path S also src/saving.test.ts). | RM 1.3 (RM:40-47); SC:69, 87 |
| 5.2 | The owner merges PR #100. | owner-hand | 5.1 | 5 | CI on `main` is green. `package.json`, `tauri.conf.json` and `Cargo.toml` on `main` read 1.1.0. | RM:56 |
| 5.3 | The owner pushes tag `v1.1.0` on the merge commit. | owner-only | 5.2 | 2 | The tag points at the merge commit. | RC\docs\releasing.md:6, 18; IN\facts.md:33 |
| 5.4 | Release Windows publishes. | runner | 5.3 | 20 | `build`, `publish` and `notes` are green. Three files. Not a pre-release. The body starts with the CHANGELOG section. | RM:57 |
| 5.5 | Release macOS from the ref Tags, `v1.1.0`, with **publish** on. The owner dispatches it, or the session does on his word. | runner | 5.4 | 25 | No `FAIL` or `BLOCKED` line. Four files on the release. The body has the preview text once. | RM:58, 62, 70 |
| 5.6 | Shipped-bytes check. The session downloads the published setup. The owner installs it over the RC from Explorer. The session checks the FileVersion and the release page with `gh release view`. | owner-hand | 5.4 | 10 | The published setup installs and starts. The owner's tabs are back. This is a same-version reinstall and proves the shipped bytes only, not an upgrade. | RC\docs\releasing.md:43; RM:37 |

### Phase 6. After the tag (none of these delays the tag)

| ID | Action | Who | Depends on | Min | Gate | Source |
|---|---|---|---|---|---|---|
| 6.1 | Rewrite `.claude/ROADMAP.md`: the 1.1 section becomes "v1.1.0: released" in the shape of the v1.0.0 section; open items; the dependabot rule (D7); the combined-test rule; the 1.1.1 scope (6.5). On a branch, as a PR. | this-session-offscreen | 5.5 | 30 | A cold session can name what is open from ROADMAP.md alone. | RM:60; RC\.claude\ROADMAP.md:21-33 |
| 6.2 | Move the process records to `archive/1.1-process`: the findings of `test/w11-20261109`, the plans of 27 and 31 October, the run args in `.claude/runs/`. Commit on the archive branch only. | this-session-offscreen | 5.4 | 20 | `main` holds no review, findings or run args. Deleting the test branches is an owner decision. | RC\.claude\CLAUDE.md "Process records"; RC\.claude\ROADMAP.md:50 |
| 6.3 | Issues. #100 closes with the merge. Rewrite #98 to what remains. Keep #74 open for #51. File DC m5 (refused write of a closed tab sent again on each blur), DC m6 and m7 (path spellings, with #98 item 6), and the Snip minors of SW in one issue. | this-session-offscreen | 5.4 | 20 | Each deferred finding has one issue. No session link and no model name. | DC:74-76; SW:25-38; RC\.claude\ROADMAP.md:31 |
| 6.4 | Path S only: merge #101 and #102 into `main` after the tag, once CI is green. New Monday PRs follow D7. | owner-hand | 5.4 | 10 | CI on `main` is green. | RM 3.4 (RM:102-106) |
| 6.5 | Propose the 1.1.1 and 1.2 scope (section 8). The owner picks. | this-session-offscreen | 6.3 | 20 | The owner has a list to accept or cut. | SC section 1 |
| 6.6 | Asset pack (D6): after the owner picks a theme, apply it on a branch off `main`, commit only the applied files (5 icon files, `docs/brand`, the README logo block without the em dash), build with Release Windows, and run the icon test of SC section 2. Card: local, model: mid, effort medium, worktree yes. Reason: the pack exists only on this PC and is untracked. | local-session | 6.5 | 90 | The icon test of SC:45-50 passes. The session opened the screenshots at small and large sizes and says what it saw. | SC:27-58; IN\facts.md:28 |
| 6.7 | Mac test hand-off: update `TESTPLAN-MAC.md` on `test/mac-20261026` to the 1.1.0 preview dmg, and post the link on #30. | this-session-offscreen | 5.5 | 20 | The plan names the 1.1.0 dmg. The Mac test does not block anything. | RC\.claude\ROADMAP.md:33 |
| 6.8 | The owner's leftovers that follow the tag: CT3, CT4, T2 (only with AZERTY), T3 (a day of use). | owner-only | 5.6 | 25 plus one day | Each result goes into the report or a new issue. | P27:91-100 |
| 6.9 | Clean up: remove the 1.1 worktree and scratch files; keep the backup of 4.1 until the owner releases it; keep the notes in `zz-w11-test\`. | this-session-offscreen | 6.2 | 10 | The workspace is as found plus the deliverables. | P31:74; ~/.claude/CLAUDE.md "Workspace" |

## 5. Critical path

Path F (default) [computed: sum of the step minutes on the chain]:
- Today: 0.1 (15), 1.2 (15), 1.3 (120), 1.4 (20), 1.5F (35), 4.1 (5), 4.2 (5), 4.3 (5), 4.4 (60), 4.5 (30), 4.6 (15), 4.7 (20). Total: 345 minutes, about 5 hours 45 minutes. With 2.4 green, 4.4 takes 25 minutes and the total is 310 minutes. The owner's own time in this chain: 145 minutes (0.1, 1.2, 4.2 to 4.6), or 110 minutes with 2.4 green.
- Parallel and off the chain: 1.1, 2.1 to 2.4, 3.1 and 3.2 run while 1.3 runs or while the owner works.
- Tomorrow: 5.1 (15), 5.2 (5), 5.3 (2), 5.4 (20), 5.5 (25), 5.6 (10). Total: 77 minutes.

Path S [computed: same method]:
- Today: 0.1 (15), 2.1 (45), 2.2 (15), 4.1 to 4.7 (140). Total: 215 minutes, about 3 hours 35 minutes. 1.5S, 1.6, 1.7 and 3.1 run in parallel.
- Tomorrow, or tonight: 77 minutes as above.

The expensive Claude work (1.3, 1.4, 2.1 to 2.3, 3.1) falls on today, where the quota is. Phase 6 needs about 4 hours of session time and an owner choice for 6.5 and 6.6. It can run tomorrow after the tag or later.

## 6. Failure branch

When a test step reports FOUT:
1. Classify it within 15 minutes, in the report (4.7).
   - Class 1: in 1.1 scope and a data, save, open or core-loop defect. It blocks the tag.
   - Class 2: cosmetic or minor, or a Snip motion detail. It becomes an issue for 1.1.1. No rebuild.
   - Class 3: it needs a product decision (for example "Snip is too busy" from T3). It goes to the owner.
   - Class 4: environment (runner drift, a BLOCKED macOS probe on a changed image). Rerun the workflow once.
2. For class 1, the cloud session fixes it on `claude/release-1.1.0` with a test that fails before the fix (step 1.3 card). A thin-review checks it (1.4).
3. Rebuild as in 1.5F: Release Windows, Windows run, and Release macOS without publish.
4. Retest only the steps that the fix touches:
   - `src/saving.ts`: S1 to S7, S4b to S6b, G3 to G5, K0, K1.
   - `src/tabs.ts` (open) or `src/paths.ts`: O1, O2, G5.
   - `src/pet.ts` or `src/petSprite.ts`: 3.1 in full, then W1 and N2b on the owner's screen.
   - Rust paths or commands: O2, S3 to S5, `cargo test -p snipmd-core`.
   - A dialog or single-instance crate: S3, S4, S5, G4, O1.
   Install the new setup over the current one with **Do not uninstall**, and repeat only the version check of 4.3. Rerun 2.4 if it exists.
5. Stop rule: if a second class-1 FOUT appears in the same area, the owner decides: ship with a named known issue in the CHANGELOG, or move the tag.
6. A FOUT at 5.4 or 5.5 (after the tag is public): Windows publishes only when `build` passes, so a failing build publishes nothing [cited RC\docs\releasing.md:18]. A wrong tag is deleted and pushed again on the right commit before any publish [cited RM:65]. A macOS failure is rerun; nothing was published before `publish` [cited RM:69].

## 7. Owner decisions (with the default and its reason)

- **D1. DC M1 (two tabs when an open reads during a running first save or Save As): fix before the tag, or ship?** Default: fix (path F). Reason: no Windows evidence exists yet, so the fix costs one rebuild and a review and no extra test round. The PR text already claims it is fixed. No edit is lost silently either way, because the second tab's stamp is stale [cited DC:62]. Deadline: before Phase 4 starts. Alternative: ship 1a3e086 and correct PR #100 and #98 (1.6, 1.7).
- **D2. SW M1 and M2 (Snip stays asleep; Snip parked over a tab): fix before the tag, or ship?** Default: fix in the same session as D1. Reason: same cost argument, the probes exist, and both appear in normal use [cited SW:19-20]. Both heal on the next save or moment [inferred from SW:19-20]. Alternative: a 1.1.1 issue.
- **D3. Dependabot #101 and #102.** Default: if D1 or D2 is fix, merge both before 1.3, so one rebuild and one test round cover them. The test steps S3 to S5, G4, O1, S7 and G5 exercise the new crates [cited RM 3.2]. If both D1 and D2 are ship, hold both for 1.1.1 (6.4), so the tested source equals the tag [cited RM:113-118]. Alternative: only #101 (read mode only) [cited RM:108-111].
- **D4. Install route.** Default: A', which is 1.1.0-3 to 1.1.0-4 with **Do not uninstall**, then 1.1.0-4 to the tested head with the default **Uninstall before installing**. Reason: about 5 more owner minutes give evidence for both setup choices, which README line 60 claims [cited SC:73], and cover "over 1.1.0-4" of smoke step 8. Alternative: B, straight from 1.1.0-3 with **Do not uninstall** [cited OM:98-100].
- **D5. Runner retest script (2.3, 2.4).** Default: yes, written in parallel and off the critical path. Reason: it moves S, G and O1 off the owner's screen now and for 1.1.1 later. Fallback: the owner's hand, or computer use with his go-ahead.
- **D6. Asset pack.** Default: not in 1.1.0. Do it as 1.1.1 with path 6.6, after the owner picks a theme. Reason: it changes the binary, needs its own icon test, and fixes no defect [cited SC:58]. Theme 1 uses crimson; SPEC section 14 decision 9 avoids red for Snip, and whether that carries over to the app icon is the owner's call [cited SC:53]. Alternative: a branded 1.1.0, applied before 1.3 so one rebuild covers it.
- **D7. Dependency freeze.** Default: after 1.2 (path F) or from now (path S), no dependency merge into `main` or the RC until the tag. Monday PRs wait for 1.1.1. A security advisory is the exception and goes to the owner. Record it in ROADMAP "Decisions in force" (6.1). Reason: Dependabot runs every Monday, so a freeze never comes without a rule [cited RM:82].
- **D8. T3 as a gate.** Default: no; T3 follows the tag (6.8). Alternative: tag after one day of use, which moves the tag to 2026-11-11.
- **D9. Smoke step 8 coverage.** What each install proves:
  - 4.3 proves the RC source installs over 1.1.0-4 (under A') or 1.1.0-3 (under B), with the page the user sees.
  - 5.6 proves the shipped bytes install and start. It is a same-version reinstall, not an upgrade.
  - 2.4 (if D5) proves that data survives a silent upgrade from 1.0.0. #74 names only `/UPDATE` and passive mode as skipping the *Already Installed* page [cited IN\issues.md:16]. A silent `/S` install shows no setup pages at all [inferred; confirm in the 2.4 log]. So 2.4 does not show what users see.
  - The 1.0.0 to 1.1.0 path with the page stays untested unless the owner provides a machine with 1.0.0. Default: accept that gap and name it in the report. Reason: no machine here has 1.0.0 [cited IN\facts.md:23].
- **D10. Bounded authority (0.2).** Default: yes for branches, PR bodies, workflow dispatch and the report. Merges into `main`, the tag, Windows settings and computer use stay with the owner. Reason: PR #100 reserves merge and tag to the owner [cited IN\pr100.md:6].
- **D11. Apple Developer ID.** Default: not a blocker; macOS ships as a preview again. Reason: ROADMAP says the Mac test does not block 1.1.0 [cited RC\.claude\ROADMAP.md:33, 57].

Settled without a decision (the brief asked for them):
- **CHANGELOG date.** Set CHANGELOG.md:5 to the tag date in 5.1. No workflow reads it, so it needs no rebuild and no retest [cited RM:40-47].
- **#74 wording.** README line 60 and release-notes.yml line 54 stay as they are [cited SC:66-67]. If 4.2 or 4.3 shows that a setup choice loses tabs, reword both in 5.1 before the merge.
- **#98 minors.** Take item 7 (tests only) before the tag [cited SC:87]. On path F, the pending path closes item 1 only if the two-saves test of 1.4 passes [inferred]. Items 2 to 6 go to 1.1.1 [cited SC:79-89].

## 8. Proposed scope after 1.1.0

- **1.1.1 (patch, no SPEC change):** #101 and #102 if held; the Monday bumps under D7; #98 items 2 to 6; DC m5, m6, m7; the Snip minors of SW (m1 to m11 as the owner chooses); the asset pack (D6); the MSI check from 1.1.0-4 to 1.1.0 [cited RM:38, conjectured there]; anything class 2 from Phase 4 or T3.
- **1.2:** #51 (updater; needs a SPEC change) [cited SC:19]; the plugin decision (#81) and the feature issues behind it [cited RC\.claude\ROADMAP.md:35-36]; #80, #59, #58; the #25 and #26 lists; the own NSIS template of #74 option 2, if #51 does not settle it [cited IN\issues.md:26-29].

## 9. Risks

- The fix session can break the save or open path. The review (1.4), the regression tests and the retest of S, G and O cover it.
- rfd 0.17 (inside #102) changes the native file dialogs, and no unit test covers them [cited RM:79, 110]. S3 to S5 and G4 cover it on path F.
- The runner script depends on SendKeys, the native dialog and a cross-run artifact download that is not confirmed [cited OM:16, 85]. It stays off the critical path, and the owner's hand is the fallback.
- A setup or the app started from this session's shell can write into the Claude package's virtual folders [cited OM:13]. Every launch goes through Explorer or the Start menu, and the FileVersion of the exe is the primary version check [cited OM:56].
- Phase 4 needs about 2 hours of the owner's time. The inputs do not say whether he has it today. Without it, Phase 4 moves to tomorrow and the tag moves to the evening of 2026-11-10 or to 2026-11-11.
- The macOS probes can end BLOCKED on a changed runner image [cited RM:28]. 1.5 runs them before the tag.
- The MSI treats 1.1.0-4 and 1.1.0 as one version [conjectured, RM:38; confirm by installing the 1.1.0 MSI over a 1.1.0-4 MSI install]. The MSI is for managed installs and does not block the tag.
- T3 can find Snip too busy. That is class 3 and a product decision, for example the default of Show Snip.
- The 1.0.0 to 1.1.0 update with the *Already Installed* page stays untested (D9).
