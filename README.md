# SnipMD

**Paste, type, keep going.** A Windows note-taking app where a screenshot is as easy as a sentence.

1. `Win+Shift+S`: snip part of the screen with the Windows tool.
2. `Ctrl+V`: the image appears in your note, below the cursor, already saved to disk.
3. Keep typing. No dialog, no toast.

Notes are plain Markdown files with an image folder next to them (`labo-04.md` + `labo-04.assets/`), so they open without loss in VS Code, Obsidian and on GitHub. SnipMD never asks anything while you write and never loses anything: untitled notes, their screenshots and closed tabs survive a crash, Alt+F4 or a restart.

| Writing (light) | Read mode (dark) |
|---|---|
| ![SnipMD writing a note with a screenshot, light theme](docs/images/write-light.png) | ![The same note in read mode, dark theme](docs/images/read-dark.png) |

*The release build on Windows, captured by `windows-run.yml` on a GitHub runner. The runner is Windows Server, so it shows no Mica.*

## Status
**1.0.0 is feature complete and not released yet.** Every part of [`SPEC.md`](SPEC.md) v1 is built, reviewed and passes CI on Windows. Before the tag, it still needs a hands-on pass on a real Windows 11 laptop: the manual tests listed in [`PLAN.md`](PLAN.md) (Status), the UI at 150% and 200% scaling, and the start time on real hardware. Until then there is no download; [build it yourself](#install).

## What it does
- **Tabs** for notes. Untitled tabs live in the session until you save them. Closing asks nothing, and `Ctrl+Shift+T` brings the tab back, also after a restart.
- **Screenshots inline.** Every local image link shows below its line, capped at 360 px; a click shows it at full size. Drop image files on a note to copy them in.
- **Saving.** Notes save themselves a second after you stop typing, on blur and on close. Writes are atomic and keep the file's line endings and BOM. The first `Ctrl+S` of a new note proposes a name from its first heading.
- **Changed outside SnipMD.** A clean tab reloads. A tab with edits shows *Open disk version · Reload · Keep mine*.
- **Read mode** (`Ctrl+E`) renders the note, sanitized: a Markdown file from someone else cannot run code or reach files.
- **Find and replace** (`Ctrl+F`, `Ctrl+H`) and light Markdown styling: larger headings, dimmed syntax, code and quotes set apart.
- **Looks native.** Fluent colours and type, the Windows light or dark setting, and Mica behind the tab bar on Windows 11.

## Keyboard
| Keys | Action |
|---|---|
| `Ctrl+T` / `Ctrl+N` | New tab |
| `Ctrl+O` | Open a file |
| `Ctrl+S` / `Ctrl+Shift+S` | Save / Save As |
| `Ctrl+W` / `Ctrl+Shift+T` | Close tab / restore it |
| `Ctrl+Tab`, `Ctrl+1`…`9` | Next tab, go to tab N |
| `Ctrl+E` | Read mode |
| `Ctrl+F` / `Ctrl+H` | Find / replace |
| `Ctrl+Shift+V` | Paste as plain text |
| `F6` | Move focus between note, info bar and tabs |

In the tab strip, the arrows, `Home` and `End` move between tabs; `Enter` opens one and `Delete` closes one.

## Quality
### Performance (SPEC §9)
Measured with [`tools/measure/measure.ps1`](tools/measure/measure.ps1) on the release build, on GitHub's `windows-latest` runner (Windows Server 2025, no GPU). Raw output is in [`findings/windows-ci/`](findings/windows-ci/).

| Budget | Target | Measured | |
|---|---|---|---|
| Ctrl+V to a 4K screenshot visible | < 150 ms | 66–96 ms (median, 4 runs) | within |
| Memory, 5 tabs and 20 images | < 120 MB | 90 MB private working set | within |
| Installer | < 10 MB | 1.36 MB (NSIS) | within |
| Startup JavaScript | as small as the first paint needs | 399 KB (131 KB gzip); read mode loads later | |
| Double-click to typing | < 300 ms | 520–1126 ms on the runner | **open** |

The start time on the runner is mostly WebView2: the page's first script runs about 460 ms after the process starts, and SnipMD's own work up to a tab that takes keys is about 60 ms. A GPU-less server VM says little about a laptop, so the budget is judged on real hardware before 1.0.0.

### Data safety
- Notes and the session are written atomically (temp file, flush, rename).
- A write is refused when the file changed on disk since the tab last saw it.
- A new image never overwrites an existing file.
- A screenshot still being saved when you press Alt+F4 or close its tab still lands in the note.
- An unreadable `session.json` is set aside, never overwritten.
- Cleanup only touches SnipMD's own scratch folder, never anything next to your notes.

The rules are in [`CLAUDE.md`](CLAUDE.md) (Guardrails); the behaviour is in [`SPEC.md`](SPEC.md) §6 and §7.

### Security
- Every opened `.md` is treated as untrusted. Read mode is sanitized with DOMPurify.
- The CSP is strict and uses Tauri's nonces, so no inline script runs.
- Rust checks every path against the allowed set: the notes you opened, their image folders, and SnipMD's data folder.
- There is no general file-system plugin, and image access is granted per folder.
- Links open in your browser, never in the app window.

See [`SECURITY.md`](SECURITY.md) and SPEC §8; [`fixtures/evil.md`](fixtures/evil.md) is the test note.

### How it is checked
- **CI on Windows** for every push: typecheck, 284 frontend unit tests (Vitest), the frontend build, 57 Rust tests (`snipmd-core`) and a check of the Tauri crate.
- **Release workflow.** It builds the installer, checks that the tag matches the version, and fails above 10 MB.
- **Real-window runs.** A manual workflow (`windows-run.yml`) builds the release app on a Windows runner, measures the budgets, screenshots the real window and runs a clean install. Its first run found two defects that unit tests and the browser could not see:
  - Tauri's CSP nonces blocked the editor's styles;
  - a focus ring sat around the text.

  Both are fixed.
- **Reviews.** Every phase got an adversarial review before merge, and the whole app got seven more rounds. Every blocker and major was fixed with a test that fails without the fix. The reviews and their resolutions are in [`review/`](review/).

### Known limits
- Windows 10 and 11 only (x64, WebView2).
- The open Windows tests and the start-time budget are listed above and in `PLAN.md`.
- Ideas outside the v1 scope are collected in [`PROPOSALS.md`](PROPOSALS.md).

## Install
There is no release yet. To build the installer yourself on Windows, you need Node.js 22, Rust stable with the MSVC toolchain, and the Visual Studio C++ build tools:

```powershell
npm ci
npx tauri build    # src-tauri\target\release\bundle\nsis\SnipMD_<version>_x64-setup.exe
```

The installer installs per user without admin rights, registers `.md` and `.markdown`, and fetches WebView2 if Windows lacks it. [`RELEASE-WIN11.md`](RELEASE-WIN11.md) covers releases and the smoke test.

## Develop
Tauri v2 (Rust) with vanilla TypeScript, Vite, CodeMirror 6 and `marked`; no UI framework. Logic that needs no Tauri lives in the crate `src-tauri/core` (`snipmd-core`) and tests on any OS.

```
npm ci
npm run tauri dev        # run the app
npm run lint             # typecheck
npm test                 # frontend unit tests
npm run build            # frontend bundle
cd src-tauri
cargo test -p snipmd-core
cargo check              # needs Windows (or GTK/WebKit on Linux)
```

- `tools/ui-tour/tour.cjs` screenshots every UI state in a browser with a mocked backend (`findings/ui/`).
- `tools/measure/` measures the budgets, screenshots the real window and smoke-tests the installer on Windows.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) explains the code; [`CONTRIBUTING.md`](CONTRIBUTING.md) gives the rules for changes.

SnipMD is built with Claude (Anthropic) as the main author, working from `SPEC.md` and `PLAN.md`. The history of that work is in `PLAN.md`, `review/` and `findings/`.

## License
MIT
