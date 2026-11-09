The release candidate for **SnipMD 1.1.0**, per `docs/releasing.md`. Merge and tag are the owner's: **do not merge before the Windows test** (see "Before the tag").

## What is in it
- **Version 1.1.0** in `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `Cargo.lock`.
- **CHANGELOG**: one `## [1.1.0]` section with everything since 1.0.0 (the pre-release sections stay below it), plus the
  compare link, and a line for one tab per note on open. The date says 2026-11-01; change it if the tag comes later.
- **README**: the note that 1.1 features are only in a pre-release goes. It says what the setup shows when SnipMD runs
  and on every update (the Already Installed page, #74).
- **Hygiene pass**: docs that no longer matched the code (ARCHITECTURE: the commands live in `app.ts`, `diskState.ts`
  holds the conflict flag, the core's `links`, the session's toggles; CONVENTIONS rule 8; SPEC applies to 1.1, §12 lists
  everything added after 1.0), five toggles in the CHANGELOG, four unused exports, a personal path in the demo mock.
  Snip now wakes on a note write only: a note reloaded from disk is not a save (SPEC §4 said so, the code counted a reload).
- **Final whole-app check**: no blocker. Its one major is fixed here. One note could still get two tabs: a path with `.`
  or `..` did not match the open tab (`normPath` resolves them now), and two opens at once both added a tab (a second
  open now waits for the first). An open that reads while a save takes the same path also keeps one tab. Minors
  deferred to #98 and #25.
- **#105, merged into this branch (6e62404)**: a second save shortly after a nap no longer leaves Snip asleep; a nap that
  starts during a moment at a tab ends with Snip at home; a save cannot take a path another tab is saving to, closed
  tabs included.
- **Docs only (2426ed9)**: the CHANGELOG and README lines above, and `docs/releasing.md` notes that the MSI path from a
  pre-release is untested.
- **ROADMAP.md**: what is left before the tag, and this run's decisions.

## Checks
- `npm run lint`, `npm test` (560 passed), `npm run build`. Startup chunk 437,568 bytes (budget 440 KB).
- `cargo test -p snipmd-core` passed. `cargo check` did not run here (no GTK libraries); CI checks it on Windows and macOS.

## Checks on the candidate (2026-11-09)
All on 6e62404, the head of this branch after #105.
- *Release Windows* run 42549469763 (build only, nothing published): setup 1,551,498 bytes.
- *Windows run* 42549472467 (run 18): 12 screenshots, including Snip asleep in light and dark; the clean-install smoke
  test passed. Runner budgets, as reference only: paste 103.3 ms, memory 91.6 MB, installer 1.48 MB, page to ready 192.5 ms.
- Headless Snip checks on the fixed code: 14 cases OK (M1, M2, N1, N2, N3, W1, W3, W5, W6, W7, W8, W9, CT1, CT5).
- Findings deferred, both minor rendering, in #106: W2 shows a 1 px overlap at an odd half-cell offset; soft edges at
  device scale 1.25 and 1.5 in emulated Chromium (WebView2 not checked).
- Other deferred minors: #107 (a closed tab's refused write is re-sent on blur) and comments on #98.
- #108, open against this branch: a runner retest script for saving and closed tabs (`tools/measure/retest.ps1`). Its
  first runs gave 10 OK. It is merged (955a918; the app code is unchanged since 6e62404). Windows run 42553525549 (run 21) on that head: 10 OK, 0 FOUT.

## Before the tag (owner)
1. **Windows test on the owner's PC**, plan `TESTPLAN-WIN11.md` on `test/w11-20261109`: install over `1.1.0-4`, Snip in
   the real window, the hardware cases, and one day of use. Test the setup from *Release Windows* run 42549469763.
2. **Budgets**: measure on the 1.1.0 build with `tools\measure\measure.ps1` and replace the table in `docs/releasing.md`.
   The last table is from 1.0, and the startup chunk grew from 397 to 437 KB. The runner figures above are not that table.
3. Merge, tag `v1.1.0` (the owner), run *Release macOS* on the tag with *publish*, and do smoke test step 8 (install
   over `1.0.0` and over `1.1.0-4`).

Co-Authored-By: Claude
