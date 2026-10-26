# Changelog

All notable changes to SnipMD. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Asleep, Snip's Z floats above its back instead of touching it.

## [1.1.0-3] - 2026-10-26

A pre-release that brings Snip, for the Windows and Mac tests.

### Added
- Snip, a small pixel crab right of the `+` button. It claps when a screenshot lands in a note, is relieved when a closed tab comes back, looks worried when a note changed outside SnipMD, and falls asleep when nothing is saved for a while. Switch it off with Show Snip in the command menu.

## [1.1.0-2] - 2026-10-24

A second pre-release, after the Windows 11 test of 1.1.0-1.

### Changed
- The first-save bar says why Save is off: the name is taken, holds a folder (use Other folder…), or has a character a file name cannot hold.
- Fenced code has no spelling squiggles, also under the fence's language name.
- Code in a block without highlighting has the text colour while writing, as in read mode.
- The macOS `.dmg` without a Developer ID signature is named `*.preview.dmg`, as the release text says.

## [1.1.0-1] - 2026-10-23

A pre-release for the Windows and Mac tests; 1.1.0 follows when they pass.

### Added
- Command menu (`Ctrl+Shift+P`, `⇧⌘P` on macOS): every command and four toggles, kept in the session. Line breaks in read mode (off), clickable tasks in read mode, a Copy button on code blocks and a match count in find (on).
- Syntax highlighting of fenced code in writing and reading for JavaScript, TypeScript, JSON, CSS, HTML, Python, Rust, SQL, shell and YAML; each language loads the first time a block names it.
- Moving tabs: drag a tab, or `Ctrl+Shift+PageUp` / `Ctrl+Shift+PageDown`; the order is kept in the session.

### Changed
- Lists and quotes follow the Markdown structure: Enter on an empty item or quote line ends the block, Tab nests an item to the width of its marker, ordered lists stay numbered after any edit, and Backspace leaves an empty item in two presses.
- `Untitled-N` takes the lowest number no open or closed tab uses.
- A note reloaded from disk shows its new text in read mode too.

### Fixed
- Read mode showed a bullet as well as the checkbox of a task.
- On macOS, Escape did not close the find panel after a click on one of its buttons, and the find and file-name fields autocorrected and capitalized.

## [1.0.0] - 2026-10-22

The first full release. It replaces the 0.1.0 prototype; open tabs and untitled text from the 0.1.0 session are restored, but screenshots of untitled 0.1.0 notes (`scratchpad/.assets/`) are not carried over.

### Added
- Screenshot paste: `Ctrl+V` with only an image on the clipboard saves it next to the note (`<stem>.assets/`) and links it on its own line; text on the clipboard always pastes as text; `Ctrl+Shift+V` is plain text.
- Images and notes dropped on the window: images are copied in at the drop line, notes open in tabs.
- Untitled tabs keep their screenshots in the app's scratch folder; the first save moves them next to the new note and rewrites the links in one undoable step.
- First-save bar: name from the first heading, last folder used (first time `Documents\Notes`), Enter saves, a taken name turns red.
- Save As (`Ctrl+Shift+S`) copies the image folder; the original stays.
- Autosave one second after typing stops, on blur and on close; atomic writes that keep line endings and BOM.
- External changes: clean tabs reload in place; tabs with edits get *Open disk version · Reload · Keep mine*; a deleted note offers *Save again*.
- Closed tabs: `Ctrl+W` closes at once with a restore bar; `Ctrl+Shift+T` restores, also after a restart (last 20 or 14 days).
- Session restore of every tab, including untitled ones, and a startup cleanup of unused scratch images older than 14 days.
- Read mode (`Ctrl+E`) with sanitized HTML; links open in the browser.
- Find and replace (`Ctrl+F`, `Ctrl+H`).
- Light Markdown styling: larger headings, dimmed syntax, code blocks and quotes set apart.
- A visual system modelled on Windows 11: light and dark follow Windows, Mica behind the tab bar on Windows 11, WCAG AA contrast, reduced motion respected.
- Keyboard: every action has a key; `F6` moves between note, info bar and tabs; the tab strip works with arrows, Enter and Delete.
- An empty tab shows the core loop.
- The first window fits the screen, also on a small laptop at high scaling.

### Security
- Every opened note is untrusted: strict CSP, sanitized read mode, links never navigate the window, Rust commands only touch files the user opened, their image folders and the app's own folder; the asset protocol is granted per image file.

### Removed
- The prototype's split view, theme gallery, side drawer, lightbox, HTML export and `localStorage` persistence (out of scope for v1).

## [0.1.0] - 2026-10-17
Prototype.

[1.1.0-3]: https://github.com/ArneVDA-AP/snipmd/compare/v1.1.0-2...v1.1.0-3
[1.1.0-2]: https://github.com/ArneVDA-AP/snipmd/compare/v1.1.0-1...v1.1.0-2
[1.1.0-1]: https://github.com/ArneVDA-AP/snipmd/compare/v1.0.0...v1.1.0-1
[1.0.0]: https://github.com/ArneVDA-AP/snipmd/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/ArneVDA-AP/snipmd/releases/tag/v0.1.0
