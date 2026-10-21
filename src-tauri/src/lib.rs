use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::{ErrorKind, Read};
use snipmd_core::{assets::{self, assets_dir_for}, atomic, cleanup, links::encode_link_path, naming, paths::{self, resolve_image, AllowedSet}, session, text};
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::SystemTime;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, DragDropEvent, Emitter, Manager, PhysicalSize, WebviewWindow, WindowEvent};
use tauri_plugin_dialog::DialogExt;

mod backdrop;
mod links;
mod macos;
mod perf;

type Allowed = Mutex<AllowedSet>;

struct Dropped(Mutex<AllowedSet>);

const MD_EXTENSIONS: &[&str] = &["md", "markdown"];

fn is_md(p: &Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| MD_EXTENSIONS.iter().any(|m| e.eq_ignore_ascii_case(m)))
}

fn allowed(app: &AppHandle) -> std::sync::MutexGuard<'_, AllowedSet> {
    // The set only ever grows, so a panic mid-update cannot leave it in a state worth refusing.
    app.state::<Allowed>()
        .inner()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
}

/// The images of the latest drop: the only files `import_image` will copy. Each drop replaces them.
fn dropped(app: &AppHandle) -> std::sync::MutexGuard<'_, AllowedSet> {
    app.state::<Dropped>().inner().0.lock().unwrap_or_else(|e| e.into_inner())
}

/// The one path into the allowed set for a note (C3). The asset protocol scope is not widened
/// here: it gets single image files, granted where Rust hands an image path to the frontend.
fn allow_note(app: &AppHandle, note: &Path) {
    allowed(app).allow_note(note);
}

/// Lets the webview display exactly this image file, and returns the path string it was
/// granted under, so the frontend builds its asset URL from the same path.
fn displayable(app: &AppHandle, image: &Path) -> String {
    let _ = app.asset_protocol_scope().allow_file(image);
    image.to_string_lossy().into_owned()
}

fn check_path(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    allowed(app).check(Path::new(path)).map_err(|e| e.to_string())
}

/// Notes handed to us on a command line (CLI or a second instance): resolved against the
/// caller's working directory and allowed before the frontend sees them.
fn open_args(app: &AppHandle, args: impl Iterator<Item = String>, cwd: &Path) -> Vec<String> {
    allow_notes(app, args.map(|a| cwd.join(a)).filter(|p| p.is_file()))
}

/// The notes among `paths`, allowed, as strings for the frontend.
fn allow_notes(app: &AppHandle, paths: impl Iterator<Item = PathBuf>) -> Vec<String> {
    paths
        .filter(|p| is_md(p))
        .inspect(|p| allow_note(app, p))
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

enum Pick {
    Open,
    Save(String),
    Folder,
}

/// Shows a native dialog and grants what the user picked: a note (open, save) or a folder for new notes.
async fn pick(app: &AppHandle, kind: Pick) -> Result<Option<String>, String> {
    let (tx, mut rx) = tauri::async_runtime::channel(1);
    let done = move |p| {
        let _ = tx.blocking_send(p);
    };
    let builder = app.dialog().file();
    let folder = matches!(kind, Pick::Folder);
    match kind {
        Pick::Save(name) => builder
            .set_file_name(if name.ends_with(".md") { name } else { format!("{name}.md") })
            .add_filter("Markdown", &["md"])
            .save_file(done),
        Pick::Open => builder.add_filter("Markdown", MD_EXTENSIONS).pick_file(done),
        Pick::Folder => builder.pick_folder(done),
    }
    let picked = rx.recv().await.ok_or_else(|| "dialog closed unexpectedly".to_string())?;
    let Some(fp) = picked else { return Ok(None) };
    let path = fp.into_path().map_err(|e| e.to_string())?;
    if folder {
        allowed(app).allow_note_folder(&path);
    } else {
        allow_note(app, &path);
    }
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
async fn pick_open(app: AppHandle) -> Result<Option<String>, String> {
    pick(&app, Pick::Open).await
}

#[tauri::command]
async fn pick_save(app: AppHandle, default_name: String) -> Result<Option<String>, String> {
    pick(&app, Pick::Save(default_name)).await
}

#[tauri::command]
async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    pick(&app, Pick::Folder).await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedImage {
    pub link: String,
    pub abs_path: String,
}

/// Every tab object in a session (open and closed). Read leniently: the TypeScript parser is
/// the authority on the format, Rust only needs the file paths and must never refuse a session.
fn session_tabs(v: &mut Value) -> Vec<&mut Value> {
    let Some(obj) = v.as_object_mut() else { return Vec::new() };
    let mut out = Vec::new();
    for (key, val) in obj.iter_mut() {
        let Some(list) = val.as_array_mut() else { continue };
        match key.as_str() {
            "tabs" => out.extend(list.iter_mut()),
            "closedTabs" => out.extend(list.iter_mut().filter_map(|c| c.get_mut("tab"))),
            _ => {}
        }
    }
    out
}

fn file_path(tab: &Value) -> Option<&str> {
    tab.get("filePath").and_then(Value::as_str)
}

/// `%APPDATA%/com.snipmd.desktop`, or the absolute folder in `SNIPMD_DATA_DIR` (measuring and tests run there,
/// so they never touch the user's session).
pub(crate) fn app_data(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(dir) = std::env::var_os("SNIPMD_DATA_DIR").map(PathBuf::from) {
        // A bad value must never fall back to the real session.
        return if dir.is_absolute() { Ok(dir) } else { Err(format!("SNIPMD_DATA_DIR is not an absolute path: {}", dir.display())) };
    }
    app.path().app_data_dir().map_err(|e| format!("Failed to resolve app_data_dir: {e}"))
}

/// The link prefix an untitled tab's images use; it resolves to the tab's scratch folder.
const UNTITLED_ASSETS: &str = "untitled.assets";

/// Where a tab's images live, decided once per command: next to its note, or in its scratch folder.
enum ImageHome {
    Note(PathBuf),
    Untitled(PathBuf),
}

impl ImageHome {
    /// `note_path` None (or empty, from older sessions) means an untitled tab.
    fn of(app: &AppHandle, tab_id: &str, note_path: Option<&str>) -> Result<Self, String> {
        match note_path.filter(|p| !p.trim().is_empty()) {
            Some(p) => Ok(ImageHome::Note(check_path(app, p)?)),
            None => Self::scratch(app, tab_id).map(ImageHome::Untitled),
        }
    }

    /// An untitled tab's scratch folder, `<app data>/scratch/<tab id>`.
    fn scratch(app: &AppHandle, tab_id: &str) -> Result<PathBuf, String> {
        if !paths::valid_tab_id(tab_id) {
            return Err("Invalid tab id".to_string());
        }
        Ok(app_data(app)?.join("scratch").join(tab_id))
    }

    fn name(&self) -> String {
        match self {
            ImageHome::Note(note) => note_name(note),
            ImageHome::Untitled(_) => "this note".to_string(),
        }
    }

    /// The folder new images go into (created on demand, never a missing note folder) and their link prefix.
    fn folder(&self) -> Result<(PathBuf, String), String> {
        let name = self.name();
        let fail = |e: std::io::Error| format!("Failed to create the image folder of {name}: {e}");
        match self {
            ImageHome::Note(note) => {
                let dir = assets_dir_for(note);
                match fs::create_dir(&dir) {
                    Err(e) if e.kind() != ErrorKind::AlreadyExists => return Err(fail(e)),
                    _ => {}
                }
                let prefix = note_name(&dir);
                Ok((dir, prefix))
            }
            ImageHome::Untitled(dir) => {
                fs::create_dir_all(dir).map_err(fail)?;
                Ok((dir.clone(), UNTITLED_ASSETS.to_string()))
            }
        }
    }

    /// An image link from this tab's text, resolved and checked to be an image file.
    fn resolve(&self, link: &str) -> Result<PathBuf, String> {
        let name = self.name();
        let resolved = match self {
            ImageHome::Note(note) => {
                let dir = note.parent().ok_or_else(|| format!("Invalid folder for {name}"))?;
                resolve_image(dir, link)
            }
            ImageHome::Untitled(dir) => paths::resolve_untitled(dir, link),
        }
        .map_err(|e| format!("{name}: {e}"))?;
        if naming::image_ext(&resolved).is_none() {
            return Err(format!("{name}: not an image: {link}"));
        }
        Ok(resolved)
    }
}

fn store_image(app: &AppHandle, home: &ImageHome, ext: &str, bytes: &[u8]) -> Result<SavedImage, String> {
    let (dir, prefix) = home.folder()?;
    let file = naming::create_snip(&dir, ext, bytes)
        .map_err(|e| format!("Failed to save the image for {}: {e}", home.name()))?;
    let link = encode_link_path(&format!("{prefix}/{}", note_name(&file)));
    Ok(SavedImage { link, abs_path: displayable(app, &file) })
}

/// A header that is present but not ASCII is an error, never read as absent: a missing note
/// path would put the image in the scratch folder of a disk note.
fn header(request: &Request<'_>, name: &str) -> Result<Option<String>, String> {
    request
        .headers()
        .get(name)
        .map(|v| v.to_str().map(str::to_owned).map_err(|_| format!("Unreadable {name} header")))
        .transpose()
}

fn raw_body<'a>(request: &'a Request<'_>) -> Result<&'a [u8], String> {
    match request.body() {
        InvokeBody::Raw(b) => Ok(b),
        _ => Err("Expected a raw request body".to_string()),
    }
}

#[tauri::command(async)]
fn save_image(app: AppHandle, request: Request<'_>) -> Result<SavedImage, String> {
    let bytes = raw_body(&request)?;
    if bytes.is_empty() {
        return Err("The image is empty".to_string());
    }
    let tab_id = header(&request, "x-tab-id")?.ok_or_else(|| "Missing tab id".to_string())?;
    let note_path = header(&request, "x-note-path")?
        .map(|raw| paths::percent_decode(&raw))
        .transpose()
        .map_err(|e| e.to_string())?;
    store_image(&app, &ImageHome::of(&app, &tab_id, note_path.as_deref())?, "png", bytes)
}

#[tauri::command(async)]
fn import_image(app: AppHandle, tab_id: String, note_path: Option<String>, src: String) -> Result<SavedImage, String> {
    let home = ImageHome::of(&app, &tab_id, note_path.as_deref())?;
    let src_path = dropped(&app)
        .check(Path::new(&src))
        .map_err(|_| "That file was not dropped on the window".to_string())?;
    let name = note_name(&src_path);
    let ext = naming::image_ext(&src_path).ok_or_else(|| format!("{name} is not an image"))?;
    let bytes = fs::read(&src_path).map_err(|e| format!("Failed to read {name}: {e}"))?;
    store_image(&app, &home, ext, &bytes)
}

#[tauri::command(async)]
fn resolve_asset_abs_path(
    app: AppHandle,
    tab_id: String,
    rel_path: String,
    current_file_path: Option<String>,
) -> Result<String, String> {
    let resolved = ImageHome::of(&app, &tab_id, current_file_path.as_deref())?.resolve(&rel_path)?;
    Ok(displayable(&app, &resolved))
}

fn note_name(path: &Path) -> String {
    path.file_name().unwrap_or(path.as_os_str()).to_string_lossy().into_owned()
}

/// TextFormat as the frontend sends and receives it (the core crate has no serde).
#[derive(Serialize, Deserialize, Clone, Copy)]
struct Format {
    crlf: bool,
    bom: bool,
}

impl From<text::TextFormat> for Format {
    fn from(f: text::TextFormat) -> Self {
        Format { crlf: f.crlf, bom: f.bom }
    }
}

impl From<Format> for text::TextFormat {
    fn from(f: Format) -> Self {
        text::TextFormat { crlf: f.crlf, bom: f.bom }
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
struct DiskStamp {
    mtime_ms: f64,
    size: u64,
}

/// A write either happened, or was refused because the file is no longer the one the tab knows.
#[derive(Serialize)]
#[serde(untagged)]
enum WriteOutcome {
    Written { written: DiskStamp },
    Changed { changed: Option<DiskStamp> },
}

#[derive(Serialize)]
struct NoteFile {
    text: String,
    format: Format,
    stamp: DiskStamp,
}

#[derive(Serialize)]
struct PrefixMove {
    from: String,
    to: String,
}

/// The file's stamp, or None when it does not exist.
fn stamp(p: &Path) -> std::io::Result<Option<DiskStamp>> {
    match fs::metadata(p) {
        Ok(m) => stamp_of(&m).map(Some),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

fn stamp_of(meta: &fs::Metadata) -> std::io::Result<DiskStamp> {
    let ms = meta
        .modified()?
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0);
    Ok(DiskStamp { mtime_ms: ms.floor(), size: meta.len() })
}

#[tauri::command(async)]
fn read_markdown_file(app: AppHandle, path: String) -> Result<NoteFile, String> {
    let checked = check_path(&app, &path)?;
    let name = note_name(&checked);
    // Bytes and stamp from one open file, so a write in between cannot pair new bytes with an old stamp.
    let read = || -> std::io::Result<(Vec<u8>, DiskStamp)> {
        let mut file = fs::File::open(&checked)?;
        let meta = file.metadata()?;
        let mut bytes = Vec::with_capacity(meta.len() as usize);
        file.read_to_end(&mut bytes)?;
        Ok((bytes, stamp_of(&meta)?))
    };
    let (bytes, stamp) = read().map_err(|e| format!("Failed to read {name}: {e}"))?;
    let (text, fmt) = text::decode(&bytes).map_err(|_| format!("{name} is not UTF-8 text"))?;
    Ok(NoteFile { text, format: fmt.into(), stamp })
}

/// Enough of a note to read its format: sniff needs the BOM and the first line break.
const HEAD_BYTES: u64 = 64 * 1024;

fn read_head(p: &Path) -> std::io::Result<Vec<u8>> {
    let mut head = Vec::new();
    fs::File::open(p)?.take(HEAD_BYTES).read_to_end(&mut head)?;
    Ok(head)
}

#[tauri::command(async)]
fn write_markdown_file(
    app: AppHandle,
    path: String,
    content: String,
    format: Option<Format>,
    expected: Option<DiskStamp>,
) -> Result<WriteOutcome, String> {
    let checked = check_path(&app, &path)?;
    let name = note_name(&checked);
    // Never write over a change made outside SnipMD since the tab last read or wrote the file (SPEC §6.1).
    if let Some(expected) = expected {
        let now = stamp(&checked).map_err(|e| format!("Failed to check {name} before saving: {e}"))?;
        if now != Some(expected) {
            return Ok(WriteOutcome::Changed { changed: now });
        }
    }
    let fmt = match format {
        Some(f) => f.into(),
        None => match read_head(&checked) {
            Ok(head) => text::sniff(&head),
            Err(e) if e.kind() == ErrorKind::NotFound => text::TextFormat::NEW_FILE,
            Err(e) => return Err(format!("Failed to read {name} before saving: {e}")),
        },
    };
    atomic::atomic_write(&checked, &text::encode(&content, fmt)).map_err(|e| format!("Failed to write {name}: {e}"))?;
    match stamp(&checked) {
        Ok(Some(written)) => Ok(WriteOutcome::Written { written }),
        Ok(None) => Err(format!("{name} vanished right after it was written")),
        Err(e) => Err(format!("Failed to read the stamp of {name}: {e}")),
    }
}

#[tauri::command(async)]
fn stat_note(app: AppHandle, path: String) -> Result<Option<DiskStamp>, String> {
    let checked = check_path(&app, &path)?;
    stamp(&checked).map_err(|e| format!("Failed to check {}: {e}", note_name(&checked)))
}

/// How links to a note's image folder start, as written in Markdown: `labo%2004.assets/`.
fn link_prefix(note: &Path) -> String {
    encode_link_path(&format!("{}/", note_name(&assets_dir_for(note))))
}

#[tauri::command(async)]
fn promote_untitled(app: AppHandle, tab_id: String, note_path: String) -> Result<Option<PrefixMove>, String> {
    let scratch = ImageHome::scratch(&app, &tab_id)?;
    let note = check_path(&app, &note_path)?;
    let name = note_name(&note);
    let empty = match fs::read_dir(&scratch) {
        Ok(mut it) => it.next().is_none(),
        Err(e) if e.kind() == ErrorKind::NotFound => true,
        Err(e) => return Err(format!("Failed to read the images of this note: {e}")),
    };
    if empty {
        return Ok(None);
    }
    assets::move_dir(&scratch, &assets_dir_for(&note)).map_err(|e| format!("Failed to move the images to {name}: {e}"))?;
    Ok(Some(PrefixMove { from: format!("{UNTITLED_ASSETS}/"), to: link_prefix(&note) }))
}

#[tauri::command(async)]
fn copy_assets(app: AppHandle, from_note: String, to_note: String) -> Result<Option<PrefixMove>, String> {
    let from = check_path(&app, &from_note)?;
    let to = check_path(&app, &to_note)?;
    let src = assets_dir_for(&from);
    // Same note, or another extension of the same stem: the folder is already the right one.
    if src == assets_dir_for(&to) || !src.is_dir() {
        return Ok(None);
    }
    assets::copy_dir(&src, &assets_dir_for(&to)).map_err(|e| format!("Failed to copy the images of {} to {}: {e}", note_name(&from), note_name(&to)))?;
    Ok(Some(PrefixMove { from: link_prefix(&from), to: link_prefix(&to) }))
}

#[tauri::command(async)]
fn default_note_folder(app: AppHandle) -> Result<String, String> {
    let dir = app.path().document_dir().map_err(|e| format!("Failed to find Documents: {e}"))?.join("Notes");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create the Notes folder: {e}"))?;
    allowed(&app).allow_note_folder(&dir);
    Ok(dir.to_string_lossy().into_owned())
}

/// The new note's path, after the name and the folder passed their checks.
fn new_note_path(app: &AppHandle, folder: &str, name: &str) -> Result<PathBuf, String> {
    if !paths::valid_note_name(name) {
        return Err(format!("{name} is not a valid note name"));
    }
    if !allowed(app).may_create_in(Path::new(folder)) {
        return Err("Notes cannot be created in that folder".to_string());
    }
    Ok(Path::new(folder).join(name))
}

#[tauri::command(async)]
fn note_name_free(app: AppHandle, folder: String, name: String) -> Result<bool, String> {
    let path = new_note_path(&app, &folder, &name)?;
    taken(&path).map(|t| !t).map_err(|e| format!("Failed to check {name}: {e}"))
}

/// A name is taken by an existing note or by an image folder it would inherit.
fn taken(note: &Path) -> std::io::Result<bool> {
    Ok(note.try_exists()? || assets_dir_for(note).try_exists()?)
}

#[tauri::command(async)]
fn claim_new_note(app: AppHandle, folder: String, name: String) -> Result<String, String> {
    let path = new_note_path(&app, &folder, &name)?;
    if assets_dir_for(&path).try_exists().unwrap_or(true) {
        return Err(format!("An image folder for {name} already exists"));
    }
    match fs::OpenOptions::new().write(true).create_new(true).open(&path) {
        Ok(_) => {}
        Err(e) if e.kind() == ErrorKind::AlreadyExists => return Err(format!("{name} already exists")),
        Err(e) => return Err(format!("Failed to create {name}: {e}")),
    }
    allow_note(&app, &path);
    Ok(path.to_string_lossy().into_owned())
}

/// SPEC §6.5: at startup, on its own thread so startup never waits, read session.json and clean
/// the scratch folder. No session, an unreadable one or one without open tabs (the frontend
/// discards it) cleans nothing. A tab with a file path has no known text (None): its scratch
/// items are kept; an untitled tab's text is its content.
fn start_cleanup(app_data: PathBuf) {
    std::thread::spawn(move || {
        let Ok(raw) = fs::read_to_string(app_data.join("session.json")) else { return };
        let Ok(mut session) = serde_json::from_str::<Value>(&raw) else { return };
        if !session.get("tabs").and_then(Value::as_array).is_some_and(|t| !t.is_empty()) {
            return;
        }
        let live = live_tabs(&mut session);
        let removed = cleanup::clean_scratch(&app_data.join("scratch"), &live, SystemTime::now(), cleanup::SCRATCH_GRACE);
        if removed > 0 {
            eprintln!("cleanup: removed {removed} unused scratch item(s)");
        }
    });
}

/// Every session tab id (open and closed) with its text when the session holds it.
fn live_tabs(session: &mut Value) -> HashMap<String, Option<String>> {
    let mut live: HashMap<String, Option<String>> = HashMap::new();
    for tab in session_tabs(session) {
        let Some(id) = tab.get("id").and_then(Value::as_str) else { continue };
        let text = file_path(tab).is_none().then(|| tab.get("content").and_then(Value::as_str).unwrap_or(""));
        // An id seen twice keeps both texts; once None, it stays None.
        match (live.entry(id.to_string()).or_insert_with(|| Some(String::new())), text) {
            (Some(all), Some(t)) => all.extend(["\n", t]),
            (known, _) => *known = None,
        }
    }
    live
}

#[tauri::command(async)]
fn load_session(app: AppHandle) -> Result<Option<String>, String> {
    let app_data = app_data(&app)?;
    // An unreadable session is kept aside (its untitled text may be recoverable by hand); when it
    // cannot be, the error tells the page not to write a fresh session over it.
    let raw = match session::load(&app_data.join("session.json"), |s| serde_json::from_str::<Value>(s).is_ok())? {
        session::Loaded::Text(raw) => raw,
        session::Loaded::Missing | session::Loaded::SetAside(_) => return Ok(None),
    };
    let mut parsed: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    for p in session_tabs(&mut parsed).into_iter().filter_map(|t| file_path(t)) {
        allow_note(&app, Path::new(p));
    }
    if let Some(folder) = parsed.get("lastFolder").and_then(Value::as_str) {
        allowed(&app).allow_note_folder(Path::new(folder));
    }
    Ok(Some(raw))
}

#[tauri::command(async)]
fn save_session(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let json = std::str::from_utf8(raw_body(&request)?).map_err(|_| "Session is not UTF-8 text".to_string())?;
    let mut parsed: Value = serde_json::from_str(json).map_err(|e| format!("Invalid session JSON: {e}"))?;
    // A path outside the allowed set is dropped (the tab restores as untitled; a clean tab's
    // text is not in the session, so it comes back empty),
    // so a compromised webview cannot plant paths for the next start. Normal use never gets
    // here, and the save itself must not fail over it (guardrail 5), so it is only logged.
    let mut dropped = 0usize;
    if parsed.get("lastFolder").and_then(Value::as_str).is_some_and(|f| !allowed(&app).may_create_in(Path::new(f))) {
        parsed["lastFolder"] = Value::Null;
        dropped += 1;
    }
    for tab in session_tabs(&mut parsed) {
        if file_path(tab).is_some_and(|p| check_path(&app, p).is_err()) {
            tab["filePath"] = Value::Null;
            dropped += 1;
        }
    }
    let json = if dropped == 0 { std::borrow::Cow::Borrowed(json) } else { parsed.to_string().into() };
    let app_data = app_data(&app)?;
    fs::create_dir_all(&app_data)
        .map_err(|e| format!("Failed to create app_data_dir: {e}"))?;
    let session_path = app_data.join("session.json");
    if dropped > 0 {
        eprintln!("session: left out {dropped} file path(s) outside the allowed set");
    }
    atomic::atomic_write(&session_path, json.as_bytes()).map_err(|e| format!("Failed to write session.json: {e}"))
}

#[tauri::command(async)]
fn get_cli_startup_files(app: AppHandle) -> Vec<String> {
    let cwd = std::env::current_dir().unwrap_or_default();
    open_args(&app, std::env::args().skip(1), &cwd)
}

/// The configured first size (1200 x 820) is taller than the work area of a 1080p laptop at 150%
/// or a 1440p screen at 200%, which would put the bottom of the window off-screen.
fn fit_to_screen(window: &WebviewWindow) {
    let (Ok(Some(monitor)), Ok(outer), Ok(inner)) = (window.current_monitor(), window.outer_size(), window.inner_size()) else { return };
    let area = monitor.work_area().size;
    let (over_w, over_h) = (outer.width.saturating_sub(area.width), outer.height.saturating_sub(area.height));
    if over_w == 0 && over_h == 0 {
        return;
    }
    // `set_size` sets the inner size, so take the overflow of the outer frame off the inner size.
    let _ = window.set_size(PhysicalSize::new(inner.width.saturating_sub(over_w), inner.height.saturating_sub(over_h)));
    let _ = window.center();
}

pub fn run() {
    perf::start();
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let md_files = open_args(app, argv.into_iter().skip(1), Path::new(&cwd));
            if !md_files.is_empty() {
                let _ = app.emit("open-files", md_files);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri::plugin::Builder::<tauri::Wry>::new("navigation-guard")
                .on_navigation(|_, url| links::app_url(url))
                .build(),
        )
        .manage(Allowed::new(AllowedSet::new()))
        .manage(Dropped(Mutex::new(AllowedSet::new())))
        .manage(macos::OpenedNotes::default())
        .setup(|app| {
            let handle = app.handle();
            if let Some(window) = handle.get_webview_window("main") {
                fit_to_screen(&window);
                backdrop::apply(&window);
            }
            if let Ok(dir) = app_data(handle) {
                allowed(handle).allow_dir(&dir);
                start_cleanup(dir);
            }
            #[cfg(target_os = "macos")]
            macos::setup(handle)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, position }) = event {
                let app = window.app_handle();
                let notes = allow_notes(app, paths.iter().cloned());
                let mut set = AllowedSet::new();
                let images: Vec<String> = paths
                    .iter()
                    .filter(|p| naming::image_ext(p).is_some())
                    .inspect(|p| set.allow_file(p))
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                *dropped(app) = set;
                let _ = app.emit(
                    "files-dropped",
                    serde_json::json!({ "notes": notes, "images": images, "x": position.x, "y": position.y }),
                );
            }
        })
        .invoke_handler(tauri::generate_handler![
            save_image,
            import_image,
            resolve_asset_abs_path,
            read_markdown_file,
            write_markdown_file,
            stat_note,
            promote_untitled,
            copy_assets,
            default_note_folder,
            pick_folder,
            note_name_free,
            claim_new_note,
            load_session,
            save_session,
            get_cli_startup_files,
            pick_open,
            pick_save,
            links::open_link,
            backdrop::window_backdrop,
            perf::perf_mark,
            macos::take_opened_notes,
            macos::quit_ready
        ])
        .build(tauri::generate_context!())
        .expect("error while building SnipMD tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &_event {
                macos::opened(_app, urls);
            }
        });
}
