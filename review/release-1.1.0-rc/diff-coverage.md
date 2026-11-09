# Diff coverage: retest plan of 31 October against the 1.1.0 RC (v1.1.0-4 to 1a3e086)

Scope: the code diff `IN\diff-v1.1.0-4..rc-src.patch` (src and src-tauri), the plan `IN\TESTPLAN-WIN11-20261031.md`, and the RC worktree at commit 1a3e086. Line numbers refer to the RC worktree unless a file under IN is named.

Answer in short: the plan covers the refusal of a first save through *Other folder…* (S5), the refused Save again (S6, S7) and the closed-tab join (G3 to G5). It does not exercise four changed behaviours: Save again that recreates a gone note, the refusal through the bar's name field and through Save As, the `.` and `..` spelling, and Snip staying asleep on a reload. The changed code has one major defect: an open that ends its read before a running save ends its write still gives two tabs on one note. PR #100 states the opposite.

## Checks run

| Command (cwd) | Exit | What it shows |
|---|---|---|
| `npx vitest run src/saving.test.ts src/tabs.test.ts src/paths.test.ts src/external.test.ts src/closedTabs.test.ts` (RC) | 1 | 4 files and 72 tests pass. `src/tabs.test.ts` does not load: `Failed to resolve import "@codemirror/search" from "src/editor/search.ts"`. The linked node_modules lacks 7 packages that RC `package.json` declares (`@codemirror/search`, `lang-json`, `lang-python`, `lang-rust`, `lang-sql`, `lang-yaml`, `legacy-modes`). |
| `npx vitest run --root <OUT> probe-rc` (RC) | 0 | Copies of `src/tabs.test.ts` and `src/integration.test.ts` with `editor/search` and `editor/codeLanguages` stubbed: 2 files, 79 tests pass. This is a different runtime from the named check. |
| `npx vitest run --root <OUT> probe-race` (RC) | 0 | Both race scenarios give two open tabs on one path (M1). |
| `npx vitest run --root <OUT> probe-closed` (RC) | 0 | A refused write of a closed tab is sent again on every flush, and the tab never goes into conflict (m5). |
| `npx vitest run --root <OUT> probe-paths` (RC) | 0 | normPath output for drive-relative, `\\?\` and UNC `..` spellings (m6, m7). |

Vitest does not accept a test file outside its root (`No test files found ... include: src/**/*.test.ts`). The probes therefore ran with OUT as root and a `// @vitest-environment jsdom` docblock.

## Changed behaviours

| ID | Behaviour (user-visible) | Code in RC |
|---|---|---|
| B1 | *Save again* on a gone note sends "expected: absent". While no file is at the path, the write recreates the note. | src/external.ts:95-99; src-tauri/core/src/note.rs:100-108 |
| B2 | *Save again* never replaces a file that is at the path again. The write is refused, the file stays, and the tab gets `<name> was changed outside SnipMD and you have changes too.` | src-tauri/core/src/note.rs:104-110; src/saving.ts:35; src/external.ts:105-115 |
| B3 | "absent" is kept in the session and the watch reads it: no bar while the file stays gone; the changed bar when a file appears, also after a restart. | src/session.ts:90-91; src/external.ts:15-16, 122, 128 |
| B4 | A first save through *Other folder…* onto a path that another open tab holds is refused: `Could not save <title>: <name> is open in another tab`. The tab stays untitled. | src/saving.ts:78-81, 92-97; src/infobar.ts:169 |
| B5 | A first save through the bar's folder and name onto a held path is refused before `claimNewNote` creates the file. | src/saving.ts:93 |
| B6 | Save As onto a held path is refused before the image copy. The tab, its links and its images stay. | src/saving.ts:145-146 |
| B7 | A closed tab does not hold its path. A save to that path goes through. Restoring the closed tab activates the open tab and opens its unsaved text as `<name> (closed)`. | src/saving.ts:74-81 (open tabs only via `openTabAt`, src/tabs.ts:142); src/tabs.ts:425-434 |
| B8 | Paths with `.` and `..` resolve to one spelling at open, save and session restore, so they match the open tab. | src/paths.ts:8-21; src/tabs.ts:352; src/session.ts:74 |
| B9 | Two opens of one note at once give one tab and one read. A failed first open is not tried again by the second. | src/tabs.ts:349-364 |
| B10 | An open whose read ends after a first save or Save As set the path activates that tab instead of adding one. | src/tabs.ts:373-376 |
| B11 | Snip wakes from a nap only on a note that was written. A reload from disk or a refused write does not wake it. | src/saving.ts:31-34; src/tabs.ts:526-537 (no `petMoment` in `markSaved`) |
| B12 | The version reads 1.1.0 (installer, Settings > Apps). | src-tauri/tauri.conf.json:4; src-tauri/Cargo.toml:3 |
| - | Type exports removed in types.ts and titlebar.ts, mock.js in tools/demo. No user-visible change. | src/types.ts, src/titlebar.ts |

## Coverage

| ID | Plan step | Note |
|---|---|---|
| B1 | GAP: add S4b | S4 shows the gone bar, but nobody clicks *Save again* while the file is gone. In S6 the file is back first, so only B2 runs. |
| B2 | S6, S7 | S6 checks that `u1.md` stays `van buiten` and the changed bar appears. S7 checks *Keep mine*. |
| B3 | GAP: add S6b | No step restarts SnipMD while a tab holds "absent". K1 restarts only after S7 set a stamp again. |
| B4 | S5 | The expected text in S5 matches `Could not ${what}` with step `save` (src/saving.ts:92, src/infobar.ts:169). |
| B5 | GAP: add S5b | S5 uses *Other folder…* only. |
| B6 | GAP: add S5c | No step runs Save As onto a held path. |
| B7 | G3, G4, G5 | Covered. K1 does not test a closed tab in conflict across a restart, because G5 removes the closed `u1.md` entry (src/tabs.ts:428). Add K0. |
| B8 | GAP: add O2 | Explorer gives canonical paths. Only a command line with `..` reaches the new code (src-tauri/src/lib.rs:63, `cwd.join(a)`). |
| B9 | O1, weak | Inferred: two double-clicks on a small local note arrive hundreds of milliseconds apart, after the first read ends. O1 then tests "already open activates its tab", not the concurrent path. The unit test `two opens of one note at once give one tab` covers the concurrent path. |
| B10 | No manual step | The race needs millisecond timing. M1 shows the code does not hold it. A unit test is the right place. |
| B11 | GAP: add P1 | The plan intro names the change, but no step tests it. |
| B12 | I3 | Covered. |

## Blockers

None.

## Majors

| ID | Severity | Location | Statement | Evidence |
|---|---|---|---|---|
| M1 | major | src/tabs.ts:373-376; src/saving.ts:97-101, 146-154 | An open that ends its read before a running first save or Save As ends its write still adds a second tab on the same note. The re-check after the read only finds the saving tab when `markSaved` already ran, because the tab gets its `filePath` only in `markSaved` (src/saving.ts:101, 154). Trigger: the user picks an existing note in the save dialog (or the bar's claim creates the file), then opens that note from Explorer while the write or the image copy (`copyAssets`, unbounded with many images) runs. Effect: a clean second tab is reloaded silently with the saved text; a dirty one gets the changed bar against the user's own other tab. No edit is lost silently, because the second tab's stamp is stale and its writes are refused. PR #100 claims the opposite. The sibling defect, two overlapping saves to one path (review-pr96 m1), is still open and is a separate case. | `IN\pr100.md:13`: "An open that reads while a save takes the same path also keeps one tab." Probe `OUT\probe-race.test.ts`, run `npx vitest run --root <OUT> probe-race`: `Tests 2 passed`. Test 1: `saveTab('u')` with the write held, `openPath(P)`, release, then `expect(onPath(P)).toHaveLength(2)` passes. Test 2: Save As with `copyAssets` held, `openPath(Q)`, release, then two tabs on Q, the Save As write sent with `expected` null, and the other tab's `disk` still `{ mtimeMs: 1, size: 6 }`. |
| M2 | major | IN\TESTPLAN-WIN11-20261031.md:50-52 (S4 to S6) | The plan never runs *Save again* while the note is still gone, so the "absent" write that recreates the file (B1) has no step. This is the route most users take, and its request changed from "no check" to "absent" in this RC. | S4 Expected: "Een balk: `u1.md is no longer on disk.` met *Save again*." S6 Do: "Zet `u1.md` terug uit de Prullenbak ... Klik in SnipMD in de balk van `u1.md` op *Save again*." The file is back before the only click. |
| M3 | major | IN\TESTPLAN-WIN11-20261031.md:3 | The plan bases its scope on the 27 October plan, but that plan never ran. So the Snip walk and nap changes of v1.1.0-4 and the update path 1.1.0-3 to 1.1.0-4 have no result, and W5 and W6 (which click *Save again*) never ran on any build. | Plan line 3: "Al de rest dekt het plan van 27 oktober." `IN\facts.md:17`: "Windows test of v1.1.0-4: plan `TESTPLAN-WIN11.md` on `test/w11-20261027` ... NO REPORT EXISTS." |

## Minors

| ID | Severity | Location | Statement | Evidence |
|---|---|---|---|---|
| m1 | minor | IN\TESTPLAN-WIN11-20261031.md:63 (O1) | O1 says `hertest-een.md` is already open, but S3 turned that tab into `hertest-twee.md`. O1 also needs `w1.md` from the 27 October plan, which never ran. | S3 Expected: "De tab heet `hertest-twee.md`". O1: "`zz-w11-test\hertest-een.md` (staat al open)" and "`zz-w11-test\w1.md` uit het plan van 27 oktober". SPEC 6.4: "the tab continues as the new note". |
| m2 | minor | IN\TESTPLAN-WIN11-20261031.md:51 (S5) | The bar's name route (B5) and Save As (B6) onto a held path have no step. Both refusals have their own code line. | src/saving.ts:93 `if (choice !== 'other') refuseHeld(...)`; src/saving.ts:146 `refuseHeld(tab, target);`. No S, G or O step uses the bar's name field or `Ctrl+Shift+S` onto `u1.md`. |
| m3 | minor | IN\TESTPLAN-WIN11-20261031.md:3 | The plan intro says a reload no longer wakes Snip, but no step checks it (B11). | Line 3: "een notitie die van schijf herladen wordt maakt Snip niet meer wakker." No step in S, G, O1 or K1 lets Snip nap. |
| m4 | minor | IN\TESTPLAN-WIN11-20261031.md:64 (K1) | K1 cannot fail on its own claim. G5 removes the closed `u1.md` entry, so at K1 no closed tab holds `u1.md`. A closed tab in conflict loses its conflict flag on restart, and the plan never tests that state. | K1 Expected: "Geen gesloten tab schrijft over `u1.md`". src/tabs.ts:428 `tabs = tabs.filter((t) => t !== tab);` in the joined branch of `reopenClosed`. src/diskState.ts:3 "Transient: nothing here goes into the session." |
| m5 | minor | src/external.ts:112-115; src/saving.ts:213-216 | A refused write of a closed tab is ignored: the tab does not go into conflict, so every blur and close sends the same refused write again (convention 10: "a failure never triggers the same work again"). After a restart this applies to every closed dirty tab that was in conflict. The stamp still stops any overwrite. The code is the same as in v1.1.0-4, but SPEC 6.4 now makes "a closed tab holds a path that another tab saved to" a normal state. | Probe `OUT\probe-closed.test.ts`: three `flushDirty()` calls give `writeNote` 3 calls and `inConflict('c')` false; `Tests 1 passed`. `git show v1.1.0-4:src/external.ts` lines 110-113 have the same `openTab(id)` guard. |
| m6 | minor | src/paths.ts:15-17; src-tauri/core/src/paths.rs:56-68 | The page and Rust disagree on `..` under a UNC share. The page keeps the share; Rust pops it. A note forwarded as `\\srv\share\..\x.md` is then allowed under `//srv/x.md` and read by the page as `//srv/share/x.md`, so the open fails "not allowed". Windows resolves it to `\\srv\share\x.md`. Inferred: the open fails with an error, it does not write elsewhere. | Probe `OUT\probe-paths.test.ts`: `normPath('\\\\srv\\share\\..\\x.md')` is `//srv/share/x.md` (passes). Rust: `".." => { if comps.pop().is_none() && !clamp { ... } }` with `normalize` prefix `//` and rest `srv/share/../x.md`. |
| m7 | minor | src/paths.ts:12-19 | normPath treats the first segment as the root also for drive-relative and `\\?\` paths. `C:foo\..\x.md` becomes `C:foo/x.md` (Windows: `C:x.md`). `\\?\UNC\srv\share\..\x.md` becomes `//?/UNC/srv/x.md` (Windows does not resolve `..` after `\\?\`). Inferred from source: Rust `normalize` returns None for drive-relative paths (paths.rs:171-174), so such an open fails with an error. | Probe `OUT\probe-paths.test.ts`, 5 tests pass, among them `normPath('C:foo\\..\\x.md')` is `C:foo/x.md` and `normPath('\\\\?\\UNC\\srv\\share\\..\\x.md')` is `//?/UNC/srv/x.md`. |
| m8 | minor | review environment (RC node_modules link) | The named check cannot load `src/tabs.test.ts` and `src/integration.test.ts`, because the linked node_modules belongs to an older branch. The changed `openPath` tests therefore ran only in stubbed copies. | `Failed to resolve import "@codemirror/search" from "src/editor/search.ts"`; `node -e` over RC package.json printed `MISSING @codemirror/search` and 6 more. |

## Proposed plan additions

These rows use the plan's format. Translate them to Dutch when they go into the plan. Bar texts are quoted from the RC source.

| ID | After | Do | Expected |
|---|---|---|---|
| S4b | S4 | New tab, type `twee`. `Ctrl+S`, click *Other folder…*, save as `zz-w11-test\u2.md`. Move `u2.md` to the Recycle Bin in Explorer. Go back to SnipMD. Click *Save again* in the bar of `u2.md`. | First the bar `u2.md is no longer on disk.` with *Save again*. After the click the bar is gone, `u2.md` is in `zz-w11-test\` again with `twee` (check in Notepad), and the tab shows no unsaved mark. The copy in the Recycle Bin stays. |
| S5b | S5 | Keep the `u1.md` tab open with its bar. New tab, type `nieuw2`. `Ctrl+S`. In the bar choose the folder `zz-w11-test` and type the name `u1.md` (the field is not red: the file is in the Recycle Bin). Enter. | An error bar: `Could not save Untitled-…: u1.md is open in another tab` (copy it literally). Explorer shows no `u1.md`, also no empty one. The tab stays `Untitled-…` with `nieuw2`. |
| S5c | S5b | Go to `hertest-twee.md`. `Ctrl+Shift+S`, choose `zz-w11-test\u1.md`. | An error bar: `Could not save hertest-twee.md: u1.md is open in another tab`. Explorer shows no `u1.md` and no `u1.assets\`. The tab is still `hertest-twee.md` and shows its image. |
| S6b | S6, before S7 | With the permission of the tester, close SnipMD and start it again from the Start menu. Go to `u1.md`. | The bar `u1.md was changed outside SnipMD and you have changes too.` comes back with *Open disk version · Reload · Keep mine*. `u1.md` still contains `van buiten` (Notepad), also after switching windows twice. |
| K0 | G5, before K1 | New tab, type `drie`, save as `zz-w11-test\u3.md` (*Other folder…*). Move `u3.md` to the Recycle Bin, go back to SnipMD, type `nog drie` in the tab, `Ctrl+W`. New tab, type `nieuw3`, save as `zz-w11-test\u3.md`. Do not restore the closed tab. Then do K1. After the restart, switch to Explorer and back three times. | `u3.md` contains `nieuw3` after each switch (Notepad). `Ctrl+Shift+T` until the `u3.md` entry comes back: the tab with `nieuw3` becomes active, and a read tab `u3.md (closed)` with `nog drie` opens next to it. |
| O2 | O1 (CT) | Keep `hertest-twee.md` open. The tester presses `Win+R`, enters `"%LOCALAPPDATA%\SnipMD\snip-md.exe" "%USERPROFILE%\Documents\Notes\zz-w11-test\..\zz-w11-test\.\hertest-twee.md"`, Enter. Why the tester: the plan forbids starting SnipMD from Claude's shell, and Win+R is not Explorer or the Start menu. | No new tab. `hertest-twee.md` becomes active and the window comes to the front. |
| P1 | K1 | Open `hertest-een.md` (clean). Do not save for 10 minutes, as in N1 of the 27 October plan, until Snip sleeps. Open `hertest-een.md` in Notepad, add a line, save, close Notepad. Go back to SnipMD. Then type a letter in `hertest-een.md`. | After the Notepad change the tab shows the new line, and Snip keeps sleeping: no friend comes. After the typed letter (saved 1 s later) the friend walks in and wakes Snip. |

The exe name `snip-md.exe` and its folder come from `IN\findings-w11-20261023.md:15` ("versie-info van `snip-md.exe`") and `IN\facts.md:23` (install location `%LOCALAPPDATA%\SnipMD`). Check the name on the PC before O2.

M1 needs no manual step. It needs a fix and a unit test: hold the target path for the running save (for example a map of pending save paths that `byPath` or `openNote` consults until `markSaved`), and keep `OUT\probe-race.test.ts` as the regression test.
