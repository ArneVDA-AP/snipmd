# Proposals

Ideas outside SPEC.md v1 (§12). Nothing here is built without the owner's agreement.

| # | Idea | Why | Cost |
|---|---|---|---|
| 1 | Window title follows the active tab (`labo-04.md — SnipMD`) | The taskbar and Alt+Tab show which note is open | Needs the `core:window:allow-set-title` permission, which widens the capability set |
| 2 | Use the Windows accent colour instead of the Fluent default blue | Matches the user's system | WebView2 has no CSS `AccentColor`; needs a Rust command reading the registry and a listener for changes |
| 3 | Hanging heading marks (`#` in the left margin) | Heading text lines up with body text | A mark decoration with negative margin; fragile with wrapping |
| 4 | Keep SnipMD ready in the background: closing hides the window and empties the editor; a later double-click shows it again | A start after closing drops from about 0.7 s to about 0.1 s (inferred; a hidden probe window showed in 51 ms) | About 85 MB idle memory; changes the close life cycle (flush, installer and updater must stop the hidden instance, `Cmd+Q` on macOS); the first start of the day stays cold unless SnipMD starts at sign-in |
