# V1 smoke test findings (Chromium, mocked Tauri, vite on :5199, 1100x700, light and dark)
Harness: run.cjs; results.json; screenshots *.png (sha256.txt). First run with load_session=null is in nullrun/ (app showed a red session-read bar because ipc expects {raw,setAside}; harness issue, the rest identical). Main run answers {raw:null,setAside:null}.

| step | input | expected | observed | evidence | verdict |
|---|---|---|---|---|---|
| 1 | Ctrl+Shift+P, type line, Enter, Esc | menu in top bar, one row unchecked; Enter checks, menu stays; Esc closes, focus in note | one row "Line breaks in read mode" aria-checked false; after Enter true, menu still open; Esc closed, focus in .cm-editor. Menu parent is .infobar | light-1a/1b/1c, dark-1a/1b/1c .png | pass (both) |
| 2 | js and python blocks typed | .tok-keyword in both blocks within 2 s | const, def, return highlighted at 2 s | light-2-highlight, dark-2-highlight | pass (both) |
| 3 | Ctrl+E, click first box, Ctrl+E | highlighted blocks, Copy on each, 2 enabled boxes, text `- [x] a` | 2 pre with tok spans, 2 button.code-copy, boxes [false,true] both enabled; after click text starts `- [x] a` | light-3a-read, 3b-back, dark-3a-read, 3b-back | pass (both) |
| 4 | Ctrl+T x2, drag 3rd to left half of 1st, Ctrl+Shift+PageDown | order changes; active moves right | order [A,B,C*] -> [C*,A,B] -> [A,C*,B] | light-4a/4b/4c, dark-4a/4b/4c | pass (both) |
| 5 | Ctrl+F, type a | count after a moment | .cm-search-count "5 matches" | light-5-find, dark-5-find | pass (both) |

Console errors (verbatim): light: "Failed to load resource: the server responded with a status of 404 (Not Found)" (once; source URL not captured, /favicon.ico is probed separately below). dark: none.
Not checkable without Tauri: clipboard (Copy button effect), release CSP, macOS keys and native menu, real window controls, file I/O, asset protocol.
