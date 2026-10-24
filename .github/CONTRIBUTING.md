# Contributing to SnipMD

## Before you change anything
- [`docs/SPEC.md`](../docs/SPEC.md) decides what SnipMD does. If your change alters behaviour, change the spec first and say why.
- [`.claude/CLAUDE.md`](../.claude/CLAUDE.md) lists the guardrails (data safety, security, editor, UX) and the code conventions. They apply to every change, whoever writes it.
- The scope is SPEC §12. Ideas outside it go into a feature request (an issue), not into code.
- [`.claude/ROADMAP.md`](../.claude/ROADMAP.md) says what is open; known follow-ups are GitHub issues. How the code is laid out: [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md); how to release: [`docs/releasing.md`](../docs/releasing.md). The design history of v1 is on the `archive/v1-process` branch.

## Setup
Node.js 22 and Rust stable; Windows 10 or 11 to run the app (`npm run tauri dev`).

```
npm ci
npm run lint && npm test && npm run build
cd src-tauri && cargo test -p snipmd-core && cargo check
```
CI runs the same on `windows-latest` for every push and pull request, and checks the Rust side on `macos-latest`.

## Pull requests
- One concern per PR, on its own branch; CI green before review.
- Add tests that fail without your change. A change that spans modules gets a case in `src/integration.test.ts`.
- UI changes come with before and after screenshots of the real window: run the *Windows run* workflow (Actions) and attach its screenshots. Colour changes keep `src/styles/contrast.test.ts` green.
- Behaviour that only exists on Windows (clipboard, Explorer, file association, Mica) needs a written Windows test in the PR.
- New dependencies need a reason that fits SPEC §9 (size, startup time).
