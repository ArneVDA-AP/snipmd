# SnipMD

SnipMD is a lightweight Markdown editor and scratchpad for Windows 11 built with Tauri v2 and CodeMirror 6. It is designed for taking quick notes and pasting clipboard screenshots directly into plain-text Markdown files without manual file dialogs or proprietary vaults.

## Features

- **Inline clipboard screenshots**: Press `Ctrl + V` after taking a screenshot (`Win + Shift + S`) to save the image to a local `.assets/` directory and insert a standard `![snip](.assets/...)` link. Screenshots render inline inside the editor.
- **Scratchpad tabs & session restore**: Open unsaved tabs (`Ctrl + T`), write notes, and close the app without save prompts. Unsaved buffers and cursor positions are restored automatically on launch.
- **Automatic asset management**:
  - Saved files store images in a sibling `.assets/` folder next to the `.md` file.
  - Unsaved tabs store images in `%APPDATA%\snip-md\scratchpad\.assets\`. Saving a scratch tab moves its referenced images to the target folder and cleans up unused files from the scratchpad directory.
- **Multiple view modes**: Switch between the raw editor with inline images, a rendered HTML preview, or a side-by-side split view (`Ctrl + E`).
- **Native footprint**: Uses the system WebView2 runtime and a Rust backend, resulting in a ~3.5 MB binary and fast startup.

## Installation

Pre-built Windows 11 (x64) packages can be built locally or downloaded from the [Releases](../../releases) page:

- **Installer (`.exe`)**: Per-user NSIS setup with optional `.md` and `.markdown` file associations.
- **MSI Package (`.msi`)**: Standard Windows Installer package.
- **Portable (`.exe`)**: Standalone executable requiring no installation.

*Note: Windows 11 includes the Microsoft Edge WebView2 runtime by default.*

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + T` | New scratchpad tab |
| `Ctrl + O` | Open `.md` or `.markdown` file |
| `Ctrl + S` | Save active tab |
| `Ctrl + W` / Middle-click | Close tab |
| `Ctrl + Tab` | Next tab |
| `Ctrl + E` | Cycle view mode (Editor / Preview / Split) |
| `Ctrl + \` | Toggle side panel (Assets, Outline, Themes) |
| `Ctrl + V` | Paste text or clipboard image |

Click any inline screenshot in the editor to toggle between its compact preview height (`360px`) and full resolution.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v20.19+ or v22 LTS)
- [Rust](https://rustup.rs/) (stable toolchain with `x86_64-pc-windows-msvc`)
- Microsoft C++ Build Tools (for native Windows builds)

### Setup

Install dependencies:

```bash
npm install
```

Run the frontend in a browser (uses an in-memory virtual filesystem for testing without Rust):

```bash
npm run dev
```

Run the native desktop app in development mode:

```bash
npm run tauri:dev
```

### Building from Source

To build the production Windows installers (`.exe` and `.msi`):

```bash
npm run release:win11
```

On Windows, you can also run `.\build-win11-release.ps1` (or `build-win11-release.bat`) to compile and copy the NSIS installer, MSI package, and portable executable into `./release-win11/`.

## Documentation

- [Architecture](./ARCHITECTURE.md) — IPC commands, asset lifecycle, and editor state design
- [Specification](./SPEC.md) — Functional requirements and behavior details
- [Windows 11 Packaging](./RELEASE-WIN11.md) — Build scripts and installer configuration
- [Contributing](./CONTRIBUTING.md) — Development workflow and pull request guidelines
- [Security](./SECURITY.md) — Local storage model and security policy

## License

[MIT](./LICENSE)
