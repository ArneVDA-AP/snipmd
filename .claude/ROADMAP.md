# Roadmap

What is open, and the decisions still in force. Replace a section when it changes; history lives in git and in the archive branches: `archive/v1-process` (the v1 plan, every review, findings and run args up to 2026-10-21) and `archive/1.1-process` (from the command-menu build on).

## v1.0.0: released
Published 2026-10-22 from the tag `v1.0.0` on 1c3a3fe: the Windows installer, MSI and portable exe, and a macOS preview (`SnipMD_1.0.0_universal.preview.dmg`, ad-hoc signed, every runner probe passed). The v0.1.0 release is marked as the prototype.

Before the release: the Windows tests on the owner's PC passed (three defects fixed in #20, #36, #37), and the final whole-app review's two blockers and four majors were fixed in #38 (minor findings: #39). After it: the smoke test of the published Windows installer passed (steps 1-6; uninstall skipped on purpose), and the test-suite audit was merged in #46. Reports and audit are on `test/w11-20261021` and `archive/v1-process`.

Open:
1. **macOS on a real Mac**: the checklist in `docs/releasing.md` (#30). The first Mac test report (2026-10-23) covered the editor and read mode, not the checklist (iCloud stamps, the privacy prompt, Retina, the feel next to native apps). Until the checklist passes, macOS stays a preview and the repo description names only Windows.
2. Left from the Windows tests: a pulled USB stick, Ctrl+1 on a real AZERTY keyboard, the first window 7 px above the screen when shrunk to fit (fixed in #38, not yet seen on a real screen).
3. **Dependabot**: #44 (actions group) and #43 (`rand` 0.8 → 0.10, a major with API changes; needs `cargo test`).

Measured on the owner's desktop (i7-8700K, Windows 11 23H2, 2026-10-21; start on `main` e951acb):

| Budget | Target | Measured |
|---|---|---|
| Ctrl+V of a 4K screenshot visible | < 150 ms | 62–70 ms |
| Memory (5 tabs, 20 images, private working set) | < 120 MB | 98–104 MB |
| Installer | < 10 MB | 1.37 MB |
| SnipMD's own start (page load to typing) | < 150 ms | 131–139 ms |
| Double-click to typing, cold start | < 1 s | 722–784 ms |

## macOS
SPEC §13 is built and on `main` (PRs #19, #32, #34, #35); `release-macos.yml` builds a universal `.dmg` and runs the acceptance probes on the installed copy. A tag push does not publish it: a run with *publish* on adds the `.dmg` to a tag's release. Open, tracked in #30:
- **A real Mac.** The runner cannot judge how the app feels next to native apps, iCloud-synced `~/Documents` changing file stamps (false conflict bars?), the first-run privacy prompt for `~/Documents`, or Retina rendering by eye. The manual checklist in `RELEASE-MACOS.md` covers them.
- **Signing.** No Apple Developer account yet, so builds are ad-hoc signed and need the first-start steps in `docs/install-macos.md`. Signing and notarization are wired in `release-macos.yml` behind secrets.

## On `main` since 1.0.0 (not released)
From the Mac test report of 2026-10-23, merged in #47 and #48:
- **Lists and quotes** (bugs 1, 2, 7, 8, 9): Enter ends a block, Tab nests to the marker width, ordered lists renumber.
- **Small fixes**: the task bullet in read mode (4), find-field autocorrection and Escape after a button click on macOS (5, 6), `Untitled-N` taking the lowest free number (11).
- **Command menu** (`Ctrl+Shift+P` / `⇧⌘P`) with four toggles kept in `session.json`: line breaks in read mode (bug 3, off by default), clickable tasks, a Copy button on code blocks and a match count in find (all on).
- **Syntax highlighting** for ten languages, in writing and reading, each parser loaded on first use.
- **Tab order** (12): drag a tab, or `Ctrl+Shift+PageUp/PageDown`; the order is kept in the session.
- **Read mode follows reloads** from disk.

Not doing: a warning when quitting (autosave and the session already keep everything, SPEC §3.3); a table inserter (outside §12).

Open before a 1.1 release:
1. **Mac test** of the pre-release `v1.1.0-2`: the plan is `TESTPLAN-MAC.md` on `test/mac-20261023` (hertest of the report, the new features, the macOS-only checks such as ⇧⌘P firing once and the clipboard, and the `docs/releasing.md` checklist). Take the `.preview.dmg` from the Releases page.
2. **Windows test** of `v1.1.0-1` (2026-10-24, report on `test/w11-20261023`): no failures. Its four remarks are fixed in `v1.1.0-2` (the reason in the first-save bar, no spellcheck in code, plain text colour in unhighlighted blocks, the `.preview` dmg name). Left for the owner: holding Enter on a toggle (B4, computer use cannot hold a key), light and dark theme (C2), the USB stick (E2), the display scale (E3), and AZERTY `Ctrl+1`/`Ctrl+2` (E1).
3. **Old branches**: 41 merged or archived branches are left to delete (listed in the session of 2026-10-23); the session's permissions do not allow `git push --delete`.

## After v1
- Issues: [#25](../../issues/25) data-safety edge cases, [#26](../../issues/26) performance, [#27](../../issues/27) code structure, [#28](../../issues/28) paste position, [#29](../../issues/29) tooling.
- Way of working: [#22](../../issues/22).
- Ideas outside the v1 scope: GitHub issues labelled `enhancement` (#53–#56 came from the former PROPOSALS.md).

## Decisions in force
One line each: what, and why. Autonomous runs add theirs here.

- **Repo front** (owner, 2026-10-24). The root holds only what users and the build need; maintainer docs are in `docs/`, community files in `.github/`, session state (`CLAUDE.md`, this file) in `.claude/`. Release pages show the version's CHANGELOG section; proposals are issues.
- **Command menu** lives in the info bar (key `command-menu`), not a dialog, so it follows the no-modal rule and reuses the bar's focus and Esc handling.
- **Code languages** are a fixed list, each parser a lazy chunk; an unknown name stays plain. A free-form list would pull every parser into the bundle.
- **Extras** (clickable tasks, Copy button, find count) are on by default, line breaks off; each is a toggle in the command menu.
- **Tab drag** uses pointer events, since Tauri's file drop takes over HTML drag and drop in the window.
- **Startup size** after the command menu: one startup file of 432.6 kB (was 405.5 kB; +8.6 kB gzip). The menu, settings, drag and find count are about 18 kB, and `StreamLanguage` (for shell) about 8 kB: it lives in `@codemirror/language`, which is in the startup file anyway. Every language parser is its own lazy chunk; JS, TS, CSS and HTML load the bare Lezer grammars because lang-markdown imports their `@codemirror/lang-*` packages statically. `npm run build` fails above 440 kB of startup JS (entry chunk plus every chunk it imports statically, `vite.config.ts`): measuring only `index-*.js` once missed a +200 kB preload.
- **Read mode follows reloads.** A note reloaded from disk renders again in read mode, in place (focus and scroll stay). Task clicks also check that the note is still the document the boxes were rendered from, so a change the pane has not shown yet can never tick another task.
- **Settings** are stored in `session.json` version 3; an older session reads as the defaults.
- **Look.** Fluent look: neutral greys, the default Fluent accent (not the system accent), Segoe UI Variable for notes and Cascadia Mono for code. Tokens live in `main.css`, and `contrast.test.ts` holds WCAG AA in both themes. Dimmed Markdown marks are held to 3:1, because they repeat what the styling already shows.
- **Mica** is used only when Rust confirms Windows 11 (build 22000+). Otherwise the page stays opaque, so a wrong guess never shows the desktop.
- **Keyboard.** F6 and Shift+F6 cycle note, info bar and tabs. The tab strip is one tab stop with arrows, Home, End, Enter and Delete. A held key acts once, except tab switching.
- **Editor scope.** GFM without embedded HTML, CSS or JS parsers (bundle 658 → 398 KB). Read mode is lazy-loaded. Code-block languages load lazily when a block names one (owner, 2026-10-23).
- **Lists.** Enter, Backspace and Tab are SnipMD's own on list and quote lines (`editor/lists.ts`), on top of CodeMirror's continuation: CodeMirror's Tab indented 2 spaces, which Markdown does not read as nesting under `1. `, and it renumbered only on Enter. Renumbering runs only on edits that add, remove or nest lines, so it costs nothing per keystroke inside a line.
- **Settings** (owner, 2026-10-23). No settings screen: choices are toggles in a command menu opened with one shortcut. Optional features load lazily and are switched there.
- **Untitled numbers** are the lowest number no open or closed tab uses, not a counter kept in the session; a restored closed tab never shares a title with a new one.
- **Paste.** A paste in the middle of a note leaves the cursor on an empty line below the image, so typing never joins the next paragraph.
- **WebView2.** Browser keys (reload, print, history) and the page menu are off. A reload would lose undo history and in-flight screenshots.
- **Styles under Tauri's CSP.** CodeMirror gets Tauri's style nonce through `EditorView.cspNonce`. Switching the nonces off would also let note CSS apply if the sanitizer ever slipped.
- **Find fields.** Ctrl+H focuses Replace only when Find already holds a term. The find and file-name fields set `autocomplete=off`, so WebView2's "Saved info" popup does not appear.
- **Data folder.** `%APPDATA%\com.snipmd.desktop`, Tauri's folder for the app identifier. The docs follow the code; moving the folder would strand existing sessions.
- **Window title** does not follow the active tab: it needs a new window permission. Proposed in #53.
- **Developer switches.** Budget marks ship in the build. `SNIPMD_TRACE` and `SNIPMD_DATA_DIR` are documented in `docs/ARCHITECTURE.md`, not in the SPEC.
- **Closed tabs.** Open and closed tabs are one list, and a closed tab has `closedAt`. `getTab` finds any tab, and `openTab` and `getTabs` find open ones. Two lists led to a wrong pick and a data-safety bug.
- **Process records.** Reviews, findings and run args of finished work move to an archive branch at each milestone, not to `main`. Deferred findings become issues. Process output stays out of the code tree.
- **thin-* agents.** They stay in `.claude/`, because they are the standard way of working and cloud sessions install them from there.
- **Windows testing.** A tester session on the owner's PC tests and reports; the cloud session fixes. That keeps one writer for the code.
- **Releases** are tagged on the owner's go, after the Windows tests and a final review. A build for testers is a pre-release with a numeric suffix (`v1.1.0-1`; the Windows MSI accepts only digits there), so testers take it from the Releases page while `Latest` stays the last tested release. A cloud session cannot push tags; the owner pushes the tag, and *Release macOS* is then run on it with *publish* for a macOS preview.
- **Health checks.** CI runs weekly as well as on every push, and Dependabot proposes grouped updates weekly. A repo-wide hygiene pass (no internal references, comments true to the code) runs before each release.
- **Start budget** (owner, 2026-10-21). SPEC §9 budgets SnipMD's own start (< 150 ms) and the cold start (< 1 s) instead of one 300 ms target. WebView2's own start takes about 600 ms on the owner's desktop before any page loads (tester probes on `test/w11-20261021`). A broker process that keeps WebView2 warm reaches about 320 ms but crashes SnipMD's start when its options differ, so it is out. Keeping SnipMD warm in the background is `PROPOSALS.md` #4, for after v1.
- **macOS** comes after v1.0.0 (SPEC §13); Linux stays out. Most code is portable already, and the gaps (quit, Finder open, menu) touch the run loop the Windows release depends on. The window keeps the native macOS buttons and an opaque bar, since vibrancy needs `macOSPrivateApi`. Closing the window quits the app, and new notes use LF.
- **macOS keys.** Only Cmd is the app's modifier on macOS; Control keeps its text bindings (Control+E is end of line). The platform is read once from the engine's user agent, so the first paint is right. Paste as Plain Text goes through Rust's clipboard read, because WKWebView pastes only through the Edit menu.
- **macOS releases are published by hand.** *Release macOS* adds the `.dmg` to a tag's release only when run on that tag with *publish* on, so tagging a Windows release never ships a macOS build the tester has not checked. Apple's secrets reach only the packaging step, which runs Apple's tools and no dependency code.
- **macOS 13 Ventura or later, universal binary.** The owner wants Intel included; Ventura still runs on 2017 Intel Macs and its WebKit has everything the frontend uses. Without an Apple Developer account, builds are ad-hoc signed.
