use std::{collections::HashMap, sync::Arc};

use gpui::{
    div, prelude::*, px, rgb, size, App, Bounds, Context, Render, Subscription, Window,
    WindowBounds, WindowHandle, WindowOptions,
};

#[cfg(test)]
use crate::runtime_state::MeasureResponder;

use crate::{
    protocol_generated::NativeEventId,
    runtime_state::{
        LayoutOperation, QueryResponder, RuntimeStateRegistry, TextControlConfig, TextControlEditor,
    },
    tree::{NativeTree, NodeData, NodeId, TextControlSnapshot, WindowId},
    NativeSelection, NativeWindowOptions,
};

struct RetendRootView {
    window_id: WindowId,
    runtime_state: RuntimeStateRegistry,
    last_window_size: Option<(f32, f32)>,
    _window_observers: Option<(Subscription, Subscription)>,
}

#[cfg(test)]
thread_local! {
    static TEST_FOCUS_EVENTS: std::cell::RefCell<Vec<(WindowId, NodeId, NativeEventId)>> =
        const { std::cell::RefCell::new(Vec::new()) };
}

fn emit_focus_event(window_id: WindowId, id: NodeId, event: NativeEventId) {
    #[cfg(test)]
    TEST_FOCUS_EVENTS.with(|events| events.borrow_mut().push((window_id, id, event)));
    if crate::runtime()
        .lock()
        .is_ok_and(|tree| tree.has_subscription_in_path(window_id, id, event))
    {
        crate::events::emit(window_id, crate::events::NativeEventPayload::new(event, id));
    }
}

fn closed_window_query_failure() -> crate::BridgeFailure {
    crate::BridgeFailure::closed_window()
}

fn ensure_focus_state<T: 'static>(
    runtime_state: &RuntimeStateRegistry,
    window_id: WindowId,
    window: &mut Window,
    cx: &mut Context<T>,
    id: NodeId,
    tab_index: isize,
    handle: Option<gpui::FocusHandle>,
) -> gpui::FocusHandle {
    let (handle, needs_subscriptions) = runtime_state.ensure_focus(id, tab_index, handle, cx);
    if needs_subscriptions {
        let focus = cx.on_focus(&handle, window, move |_, _, _| {
            emit_focus_event(window_id, id, NativeEventId::Focus);
        });
        let blur = cx.on_blur(&handle, window, move |_, _, _| {
            emit_focus_event(window_id, id, NativeEventId::Blur);
        });
        runtime_state.set_focus_subscriptions(id, [focus, blur]);
    }
    handle
}

fn ensure_text_control_entity<T: 'static>(
    runtime_state: &RuntimeStateRegistry,
    window_id: WindowId,
    id: NodeId,
    snapshot: &TextControlSnapshot,
    window: &mut Window,
    cx: &mut Context<T>,
) -> TextControlEditor {
    runtime_state.ensure_text_control(
        window_id,
        id,
        TextControlConfig {
            kind: snapshot.kind,
            value: &snapshot.value,
            value_revision: snapshot.value_revision,
            min_rows: snapshot.min_rows,
            max_rows: snapshot.max_rows,
        },
        window,
        cx,
    )
}

fn focus_runtime_node<T: 'static>(
    runtime_state: &RuntimeStateRegistry,
    window_id: WindowId,
    id: NodeId,
    tab_index: isize,
    text_control: Option<&TextControlSnapshot>,
    window: &mut Window,
    cx: &mut Context<T>,
) {
    let handle = text_control.map(|snapshot| {
        ensure_text_control_entity(runtime_state, window_id, id, snapshot, window, cx)
            .focus_handle(cx)
    });
    ensure_focus_state(runtime_state, window_id, window, cx, id, tab_index, handle)
        .focus(window, cx);
}

pub(crate) fn prepare_frame<T: 'static>(
    tree: &NativeTree,
    runtime_state: &RuntimeStateRegistry,
    window_id: WindowId,
    window: &mut Window,
    cx: &mut Context<T>,
) -> u64 {
    let generation = runtime_state.begin_frame(tree, window_id);
    if !runtime_state.needs_preparation(tree, window_id) {
        return generation;
    }
    for (&id, node) in tree
        .nodes
        .iter()
        .filter(|(_, node)| node.window_id == window_id)
    {
        let text_control = if let NodeData::TextControl {
            kind,
            value,
            value_revision,
            min_rows,
            max_rows,
        } = &node.data
        {
            Some(runtime_state.ensure_text_control(
                window_id,
                id,
                TextControlConfig {
                    kind: *kind,
                    value,
                    value_revision: *value_revision,
                    min_rows: *min_rows,
                    max_rows: *max_rows,
                },
                window,
                cx,
            ))
        } else {
            None
        };
        match node.effective_tab_index() {
            Some(tab_index) => {
                let handle = text_control
                    .as_ref()
                    .map(|control| control.focus_handle(cx));
                ensure_focus_state(runtime_state, window_id, window, cx, id, tab_index, handle);
            }
            None => runtime_state.disable_focus(id),
        }
        runtime_state.sync_scroll(
            id,
            node.style
                .as_deref()
                .map(|style| style.overflow)
                .unwrap_or_default(),
        );
    }
    generation
}

pub(crate) enum TextControlOperation {
    SetSelection(u32, u32),
    Select,
    GetSelection(QueryResponder<NativeSelection>),
}

pub(crate) enum WindowOperation {
    Invalidate,
    Focus(NodeId, isize, Option<TextControlSnapshot>),
    Blur(NodeId),
    TextControl(NodeId, TextControlSnapshot, TextControlOperation),
    Layout(LayoutOperation),
    DestroyRuntimeNodes(Vec<NodeId>),
    SetTitle(String),
    Close,
}

impl WindowOperation {
    fn reject_closed(self) {
        match self {
            Self::Layout(operation) => operation.reject(closed_window_query_failure()),
            Self::TextControl(_, _, TextControlOperation::GetSelection(responder)) => {
                responder.respond(Err(closed_window_query_failure()))
            }
            _ => {}
        }
    }
}

fn execute_window_operation(
    window_id: WindowId,
    window: Option<WindowHandle<RetendRootView>>,
    operation: WindowOperation,
    cx: &mut App,
) {
    let Some(window) = window else {
        operation.reject_closed();
        return;
    };
    let result = window.update(cx, |view, window, cx| {
        let runtime = &view.runtime_state;
        let redraw = matches!(
            &operation,
            WindowOperation::Invalidate
                | WindowOperation::Layout(_)
                | WindowOperation::DestroyRuntimeNodes(_)
        );
        match &operation {
            WindowOperation::Invalidate => {}
            WindowOperation::Focus(id, tab_index, text_control) => {
                focus_runtime_node(
                    runtime,
                    window_id,
                    *id,
                    *tab_index,
                    text_control.as_ref(),
                    window,
                    cx,
                );
            }
            WindowOperation::Blur(id) => {
                if !runtime
                    .focus_handle(*id)
                    .is_some_and(|handle| handle.is_focused(window))
                {
                    return;
                }
                window.blur(cx);
            }
            WindowOperation::TextControl(id, snapshot, operation) => {
                let control =
                    ensure_text_control_entity(runtime, window_id, *id, snapshot, window, cx);
                match operation {
                    TextControlOperation::SetSelection(start, end) => {
                        control.set_selection(*start, *end, cx);
                    }
                    TextControlOperation::Select => control.select_all(window, cx),
                    TextControlOperation::GetSelection(responder) => {
                        responder.respond(control.selection(window, cx));
                    }
                }
            }
            WindowOperation::Layout(operation) => runtime.enqueue_layout(operation.clone()),
            WindowOperation::DestroyRuntimeNodes(ids) => runtime.destroy_nodes(ids),
            WindowOperation::SetTitle(title) => return window.set_window_title(title),
            WindowOperation::Close => return window.remove_window(),
        }
        if redraw {
            cx.notify();
        }
    });
    if result.is_err() {
        operation.reject_closed();
    }
}

impl Drop for RetendRootView {
    fn drop(&mut self) {
        self.runtime_state.reject_queries(
            "CLOSED_WINDOW",
            "Renderer window closed before the native query completed.",
        );
    }
}

impl Render for RetendRootView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let window_id = self.window_id;
        let runtime_state = self.runtime_state.clone();
        let content = crate::runtime().lock().ok().and_then(|tree| {
            let native_window = tree.windows.get(&window_id)?;
            if let Some(fatal) = native_window.fatal.as_ref() {
                self.runtime_state.reject_queries(
                    "POISONED_RENDERER",
                    "Renderer became poisoned before the native query completed.",
                );
                let runtime_state = runtime_state.clone();
                return Some(
                    div()
                        .size_full()
                        .p_6()
                        .bg(rgb(0x1a1111))
                        .text_color(rgb(0xff8a8a))
                        .child("Retend GPUI fatal renderer error")
                        .child(fatal.native_failure.clone())
                        .child(fatal.javascript_stack.clone())
                        .child(div().id("retend-fatal-reload").child("Reload").on_click(
                            move |_, _, _| {
                                let reloaded = crate::runtime()
                                    .lock()
                                    .ok()
                                    .is_some_and(|mut tree| tree.reload_window(window_id).is_ok());
                                if reloaded {
                                    runtime_state.clear();
                                    crate::events::emit_window(
                                        window_id,
                                        crate::events::NativeWindowEventPayload::reload(),
                                    );
                                }
                            },
                        ))
                        .into_any_element(),
                );
            }

            let generation = prepare_frame(&tree, &self.runtime_state, window_id, window, cx);
            Some(crate::render::build_with_runtime(
                &tree,
                native_window.root_id,
                &self.runtime_state,
                generation,
            ))
        });

        match content {
            Some(content) => content,
            None => crate::render::root_container().into_any_element(),
        }
    }
}

fn window_dimension(value: Option<f64>) -> Result<Option<f32>, String> {
    value
        .map(|value| {
            if value > f64::from(f32::MAX) {
                Err("Native window dimensions exceed GPUI limits.".to_string())
            } else {
                Ok(value as f32)
            }
        })
        .transpose()
}

#[derive(Clone, Copy)]
struct WindowSizeConstraints {
    min_width: Option<f32>,
    min_height: Option<f32>,
    max_width: Option<f32>,
    max_height: Option<f32>,
}

impl WindowSizeConstraints {
    fn clamp(self, width: f32, height: f32) -> (f32, f32) {
        (
            width
                .max(self.min_width.unwrap_or(0.0))
                .min(self.max_width.unwrap_or(f32::MAX)),
            height
                .max(self.min_height.unwrap_or(0.0))
                .min(self.max_height.unwrap_or(f32::MAX)),
        )
    }
}

impl RetendRootView {
    fn window_size_event(
        &mut self,
        constraints: WindowSizeConstraints,
        window: &mut Window,
    ) -> Option<crate::events::NativeWindowEventPayload> {
        let current = window.viewport_size();
        let current = (f32::from(current.width), f32::from(current.height));
        let size = if window.is_fullscreen() || window.is_maximized() {
            current
        } else {
            let constrained = constraints.clamp(current.0, current.1);
            if constrained != current {
                window.resize(size(px(constrained.0), px(constrained.1)));
            }
            constrained
        };
        if self.last_window_size == Some(size) {
            return None;
        }
        self.last_window_size = Some(size);
        Some(crate::events::NativeWindowEventPayload::resize(
            f64::from(size.0),
            f64::from(size.1),
        ))
    }
}

fn install_window_observers<Emit>(
    window_id: WindowId,
    constraints: WindowSizeConstraints,
    window: &mut Window,
    cx: &mut Context<RetendRootView>,
    emit: Emit,
) -> (Subscription, Subscription)
where
    Emit: Fn(WindowId, crate::events::NativeWindowEventPayload) + Clone + 'static,
{
    let emit_resize = emit.clone();
    (
        cx.observe_window_bounds(window, move |view, window, cx| {
            if let Some(payload) = view.window_size_event(constraints, window) {
                emit_resize(window_id, payload);
                cx.notify();
            }
        }),
        cx.observe_window_activation(window, move |_, window, _| {
            emit(
                window_id,
                crate::events::NativeWindowEventPayload::activation(window.is_window_active()),
            );
        }),
    )
}

fn open_gpui_window(
    window_id: WindowId,
    options: NativeWindowOptions,
    cx: &mut App,
) -> Result<WindowHandle<RetendRootView>, String> {
    let constraints = WindowSizeConstraints {
        min_width: window_dimension(options.min_width)?,
        min_height: window_dimension(options.min_height)?,
        max_width: window_dimension(options.max_width)?,
        max_height: window_dimension(options.max_height)?,
    };
    let (width, height) = constraints.clamp(
        window_dimension(options.width)?.unwrap_or(800.0),
        window_dimension(options.height)?.unwrap_or(600.0),
    );
    let bounds = Bounds::centered(None, size(px(width), px(height)), cx);
    let window_bounds = if options.fullscreen.unwrap_or(false) {
        WindowBounds::Fullscreen(bounds)
    } else if options.maximized.unwrap_or(false) {
        WindowBounds::Maximized(bounds)
    } else {
        WindowBounds::Windowed(bounds)
    };
    let mut window_options = WindowOptions {
        window_bounds: Some(window_bounds),
        is_resizable: options.resizable.unwrap_or(true),
        window_min_size: (constraints.min_width.is_some() || constraints.min_height.is_some())
            .then(|| {
                size(
                    px(constraints.min_width.unwrap_or(0.0)),
                    px(constraints.min_height.unwrap_or(0.0)),
                )
            }),
        ..Default::default()
    };
    if let Some(title) = options.title {
        if let Some(titlebar) = window_options.titlebar.as_mut() {
            titlebar.title = Some(title.into());
        }
    }
    cx.open_window(window_options, move |window, cx| {
        window.on_window_should_close(cx, move |_window, _cx| {
            mark_window_closed(window_id);
            true
        });
        cx.new(|cx| {
            let mut view = RetendRootView {
                window_id,
                runtime_state: RuntimeStateRegistry::default(),
                last_window_size: None,
                _window_observers: None,
            };
            if let Some(payload) = view.window_size_event(constraints, window) {
                crate::events::emit_window(window_id, payload);
            }
            crate::events::emit_window(
                window_id,
                crate::events::NativeWindowEventPayload::activation(window.is_window_active()),
            );
            view._window_observers = Some(install_window_observers(
                window_id,
                constraints,
                window,
                cx,
                |window_id, payload| {
                    crate::events::emit_window(window_id, payload);
                },
            ));
            view
        })
    })
    .map_err(|error| error.to_string())
}

fn mark_window_closed(window_id: WindowId) {
    crate::events::emit_close(window_id);
    if let Ok(mut tree) = crate::runtime().lock() {
        tree.close_window(window_id);
    }
    remove_registered_window(window_id);
}

#[cfg(target_os = "macos")]
mod imp {
    use std::{cell::RefCell, collections::VecDeque, rc::Rc};

    use gpui::{Application, ApplicationHandle, QuitMode};

    use super::*;

    thread_local! {
        static PLATFORM: RefCell<Option<Rc<gpui_macos::MacPlatform>>> = const { RefCell::new(None) };
        static APP: RefCell<Option<ApplicationHandle>> = const { RefCell::new(None) };
        static WINDOWS: RefCell<HashMap<WindowId, WindowHandle<RetendRootView>>> = RefCell::new(HashMap::new());
    }

    /// Work requested from inside the native pump. Dispatching it directly would
    /// re-enter the borrowed GPUI application, so it runs after the pump returns.
    enum DeferredOperation {
        Window(WindowId, WindowOperation),
        Open(WindowId, NativeWindowOptions),
        Close(WindowId),
    }

    thread_local! {
        static DEFERRED: RefCell<VecDeque<DeferredOperation>> = const { RefCell::new(VecDeque::new()) };
    }

    fn with_app<T>(f: impl FnOnce(&ApplicationHandle) -> T) -> Option<T> {
        APP.with(|app| app.borrow().as_ref().map(f))
    }

    fn open_window_now(window_id: WindowId, options: NativeWindowOptions) -> Result<(), String> {
        if let Some(result) =
            with_app(|app| app.update(|cx| open_gpui_window(window_id, options.clone(), cx)))
        {
            let window = result?;
            WINDOWS.with(|windows| {
                windows.borrow_mut().insert(window_id, window);
            });
            return Ok(());
        }

        let platform = Rc::new(gpui_macos::MacPlatform::new_embedded());
        let open_result = Rc::new(RefCell::new(None));
        let result_for_app = open_result.clone();
        let app = Application::with_platform(platform.clone())
            .with_http_client(Arc::new(reqwest_client::ReqwestClient::new()))
            .with_quit_mode(QuitMode::LastWindowClosed);
        let app_handle = app.run_embedded(move |cx| {
            crate::render::init(cx);
            let result = open_gpui_window(window_id, options, cx);
            if result.is_ok() {
                cx.activate(true);
            }
            *result_for_app.borrow_mut() = Some(result);
        });

        let window = match open_result
            .borrow_mut()
            .take()
            .ok_or_else(|| "GPUI did not create the requested native window".to_string())?
        {
            Ok(window) => window,
            Err(error) => {
                app_handle.update(|cx| cx.quit());
                return Err(error);
            }
        };

        PLATFORM.with(|stored| *stored.borrow_mut() = Some(platform));
        APP.with(|stored| *stored.borrow_mut() = Some(app_handle));
        WINDOWS.with(|windows| {
            windows.borrow_mut().insert(window_id, window);
        });
        Ok(())
    }

    pub fn open_window(window_id: WindowId, options: NativeWindowOptions) -> Result<(), String> {
        if crate::events::in_direct_window_delivery() {
            DEFERRED.with(|queue| {
                queue
                    .borrow_mut()
                    .push_back(DeferredOperation::Open(window_id, options))
            });
            return Ok(());
        }
        open_window_now(window_id, options)
    }

    fn dispatch_now(window_id: WindowId, operation: WindowOperation) -> bool {
        let Some(window) = WINDOWS.with(|windows| windows.borrow().get(&window_id).copied()) else {
            operation.reject_closed();
            return false;
        };
        APP.with(|app| {
            let app = app.borrow();
            let Some(app) = app.as_ref() else {
                operation.reject_closed();
                return false;
            };
            app.update(|cx| execute_window_operation(window_id, Some(window), operation, cx));
            true
        })
    }

    pub(crate) fn dispatch(window_id: WindowId, operation: WindowOperation) -> bool {
        if crate::events::in_direct_window_delivery() {
            DEFERRED.with(|queue| {
                queue
                    .borrow_mut()
                    .push_back(DeferredOperation::Window(window_id, operation))
            });
            return true;
        }
        dispatch_now(window_id, operation)
    }

    fn close_now(window_id: WindowId) {
        let window = WINDOWS.with(|windows| windows.borrow_mut().remove(&window_id));
        if let Some(window) = window {
            with_app(|app| {
                app.update(|cx| {
                    execute_window_operation(window_id, Some(window), WindowOperation::Close, cx)
                });
            });
        }
    }

    pub fn close_window(window_id: WindowId) {
        if crate::events::in_direct_window_delivery() {
            DEFERRED.with(|queue| {
                queue
                    .borrow_mut()
                    .push_back(DeferredOperation::Close(window_id))
            });
            return;
        }
        close_now(window_id);
    }

    /// Runs operations queued while the native pump held the application borrow.
    fn drain_deferred() {
        loop {
            let next = DEFERRED.with(|queue| queue.borrow_mut().pop_front());
            let Some(operation) = next else {
                return;
            };
            match operation {
                DeferredOperation::Window(window_id, operation) => {
                    // Query-bearing operations reject themselves if the target window
                    // disappeared before deferred execution.
                    let _ = dispatch_now(window_id, operation);
                }
                DeferredOperation::Open(window_id, options) => {
                    let _ = open_window_now(window_id, options);
                }
                DeferredOperation::Close(window_id) => close_now(window_id),
            }
        }
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
                .map(|platform| {
                    crate::events::with_direct_window_delivery(|| platform.pump_events())
                })
                .unwrap_or(false)
        });
        drain_deferred();
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
            options: NativeWindowOptions,
            response: std::sync::mpsc::SyncSender<Result<(), String>>,
        },
        Window(WindowId, WindowOperation),
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
                gpui_platform::application()
                    .with_http_client(Arc::new(reqwest_client::ReqwestClient::new()))
                    .run(move |cx| {
                        crate::render::init(cx);
                        cx.activate(true);
                        cx.spawn(async move |cx| {
                            let mut windows = HashMap::new();
                            while let Some(command) = receiver.next().await {
                                match command {
                                    UiCommand::Open {
                                        window_id,
                                        options,
                                        response,
                                    } => {
                                        let result = cx
                                            .update(|cx| open_gpui_window(window_id, options, cx))
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
                                    UiCommand::Window(window_id, operation) => {
                                        let window = if matches!(&operation, WindowOperation::Close)
                                        {
                                            windows.remove(&window_id)
                                        } else {
                                            windows.get(&window_id).copied()
                                        };
                                        cx.update(|cx| {
                                            execute_window_operation(window_id, window, operation, cx)
                                        });
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

    pub fn open_window(window_id: WindowId, options: NativeWindowOptions) -> Result<(), String> {
        let (response, receiver) = sync_channel(1);
        command_sender()?
            .unbounded_send(UiCommand::Open {
                window_id,
                options,
                response,
            })
            .map_err(|_| "The GPUI UI thread is not running".to_string())?;
        receiver
            .recv()
            .map_err(|_| "The GPUI UI thread stopped during window creation".to_string())?
    }

    fn send(command: UiCommand) -> bool {
        commands()
            .lock()
            .ok()
            .and_then(|commands| commands.as_ref().cloned())
            .is_some_and(|sender| sender.unbounded_send(command).is_ok())
    }

    pub(crate) fn dispatch(window_id: WindowId, operation: WindowOperation) -> bool {
        send(UiCommand::Window(window_id, operation))
    }

    pub fn close_window(window_id: WindowId) {
        dispatch(window_id, WindowOperation::Close);
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

    pub fn open_window(_window_id: WindowId, _options: NativeWindowOptions) -> Result<(), String> {
        Err("Retend GPUI does not support this operating system".to_string())
    }

    pub(crate) fn dispatch(_window_id: WindowId, _operation: WindowOperation) -> bool {
        false
    }

    pub fn close_window(_window_id: WindowId) {}
    pub fn remove_registered_window(_window_id: WindowId) {}
    pub fn tick() -> Result<bool, String> {
        Ok(false)
    }
}

pub(crate) use imp::dispatch;
use imp::remove_registered_window;
pub use imp::{close_window, open_window, tick};

#[cfg(test)]
thread_local! {
    static TEST_INVALIDATIONS: std::cell::RefCell<Vec<(WindowId, Option<String>)>> =
        const { std::cell::RefCell::new(Vec::new()) };
}

pub fn invalidate_window(window_id: WindowId) {
    #[cfg(test)]
    TEST_INVALIDATIONS.with(|invalidations| {
        let snapshot = crate::runtime()
            .lock()
            .ok()
            .and_then(|tree| tree.debug_window_json(window_id).ok());
        invalidations.borrow_mut().push((window_id, snapshot));
    });
    dispatch(window_id, WindowOperation::Invalidate);
}

#[cfg(test)]
pub(crate) fn take_test_invalidations() -> Vec<(WindowId, Option<String>)> {
    TEST_INVALIDATIONS.with(|invalidations| std::mem::take(&mut *invalidations.borrow_mut()))
}

#[cfg(test)]
fn take_test_focus_events() -> Vec<(WindowId, NodeId, NativeEventId)> {
    TEST_FOCUS_EVENTS.with(|events| std::mem::take(&mut *events.borrow_mut()))
}

#[cfg(test)]
mod tests {
    use std::{
        cell::RefCell,
        rc::Rc,
        sync::{
            atomic::{AtomicU32, Ordering},
            mpsc,
        },
    };

    use gpui::{EntityInputHandler, Focusable, Keystroke, TestApp, TestAppContext};
    use napi::bindgen_prelude::Buffer;

    use super::*;
    use crate::{
        protocol::{Command, PropertyValue},
        protocol_generated::{ElementKind, PropertyId},
        tree::NativeTree,
    };

    struct FocusTreeView {
        tree: Rc<RefCell<NativeTree>>,
        runtime_state: RuntimeStateRegistry,
        window_id: WindowId,
    }

    impl Render for FocusTreeView {
        fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
            let tree = self.tree.borrow();
            let generation = prepare_frame(&tree, &self.runtime_state, self.window_id, window, cx);
            crate::render::build_with_runtime(
                &tree,
                tree.windows[&self.window_id].root_id,
                &self.runtime_state,
                generation,
            )
        }
    }

    fn focus_tree(
        nodes: &[(NodeId, Option<isize>)],
        edges: &[(NodeId, NodeId)],
    ) -> (Rc<RefCell<NativeTree>>, WindowId) {
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window_id = tree.borrow_mut().create_window(1).unwrap();
        let mut commands = Vec::new();
        for &(id, tab_index) in nodes {
            commands.push(Command::CreateNode {
                id,
                kind: ElementKind::Container,
            });
            if let Some(tab_index) = tab_index {
                commands.push(Command::SetProperty {
                    id,
                    property: PropertyId::TabIndex,
                    value: PropertyValue::Number(tab_index as f64),
                });
            }
        }
        for &(parent_id, child_id) in edges {
            commands.push(Command::InsertChild {
                parent_id,
                child_id,
                before_id: 0,
            });
        }
        tree.borrow_mut()
            .apply_commands(window_id, commands)
            .unwrap();
        (tree, window_id)
    }

    fn text_control_tree(
        kind: ElementKind,
        value: Option<&str>,
    ) -> (Rc<RefCell<NativeTree>>, WindowId) {
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window_id = tree.borrow_mut().create_window(1).unwrap();
        let mut commands = vec![Command::CreateNode { id: 2, kind }];
        if let Some(value) = value {
            commands.push(Command::SetProperty {
                id: 2,
                property: PropertyId::Value,
                value: PropertyValue::String(value.into()),
            });
        }
        commands.push(Command::InsertChild {
            parent_id: 1,
            child_id: 2,
            before_id: 0,
        });
        tree.borrow_mut()
            .apply_commands(window_id, commands)
            .unwrap();
        (tree, window_id)
    }

    fn input_tree(value: Option<&str>) -> (Rc<RefCell<NativeTree>>, WindowId) {
        text_control_tree(ElementKind::Input, value)
    }

    fn textarea_tree(value: Option<&str>) -> (Rc<RefCell<NativeTree>>, WindowId) {
        text_control_tree(ElementKind::Textarea, value)
    }

    static NEXT_GLOBAL_TEST_ROOT: AtomicU32 = AtomicU32::new(0xc000_0000);

    #[gpui::test]
    fn nested_focus_events_target_only_the_exact_focused_node(cx: &mut TestAppContext) {
        let (tree, window_id) = focus_tree(&[(2, Some(0)), (3, Some(0))], &[(1, 2), (2, 3)]);
        let runtime_state = RuntimeStateRegistry::default();
        let window = cx.add_window({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| FocusTreeView {
                tree,
                runtime_state,
                window_id,
            }
        });
        cx.update_window(window.into(), |_, window, cx| {
            window.activate_window();
            window.draw(cx).clear(cx);
        })
        .unwrap();
        cx.executor().run_until_parked();
        take_test_focus_events();

        let parent = runtime_state.focus_handle(2).unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            window.focus(&parent, cx);
            window.draw(cx).clear(cx);
        })
        .unwrap();
        assert_eq!(
            take_test_focus_events(),
            vec![(window_id, 2, NativeEventId::Focus)]
        );

        let child = runtime_state.focus_handle(3).unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            window.focus(&child, cx);
            window.draw(cx).clear(cx);
        })
        .unwrap();
        let events = take_test_focus_events();
        assert_eq!(events.len(), 2);
        assert!(events.contains(&(window_id, 2, NativeEventId::Blur)));
        assert!(events.contains(&(window_id, 3, NativeEventId::Focus)));
    }

    #[gpui::test]
    fn focus_handle_and_focus_survive_detach_reattach(cx: &mut TestAppContext) {
        cx.update(crate::render::init);
        let (tree, window_id) = focus_tree(&[(2, Some(0))], &[(1, 2)]);
        let runtime_state = RuntimeStateRegistry::default();
        let window = cx.add_window({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| FocusTreeView {
                tree,
                runtime_state,
                window_id,
            }
        });
        cx.update_window(window.into(), |_, window, cx| {
            window.activate_window();
            window.draw(cx).clear(cx);
            runtime_state.focus_handle(2).unwrap().focus(window, cx);
            window.draw(cx).clear(cx);
        })
        .unwrap();
        let focus = runtime_state.focus_handle(2).unwrap();
        take_test_focus_events();

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![Command::RemoveChild {
                    parent_id: 1,
                    child_id: 2,
                }],
            )
            .unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
            assert_eq!(runtime_state.focus_handle(2).unwrap(), focus);
            assert!(focus.is_focused(window));
        })
        .unwrap();
        assert!(take_test_focus_events().is_empty());

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![Command::InsertChild {
                    parent_id: 1,
                    child_id: 2,
                    before_id: 0,
                }],
            )
            .unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
            assert_eq!(runtime_state.focus_handle(2).unwrap(), focus);
            assert!(focus.is_focused(window));
        })
        .unwrap();
        assert!(take_test_focus_events().is_empty());
    }

    #[gpui::test]
    fn detached_focus_operation_routes_keyboard_after_reattach(cx: &mut TestAppContext) {
        cx.update(crate::render::init);
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        let target_id = root_id + 1;
        let window_id = {
            let mut tree = crate::runtime().lock().unwrap();
            let window_id = tree.create_window(root_id).unwrap();
            tree.apply_commands(
                window_id,
                vec![
                    Command::CreateNode {
                        id: target_id,
                        kind: ElementKind::Container,
                    },
                    Command::SetProperty {
                        id: target_id,
                        property: PropertyId::TabIndex,
                        value: PropertyValue::Number(-1.0),
                    },
                    Command::SubscribeEvent {
                        id: target_id,
                        event: NativeEventId::KeyDown,
                    },
                ],
            )
            .unwrap();
            window_id
        };
        let runtime_state = RuntimeStateRegistry::default();
        let window = cx.add_window({
            let runtime_state = runtime_state.clone();
            move |_, _| RetendRootView {
                window_id,
                runtime_state,
                last_window_size: None,
                _window_observers: None,
            }
        });
        cx.update_window(window.into(), |_, window, cx| {
            window.activate_window();
            window.draw(cx).clear(cx);
        })
        .unwrap();

        let focus_operation = {
            let tree = crate::runtime().lock().unwrap();
            let (tab_index, text_control) = tree
                .node_focus_target(window_id, target_id)
                .unwrap()
                .expect("detached node with tabIndex must remain focusable");
            WindowOperation::Focus(target_id, tab_index, text_control)
        };
        cx.update(|cx| execute_window_operation(window_id, Some(window), focus_operation, cx));
        let focus = runtime_state
            .focus_handle(target_id)
            .expect("focus command must create persistent native focus state");
        cx.update_window(window.into(), |_, window, cx| {
            assert!(focus.is_focused(window));
            crate::events::take_test_emitted_events();
            window.dispatch_keystroke(Keystroke::parse("a").unwrap(), cx);
        })
        .unwrap();
        assert!(
            crate::events::take_test_emitted_events()
                .into_iter()
                .all(|(_, event)| event.event_id != NativeEventId::KeyDown as u16),
            "detached focused nodes are absent from GPUI's keyboard dispatch tree"
        );

        crate::runtime()
            .lock()
            .unwrap()
            .apply_commands(
                window_id,
                vec![Command::InsertChild {
                    parent_id: root_id,
                    child_id: target_id,
                    before_id: 0,
                }],
            )
            .unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
            assert_eq!(runtime_state.focus_handle(target_id).unwrap(), focus);
            assert!(focus.is_focused(window));
            crate::events::take_test_emitted_events();
            window.dispatch_keystroke(Keystroke::parse("a").unwrap(), cx);
        })
        .unwrap();

        let events: Vec<_> = crate::events::take_test_emitted_events()
            .into_iter()
            .filter(|(_, event)| event.event_id == NativeEventId::KeyDown as u16)
            .collect();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].0, window_id);
        assert_eq!(events[0].1.target_id, target_id);
        assert_eq!(events[0].1.key, "a");
        crate::runtime().lock().unwrap().close_window(window_id);
    }

    #[gpui::test]
    fn tab_navigation_and_tab_index_removal_follow_browser_mapping(cx: &mut TestAppContext) {
        cx.update(crate::render::init);
        let (tree, window_id) = focus_tree(
            &[(2, Some(0)), (3, Some(1)), (4, Some(-1))],
            &[(1, 2), (1, 3), (1, 4)],
        );
        let runtime_state = RuntimeStateRegistry::default();
        let window = cx.add_window({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| FocusTreeView {
                tree,
                runtime_state,
                window_id,
            }
        });
        cx.update_window(window.into(), |_, window, cx| {
            window.activate_window();
            window.draw(cx).clear(cx);
        })
        .unwrap();
        cx.executor().run_until_parked();

        let tab = Keystroke::parse("tab").unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            window.dispatch_keystroke(tab.clone(), cx);
        })
        .unwrap();
        cx.update_window(window.into(), |_, window, _| {
            assert!(runtime_state.focus_handle(2).unwrap().is_focused(window));
        })
        .unwrap();

        cx.update_window(window.into(), |_, window, cx| {
            window.dispatch_keystroke(tab.clone(), cx);
        })
        .unwrap();
        cx.update_window(window.into(), |_, window, _| {
            assert!(runtime_state.focus_handle(3).unwrap().is_focused(window));
            assert!(!runtime_state.focus_handle(4).unwrap().is_focused(window));
        })
        .unwrap();

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![Command::SetProperty {
                    id: 2,
                    property: PropertyId::TabIndex,
                    value: PropertyValue::Null,
                }],
            )
            .unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
        })
        .unwrap();
        assert!(runtime_state.tracked_focus_handle(2).is_none());

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![Command::SetProperty {
                    id: 2,
                    property: PropertyId::TabIndex,
                    value: PropertyValue::Number(-1.0),
                }],
            )
            .unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
        })
        .unwrap();
        assert!(runtime_state.tracked_focus_handle(2).is_some());

        let shift_tab = Keystroke::parse("shift-tab").unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            window.dispatch_keystroke(shift_tab, cx);
        })
        .unwrap();
        cx.update_window(window.into(), |_, window, _| {
            assert!(runtime_state.focus_handle(3).unwrap().is_focused(window));
            assert!(!runtime_state.focus_handle(2).unwrap().is_focused(window));
        })
        .unwrap();
    }

    #[gpui::test]
    fn native_input_is_a_default_tab_stop(cx: &mut TestAppContext) {
        cx.update(crate::render::init);
        let (tree, window_id) = input_tree(None);
        let runtime_state = RuntimeStateRegistry::default();
        let window = cx.add_window({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| FocusTreeView {
                tree,
                runtime_state,
                window_id,
            }
        });
        cx.update_window(window.into(), |_, window, cx| {
            window.activate_window();
            window.draw(cx).clear(cx);
            window.dispatch_keystroke(Keystroke::parse("tab").unwrap(), cx);
        })
        .unwrap();
        cx.update_window(window.into(), |_, window, _| {
            assert!(runtime_state.focus_handle(2).unwrap().is_focused(window));
        })
        .unwrap();
    }

    #[gpui::test]
    fn native_input_accepts_platform_text_and_stays_single_line(cx: &mut TestAppContext) {
        cx.update(crate::render::init);
        let (tree, window_id) = input_tree(Some("a"));
        let runtime_state = RuntimeStateRegistry::default();
        let window = cx.add_window({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| FocusTreeView {
                tree,
                runtime_state,
                window_id,
            }
        });
        cx.update_window(window.into(), |_, window, cx| {
            window.activate_window();
            window.draw(cx).clear(cx);
            let focus = runtime_state.focus_handle(2).unwrap();
            window.focus(&focus, cx);
            window.draw(cx).clear(cx);
        })
        .unwrap();
        cx.simulate_input(window.into(), "b\nc");

        let value = cx.update(|cx| runtime_state.input(2).unwrap().read(cx).value().to_string());
        assert_eq!(value, "abc");
    }

    #[gpui::test]
    fn native_textarea_accepts_multiline_platform_text_and_commits_on_blur(
        cx: &mut TestAppContext,
    ) {
        cx.update(crate::render::init);
        let (tree, window_id) = textarea_tree(None);
        let runtime_state = RuntimeStateRegistry::default();
        let window = cx.add_window({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| FocusTreeView {
                tree,
                runtime_state,
                window_id,
            }
        });
        cx.update_window(window.into(), |_, window, cx| {
            window.activate_window();
            window.draw(cx).clear(cx);
            runtime_state.focus_handle(2).unwrap().focus(window, cx);
            window.draw(cx).clear(cx);
        })
        .unwrap();
        crate::runtime_state::take_test_text_events();

        cx.simulate_input(window.into(), "b");
        cx.update_window(window.into(), |_, window, cx| {
            window.dispatch_keystroke(Keystroke::parse("enter").unwrap(), cx);
        })
        .unwrap();
        let value = cx.update(|cx| {
            runtime_state
                .textarea(2)
                .unwrap()
                .read(cx)
                .value()
                .to_string()
        });
        assert_eq!(value, "b\n");
        assert_eq!(
            crate::runtime_state::take_test_text_events(),
            vec![
                (window_id, 2, NativeEventId::Input, "b".into()),
                (window_id, 2, NativeEventId::Input, "b\n".into()),
            ]
        );

        cx.simulate_input(window.into(), "c");
        assert_eq!(
            crate::runtime_state::take_test_text_events(),
            vec![(window_id, 2, NativeEventId::Input, "b\nc".into())]
        );

        cx.update_window(window.into(), |_, window, cx| window.blur(cx))
            .unwrap();
        assert_eq!(
            crate::runtime_state::take_test_text_events(),
            vec![(window_id, 2, NativeEventId::Change, "b\nc".into())]
        );
    }

    #[gpui::test]
    fn imperative_input_focus_before_first_frame_uses_editor_handle(cx: &mut TestAppContext) {
        cx.update(crate::render::init);
        let (tree, window_id) = input_tree(Some("a"));
        let snapshot = tree.borrow().text_control_snapshot(window_id, 2).unwrap();
        let runtime_state = RuntimeStateRegistry::default();
        let window = cx.add_window({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |window, cx| {
                window.activate_window();
                focus_runtime_node(&runtime_state, window_id, 2, 0, Some(&snapshot), window, cx);
                FocusTreeView {
                    tree,
                    runtime_state,
                    window_id,
                }
            }
        });

        cx.update_window(window.into(), |_, window, cx| {
            let editor = runtime_state.input(2).unwrap();
            let editor_focus = editor.read(cx).focus_handle(cx);
            assert_eq!(runtime_state.focus_handle(2).unwrap(), editor_focus);
            assert!(editor_focus.is_focused(window));

            window.draw(cx).clear(cx);
            assert_eq!(
                runtime_state.focus_handle(2).unwrap(),
                editor.read(cx).focus_handle(cx)
            );
        })
        .unwrap();

        cx.simulate_input(window.into(), "b");
        let value = cx.update(|cx| runtime_state.input(2).unwrap().read(cx).value().to_string());
        assert_eq!(value, "ab");
    }

    #[gpui::test]
    fn native_text_control_selection_uses_utf16_offsets_and_pending_controlled_value(
        cx: &mut TestAppContext,
    ) {
        cx.update(crate::render::init);
        for kind in [ElementKind::Input, ElementKind::Textarea] {
            let (tree, window_id) = text_control_tree(kind, Some("old"));
            let runtime_state = RuntimeStateRegistry::default();
            let window = cx.add_window({
                let tree = tree.clone();
                let runtime_state = runtime_state.clone();
                move |_, _| FocusTreeView {
                    tree,
                    runtime_state,
                    window_id,
                }
            });
            cx.update_window(window.into(), |_, window, cx| {
                window.activate_window();
                window.draw(cx).clear(cx);
            })
            .unwrap();

            tree.borrow_mut()
                .apply_commands(
                    window_id,
                    vec![Command::SetProperty {
                        id: 2,
                        property: PropertyId::Value,
                        value: PropertyValue::String("a😀b".into()),
                    }],
                )
                .unwrap();
            let snapshot = tree.borrow().text_control_snapshot(window_id, 2).unwrap();

            cx.update(|cx| {
                window
                    .update(cx, |_, window, cx| {
                        let control = ensure_text_control_entity(
                            &runtime_state,
                            window_id,
                            2,
                            &snapshot,
                            window,
                            cx,
                        );
                        control.set_selection(3, 3, cx);
                        assert_eq!(
                            control.selection(window, cx).unwrap(),
                            NativeSelection { start: 3, end: 3 }
                        );

                        control.select_all(window, cx);
                        assert_eq!(
                            control.selection(window, cx).unwrap(),
                            NativeSelection { start: 0, end: 4 }
                        );
                    })
                    .unwrap();
            });
        }
    }

    #[gpui::test]
    fn native_text_control_selection_survives_detach_reattach(cx: &mut TestAppContext) {
        cx.update(crate::render::init);
        for kind in [ElementKind::Input, ElementKind::Textarea] {
            let (tree, window_id) = text_control_tree(kind, Some("abc"));
            let runtime_state = RuntimeStateRegistry::default();
            let window = cx.add_window({
                let tree = tree.clone();
                let runtime_state = runtime_state.clone();
                move |_, _| FocusTreeView {
                    tree,
                    runtime_state,
                    window_id,
                }
            });
            cx.update_window(window.into(), |_, window, cx| {
                window.activate_window();
                window.draw(cx).clear(cx);
                let control = runtime_state.text_control(2).unwrap();
                control.set_selection(1, 2, cx);
                assert_eq!(
                    control.selection(window, cx).unwrap(),
                    NativeSelection { start: 1, end: 2 }
                );
            })
            .unwrap();

            tree.borrow_mut()
                .apply_commands(
                    window_id,
                    vec![Command::RemoveChild {
                        parent_id: 1,
                        child_id: 2,
                    }],
                )
                .unwrap();
            cx.update_window(window.into(), |_, window, cx| {
                window.refresh();
                window.draw(cx).clear(cx);
            })
            .unwrap();

            tree.borrow_mut()
                .apply_commands(
                    window_id,
                    vec![Command::InsertChild {
                        parent_id: 1,
                        child_id: 2,
                        before_id: 0,
                    }],
                )
                .unwrap();
            cx.update_window(window.into(), |_, window, cx| {
                window.refresh();
                window.draw(cx).clear(cx);
                assert_eq!(
                    runtime_state
                        .text_control(2)
                        .unwrap()
                        .selection(window, cx)
                        .unwrap(),
                    NativeSelection { start: 1, end: 2 }
                );
            })
            .unwrap();
        }
    }

    #[gpui::test]
    fn native_input_and_change_events_follow_edit_commit_semantics(cx: &mut TestAppContext) {
        cx.update(crate::render::init);
        let (tree, window_id) = input_tree(Some("a"));
        let runtime_state = RuntimeStateRegistry::default();
        let window = cx.add_window({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| FocusTreeView {
                tree,
                runtime_state,
                window_id,
            }
        });
        cx.update_window(window.into(), |_, window, cx| {
            window.activate_window();
            window.draw(cx).clear(cx);
            runtime_state.focus_handle(2).unwrap().focus(window, cx);
            window.draw(cx).clear(cx);
        })
        .unwrap();
        crate::runtime_state::take_test_text_events();

        cx.simulate_input(window.into(), "b");
        assert_eq!(
            crate::runtime_state::take_test_text_events(),
            vec![(window_id, 2, NativeEventId::Input, "ab".into())]
        );

        cx.update_window(window.into(), |_, window, cx| {
            window.dispatch_keystroke(Keystroke::parse("enter").unwrap(), cx);
        })
        .unwrap();
        assert_eq!(
            crate::runtime_state::take_test_text_events(),
            vec![(window_id, 2, NativeEventId::Change, "ab".into())]
        );

        cx.update_window(window.into(), |_, window, cx| {
            window.dispatch_keystroke(Keystroke::parse("enter").unwrap(), cx);
        })
        .unwrap();
        assert!(crate::runtime_state::take_test_text_events().is_empty());

        cx.simulate_input(window.into(), "c");
        assert_eq!(
            crate::runtime_state::take_test_text_events(),
            vec![(window_id, 2, NativeEventId::Input, "abc".into())]
        );
        cx.update_window(window.into(), |_, window, cx| window.blur(cx))
            .unwrap();
        assert_eq!(
            crate::runtime_state::take_test_text_events(),
            vec![(window_id, 2, NativeEventId::Change, "abc".into())]
        );
    }

    #[gpui::test]
    fn identical_controlled_textarea_write_preserves_selection_and_composition(
        cx: &mut TestAppContext,
    ) {
        cx.update(crate::render::init);
        let (tree, window_id) = textarea_tree(Some("a\nb"));
        let runtime_state = RuntimeStateRegistry::default();
        let window = cx.add_window({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| FocusTreeView {
                tree,
                runtime_state,
                window_id,
            }
        });
        cx.update_window(window.into(), |_, window, cx| {
            window.activate_window();
            window.draw(cx).clear(cx);
        })
        .unwrap();

        let textarea = runtime_state.textarea(2).unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            textarea.update(cx, |textarea, cx| {
                textarea.set_selected_range(2..2, cx);
                textarea.replace_and_mark_text_in_range(None, "X", Some(1..1), window, cx);
            });
            window.draw(cx).clear(cx);
        })
        .unwrap();
        let before = cx
            .update_window(window.into(), |_, window, cx| {
                textarea.update(cx, |textarea, cx| {
                    (
                        textarea.value().to_string(),
                        textarea
                            .selected_text_range(false, window, cx)
                            .unwrap()
                            .range,
                        textarea.marked_text_range(window, cx),
                    )
                })
            })
            .unwrap();

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![Command::SetProperty {
                    id: 2,
                    property: PropertyId::Value,
                    value: PropertyValue::String(before.0.clone()),
                }],
            )
            .unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
        })
        .unwrap();
        let identical = cx
            .update_window(window.into(), |_, window, cx| {
                textarea.update(cx, |textarea, cx| {
                    (
                        textarea.value().to_string(),
                        textarea
                            .selected_text_range(false, window, cx)
                            .unwrap()
                            .range,
                        textarea.marked_text_range(window, cx),
                    )
                })
            })
            .unwrap();
        assert_eq!(identical, before);
    }

    #[gpui::test]
    fn identical_controlled_input_write_preserves_selection_and_composition(
        cx: &mut TestAppContext,
    ) {
        cx.update(crate::render::init);
        let (tree, window_id) = input_tree(Some("ab"));
        let runtime_state = RuntimeStateRegistry::default();
        let window = cx.add_window({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| FocusTreeView {
                tree,
                runtime_state,
                window_id,
            }
        });
        cx.update_window(window.into(), |_, window, cx| {
            window.activate_window();
            window.draw(cx).clear(cx);
        })
        .unwrap();

        let input = runtime_state.input(2).unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            input.update(cx, |input, cx| {
                input.set_selected_range(1..1, cx);
                input.replace_and_mark_text_in_range(None, "X", Some(1..1), window, cx);
            });
            window.draw(cx).clear(cx);
        })
        .unwrap();
        let before = cx
            .update_window(window.into(), |_, window, cx| {
                input.update(cx, |input, cx| {
                    (
                        input.value().to_string(),
                        input.selected_text_range(false, window, cx).unwrap().range,
                        input.marked_text_range(window, cx),
                    )
                })
            })
            .unwrap();

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![Command::SetProperty {
                    id: 2,
                    property: PropertyId::Value,
                    value: PropertyValue::String(before.0.clone()),
                }],
            )
            .unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
        })
        .unwrap();
        let identical = cx
            .update_window(window.into(), |_, window, cx| {
                input.update(cx, |input, cx| {
                    (
                        input.value().to_string(),
                        input.selected_text_range(false, window, cx).unwrap().range,
                        input.marked_text_range(window, cx),
                    )
                })
            })
            .unwrap();
        assert_eq!(identical, before);

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![Command::SetProperty {
                    id: 2,
                    property: PropertyId::Value,
                    value: PropertyValue::String("z".into()),
                }],
            )
            .unwrap();
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
        })
        .unwrap();
        let replaced = cx
            .update_window(window.into(), |_, window, cx| {
                input.update(cx, |input, cx| {
                    (
                        input.value().to_string(),
                        input.selected_text_range(false, window, cx).unwrap().range,
                        input.marked_text_range(window, cx),
                    )
                })
            })
            .unwrap();
        assert_eq!(replaced, ("z".to_string(), 1..1, None));
    }

    #[gpui::test]
    fn pending_layout_queries_reject_when_window_closes(cx: &mut TestAppContext) {
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        let window_id = crate::runtime()
            .lock()
            .unwrap()
            .create_window(root_id)
            .unwrap();
        let runtime_state = RuntimeStateRegistry::default();
        let window = cx.add_window({
            let runtime_state = runtime_state.clone();
            move |_, _| RetendRootView {
                window_id,
                runtime_state,
                last_window_size: None,
                _window_observers: None,
            }
        });
        let (sender, receiver) = mpsc::channel();
        runtime_state.enqueue_layout(LayoutOperation::Measure(
            root_id,
            MeasureResponder::new(move |result| sender.send(result).unwrap()),
        ));

        cx.update_window(window.into(), |_, window, _| window.remove_window())
            .unwrap();
        cx.executor().run_until_parked();
        let failure = receiver.try_recv().unwrap().unwrap_err();
        assert_eq!(failure.code, "CLOSED_WINDOW");
        assert!(receiver.try_recv().is_err());
        crate::runtime().lock().unwrap().close_window(window_id);
    }

    #[gpui::test]
    fn pending_layout_queries_reject_when_healthy_renderer_becomes_poisoned(
        cx: &mut TestAppContext,
    ) {
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        let window_id = crate::runtime()
            .lock()
            .unwrap()
            .create_window(root_id)
            .unwrap();
        let runtime_state = RuntimeStateRegistry::default();
        let window = cx.add_window({
            let runtime_state = runtime_state.clone();
            move |_, _| RetendRootView {
                window_id,
                runtime_state,
                last_window_size: None,
                _window_observers: None,
            }
        });
        cx.update_window(window.into(), |_, window, cx| {
            window.draw(cx).clear(cx);
        })
        .unwrap();

        let (sender, receiver) = mpsc::channel();
        runtime_state.enqueue_layout(LayoutOperation::Measure(
            root_id,
            MeasureResponder::new(move |result| sender.send(result).unwrap()),
        ));
        assert!(receiver.try_recv().is_err(), "query must still be pending");

        let binding = crate::NativeRendererBinding {
            window_id,
            root_id,
            headless: false,
            options: NativeWindowOptions::default(),
            opened: std::sync::atomic::AtomicBool::new(false),
        };
        take_test_invalidations();
        assert!(binding.apply_command_batch(Buffer::from(vec![0])).is_err());
        let invalidations = take_test_invalidations();
        assert_eq!(invalidations.len(), 1);
        assert_eq!(invalidations[0].0, window_id);
        assert!(invalidations[0]
            .1
            .as_deref()
            .is_some_and(|snapshot| snapshot.contains("\"poisoned\":true")));
        // The TestApp window is not registered in the real platform dispatcher, so
        // replay the invalidation operation that apply_command_batch just submitted.
        cx.update(|cx| {
            execute_window_operation(window_id, Some(window), WindowOperation::Invalidate, cx)
        });
        cx.executor().run_until_parked();

        let failure = receiver.try_recv().unwrap().unwrap_err();
        assert_eq!(failure.code, "POISONED_RENDERER");
        assert!(receiver.try_recv().is_err());
        crate::runtime().lock().unwrap().close_window(window_id);
    }

    #[test]
    fn closed_query_rejection_is_exactly_once() {
        let results = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let captured = results.clone();
        let responder = MeasureResponder::new(move |result| {
            captured
                .lock()
                .unwrap()
                .push(result.map(|_| "OK").unwrap_or_else(|error| error.code));
        });

        responder.respond(Err(closed_window_query_failure()));
        responder.respond(Ok(crate::runtime_state::Measurement::default()));

        assert_eq!(*results.lock().unwrap(), vec!["CLOSED_WINDOW"]);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn deferred_query_rejects_if_window_is_gone_before_dispatch() {
        let (sender, receiver) = mpsc::channel();
        let responder = MeasureResponder::new(move |result| sender.send(result).unwrap());
        let operation = WindowOperation::Layout(LayoutOperation::Measure(1, responder));

        crate::events::with_direct_window_delivery(|| {
            assert!(dispatch(u32::MAX, operation));
        });
        assert!(receiver.try_recv().is_err(), "query must still be queued");

        tick().unwrap();
        let failure = receiver.try_recv().unwrap().unwrap_err();
        assert_eq!(failure.code, "CLOSED_WINDOW");
    }

    #[test]
    fn native_window_bounds_observer_emits_resize_once() {
        use std::{cell::RefCell, rc::Rc};

        let mut app = TestApp::new();
        let window_id = 77;
        let constraints = WindowSizeConstraints {
            min_width: None,
            min_height: None,
            max_width: Some(500.0),
            max_height: Some(400.0),
        };
        let events = Rc::new(RefCell::new(Vec::new()));
        let emitted = events.clone();
        let window = app.open_window(move |window, cx| {
            let mut view = RetendRootView {
                window_id,
                runtime_state: RuntimeStateRegistry::default(),
                last_window_size: None,
                _window_observers: None,
            };
            view._window_observers = Some(install_window_observers(
                window_id,
                constraints,
                window,
                cx,
                {
                    let emitted = emitted.clone();
                    move |_, payload| emitted.borrow_mut().push(payload)
                },
            ));
            view
        });

        let handle = window.handle();
        app.update(|cx| {
            cx.update_window(handle.into(), |_root, window, cx| {
                window.bounds_changed(cx);
                window.bounds_changed(cx);
            })
            .unwrap();
        });

        let events = events.borrow();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].kind, "resize");
        assert_eq!(events[0].width, Some(500.0));
        assert_eq!(events[0].height, Some(400.0));

        app.update(|cx| cx.shutdown());
    }

    #[test]
    fn native_window_root_uses_retend_canvas_defaults() {
        let mut actual = crate::render::root_container();
        let mut expected = div()
            .size_full()
            .bg(rgb(0xffffff))
            .text_color(rgb(0x000000));
        assert_eq!(actual.style(), expected.style());
    }
}
