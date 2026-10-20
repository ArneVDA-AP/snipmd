# SnipMD

Paste, type, keep going. A Windows note-taking app where a screenshot is as easy as a sentence: `Win+Shift+S`, `Ctrl+V`, and the image is in your note and on disk. Notes stay plain Markdown files.

Status: work in progress. The product spec is in [`SPEC.md`](SPEC.md), the road from the prototype to v1 in [`PLAN.md`](PLAN.md).

## Stack
Tauri v2 (Rust) + vanilla TypeScript + Vite + CodeMirror 6 + `marked`. Pure logic lives in the Tauri-free crate `src-tauri/core` (`snipmd-core`).

## Develop
Requires Node.js 22 and Rust stable. Windows 11 for the app itself.

```
npm ci
npm run tauri dev        # run the app
npm run lint             # typecheck
npm test                 # frontend unit tests
npm run build            # frontend bundle
cd src-tauri
cargo test -p snipmd-core
cargo check
```

On Linux, `cargo check` of the Tauri crate needs the GTK/WebKit system libraries; `cargo test -p snipmd-core` does not.

## License
MIT
