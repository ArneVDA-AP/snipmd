# Measurements (2026-10-31, this cloud sandbox)

Prototype: one window, a multiline editor holding a 400-line / 29 KB Markdown note, plus one 3840x2160 PNG shown 360 px high above it. Sources in `proto/egui` and `proto/iced`. Release build, `strip`, thin LTO.

Environment: Linux x86_64 container, Xvfb 1920x1080, no GPU; wgpu falls back to Mesa software rendering (llvmpipe/lavapipe). Rust 1.97. These numbers are **relative indicators only**: no GPU, no Windows, no DirectWrite/D3D. They are not comparable to the Windows WebView2 numbers in `docs/releasing.md`.

| | egui 0.37 (eframe, wgpu 30) | iced 0.14 (wgpu 27 + tiny-skia) |
|---|---|---|
| Stripped binary (Linux) | 21.5 MB | 19.5 MB |
| gzip -9 / xz -9 | 8.4 MB / 5.7 MB | 7.5 MB / 5.1 MB |
| Process start to first frame, warm (runs 2–4) | 55–72 ms | 122–158 ms |
| First run (cold disk cache) | 72 ms | 3743 ms (shader/pipeline setup on software Vulkan) |
| 4K PNG decode + upload | 69–83 ms | (async, not timed) |
| RSS after 60 frames, with the 4K image | 203–213 MB | 228–237 MB (peak 262–276 MB) |
| RSS after 60 frames, no image | 139 MB | 143 MB |

Reading:
- Most of the ~140 MB no-image RSS is Mesa's software renderer, which a real GPU driver replaces; a 4K RGBA image costs ~33 MB per copy (CPU + GPU texture), ~65–75 MB here. On Windows with a GPU the same app would be far smaller, but **that was not measured**.
- First frame in 55–160 ms on a CPU renderer says a native window plus editor can be on screen well under the 300 ms cold-start goal; WebView2's ~600 ms floor is the dominant cost today (SPEC §9).
- Binary size: ~5–8 MB compressed before any SnipMD code, against today's 1.37 MB installer. Still under the 10 MB budget, but 4–6x today. wgpu is most of it; a tiny-skia/softbuffer or D3D-only build would be smaller (not measured).
- Not measured, and the reason the prototype proves little about the hard part: IME (no input method in Xvfb), screen readers, spellcheck, images between lines *inside* the editor (both prototypes put the image outside the text widget; neither widget supports block widgets between lines).

## License check (2026-10-31, read from the Cargo.toml files on zed-industries/zed `main`)
| Crate | License |
|---|---|
| `gpui` | Apache-2.0 (and on `main` it now depends on `accesskit.workspace = true`) |
| `editor`, `text`, `multi_buffer`, `language` | GPL-3.0-or-later |
SnipMD is MIT (`LICENSE`, `package.json`). Using gpui gives the framework only; Zed's editor cannot be reused without relicensing SnipMD under GPL-3.0. crates.io still lists gpui 0.2.2 as the newest version.
Sources: https://raw.githubusercontent.com/zed-industries/zed/main/crates/{gpui,editor,text,multi_buffer,language}/Cargo.toml ; https://crates.io/api/v1/crates/gpui
