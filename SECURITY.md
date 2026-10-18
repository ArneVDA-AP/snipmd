# Security Policy

## Local-First Privacy Architecture

SnipMD is a strictly **local-first** desktop application:
- **Zero Telemetry or Cloud Sync**: SnipMD makes no external network requests, collects no analytics, and transmits no user notes or screenshots over the internet.
- **Scoped Tauri v2 Capabilities**: Native OS permissions are explicitly restricted in [`src-tauri/capabilities/default.json`](./src-tauri/capabilities/default.json) to window controls, native file open/save dialogs, and local file operations.
- **Asset Protocol Scoping**: `protocol-asset` is used exclusively to stream local `.assets/snip-*.png` files into the local WebView2 renderer (`convertFileSrc`).

---

## Supported Versions

| Version | Supported |
| :--- | :--- |
| `0.1.x` | :white_check_mark: Active support |

---

## Reporting a Vulnerability

If you discover a security vulnerability (for example, path traversal in `.assets/` resolution, unsafe HTML injection in the Markdown previewer, or privilege escalation in Tauri IPC commands):

1. **Do not open a public GitHub issue** if the vulnerability allows arbitrary file access or code execution.
2. Open a private [GitHub Security Advisory](../../security/advisories/new) in this repository with:
   - Affected file(s) and IPC command(s)
   - Reproduction steps or proof-of-concept Markdown payload
   - Suggested mitigation (if available)

We aim to acknowledge reports within 48 hours and publish a patched release within 7 days.
