# Releasing SnipMD for macOS

SnipMD for macOS ships as one universal app (Apple Silicon and Intel) in `SnipMD_<version>_universal.dmg` (`SnipMD_<version>_universal.preview.dmg` while it has no Developer ID signature), for macOS 13 Ventura or later (SPEC §13). Target size: under 10 MB (SPEC §9).

## Building and publishing
The workflow *Release macOS* (`.github/workflows/release-macos.yml`) runs by hand (Actions → Release macOS → Run workflow):
1. `build` (read-only token) runs the typecheck, the unit tests and the core tests on macOS, and builds the app.
2. `tools/release/macos-package.sh` packs the app into the `.dmg`. With the Developer ID secrets below, it signs and notarizes first.
3. The `.dmg` is checked against the size budget.
4. The job installs the app from the `.dmg` the way a user does: quarantine flag, Gatekeeper's verdict, then the first-start step in *Installing an ad-hoc build*.
5. It runs the acceptance probes (`tools/measure/macos-probe.sh`) on that copy. Any probe that does not pass fails the run.
6. The `.dmg` and the probe results are a workflow artifact.

To publish, run it on the version tag (the *Use workflow from* list → Tags → `v<version>`) with **publish** on. `publish` (the only job with write access) adds the `.dmg` to that tag's release, next to the Windows files. Pushing a tag alone publishes nothing for macOS, so a Windows release never ships a macOS build that has not passed the checklist below.

## Signing and notarization
Until SnipMD has an Apple Developer ID, builds are ad-hoc signed and Gatekeeper refuses them on first start (see *Installing an ad-hoc build*). With an Apple Developer account ($99 a year), add these repository secrets; the next run signs, notarizes and staples, and fails if Gatekeeper does not accept the result.

| Secret | What |
|---|---|
| `APPLE_CERTIFICATE` | The *Developer ID Application* certificate with its private key, exported from Keychain Access as `.p12`, base64-encoded (`base64 -i cert.p12 \| pbcopy`) |
| `APPLE_CERTIFICATE_PASSWORD` | The `.p12` export password |
| `APPLE_SIGNING_IDENTITY` | The certificate's name, e.g. `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID` | The Apple ID of the developer account |
| `APPLE_PASSWORD` | An app-specific password for that Apple ID (appleid.apple.com) |
| `APPLE_TEAM_ID` | The 10-character team ID |

The signing path has not run yet; the first run with real secrets is its test.

## Installing an ad-hoc build
1. Download the `.dmg` (from the release, or from the workflow run's artifact `SnipMD-macos-universal`).
2. Open it and drag SnipMD to Applications.
3. The first start is refused ("cannot be opened" or "Apple could not verify"). Either:
   - System Settings → Privacy & Security → *Open Anyway* next to SnipMD, then confirm; or
   - in Terminal: `xattr -dr com.apple.quarantine /Applications/SnipMD.app`.

   After that SnipMD starts normally.

## Manual checklist
The runner checks launch, open from Finder, the flush on Cmd+Q and on the Dock's Quit, Cmd+W, paste, plain paste, replace, Cmd+H and the top bar, on every build. This list is what it cannot judge. Note the Mac, its chip and macOS version, and report each item as OK or what happened, with a screenshot where it helps, as a comment on [#30](../../issues/30).

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
