// Same shape in iced: text_editor over a 400-line note plus one 4K image.
use iced::widget::{column, image, scrollable, text_editor};
use iced::{Element, Subscription, Task};
use std::time::Instant;
static mut T0: Option<Instant> = None;
fn rss() -> String {
    std::fs::read_to_string("/proc/self/status").unwrap().lines()
        .filter(|l| l.starts_with("VmRSS") || l.starts_with("VmHWM")).collect::<Vec<_>>().join(" ")
}
struct App { content: text_editor::Content, img: image::Handle, frames: u32 }
#[derive(Debug, Clone)]
enum Msg { Edit(text_editor::Action), Frame }
fn boot() -> App {
    App { content: text_editor::Content::with_text(&std::fs::read_to_string("note.md").unwrap()),
          img: image::Handle::from_path("shot.png"), frames: 0 }
}
fn update(a: &mut App, m: Msg) -> Task<Msg> {
    match m {
        Msg::Edit(act) => a.content.perform(act),
        Msg::Frame => {
            if a.frames == 0 { eprintln!("first_frame_ms {}", unsafe { T0.unwrap() }.elapsed().as_millis()); }
            a.frames += 1;
            if a.frames == 60 { eprintln!("rss {}", rss()); std::process::exit(0); }
        }
    }
    Task::none()
}
fn view(a: &App) -> Element<'_, Msg> {
    if std::env::var("NOIMG").is_ok() { scrollable(text_editor(&a.content).on_action(Msg::Edit)).into() } else { scrollable(column![image(a.img.clone()).height(360), text_editor(&a.content).on_action(Msg::Edit)]).into() }
}
fn sub(_: &App) -> Subscription<Msg> { iced::window::frames().map(|_| Msg::Frame) }
fn main() -> iced::Result {
    unsafe { T0 = Some(Instant::now()); }
    iced::application(boot, update, view).subscription(sub).run()
}
