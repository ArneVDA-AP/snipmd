# Native core without a webview: research

Date: 2026-10-31. Question from the owner: how could SnipMD drop WebView2 / WKWebView and run on its own native core? Research and a recommendation only; nothing on `main` changes. SPEC and ARCHITECTURE are untouched until the owner decides.

Working files, all in `research/native-core/`:
- `facts-rust-gui.md`, `facts-platform.md`: web facts, one status per claim, with URLs and the pages that did not load.
- `measurements.md`: the prototype numbers and the license check.
- `proto/`: the egui and iced prototype sources.
- `lens-keep-webview.md`, `lens-go-native.md`: two analyses with opposite lenses.

## Recommendation

**Keep the webview, and don't start a rewrite.** All SPEC §9 budgets pass today. The one gain only native can deliver is about 0.5 s off the cold start. Getting it means writing the editor ourselves, because no Rust stack offers one that meets SPEC §5. That is 25–65 person-weeks of work, and IME, screen-reader support and images between lines get worse before they get better.

Three things are worth doing now, whatever is decided later:
1. **Plugins stay portable.** Already done: the #81 design runs plugins as plain JS in a Web Worker, behind a JSON message protocol, with declarative UI and JSON themes. Its prelude removes web APIs, so the same plugins could run on rquickjs in a native host (`design/plugins.md` §13 on `claude/plugin-design`).
2. **Move pure decisions into `snipmd-core` when they are touched anyway.** Candidates: link rewriting on promotion, slug names, paste rules. These are tested in Rust, the shipping app uses them, and they survive any UI. Nothing on the keystroke path moves, because an IPC round trip per edit would break "nothing O(document) per keystroke" (CONVENTIONS 2).
3. **If cold start under 300 ms matters to the owner, pay for a spike, not a migration.** That is 1–2 person-weeks on Windows: a gpui window and an egui window, each with the Microsoft Pinyin and Japanese IME, NVDA, a 4K image, and cold start and memory measured with `measure.ps1`. The outcome is go or no-go. A go still needs the owner's decision on everything listed under "Questions for the owner".

When to look again: Linux comes into scope; a WebView2 or WKWebView change breaks the core loop; a Rust editor ships with AccessKit text ranges, stable IME and block widgets between lines; or the owner makes 300 ms a hard requirement.

## The reasons to go native, checked

| Reason | Holds? | Numbers |
|---|---|---|
| Cold start < 300 ms | **Yes, and it is the only one** | Measured 722–784 ms, of which SnipMD's own start is 131–139 ms (`docs/releasing.md`). The ~0.6 s rest is WebView2, and an app cannot shorten it (SPEC §9). The warm broker reached ~320 ms but crashed the start, so it was dropped (ARCHITECTURE, Decisions). Native prototypes drew their first frame in 55–72 ms (egui) and 122–158 ms (iced) on a CPU renderer (`measurements.md`). No webview option has a figure under 300 ms. |
| Memory | No evidence | Today 98–104 MB against a 120 MB budget. The prototypes used 139–143 MB with no image and 203–237 MB with a 4K image, but on Mesa software rendering, which isn't comparable. Windows with a GPU was **not measured**. |
| Linux | Not today | Out of scope (SPEC §12). If that changes it partly holds: WebKitGTK problems are an open Tauri discussion, and Tauri's CEF backend is "very experimental" on a branch with no release (`facts-platform.md` §3). |
| No dependence on webview behaviour | Partly | We work around 5 webview behaviours today: the macOS Edit-menu paste, the `paste-text` event, browser keys switched off, `autocomplete=off`, and the CSP nonce. Each is a few lines and already shipped. Native swaps them for pre-1.0 crates that break between releases (gpui, egui, iced, Xilem). |
| Security (§8) | Partly | Native read mode has no script engine, so the risk of a note running code disappears by design. But §8 is met today with DOMPurify and a strict CSP, and the allowed set lives in Rust either way. comrak scrubs raw HTML by default. |
| Plugin isolation (#81) | No | A worker gives isolation today at no extra cost. Native needs an embedded runtime: rquickjs or wasmtime. No size figure was found for wasmtime. |
| Control over rendering | Partly | Native owns every pixel, but Mica, Snip's animation and WCAG AA contrast already work in the webview. macOS vibrancy is blocked by a private API, not by the webview. |

## The editor is the cost

| Capability (SPEC §5–6) | Today (CodeMirror 6 in the webview) | Best native evidence |
|---|---|---|
| Images as blocks between lines (the core loop, §2 step 2) | `StateField` block widgets, shipped | **No stack has it.** Neither prototype's widget can do it. We would write our own editor element on every route. |
| IME (CJK, dead keys, AZERTY) | The engine's text input | gpui: Win32 IME and TSF handled, but 3 open Windows candidate-window bugs in Zed (2026-06 to 09). egui: improved in 0.35, 9 open IME issues. Untestable here (no input method under Xvfb). |
| Accessibility | The engine's tree (UIA / NSAccessibility) | AccessKit 0.25 handles single- and multi-line text on Windows and macOS, but no rich text, and has open text-range bugs. egui has AccessKit always on. gpui 0.2.2 on crates.io has none; Zed `main` now depends on it ("mostly working", May 2026). |
| Spellcheck | The engine's | No Rust stack states any. We would bind ISpellChecker and NSSpellChecker ourselves. AccessKit can't expose spelling errors yet (#847). |
| Bidi, selection, undo | CodeMirror + engine | Parley has bidi via ICU4X and IME preedit. cosmic-text lists bidi selection as not ready. egui 0.37 has a selection regression. |
| Find/replace, highlighting | CodeMirror search, Lezer grammars loaded lazily | Not found in any stack. We would build both. |
| Read mode | `marked` + DOMPurify | comrak (652/652 CommonMark, 670/670 GFM, scrubs raw HTML) or pulldown-cmark, rendered to native layout. Feasible. |

**License finding.** gpui is Apache-2.0, but Zed's `editor`, `text`, `multi_buffer` and `language` crates are GPL-3.0-or-later, and SnipMD is MIT. So gpui gives us a framework, not Zed's editor. Read from the crates' `Cargo.toml` on `main`.

## Candidates

The full score table is in `lens-go-native.md` §1. In short:
- **gpui** (Apache-2.0, pre-1.0, crates.io a year behind `main`): uses DirectWrite and CoreText, so system fonts and CJK/emoji fallback come for free. Retained rendering suits tall notes full of images. It is the only stack carrying a shipped editor on Windows (Zed), but that editor is GPL. Screen-reader support is only on `main`. We'd pin a git revision. **Best base if native**, by a thin margin.
- **egui** (MIT/Apache, monthly releases, breaking changes): best accessibility today. But it has its own text layout that needs fonts supplied, and it is immediate mode, which the project warns is CPU-heavy for large scroll areas. Runner-up, and the pick if a working screen reader is a gate before any code.
- **Slint** (1.18, active): its royalty-free license requires an "AboutSlint" attribution and forbids exposing Slint APIs, which collides with plugin UI. GPLv3 is the alternative.
- **iced** (experimental, 11 months since 0.14, no accessibility), **Xilem/Masonry** (experimental, its text editing widget is still an open issue), **Floem** (no release since 2024-11), **Makepad** (1.0 in 2025-05, no accessibility): not viable now.
- **Per-OS native** (Win32 RichEdit + TSF + ISpellChecker; AppKit/TextKit 2): best IME and spellcheck evidence on Windows. But it means two UIs for one product, and WinUI from Rust is preview-only (`windows-reactor` 0.100) or archived (`windows-app-rs`). Most macOS rows couldn't be verified because developer.apple.com didn't load. Only sensible if SnipMD stays Windows-only for good.
- **Hybrid** (native editor, webview for read mode only): the 0.6 s moves to the first `Ctrl+E` instead of disappearing, and we'd keep two renderers that must highlight "with the same colours" (§5). A stage on the way, not an end state.

## Measurements

From `measurements.md`: Linux, Xvfb, no GPU, Mesa software rendering. Treat these as relative indicators only.

| | egui 0.37 | iced 0.14 | SnipMD today (Windows, `releasing.md`) |
|---|---|---|---|
| First frame / cold start | 55–72 ms to first frame | 122–158 ms (one cold run: 3.7 s of software Vulkan setup) | 722–784 ms double-click to typing |
| Memory | 139 MB, 203–213 MB with a 4K image | 143 MB, 228–237 MB | 98–104 MB (5 tabs, 20 images) |
| Size | 21.5 MB stripped, 5.7–8.4 MB compressed | 19.5 MB, 5.1–7.5 MB | 1.37 MB installer |

Not measured: Windows, a GPU, IME, screen readers, or images inside the editor. The prototype shows a native window is fast. It doesn't touch the hard part.

## Plugins without a webview (#81)

The #81 design took the three points sent on 2026-10-31: plugins are JS in a Worker with no DOM, a JSON protocol, declarative UI only, ECMAScript plus a `snipmd` object, and JSON themes. That makes the native answer **rquickjs running the same plugins**, not a new WASM API.
- WASM components on wasmtime are what Zed uses, and they suit Rust authors. But they would replace a JS API that users and agents can write, and wasmtime's size against the 10 MB budget wasn't found.
- Risk: rquickjs marks MSVC x86_64 as experimental, and that is SnipMD's main target. A native spike should build it on Windows.
- What a native host loses: CodeMirror editor extensions as a plugin point (e.g. path completion, #85). That point would need its own native API.

## Migration path, if the owner goes native

The Tauri build stays the release until the native build passes the full release checklist and the §9 budgets. Data safety doesn't move: atomic writes, `create_new` naming, stamped writes, cleanup and the session format already live in `snipmd-core`, which has no Tauri dependency.

| Phase | What | Gate | Size |
|---|---|---|---|
| 0 Spike | gpui + egui on Windows: IME, NVDA, a 4K texture, cold start, memory | Go / no-go | 1–2 person-weeks |
| 1 Core first | Pure decisions into `snipmd-core`, used by the shipping app (none from the keystroke path) | cargo + Vitest green | 3–5 weeks |
| 2 Shell | Tabs, info bar, command menu, first-save bar, theme, Mica; a plain editor; dogfooded with `SNIPMD_DATA_DIR` | Core loop works on Windows | 2.5–4k lines |
| 3 Editor | Own element: undo across tabs, Markdown styling, lists, block images, find/replace, lazy languages, clipboard, drop, IME, AccessKit text, spellcheck | Ported Vitest cases; §9 on Windows | 7–11k lines |
| 4 Read mode | comrak → native layout; app-owned checkboxes and Copy | `evil.md` check | 1.5–2.5k lines |
| 5 macOS | Menu bar, Finder open, Cmd+Q flush, native buttons | `macos-probe.sh` | 0.8–1.5k lines |
| 6 Switch | Pre-release in the same data folder, session unchanged, so the Tauri build is a lossless rollback | Install-over check | n/a |

Total: 12–20k new Rust lines plus 4–6k lines of ported tests, about **25–65 person-weeks** (central guess ~40). The rate of 300–500 tested lines a week is a guess that phase 2 would calibrate. Today's frontend is 4,209 lines because CodeMirror and the browser do the heavy work, and native means writing that layer.

What survives: all of `snipmd-core` (2,122 lines) and the allowed-set checks from the Tauri crate. The TypeScript survives as behaviour (the Vitest cases, colour tokens, contrast pairs, Snip's sprite paths), not as code. Files on disk and `session.json` stay byte for byte the same.

## Weakest point of this recommendation

SPEC §2 says: "If they don't feel instant, nothing else matters." The cold start is the first thing every user feels. Because closing the window quits the app, every open after a close is cold. I treat 0.7 s as good enough because the SPEC's own target (< 1 s) says so. If the owner's real target is "instant", this recommendation is wrong on its own terms.

Waiting also isn't free: every feature and plugin point built on CodeMirror and the DOM raises the cost of leaving later. Step 1 limits that for plugins, not for core features.

The comparison also leans on numbers that don't exist yet: Windows memory for a native build, and SnipMD's own IME and screen-reader quality in the webview. Both are inferred, not measured.

A cheaper lever outside the native frame: if most cold starts happen because the app quits on close, an option to stay resident on Windows (tray, or keep the process after the last window closes) would make most opens warm handoffs (SPEC §9 already hands a double-click to the open window). The cost is background memory and a change to how closing behaves. That is the owner's call, and it should be measured before any native work.

## Questions for the owner
1. Is cold start under 300 ms a requirement, or is the SPEC's < 1 s enough?
2. Would SnipMD staying resident after the window closes (Windows) be acceptable as the cheap fix for cold start?
3. Will Linux ever be in scope? It is the one platform where the webview story is weak.
4. Is screen-reader support a gate before any native code? It decides between gpui and egui.
5. Does SnipMD stay MIT? GPL-3.0 would allow reusing Zed's editor crates, at the cost of their size, churn and licence terms for contributors and plugins.
6. Is 25–65 person-weeks of rewrite worth more than the same time on features and plugins?
7. Is an installer growing from ~1.4 MB to ~6–8 MB acceptable? It stays under the 10 MB budget.

## What did not load
docs.rs, slint.dev, zed.dev, learn.microsoft.com (Microsoft Learn sources were read from GitHub instead), devblogs.microsoft.com, webkit.org, wikipedia, and developer.apple.com (title only). So TextKit 2 / NSTextView / NSSpellChecker, the WKWebView process model, Slint's commercial terms, and whether Windows 11 Notepad runs on RichEdit stay unverified. The details are in each facts file under "Did not load".
