use snipmd_core::assets::assets_dir_for;
use std::path::Path;

#[test]
fn image_folder_sits_next_to_the_note_under_its_stem() {
    assert_eq!(assets_dir_for(Path::new("/n/labo-04.md")), Path::new("/n/labo-04.assets"));
    assert_eq!(assets_dir_for(Path::new("/n/a.b.markdown")), Path::new("/n/a.b.assets"));
    assert_eq!(assets_dir_for(Path::new("/n/lab notes.md")), Path::new("/n/lab notes.assets"));
}
