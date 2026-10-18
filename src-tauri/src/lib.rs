use chrono::Local;
use rand::Rng;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveImageResult {
    pub markdown_rel_path: String,
    pub abs_disk_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionTabStub {
    pub file_path: Option<String>,
    pub content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionPayloadStub {
    pub tabs: Vec<SessionTabStub>,
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
            let md_path = Path::new(path_str);
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

#[tauri::command]
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
                let abs_disk_path = fs::canonicalize(&target_path)
                    .unwrap_or(target_path)
                    .to_string_lossy()
                    .into_owned();
                return Ok(SaveImageResult {
                    markdown_rel_path: format!(".assets/{filename}"),
                    abs_disk_path,
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

#[tauri::command]
fn resolve_asset_abs_path(
    app: AppHandle,
    rel_path: String,
    current_file_path: Option<String>,
) -> Result<String, String> {
    let base_dir = match current_file_path.as_deref() {
        Some(p) if !p.trim().is_empty() => Path::new(p)
            .parent()
            .ok_or_else(|| format!("Invalid parent directory for {p}"))?
            .to_path_buf(),
        _ => resolve_scratchpad_dir(&app)?,
    };

    let normalized_rel = rel_path.trim_start_matches("./").trim_start_matches(".\\");
    let joined = base_dir.join(normalized_rel);
    let resolved = fs::canonicalize(&joined).unwrap_or(joined);
    Ok(resolved.to_string_lossy().into_owned())
}

#[tauri::command]
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

#[tauri::command]
fn promote_scratch_assets(
    app: AppHandle,
    content: String,
    target_md_path: String,
    remaining_unsaved_contents: Vec<String>,
) -> Result<(), String> {
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

#[tauri::command]
fn read_markdown_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read markdown file {path}: {e}"))
}

#[tauri::command]
fn write_markdown_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write markdown file {path}: {e}"))
}

#[tauri::command]
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

    if let Ok(parsed) = serde_json::from_str::<SessionPayloadStub>(&raw) {
        let unsaved_contents: Vec<String> = parsed
            .tabs
            .into_iter()
            .filter(|t| t.file_path.is_none())
            .map(|t| t.content)
            .collect();
        let _ = gc_scratch_assets(app, unsaved_contents);
    }

    Ok(Some(raw))
}

#[tauri::command]
fn save_session(app: AppHandle, json: String) -> Result<(), String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app_data_dir: {e}"))?;
    fs::create_dir_all(&app_data)
        .map_err(|e| format!("Failed to create app_data_dir: {e}"))?;
    let session_path = app_data.join("session.json");
    fs::write(&session_path, json).map_err(|e| format!("Failed to write session.json: {e}"))
}

#[tauri::command]
fn get_cli_startup_files() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|arg| {
            let p = Path::new(arg);
            p.exists()
                && p.is_file()
                && p.extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown"))
                    .unwrap_or(false)
        })
        .collect()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let md_files: Vec<String> = argv
                .into_iter()
                .skip(1)
                .filter(|arg| {
                    let p = Path::new(arg);
                    p.exists() && p.is_file()
                })
                .collect();
            if !md_files.is_empty() {
                let _ = app.emit("open-files", md_files);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            save_clipboard_image,
            resolve_asset_abs_path,
            promote_scratch_assets,
            gc_scratch_assets,
            read_markdown_file,
            write_markdown_file,
            load_session,
            save_session,
            get_cli_startup_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running SnipMD tauri application");
}
