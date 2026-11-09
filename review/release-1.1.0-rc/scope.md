# Scope of 1.1.0: what is in, what waits, what the owner decides

Basis: release candidate `claude/release-1.1.0` at 1a3e086 (PR #100), read in RC. Labels: [cited] = file and line or input file; [computed] = derived from named inputs; [conjectured] = needs a check that is named.
Paths: RC = the worktree of the candidate. IN = the exported inputs. "facts" = IN\facts.md.

## 1. Decisions table

| Item | What it is | Class | Reason | Owner options (only for "owner decision") |
|---|---|---|---|---|
| PR #100 Release 1.1.0 | The candidate: version 1.1.0, CHANGELOG section, one-tab-per-note fixes, hygiene. | in 1.1.0 | Open, mergeable, CI green, 0 commits behind main [cited: facts.md:8]. | none |
| Windows test of v1.1.0-4 (plan `test/w11-20261027`) | Snip walk, nap and friend, update 1.1.0-3 to 1.1.0-4, CT1-CT5, T1-T3. | in 1.1.0 | ROADMAP lists it as open before 1.1.0 [cited: RC\.claude\ROADMAP.md:25]. No report exists [cited: facts.md:17]. The owner's PC still has 1.1.0-3 installed, so the update step can run as written [cited: facts.md:23]. | none |
| Retest of the candidate (plan `test/w11-20261031`) | Saving S1-S7, closed tab G1-G5, two double-clicks O1, K1, on the Release Windows artifact of 1a3e086. | in 1.1.0 | ROADMAP item 2 [cited: ROADMAP.md:26]. #79 and the one-tab-per-note fixes came after the last Windows test [cited: facts.md:12]. Artifact exists, 5 299 530 bytes, expires 2027-01-30 [cited: facts.md:9]. | none |
| Budgets on the 1.1.0 build | Measure the table in `docs/releasing.md` on the owner's PC. | in 1.1.0 | Owner step before the tag [cited: ROADMAP.md:27]. The last table is from 1.0; the startup chunk grew from 397 to 437 KB [cited: ROADMAP.md:27]. | none |
| Tag v1.1.0, Release macOS with publish, smoke test step 8 | The release act itself. | in 1.1.0 | Owner pushes the tag; a cloud session cannot [cited: ROADMAP.md:55]. Step 8 is an install over 1.0.0 and over 1.1.0-4 [cited: ROADMAP.md:27]. | none |
| #74 setup "uninstall first" page | Stock Tauri NSIS page on every update. | in 1.1.0 (as documentation only) | Settled for 1.1: say it in the docs; no data at risk [cited: ROADMAP.md:31; issues.md #74 "Proposal"]. The text is already in README and release notes (section 3). Own template or updater waits for #51. | none |
| #98 minors (7) | Deferred findings of the final review. | split, see section 4 | Only item 7 is test-only. | none |
| Dependabot #101 marked 18.1.1 to 18.1.2 | Patch bump of the read-mode parser. Release notes list fixes to emphasis, html blocks, block quotes and nested image alt text [cited: dependabot-prs.md:14-33]. | after 1.1.0 as 1.1.1 | It changes parser output in read mode, which the Windows tests have not seen. It edits `package.json` and `package-lock.json`, which #100 also edits [cited: dependabot-prs.md:3; facts.md:8], so a merge first forces a rebase of #100 and makes the tested artifact differ from the tag [computed: file overlap plus 1a3e086 being the artifact commit]. | none |
| Dependabot #102 dialog 2.8.3 to 2.8.4, single-instance 2.5.4 to 2.5.5 | Lockfile-only bump of two Tauri plugins. | owner decision | The dialog bump moves `rfd` to 0.17, the native file and folder picker used by Open, Save As and the first-save folder button [cited: dependabot-prs.md:97; issues.md #80 "Today"]. The single-instance bump fixes a Windows race where a second instance fails to exit [cited: dependabot-prs.md:168]. Both are on paths the tests cover. | (a) Merge after the tag, ship as 1.1.1: the tested build equals the tag, the single-instance fix waits. (b) Merge before the RC retest and rebuild the artifact: the fix ships, the retest plan must add one Open, one Save As, one folder pick and one double-click while SnipMD runs; this costs one more Release Windows run. (c) Close it and let Dependabot reopen: no effect. |
| #51 updater | Tell users about a newer version. | after 1.1.0 as 1.2 | Needs a SPEC change first (§4, §8, §12) [cited: issues.md #51 "What it collides with"]. ROADMAP lists it as backlog [cited: ROADMAP.md:38]. The owner's choice among option 0, A and B is open [cited: issues.md #51 comment 2026-10-26: "Proposal: 0 now; A ... B after a Developer ID"]. | none for 1.1.0 |
| #80 drop "Other folder..." | Remove a button from the first-save bar. | after 1.1.0 as 1.1.1 or 1.2 | Backlog [cited: ROADMAP.md:38]. It changes SPEC §6.2 and README and touches the first-save flow that the retest covers [cited: issues.md #80 "Check before building"]. | none |
| #59 rename by double-click on a tab | New feature with a safe-rename design. | after 1.1.0 as 1.2 | "Outside the current scope (SPEC §12): backlog" [cited: issues.md #59]. | none |
| #58 insert table | New command. | after 1.1.0 as 1.2 or a plugin | Outside scope; the shorthand idea is routed to plugins (#81) [cited: issues.md #58 comment]. ROADMAP: feature issues stay unbuilt until the plugin decision [cited: ROADMAP.md:36]. | none |
| #25, #26, #39 edge cases and performance | Deferred lists from the v1 reviews. | after 1.1.0 as 1.2 | #25: "None is on the common path". #26: "Pick them up when a measurement asks for one" [cited: issues.md #25, #26]. #39: "None of these lose data on a normal path" [cited: issues.md #39]. | none |
| #30 macOS | Mac checklist, signing, Apple Developer account. | owner decision (for the Developer ID); the Mac test is after 1.1.0 | ROADMAP: the Mac test does not block 1.1.0; macOS stays a preview [cited: ROADMAP.md:33]. The $99 a year Apple program is the owner's call [cited: issues.md #30 last open box; ROADMAP.md:57]. | (a) Ship 1.1.0 with the macOS preview dmg as 1.0.0 did: no cost, users must clear the quarantine flag [cited: install-macos.md via issues.md #30]. (b) Buy the Developer ID before the tag: delays the tag until secrets and a first signed run exist, and the path has not run yet [cited: issues.md #30]. |
| Asset pack (icons, logos) | Two themes of icons and README logos, not in git. | owner decision | See section 2. | (a) Before the tag: the release gets a real icon, costs a Windows icon test and one more artifact run. (b) As 1.1.1: the 1.1.0 test result stays valid. (c) Separate decision, no date: nothing changes until the owner picks a theme. |

## 2. The asset pack

Facts [cited: IN\asset-pack-README.md; facts.md:28]: `assets/snipmd-asset-pack/` is untracked, 58 files, 13 MB. It holds two themes. Each theme has `src-tauri/icons/` and `brand/`. `apply-theme.ps1` copies both with `Copy-Item -Force` into `src-tauri\icons` and `docs\brand` of the repo root (read in `assets\snipmd-asset-pack\apply-theme.ps1`).

What ships now [cited: RC\src-tauri\icons, `ls -l`; `file`]:
- `32x32.png` 136 bytes; `128x128.png` 404 bytes; `128x128@2x.png` 1 436 bytes (256x256); `icon.png` 1 436 bytes (256x256); `icon.ico` 1 610 bytes.
- `icon.ico` holds two images, 32 and 256 px [computed: header of `icon.ico` read with Python]. There is no 16 px image, so small sizes are scaled by Windows.
- `bundle.icon` lists exactly those five files [cited: RC\src-tauri\tauri.conf.json:47-53]. There is no `.icns` in the list.
- The README shows no logo; its first lines are the title and three badges [cited: RC\README.md:1-5]. `docs/brand` does not exist [computed: `ls docs/brand` fails in RC]. The window title bar draws no app icon: `src/titlebar.ts` and `index.html` have no icon or logo reference besides button glyphs [computed: grep].

Files an apply would change [computed: apply script plus both folder listings]:
- Overwritten, 5 files: `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png`, `icon.ico`. These are the only icon files the build reads [cited: tauri.conf.json:47-53].
- Added to `src-tauri/icons`, 13 files: `16x16.png`, `icon-1024.png`, `icon.icns`, nine `Square*Logo.png` tiles, `StoreLogo.png`. The build ignores them unless `bundle.icon` also lists them [computed: the list above]. `icon.icns` matters only if the owner wants the macOS app icon; whether Tauri then uses it needs a macOS build to confirm [conjectured].
- Added to `docs/brand/`, 9 files: `icon.svg`, `favicon.svg`, `favicon.ico`, `logo-light/dark` as svg and png, `social-preview` as svg and png (listing of `brand` in theme 1). Nothing links them until README gets the snippet from the pack README. The social preview is a GitHub repository setting and cannot be committed [conjectured; confirm in the repository settings].
- Size: theme 1 `icon.ico` is 137 428 bytes and `icon.icns` 1.6 MB [computed: `ls -l`]. The Windows artifact is 5.3 MB against the 10 MB installer budget [cited: facts.md:9; SPEC.md:148]. The 137 KB ico fits that margin. The repo grows by about 6.4 MB per theme folder if committed whole [computed: `du`], so commit only the applied files.
- Not in git, in no PR, origin unknown [cited: facts.md:28].

Is it a user-visible change that needs its own test? Yes. A new icon changes the exe, the setup, the Start menu entry, the task bar button, the Explorer icon of the `.md` association, and Settings, Apps. The README header changes what GitHub shows.
Test it as a separate plan:
1. Windows, runner or owner PC: build via Release Windows; install; check the icon in Explorer on the setup and exe at small, medium and large views (16, 32, 48, 256 px come from the ico), Start menu, task bar pinned and running, Alt+Tab, and a `.md` file with SnipMD as the default app.
2. Windows scaling: 100%, 150% and 200%. The owner's main screen is 100% [cited: facts.md:27]; the second screen setting is not recorded here [missing fact].
3. README on GitHub in light and dark: the `<picture>` block with both logos, at desktop and phone width. This needs the branch pushed or a rendered preview; no network here.
4. Title bar and window: the app draws no icon there today (above), so a window icon appears only through the OS; check it.
5. macOS: icns is not wired; a Mac test belongs to the open Mac test [cited: ROADMAP.md:33].

Process concerns, not art:
- Theme 1 is described as crimson under cream and charcoal paper [cited: IN\asset-pack-README.md:10]. SPEC §14 decision 9 avoids orange and red for Snip because they read as Claude's colour or as an error [cited: RC\docs\SPEC.md §14 row 9]. That rule covers Snip, not the app icon. Whether it carries over is the owner's call [conjectured scope of the rule].
- Theme 3 uses ochre, terracotta and sage [cited: IN\asset-pack-README.md:23]. No SPEC rule bears on it.
- The pack README is Dutch and its snippet writes the tagline "Paste, type, keep going" with an em dash in the `alt` text; the repo rule for public text is plain sentences [cited: IN\asset-pack-README.md:60; user preferences]. Fix when applied.
- The apply script uses `-Force` and keeps no backup. Git is the backup, so apply only on a branch.

Recommended timing: as 1.1.1, or a separate decision. Reason: the candidate is built and the Windows retest ties to artifact 1a3e086 [cited: facts.md:9]. An icon swap changes the binary and needs its own visual checks. It does not fix a defect. If the owner wants a branded 1.1.0, do the swap on a branch off the candidate, run Release Windows, and run the icon test above together with the retest, so there is one more artifact and no second retest [computed: the retest has not run yet, facts.md:18]. This is option (a), and the pack must then be committed before the retest starts.

## 3. #74

Settled decision [cited: RC\.claude\ROADMAP.md:31]: "the setup's 'uninstall the older version first' page (#74) is stock Tauri behaviour with no data at risk; the README and release notes say how to update (#77), and a setup that skips the page waits for #51."
This matches the issue's own proposal: option 1 for 1.1, option 2 or 3 when #51 is decided [cited: issues.md #74 "Proposal"].

Check of the texts:
- README line 60: "To update, close SnipMD and run the new setup. If it offers to uninstall the older version first, either choice keeps your notes and open tabs; leave *Delete the application data* unticked." [cited]. It says what ROADMAP says.
- Release notes: `release-notes.yml:54` has the same sentence word for word [cited]. The release page text is generated by that workflow when the assets include a setup exe [cited: release-notes.yml:48-54]. ROADMAP's claim holds.
- CHANGELOG `[1.1.0]` (lines 5-34 of RC\CHANGELOG.md) has no line about the setup page [cited]. That is consistent: the ROADMAP does not say the CHANGELOG carries it, and the CHANGELOG lists app changes. No action.
- The CHANGELOG `[1.1.0]` Fixed section says a note can no longer be saved to a path open in another tab [cited: CHANGELOG.md, Fixed first bullet]. It has no line for the main fix on the candidate, one tab per note for opens (`.` and `..` paths, two opens at once) [cited: facts.md:8; SPEC §12 "one tab per note (§6.4)"]. A grep of CHANGELOG for "one tab", "same note", "twice" and "already open" finds nothing [computed]. Gap for the owner; it is a one-line edit.

Two gaps in the wording of README line 60 against the issue [cited: issues.md #74 "Seen"]:
- If the user did not close SnipMD first, the uninstaller asks "SnipMD is running! Click OK to kill it" and ends SnipMD without its normal close. The README does not say so; its first clause, "close SnipMD", is the prevention. The data risk is low because SnipMD writes on window blur [cited: issues.md #74 "Risk"].
- "Either choice keeps your notes" has evidence for the default choice only (uninstall first, data box off): notes and tabs came back [cited: findings-w11-20261026.md:82-83 and FOUT 1 text]. The *Do not uninstall* path is in the 27 Oct plan, which has no report [cited: facts.md:17]. Run it in the Windows test of -4 or in smoke step 8 before the tag; if it fails, the sentence is wrong [computed from the two cited lines].

## 4. #98 minors

Rule applied: "yes" only if the change cannot alter what the Windows retest exercises, so a unit test or a Rust `cargo test` is enough. The retest covers saving, closed tabs, one tab per note and double-click opens [cited: facts.md:18]. Any change to the shipped bundle also makes the artifact differ from the tested one [computed].

| # | Minor | Take before the tag? | Reason |
|---|---|---|---|
| 1 | Save does not reserve its target while it runs (#25) | No | It changes `refuseHeld` and the save path in `src/saving.ts`, the code that retest steps S1-S7 test [cited: facts.md:18]. The race needs two saves at the same instant and nothing is lost silently, since stamped writes catch it [cited: issues.md #98 item 1]. |
| 2 | `restore()` does no path check for a 1.0 session with two tabs on one path (#25) | No | It changes startup restore, which every user hits [cited: RC\src\tabs.ts:178]. The trigger is a 1.0 session with two tabs on one path, which 1.0 could produce only by the bug the candidate fixes. A cheap unit test exists, but the behaviour change is tested only by a Windows start. Take it in 1.1.1. |
| 3 | Find count rescans at idle after every keystroke (#26) | No | It changes timing in `src/editor/search.ts`, the idle callback at lines 63-78 [cited]. Timing is not covered by jsdom reliably, and the cost (185 ms on 2.5 MB, no match) is an edge case [cited: issues.md #98 item 3]. |
| 4 | `.markdown` names in the first-save bar | No | The page appends `.md` unless the name ends in `.md` or `.markdown` [cited: RC\src\firstSaveBar.ts:28-31]; Rust refuses `.markdown` [cited: issues.md #98 item 4]. Either fix changes the first-save bar or Rust, both on the retest path. The choice between the two fixes is also open. |
| 5 | Note's own `<input type="checkbox">` is live in read mode | No | The fix touches `src/preview/render.ts`, the sanitizer hook (lines 21-38) beside the task-box code that re-enables the app's own boxes (`box.disabled = false`, line 160) [cited]. A note's own inputs and the app's tasks share that path, so a wrong fix could disable clickable tasks, a shipped feature. Unit tests would catch it, but the Windows test of -4 does not exercise read-mode clicks, so keep it out of the tagged build [conjectured; confirm by checking which plan step clicks a task]. |
| 6 | `..` above a UNC share: Rust and TS disagree | No | Rust `normalize` in `src-tauri/core/src/paths.rs:164-182` is the path check for every command (guardrail 8) [cited]. The open is refused either way today [cited: issues.md #98 item 6]. `cargo test -p snipmd-core` covers a fix, but a Rust change makes the binary differ from the tested artifact, and the gain for a user is nil. Take it in 1.1.1. |
| 7 | No test that a reload does not wake Snip and that first save and Save As do | Yes | Unit tests only, in `src/saving.test.ts`, which today covers `writeTab` only for this [cited: issues.md #98 item 7; saving.test.ts:125 "a written note is a save for Snip"]. No product code changes, so the tested artifact stays the tested artifact. If a test fails, that is a defect to report, not to fix before the tag without the owner knowing. |

Count [computed]: 1 yes, 6 no. All seven stay open on #98 after the tag, except item 7 if done.

## 5. For the owner, in order

1. Run the two Windows tests on the owner's PC or with computer use (each needs an announced go-ahead per the owner's rule): -4 plan, then the candidate retest. Add the *Do not uninstall* update path to one of them.
2. Choose the three owner decisions: #102 timing, asset pack timing, whether the Apple Developer ID blocks the tag.
3. Optional edits to PR #100 before merge: one CHANGELOG line for one tab per note on open; item 7 tests. Neither changes shipped code.
4. Measure budgets, merge #100, tag, run Release macOS with publish, smoke step 8.

Missing facts [not in IN]: the second screen's scaling for the icon test; whether the Windows tests read or click a task box in read mode; whether Tauri uses `icon.icns` for the macOS bundle with the current `bundle.icon` list.
