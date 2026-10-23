# Test audit: what the suite proves, and what it only appeared to prove

Branch `claude/test-audit`, from `main` at 1c3a3fe (v1.0.0). Method: mutation testing as the
objective measure, then reading the tests next to every surviving mutant.

- Rust core: `cargo-mutants 27.1.0`, `cargo mutants -p snipmd-core` (229 mutants before, 285 after).
- Frontend: StrykerJS 10.0.0 with the Vitest runner. **StrykerJS does not work with Vitest 5** (the
  project's version): the runner activates a mutant in a `beforeAll` hook of its setup file, and
  Vitest 5 skips the setup file's hooks when a test-name filter is set, which is every run of a
  covered mutant. Every mutant then ran against the unmutated code: 3.8% score, 1088 "survivors".
  The numbers below come from a scratch copy of the project with Vitest 4.1.12 and Vite 7.3.7
  (`package.json` of the repo is unchanged), where all 334 tests pass unchanged and the runner works.
  Running Stryker here later needs that same workaround until the runner supports Vitest 5.
- Classes: **(a)** a gap that matters for SPEC §3, §6, §7 (data safety) or §8 (security); **(b)** a
  gap of low value (messages, UX details, defence in depth that another guard already covers);
  **(c)** an equivalent mutant (no observable difference, or only a different error text for the
  same failure).

## 1. Scores

### Rust `snipmd-core` (caught / viable mutants)

| File | Before | After | Note |
|---|---|---|---|
| `assets.rs` | 18/23 (78%) | 18/23 (78%) | 5 survivors, all (b)/(c), see §2.1 |
| `atomic.rs` | 5/7 (71%) | 6/7 (86%) | |
| `cleanup.rs` | 29/30 (97%) | 29/30 (97%) | |
| `lib.rs` (error texts) | 0/2 (0%) | 2/2 (100%) | |
| `links.rs` | 2/2 | 2/2 | |
| `naming.rs` | 7/7 | 7/7 | |
| `note.rs` (new, moved from the Tauri crate) | – | 16/17 (94%) | |
| `paths.rs` | 115/119 (97%) | 118/119 (99%) | |
| `session.rs` | 10/11 (91%) | 46/46 (100%) | 35 new mutants from the moved logic |
| `text.rs` | 19/21 (90%) | 21/21 (100%) | |
| **Total** | **205/222 (92%)** | **265/274 (97%)** | |

### Frontend, data-safety modules (killed / covered + uncovered mutants)

| File | Before | After |
|---|---|---|
| `src/closedTabs.ts` | 68/72 (94%) | 69/72 (96%) |
| `src/diskState.ts` | 8/26 (31%) | 25/26 (96%) |
| `src/editor/paste.ts` | 71/106 (67%) | 90/106 (85%) |
| `src/editor/registry.ts` | 66/79 (84%) | 72/79 (91%) |
| `src/external.ts` | 91/127 (72%) | 117/127 (92%) |
| `src/saving.ts` | 109/160 (68%) | 137/160 (86%) |
| `src/session.ts` | 120/167 (72%) | 150/167 (90%) |
| `src/tabs.ts` | 289/487 (59%) | 402/488 (82%) |
| **Total** | **822/1224 (67%)** | **1062/1225 (87%)** |

### Frontend, the other modules (one run, no tests added)

| File | Before | After |
|---|---|---|
| `src/app.ts` | 248/325 (76%) | 248/325 (76%) |
| `src/dom.ts` | 4/5 (80%) | 4/5 (80%) |
| `src/drop.ts` | 52/73 (71%) | 61/73 (84%) |
| `src/editor/emptyHint.ts` | 9/38 (24%) | 9/38 (24%) |
| `src/editor/imageUrl.ts` | 16/17 (94%) | 16/17 (94%) |
| `src/editor/imageWidget.ts` | 90/171 (53%) | 92/171 (54%) |
| `src/editor/links.ts` | 22/33 (67%) | 28/33 (85%) |
| `src/editor/mdStyle.ts` | 48/63 (76%) | 47/63 (75%) |
| `src/editor/search.ts` | 14/42 (33%) | 14/42 (33%) |
| `src/editor/setup.ts` | 20/62 (32%) | 23/62 (37%) |
| `src/firstSaveBar.ts` | 101/153 (66%) | 101/153 (66%) |
| `src/infobar.ts` | 134/203 (66%) | 134/203 (66%) |
| `src/paths.ts` | 54/62 (87%) | 57/62 (92%) |
| `src/perf.ts` | 27/44 (61%) | 27/44 (61%) |
| `src/platform.ts` | 35/36 (97%) | 35/36 (97%) |
| `src/preview/render.ts` | 95/142 (67%) | 115/142 (81%) |
| `src/titlebar.ts` | 133/275 (48%) | 133/275 (48%) |
| **Total** | **1102/1744 (63%)** | **1144/1744 (66%)** |

The after-run of these modules ran before the last `app.test.ts` additions (the blur flush, the close cap, the forwarded files and the mounted elements), so `src/app.ts` is understated.

## 2. Surviving mutants, classified

Line numbers refer to `main` (before the changes). "Test" names the test added in this PR that
now kills the mutant; (c) and most (b) mutants are left as they are.

### 2.1 Rust core

| Mutant | Class | Why / test |
|---|---|---|
| `assets.rs:16` `delete !` in `move_dir` (`if !to.exists() && rename`) | (b) | With the `!` gone a move to a new folder copies file by file instead of renaming; same files in the end. Only observable through inode numbers. Left. |
| `assets.rs:40` `same_file` size guard → true | (c) | The byte comparison after it still decides. |
| `assets.rs:42` `same_file` NotFound guard → true | (c) | Any other stat error surfaces at `copy_new` right after. |
| `assets.rs:56` `walk` AlreadyExists guard → true, `&&` → `\|\|` | (c) | A `to` that is a file still fails at the first `copy_new` (NotADirectory); only the error text differs. |
| `atomic.rs:15` symlink guard → true | (c) | `canonicalize` of a plain existing file is the same file. The symlink case itself was already tested (`write_through_symlink_keeps_the_link`). |
| `atomic.rs:62` `create_unique` AlreadyExists guard → true | (b) | Any error would be retried 64 times and reported as "no free file name". Test: `naming::create_snip_in_missing_folder_errs_and_creates_nothing` now asserts `NotFound`. |
| `cleanup.rs:18` `scan_scratch` NotFound guard → true | (c) | `Err` and `Ok(empty)` both make `clean_scratch` remove nothing. |
| `lib.rs:33`, `lib.rs:53` `Display` → empty | (b) | Error texts reach the info bar. Tests: `paths::errors_name_the_path_they_refused`, `text::errors_name_their_cause`. |
| `paths.rs:125` `\|\|` → `&&` in `valid_note_name` (trailing `.`/space) | (c) | Dead guard: a name ending in `.` or a space fails the `.md` check anyway, and the stem check refuses `a .md`. Simplification candidate, not changed here. |
| `paths.rs:132` `\|\|` → `&&` in the `.md` check | **(a)** | With `&&` the slice `name[n-3..]` runs on a non-char boundary and panics; `panic = "abort"` in release would take the app down from a name typed in the first-save bar. Test: `paths::a_name_whose_last_bytes_split_a_character_is_refused_without_a_panic`. |
| `paths.rs:210` `i > 0` guard in `allow_note` (→ true, → `>=`) | (b) | Only a note named `.md` is affected: std's `with_extension` gives `.md.assets`, and `allow_note` must agree or its images cannot be saved. Test: `paths::a_note_named_only_by_its_extension_gets_the_folder_std_gives_it`. |
| `session.rs:40` `n == 0` → `!=` in `move_aside` | (b) | The first set-aside would be named `session.unreadable-<ms>-0.json`; the bar and SPEC §6.5 name it without the suffix. Test: `session::a_rejected_session_is_kept_aside` now checks the name. |
| `text.rs:20` `i > 0` → `>=` in `sniff` | **(a)** | A note that starts with `\n` would index `bytes[-1]`: a panic (abort in release) on reading or writing such a note. Test: `text::a_note_that_starts_with_a_line_break_sniffs_without_looking_before_it`. |
| `text.rs:45` `encode` drops every `\r`, not only the one before `\n` | **(a)** | A lone CR inside a note (old Mac text, some pastes) would be dropped silently on every save: SPEC §6.1 keeps bytes as found. Test: `text::a_lone_cr_is_kept_in_both_formats`. |
| `paths.rs:19`, `:24` `+=` in `decode_bytes` (timeouts) | (c) | Infinite loops; counted as caught. |
| New in `note.rs` after the move: `stamp` NotFound guard → true | (b) | A stat that fails for another reason (a path under a file) would read as "the note is gone" instead of an error. Test: `note::a_stat_that_fails_is_an_error_not_a_gone_file` (Unix). |
| `note.rs` `* 1000.0` → `+ 1000.0` in `stamp_of` | (b) | The page only compares stamps for equality, but the unit is part of the session format. Test: `note::a_stamp_is_the_file_time_in_milliseconds`. |
| `note.rs` `HEAD_BYTES` `64 * 1024` → `64 + 1024` | (b) | A note whose first line break sits past 1 KB would be written in the new-file format. Test: `note::the_format_is_read_past_a_long_first_line`. |
| `note.rs` `read_head` NotFound guard → true | (c) | Any other read error fails at the write right after; only the text differs. |

### 2.2 Frontend, data-safety modules

The before-run left 311 survivors and 91 uncovered mutants in the eight modules. Grouped by what
they share; the full list with status per mutant is in the Stryker JSON reports (not committed).

**`src/tabs.ts`** (131 survived, 67 uncovered)

| Lines | What survived | Class | Why / test |
|---|---|---|---|
| 60–62, 74, 254, 313, 367, 390, 414, 446, 463 | every `scheduleSessionSave(...)` and `changed()` call: the session write after a close, a new tab, a reopen, a save, a gone file, an activation, and the debounced one after an edit | **(a)** | `tabs.test.ts` never bound the session, so SPEC §7 "written immediately after …" was unproven. Test: `a close, a new tab, a reopen, a save and a gone file write the session at once; an edit is debounced`. Line 56 (the first debounced write in `startSessionWrites`) is left: the integration tests flush right after it. |
| 61 | `titlebar.render(...)` | (b) | The strip would stop redrawing. Test: `redraws the strip with the open tabs and the active one`. |
| 68 | `editListener(id)` (the autosave hook from `initTabs`) | **(a)** | Autosave is wired through this call; no test asserted it. Same test as above (`onEdit` is a spy now). |
| 85 | `openTab` returning closed tabs | (b) | Bar actions and `handleRefusedWrite` would act on closed tabs. Test: `openTab sees only open tabs, getTab both`. |
| 106–109 | the prefix/suffix diff in `loadText` | **(a)** | The three existing tests only checked the final text; a wrong diff that replaces the whole document gives the same text and only moves the cursor and undo. Test: `a deletion in the middle, an insertion at the end and a cursor before the change are handled minimally`. |
| 118 | `unwritten` (`&&` → `\|\|`, → true) | (b) | Keeps more closed tabs than SPEC §7 says, never fewer. Left. |
| 127 | `< CLOSED_MS` → `<=` | (c) | Boundary millisecond. |
| 137 | `setLastFolder` body | (b) | Test: `remembers the last folder`. |
| 147–156 | `captureVisible`: cursor and scroll stored on a tab switch | (b) | SPEC §7 lists cursor and scroll in the session. Test: `a tab keeps its cursor while another tab is shown` (scroll positions cannot be set in jsdom). |
| 181 | first failure's reason in the restore error | (b) | Test: `drops a tab whose read fails … with the first cause`. |
| 217, 220 | `mountEditor` view reuse | (b) | A new `EditorView` per activation would leak DOM. Left: it needs a count of `.cm-editor` elements, which the existing tests would make brittle. |
| 224 | `Math.min(tab.cursor, doc.length)` → `max` | **(a)** | A session cursor past the end of a file that shrank outside would throw in CodeMirror and stop `restore`. Test: `a cursor past the end of the file … is clamped, not an error`. |
| 225–227, 282–284 | `requestAnimationFrame` bodies (scroll restore, focus) | (b) | `requestAnimationFrame` is stubbed to a no-op in the tests. Left. |
| 235–241 | `preloadReader`, `stripHasFocus` | (b) | UX; left. |
| 252–253 | pane `hidden` flags in `activate` | (b) | Test: `shows the editor pane for a writing tab and the read pane for a reading one`. |
| 265, 271, 276, 280 | render-race guards in `activate` | (c) | Two guards cover each race (`renders` counter and `activeId`); each alone keeps the existing race tests green. Defence in depth, left. |
| 301–302, 317 | `addTab` defaults, `Untitled-N` counter | (b) | Test: `new untitled tabs count up from the session counter, writing, clean`. |
| 309–311 | `after` position of `openCopy` | (b) | Test: `a copy opens next to its tab, in read mode`. |
| 328–340 | `openPath` of an open, a new or an unreadable note; `openPaths` order | (b) | No test opened a fresh note through `openPath`. Tests: `a note already open is activated …`, `a new note is read and opened …`, `a note that cannot be read opens nothing …`, `several paths open in order`. |
| 355 | a clean empty note dropped on close instead of kept | (b) | Test: `an empty note on disk is kept when closed, so it can be restored`. |
| 358 | `closedAt` strictly after the last close | (b) | Ctrl+Shift+T would restore the wrong tab after two closes in one millisecond. Test: `two closes in the same millisecond keep their order`. |
| 360–362 | an empty untitled tab removed from the list and its state dropped | (b) | The old test checked only the return value. Test: `an empty untitled tab that closes is gone with its editor state`. |
| 365–366 | the last tab closed → a new untitled; the active tab moves to the neighbour | (b) | Tests: `closing the active tab shows its right neighbour, or the last tab`, `closing a tab that is not active keeps the active one`. |
| 379–380, 386–389 | `reopenClosed` by id; a clean closed copy of an open note | (b) | Tests: `reopens the closed tab asked for by id …`, `a clean closed copy of a note that is open again just activates it`. |
| 413 | focus rule after a late reopen | (b) | The integration test's second scenario passed by coincidence (the closed tab's neighbour was the reopened tab). `integration.test.ts` now closes a tab whose neighbour is another tab. |
| 419–438 | `focusActive`, `toggleMode`, `cycle` (uncovered) | (b) | Tests: `Ctrl+E toggles between writing and reading`, `Ctrl+Tab cycles forward and back with wrap-around …`. `focusActive` is left (focus in jsdom). |
| 442–446 | `markDirty` (uncovered) | **(a)** | SPEC §6.1: a note that is gone turns dirty so the session keeps its text. Test: `markDirty keeps the text in the session for a note that is gone`. |
| 459 | `redrawImages` after a first save | (b) | Left: asserting it needs a spy on the image widget module. |
| 462 | `textOf(tab) === written.text` → true in `markSaved` | **(a)** | Text typed during a write would be marked saved: the tab is clean, so a close would not write it. Test: `a tab edited during the write stays dirty; the stamp is stored either way`. |

**`src/saving.ts`** (46 survived, 5 uncovered)

| Lines | What survived | Class | Why / test |
|---|---|---|---|
| 27, 33–34 | `beginWrite` / `endWrite` around a write | **(a)** | The external watch skips a tab being written through these; nothing asserted them. Test: `marks the tab as writing while its write runs, so the watch leaves it alone`. |
| 45 | `Promise.resolve(true)` → `false` | (c) | The value of the chain's base is never read. |
| 51 | `inConflict` check inside the queued write | (b) | `saveTab` and the autosave check it before queuing; this one catches a conflict raised while a write was queued (Rust's stamp refusal would catch it too). Test: `a save queued behind a write is dropped when the tab went into conflict meanwhile`. |
| 56 | `tab.filePath === path` after a Save As during a write | (b) | Needs a Save As racing an autosave; the next write would be refused by its stamp and show a conflict bar. Left. |
| 62–63 | `running` bookkeeping | (c) | Chaining on an old settled promise behaves the same. |
| 75, 81, 123, 129, 131, 142 | the `step` texts in error messages | (b) | One asserted now (`save Untitled-1`); the others are the same mechanism. |
| 84, 134 | `!stamp` after a first save / Save As write | (c) | A write without an expected stamp is never refused. |
| 87, 139, 137, 138 | `clearInfo`, `resolveConflict`, `setLastFolder` after a successful first save / Save As | (b) | Tests: assertions added to `claims the note and writes it …` and `a note without images is written and switched without a rewrite`. |
| 104, 135 | `move` null (a note without images) | (b) | `rewriteImagePrefix(id, null)` would throw: an error bar after a first save, and a Save As that wrote the file but never switched the tab. Tests: `a note without images is saved without a rewrite or an error`, `a note without images is written and switched without a rewrite`. |
| 110–112 | "Try again" label, primary, `t` check | (b) | Left. |
| 126 | `!picked` in Save As | (b) | A cancelled dialog would show an error. Test: `a cancelled dialog changes nothing and reports nothing`. |
| 152–154 | one first save per tab | (b) | Test: `a second Ctrl+S while the bar is open joins it instead of opening another`. |
| 161 | `!tab \|\| inConflict` in `saveTab` | (c) | The inner check (line 51) refuses the same write; defence in depth. |
| 163, 173 | `scheduleSessionSave({ immediate: true })` after a save | (b) | `markSaved` already writes the session; this covers the `ok` flag. Test: `a successful save writes the session at once; a failed one does not`. |
| 181, 186, 189 | autosave timer bookkeeping | (c) | A timer for an untitled tab fires and does nothing. |

**`src/session.ts`** (39 survived, 8 uncovered)

| Lines | What survived | Class | Why / test |
|---|---|---|---|
| 27 | `if (timer) return` in the debounce | (b) | Every call would start its own timer: more than one write per 500 ms (SPEC §7). The old test ended before the extra timers fired. Test: `several debounced calls inside 500 ms write once` now runs on. |
| 36 | `if (timer) clearTimeout` | (c) | `clearTimeout(null)` is a no-op. |
| 50–56, 8 | the `failing` flag, the bar key and text, `clearInfo` on recovery | (b) | Test: `flushSession resolves when the write rejected and reports it once, keyed, until a write succeeds`. |
| 53 | `lastQueued` reset on failure | (c) | The next save writes either way. |
| 15 | `lastQueued = ''` initial | (c) | |
| 61–63 | `loadSession` wrapper (uncovered) | (c) | One line over `ipc`. |
| 73 | `typeof t.filePath === 'string' && t.filePath` | **(a)** | An empty `filePath` (older sessions wrote it) would make an untitled tab a disk tab; its read fails at restore, the tab is dropped, and the next session write loses its text. Test: `an empty file path is an untitled tab …`. |
| 66–72, 76–81, 91–96, 101–122 | the rest of the lenient parser (fallbacks, partial stamps and formats, non-object JSON, `lastFolder`) | (b) | Robustness against a hand-edited or old session. Tests: `drops malformed tabs …` extended, `a stamp or format missing a field is unknown, not half known`. |
| 112–115 | `closedTabs` parsing, future `closedAt` clamped (uncovered) | (b) | Test: `closed tabs keep their tab and time; a time in the future is clamped to now …`. |

**`src/external.ts`** (35 survived, 1 uncovered)

| Lines | What survived | Class | Why / test |
|---|---|---|---|
| 14 | `same`: `&&` → `\|\|`, each side → true | **(a)** | A file rewritten within the same floored millisecond with a different size (or the reverse) would not count as changed. Test: `a stamp that differs in only the time or only the size is a change`. |
| 119 (7 variants) | the stale-stat guard (`writeGeneration`, `isWriting`, `inConflict`) | **(a)** | The existing test set `tab.disk = S2` before the stat answered, so the guard was never needed to pass it: with the guard removed the tab would get a false conflict bar after its own write, and "Reload" there drops the user's edits. Tests: `a write that ends during the stat makes the answer stale …` (fixed), `a write still running when the stat answers, or a conflict raised meanwhile, makes it stale too`. |
| 126 | `t.filePath && t.disk` filter | (b) | Untitled tabs and disk tabs without a stamp would be stat'ed. Test: `skips untitled tabs and disk tabs without a stamp`. |
| 105 | `tab.dirty` in `outside` | (c) | `reload(tab, true)` raises the same conflict for a dirty tab after reading the file. |
| 112 | `handleRefusedWrite` guard | (b) | A refused write of a closed or already conflicted tab would raise a second bar. Test: `a refused write for a tab already in conflict, or a closed one, raises nothing more`. |
| 19 | the unwired-`saveTab` throw | (c) | Wiring error. |
| 40 | `clearInfo(errorKey)` in `resolveConflict` | (b) | Test: `a successful choice also clears an error left by an earlier failed one`. |
| 44, 78, 97, 61, 88 | `primary` defaults, `kind: 'warning'` | (b) | Tests: `Keep mine is the primary choice …`, `the gone bar cannot be dismissed either …`. |
| 90 | `sticky: true` of the gone bar | (b) | A dismissed gone bar would leave the tab in conflict with no way out. Same test. |
| 51 | `!tab` in a bar action | (b) | Test: `a choice made after the tab closed only takes its bar away`. |
| 52, 66, 70, 74, 93 | action texts | (b) | Left. |
| 131, 137, 149 | `stop` / `hasFocus` | (c) | `clearInterval` on blur and the `hasFocus` check in the interval each cover the other. |
| 135 | `stop()` at the start of `start()` | (b) | Two focus events would double the checks. Test: `a second focus event does not double the checks`. |
| 148 | the `'blur'` event name | (b) | Left. |

**`src/editor/paste.ts`** (28 survived, 7 uncovered)

| Lines | What survived | Class | Why / test |
|---|---|---|---|
| 36 | `scheduleSessionSave({ immediate: true })` after a paste | **(a)** | SPEC §7: the session, the only store of an untitled tab's links, is written right after a paste. Assertion added to `mid-line keeps the line text …`. |
| 34 | `primeAssetCache` | (b) | The image would show after a lookup instead of at once (SPEC §9 budget). Assertion added to the same test and to `image only saves once …`. |
| 15 | `!state` in `insertLinks` | (b) | Test: `a tab that is gone takes nothing and throws nothing`. |
| 19 | `line.length === 0 ? line.from : line.to` | (c) | Equal for an empty line. Simplification candidate (`line.to`). |
| 25, 84 | `scrollIntoView`, `userEvent` | (b) | Left. |
| 44 | `markPasteVisible` | (b) | Assertion added to `image only saves once …`. |
| 45–46 | `showError('save the image')` (uncovered) | (b) | Test: `a failed image save is reported and leaves the note as it was`. |
| 56–57 | the Ctrl+Shift+V key watcher: each condition, and its return value | (b) | Typing a capital V, or Ctrl+Shift with another key, would make the next image paste a plain one; a handler that returns true would swallow every key. Tests: `other keys with Shift or Ctrl do not turn the next paste into a plain one`, `the key watcher swallows no key …`. |
| 61 | `return false` when text is present | (c) | Expected to matter for SPEC §6.3 "text wins" (a handler that returns true stops later handlers), but CodeMirror's own paste handler runs before this one, so the text lands either way. The old test only checked that no image was saved; it now checks the text landed, which guards the rule itself. |
| 63–64 | `getData('text/plain')`, `items ?? []`, `'image/'` prefix | (b) | The old clipboard mock ignored the type asked for and listed one item only, so these were mock-only. The mock now answers by type and lists a text item first, like WebView2. |
| 65–70 | `!file`, `preventDefault`, `return true` | (b)/(c) | `!file` is covered by `a clipboard with neither text nor an image is left to CodeMirror`. `preventDefault` and the handler's return value turned out equivalent in jsdom: CodeMirror's own paste handler runs as well and prevents the default itself, so the text still lands and `defaultPrevented` is true either way. The same holds for line 61 above: its `return false` is not what keeps the text paste working, so that row is (c), not (a). |
| 81–82 | `pastePlainText` into an input field (uncovered) | (b) | macOS only; `execCommand` does not exist in jsdom. Left. |

**`src/editor/registry.ts`** (11 survived, 2 uncovered)

| Lines | What survived | Class | Why / test |
|---|---|---|---|
| 42, 46 | `trackImageSave` set bookkeeping | **(a)** | With a new set per call, `imageSavesRunning` and `imageSavesSettled` see only the latest save: a close right after two quick pastes would wait for the second only. Test: `an earlier save still running keeps the tab busy after a later one landed`. |
| 58 | `imageSavesSettled(tabId)` → waits for nothing | **(a)** | A first save would move the scratch folder before a paste still saving into it landed. Test: `settled for one tab waits for that tab's saves and not for another tab's`. |
| 105, 108 | `applyToTab` return values | (b) | Tests: `applyToTab reports whether the tab had a document` (paste.test), `reports a change only when the document changed`. |
| 111 | `tr.docChanged` → true | (b) | A selection-only transaction on a hidden tab (a redraw effect) would mark it dirty. Same test. |
| 9, 28 | facet default, unwired-hooks throw | (c) | |

**`src/diskState.ts`** (17 survived, 1 uncovered)

All of `beginWrite` / `endWrite` / `writeGeneration` counting survived: `saving.test.ts` and
`external.test.ts` used the module but no assertion depended on its arithmetic (see `external.ts`
line 119 above). Class **(a)** as a group; `src/diskState.test.ts` is new and covers counting,
nested writes and the generation. The one survivor left (`+ 1` → `- 1` in `bump`) is (c): only
inequality of generations is ever read.

**`src/closedTabs.ts`** (4 survived)

| Lines | What survived | Class | Why / test |
|---|---|---|---|
| 14–15 | regex quantifier bounds and the scheme anchor | (c) | Static mutants Stryker did not attribute to a test; `counts distinct relative screenshots` exercises both forms. |
| 49 | `!closed` after `closeTab` | (b) | An empty untitled tab closing would throw on `closed.title`. Test: `an empty untitled tab closes without a bar`. |

### 2.3 Frontend, the other modules

Read mutant by mutant for the modules that touch SPEC §8 (`preview/render.ts`, `paths.ts`,
`editor/links.ts`, `editor/imageWidget.ts`, `drop.ts`) and for `app.ts` (the lifecycle wiring);
skimmed for the pure UI modules.

| Where | What survived | Class | Why / test |
|---|---|---|---|
| `render.ts:36` `FORBID_ATTR` entries `srcset`, `background` | **(a)** | A note's `<img srcset="http://asset.localhost/…">` would load a local file past the `src` check. Test: `drops srcset and background, which would load a file past the src check`. |
| `render.ts:35` `FORBID_TAGS` `style`, `form` | (b) | A `<style>` from a note would restyle the app (its CSS is not scoped). Test: `drops style elements and forms …`. |
| `render.ts:12` `SAFE_LINK` anchor | (b) | `tel:123#x` would keep its href; Rust still checks the scheme on open. Test: `keeps only mailto and fragment links among the non-web schemes`. |
| `render.ts:10` `escapeAttr` | (b) | The alt text is escaped before DOMPurify sees it; DOMPurify would still strip a handler. Test: `keeps its own image class and puts the alt text in as written`. |
| `render.ts:19` the class filter | (b) | Own images would lose `read-img` (no expand on click). Same test. |
| `render.ts:55` `walkTokens` resolving images | (b) | Read mode would show only images the editor had resolved already. Same test asserts `ensureResolved`. |
| `render.ts:24–25, 63` | (c) | A note-written `data-own` image is removed by the `own[]` lookup either way; web images take the same path through `own[]`. |
| `render.ts:82–90` click handling | (b) | Left. |
| `paths.ts:36` trailing-dot regex | (b) | `asset.localhost..` would read as a web host. Test: added to `refuses app-served hosts however they are spelled`. |
| `paths.ts:45` `!!url && …` → true | (b) | `isWebUrl('http://')` would throw inside the sanitizer hook. Test: `http://` and `https:` added. |
| `paths.ts:43` the prefix test | (c) | Only a shortcut before the URL parse. |
| `links.ts:26–29` `rewrittenText` (uncovered) | **(a)** | The text a Save As writes to the new file; `saving.test.ts` mocks it. Test: `rewrittenText is the text a Save As writes …`. |
| `links.ts:12, 19, 37` | (c) | |
| `imageWidget.ts:59–61` cache states | (b) | A resolved image looked up again on every edit; two tabs of one note each looking it up. Test: `a resolved image is looked up once …`. |
| `imageWidget.ts:74` a prime during a lookup | (b) | The lookup's result would overwrite the primed URL. Test: `a prime during the lookup wins over its result`. |
| `imageWidget.ts:175` the field's rebuild condition | (b) | `syntaxTree(...) !==` → false: images in a long note parsed after the first paint would not appear until an edit. jsdom parses synchronously, so it is not testable here. Left. |
| `imageWidget.ts:91, 96–125, 133–166, 169` widget `eq`, DOM, link parsing, `block: true` | (b)/(c) | UI details; `block: true` is equivalent in jsdom (the field is a `StateField`, so CM accepts inline widgets too). Left. |
| `drop.ts:42` `failed.length > 0` → true | (b) | Every successful drop would show "add" with an empty list. Test: assertion added to `places all images in drop order …`. |
| `drop.ts:12–41` optional chaining, `notes.length` checks, the read-mode re-activation | (c)/(b) | `openPaths([])` is a no-op; the rest is UX. Left. |
| `app.ts:221` the `blur` listener → `flushDirty` | **(a)** | SPEC §6.1: dirty notes are written on window blur; nothing tested it. Test: `a window blur writes every dirty note`. |
| `app.ts:224` the 3 s cap on the close flush | (b) | A hung write would keep the window open. Test: `a close waits for the flush, but not forever …`. |
| `app.ts:228–232` forwarded files, Finder notes, drops | (b) | The listeners were registered but their callbacks never run. Test: `files from a second instance, from Finder and from a drop reach the page`. |
| `app.ts:182–192` the ids the modules mount on | (b) | `app.test.ts` started the app on a detached root, so `getElementById` found nothing and the ids were equivalent. The root is attached now and the elements asserted. |
| `app.ts:147` `BrowserForward`, `BrowserRefresh` | (b) | Added to the browser-keys table. |
| `app.ts:209` no session and no files → one new tab | (b) | Needs its own module setup (the file's mocks hand over a Finder note). Left. |
| `app.ts` the rest (F6 regions, context menu, Ctrl+H replace flag, mac modifier logic) | (b) | Left. |
| `titlebar.ts`, `infobar.ts`, `firstSaveBar.ts`, `editor/setup.ts`, `editor/search.ts`, `editor/emptyHint.ts`, `editor/mdStyle.ts`, `perf.ts` | (b) | UI and styling; the low scores of `setup.ts` (highlight styles), `search.ts` (panel keys) and `emptyHint.ts` are DOM details jsdom does not render. Not read mutant by mutant. |


## 3. Tests that proved less than they appeared to

- **`external.test.ts` "a write that ends during the stat makes the answer stale"** set the tab's
  stamp to the answer before the stat returned, so the stale-check it was written for was never
  exercised. Fixed (see §2.2).
- **`saving.test.ts`** replicates `markSaved` inside its `./tabs` mock ("as tabs.ts: only when the
  text is still the written one") and `flushDirty … leaves the other tabs saved` asserts the dirty
  flags that mock computes. The seam is real in `integration.test.ts`; the module test's assertion
  on `dirty` is on its own mock. Kept, since the rest of the test (one failure, one error, the
  session flushed twice) is about `saving.ts`.
- **`external.test.ts`** likewise mocks `markDirty` and asserts `tab.dirty` after a gone file: that
  assertion is on the mock. The real `markDirty` is now tested in `tabs.test.ts`.
- **`paste.test.ts`** used a clipboard mock that returned the same text for every type and listed
  only one item, which hid three mutants (§2.2). Fixed.
- **`integration.test.ts` "a late reopen … takes it when the shown tab was closed"**: the reopened
  tab was also the closed tab's neighbour, so the rule under test was not needed to pass. Fixed.
- **`session.test.ts` "several debounced calls inside 500 ms write once"** stopped the clock before
  the extra timers a broken debounce would start. Fixed.
- **Wall-clock timing**: `closedTabs.test.ts` "stays linear: many unclosed ![ take well under a
  second" asserts `< 3000 ms` for a 100k-mark note. It guards a real quadratic regression (SPEC §8
  hostile notes) and the margin is wide; left as is, flagged because a loaded runner can still fail
  it. `startup.test.ts` waits 20 ms of real time three times; it asserts order, not duration.
- **Duplicates**: `tabs.test.ts` "drops an empty untitled tab with nothing saving" and "an empty
  untitled tab is not kept" asserted the same return value. The first now also checks the tab list
  and the editor state, so they differ. No test was removed.
- **Regression tests kept**: every other test is a regression test for a specific bug and fails
  without its fix; none was found redundant.

## 4. The Tauri crate (`src-tauri/src/lib.rs`)

CI tests `snipmd-core` only; the Tauri crate is `cargo check`ed. Logic that decides data safety sat
in `lib.rs` untested. Moved into `snipmd-core`, following the `core/src/session.rs` pattern:

- **`note.rs`** (new): `DiskStamp`, `WriteOutcome`, `NoteFile`, `stamp`, `read`, and `write` with
  the stamp check that refuses a write over a file changed outside SnipMD (SPEC §6.1, guardrail 6).
  `write_markdown_file`, `read_markdown_file` and `stat_note` are now one line each over it. Tests
  (`core/tests/note.rs`): a new note in the new-file format with the stamp `stat` reports; a write
  without a format keeps CRLF and BOM; a matching stamp writes; a stale stamp (size, or time only)
  refuses and reports the stamp now; a gone file is not recreated by a stamped write but is by Save
  again; stamps are whole milliseconds; a failed stat is an error, not "gone"; errors name the note.
- **`session.rs`**: `tabs`, `file_path`, `live_tabs` (which session texts the cleanup may trust),
  `known_texts` (the whole decision `start_cleanup` made: no session, no open tabs, an unreadable
  set-aside session → clean nothing) and `drop_unallowed` (the §8 filter in `save_session` that
  nulls planted paths). Tests: closed tabs count, disk tabs have no known text, a repeated id keeps
  both texts and goes unknown once a disk tab had it, the four "clean nothing" cases, a set-aside
  session's raw text is known, an unreadable one stops the cleanup, planted paths and `lastFolder`
  are nulled and counted and nothing else is touched.
- `serde` (derive) and `serde_json` are now dependencies of `snipmd-core`; both were already in the
  lock file through the Tauri crate. `TextFormat` carries the serde derives, so the `Format` mirror
  struct in `lib.rs` is gone.

Still untested in the Tauri crate, by choice: `ImageHome` (resolves a tab's image folder; the path
checks it calls are core-tested), the raw-body and header parsing of `save_image`, `pick`,
`open_args`, the drop handler and `fit_to_screen`. Each needs an `AppHandle` or a dialog; moving
them would mean passing the allowed set and the data folder through, which is a larger refactor than
this audit should carry. `cargo check` could not run here (no GTK, no `windres` for a Windows
cross-check); CI's Windows and macOS jobs check the crate.

## 5. What was left, and why

- Mutants classed (c): equivalent, or defence in depth where the other guard is tested.
- Mutants classed (b) without a test: listed above with "Left". They are texts, focus and scroll
  details jsdom cannot show, or a race that needs a Save As during an autosave.
- `src/tabs.ts` `mountEditor` view reuse and `redrawImages` after a first save: assertable only
  through DOM counts or a spy on the image widget; not worth the brittleness.
- The vitest 5 incompatibility of StrykerJS is a tooling issue, not the repo's. A `stryker.config`
  is deliberately not added to the repo while it cannot run on the repo's own vitest.
- Two simplification candidates noted, not applied (tests only in this PR): the dead trailing
  `.`/space guard in `valid_note_name` (`paths.rs:125`) and `line.length === 0 ? line.from : line.to`
  in `insertLinks` (`paste.ts:19`).
