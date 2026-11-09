# comment on #98

More on item 7 (tests): `src/pet.test.ts` does not try these cases either.

- The 1.4 s walk cap (no test reads `opts.duration`).
- A nap during a walk or during a moment.
- A second save during the friend's visit.
- An idle glance during the visit.
- Show Snip off during a walk or a visit.
- A tab closed or moved during a walk.
- A display scale change.

Evidence: `grep -n "duration" src/pet.test.ts` shows only the frame-strip check at line 191 and the filter at line 21; the matchMedia mock at line 27 has a no-op `addEventListener`.

Suggested fix: add one test per case, each failing before its fix.
