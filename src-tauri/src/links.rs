//! Links in notes: web and mail links open outside the app, and the webview never navigates away.
use tauri::{AppHandle, Url};

/// Opens a web or mailto link from a note in the user's default app, never in the webview.
#[tauri::command]
pub fn open_link(app: AppHandle, url: String) -> Result<(), String> {
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
pub fn app_url(url: &Url) -> bool {
    match url.scheme() {
        "tauri" | "about" => true,
        "http" | "https" => {
            let h = host(url);
            h == "tauri.localhost" || (cfg!(debug_assertions) && h == "localhost")
        }
        _ => false,
    }
}
