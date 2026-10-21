# Changelog

All notable changes to SnipMD. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-22

The first release built to `SPEC.md`. It replaces the 0.1.0 prototype; the session file and image folders of 0.1.0 are not carried over.

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
- Keyboard: every action has a key (SPEC §10); `F6` moves between note, info bar and tabs; the tab strip works with arrows, Enter and Delete.
- An empty tab shows the core loop.
- The first window fits the screen, also on a small laptop at high scaling.

### Security
- Every opened note is untrusted: strict CSP, sanitized read mode, links never navigate the window, Rust commands only touch files the user opened, their image folders and the app's own folder; the asset protocol is granted per folder.

### Removed
- The prototype's split view, theme gallery, side drawer, lightbox, HTML export and `localStorage` persistence (out of scope for v1, see `SPEC.md` §12).

## [0.1.0] - 2026-10-17
Prototype.
