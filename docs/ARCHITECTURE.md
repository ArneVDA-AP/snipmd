# SnipMD architecture

How the code is laid out and why. Behaviour is defined in [`SPEC.md`](SPEC.md); the rules for changing code are in [`CONVENTIONS.md`](CONVENTIONS.md) (guardrails and conventions).

## Shape
```
WebView2 (TypeScript, CodeMirror 6)          Rust (Tauri v2)                      snipmd-core (no Tauri)
  app.ts  wiring, keys, lifecycle              lib.rs  commands, allowed set,        paths    lexical path checks
  tabs.ts tab list, editor/read panes                  drop, setup, dialogs          atomic   temp + flush + rename
  saving / external / closedTabs / drop        backdrop.rs  Windows 11 Mica          naming   snip-…png, create_new
  editor/  states, paste, images, search       links.rs     links open outside       note     read, stamped write
  preview/ read mode (loaded on first use)     perf.rs      budget marks             assets   move/copy image folders
  infobar / titlebar / firstSaveBar            macos.rs     menu, Finder, quit       text     line endings, BOM
                                                                                    session  load, texts, path filter
                                                                                    cleanup  startup scratch cleanup
        │  invoke (typed wrappers in ipc.ts)        │  calls
        └──────────────────────────────────────────┘
```
- **One store**: `%APPDATA%/com.snipmd.desktop/session.json` holds tabs, untitled text, closed tabs and the last folder. It is written atomically, debounced while typing and at once after a paste, a save, a close or blur (`session.ts`). A session that cannot be read is moved aside, never overwritten (`core/src/session.rs`).
- **Untitled tabs** keep their images in `%APPDATA%/com.snipmd.desktop/scratch/<tab id>/`, linked as `untitled.assets/…`. The first save writes the note, then moves that folder to `<stem>.assets/` and rewrites the links in one undoable step.
- **The allowed set** (Rust): every path a command touches must be a file the user opened, its `<stem>.assets/` folder, or the app data folder. Paths are checked lexically in `snipmd-core::paths`, the way Windows reads them; the asset protocol is granted per image file at runtime.

## Frontend
- `app.ts` is the only place that connects modules: it builds the DOM skeleton, registers the commands (the keyboard table of SPEC §10, the macOS menu bar and the command menu all run them by id) and the settings toggles, the F6 focus regions, and the flush on the window's close-requested event and on a macOS quit.
- `commands.ts` is the registry of `Command`s (id, title, keys, run, and `checked` for a toggle); `app.ts` registers the list once and `runCommand(id)` is the one way to run one. `settings.ts` owns the five toggles (SPEC §4) and their values, which live in `session.json` (version 3); a change saves the session at once and redraws read mode. `commandMenu.ts` shows the commands as the keyed top info bar `command-menu`: a filter field and a list, a toggle row stays open.
- `tabs.ts` owns the tab list and which pane is visible. A tab's text lives only in its CodeMirror `EditorState` (`editor/registry.ts`); `textOf(tab)` reads it. Closed tabs are tabs without a view: they keep their state, so a paste or write that ends after the close still lands.
- `saving.ts` writes notes one at a time per tab and sends the disk stamp it last saw; Rust refuses a write when the file changed. `external.ts` owns conflicts and their bars.
- `infobar.ts` is the only way to show messages and choices (no dialogs). A bar that belongs to a tab has a key ending in `:<tab id>`.
- `editor/setup.ts` builds a tab's state: GFM Markdown whose fenced code is parsed by languages that load on first use (`codeLanguages.ts`), the highlight style, line styling (`mdStyle.ts`), the empty-state hint, list and quote keys with renumbering (`lists.ts`), find and replace, paste and inline images (`imageWidget.ts`, a `StateField` of block widgets with an async URL cache).
- `editor/codeLanguages.ts` maps a fence's language name to a parser from a fixed list, each loaded on first use as its own chunk. JavaScript, TypeScript, CSS and HTML use the bare Lezer grammars, because lang-markdown imports their `@codemirror/lang-*` packages statically and a dynamic import of those would land in the startup files. `preview/tasks.ts` turns a click on a read-mode checkbox into a one-character change of the note, applied to the tab the view belongs to.
- `pet.ts` owns Snip's state (SPEC §4). The moments come in through `petMoment` from the chokepoints: `placeImages` (an image landed), `reopenClosed` (a tab came back), `setConflict` (a conflict starts) and `markSaved` (wakes it); one timer puts it to sleep 10 minutes after the last save. The sprites are in `petSprite.ts`, a chunk loaded when the window is idle: each state is a strip of its frames side by side, a few `<path>`s each, coloured from `main.css`. `titlebar.ts` keeps the slot it lives in.
- `titlebar.ts` also owns tab dragging with pointer events (not HTML drag and drop, which Tauri's file drop takes); a drop calls `move`, wired to `tabs.moveTab`.
- `preview/render.ts` (read mode) renders with `marked` and sanitizes with DOMPurify; images the app resolved get their URL after sanitizing, so a note cannot forge one. It is a separate chunk, loaded when the window is idle.
- `platform.ts` says once, from the engine's user agent, whether the page runs on macOS, and writes key combinations the way the system does (`⇧⌘T`). On macOS the top bar leaves room for the system's window buttons, the app's keys need Cmd alone (Control keeps its text bindings), and Paste as Plain Text arrives as a `paste-text` event with the clipboard's text, because WKWebView pastes only through the Edit menu's own Paste.
- Styles live in `main.css`; each feature has its own section at the end.
- `styles/main.css` holds the visual system: tokens for type, space, radius, motion and colour in both themes. `contrast.test.ts` checks every text pair for WCAG AA.

## Rust
- Every command that touches the disk is async, so a slow or removed drive never freezes the window.
- `lib.rs` only checks paths and wires: what a command decides (a stamped write, which session texts the cleanup may trust, which session paths are dropped) lives in `snipmd-core`, where it is tested.
- New images are created with `create_new` and a unique name; notes and the session are written to a temp file in the same folder, flushed and renamed.
- The scratch cleanup runs once at startup from `.setup()` on its own thread, only inside the scratch folder, and only deletes what is older than 14 days and referenced by no tab, no closed tab and no session kept aside as unreadable.
- `macos.rs` (SPEC §13) builds the menu bar, reads the clipboard's text for Paste as Plain Text, queues notes Finder hands over (`RunEvent::Opened`) until the page takes them, and answers AppKit's `applicationShouldTerminate:` with "later" until the page has flushed (5 s at most). Tao has no such hook, so it is added to tao's app delegate at startup. Only its two commands compile on Windows. `tauri.macos.conf.json` swaps the frameless window for native buttons over the bar.
- `SNIPMD_DATA_DIR` points the app at another data folder and `SNIPMD_TRACE` writes budget marks to `perf.log` there; `tools/measure/measure.ps1` uses both.

## Tests
- `npm test`: Vitest with jsdom: a test file per feature module, and `src/integration.test.ts`, which runs tabs, the editor registry, paste and saving together with only the Rust side stubbed.
- `cargo test -p snipmd-core`: the Rust logic, on any OS.
- CI on `windows-latest` runs both, builds the frontend and checks the Tauri crate on every push; a `macos-latest` job checks the crate for Apple Silicon and Intel.
- `.github/workflows/windows-run.yml` (manual): builds the release app on a Windows runner, measures the SPEC §9 budgets and screenshots the real window; the results are a workflow artifact.
- `.github/workflows/macos-run.yml` (manual): builds the macOS app and runs `tools/measure/macos-probe.sh`: launch, Finder open, the flush on Cmd+Q and on a Dock quit, Cmd+W closing one tab, paste and plain paste, replace and Cmd+H, and the top bar read through Accessibility; the results are in the log and a workflow artifact.
- `.github/workflows/release-macos.yml` (manual): builds the universal app, packs it with `tools/release/macos-package.sh` (Developer ID signing and notarization when the secrets exist, ad-hoc otherwise), installs it from the `.dmg` and runs the same probes on that copy. On a tag with *publish* on, it adds the `.dmg` to the release. See [`releasing.md`](releasing.md).
- `.github/workflows/release-win11.yml` (on a version tag): builds, tests and publishes the Windows files.
- `.github/workflows/release-notes.yml` (called by both release workflows, or by hand with a tag): sets a release's text from its CHANGELOG section and the downloads it has.

## Decisions
Build choices that are not obvious from the code, one line each: what, and why. Behaviour decisions are in SPEC §14.

- **Snip's frames** play as one Web Animation per state that slides the strip with `step-end` keyframes: each state's length and runs live in `pet.ts` (which times the return to idle), the frame offsets in `petSprite.ts`, no timer runs per frame, the animations pause while the window has no focus, and the CSP is untouched (no style attributes). Its sprites load when the window is idle, so it costs the startup files about 1.5 kB.
- **Command menu** is the keyed info bar `command-menu`, not a dialog: it keeps the no-modal rule and reuses the bar's focus and Esc handling.
- **Editor scope.** GFM without the embedded HTML, CSS and JS parsers (bundle 658 → 398 KB). Read mode is a lazy chunk.
- **Code languages** are a fixed list, each parser its own lazy chunk; an unknown name stays plain. A free-form list would pull every parser into the bundle.
- **Startup size.** `npm run build` fails above 440 kB of startup JS: the entry chunk plus every chunk it imports statically (`vite.config.ts`). Measuring only `index-*.js` once missed a +200 kB preload. `StreamLanguage` (for shell) costs about 8 kB because it lives in `@codemirror/language`, which is in the startup file anyway.
- **Lists.** Enter, Backspace and Tab are SnipMD's own on list and quote lines (`editor/lists.ts`), on top of CodeMirror's continuation: CodeMirror's Tab indented 2 spaces, which Markdown does not read as nesting under `1. `, and it renumbered only on Enter. Renumbering runs only on edits that add, remove or nest lines, so it costs nothing per keystroke inside a line.
- **Closed tabs.** Open and closed tabs are one list, and a closed tab has `closedAt`. Two lists led to a wrong pick and a data-safety bug.
- **Untitled numbers** come from the open and closed tabs, not from a counter in the session, so a restored closed tab never shares a title with a new one.
- **Look.** Fluent: neutral greys, the default Fluent accent (not the system accent), Segoe UI Variable for notes and Cascadia Mono for code. Dimmed Markdown marks are held to 3:1, because they repeat what the styling already shows.
- **Mica** is used only when Rust confirms Windows 11 (build 22000+). Otherwise the page stays opaque, so a wrong guess never shows the desktop.
- **Styles under Tauri's CSP.** CodeMirror gets Tauri's style nonce through `EditorView.cspNonce`. Switching the nonces off would also let note CSS apply if the sanitizer ever slipped.
- **WebView2.** Browser keys (reload, print, history) and the page menu are off. A reload would lose undo history and in-flight screenshots.
- **Find fields.** Ctrl+H focuses Replace only when Find already holds a term. The find and file-name fields set `autocomplete=off`, so WebView2's "Saved info" popup does not appear.
- **Data folder.** `%APPDATA%\com.snipmd.desktop` is Tauri's folder for the app identifier. Moving it would strand existing sessions.
- **Start.** A broker process that keeps WebView2 warm reaches about 320 ms, but crashes SnipMD's start when its options differ, so it is out. SPEC §9 budgets SnipMD's own start and the cold start separately for that reason.
- **macOS.** macOS 13 Ventura or later, one universal binary: Ventura still runs on 2017 Intel Macs and its WebKit has everything the frontend uses. No vibrancy, since it needs `macOSPrivateApi`.
