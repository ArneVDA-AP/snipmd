# UI screenshots

`before/` is `main` at the start of phase 6 (after phase 5); `after/` is the phase 6 UI system.
Both come from `tools/ui-tour/tour.cjs`: the frontend in Chromium with a mocked Tauri backend, one
shot per scene in light and dark, and the writing scene at 150% and 200% scaling.

These shots run on Linux, so Segoe UI and Cascadia Mono are replaced by fallback fonts and there is
no Mica. They show layout, colour and states.

`windows-ci/` is the real release app on a Windows Server 2025 runner (`windows-run.yml`, run 3, after
the fixes it led to): Segoe UI, WebView2, the app's CSP. Run 1 of that workflow showed the editor
without any Markdown styling (CodeMirror's styles blocked by the CSP) and a focus ring around the
text; both are fixed. The owner's machine is still the judge (`windows/`, by computer use).

| Scene | What it shows |
|---|---|
| empty | First start: one empty tab with the core-loop hint |
| write | A note with headings, a screenshot, list, link, quote and code |
| read | The same note in read mode (`Ctrl+E`) |
| tabs | Nine tabs: shrinking, separators, unsaved dots |
| firstsave | `Ctrl+S` on an untitled tab: the first-save bar |
| closed | `Ctrl+W`: the restore bar at the bottom |
| conflict | A note changed outside SnipMD while it has edits |
| error | A write that failed |
| find | `Ctrl+H`: find and replace (after only) |
| focus | `F6` to the tab strip, arrow to the next tab: the focus ring (after only) |

Run: `npx vite`, then `NODE_PATH=<dir with playwright-core> node tools/ui-tour/tour.cjs findings/ui/after`.
