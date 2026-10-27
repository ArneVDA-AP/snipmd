# Roadmap

What is open, and the decisions still in force. Replace a section when it changes; history lives in git and in the archive branches: `archive/v1-process` (the v1 plan, every review, findings and run args up to 2026-10-21) and `archive/1.1-process` (from the command-menu build on).

## v1.0.0: released
Published 2026-10-22 from the tag `v1.0.0` on 1c3a3fe: the Windows installer, MSI and portable exe, and a macOS preview (`SnipMD_1.0.0_universal.preview.dmg`, ad-hoc signed, every runner probe passed). The v0.1.0 release is marked as the prototype.

Before the release: the Windows tests on the owner's PC passed (three defects fixed in #20, #36, #37), and the final whole-app review's two blockers and four majors were fixed in #38 (minor findings: #39). After it: the smoke test of the published Windows installer passed (steps 1-6; uninstall skipped on purpose), and the test-suite audit was merged in #46. Reports and audit are on `test/w11-20261021` and `archive/v1-process`.

Open:
1. **macOS on a real Mac**: the checklist in `docs/releasing.md` (#30). The first Mac test report (2026-10-23) covered the editor and read mode, not the checklist (iCloud stamps, the privacy prompt, Retina, the feel next to native apps). Until the checklist passes, macOS stays a preview and the repo description names only Windows.
2. Left from the Windows tests: a pulled USB stick, Ctrl+1 on a real AZERTY keyboard, the first window 7 px above the screen when shrunk to fit (fixed in #38, not yet seen on a real screen).
3. **Dependabot**: #44 (actions group) and #43 (`rand` 0.8 → 0.10, a major with API changes; needs `cargo test`).

The last budget measurement is in `docs/releasing.md`.

## macOS
SPEC §13 is built and on `main` (PRs #19, #32, #34, #35); `release-macos.yml` builds a universal `.dmg` and runs the acceptance probes on the installed copy. A tag push does not publish it: a run with *publish* on adds the `.dmg` to a tag's release. Open, tracked in #30:
- **A real Mac.** The runner cannot judge how the app feels next to native apps, iCloud-synced `~/Documents` changing file stamps (false conflict bars?), the first-run privacy prompt for `~/Documents`, or Retina rendering by eye. The manual checklist in `docs/releasing.md` covers them.
- **Signing.** No Apple Developer account yet, so builds are ad-hoc signed and need the first-start steps in `docs/install-macos.md`. Signing and notarization are wired in `release-macos.yml` behind secrets.

## 1.1
`v1.1.0-1`, `v1.1.0-2` and `v1.1.0-3` (Snip) are pre-releases; `CHANGELOG.md` says what they add. Backlog: inserting a table (#58), renaming a note by double-clicking its tab (#59), telling users about a newer version (#51).

Open before a 1.1 release, on `v1.1.0-3`:
1. **Windows test**: done 2026-10-26, report `findings/windows/w11-20261026.md` on `test/w11-20261026`. Snip passed (S1–S7). The two failures:
   - The setup recommends uninstalling the older version first, then closes a running SnipMD hard. This is stock Tauri behaviour on every upgrade, and no data is at risk because SnipMD saves on blur: #74 (proposal: a line in the install text for 1.1).
   - The runner's dark sleep screenshot was the light one. Fixed by #71: *Windows run* 12 on `main` has a dark and a light sleep shot.

   Still open, with the tester: the light theme (CT1), display scale 125–200% (CT2), the window shrunk at first start (CT3), the USB stick (CT4), a held Enter in the menu (T1) and a day of normal use (T3). AZERTY (T2) needs another keyboard.
2. **Mac test**: `TESTPLAN-MAC.md` on `test/mac-20261026`, by an independent Mac tester and their Claude session, as a favour: no deadline, and nothing waits on it but this item. No report yet. No version has been tested on a real Mac yet; the plan holds the retest of the 23 October report, the 1.1 features, Snip and the `docs/releasing.md` checklist. The runner probes passed on the release (*Release macOS* run 9).

## After v1
- Issues: [#25](../../issues/25) data-safety edge cases, [#26](../../issues/26) performance, [#27](../../issues/27) code structure, [#28](../../issues/28) paste position, [#29](../../issues/29) tooling.
- Way of working: [#22](../../issues/22).
- Ideas outside the v1 scope: GitHub issues labelled `enhancement` (#53–#56 came from the former PROPOSALS.md).

## Decisions in force
How we work, one line each: what, and why. Autonomous runs add theirs here. Product decisions are in `docs/SPEC.md` §14, build decisions in `docs/ARCHITECTURE.md` "Decisions", release policy in `docs/releasing.md`.

- **Repo front** (owner, 2026-10-24). The root holds only what users and the build need; maintainer docs are in `docs/`, community files in `.github/`, session state (`CLAUDE.md`, this file) and agent files in `.claude/`. Release pages show the version's CHANGELOG section; proposals are issues.
- **Contributor rules** (owner, 2026-10-24) live in `docs/CONVENTIONS.md`, which `CLAUDE.md` imports, so a contributor without Claude finds them and sessions read the same text. Product and build decisions moved out of this file for the same reason.
- **Process records.** Reviews, findings and run args of finished work move to an archive branch at each milestone, not to `main`. Deferred findings become issues. Process output stays out of the code tree.
- **Test plans** (owner, 2026-10-26). Each step says who does it: the runner (Claude starts a workflow), Claude on the machine with computer use, Claude with one action from the tester (a setting, a prompt, a USB stick), or the tester alone, with the reason. As much as possible goes to the runner and to Claude; the Mac tester works the same way.
- **thin-* agents.** They stay in `.claude/`, because they are the standard way of working and cloud sessions install them from there.
- **Windows testing.** A tester session on the owner's PC tests and reports; the cloud session fixes. That keeps one writer for the code.
- **Tags.** A cloud session cannot push tags; the owner pushes the tag, and *Release macOS* is then run on it with *publish* for a macOS preview.
- **Hygiene pass.** Before each release, a repo-wide pass checks for internal references and comments that no longer match the code.
- **Code signing** (owner, 2026-10-24). The owner applies to SignPath Foundation for Windows. The Apple Developer Program ($99 a year) is the owner's call; until then macOS stays a preview.
