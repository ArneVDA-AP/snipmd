// Minimal "SnipMD-shaped" window: a multiline editor over a 400-line note plus one 4K image.
// Prints ms from process start to first frame, then RSS after 60 frames, and exits.
use std::time::Instant;
use eframe::egui;
static mut T0: Option<Instant> = None;
fn rss() -> String {
    std::fs::read_to_string("/proc/self/status").unwrap().lines()
        .filter(|l| l.starts_with("VmRSS") || l.starts_with("VmHWM")).collect::<Vec<_>>().join(" ")
}
struct App { text: String, tex: Option<egui::TextureHandle>, frames: u32 }
impl eframe::App for App {
    fn ui(&mut self, ui0: &mut egui::Ui, _f: &mut eframe::Frame) {
        let ctx = ui0.ctx().clone(); let ctx = &ctx;
        if self.frames == 0 { eprintln!("first_frame_ms {}", unsafe { T0.unwrap() }.elapsed().as_millis()); }
        if self.tex.is_none() && std::env::var("NOIMG").is_err() {
            let t = Instant::now();
            let img = image::load_from_memory(&std::fs::read("shot.png").unwrap()).unwrap().to_rgba8();
            let size = [img.width() as usize, img.height() as usize];
            let ci = egui::ColorImage::from_rgba_unmultiplied(size, img.as_raw());
            self.tex = Some(ctx.load_texture("shot", ci, Default::default()));
            eprintln!("image_ms {}", t.elapsed().as_millis());
        }
        { let ui = ui0;
            egui::ScrollArea::vertical().show(ui, |ui| {
                if let Some(t) = &self.tex { ui.add(egui::Image::new(t).max_height(360.0)); }
                ui.add(egui::TextEdit::multiline(&mut self.text).desired_width(f32::INFINITY).code_editor());
            });
        }
        self.frames += 1;
        if self.frames == 60 { eprintln!("rss {}", rss()); std::process::exit(0); }
        ctx.request_repaint();
    }
}
fn main() -> eframe::Result {
    unsafe { T0 = Some(Instant::now()); }
    let text = std::fs::read_to_string("note.md").unwrap();
    eframe::run_native("proto", eframe::NativeOptions::default(),
        Box::new(|_| Ok(Box::new(App { text, tex: None, frames: 0 }))))
}
