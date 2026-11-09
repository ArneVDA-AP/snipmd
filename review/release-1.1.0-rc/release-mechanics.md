# Release mechanics: from "merge PR #100" to "1.1.0 on the Releases page"

Labels: [cited] means a file and line or a command output. [computed] means derived from named inputs. [conjectured] means a guess, with what would confirm it.
Paths: RC = the release candidate worktree (branch claude/release-1.1.0, commit 1a3e086). IN = the coordinator's input folder. Line numbers refer to RC unless a path under IN is given.

## 0. Starting state
- main is at 56c5ee0 and the RC is 0 commits behind it. [cited] `git log --oneline origin/claude/release-1.1.0..origin/main` printed nothing.
- The RC differs from main in 21 files, 156 insertions and 39 deletions. [cited] `git diff origin/main origin/claude/release-1.1.0 --stat`.
- No Windows report exists for v1.1.0-4 or for the RC. [cited] IN\facts.md:17-18.
- No Release macOS run exists on the RC. The last one is run 40428103417 on 8aed99b (v1.1.0-4). [cited] IN\ci-runs.md:12.
- Today is Monday 2026-11-09. [computed] `date -d 2026-11-09 +%A` printed Monday.

## 1. Tag-time checklist

### 1.1 What each workflow tests

| # | Condition | Enforced at | RC now | Label |
|---|---|---|---|---|
| 1 | Tag equals `package.json` version, `tauri.conf.json` version and the first `version =` in `Cargo.toml`. A mismatch throws before the build. | release-win11.yml:54-59 | package.json:4 is 1.1.0. tauri.conf.json:4 is 1.1.0. Cargo.toml:3 is 1.1.0. Tag `v1.1.0` satisfies it. | cited |
| 2 | macOS: tag equals `package.json` version only. | release-macos.yml:62-66 | 1.1.0 | cited |
| 3 | Cargo.lock agrees with Cargo.toml. No workflow compares the version text. `cargo check --locked` and `cargo test --locked` fail if the lock needs an update. | ci.yml:52,56; release-macos.yml:60 | Cargo.lock entry `snip-md` is 1.1.0 (Cargo.lock:3191-3192). package-lock.json lines 3 and 9 are 1.1.0. | cited |
| 4 | CHANGELOG has a line containing `## [1.1.0]`. A miss throws before the build. | release-win11.yml:61 | CHANGELOG.md:5 reads `## [1.1.0] - 2026-11-01`. | cited |
| 5 | Release notes: the tag must match `^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9]+)?$`. | release-notes.yml:38 | `v1.1.0` matches. | computed |
| 6 | Release notes: the section must start with `## [1.1.0]` at column 1 and be non-empty. The awk stops at the next `## [`. `## [1.1.0-4]` does not match, because `]` follows `0`. | release-notes.yml:40-41 | The section runs CHANGELOG.md:5-27 and is non-empty. | cited |
| 7 | Release notes rewrite the body: the CHANGELOG section, then a Download block built from the asset names. `gh release edit` sets it. | release-notes.yml:42-63 | Runs as the `notes` job after `publish` in both release workflows (release-win11.yml:109-116, release-macos.yml:141-148). | cited |
| 8 | Windows size budget: the `*-setup.exe` must be under 10 MB. | release-win11.yml:75-77 | The build on 1a3e086 succeeded, so the step passed. The artifact (three files, zipped) is 5 299 530 bytes. | cited (IN\ci-runs.md:2,19) |
| 9 | macOS size budget: the `.dmg` must be under 10 485 760 bytes. | release-macos.yml:83-88 | Not run on the RC. | cited |
| 10 | macOS probes: any line `: FAIL - ` or `: BLOCKED - ` fails the run. The probes include screen capture and accessibility, which can end BLOCKED when the runner image changes. | release-macos.yml:109-113; tools/measure/macos-probe.sh:66,72 | Not run on the RC. The last green run is 13 days old. | cited; the drift risk is conjectured |
| 11 | Publish gates: Windows publishes only on a tag push. macOS publishes only when the `publish` input is on and the ref is a tag. | release-win11.yml:91; release-macos.yml:124 | A tag push publishes Windows. macOS needs a manual run. | cited |
| 12 | A tag with `-` is a pre-release. `v1.1.0` has none, so the release is not a pre-release. | release-win11.yml:106; release-macos.yml:138 | `v1.1.0` has no `-`. | computed |
| 13 | Any tag `v*` starts Release Windows. | release-win11.yml:9-10 | Do not push a stray `v*` tag. | cited |

### 1.2 Gaps the workflows do not test
- Items 8 to 10 have no evidence on the RC for macOS. The first macOS build of the 1.1.0 code happens at tag time unless a dry run is made first. [computed] from IN\ci-runs.md.
  - A manual Release macOS run on the branch `claude/release-1.1.0` without `publish` builds and probes. The tag check is skipped, because `startsWith(github.ref,'refs/tags/')` is false (release-macos.yml:63). [cited]
- Budgets in docs/releasing.md:51-57 are from 1.0 (2026-10-21). The workflows do not read that table. Measuring is a manual step (PR #100 "Before the tag" item 3). [cited] IN\pr100.md:24.
- The retest checks source, not bytes. The tag build is a fresh build in every option, so the shipped files are never the byte-identical run 16 artifact. [computed] from release-win11.yml:63-64. Smoke step 8 on the shipped setup closes that gap.
- MSI upgrade from 1.1.0-4 to 1.1.0: [conjectured] Tauri's MSI takes a numeric suffix as the fourth version field (docs/releasing.md:22 says the MSI accepts only digits after the dash), and Windows Installer ignores the fourth field when it compares versions. The MSI may then see 1.1.0 and 1.1.0-4 as the same version. A test would be installing the 1.1.0 MSI over a 1.1.0-4 MSI install. The smoke test (releasing.md:43) covers the NSIS setup only, and the MSI is for managed installs. Do not block on it. Name it in the release if it fails.

### 1.3 The CHANGELOG date
- CHANGELOG.md:5 says 2026-11-01. Today is 2026-11-09. PR #100 says "change it if the tag comes later". [cited] IN\pr100.md:10.
- The only file to change is CHANGELOG.md, line 5, to the tag date. The compare link at line 9 stays.
- No workflow reads the date. The tag check matches `## [1.1.0]` as plain text (release-win11.yml:61). The notes awk matches the prefix `## [1.1.0]` and skips the heading line (release-notes.yml:40). The release page shows the publish time, not the CHANGELOG date. [cited]
- The date is not compiled into the app. [computed] `grep -rIn CHANGELOG src src-tauri/src src-tauri/tauri.conf.json src-tauri/build.rs vite.config.* tools` returned no hit.
- Consequence: no new build and no retest. It is one docs-only commit on PR #100. The commit changes the PR head, so CI runs again on the PR. Run 16 and run 15 on 1a3e086 no longer name the head, but their source is identical. [computed]
- Make the date commit together with the other docs-only edit that must land before the merge: the budgets table in docs/releasing.md:49-57. That gives one extra CI run, not two.
- Set the date on the day of the tag. If the tag slips past midnight, the date is off by a day. This is cosmetic.

## 2. Owner sequence after the tests (docs/releasing.md)

Source: docs/releasing.md:5-10, 15-18, 34-44, 62-71 and IN\pr100.md:21-25. The order is merge, tag, Release macOS with publish, smoke step 8.

| Step | Owner action | What it produces | Check before the next step |
|---|---|---|---|
| 0 | Reports for v1.1.0-4 and the RC are in. Budgets measured with `tools\measure\measure.ps1`. The table in docs/releasing.md:51-57 is replaced. The CHANGELOG date is set (1.3). Both edits go on the PR branch. | A final PR head. | CI on the PR head is green (`check`, `check-macos`). No open FOUT in scope for 1.1. |
| 1 | Merge PR #100 into main. | main holds 1.1.0. A push to main starts CI (ci.yml:4-5). | CI on the merge commit is green. `package.json`, `tauri.conf.json` and `Cargo.toml` on main read 1.1.0. `CHANGELOG.md` on main has `## [1.1.0]`. If main had no other commits, `git diff <PR head> <merge commit>` is empty (conjectured on the merge strategy: a squash gives a new SHA with the same tree). |
| 2 | Push tag `v1.1.0` on that merge commit. The owner does this, on the owner's go (releasing.md:6). | Release Windows starts: `build` (lint, tests, tag check, `tauri build`, size check, artifact), then `publish` (a release named `SnipMD v1.1.0`, not a pre-release, with three files), then `notes` (the body). | All three jobs are green. The release lists `SnipMD_1.1.0_x64-setup.exe`, `SnipMD_1.1.0_x64_en-US.msi`, `SnipMD_1.1.0_x64_portable.exe`. The body starts with the CHANGELOG section and has a Download block without a macOS paragraph yet. The release is not marked pre-release. The setup is under 10 MB. |
| 3 | Actions, Release macOS, Run workflow, "Use workflow from" Tags, `v1.1.0`, tick **publish**. | The `.preview.dmg` joins the release (no Apple secrets, so the name has `.preview`: macos-package.sh:16-21). The `notes` job runs again and the body gains the macOS paragraph. | No `FAIL` or `BLOCKED` line in the probe output. The dmg is under 10 MB. The release has four files. The body has the preview wording and the Download block is not duplicated (the notes job rebuilds the whole body, release-notes.yml:40-63). |
| 4 | Smoke test step 8 (releasing.md:43): install the new setup over 1.0.0 and over 1.1.0-4, with tabs open. The owner's PC has 1.1.0-3 installed (IN\facts.md:23). | Evidence that the update path works. | The setup asks to close SnipMD. No downgrade prompt. Settings, Apps lists one SnipMD at 1.1.0. Tabs and notes are back. The "Already Installed" page (#74) may show: it is settled as "say it in the docs" (IN\facts.md:11). Steps 1 to 7 and 9 on a clean install are the rest of the smoke test (releasing.md:35-45). |
| 5 | After the check: rewrite `.claude/ROADMAP.md` (its "1.1" section, lines 21-31, still describes the pre-release state), and move process records to the archive branch (the project CLAUDE.md rule). | A cold session can continue. | None. |

Order constraint: run step 3 after step 2 has finished. Release macOS creates the release if none exists (release-macos.yml:134). The Windows files then join a release that has no name set by the Windows job. [cited]

What can fail, by step:
- Step 2, tag check (release-win11.yml:58): the tag and a version differ. The tag is already public. The fix is to delete the tag and push it again on the right commit. [computed]
- Step 2, CHANGELOG check (:61): the section is missing. Not an issue on RC (table row 4).
- Step 2, `npm ci` or `--locked`: a lockfile out of step with its manifest. Dependabot bumps merged into main without a new check are the risk (section 3).
- Step 2, runner drift: Rust stable, `windows-latest` and WebView2 move without a code change. The weekly CI (ci.yml:8-9) shows this on `check` and `check-macos`. The last scheduled run is 2026-11-02 and green (IN\facts.md:6).
- Step 3: probes end BLOCKED on a changed runner image (table row 10). A re-run is possible, because nothing was published before `publish`.
- Step 3, wrong ref: run from the branch `main` and not from the tag. Then `publish` is skipped (release-macos.yml:124), and the tag check is skipped. The run is green and publishes nothing. [computed]

## 3. Dependabot #101 and #102

### 3.1 Facts
- #101 bumps `marked` ^18.1.1 to 18.1.2 in package.json and package-lock.json. [cited] IN\dependabot-prs.md:1-8; RC package.json:40 and package-lock.json:2042-2043 read 18.1.1.
- `marked` is a runtime dependency of read mode. It is used only in `src/preview/render.ts` (lines 2, 114, 143). The output goes through `purify.sanitize` at line 143. [cited]
- The 18.1.2 release notes list 14 fixes: emphasis flanking over the whole delimiter run, block quote tab handling, html block tag names, list item and lazy line cases, nested image alt text, and a performance gain of about 16%. [cited] IN\dependabot-prs.md:14-33. Parsing output of user notes can change in edge cases. [computed]
- #102 changes `src-tauri/Cargo.lock` only: tauri-plugin-dialog 2.8.3 to 2.8.4 and tauri-plugin-single-instance 2.5.4 to 2.5.5. [cited] IN\dependabot-prs.md:82-89; Cargo.lock:3586 and 3650 read 2.8.3 and 2.5.4.
- dialog 2.8.4 contains one change: "Updated dependency rfd to 0.17". The lock holds rfd 0.16.0 (Cargo.lock:2829). A 0.x minor step is a breaking range for the file dialog crate. [cited] IN\dependabot-prs.md:97. The dependabot group labels it a patch bump. [computed]
- single-instance 2.5.5 changes two things: the lock is released in `cleanup_before_exit`, and a Windows race where a secondary instance fails to exit when `FindWindowW` misses the target window is fixed. [cited] IN\dependabot-prs.md:167-168.
- Both PRs show CI green on `check` and `check-macos`. That CI ran against main plus the bump, not against the RC. [cited] IN\dependabot-prs.md:4,85.
- Dependabot runs every Monday for all three ecosystems (.github/dependabot.yml: `interval: weekly`, `day: monday`), and today is Monday. New PRs can arrive at any week boundary. [cited, computed] A "no more bumps before the tag" rule has to be set by the owner. Without one, a freeze never arrives.

### 3.2 Which test steps each bump touches
- #101, read mode: smoke step 7 (read mode on `tools/fixtures/evil.md`, releasing.md:42). The RC retest plan reads notes in read tabs in S7 (`u1.md (disk)`) and G5 (`u1.md (closed)`) (IN\TESTPLAN-WIN11-20261031.md:53,62). Unit tests that run `marked` for real are `src/preview/render.test.ts` and `src/preview/tasks.test.ts`. Other test files mock the renderer. [cited; the test list is computed from grep]
- #102 dialogs: `pick_open`, `pick_save` and `pick_folder` call the dialog plugin (src-tauri/src/lib.rs:87-95, 109-119). The retest steps that use *Other folder…* are S4, S5 and G4 (plan lines 50, 51, 61). [cited]
- #102 single instance: the callback is at lib.rs:466-474. It serves a second double-click in Explorer. The steps are O1 (plan line 63) and smoke step 5. [cited]
- The Windows retest has not started, and the plan names run 16 as the build to install (IN\TESTPLAN-WIN11-20261031.md:41). [cited] A merge after the test voids the run 16 evidence for S4, S5, G4 and O1.

### 3.3 Option (a): merge both into main before the tag, then update the RC
- Steps: merge #101 and #102 into main (each needs green CI). Merge main into `claude/release-1.1.0` (or rebase). PR #100 is then ahead of main by its own commits only.
- Conflicts: none expected. [conjectured; confirm with `git merge-tree` or the PR's "mergeable" state after the first merge.]
  - package.json: RC changes line 4 (version). #101 changes line 40 (`marked`). The hunks are 36 lines apart.
  - package-lock.json: RC changes lines 3 and 9. #101 changes about line 2043 and the `integrity` line.
  - Cargo.lock: RC changes line 3192. #102 changes about lines 3586 and 3650 and the lines for `rfd` and its dependencies.
  - #101 and #102 touch no common file. They merge in any order.
- Workflows to rerun on the new head: CI (`check`, `check-macos`) runs on its own for the PR. Run by hand: Release Windows (build only), Windows run (clean install and screenshots). Release macOS without publish on the branch is worth adding, because no macOS release build exists on the RC.
- Tests touched: read mode (S7, G5, smoke 7), dialogs (S4, S5, G4), single instance (O1, smoke 5). The CHANGELOG needs no line unless the owner wants to mention the single-instance fix. [conjectured]
- Cost if done before the retest: one rebuild and the artifact name in the plan (run 16 becomes the new run). Cost if done after the retest: the three groups above run again.
- Consequence for the release: 1.1.0 ships current dependencies. The rfd 0.17 step and the single-instance change reach users with one retest, not in an untested state.

### 3.4 Option (b): tag first, take them in 1.1.1
- The tested code is exactly the RC: no retest owed and no change to the three workflow runs on 1a3e086.
- The two PRs stay open and CI on main stays green. The next Monday adds more bumps. 1.1.1 starts with an untested pile of dependency changes plus whatever else is by then waiting.
- 1.1.0 ships `marked` 18.1.1 and the old dialog and single-instance crates. Neither bump is a security advisory in the PR text. [cited] No advisory appears in IN\dependabot-prs.md. Dependabot's security updates arrive as soon as an advisory is published (.github/dependabot.yml comment, line 1), so an advisory would be a new PR.
- A user-visible effect of waiting: the single-instance race fix (a second double-click failing to exit) is in 2.5.5 only. [cited] Whether 1.1.0 users hit it is unknown. [conjectured; O1 in the retest on the RC would show it]

### 3.5 Option (c): only one of them
- Only #101: the risk is read mode alone. The retest then adds S7, G5 and smoke 7. It is the smaller retest, and `marked` is the more user-visible dependency. The npm lock is the only lock file touched, so the cargo side stays as tested.
- Only #102: the risk is the Windows dialogs and the second-instance path. The change in rfd 0.17 is the one not covered by unit tests: dialogs run in the real window only. [computed] It adds S4, S5, G4, O1 and smoke 5 to the retest, and those are the steps the owner has to run by hand with computer use.
- Either choice leaves the other PR open for 1.1.1.

### 3.6 Recommendation
Choose (a) only if the dependency merge happens now, before the Windows retest starts. Reason: no retest report exists (IN\facts.md:18), so the cost of (a) is one rebuild of the artifact and not a repeated test. The dialog and single-instance steps are tested by hand either way.

If the retest has already started on run 16 when this is decided, choose (b). A change after the evidence voids it. The next Monday's PRs then wait for 1.1.1 under an explicit rule.

If the owner wants the smallest retest, (c) with #101 only is the middle path. It costs read mode checks only. Reasoning: this is [conjectured] ranking by risk. rfd 0.16 to 0.17 is the largest change in the two PRs.

This is the owner's call. Whichever option, record the rule for later Monday PRs in `.claude/ROADMAP.md` (the process-decisions section).

## 4. Text that still says 1.1.0-4 or pre-release

Command: grep -in "1\.1\.0-4|pre-release|prerelease|preview" over README.md, docs/*.md, CHANGELOG.md, tauri.conf.json, package.json, .claude/ROADMAP.md, .github/*.md. A repo-wide grep for `1.1.0-4` and `1.1.0-3` (excluding node_modules, .git, CHANGELOG.md and package-lock.json) hit only .claude/ROADMAP.md and docs/releasing.md. [cited]

| Location | Text | Should it change for 1.1.0? | PR #100 |
|---|---|---|---|
| README.md:18 | "macOS 13+ is in preview" | No. The macOS dmg is still `.preview.dmg` (macos-package.sh:21). The text is true. | Keeps it. |
| README.md (diff) | The note that 1.1 features live only in a pre-release | Gone. `README.md | 1 -` in the stat. | Handled. [cited] IN\pr100.md:11 |
| CHANGELOG.md:7 | "The pre-releases below were steps on the way" | No. It explains the sections below. | Handled (new text). |
| CHANGELOG.md:30, 40, 47, 57 | "A pre-release for ..." in the 1.1.0-4, -3, -2, -1 sections | No. Historical. docs/releasing.md:9 says these sections stay. | Kept as designed. |
| CHANGELOG.md:21 and 53 | `*.preview.dmg` naming | No. True. | Fine. |
| docs/releasing.md:9, 22, 43, 60 | Policy text with examples (`1.1.0-1`, `1.1.0-3`) and the preview dmg name | No. Examples and rules. | Fine. |
| docs/install-macos.md:3, 5 | "It is a preview"; `.preview.dmg` | No. True while unsigned. | Fine. |
| .claude/ROADMAP.md:22, 25-27 | "`v1.1.0-1` to `v1.1.0-4` are pre-releases"; "Open before 1.1.0"; test steps for v1.1.0-4 | Yes, after the tag. The section describes the state before the release. | PR #100 already rewrote this section as "what is left before the tag" (IN\pr100.md:14). It has to be rewritten again in step 5 of section 2. |
| src-tauri/tauri.conf.json | No match. `version` is 1.1.0 (line 4). | No. | Handled. |
| package.json, package-lock.json | `version` is 1.1.0 (package.json:4; package-lock.json:3, 9). | No. | Handled. |
| release-notes.yml:58 | macOS "a preview" text, built from the asset name | No. Intentional. It applies while the dmg has `.preview`. | Not in PR scope. |

Result: nothing in README, docs or config reads 1.1.0-4 where 1.1.0 should stand. The one text that needs a change after the tag is `.claude/ROADMAP.md`. [computed from the table]

Link note: CHANGELOG.md:9 `compare/v1.0.0...v1.1.0` points to a tag that does not exist until step 2. [cited] It works from then on.

README badge: the "Latest release" badge and the download link point at `releases/latest` (README.md:3, 17). They show v1.0.0 until step 2 publishes a non-pre-release. [cited, with the Latest rule from docs/releasing.md:22]

## 5. Open points for the coordinator
- The result of `git merge-tree` for #101 and #102 against the RC is not available here. The no-conflict claim in 3.3 is conjectured from line positions.
- The merge strategy the owner uses for #100 (merge commit or squash) is not stated in the inputs.
- The owner has not said whether Monday dependabot PRs are frozen until the tag.
