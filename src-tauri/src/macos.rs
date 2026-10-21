//! macOS integration (SPEC §13): the menu bar, notes handed over by Finder, and the flush on quit.
//! Other systems compile only the two commands, which have nothing to do there.
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// Notes Finder handed over that the page has not taken yet. Finder can hand them over before the
/// page listens (a double-click that starts the app), so they wait here until the page asks.
#[derive(Default)]
pub struct OpenedNotes(Mutex<Vec<String>>);

/// The notes Finder handed over since the last call.
#[tauri::command]
pub fn take_opened_notes(app: AppHandle) -> Vec<String> {
    std::mem::take(&mut *app.state::<OpenedNotes>().0.lock().unwrap_or_else(|e| e.into_inner()))
}

/// The page has flushed after `quit-requested`: the quit may go on.
#[tauri::command]
pub fn quit_ready(app: AppHandle) {
    #[cfg(target_os = "macos")]
    quit::reply(&app);
    let _ = app;
}

#[cfg(target_os = "macos")]
pub use mac::{opened, setup};

#[cfg(target_os = "macos")]
mod mac {
    use super::{quit, OpenedNotes};
    use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
    use tauri::{AppHandle, Emitter, Manager, PhysicalSize, Runtime, Url, WebviewWindow};

    /// SPEC §13 menu bar. Custom items carry the page's command name as their id.
    fn menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
        let cmd = |id: &str, text: &str, keys: &str| MenuItem::with_id(app, id, text, true, Some(keys));
        let sep = || PredefinedMenuItem::separator(app);
        Menu::with_items(
            app,
            &[
                &Submenu::with_items(
                    app,
                    "SnipMD",
                    true,
                    &[
                        &PredefinedMenuItem::about(app, None, None)?,
                        &sep()?,
                        &PredefinedMenuItem::hide(app, None)?,
                        &PredefinedMenuItem::hide_others(app, None)?,
                        &PredefinedMenuItem::show_all(app, None)?,
                        &sep()?,
                        &PredefinedMenuItem::quit(app, None)?,
                    ],
                )?,
                &Submenu::with_items(
                    app,
                    "File",
                    true,
                    &[
                        &cmd("new-tab", "New Tab", "CmdOrCtrl+T")?,
                        &cmd("open", "Open…", "CmdOrCtrl+O")?,
                        &sep()?,
                        &cmd("save", "Save", "CmdOrCtrl+S")?,
                        &cmd("save-as", "Save As…", "CmdOrCtrl+Shift+S")?,
                        &sep()?,
                        &cmd("close-tab", "Close Tab", "CmdOrCtrl+W")?,
                        &cmd("reopen-tab", "Reopen Closed Tab", "CmdOrCtrl+Shift+T")?,
                    ],
                )?,
                &Submenu::with_items(
                    app,
                    "Edit",
                    true,
                    &[
                        &PredefinedMenuItem::undo(app, None)?,
                        &PredefinedMenuItem::redo(app, None)?,
                        &sep()?,
                        &PredefinedMenuItem::cut(app, None)?,
                        &PredefinedMenuItem::copy(app, None)?,
                        &PredefinedMenuItem::paste(app, None)?,
                        &cmd(PASTE_PLAIN, "Paste as Plain Text", "CmdOrCtrl+Shift+V")?,
                        &PredefinedMenuItem::select_all(app, None)?,
                        &sep()?,
                        &cmd("find", "Find", "CmdOrCtrl+F")?,
                        &cmd("replace", "Replace", "CmdOrCtrl+Alt+F")?,
                    ],
                )?,
                &Submenu::with_items(
                    app,
                    "View",
                    true,
                    &[&cmd("read-mode", "Read Mode", "CmdOrCtrl+E")?, &sep()?, &PredefinedMenuItem::fullscreen(app, None)?],
                )?,
                &Submenu::with_items(
                    app,
                    "Window",
                    true,
                    &[&PredefinedMenuItem::minimize(app, None)?, &PredefinedMenuItem::maximize(app, None)?],
                )?,
            ],
        )
    }

    const PASTE_PLAIN: &str = "paste-plain";

    /// A custom menu item runs the page command of the same name. Paste as Plain Text is the
    /// exception: WKWebView only pastes through the Edit menu's own Paste, so Rust reads the
    /// clipboard's text for this one click or key and hands it to the page (SPEC §6.3, §13).
    fn on_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
        let id = event.id().as_ref();
        if id == PASTE_PLAIN {
            if let Some(text) = clipboard_text() {
                let _ = app.emit("paste-text", text);
            }
            return;
        }
        let _ = app.emit("menu-command", id);
    }

    fn clipboard_text() -> Option<String> {
        use objc2_app_kit::{NSPasteboard, NSPasteboardTypeString};
        // SAFETY: an AppKit constant that is set before the app runs.
        let text_type = unsafe { NSPasteboardTypeString };
        NSPasteboard::generalPasteboard().stringForType(text_type).map(|s| s.to_string())
    }

    /// `RunEvent::Opened`: Finder's notes are allowed, queued for the page, and the page is told.
    pub fn opened(app: &AppHandle, urls: &[Url]) {
        let notes = crate::allow_notes(app, urls.iter().filter_map(|u| u.to_file_path().ok()));
        if notes.is_empty() {
            return;
        }
        app.state::<OpenedNotes>().0.lock().unwrap_or_else(|e| e.into_inner()).extend(notes);
        let _ = app.emit("notes-opened", ());
    }

    /// Startup: the menu bar, the quit hook, and a first window that fits the screen (the config
    /// size is for a laptop).
    pub fn setup(app: &AppHandle) -> tauri::Result<()> {
        app.set_menu(menu(app)?)?;
        app.on_menu_event(on_menu_event);
        quit::install(app);
        if let Some(window) = app.get_webview_window("main") {
            fit_to_screen(&window);
        }
        Ok(())
    }

    fn fit_to_screen(window: &WebviewWindow) {
        let (Ok(Some(monitor)), Ok(size)) = (window.current_monitor(), window.outer_size()) else { return };
        let area = monitor.work_area().size;
        if size.width <= area.width && size.height <= area.height {
            return;
        }
        let fitted = PhysicalSize::new(size.width.min(area.width), size.height.min(area.height));
        let _ = window.set_size(fitted);
        let _ = window.center();
    }
}

/// AppKit ends the app on Cmd+Q, the Dock's Quit and logout without asking Tauri, so the page
/// never flushed. SnipMD answers `applicationShouldTerminate:` with "later", lets the page flush
/// as it does on close, and then lets the quit go on. A page that does not answer in time does
/// not keep the app open.
#[cfg(target_os = "macos")]
mod quit {
    use objc2::ffi;
    use objc2::runtime::{AnyClass, AnyObject, Bool, Imp, Sel};
    use objc2::{class, msg_send, sel};
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::OnceLock;
    use std::time::Duration;
    use tauri::{AppHandle, Emitter};

    /// Longer than the page's own close wait (CLOSE_WAIT_MS, 3 s), so a slow write still lands.
    const WAIT: Duration = Duration::from_secs(5);
    const TERMINATE_NOW: usize = 1;
    const TERMINATE_LATER: usize = 2;

    static APP: OnceLock<AppHandle> = OnceLock::new();
    /// A quit waits for the page.
    static WAITING: AtomicBool = AtomicBool::new(false);

    extern "C-unwind" fn should_terminate(_this: &AnyObject, _cmd: Sel, _sender: *mut AnyObject) -> usize {
        let Some(app) = APP.get() else { return TERMINATE_NOW };
        if WAITING.swap(true, Ordering::SeqCst) {
            return TERMINATE_LATER;
        }
        if app.emit("quit-requested", ()).is_err() {
            WAITING.store(false, Ordering::SeqCst);
            return TERMINATE_NOW;
        }
        let app = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(WAIT);
            reply(&app);
        });
        TERMINATE_LATER
    }

    /// Lets a waiting quit go on; the second call (page and timer both) does nothing.
    pub fn reply(app: &AppHandle) {
        if !WAITING.swap(false, Ordering::SeqCst) {
            return;
        }
        let _ = app.run_on_main_thread(|| unsafe {
            let ns_app: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
            let _: () = msg_send![ns_app, replyToApplicationShouldTerminate: Bool::YES];
        });
    }

    /// Adds `applicationShouldTerminate:` to the app delegate tao installed (tao has none).
    pub fn install(app: &AppHandle) {
        if APP.set(app.clone()).is_err() {
            return;
        }
        // SAFETY: runs on the main thread during setup, after tao set its delegate. The method is
        // added only when the class has none, with the type encoding of
        // `- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication *)sender`.
        unsafe {
            let ns_app: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
            let delegate: *mut AnyObject = msg_send![ns_app, delegate];
            if delegate.is_null() {
                return;
            }
            let cls = ffi::object_getClass(delegate) as *mut AnyClass;
            let imp: Imp = std::mem::transmute(
                should_terminate as extern "C-unwind" fn(&AnyObject, Sel, *mut AnyObject) -> usize,
            );
            ffi::class_addMethod(cls, sel!(applicationShouldTerminate:), imp, c"Q@:@".as_ptr());
        }
    }
}
