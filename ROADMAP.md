# Roadmap

What is open, and the decisions still in force. Replace a section when it changes; history lives in git and in the `archive/v1-process` branch (the v1 plan, every review, findings and run args up to 2026-10-21).

## v1.0.0: released
Tagged `v1.0.0` on 1c3a3fe (2026-10-22); the *Release Windows* workflow publishes the installers.

1. **Windows tests on the owner's PC: passed** (2026-10-21/22, report on the unmerged `test/w11-20261021` branch). Security with `fixtures/evil.md`, paste then Alt+F4, paste and drop, first save, external edits with the conflict bar, Save As to another drive, closed tabs, held Ctrl+W, browser keys off, F6 and the tab strip, Mica, the installed app, Obsidian both ways, and 100%, 150% and 200% scaling. Three defects were found and fixed: autofill over the find fields (#20), code blocks that did not wrap in read mode (#36), and a first window taller than the screen at high scaling (#37). Left for after the release: a pulled USB stick and Ctrl+1 on a real AZERTY keyboard (the code handles it), and the first window sitting 7 px above the screen when it is shrunk to fit.
2. **Final whole-app review: done** (2026-10-22). Two blockers (a session that could not be read was overwritten; a note that crashed the read-mode renderer stopped every later startup) and four majors were fixed in #38, each with a test, over three review rounds. Minor findings are in #39.
3. **Open:** smoke-test the published installer (RELEASE-WIN11.md), and mark the v0.1.0 prototype release as superseded.

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
- **Signing.** No Apple Developer account yet, so builds are ad-hoc signed and need the first-start steps in `RELEASE-MACOS.md`. Signing and notarization are wired in `release-macos.yml` behind secrets.

## After v1
- Issues: [#25](../../issues/25) data-safety edge cases, [#26](../../issues/26) performance, [#27](../../issues/27) code structure, [#28](../../issues/28) paste position, [#29](../../issues/29) tooling.
- Way of working: [#22](../../issues/22).
- Ideas outside the v1 scope: `PROPOSALS.md`.

## Decisions in force
One line each: what, and why. Autonomous runs add theirs here.

- **Look.** Fluent look: neutral greys, the default Fluent accent (not the system accent), Segoe UI Variable for notes and Cascadia Mono for code. Tokens live in `main.css`, and `contrast.test.ts` holds WCAG AA in both themes. Dimmed Markdown marks are held to 3:1, because they repeat what the styling already shows.
- **Mica** is used only when Rust confirms Windows 11 (build 22000+). Otherwise the page stays opaque, so a wrong guess never shows the desktop.
- **Keyboard.** F6 and Shift+F6 cycle note, info bar and tabs. The tab strip is one tab stop with arrows, Home, End, Enter and Delete. A held key acts once, except tab switching.
- **Editor scope.** GFM without embedded HTML, CSS or JS parsers (bundle 658 → 398 KB). Read mode is lazy-loaded.
- **Paste.** A paste in the middle of a note leaves the cursor on an empty line below the image, so typing never joins the next paragraph.
- **WebView2.** Browser keys (reload, print, history) and the page menu are off. A reload would lose undo history and in-flight screenshots.
- **Styles under Tauri's CSP.** CodeMirror gets Tauri's style nonce through `EditorView.cspNonce`. Switching the nonces off would also let note CSS apply if the sanitizer ever slipped.
- **Find fields.** Ctrl+H focuses Replace only when Find already holds a term. The find and file-name fields set `autocomplete=off`, so WebView2's "Saved info" popup does not appear.
- **Data folder.** `%APPDATA%\com.snipmd.desktop`, Tauri's folder for the app identifier. The docs follow the code; moving the folder would strand existing sessions.
- **Window title** does not follow the active tab: it needs a new window permission. Moved to `PROPOSALS.md`.
- **Developer switches.** Budget marks ship in the build. `SNIPMD_TRACE` and `SNIPMD_DATA_DIR` are documented in ARCHITECTURE.md, not in the SPEC.
- **Closed tabs.** Open and closed tabs are one list, and a closed tab has `closedAt`. `getTab` finds any tab, and `openTab` and `getTabs` find open ones. Two lists led to a wrong pick and a data-safety bug.
- **Process records.** Reviews, findings and run args of finished work move to an archive branch at each milestone, not to `main`. Deferred findings become issues. Process output stays out of the code tree.
- **thin-* agents.** They stay in `.claude/`, because they are the standard way of working and cloud sessions install them from there.
- **Windows testing.** A tester session on the owner's PC tests and reports; the cloud session fixes. That keeps one writer for the code.
- **v1.0.0** is tagged after the Windows tests and a final review, on the owner's go.
- **Start budget** (owner, 2026-10-21). SPEC §9 budgets SnipMD's own start (< 150 ms) and the cold start (< 1 s) instead of one 300 ms target. WebView2's own start takes about 600 ms on the owner's desktop before any page loads (tester probes on `test/w11-20261021`). A broker process that keeps WebView2 warm reaches about 320 ms but crashes SnipMD's start when its options differ, so it is out. Keeping SnipMD warm in the background is `PROPOSALS.md` #4, for after v1.
- **macOS** comes after v1.0.0 (SPEC §13); Linux stays out. Most code is portable already, and the gaps (quit, Finder open, menu) touch the run loop the Windows release depends on. The window keeps the native macOS buttons and an opaque bar, since vibrancy needs `macOSPrivateApi`. Closing the window quits the app, and new notes use LF.
- **macOS keys.** Only Cmd is the app's modifier on macOS; Control keeps its text bindings (Control+E is end of line). The platform is read once from the engine's user agent, so the first paint is right. Paste as Plain Text goes through Rust's clipboard read, because WKWebView pastes only through the Edit menu.
- **macOS releases are published by hand.** *Release macOS* adds the `.dmg` to a tag's release only when run on that tag with *publish* on, so tagging a Windows release never ships a macOS build the tester has not checked. Apple's secrets reach only the packaging step, which runs Apple's tools and no dependency code.
- **macOS 13 Ventura or later, universal binary.** The owner wants Intel included; Ventura still runs on 2017 Intel Macs and its WebKit has everything the frontend uses. Without an Apple Developer account, builds are ad-hoc signed.
