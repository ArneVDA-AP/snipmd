# Lens: go native (2026-10-31)

The strongest honest case for SnipMD without a webview, the route I would take, and where the case is weakest.

**Citation key.** `R<n>` = facts-rust-gui.md line n; `P<n>` = facts-platform.md line n; `M<n>` = measurements.md line n; `S<n>` = SPEC.md line n; `A<n>` = ARCHITECTURE.md line n; `Rel<n>` = releasing.md line n; `I<n>` = issue-81.md line n; `Brief` = line counts given in the brief. **[INF]** marks my own inference, **[CMP]** a number I computed from the named inputs. NF = not found in the facts files (a search gap, not proof of absence, R3).

## 0. The case in four lines
- Cold start today is 722–784 ms, of which SnipMD's own start is 131–139 ms (Rel56, Rel57). So roughly 583–653 ms is outside SnipMD's code [CMP: 722-139, 784-131], which matches the "about 0.6 s" WebView2 floor that "an app cannot shorten" (S152). The only way to cut it is to not start a webview.
- A native window plus a multiline editor and a 4K image reached a first frame in 55–72 ms (egui) and 122–158 ms (iced) on a CPU renderer (M11, M19). That is Linux without a GPU, so it is an indicator only (M5).
- macOS workarounds exist only because of the webview: Paste as Plain Text arrives as an event because WKWebView pastes only through the Edit menu (A34, S212). A native editor owns its clipboard [INF].
- Read mode would render Markdown to native layout instead of HTML, so there is no script engine for a hostile note to reach (S129, S131) [INF]. The sanitizer becomes a parser choice: comrak scrubs raw HTML and dangerous links by default (P124).

## 1. Scored comparison

Score per cell: 3 strong per the facts, 2 usable with named gaps, 1 weak, 0 absent or NF. Sum out of 24. "In-editor" means images drawn as blocks between text lines inside the text widget, as S58 requires.

| Candidate | Maturity / maintenance | License | Editor + IME | Accessibility | Block images in editor | Spellcheck | Windows + macOS | Start / memory / size evidence | Sum |
|---|---|---|---|---|---|---|---|---|---|
| gpui (Zed) | 2: pre-1.0, breaking changes (R14); active monorepo (R18); crates.io 0.2.2 a year old, lags main (R12, R20, M28) | 3: framework Apache-2.0 (R13, M26); Zed's `editor`, `text`, `multi_buffer`, `language` are GPL-3.0-or-later, SnipMD is MIT (M27, M28) | 1: no reusable editor: Zed's is GPL (M28), the crate ships only an input example (R27); `InputHandler` with `bounds_for_range`, Win32 IME messages handled (R21); 8 open IME issues incl. Windows candidate window (R22) | 1: maintainer says no screen reader support (R23); none in 0.2.2 (R25); main now depends on accesskit (M26), PR "mostly working" (R24); text ranges NF (R26) | 0: `img()` exists (R28); in-editor NF (R29) | 0: NF (R30) | 3: Win32 + DirectWrite, Metal + CoreText (R15, R16) | 0: NF (R32) | 10 |
| Slint | 3: 1.18.1 on 2026-09-21, releases every 1–3 months (R38, R39) | 1: GPLv3 or Royalty-free 2.0, which needs an AboutSlint attribution and forbids exposing Slint APIs from the app (R40, R42) | 1: `TextEdit`/`TextInput` (R49), IME hint and position fix (R46), open #10861 (R47); full editor NF (R49) | 2: text input content and selection exposed to AT (R48); screen reader quality NF | 0: NF (R51) | 0: NF (R52) | 3: Windows, macOS (R44) | 0: design goal only, no numbers (R54) | 10 |
| iced | 1: "experimental" (R63); 11 months since 0.14.0 (R60) | 3: MIT (R62) | 1: IME fixes in 0.14 (R65); `text_editor` not read from a page (R68) | 0: issue #552 open since 2020, no AccessKit (R67) | 0: prototype widget cannot (M21) | 0: NF (R70) | 3 (R63) | 1: measured on Linux CPU only (M9–M16) | 9 |
| egui | 2: roughly monthly, breaking each release (R77, R80) | 3: MIT OR Apache-2.0 (R78) | 1: TextEdit (R86), IME improved 0.35 (R83), 9 open IME issues (R84); immediate mode, large scroll areas CPU heavy (R89) | 2: AccessKit always on, native APIs on Windows and macOS (R81, R82); quality NF | 0: prototype widget cannot (M21) | 0: NF (R90) | 3 (R79) | 1: measured on Linux CPU only (M9–M16) | 12 |
| Xilem / Masonry | 0: "experimental" (R100); 12 months without a release (R97) | 3: Apache-2.0 (R99) | 1: `TextArea` (R104), Parley preedit (R164); "first-in-class text editing widget" still an open issue (R105) | 2: built on AccessKit (R107); quality NF | 0: NF (R108) | 0: NF (R109) | 1: not stated (R102) | 0: NF (R110) | 7 |
| Makepad | 1: 1.0.0 of 2025-05 (R116); active (R117); README now pitches AI game dev (R119) | 3: MIT OR Apache-2.0 (R116) | 1: `code_editor` dir, details NF (R120); IME issues closed (R121); Win/mac candidate window NF (R122) | 0: issue #196, no integration (R123) | 0: NF | 0: NF (R126) | 3 (R118) | 0: none (R127); CJK fonts inflate size (R124) | 8 |
| Floem (Lapce) | 0: 0.2.0 of 2024-11 (R133); fixes living in downstream forks (R135) | 3: MIT (R133) | 1: `editor` feature (R138); open IME delete bug (R139) | 0: AccessKit issue open since 2023 (R140) | 0: NF | 0: NF (R143) | 2: listed (R134) | 0: NF (R144) | 6 |
| Win32 RichEdit 4.1 + TSF (Windows half of per-OS native) | 2: msftedit is the current spec (P13); D2D/DirectWrite variant unconfirmed (P17, P18); `windows` crate 0.62.2 (P35) | 0: NF | 2: TSF via SES_USECTF (P14); TSF as the IME route is inferred (P20) | 0: NF | 0: NF (SES_CTFALLOWEMBED is a TSF flag, P14) | 2: Spell Checking API (P21), SES_CTFALLOWPROOFING (P14) | 1: Windows only | 0: NF; Notepad-on-RichEdit unconfirmed (P92) | 7 |
| AppKit / TextKit 2 (macOS half) | 1: objc2-app-kit no release in 12+ months (P45, P49) | 3: MIT/Apache/Zlib (P47) | 0: NF (P43, P48) | 0: NF | 0: NF (P43) | 0: NF (P44) | 1: macOS only | 0: NF | 5 |
| WinUI 3 via windows-reactor | 0: "preview" (P32), crate 6 months old (P33); windows-app-rs archived (P36) | 0: NF | 0: RichEditBox exposure NF (P34) | 0: NF | 0: NF | 0: NF | 1: Windows only | 0: NF | 1 |
| Hybrid: native editor (gpui row) + WebView2 read mode | as gpui | as gpui | as gpui | editor as gpui; read mode NF | as gpui | as gpui | 3 | 1: today's WebView2 numbers (Rel53–Rel57); cold start is WebView2's bottleneck (P56), memory grows per control (P57) | 11 |

Reading the table:
- The block-images column is 0 everywhere: no text widget in the facts draws blocks between lines (R29, R51, M21). Whatever the stack, SnipMD writes its own editor element. That moves the choice from "best text widget" to "best base for a custom editor" [INF].
- Spellcheck has no evidence on any Rust stack (R6). SPEC names spellcheck only to turn it off in the find fields (S66), so it is not a stated requirement for the note [INF from S55–S70].
- No row has Windows numbers; every speed claim for native rests on M11 (Linux, CPU).

## 2. Pick: gpui, pinned to a Zed git revision, with SnipMD's own editor element

egui sums two points higher (12 vs 10). The licence check (M23–M28) removed gpui's biggest asset: SnipMD is MIT, so Zed's editor cannot be reused and gpui gives the framework only (M28). Every route now writes its own editor element (section 1). I still pick gpui, by a thin margin, on three things the columns do not weigh:
1. **Platform text.** gpui shapes with DirectWrite on Windows and CoreText on macOS (R15, R16, R31). SnipMD's look is Segoe UI Variable and Cascadia Mono with system fonts and no web fonts (A68, S53). egui uses its own layout and needs non-Latin fonts supplied through `set_fonts` (R87); Makepad shows where bundling CJK fonts leads (R124). [INF: system fallback for emoji and CJK comes with DirectWrite, not with egui.]
2. **Proof that the framework carries an editor.** gpui is the only stack in the facts under a shipping code editor on Windows (R27, R17 INF, P88). That is evidence of feasibility, not code: the editor crates are GPL-3.0-or-later (M27). Its IME hook (`InputHandler::bounds_for_range`, R21) is what a custom element needs. egui's TextEdit and iced's `text_editor` would be replaced too (M21) [INF]. [INF: SnipMD's editor should be written without copying from Zed's GPL crates, so reading them as a design guide carries a licence risk the owner may want checked.]
3. **Retained rendering for long notes.** egui warns that very large scroll areas are CPU heavy (R89); SnipMD notes are "short text with many screenshots" (S9), i.e. tall scroll areas of large textures [INF].

Why it beats the others:
- **egui** (runner-up): wins today on accessibility (R81), though gpui main now depends on accesskit (M26), which narrows that lead. If the owner makes a working screen reader a gate before any code, egui or Slint is the pick and gpui waits for its AccessKit work to reach a pinned revision (R24, conjecture 1 at R189). That choice belongs to the owner.
- **Slint**: the Royalty-free licence requires an About screen or a public badge and forbids exposing Slint APIs (R42). SnipMD has invisible chrome on Windows (S27); the macOS About item exists (S213). The API clause collides with any plugin UI (I3) [INF]. GPLv3 is the other door, but SnipMD is MIT (M28).
- **iced, Xilem, Floem, Makepad**: experimental or stale on crates.io (R60, R63, R97, R100, R133), and no accessibility except Xilem's AccessKit base (R67, R107, R123, R140).
- **Per-OS native**: on Windows it is the only route with spellcheck and TSF evidence (P14, P21), but its accessibility, image embedding and licence cells are NF, the macOS half is NF almost throughout (P43–P49), WinUI from Rust is preview or archived (P32, P36), and it means two UIs for one product [INF]. It wins only if Windows-only stays acceptable for good.
- **Hybrid**: keeps WebView2 installed and started, so the ~0.6 s floor (S152) moves to the first `Ctrl+E` instead of disappearing, adds a second engine's memory (P57), and must keep writing and reading highlighted "with the same colours" across two renderers (S65) [INF]. It is a reasonable interim step, not an end state. Its real merit: read mode is already a lazy chunk (A33), so the cost would be paid only by users who read.

- **Open option for the owner, not closed here: relicense SnipMD to GPL-3.0.** It would allow reusing Zed's `editor`, `text`, `multi_buffer` and `language` crates (M27, M28) and Slint's GPLv3 door (R41). Consequences: the editor phase shrinks by most of its 7–11k lines [INF], but SnipMD takes on Zed's editor and its dependency tree, whose size against the 10 MB budget (S148) is NF, plus Zed's pre-1.0 churn (R14); every contributor's MIT code changes licence terms, and third-party plugins linking against a GPL host raise their own licence question [INF]. Staying MIT keeps the estimate in section 4 as written.

## 3. Plugins without a webview (#81)

Pick: **WebAssembly components on wasmtime**, the model Zed ships.
- Zed's extensions are Rust compiled to `wasm32-wasip2` against a WIT world (P109, P110), hosted on `wasmtime` + `wasmtime-wasi` (P111). A gpui app would follow a working precedent in the same ecosystem [INF].
- #81 wants manifest capabilities enforced in Rust and plugins that never write files (I3). A WIT world imports only what the host grants, so a capability is an import the host leaves out [INF from P110].
- Extism: active, 14 host SDKs (P105), but it names neither its runtime nor the component model (P106), so typed interfaces are unknown.
- wasmi: an interpreter for plug-in use, wasip1 only, no component model mentioned (P103). Useful fallback if wasmtime's size breaks the 10 MB budget (S148); wasmtime's size is NF (P104).
- rquickjs: smallest stated engine (P107), and JS fits a "users and agents write their own" guide (I2) [INF], but MSVC x86_64 is marked experimental (P107), which is SnipMD's primary target (S7).
- mlua: sandboxing is offered for Luau only (P108).
- None: #81's phase 1 is a first-party registry (I3), which needs no runtime at all. Shipping phase 1 as Rust traits and deferring third-party code is an open option with zero size cost [INF].

What #81 loses on this route: the CodeMirror editor-extension point and the CSS layer (I3) have no counterpart; a plugin cannot draw UI and would describe it for the host to render [INF]. The iframe-vs-worker memory question (I4) disappears. The #81 design and this route must be decided together, or one of them is wasted work [INF].

## 4. Migration path

Rule for every phase: the Tauri build stays the release until the native build passes the full release checklist (Rel38–Rel44) and the §9 budgets with `measure.ps1` (Rel47). Data safety never moves: atomic writes, `create_new` naming, cleanup and the stamped write are already in `snipmd-core`, which has no Tauri dependency (A12–A15, A40, Brief).

| Phase | Moves | Gate | Size [INF unless cited] |
|---|---|---|---|
| 0 Spike | gpui window on Windows: DirectWrite text, a 4K texture, IME candidate window with Microsoft Pinyin and Japanese, NVDA on a main revision with AccessKit (R24) | Go/no-go: IME placement and NVDA reading the text; cold start and memory measured on the Rel49 machine | 1–2 person-weeks |
| 1 Core first | Decisions still in TypeScript move into `snipmd-core`: tab and closed-tab model (A66, A67), link rewriting on promotion (S108, S111), paste rules (S99–S102), slug names (S87), list renumbering as text functions (A65). The shipping Tauri app calls them, so they are tested in production before any native UI exists | `cargo test -p snipmd-core` plus the existing Vitest suite green | 2–3k lines moved, 3–5 weeks |
| 2 Shell | Native binary: tab strip, info bar, command menu, first-save bar, F6 regions, light/dark, Mica (S32–S52, S171). Plain editor. Dogfooded with `SNIPMD_DATA_DIR` (A44) so it never shares a live `session.json` with the release | Core loop works end to end on Windows | 2.5–4k lines |
| 3 Editor parity | Own editor element: rope, undo groups that survive tab switches (S67), Markdown styling, lists (S60–S64), block images with expand and "image not found" (S58), find/replace with count (S66), lazy code languages (S65), clipboard text and image, drop, IME, AccessKit text nodes | Vitest cases (5,362 lines, Brief) ported as Rust tests; §9 on Windows | 7–11k lines |
| 4 Read mode | comrak or pulldown-cmark (P121–P124) to native layout; task checkboxes and Copy buttons stay app-owned (S132) | `evil.md` check (Rel42) | 1.5–2.5k lines |
| 5 macOS | Menu bar, Finder open, Cmd+Q flush, native buttons (S212–S231); the logic in `macos.rs` (A43) moves | `macos-probe.sh` set (A51) | 0.8–1.5k lines |
| 6 Switch | Native build as a pre-release in the same data folder (A73), session format unchanged (A25) so the Tauri build stays a lossless rollback for one release | Install-over check (Rel43) | n/a |

**Estimate.** 12–20k new Rust lines plus 4–6k lines of ported tests [CMP: sum of the phase ranges 2.5+7+1.5+0.8 = 11.8k to 4+11+2.5+1.5 = 19k, rounded]. At 300–500 tested lines per person-week for editor and platform code [conjecture; confirm against phase 2 velocity], that is **25–65 person-weeks**, about 40 as a central guess [CMP: 12k/500 = 24, 20k/300 = 67]. Reasoning: today's 4,209 TS lines (Brief) are small because CodeMirror, the browser's text input, IME, accessibility, clipboard and CSS do the heavy work; going native means writing that layer, so 3–5x the current frontend is the honest order [INF]. The estimate already assumed an editor written by SnipMD, so the licence check (M28) leaves it unchanged; it rules out the shortcut of reusing Zed's editor under MIT.

**What survives.** All of `snipmd-core` (2,122 lines, Brief). From the 910-line Tauri crate, the allowed-set checks and command bodies become direct calls; the Tauri glue goes [INF: about half]. The TypeScript survives as behaviour, not code: the Vitest cases, the colour tokens and the WCAG contrast pairs (A36), and Snip's sprite paths as data (A31). The files on disk, `session.json` and the data folder stay byte for byte the same.

## 5. Weakest point

**Go-native spends its largest effort on the parts no source shows to be solved, to fix a budget that is already green.**
- Every §9 budget passes today: cold start 722–784 ms under 1 s, memory 98–104 MB under 120 MB, installer 1.37 MB (Rel53–Rel57). The one measured native win is a Linux CPU first frame (M11); memory on Windows is unmeasured (M18) and the installer would grow 4–6x before any SnipMD code (M20).
- The features that make SnipMD usable for everyone, IME, screen readers and images between lines, are 0 or NF in every row, and the prototype "proves little about the hard part" (M21). The webview gives all three today [INF: CodeMirror in WebView2 already passes the S58 behaviour].
- The chosen stack ships no screen reader support in its published crate (R23, R25), and under MIT it brings no editor at all (M28): the hardest component is greenfield on every route. A switch before phase 0 proves NVDA works would be an accessibility regression [INF].
- The cost, 25–65 person-weeks, is set against a frontend of 4,209 lines that meets its spec.

The case is strongest if the owner values the ~0.6 s cold start (S152), a script-free read mode and a webview-free plugin model enough to fund phase 0 as a cheap, falsifiable test. It is weakest as a plan to commit to before that spike.
