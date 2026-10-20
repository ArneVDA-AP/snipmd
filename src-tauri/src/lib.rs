use chrono::Local;
use rand::Rng;
use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{ErrorKind, Read, Write};
use snipmd_core::{atomic, paths::{resolve_image, AllowedSet}, text};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, DragDropEvent, Emitter, Manager, Url, WindowEvent};
use tauri_plugin_dialog::DialogExt;

type Allowed = Mutex<AllowedSet>;

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
    args.map(|a| cwd.join(a))
        .filter(|p| p.is_file() && is_md(p))
        .inspect(|p| allow_note(app, p))
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

async fn pick(app: &AppHandle, save_name: Option<String>) -> Result<Option<String>, String> {
    let (tx, mut rx) = tauri::async_runtime::channel(1);
    let done = move |p| {
        let _ = tx.blocking_send(p);
    };
    let builder = app.dialog().file();
    match save_name {
        Some(name) => builder
            .set_file_name(if name.ends_with(".md") { name } else { format!("{name}.md") })
            .add_filter("Markdown", &["md"])
            .save_file(done),
        None => builder.add_filter("Markdown", MD_EXTENSIONS).pick_file(done),
    }
    let picked = rx.recv().await.ok_or_else(|| "dialog closed unexpectedly".to_string())?;
    match picked {
        Some(fp) => {
            let path = fp.into_path().map_err(|e| e.to_string())?;
            allow_note(app, &path);
            Ok(Some(path.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
async fn pick_open(app: AppHandle) -> Result<Option<String>, String> {
    pick(&app, None).await
}

#[tauri::command]
async fn pick_save(app: AppHandle, default_name: String) -> Result<Option<String>, String> {
    pick(&app, Some(default_name)).await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveImageResult {
    pub markdown_rel_path: String,
    pub abs_disk_path: String,
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

fn resolve_scratchpad_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app_data_dir: {e}"))?;
    Ok(app_data.join("scratchpad"))
}

fn resolve_assets_dir(app: &AppHandle, current_file_path: Option<&str>) -> Result<PathBuf, String> {
    match current_file_path {
        Some(path_str) if !path_str.trim().is_empty() => {
            let md_path = check_path(app, path_str)?;
            let parent = md_path
                .parent()
                .ok_or_else(|| format!("Cannot resolve parent directory of {path_str}"))?;
            Ok(parent.join(".assets"))
        }
        _ => Ok(resolve_scratchpad_dir(app)?.join(".assets")),
    }
}

fn extract_referenced_snips(text: &str) -> HashSet<String> {
    let re = Regex::new(r"\.assets/(snip-[A-Za-z0-9_-]+\.png)").expect("Valid snip regex");
    let mut set = HashSet::new();
    for cap in re.captures_iter(text) {
        if let Some(m) = cap.get(1) {
            set.insert(m.as_str().to_string());
        }
    }
    set
}

#[tauri::command(async)]
fn save_clipboard_image(
    app: AppHandle,
    bytes: Vec<u8>,
    current_file_path: Option<String>,
) -> Result<SaveImageResult, String> {
    let assets_dir = resolve_assets_dir(&app, current_file_path.as_deref())?;
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create .assets directory {:?}: {e}", assets_dir))?;

    let timestamp = Local::now().format("%Y%m%d-%H%M%S-%3f").to_string();
    let mut rng = rand::thread_rng();

    for _attempt in 0..64 {
        let hex_suffix: u16 = rng.gen();
        let filename = format!("snip-{timestamp}-{hex_suffix:04x}.png");
        let target_path = assets_dir.join(&filename);

        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target_path)
        {
            Ok(mut file) => {
                file.write_all(&bytes)
                    .map_err(|e| format!("Failed to write clipboard image bytes: {e}"))?;
                return Ok(SaveImageResult {
                    markdown_rel_path: format!(".assets/{filename}"),
                    abs_disk_path: displayable(&app, &target_path),
                });
            }
            Err(err) if err.kind() == ErrorKind::AlreadyExists => continue,
            Err(err) => {
                return Err(format!(
                    "Failed to create snip file {:?}: {err}",
                    target_path
                ))
            }
        }
    }

    Err("Unable to allocate collision-free snip filename after 64 attempts".to_string())
}

#[tauri::command(async)]
fn resolve_asset_abs_path(
    app: AppHandle,
    rel_path: String,
    current_file_path: Option<String>,
) -> Result<String, String> {
    let base_dir = match current_file_path.as_deref() {
        Some(p) if !p.trim().is_empty() => {
            let note = check_path(&app, p)?;
            note.parent()
                .ok_or_else(|| format!("Invalid parent directory for {p}"))?
                .to_path_buf()
        }
        _ => resolve_scratchpad_dir(&app)?,
    };
    let resolved = resolve_image(&base_dir, &rel_path).map_err(|e| e.to_string())?;
    Ok(displayable(&app, &resolved))
}

#[tauri::command(async)]
fn gc_scratch_assets(
    app: AppHandle,
    live_unsaved_contents: Vec<String>,
) -> Result<usize, String> {
    let scratch_assets_dir = resolve_scratchpad_dir(&app)?.join(".assets");
    if !scratch_assets_dir.exists() {
        return Ok(0);
    }

    let mut live_refs = HashSet::new();
    for content in &live_unsaved_contents {
        for snip_name in extract_referenced_snips(content) {
            live_refs.insert(snip_name);
        }
    }

    let mut deleted_count = 0usize;
    let entries = fs::read_dir(&scratch_assets_dir)
        .map_err(|e| format!("Failed to read scratchpad .assets directory: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with("snip-") && name.ends_with(".png") && !live_refs.contains(name) {
                if fs::remove_file(&path).is_ok() {
                    deleted_count += 1;
                }
            }
        }
    }

    Ok(deleted_count)
}

#[tauri::command(async)]
fn promote_scratch_assets(
    app: AppHandle,
    content: String,
    target_md_path: String,
    remaining_unsaved_contents: Vec<String>,
) -> Result<(), String> {
    let target_md_path = check_path(&app, &target_md_path)?
        .to_string_lossy()
        .into_owned();
    let referenced = extract_referenced_snips(&content);
    if !referenced.is_empty() {
        let scratch_assets_dir = resolve_scratchpad_dir(&app)?.join(".assets");
        let target_parent = Path::new(&target_md_path)
            .parent()
            .ok_or_else(|| format!("Invalid target markdown path: {target_md_path}"))?;
        let target_assets_dir = target_parent.join(".assets");
        fs::create_dir_all(&target_assets_dir)
            .map_err(|e| format!("Failed to create target .assets directory: {e}"))?;

        for filename in referenced {
            let src_path = scratch_assets_dir.join(&filename);
            if src_path.exists() {
                let dst_path = target_assets_dir.join(&filename);
                // Move with cross-volume (EXDEV / ERROR_NOT_SAME_DEVICE) copy + remove_file fallback
                if fs::rename(&src_path, &dst_path).is_err() {
                    fs::copy(&src_path, &dst_path).map_err(|e| {
                        format!(
                            "Failed to copy scratch asset {:?} to {:?}: {e}",
                            src_path, dst_path
                        )
                    })?;
                    let _ = fs::remove_file(&src_path);
                }
            }
        }
    }

    let _ = gc_scratch_assets(app, remaining_unsaved_contents)?;
    Ok(())
}

fn note_name(path: &Path) -> String {
    path.file_name().unwrap_or(path.as_os_str()).to_string_lossy().into_owned()
}

#[tauri::command(async)]
fn read_markdown_file(app: AppHandle, path: String) -> Result<String, String> {
    let checked = check_path(&app, &path)?;
    let name = note_name(&checked);
    let bytes = fs::read(&checked).map_err(|e| format!("Failed to read {name}: {e}"))?;
    text::decode(&bytes).map(|(t, _)| t).map_err(|_| format!("{name} is not UTF-8 text"))
}

/// Enough of a note to read its format: sniff needs the BOM and the first line break.
const HEAD_BYTES: u64 = 64 * 1024;

fn read_head(p: &Path) -> std::io::Result<Vec<u8>> {
    let mut head = Vec::new();
    fs::File::open(p)?.take(HEAD_BYTES).read_to_end(&mut head)?;
    Ok(head)
}

#[tauri::command(async)]
fn write_markdown_file(app: AppHandle, path: String, content: String) -> Result<(), String> {
    let checked = check_path(&app, &path)?;
    let name = note_name(&checked);
    let fmt = match read_head(&checked) {
        Ok(head) => text::sniff(&head),
        Err(e) if e.kind() == ErrorKind::NotFound => text::TextFormat::NEW_FILE,
        Err(e) => return Err(format!("Failed to read {name} before saving: {e}")),
    };
    atomic::atomic_write(&checked, &text::encode(&content, fmt))
        .map_err(|e| format!("Failed to write {name}: {e}"))
}

#[tauri::command(async)]
fn load_session(app: AppHandle) -> Result<Option<String>, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app_data_dir: {e}"))?;
    let session_path = app_data.join("session.json");
    if !session_path.exists() {
        let _ = gc_scratch_assets(app, Vec::new());
        return Ok(None);
    }

    let raw = fs::read_to_string(&session_path)
        .map_err(|e| format!("Failed to read session.json: {e}"))?;

    if let Ok(mut parsed) = serde_json::from_str::<Value>(&raw) {
        for p in session_tabs(&mut parsed).into_iter().filter_map(|t| file_path(t)) {
            allow_note(&app, Path::new(p));
        }
        let unsaved_contents: Vec<String> = parsed
            .get("tabs")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter(|t| file_path(t).is_none())
            .map(|t| t.get("content").and_then(Value::as_str).unwrap_or("").to_string())
            .collect();
        let _ = gc_scratch_assets(app, unsaved_contents);
    }

    Ok(Some(raw))
}

#[tauri::command(async)]
fn save_session(app: AppHandle, json: String) -> Result<(), String> {
    let mut parsed: Value =
        serde_json::from_str(&json).map_err(|e| format!("Invalid session JSON: {e}"))?;
    // A path outside the allowed set is dropped (the tab restores as untitled; a clean tab's
    // text is not in the session, so it comes back empty),
    // so a compromised webview cannot plant paths for the next start. Normal use never gets
    // here, and the save itself must not fail over it (guardrail 5), so it is only logged.
    let mut dropped = 0usize;
    for tab in session_tabs(&mut parsed) {
        if file_path(tab).is_some_and(|p| check_path(&app, p).is_err()) {
            tab["filePath"] = Value::Null;
            dropped += 1;
        }
    }
    let json = if dropped == 0 { json } else { parsed.to_string() };
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app_data_dir: {e}"))?;
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

/// Opens a web or mailto link from a note in the user's default app, never in the webview.
#[tauri::command]
fn open_link(app: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let parsed = Url::parse(&url).map_err(|e| format!("Invalid link {url}: {e}"))?;
    let web = matches!(parsed.scheme(), "http" | "https")
        && !APP_HOSTS.contains(&host(&parsed).as_str());
    if !web && parsed.scheme() != "mailto" {
        return Err(format!("Not a web or mail link: {url}"));
    }
    app.opener()
        .open_url(parsed.as_str(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// Hosts the webview serves itself on Windows (the app, its files, IPC). Never a web link.
const APP_HOSTS: &[&str] = &["asset.localhost", "tauri.localhost", "ipc.localhost"];

/// The host as the webview resolves it: lower case, without trailing dots.
fn host(url: &Url) -> String {
    url.host_str().unwrap_or("").trim_end_matches('.').to_ascii_lowercase()
}

/// The webview only ever shows the app itself. A link in a note must not replace it with a
/// remote page or a file from the asset scope.
fn app_url(url: &Url) -> bool {
    match url.scheme() {
        "tauri" | "about" => true,
        "http" | "https" => {
            let h = host(url);
            h == "tauri.localhost" || (cfg!(debug_assertions) && h == "localhost")
        }
        _ => false,
    }
}

pub fn run() {
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
                .on_navigation(|_, url| app_url(url))
                .build(),
        )
        .manage(Allowed::new(AllowedSet::new()))
        .setup(|app| {
            let handle = app.handle();
            if let Ok(dir) = handle.path().app_data_dir() {
                allowed(handle).allow_dir(&dir);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event {
                let app = window.app_handle();
                for p in paths.iter().filter(|p| is_md(p)) {
                    allow_note(app, p);
                }
                let all: Vec<String> = paths
                    .iter()
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                let _ = app.emit("files-dropped", all);
            }
        })
        .invoke_handler(tauri::generate_handler![
            save_clipboard_image,
            resolve_asset_abs_path,
            promote_scratch_assets,
            gc_scratch_assets,
            read_markdown_file,
            write_markdown_file,
            load_session,
            save_session,
            get_cli_startup_files,
            pick_open,
            pick_save,
            open_link
        ])
        .run(tauri::generate_context!())
        .expect("error while running SnipMD tauri application");
}
