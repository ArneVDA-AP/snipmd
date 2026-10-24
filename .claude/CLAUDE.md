# CLAUDE.md — SnipMD

@../docs/CONVENTIONS.md

The import above is the contributor rulebook: ground truth, stack, guardrails, code conventions and verification. It applies to sessions as to anyone. This file adds what only sessions need.

## Session state
- `.claude/ROADMAP.md` holds what is open and the process decisions in force. Rewrite its sections when they change; don't append history. Deferred findings are GitHub issues.
- A product decision goes where a contributor reads it: behaviour in `docs/SPEC.md` (one-line decisions in §14), the reason behind a build choice in `docs/ARCHITECTURE.md` "Decisions", release policy in `docs/releasing.md`. ROADMAP.md gets only decisions about how we work.

## Workflow
- Work on a branch, never directly on `main`. Commit and open PRs only when asked, or in an autonomous run.
- **Autonomous runs.** When the owner has handed over authority, the session decides: it commits, opens PRs and merges each once CI is green and its review has no open blocker or major. thin-standard args are written to `.claude/runs/` and used, not held for approval. Every decision is recorded where it belongs (see Session state); the session ends with ROADMAP.md current, so a cold session can continue. The guardrails, the public-repo commit rules and "never rewrite `main`, never delete user data, never widen permissions" still hold.
- **Public-repo rules** for commits, PRs, issues and comments: no session links, no claude.ai links, no model names. A commit message ends with `Co-Authored-By: Claude` and nothing else. The GitHub tool replaces a PR description's footer with a session link when it creates the PR: right after `create_pull_request`, set the body again with `update_pull_request` (an update keeps the text as given) and read it back.
- **The repo front is for users.** The root holds only what a user or the build needs (README, LICENSE, CHANGELOG, build config, source folders). Maintainer docs live in `docs/`, community files in `.github/`, session state and agent files in `.claude/`. The README describes the app as it is on `main`; a PR that changes what a user sees updates it in the same PR. The README and release notes link only to pages a user can act on.
- **Process records stay off `main` once their work is merged.** Reviews (`review/`), findings (`findings/`) and run args (`.claude/runs/`) live on the working branch; at each milestone they move to an archive branch (`archive/v1-process` holds v1, `archive/1.1-process` what came after). Screenshots for a review are workflow artifacts or files on a `test/` branch, not commits to `main`.

## Finishing a change
Before finishing a change, run `/simplify`. It reviews within the chosen approach; after a build of 3+ units, also run one thin-review whose only question is what can be deleted or written shorter while every SPEC behaviour holds (one key per binding, no module for one caller, no guard its callers rule out), and apply what it verifies. Say in the reply which of `cargo test` and `cargo check` ran.

## Delegation
- The `thin-*` agents and the `thin-standard` workflow live in this repo: `.claude/agents/`, `.claude/workflows/thin-standard.js`. They load at session start, also in cloud sessions. Self-test (no tokens):
  `THIN_SCRIPT=.claude/workflows/thin-standard.js node .claude/workflows-tests/thin-standard/thin-standard.test.cjs` → `59/59 as expected`.
- Before a large task (audit, analysis, build, plan), state in one or two lines the deliverable ("done is when I see ...") and the scale, and match the process weight to the stakes.
- The main session owns design and integration. Subagents get a narrow brief: named files, a stated output, nothing open-ended. Prefer the `thin-*` agents when one fits; the built-in read-only agents (Explore, Plan) are fine for search.
- Contract first (file-ownership map plus exact interface signatures) before parallel writers; build the shared foundation yourself; one integrator makes it cohere.
- Standard workflow shape: `thin-standard`. The main session passes contract and briefs in `args`; the script only validates, dispatches thin-* units phase by phase, and stops at the first red gate. Show the `args` for approval before each run (in an autonomous run: record them, see Workflow). A bespoke script only when the standard cannot express the task; show it first.
- Before a large design (3+ units, or a choice between architectures), run two thin-analyst units in parallel with different lenses (minimal change vs clean structure) and pick one; then write the contract.
- Propose thin-standard for coding work of 3+ units, disjoint files, runnable checks, solo above ~$1.50. Measured equal quality at -10 to -52% cost vs solo (N=1 per task); see `.claude/workflows-tests/thin-standard/CONCLUSION.md`.
- Every session or task card you propose states: recommended model, effort, worktree yes/no, local or cloud, with a one-line reason.
- Sessions are started from the coordinating session (`create_session`), so they show as its children, and are titled `<ddmon>-snipmd-<topic>` (for example `22okt-snipmd-test-audit`).
- `thin-web` needs the Claude in Chrome extension; it does not work in cloud sessions.
