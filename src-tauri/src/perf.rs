//! Measuring the SPEC §9 budgets on Windows. With `SNIPMD_TRACE` set, the page reports its marks
//! (ready to type, paste visible) and they are appended to `perf.log` in the app data folder; without it
//! a mark costs one IPC call and nothing is written. `tools/measure/measure.ps1` reads the log.
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::OnceLock;
use std::time::Instant;
use tauri::AppHandle;

static START: OnceLock<Instant> = OnceLock::new();

/// Called first thing in `run()`; "ready" marks are measured from here.
pub fn start() {
    START.get_or_init(Instant::now);
}

/// A mark from the page: `ms` as measured there, or, without it, the time since the process started.
#[tauri::command(async)]
pub fn perf_mark(app: AppHandle, name: String, ms: Option<f64>) -> Result<(), String> {
    if std::env::var_os("SNIPMD_TRACE").is_none() {
        return Ok(());
    }
    if name.is_empty() || name.len() > 32 || !name.bytes().all(|b| b.is_ascii_lowercase() || b == b'-') {
        return Err(format!("Bad mark name: {name}"));
    }
    let ms = match ms {
        Some(ms) if ms.is_finite() => ms,
        Some(_) => return Err("Bad mark time".into()),
        None => START.get().map_or(-1.0, |s| s.elapsed().as_secs_f64() * 1000.0),
    };
    let dir = crate::app_data(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut log = OpenOptions::new().create(true).append(true).open(dir.join("perf.log")).map_err(|e| e.to_string())?;
    writeln!(log, "{name}\t{ms:.1}").map_err(|e| e.to_string())
}
