# Review of PR #105 (claude/rc-majors into claude/release-1.1.0)

Reviewed on DESKTOP (Windows 11), isolated worktree, branch `review-105` at `origin/claude/rc-majors` (commits e961198, cd7adc6), base `origin/claude/release-1.1.0` at 1a3e086. Nothing committed or pushed. Probe tests were written as `src/probe-hold.test.ts` and `src/probe-pet.test.ts`, run with vitest, and deleted before the end.

## Blockers

None.

## Majors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| R1 | major | src/tabs.ts:150-151 (`byPath`), src/saving.ts:79-83 (`hold`), src/saving.ts:155 (`writeFile(..., null)`) | A hold owned by a closed tab is invisible to the check in `hold()`, because `openTabAt` goes through `byPath(path, true)`, which scans only `getTabs()`. A Save As whose tab the user closes during the image copy keeps running and later writes its target with `expected: null`. Meanwhile another open tab can first-save to that same path; both writes land and the closed tab's write goes second, over the other tab's freshly written note. This is the review-pr96 m1 scenario (two overlapping saves to one path) with one extra step, and the PR claims that defect closed ("a second save gets the existing 'is open in another tab' bar"; ARCHITECTURE: "a second save to it is refused"). SPEC §6.4 "A closed tab may hold it" is safe for a closed tab with no write in flight; the new `hold()` docstring extends the allowance to the case where it fails. Consequence for the user: the overwritten tab is clean, so the watch reloads it silently with the other tab's text (SPEC §6.1 "Tab clean, reload silently"; inferred, not run). The window is the image copy (`copyAssets`), which is unbounded with many images. | Probe P3 (observed): restore disk tab `a3` (C:/n/a3.md) and untitled `u3`; `saveAs('a3')` to C:/n/q3.md with `copyAssets` held; `closeTab('a3')`; `saveTab('u3')` via Other folder to C:/n/q3.md returns `true` with no error; release the copy. Output: `P3 second save result true writes [["C:/n/q3.md","mine",null],["C:/n/q3.md","a text",null]] errors []`. Code: `const held = openTabAt(path); if (held && held !== tab) throw ...` and `(open ? getTabs() : closedTabs()).find(...)`. |

## Minors

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| R2 | minor | src/pet.ts:96-100 (`napCheck`) | Once the nap is due and Snip is not idle, the check re-arms every second with no bound. A walk that the window's blur pauses (petSprite.ts:88 pauses every running animation of the svg, the walker included) never finishes while the window is away, so the state stays `walk` and the check fires once per second for as long as the user is in another app. Trigger: an image paste or any moment, then switching away within its few seconds. During a whole nap the check re-arms once per 10 minutes, as before. No SPEC §9 row measures timer wakeups, so this is a rate cost against the comment "One timer for the nap ... a save every second costs no timer" (the count of timers is still one), not a SPEC breach. | Probe Q1 (observed): clap at tab `a`, arrive, `focused = false`, the walk home starts paused, advance 10 min, then count `setTimeout` calls over 60 min: `Q1 setTimeout calls in one hour away: 3600 state walk`. Baseline Q1b, idle at home, unfocused: `6 state sleep`. |
| R3 | minor | src/pet.test.ts:184-192 (glance test) | With `Math.random` fixed at 0 before the mount, the glances fall at 20 s and 40 s, and the look-back of the 40 s glance is already done when the test reaches 45 s. The final `advanceTimersByTimeAsync(900)` and its assertion then check nothing about the 900 ms look-back, and the test title's "at irregular times" is not exercised (every interval is exactly 20 s). The fix removed the flake by removing the timing check. | Mutation (observed): changed `turn(snip, 1), 900)` to `turn(snip, 1), 5500)` in pet.ts, ran `npx vitest run src/pet.test.ts -t "glances right"`: `Tests 1 passed | 24 skipped (25)`; pet.ts restored with `git checkout`. |
| R4 | minor | src/pet.ts:166-196 (`walk`) | `walk()` still resolves a boolean and documents "Resolves false when a newer walk took over", but after this PR no caller reads the result (lines 229, 235, 275, 279 all `await walk(...)` and drop it). Convention 10: no payloads nobody reads. | `grep -n "walk(" src/pet.ts`: `229: ... await walk(snip, to);` `235: if (snip.x !== 0) await walk(snip, 0);` `275: await walk(f, away);` `279: await walk(f, snip.x + cell * (CELLS + 1));`. On the base, 275 and 279 read it: `if (!(await walk(f, away))) return;`. |
| R5 | minor | docs/ARCHITECTURE.md:28 | The new sentence says the save holds its target "from its check until `markSaved`". The code holds it until the save ends (`finally { holdPath(tab.id); }`, saving.ts:109-111 and 166-168), which is after `markSaved` on success and also covers the failure paths, where `markSaved` never runs. The PR body says "until it ends", which matches the code. | Quoted lines: ARCHITECTURE `holds its target path from its check until \`markSaved\` (\`holdPath\` in \`tabs.ts\`)`; saving.ts `} finally {\n    holdPath(tab.id);\n  }`. The tabs.ts docstring has the same wording: "The tab holds that path from the save's check until `markSaved` gives it". |

## Checked, no defect

- P1 (observed): a first save whose write throws after the hold shows one error (`showError` called once), releases the hold (`openTabAt('C:/n/p1.md')` is undefined), the tab stays untitled, and a second save of the same tab to the same path succeeds.
- P2 (observed): Save As onto the tab's own path in another spelling (`c:\N\A2.md`) is a plain save: one write to `C:/n/a2.md` with the tab's stamp, no `copyAssets`, no hold.
- P4 (observed): an open whose read began before the hold, with the saving tab closed during the hold, adds one open tab on the path next to the closed saving tab. SPEC §6.4 allows a closed tab on the path; the open tab is clean and the watch reloads it with the saved text. Output: `P4 open tabs [["o4",null],["6edb...","C:/n/p4.md"]] u4 C:/n/p4.md closed true`.
- P5 (observed): the bar's claim fails (name taken): one error, hold released.
- P6 (observed): two untitled tabs first-saving to one bar name: the second is refused with "p6.md is open in another tab" while the first still claims. Accurate, another tab is saving there.
- P7 (observed): the hold is not in `snapshot()`, so a restart holds nothing.
- P8 (observed): `holdPath(id)` without a path deletes only that tab's entry; another tab's hold stays.
- P9 (observed): `saveTab` and `saveAs` of one untitled tab in flight join: one bar, one write.
- Snip, by reading and the PR's tests: a save while the friend is in view and Snip is awake does nothing (the guard sits behind `state === 'sleep'`); `friend` undefined before the sprites load gives `?? true` and `wakeUp` then shows idle; reduced motion and Show Snip off skip the friend; only `wakeUp` walks the friend and it starts only when the friend is gone, so removing the cut guards is safe. Q5 (observed): Show Snip off, a nap due while a moment plays at home sleeps once the moment ends.
- Previous minors from snip-walk-review: m1 (nap lost for 10 minutes) is fixed by the 1 s re-check. m2, m3 and m4 are unchanged and not claimed by the PR (m3: the friend now always finishes its walk-in before it leaves; m4: a glance can still fire during the 1.4 s of `show('idle')` at pet.ts:288).
- No added line names a review, plan, phase or row id (grep of the `+` lines of the diff for `review|plan|phase|M[0-9]|m[0-9]|step [0-9]` printed nothing).

## Shorter

| where | what |
|---|---|
| src/pet.ts:166-196 | `walk()` can return `Promise<void>`: drop `return true` / `return false`, the docstring sentence "Resolves false when a newer walk took over" and the `// cancelled by a newer walk` value; no caller reads it (R4). |
| src/tabs.ts:137-140 | The docstring of `held` repeats the ARCHITECTURE sentence and says "until `markSaved`" where the code means "until the save ends"; one line ("the path a running first save or Save As writes to") is enough. |
| src/saving.ts:95 and 99 | Kept: line 95 checks before the claim creates the file, line 99 covers Other folder and the claimed path. Neither is a guard its callers rule out. |
| src/tabs.ts:143-146 | Kept: one function with an optional path for take and give is shorter than two exports. |

Nothing else in the diff can go while the SPEC behaviours hold.

## Checks

All run on DESKTOP (Windows 11) from the worktree root unless noted.

| command | exit | what it shows |
|---|---|---|
| `npm ci` | 0 | dependencies install from the lockfile |
| `npm run lint` | 0 | the branch type-checks |
| `npm run build` | 0 | the branch builds; `dist/assets/index-aPRsBCEh.js` is 437,515 bytes (427 KiB), under the 440 KB budget in either unit |
| `npm test` (run 1) | 0 | the full suite: 33 files, 559 tests, no failure |
| `npm test` (run 2) | 0 | the same, second run, no failure |
| `npm test` (run 3) | 0 | the same, third run, no failure |
| `cargo test -p snipmd-core` (in src-tauri) | 0 | the Rust core tests still hold; no Rust file changed |
| `npx vitest run src/probe-hold.test.ts` | 0 | the hold probes P1 to P9 behave as stated above, P3 included (a closed saving tab does not stop a second save) |
| `npx vitest run src/probe-pet.test.ts` | 0 | the nap check re-arms every second while a paused walk stalls a due nap (Q1), once per ten minutes asleep (Q1b) |
| `npx vitest run src/pet.test.ts src/tabs.test.ts src/saving.test.ts` on base pet.ts, saving.ts, tabs.ts | 1 | the five new tests fail on the candidate code (5 failed, 117 passed) |
| `npx vitest run src/pet.test.ts src/tabs.test.ts src/saving.test.ts` on the branch | 0 | the same three files on the PR code (122 passed) |
| `npx vitest run src/tabs.test.ts -t "reload from disk is not a save"` with `petMoment('saved')` added to `markSaved` | 1 | the reload test notices a save moment from the reload path |
| `npx vitest run src/pet.test.ts -t "glances right"` with the look-back at 5500 ms | 0 | the glance test does not pin the 900 ms look-back (R3) |

## PR body claims

| claim | verdict | evidence |
|---|---|---|
| Tests fail on the candidate and pass here | holds | base sources under the new tests: 5 failed, 117 passed (the five named tests); branch: 122 passed. Base tip is 1a3e086 as the body says. |
| A save starts a wake visit only when no friend is in view, so the one visit runs to its end | holds | pet.ts:218 guard; the PR test for the second save fails on base and passes here. |
| A wake can no longer overtake a wake, so the friend's walks are never cut | holds | the friend is walked only at pet.ts:275 and 279 inside `wakeUp`, which starts only when the friend is `gone`. |
| The nap check naps only when idle and otherwise looks again a second later | holds | pet.ts:98-99. Its cost when a walk stalls is R2. |
| SPEC is unchanged | holds | `git diff --stat` lists no SPEC file. |
| A running first save or Save As holds its target; an open meanwhile shows the saving tab, and a second save gets the "is open in another tab" bar | does not hold in full | holds while the saving tab is open (PR tests, P6); fails when the saving tab is closed during the hold (R1, probe P3). |
| ARCHITECTURE describes the hold | holds, with a wording slip | R5 ("until `markSaved`" against "until it ends"). |
| A reload through the watch does not call `petMoment`; the test was checked by adding `petMoment('saved')` to `markSaved` | holds | mutation run here: the test fails with the added call. |
| A first save and a Save As each call `petMoment('saved')` | holds | saving.test.ts new test, part of the 122. |
| The glance flake is fixed by fixing `Math.random` before the mount; the Snip tests passed five runs in a row | holds for 3 full runs here | three `npm test` runs, no failure. The fix removes part of what the test checks (R3). |
| lint 0, test 0 with 33 files and 559 tests, build 0 with 437,515 bytes, cargo test 0 | holds | same numbers observed here. |
| Public-repo rules | holds | both commit messages end with `Co-Authored-By: Claude` and nothing after; the body has no model name, no session link, no claude.ai link. |

## Re-review of eb42ce6

Detached checkout of eb42ce6 (claude/rc-majors) on DESKTOP (Windows 11). The lockfile did not change since cd7adc6, so `npm ci` was not rerun. I re-created the probes as `src/probe-hold.test.ts`, ran them, and deleted them afterwards. The worktree is clean.

**R1: closed.** I reran probe P3 verbatim. Its own assertions (which expected the defect) now fail: `P3 second save result false writes [["C:/n/q3.md","a text",null]] errors ["Error: q3.md is open in another tab"]`. The second save is refused, and only a3's write reaches q3. `heldBy` (tabs.ts:149-150) scans the hold map across all tabs. `hold()` (saving.ts:80-84) refuses when either `openTabAt` or `heldBy` names another tab.

**Attack from the other side (observed, all as SPEC wants):**
- P2: a tab's own Save As onto its own path, spelled `c:\N\A2.md`, is a plain save with the tab's stamp: no hold, no error.
- P10: a closed tab whose save ended long ago keeps its path free (SPEC 6.4). Another tab first-saves to that path, gets no error, and ends up the one open tab on it.
- P1 and P1b: a failed save releases the hold (`heldBy` is undefined after it). The same tab and another tab can then save to that path.
- P11: two tabs saving to different paths at the same time (a Save As with the copy held, plus a first save) both write. Neither gets an error.
- P12 and P7: a fresh module's hold map is empty, and the hold never enters `snapshot()`, so a restart holds nothing. `heldBy` is undefined once the save ends.
- P6: the claim path holds the bar name, then the claimed path in Windows spelling, for the same tab without refusing itself.
- P4, P5 and P8 behave as on cd7adc6.

**New finding:**

| id | severity | location | statement | evidence |
|---|---|---|---|---|
| N1 | minor | src/saving.ts:83 | When the holder is a closed tab, the refusal still reads "is open in another tab", but no open tab shows that note. The closed tab is still titled with its old name, so the user cannot find the tab the bar points to. SPEC 6.4 only says "the info bar says so". | P3 output: `errors ["Error: q3.md is open in another tab"]` after `closeTab('a3')`, with a3 closed and titled a.md. |

**Tests:**
- The new test "a Save As still holds its path after its tab is closed: a second save to it is refused" fails on the cd7adc6 tabs.ts and saving.ts (`Tests 1 failed | 68 passed (69)`, that test only) and passes on eb42ce6.
- `npm test` on eb42ce6: exit 0, 33 files, 560 tests. `npm run lint`: exit 0.

**R4: fixed.** `walk()` returns `Promise<void>`, and no caller reads a result (pet.ts:228, 234, 274, 278). The docstring "Resolves when it arrives or a newer walk took over" matches the code. `walking` is cleared only on arrival, and on a cut the newer walk owns the crab.

**R5: fixed.** ARCHITECTURE.md and the tabs.ts docstring now say the hold lasts "until the save ends, failed or not". That matches the `finally { holdPath(tab.id); }` blocks. The `hold()` docstring matches the new rule.
