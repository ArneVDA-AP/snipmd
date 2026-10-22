use snipmd_core::text::{decode, encode, sniff, TextFormat};
use snipmd_core::TextError;

fn round(b: &[u8]) {
    let (t, f) = decode(b).unwrap();
    assert_eq!(encode(&t, f), b, "round trip of {b:?}");
}

#[test]
fn round_trips_byte_for_byte() {
    round(b"a\nb\n");
    round(b"a\r\nb\r\n");
    round(b"\xEF\xBB\xBFa\r\nb");
    round(b"\xEF\xBB\xBFa\nb");
    round(b"");
}

#[test]
fn decode_yields_lf_text_and_format() {
    let (t, f) = decode(b"\xEF\xBB\xBFa\r\nb").unwrap();
    assert_eq!(t, "a\nb");
    assert_eq!(f, TextFormat { crlf: true, bom: true });
    let (_, f) = decode(b"a\nb\r\n").unwrap();
    assert!(!f.crlf);
}

#[test]
fn no_line_break_sniffs_the_new_file_format() {
    // CRLF on Windows, LF on macOS (SPEC §6.1, §13).
    assert_eq!(sniff(b"one line").crlf, cfg!(windows));
    assert_eq!(sniff(b"").crlf, cfg!(windows));
    assert_eq!(TextFormat::NEW_FILE, TextFormat { crlf: cfg!(windows), bom: false });
    assert_eq!(TextFormat::default(), TextFormat { crlf: false, bom: false });
}

#[test]
fn non_utf8_is_refused_but_sniffs() {
    let b = b"\xFF\xFE\r\nx";
    assert_eq!(decode(b), Err(TextError::NotUtf8));
    assert!(sniff(b).crlf);
    assert!(sniff(b"\xEF\xBB\xBF\xFF\n").bom);
}

#[test]
fn encode_does_not_double_crlf() {
    let out = encode("a\r\nb\n", TextFormat { crlf: true, bom: false });
    assert_eq!(out, b"a\r\nb\r\n");
}

#[test]
fn lone_cr_survives_decode() {
    let (t, _) = decode(b"a\rb\nc").unwrap();
    assert_eq!(t, "a\rb\nc");
}

#[test]
fn a_note_that_starts_with_a_line_break_sniffs_without_looking_before_it() {
    assert!(!sniff(b"\nsecond line\r\n").crlf);
    assert!(sniff(b"\r\nsecond line\n").crlf);
    assert!(!sniff(b"\n").crlf);
}

#[test]
fn a_lone_cr_is_kept_in_both_formats() {
    assert_eq!(encode("a\rb\n", TextFormat { crlf: true, bom: false }), b"a\rb\r\n");
    assert_eq!(encode("a\rb\n", TextFormat { crlf: false, bom: false }), b"a\rb\n");
    assert_eq!(encode("a\r", TextFormat { crlf: true, bom: false }), b"a\r");
    round(b"a\rb\r\nc\r");
}

#[test]
fn errors_name_their_cause() {
    assert_eq!(TextError::NotUtf8.to_string(), "file is not valid UTF-8");
}
