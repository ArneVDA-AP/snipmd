# Headless Snip rerun on the fixed candidate (eb42ce6 / 2426ed9)

Written by the coordinating session from the verifier's and the headless agent's hand-backs of 2026-11-09; the harness refused both agents' writes of this file. Every number below is from their reports (observed in the JSON or PNG they name), unless marked inferred.

## Environment
- Date 2026-11-09. Machine DESKTOP, Windows 11 Pro 10.0.22631. Headless Chromium 156.0.8078.80 via playwright-cli 0.1.23, viewport 1280x720, never headed.
- Code: PR #105 head eb42ce6 for M1, M2, N12, N3, W1, CT5 (merged as 6e62404 into `claude/release-1.1.0`); 2426ed9 for W8 (same source, the last commit is docs only).
- Demo `tools/demo/snip-walk` served by vite on 127.0.0.1:5199 (ready in 716 ms for the first run; vite-w8.log for W8). Scripts copied from the 1a3e086 run; only the OUT path in src/harness.js changed. The 1a3e086 results in the parent folder were not touched.

## Results
| ID | Verdict | Measured | 1a3e086 value | Evidence |
|---|---|---|---|---|
| M1 | OK | Saves 307 ms apart after the nap. Snip woke, the friend visited once, Snip ended idle at x 0. | Asleep to the end of the trace | M1.json, M1-end.png |
| M2 | OK | After the clap at the far tab Snip walked home first (idle at home at 4198 ms); the nap began at 4617 ms at home, 420 ms after arriving, not during the walk. After the save the friend visited once; Snip ended idle at x 0. | Ended at x -692 over the tab | M2.json, M2-asleep.png, M2-end.png |
| N1 | OK | Sleep after the skip, at home. State sequence equal to the 1a3e086 run. | equal | N12.json, N1-sleep.png |
| N2 | OK | Visit 5553 ms from the save to Snip's last turn. State sequence equal. | 5557 ms | N12.json, N2-together.png, N2-end.png |
| N3 | OK | State sequence equal to the 1a3e086 run; durations within 1 to 2 %. | equal | N3.json, N3-at-tab.png, N3-end.png |
| W1 | OK | Walks 1350.6 ms first to last change; state sequence equal. | 1350.5 ms | W1.json, W1-at-tab.png, W1-home.png |
| CT5 | OK | Reduced motion: clap at home without a walk; nap; the waking save brings no friend. Equal. | equal | CT5.json, CT5-clap.png, CT5-sleep.png, CT5-woken.png |
| W8 | OK | 2 minutes real time, page focused, native Math.random, no skip: 3 glances right (expected 2 to 6) at 29.566, 72.137 and 95.098 s, each 0.910, 0.900 and 0.910 s; gaps 42.571 and 22.960 s (expected 20 to 45 s); state idle only; x 0; idle strip running every frame with 82 frame changes (breath and blink); 12157 frames over 121572 ms, largest frame gap 10.5 ms; focus never lost. One 2-minute run is one random draw and does not show the distribution. | not run | W8.json, W8-end.png, W8.js |

| W3 | OK | idle, walk, relief, walk, idle; walks 1125 ms each way (46 keys); first to last change 1020.5 ms both ways; every change 1 cell; stop at x -90 with right edge 785 = close edge 785; ends idle at x 0. | same states; 1125 ms; 1020.5 / 1021.1 ms; stop -90, edge 785 | W3.json (0bb307fc7921), W3-at-tab.png (byte-identical to 1a3e086) |
| W6 | OK | 10 Ctrl+T presses; idle, worried for 4001 ms at x 0, idle; no walk. | worried 4010 ms at x 0; no walk | W6.json (7e0e66a8e532), W6-before.png, W6-moment.png |
| W7 | OK | 10052 ms of typing; idle only, x 0, no walk. | 10250 ms; idle only | W7.json (0bb2b8a6a198), W7-before.png, W7-after.png |
| W9 | OK | Off: .pet hidden, 0x0, display none; the clap plays 1200 ms at x 0 with no walk; on: back at 853,6 22x22. | clap 1211 ms; same geometry | W9.json (b0d24e43a22c), W9-off-moment.png, W9-on.png (byte-identical) |
| CT1 | OK | All light and dark fills equal (eye white / pupil rgb(36,36,36) in light; eye rgb(36,36,36) / pupil white in dark); the four PNGs, 8x included, are byte-identical to the 1a3e086 ones (hard edges). | same colours | CT1.json (ae71a5255a63, identical hash), CT1-light-home-x8.png (a548bf102693), CT1-dark-home-x8.png (02591ec66163) |

| W5 | OK | The walk toward t4 starts at 43.8 ms and is cut at 443.8 ms with Snip at x -24; the new walk runs -24 to -692 (335 keys, 1400 ms); samples at the cut -22 -24 -24 -24 -24 -24 -24 -26, at most one cell per step; worried at t1; one walk home (-692 to 0, 1400 ms); idle at x 0. In the 3 s after settling no further walk started; only the idle strip loop was running. | cut at 511.8 ms at -24; same new walk, same samples, same states, one walk home | W5x.json (63fcc234836d), W5-at-tab.png and W5-home.png (byte-identical to 1a3e086), W5x.js (the W5 script plus a 3 s tail and the end check) |

Counts: OK 14, FOUT 0. Every case of the 1a3e086 run except W2 and CT2 (minors, issue #106) has a post-fix value; W4 is the owner's real-window row.

The verifier opened M1-end.png and M2-end.png (byte-identical): the purple crab awake at home beside the tabs, no friend visible.

## Cleanup
Vite stopped after each run (PIDs 3824 and 34888); no listener on port 5199; the playwright session `snip-rc` closed; `git status --short` of the RC worktree empty.
