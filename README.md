# SnipMD

**Paste, type, keep going.** A Windows note-taking app where a screenshot is as easy as a sentence.

1. `Win+Shift+S`: snip part of the screen with the Windows tool.
2. `Ctrl+V`: the image appears in your note, below the cursor, already saved to disk.
3. Keep typing. No dialog, no toast.

| Writing | Reading (`Ctrl+E`) |
|---|---|
| ![SnipMD writing a note with a screenshot, light theme](docs/images/write-light.png) | ![The same note in read mode, dark theme](docs/images/read-dark.png) |

## Your notes stay yours
Notes are plain Markdown files with an image folder next to them (`labo-04.md` + `labo-04.assets/`). They open without loss in VS Code, Obsidian and on GitHub, and they keep working if you stop using SnipMD.

## It never loses anything
- **Untitled notes survive a crash, Alt+F4 or a restart**, together with their screenshots. A screenshot that is still being saved when you close still lands in the note.
- **Closing a tab asks nothing.** `Ctrl+Shift+T` brings it back, also after a restart.
- **Notes save themselves** a second after you stop typing, when you switch away and when you close. Every write replaces the file in one step, so a crash never leaves half a note. The file keeps its line endings and encoding.
- **SnipMD watches for changes made elsewhere.** If another app changes the note, a tab without edits reloads. A tab with edits asks *Open disk version · Reload · Keep mine*; it never overwrites the other change without asking.

## What else it does
- **Tabs** for notes. The first `Ctrl+S` of a new note proposes a name from its first heading.
- **Screenshots inline.** Every local image link shows below its line; a click shows it at full size. Drop image files on a note to copy them in.
- **Read mode** (`Ctrl+E`) shows the note rendered.
- **Find and replace** (`Ctrl+F`, `Ctrl+H`) and light Markdown styling: larger headings, dimmed syntax, code and quotes set apart.
- **Looks like Windows.** It follows the light or dark setting, with Mica behind the tab bar on Windows 11.
- **Small and quick.** A 1.4 MB installer; a 4K screenshot shows in under 0.1 s after `Ctrl+V`.

## Safe with notes from others
A Markdown file someone sends you can't run code or reach your files through SnipMD:
- Read mode is sanitized.
- Images load only from the note's own folder.
- Links open in your browser.

SnipMD makes no network connections and collects nothing. See [`SECURITY.md`](SECURITY.md).

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

## Install
SnipMD runs on Windows 10 and 11 (x64).

**Version 1.0 is not released yet.** Once it is, download `SnipMD_<version>_x64-setup.exe` from [Releases](../../releases). The installer needs no admin rights, registers `.md` and `.markdown`, and fetches WebView2 if Windows lacks it.

Until then you can build it yourself. You need Node.js 22, Rust with the MSVC toolchain, and the Visual Studio C++ build tools:

```powershell
npm ci
npx tauri build
```

The installer is then in `src-tauri\target\release\bundle\nsis\`.

## Contributing
See [`CONTRIBUTING.md`](CONTRIBUTING.md). The behaviour is specified in [`SPEC.md`](SPEC.md), and the code is explained in [`ARCHITECTURE.md`](ARCHITECTURE.md). SnipMD is built with Claude (Anthropic) as the main author.

## License
MIT
