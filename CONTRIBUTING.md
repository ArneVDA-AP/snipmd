# Contributing to SnipMD

## Before you change anything
- `SPEC.md` decides what SnipMD does. If your change alters behaviour, change the spec first and say why.
- `CLAUDE.md` lists the guardrails (data safety, security, editor, UX) and the code conventions. They apply to every change, whoever writes it.
- v1 scope is `SPEC.md` §12. Ideas outside it go to `PROPOSALS.md` as a row, not into code.

## Setup
Node.js 22 and Rust stable; Windows 10 or 11 to run the app (`npm run tauri dev`).

```
npm ci
npm run lint && npm test && npm run build
cd src-tauri && cargo test -p snipmd-core && cargo check
```
CI runs the same on `windows-latest` for every push.

## Pull requests
- One concern per PR, on its own branch; CI green before review.
- Add tests that fail without your change. UI changes come with before and after screenshots from `tools/ui-tour/tour.cjs`; colour changes keep `src/styles/contrast.test.ts` green.
- Behaviour that only exists on Windows (clipboard, Explorer, file association, Mica) needs a written Windows test in the PR.
- New dependencies need a reason that fits SPEC §9 (size, startup time).
