# Design (clean structure lens): command menu as the home of all options

Labels: [cited] file:line, [computed] with inputs named, [inferred] not read or not run. Open choices for the owner are marked OPTION.

## 1. Placement and UI

**Guardrail 13 answer (OPTION, owner decides).**
- A (recommended): the menu *is* an info bar. `commandMenu.ts` calls `showInfo({ kind: 'info', key: 'command-menu', position: 'top', body, onClose })`; `InfoMessage.body` already exists for this kind of feature control [cited src/types.ts:72-73, src/infobar.ts:70]. What you get for free: Esc dismissal [cited src/infobar.ts:86-90], focus going back to the note when the bar goes [cited src/infobar.ts:50-53], and F6 reaching it, because `focusInfobar` focuses the first `input` [cited src/infobar.ts:97]. SPEC §4's sentence "the only way the app shows information or choices" keeps holding, and §4 only gains a line. Cost: the bar stack shows only the newest entry [cited src/infobar.ts:31], so an unkeyed message that arrives while the menu is open hides it (risk 4).
- B: its own surface (a non-modal popover under the top bar, outside the info bar). This changes SPEC §4 and guardrail 13 ("no modals" stays true, but "the only way" does not). You get full control over stacking. You pay a second focus region in `cycleRegion` [cited src/app.ts:131-139], your own Esc and focus-return code, and a CLAUDE.md change.

**Look (both themes, tokens only).** The bar row holds a search icon and a plain input (`plainField` [cited src/dom.ts:16-21]) with placeholder "Type a command". Below it, a list panel is absolutely positioned under the bar, so the note does not jump. The host sits in normal flow between the title bar and the workspace [cited src/app.ts:44-46]. The panel uses `--control` background, a `--line-strong` border, `--r-lg` radius and at most 8 rows. A row shows the title on the left and its keys in `--text-muted` on the right (through `keys()` so macOS shows ⇧⌘P [cited src/platform.ts:16]). Toggles show a check icon and "on/off". The selected row uses `--pressed`. Every colour is an existing token in both themes [cited src/styles/main.css:32-93], and new pairs go into `contrast.test.ts`. There are no inline style strings: rules live in a CSS file, so the CSP nonce question does not arise (ROADMAP "Styles under Tauri's CSP").

**Keys and focus.** Ctrl+Shift+P (Cmd+Shift+P) opens the menu, or focuses it if it is open. ↑/↓ select. Enter closes the menu first and then runs the command, so focus is back in the note before a command such as Find moves it. A toggle runs and the menu stays open, with the new state shown. Esc closes. Blur closes. Click runs. ARIA: the input is `role=combobox` with `aria-activedescendant`, and the list is `role=listbox`. Filtering is a case-insensitive subsequence match on the title, with no dependency.
- Bug to fix on the way: `isBrowserKey` swallows every Cmd/Ctrl+P, including with Shift, before any command runs [cited src/app.ts:149, src/app.ts:164]. It must exempt Shift+P.
- macOS: add a View item "Command Menu… ⇧⌘P" that emits `menu-command` [cited src-tauri/src/macos.rs:92, :117]. `onMenuCommand` then runs it by id [cited src/app.ts:230].

## 2. Modules

| File | Owner of | New/changed |
|---|---|---|
| `src/commands.ts` | the registry: id, title, keys, run, toggle state | new |
| `src/settings.ts` | toggle values and their typed schema | new |
| `src/lazy.ts` | the lazy-load pattern (tagged cache, no retry) | new |
| `src/commandMenu.ts` + `src/styles/menu.css` | the menu UI | new |
| `src/code/languages.ts` | language descriptions with dynamic imports | new |
| `src/code/highlight.ts` | the `tok-*` class highlighter, shared by editor and read mode | new |
| `src/editor/features.ts` | Compartment for optional editor extensions | new |
| `src/editor/matchCount.ts` | find-panel counter (own chunk) | new |
| `src/preview/taskClicks.ts`, `src/preview/codeCopy.ts` | read-mode extras | new |
| `src/app.ts` | `COMMANDS` [cited :80-90] moves into registry entries built here; new keys; wiring | changed |
| `src/session.ts`, `src/types.ts` | `settings` field, parse | changed |
| `src/tabs.ts` | `moveTab`, `refreshRead`, reader via `lazy` [cited :230] | changed |
| `src/titlebar.ts` | pointer drag, `move` handler | changed |
| `src/editor/setup.ts`, `src/editor/registry.ts` | code-language parser, feature compartment; `stateIds()` | changed |
| `src/preview/render.ts` | `breaks`, highlighting, enhancer hook | changed |
| `src/icons.ts`, `src/styles/main.css` (tokens only), `src/styles/contrast.test.ts`, `package.json`, `src-tauri/src/macos.rs` | | changed |

```ts
// src/commands.ts: one path to run anything (keys, macOS menu, command menu)
export interface Command {
  id: string; title: string;
  keys?: string;                 // Windows notation, shown through keys()
  run: () => unknown;
  checked?: () => boolean;       // present = a toggle; the menu stays open after it runs
  hidden?: boolean;              // runnable by key or menu, not listed (go-to-tab-N)
}
export function initCommands(list: readonly Command[]): void;   // once, from app.ts; a second call throws
export function runCommand(id: string): void;                   // unknown id: no-op; an unwired registry throws
export function listCommands(): readonly Command[];             // visible ones, in registration order

// src/settings.ts: the only owner of toggle values
export const SETTINGS: { readonly [K in SettingKey]: { title: string; default: boolean } };
export type SettingKey = 'lineBreaks' | 'taskClicks' | 'codeCopy' | 'matchCount';
export type Settings = Record<SettingKey, boolean>;
export function initSettings(saved: Partial<Settings>, persist: () => void): void;
export function getSetting(k: SettingKey): boolean;
export function setSetting(k: SettingKey, v: boolean): void;    // notifies, then persist()
export function onSetting(k: SettingKey, fn: (v: boolean) => void): void;
export function settingsSnapshot(): Settings;
export function parseSettings(raw: unknown): Partial<Settings>; // lenient: unknown keys and non-booleans dropped
export function toggleCommands(): Command[];                    // one Command per key: `toggle:<key>`

// src/lazy.ts: one tagged entry per key (convention 1); a failure is kept, never retried (convention 10)
export type Entry<T> = { state: 'pending'; promise: Promise<T> } | { state: 'ok'; value: T } | { state: 'failed'; error: unknown };
export interface Lazy<T> { get(): Promise<T>; peek(): T | undefined; preload(): void; }
export function lazy<T>(load: () => Promise<T>): Lazy<T>;
export function lazyMap<K, T>(load: (key: K) => Promise<T>): { get(key: K): Promise<T>; peek(key: K): T | undefined };

// src/commandMenu.ts
export function initCommandMenu(source: () => readonly Command[], run: (id: string) => void): void;
export function openCommandMenu(): void;

// src/code/languages.ts (main bundle: names and import thunks only)
export const CODE_LANGUAGES: readonly LanguageDescription[];        // LanguageDescription.of({ name, alias, load })
export function codeParser(info: string): Parser | null;            // loaded: its parser; not yet: ParseContext.getSkippingParser(load)
export function loadLanguage(info: string): Promise<Language | null>; // for read mode; null when unnamed or failed
// src/code/highlight.ts
export const codeClasses: Highlighter;                               // tagHighlighter: tags.keyword → 'tok-keyword', ...
export function highlightInto(target: HTMLElement, code: string, lang: Language): void; // textContent spans only

// src/editor/features.ts
export type EditorFeature = 'matchCount';
export function featureExtension(): Extension;                       // the compartment with the current value, for new states
export function setEditorFeature(f: EditorFeature, ext: Extension | null): void; // reconfigures every state through applyToTab
// src/editor/registry.ts (added)
export function stateIds(): string[];
// src/editor/matchCount.ts (own chunk)
export function matchCountExtension(): Extension;

// src/preview/render.ts (changed)
export interface ReadOptions { breaks: boolean; enhancers: readonly ReadEnhancer[]; }
export type ReadEnhancer = (article: HTMLElement, ctx: { tabId: string; source: string }) => void;
export async function renderRead(tabId: string, content: string, opts: ReadOptions): Promise<HTMLElement>;
// src/preview/taskClicks.ts, src/preview/codeCopy.ts
export const taskClicks: ReadEnhancer;
export const codeCopy: ReadEnhancer;
// src/tabs.ts (added)
export function moveTab(id: string, toIndex: number): void;          // index among open tabs; ends in changed({ immediate: true })
export function refreshRead(): Promise<void>;                        // re-renders the active tab if it is in read mode
// src/titlebar.ts: TitlebarHandlers gains
move: (id: string, toIndex: number) => void;
```
Wiring stays in app.ts, from the root (convention 8). app.ts builds `[...appCommands, ...toggleCommands()]`, then calls `initCommands`, `initCommandMenu(listCommands, runCommand)` and `initSettings(saved, () => scheduleSessionSave({ immediate: true }))`. It also registers `onSetting` listeners: `lineBreaks` and the read extras call `refreshRead`, and `matchCount` loads its chunk and calls `setEditorFeature`. `commandFor` returns ids, and every source runs them through `runCommand`.

## 3. State and persistence

- **Toggles go in session.json** (guardrail 6, and ROADMAP already says so). `SessionFile` becomes `{ version: 4, …, settings: Settings }`. OPTION: keep `version: 3` and add an optional field. Either works the same way in practice, because `parseSession` never reads `version` [cited src/session.ts:205-229]. I recommend 4 so the file says what it holds.
- **Rust needs no change.** It reads the session as an untyped `Value` and edits only tabs [cited src-tauri/core/src/session.rs:1-4, src-tauri/src/lib.rs:409-431], so an added field survives [inferred: `drop_unallowed` writes the Value back whole; I did not read its body].
- **Migration of a v3 file.** No `settings` means every value takes its default. Downgrading to 1.0.0: that build parses the file fine and drops `settings` on its next write [inferred from session.ts:223-229]. The cost is lost toggles, never tabs.
- **Settings get parsed before the tab check.** `parseSession` returns null when there are no tabs [cited src/session.ts:216]. `loadSession` will return `{ session, settings, setAside }`, so settings survive a file whose tabs are all unusable.
- **The session gets one source.** Today `startSessionWrites` binds `snapshot` from tabs.ts [cited src/tabs.ts:53-55, :162-167]. Clean version: `bindSessionSource(() => ({ ...tabsSnapshot(), settings: settingsSnapshot() }))` is composed in app.ts, so tabs.ts stops knowing the file shape. If the session is unreadable, this run writes nothing [cited src/app.ts:215-216]. Toggles then still apply in memory but do not persist. The existing error bar already says so.
- **Tab order needs no schema change.** The snapshot keeps strip order [cited src/tabs.ts:164] and restore keeps it [cited src/tabs.ts:192]. `moveTab` reorders open tabs inside `tabs` (closed ones stay where they are) and ends in `changed()` (convention 3).

## 4. How items 2-5 plug in

**2 Line breaks.** `renderRead` passes `breaks: opts.breaks` to the `Marked` it already builds per render [cited src/preview/render.ts:51]. Toggling it calls `refreshRead()`. Nothing new loads.

**3 Syntax highlighting.**
- *Editor.* `markdown()` would statically import `@codemirror/lang-html` [cited node_modules/@codemirror/lang-markdown/dist/index.js:6, :402], so instead setup.ts builds `new Language(markdownLanguage.data, markdownLanguage.parser.configure([parseCode({ codeParser })]), [], 'markdown')` [constructor cited node_modules/@codemirror/language/dist/index.d.ts:110-120; `parseCode` d.ts:542-551]. This replaces `markdownLanguage` at setup.ts:37. `codeParser` returns `ParseContext.getSkippingParser(desc.load())` [cited d.ts:280] for a language that has not loaded yet, so CodeMirror re-parses when the import resolves [inferred from CodeMirror's docs; needs a spike]. This adds `@lezer/markdown` as a direct dependency (installed now, transitively).
- *Colours.* `syntaxHighlighting(codeClasses)`, with `tok-*` colours as tokens in main.css scoped to `.md-code-line` and `.read-view pre`. One palette for both panes, contrast-tested.
- *Read mode.* `walkTokens` awaits `loadLanguage(token.lang)` for code tokens, the same way it awaits images [cited render.ts:54-56]. The sanitizer strips every class [cited render.ts:19-21], so highlighting runs after sanitizing. The renderer marks `<pre data-code="i">` (added to `ADD_ATTR` like `data-own` [cited :41]), and `highlightInto` rebuilds that block from the token's own text with textContent spans. A forged mark from note HTML can only re-show the note's own code.
- *Loading.* One dynamic import per pack, cached by `LanguageDescription.load` or `lazyMap`. A failed load leaves the block plain for the run.
- *Sizes measured from node_modules, min+gzip -9* [computed with gzip on dist/index.js]: lang-javascript 5.9 KB + @lezer/javascript 30.3 KB; lang-css 5.4 + @lezer/css 8.5; lang-html 7.0 + @lezer/html 7.3 (it also pulls in js and css). Python, Rust, JSON, SQL, shell and `@codemirror/language-data`: unmeasured (not installed).
- OPTION, which languages: (a) a curated list of about 10 `@codemirror/lang-*` packages; (b) `@codemirror/language-data` with about 150 entries, whose many legacy-mode chunks grow the installer (unmeasured; the budget is 10 MB, now 1.37 MB [cited ROADMAP.md]).
- OPTION: highlighting always on, which matches the owner's wording, or a toggle.

**4 Tab order.**
- *Drag.* titlebar.ts drags with pointer events (pointerdown, then a 4 px threshold, pointermove, pointerup) and calls `h.move(id, index)`. It does not use HTML5 drag and drop: Tauri's window drop handler, which `files-dropped` relies on, takes over drag events in the webview [inferred; confirm on Windows]. `render` already re-orders the DOM by id [cited src/titlebar.ts:158-163].
- *Keys.* Ctrl+Shift+PageUp/PageDown become commands `move-tab-left`/`move-tab-right`. OPTION: whether a held key repeats, like tab switching [cited src/app.ts:172], or acts once. On macOS it is Cmd+Shift+PageUp, and fn+↑ on laptops (§13).

**5 Extras.** Each is a toggle whose `onSetting` listener loads what it needs.
- *Match counter.* A real lazy chunk, since the editor is in the main bundle. `matchCount.ts` (a ViewPlugin) is loaded with `lazy()` and switched on through the `features.ts` Compartment for every state [`applyToTab` works on hidden states, cited registry.ts:102-112]. It counts with `SearchCursor` when the query changes and debounced after doc changes, capped at "1000+", so the work is not O(document) per keystroke (convention 2). It puts a `<span>` into `.cm-search`, as `panelSetup` does [cited search.ts:29-35].
- *Clickable checkboxes and copy button.* They live in the preview chunk, which is already lazy [cited tabs.ts:230-236]. A chunk of their own, about 1-2 KB [inferred], would cost a request for nothing.
- *Checkboxes in detail.* The enhancer removes `disabled`. It pairs the nth rendered task checkbox with the nth GFM `TaskMarker` in the tab's syntax tree, and if the two counts differ it leaves every box read-only (risk 2). A click goes through `applyToTab(tabId, …)` to write `[x]` / `[ ]` (convention 4), and autosave follows.
- *Copy button in detail.* `button()` from dom.ts [cited dom.ts:3-12] is placed on each `pre` after sanitizing, and it copies the code text with `navigator.clipboard.writeText` [inferred to work in WebView2 and WKWebView on a click; needs a Windows and Mac test]. It reports a failure through `showError`.

## 5. SPEC changes (before code)
- §4: add the command menu: where it shows, its non-modal behaviour and the info-bar rule (option A adds a line; option B also rewrites "the only way").
- §5: syntax highlighting in code blocks in both modes, loaded per language; the line-break toggle; clickable task boxes, the copy button and the match counter as toggles with their defaults (OPTION: the extras' defaults, on or off).
- §7: the session also holds settings, and tab order is kept.
- §10: Ctrl+Shift+P; Ctrl+Shift+PageUp/PageDown; dragging a tab.
- §12: v1-in gains the command menu and its toggles; the "deliberately out" note on settings stays.
- §13: ⇧⌘P, the View menu item, and PageUp on Mac keyboards.

## 6. Units (disjoint files)
| Unit | Files | Depends | Size |
|---|---|---|---|
| U0 foundation (coordinator) | commands.ts, settings.ts, lazy.ts, types.ts, session.ts, editor/features.ts, editor/registry.ts, setup.ts (compartment line only), main.css tokens and `@import`s, contrast.test.ts, + tests | none | ~300 lines |
| U1 menu | commandMenu.ts, styles/menu.css, icons.ts (check, search), test | U0 | ~220 |
| U2 tab order | tabs.ts, titlebar.ts, styles/tabs-drag.css, tests | none | ~170 |
| U3 highlighting + line breaks | code/languages.ts, code/highlight.ts, setup.ts, preview/render.ts (incl. `ReadOptions` and the enhancer hook), styles/code.css, package.json, tests | U0 | ~280 |
| U4 read extras | preview/taskClicks.ts, preview/codeCopy.ts, styles/extras.css, tests | U0 (`ReadEnhancer` type) | ~180 |
| U5 match counter | editor/matchCount.ts, test | U0 | ~110 |
| U6 integrator | app.ts, macos.rs, ARCHITECTURE.md, ROADMAP.md | all | ~150 |

SPEC.md goes in before U0, from the coordinator. Per-unit CSS files `@import`ed from main.css keep the units disjoint, with the tokens kept in main.css for the contrast test [inferred: Vite inlines `@import`].

**What clean costs over a minimal design** [computed estimate]:
- About 200 to 250 more lines and one more unit (U0).
- `lazy.ts` (about 40 lines) and `features.ts` (about 50) serve one or two callers today. They can be deferred: the match counter can use a plain `import()` with a module-level promise.
- The `onSetting` listener API could be deferred too, with app.ts calling `refreshRead` directly.
- Moving `COMMANDS` into `commands.ts` (about 60 lines plus tests) is the part not worth deferring, because the menu, the keys and the macOS menu need the one path.
- Start budget: the main bundle grows only by the registry, settings, the menu and the language name table, about 6 to 10 KB raw [inferred]. The menu DOM is built on first open. OPTION: make `commandMenu.ts` a lazy chunk too.

## 7. Risks (ranked)
1. **Ctrl+Shift+P is swallowed** by `isBrowserKey` [cited app.ts:149]. Test: an app.test keydown opens the menu, and Ctrl+P is still blocked.
2. **A checkbox click writes the wrong task**, because marked and Lezer disagree (raw HTML inputs, tasks in quotes or HTML blocks). Test: fixture notes with those cases. Mismatched counts must leave the boxes read-only, and a click changes exactly one `[ ]` at the expected offset.
3. **Parsers end up in the startup bundle.** Test: after `npm run build`, a check fails if the main chunk contains `@lezer/javascript` code or grows more than 15 KB over the current 405,529 bytes [measured from dist/assets/index-20KEB5gl.js, build date unknown].
4. **The menu is hidden by a newer unkeyed bar**, or loses focus. Test: an infobar test opens the menu, calls `showError`, and expects the menu closed (blur) or still on top, with focus back in the note.
5. **The language reparse never happens** after a lazy load (the `getSkippingParser` assumption). Test: an editor test with a stubbed slow loader expects `tok-keyword` spans after it resolves.
6. **Settings are lost** with an unusable tab list, or set to defaults when the session is unreadable. Test: session.test parses `{tabs: [], settings: {...}}` and keeps the settings.
7. **Dragging a tab breaks file drop**, or does nothing under Tauri. Test: a jsdom pointer-event test for `move`. Windows test: drag a tab, then drop a .md on the window.
8. **The match counter costs time on large notes.** Test: a perf.test with a 1 MB doc; a keystroke does no count until the debounce fires.
9. **Copy is blocked in the webview.** Windows and Mac tests: copy, paste into Notepad, and a failure shows the error bar.
10. **A failed language load is retried on every render** (convention 10). Test: a `lazy` test where a rejected loader is called once.
