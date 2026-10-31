# SnipMD plugins: design and plan (#81)

Status: proposal for the owner, 2026-10-31. Nothing here is decided until the owner says so; the decisions then go to SPEC §4, §8, §12, §14 and ARCHITECTURE "Decisions" in a PR to `main`.

Inputs: the two analyses in `design/analysis/` (lens A minimal change, lens B clean structure), the measurements in `design/prototype/README.md`, Tauri 2.12.5's source, and the code on `main` at 30bc309. Statements about WebView2 that the prototype could only show in Chromium are marked *(Windows: P0)*; phase P0 checks them on the runner before any product code.

## 1. Recommendation

Build plugins, but smaller than #81 proposes, and for a different reason.

1. **Two kinds of plugin, both off by default, installed by dropping a folder into `%APPDATA%/com.snipmd.desktop/plugins/`:**
   - a **theme**, which may only set the public colour, font and size tokens (no free CSS, no JS);
   - a **code plugin**, one JavaScript file in its own Web Worker, which talks to the core in JSON messages and can do only what its manifest asks for and the broker grants.
2. **No first-party registry up front.** The extension points are added when a real plugin needs them; the first two plugins (path completion #85, a theme #87) need exactly two: one completion slot and the token layer. Snip, paste, drop, lists and read mode stay as they are.
3. **The protocol is host-agnostic.** Manifest, capabilities and messages are plain JSON; plugin code may use ECMAScript and the `snipmd` object, nothing from the web platform. That keeps a native core (the `31okt-snipmd-native-core` research) able to run the same plugins in an embedded JS engine (section 13).
4. **Rust enforces where; the broker enforces who.** A plugin's request reaches Rust only through the broker, so Rust cannot tell a plugin from the core. Rust keeps checking every path (guardrail 8); the broker checks every grant.
5. **Order:** P0 probe on Windows → P1 token themes → P2 worker host and path completion → P3 developer guide → P4 only when a third plugin asks for more. The API is `apiVersion: 0` (unstable) until three real plugins use it.

## 2. Where this departs from #81

| #81 says | This design says | Why |
|---|---|---|
| Keep the core to the core loop; make the rest plugins | Plugins are for personal taste (looks, typing aids), not the way to absorb the tester list | Of the 11 feature issues, a plugin can build 2 fully (#85, #87) and 1 partly (#86). #58, #79, #80, #82, #83, #84 are core work whatever happens, and #88-#91 are core or out (section 14). The plugin system does not shrink the core; it stops personal preferences from growing it. |
| First-party extension points first, move Snip and tables onto them | No registry before a second caller exists | `COMMANDS` in `src/app.ts:87` already is the command registry, `showInfo` the only message path, `settings.ts` the toggles. A registry with one caller breaks code convention 10. Snip needs DOM and the title-bar slot, which no sandboxed plugin can have, so moving it proves nothing about the message API. Lens B's six registries cost about 1,320 product lines against lens A's 470 for the same first two plugins. |
| A sandbox in "an iframe or worker" | A worker, one per code plugin | Measured: a plugin in a busy loop froze the page for 1,501 ms from a sandboxed iframe and 14 ms from a worker. The iframe shares the editor's thread. |
| "Rust enforces each capability with the same path checks" | Rust enforces scope; the broker enforces grants; and listing a note's folder is a new read | Every command is called from one page (`src-tauri/src/lib.rs:517`). The allowed set covers opened files, their `<stem>.assets/` and app data, not the note's folder (`core/src/paths.rs:213-230`, SPEC §8). |
| "No network capability" means no exfiltration | It does not, without one more rule | A plugin that can insert text can insert `![](https://host/?q=<note text>)`; read mode loads `https:` images (SPEC §8, CSP `img-src https:`). The broker refuses plugin text that contains `://` (section 12). |
| Is a CSS-only theme the safe first step? | Yes, if it is tokens only | Free CSS can hide or forge the info bar and beacon out through `url()`. Tokens can do neither, and they survive a native core. |

## 3. Evidence

From `design/prototype/` (Chromium 153, headless, Linux; WebView2 is the same engine with its own flags, so P0 repeats the numbers on Windows):

| Measure | Worker | Sandboxed iframe |
|---|---|---|
| Memory, first one | 6.9-7.2 MB | 4.1-4.7 MB |
| Memory, each further one | about 2.7 MB | about 1.3 MB |
| Spawn to first reply | 7-27 ms | 8-26 ms |
| Page's longest stall while the plugin loops 1.5 s | 14 ms | 1,501 ms |
| Can fetch `https:` | no (inherited CSP) | no |
| Can fetch what the page may connect to | **yes** (inherited `connect-src`) | n/a |
| Has `__TAURI_INTERNALS__` | no | n/a |

- **Memory headroom is the binding budget.** The last Windows measurement was 98-104 MB of 120 MB with 5 tabs and 20 images (`docs/releasing.md`). One code plugin fits (about 7 MB); five (about 18 MB) would not. Workers start on first use, not at startup.
- **Startup bytes:** the startup JS is 436,669 of 440,000 bytes (lens A, `npm run build` into a scratch folder). Everything for plugins is a lazy chunk; the startup files gain only the token apply (about 0.3 kB) and the idle hook.
- **Autocomplete** (`@codemirror/autocomplete` 6.20.4, already in `node_modules` through lang-markdown, not in the startup chunk): 27-49 kB minified depending on what is counted as shared (lens A: 27,469 bytes with CodeMirror core external; this session: +49 kB over view, state and language). A lazy chunk either way.
- **IPC from a worker:** a worker can send a request to `http://ipc.localhost`. Tauri 2.12.5 refuses any IPC request without the per-launch `Tauri-Invoke-Key` header (`tauri/src/ipc/protocol.rs:479`, check in `src/webview/mod.rs:2010`). The key is a closure constant in the page's IPC script (`scripts/ipc-protocol.js:12`), declared there so that even `toString()` cannot leak it. A worker never sees it. *(Windows: P0 sends the request and expects the refusal.)*
- **Themes:** a constructable stylesheet applies under the current CSP and drops `@import`; `url(https:…)` survives. `documentElement.style.setProperty('--token', …)` applies under the CSP, a `style` attribute does not. Cascade layers keep a core `!important` above a theme's.

## 4. What stays core, and why

| Stays core | Why |
|---|---|
| The core loop: paste, drop, image save, `placeImages` | SPEC §2 and the 150 ms paste budget; a handler chain in front adds a lookup to the hot path |
| Saving, stamps, atomic writes, session, closed tabs | Guardrails 1-6, conventions 6-7. A plugin never writes; text it inserts is a normal edit, saved by autosave |
| The `<stem>.assets/` model, the allowed set, every path check | Guardrails 8-9. #84 changes the image home and is core work |
| The info bar and its keys | Guardrail 13. Plugins send text; the broker builds the bar with `textContent`, keyed `plugin:<id>` |
| Read-mode sanitizing and the app's read-mode controls | SPEC §8. No plugin renders HTML in api 0 |
| Tabs, windows, keys, the command menu | Plugin commands appear as rows in the menu; they get no keys in api 0 |
| Snip | First-party, DOM and Web Animations, one fixed look (SPEC §14 #9) |

## 5. Architecture

```
main thread (core)                                    worker per code plugin
  app.ts      idle → import('plugins/host')             prelude (trusted): removes web APIs,
  plugins/host.ts   discovery, enable state,              defines frozen `snipmd`
              broker (grants, request ids, timeouts,    plugin main.js (untrusted)
              caps, strikes), bars                         │ postMessage, JSON only
  plugins/complete.ts  autocompletion source ───────────┘
  editor/setup.ts      pluginSlot Compartment
  theme.ts    token filter + apply (startup: cached tokens)
Rust: list_plugins, read_plugin_file, list_note_entries (snipmd-core::plugins, paths::resolve_dir)
```

- **Discovery and enable state.** `list_plugins` reads `plugins/*/manifest.json` (each at most 64 kB) and returns their text; `snipmd-core::plugins` validates the shape so it is tested on any OS. Enabled ids live in `session.json` (`plugins: string[]`, guardrail 6); default none. Each installed plugin is a command-menu toggle "Plugin: <name>"; turning one on the first time shows a bar with its capabilities and [Turn on]. That is a choice the user started, not a question while writing (SPEC §3.1).
- **Loading.** After `markReady()`, and only if a plugin is enabled, `app.ts` imports `plugins/host` on idle. A theme applies at once. A code plugin's worker starts on its first use (the first completion trigger, or its command), not at load.
- **Failure.** A worker `error`/`messageerror`, a malformed message, or three timeouts within 60 s is a strike-out: `terminate()`, its contributions removed, a keyed bar "<name> stopped: <reason>. [Restart] [Turn off]". It stays enabled for the next start but is not restarted on its own this run (convention 10). A plugin holds no note data, so nothing is lost (convention 7).

## 6. Sandbox

- One dedicated worker per code plugin, from a Blob of `PRELUDE + source`; the blob URL is revoked after `ready`.
- A shared worker for all plugins was rejected for a reason beyond lens B's: plugins in one realm can patch each other's globals and ports, so the capabilities of the enabled plugins would merge into their union. Per-plugin grants need per-plugin realms. Cost: about 2.7 MB per extra plugin.
- An iframe was rejected: it freezes the editor on a busy plugin (measured), needs `frame-src` opened, and has no cheap native counterpart.
- A hidden second webview per plugin (Rust would then know the caller by webview label) was rejected: a second WebView2 renderer costs tens of MB against 16-22 MB of headroom *(Windows: not measured)*.
- **The boundary** is the worker realm, plus the inherited CSP (no network, no `eval`, no remote `importScripts`), plus Tauri's invoke key. The **prelude** is a second line: it deletes `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `importScripts`, `Worker`, `SharedWorker`, `BroadcastChannel`, `indexedDB`, `caches`, `navigator.storage` and `WebTransport` before plugin code runs. It also makes the web APIs that the native port could not offer unavailable on purpose.

## 7. The protocol (contract)

`src/plugins/api.ts` is the one source; the guide links it.

```ts
/** plugins/<id>/manifest.json */
export interface Manifest {
  apiVersion: 0;                       // unstable; see section 11
  id: string;                          // [a-z0-9-]{1,40}, equal to the folder name
  name: string;                        // 1-60 chars, shown with textContent only
  version: string;                     // the plugin's own, free text, at most 20 chars
  theme?: 'theme.json';                // token theme, no worker
  main?: 'main.js';                    // classic script, one file, at most 256 kB
  capabilities?: Capability[];         // the broker refuses anything not listed and granted
  completion?: { triggers: string[] }; // literal strings, at most 8 chars each, e.g. ["](", "src=\""]
}

export type Capability =
  | 'complete'         // receive completion requests at a declared trigger
  | 'list:noteFolder'; // names and a dir flag of entries under the note's folder, during a request
// Added only when a plugin needs them (P4): 'command', 'insert', 'readNote', 'events'.

export interface NoteEntry { name: string; dir: boolean }

// core -> plugin
export type ToPlugin =
  | { v: 0; t: 'init'; grants: Capability[]; platform: 'windows' | 'macos' }
  | { v: 0; t: 'complete'; req: number; trigger: string;
      before: string;          // the line before the cursor, from the trigger on, at most 200 chars
      stem: string | null }    // note name without .md; null for an untitled tab
  | { v: 0; t: 'reply'; req: number; ok: true; value: NoteEntry[] }
  | { v: 0; t: 'reply'; req: number; ok: false; error: string };

// plugin -> core
export type FromPlugin =
  | { v: 0; t: 'ready' }
  | { v: 0; t: 'completed'; req: number;
      replace: number;         // chars of `before`, from its end, that an option replaces
      options: { label: string; apply?: string; detail?: string }[] }   // at most 200, 1,024 chars each
  | { v: 0; t: 'call'; req: number; for: number; cap: 'list:noteFolder'; dir: string }
  | { v: 0; t: 'info'; text: string };   // a plain bar `plugin:<id>`, at most 200 chars, one per 10 s
```

- **Requests bind the tab.** A plugin never sees a tab id, a path or a view. The broker maps each open core request `req` to the tab it was made for; a `call` names it in `for`, and a `call` for a closed request is refused (guardrail 12, convention 4).
- **Plugin-side API** (defined by the prelude, frozen): `snipmd.on('complete', async (q) => ({ replace, options }))`, `snipmd.listNoteFolder(dir)`, `snipmd.info(text)`. The prelude fills `req`/`for` itself.
- **Limits:** a `complete` gets 250 ms, then the core shows nothing; messages above 1 MiB, unknown shapes and ungranted calls count as strikes.

**Rust (new, async, in `src-tauri/src/lib.rs`, logic in `snipmd-core`):**
```rust
async fn list_plugins(app: AppHandle) -> Result<Vec<PluginManifestText>, String>;          // { id, manifest }
async fn read_plugin_file(app: AppHandle, id: String, file: PluginFile) -> Result<String, String>; // enum { Main, Theme }
async fn list_note_entries(app: AppHandle, tab_id: String, note_path: Option<String>, rel_dir: String)
    -> Result<Vec<NoteEntry>, String>;   // names only, sorted, at most 500, no symlinks or junctions
// snipmd-core
pub fn valid_plugin_id(id: &str) -> bool;
pub fn resolve_dir(note_dir: &Path, rel: &str) -> Result<PathBuf, PathError>;   // resolve_image's rules; "" = the folder
pub fn list_names(dir: &Path, cap: usize) -> std::io::Result<Vec<NoteEntry>>;
pub fn parse_manifest(text: &str) -> Result<Manifest, ManifestError>;
```
`list_note_entries` checks the note through `ImageHome::of` (`lib.rs:151`); an untitled tab lists only its scratch folder (as `untitled.assets/`).

## 8. Editor

- `editor/setup.ts` gets one `pluginSlot = new Compartment()`, empty at start. When the first completion plugin is enabled, `plugins/complete.ts` (a lazy chunk with autocomplete) reconfigures every tab, open or closed, through `applyToTab`; new tabs read the current value in `createEditorState`.
- `linkSource(ctx)` reads at most 200 chars before the cursor (O(line), convention 2) and returns `null` unless a declared literal trigger is there, so no message is sent while typing ordinary text. It then awaits the plugin (250 ms), returns `null` if `ctx.aborted`, and otherwise `{ from, options, validFor }`.
- **Guardrails 10-11:** a completion is a tooltip, not a block widget; the plugin's async answer is awaited inside CodeMirror's async source, never in `StateField.update`. The plugin never holds a view; the accepted option is a user edit in the visible tab.
- **Keys:** autocomplete's keymap takes Enter only while the popup is open; list Enter (`Prec.high(listExtension())`) must still win otherwise. A test in `lists.test.ts` covers it.
- **Later (P4, when a plugin needs it):** decorations and input rules come back as data (ranges and class names prefixed `p-<id>-`, or a replacement string) and enter through one `StateField` that maps pending requests through the changes since they were sent. That is the `imageWidget.ts` pattern: async result, effect, synchronous update. Lens B section 5 has the design; it is not built before a plugin needs it.

## 9. Themes

- `theme.json` in the plugin folder: `{ "light": { "--bg": "#fff", ... }, "dark": { ... } }`. JSON rather than CSS, so the parse is ours and the format ports to a native core unchanged.
- **Allowed keys:** the public tokens (`--font-ui --font-display --font-mono --fs-body --fs-code --bg --chrome --hover --pressed --line --line-strong --control --text --text-strong --text-muted --syntax --accent --accent-hover --on-accent --link --code --code-bg --selection --focus --match --match-current --tok-*`, from `src/styles/main.css`). Excluded: `--bar-h` (the 34 px bar), spacing, radius, motion, `--info-* --warn-* --error-* --danger` (the info bar), `--pet-*` (Snip).
- **Allowed values:** checked with `CSS.supports(prop, value)` for the token's kind: a colour for colours, a font family list for fonts (system fonts only, since `font-src 'self'`), a length for sizes. No `url(`, `image-set(`, `attr(`, `var(`, `!important`. A theme with a bad entry is refused as a whole, with a bar naming the first entry.
- **The info bar cannot be hidden or forged:** `.infobar-host` sets its colours again from private `--bar-*` copies, which no theme may set. `contrast.test.ts` keeps checking those pairs. A theme can still make the note hard to read; that is the user's own choice.
- **No flash at start:** the filtered tokens of the enabled theme are kept in `session.json` and applied with `style.setProperty` before the first paint (allowed under the CSP; a `style` attribute is not). At idle the host rereads `theme.json`, and if it changed, it filters, applies and saves the tokens again.
- **Free CSS** (`@layer theme` under a guard layer) is the alternative the owner may choose (question 3). It costs the guarantees above and does not port to a native core.

## 10. CSP

```
before: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: http://asset.localhost https: http:; connect-src ipc: http://ipc.localhost; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'
after:  default-src 'self'; script-src 'self'; worker-src blob:; style-src 'self' 'unsafe-inline'; img-src 'self' asset: http://asset.localhost https: http:; connect-src ipc: http://ipc.localhost; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'
```
`devCsp` gets the same `worker-src blob:`. Only app code can create a blob worker: a note's HTML never runs script (read mode is sanitized).

**What must not change:** `script-src 'self'` (no `unsafe-eval`, no `blob:` in `script-src`), `connect-src` (no `https:`), `frame-src 'none'`, `font-src 'self'`, and the style nonce (no plugin gets it). The asset protocol scope is never widened for a plugin; a plugin gets no image URLs.

## 11. Distribution, versioning, stability

- **Distribution:** a folder you drop in. No store, no download from inside the app, no network, no auto-update. Sharing is copying a folder (or a git repo). "You run what you install": the capabilities shown at first enable are the disclosure. No signing in api 0; revisit if a shared catalogue ever exists.
- **Versioning:** `apiVersion: 0` is unstable, and only 0 loads. Once three real plugins run on it unchanged, the owner declares 1. From then on the core loads `oldest ≤ apiVersion ≤ current`: an added message raises `current`, a breaking change raises both, and a plugin outside the range is not started ("<name> needs plugin API N").
- **Stable surface:** the manifest, the messages, the capability names and the public token names. Class names, DOM and CodeMirror internals are never API.

## 12. What a broken or hostile plugin can and cannot do

| | Can | Cannot |
|---|---|---|
| Broken | Show no completions; cost one strike-out bar; use one CPU core until its timeout | Freeze typing (it is a worker); lose or corrupt a note (it writes nothing); block startup (lazy, after first paint) |
| Hostile, with `complete` | Read up to 200 chars of the current line after a trigger | Reach the network (CSP, prelude); call `invoke` (no key) *(Windows: P0)*; read other tabs, files or the session |
| Hostile, with `list:noteFolder` | Learn file names under the folder of the note that triggered the request | Read file contents; list outside the note's folder (`resolve_dir`, `ImageHome`); follow symlinks or junctions |
| Hostile, any | Offer misleading completion text that the user accepts | Insert a URL: the broker refuses plugin text containing `://` or `//`-relative links, which closes the remote-image exfiltration path through read mode |
| Hostile theme | Make the note ugly or hard to read | Hide or forge the info bar; load anything remote; run code |

The remaining risks are those of any local program the user chooses to run. A plugin cannot get more than its manifest asked for and the user turned on.

## 13. What assumes a webview

The native-core research may replace the webview. This is what each part becomes then:

| Part | Assumes a webview? | Without one |
|---|---|---|
| Manifest, capabilities, messages, `apiVersion` | No: JSON | Unchanged |
| Plugin code (`main.js`, ECMAScript plus `snipmd` only) | No, by rule: the prelude removes web APIs | An embedded JS engine (QuickJS via `rquickjs`) runs the same file with the same `snipmd` object; WASM is possible for new plugins |
| Worker sandbox and CSP boundary | Yes | The engine has no imports beyond `snipmd`; Rust is the broker and knows the caller, so grants move into Rust |
| Token themes (`theme.json`) | No: names and values | Mapped onto the native theme's colours and fonts |
| Free-CSS themes (if chosen) | Yes | No counterpart; a reason to stay with tokens |
| Completion slot | The CodeMirror adapter does | The native editor's completion calls the same `complete` message |
| Decorations, input rules (P4) | Data only (ranges, classes, strings) | The native editor applies the same data |
| Plugin-rendered HTML panels | Not offered | Not offered; nothing to port |

The cost of keeping this open is the "no web APIs in plugins" rule and JSON themes. Both are wanted for safety anyway.

## 14. Feature issues

| Issue | Lives in | Can this API build it? |
|---|---|---|
| #58 Insert table | Core command in `COMMANDS` (about 30 lines) | The `[]*2*3` shorthand needs an input rule and `insert` (P4) |
| #79 Two tabs on one path | Core (data safety) | n/a |
| #80 Drop "Other folder…" | Core | n/a |
| #82 Context menu | Core feature; its entries are commands, so plugin commands join it once P4 adds `command` | Entries yes (P4); the menu itself is core DOM. Open: is a popup menu allowed under SPEC §4 "info bar only"? |
| #83 Rename a screenshot | Core command (rename and link rewrite) | The prompt-on-paste needs `events` and a call to the core rename (P4) |
| #84 Existing image folder | Core (image home, allowed set) | n/a; `list_note_entries` must follow the new home when it lands |
| #85 Path completion | **Plugin** (the first one) | Yes: `complete` + `list:noteFolder`; the plugin ranks `<stem>.assets/` first and percent-encodes (SPEC §6.3) |
| #86 Font choice | Monospace toggle in core; family and size by theme | Yes for family and size (system fonts) through `--font-*` and `--fs-body` |
| #87 Custom CSS | **Plugin** (a token theme) | Yes for colours and fonts; no for free CSS unless the owner chooses it |
| #88 Split view / own window | Core, or not at all | No, and it should not be |
| #89 Workspaces | Session API in core first; Ctrl+P first | A switcher needs a `session` capability that does not exist |
| #90 Terminal | Narrow core command *Open folder in Terminal* | Never as a plugin (no process capability) |
| #91 Collaboration | Out | Never (no network capability) |

## 15. Developer guide (outline, `docs/plugins.md` in P3)

Written so an agent can build a plugin from it alone:
1. **What a plugin is**: the two kinds, what they can and cannot do (sections 9, 12), one paragraph each.
2. **Quick start**: copy `tools/plugin-template/` to `%APPDATA%/com.snipmd.desktop/plugins/<id>/` (macOS: `~/Library/Application Support/com.snipmd.desktop/plugins/<id>/`), edit `manifest.json`, enable it with "Plugin: <name>" in the command menu.
3. **Manifest reference**: every field, with limits, generated from `src/plugins/api.ts`.
4. **The `snipmd` object**: every function and event, with its message, limits and timeout.
5. **Rules**: ECMAScript only (no `fetch`, DOM, storage); one file; answer within 250 ms; never return text with `://`; what counts as a strike.
6. **Themes**: the token list with the default light and dark values, and the value rules.
7. **Test harness**: `tools/plugin-template/harness/` is a Vite page with a mocked `window.__TAURI_INTERNALS__` (invoke, transformCallback, convertFileSrc, metadata), the app, and a fake plugin folder. `npx vite --config tools/plugin-template/harness/vite.config.ts` loads the plugin, types a trigger and shows the completions; a Vitest file drives the same protocol headlessly (`npm test` in the template).
8. **Worked example**: path completion (#85), complete source, about 60 lines.
9. **Checklist before sharing**: id equals the folder name, apiVersion 0, capabilities minimal, harness test green.
10. **Versioning**: what `apiVersion` 0 means, and what changes at 1.

## 16. Phased plan

Runs as `thin-standard`. Each phase's args go to `.claude/runs/` on the working branch and are shown to the owner before the run. The cost figures are rough estimates from the size of each unit.

**Contract (built by the main session before P2, shared, owned by no unit):** `src/plugins/api.ts` (section 7 types) and `src-tauri/core/src/plugins.rs` signatures (section 7 Rust).

### P0: Windows probe (decides whether P2 is safe)
- **Units:**
  - **B0** (thin-builder): a `test/plugin-probe` branch with a probe page in a release build (worker from a blob under the real CSP), plus a `windows-run.yml` step. The probe tries, from a worker: `eval`, `fetch https:`, a POST to `http://ipc.localhost/read_markdown_file` with and without Tauri's headers, `typeof __TAURI_INTERNALS__`, remote `importScripts`, `indexedDB`. It also tries `style.setProperty` of a token and a constructable stylesheet. Results go to `perf.log` through `perf_mark`, and memory is measured with 5 tabs, 20 images and 0, 1 and 3 idle workers.
  - **V0** (thin-verifier): reads the run's artifact.
- **Owns:** B0 `tools/measure/plugin-probe/**`, `.github/workflows/windows-run.yml` (on the test branch only); V0 `findings/plugins/P0.md`.
- **Checks:** `npm run build` exit 0; the run's log has every probe line; V0 states each refused/allowed against section 12.
- **Gate:** any "allowed" for IPC or network stops the plan; the design falls back to a hidden plugin webview or no code plugins.
- **Cost:** about $1-2 plus one runner run.

### P1: token themes (#87, #86 fonts)
- **Units:**
  - **B1** (thin-builder, TS): `src/theme.ts` + test, i.e. the filter, the apply and the session cache. Also the `.infobar-host` `--bar-*` copies in `main.css`, `plugins: string[]` in session/types, the startup apply in `app.ts`, and the plugin toggles in the command menu.
  - **B2** (thin-builder, Rust): `list_plugins`, `read_plugin_file`, and `snipmd-core::plugins` (manifest parse, `valid_plugin_id`) + tests.
  - **R1** (thin-review).
- **Owns:** B1 `src/theme.ts`, `src/theme.test.ts`, `src/styles/main.css`, `src/session.ts`, `src/types.ts`, `src/app.ts`, `src/ipc.ts`; B2 `src-tauri/core/src/plugins.rs`, `src-tauri/core/src/lib.rs`, `src-tauri/src/lib.rs`.
- **Checks:** `npm run lint`, `npm test` (a hostile theme with `url(`, `--info-bg` and a bad value is refused; a good one sets the tokens; the bar keeps its colours), `npm run build` (startup under 440 kB), `cargo test -p snipmd-core` (bad ids, oversize manifests and a wrong `apiVersion` are refused).
- **Cost:** about $3-5.

### P2: worker host and path completion (#85)
- **Units:**
  - **B3** (thin-builder, TS): `src/plugins/host.ts`, `prelude.ts`, `complete.ts` + tests, the `pluginSlot` in `setup.ts`, `worker-src blob:` in `tauri.conf.json`, and `list_note_entries` in `ipc.ts`.
  - **B4** (thin-builder, Rust): `list_note_entries`, `paths::resolve_dir`, `list_names` + tests.
  - **B5** (thin-builder): `tools/plugin-template/` with the path-completion plugin and the harness.
  - **V2** (thin-verifier): the harness, the browser smoke test, and a P0-style probe rerun on the release build.
  - **R2** (thin-review).
- **Owns:** B3 `src/plugins/**`, `src/editor/setup.ts`, `src/ipc.ts`, `src-tauri/tauri.conf.json`; B4 `src-tauri/core/src/paths.rs`, `src-tauri/core/src/plugins.rs`, `src-tauri/src/lib.rs`; B5 `tools/plugin-template/**`.
- **Checks:** `npm test` covers these cases:
  - a call for a closed request is refused;
  - a busy plugin is struck out after its timeouts;
  - text with `://` is refused;
  - a completion for a switched tab lands nowhere;
  - list Enter wins without a popup.

  Also `cargo test -p snipmd-core` (`..`, absolute paths, drive roots, symlinks, more than 500 entries), `npm run build` (autocomplete not in the startup files), and the `windows-run.yml` memory with the plugin on under 120 MB.
- **Cost:** about $8-12.

### P3: developer guide
- **Units:** **W1** (thin-writer): `docs/plugins.md` from section 15, `api.ts` and the template; **V3** (thin-verifier): a fresh agent builds a second plugin (a word-list completion) from the guide alone; **R3** (thin-review).
- **Checks:** V3's plugin passes the harness test unaided.
- **Cost:** about $3-5.

### P4: when a third plugin needs it
`command`, `insert`, `readNote`, `events`, decorations and input rules, added one at a time with the plugin that needs them. Candidates are the table shorthand (#58) and prompt-on-paste (#83). `apiVersion` 1 once three plugins run unchanged.

## 17. Questions only the owner can answer

1. **Plugins in at all?** SPEC §12 moves "plugins" from out to in, limited to token themes and sandboxed code plugins, off by default and installed from a folder. §1 keeps "Obsidian needs a vault, plugins and settings first" true, because SnipMD with no plugins is the whole product.
2. **SPEC §8:** may a plugin list file names (never contents) in the folder of an opened note and below it (#85 as asked, and what #84 needs later), or only in `<stem>.assets/` (no SPEC change; #85 then completes only the note's own images)? Recommendation: the folder.
3. **Themes:** tokens only (recommended: the bar stays protected, no remote loads, ports to a native core), or free CSS as well?
4. **Budgets:** do the SPEC §9 budgets hold with the enabled plugins on? Recommendation: yes, with the number of code plugins capped until P0 measures WebView2 (the Chromium numbers suggest two).
5. **Completion while typing** right after `](` and `src="` (recommended: a popup is not a question, and typing on ignores it), or only on `Ctrl+Space`?
6. **#82:** is a right-click popup menu acceptable under SPEC §4's "info bar only", or must it be an info-bar list like the command menu?

## 18. Text for the PR after a yes

- **SPEC §12:** "Plugins (§15): token themes and sandboxed code plugins, off by default, installed by dropping a folder into the app data folder. SnipMD with no plugins is the whole product." Remove "plugins" from the out list. Keep "theme gallery" out.
- **SPEC §8:** "A plugin runs in its own worker with no network, no file access and no `invoke`. It sees only what its granted capabilities give it, and text it offers may not contain a URL." Plus question 2's line.
- **SPEC §4:** "No other theming in v1" becomes "Themes may set the public colour and font tokens (§15); the info bar keeps its own."
- **SPEC §14:** one line, "Plugins: for personal taste, not for features; tokens-only themes; workers; folder install; API 0 until three plugins use it."
- **ARCHITECTURE "Decisions":**
  - Plugin sandbox: one worker per plugin from a blob, `worker-src blob:` only. Why: an iframe shares the editor's thread (1.5 s stall measured), and a shared worker merges the plugins' grants.
  - Plugin API: grown per plugin, no registry up front.
- **CONVENTIONS guardrail 9:** "Plugins run in a worker and never get `invoke`, the DOM or a CodeMirror view."
- **ARCHITECTURE line 25:** names `commands.ts`, which does not exist (the `Command` type is in `commandMenu.ts`, the list in `app.ts`). Fix it in the same PR.
