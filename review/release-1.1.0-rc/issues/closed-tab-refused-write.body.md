**What happens.** A refused write of a closed tab is ignored: the tab does not go into conflict, so every blur and close sends the same refused write again (CONVENTIONS code rule 10: a failure never triggers the same work again). After a restart this applies to every closed dirty tab that was in conflict. The stamp still stops any overwrite, so no data is lost.

**Where.** `src/external.ts:112-115`, `src/saving.ts:213-216`.

**Evidence.**
- A test with three `flushDirty()` calls on a closed tab gives `writeNote` 3 calls and `inConflict('c')` false.
- `git show v1.1.0-4:src/external.ts` lines 110-113 have the same `openTab(id)` guard, so the code is unchanged. SPEC 6.4 now makes "a closed tab holds a path that another tab saved to" a normal state, which makes the case more likely.

**Why it is not fixed in 1.1.0.** Minor: the stamp refuses the write every time, so only repeated work remains.

**Suggested fix.** When a closed tab's write is refused, put it into conflict (or remember the refusal) so a flush does not send it again, with a test that counts `writeNote` calls.
