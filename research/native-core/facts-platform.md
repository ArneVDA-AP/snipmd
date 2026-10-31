# Facts: platform-native editing, webview, runtimes (as of 2026-10-31)

No recommendation. Status values: confirmed-from-page (page opened, content read), inferred (my reading, what confirms it is stated), not-found (no opened page gave it). Fetch tool summarises pages with a small model, so "confirmed" means the summary of the opened page said so; numbers were not re-read from raw HTML.

Network note: learn.microsoft.com, zed.dev, docs.rs, en.wikipedia.org, webkit.org, blogs.windows.com, devblogs.microsoft.com, microsoft.github.io, developer.apple.com (body empty) were not reachable or gave no body. github.com, raw.githubusercontent.com and crates.io worked. Many Microsoft and Apple primary pages therefore could not be read; Microsoft Learn source markdown on GitHub (MicrosoftDocs/*) was read where the file name could be guessed.

## 1. Platform-native text editing

### Windows

| Claim | Status | URL |
|---|---|---|
| Rich Edit 1.0 = Riched32.dll; 2.0 and 3.0 = Riched20.dll; 4.1 = Msftedit.dll (class MSFTEDIT_CLASS), named as current spec | confirmed-from-page | https://raw.githubusercontent.com/MicrosoftDocs/win32/docs/desktop-src/Controls/about-rich-edit-controls.md |
| Rich Edit 4.1 has TSF support, switched on with SES_USECTF via EM_SETEDITSTYLE (plus SES_CTFALLOWEMBED, SES_CTFALLOWPROOFING, SES_CTFALLOWSMARTTAG) | confirmed-from-page | same as above |
| That Win32 doc page does not mention DirectWrite | confirmed-from-page | same as above |
| The "using rich edit controls" and "rich edit controls" doc pages do not mention RichEditD2D, Rich Edit 8 or DirectWrite | confirmed-from-page | https://raw.githubusercontent.com/MicrosoftDocs/win32/docs/desktop-src/Controls/using-rich-edit-controls.md ; https://raw.githubusercontent.com/MicrosoftDocs/win32/docs/desktop-src/Controls/rich-edit-controls.md |
| RichEditD2D / RichEditD2DPT classes exist (D2D/DirectWrite RichEdit, Microsoft 365 RichEdit, Jan 2020); not ported to system msftedit.dll | not-found (only seen in a web-search snippet of devblogs.microsoft.com/math-in-office/richeditd2d-window-controls/; page did not load) | https://devblogs.microsoft.com/math-in-office/richeditd2d-window-controls/ (did not load) |
| "RichEdit 8" as a name for a shipping system control | not-found (snippet only mentioned Office 2013 and learn.microsoft.com archive post; neither opened) | none |
| TSF is a Windows system service giving "advanced text input", redistributable; page does not name IMEs | confirmed-from-page | https://raw.githubusercontent.com/MicrosoftDocs/win32/docs/desktop-src/TSF/text-services-framework.md |
| TSF is the IME route for RichEdit 4.1 | inferred from the two rows above (TSF support in RichEdit; TSF doc lacks IME wording). Confirm: Learn "Text Services Framework" overview naming IMEs | n/a |
| Windows Spell Checking API landing page: check text, get suggestions, manage settings and user dictionaries, plus provider plug-ins | confirmed-from-page | https://raw.githubusercontent.com/MicrosoftDocs/win32/docs/desktop-src/Intl/spell-checker-api.md |
| ISpellChecker interface details and minimum Windows version | not-found (landing page lacks them; "about-the-spell-checker-api.md" exists per directory listing but was not opened) | https://github.com/MicrosoftDocs/win32/tree/docs/desktop-src/Intl (listing only) |
| WinUI 3 RichEditBox: "rich text editing control", formatted text, hyperlinks; for plain text the page suggests TextBox. Document returns ITextDocument (Text Object Model); TextDocument member added Windows 10 1809 (SDK 17763). This is the Windows.UI.Xaml (UWP) page, not Microsoft.UI.Xaml | confirmed-from-page | https://raw.githubusercontent.com/MicrosoftDocs/winrt-api/docs/windows.ui.xaml.controls/richeditbox.md |
| Microsoft.UI.Xaml (WinUI 3) RichEditBox page | not-found (404 on guessed path) | https://raw.githubusercontent.com/MicrosoftDocs/winrt-api/docs/microsoft.ui.xaml.controls/richeditbox.md (404) |
| DirectWrite used by GPUI on Windows for text (Win32 for windowing) | confirmed-from-page | https://raw.githubusercontent.com/zed-industries/zed/main/crates/gpui/README.md |

### Hosting WinUI from Rust

| Claim | Status | URL |
|---|---|---|
| windows-rs repo lists `windows-reactor`, "Declarative UI library backed by WinUI 3"; repo page does not mention RichEdit | confirmed-from-page | https://github.com/microsoft/windows-rs |
| windows-reactor readme: "Reactor is a preview; public APIs may change." Uses an installed Windows App Runtime by default; self-contained build via `windows-reactor-setup` from build.rs; version 0.100 | confirmed-from-page | https://github.com/microsoft/windows-rs/tree/master/crates/libs/reactor |
| windows-reactor crate: created 2026-04-27, newest 0.100.0 (2026-09-03) | confirmed-from-page | https://crates.io/api/v1/crates/windows-reactor |
| Whether windows-reactor exposes RichEditBox or TextBox | not-found (readme names neither; a "controlled input" sample implies some text input) | https://github.com/microsoft/windows-rs/tree/master/crates/libs/reactor |
| `windows` crate newest 0.62.2, updated 2025-10-06 | confirmed-from-page | https://crates.io/api/v1/crates/windows |
| windows-app-rs (Windows App SDK bindings) archived 2022-08-24, read-only; "experimental", "not ready for production use"; archive notice says App SDK too tied to .NET and Visual Studio | confirmed-from-page | https://github.com/microsoft/windows-app-rs |
| ISpellChecker present in the `windows` crate | not-found (microsoft.github.io docs did not load) | https://microsoft.github.io/windows-docs-rs/doc/windows/Win32/Globalization/struct.ISpellChecker.html (did not load) |

### macOS

| Claim | Status | URL |
|---|---|---|
| NSTextView, TextKit 2 (NSTextLayoutManager), NSTextAttachmentViewProvider availability and inline-view behaviour | not-found (Apple page returned title only; docs.rs type pages did not load) | https://developer.apple.com/documentation/uikit/nstextattachmentviewprovider (empty body) |
| NSSpellChecker | not-found | https://docs.rs/objc2-app-kit/latest/objc2_app_kit/struct.NSSpellChecker.html (did not load) |
| objc2-app-kit: newest 0.3.2, updated 2025-10-04, "Bindings to the AppKit framework", ~80.3M total downloads | confirmed-from-page | https://crates.io/api/v1/crates/objc2-app-kit |
| objc2-foundation newest 0.3.2, updated 2025-10-04 | confirmed-from-page | https://crates.io/api/v1/crates/objc2-foundation |
| objc2 README: merged fork of objc, objc-foundation, block etc.; dual MIT/Apache-2.0/Zlib; no framework list shown | confirmed-from-page | https://raw.githubusercontent.com/madsmtm/objc2/main/README.md |
| Whether objc2-app-kit 0.3.2 exposes NSTextAttachmentViewProvider / NSTextLayoutManager | not-found | n/a |
| Observation: objc2-app-kit has had no release in the 12+ months before today (last 2025-10-04) | numerical: 2026-10-31 minus 2025-10-04, inputs from crates.io row above | https://crates.io/api/v1/crates/objc2-app-kit |

## 2. WebView2 and WKWebView

| Claim | Status | URL |
|---|---|---|
| A WebView2 process group has exactly one browser process, one or more renderers, and helpers (GPU, Audio service named as examples); renderer count depends on site isolation and distinct origins; each user data folder gets its own group; no fixed counts | confirmed-from-page | https://raw.githubusercontent.com/MicrosoftDocs/edge-developer/main/microsoft-edge/webview2/concepts/process-model.md |
| Performance doc: cold starts are the main startup bottleneck; Evergreen runtime already in memory if Edge is running improves launch; do not use WebView2 for splash screens/simple dialogs; keep user data folder on fast local storage | confirmed-from-page | https://raw.githubusercontent.com/MicrosoftDocs/edge-developer/main/microsoft-edge/webview2/concepts/performance.md |
| Same doc: each control has its own processes so memory grows per instance; share one CoreWebView2Environment; MemoryUsageTargetLevel Low and TrySuspendAsync for inactive views; GPU needs extra memory but is "critical for performance" | confirmed-from-page | same as above |
| The performance doc gives no ms or MB figures | confirmed-from-page | same as above |
| Numeric cold-start time or typical memory for WebView2 | not-found | n/a |
| WKWebView / WebKit WebContent process model | not-found (webkit.org did not load) | https://webkit.org/blog/9661/webkit-process-model/ (did not load) |
| wry backends: Windows WebView2 (Edge Chromium), macOS native WebKit, Linux WebKitGTK (`webkit2gtk-4.1`), Android; `os-webview` feature "added in preparation of other ports like cef and servo" | confirmed-from-page | https://github.com/tauri-apps/wry |
| Tauri v2 uses webkit2gtk 4.1 on Linux (v1 used 4.0) | confirmed-from-page | https://raw.githubusercontent.com/tauri-apps/tauri/dev/README.md |
| tauri crate newest stable 2.12.5 (2026-10-21); prerelease 3.0.0-alpha.5 (2026-10-14) | confirmed-from-page | https://crates.io/api/v1/crates/tauri |

## 3. Tauri on Linux and alternative runtimes

| Claim | Status | URL |
|---|---|---|
| Discussion #8524 (opened 2024-01-02) is open: WebKitGTK instability, asks for Firefox/Chromium engines | confirmed-from-page | https://github.com/tauri-apps/tauri/discussions/8524 |
| Maintainer FabianLars 2024-01-03: CEF work started, halted a second time, mainly due to Servo cooperation, likely not part of the open-source org | confirmed-from-page | same |
| 2024-01-02: team working with Igalia on a Servo webview; Servo would not match mainstream browsers in features soon | confirmed-from-page | same |
| 2025-03-03: GTK4 work underway to "slightly improve the webkitgtk situation"; CEF "has begun recently" | confirmed-from-page | same |
| 2025-11-07: maintainer corrected "considering" to "working on it" for CEF | confirmed-from-page | same |
| 2026-01-13: no release; work is dogfooding on customer projects, open-source work later | confirmed-from-page | same |
| 2026-03-16: a `feat/cef` branch is usable but "very experimental"; 2026-07-07 another user experimenting with CEF branches | confirmed-from-page | same |
| 2026-07-05 user report: ~40 fps on WebKitGTK vs ~240 fps in an Electron build (one user report, not a benchmark) | confirmed-from-page (as a report) | same |
| 2026-03 users say Linux webview problems persist | confirmed-from-page (as reports) | same |
| tauri-apps/cef-rs: Rust bindings for CEF, under tauri-apps org, Linux/macOS/Windows x86_64 and ARM64, no published releases shown, 489 stars, Apache-2.0/MIT | confirmed-from-page | https://github.com/tauri-apps/cef-rs |
| Verso (Servo-based browser): README says "no longer maintained"; repo archived 2025-10-08 | confirmed-from-page | https://github.com/versotile-org/verso |
| Verso's relation to Tauri | not-found on that page (Tauri not mentioned) | https://github.com/versotile-org/verso |
| Official Tauri roadmap/blog statement for 2026 on CEF release date | not-found | n/a |
| Tauri README names no Servo, Verso or CEF | confirmed-from-page | https://raw.githubusercontent.com/tauri-apps/tauri/dev/README.md |

## 4. Real apps

| Claim | Status | URL |
|---|---|---|
| Zed repo: Rust, macOS/Linux/Windows downloads, "gpui" topic | confirmed-from-page | https://github.com/zed-industries/zed |
| GPUI: "hybrid immediate and retained mode, GPU accelerated, UI framework for Rust"; Metal on macOS, DirectWrite on Windows, wayland/x11 on Linux; pre-1.0, breaking changes common | confirmed-from-page | https://raw.githubusercontent.com/zed-industries/zed/main/crates/gpui/README.md |
| Lapce: "written in pure Rust", UI in Floem, built-in LSP, modal editing, remote dev, WASI-based plugins, terminal. Page shows ~3,653 commits, 833 open issues, 73 open PRs; no dates, no release list | confirmed-from-page | https://github.com/lapce/lapce |
| Lapce release cadence / maintenance state | not-found | n/a |
| Windows 11 Notepad built on a RichEdit from the Microsoft 365 line (not msftedit.dll), uses RichEditD2DPT with DirectWrite for color emoji | not-found as confirmed (only a search-result summary of devblogs.microsoft.com/math-in-office/windows-11-notepad/; page did not load) | https://devblogs.microsoft.com/math-in-office/windows-11-notepad/ (did not load) |
| Notepad Wikipedia page | not-found (did not load) | https://en.wikipedia.org/wiki/Windows_Notepad (did not load) |
| Note/Markdown apps that left Electron or webviews for native | not-found (not searched beyond the above) | n/a |

## 5. Plugin runtimes

| Claim | Status | URL |
|---|---|---|
| wasmtime crate: page states newest_version 48.0.8 but max_version/max_stable 50.0.1, updated 2026-10-29. The two figures disagree on the page itself; I did not resolve it | confirmed-from-page (conflict noted) | https://crates.io/api/v1/crates/wasmtime |
| Wasmtime repo: Bytecode Alliance, "lightweight ... fast, secure, standards-compliant", WASI APIs, example targets `wasm32-wasip2` components; no size or startup numbers | confirmed-from-page | https://github.com/bytecodealliance/wasmtime |
| wasmi crate: 2.0.0, updated 2026-09-01, "WebAssembly interpreter" | confirmed-from-page | https://crates.io/api/v1/crates/wasmi |
| Wasmi README: interpreter for embedded/plug-in use, no_std; WASI only via `wasmi_wasi` (wasip1) and C-API; no mention of the component model; no size or startup numbers | confirmed-from-page | https://github.com/wasmi-labs/wasmi |
| Binary size added or startup cost for wasmtime or wasmi | not-found | n/a |
| Extism: crate 1.41.0 (2026-10-09), "Extism runtime and Rust SDK"; README: lightweight framework for building with Wasm, plug-in systems, 14 host SDK languages, host-controlled HTTP "without WASI" | confirmed-from-page | https://crates.io/api/v1/crates/extism ; https://raw.githubusercontent.com/extism/extism/main/README.md |
| Extism README does not name its runtime or say anything on the component model | confirmed-from-page | https://raw.githubusercontent.com/extism/extism/main/README.md |
| rquickjs 0.14.0 (2026-09-18); binds QuickJS-NG; README quotes "210 KiB of x86 code for a simple hello world" which describes QuickJS itself, not rquickjs; no Node/web APIs; MSVC x86_64 marked experimental; set max stack size on wasm32 | confirmed-from-page | https://crates.io/api/v1/crates/rquickjs ; https://raw.githubusercontent.com/DelSkayn/rquickjs/master/README.md |
| mlua 0.12.2 (2026-10-03); Lua 5.1-5.5, LuaJIT, Luau; `vendored` compiles from source; sandbox method for Luau only; async via coroutines | confirmed-from-page | https://crates.io/api/v1/crates/mlua ; https://raw.githubusercontent.com/mlua-rs/mlua/main/README.md |
| Zed extensions: "Procedural parts ... written in Rust and compiled to WebAssembly", `zed_extension_api` crate, target `wasm32-wasip2`, `schema_version = 1` in extension.toml | confirmed-from-page | https://raw.githubusercontent.com/zed-industries/zed/main/docs/src/extensions/developing-extensions.md |
| Zed's extension WIT file declares `package zed:extension;` and a world `extension` importing interfaces such as github, http-client, process, nodejs, dap | confirmed-from-page | https://raw.githubusercontent.com/zed-industries/zed/main/crates/extension_api/wit/since_v0.8.0/extension.wit |
| Zed's extension_host crate depends on `wasmtime` and `wasmtime-wasi` | confirmed-from-page | https://raw.githubusercontent.com/zed-industries/zed/main/crates/extension_host/Cargo.toml |
| Docs page does not itself name wasmtime or WIT; those come from the two source files above | confirmed-from-page | developing-extensions.md URL above |
| Zed docs/blog statement on the extension runtime | not-found (zed.dev did not load) | https://zed.dev/docs/extensions/developing-extensions (did not load) |
| WASI component model status in Wasmtime 2026 (wasip2/wasip3) beyond the example | not-found | n/a |

## 6. Markdown in Rust

| Claim | Status | URL |
|---|---|---|
| pulldown-cmark newest 0.13.6, updated 2026-10-30, "A pull parser for CommonMark" | confirmed-from-page | https://crates.io/api/v1/crates/pulldown-cmark |
| pulldown-cmark README: aims for 100% CommonMark compliance (no spec version named); opt-in GFM tables, task lists, strikethrough; footnotes; `==highlight==`; offset iterator for source ranges; no_std option; MSRV 1.71.1; no `unsafe` except opt-in SIMD. HTML handling of raw HTML not described on the page | confirmed-from-page | https://raw.githubusercontent.com/pulldown-cmark/pulldown-cmark/master/README.md |
| comrak newest 0.59.0, updated 2026-10-26, "100% CommonMark-compatible GitHub Flavored Markdown parser and formatter" | confirmed-from-page | https://crates.io/api/v1/crates/comrak |
| comrak README: CommonMark 0.31.2; badges 652/652 CommonMark and 670/670 GFM; supports tables, task lists, strikethrough, autolinks; tagfilter deprecated 0.55.0, removed 0.56.0; footnotes, superscript, math, wikilinks as own extensions | confirmed-from-page | https://raw.githubusercontent.com/kivikakk/comrak/main/README.md |
| comrak scrubs raw HTML and dangerous links by default (`unsafe` option turns this off); author suggests pairing with ammonia | confirmed-from-page | same |
| ammonia newest 4.2.4, updated 2026-10-17, "HTML Sanitization" | confirmed-from-page | https://crates.io/api/v1/crates/ammonia |
| ammonia README (html5ever basis, MSRV) | not-found (guessed raw path returned 404) | https://raw.githubusercontent.com/rust-ammonia/ammonia/main/README.md (404) |

## Did not load

- https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model (host not resolvable; read via MicrosoftDocs/edge-developer raw instead)
- https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance (same)
- https://zed.dev/docs/extensions/developing-extensions (host not resolvable; read via zed repo raw)
- https://blogs.windows.com/windows-insider/2023/11/09/begin-testing-new-notepad-spellcheck/
- https://en.wikipedia.org/wiki/Rich_Edit_Control ; https://en.wikipedia.org/wiki/Windows_Notepad
- https://webkit.org/blog/9661/webkit-process-model/
- https://devblogs.microsoft.com/math-in-office/windows-11-notepad/ ; https://devblogs.microsoft.com/math-in-office/richeditd2d-window-controls/
- https://docs.rs/objc2-app-kit/latest/objc2_app_kit/struct.NSTextAttachmentViewProvider.html ; .../struct.NSTextLayoutManager.html ; .../struct.NSSpellChecker.html
- https://microsoft.github.io/windows-docs-rs/doc/windows/Win32/Globalization/struct.ISpellChecker.html
- https://developer.apple.com/documentation/uikit/nstextattachmentviewprovider (loaded, no body)
- 404: https://raw.githubusercontent.com/MicrosoftDocs/win32/docs/desktop-src/Intl/about-the-spell-checking-api.md ; .../Controls/versions-of-rich-edit.md ; https://raw.githubusercontent.com/MicrosoftDocs/winrt-api/docs/microsoft.ui.xaml.controls/richeditbox.md ; https://raw.githubusercontent.com/rust-ammonia/ammonia/main/README.md ; https://github.com/objc2/objc2 ; https://github.com/tauri-apps/tauri/issues/8524 loaded as a discussion redirect only
- gh API to MicrosoftDocs/win32 refused (repo access not enabled)

## Conjectures

1. TSF is how RichEdit 4.1 receives IME input (see section 1). Confirm with the Learn TSF overview naming IMEs.
2. The Windows 11 Notepad RichEditD2DPT/DirectWrite claim rests on a search summary only; confirm by opening the devblogs post.
3. Whether the objc2-app-kit 0.3.2 release covers TextKit 2 classes is unknown; confirm in its docs.rs type list or Cargo features.
