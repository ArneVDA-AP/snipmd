# Roadmap

What is open, and the decisions still in force. Replace a section when it changes; history lives in git and in the `archive/v1-process` branch (the v1 plan, every review, findings and run args up to 2026-10-21).

## v1.0.0: open
All of SPEC.md v1 is built and on `main` with CI green. Before the tag:

1. **Windows tests on a real machine.** A tester session with computer use on the owner's PC runs them and reports on a `test/` branch, which is not merged. Done 2026-10-21: build, unit tests, budgets and screenshots at 100%. Open:
   - **Security:** `fixtures/evil.md` in write and read mode. Nothing runs, nothing outside the note's folder loads, and links open in the browser.
   - **Storage:** paste then Alt+F4 at once, then restart: the image and text are there. Pull a USB stick under an open note: an error bar shows, and the other tabs keep saving (owner).
   - **Paste and drop:** cells copied from Excel paste as text. Ctrl+Shift+V with only an image on the clipboard does nothing. A dropped jpg lands on the drop line; two dropped images sit together.
   - **Saving:** first save puts the note and its `.assets` folder side by side, with no hidden attribute. Edit the note in Notepad: a clean tab reloads, and a dirty tab shows the conflict bar. Save As to another drive copies the images.
   - **Tabs:** Ctrl+W, restart, Ctrl+Shift+T brings the tab back with its images. A close with unwritten edits warns with Restore. Ctrl+1 works on AZERTY (owner). A held Ctrl+W closes one tab.
   - **Window:** Mica on Windows 11, and no desktop showing through. F5, Ctrl+R, Ctrl+P and a right-click outside the text do nothing. F6 and the tab-strip keys work. Ctrl+H focuses Find when nothing is selected. No autofill popup. 150% and 200% scaling look right.
   - **Installed app:** Start menu, `.md` double-click and restart, all from the installer.
   - **Obsidian:** a note saved into a vault folder shows its screenshots in Obsidian. Editing it in both apps at once loses nothing.
2. **Release** (RELEASE-WIN11.md):
   - set version 1.0.0 and date the CHANGELOG;
   - tag `v1.0.0`;
   - smoke-test the published installer;
   - run a final whole-app review.

Measured on the owner's desktop (i7-8700K, Windows 11 23H2, 2026-10-21; start on `main` e951acb):

| Budget | Target | Measured |
|---|---|---|
| Ctrl+V of a 4K screenshot visible | < 150 ms | 62–70 ms |
| Memory (5 tabs, 20 images, private working set) | < 120 MB | 98–104 MB |
| Installer | < 10 MB | 1.37 MB |
| SnipMD's own start (page load to typing) | < 150 ms | 131–139 ms |
| Double-click to typing, cold start | < 1 s | 722–784 ms |

## macOS (phase 7, after v1.0.0)
Goal: SPEC §13 on `main`, with CI green on Windows and macOS. Each step is its own branch and PR; open work is tracked in #30. 7a, 7b and 7c went ahead of v1.0.0 (owner, 2026-10-21) because they change nothing Windows runs. Next is 7d, the release.

Most of the code is portable already: the Windows-only Rust sits behind `cfg(windows)`, keys accept `metaKey`, and paths parse POSIX. The work is in seven places:
1. Quit. AppKit ends the app on `Cmd+Q`, the Dock's Quit and logout through `applicationWillTerminate`; Tauri 2.12 sends no `ExitRequested`, so the page never flushed. Done in 7b: `macos.rs` adds `applicationShouldTerminate:` to tao's delegate and answers later until the page has flushed (5 s at most).
2. Opening from Finder. macOS hands files over as an Apple Event (`RunEvent::Opened`), not as argv, so double-click and Open With do nothing today. Route it through `allow_notes` and `open-files`.
3. Menu. Tauri's default macOS menu binds `Cmd+W` to close window and `Cmd+H` to hide. SnipMD needs its own menu (SPEC §13) whose items emit the app's commands.
4. Window. A `tauri.macos.conf.json` sets `decorations: true`, `titleBarStyle: "Overlay"`, `hiddenTitle`, `transparent: false` and the `dmg` / `app` targets. On macOS the title bar drops its own window buttons and leaves room for the system ones.
5. Labels and hints: platform key labels, the macOS core loop in the empty hint, and `Cmd+Option+F` for replace.
6. New notes in LF on macOS (`ipc.ts` format default, Rust write path).
7. Release: a universal `.dmg`, signed and notarized; `release-macos.yml`, `RELEASE-MACOS.md`, README.

| Step | What | Where | Verified by |
|---|---|---|---|
| 7a | `macos-latest` job in `ci.yml` (core tests, `cargo check`), and a manual `macos-run.yml` spike like `windows-run.yml`: build the app, launch it with `SNIPMD_DATA_DIR`, screenshot it, find out which automation the runner allows | cloud | the runner's output, pushed to `ci/macos-run-<n>` |
| 7b | items 1-4 (Rust and config) | cloud | core tests, macOS CI, `macos-run.yml` |
| 7c | items 5-6 (frontend) | cloud | Vitest, browser tour, `macos-run.yml` screenshots |
| 7d | item 7 (release) | cloud, plus the owner's Apple account | a notarized `.dmg` from a tag, opened on a clean runner |

Run card: Opus, medium, no worktree, cloud. The steps touch shared files (`lib.rs`, `app.ts`, `titlebar.ts`), so solo, not thin-standard.

**What the macOS runner can check** (GitHub's `macos-latest`, Apple Silicon, free for a public repo):
- Building and launching the app.
- Opening a file through LaunchServices: `open -a SnipMD note.md` sends the same Apple Event as a Finder double-click.
- Quitting: `osascript -e 'tell application "SnipMD" to quit'` sends the same event as `Cmd+Q`.
- The result of open and quit, read from `session.json` in `SNIPMD_DATA_DIR`.
- An image on the clipboard: `osascript` with `«class PNGf»` needs no permission.
- `Cmd+V` and typing through System Events, and screenshots: the runner grants Accessibility and Screen Recording (7a, run 2).
- The §9 budgets, as a reference: the runner is a VM, not a laptop.
- Gatekeeper on the downloaded `.dmg`: `spctl --assess` with the quarantine flag set.

**7a result** (`macos-run.yml` run 2 on macOS 26.6 arm64, 2026-10-21; `findings/macos-ci/probe.txt` on `ci/macos-run-2`):
- The Tauri crate compiles for both architectures. The universal app builds and gets an ad-hoc signature.
- launch, quit Apple Event and **paste: PASS**. WKWebView hands a clipboard PNG to the page, and `placeImages` saves it and shows it inline with no change to the code.
- finder-open and quit-flush: FAIL, as expected (items 2 and 1). These two probes are the acceptance tests for 7b.
- The empty hint shows the Windows keys (item 5).
- The runner's screen is 1024x768, smaller than the 1200x820 window, so the top bar sits under the menu bar in the screenshots. The 7b window config should cap the first size at the screen.
- Run 1 never started the app (a relative path to `defaults read`) yet the job was green. The probe now fails the job when its harness breaks.

**7b result** (PR #32, `macos-run.yml` run 4 on macOS 26.6 arm64, 2026-10-21): finder-open, quit-flush-cmdq, quit-flush-dock (a quit Apple Event) and close-tab (`Cmd+W`) PASS, as do launch and paste. Items 1-4 are done. The probe lines are in the run's log, and the screenshots are in its artifact.

**7c result** (PR #34, `macos-run.yml` run 11, 2026-10-21): every probe PASS. New probes, read through Accessibility or the session, not by eye:
- traffic-lights: the close button's centre is at y 17 in the 34 pt bar.
- own-buttons and key-labels: the page has no window buttons, and + reads "New tab (⌘T)".
- close-once: one Cmd+W closes one tab, so the page and the menu never both run a command.
- paste-plain: Cmd+Shift+V pastes the clipboard's text.
- replace: Cmd+Option+F, a word and Enter replace the selected word.
- cmd-h: Cmd+H hides the app.

Items 5 and 6 are done. Accessibility sees only part of WKWebView's page (the hint is `aria-hidden`), and this session cannot download artifacts; the empty hint is judged on the tester's Mac.

**What it cannot check:**
- How the app feels next to native apps.
- iCloud-synced `~/Documents` changing file stamps (false conflict bars?).
- The first-run privacy prompt for `~/Documents`.
- Retina judgement by eye.

These need one session on a real Mac before the first macOS release.

**Settled with the owner (2026-10-21):**
- No Apple Developer account yet. Builds are ad-hoc signed; the tester clears quarantine with `xattr -dr com.apple.quarantine /Applications/SnipMD.app`, or uses Open Anyway in System Settings › Privacy & Security. Signing and notarization stay in 7d, behind secrets, for when the account exists.
- Universal binary (Apple Silicon and Intel), macOS 13 Ventura or later.
- A tester with a Mac does the final check; 7d writes their test list in `RELEASE-MACOS.md`.

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
- **v1.0.0** is tagged only after the Windows tests pass.
- **Start budget** (owner, 2026-10-21). SPEC §9 budgets SnipMD's own start (< 150 ms) and the cold start (< 1 s) instead of one 300 ms target. WebView2's own start takes about 600 ms on the owner's desktop before any page loads (tester probes on `test/w11-20261021`). A broker process that keeps WebView2 warm reaches about 320 ms but crashes SnipMD's start when its options differ, so it is out. Keeping SnipMD warm in the background is `PROPOSALS.md` #4, for after v1.
- **macOS** comes after v1.0.0 (SPEC §13); Linux stays out. Most code is portable already, and the gaps (quit, Finder open, menu) touch the run loop the Windows release depends on. The window keeps the native macOS buttons and an opaque bar, since vibrancy needs `macOSPrivateApi`. Closing the window quits the app, and new notes use LF.
- **macOS keys.** Only Cmd is the app's modifier on macOS; Control keeps its text bindings (Control+E is end of line). The platform is read once from the engine's user agent, so the first paint is right. Paste as Plain Text goes through Rust's clipboard read, because WKWebView pastes only through the Edit menu.
- **macOS 13 Ventura or later, universal binary.** The owner wants Intel included; Ventura still runs on 2017 Intel Macs and its WebKit has everything the frontend uses. Without an Apple Developer account, builds are ad-hoc signed.
