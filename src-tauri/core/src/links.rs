//! R5: Markdown link paths (SPEC §6.3, §6.4). Encode in phase 3, rewrite in phase 4.

/// R5. Percent-encodes spaces and `( ) # %` in a relative link path.
pub fn encode_link_path(p: &str) -> String {
    todo!("phase 3")
}

/// R5. Rewrites image link targets that start with exactly `old` to start with `new`.
/// Returns the new text and the number of links changed.
pub fn rewrite_prefix(text: &str, old: &str, new: &str) -> (String, usize) {
    todo!("phase 4")
}
