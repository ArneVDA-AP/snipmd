# Lens B: clean structure for the plugin system (#81)

Labels: **[C file:line]** cited, **[K: inputs]** computed, **[J: what confirms it]** conjectured. CONVENTIONS rules are cited by number (guardrail Gn, code convention Cn; docs/CONVENTIONS.md:17-50). Everything about WebView2 at run time is [J].

## 1. Verdict

1. Build one typed module, `src/extensions.ts`, that owns six registries: commands, context entries, paste transforms, editor contributions, fence renderers and app events. Core commands, Snip and the table command register there exactly as a plugin's broker does. The CSS layer goes in `src/theme.ts` and info-bar output stays `showInfo`, because that is already the one path for bars [C src/infobar.ts:114] (C3).
2. Only three built-ins should move: the command list [C src/app.ts:87-106,128-144], Snip's four moments, which become events [C src/editor/paste.ts:38, src/tabs.ts:408,433,511, src/diskState.ts:32], and main.css, which goes into `@layer core`. Moving paste, drop, the image widget, lists or the highlighter would be churn with no second caller.
3. The third-party tier is one dedicated Worker per plugin, built from a Blob (a trusted prelude plus the plugin's source). It inherits the page CSP, so the CSP diff is one directive: `worker-src blob:`. The broker is a lazy chunk, imported only when at least one plugin is on, so the startup bundle does not grow [K: vite.config.ts:8 budget; dynamic import].
4. Contributions are declared in the manifest. The worker never runs on the editor's synchronous path: completion is asked for through CodeMirror's async source, and decorations, input rules and paste transforms come back as effects into one StateField. That field remembers the changes made since each request, so G10 and G11 hold.
5. The API can build #58, #82 (as an extension point), #85, #86 and #87. #83's prompt needs a core `rename-image` capability. #89 needs a session API that does not exist yet. #84, #88 and #90 stay core, and #91 is out. The weakest point: the sandbox rests on two runtime conjectures (a blob worker inherits the CSP, and Tauri IPC refuses a worker). One probe plugin on `windows-run.yml` settles both.

## 2. Registry

Owner: `src/extensions.ts` (new, about 160 lines). It is wired once from `app.ts` (C8). Each kind has more than one caller: core plus the broker (C10). Every `register*` returns a `Disposer`, and the broker calls it when a plugin is switched off. A duplicate id or key throws, so each key has one binding.

```ts
export type Source = 'core' | `plugin:${string}`;
export type Disposer = () => void;

// 1. Commands (replaces COMMANDS/runCommand/menuRows/commandFor in app.ts)
export interface Command {
  id: string;                 // core: 'save'; plugin: 'plugin:<pid>:<name>'; also the macOS menu name
  title: string;
  keys?: string;              // Windows notation; registry refuses a combo already bound or in CodeMirror's defaultKeymap
  run: () => unknown;
  checked?: () => boolean;    // a toggle row
  source: Source;
}
export function registerCommand(c: Command): Disposer;
export function commands(): readonly Command[];            // menu order: core first, then plugins by title
export function runCommand(id: string): unknown;
export function commandForCombo(combo: string): string | undefined;   // 'shift+s' → 'save-as'

// 2. Context-menu entries (#82); entries are commands
export type MenuArea = 'note' | 'read' | 'tab' | 'image';
export interface MenuContext { area: MenuArea; tabId: string; hasSelection: boolean; imageLink?: string }
export interface ContextEntry { command: string; areas: readonly MenuArea[]; needsSelection?: boolean; source: Source }
export function registerContextEntry(e: ContextEntry): Disposer;
export function contextCommands(ctx: MenuContext): readonly Command[];

// 3. Paste transforms: text only, after CodeMirror pasted it (image paste stays core)
export interface PasteTransform {
  id: string;
  accepts: (text: string) => boolean;            // sync, O(pasted text), never O(document)
  transform: (tabId: string, text: string) => Promise<string | null>;  // null: keep as pasted
  source: Source;
}
export function registerPasteTransform(t: PasteTransform): Disposer;
export function pasteTransformFor(text: string): PasteTransform | undefined;   // first match only

// 4. Editor contributions: data specs, compiled by editor/pluginFields.ts (section 5)
export type EditorContribution =
  | { kind: 'completion'; id: string; triggers: readonly string[]; complete: (q: CompletionQuery) => Promise<CompletionItem[]> }
  | { kind: 'decorations'; id: string; decorate: (q: DecorateQuery) => Promise<DecoSpec[]> }
  | { kind: 'inputRule'; id: string; suffix: string; apply: (q: InputRuleQuery) => Promise<string | null> };
export function registerEditorContribution(c: EditorContribution & { source: Source }): Disposer;
export function editorContributions(): readonly (EditorContribution & { source: Source })[];
export function onEditorContributionsChanged(fn: () => void): Disposer;   // pluginFields reconfigures every tab

// 5. Read-mode fence renderers: untrusted HTML out, sanitized by render.ts
export interface FenceRenderer { lang: string; render: (code: string, tabId: string) => Promise<string>; source: Source }
export function registerFenceRenderer(r: FenceRenderer): Disposer;   // refuses a lang in codeLanguages.ts
export function fenceRenderer(lang: string): FenceRenderer | undefined;

// 6. App events: the chokepoints' moments
export type AppEvent =
  | { kind: 'imagePlaced'; tabId: string; links: readonly string[] }
  | { kind: 'tabRestored'; tabId: string }
  | { kind: 'conflict'; tabId: string }
  | { kind: 'saved'; tabId: string };
export function emit(e: AppEvent): void;
export function onAppEvent(fn: (e: AppEvent) => void): Disposer;
```

```ts
// src/theme.ts (new): the CSS layer. One theme at a time; themes conflict by nature.
export function applyTheme(source: Source, css: string): Disposer;   // throws ThemeRejected(reason)
// Info bars: no registry. The broker turns a plugin bar into an InfoMessage (types.ts:67) for showInfo.
export interface PluginBar {
  key: string; kind: 'info' | 'warning' | 'error'; text: string; tabId?: string; timeoutMs?: number;
  fields?: { id: string; label: string; value: string; maxLength: number }[];
  actions?: { id: string; label: string; primary?: boolean }[];
}
```

What moves where, with churn and benefit per move:

| Current code | Moves onto | Churn / benefit |
|---|---|---|
| `COMMANDS`, `runCommand`, `menuRows`, `commandFor` [C src/app.ts:87-106,128,131,138-144] | `registerCommand` per entry in `startApp`, `commandForCombo` | About 40 lines. Benefit: plugin commands show up in the menu, the keys and the context menu through one path [K: 3 callers: keydown, menu, onMenuCommand at app.ts:255]. **Move.** |
| `Command` type [C src/commandMenu.ts:8-17] | extensions.ts, gains `source` | About 12 lines. Benefit: one owner. ARCHITECTURE.md:25 names a `commands.ts` that does not exist [C docs/ARCHITECTURE.md:25; `ls src` shows no such file]; that doc line gets fixed here. **Move.** |
| Settings toggles [C src/app.ts:100-105] | stay commands with `checked`; plugin on/off rows use the same shape | 0 lines. **Keep.** |
| `petMoment` calls [C src/editor/paste.ts:38, src/tabs.ts:408,433,511, src/diskState.ts:32] | `emit(AppEvent)`; pet.ts subscribes in `mountPet` [C src/pet.ts:103] | About 10 lines. Benefit only once the broker forwards events (#83 prompt-on-paste). Snip stays first-party: it needs the titlebar slot and DOM [C src/app.ts:231]. `markSaved` gains the tab id [C src/tabs.ts:511]. **Move in phase 2, not phase 1** (one listener before then: C10). |
| `allowContextMenu` [C src/app.ts:170-174,177-179] | new `contextMenu.ts` reads `contextCommands` | New feature (#82), not a move. |
| Image paste `pasteExtension` [C src/editor/paste.ts:52-75] | stays | It is the core loop (SPEC §2, §9 150 ms [C docs/SPEC.md:146]) and tied to `trackImageSave`. A handler chain in front of it would only add a lookup. Text pastes call `pasteTransformFor` after CodeMirror inserted them. **Keep.** |
| `pasteURLAsLink` [C src/editor/setup.ts:42] | stays a CM extension | It is already a CodeMirror extension; registering it would rename it, nothing more. **Churn, keep.** |
| `handleDrop` [C src/drop.ts:17-46] | no drop point | Rust sorts drops into notes and images only [C src/types.ts:91-96]. Another file type would need Rust to pass and allow it; a drop point would have one caller. **Not built.** |
| Static extensions in `createEditorState` [C src/editor/setup.ts:54-74] | stay; one `pluginCompartment.of([])` is added | The lists, find, the hint and the image field are core. Moving them is churn [K: 9 entries, 1 caller]. |
| Copy button and highlighting [C src/preview/render.ts:122-125,154-155] | stay app controls added after sanitizing | A plugin renderer is untrusted HTML before sanitizing; the built-ins are trusted DOM after it (SPEC §8 [C docs/SPEC.md:132]). Two trust levels, so no shared point. **Keep.** |
| Task boxes [C src/preview/render.ts:127, src/preview/tasks.ts:14] | stay | Same reason. |
| main.css [C src/main.ts:1] | wrapped in `@layer core { … }` plus a guard block | About 15 lines. Benefit: a theme can override core rules at all (unlayered CSS beats any layer) and cannot defeat the guard. `contrast.test.ts` slices from `':root {'`, which still matches [C src/styles/contrast.test.ts:11]. **Move in phase 3.** |
| Table insert (#58) | new built-in command | New. Its bar uses `PluginBar`-shaped fields so the API's form gets a first user. |

Count of moves [K: rows above]: 4 move (commands, Command type, Snip events, main.css), 7 stay or are not built.

## 3. Plugin tier

**Broker**: `src/plugins/broker.ts`, a lazy chunk, one `PluginHost` per plugin. It is the only code that talks to workers. It validates every message (shape, size of at most 1 MiB, capability, gesture), maps messages onto the registry, `applyToTab` [C src/editor/registry.ts:102-113] and `showInfo`, and keeps request ids and timers. It is wired with `startBroker({ textOfTab, activeTabId, applyEdit, listEntries, sources })` from app.ts (C8).

**Envelope**: every message is `{ v: 1, type, ... }`. Requests carry `rid: number`. A gesture is `g: number`, issued by the host for a user act and valid for 5 s.

Host → plugin:
```ts
type HostMsg =
 | { v: 1; type: 'init'; pluginId: string; apiVersion: number; capabilities: Capability[]; platform: 'windows' | 'macos' }
 | { v: 1; type: 'command'; rid: number; g: number; command: string; tabId: string; selection: { from: number; to: number } | null }
 | { v: 1; type: 'barAction'; rid: number; g: number; key: string; action: string; fields: Record<string, string> }
 | { v: 1; type: 'complete'; rid: number; tabId: string; pos: number; lineBefore: string; trigger: string }
 | { v: 1; type: 'decorate'; rid: number; tabId: string; text: string }                 // needs read-note
 | { v: 1; type: 'inputRule'; rid: number; g: number; tabId: string; rule: string; lineBefore: string }
 | { v: 1; type: 'pasteTransform'; rid: number; g: number; tabId: string; transform: string; text: string }
 | { v: 1; type: 'renderFence'; rid: number; lang: string; code: string }
 | { v: 1; type: 'event'; g?: number; event: AppEvent }                               // needs events; g on imagePlaced
 | { v: 1; type: 'reply'; rid: number; ok: true; value: unknown } | { v: 1; type: 'reply'; rid: number; ok: false; error: string };
```
Plugin → host:
```ts
type PluginMsg =
 | { v: 1; type: 'ready' }
 | { v: 1; type: 'result'; rid: number; ok: true; value: unknown } | { v: 1; type: 'result'; rid: number; ok: false; error: string }
 | { v: 1; type: 'insertText'; g: number; tabId: string; text: string; range: 'selection' | { from: number; to: number } }   // insert-text
 | { v: 1; type: 'getNote'; rid: number; g: number; tabId: string }          // read-note; reply { title, text }
 | { v: 1; type: 'listEntries'; rid: number; g?: number; tabId: string; dir: string }   // list-files; reply NoteEntry[]
 | { v: 1; type: 'showBar'; g?: number; bar: PluginBar }                     // fields/actions need g
 | { v: 1; type: 'clearBar'; key: string }
 | { v: 1; type: 'error'; message: string };
```
`result.value` types per request: `complete` → `{ label: string; insert: string; detail?: string }[]` (at most 200), `decorate` → `DecoSpec[]` (at most 2000), `inputRule` and `pasteTransform` → `string | null`, `renderFence` → `string` (HTML), `command` and `barAction` → `null`.

The broker enforces these rules:
- A bar key becomes `plugin:<pid>:<key>`, and gets `:<tabId>` when it has a tab, so `clearTabInfo` covers it [C src/infobar.ts:150]. `sticky` and `body` are never set. Fields are built with `plainField` [C src/commandMenu.ts:2].
- An edit is `applyToTab(tabId, { changes, userEvent: 'input.plugin' })`, so it is undoable and autosaved (G12, C4). It needs a live gesture whose tabId equals the message's tabId; a range must lie inside the doc of that gesture's snapshot.
- Any message with a type, capability or shape it does not expect counts as a throw.

**Manifest** (`%APPDATA%/com.snipmd.desktop/plugins/<id>/manifest.json`, parsed and validated in Rust `snipmd-core::plugins`, so it is tested anywhere: C5, C9):
```ts
interface PluginManifest {
  id: string;               // [a-z0-9-]{1,40}, equal to the folder name
  name: string;             // ≤ 60 chars, shown with textContent only
  version: string;          // the plugin's own, free text ≤ 20
  apiVersion: number;       // integer, see versioning
  main?: 'main.js';         // fixed name; absent for a CSS-only theme
  theme?: 'theme.css';      // fixed name
  capabilities: Capability[];   // 'insert-text' | 'read-note' | 'list-files' | 'events' | 'theme'
  contributes: {
    commands?: { name: string; title: string; keys?: string }[];
    contextMenu?: { command: string; areas: MenuArea[]; needsSelection?: boolean }[];
    completion?: { id: string; triggers: string[] }[];     // literal strings ≤ 8 chars
    decorations?: { id: string }[];
    inputRules?: { id: string; suffix: string }[];        // literal, ≤ 16 chars
    pasteTransforms?: { id: string; startsWith?: string; maxLength: number }[];
    fences?: { lang: string }[];
  };
}
```
Contributions are static, so the menu lists plugin commands before the worker is up, and a command's `run` starts its worker on demand. Every `accepts` and trigger test is a literal check on the main thread. No regular expression from a plugin ever runs there [K: avoids ReDoS on the UI thread].

**Lifecycle**
1. After `markReady()` [C src/app.ts:260], app.ts calls `idle(...)` [C src/dom.ts:24], but only if the session lists an enabled plugin. Then it imports the broker.
2. The broker calls `list_plugins()` and registers the static contributions of each enabled plugin with a matching `apiVersion`. It starts one worker per `idle` callback, staggered.
3. Handshake: `init`, then `ready` within 2000 ms. Otherwise the plugin counts as thrown.
4. Request timeouts (the request resolves as `null`, so the core behaviour stands: the text stays as pasted, no completion, the fence stays plain): complete 250 ms, inputRule/pasteTransform 1000 ms, decorate 1000 ms, renderFence 2000 ms, command until its first message 5000 ms. Three timeouts within 60 s count as a throw.
5. A throw is the worker's `error` or `messageerror` event, a `type: 'error'` message, or a message the broker rejects. On a throw the broker calls `worker.terminate()`, calls every Disposer of that plugin and shows a keyed bar `plugin:<pid>`: "<name> stopped: <reason>. [Restart] [Turn off]". Unsaved edits are untouched, because a plugin holds no note data (C7). A worker is never restarted on its own, so a failure does not trigger the same work again (C10).
6. On window close, the broker terminates the workers. There is nothing to flush.

**Enable state** lives in `session.json` as `plugins: Record<string, { enabled: boolean }>` (G6). It is parsed like settings [C src/session.ts:125] and its default is off. Turning a plugin on is a command-menu toggle "Plugin: <name>". Its first activation shows a bar listing the capabilities with [Turn on] (a user-started choice, not a question while writing: SPEC §3.1 [C docs/SPEC.md:23]). Whether `session.json` needs `version: 4` depends on whether `core/src/session.rs` keeps unknown keys [J: it uses `serde_json::Value` (session.rs:7); a round-trip test confirms].

Open for the owner: after a throw, is the plugin off for this run only (the default above) or off until turned on again?

**Versioning**: `const API = { current: 0, oldest: 0 }` in the broker. While the API is unstable, only `apiVersion === 0` loads. When it is declared stable it becomes `{ current: 1, oldest: 1 }`, and a plugin loads when `oldest ≤ apiVersion ≤ current`. A breaking change raises both. An added message type raises `current` only, and the broker sends an older plugin only the messages its version knows. A plugin outside the range is not started, and a keyed bar says "<name> needs plugin API N; this SnipMD supports oldest to current". The envelope's `v` is the wire format, separate from `apiVersion`, and is checked on every message.

## 4. Sandbox

**Choice: one dedicated Worker per plugin, created from a Blob.** Rejected alternatives:
- An iframe needs `frame-src` opened (today `'none'` [C src-tauri/tauri.conf.json:27]). Tauri's init scripts and IPC might reach a frame [J: WebView2 frame script injection], and a cross-origin frame may get its own renderer process [J: about 20-30 MB each against the 120 MB budget, C docs/SPEC.md:147].
- One shared host for all plugins: a single `terminate()` could then not switch off just the plugin that threw.
- A worker from a `'self'` URL with `eval` would need `'unsafe-eval'`, and its policy would come from response headers that Tauri may not send for `.js` files [J], which would leave the worker with no CSP and therefore network access.

**Creation**: the broker fetches the source with `plugin_source(id)` (Rust, inside the plugin folder only), then calls `new Worker(URL.createObjectURL(new Blob([PRELUDE, '\n;', source], { type: 'text/javascript' })))` and revokes the URL at once.
- `PRELUDE` is `src/plugins/prelude.js?raw`, trusted app code. It deletes `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `importScripts`, `Worker`, `indexedDB` and `caches` from the global and the prototypes. It defines a frozen `snipmd` object (`on(type, fn)`, `insertText`, `getNote`, `listEntries`, `showBar`, `clearBar`) over `postMessage`. That is defence in depth; the boundary is the realm plus the CSP.
- The main thread never evaluates plugin text.

**CSP diff** (`app.security.csp` [C src-tauri/tauri.conf.json:27]):
- before: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: http://asset.localhost https: http:; connect-src ipc: http://ipc.localhost; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`
- after: `default-src 'self'; script-src 'self'; worker-src blob:; style-src 'self' 'unsafe-inline'; img-src 'self' asset: http://asset.localhost https: http:; connect-src ipc: http://ipc.localhost; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`
- `devCsp` [C src-tauri/tauri.conf.json:28] gets the same `worker-src blob:;` after its `script-src` entry. Nothing else changes.

Why this is enough: a blob worker inherits the creator's policy (CSP3) [J: WebView2/Chromium behaviour, probe in section 9]. So inside the worker `eval`, `new Function` and `importScripts` from elsewhere are refused (no `'unsafe-eval'`), and `connect-src` allows only IPC.

**What the plugin realm can reach**:
- It cannot reach the DOM, `window`, `__TAURI_INTERNALS__` or a CodeMirror view (workers get no init scripts) [J: Tauri injects into documents only].
- It cannot reach the network: `connect-src` has no `https:`. `img-src https:` does not apply, because a worker loads no images [K: CSP directive scope].
- It can reach `http://ipc.localhost` in principle. Tauri v2 refuses an invoke without the per-run invoke key, which is held in the page's init script [J: header `Tauri-Invoke-Key`; probe in section 9]. The prelude also removes `fetch`.
- It cannot reach storage that survives: there is no IndexedDB after the prelude, a blob worker's origin carries no storage worth trusting, and nothing must survive there anyway (G6).
- It can reach its own CPU and memory. A tight loop costs one core, not the UI, and the timeouts end its role [J: a busy worker does not slow WebView2 input; measure.ps1 with a spin plugin].

## 5. Editor

All plugin editor parts live in `src/editor/pluginFields.ts` (new). `setup.ts` adds one `pluginCompartment.of(current())` [C src/editor/setup.ts:54-74]. When contributions change, `pluginFields` reconfigures every tab, open or closed: it calls `applyToTab(id, { effects: pluginCompartment.reconfigure(...) })` for each tab in `allTabs()` [C src/tabs.ts:90, src/editor/registry.ts:102]. No view is handed to a plugin.

**One field for pending work** (shared by decorations, input rules and paste transforms):
```ts
interface Pending { owner: string; changes: ChangeSet }          // changes since the request was sent
interface PluginState { decos: Map<string, DecorationSet>; pending: Map<number, Pending> }
const pluginField: StateField<PluginState>;   // update: decos.map(tr.changes); pending.changes = pending.changes.compose(tr.changes)
const deliver = StateEffect.define<{ rid: number; owner: string; specs: DecoSpec[] }>();
```
- Sending a request stores `rid → empty ChangeSet` for the tab: one effect, O(1).
- A result arrives as `applyToTab(tabId, { effects: deliver.of(...) })`, which is G11's pattern: async result, then an effect, then a synchronous field update. The update maps each range through `pending.changes`, drops a range whose text was edited (`touchesRange`), builds the `DecorationSet` and deletes the pending entry.
- `provide: f => EditorView.decorations.from(f, s => merge(s.decos))`. Block widgets therefore come from this StateField (G10).
- `DecoSpec = { from: number; to: number; class: string } | { line: number; class: string } | { at: number; text: string; block: boolean; class: string }`. Classes are forced to `p-<pid>-[a-z0-9-]+`. A widget is a core `WidgetType` that sets only `textContent` (G7).

**Decorations**: a `ViewPlugin`-free `EditorView.updateListener` inside the compartment, present only when a decorating plugin is on. On `docChanged` it only sets a 500 ms timer (C2). When the timer fires it asks on `idle` with `textOf` of the visible tab only (O(document) at idle, not per keystroke: C2). It sends at most one request per plugin per tab, and a newer request replaces an older pending one.

**Completion** (#85): when the first completion contribution registers, the compartment gets `(await import('@codemirror/autocomplete')).autocompletion({ override: [source] })`. That is a lazy chunk, about 90 kB unminified [K: `wc -c node_modules/@codemirror/autocomplete/dist/index.js` = 90056], and it stays out of the startup files [J: lang-markdown imports only `CompletionContext` (lang-markdown/dist/index.js:4); confirm with `npm run build`, which fails above 440 kB, vite.config.ts:8].
- `source(ctx)` is async, which `CompletionSource` allows [C node_modules/@codemirror/autocomplete/dist/index.d.ts:239].
  1. It reads at most 200 chars of the line before `ctx.pos`, and returns `null` unless a declared literal trigger is there. So there is no message per keystroke outside `](` or `src="`.
  2. Otherwise it awaits `complete` with a 250 ms timeout.
  3. It returns `null` when `ctx.aborted` is set [C …/index.d.ts:200].
  4. Otherwise it returns `{ from, options }`.
- Open point: `completionKeymap` binds Enter [C …/index.d.ts:620]. Enter on a list line is SnipMD's own (`Prec.high(listExtension())` [C src/editor/setup.ts:42]). The compartment must sit below that precedence, and only an open popup may take Enter [J: one test in lists.test.ts].

**Key bindings**: a plugin key is a command key in the registry, never a CodeMirror keymap entry. `app.ts` already resolves Ctrl combos from the command list and ignores Alt [C src/app.ts:138-144,187]. A plugin may claim only `Ctrl+Shift+<letter or digit>` combos that are free in the registry and not in `defaultKeymap` [C src/editor/setup.ts:68], and it is refused when it asks for another. The rule "a held key acts once" comes for free [C src/app.ts:189].

**Input rules** (the `[]*2*3` shorthand):
1. The same updateListener checks transactions with `userEvent 'input.type'`. If the text before the cursor ends with a declared literal `suffix` (O(suffix)), it records `pending` with the range of the current line before the cursor.
2. It sends `inputRule` with a gesture.
3. A string reply is applied through `applyToTab` in one transaction, replacing the mapped range, and only if that text is unchanged. So one undo takes it back (#58: one undo step [C design/analysis/issues-snapshot.md:10]).
4. A late or stale reply changes nothing.

**Paste transforms**: after CodeMirror inserts a text paste, `paste.ts` calls `pasteTransformFor(text)`. A match records `pending` for the inserted range, and the same mapping and apply path follows. The raw paste is visible at once, so nothing waits on the writing path (SPEC §3.1). Undo goes back to the raw text first [J: users read that as autocorrect; Windows test].

## 6. Capabilities

| Capability | What it allows | Where enforced | New Rust command |
|---|---|---|---|
| (always) contribute | commands, keys, context entries, completion, decorations, input rules, fences, bars without actions | broker + registry (refuses duplicates and taken keys) | none |
| `insert-text` | insert or replace text in the tab of a live gesture, range-checked | broker (gesture, tab id, doc snapshot), `applyToTab` | none |
| `read-note` | title and text of the tab of a gesture; `decorate` text of the visible tab | broker | none |
| `list-files` | names and a dir flag of entries under the note's folder (at most 500, depth from `dir`); for an untitled tab its scratch folder only | Rust: `ImageHome::of` checks the note against the allowed set [C src-tauri/src/lib.rs:151-156]; a new `snipmd_core::paths::resolve_listing` uses `resolve_image`'s lexical rules (no `..`, no absolute) [C src-tauri/core/src/paths.rs:80] | `#[tauri::command] async fn list_note_entries(app: AppHandle, tab_id: String, note_path: Option<String>, dir: String) -> Result<Vec<NoteEntry>, String>`, with `NoteEntry { name: String, dir: bool }`, plus `pub fn resolve_listing(note_dir: &Path, rel: &str) -> Result<PathBuf, PathError>` |
| `events` | receive `AppEvent`; `imagePlaced` carries a gesture | broker | none |
| `theme` | one CSS sheet in `@layer theme` | broker CSS filter (section 9); guard rules in `@layer core`; CSP `style-src` nonce [C src/editor/setup.ts:49] | none (source via `plugin_source`) |
| loading | read `manifest.json`, `main.js` and `theme.css` of an enabled plugin | Rust: id checked like `valid_tab_id` [C src-tauri/core/src/paths.rs:117], fixed file names, only under `<app data>/plugins/` | `async fn list_plugins(app: AppHandle) -> Result<Vec<PluginManifest>, String>`; `async fn plugin_source(app: AppHandle, id: String, file: PluginFile) -> Result<String, String>` with `enum PluginFile { Main, Theme }` |
| `rename-image` (needed for #83's prompt) | ask core to rename an image of the gesture's tab | Rust (`create_new`-style refusal, G2), the core command of #83 | the #83 core command; no plugin-only command |
| network | never | CSP `connect-src` (no `https:`), prelude | none |
| disk write | never; plugins ask the core | no command exists; edits go through `applyToTab` and the normal autosave (G1) | none |
| `invoke`, DOM, CM view | never | worker realm; Tauri invoke key [J] | none |

- SPEC §8 needs one line for `list-files`: listing names in the folder of an allowed note is a read outside the allowed set as written today [C docs/SPEC.md:134].
- The asset protocol is never widened for a plugin (G9): a plugin gets no image URLs.
- `PluginBar` with fields or actions counts as asking, so it needs a gesture. A bar without one is info-only and rate-limited to one per 10 s per plugin (G13, SPEC §3.1).

## 7. Feature issues

Sources: design/analysis/issues-snapshot.md:10-22.

| Issue | Where it lives | Lens B API builds it? |
|---|---|---|
| #58 table | built-in command; `[]*2*3` as a plugin | Yes. The command uses `PluginBar` fields, then `insertText`. The shorthand is an `inputRule` with suffix `' '`; the plugin parses the line it gets. |
| #82 context menu | extension point (`ContextEntry`) | Yes, by construction. Shift+F10 and the menu key go in `contextMenu.ts`. The menu is a popup list, not a modal [J: the owner reads SPEC §4 "info bar only" [C docs/SPEC.md:40] as allowing it; otherwise it becomes an info-bar list like the command menu]. |
| #83 rename screenshot | core command; prompt-on-paste as a plugin | Plugin: no, until `rename-image` exists. It needs the `imagePlaced` event (there) plus a capability to call the core rename (missing). |
| #84 shared image folder | core | No, by design: it changes `ImageHome` and the allowed set [C src-tauri/src/lib.rs:144-210]. |
| #85 path completion | plugin | Yes: `completion` with triggers `](` and `src="`, plus `list-files`. The plugin percent-encodes (SPEC §6.3 [C docs/SPEC.md:98]). It costs a lazy autocomplete chunk. |
| #86 font choice | monospace toggle in core; more fonts via theme | Yes, through a theme overriding `--font-ui` and `--font-mono` [C src/styles/main.css:8-10]. Font size works the same way via `--fs-body`. |
| #87 custom CSS | theme plugin | Yes, with the filter and guard. Open (owner): tokens-only themes, or full CSS (section 9). |
| #88 split view / window | core or not at all | No. Session per window is core. |
| #89 workspaces | session API in core; switcher could be a plugin | No. Missing: `workspaces` capability (list, open named session). Ctrl+P comes first. |
| #90 terminal | narrow core command | No, by design. There is no process capability. |
| #91 collaboration | out | No. There is no network capability. |

Counts [K: table rows]:
- buildable with lens B as it stands: 5 (#58, #82, #85, #86, #87)
- buildable with one missing capability: 2 (#83 `rename-image`, #89 `workspaces`)
- core or out by design: 4 (#84, #88, #90, #91)

## 8. Changes

| Path | New/changed | Est. lines | Phase |
|---|---|---|---|
| src/extensions.ts | new | 160 | 1 |
| src/extensions.test.ts | new | 120 | 1 |
| src/app.ts | changed (register commands, wire extensions, broker on idle) | −45 / +35 | 1, 2 |
| src/commandMenu.ts | changed (Command type out, reads `commands()`) | −12 / +4 | 1 |
| src/contextMenu.ts (+ test) | new (#82) | 120 + 90 | 1 |
| src/editor/table.ts (+ test) | new (#58 built-in) | 70 + 60 | 1 |
| docs/SPEC.md | changed (§4 context menu, §8 list-files and plugins, §12 plugins in, §14 one line) | +15 | 1, 2 |
| docs/ARCHITECTURE.md | changed (fix line 25, extensions, broker, Decisions: blob worker) | +12 | 1, 2 |
| src/pet.ts, src/editor/paste.ts, src/tabs.ts, src/diskState.ts | changed (`emit` instead of `petMoment`) | +8 / −6 | 2 |
| src/editor/pluginFields.ts (+ test) | new | 200 + 150 | 2 |
| src/editor/setup.ts | changed (compartment) | +2 | 2 |
| src/editor/paste.ts | changed (`pasteTransformFor` after a text paste) | +10 | 2 |
| src/preview/render.ts | changed (fence renderer, then the same sanitize as the note) | +25 | 2 |
| src/plugins/broker.ts (+ test) | new, lazy chunk | 320 + 250 | 2 |
| src/plugins/prelude.js | new | 110 | 2 |
| src/types.ts | changed (PluginManifest, NoteEntry, SessionFile.plugins) | +35 | 2 |
| src/session.ts, src/ipc.ts | changed (parse plugins; 3 wrappers) | +12, +15 | 2 |
| src-tauri/core/src/plugins.rs (+ tests) | new (manifest parse and validation) | 160 + 120 | 2 |
| src-tauri/core/src/paths.rs | changed (`resolve_listing` + tests) | +45 | 2 |
| src-tauri/src/lib.rs | changed (3 commands, handler list [C lib.rs:517]) | +70 | 2 |
| src-tauri/tauri.conf.json | changed (`worker-src blob:` in csp and devCsp) | 2 | 2 |
| src/theme.ts (+ test) | new (filter, layer, nonce'd style) | 90 + 80 | 3 |
| src/styles/main.css | changed (`@layer core`, guard block) | +15 | 3 |
| docs/plugins.md, tools/plugin-template/ | new (guide, template, harness on the mocked `__TAURI_INTERNALS__` page) | 200 + 80 | 4 |

Totals [K: sum of the rows]: about 1,320 lines of product code (each changed row counted by its larger side) and about 870 lines of tests, plus 230 lines of docs and 280 lines of guide and template (docs/plugins.md and tools/plugin-template/). By phase:
- Phase 1, registry first-party: #58, #82 and the commands move. It ships alone and the API is still unstable.
- Phase 2, worker tier with apiVersion 0: probe first (section 9), then the broker, then #85 as the first real plugin.
- Phase 3, theme: #86 and #87.
- Phase 4, guide. `apiVersion` 1 once 3-4 real features run on it [C design/analysis/issues-snapshot.md:5].

## 9. Weakest point, and the cheapest test

**Weakest point.** "Messages only, never `invoke`" is a property of the WebView2 runtime here, not of SnipMD's code. Three things must hold:
1. a blob worker inherits the page CSP;
2. a worker gets no Tauri init script;
3. Tauri refuses `http://ipc.localhost` without the invoke key.

All three are [J]. If (1) fails, the worker has no policy, and `eval` plus `fetch('https://…')` give a plugin the network. If (3) fails, a plugin can call `read_markdown_file` on every allowed note. The prelude's deletions are only a second line of defence: a plugin can reach `fetch` again through a nested realm the prelude missed [J].

**Cheapest test**: a probe plugin of about 20 lines, loaded by a throwaway branch in a release build on `windows-run.yml` (CSP active only there: docs/CONVENTIONS.md, Verification). Before the prelude runs, it tries each of:
- `eval('1')`
- `fetch('https://example.com')`
- `fetch('http://ipc.localhost/read_markdown_file', { method: 'POST', body: '{}' })`
- `typeof __TAURI_INTERNALS__`
- `importScripts('https://example.com/x.js')`

It posts each outcome to the page, which writes them to `perf.log` through `perf_mark` [C src/ipc.ts:112-114]. Pass means every line is refused or `undefined`. The same run measures memory with 5 tabs, 20 images and 5 idle probe workers against the 120 MB budget [C docs/SPEC.md:147]. That also answers #81's open question on worker memory [C design/analysis/issues-snapshot.md:7].

**Second weak point: the CSS layer.** The guard (`@layer core { .infobar-host, .infobar { display, visibility, opacity, position, z-index: … !important } }`) beats any theme rule, including `!important`, because important declarations in an earlier layer win [K: CSS cascade layers]. Re-serialising the theme from the browser's own parse (`CSSStyleSheet.replaceSync`, then each rule's `cssText`) stops a theme from closing the layer with a stray `}` (C5). The filter rejects `@import`, `@font-face` and any `url(` or `image-set(` that is not `data:`, because `img-src https:` would let a theme load remote images [C src-tauri/tauri.conf.json:27]. A guard still cannot stop a theme from setting `--info-bg` equal to `--text` and so hiding the bar's text.

Open for the owner:
- **(a) tokens-only themes.** Only `--*` declarations on `:root`, with values checked for contrast against the pairs in `contrast.test.ts`. Safe, but limited.
- **(b) full CSS with the guard.** Flexible, but a bar can still be made unreadable.

Cheapest test: a 3-rule hostile theme in `theme.test.ts` (jsdom parses CSS but does not cascade layers [J]), plus one screenshot from the same `windows-run.yml` run.
