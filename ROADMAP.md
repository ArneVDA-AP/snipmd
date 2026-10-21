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
2. **Start budget.** Double-click to typing measures 690–730 ms on the owner's desktop, against a 300 ms target. About 620 ms passes before the page script runs, and SnipMD's own part is 60–70 ms. The `page` and `html` marks (measure.ps1) split those 620 ms. The owner decides on the budget once they are measured.
3. **Release** (RELEASE-WIN11.md):
   - set version 1.0.0 and date the CHANGELOG;
   - tag `v1.0.0`;
   - smoke-test the published installer;
   - run a final whole-app review.

Measured on the owner's desktop (i7-8700K, Windows 11 23H2, 2026-10-21):

| Budget | Target | Measured |
|---|---|---|
| Ctrl+V of a 4K screenshot visible | < 150 ms | 62–70 ms |
| Memory (5 tabs, 20 images, private working set) | < 120 MB | 98–104 MB |
| Installer | < 10 MB | 1.37 MB |
| Double-click to typing | < 300 ms | 690–730 ms, **open** |

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
- **v1.0.0** is tagged only after the Windows tests pass and the start budget is decided.
