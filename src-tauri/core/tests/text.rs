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
fn no_line_break_sniffs_crlf() {
    assert!(sniff(b"one line").crlf);
    assert!(sniff(b"").crlf);
    assert_eq!(TextFormat::NEW_FILE, TextFormat { crlf: true, bom: false });
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
