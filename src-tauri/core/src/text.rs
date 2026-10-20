//! R6: keep a note's line endings and BOM (SPEC §6.1). Phase 2.

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

/// R6. Decodes UTF-8 bytes to `\n` text and remembers the original format.
pub fn decode(bytes: &[u8]) -> Result<(String, TextFormat), crate::TextError> {
    let fmt = sniff(bytes);
    let body = if fmt.bom { &bytes[3..] } else { bytes };
    let text = std::str::from_utf8(body).map_err(|_| crate::TextError::NotUtf8)?;
    Ok((text.replace("\r\n", "\n"), fmt))
}

/// R6. Encodes `\n` text back in the given format.
pub fn encode(text: &str, fmt: TextFormat) -> Vec<u8> {
    let norm = text.replace("\r\n", "\n");
    let body = if fmt.crlf { norm.replace('\n', "\r\n") } else { norm };
    let mut out = Vec::with_capacity(body.len() + 3);
    if fmt.bom {
        out.extend_from_slice(&BOM);
    }
    out.extend_from_slice(body.as_bytes());
    out
}
