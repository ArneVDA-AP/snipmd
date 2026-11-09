# Snip: minor findings from the 1.1.0 release candidate checks, deferred

These are minor Snip findings from the checks of the 1.1.0 candidate; none blocks 1.1.0.

1. **Snip's right edge touches the close button's box on a far tab.** At an odd half-cell offset the right edge ends 1 px inside the button's box (`src/pet.ts:142-145`, `spot()`); the x glyph stays clear by 5 px.
   Right edge 183 against 182 at dpr 1, 1.5 and 2; 182.59 against 182 at 1.25. Center 208-26-11 = 171, offset -693 px = -346.5 cells; `Math.round` gives -346, toward the right. An even offset stops exactly at the edge (785 = 785).
   Fix: round the cell offset down instead of to the nearest cell, or clamp it to the button's left edge.
2. **Soft edges at display scales 1.25 and 1.5.** Blended pixels inside Snip's box; hard edges at 1 and 2 (`src/pet.ts:79` `fit()`, `src/pet.ts:145` `spot()`, `src/styles/main.css:26, 166`). Emulated `deviceScaleFactor` in headless Chromium; WebView2 not checked.
   dpr 1 and 2: 0 blended pixels. dpr 1.25: home origin 1066.25,10.25 device px, 82 blended pixels at home, 74 at the tab. dpr 1.5: home starts at 1279.5 device px, 120 blended at home, 90 at the tab.
   Cause: `fit()` makes the cell whole device px, but the home origin is fractional and `spot()` snaps only the offset from home. Fix: place the home origin on a whole device px too, then check at 125 % and 150 % in the real window.
3. **Stale geometry while Snip is away.** The spot is computed once (`src/pet.ts:226`: `const to = tab === undefined ? undefined : spot(tab);`), so a tab closed, dragged or scrolled (`src/titlebar.ts:99-106`) or a resize leaves Snip at the old spot. A scale change keeps `snip.x` and the keyframes in the old cell size (`src/pet.ts:77-87, 136-146`).
   Found by reading the code, not reproduced; `src/pet.test.ts:27` has a no-op `addEventListener` in its matchMedia mock.
4. **A nap, a moment and the friend's visit overlap** (found in unit tests of `src/pet.ts`). A nap that starts during a walk is lost: `state()` 'sleep', then 'clap', still 'idle' 9 minutes after the return (`:93-99, 228-231`). A moment during a nap wakes Snip without the friend, and the next save brings none (`:214-221`; SPEC.md:49).
   A moment while the friend walks in does not turn it round; it leaves only after the walk-in (`:278`; SPEC.md:49, comment at `:261`).
   A glance can fire during the visit: Snip faces `scaleX(-1)` at 619.7 s and `scaleX(1)` at 620.95 s while the friend walks off (`:204-211, 286-291`).
5. **Reduced motion is read only when a state starts** (`src/petSprite.ts:86, 101`: `if (still.matches) return;`). After "Animatie-effecten" is turned off, idle keeps breathing and blinking until the next state change; turned on, idle stays on one frame until the next moment.
   `grep -n "change" src/petSprite.ts` finds no listener; `src/styles/main.css:309-311` does not stop Web Animations.
6. **The friend's walk is capped at 1.4 s** (`src/pet.ts:270, 186`). On a 3440 px wide screen with a maximised window the walk is about 1 500 to 2 000 px, so the friend dashes (inferred).
   From the source: `away = Math.ceil((window.innerWidth - slot.getBoundingClientRect().left) / cell) * cell` and `Math.min(WALK_MAX_MS, ...)`.
