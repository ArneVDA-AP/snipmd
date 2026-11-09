# comment on #98

More on item 6: `normPath` (`src/paths.ts:12-19`) treats the first segment as the root for drive-relative and `\\?\` paths too, and Rust handles them differently.

- UNC, detail for item 6 (`src/paths.ts:15-17`, `src-tauri/core/src/paths.rs:56-68`): a note forwarded as `\\srv\share\..\x.md` is allowed by Rust under `//srv/x.md` and read by the page as `//srv/share/x.md`, so the open fails "not allowed". Windows resolves it to `\\srv\share\x.md`. Test: `normPath('\\\\srv\\share\\..\\x.md')` is `//srv/share/x.md`.
- Drive-relative: `normPath('C:foo\\..\\x.md')` is `C:foo/x.md`; Windows gives `C:x.md`.
- `\\?\` paths: `normPath('\\\\?\\UNC\\srv\\share\\..\\x.md')` is `//?/UNC/srv/x.md`; Windows does not resolve `..` after `\\?\`.
- Inferred from source: Rust `normalize` returns None for drive-relative paths (`paths.rs:171-174`), so such an open fails with an error. It does not write elsewhere.

Suggested fix: when Rust is fixed for item 6, add test cases for these two spellings on both sides.
