# Issue snapshot (2026-10-31), condensed from GitHub for analysts without network

## #81 Plugin system (owner)
Keep the core to the core loop (SPEC §2) and guarantees (§3, §8, §9); the rest plugins, with a developer guide so users and their agents can write plugins. Changes SPEC §12 (plugins listed as out).
Proposed path: (1) first-party extension points first: commands, context-menu entries, paste/drop handlers, CodeMirror extensions, read-mode renderers, info-bar actions, a CSS layer; move Snip and tables (#58) onto it; API stable after 3-4 real features use it. (2) third-party plugins, off by default, from `%APPDATA%/com.snipmd.desktop/plugins/`, sandboxed in an iframe or worker, messages only, never `invoke`/DOM/CM view; manifest capabilities (insert text, read current note, list files under note folder, add command) that "Rust enforces with the same path checks"; plugins never write to disk, they ask the core. Load on idle after first paint; budgets measured with plugins on; a throwing plugin is switched off with a bar. (3) developer guide + template + mocked `__TAURI_INTERNALS__` harness.
Stays core: core loop, saving, session, `<stem>.assets/` model, path checks, info bar, tabs, read-mode sanitizing.
Open: iframe vs worker memory cost (120 MB budget); distribution (folder vs command-menu list); CSS-only theme as safe first step?; signing/review vs "you run what you install".

## Feature issues
- #58 Insert table from the command menu: info bar asks columns/rows, inserts header + `|---|` + rows as one undo step. #81 says: built-in command; a `[]*2*3` shorthand as plugin.
- #79 bug: two tabs can hold one path after a deleted note; *Save again* writes with no stamp and overwrites. Core data safety.
- #80 First-save bar: drop "Other folder…". Core.
- #82 Context menu: own right-click menu, entries are commands; Shift+F10/menu key; plugins add entries. Extension point.
- #83 Rename a screenshot: (1) Rename image command afterwards: info bar name, file renamed in `<stem>.assets/`, link rewritten in one step, create_new style refusal; (2) opt-in name prompt after paste, never blocking. #81: core command; prompt-on-paste as plugin.
- #84 Use a note's existing image folder (e.g. shared `images/`): changes image home, Save As, cleanup, path checks. Core.
- #85 Path completion in `](` or `src="`: CM autocomplete of entries under the note's folder, `<stem>.assets/` first; Rust command lists only inside note folder, names only; untitled lists only its scratch folder; inserted path relative and percent-encoded (§6.3). "If it cannot be built as a plugin, the plugin API is missing something." Check `@codemirror/autocomplete` size (setup.ts avoids `markdown()` partly to keep autocompletion out).
- #86 Font choice: monospace toggle in core; more via CSS theme. Maybe font size is the real ask.
- #87 Custom CSS: CSS-only theme plugin under the same CSP (no remote loads); tokens on `:root` become public; can a theme hide the info bar / conflict bar?
- #88 Split view / tab in own window: large core change (session per window, single instance). Core or not at all.
- #89 Workspaces: named sessions = session API in core; switcher could be plugin. Ctrl+P first.
- #90 Terminal: not a plugin capability; *Open folder in Terminal* as a narrow core command.
- #91 Collaboration: not planned; no network capability.
