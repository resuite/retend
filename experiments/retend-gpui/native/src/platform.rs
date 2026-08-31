use std::collections::HashMap;

use gpui::{
    div, prelude::*, px, rgb, size, App, Bounds, Context, Render, Window, WindowBounds,
    WindowHandle, WindowOptions,
};

use crate::tree::WindowId;

struct RetendRootView {
    window_id: WindowId,
}

impl Render for RetendRootView {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        let fatal = crate::runtime().lock().ok().and_then(|tree| {
            tree.windows
                .get(&self.window_id)
                .and_then(|window| window.fatal.clone())
        });

        let root = div()
            .size_full()
            .bg(rgb(0xffffff))
            .text_color(rgb(0x000000));
        match fatal {
            Some(fatal) => root.child(
                div()
                    .size_full()
                    .p_6()
                    .bg(rgb(0x1a1111))
                    .text_color(rgb(0xff8a8a))
                    .child("Retend GPUI fatal renderer error")
                    .child(fatal.native_failure)
                    .child(fatal.javascript_stack),
            ),
            None => root,
        }
    }
}

fn open_gpui_window(
    window_id: WindowId,
    cx: &mut App,
) -> Result<WindowHandle<RetendRootView>, String> {
    let bounds = Bounds::centered(None, size(px(800.0), px(600.0)), cx);
    cx.open_window(
        WindowOptions {
            window_bounds: Some(WindowBounds::Windowed(bounds)),
            ..Default::default()
        },
        move |window, cx| {
            window.on_window_should_close(cx, move |_window, _cx| {
                mark_window_closed(window_id);
                true
            });
            cx.new(|_| RetendRootView { window_id })
        },
    )
    .map_err(|error| error.to_string())
}

fn mark_window_closed(window_id: WindowId) {
    if let Ok(mut tree) = crate::runtime().lock() {
        tree.close_window(window_id);
    }
    remove_registered_window(window_id);
}

#[cfg(target_os = "macos")]
mod imp {
    use std::{cell::RefCell, rc::Rc};

    use gpui::{Application, ApplicationHandle, QuitMode};

    use super::*;

    thread_local! {
        static PLATFORM: RefCell<Option<Rc<gpui_macos::MacPlatform>>> = const { RefCell::new(None) };
        static APP: RefCell<Option<ApplicationHandle>> = const { RefCell::new(None) };
        static WINDOWS: RefCell<HashMap<WindowId, WindowHandle<RetendRootView>>> = RefCell::new(HashMap::new());
    }

    fn with_app<T>(f: impl FnOnce(&ApplicationHandle) -> T) -> Option<T> {
        APP.with(|app| app.borrow().as_ref().map(f))
    }

    pub fn open_window(window_id: WindowId) -> Result<(), String> {
        if let Some(result) = with_app(|app| app.update(|cx| open_gpui_window(window_id, cx))) {
            let window = result?;
            WINDOWS.with(|windows| {
                windows.borrow_mut().insert(window_id, window);
            });
            return Ok(());
        }

        let platform = Rc::new(gpui_macos::MacPlatform::new_embedded());
        let opened_window = Rc::new(RefCell::new(None));
        let startup_error = Rc::new(RefCell::new(None));
        let opened_window_for_app = opened_window.clone();
        let startup_error_for_app = startup_error.clone();
        let app =
            Application::with_platform(platform.clone()).with_quit_mode(QuitMode::LastWindowClosed);
        let app_handle = app.run_embedded(move |cx| match open_gpui_window(window_id, cx) {
            Ok(window) => {
                *opened_window_for_app.borrow_mut() = Some(window);
                cx.activate(true);
            }
            Err(error) => {
                *startup_error_for_app.borrow_mut() = Some(error);
            }
        });

        if let Some(error) = startup_error.borrow_mut().take() {
            app_handle.update(|cx| cx.quit());
            return Err(error);
        }
        let window = opened_window
            .borrow_mut()
            .take()
            .ok_or_else(|| "GPUI did not create the requested native window".to_string())?;

        PLATFORM.with(|stored| *stored.borrow_mut() = Some(platform));
        APP.with(|stored| *stored.borrow_mut() = Some(app_handle));
        WINDOWS.with(|windows| {
            windows.borrow_mut().insert(window_id, window);
        });
        Ok(())
    }

    pub fn invalidate_window(window_id: WindowId) {
        let Some(window) = WINDOWS.with(|windows| windows.borrow().get(&window_id).copied()) else {
            return;
        };
        with_app(|app| {
            app.update(|cx| {
                let _ = window.update(cx, |_view, _window, cx| cx.notify());
            });
        });
    }

    pub fn close_window(window_id: WindowId) {
        let Some(window) = WINDOWS.with(|windows| windows.borrow_mut().remove(&window_id)) else {
            return;
        };
        with_app(|app| {
            app.update(|cx| {
                let _ = window.update(cx, |_view, window, _cx| window.remove_window());
            });
        });
    }

    pub fn remove_registered_window(window_id: WindowId) {
        WINDOWS.with(|windows| {
            windows.borrow_mut().remove(&window_id);
        });
    }

    pub fn tick() -> Result<bool, String> {
        let running = PLATFORM.with(|platform| {
            platform
                .borrow()
                .as_ref()
                .map(|platform| platform.pump_events())
                .unwrap_or(false)
        });
        if !running {
            WINDOWS.with(|windows| windows.borrow_mut().clear());
            APP.with(|app| app.borrow_mut().take());
            PLATFORM.with(|platform| platform.borrow_mut().take());
        }
        Ok(running)
    }
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
mod imp {
    use std::sync::{mpsc::sync_channel, Mutex, OnceLock};
    use std::thread;

    use futures::{channel::mpsc, StreamExt as _};

    use super::*;

    enum UiCommand {
        Open {
            window_id: WindowId,
            response: std::sync::mpsc::SyncSender<Result<(), String>>,
        },
        Invalidate(WindowId),
        Close(WindowId),
        Forget(WindowId),
    }

    static COMMANDS: OnceLock<Mutex<Option<mpsc::UnboundedSender<UiCommand>>>> = OnceLock::new();

    fn commands() -> &'static Mutex<Option<mpsc::UnboundedSender<UiCommand>>> {
        COMMANDS.get_or_init(|| Mutex::new(None))
    }

    fn command_sender() -> Result<mpsc::UnboundedSender<UiCommand>, String> {
        let mut stored = commands()
            .lock()
            .map_err(|_| "GPUI command lock was poisoned")?;
        if let Some(sender) = stored.as_ref() {
            return Ok(sender.clone());
        }

        let (sender, mut receiver) = mpsc::unbounded();
        thread::Builder::new()
            .name("retend-gpui-ui".to_string())
            .spawn(move || {
                gpui_platform::application().run(move |cx| {
                    cx.activate(true);
                    cx.spawn(async move |cx| {
                        let mut windows = HashMap::new();
                        while let Some(command) = receiver.next().await {
                            match command {
                                UiCommand::Open {
                                    window_id,
                                    response,
                                } => {
                                    let result = cx
                                        .update(|cx| open_gpui_window(window_id, cx))
                                        .map_err(|error| error.to_string())
                                        .and_then(|result| result);
                                    let quit = result.is_err() && windows.is_empty();
                                    if let Ok(window) = result.as_ref() {
                                        windows.insert(window_id, *window);
                                    }
                                    let _ = response.send(result.map(|_| ()));
                                    if quit {
                                        if let Ok(mut commands) = commands().lock() {
                                            commands.take();
                                        }
                                        break;
                                    }
                                }
                                UiCommand::Invalidate(window_id) => {
                                    if let Some(window) = windows.get(&window_id).copied() {
                                        let _ = window.update(cx, |_view, _window, cx| cx.notify());
                                    }
                                }
                                UiCommand::Close(window_id) => {
                                    if let Some(window) = windows.remove(&window_id) {
                                        let _ = window.update(cx, |_view, window, _cx| {
                                            window.remove_window()
                                        });
                                    }
                                }
                                UiCommand::Forget(window_id) => {
                                    windows.remove(&window_id);
                                }
                            }
                        }
                        let _ = cx.update(|cx| cx.quit());
                    })
                    .detach();
                });
                if let Ok(mut commands) = commands().lock() {
                    commands.take();
                }
            })
            .map_err(|error| format!("Failed to start GPUI UI thread: {error}"))?;
        *stored = Some(sender.clone());
        Ok(sender)
    }

    pub fn open_window(window_id: WindowId) -> Result<(), String> {
        let (response, receiver) = sync_channel(1);
        command_sender()?
            .unbounded_send(UiCommand::Open {
                window_id,
                response,
            })
            .map_err(|_| "The GPUI UI thread is not running".to_string())?;
        receiver
            .recv()
            .map_err(|_| "The GPUI UI thread stopped during window creation".to_string())?
    }

    fn send(command: UiCommand) {
        if let Ok(commands) = commands().lock() {
            if let Some(sender) = commands.as_ref() {
                let _ = sender.unbounded_send(command);
            }
        }
    }

    pub fn invalidate_window(window_id: WindowId) {
        send(UiCommand::Invalidate(window_id));
    }

    pub fn close_window(window_id: WindowId) {
        send(UiCommand::Close(window_id));
    }

    pub fn remove_registered_window(window_id: WindowId) {
        send(UiCommand::Forget(window_id));
    }

    pub fn tick() -> Result<bool, String> {
        Ok(true)
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
mod imp {
    use super::*;

    pub fn open_window(_window_id: WindowId) -> Result<(), String> {
        Err("Retend GPUI does not support this operating system".to_string())
    }

    pub fn invalidate_window(_window_id: WindowId) {}
    pub fn close_window(_window_id: WindowId) {}
    pub fn remove_registered_window(_window_id: WindowId) {}
    pub fn tick() -> Result<bool, String> {
        Ok(false)
    }
}

use imp::remove_registered_window;
pub use imp::{close_window, invalidate_window, open_window, tick};
