# Brief: design for the command menu and the features it switches

Repo: /home/user/snipmd (branch cc/quirky-lovelace-ge5udo; Tauri v2 + vanilla TypeScript + Vite + CodeMirror 6 + marked). Read first: CLAUDE.md (guardrails and code conventions), SPEC.md §3, §4, §5, §9, §10, §12, §13, ARCHITECTURE.md, ROADMAP.md section "Next: from the Mac test report". Then the code you need: src/app.ts (keys), src/infobar.ts, src/titlebar.ts, src/tabs.ts, src/session.ts, src/types.ts, src/editor/setup.ts, src/editor/search.ts, src/preview/render.ts, src/styles/main.css, vite.config.*, package.json.

## What the owner decided (2026-10-23)
1. A **command menu** opened with one shortcut (Ctrl+Shift+P, Cmd+Shift+P on macOS). Minimal, in SnipMD's own look, no settings screen. It runs commands and holds toggles. It is the place future options go.
2. **Line breaks**: a toggle; on = a single newline renders as a break in read mode. Off by default (CommonMark).
3. **Syntax highlighting in code blocks**, in writing (CodeMirror) and reading (read mode), language parsers loaded lazily the first time a block names a language. The startup bundle must not grow by the parsers.
4. **Tab order**: drag a tab to move it; Ctrl+Shift+PageUp/PageDown too; order kept in the session.
5. **Optional extras**, each lazily loaded where possible and switched in the command menu: clickable checkboxes in read mode (writes `[x]` to the source), a copy button on code blocks, a match counter in the find panel.
No quit warning, no table inserter.

## Constraints that bite
- Guardrail 13: no modal dialogs, toasts or alert(); "all messages and choices go through the info bar" (SPEC §4). Decide how a command menu fits this: inside the info bar, or a SPEC change the owner must approve. State which, with the trade-off.
- Guardrail 6: what must survive lives in session.json, not localStorage. Decide where toggles persist (session.json's shape is in src/types.ts `SessionFile`, version 3, parsed in src/session.ts; Rust keeps an unreadable session aside).
- SPEC §9: SnipMD's own start < 150 ms. Anything not needed for the first paint is lazy. Read mode is already lazy (src/preview).
- Guardrail 7 / CSP: read-mode HTML is sanitized; anything added to the read DOM (copy button, clickable checkbox) must be set on the clean DOM by the app, never via note HTML. Styles under Tauri's CSP use the nonce (ROADMAP "Styles under Tauri's CSP").
- Code conventions 3 and 8: one path per concern, one owner module per state, wired once from the root with functions passed at init.
- Keyboard: F6 cycle (note, info bar, tabs), macOS Cmd mapping (src/platform.ts).

## Output
Write ONE file at the path your lens brief names (Markdown, at most ~180 lines). Sections, in order:
1. **Placement and UI** of the command menu (where it renders, focus, keys, how it looks in both themes; the guardrail-13 answer).
2. **Modules**: file-ownership map (new and changed files) and the exact exported signatures (TypeScript) of every new module.
3. **State and persistence** of toggles and tab order (shape change in SessionFile, migration of a v3 file).
4. **How items 2-5 plug in**, one short paragraph each, including what loads lazily and how (dynamic import boundaries, which npm packages, their size if you can measure it from node_modules or `npm view`; mark a size you could not measure as unmeasured).
5. **SPEC changes** needed (section and one-line gist each).
6. **Units** for a parallel build: list of units with their files (disjoint), dependencies between units, and a rough size each.
7. **Risks**, ranked, each with how a test would catch it.
Cite file:line for every claim about existing code. Mark anything you inferred and did not read as inferred. Do not edit repository files.
