# Sandbox prototype (does not merge)

Measures what a plugin sandbox costs and what it can reach, in Chromium 153 (Playwright, headless, Linux). WebView2 uses the same engine, but its process model and flags may differ, so the Windows numbers come from the runner (plan phase P0).

Run: `node server.cjs &` then `node measure.cjs`, `node probe.cjs`, `node busy.cjs` (with `NODE_PATH=$(npm root -g)`).

`server.cjs` serves a page under SnipMD's release CSP (`src-tauri/tauri.conf.json`, nonce instead of Tauri's injected one, `connect-src 'self'` standing in for `ipc:`), with variants: `cur` (unchanged), `worker` (+ `worker-src blob:`), `iframe` (`frame-src 'self'`).

## Results (2026-10-31)

Memory: increase in the browser's total PSS after spawning, 3 runs each (`results.json`).

| Sandbox | 1 | 3 | 5 | Spawn to first reply | Renderer processes |
|---|---|---|---|---|---|
| Worker per plugin (blob) | 6.9-7.2 MB | 12.5-12.7 MB | 17.7-18.0 MB | 7-27 ms | 1 |
| Sandboxed iframe, srcdoc | 4.1-4.3 MB | 6.5-7.0 MB | - | 8-26 ms | 1 |
| Sandboxed iframe, src | 4.4-4.7 MB | 6.9-7.0 MB | - | 10-20 ms | 1 |

So: a first worker about 7 MB, each further one about 2.7 MB; a first iframe about 4.3 MB, each further one about 1.3 MB.

Main thread while the plugin runs a 1.5 s busy loop (longest gap of a 10 ms interval in the page, `busy.cjs`):

| Sandbox | Longest gap |
|---|---|
| Worker | 14 ms |
| Sandboxed iframe (srcdoc or src) | 1501 ms |

A sandboxed iframe stays in the page's renderer process here, so it shares the editor's main thread: a slow or hostile plugin freezes typing. A worker does not.

Reach (`probe.cjs`):

| From | `fetch https:` | fetch the page's own origin | `importScripts` remote | nested Worker | parent DOM | `__TAURI_INTERNALS__` |
|---|---|---|---|---|---|---|
| Blob worker | blocked (CSP) | **allowed** (inherits the page's `connect-src`) | blocked | allowed | none | undefined |
| Sandboxed iframe | blocked | - | - | - | blocked, origin `null` | - |

Under the current CSP (no `worker-src`), creating a blob worker is refused: `worker-src` falls back to `script-src 'self'`.

The worker reaching what the page may connect to means, in the app, it can send a request to `http://ipc.localhost`. Tauri 2.12.5 refuses an IPC request without the per-launch `Tauri-Invoke-Key` header (`src/ipc/protocol.rs:479`, `src/webview/mod.rs:2010`), and the key is a closure constant in the page's IPC script (`scripts/ipc-protocol.js:12`), not readable from a worker. P0 tests that refusal on Windows.

Themes (`probe.cjs`):
- A `<style>` element without the nonce is refused by the CSP (colour unchanged).
- A constructable stylesheet (`new CSSStyleSheet()`, `replaceSync`, `document.adoptedStyleSheets`) applies under the same CSP, with no CSP change.
- `replaceSync` drops `@import` (console: "@import rules are not allowed here").
- `url(https://…)` stays in the sheet, and `img-src` allows `https:`, so a theme can make a request (a beacon): the loader must drop it.
- Cascade layers protect what must stay visible: with `@layer core, theme`, a `!important` in `core` beats a `!important` in `theme` (the info bar stayed `display: block`, `opacity: 1`).

Autocomplete size (`@codemirror/autocomplete` 6.20.4, minified, over `@codemirror/view` + `state` + `language`): +49 kB (+14 kB gzip). It is in `node_modules` already through `lang-markdown`, but not in the startup chunk.

Token apply at startup (`tok.cjs`): `document.documentElement.style.setProperty('--text', …)` applies under the CSP; `setAttribute('style', …)` is refused ("Applying inline style violates … style-src").
