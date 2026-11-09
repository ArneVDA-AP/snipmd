#!/usr/bin/env bash
set -u
gh issue create --repo ArneVDA-AP/snipmd --title "Snip: minor findings from the 1.1.0 release candidate checks, deferred" --body-file "/c/Users/Admin/AppData/Local/Temp/claude/7323b5bed2752d75/42d8ed5a-578a-4047-85be-4a566a1c9312/scratchpad/out/issues/snip-rc-minors.body.md" --label bug
gh issue create --repo ArneVDA-AP/snipmd --title "A closed tab's refused write is sent again on every blur and close" --body-file "/c/Users/Admin/AppData/Local/Temp/claude/7323b5bed2752d75/42d8ed5a-578a-4047-85be-4a566a1c9312/scratchpad/out/issues/closed-tab-refused-write.body.md" --label bug
gh issue comment 98 --repo ArneVDA-AP/snipmd --body-file "/c/Users/Admin/AppData/Local/Temp/claude/7323b5bed2752d75/42d8ed5a-578a-4047-85be-4a566a1c9312/scratchpad/out/issues/issue98-normpath.comment.body.md"
gh issue comment 98 --repo ArneVDA-AP/snipmd --body-file "/c/Users/Admin/AppData/Local/Temp/claude/7323b5bed2752d75/42d8ed5a-578a-4047-85be-4a566a1c9312/scratchpad/out/issues/issue98-pet-tests.comment.body.md"
