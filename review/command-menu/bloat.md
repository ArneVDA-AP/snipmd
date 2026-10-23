# Bloat and overengineering review, PR #48 (branch cc/quirky-lovelace-ge5udo)

Lens: code size only. The features are as SPEC §4, §5, §7, §8, §10 fix them.
Scope: `git diff origin/main...HEAD`, production TS net +643 lines, CSS +65, tests +755.

Checks run from /home/user/snipmd: `npm run lint` exit 0; `npx vitest run` exit 0 (33 files, 512 tests);
`npx vite build --outDir <scratchpad>/dist` exit 0 (output removed afterwards).

## Verdict

About 640 net production lines is proportionate for these five features. Where the lines go:
- tab drag, titlebar.ts +99: pointer events with capture, Escape, pointercancel and the swallowed click.
  HTML5 drag and drop is not a shorter option here: `tauri.conf.json:22` sets `"dragDropEnabled": true`,
  and with that Tauri takes the webview's drag events for file drops (inferred from how Tauri works, not
  tested here).
- command menu with toggles: commandMenu 115, commands 34, settings 40, app +39. That covers a keyed bar,
  filtering, the arrows, aria, held-key handling and persistence.
- highlighting: codeLanguages 74 for ten lazy languages, used both in the editor and in read mode.
- read-mode extras: render +89, tasks 33. The per-render token is what SPEC §8 asks for: a note's own
  HTML can neither create the controls nor point them at its text.
- find count: search +58.

I found no abstraction tower, no framework-like layer and no large dead module. The excess is local:
one module with a single user, one key table written twice, a few guards for cases the callers rule out,
five tiny CSS files, a boolean return that only tests read, and some tests of guards rather than behaviour.

Realistic removal without losing SPEC behaviour: about 60 to 75 production lines (roughly 10%), plus about
40 test lines. The largest single item is about 22 lines. No blockers.

## Blockers

None.

## Majors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| B1 | major | src/app.ts:97-108 and 134-150 | Every key binding is written twice: once as the display string in `Command.keys`, once in `SHIFTED` plus the `commandFor` switch. Change one and the menu row silently shows a key that does something else, which breaks CLAUDE.md convention 1 (one source of truth). Shorter form: build a `Map` from normalised `c.keys` to `c.id` once in `startApp`, and keep only the real exceptions in `commandFor`: the `Ctrl+N` alias, the `Ctrl+F` gate in the editor, and `Ctrl+H` on macOS. **Saves about 8 to 10 lines.** Risk: medium. The macOS replace key is `Ctrl+Alt+F`, which `registerKeys` never sees because of the `e.altKey` early return, so that entry has to stay display-only. The app.test keyboard table covers this. | Quoted: `{ id: 'save-as', ..., keys: 'Ctrl+Shift+S', ...}` (l.100) next to `const SHIFTED = { s: 'save-as', t: 'reopen-tab', p: 'command-menu', pageup: 'tab-left', pagedown: 'tab-right' }` (l.134), and `case 's': return 'save';` (l.143) next to `keys: 'Ctrl+S'` (l.99). A third copy sits in `src-tauri/src/macos.rs` (`cmd("command-menu", "Command Menu…", "CmdOrCtrl+Shift+P")`). |

## Minors (ranked by lines saved)

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| M1 | minor | src/commands.ts:1-34, src/commandMenu.ts:12, src/app.ts:6,108,211,217, src/startup.test.ts:56, src/commands.test.ts | A module with one user. Only app.ts calls `initCommands`, `runCommand` and `listCommands`; commandMenu.ts imports only the type. The menu also gets a `run(id)` callback that looks a command up by id only to call `c.run()`, which the menu already holds. Shorter form: keep the `Map` as a local in app.ts, let the menu call `c.run()` itself (drop the `run` parameter), and move `Command` next to its consumer or into types.ts. The double-init and unwired guards go with it. **Saves about 22 production lines, 22 test lines and 1 mock line.** Risk: low. app.test "a menu command name runs through the registry" still covers the id path. | `grep -rn "initCommands\|listCommands\|runCommand" src` (non-test) matches only in src/app.ts and src/commands.ts. |
| M2 | minor | src/styles/{menu,code,tabs-drag,extras,find-count}.css, src/styles/main.css:1-7 | Five files of 2 to 21 lines each, each with a header comment, plus six `@import` lines and a comment in main.css. One `features.css`, or a section of main.css, holds the same rules. Also: `.cmdmenu-row:hover` and `.cmdmenu-row.selected` (menu.css:8-9) have the same body and can be one rule. `.read-view .code-copy:focus-visible` (extras.css:17) is already covered by `pre:focus-within`, because the button sits inside the `pre`. code.css repeats its scope ten times; `:is(.editor-pane .md-code-line, .read-view pre code) .tok-x` halves the selectors. **Saves about 9 to 10 lines.** Risk: none for behaviour; contrast.test reads only the tokens in main.css. | Diff of main.css: `@import './menu.css'; ... @import './find-count.css';`; menu.css lines 583-584 of the diff: `.cmdmenu-row:hover { background: var(--hover); }` and `.cmdmenu-row.selected { background: var(--hover); }`. |
| M3 | minor | src/editor/codeLanguages.ts:47-73 | `highlightCode` resolves to a boolean that no production caller reads, and it catches load failures that its only caller catches again. Shorter form: `Promise<void>`, no try/catch, early `return` for an unknown name. **Saves about 6 lines.** Risk: the three `toBe(true/false)` assertions in codeLanguages.test.ts change to DOM checks. render.test "keeps the block plain when highlighting rejects" already covers a rejection. | render.ts:154 `if (lang) highlightCode(code, text, lang).catch(() => {});` is the only call (grep). The return value is read only in codeLanguages.test.ts:12, 23, 32. |
| M4 | minor | src/titlebar.ts:209-210, 218, 227, 242, 251, 259 | Guards for cases that pointer capture or the caller rule out. `if (!rects.length) return;` (227) cannot happen, because `rects` maps `this.order`, which holds the dragged tab. The stale-drag cleanup in `onPointerDown` (209-210) and the `d.id !== el.dataset.id` checks (218, 242) cover a release that misses its tab, which `setPointerCapture` at the press prevents. `if (from >= 0)` (251) repeats `moveTab`'s own `from === -1` return. `else this.drag = null` (259) handles the dragged tab vanishing mid-drag. **Saves about 5 lines, plus the jsdom-only test "a press released off its tab leaves no drag behind" (about 10 lines).** Risk: low. The `?.` on `setPointerCapture` only exists for jsdom. | Quoted l.227 `if (!rects.length) return;` after l.224 `d.rects = this.order.map(...)`. tabs.ts moveTab: `if (from === -1 \|\| from === to) return;`. The test dispatches `pointerup` on `document.body`, which the webview cannot do while the tab holds capture. |
| M5 | minor | src/settings.ts:14, 22-23, 26-27, 35-39; src/app.ts:93 | `defaults()` duplicates `parseSettings(undefined)`. `onChange(key)` passes a key that the only callback (app.ts:242) ignores. `setSetting(key, value)` has one caller, which always passes `!getSetting(key)`, so `if (values[key] === value) return;` can never fire. `{ ...initial }` copies an object that parseSession has just built. Shorter form: `toggleSetting(key)`, `onChange: () => void`, `values = parseSettings(undefined)`. **Saves about 4 lines, plus the settings.test line "setting the same value reports nothing".** Risk: none. | Callers: app.ts:93 `run: () => setSetting(key, !getSetting(key))` is the only setSetting call; app.ts:242 `initSettings(..., () => { scheduleSessionSave(...); void refreshRead(); })` ignores the key. |
| M6 | minor | src/preview/render.ts:71-74 (copyButton) | The "Copied" text and its 1500 ms reset are not in SPEC §5, which only says the button "puts the block's text on the clipboard". **Saves 3 to 4 lines and one assertion.** Risk: the user loses the visible confirmation. This is a product call, not a defect. | SPEC.md:63 `each code block has a Copy button that puts the block's text on the clipboard.` |
| M7 | minor | src/preview/render.ts:88-89; src/preview/tasks.ts:26, 30 | `await import('./tasks')` splits a 0.47 kB chunk out of render.ts, which is itself loaded lazily. tasks.ts's only import, `ensureSyntaxTree`, is already in the startup chunk. A static import removes the await and the "read after the import" reasoning. In taskChange, `index < 0 \|\| index >= markers.length` cannot be true: `index` comes from the render's own counter, which is below `tasks`, and `tasks === rendered === markers.length` by the check before it. `mark !== '[ ]' && !isDone` cannot be true for a Lezer `TaskMarker`, which only matches `[ ]`, `[x]` and `[X]`. Shorter: `if (/^\[[xX]\]$/.test(mark) === checked) return null;`. **Saves about 4 lines, plus the test "returns null for an index outside the tasks" (3 lines).** Risk: low. | Build output: `assets/tasks-CNIchz_h.js 0.47 kB` next to `assets/render-HaUUzFQM.js 78.19 kB`. tasks.ts:26 `if (markers.length !== rendered \|\| index < 0 \|\| index >= markers.length) return null;` |
| M8 | minor | src/commandMenu.ts:31-37, 85 | `matches(all)` is a closure with one call site; it can sit inline in `rebuild`. `close?.()` in `choose` cannot be null while the menu is open. **Saves about 3 lines** (more if M1 also removes the `run` parameter). Risk: none. | Quoted l.49 `shown = matches(source());` is the only call. |
| M9 | minor | src/preview/render.ts:62-64, 123-126, 152-155 | `appElements` sorts its result (`mine.sort(...)`), but neither use depends on the order: both look up by `index`. The code renderer re-derives the fence's first word (`(lang ?? '').trim().split(/\s+/)[0]`), which `describe()` in codeLanguages.ts:33 already does. The block's `text` is also stored, although the sanitized `<code>`'s `textContent` is the same text. **Saves about 2 lines.** Risk: low. | Quoted render.ts `return mine.sort((a, b) => a.index - b.index);`; codeLanguages.ts:33 `/\S*/.exec(info.trim())![0]`. |
| M10 | minor | src/editor/search.ts:53-59 | `!current &&` is redundant, because only one match can equal the main selection. Putting the cap check before the current check (`if (++total > COUNT_CAP) break;`) removes the `current <= COUNT_CAP` test and the `capped` local. **Saves about 2 lines.** Risk: low. search.test "stops at 1000+" covers it. | Quoted l.53 `if (!current && m.from === from && m.to === to) current = total;` and l.59 `if (current && current <= COUNT_CAP)`. |
| M11 | minor | src/commands.ts:17, 33; src/settings.ts:25; src/tabs.ts (moveActive doc) | Comments that repeat the code ("Wired once from app.ts", "Every command, in the order app.ts registered them", "Moves the active tab one place left or right; it stops at either end"). **Saves about 4 lines.** Risk: none. | Quoted from the diff. |
| M12 | minor | src/editor/codeLanguages.test.ts:37-51 | The editor test calls `ensureSyntaxTree` three times, sleeps 50 ms twice and makes a dummy edit. One `vi.waitFor` on the `.tok-keyword` query does the same. **Saves about 5 test lines** and a timing dependency. | Quoted: `await new Promise((r) => setTimeout(r, 50));` appears twice. |
| M13 | minor | src/titlebar.test.ts "dropping on the right half of the second tab moves to index 2 (slot minus one when moving later)" | The test's name is wrong, and it covers the same branch as "dropping back in place". Tab c (index 2) dropped on b's right half gives slot 2, and `from < slot` is false, so nothing is subtracted. Both tests are no-op moves. The `from < slot` branch is covered only by "moving a tab right counts the slot after removing it". **Delete one test (about 6 lines).** | Arithmetic from titlebar.ts:229-249 with rects 0-100, 100-200, 200-300: x=180 gives i=1 and before=false, so slot 2; from=2, toIndex=2. |
| M14 | minor | src/commands.test.ts:15-21, src/settings.test.ts:27-31, src/tabs.test.ts "the snapshot carries the toggles" | These test wiring guards and implementation details (throw on double init, throw before init, the snapshot equals the defaults), and session.test's round-trip already covers the last one. **About 10 test lines.** | Quoted from the diff. |
| X1 | minor (outside this lens) | src/editor/codeLanguages.ts:33 | `matchLanguageName(..., true)` matches fuzzily, so names that are not on SPEC §5's list still get highlighted. SPEC §5 says "Other names show as plain code". | Node script against the same names and aliases: `"scss" -> CSS`, `"postcss" -> CSS`, `"jsonc" -> JSON`, `"sqlite" -> SQL`, `"cshell" -> Shell`, `"klingon" -> null`. |

## Considered and kept

- The pointer-based drag instead of HTML5 drag and drop: see the verdict.
- `idle()` in dom.ts with its `setTimeout` fallback: WKWebView on macOS has no `requestIdleCallback`, and the search plugin needs the cancel.
- `renderPane(tab, focus)`: two callers with different focus needs (switching tabs versus a render in place).
- The `rendered` count and the marker check in taskChange: they cover marked and Lezer disagreeing about which tasks exist, which SPEC §5 requires.
- The kept drag classes in `render()`: a re-render during a drag would otherwise drop them.
- The `moveTab` clamp: `moveActive` passes -1 and `length`.

## Totals

Production: B1 9, M1 22, M2 9, M3 6, M4 5, M5 4, M6 4, M7 4, M8 3, M9 2, M10 2, M11 4, so about 74 at most.
If M6 (a product call) and the riskier half of B1 are left out, the realistic figure is about 60 to 65.
Tests: about 40 to 45 lines.
