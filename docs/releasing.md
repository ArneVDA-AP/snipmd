# Releasing SnipMD

For maintainers. Users install from [Releases](https://github.com/ArneVDA-AP/snipmd/releases); macOS users also read [install-macos.md](install-macos.md).

## Before a tag
- The version is set in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` (and their lockfiles).
- `CHANGELOG.md` has a `## [<version>] - <date>` section written for users (what they will notice, not how it was built) and a compare link at the bottom. *Release Windows* puts that section on the release page and fails without it.
- A final release after pre-releases (`1.1.0` after `1.1.0-1`, `-2`) gets one section that says everything new since the last final release; the pre-release sections stay below it.
- The README describes the app as it is: a change a user sees updates it in the same PR.

## Windows
SnipMD ships as a per-user NSIS installer (`SnipMD_<version>_x64-setup.exe`), an MSI for managed installs, and a portable `SnipMD_<version>_x64_portable.exe`. All three run on Windows 10 and 11 (x64) with WebView2; the installer fetches WebView2 when it is missing. Target size: under 10 MB (SPEC §9).

### From a tag (the normal way)
1. Set the version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, and add a `## [<version>] - <date>` section to `CHANGELOG.md`.
2. Merge to `main` with CI green.
3. Push a tag `v<version>` on that commit. The workflow *Release Windows* (`.github/workflows/release-win11.yml`) has two jobs. `build` (read-only token) checks the tag against `package.json`, runs the typecheck and tests, builds on `windows-latest`, checks the installer size and uploads the three files as an artifact. `publish` (the only job with write access) downloads that artifact and publishes a GitHub release.

A manual run of the same workflow (Actions → Run workflow) runs `build` only: the files are workflow artifacts and nothing is published.

A version with a numeric suffix (`1.1.0-1`, tag `v1.1.0-1`) is a build for testers: it is published as a pre-release, so `Latest` stays the last tested release. The Windows MSI accepts only digits after the dash.

### Locally
Requires Node.js 22, Rust stable with the MSVC toolchain, and the Visual Studio C++ build tools.

```powershell
.\tools\release\build-win11-release.ps1
```
It runs `npm ci`, the typecheck, the tests and the release build, and copies the files to `release-win11\`. It stops at the first command that fails.

The files are not code-signed: SmartScreen warns on the first run of the setup until a signing certificate is added to the build job (the README says how to get past it).

### Smoke test of an installer
On a machine without SnipMD (or after uninstalling it and removing `%APPDATA%\com.snipmd.desktop`):
1. Run the setup. It installs without admin rights; the Start menu has SnipMD.
2. Start SnipMD: one empty tab with the core-loop hint, in the Windows theme.
3. `Win+Shift+S`, `Ctrl+V`: the screenshot shows below the cursor; type on.
4. `Ctrl+S`, Enter: `Documents\Notes\<name>.md` and `<name>.assets\` exist side by side.
5. Double-click a `.md` file in Explorer: it opens as a tab in the running window.
6. Close and start again: the tabs are back.
7. Uninstall from Settings → Apps: notes and images in `Documents\Notes` stay.

### Measuring the budgets
`tools\measure\measure.ps1 -Exe <path to snip-md.exe>` measures start to typing, paste of a 4K screenshot, memory with 5 tabs and 20 images, and the installer size, in its own data folder. Record the values in `.claude/ROADMAP.md`.

## macOS
SnipMD for macOS ships as one universal app (Apple Silicon and Intel) in `SnipMD_<version>_universal.dmg` (`SnipMD_<version>_universal.preview.dmg` while it has no Developer ID signature), for macOS 13 Ventura or later (SPEC §13). Target size: under 10 MB (SPEC §9).

### Building and publishing
The workflow *Release macOS* (`.github/workflows/release-macos.yml`) runs by hand (Actions → Release macOS → Run workflow):
1. `build` (read-only token) runs the typecheck, the unit tests and the core tests on macOS, and builds the app.
2. `tools/release/macos-package.sh` packs the app into the `.dmg`. With the Developer ID secrets below, it signs and notarizes first.
3. The `.dmg` is checked against the size budget.
4. The job installs the app from the `.dmg` the way a user does: quarantine flag, Gatekeeper's verdict, then the first-start step in [install-macos.md](install-macos.md).
5. It runs the acceptance probes (`tools/measure/macos-probe.sh`) on that copy. Any probe that does not pass fails the run.
6. The `.dmg` and the probe results are a workflow artifact.

To publish, run it on the version tag (the *Use workflow from* list → Tags → `v<version>`) with **publish** on. `publish` (the only job with write access) adds the `.dmg` to that tag's release, next to the Windows files. Pushing a tag alone publishes nothing for macOS, so a Windows release never ships a macOS build that has not passed the checklist below.

### Signing and notarization
Until SnipMD has an Apple Developer ID, builds are ad-hoc signed and Gatekeeper refuses them on first start (see [install-macos.md](install-macos.md)). With an Apple Developer account ($99 a year), add these repository secrets; the next run signs, notarizes and staples, and fails if Gatekeeper does not accept the result.

| Secret | What |
|---|---|
| `APPLE_CERTIFICATE` | The *Developer ID Application* certificate with its private key, exported from Keychain Access as `.p12`, base64-encoded (`base64 -i cert.p12 \| pbcopy`) |
| `APPLE_CERTIFICATE_PASSWORD` | The `.p12` export password |
| `APPLE_SIGNING_IDENTITY` | The certificate's name, e.g. `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID` | The Apple ID of the developer account |
| `APPLE_PASSWORD` | An app-specific password for that Apple ID (appleid.apple.com) |
| `APPLE_TEAM_ID` | The 10-character team ID |

The signing path has not run yet; the first run with real secrets is its test.

### Manual checklist
The runner checks launch, open from Finder, the flush on Cmd+Q and on the Dock's Quit, Cmd+W, paste, plain paste, replace, Cmd+H and the top bar, on every build. This list is what it cannot judge. Note the Mac, its chip and macOS version, and report each item as OK or what happened, with a screenshot where it helps, as a comment on [#30](https://github.com/ArneVDA-AP/snipmd/issues/30).

1. **First start.** One empty tab with a hint showing ⌃⇧⌘4, ⌘V, ⌘S and the thumbnail tip. The bar follows the light or dark setting, and the close, minimize and zoom buttons sit centred at its left, before the first tab. The window drags from the empty part of the bar, and the green button goes to full screen and back.
2. **Core loop, clipboard.** `⌃⇧⌘4`, select an area, then `⌘V`: the screenshot shows below the cursor at once, and typing goes on on the next line.
3. **Core loop, thumbnail.** `⇧⌘4`, select an area, and drag the floating thumbnail onto the note: the image lands where you drop it.
4. **First save.** `⌘S`, Enter: `~/Documents/Notes/<name>.md` and `<name>.assets/` sit side by side in Finder. Write down any prompt macOS shows about access to Documents.
5. **iCloud.** If *Desktop & Documents* syncs to iCloud: edit a saved note for a few minutes. No bar should say the note changed outside SnipMD.
6. **Opening notes.** Each opens the note as a tab in the running window:
   - double-click a `.md` file in Finder (after *Open With → SnipMD*, or after making SnipMD the default);
   - drop a `.md` file on the Dock icon;
   - drop a `.md` file on the window;
   - in Terminal, `open -a SnipMD note.md`.
7. **Keys.** Check each of these:
   - `⌘T` and `⌘N` open a tab, and `⌘W` closes one.
   - `⌘⇧T` brings a closed tab back.
   - `⌃Tab` and `⌘1`…`⌘9` move between tabs.
   - `⌘E` toggles read mode.
   - `⌘F` finds, and `⌘⌥F` replaces.
   - `⌘⇧V` pastes text copied from a web page as plain text.
   - `⌘H` hides the app.
   - In a note, `⌃A` and `⌃E` move to the start and end of the line.
8. **Nothing is lost.** Type and press `⌘Q` at once, then start again: the text is back. Do the same with a log-out while SnipMD is open.
9. **Sharpness.** Text and screenshots are crisp on a Retina screen.
10. **Speed.** Note how starting SnipMD and pasting a full-screen screenshot feel. With 5 tabs and 20 screenshots, Activity Monitor shows under 120 MB for SnipMD and its *SnipMD Web Content* process together (SPEC §9).
11. **Intel.** If an Intel Mac is at hand, items 1, 2 and 8 there.
