# Final review R7: merged main 5b571e9

Scope: `origin/main` at 5b571e9, checked out as a worktree in the scratchpad. Covers what changed since R6 (3e1cefe): PR #13 (`tools/measure/shots.ps1`, `.github/workflows/windows-run.yml`) and PR #14 (`src/editor/setup.ts` style nonce, class stripping in `src/preview/render.ts`, `main.css`, docs). Ground truth: SPEC.md and CLAUDE.md. No source file was edited.

## Checks (run in the worktree, node_modules symlinked)

- `npm test`: exit 0 (20 files, 282 tests)
- `npm run lint`: exit 0
- `npm run build`: exit 0 (`dist/assets/index-*.js` 398.70 kB, gzip 130.55 kB)
- `cargo test -p snipmd-core` in `src-tauri/`: exit 0 (57 tests, 0 failed)
- `cargo check` in `src-tauri/`: exit 0. This checked the Tauri crate itself, because GTK is installed here.

## PR #14: style nonce (`src/editor/setup.ts:43`)

- **Does the lookup find Tauri's element?** `index.html:8` has an inline `<style>`, and `dist/index.html` keeps it after the Vite build. tauri-utils 2.10.2 `html.rs:156` runs `inject_nonce(document, "style", STYLE_NONCE_TOKEN)` on it. At serve time, tauri `manager/mod.rs:126-137` `replace_csp_nonce` swaps in `getrandom::u64()` for each load and adds it to `style-src`. So the nonce is random for every load, and a note cannot predict it.
- **Nonce hiding.** The code reads the `.nonce` IDL property, not `getAttribute`. `style[nonce]` still matches when the attribute is blanked, so this works whether the CSP comes from a header or a meta tag.
- **Can a note add a `style[nonce]` first?** No. `styleNonce` is read once, when the module is evaluated, and module scripts run before any note is rendered. Read mode forbids `style` (`render.ts:35`). In a probe, `<style nonce="1">` came out as nothing. The editor never renders note HTML.
- **Failure mode.** If the inline style is ever removed, `styleNonce` becomes undefined and CodeMirror's styles are blocked. That fails closed: the result is cosmetic, not a security loss. Nothing guards it in tests (m2).
- **Coverage.** Every view state comes from `createEditorState` (the only `EditorState.create` in `src/`; the only `new EditorView` is `tabs.ts:213`). style-mod mounts on `document`, which has a head, so it uses a `<style>` tag that carries the nonce. `dangerousDisableAssetCspModification` is gone from `tauri.conf.json` (grep count 0), so R1's m1 and m2 are resolved.
- **Release evidence.** `findings/ui/windows-ci/write-light.png` shows Markdown styling in the release window (large headings, monospace inline code).

## PR #14: class stripping (`src/preview/render.ts:19-21`)

Probe output (real `renderRead`, using the mocks from `render.test.ts`):
- Task lists: `<li><input checked="" disabled="" type="checkbox"> done</li>`. marked 18 emits no class here, and the CSS matches `input[type='checkbox']`, so nothing breaks.
- Code blocks: `<pre><code>x</code></pre>`. The `language-js` class is dropped. No CSS or code depends on it.
- App images: `<img class="read-img" data-own="0" ... src="http://asset.localhost/...">` and web images keep `read-img`. The click handler's `closest('img.read-img')` still works, and `expanded` is added after sanitizing.
- Note-written: `<p class="read-img">` loses the class. `<img class="read-img expanded">` and `class="READ-IMG"` also lose it. `<img class="read-img" data-own="0">` keeps it and shows the note's own first image. That is R4 m4, which was left by decision.
- No unscoped attribute selector in `main.css` could be used instead of a class (only `[hidden]` and selectors scoped to `.read-view` or `.cm-search`).

## PR #13: windows-run.yml and shots.ps1

- The workflow runs on `workflow_dispatch` only, so only users with write access can start it. `contents: write` is used to push `ci/windows-run-N`. The token is persisted by `actions/checkout` and is available to `npm ci` lifecycle scripts and to `build.rs` (m1).
- `shots.ps1` uses its own `SNIPMD_DATA_DIR` for each run. It restores `AppsUseLightTheme` in `finally`. If it throws mid-run, it leaves a `snip-md` process running, because `finally` does not stop `$p`. That is harmless on a runner and a minor annoyance on the owner's machine (m3).

## R1-R6 still hold

All 282 Vitest tests and 57 core tests pass on 5b571e9. The read-mode hostile-input set from R6 (render tests) and the write and stamp checks (core tests) are unchanged since 3e1cefe: the diff touches only `setup.ts`, `render.ts`, `render.test.ts` and `main.css` in `src/`, and nothing in `src-tauri/`. R6 m1 (no test for the scroll guard) and m2 (rAF restore) are still open as minors.

## Blockers

None.

## Majors

None.

## Minors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| m1 | minor | `.github/workflows/windows-run.yml:10-11, 17, 33` | A token with `contents: write` is persisted in `.git/config` by `actions/checkout@v4` (default `persist-credentials: true`) before `npm ci` and `tauri build` run third-party install scripts and `build.rs`. A compromised dependency could push to any unprotected branch. `dtolnay/rust-toolchain@stable` and `swatinem/rust-cache@v2` are pinned to tags, not SHAs. Fix: `persist-credentials: false` on checkout, plus a token only in the push step, or split the push into a second job. Only manual dispatch triggers it, and `release-win11.yml` has the same shape. | `permissions:\n  contents: write`; `- uses: actions/checkout@v4` with no `with:`; `npm ci` in the Build step. |
| m2 | minor | `src/editor/setup.ts:43`, `index.html:8` | The editor nonce depends on the "paint before main.css" inline `<style>`. Removing or moving it silently drops all CodeMirror styling in release builds only. No test or comment in `index.html` ties them together. | `grep -rn nonce src` matches only `setup.ts`. `index.html:7` comment mentions only the background paint. |
| m3 | minor | `tools/measure/shots.ps1:131-150` | If a step throws (for example `throw 'SnipMD did not report ready'`), `finally` restores the theme but does not stop the running SnipMD. On the owner's machine the next run then aborts with `Close SnipMD first.` | `} finally { if ($null -ne $before) { Set-ItemProperty ... } else { Remove-ItemProperty ... } }`: no `Stop-Snip`. |
| m4 | minor (inferred) | `src/preview/render.ts:33-41` | Read mode keeps note-written ARIA attributes (`role="alert"`, `aria-label`), so a note can make a screen reader announce its text as an alert. This is low impact and came before PR #14. | Probe: `<div aria-label="infobar" role="alert">r</div>` was kept unchanged. |

## Verdict

Open blockers/majors verifiable without the owner's Windows machine: no.

## Resolution (main session, branch claude/windows-run-2)
- m1 fixed: both Windows workflows check out without persisting credentials; only the step that pushes results (windows-run) or publishes the release (softprops, its own token) gets one.
- m2 fixed: index.html says why its inline style must stay, and `src/indexHtml.test.ts` fails if it goes.
- m3 fixed: shots.ps1 stops any SnipMD it left running, also when a step fails.
- m4 fixed: read mode drops `role` and `aria-*` from notes (test).
- Verdict unchanged: no open blocker or major verifiable without the owner's Windows machine.
