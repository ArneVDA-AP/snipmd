# Design, minimal-change lens: command menu, line breaks, code highlighting, tab order, extras

Labels: [cited file:line], [computed: inputs], [inferred: what would confirm it]. Sizes measured with rolldown 1.2.14 from the repo's node_modules, minified, shared CodeMirror/Lezer packages external.

## 1. Placement and UI of the command menu

**The menu is an info bar.** It is a keyed top bar (`key: 'command-menu'`) whose `body` holds a filter field and a list. `InfoMessage.body` exists for exactly this (feature controls after the text, built with DOM APIs) [cited src/types.ts:403-404], and the first-save form already works this way [cited src/styles/main.css:183-189]. No infobar.ts change is needed.
- Guardrail 13 answer: it stays inside the info bar, so SPEC §4 ("the only way the app shows information or choices") holds. The SPEC change is one item added to §4's list of uses. Trade-off: the bar sits in the layout flow [cited src/app.ts:43-51], so while the menu is open the note moves down by the list's height (at most 6 rows, about 200 px). An overlay would avoid that shift, but it is a popup, which needs the owner to change §4's wording. Both options are open. This design takes the in-bar one.
- Look: the bar uses the info bar tokens (`--info-bg`, `--line`) [cited src/styles/main.css:161]. The field is styled like `.firstsave-name` [cited src/styles/main.css:185]. Rows use `--hover` for the selected row and `--text-muted` for the key hint. These tokens are already in contrast.test.ts in both themes [cited src/styles/contrast.test.ts:30-35]. The bar's empty text span is hidden with `.infobar:has(> .menu-body) .infobar-text { display: none }`. `:has` is already in use [cited src/styles/main.css:251].
- Keys: `Ctrl+Shift+P` (macOS `⇧⌘P`) opens the menu, and pressing it again closes it. Up and Down move the selection. Enter runs the selected item. Typing filters (every word must be a substring of the label, case-insensitive). Esc closes the menu through the bar's own Escape handler [cited src/infobar.ts:321-326], and focus goes back to the note because `remove` calls `returnFocus` when the bar held focus [cited src/infobar.ts:286-289]. A mousedown on a row is prevented, so focus stays in the field (the same trick as search.ts:93-97).
- F6 needs no change: `focusInfobar` focuses the newest top bar's first `input` [cited src/infobar.ts:331-340].
- Commands close the menu and then run, so Find and the other commands get focus from the note. Toggles flip, the menu stays open and the row's check mark updates. Open option: toggles could close the menu too.
- Rows show a check mark for toggles (`role=option`, `aria-checked`) and the key hint through `keys()` [cited src/platform.ts:20].
- **A key already gets eaten:** `isBrowserKey` prevents every Ctrl+P, including Ctrl+Shift+P, and `registerKeys` returns before command dispatch [cited src/app.ts:149, src/app.ts:164]. The menu key must be matched before that check.

## 2. Modules

| File | New / changed | What |
|---|---|---|
| src/settings.ts | new | Owner of toggle state |
| src/commandMenu.ts | new | Menu as info-bar body |
| src/editor/codeLanguages.ts | new | Language list, lazy loaders, markdown code parser |
| src/preview/tasks.ts | new (lazy chunk) | Task index to source edit |
| src/types.ts | changed | `Settings`, `SessionFile.settings` |
| src/session.ts | changed | `parseSettings` in `parseSession` |
| src/tabs.ts | changed | snapshot adds settings; `moveTab`, `refreshRead` |
| src/titlebar.ts | changed | pointer drag; `TitlebarHandlers.move` |
| src/editor/setup.ts | changed | markdown language with `parseCode`; `classHighlighter` |
| src/editor/search.ts | changed | match counter |
| src/preview/render.ts | changed | `breaks`, code highlight, copy button, task checkboxes |
| src/app.ts | changed | keys, menu items, wiring |
| src/styles/main.css, contrast.test.ts | changed | menu, tokens `--tok-*`, copy button, drop marker |
| package.json | changed | direct deps for parsers already in node_modules |

```ts
// src/types.ts
export interface Settings { lineBreaks: boolean; taskClicks: boolean; copyCode: boolean; findCount: boolean }
export interface SessionFile { version: 3; /* existing fields */ settings: Settings }

// src/settings.ts  (imports only types: no cycle with session.ts or tabs.ts)
export const DEFAULT_SETTINGS: Readonly<Settings>;
/** Wired once from app.ts; setSetting before init throws. */
export function initSettings(initial: Settings, onChange: (key: keyof Settings) => void): void;
export function getSettings(): Readonly<Settings>;
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;

// src/commandMenu.ts
export interface MenuItem { id: string; label: string; keys?: string; checked?: () => boolean; run: () => unknown }
/** Opens the menu in the top info bar, or closes it when open. `items` is read on each open. */
export function toggleCommandMenu(items: () => readonly MenuItem[]): void;

// src/editor/codeLanguages.ts
export const CODE_LANGUAGES: readonly LanguageDescription[];
export function codeLanguage(info: string): LanguageDescription | null; // matchLanguageName(CODE_LANGUAGES, info, true)
/** For parseCode(): a loaded parser, or a skipping parser that loads it and makes CodeMirror reparse. */
export function codeParser(info: string): Parser | null;

// src/preview/tasks.ts
/** The change that sets task `index` (document order) to `checked`, or null when the source and the rendering disagree. */
export function taskChange(state: EditorState, index: number, rendered: number, checked: boolean): ChangeSpec | null;

// src/tabs.ts (added)
export function moveTab(id: string, toIndex: number): void; // index among open tabs; ends in changed()
export function moveActive(delta: 1 | -1): void;            // stops at the ends
export function refreshRead(): Promise<void>;               // re-renders the active tab if it is in read mode

// src/preview/render.ts (signature change)
export async function renderRead(tabId: string, content: string, opts: Readonly<Settings>): Promise<HTMLElement>;

// src/editor/search.ts (added)
export function refreshFindCount(view: EditorView | null): void;

// src/titlebar.ts
export interface TitlebarHandlers { /* existing */ move: (id: string, toIndex: number) => void }
```

## 3. State and persistence

- **Toggles:** they live in `settings.ts` (one owner, convention 8) and persist as `session.json` field `settings: { lineBreaks, taskClicks, copyCode, findCount }`. `tabs.snapshot()` adds `settings: getSettings()` next to `lastFolder` [cited src/tabs.ts:162-168]. app.ts calls `initSettings(session?.settings ?? DEFAULT_SETTINGS, onChange)` before `restore`, so a tab restored in read mode renders with the right options [cited src/app.ts:208]. `onChange` schedules a session save and calls `refreshRead()` or `refreshFindCount()`.
- **Migration:** `parseSession` already ignores `version` and always returns 3 [cited src/session.ts:324-325]. `parseSettings(d.settings)` takes each key that is a boolean and falls back to the default otherwise, so a v3 file without `settings` gets the defaults. Rust passes unknown fields through: load only checks that the file is JSON [cited src-tauri/src/lib.rs:409], and save edits a `serde_json::Value` [cited src-tauri/src/lib.rs:427-432]. No Rust change. Open option: bump to `version: 4`. Nothing reads the version, so the bump would only label the file. The cost of staying on 3 is that downgrading to 1.0.0 drops the settings on its first write, and nothing else is lost.
- Edge: `parseSession` returns null when there are no tabs [cited src/session.ts:317], and then the settings fall back to the defaults. A written session always has an open tab (closeTab opens a new untitled tab when the last one closes, src/tabs.ts:372) [inferred: a test that parses a tabs-empty file would confirm].
- **Tab order** needs no new state. `tabs` is kept "in strip order" [cited src/tabs.ts:36], snapshot writes `getTabs()` in that order [cited src/tabs.ts:164], and restore keeps it [cited src/tabs.ts:177-192]. `moveTab` reorders `tabs` and ends in `changed({ immediate: true })`. Ctrl+1..9 follow automatically [cited src/app.ts:106]. Cost: a reopened closed tab goes to the end [cited src/tabs.ts:400-402] and does not return to its old place. Keeping its place would need an index per closed tab (about 10 lines, open option).
- Defaults: line breaks off (owner). For the three extras, owner said "optional" and set no default. This design assumes off. The other options are on, or on only for copy.

## 4. How items 2-5 plug in

**Line breaks.** `renderRead` already builds a new `Marked` on every render [cited src/preview/render.ts:180], so the change is to pass `breaks: opts.lineBreaks` there. A toggle calls `refreshRead()`, which goes through `activate` (that keeps scroll [cited src/tabs.ts:280-283]). No lazy code. It lives in the render chunk that is already lazy [cited src/tabs.ts:230].

**Code highlighting.**
- Writing: setup.ts avoids `markdown()` on purpose [cited src/editor/setup.ts:32-37]. `markdown()` uses `html()` as the default for `htmlTagLanguage`, which pulls lang-html, lang-css and lang-javascript into the startup bundle [cited node_modules/@codemirror/lang-markdown/dist/index.js:6, :402, :407]. The minimal path keeps that boundary: `new Language(markdownLanguage.data, markdownLanguage.parser.configure(parseCode({ codeParser })), [], 'markdown')` with `parseCode` from `@lezer/markdown` [inferred: `Language.data` is public in @codemirror/language 6.13; a unit test that list keys still work would confirm]. `codeParser` returns `ParseContext.getSkippingParser(desc.load())` until a language has loaded, which is the same thing lang-markdown does [cited lang-markdown/dist/index.js:86], and CodeMirror reparses when the language arrives.
- Colours: `syntaxHighlighting(classHighlighter)` from `@lezer/highlight` [cited exported, checked with node] gives `tok-*` classes. CSS in main.css styles only code tags (`tok-keyword`, `tok-string`, `tok-comment`, `tok-number`, `tok-typeName`, `tok-variableName2`, `tok-propertyName`). It does not style `tok-meta` or `tok-punctuation`, which the Markdown marks also use. The CSS is static, so nothing is injected at run time, the CSP and its nonce are not involved, and the same classes serve read mode.
- Reading: a `code` renderer emits `<pre><code data-code="N-i">` with escaped text. `N` is a random per-render token, so a note's raw HTML cannot point at a block. The attribute is added to `ADD_ATTR`, as `data-own` is [cited src/preview/render.ts:170]. After sanitizing, each block whose language `codeLanguage()` finds is loaded, parsed with `support.language.parser`, and filled with `highlightCode(...)` as spans built with `textContent` and `className`, on the clean DOM.
- Lazy boundary: each `load` is `() => import('@codemirror/lang-x').then(({ xLanguage }) => new LanguageSupport(xLanguage))`.
- Measured chunks: JS/TS/JSX 80.0 KB min / 31.5 KB gz; CSS 17.6 / 8.3; HTML 120.9 / 48.5 (it embeds JS and CSS); `@lezer/lr` 27.1 / 8.8 as a shared lazy chunk (not in the startup bundle today: lang-markdown and @lezer/markdown do not import it [computed: grep of both dist files]). [computed: rolldown, /tmp/claude-0/-home-user-snipmd/36e9a9a5-0d74-5063-a0ab-ee24704ae997/scratchpad/sizes/m.mjs]
- Startup cost: the descriptions list plus `codeParser` [inferred: under 2 KB; a build diff would confirm]. Current bundle for reference: index 405.5 KB, render chunk 76.4 KB [cited dist/assets, build of 2026-10-23 13:06].
- Languages: those three are installed and only need declaring in package.json. Python, JSON, Rust, SQL, YAML, shell and others need new `@codemirror/lang-*` or `legacy-modes` packages, all unmeasured. Open option: `@codemirror/language-data` (every language, lazy), with size and install growth unmeasured. The owner picks the list.

**Tab order.**
- Keys: `commandFor`'s shift branch [cited src/app.ts:111] gains `pageup` and `pagedown`, which call `moveActive(∓1)`. A held key acts once under the existing repeat rule [cited src/app.ts:172]. Open option: let it repeat like tab switching (SPEC §10 line 156).
- Drag: pointer events in titlebar.ts (`pointerdown`, then past 4 px `setPointerCapture`, a `.drop-before`/`.drop-after` marker on the target tab, and on `pointerup` `h.move(id, index)`; the click after a drag is swallowed). It does not use HTML5 drag and drop, because `dragDropEnabled: true` [cited src-tauri/tauri.conf.json:22] lets Tauri take OS drag events on Windows [inferred: the Windows test in §7 confirms]. `render` already reorders the DOM and keeps focus [cited src/titlebar.ts:158-163]. The existing mousedown `preventDefault` [cited src/titlebar.ts:126] does not block pointer events.
- Cost of minimal: no auto-scroll of a full strip while dragging (about 20 lines later).

**Extras.** The read-mode extras sit in the lazy render chunk, so they add nothing at startup.
- Copy button: after sanitizing, if `copyCode` is on, each app-made `pre` gets `button('code-copy', ...)` from dom.ts [cited src/dom.ts:3]. It copies the token's text with `navigator.clipboard.writeText`, and a failure goes to `showError` [inferred: clipboard permission in WebView2 and WKWebView; Windows and Mac tests].
- Checkboxes: a `checkbox` renderer [cited marked.d.ts:189] emits `data-task="N-i"`. With `taskClicks` on, `disabled` is removed. A delegated click handler imports `./tasks` and calls `taskChange(getState(tabId), i, rendered, checked)`. `taskChange` walks `TaskMarker` nodes from `ensureSyntaxTree`, refuses the edit when its count differs from the rendered count or when the marker text does not match the box's old state, and otherwise returns a one-character change. The handler applies the change with `applyToTab(tabId, …)`, which binds it to the tab (convention 4), and the tab turns dirty and autosaves through `notifyChange` [cited src/editor/setup.ts:65-67]. A refusal unchecks the box again and shows an info bar. Every shown tab has a state [cited src/tabs.ts:199-210].
- Match counter: search.ts's `panelSetup` [cited src/editor/search.ts:99-105] appends `<span class="cm-search-count">` when `findCount` is on. An update listener schedules an idle count on a doc or query change while the panel is open (`getSearchQuery(state).getCursor(state)`, capped at 1000 and shown as "1000+"). Nothing is counted per keystroke inline (convention 2). The counter stays in the main bundle: lazy-loading it would need a `Compartment` in every tab state [inferred: under 1 KB].

## 5. SPEC changes

- §4: the info bar's uses gain "command menu (`Ctrl+Shift+P`): a filter field and a list of commands and toggles". Tabs: "drag a tab to move it".
- §5: fenced code is highlighted in writing and reading, and a language loads the first time a block names it. Read mode gets the line-break toggle, clickable task boxes and a copy button. Find gets a match counter.
- §7: session contents add "settings (toggles)", and open tabs are kept "in strip order".
- §8: controls in read mode (copy button, task box) are the app's, added after sanitizing. A note cannot create or address them.
- §10: rows for `Ctrl+Shift+P` and `Ctrl+Shift+PageUp/PageDown` (move tab).
- §12: v1 scope adds the command menu and its toggles. A settings screen stays out.
- §13: `⇧⌘P`. Open option: a View menu item "Command Menu…", which needs Rust in macos.rs:90-92.

## 6. Units (files disjoint)

| Unit | Files | Depends on | Size |
|---|---|---|---|
| U0 foundation (main session) | types.ts, settings.ts (+test), session.ts (+test), tabs.ts (+test: moveTab, refreshRead, snapshot), main.css, contrast.test.ts, SPEC.md | none | ~170 lines |
| U1 command menu | commandMenu.ts, commandMenu.test.ts | U0 (CSS classes) | ~120 + 90 test |
| U2 editor highlighting | editor/codeLanguages.ts, editor/setup.ts, package.json, codeLanguages.test.ts | U0 | ~70 + 60 |
| U3 read mode | preview/render.ts, render.test.ts | U0, U2 (signature only) | ~110 + 120 |
| U4 task mapping | preview/tasks.ts, tasks.test.ts | none | ~50 + 100 |
| U5 tab drag | titlebar.ts, titlebar.test.ts | U0 | ~70 + 70 |
| U6 match counter | editor/search.ts, search.test.ts | U0 | ~45 + 50 |
| U7 integration | app.ts, app.test.ts, integration.test.ts, ARCHITECTURE.md, ROADMAP.md | all | ~70 + 80 |

U1 to U6 run in parallel after U0. U3 imports U2 and U4 by the signatures in §2.

## 7. Risks, ranked

1. **The wrong task box is written.** marked and Lezer could disagree on what counts as a task (in quotes, nested lists, lazy continuation, HTML blocks). Test: tasks.test.ts runs fixtures through both parsers, checks that the counts agree, and checks that a mismatch returns null and leaves the source unchanged.
2. **Ctrl+Shift+P is swallowed by `isBrowserKey`** [cited src/app.ts:149]. Test: app.test.ts dispatches the keydown and expects the `command-menu` bar.
3. **A newer unkeyed bar covers the open menu.** The menu's DOM leaves the host and focus falls to body [cited src/infobar.ts:266-274], and the menu comes back later. Test: open the menu, call `showError`, and assert where focus is and that Esc on the error brings the menu back with its filter. Decide whether that return is wanted.
4. **Parsers leak into the startup bundle**, through a static import or by calling `markdown()`. Test: a build check that the entry chunk contains no `javascriptLanguage`/`cssLanguage` and grows less than 3 KB.
5. **The custom markdown `Language` changes behaviour** (lists, `pasteURLAsLink`, highlighting). Test: the existing lists, mdStyle and paste suites run on the new setup, plus a test that a fenced `js` block gets `tok-keyword` after its load resolves.
6. **Highlight colours miss AA in one theme.** Test: add `tok-*` pairs over `bg` and `code-bg` to contrast.test.ts.
7. **Tab drag fights click, middle-click or the strip's wheel scroll.** HTML5 drag would be eaten by Tauri. Test: synthetic pointer events in titlebar.test.ts. Windows test: drag tab 3 before tab 1, restart, and see the order kept.
8. **The counter is costly on large notes.** Test: a 1 MB doc with the panel open where 50 keystrokes run one count (spy) and the cap holds.
9. **Clipboard write is denied in the webview.** Windows and Mac test: click Copy, paste into Notepad or TextEdit, and on failure expect an error bar, never silence.
10. **Forged `data-code` or `data-task` in note HTML.** Test: render.test with raw HTML carrying those attributes, expecting no highlight, no live box and no write.
