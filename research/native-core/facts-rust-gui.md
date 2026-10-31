# Facts: Rust native GUI stacks (as of 2026-10-31)

Status key: CP = confirmed-from-page (page opened, URL given), INF = inferred (reasoning stated), NF = not-found (looked, page did not say; this is not proof of absence).
Short names: CIO = https://crates.io/api/v1/crates/<name> (and /versions); RAW = raw.githubusercontent.com; GH = github.com.
Limits of this run: `gh api` was refused (repo access not enabled), docs.rs, slint.dev, zed.dev, linuxiac.com did not resolve (session network allowlist). Issue lists were read through GitHub search pages, summarised by the fetch tool from titles only.
Cross-cutting: no page opened states any spellcheck integration for any stack, and none publishes startup, memory or binary-size numbers (NF for all, see each section).

## 1. gpui (Zed)

| Claim | Status | URL |
|---|---|---|
| Published standalone on crates.io as `gpui`; latest 0.2.2 released 2025-10-22 (prior 0.2.1 2025-10-14, 0.2.0 2025-10-09); crate created 2022-06-23 | CP | https://crates.io/api/v1/crates/gpui/versions |
| License Apache-2.0 (crates.io metadata and Cargo.toml `license = "Apache-2.0"`, `publish = true`) | CP | https://raw.githubusercontent.com/zed-industries/zed/main/crates/gpui/Cargo.toml |
| README: pre-1.0, "There will often be breaking changes between versions"; needs latest stable Rust | CP | https://github.com/zed-industries/zed/tree/main/crates/gpui |
| Windows: no features needed, Win32 windowing, DirectWrite text; macOS: Metal, needs `font-kit` feature for glyphs; Linux: wayland/x11 features | CP | https://github.com/zed-industries/zed/tree/main/crates/gpui |
| Published 0.2.2 source has Windows backend with DirectWrite, DirectX renderer; Linux uses cosmic-text, macOS uses zed-font-kit (CoreText) | CP (read extracted .crate) | https://static.crates.io/crates/gpui/gpui-0.2.2.crate |
| Zed's Windows build is announced as stable, renders with DirectX 11 and DirectWrite (from a search result summary, blog itself did not load) | INF | search result summary of https://zed.dev/blog/zed-for-windows-is-here |
| Maintenance: GPUI lives in the Zed monorepo; Zed issue tracker shows activity through Oct 2026 (issues dated 2026-10-08) | CP | https://github.com/zed-industries/zed/issues?q=is%3Aissue+is%3Aopen+IME+windows |
| Zed reaches 1.0 (single search-result line, page not opened) | INF | search result "Zed Code Editor Hits 1.0" at https://linuxiac.com/zed-code-editor-hits-1-0-with-gpu-accelerated-ui/ (did not load) |
| Crates.io 0.2.2 is a year old (2025-10-22) while the monorepo main is at the same version string 0.2.2; so crates.io lags main | INF | gpui Cargo.toml `version = "0.2.2"` on main vs crates.io versions list; main has post-publish changes (see AccessKit PR below) |
| IME: Windows handles WM_IME_STARTCOMPOSITION / WM_IME_COMPOSITION and calls ImmSetCandidateWindow with CANDIDATEFORM (CFS_CANDIDATEPOS); an `InputHandler` trait with `bounds_for_range` and `EntityInputHandler` exist | CP (source in .crate) | https://static.crates.io/crates/gpui/gpui-0.2.2.crate |
| Known open IME issues (Zed repo): #64850 candidate window misplaced vs composition (Windows, 2026-09-28); #59636 TSF GetTextExt returns caret-like rect for composition range (Windows, 2026-06-20); #64389 gpui examples/input.rs misplaces IME composition selection, copy can panic (2026-09-17); #61724 preedit width differs in terminal (Windows); #59193 text shifts vertically with Chinese IME on Windows; #59882 Chinese IME intermittently fails; #60747 macOS Shift in Chinese IME triggers command panel; #65302 Wayland preedit segment not distinguished | CP (titles/dates from search page) | https://github.com/zed-industries/zed/issues?q=is%3Aissue+is%3Aopen+IME+windows |
| Accessibility: Zed issue #41138 open (opened 2025-10-24): Zed silent to JAWS/NVDA on Windows; maintainer (2025-10-28) says no screen reader support on macOS, Linux, Windows | CP | https://github.com/zed-industries/zed/issues/41138 |
| AccessKit for GPUI: work in PR #51097 then #56065 "gpui: Accesskit support"; contributor said "mostly working" on 2026-05-22, tested on Windows and Wayland, macOS/X11 feedback sought; PR referenced by a merge-queue commit 2026-05-27 | CP | https://github.com/zed-industries/zed/issues/41138 |
| Published gpui 0.2.2 contains no "accesskit" string anywhere in its source | CP (grep of extracted .crate) | https://static.crates.io/crates/gpui/gpui-0.2.2.crate |
| Whether AccessKit support exposes text ranges/caret for Zed's editor | NF | n/a |
| Multiline editor: Zed's editor is built on GPUI (a real code editor exists); gpui itself ships only an `examples/input.rs` text-input example, no ready text-area widget in the crate | INF (Zed is the product; example list read from .crate) | https://static.crates.io/crates/gpui/gpui-0.2.2.crate |
| Image rendering: `img()` element, `ImageCache`, `ObjectFit`, examples image_gallery, image_loading, gif_viewer, svg | CP | https://static.crates.io/crates/gpui/gpui-0.2.2.crate |
| Block images between text lines inside the editor | NF | n/a |
| Spellcheck | NF | n/a |
| Text shaping: DirectWrite (Windows), CoreText via zed-font-kit (macOS), cosmic-text (Linux) | CP | https://static.crates.io/crates/gpui/gpui-0.2.2.crate (Cargo.toml) |
| Startup/memory/binary size numbers | NF | n/a |

## 2. Slint

| Claim | Status | URL |
|---|---|---|
| Latest crates.io `slint` 1.18.1 released 2026-09-21 (1.18.0 2026-09-16, 1.17.1 2026-07-07, 1.17.0 2026-06-24, 1.16.1 2026-04-23) | CP | https://crates.io/api/v1/crates/slint/versions |
| Master changelog has an unreleased 1.19.0 section; releases roughly every 1 to 3 months | CP | https://raw.githubusercontent.com/slint-ui/slint/master/CHANGELOG.md |
| Licence expression `GPL-3.0-only OR LicenseRef-Slint-Royalty-free-2.0 OR LicenseRef-Slint-Software-3.0` | CP | https://crates.io/api/v1/crates/slint |
| README: choose Royalty-free (proprietary desktop/mobile/web), GPLv3 (open source), or Commercial (proprietary embedded) | CP | https://github.com/slint-ui/slint |
| Royalty-free 2.0 text: allows use in desktop, mobile, web apps; no embedded systems; no standalone distribution; no exposing Slint APIs from the app; attribution required via AboutSlint widget in an About screen/splash, or attribution badge on a public webpage; no termination clause in the text | CP | https://raw.githubusercontent.com/slint-ui/slint/master/LICENSES/LicenseRef-Slint-Royalty-free-2.0.md |
| Commercial price list / terms page | NF (slint.dev did not load) | https://slint.dev/terms-and-conditions |
| Platforms: Windows, macOS, Linux desktop; embedded; web (wasm); renderers femtovg, Skia, software; Qt style optional | CP | https://github.com/slint-ui/slint |
| Default desktop backend is winit (changelog mentions "backend-winit" label and winit backend) | INF | https://github.com/slint-ui/slint/issues?q=is%3Aissue+is%3Aopen+IME |
| IME: `input-method-hints` property on TextInput/LineEdit; fix "IME not updated when position of a focused TextInput changes" (1.18.0) | CP | https://raw.githubusercontent.com/slint-ui/slint/master/CHANGELOG.md |
| Open IME issues: #10861 last char dropped when window loses focus during IME composition in LineEdit (2026-02-24, backend-winit/upstream); #3811 Input Method support in public Platform API (2023-10-30); #14032 Chinese IME fails on iOS LineEdit (2026-10-13). No open CJK candidate-window position issue seen in the list | CP | https://github.com/slint-ui/slint/issues?q=is%3Aissue+is%3Aopen+IME |
| Accessibility: changelog 1.18.0 says text inputs' content, including selection, is exposed to assistive tech and AT can change the selection; `accessible-*` properties; accessible-action-set-value on TextEdit/LineEdit; AccessKit not named in the sections read | CP (AccessKit use itself INF) | https://raw.githubusercontent.com/slint-ui/slint/master/CHANGELOG.md |
| Multiline widget: `TextEdit` (std widgets) and `TextInput` element; a full code editor built on it: NF | CP for widgets (changelog), NF for editor | https://raw.githubusercontent.com/slint-ui/slint/master/CHANGELOG.md |
| Image: `Image` element and `AccessibleRole.image` | CP | https://raw.githubusercontent.com/slint-ui/slint/master/CHANGELOG.md |
| Inline block widgets between text lines in TextEdit | NF | n/a |
| Spellcheck | NF | n/a |
| Text shaping library (Slint uses parley/skrifa in recent versions) | NF in pages opened | n/a |
| Size/memory numbers: README states only design goal "minimal resources", no numbers | CP | https://github.com/slint-ui/slint |

## 3. iced

| Claim | Status | URL |
|---|---|---|
| Latest crates.io 0.14.0 released 2025-12-07; previous 0.13.1 2024-09-19; about 11 months since last release | CP | https://crates.io/api/v1/crates/iced/versions |
| Changelog top is `[Unreleased]` then 0.14.0 2025-12-07 | CP | https://raw.githubusercontent.com/iced-rs/iced/master/CHANGELOG.md |
| License MIT | CP | https://crates.io/api/v1/crates/iced |
| README: "currently experimental software"; Windows, macOS, Linux, Web; renderers wgpu (Vulkan/Metal/DX12) and tiny-skia | CP | https://github.com/iced-rs/iced |
| Text engine: cosmic-text (workspace Cargo.toml pins a hecrj fork of cosmic-text by git rev) | CP | https://raw.githubusercontent.com/iced-rs/iced/master/Cargo.toml |
| IME: changelog 0.14 fixes "Wrong initial candidate position for IME" (#2793), "Input placeholder not clearing when IME is activated" (#2785), "Text spans in IME preedit not cached" (#2806), and adds variable text size for the preedit IME window (#2790) | CP | https://raw.githubusercontent.com/iced-rs/iced/master/CHANGELOG.md |
| Open IME issues in tracker search: none listed | NF | https://github.com/iced-rs/iced/issues?q=is%3Aissue+is%3Aopen+IME |
| Accessibility: issue #552 "Implement accessibility support" (opened 2020-10-05, labels accessibility/feature/help wanted); no AccessKit mention in README or changelog | CP (issue exists), NF (no integration found) | https://github.com/iced-rs/iced/issues?q=is%3Aissue+accessibility+AccessKit |
| Multiline widget `text_editor` (built on cosmic-text Editor); a real code editor built on it: NF | INF (widget name not read from a page this run) | n/a |
| Image widget and markdown widget exist (changelog mentions `markdown::view`) | CP for markdown | https://raw.githubusercontent.com/iced-rs/iced/master/CHANGELOG.md |
| Spellcheck | NF | n/a |
| Size/memory/startup numbers | NF | n/a |

## 4. egui (+ TextEdit)

| Claim | Status | URL |
|---|---|---|
| Latest crates.io egui 0.37.0 released 2026-10-15 (0.36.2 2026-09-08, 0.36.0 2026-08-05, 0.35.0 2026-06-25); roughly monthly | CP | https://crates.io/api/v1/crates/egui/versions |
| License MIT OR Apache-2.0 | CP | https://github.com/emilk/egui |
| Platforms via eframe: Web, Linux, Mac, Windows, Android | CP | https://github.com/emilk/egui |
| Interface still changing, breaking changes each release | CP | https://github.com/emilk/egui |
| AccessKit: always a dependency (feature removed, #7701); README says native a11y APIs on Windows and macOS; changelog adds AccessKit `SetValue` and `ReplaceSelectedText` for TextEdit (#8701), AccessKit tree readable via egui_mcp inspection | CP | https://raw.githubusercontent.com/emilk/egui/main/CHANGELOG.md |
| README text on a11y: "currently implements the native accessibility APIs on Windows and macOS" | CP | https://raw.githubusercontent.com/emilk/egui/main/README.md |
| IME: 0.35.0 (2026-06-25) "improved IME": composition shown with underline and cursor (#8083), `owns_ime_events` on Memory (#7983), macOS/Safari backspace fix (#7810) | CP | https://raw.githubusercontent.com/emilk/egui/main/CHANGELOG.md |
| Open IME issues: #7975 Linux X11 + Fcitx5 preedit text not in TextEdit (2026-03-13); #7974 macOS Korean hanja candidate window cannot open with Option+Return (2026-03-13); #7941 IMEOutput lacks hint/text/input type; #4486 CompositionEnd-only characters rejected by index checks; #3532 IME input broken; #2529 Japanese IME with fcitx5; #2317 cannot switch IME on Windows 11; #8720 "Add native Chinese support"; #8763 TextEdit loses selection (0.37 regression) | CP (titles) | https://github.com/emilk/egui/issues?q=is%3Aissue+is%3Aopen+IME |
| Closed-or-open status of CJK candidate window positioning on Windows specifically | NF | n/a |
| TextEdit: README lists "text editing" with multiline, copy/paste, undo, emoji; a full code editor on egui: NF in pages opened | CP for feature list | https://github.com/emilk/egui |
| Text layout: epaint own layout (README does not name a library); non-Latin needs user fonts via `Context::set_fonts`; no bidi support statement found | CP for fonts, NF for bidi | https://raw.githubusercontent.com/emilk/egui/main/README.md |
| Image: `ui.image(egui::include_image!(..))`, `egui_extras` loaders | CP | https://github.com/emilk/egui |
| Immediate mode: frame delay for windows/grids, first-frame flicker; very large scroll areas CPU heavy | CP | https://github.com/emilk/egui |
| Spellcheck | NF | n/a |
| Size/startup numbers | NF | n/a |

## 5. Xilem / Masonry (Linebender)

| Claim | Status | URL |
|---|---|---|
| Latest crates.io xilem 0.4.0 and masonry 0.4.0, both released 2025-10-29 (masonry 0.3.0 2025-05-10); 12 months without a crates.io release | CP | https://crates.io/api/v1/crates/masonry/versions |
| Repo main is ahead of crates.io: workspace MSRV 1.96, vello 0.8, accesskit 0.24, accesskit_winit 0.32.2; the workspace pins parley 0.8 (older than current parley 0.12) | CP | https://raw.githubusercontent.com/linebender/xilem/main/Cargo.toml |
| Licence Apache-2.0 | CP | https://crates.io/api/v1/crates/xilem |
| README: "experimental Rust architecture for reactive UI" | CP | https://github.com/linebender/xilem |
| Masonry: foundational framework, any windowing lib with wgpu; Masonry Winit backend for most platforms; Android backend not yet generally usable | CP | https://raw.githubusercontent.com/linebender/xilem/main/masonry/README.md |
| Windows and macOS support explicitly stated | NF (README setup only covers Linux/BSD; winit backend implies both) | https://github.com/linebender/xilem |
| Text stack: Parley + Fontique (HarfRust shaping, ICU4X bidi/segmenting per Parley README) | CP | https://github.com/linebender/parley |
| Widgets `TextInput` and `TextArea` exist (to-do example) | CP | https://raw.githubusercontent.com/linebender/xilem/main/masonry/README.md |
| Open issue #388 "Implement first-in-class text editing widget" (2024-06-12); #1341 "Most text widgets are missing tests" (2025-08-15) | CP | https://github.com/linebender/xilem/issues?q=is%3Aissue+is%3Aopen+IME |
| IME open bugs, CJK candidate positioning | NF | n/a |
| Accessibility: built on AccessKit, central a11y event handling; screen reader quality on Windows/macOS | CP for AccessKit use, NF for quality | https://raw.githubusercontent.com/linebender/xilem/main/masonry/README.md |
| Image widget: README names none; Xilem has image support via vello/peniko | NF | n/a |
| Spellcheck | NF | n/a |
| Size/startup numbers | NF | n/a |

## 6. Makepad

| Claim | Status | URL |
|---|---|---|
| Latest crates.io makepad-widgets 1.0.0 released 2025-05-13; MIT OR Apache-2.0 on crates.io, MIT on GitHub sidebar | CP | https://crates.io/api/v1/crates/makepad-widgets |
| Repo: 2,422 commits, 37 open issues, 14 open PRs; `main` = validated milestones, `work` = fast branch; actively developed | CP | https://github.com/makepad/makepad |
| Targets: wasm/webGL, macOS/Metal, Windows/DX11, Linux/OpenGL; iOS, tvOS, Android via cargo_makepad | CP | https://github.com/makepad/makepad |
| README now pitches "AI-accelerated application and game development environment" | CP | https://raw.githubusercontent.com/makepad/makepad/main/README.md |
| Repo contains `code_editor` directory (built-in editor used by Makepad Studio); feature details not read | CP (directory), NF (details) | https://github.com/makepad/makepad |
| IME: closed issues #795 "Cannot input with fcitx on Linux" (closed 2026-09-28), #773 Chinese on web (closed 2025-07-31), #179 cannot enter/display CJK/emoji (closed 2024-10-22); open #1126 iOS TextInput crash (2026-06-16); search "IME" returned 0 open | CP | https://github.com/makepad/makepad/issues?q=is%3Aissue+accessibility+OR+%22screen+reader%22+OR+%22input+method%22+OR+CJK |
| Windows/macOS IME candidate-window positioning status | NF | n/a |
| Accessibility: open issue #196 "On Accessibility" (2023-08-08); no AccessKit or a11y feature found in README | CP (issue), NF (integration) | same issues URL as above |
| Issue #829 "including fonts-chinese: huge size of app" (closed): CJK font bundling inflates app size | CP (title) | same issues URL as above |
| Text shaping library | NF (Makepad has its own text/font code, not verified) | n/a |
| Spellcheck | NF | n/a |
| Published size/startup numbers: README mentions wasm size-reduction flags only, no numbers | CP | https://github.com/makepad/makepad |

## 7. Floem (Lapce)

| Claim | Status | URL |
|---|---|---|
| Latest crates.io floem 0.2.0 released 2024-11-14 (0.1.1 2024-01-13); nearly two years without a release; MIT | CP | https://crates.io/api/v1/crates/floem/versions |
| Repo main: 1,038 commits; "still maturing", occasional breaking changes before v1; Windows, macOS, Linux | CP | https://github.com/lapce/floem |
| Recent issue activity: #1093 (2026-10-27) "Published 0.2.0: compatible X11 IME bottom-right spot backport route"; #1090 (2026-09-27) bug fixes from a downstream fork, asking whether to submit as PRs | CP | https://github.com/lapce/floem/issues?q=is%3Aissue+is%3Aopen+IME |
| Renderers: wgpu via vger (default feature) or vello; AnyRender Skia GPU; tiny-skia CPU fallback | CP | https://github.com/lapce/floem and https://raw.githubusercontent.com/lapce/floem/main/Cargo.toml |
| Text layout on main: parley 0.7 and swash 0.2 in workspace Cargo.toml (published 0.2.0 may still use cosmic-text) | CP for main, INF for published | https://raw.githubusercontent.com/lapce/floem/main/Cargo.toml |
| Default features include `editor` (editor-core directory in repo); Lapce editor is built on Floem | CP (feature/dir), INF (Lapce is built on it, standard knowledge) | https://raw.githubusercontent.com/lapce/floem/main/Cargo.toml |
| IME: open #1024 "IME delete text support in editor" (2026-01-27) | CP | https://github.com/lapce/floem/issues?q=is%3Aissue+is%3Aopen+IME |
| Accessibility: #8 "Support Accessibility via AccessKit" open since 2023-04-14; #958 "Accessibility" closed as duplicate 2025-11-04. No integration found | CP | https://github.com/lapce/floem/issues?q=is%3Aissue+accessibility+OR+accesskit+OR+%22screen+reader%22 |
| Open crash #1020 "Keeps crashing in tiny-skia" (2026-01-21) | CP | https://github.com/lapce/floem/issues?q=is%3Aissue+is%3Aopen+IME |
| Image: `default-image-formats` default feature | CP | https://raw.githubusercontent.com/lapce/floem/main/Cargo.toml |
| Spellcheck | NF | n/a |
| Size/startup numbers | NF | n/a |

## 8. AccessKit

| Claim | Status | URL |
|---|---|---|
| accesskit 0.25.2 released 2026-10-25 (0.25.1 2026-09-25, 0.25.0 2026-08-29, 0.24.1 2026-06-12, 0.24.0 2026-02-01); accesskit_windows 0.35.2 and accesskit_macos 0.27.2 both 2026-10-25; MIT OR Apache-2.0 | CP | https://crates.io/api/v1/crates/accesskit |
| Adapters: Windows (UI Automation), macOS (NSAccessibility), also Android, iOS, Unix; "rough feature parity"; supports single-line and multi-line text input controls; no rich text or hypertext yet | CP | https://github.com/AccessKit/accesskit and https://raw.githubusercontent.com/AccessKit/accesskit/main/README.md |
| Open: #847 expose spelling/grammar errors to screen readers (2026-10-29); #836 macOS character-range lookup panics at a run boundary before empty text runs (2026-10-20); #578 which text properties are required (2025-06-19) | CP | https://github.com/AccessKit/accesskit/issues?q=is%3Aissue+text+range |
| Closed: #34 "Partial UIA text pattern implementation for plain text" (2023) | CP | same URL |
| Windows UIA TextPattern / text range completeness, caret and selection reporting in practice | NF (README says multi-line text supported; no per-pattern list read) | n/a |
| Block widgets (images) interleaved with text in the a11y tree | NF | n/a |

## 9. Parley and cosmic-text

| Claim | Status | URL |
|---|---|---|
| Parley 0.12.0 released 2026-10-09 (0.11.1 2026-08-16, 0.11.0 2026-06-26, 0.10.0 2026-06-01, 0.9.0 2026-04-21); Apache-2.0 OR MIT; MSRV 1.88 | CP | https://crates.io/api/v1/crates/parley/versions |
| Parley stack: Fontique (fonts), HarfRust (shaping), Skrifa (outlines), ICU4X (bidi, segmentation); does line breaking and bidi resolution | CP | https://github.com/linebender/parley |
| 0.12.0 introduces `parley_engine` lower-level crate (bidi levels, line-break opportunities, grapheme boundaries, shaping) | CP | https://raw.githubusercontent.com/linebender/parley/main/CHANGELOG.md |
| Preedit: changelog lists "Support for preedit for input methods in PlainEditor" (#192, #198); source has `set_compose(text, cursor)`, `clear_compose`, `finish_compose`, byte range `compose` | CP | https://raw.githubusercontent.com/linebender/parley/main/parley/src/editing/editor.rs |
| Changelog: "Editor features required by Android IME" (#334); RTL cursor navigation fix (#331) | CP | https://raw.githubusercontent.com/linebender/parley/main/CHANGELOG.md |
| In 0.12.0 the `accesskit` feature and the AccessKit integration were removed from Parley (now in the `editor` example to copy) | CP | https://raw.githubusercontent.com/linebender/parley/main/CHANGELOG.md |
| Open Parley issues: #561 share more data between HarfRust and Parley; #9 Unicode-aware line breaking (since 2021). Closed: #849 Editor::set_text left stale selection and later edits panicked (2026-09-28) | CP | https://github.com/linebender/parley/issues?q=is%3Aissue+IME+OR+preedit+OR+compose |
| Parley `complex-scripts` feature: dictionary line/word breaking for CJK, Thai, Khmer, Lao, Myanmar | CP | https://raw.githubusercontent.com/linebender/parley/main/CHANGELOG.md |
| Parley undo/redo, spellcheck | NF | n/a |
| cosmic-text 0.19.0 released 2026-04-22; MIT OR Apache-2.0 | CP | https://crates.io/api/v1/crates/cosmic-text |
| cosmic-text README: HarfRust shaping, swash rendering, own layout with bidirectional text; full feature set on Linux, macOS, Windows; roadmap lists bidirectional selection and editor items as not ready; "ready" bar not yet claimed | CP | https://github.com/pop-os/cosmic-text |
| cosmic-text IME preedit support | NF (README silent; iced's changelog handles preedit above the text layer) | https://github.com/pop-os/cosmic-text |

## Did not load

| URL | Why |
|---|---|
| https://slint.dev/terms-and-conditions | host not in session allowlist (ENOTFOUND) |
| https://docs.rs/parley/latest/parley/editing/struct.PlainEditor.html | docs.rs not in allowlist |
| https://docs.rs/egui/latest/egui/widgets/struct.TextEdit.html | docs.rs not in allowlist |
| https://docs.rs/iced/latest/iced/widget/text_editor/index.html | docs.rs not in allowlist |
| https://linuxiac.com/zed-code-editor-hits-1-0-with-gpu-accelerated-ui/ | host not in allowlist |
| https://zed.dev/blog/zed-for-windows-is-here | host not in allowlist |
| api.github.com via `gh api` for 10 repos (latest release, pushed_at, stars) | "GitHub access to this repository is not enabled" (HTTP 403). GitHub Releases pages showed empty in fetched HTML, so release dates above come from crates.io |
| Search for Makepad IME/accessibility | returned unrelated results, nothing usable |

## Conjectures

1. GPUI crates.io 0.2.2 (2025-10-22) lacks AccessKit while Zed main has it (PR #56065 merged around 2026-05-27). Confirm by diffing a newer git rev of crates/gpui or by a new crates.io release.
2. Slint accessibility goes through AccessKit on its winit backend. Confirm in the slint-ui internal/backends/winit Cargo.toml.
3. Floem published 0.2.0 still uses cosmic-text while main moved to parley. Confirm by reading the floem 0.2.0 .crate Cargo.toml.
4. Windows CJK candidate-window position is an active bug class in GPUI (three open Zed issues) and egui/iced have had fixes; absence of such an issue for Slint, Makepad, Xilem is a search gap, not evidence of correctness. Confirm with a hands-on test on Windows with Microsoft Pinyin and Japanese IME.
