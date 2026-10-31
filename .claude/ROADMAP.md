# Roadmap

What is open, and the decisions still in force. Replace a section when it changes; history lives in git and in the archive branches: `archive/v1-process` (the v1 plan, every review, findings and run args up to 2026-10-21) and `archive/1.1-process` (from the command-menu build on).

## v1.0.0: released
Published 2026-10-22 from the tag `v1.0.0` on 1c3a3fe: the Windows installer, MSI and portable exe, and a macOS preview (`SnipMD_1.0.0_universal.preview.dmg`, ad-hoc signed, every runner probe passed). The v0.1.0 release is marked as the prototype.

Before the release: the Windows tests on the owner's PC passed (three defects fixed in #20, #36, #37), and the final whole-app review's two blockers and four majors were fixed in #38 (minor findings: #39). After it: the smoke test of the published Windows installer passed (steps 1-6; uninstall skipped on purpose), and the test-suite audit was merged in #46. Reports and audit are on `test/w11-20261021` and `archive/v1-process`.

Open:
1. **macOS on a real Mac**: the checklist in `docs/releasing.md` (#30). The first Mac test report (2026-10-23) covered the editor and read mode, not the checklist (iCloud stamps, the privacy prompt, Retina, the feel next to native apps). Until the checklist passes, macOS stays a preview and the repo description names only Windows.
2. Left from the Windows tests: a pulled USB stick, Ctrl+1 on a real AZERTY keyboard, the first window 7 px above the screen when shrunk to fit (fixed in #38, not yet seen on a real screen). The 1.1 test plan carries them as CT4, T2 and CT3.

The last budget measurement is in `docs/releasing.md`.

## macOS
SPEC §13 is built and on `main` (PRs #19, #32, #34, #35); `release-macos.yml` builds a universal `.dmg` and runs the acceptance probes on the installed copy. A tag push does not publish it: a run with *publish* on adds the `.dmg` to a tag's release. Open, tracked in #30:
- **A real Mac.** The runner cannot judge how the app feels next to native apps, iCloud-synced `~/Documents` changing file stamps (false conflict bars?), the first-run privacy prompt for `~/Documents`, or Retina rendering by eye. The manual checklist in `docs/releasing.md` covers them.
- **Signing.** No Apple Developer account yet, so builds are ad-hoc signed and need the first-start steps in `docs/install-macos.md`. Signing and notarization are wired in `release-macos.yml` behind secrets.

## 1.1
`v1.1.0-1` to `v1.1.0-4` are pre-releases; `CHANGELOG.md` says what they add. `v1.1.0-4` (Snip walks to the tab, the wake-up friend) is published with the Windows files and a macOS preview.

Open before 1.1.0:
1. **#79, data safety.** After a note's file is deleted, a new tab can be saved to the same path, and *Save again* in the old tab then overwrites the newer note without a check. Fix: *Save again* writes only while the file is still absent, and no two tabs hold one path. Found by reading the code; a test reproduces it first. #80 (drop *Other folder…*, which proposes the colliding name) is not in 1.1.
2. **Windows test of `v1.1.0-4`**: `TESTPLAN-WIN11.md` on `test/w11-20261027`, report `findings/windows/w11-20261027.md` on that branch. No report yet. It covers Snip's walk, the friend, reduced motion, and the steps left from the test of `v1.1.0-3` (CT1–CT4, T1, T3). AZERTY (T2) does not block. #79 lands after this test, so the release candidate gets a short retest of saving and the closed-tab bar.
3. **SPEC §12 promises `Ctrl+P` and TextPack for v1.1**; neither is built. Move them to a later version in §12 before tagging 1.1.0, so the SPEC describes what ships.
4. **The release itself**: the hygiene pass, a final review, the version set to `1.1.0`, one CHANGELOG section with everything since 1.0.0, then the owner's tag and smoke test step 8 (install over `1.0.0` and over `1.1.0-4`).

Settled for 1.1: the setup's "uninstall the older version first" page (#74) is stock Tauri behaviour with no data at risk; the README and release notes say how to update (#77), and a setup that skips the page waits for #51.

Not blocking 1.1: the **Mac test** (`TESTPLAN-MAC.md` on `test/mac-20261026`), by an independent Mac tester and their Claude session as a favour, with no deadline. No version has run on a real Mac yet; macOS stays a preview until the `docs/releasing.md` checklist passes. The runner probes passed on *Release macOS* run 9.

## After 1.1: plugins
Tester feedback (2026-10-31) asked for a dozen features, filed as #82–#91 plus #58. The owner's direction: keep the core to the core loop and its guarantees, and make the rest plugins (#81), with a guide so users and their agents can write their own. Not decided yet. It changes SPEC §12, which lists plugins as out. A design session works it out (see #81). Until it is decided, the feature issues stay unbuilt; each names where it would live (core, extension point, or plugin).

Backlog besides that: #80, renaming a note by double-clicking its tab (#59), telling users about a newer version (#51).

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
