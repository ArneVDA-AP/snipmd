// Start-time probe for SnipMD: logs each step of a Tauri + WebView2 start to PROBE_LOG.
// Each line: name, Unix time in ms, ms since main().
#![windows_subsystem = "windows"]
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

static START: OnceLock<Instant> = OnceLock::new();

fn log(name: &str) {
    let Ok(path) = std::env::var("PROBE_LOG") else { return };
    let unix = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs_f64() * 1000.0;
    let since = START.get().map_or(-1.0, |s| s.elapsed().as_secs_f64() * 1000.0);
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = f.write_all(format!("{name}\t{unix:.1}\t{since:.1}\n").as_bytes());
    }
}

fn resident() -> bool {
    std::env::var_os("PROBE_RESIDENT").is_some()
}

// A hidden broker that only keeps the WebView2 browser process alive for other hosts.
fn hold() -> bool {
    std::env::var_os("PROBE_HOLD").is_some()
}

#[tauri::command]
fn mark(app: tauri::AppHandle, name: String) {
    log(&name);
    if name == "exit" && !resident() && !hold() {
        app.exit(0);
    }
}

// SnipMD's bundle calls perf_mark('script') and perf_mark('session').
#[tauri::command]
fn perf_mark(name: String, ms: Option<f64>) -> bool {
    let _ = ms;
    log(&format!("snip-{name}"));
    true
}

fn main() {
    START.get_or_init(Instant::now);
    log("main");
    let mut b = tauri::Builder::default();
    if resident() {
        b = b.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            log("second-instance");
            if let Some(w) = app.get_webview_window("main") {
                if w.is_visible().unwrap_or(false) {
                    let _ = w.hide();
                    log("hidden");
                } else {
                    let _ = w.show();
                    let _ = w.set_focus();
                    let _ = w.eval("requestAnimationFrame(()=>setTimeout(()=>window.__TAURI_INTERNALS__.invoke('mark',{name:'shown'}),0))");
                }
            }
        }));
    }
    b.invoke_handler(tauri::generate_handler![mark, perf_mark])
        .setup(|app| {
            log("setup");
            let page = std::env::var("PROBE_PAGE").unwrap_or_else(|_| "index.html".into());
            let url = if page == "about:blank" {
                WebviewUrl::External("about:blank".parse().unwrap())
            } else {
                WebviewUrl::App(page.into())
            };
            let mut wb = WebviewWindowBuilder::new(app, "main", url)
                .title("SnipMD probe")
                .inner_size(1200.0, 820.0)
                .center()
                .decorations(std::env::var_os("PROBE_FRAMELESS").is_none())
                .transparent(std::env::var_os("PROBE_TRANSPARENT").is_some())
                .visible(!resident() && !hold());
            if let Ok(a) = std::env::var("PROBE_ARGS") {
                wb = wb.additional_browser_args(&a);
            }
            if let Ok(d) = std::env::var("PROBE_UDF") {
                wb = wb.data_directory(PathBuf::from(d));
            }
            log("build-start");
            wb.build()?;
            log("build-end");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("run");
}
