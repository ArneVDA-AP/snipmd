# CI runs and the phase 5 solo run

Each folder holds the files one run branch added, under that branch's name, so runs that wrote the same paths sit side by side. The branches themselves are parents of the merge commit that added this folder; their full commits (for `phase-5-solo` also its code) stay in history there.

- `windows-run-1` … `windows-run-5`: `windows-run.yml` budgets and real-window screenshots from a Windows runner.
- `macos-run-1` … `macos-run-3`: macOS acceptance probes from a runner.
- `phase-5-solo`: the solo run of phase 5, the baseline for the thin-standard cost comparison.
