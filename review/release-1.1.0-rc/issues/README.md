# Issue drafts for the minors deferred past 1.1.0

Open issues checked: `gh issue list --state open --limit 100`, #98, #25. Labels from `gh label list`: only `bug` is used. `file-issues.sh` creates two issues and posts two comments (not run yet).

| slug | action | title | labels | summary |
|---|---|---|---|---|
| snip-rc-minors | new issue | Snip: minor findings from the 1.1.0 release candidate checks, deferred | bug | Umbrella list of six Snip minors: spot rounding (W2), soft edges at 1.25 and 1.5 (CT2, walk m6), stale geometry (m7, m8), nap and visit overlaps (m1-m4), reduced motion read once (m5), friend's capped walk (m9). |
| closed-tab-refused-write | new issue | A closed tab's refused write is sent again on every blur and close | bug | `external.ts:112-115`: `writeNote` 3 calls for 3 flushes, tab never in conflict. (diff m5) |
| issue98-normpath | comment on #98 | (comment) | - | Adds drive-relative and `\\?\` spellings and the UNC detail to item 6. (diff m6, m7) |
| issue98-pet-tests | comment on #98 | (comment) | - | Adds the untested Snip cases to item 7. (walk m11) |

## Skipped

- headless W1, W5, and walk M3: not defects, the 1400 ms cap (`WALK_MAX_MS`) is intended.
- headless M1, M2 and walk M1, M2: fixed in #105.
- diff-coverage M1 (path hold race): fixed in #105.
- diff-coverage M2, M3: majors about the test plan, not product defects; not in the brief.
- diff-coverage m1, m2, m3, m4, m8: gaps or errors in the test plan or the review environment, not product defects. m3 is also covered by #98 item 7.
- diff-coverage m6 (UNC `..`): duplicate of #98 item 6; its extra detail is in the #98 comment.
- walk m10 (untitled tabs never count as a save): matches SPEC.md:49, not a defect.
- walk m12 (test plan does not check the wake rule): test plan gap; the code tests are #98 item 7.
