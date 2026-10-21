//! Measuring the SPEC §9 budgets on Windows. With `SNIPMD_TRACE` set, the page reports its marks
//! (ready to type, paste visible) and they are appended to `perf.log` in the app data folder; without it
//! a mark costs one IPC call and nothing is written. `tools/measure/measure.ps1` reads the log.
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::OnceLock;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

static START: OnceLock<(Instant, f64)> = OnceLock::new();

/// Called first thing in `run()`; "ready" marks are measured from here.
pub fn start() {
    START.get_or_init(|| (Instant::now(), epoch_ms(SystemTime::now())));
}

fn epoch_ms(t: SystemTime) -> f64 {
    t.duration_since(UNIX_EPOCH).map_or(0.0, |d| d.as_secs_f64() * 1000.0)
}

/// A mark from the page: `ms` as measured there; or `epoch`, a wall-clock time from the page
/// (navigation start, HTML loaded), turned into time since the process started; or, without
/// either, the time since the process started. Returns whether tracing is on, so the page
/// measures nothing else when it is off.
#[tauri::command(async)]
pub fn perf_mark(app: AppHandle, name: String, ms: Option<f64>, epoch: Option<f64>) -> Result<bool, String> {
    if std::env::var_os("SNIPMD_TRACE").is_none() {
        return Ok(false);
    }
    if name.is_empty() || name.len() > 32 || !name.bytes().all(|b| b.is_ascii_lowercase() || b == b'-') {
        return Err(format!("Bad mark name: {name}"));
    }
    let ms = match (ms, epoch) {
        (Some(ms), None) if ms.is_finite() => ms,
        (None, Some(at)) if at.is_finite() => START.get().map_or(-1.0, |s| at - s.1),
        (None, None) => START.get().map_or(-1.0, |s| s.0.elapsed().as_secs_f64() * 1000.0),
        _ => return Err("Bad mark time".into()),
    };
    let dir = crate::app_data(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut log = OpenOptions::new().create(true).append(true).open(dir.join("perf.log")).map_err(|e| e.to_string())?;
    // One write per line, so a reader polling the log never sees half a mark.
    log.write_all(format!("{name}\t{ms:.1}\n").as_bytes()).map_err(|e| e.to_string())?;
    Ok(true)
}
