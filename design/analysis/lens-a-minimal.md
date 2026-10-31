# Lens A: minimal change for plugins (#81, first users #87 and #85)

Labels: [cited file:line], [computed: inputs], [conjectured: what would confirm it]. Line numbers are those of the files as read on 2026-10-31.

## 1. Verdict in 5 lines

1. Two extension points are enough for #87 and #85. The first is a theme that may only set an allowlist of `:root` tokens. The second is one CodeMirror completion slot, fed by a dedicated Worker per plugin. Everything else is what exists already: the `COMMANDS` list, the info bar, `settings.ts`, `applyToTab` and `ImageHome` with the allowed set.
2. Cost: the CSP gains `worker-src blob:`, Rust gains 3 async commands, and the change is about 470 product lines plus tests. Startup JS grows under 1 kB because the host and `@codemirror/autocomplete` load lazily. The startup headroom is only 3,331 bytes and autocomplete is 27,469 bytes [computed: 440,000 budget minus a 436,669-byte `index-*.js` built into the scratchpad; rolldown minify of `autocompletion, completionStatus, startCompletion`].
3. Where I disagree with #81: no first-party registry before the first third-party plugin. `COMMANDS` already is the command registry, and an in-process API proves nothing about a message API. Moving Snip or tables onto it buys no user-visible behaviour, and it spends startup bytes on indirection.
4. Where I disagree with #81: Rust cannot tell a plugin's request from the core's, so grants are enforced by a TS broker and Rust only enforces scope. Listing the note's folder is also outside today's allowed set, so SPEC §8 needs a new line. That is the owner's call.
5. Left open for the owner: a token-only theme or full CSS; completion while typing or only on Ctrl+Space; how much of the sandbox boundary must be proven on WebView2 before shipping (section 9).

## 2. Changes

| Path | New/changed | What | Est. lines |
|---|---|---|---|
| `src-tauri/tauri.conf.json` | changed | add `worker-src blob:` to `csp` and `devCsp` | 2 |
| `src-tauri/core/src/paths.rs` | changed | `resolve_dir(note_dir, rel)`: the same walk as `resolve_image`, but an empty path means the folder itself; `valid_plugin_id`, `valid_plugin_file` (one component, `.css`/`.js`) | 35 + 50 test |
| `src-tauri/core/src/plugins.rs` | new | `list_names(dir, cap)`: names and is-dir only, skips symlinks and reparse points, sorted, capped at 1000; `manifests(root)` reads `plugins/*/manifest.json` (64 kB cap) | 60 + 60 test |
| `src-tauri/src/lib.rs` | changed | `list_plugins`, `read_plugin_file`, `list_note_entries` (section 6), plus registration in `generate_handler!` | 45 |
| `src/ipc.ts` | changed | three wrappers, no logic | 12 |
| `src/plugins/api.ts` | new | message and manifest types (section 3); this is also the file the developer guide links to | 70 |
| `src/plugins/host.ts` | new, lazy chunk | reads manifests at idle, starts a Worker on first use, runs the broker (grants, request ids, timeouts, size caps), switches a plugin off with a bar, applies the theme | 170 |
| `src/plugins/prelude.ts` | new, lazy | the string prepended to plugin code: removes network, storage and nested-worker globals, then freezes them | 20 |
| `src/plugins/complete.ts` | new, lazy chunk | `autocompletion({ override: [source] })` bridged to the host; imports `@codemirror/autocomplete` | 45 |
| `src/editor/setup.ts` | changed | `pluginSlot = new Compartment()`, `pluginSlot.of(current)` in `createEditorState`, `setPluginExtensions(ext)` reconfigures every state through `applyToTab` | 12 |
| `src/settings.ts` | changed | owns the set of enabled plugin ids (off by default) and `togglePlugin(id)` | 20 |
| `src/types.ts` | changed | `SessionFile.plugins?: string[]` | 3 |
| `src/session.ts`, `src/tabs.ts` | changed | parse `plugins` leniently (string array) and add it to the snapshot | 5 |
| `src/app.ts` | changed | `menuRows` and `runCommand` read `[...COMMANDS, ...pluginRows()]`; `idle(startPlugins)` after `preloadReader()` | 12 |
| `src/styles/main.css` | changed | `.infobar-host` sets its tokens again from private `--bar-*` copies (section 7) | 25 |
| `src/plugins/host.test.ts`, `src/plugins/theme.test.ts` | new | broker refusals, timeouts, switch-off, theme filter | 200 |
| `docs/SPEC.md` | changed | §4 "No other theming" becomes token themes; §8 adds the plugin realm and the folder-listing line; §12 moves plugins from out to in; §14 one decision line | 15 |
| `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md` | changed | a `plugins/` paragraph; guardrail 9 gains "plugins run in a Worker and never get `invoke`" | 10 |
| `docs/plugins.md` | new | developer guide: manifest, messages, a template plugin, the mock harness | 120 (phase 3 of #81) |

Total product code is about 470 lines (Rust 140, TS 330, CSS 25) [computed: sum of the product rows]. Tests add about 310 lines and docs about 145 [computed]. All estimates are conjectured; a build would confirm them.

## 3. Plugin-facing API

All traffic is `postMessage` with structured-clone data, and there is no shared object. The broker drops any message that does not match these shapes exactly (convention 5). A dropped message counts as one strike.

```ts
/** manifest.json in %APPDATA%/com.snipmd.desktop/plugins/<id>/ */
export interface Manifest {
  api: 1;
  /** [a-z0-9-]{1,40}; must equal the folder name. */
  id: string;
  /** Shown with textContent in the command menu and bars; 1-60 chars. */
  name: string;
  version: string;
  /** A theme: a .css file name in the plugin's folder, at most 64 kB. No worker is started for it. */
  theme?: string;
  /** Code: a .js file name in the plugin's folder (classic script, one file), at most 256 kB. */
  main?: string;
  /** Asked for once, shown in the toggle row's title; the broker refuses anything else. */
  capabilities?: Capability[];
  /** Needs 'command'. They show as "<name>: <title>" in the command menu, without keys. */
  commands?: { id: string; title: string }[];
}

export type Capability = 'complete:link' | 'list:noteFolder' | 'command' | 'insert' | 'readNote';

/** One entry of a listing: a name, never a path. */
export interface NoteEntry { name: string; dir: boolean }

// Core -> plugin
export type ToPlugin =
  | { t: 'init'; api: 1; grants: Capability[] }
  | {
      t: 'complete'; req: number;
      /** Text before the cursor on its line, from the trigger on: `](lab` or `src="img/`, at most 500 chars. */
      before: string;
      /** Name of the note without .md, for `<stem>.assets/` first; null for an untitled tab. */
      stem: string | null;
    }
  | { t: 'command'; req: number; id: string }
  | { t: 'reply'; req: number; ok: true; value: NoteEntry[] | string | null }
  | { t: 'reply'; req: number; ok: false; error: string };

// Plugin -> core. `req` on a call is the plugin's own counter; `for` names the core request it serves.
export type FromPlugin =
  | { t: 'ready' }
  | {
      t: 'completed'; req: number;
      /** How many chars of `before`, counted from its end, the options replace. */
      replace: number;
      /** At most 200 options; label and apply at most 1,024 chars each. */
      options: { label: string; apply?: string; detail?: string; dir?: boolean }[];
    }
  | { t: 'done'; req: number }
  /** Capability calls. They are only valid while core request `for` is open (the broker knows its tab). */
  | { t: 'call'; req: number; for: number; cap: 'list:noteFolder'; dir: string }
  | { t: 'call'; req: number; for: number; cap: 'insert'; text: string }
  | { t: 'call'; req: number; for: number; cap: 'readNote' }
  /** A plain info bar keyed `plugin:<id>`, at most 200 chars, text only. */
  | { t: 'info'; text: string };
```

Design choices in this API:
- The plugin never sees a tab id, an absolute path or a view. The broker keeps a map from each open core request `req` to the `tabId` it was made for. A call names that request in `for`, and the broker resolves the tab itself (guardrail 12, convention 4). [conjectured: a test that sends `for` of a closed request expects a refusal]
- `insert` goes through `applyToTab(tabId, …)` [cited src/editor/registry.ts:102] as one transaction at that tab's cursor, at most 64 kB.
- Time limits: a `complete` gets 300 ms, then the core uses no result. A `command` gets 5 s. Three strikes (a timeout, a malformed message, or an `error` event) terminate the Worker. The plugin is then switched off and a keyed bar says so with a *Turn on again* action [cited src/infobar.ts:114, src/types.ts:67].

## 4. Sandbox

**Choice: one dedicated Worker per code plugin, started on first use (first completion trigger or first command), never at startup.** An iframe would need `frame-src` opened [cited src-tauri/tauri.conf.json:27], DOM and layout in the page, and more memory. A Worker has no DOM by construction. Lens B may make a stronger case for an opaque-origin iframe; see section 9.

**Creation under the current CSP.** The CSP has no `worker-src`, so it falls back to `script-src 'self'` [cited src-tauri/tauri.conf.json:27]. A Worker URL must be same-origin, and plugin files live in `%APPDATA%`, not in `dist/`. So the host does this:
1. `readPluginFile(id, manifest.main)` through Rust. App data is already in the allowed set [cited src-tauri/src/lib.rs:492], and Rust validates `id` and `file` (section 6).
2. `new Blob([PRELUDE, '\n', source], { type: 'text/javascript' })`, then `URL.createObjectURL`, then `new Worker(url, { name: id })`, then `revokeObjectURL` once `ready` arrives.
3. `eval`, `new Function` and `importScripts` of anything but `'self'` are refused by the inherited `script-src 'self'`. That is why a plugin is one file. [conjectured: a blob: worker inherits its creator's CSP in Chromium, so in WebView2 too; confirm with the section 9 probe]

**CSP diff** (`app.security.csp`; `devCsp` gets the same addition):

Before:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: http://asset.localhost https: http:; connect-src ipc: http://ipc.localhost; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'
```
After:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: http://asset.localhost https: http:; connect-src ipc: http://ipc.localhost; font-src 'self'; worker-src blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'
```
This does not weaken SPEC §8. A note's HTML never runs script, because read mode is sanitized [cited src/preview/render.ts:1]. So only app code can build a blob URL and start a Worker from it.

**What the plugin realm can reach:**

| Target | Reach | Why |
|---|---|---|
| Internet (fetch, XHR, WebSocket) | no | inherited `connect-src ipc: http://ipc.localhost`; the prelude also deletes `fetch`, `XMLHttpRequest`, `WebSocket` and `EventSource` [conjectured: the inheritance holds in WebView2] |
| Remote images | no | Workers have no `Image`, and `createImageBitmap` needs a fetch [conjectured] |
| Tauri IPC | no `invoke` | Tauri's init script, which defines `__TAURI_INTERNALS__`, is injected into documents and not into Workers [conjectured]. A raw `fetch('http://ipc.localhost/…')` would pass `connect-src`, so this rests on the prelude removing `fetch` and on Tauri v2 requiring an invoke key the Worker never gets [conjectured: not visible here, since no Tauri crate source is on disk; this is the weakest point, section 9] |
| DOM, CodeMirror view | none | it is a Worker, and the API passes no handles (section 3) |
| Disk | only through the broker | `list:noteFolder` returns names; nothing writes |
| Other plugins | not by design | each has its own Worker. They share the app's origin, so `BroadcastChannel`, `indexedDB`, `caches` and `navigator.storage` would link them; the prelude deletes these before plugin code runs [conjectured: no other realm can bring them back, since nested `Worker` is deleted too] |
| Core state | only by messages | the broker validates every message; unknown shapes count as a strike |
| CPU, memory | a busy loop does not freeze the UI; memory is not capped | the Worker is a separate thread; the 300 ms timeout and strikes handle hangs. A Worker costs about 1-4 MB [conjectured: measure with `windows-run.yml` and a plugin on, against the 120 MB budget, SPEC §9 at docs/SPEC.md:147] |

## 5. Editor

**Completion.** `@codemirror/autocomplete` is installed (6.20.4, 276 kB on disk) [cited package-lock.json:92-93; computed: du]. Minified it is 27,469 bytes, 9,615 gzip [computed: rolldown with CodeMirror core external]. That does not fit the 3,331 bytes of startup headroom [computed, section 1], and setup.ts avoids `markdown()` for this reason [cited src/editor/setup.ts:34-36; docs/ARCHITECTURE.md:62,64]. So:
- `setup.ts` adds `pluginSlot.of(pluginExtensions)` (empty at start). A `Compartment` costs a few hundred bytes of startup code [conjectured: confirm with `npm run build`'s budget line].
- When the first plugin with `complete:link` is enabled, `host.ts` does `import('./complete')`, which pulls autocomplete into its own chunk. `setPluginExtensions([autocompletion({ override: [linkSource], icons: false })])` then sends `pluginSlot.reconfigure(...)` to every open and closed tab through `applyToTab`. New tabs read the current value in `createEditorState` [cited src/editor/setup.ts:51-75].
- `linkSource(ctx)` runs only on CodeMirror's completion trigger. It calls `ctx.matchBefore(/(?:\]\(|src=")[^)\s"]{0,200}$/)`, which is O(line) and not O(document) (convention 2). If that matches, it reads `tabId` from `tabIdFacet` [cited src/editor/registry.ts:8], posts `complete` to each granted plugin, awaits the result (300 ms limit), and returns null if `ctx.aborted`. Otherwise it returns `{ from: ctx.pos - replace, options, validFor: /^[^)\s"]*$/ }`.
- The plugin never holds the view. CodeMirror shows the tooltip and applies the chosen option to the state the context came from. A result for a tab that is no longer in the view is dropped, because the completion state lives in that tab's `EditorState` [conjectured: a Vitest test that switches `setState` during a pending source expects no insert into the new tab]. The text lands only when the user accepts it. That is a user edit in the visible view, so guardrail 12 holds by construction.
- Guardrail 10: a completion is a tooltip, not a block widget, so no `StateField` is needed. Guardrail 11: the only async part (the plugin's answer) is awaited inside CodeMirror's own async source API. It never runs inside `StateField.update`.
- Keys: autocomplete's keymap is `Prec.highest`, so Enter accepts an open completion before the list Enter [cited src/editor/setup.ts:42] [conjectured: confirm in `lists.test.ts` with the extension on].
- Styles: the tooltip's `<style>` gets the nonce through `EditorView.cspNonce` [cited src/editor/setup.ts:49,56].

**Decorations: out of lens A.** If a later plugin needs them, the route is the one `imageWidget.ts` already uses: a `StateField` that builds from a cache with one tagged entry per key (`ok`/`pending`/`failed`) [cited src/editor/imageWidget.ts:18-19], filled by an async ask to the plugin, then `applyToTab(id, { effects: redraw })` [cited src/editor/imageWidget.ts:26-27,57-77]. The plugin would return ranges for a line's text, never DOM. That is a few dozen lines and a new capability. It is not built until a plugin needs it.

## 6. Capabilities

| Capability | What it allows | Where enforced | New Rust command |
|---|---|---|---|
| (theme file) | load one `.css` file from the plugin's folder | Rust: `valid_plugin_id`/`valid_plugin_file` plus the allowed set (app data); TS: the token filter (section 7); CSP: `font-src 'self'`, and no `@import` in constructed sheets | `async fn read_plugin_file(app: AppHandle, id: String, file: String) -> Result<String, String>` (UTF-8, cap 256 kB) |
| (discovery) | the core lists installed plugins; a plugin cannot call this | Rust: reads only `<app data>/plugins/*/manifest.json` | `async fn list_plugins(app: AppHandle) -> Result<Vec<PluginManifestText>, String>` with `struct PluginManifestText { id: String, manifest: String }` |
| `complete:link` | receive the text before the cursor from `](` or `src="` (at most 500 chars) and the note's stem | broker (TS): sent only to granted, enabled plugins | none |
| `list:noteFolder` | names and is-dir of entries in the note's folder or a subfolder, within an open `complete` or `command` request. An untitled tab lists only `untitled.assets/`, which is its scratch folder | broker (TS): grant plus open request, and the tab comes from the request. Rust: `ImageHome::of` checks the note path against the allowed set [cited src-tauri/src/lib.rs:151-157]; `paths::resolve_dir` refuses `..`, absolute paths, drives, `:` and trimmed names, using the walk from `resolve_image` [cited src-tauri/core/src/paths.rs:56,80-105]; `list_names` skips symlinks and junctions | `async fn list_note_entries(app: AppHandle, tab_id: String, note_path: Option<String>, rel_dir: String) -> Result<Vec<NoteEntry>, String>` with `struct NoteEntry { name: String, dir: bool }` |
| `command` | add rows `"<name>: <title>"` to the command menu, with no keys; ids are namespaced `plugin:<id>:<cmd>` | broker (TS); `app.ts` merges the rows | none |
| `insert` | insert text at the cursor of the request's tab, as one transaction, at most 64 kB | broker (TS), through `applyToTab` | none |
| `readNote` | the text of the request's tab, once per request | broker (TS), through `textOf` | none |
| never | network, disk writes, `invoke`, DOM, other tabs, keys, info bar actions | CSP, Worker, prelude, and no message type exists | none |

Two notes on #81:
- #81 says capabilities are enforced by "Rust with the same path checks". Rust sees only the page, and the page also serves the core. Rust can enforce where a listing may look, not who asked. The grant check lives in the broker, and that is sound only while a plugin cannot reach `invoke` (section 9) [inferred from src/ipc.ts:1-16 and src-tauri/src/lib.rs:517: every command is called from one page].
- The allowed set covers opened files, their `<stem>.assets/` and app data. It does not cover the note's folder [cited docs/SPEC.md:134; src-tauri/core/src/paths.rs:213-230]. `list_note_entries` on the note's folder is therefore a new read, even if it returns names only. There are two options:
  - (a) SPEC §8 gains "names, never contents, of entries in the folder of an opened note and below it". #85 then works as asked, and #84's shared `images/` works too.
  - (b) Listing is limited to `<stem>.assets/`, with no SPEC change. #85 then completes only the note's own images, and #84 needs (a) later.

## 7. Theme

**Loading.** The CSP lists `'unsafe-inline'`, but a release build adds Tauri's style nonce. With a nonce present, `'unsafe-inline'` is ignored [cited docs/ARCHITECTURE.md:70; index.html:7-10; src/editor/setup.ts:44-49]. There are three ways to load a theme:
- **Constructable stylesheet.** `const s = new CSSStyleSheet(); s.replaceSync(css)`, then the filter, then `document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]`. `replaceSync` ignores `@import`, so there are no remote loads and the CSSOM is parsed the way the engine reads it (convention 5). This is my choice, if WebView2 does not check `style-src` for adopted sheets [conjectured: the release-build screenshot in `windows-run.yml` shows the theme's colour].
- **A `<style nonce>`.** This is the fallback if adopted sheets are blocked; it is the same route CodeMirror uses.
- **A `<link>`.** It would need the file under `'self'`, but plugin files are in app data. Rejected.

**Filter (option A1, recommended first).** The theme is parsed with the same `CSSStyleSheet`. The theme is refused as a whole, with a bar naming the first offending rule, unless every rule passes these checks:
- Each rule is a style rule with selector exactly `:root`, optionally inside `@media (prefers-color-scheme: dark|light)`.
- Each declaration is a custom property on the allowlist.
- No value contains `url(`, `image-set(`, `attr(`, `var(--bar-` or `!important`.

The allowlist is the public tokens: `--font-ui --font-display --font-mono --fs-body --fs-code --bg --chrome --hover --pressed --line --line-strong --control --text --text-strong --text-muted --syntax --accent --accent-hover --on-accent --link --code --code-bg --selection --focus --match --match-current --tok-*` [cited src/styles/main.css:6-71, the token list].

These tokens are excluded:
- `--bar-h`, so the 34 px bar stays [cited src/styles/main.css:138; docs/SPEC.md:27].
- Spacing, radius and motion.
- `--info-* --warn-* --error-* --danger`, which belong to the info bar.
- `--pet-*`, because Snip has one fixed look [cited docs/SPEC.md:250].

Fonts can only be system fonts, because `font-src 'self'` blocks any other font file. This also covers #86's "more fonts" and font size.

**Protecting the info bar.** Under A1 a theme cannot hide the bar: it cannot touch `display`, sizes or `opacity`. It could still make the text the colour of the bar through `--text`. So `main.css` declares private copies (`--bar-text`, `--bar-bg`, …) on `:root` next to the public ones, and `.infobar-host { --text: var(--bar-text); … }` sets them again. The filter refuses `--bar-*` names. The conflict bar and the command menu are info bars [cited src/commandMenu.ts:112; src/infobar.ts:56-68], so they are covered too. This is the same reason read mode strips note classes, so a note cannot draw a fake bar [cited src/preview/render.ts:24-26]. `contrast.test.ts` keeps checking the private copies.

**Option A2 (full CSS)** wraps the theme in `@layer theme { … }` and strips `!important`, so the app's unlayered rules win. The info bar is then protected only for the properties `main.css` sets on it. Anything it does not set (`opacity`, `transform`, `clip-path`, `font-size`) needs a guard rule, and that list is never complete [conjectured]. A2 also widens SPEC §3.5. It is the owner's call; lens A recommends A1 and leaves A2 for when a theme author hits the allowlist.

**Timing.** The theme loads at idle with the other plugins, so the default colours show for one frame before it applies. The other option is to read the theme file in the startup `Promise.all` [cited src/app.ts:215-223]. That costs one IPC read in parallel with `loadSession`, plus about 1 kB of filter code in the startup chunk [conjectured; this fits the 3,331 bytes but leaves little]. Owner's call: a flash, or startup bytes.

## 8. Per feature issue

| Issue | Where it belongs | Can lens A's API build it? |
|---|---|---|
| #58 Insert table | core command in `COMMANDS` (agrees with #81) | built-in: n/a. The `[]*2*3` shorthand plugin: no. It needs a trigger other than link targets, or a `command` that asks for rows and columns, and the API has no form bar. Missing: a generic completion trigger, or an input capability |
| #82 Context menu | extension point in core; its entries are commands | entries: yes, once #82 is built in core. Plugin `command` rows join any list built from `COMMANDS`. The menu itself: no, it is core DOM |
| #83 Rename a screenshot | core command (agrees) | the prompt after paste as a plugin: no. Missing: an image-placed event out of `placeImages` [cited src/editor/paste.ts:33-39], a rename capability and an input bar |
| #84 Existing image folder | core | not a plugin. Lens A depends on it: `list_note_entries` must follow the new image home, and option (a) in section 6 is needed |
| #85 Path completion | plugin | yes: `complete:link` plus `list:noteFolder`. The plugin ranks `<stem>.assets/` first and percent-encodes `apply` itself (SPEC §6.3). Untitled tabs list only `untitled.assets/` |
| #86 Font choice | monospace toggle in core (a `SETTINGS` row [cited src/settings.ts:5-11]); more via theme | yes for family and size through `--font-*`/`--fs-body`, system fonts only. The toggle is core |
| #87 Custom CSS | theme plugin | yes under A1 (tokens). No for arbitrary CSS unless the owner picks A2 |
| #88 Split view / own window | core or not at all | no, and it should not be: it is session and window architecture |
| #89 Workspaces | session API in core | a switcher plugin: no. Missing: a session capability, which lens A would not add before the core API exists |
| #90 Terminal | narrow core command | not as a plugin, ever (agrees) |
| #91 Collaboration | out | no: there is no network capability, by design |

Count: 2 of the 11 issues can be built fully by plugins under lens A (#85, #87) and #86 partly. The rest are core, or need a capability lens A deliberately leaves out [computed: rows above].

**Challenge to #81's step 1.**
- **No first-party registry is needed first.** The command registry exists [cited src/app.ts:87-106,128,131; src/commandMenu.ts:8-17]. The info bar is already the only message path [cited src/infobar.ts:114]. Settings already own toggles [cited src/settings.ts:5-11]. Building context-menu, paste, renderer and CodeMirror registries before any sandboxed consumer exists would add exports nobody reads (convention 10). It would also stabilise an in-process API that third-party plugins never get, since they only see messages.
- **The API stabilises by use.** Each capability is added when a plugin needs it, as #85 needs two.
- **Moving Snip is worth nothing.** It is first-party, hangs on four chokepoints by design [cited docs/ARCHITECTURE.md:31], needs DOM and Web Animations that the sandbox forbids, and already has its toggle. Moving it proves nothing about the message API and costs startup bytes.
- **Moving tables is not worth it either.** #58 as a command is about 30 lines in `COMMANDS`.

## 9. Weakest point and the cheapest test

**Weakest point: the sandbox boundary is three things I cannot see from Linux, and the capability model depends on all three.**
- A `blob:` Worker in WebView2 inherits the page's CSP [conjectured].
- No `__TAURI_INTERNALS__` exists in a Worker, and Tauri v2's IPC protocol refuses a raw `fetch('http://ipc.localhost/<cmd>')` without the invoke key or callback headers that only its init script holds [conjectured]. `connect-src` explicitly allows that URL [cited src-tauri/tauri.conf.json:27].
- The prelude's deletions of `fetch`, `BroadcastChannel`, `indexedDB` and `Worker` cannot be undone from inside the realm [conjectured].

If the second one fails, a plugin is a full page: `save_session`, `write_markdown_file` and `read_markdown_file` on any allowed path. Guardrail 8 and SPEC §9's "never" then fail through plugins, though not through notes. The fallback is the opaque-origin iframe (`sandbox="allow-scripts"`, `frame-src blob:`), whose `null` origin Tauri should refuse [conjectured]; that is lens B's ground.

**Cheapest test (about 25 lines, no product code).** Add a probe plugin to `windows-run.yml`'s release build. It is a `main.js` that, inside the Worker and before the prelude, tries each of these and posts back each outcome:
1. `fetch('https://example.com')`
2. `fetch('http://ipc.localhost/load_session', { method: 'POST' })`, with the Tauri headers copied from `@tauri-apps/api`'s invoke
3. `typeof __TAURI_INTERNALS__`
4. `indexedDB.open('x')`
5. `new BroadcastChannel('x')`
6. `importScripts('http://asset.localhost/…')`

A test page writes the results to `perf.log` through `perf_mark`. The expected outcomes are: (1) a CSP refusal, (2) an error or a refused response, never a session body, (3) `undefined`, and (4) to (6) refused once the prelude is on.

A second, cheaper guard: `npm run build`'s budget line after the change must still pass with less than 1 kB of growth, since the headroom is 3,331 bytes [computed, section 1].
