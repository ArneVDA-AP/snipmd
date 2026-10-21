//! Markdown link paths (SPEC §6.3, §6.4). Encode only; links are rewritten in the editor.

/// Percent-encodes exactly space, `(`, `)`, `#`, `%` and `&` (an entity like `&amp;` would
/// otherwise read differently in Markdown renderers); everything else stays.
pub fn encode_link_path(p: &str) -> String {
    let mut out = String::with_capacity(p.len());
    for c in p.chars() {
        match c {
            ' ' => out.push_str("%20"),
            '(' => out.push_str("%28"),
            ')' => out.push_str("%29"),
            '#' => out.push_str("%23"),
            '%' => out.push_str("%25"),
            '&' => out.push_str("%26"),
            c => out.push(c),
        }
    }
    out
}
