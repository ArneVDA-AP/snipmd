use snipmd_core::links::encode_link_path;
use snipmd_core::paths::resolve_image;
use std::path::Path;

#[test]
fn encodes_exactly_the_five_characters() {
    assert_eq!(encode_link_path("a b(1)#%.png"), "a%20b%281%29%23%25.png");
    assert_eq!(encode_link_path("dir/é.png"), "dir/é.png");
}

#[test]
fn encoded_form_resolves_back() {
    let s = "my notes.assets/a b(1)#%é.png";
    let got = resolve_image(Path::new("/n"), &encode_link_path(s)).unwrap();
    assert_eq!(got, Path::new("/n").join("my notes.assets").join("a b(1)#%é.png"));
}
