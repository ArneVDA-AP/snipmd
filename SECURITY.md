# Security

SnipMD opens Markdown files from anyone. Opening one must never run code or touch files (SPEC §8).

## How the app is built for that
- No network access at runtime, no telemetry.
- Read mode HTML is sanitized with DOMPurify; the CSP forbids inline scripts; links open in the default browser and never navigate the app window.
- Rust commands only read or write files the user opened, their `<stem>.assets/` folders and `%APPDATA%\snip-md\`. Image paths in notes are resolved lexically and must stay inside the note's folder.
- The asset protocol is granted per folder at runtime. There is no general file-system plugin.

## Reporting a vulnerability
Please do not open a public issue for something that lets a note run code or reach files. Open a private [security advisory](../../security/advisories/new) with the affected files, a reproducing note, and a fix if you have one.

| Version | Supported |
|---|---|
| 1.x | yes |
| 0.1.x (prototype) | no |
