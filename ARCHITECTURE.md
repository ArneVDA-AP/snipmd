# SnipMD architecture

How the code is laid out and why. Behaviour is defined in `SPEC.md`; the rules for changing code are in `CLAUDE.md` (guardrails and conventions).

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
- `app.ts` is the only place that connects modules: it builds the DOM skeleton, owns the named commands that the keyboard table (SPEC §10) and the macOS menu bar both run, the F6 focus regions, and the flush on the window's close-requested event and on a macOS quit.
- `tabs.ts` owns the tab list and which pane is visible. A tab's text lives only in its CodeMirror `EditorState` (`editor/registry.ts`); `textOf(tab)` reads it. Closed tabs are tabs without a view: they keep their state, so a paste or write that ends after the close still lands.
- `saving.ts` writes notes one at a time per tab and sends the disk stamp it last saw; Rust refuses a write when the file changed. `external.ts` owns conflicts and their bars.
- `infobar.ts` is the only way to show messages and choices (no dialogs). A bar that belongs to a tab has a key ending in `:<tab id>`.
- `editor/setup.ts` builds a tab's state: GFM Markdown without embedded languages, the highlight style, line styling (`mdStyle.ts`), the empty-state hint, find and replace, paste and inline images (`imageWidget.ts`, a `StateField` of block widgets with an async URL cache).
- `preview/render.ts` (read mode) renders with `marked` and sanitizes with DOMPurify; images the app resolved get their URL after sanitizing, so a note cannot forge one. It is a separate chunk, loaded when the window is idle.
- `platform.ts` says once, from the engine's user agent, whether the page runs on macOS, and writes key combinations the way the system does (`⇧⌘T`). On macOS the top bar leaves room for the system's window buttons, the app's keys need Cmd alone (Control keeps its text bindings), and Paste as Plain Text arrives as a `paste-text` event with the clipboard's text, because WKWebView pastes only through the Edit menu's own Paste.
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
- `.github/workflows/release-macos.yml` (manual): builds the universal app, packs it with `tools/release/macos-package.sh` (Developer ID signing and notarization when the secrets exist, ad-hoc otherwise), installs it from the `.dmg` and runs the same probes on that copy. On a tag with *publish* on, it adds the `.dmg` to the release. See `RELEASE-MACOS.md`.
