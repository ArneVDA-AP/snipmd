//! Reading and writing one note (SPEC §6.1): the text with its format and stamp, and a write that
//! refuses to go over a file that changed outside SnipMD since the tab last read or wrote it.
use crate::atomic::atomic_write;
use crate::text::{self, TextFormat};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{self, ErrorKind, Read};
use std::path::Path;

/// What SnipMD last knew of a note's file; a different stamp means it changed outside SnipMD.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DiskStamp {
    /// Whole milliseconds, so a stamp survives the round trip through the page's numbers.
    pub mtime_ms: f64,
    pub size: u64,
}

/// A write either happened, or was refused because the file is no longer the one the tab knows.
#[derive(Serialize, Debug, PartialEq)]
#[serde(untagged)]
pub enum WriteOutcome {
    Written { written: DiskStamp },
    Changed { changed: Option<DiskStamp> },
}

#[derive(Serialize, Debug, PartialEq)]
pub struct NoteFile {
    pub text: String,
    pub format: TextFormat,
    pub stamp: DiskStamp,
}

/// The file name of a path, for messages.
pub fn note_name(path: &Path) -> String {
    path.file_name().unwrap_or(path.as_os_str()).to_string_lossy().into_owned()
}

/// The file's stamp, or None when it does not exist.
pub fn stamp(p: &Path) -> io::Result<Option<DiskStamp>> {
    match fs::metadata(p) {
        Ok(m) => stamp_of(&m).map(Some),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

fn stamp_of(meta: &fs::Metadata) -> io::Result<DiskStamp> {
    let ms = meta
        .modified()?
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0);
    Ok(DiskStamp { mtime_ms: ms.floor(), size: meta.len() })
}

/// Reads a note: its `\n` text, the format it was stored in and its stamp. Bytes and stamp come
/// from one open file, so a write in between cannot pair new bytes with an old stamp.
pub fn read(path: &Path) -> Result<NoteFile, String> {
    let name = note_name(path);
    let read = || -> io::Result<(Vec<u8>, DiskStamp)> {
        let mut file = fs::File::open(path)?;
        let meta = file.metadata()?;
        let mut bytes = Vec::with_capacity(meta.len() as usize);
        file.read_to_end(&mut bytes)?;
        Ok((bytes, stamp_of(&meta)?))
    };
    let (bytes, stamp) = read().map_err(|e| format!("Failed to read {name}: {e}"))?;
    let (text, format) = text::decode(&bytes).map_err(|_| format!("{name} is not UTF-8 text"))?;
    Ok(NoteFile { text, format, stamp })
}

/// Enough of a note to read its format: sniff needs the BOM and the first line break.
const HEAD_BYTES: u64 = 64 * 1024;

fn read_head(p: &Path) -> io::Result<Vec<u8>> {
    let mut head = Vec::new();
    fs::File::open(p)?.take(HEAD_BYTES).read_to_end(&mut head)?;
    Ok(head)
}

/// Writes `content` atomically in `format` (None: the format the file has, or a new file's). With
/// `expected`, a file whose stamp differs (changed or gone outside SnipMD) is not written and its
/// stamp now comes back as `Changed`.
pub fn write(path: &Path, content: &str, format: Option<TextFormat>, expected: Option<DiskStamp>) -> Result<WriteOutcome, String> {
    let name = note_name(path);
    if let Some(expected) = expected {
        let now = stamp(path).map_err(|e| format!("Failed to check {name} before saving: {e}"))?;
        if now != Some(expected) {
            return Ok(WriteOutcome::Changed { changed: now });
        }
    }
    let fmt = match format {
        Some(f) => f,
        None => match read_head(path) {
            Ok(head) => text::sniff(&head),
            Err(e) if e.kind() == ErrorKind::NotFound => TextFormat::NEW_FILE,
            Err(e) => return Err(format!("Failed to read {name} before saving: {e}")),
        },
    };
    atomic_write(path, &text::encode(content, fmt)).map_err(|e| format!("Failed to write {name}: {e}"))?;
    match stamp(path) {
        Ok(Some(written)) => Ok(WriteOutcome::Written { written }),
        Ok(None) => Err(format!("{name} vanished right after it was written")),
        Err(e) => Err(format!("Failed to read the stamp of {name}: {e}")),
    }
}
