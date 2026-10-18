## Summary

<!-- Briefly describe what this PR changes and why. -->

## Architectural Invariants Checklist

- [ ] `npm run lint` (`tsc --noEmit`) passes with zero errors
- [ ] `npm run build` (`vite build`) compiles cleanly with zero warnings
- [ ] CodeMirror 6 inline screenshot widgets remain inside `StateField<DecorationSet>` (never `ViewPlugin`)
- [ ] Scratchpad `.assets/` garbage collection (`gc_scratch_assets`) only triggers on `load_session`, `Ctrl+S`, or `Ctrl+W` (never on `window.blur`)
- [ ] UI styling uses semantic theme variables (`var(--bg-main)`, `var(--text-main)`, `var(--accent)`, etc.) across all 8 themes
