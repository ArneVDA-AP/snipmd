//! R5: Markdown link paths (SPEC §6.3, §6.4). Encode in phase 3, rewrite in phase 4.

/// R5. Percent-encodes exactly space, `(`, `)`, `#` and `%`; everything else stays.
pub fn encode_link_path(p: &str) -> String {
    let mut out = String::with_capacity(p.len());
    for c in p.chars() {
        match c {
            ' ' => out.push_str("%20"),
            '(' => out.push_str("%28"),
            ')' => out.push_str("%29"),
            '#' => out.push_str("%23"),
            '%' => out.push_str("%25"),
            c => out.push(c),
        }
    }
    out
}

/// R5. Rewrites image link targets that start with exactly `old` to start with `new`.
/// Returns the new text and the number of links changed.
pub fn rewrite_prefix(text: &str, old: &str, new: &str) -> (String, usize) {
    todo!("phase 4")
}
