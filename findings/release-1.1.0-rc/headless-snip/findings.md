# Headless Snip check on the 1.1.0 release candidate

## Environment
- Date: 2026-11-09 (env.json: 2026-11-09T01:42:03Z). Machine: DESKTOP, Windows 11 Pro 10.0.22631.
- playwright-cli 0.1.23, headless Chromium 156.0.8078.80 (`browser.version()`, env.json), viewport 1280x720, never headed.
- RC commit 1a3e086571da5aa062244ee40db10e8600802778. Demo served by `npx vite --config tools/demo/snip-walk/vite.config.ts --port 5199 --strictPort --host 127.0.0.1` (vite.log: Vite v8.3.5, ready in 398 ms). Page title "Snip loopt mee".
- Setup: the RC `node_modules` junction was removed with rmdir (setup-rmdir.cmd, exit 0). Its target C:\dev\snipmd-claude-north-star\snipmd\node_modules still exists (69 entries). `npm ci` in RC installed 111 packages, exit 0.
- Checks at the start of every case, stored as `pre` in each JSON:
  - `document.hasFocus()` true, so walks do not pause (pet.ts:187).
  - Reduced motion false (true only in CT5).
  - The dpr as intended.
  - `.pet` visible.
  - Snip's transform none.
- Headless requestAnimationFrame ran at 100 Hz (median frame 10 ms in every trace). The only console error was a 404 for /favicon.ico.

## Method
- One script per case: `<ID>.js`, built by build.py from src/harness.js and src/<ID>.body.js. `bash run.sh <ID>` runs it with `playwright-cli -s=snip-rc run-code --filename=<ID>.js` and writes `<ID>.json`. Every case starts with a reload.
- The sampler runs per animation frame inside the page. It records performance.now(), Snip's and the friend's computed transform (through DOMMatrix: x = .e, face = sign of .a), getBoundingClientRect() and the state. Every new Web Animation on either svg is also recorded with its duration and keyframes (`walks`).
- State marker: drawPet draws each state as one `<g>` strip, and play(state) sets display="inline" on that strip and "none" on the others (petSprite.ts:90-95). The state is the index of the child `<g>` with display="inline", in FRAMES order: idle, clap, relief, worried, sleep, walk, wave (petSprite.ts:8-40). The marker is set under reduced motion too. The friend's `gone` comes from its class.
- Buttons are pressed inside the page with button.click(). The gaps of 300 ms and 200 ms use an in-page setTimeout, and every press is timestamped in `events`.
- PNGs are taken only while Snip stands still, never during a walk. Bar clips cover 0,0,1280,34.
- `analyze.py <ID>.json` derives the numbers below. `crisp.py` makes the CT2 pixel check (CT2-pixels.json). SHA256SUMS.txt holds the full hashes; the table shows the first 12 hex characters.

## Results
| ID | Verdict | Measured | Evidence |
|---|---|---|---|
| W1 | FOUT | Each way the walk animation lasts 1400 ms, with 347 keyframes 2 px (1 cell) apart. First to last change: 1350.9 ms out, 1350.5 ms back. Per sample: 129 changes each way, 104 of them larger than one cell, the largest 4 cells in a 10 ms frame. Snip faced the walking direction (face 1 going, -1 back) and kept top 6, the same as home. It stopped at x -692 and ended idle at x 0, turning to face 1 309 ms after arriving. | W1.json 45c8a88626ca; W1-before.png b38a18b90eac; W1-at-tab.png b4dd93828a35; W1-home.png b38a18b90eac |
| W2 | FOUT | Snip's right edge is 183 and t1's close button starts at 182, so Snip covers 1 px of the button box. The x glyph (188-198) stays clear by 5 px. Snip's top is 6, the same as home. | W1.json atTab, geom.tabs[0]; W1-at-tab.png |
| W3 | OK | The walk to t4 lasts 1125 ms (46 keys), 1020.5 ms first to last change, against 1400 / 1350.9 for W1. Every change is exactly 1 cell (45 each way). The right edge, 785, equals the close button's edge, 785. Snip ended idle at x 0. | W3.json 822e81063345; W3-at-tab.png a6407986ef73 |
| W5 | FOUT | The walk toward t4 starts at 110.5 ms and is cut at 511.8 ms with Snip at x -24. The new walk runs from -24.0 to -692.0 (335 keys, 1400 ms). Samples at the cut read -24 -24 -24 -26 -26 -28: no jump. Snip played worried at t1, made one walk home and ended idle at x 0. The long leg has changes of up to 4 cells per frame (102 larger than one cell). | W5.json 8e72685446e3; W5-at-tab.png 5cb4f3fee83b |
| W6 | OK | 10 Ctrl+T presses gave 14 tabs; scrollLeft 39, t1 spans -31 to 45. pet.ts's stop at t1 (-3 to 19) starts left of the strip at 0, so the premise holds. Worried played at x 0 for 4010 ms, with no walk animation and x 0 in every sample. | W6.json 784f19b49d93; W6-moment.png 1f4cf796298d |
| W7 | OK | 10250 ms of typing in the active editor. The only state was idle, x stayed 0, and there was no walk or placement animation. | W7.json 61a9f994f9da; W7-after.png b38a18b90eac |
| W9 | OK | The menu showed "✓Show Snip". After Enter and Escape, .pet was hidden (display none, 0x0). The clap on t1 started no walk and x stayed 0. After toggling back on, .pet was visible at 853,6 22x22. Unjudged: one strip animation counted as running while hidden. | W9.json 13c2afdcd921; W9-off-moment.png 647dee25739f; W9-on.png |
| N1 | OK | Sleep 7 ms after "10 minuten later", at x 0. | N12.json 37ec024c9f0a; N1-sleep.png b64a02b3467d |
| N2 | OK | The friend's first x is 428 (left 1281 against innerWidth 1280). It walks 1400 ms to x 24, 2 px beside Snip, then: friend clap (the tap); Snip turns to face -1 and claps 1210 ms; the friend waves; the friend walks off 1400 ms; Snip waves; the friend gets gone; Snip goes idle at 0 and turns to face 1. Total from the save to Snip's last turn: 5557 ms. To gone: 5238 ms. | N12.json; N2-together.png 5f75cc7904c7; N2-end.png ae4e680dc447 |
| N3 | OK | Save at 551 ms, paste at 759 ms. Snip walked from sleep to t1, clapped and walked home. The friend finished its walk-in, turned and walked off (gone at 3358 ms). End: one Snip svg idle at x 0, one friend svg with class gone. | N3.json 334228dc45d4; N3-at-tab.png 73ada9678938; N3-end.png |
| M1 | FOUT (reproduced) | Saves at 362 ms and 666 ms. The second save placed the friend back at 428 and it was gone at 705 ms. Snip's state was sleep from 15 ms to the end of the trace at 7815 ms. | M1.json d6bb9e71c1ba; M1-end.png 42b717ede533 |
| M2 | FOUT (reproduced) | Clap at x -692, then "10 minuten later" at 1576 ms: sleep at x -692 from 1583 ms, still at -692 4 s later. After the save the friend walked from 428 to -668 over the tabs. They clapped and waved, and the friend left. Snip ended idle at x -692 (left 161), over t1. | M2.json 8915b24ae0d6; M2-asleep.png 6147143c263b; M2-end.png ad20e4e2bd7e |
| CT5 | OK | With reduced motion, the clap played at x 0 with no walk animation. "10 minuten later" gave sleep; the save gave idle with no friend svg and no running animation. Reset to no-preference afterwards. | CT5.json 532c079a645f; CT5-clap.png 80c348e7bf7e |
| CT1 | OK | Light: body rgb(123,79,214), claw rgb(95,143,10), eye white, pupil rgb(36,36,36), bar rgb(243,243,243). Dark: body rgb(178,146,255), claw rgb(180,224,74), eye rgb(36,36,36), pupil white, bar rgb(32,32,32). The 8x PNGs show white eyes with a dark pupil top-left in light and dark eyes with a white glint top-left in dark; the edges are hard in both. | CT1.json ae71a5255a63; CT1-light-home-x8.png a548bf102693; CT1-dark-home-x8.png 02591ec66163 |
| CT2 | FOUT (1.25, 1.5) | dpr 1 OK: 22 device px = 11x2, home 853,6, whole positions, 0 blended pixels. dpr 2 OK: 44 = 11x4, home 1706,12, 0 blended pixels. dpr 1.25 FOUT: home origin 1066.25,10.25 device px and every sampled left ends in .25. The layout width is 17.59375 CSS px = 21.992 device px (attribute 17.6 stored in 1/64 px units); the painted body and claw span 22 device px (11 cells of 2). The whole-multiple rule is judged on the painted width and the crispness on the PNG: 82 blended pixels at home, 74 at the tab. dpr 1.5 FOUT on crispness only: width 33 = 11x3 and cell 3 meet the rule, but home starts at 1279.5 device px and every left ends in .5; 120 blended pixels at home, 90 at the tab. Walks match W1 at every factor: 1400 ms, keyframes 1 cell apart, at most 4 cells per sample (5 at 1.25). | CT2.json c488ea8541f4; CT2-pixels.json baecb0d1a6ad; CT2-dpr*-{home,at-tab}-clip(-x8).png |

Counts: OK 9, FOUT 6, NOT CHECKED 0.

Coordinator's ruling (2026-11-09): W1 and W5 are FOUT only on the brief's rule "one cell per sample", which cannot hold under the 1400 ms cap (`WALK_MAX_MS`); the cap is the intended behaviour, so W1 and W5 count as OK and the owner judges smoothness at 60 Hz in the real window. M1 and M2 are the reviewer's majors, fixed in PR #105; they are rerun on the fixed head. W2 and CT2 are minors, filed as issues, not blocking 1.1.0.

## FOUT details

### W1, W5: more than one cell between samples
- Expected (brief): every change between consecutive samples is exactly one cell.
- Trace: the keyframes are one cell apart (key_steps_px [2.0]), but the rendered frames skip cells. In W1, 104 of 129 changes per walk are larger than one cell, the largest 4.
- Cause: steps/CELLS_PER_S is capped at WALK_MAX_MS 1400 (pet.ts:25-26, 186). One cell per frame over 346 cells would take 3.46 s at 100 Hz, or 5.8 s at 60 Hz.
- At 60 Hz the jumps are larger than in this trace (inferred).
- W3 (45 cells in 1125 ms) is one cell per change.
- The W5 cut itself is clean.

### W2: 1 px into the close button's box
- Expected: Snip's right edge at or left of the close button's left edge.
- Trace: right edge 183 against 182 at dpr 1, 1.5 and 2; 182.59 against 182 at 1.25 (W1.json, CT2.json).
- Cause: pet.ts:142-145. The center is 208-26-11 = 171, so the offset is -693 px = -346.5 cells. Math.round gives -346, which rounds toward the right.
- The x glyph stays visible and clear by 5 px (W1-at-tab.png).
- W3's even offset stops exactly at the edge.

### M1 (reviewer, reproduced)
- Expected (reviewer): Snip stays asleep and the friend leaves.
- Trace: exactly that. Snip's states are [idle 5.8, sleep 15.3] to the end at 7815 ms; the friend is gone at 705 ms (M1.json). M1-end.png shows Snip lying asleep at home.
- A reproduced reviewer defect counts as FOUT: the first save after a nap should wake Snip.

### M2 (reviewer, reproduced)
- Expected (reviewer): Snip sleeps over the tab and ends idle there after the save.
- Trace: exactly that. Sleep at x -692 from 1583 ms. The friend walks to -668. The end sample is x -692, state idle (M2.json extra.end).
- M2-asleep.png shows the sleeping Snip over labo-04.md next to the x.

### CT2: soft edges at 1.25 and 1.5
- Cause: fit() makes the cell a whole number of device px (pet.ts:79), but the home origin falls on a fractional device px (1066.25 and 10.25 at 1.25, 1279.5 at 1.5). spot() snaps only the offset from home (pet.ts:145), so every position keeps that fraction.
- Capture: full-viewport screenshots (origin 0,0, so no capture resampling) show blended colours inside Snip's box and sprite runs that are not whole cells (CT2-pixels.json). An earlier run with fractional clip origins gave the same counts; it is kept in clip-run1/ and superseded.
- Seen at 8x:
  - dpr1_25 home and at-tab, dpr1_5 home and at-tab: a lighter half-tone column on the left and right edges of the claws, body and legs, and a grey half-column beside the pupils.
  - dpr1 home and at-tab, dpr2 home and at-tab: hard edges, only the flat colours.
- Observed with emulated deviceScaleFactor in headless Chromium; WebView2 not checked. Inferred cause: the animated svg layer is composited at a fractional device offset.

## What only the real window can show
- WebView2's rasterising and compositing of the transparent, frameless Tauri window.
- The real refresh rate: whether a 1400 ms walk reads as smooth at 60 Hz.
- Windows display scale: real 125% and 150% with the app's 1200 px layout (the fractional home origin depends on it), and per-monitor DPI changes.
- The owner's theme: the Windows light/dark mapping and the Mica backdrop.
- The Windows setup:
  - "Animatie-effecten" mapped to prefers-reduced-motion.
  - Real window focus and blur.
  - Real paste, the file watcher and the Recycle Bin.
  - The real 10-minute timer.
  - The CSP; the demo runs without it.
