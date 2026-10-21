//! Windows 11 Mica behind the top bar (SPEC §4: follows Windows). Applied once at startup when the
//! OS has it; the frontend asks `window_backdrop` and only then lets the bar show through.
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Runtime, WebviewWindow};

static MICA: AtomicBool = AtomicBool::new(false);

/// Mica exists from Windows 11 (build 22000).
#[cfg(windows)]
fn has_mica() -> bool {
    #[repr(C)]
    struct OsVersionInfoW {
        size: u32,
        major: u32,
        minor: u32,
        build: u32,
        platform: u32,
        csd: [u16; 128],
    }
    #[link(name = "ntdll")]
    extern "system" {
        fn RtlGetVersion(info: *mut OsVersionInfoW) -> i32;
    }
    let mut info = OsVersionInfoW { size: std::mem::size_of::<OsVersionInfoW>() as u32, major: 0, minor: 0, build: 0, platform: 0, csd: [0; 128] };
    // SAFETY: RtlGetVersion only writes into the struct whose size it is given.
    let ok = unsafe { RtlGetVersion(&mut info) } == 0;
    ok && info.major >= 10 && info.build >= 22000
}

#[cfg(not(windows))]
fn has_mica() -> bool {
    false
}

pub fn apply<R: Runtime>(window: &WebviewWindow<R>) {
    if !has_mica() {
        return;
    }
    let effects = tauri::window::EffectsBuilder::new().effect(tauri::window::Effect::Mica).build();
    if window.set_effects(effects).is_ok() {
        MICA.store(true, Ordering::Relaxed);
    }
}

/// True when the window has Mica; the page then keeps the top bar transparent.
#[tauri::command]
pub fn window_backdrop() -> bool {
    MICA.load(Ordering::Relaxed)
}
