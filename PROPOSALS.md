# Proposals

Ideas outside SPEC.md v1 (§12). Nothing here is built without the owner's agreement.

| # | Idea | Why | Cost |
|---|---|---|---|
| 1 | Window title follows the active tab (`labo-04.md — SnipMD`) | The taskbar and Alt+Tab show which note is open | Needs the `core:window:allow-set-title` permission, which widens the capability set |
| 2 | Use the Windows accent colour instead of the Fluent default blue | Matches the user's system | WebView2 has no CSS `AccentColor`; needs a Rust command reading the registry and a listener for changes |
| 3 | Hanging heading marks (`#` in the left margin) | Heading text lines up with body text | A mark decoration with negative margin; fragile with wrapping |
