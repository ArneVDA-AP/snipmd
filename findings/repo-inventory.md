# Repo inventory: the app versus how we build it

Read on `main` at 8a2b394 (155 tracked files, `git ls-files`). Every file below was read; no file was changed.

## Summary

| Category | Rows | Files |
|---|---|---|
| 1. App | 9 | 111 |
| 2. Product docs for users | 7 | 8 |
| 3. Contributor and maintainer docs | 7 | 8 |
| 4. CI and release tooling | 4 | 14 |
| 5. Our way of working and Claude environment | 5 | 14 |
| **Total** | **32** | **155** |

The code tree, the workflows and the tools are clean: one stray process trace in a test name, nothing else. The blur sits in two places:

1. **Contributor rules live in a Claude file.** The guardrails and code conventions, which CONTRIBUTING says apply to every change, are in `.claude/CLAUDE.md`, mixed with session, delegation and autonomous-run rules. A human contributor is sent into the agent config to learn the rules.
2. **The roadmap is session state.** `.claude/ROADMAP.md` holds the product roadmap, measured budgets and product decisions next to process decisions (thin-* agents, tester sessions, what a cloud session may push). `docs/releasing.md` tells maintainers to record budgets there.

## 1. App

| Path | Why |
|---|---|
| `src/` (52 files) | The TypeScript frontend and its Vitest tests, one test per module plus `integration.test.ts`. |
| `src-tauri/` (36 files) | The Rust side: Tauri crate, `snipmd-core` with its tests, capabilities, icons, Tauri config, lockfile. |
| `index.html` | The page the webview loads, with the CSP. |
| `package.json` | Dependencies and the `lint`, `test`, `build` scripts. |
| `package-lock.json` | Pinned frontend dependencies. |
| `tsconfig.json` | TypeScript build config. |
| `vite.config.ts` | Bundler config, including the startup-size gate. |
| `.gitignore` | Repo config for build output. One line is Claude tooling (see Mixed files). |
| `tools/fixtures/evil.md` | A hostile note for testing the sanitizer by hand. Nothing references it: no test, script or doc. |

## 2. Product docs for users

| Path | Why |
|---|---|
| `README.md` | What the app does, download, keys, install. |
| `CHANGELOG.md` | User-facing changes per version; it also feeds the release text. |
| `LICENSE` | MIT. |
| `docs/install-macos.md` | First-start steps for the unsigned macOS preview. |
| `docs/code-signing.md` | Signing policy that SignPath requires to be public. |
| `docs/images/` (2 files) | README screenshots. |
| `.github/SECURITY.md` | Security model and how to report a vulnerability; linked from the README. |

## 3. Contributor and maintainer docs

| Path | Why |
|---|---|
| `docs/SPEC.md` | The behaviour spec, scope and decision log. No process content. |
| `docs/ARCHITECTURE.md` | Code layout and the reasons behind it. |
| `docs/releasing.md` | How to tag, build, sign and test a release. |
| `.github/CONTRIBUTING.md` | Setup, checks and PR rules. |
| `.github/CODE_OF_CONDUCT.md` | Contributor Covenant. |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist. |
| `.github/ISSUE_TEMPLATE/` (2 files) | Bug and feature forms. |

## 4. CI and release tooling

| Path | Why |
|---|---|
| `.github/workflows/` (6 files) | CI, the Windows and macOS run and release workflows, and release notes. Comments cite SPEC sections and issue #30 only. |
| `.github/dependabot.yml` | Weekly grouped dependency updates. |
| `tools/measure/` (4 files) | Budget measurement, screenshots, installer smoke test, macOS probes. |
| `tools/release/` (3 files) | Local Windows release build and macOS packaging. |

## 5. Our way of working and Claude environment

| Path | Why |
|---|---|
| `.claude/CLAUDE.md` | Session instructions. Mixed: about half of it is contributor rules (see below). |
| `.claude/ROADMAP.md` | Session state for a cold start. Mixed: it also holds the product roadmap and product decisions. |
| `.claude/agents/` (9 files) | The thin-* subagent definitions, with model choice in their frontmatter. |
| `.claude/workflows/thin-standard.js` | The orchestration workflow script. |
| `.claude/workflows-tests/thin-standard/` (2 files) | The workflow's self-test (`thin-standard.test.cjs`) and `CONCLUSION.md`, a Dutch cost study of the workflow. |

## Mixed files

### Category 5 content in categories 1 to 4

| File | Line | Quote | Assessment |
|---|---|---|---|
| `.github/CONTRIBUTING.md` | 5 | "[`.claude/CLAUDE.md`](../.claude/CLAUDE.md) lists the guardrails (data safety, security, editor, UX) and the code conventions. They apply to every change, whoever writes it." | The main leak. A contributor's rules are in the agent file. |
| `.github/CONTRIBUTING.md` | 7 | "[`.claude/ROADMAP.md`](../.claude/ROADMAP.md) says what is open; ... The design history of v1 is on the `archive/v1-process` branch." | Points contributors to session state and to a process archive. |
| `docs/ARCHITECTURE.md` | 3 | "the rules for changing code are in [`.claude/CLAUDE.md`](../.claude/CLAUDE.md) (guardrails and conventions)." | Same leak as CONTRIBUTING line 5. |
| `docs/releasing.md` | 44 | "Record the values in `.claude/ROADMAP.md`." | A maintainer step writes into session state. |
| `src/editor/lists.test.ts` | 115 | `it('builds the sublist from the tester report and continues the outer list after Shift+Tab', ...` | A test name cites a test report. Small; a name that states the case is enough. |
| `.gitignore` | 17 | `.claude/worktrees/` | Claude tooling, harmless. Keep it. |
| `README.md` | 72 | "SnipMD is written with Claude (Anthropic) as the main author." | Not a process rule: an authorship statement. Keep it. |
| `docs/code-signing.md` | 11 | "Code is written with Claude (Anthropic) as the main author; every change goes through a pull request with CI" | Same, and SignPath asks for the team and its process. Keep it. |

Checked and clean: every comment in `src/`, `src-tauri/`, `.github/workflows/` and `tools/` (search for review, phase, session, plan step, thin-, findings, audit, model names). The `#30` references in `macos-run.yml` and `macos-probe.sh` point to a public issue that holds the macOS checklist, so they are product tracking, not process.

### Categories 1 to 4 content in category 5 files

The brief asked for the direction above; this direction matters more, because it is why the leaks above exist.

**`.claude/CLAUDE.md`**
- Contributor content (category 3): "Ground truth" (SPEC wins over code), "Stack", all 14 "Guardrails", the 10 "Code conventions", "Verification" (which commands to run and what CI covers). A human needs these.
- Process content (category 5): "Workflow" (autonomous runs, public-repo commit rules, the GitHub tool's footer workaround, "Process records stay off `main`"), the `/simplify` and thin-review step, and all of "Delegation" (thin-* agents, contract-first, session naming `<ddmon>-snipmd-<topic>`, `thin-web` needs Chrome).

**`.claude/ROADMAP.md`**
- Product content: the release status of 1.0.0, open items 1 to 3 of "v1.0.0", the measured budget table, "On `main` since 1.0.0", and most of "Decisions in force" (Command menu, Code languages, Extras, Tab drag, Startup size, Look, Mica, Keyboard, Editor scope, Lists, Settings, Paste, WebView2, Styles under CSP, Find fields, Data folder, Window title, Closed tabs, the macOS decisions, Code signing, Release text).
- Process content: "Process records", "thin-* agents", "Windows testing" ("A tester session on the owner's PC tests and reports; the cloud session fixes"), the part of "Releases" on what "A cloud session cannot push", "Health checks", and open item 3 ("the session's permissions do not allow `git push --delete`").

**`.claude/workflows-tests/thin-standard/CONCLUSION.md`** breaks the public-repo rule: line 5 names a model and its version, and lines 24 to 42 name models next to dollar costs (quoted here, this report would break the rule too). It is in Dutch, refers twice to raw results and a test plan "niet in deze repo", and is a finished study: a process record by the repo's own definition.

## Recommendation

What constrains the choice: cloud sessions load `.claude/CLAUDE.md`, `.claude/agents/` and `.claude/workflows/` from the cloned repo at start. User-level `~/.claude` does not exist in a fresh cloud container, so anything moved there disappears from cloud sessions. A separate private repo can be attached with `add_repo`, but whether its agents and workflows then load the way the repo's own do is not something I verified; it at least costs a step per session and a second repo to keep in step.

| Item | Recommendation | Why, and what breaks if it moves |
|---|---|---|
| `.claude/agents/` | Stay in `.claude/`. | Cloud sessions need them at start; moving them breaks delegation in every cloud session. They are generic, not SnipMD secrets, and `.claude/` is where readers expect tool config. Revisit only if a second project uses them: then a shared plugin repo is the clean home. |
| `.claude/workflows/thin-standard.js` | Stay in `.claude/`. | Same as the agents: the `thin-standard` skill and CLAUDE.md's delegation rules call it. |
| `.claude/workflows-tests/thin-standard/thin-standard.test.cjs` | Stay, next to the workflow. | CLAUDE.md runs it as the no-token self-test; it guards the script it sits beside. |
| `.claude/workflows-tests/thin-standard/CONCLUSION.md` | Move to `archive/1.1-process`. | A finished study that breaks the model-name rule. Nothing loads it; only CLAUDE.md's "see CONCLUSION.md" pointer needs a one-line summary in its place. |
| `.claude/CLAUDE.md` | Stay, but split. Move "Ground truth", "Stack", "Guardrails", "Code conventions" and "Verification" into a contributor doc (for example `docs/CONVENTIONS.md`, or into CONTRIBUTING), and import it from CLAUDE.md with an `@docs/CONVENTIONS.md` line. | Sessions still read the same rules through the import, so nothing breaks for Claude. CONTRIBUTING and ARCHITECTURE then point to a doc meant for people, and CLAUDE.md is left with what only sessions need. |
| `.claude/ROADMAP.md` | Stay as session state, but split. Product decisions go to SPEC §14 (behaviour) or ARCHITECTURE (implementation reasons); the measured budgets go to `docs/releasing.md`; open product work is already in issues and should live only there. ROADMAP keeps process decisions and the cold-start pointer list. | A cold session still finds its state. Product decisions become readable without opening session files, and `docs/releasing.md` line 44 stops writing into `.claude/`. |

For the mixed lines in categories 1 to 4: CONTRIBUTING lines 5 and 7, ARCHITECTURE line 3 and releasing.md line 44 follow automatically from the two splits. The test name in `lists.test.ts` line 115 can be renamed in any PR that touches the file. `tools/fixtures/evil.md` is unreferenced: either wire it into `src/preview/render.test.ts` or delete it.

The weakest point of this recommendation is the CLAUDE.md split: if the import were not followed in some surface, sessions would lose the guardrails. Claude Code follows `@` imports in CLAUDE.md, so the risk is low, but the first session after the split should confirm the guardrails are in its context.
