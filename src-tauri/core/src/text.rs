//! Keep a note's line endings and BOM (SPEC §6.1).

const BOM: [u8; 3] = [0xEF, 0xBB, 0xBF];

/// How a note was stored on disk.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct TextFormat {
    pub crlf: bool,
    pub bom: bool,
}

impl TextFormat {
    /// Format for new notes: Windows line breaks, no BOM.
    pub const NEW_FILE: TextFormat = TextFormat { crlf: true, bom: false };
}

/// R6b. Reads the format from raw bytes. Never fails. No line break counts as crlf.
pub fn sniff(bytes: &[u8]) -> TextFormat {
    let crlf = match bytes.iter().position(|&b| b == b'\n') {
        Some(i) => i > 0 && bytes[i - 1] == b'\r',
        None => true,
    };
    TextFormat { crlf, bom: bytes.starts_with(&BOM) }
}

/// Decodes UTF-8 bytes to `\n` text and remembers the original format.
pub fn decode(bytes: &[u8]) -> Result<(String, TextFormat), crate::TextError> {
    let fmt = sniff(bytes);
    let body = if fmt.bom { &bytes[3..] } else { bytes };
    let text = std::str::from_utf8(body).map_err(|_| crate::TextError::NotUtf8)?;
    let text = if text.contains('\r') { text.replace("\r\n", "\n") } else { text.to_owned() };
    Ok((text, fmt))
}

/// Encodes `\n` text back in the given format.
pub fn encode(text: &str, fmt: TextFormat) -> Vec<u8> {
    // One pass: a `\r` that already precedes a `\n` is dropped, every `\n` gets the chosen break.
    let mut out = Vec::with_capacity(text.len() + if fmt.crlf { text.len() / 16 } else { 0 } + 3);
    if fmt.bom {
        out.extend_from_slice(&BOM);
    }
    let bytes = text.as_bytes();
    for (i, &b) in bytes.iter().enumerate() {
        match b {
            b'\r' if bytes.get(i + 1) == Some(&b'\n') => {}
            b'\n' if fmt.crlf => out.extend_from_slice(b"\r\n"),
            _ => out.push(b),
        }
    }
    out
}
