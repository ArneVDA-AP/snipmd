# SnipMD — Product Specification

Applies to SnipMD 1.0. This file is the single source of truth for what SnipMD is and does.

## 1. North star

**Paste, type, keep going.** A note-taking app for Windows, and for macOS after v1 (§13), where a screenshot is as easy as a sentence. It never asks you anything while you write, it never loses anything, and your notes stay plain files.

**For whom:** people who document what happens on their screen while they work: running a lab, reproducing a bug, following a meeting. Short text with many screenshots in between.

**Why not existing tools:** OneNote uses a proprietary format and feels slow. Obsidian needs a vault, plugins and settings first. Notepad has no images. Word is too heavy for a quick note.

## 2. The core loop

Everything in this spec serves these three steps. The keys are the Windows ones; §13 gives the macOS loop. If they don't feel instant, nothing else matters.

1. `Win+Shift+S`: the user snips part of the screen with the Windows tool.
2. `Ctrl+V`: the image appears in the note below the cursor, already saved to disk.
3. The user keeps typing. The cursor is already on the next line. No dialog, no toast.

## 3. Principles

1. **Never ask while writing.** No dialogs on the writing path. The only question the app ever asks is where a new note goes the first time, and that one has a prefilled answer.
2. **Undo over confirm.** Closing a tab asks nothing, but it can always be restored. Confirmation dialogs are friction and get clicked away blindly.
3. **Never lose anything.** After a crash, Alt+F4, power loss or a pulled USB stick, everything is back on restart, including untitled tabs and their images.
4. **Plain files.** A note is a `.md` file with its own image folder next to it (`labo-04.md` + `labo-04.assets/`). It opens without loss in VS Code, Obsidian and GitHub. No database, no custom format.
5. **Invisible chrome.** One 34px bar with tabs. No sidebar, no theme picker, no status bar with word counts. The text is the interface.
6. **Fast, or it doesn't go in.** Every feature fits the budgets in §9. A feature that costs startup time does not ship.

## 4. Window and UI

- Frameless window (`decorations: false`). One 34px top bar containing, left to right:
  - Tab strip: `filename.md` or `Untitled-N`, where N is the lowest number no open or closed tab uses. A dot marks unsaved changes. Middle-click closes; dragging a tab moves it. Tabs shrink and truncate; the strip scrolls horizontally when full.
  - `+` button (new tab).
  - Snip, a small pixel crab (below).
  - Drag region (`data-tauri-drag-region`) filling the remaining space.
  - In read mode only: a small "Reading" chip that switches back to writing (`Ctrl+E`).
  - Window controls: minimize, maximize/restore, close.
- An empty tab shows a short hint for the core loop (§2) until the first character is typed.
- **Info bar**: a single thin bar directly below the top bar (or at the bottom for undo notices). It is the only way the app shows information or choices. No modals, no toasts, no `alert()`. Used for: first save, closed-tab restore, external-change conflict, errors (e.g. a file could not be written), and the command menu.
- **Command menu** (`Ctrl+Shift+P`): a top info bar with a filter field and up to six rows of commands and toggles. Typing filters (every word must appear in the name, case-insensitive), the arrows move, `Enter` runs, `Esc` or `Ctrl+Shift+P` closes. A command closes the menu, then runs; a toggle flips, shows its check mark and leaves the menu open. Each row shows its key. The menu is the only place for options: there is no settings screen. Toggles:
  - **Line breaks in read mode**: off by default. On, a single line break in the note shows as a break; off, read mode follows CommonMark and joins the lines into one paragraph.
  - **Clickable tasks in read mode**: on by default.
  - **Copy button on code blocks**: on by default.
  - **Match count in find**: on by default.
  - **Show Snip**: on by default.
- **Snip** is an 11×11 pixel crab right of the `+` button, about 22 px tall (22 px at 100%, 150% and 200%), sized to a whole number of screen pixels per cell so it stays sharp at every display scale. It reacts only to the app's own moments, never to typing: it claps when an image lands in a note (paste or drop), sighs with relief when a closed tab comes back, looks worried for 4 seconds when a note changed outside SnipMD and a choice waits (the info bar keeps the choice; Snip does not repeat it), and falls asleep after 10 minutes without a save; the next save wakes it. It has no sound, no text, no click action, and screen readers skip it. With reduced motion it shows still frames.
- Follows the Windows light/dark setting, with the Mica backdrop behind the top bar on Windows 11. No other theming in v1.
- System fonts (Segoe UI, Cascadia Mono / Consolas on Windows; the system font and its monospace on macOS). No web fonts, no network access at runtime.

## 5. Editor

- CodeMirror 6, raw Markdown with light styling: headings larger, Markdown syntax characters dimmed, bold/italic rendered. No live preview (hiding syntax) in v1.
- **Inline images:** every image link `![alt](path)` that points to a local image gets a block widget directly below its line. Max height 360px, max width 100%, `border-radius: 6px`. Clicking toggles full height. Missing files show a clear "image not found: <path>" placeholder, never a perpetual "loading".
- Images inside fenced code blocks are not rendered.
- **Lists and quotes** follow the Markdown structure, so what read mode shows matches what was typed:
  - `Enter` continues a list or quote. On an empty item or quote line it ends the block: a nested item moves one level up; leaving the outermost level leaves a blank line, so typing starts a new paragraph instead of continuing the item above.
  - `Backspace` right after the marker of an empty item clears the line; the next `Backspace` joins the line above.
  - `Tab` nests a list item (and the items selected with it) under the item above, indented to that item's text (3 spaces after `1. `, 4 after `10. `). `Shift+Tab` moves the item back to its parent's level. Outside a list, `Tab` indents.
  - An ordered list stays numbered in sequence (a nested list from 1, an outer list from its first number) after any edit that adds, removes or nests lines; one undo takes back the edit and the renumbering together. A list with the same number on every item keeps it, and a number typed inside a line is left as typed.
- **Code blocks** with a language name (```` ```python ````) are highlighted, in writing and in reading, with the same colours. A language's parser loads the first time a block names it, never at startup; until it is in, the block shows as plain code. Languages: JavaScript, TypeScript, JSON, CSS, HTML, Python, Rust, SQL, shell, YAML. Other names show as plain code.
- Find and replace: `Ctrl+F`, `Ctrl+H` (CodeMirror search panel at the top). With the toggle on, the panel shows which match is selected and how many there are ("2 of 5"), counted when typing pauses and capped at "1000+". In read mode they switch to writing first. The fields have no autofill, autocorrection or spell check; clicking a panel button keeps the focus in the field, so `Escape` still closes the panel.
- Undo history survives tab switches and the first save of an untitled tab.
- **Read mode (`Ctrl+E`)**: toggles between writing and reading for the active tab. Reading is rendered Markdown, sanitized (§8). Long lines wrap, also in code blocks, as in writing. A task item shows its checkbox in place of the bullet. No split view.
  - With the toggle on, clicking a task's checkbox writes `[x]` or `[ ]` into the note, as an edit in writing would (undoable, autosaved). When the rendering and the note's text disagree about which task it is, nothing is written and the info bar says so.
  - With the toggle on, each code block has a Copy button that puts the block's text on the clipboard.

## 6. Files, images and saving

### 6.1 Note on disk
- **Autosave**: a dirty disk-backed tab is written 1 second after the last keystroke, and immediately on window blur and app close. `Ctrl+S` works but is never required.
- **Atomic writes**: write to a temp file in the same directory, flush, then rename over the target. Never truncate-then-write.
- **Preserve encoding details**: keep the file's line endings (CRLF or LF) and UTF-8 BOM as found. New files use CRLF without BOM (LF on macOS, §13).
- **External changes**: on window focus and every 2 seconds while focused, compare the file's mtime/size with the last known state.
  - Tab clean → reload silently, keep cursor and scroll position. A tab in read mode shows the new text.
  - Tab dirty → info bar: "<name> was changed outside SnipMD and you have changes too." Actions: Open disk version · Reload · Keep mine. "Open disk version" opens the file's current text in a new read-mode tab, next to yours; a real diff view is v1.1. Autosave pauses for that tab until the user chooses Reload or Keep mine.
  - File gone (deleted or moved) → info bar: "<name> is no longer on disk." The tab keeps its text and turns dirty; autosave pauses. Action: Save again (writes it back to the same path; a missing folder stays a write failure).
- **Write failure** (folder deleted, drive removed, read-only): info bar with the error. The tab stays dirty, its content stays in the session, and other tabs and session saving keep working.

### 6.2 Untitled tabs
- Live in the session (§7) until saved or closed. They are never lost and never prompt on app close.
- **First save** (`Ctrl+S` on an untitled tab): info bar "Save as [folder ›] [name.md] [Save] [Other folder…]".
  - Name is prefilled from the first heading, slugified (`# DHCP-probleem lokaal B` → `dhcp-probleem-lokaal-b.md`); fallback `note-YYYYMMDD.md`.
  - Folder is the last folder used; the first time `Documents\Notes` (created if missing).
  - `Enter` saves, `Esc` cancels, "Other folder…" opens the native save dialog.
  - A name that is taken or cannot be a file name turns red, turns Save off and says why next to the field (a `\` or `/` points to "Other folder…").
  - If the name exists, the field turns red and Save is disabled; no overwrite prompt.

### 6.3 Images
- **Location**: each note has its own folder `<note-stem>.assets/` next to it. `labo-04.md` → `labo-04.assets/`.
  - Tested on Windows 11: Explorer only moves a companion folder for `.htm` files, not `.md`, whatever the suffix. SnipMD itself must keep note and folder together (§6.4).
- **Untitled tabs** store images in `%APPDATA%/com.snipmd.desktop/scratch/<tab-id>/` and link them as `untitled.assets/<file>`. That prefix resolves to the tab's scratch folder.
- **Filename**: `snip-YYYYMMDD-HHMMSS-mmm-XXXX.png` (local time to the millisecond + 4 random lowercase hex chars). Created with `OpenOptions::new().write(true).create_new(true)`, retrying with a new suffix on `AlreadyExists`. Never overwrites.
- **Link format**: relative, `![snip](labo-04.assets/snip-20261020-142211-087-3fa9.png)`. Percent-encode spaces and `( ) # % &` in the path so GitHub and Obsidian read it.
- **Paste rules**:
  - Clipboard has text (any `text/plain`) → paste text. Copying from Excel, Word or a browser pastes text, even though those apps also put an image on the clipboard.
  - Clipboard has only an image → save it and insert the link on its own line below the cursor; cursor moves to the line after. In the middle of a note that is a new empty line, so typing never joins the next paragraph.
  - `Ctrl+Shift+V` → always plain text.
- **Drag and drop**: an image file dropped on the editor is copied into the note's image folder and inserted at the drop position. A dropped `.md` file opens in a tab.
- **Transfer**: image bytes go to Rust as a raw binary IPC body, never as a JSON number array.
- **Race safety**: a paste is bound to the tab it started in. If the user switches tabs before saving finishes, the link is inserted into the original tab's document, not the visible one.

### 6.4 Rename, Save As, promotion
- **First save of an untitled tab**: move `scratch/<tab-id>/` to `<new-stem>.assets/` (rename; fall back to copy + delete across drives) and rewrite links `untitled.assets/` → `<new-stem>.assets/` in the buffer. The rewrite is one undoable transaction.
- **Save As** of a disk note (`Ctrl+Shift+S`): copy the image folder to `<new-stem>.assets/` (never overwriting a file there) and rewrite links; the tab continues as the new note. Save As keeps the original note and folder intact, also in the same folder.
- **Rename** in v1 is Save As to the same folder; SnipMD never deletes the old note or its images. The user removes them in Explorer.
- Only links that start with the exact old prefix are rewritten.

### 6.5 Cleanup
- Only at startup. Only inside `%APPDATA%/com.snipmd.desktop/scratch/`. Never touches image folders next to disk notes.
- A scratch folder is deleted when its tab is neither in the session nor in the closed-tabs list, **and** it is older than 14 days.
- Inside a live scratch folder, an image is deleted when no tab buffer and no closed-tab entry references it **and** its mtime is older than 14 days.
- A session that cannot be read at startup is never overwritten: it is renamed to `session.unreadable-<time>.json`, a lasting bar names it, and an image whose name appears anywhere in its text is kept. If it can be neither read nor renamed, SnipMD writes no session that run.

## 7. Session and recovery

- **One store**: `%APPDATA%/com.snipmd.desktop/session.json`. No localStorage.
- Contents: open tabs in strip order (id, file path or null, content for untitled and dirty tabs, cursor, scroll, mode), active tab, last-used folder, closed-tabs list, the command menu's toggles. A session without toggles (an older file) gets the defaults.
- Written atomically, debounced to at most every 500 ms while typing, and immediately after: a paste, opening/closing a tab, a save, window blur, app close.
- On startup: restore all tabs. For disk-backed tabs that were clean, read the file from disk (never trust the cached copy). For dirty ones, compare with disk and show the conflict bar if the file changed meanwhile.
- **Closed tabs**: `Ctrl+W` (or middle-click) closes immediately. A bottom info bar shows "<name> closed, with N screenshots. [Restore] Ctrl+Shift+T" for 8 seconds. `Ctrl+Shift+T` restores the most recent closed tab, including after restart. The list keeps the last 20 closed tabs or 14 days, whichever is shorter.

## 8. Security

Opening a Markdown file from someone else must never run code or touch files.

- Read mode HTML is sanitized (DOMPurify or equivalent): no scripts, no event handlers, no iframes, no `javascript:` URLs. Images only from the note's own folders or `http(s)`.
- Read-mode controls (Copy buttons, live task checkboxes, highlighted code) are the app's, added to the sanitized DOM; a note's own HTML can neither create them nor point one at its text.
- Strict CSP in `tauri.conf.json` (no `unsafe-inline` scripts, `connect-src` none beyond IPC).
- Rust commands only read or write paths inside an **allowed set**: files the user opened (dialog, CLI, drag-drop, single-instance forward, session restore), their `<stem>.assets/` folders, and `%APPDATA%/com.snipmd.desktop/`. Relative image paths are resolved and checked to stay inside the note's folder (no `..`, no absolute paths).
- Asset protocol scope is extended at runtime per image file the app resolved or saved, never a folder or `**/*`.
- No `tauri-plugin-fs`; all file access goes through the scoped commands.

## 9. Quality bar

Measured on an ordinary Windows 11 laptop. Every release is checked against this.

| Measure | Target |
|---|---|
| SnipMD's own start: page load begun to typing | < 150 ms |
| Double-click to typing, cold start | < 1 s |
| `Ctrl+V` to a 4K screenshot visible | < 150 ms |
| Memory with 5 tabs and 20 images | < 120 MB |
| Installer size | < 10 MB |
| Data loss on crash, Alt+F4, power loss, pulled drive, accidental Ctrl+W | 0 |
| Opening an unknown `.md` can run code or touch files | never |

WebView2 takes about 0.6 s to start before any page loads, and an app cannot shorten that. So the cold-start target covers it, and SnipMD's own part has its own, tighter target. When SnipMD is already running, a double-click hands the file to the open window.

## 10. Keyboard

| Keys | Action |
|---|---|
| `Ctrl+T` / `Ctrl+N` | New untitled tab |
| `Ctrl+O` | Open file |
| `Ctrl+S` | Save (first save: info bar) |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+W` | Close tab |
| `Ctrl+Shift+T` | Restore closed tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / previous tab |
| `Ctrl+1`…`Ctrl+9` | Go to tab N |
| `Ctrl+Shift+PageUp` / `Ctrl+Shift+PageDown` | Move the tab left / right |
| `Ctrl+Shift+P` | Command menu |
| `Ctrl+E` | Toggle read mode |
| `Ctrl+F` / `Ctrl+H` | Find / replace |
| `Ctrl+V` / `Ctrl+Shift+V` | Paste (rules in §6.3) / paste plain text |
| `F6` / `Shift+F6` | Move focus between the note, the info bar and the tab strip |
| In the tab strip: arrows, `Home`, `End` / `Enter` / `Delete` | Move between tabs / open / close |
| `Esc` in an info bar | Dismiss it (a pending choice, such as a conflict, stays) |

A held key acts once, except moving between tabs. On macOS, §13 maps these keys.

## 11. Opening files

- Double-click a `.md` / `.markdown` file (file association), drag it onto the window, `snipmd <path>` on the command line, or `Ctrl+O`.
- Single instance: a second launch forwards its paths to the running window and focuses it. Relative paths resolve against the second launch's working directory.
- Opening a file that is already open activates its tab.

## 12. Scope

**v1 — in:** tabs; new, open, save, save as; paste and drop screenshots, inline display, expand; session restore and closed-tab restore; find and replace; read mode; open via double-click, drag, CLI; follows Windows light/dark.

**Added after 1.0:** the command menu and its toggles (§4), code highlighting (§5), moving tabs (§4, §10), Snip (§4).

**v1 — deliberately out:** theme gallery, font choice, a settings screen (choices go through the command menu); folder or outline sidebar; split view; export to HTML or PDF; sync, accounts, sharing; plugins, AI features; Linux builds.

**macOS:** in testing as §13 describes; ad-hoc signed builds until there is a Developer ID. Linux stays out.

**v1.1:** `Ctrl+P` quick open over recent files. Share as one file: export to TextPack (zip of note + images) and import `.textpack` / `.textbundle`. The working format stays plain Markdown.

## 13. macOS

Everything above holds on macOS, with these differences. Where this section is silent, the Windows behavior applies with `Cmd` for `Ctrl`.

**Core loop.** Two ways in, both instant:
1. `Cmd+Ctrl+Shift+4` puts a snip on the clipboard; `Cmd+V` pastes it (§6.3 rules).
2. `Cmd+Shift+4` shows a floating thumbnail; dragging it onto the editor drops the image (§6.3 drag and drop).

The empty-tab hint shows both.

**Keys.** `Cmd` replaces `Ctrl` in §10, except:
- `Ctrl+Tab` / `Ctrl+Shift+Tab` stay `Ctrl`, as in browsers.
- Replace is `Cmd+Option+F`; `Cmd+H` hides the app.
- `Cmd+Q` quits with the same flush as closing the window. Nothing is lost (§3.3, §9).

Labels and tooltips show the macOS keys (⌘ ⌥ ⇧ ⌃).

**Menu bar.** macOS needs one: the webview's clipboard keys only work through an Edit menu.
- SnipMD: About, Hide, Hide Others, Show All, Quit.
- File: New Tab, Open…, Save, Save As…, Close Tab, Reopen Closed Tab.
- Edit: Undo, Redo, Cut, Copy, Paste, Paste as Plain Text, Select All, Find, Replace.
- View: Command Menu…, Read Mode, Enter Full Screen.
- Window: Minimize, Zoom.

Every item runs the same command as its key. `Cmd+W` closes the tab, never the window. The menu bar is the system's, not window chrome; §3.5 still holds for the window.

**Window.** The window uses the native title bar overlaid on the 34px top bar:
- The system's close, minimize and zoom buttons sit at the left of the bar; the tab strip starts after them. SnipMD draws no window buttons of its own.
- Native full screen and rounded corners.
- The bar is opaque and follows the macOS light/dark setting. No vibrancy in the first macOS release: it needs a private API.

**Files.**
- App data lives in `~/Library/Application Support/` under the app's identifier, the macOS counterpart of `%APPDATA%` in §6.3, §6.5 and §7.
- The first-save folder is `~/Documents/Notes`.
- New notes use LF. Existing files keep their line endings and BOM (§6.1).

**Opening files.** Double-click in Finder, Open With, a drop on the Dock icon, a drop on the window, `open -a SnipMD <path>` and `Cmd+O`. macOS keeps one instance and hands a running app the files. Closing the window quits the app: SnipMD has one window, and the session restores it.

**Distribution.**
- One universal app (Apple Silicon and Intel) in a `.dmg`, for macOS 13 Ventura or later.
- Signed and notarized, so Gatekeeper opens it without a warning. Until there is a Developer ID, builds are ad-hoc signed for testers, who clear the quarantine flag by hand.
- The §9 budgets apply, measured on an ordinary Apple Silicon Mac.

## 14. Decisions log

| # | Question | Decision |
|---|---|---|
| 1 | Autosave disk notes | Always, 1 s after the last keystroke, plus on blur and close |
| 2 | Writing view | Raw Markdown with light styling; live preview later, maybe |
| 3 | Default folder for new notes | Last used; first time `Documents\Notes` |
| 4 | Image location | One folder per note, `<stem>.assets/` |
| 5 | Finding notes | `Ctrl+P` recent files in v1.1; no sidebar |
| 6 | External change with local edits | Open disk version · Reload · Keep mine; a diff view is v1.1 |
| 7 | Rename | Save As to the same folder; SnipMD never deletes user files |
| 8 | Warning when quitting | None: autosave and the session already keep everything (§3.3) |
| 9 | A companion in the app | Snip, a pixel crab in the tab bar: purple body, lime claws (no orange or red, which read as Claude's colour or as an error; no yellow, the warning colour). One fixed look, switched off in the command menu, no colour choice |
| — | Bundled single-file format | Not as working format (breaks plain files, costly autosave, binary diffs). TextPack export/import in v1.1 |
