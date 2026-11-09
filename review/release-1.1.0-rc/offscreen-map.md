# Offscreen map for the two open Windows test plans

Scope: every step ID of P27 (`IN\TESTPLAN-WIN11-20261027.md`, v1.1.0-4) and P31 (`IN\TESTPLAN-WIN11-20261031.md`, 1.1.0 RC at 1a3e086). Code under review: RC (`claude/release-1.1.0`, 1a3e086).

Labels. **[cited X:n]** means file X, line n. **[computed: inputs]** means arithmetic from the named inputs. **[conj: confirm by ...]** means a conjecture and the action that would confirm it. All minute estimates are conjectured. Short names: `pet.ts` = `RC\src\pet.ts`; `css` = `RC\src\styles\main.css`; `lib.rs` = `RC\src-tauri\src\lib.rs`; `F26` = `IN\findings-w11-20261026.md`.

## 0. Hard constraints that decide the channels

1. **"headless-real-app" as defined in the brief does not exist on the owner's PC.**
   - `measure.ps1` and `shots.ps1` put SnipMD in the foreground and send keys with `SendKeys` [cited RC\tools\measure\measure.ps1:102-111, 173] [cited RC\tools\measure\shots.ps1:96-125]. `shots.ps1` also reads the screen with `CopyFromScreen` [cited shots.ps1:112]. So these scripts use the owner's screen and keyboard while they run.
   - Both scripts stop if `snip-md` is running [cited measure.ps1:45] [cited shots.ps1:37]. The owner's SnipMD is running now and is used daily [cited IN\facts.md:24]. Single instance would forward a test launch into the owner's window, because the plugin does not depend on `SNIPMD_DATA_DIR` [cited lib.rs:466] [cited lib.rs:130-135].
   - Snip's walk, frames and glances stop when the page has no focus [cited pet.ts:187] [cited pet.ts:205] [cited RC\src\petSprite.ts:88-89, 103]. A real-window motion check therefore needs a focused, visible window. That is the owner's screen.
   - Both plans forbid starting the setup or SnipMD from the session's shell [cited P27:35] [cited P31:29]. On 26 October a setup started from that shell wrote into the Claude app's MSIX package [cited F26:88]. A test app started from this shell can also write into virtualized AppData [conj: confirm by starting the exe once with `SNIPMD_DATA_DIR` outside AppData and checking `%LOCALAPPDATA%\Packages\Claude_*\LocalCache` afterwards].
   - `shots.ps1` writes `HKCU\...\Personalize\AppsUseLightTheme` [cited shots.ps1:138, 154, 160]. That is a Windows setting. Both plans forbid Claude to change Windows settings [cited P27:36] [cited P31:30].
   - Consequence: scripted real-app steps go to the **GitHub runner**. A scripted run on the owner's PC stays an owner option. It costs: the owner closes his SnipMD, the script takes the foreground, and the plan rule "never from the shell" needs a stated exception.
2. **The runner already drives the real window.** `windows-run.yml` builds the app, runs `measure.ps1` and `shots.ps1` on `windows-latest`, and runs the clean-install smoke test [cited RC\.github\workflows\windows-run.yml:41-71]. A dispatch on a branch uses that branch's version of the workflow. Example: a Windows run on `claude/snip-sleep-z` [cited IN\ci-runs.md:10]. A new script step on a branch therefore needs no change to `main`. Consequences of every runner option. (a) The new script or step must be committed and pushed to a branch. Commits happen only when the owner asks [cited IN/facts.md:34], so each runner option needs the owner's approval. (b) The runner builds 1a3e086 fresh. P31 says to test only the build that the PR names [cited P31:23], which is the artifact of run 41255262735. A step can instead download that artifact and install its setup silently, as `install-smoke.ps1` does with a setup [cited RC/tools/measure/install-smoke.ps1:12]. Whether a job can read the artifact of another run is open [conj: confirm with `actions/download-artifact` and a `run-id` input in the first run].
3. **The demo is the real app code on a mocked Tauri.**
   - `demo.ts` imports `src/main` and calls `petMoment` from the real `src/pet` [cited RC\tools\demo\snip-walk\demo.ts:3-5].
   - The mock has four notes and no files. Every write succeeds and every stat returns `{mtimeMs: 1, size: 1}` [cited RC\tools\demo\snip-walk\public\mock.js:1, 12-19, 49-50]. The demo cannot show a deleted file, a conflict, the Recycle Bin, a native dialog or a real paste.
   - The "Opslaan" button calls `petMoment('saved')` directly [cited demo.ts:74]. The demo cannot show that a reload from disk is not a save. That rule lives in `saving.ts` [cited RC\src\saving.ts:32]. The diff adds unit tests that a reload does not call `petMoment` and a write does [cited IN\diff-v1.1.0-4..rc-src.patch:481-483].
   - "10 minuten later" moves `Date.now` and runs every timer of 5 minutes or more at once [cited demo.ts:74] [cited mock.js:21-35]. The nap timer is 10 minutes [cited pet.ts:23, 93-100], so the jump reaches it. Glance timers (20 to 45 s) are below 5 minutes [cited pet.ts:31], so the jump does not reach them. W8 needs real time.
   - The demo is Chromium, not WebView2. It runs without Tauri's CSP. The project notes that the browser smoke test runs without the CSP [cited RC\docs\CONVENTIONS.md, Verification, last bullet]. It has no Windows focus events from a real Tauri window and no real DPI change.
   - Start command: `npx vite --config tools/demo/snip-walk/vite.config.ts` [cited RC\docs\ARCHITECTURE.md:55]. The demo's tabs map to the plan's tabs like this: `labo-04.md` (first, far) = `w1`; `meeting-notes.md` = `w2`; `todo.md` (last, near) = `w3` [cited mock.js:15-18].
4. **The logic of the S, G and O1 steps already has tests.**
   - `integration.test.ts:248` covers "Save again recreates the file while nothing is there".
   - `integration.test.ts:255` covers "Save again never writes over a note that is at the path again".
   - `integration.test.ts:267` covers "a new tab cannot be saved to the path the open tab of the deleted note holds".
   - `integration.test.ts:279` covers "Save As cannot take the path another open tab holds".
   - `integration.test.ts:289` covers "once the old tab is closed, the path is free".
   - `core/tests/note.rs:153` covers a write that expects no file and recreates a gone note. `core/tests/note.rs:161` covers that such a write never replaces a note that is there again.
   - `tabs.test.ts:255` covers two opens of one note at once giving one tab. `tabs.test.ts:279` covers a save to the path during an open.
   - `closedTabs.test.ts:91` covers the restore bar staying 8 s. `closedTabs.test.ts:138` covers the lasting warning with Restore.
   - What only a real run adds: the real file system, the file watcher, the Recycle Bin, the native save dialog and the shell's double-click launch.
5. **Snip's numbers from the code.**
   - Cell size in CSS px is `floor(2 * dpr) / dpr`. In device px it is `floor(2 * dpr)` [computed: pet.ts:79]. That is 2 device px at 100 % and 125 %, 3 at 150 % and 175 %, and 4 at 200 % [computed: pet.ts:79]. The sprite is 22 CSS px at 100 % and 200 %, 17.6 CSS px at 125 %, and 22 CSS px at 150 % [computed: 11 * floor(2*dpr) / dpr].
   - One walk lasts `min(1400, steps / 40 * 1000)` ms, with `steps = round(distance / cell)` [cited pet.ts:25-26, 179, 186]. At 100 % a cell is 2 CSS px, so every walk longer than 112 CSS px (56 cells) takes exactly 1400 ms [computed: 1400 ms * 40 cells/s = 56 cells; 56 * 2 px].
   - A visit with a clap lasts at most 1400 + 1200 + 1400 + 300 = 4300 ms [computed: WALK_MAX_MS, TIMING.clap, LOOK_MS; pet.ts:16, 26, 30, 233-243].
   - "Worried" lasts 2 * 2000 = 4000 ms [computed: pet.ts:18]. The plan's "about 4 s" in W4 matches [cited P27:68].
   - A friend visit lasts at most 1400 (walk in) + 500 (tap) + 1200 (clap) + 700 (wave) + 1400 (leave) + 300 (settle) = 5500 ms [computed: pet.ts:278-293].
   - Snip stops `CLOSE_ROOM` = 26 px left of a tab's right edge [cited pet.ts:28, 142]. The close button is 22 px wide [cited css:150].
   - The sprite has `pointer-events: none` [cited css:167]. A click at Snip's position lands on the tab below.

## 1. Step table

Channels: **runner** = a GitHub Actions run on `windows-latest`, read back with git or the artifact. **headless-demo** = the vite demo driven by playwright-cli, headless. **headless-real-app** = the real `snip-md.exe` driven by a PowerShell script. **computer-use** = Claude on the owner's desktop. **owner-hand** = the owner does one action and Claude checks the result offscreen. **owner-only** = the owner does and judges it.

One channel is added, because none of the six fits read-only checks. **offscreen** = a read-only PowerShell, git or vitest command that opens no window and touches no setting.

| ID | Plan | Channel | What exactly would be done | Why this channel and not a cheaper one | Est. min |
|---|---|---|---|---|---|
| 0 | P27, P31 | offscreen | Read the Windows build (`Get-CimInstance Win32_OperatingSystem`), the scale (registry `HKCU\Control Panel\Desktop\PerMonitorSettings` or the F26 values), the keyboard (`Get-WinUserLanguageList`), the theme (`AppsUseLightTheme` read only), Animation effects (`SystemParametersInfo SPI_GETCLIENTAREAANIMATION` through Add-Type), and the installed version (HKCU Uninstall `DisplayVersion`), with the exe `FileVersion` as the primary source (see I3). | Every value is in the registry or WMI. F26 already holds most of them [cited F26:9-14]. | 3 |
| R1-R5 | P27 | runner (done) | Read Release Windows run 40427777393 and Windows run 40430013343 on 8aed99b [cited ci-runs.md:4, 8]. Read the screenshots on `test/windows-run-<n>` with `git show`. | They already ran. Only reading remains. This plan's R block is for v1.1.0-4. The RC has its own runs (P31 R1-R2). | 5 |
| R1-R2 | P31 | runner (done) | Read Release Windows run 41255262735 (artifact 5 299 530 bytes) and Windows run 41255265008, both on 1a3e086 [cited ci-runs.md:2, 7, 18]. | They already ran. | 5 |
| I1 | P27 | offscreen | Copy `%APPDATA%\com.snipmd.desktop\` to `Desktop\snipmd-backup-<date>\` with `robocopy /E`. Compare the file count and byte sum on both sides. | A copy needs no window. It worked this way on 26 October [cited F26:27]. Reads from this shell can see a virtualized view [conj: confirm by comparing the count with `dir` from an Explorer-started shell]. | 3 |
| I2 | P27 | owner-hand (computer-use as an option) | Claude downloads `SnipMD_1.1.0-4_x64-setup.exe` with `gh release download v1.1.0-4` into `Downloads\`, checks its size, and writes the expected page text from F26 [cited F26:82-83]. The owner double-clicks it in Explorer, picks **Do not uninstall**, and answers the close prompt. Claude then checks offscreen: the exe `FileVersion` first and HKCU `DisplayVersion` second (see I3), the install folder, and no copy under `Packages\Claude_*\LocalCache\Local\SnipMD`. | Both plans require a launch from Explorer [cited P27:35]. The page text must be copied verbatim [cited P27:56]. The setup UI is native. Computer use can read it, but the owner's double-click and one screenshot take less time. | 4 |
| I3 | P27 | offscreen (owner-hand fallback) | Primary: read `FileVersion` and `ProductVersion` of `%LOCALAPPDATA%/SnipMD/snip-md.exe`. Secondary: read HKCU `.../Uninstall/SnipMD` (`DisplayVersion`) and count the SnipMD keys. If the two disagree, the owner opens Settings, Apps, and reads the version (30 s). | The exe on disk is the installed build. The registry read can be stale. On 26 October a setup started from the session shell wrote a SnipMD key into the virtual registry of the Claude package, and Settings still showed the old version [cited F26:88]. Whether this session shell runs inside that package is open [conj: confirm by comparing the exe version with the HKCU value, or by checking the parent process of the shell]. | 1 |
| I4 | P27 | owner-hand | The owner starts SnipMD from the Start menu. Claude compares the tab ids and titles in `session.json` before I2 and after the start. The owner says whether Snip stands home, or Claude takes one window capture with the owner's consent. | The start must not come from the shell [cited P27:35]. The tab check is a file diff. Only "Snip home" needs a look. | 2 |
| W1 | P27 | headless-demo (real-window part: runner, new step) | Demo: pick `labo-04.md`, press "Afbeelding geplakt", sample Snip's transform per animation frame, and save clipped screenshots about every 50 ms (section 2). Check: one cell per step, eased start and stop, face toward the target, stop left of the close button, clap, walk back, a 300 ms look, then the turn. Check each walk is 1400 ms or shorter. Runner: a new script step starts the app with three notes, pastes a generated image (`Clipboard.SetImage` plus `SendKeys ^v`, as `measure.ps1:169-173`), and captures the tab-bar rectangle every 50 ms with Stopwatch timestamps. | The walk is the code in `pet.ts`, and the demo runs that code [cited demo.ts:3-5]. The demo cannot show WebView2 rendering or the real paste path. The runner shows both at 100 % without the owner's screen [cited windows-run.yml:53-64]. | 10 demo; 60-90 for the runner step (one time) |
| W2 | P27 | headless-demo | With Snip at `labo-04.md`, read `svg.getBoundingClientRect()` and the tab's `.tab-close` rect. Check that they do not overlap and that the top values match the home position. Save one clipped 8x frame for the eye. | A rect comparison is exact. A screenshot judged by eye is not. Fonts are the same Windows system fonts in Chromium and WebView2 on one PC [conj: confirm by comparing tab widths in the demo with a runner screenshot]. | 3 |
| W3 | P27 | headless-demo | Make `labo-04.md` active. Press `Ctrl+W` on `todo.md`, then `Ctrl+Shift+T`. The real restore calls `petMoment('relief')` [cited RC\src\tabs.ts:433, 458]. The "Tab teruggehaald" button is a fallback. Compare the walk duration with W1. | Close and restore run on the mock. The duration comparison is numeric. W3 expects the short walk to be shorter. That holds only if the near spot is under 112 CSS px from home [computed: section 0.5]. | 5 |
| W4 | P27 | headless-demo | Press "Gewijzigd buiten SnipMD" on `meeting-notes.md`. While Snip stands there, run `document.elementFromPoint(x, y)` at Snip's centre, then click there. Check that the tab becomes active (`aria-selected`) and that "worried" lasts 4000 ms. | `pointer-events: none` makes this a DOM fact [cited css:167]. The "no longer on disk" bar needs a real file. P31 S4 on the runner covers it. | 5 |
| W5 | P27 | headless-demo | Press "Twee kort na elkaar". It plays a clap on the last tab, then "worried" on the first tab 400 ms later [cited demo.ts:68-72]. Check from the samples that the second walk starts at the cell the first one reached, with no jump and no stop at home. | The cut walk is the same code as two watcher events. Which tab a real two-file delete hits first is a watcher detail and does not change the walk logic. The runner script can recycle two files at once if that order matters. | 5 |
| W6 | P27 | headless-demo | `resize 900 700`, press `Ctrl+T` until the strip scrolls and `labo-04.md` is out of view, select it in the chip row, and press "Gewijzigd buiten SnipMD". Check that the transform stays 0. | `spot()` returns none for a tab out of view [cited pet.ts:136-146]. The unit test covers it too [cited RC\src\pet.test.ts:264]. | 4 |
| W7 | P27 | offscreen (demo as an option) | Grep: `petMoment` is called only from `diskState.ts:32`, `editor/paste.ts:38`, `saving.ts:32` and `tabs.ts:433, 458`. None of these is the change listener. Demo option: type for 30 s with `playwright-cli type` and check that the transform samples stay 0. | Code inspection proves that typing raises no moment. | 2 |
| W8 | P27 | headless-demo | Leave the demo idle for 120 s. Log `scaleX` of Snip's transform every 250 ms in the page. Count the flips to -1 (2 to 6 expected) and their spacing (20 to 45 s). | Glances are below the demo clock's 5-minute floor, so this takes real time [cited mock.js:27] [cited pet.ts:31]. The unit test covers it too [cited pet.test.ts:147]. Headless costs no screen. | 3 |
| W9 | P27 | headless-demo | `Ctrl+Shift+P`, type `snip`, `Enter` on *Show Snip*, `Esc`. Check that `.pet` is `hidden`. Press "Afbeelding geplakt" and check that no animation runs. Switch it on again and check that Snip is at x = 0. | The command menu and `showPet` run unchanged in the demo. Unit tests cover it too [cited pet.test.ts:264, 287]. | 3 |
| N1 | P27 | headless-demo (real window: runner, existing) | Press "10 minuten later". Screenshot Snip at 8x. Check the sleeping drawing with the loose Z. Real window: the `snip_sleep` option of the Windows run shoots Snip asleep after 615 s in light and dark [cited windows-run.yml:11-15, 63] [cited shots.ps1:152-165]. | The demo clock reaches the nap timer [cited mock.js:27-35]. A real 10-minute wait in the owner's window costs his screen for 10 minutes. The runner already does it. | 2 demo; 0 runner if run 41255265008 had `snip_sleep` |
| N2 | P27 | headless-demo | After N1, press "Opslaan". Sample both crabs (Snip and `.friend`) per animation frame until the friend is `gone`. Check the order: walk in, tap, Snip turns, clap, wave, leave, Snip watches. Check the total is 5500 ms or shorter. | The visit is `wakeUp()` [cited pet.ts:264-294]. The save that triggers it in the real app is unit tested [cited IN\diff-v1.1.0-4..rc-src.patch:481-483]. | 4 |
| N3 | P27 | headless-demo | After a new "10 minuten later", run one `run-code` script: click "Opslaan", wait 600 ms, click "Afbeelding geplakt". Check that the friend leaves, Snip claps at `todo.md`, and in the end one Snip stands home with the friend `gone`. | A script sets the gap exactly. The plan expects that the manual timing can fail [cited P27:84]. | 3 |
| N4 | P27 | runner (existing) plus offscreen | Compare `ui/snip-sleep-light.png` and `ui/snip-sleep-dark.png` of the Windows run on 1a3e086 with `git rev-parse`, so the two blobs must differ. Compare them with the N1 demo crop in the same theme. | 26 October found one blob for both themes [cited F26:26]. A hash comparison is exact. If that run had no `snip_sleep`, dispatch it again with `snip_sleep=true` (about 10 minutes longer) [cited windows-run.yml:13]. | 3 |
| K1 | P27 | owner-hand | The owner closes SnipMD and starts it from the Start menu. Claude diffs `session.json` before and after (tab ids, titles, the test tabs). The owner confirms Snip stands home. | The test is about the owner's own session after an update, so the runner cannot replace it. Closing the owner's app needs his consent [cited P27:82]. Do it once together with P31 K1. | 2 |
| CT1 | P27 | headless-demo plus runner; owner-hand optional | Demo: `set-color-scheme light`, then `dark`, and repeat W1. Check the eye colours in frames taken during the walk. Runner: `shots.ps1` already shoots light and dark windows and switches the theme on an open window [cited shots.ps1:137-163]. Add one line for a command-menu shot (`Keys $p '^+p'`). | On the runner a theme change is allowed. On the owner's PC it is a Windows setting [cited P27:89]. A live switch on the owner's PC adds only "the owner's window follows a theme change", which the runner already shows [cited shots.ps1:160-163]. | 5 demo; 10 runner |
| CT2 | P27 | owner-hand (demo pre-check) | Demo pre-check at device scale 1.25, 1.5 and 2 (section 2.4). Then the owner sets 125, 150 and 200 %. After each, the owner presses `Win+Shift+S`, `Ctrl+V` in `w1`. A capture loop, started by Claude with consent, records the SnipMD window rectangle every 50 ms. Claude checks the uniform cells in 8x crops. | Display scale is a Windows setting. A runner cannot change it without a new sign-in [conj: confirm in the runner documentation]. The demo checks `fit()` and the cell snap [cited pet.ts:77-85, 145]. A real per-monitor DPI change and the WebView2 raster need the real screen. | 12 |
| CT3 | P27 | owner-hand (runner possible) | The owner sets the main screen to 200 % and restarts SnipMD. Claude reads the window rectangle with `GetWindowRect` and the monitor work area, and checks that the window lies inside. | `fit_to_screen` runs at start and names "a 1440p screen at 200 %" [cited lib.rs:448-461]. The window size is not saved [conj: confirm that no window-state plugin is listed in Cargo.toml]. On the runner the screen can be smaller than 1200 x 820, which tests the same path at 100 % [conj: confirm with the `w x h` line that `shots.ps1` prints, shots.ps1:117]. | 4 |
| CT4 | P27 | owner-only (offscreen substitute as an option) | The owner plugs in a USB stick, saves a test note on it, types, pulls the stick, types again, reads the error bar, plugs it back, and saves. Substitute without hardware: on the runner, `subst X: <folder>`, save a note on `X:`, then `subst X: /d`, and type. | A device removal is physical. The failing-write logic has tests [cited RC\src-tauri\core\tests\note.rs:109]. `subst` gives "path not found", which can differ from "device not connected" [conj: confirm by comparing the error bar texts]. | 6 |
| CT5 | P27 | owner-hand (demo plus runner pre-check) | Demo: `set-reduced-motion reduce`, then W1, W3, N1 and N2. Check that Snip plays every moment at home with one still frame, does not glance, and wakes without a friend. Runner option: set `SPI_SETCLIENTAREAANIMATION` to off in the script, then run the W1 capture. Owner: switch Animation effects off, paste once, switch it on. | The code reads `prefers-reduced-motion` [cited pet.ts:89] [cited petSprite.ts:86, 101]. Unit test [cited pet.test.ts:195]. Only the mapping from the Windows setting to that media query in WebView2 needs a real window [conj: confirm with one owner paste, or with the runner option]. | 6 |
| T1 | P27 | owner-only | The owner holds `Enter` for 2 s on a toggle in `Ctrl+Shift+P`. | Computer use cannot hold a key [cited P27:98]. Held-key logic has a unit test with `repeat: true` [cited RC\src\commandMenu.test.ts:75]. | 1 |
| T2 | P27 | owner-only | `Ctrl+1` and `Ctrl+2` on an AZERTY keyboard. | No AZERTY keyboard [cited F26:11, 100]. Adding a layout changes Windows settings. NOT TESTED unless the owner has one. | 0 |
| T3 | P27 | owner-only | A day of normal use with many pasted screenshots. | It is a judgement of feel, the question of #72 [cited P27:100]. | 0 session min (one day) |
| I1 | P31 | offscreen | As P27 I1, into `Desktop\snipmd-backup-20261031\`. | As P27 I1. | 3 |
| I2 | P31 | owner-hand (computer-use as an option) | Claude downloads the artifact with `gh run download 41255262735 -n SnipMD-windows-x64` into `Downloads\snipmd-1.1.0-rc\`. `gh` is logged in [cited IN\facts.md:25], so the owner's GitHub login is no longer needed. The owner double-clicks `SnipMD_1.1.0_x64-setup.exe` in Explorer and picks **Do not uninstall**. Claude checks offscreen as in P27 I2. | The plan gave the download to the owner only because of the login [cited P31:41]. The launch from Explorer stays [cited P31:29]. | 4 |
| I3 | P31 | offscreen plus owner-hand | Registry check for one SnipMD at 1.1.0. The owner starts SnipMD from the Start menu. Claude diffs `session.json`. | As P27 I3 and I4. | 2 |
| S1 | P31 | runner (new script) | The script starts the built exe with its own `SNIPMD_DATA_DIR` and a temporary Notes folder. `Ctrl+T`, `SendKeys "# Hertest een"`, `Ctrl+S`, pick the folder in the first-save bar with keys, `Enter`. Check that the file exists. Take a window shot for the tab title. | Logic tested offscreen (section 0.4). The real write and the real bar need the real app. The runner costs no owner screen [cited windows-run.yml:41-71]. It needs the approved commit and the build choice of section 0.2; this holds for every runner row. | 2 (inside a 15-20 min run) |
| S2 | P31 | runner | Type one line, wait 2 s, and read the file with `Get-Content`. | Reading the file proves the write. Opening Notepad adds nothing. | 1 |
| S3 | P31 | runner | Put a generated PNG on the clipboard, `Ctrl+V`, `Ctrl+Shift+S`, type the full path into the native save dialog, `Enter`. Check `hertest-twee.assets\`, the old files, and a window shot. | The native dialog takes a typed path in its file-name box [conj: confirm in the first runner run]. | 2 |
| S4 | P31 | runner | Save `u1.md` through *Other folder...*. Move it to the Recycle Bin with `[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile(path, 'OnlyErrorDialogs', 'SendToRecycleBin')`. Focus the app. Take a window shot of the bar. | A Recycle Bin move from a script is the same file-system event as Explorer's [conj: confirm that the bar appears]. On 26 October computer use could only press Explorer's *Delete* button [cited F26:91]. | 2 |
| S5 | P31 | runner | New tab with `nieuw`, *Other folder...*, path `u1.md`. Check the error bar text in the window shot, that `u1.md` does not exist, and the tab title. | The refusal is unit tested [cited integration.test.ts:267-272]. The text in the real bar is the residue. | 2 |
| S6 | P31 | runner | Put `u1.md` back: through `Shell.Application` namespace 10 and the restore verb, or by writing the file again. Write `van buiten` into it. Click *Save again* (key or UI Automation). Check the file content and the bar text. | The app compares stamps, so a restored file and a written file give the same event [cited integration.test.ts:255-265]. A Notepad save can produce a different watcher event sequence [conj: confirm by also writing through `notepad.exe` on the runner]. | 3 |
| S7 | P31 | runner | Click *Open disk version*, then *Keep mine*. Check the `u1.md (disk)` tab in a shot and `oud` in the file. | As S6. | 2 |
| G1 | P31 | runner | `Ctrl+W` on `hertest-twee.md`. Take window shots at 0 s and 9 s. | The 8 s bar is unit tested [cited closedTabs.test.ts:91]. The real text is the residue. | 1 |
| G2 | P31 | runner | `Ctrl+Shift+T`. Take a shot of the image and the cursor. | Unit tested [cited integration.test.ts:101]. | 1 |
| G3 | P31 | runner | Recycle `u1.md` again, type `nog oud`, `Ctrl+W`. Shot of both bars. | Unit tested [cited closedTabs.test.ts:138]. | 2 |
| G4 | P31 | runner | New tab `nieuw`, *Other folder...*, `u1.md`. Check the file content. | Unit tested [cited integration.test.ts:289]. | 1 |
| G5 | P31 | runner | Press *Restore* in the warning. Check the shot (no second tab on `u1.md`, a read tab `u1.md (closed)`) and the file still `nieuw`. | Unit tested [cited integration.test.ts:289] [cited tabs.test.ts:588]. | 2 |
| O1 | P31 | runner | Run `Start-Process <note>.md` twice with gaps of 0, 100 and 300 ms, first for an open note, then for a closed one. The silent install sets the association [cited F26:24]. Count the tabs in a shot. | A double-click in Explorer opens the file through its association, as `Start-Process` does [conj: confirm that the second launch reaches the single-instance callback, lib.rs:466]. Script gaps are tighter than a human double-click. | 3 |
| K1 | P31 | runner plus owner-hand | Runner: close the app with `CloseMainWindow`, start it again, send `Ctrl+Shift+T` until nothing returns, and check `u1.md` holds `nieuw`. Owner's PC: the restart of P27 K1. | The overwrite check needs the script's files. The restore of the owner's own tabs needs the owner's PC. | 2 |

Open option for the I steps. This is the owner's decision.
- **Option A (as written).** Update 1.1.0-3 to 1.1.0-4 (P27 I2), then 1.1.0-4 to the RC (P31 I2). This tests two updates, including one that no user will take after the 1.1.0 release. It costs one more owner-hand install, about 5 minutes.
- **Option B.** Update 1.1.0-3 directly to the RC, and run the W and N steps on the RC. The RC differs from 1.1.0-4 in Snip only in "a reload is not a save" [cited IN\facts.md:12] [cited IN\diff-v1.1.0-4..rc-src.patch:509-529]. Release step 8 names exactly this update ("from a pre-release such as 1.1.0-3 to 1.1.0") [cited RC\docs\releasing.md:43]. P27 then gets "NOT TESTED: superseded by the RC" for I2-I4.

## 2. Proposal: Headless Snip check

Goal: prove the walk, the visit and the nap with the real `pet.ts` in Chromium, without the owner's screen. Everything below is a proposal. Nothing has run.

### 2.1 Session steps

1. Start the demo in the background from RC: `npx vite --config tools/demo/snip-walk/vite.config.ts --port 5199 --strictPort`. Stop it at the end. The port is my choice. The config sets none [cited RC\tools\demo\snip-walk\vite.config.ts:5].
2. `playwright-cli -s=snipwalk open http://localhost:5199/`, then `playwright-cli -s=snipwalk resize 1200 820`. That is the app's first size [cited RC\src-tauri\tauri.conf.json:16-17].
3. **First check:** `playwright-cli -s=snipwalk --raw eval "document.hasFocus()"`.
   - If it returns `false`, nothing moves [cited pet.ts:187] [cited petSprite.ts:103]. Every frame would then look like "Snip stays home", which is a false pass.
   - Fix if false: `run-code "async page => { const s = await page.context().newCDPSession(page); await s.send('Emulation.setFocusEmulationEnabled', { enabled: true }); }"`, then reload [conj: confirm that `hasFocus()` returns `true` afterwards].
4. Wait until the sprites have loaded: `eval "document.querySelectorAll('.pet svg path').length > 0"` [cited pet.ts:117-125].
5. Install the sampler with one `eval`. It records Snip's (and the friend's) position per animation frame, so timing does not depend on screenshot speed:
   ```js
   window.__s = []; const t0 = performance.now();
   (function tick() {
     const svgs = [...document.querySelectorAll('.pet svg')];
     window.__s.push({ t: performance.now() - t0, c: svgs.map(s => {
       const r = s.getBoundingClientRect(); const m = new DOMMatrix(getComputedStyle(s).transform);
       return { x: m.e, face: Math.sign(m.a), left: r.left * devicePixelRatio, top: r.top * devicePixelRatio,
                strip: [...s.children].findIndex(g => g.getAttribute('display') === 'inline'),
                gone: s.classList.contains('gone') }; }) });
     requestAnimationFrame(tick); })();
   ```
6. **W1:** click the chip `labo-04.md`, then the button "Afbeelding geplakt". The chip and button names are in `demo.ts:49-74`. Use `find "Afbeelding geplakt"` for the ref.
7. **Frames for the eye.** Run one `run-code --filename=<scratch>\frames.js` that loops for 4.5 s. In each pass it reads `Date.now()` and calls `page.screenshot({ clip: <tab strip rect>, path: '<OUT dir>\\W1-<nnn>-<ms>.png' })`. The timestamp goes in the file name. A single CLI `screenshot` per frame cannot reach 50 ms because of the round trip [conj: confirm by timing 10 calls]. The real interval in the loop is whatever `page.screenshot` takes [conj: confirm from the file-name timestamps]. Alternative: `video-start` and `video-stop` for a reviewable film.
8. Read the samples: `--raw eval "JSON.stringify(window.__s)"` into a file. Then `eval "window.__s = []"` before the next moment.
9. Repeat steps 6-8 for W3 (keys `Ctrl+W` on `todo.md`, then `Ctrl+Shift+T`), W4 (button "Gewijzigd buiten SnipMD" plus the click check), W5 ("Twee kort na elkaar"), W6 (`resize 900 700`, `Ctrl+T` until it scrolls), W9 (command menu), N1-N3 ("10 minuten later", "Opslaan"), and W8 (120 s idle).
10. Run W1, W3, N1 and N2 again with `set-reduced-motion reduce` (CT5 pre-check), then with `set-color-scheme light` and `dark` (CT1 pre-check). Reset with `clear-reduced-motion` and `clear-color-scheme`.
11. Run section 2.4 for the device scales.
12. `playwright-cli -s=snipwalk close`. Stop vite. Remove `.playwright-cli\` if the tool created it outside OUT.

### 2.2 How to measure a walk from the samples

- **Departure:** the first sample where `x` differs from the start value.
- **Arrival:** the first sample where `x` equals the final value, before the next change.
- **Duration** = arrival - departure. The accuracy is one animation frame, about 16.7 ms at 60 Hz [computed: 1000/60].
- **Cross-check against the code.** Right after the click, read `document.querySelector('.pet svg').getAnimations()[0].effect.getComputedTiming().duration`. It must equal `min(1400, round(|to - at| / cell) / 40 * 1000)` [cited pet.ts:179, 186]. Take `to` and `at` from the samples and `cell` from `svg.width / 11` [cited pet.ts:87].
- **One cell per step:** every change in `x` between two samples must be a whole multiple of `cell`. The middle of a 1400 ms walk over many cells jumps several cells per frame. That is correct, because the keyframes are per cell with `step-end` [cited pet.ts:183-184].
- **Eased:** the cells per frame must be smallest at the start and the end [cited pet.ts:164].
- **Facing:** `face` = -1 while `x` grows, and +1 while `x` shrinks [cited pet.ts:180].
- **End of the visit:** after the walk back, the `idle` strip shows, and 300 ms later `face` = +1 [cited pet.ts:239-244].
- **Full visit:** the time from the click to that turn must be 4300 ms or less [computed: section 0.5].
- **From frame timestamps** (if only the PNGs are used): find the first frame where Snip's crop differs from home and the first frame where it equals the target crop. The uncertainty is one frame interval.

### 2.3 What the demo proves, and what only the real window proves

| The demo proves | Only the real window proves |
|---|---|
| Path, cell steps, easing, facing, stop position, duration cap, cut walks, the order of the friend visit, reduced-motion behaviour, and the integer cell geometry, all in Chromium (Blink, the same engine family as WebView2). | WebView2's rasterization and compositing of the transparent, frameless Tauri window [cited tauri.conf.json:20-21]. |
| That the command menu and `Ctrl+W` / `Ctrl+Shift+T` raise the right moments in the real front-end code. | The real paste, the file watcher, and the Recycle Bin raising the moments. |
| The sleep drawing after a simulated 10 minutes. | A real 10-minute nap timer in a WebView2 window that has no focus. The runner `snip_sleep` shot covers this [cited shots.ps1:152-159]. |
| Focus-pause logic, only if `hasFocus()` is first proved `true` (step 3). | Windows focus and blur events from the Tauri window, and the Windows mappings: Animation effects to `prefers-reduced-motion`, and the system theme to `prefers-color-scheme`. |
| `fit()` at an emulated device scale. | A real per-monitor DPI change, and a move between the 100 % main screen and the portrait screen [cited IN\facts.md:27]. |
| Nothing about the CSP. | The CSP (the demo runs without it). Snip uses `element.animate()`, not injected style elements [cited pet.ts:154, 186]. |

### 2.4 Integer cell geometry at device scale 2 (and 1.25, 1.5)

1. Set the scale in the open session: `run-code "async page => { const s = await page.context().newCDPSession(page); await s.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 820, deviceScaleFactor: 2, mobile: false }); }"`. Then check `eval "devicePixelRatio"` = 2.
   - `fit()` refits on a resolution change [cited pet.ts:84].
   - The playwright-cli config schema for `deviceScaleFactor` is not in the skill text I read [conj: confirm in the config reference]. That is why the CDP route is the primary one.
2. Run 1.25 first. There the width attribute changes from `22` to `17.6`, which proves that `fit()` ran again. At dpr 2 the value is `22`, the same as at dpr 1, so reload the page after the override at 2. Values: `17.6` at 1.25 (2 device px per cell), `22` at 1.5 (3 device px per cell), `22` at 2 (44 device px, 4 device px per cell) [computed: pet.ts:79].
3. **Position.** In the samples of a W1 walk at this scale, `left` and `top` (already multiplied by the dpr) must be integers within 0.01 at home and at every cell. The main risk is a home slot whose left edge lands on a fractional device pixel. `spot()` snaps only the offset from home [cited pet.ts:145].
4. **Pixels.** Take a screenshot clipped to Snip at home and at the stop at `labo-04.md`. Decode the PNG in the page: pass it as base64 into `page.evaluate`, then use `createImageBitmap` and `getImageData`. Check two things:
   - Home crop: every block of 4 x 4 device px, aligned to the origin of the sprite, has one colour. The set of distinct colours equals {bar background, body, claw, eye, pupil}. A blended edge pixel fails this check.
   - Stop crop at `labo-04.md`: the empty cells (`.` in FRAMES [cited RC/src/petSprite.ts:8-40]) show tab text and tab background, so the colour-set test does not apply there. Check block uniformity only on the cells that the shown frame fills.
5. Repeat at 1.25 and 1.5 with block sizes 2 and 3. Then reset with `Emulation.clearDeviceMetricsOverride`.

This proves the CSS and `fit()` arithmetic in Chromium. It does not prove the WebView2 raster at a real Windows scale. CT2 on the owner's screen keeps that part.

## 3. Minimum computer-use session

Recommendation: **none is required.** Each remaining real-screen step is an owner action that Claude checks offscreen (section 4). Computer use only replaces the owner's hand if the owner prefers it. In that case the minimum ordered session is:

1. **P31 I2** (or P27 I2 then P31 I2 under option A): double-click the setup in Explorer, read every page verbatim, and pick *Do not uninstall*. Reason: a native installer window, a launch only from Explorer [cited P31:29], and verbatim page text [cited P31:41].
2. **P31 I3 / P27 I4**: start SnipMD from the Start menu, and look at Snip at home in the owner's session. Reason: the owner's data and his installed build exist only on this screen. The tab check itself is offscreen.
3. **K1 (both plans, once)**: close SnipMD with the owner's consent, start it from the Start menu, and look. Reason: as step 2.

Estimated duration: 15 minutes under option B, 20 minutes under option A (conjectured, from the 26 October I2-I4 and K3 rows [cited F26:28-30, 43]).

Not in the list, and why:
- W1-W9 and N1-N3: the headless demo covers them, plus the runner for the real window at 100 %.
- The W/N real-window capture on the owner's screen is only needed if the owner rejects the new runner step. It would add 1 walk capture (about 10 minutes).
- S, G and O1: the runner script covers them. Without the script, computer use would need about 45 minutes for S1-K1, and Explorer allows it only clicks [cited F26:91].

## 4. The owner's own list

| ID | Owner does | Est. min | Claude prepares and checks |
|---|---|---|---|
| I2 (P31; also P27 under option A) | Double-click the setup in `Downloads\`, pick *Do not uninstall*, OK the close prompt, take one screenshot per page. | 4 per install | Downloads the files with `gh`, checks the size, writes the expected text [cited F26:82-83]. After the install, checks `DisplayVersion`, the exe version, the install folder, and that nothing went into the Claude package folder. |
| I4 / I3 / K1 | Start SnipMD from the Start menu; later close it and start it again. | 3 | `session.json` copy before and diff after. A list of the tabs that must come back. |
| CT1 (optional) | Switch to light theme, look at the menu, a code block and Snip, then switch back. | 3 | The demo and runner shots in both themes as a reference, with 8x crops of the eyes. |
| CT2 | Set 125 %, then 150 %, then 200 %. After each: `Win+Shift+S`, `Ctrl+V` in `w1`. Set 100 % back. | 12 | Demo results at the same scales. With consent, a capture script that records the window rectangle every 50 ms during each paste. The 8x crops and the cell check. |
| CT3 | At 200 % on the main screen, restart SnipMD. | 4 | Reads the window and work-area rectangles and reports inside or outside. |
| CT4 | Plug in a USB stick, save a note on it, pull it while typing, plug it back. | 6 | The test-note text, the expected error bar from the unit tests, and a check afterwards that the other tabs saved (file times). Option: the `subst` substitute on the runner instead. |
| CT5 | Switch Animation effects off, paste once in `w1`, wait 10 minutes without saving if N1-N2 is wanted, switch it on. | 3 (13 with the nap) | Demo results with reduced motion as the expected picture. Option: the runner variant, which makes this owner step unnecessary. |
| T1 | Hold `Enter` 2 s on a toggle in `Ctrl+Shift+P`. | 1 | Names the toggle and the expected single change. |
| T2 | Only with an AZERTY keyboard. | 0 | Marks it NOT TESTED otherwise [cited F26:100]. |
| T3 | Use SnipMD for a day. | 0 extra (one day) | A five-line note template for what to write down (walks per hour, readable titles, calm bar while typing, the friend). |

Total owner time: about 36 minutes under option B, plus one day for T3. That rises to about 50 minutes with the CT5 nap and option A [computed: the sums of this table].
