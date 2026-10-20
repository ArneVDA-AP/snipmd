//! R6: keep a note's line endings and BOM (SPEC §6.1). Phase 2.

/// How a note was stored on disk.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct TextFormat {
    pub crlf: bool,
    pub bom: bool,
}

/// R6. Decodes UTF-8 bytes to `\n` text and remembers the original format.
pub fn decode(bytes: &[u8]) -> Result<(String, TextFormat), crate::TextError> {
    todo!("phase 2")
}

/// R6. Encodes `\n` text back in the given format.
pub fn encode(text: &str, fmt: TextFormat) -> Vec<u8> {
    todo!("phase 2")
}
