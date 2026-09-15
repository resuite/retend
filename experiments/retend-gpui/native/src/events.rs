use std::{
    collections::HashMap,
    sync::{Arc, Mutex, OnceLock},
    time::Instant,
};

#[cfg(target_os = "macos")]
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
};

use gpui::{
    ClickEvent, Keystroke, Modifiers, MouseButton, MouseDownEvent, MouseMoveEvent, MouseUpEvent,
    NavigationDirection, Pixels, Point,
};
#[cfg(target_os = "macos")]
use napi::bindgen_prelude::{Env, FunctionRef, JsValuesTuple};
use napi::{
    bindgen_prelude::Function,
    threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
    Error, Result, Status,
};
use napi_derive::napi;

use crate::{
    protocol_generated::NativeEventId,
    tree::{NodeId, WindowId},
};

#[napi(object)]
#[derive(Clone, Debug)]
pub struct NativeWindowEventPayload {
    pub kind: String,
    pub width: Option<f64>,
    pub height: Option<f64>,
}

impl NativeWindowEventPayload {
    fn new(kind: &str) -> Self {
        Self {
            kind: kind.to_string(),
            width: None,
            height: None,
        }
    }

    pub fn resize(width: f64, height: f64) -> Self {
        Self {
            kind: "resize".to_string(),
            width: Some(width),
            height: Some(height),
        }
    }

    pub fn activation(active: bool) -> Self {
        Self::new(if active { "focus" } else { "blur" })
    }

    pub fn close() -> Self {
        Self::new("close")
    }

    pub fn reload() -> Self {
        Self::new("reload")
    }
}

#[napi(object)]
pub struct NativeTransportPayload {
    pub event: Option<NativeEventPayload>,
    pub window: Option<NativeWindowEventPayload>,
}

impl NativeTransportPayload {
    fn event(event: NativeEventPayload) -> Self {
        Self {
            event: Some(event),
            window: None,
        }
    }

    fn window(window: NativeWindowEventPayload) -> Self {
        Self {
            event: None,
            window: Some(window),
        }
    }
}

#[napi(object)]
#[derive(Clone, Debug, Default)]
pub struct NativeEventPayload {
    pub event_id: u16,
    pub target_id: NodeId,
    pub time_stamp: f64,
    pub client_x: f64,
    pub client_y: f64,
    pub button: i32,
    pub buttons: u32,
    pub detail: u32,
    pub alt_key: bool,
    pub ctrl_key: bool,
    pub meta_key: bool,
    pub shift_key: bool,
    pub key: String,
    pub key_char: Option<String>,
    pub repeat: bool,
    pub scroll_x: f64,
    pub scroll_y: f64,
    pub value: Option<String>,
    pub property_name: Option<String>,
    pub elapsed_time: f64,
}

fn event_clock() -> &'static Instant {
    static START: OnceLock<Instant> = OnceLock::new();
    START.get_or_init(Instant::now)
}

impl NativeEventPayload {
    pub fn new(event: NativeEventId, target_id: NodeId) -> Self {
        Self {
            event_id: event as u16,
            target_id,
            time_stamp: event_clock().elapsed().as_secs_f64() * 1_000.0,
            ..Self::default()
        }
    }

    fn is_mouse_move(&self) -> bool {
        self.event_id == NativeEventId::MouseMove as u16
    }

    pub fn scroll(target_id: NodeId, x: f64, y: f64) -> Self {
        let mut payload = Self::new(NativeEventId::Scroll, target_id);
        payload.scroll_x = x;
        payload.scroll_y = y;
        payload
    }

    pub fn text(event: NativeEventId, target_id: NodeId, value: String) -> Self {
        let mut payload = Self::new(event, target_id);
        payload.value = Some(value);
        payload
    }

    pub fn transition(
        event: NativeEventId,
        target_id: NodeId,
        property_name: String,
        elapsed_time: f64,
    ) -> Self {
        let mut payload = Self::new(event, target_id);
        payload.property_name = Some(property_name);
        payload.elapsed_time = elapsed_time;
        payload
    }
}

fn apply_modifiers(payload: &mut NativeEventPayload, modifiers: Modifiers) {
    payload.alt_key = modifiers.alt;
    payload.ctrl_key = modifiers.control;
    payload.meta_key = modifiers.platform;
    payload.shift_key = modifiers.shift;
}

fn apply_position(payload: &mut NativeEventPayload, position: Point<Pixels>) {
    payload.client_x = f64::from(f32::from(position.x));
    payload.client_y = f64::from(f32::from(position.y));
}

fn button_values(button: MouseButton) -> (i32, u32) {
    match button {
        MouseButton::Left => (0, 1),
        MouseButton::Middle => (1, 4),
        MouseButton::Right => (2, 2),
        MouseButton::Navigate(NavigationDirection::Back) => (3, 8),
        MouseButton::Navigate(NavigationDirection::Forward) => (4, 16),
    }
}

pub fn mouse_down(
    event_id: NativeEventId,
    target_id: NodeId,
    event: &MouseDownEvent,
) -> NativeEventPayload {
    let mut payload = mouse_event(event_id, target_id, event.position, event.modifiers);
    (payload.button, payload.buttons) = button_values(event.button);
    payload.detail = event.click_count as u32;
    payload
}

pub fn mouse_up(
    event_id: NativeEventId,
    target_id: NodeId,
    event: &MouseUpEvent,
) -> NativeEventPayload {
    let mut payload = mouse_event(event_id, target_id, event.position, event.modifiers);
    payload.button = button_values(event.button).0;
    payload.detail = event.click_count as u32;
    payload
}

pub fn mouse_move(target_id: NodeId, event: &MouseMoveEvent) -> NativeEventPayload {
    let mut payload = mouse_event(
        NativeEventId::MouseMove,
        target_id,
        event.position,
        event.modifiers,
    );
    (payload.button, payload.buttons) = event.pressed_button.map(button_values).unwrap_or_default();
    payload
}

pub fn click(event_id: NativeEventId, target_id: NodeId, event: &ClickEvent) -> NativeEventPayload {
    let mut payload = mouse_event(event_id, target_id, event.position(), event.modifiers());
    payload.detail = event.click_count() as u32;
    payload.button = match event {
        ClickEvent::Mouse(event) => button_values(event.up.button).0,
        ClickEvent::Keyboard(_) | ClickEvent::Touch(_) => 0,
    };
    payload
}

pub fn mouse_event(
    event_id: NativeEventId,
    target_id: NodeId,
    position: Point<Pixels>,
    modifiers: Modifiers,
) -> NativeEventPayload {
    let mut payload = NativeEventPayload::new(event_id, target_id);
    apply_position(&mut payload, position);
    apply_modifiers(&mut payload, modifiers);
    payload
}

pub fn key_event(
    event_id: NativeEventId,
    target_id: NodeId,
    keystroke: &Keystroke,
    repeat: bool,
) -> NativeEventPayload {
    let mut payload = NativeEventPayload::new(event_id, target_id);
    apply_modifiers(&mut payload, keystroke.modifiers);
    payload.key = keystroke.key.clone();
    payload.key_char = keystroke.key_char.clone();
    payload.repeat = repeat;
    payload
}

struct MoveSlot {
    payload: Mutex<Option<NativeEventPayload>>,
}

impl MoveSlot {
    fn new() -> Self {
        Self {
            payload: Mutex::new(None),
        }
    }

    fn replace_and_mark_queued(&self, payload: NativeEventPayload) -> bool {
        self.payload
            .lock()
            .is_ok_and(|mut pending| pending.replace(payload).is_none())
    }

    fn take_for_delivery(&self) -> Result<NativeEventPayload> {
        self.payload
            .lock()
            .map_err(|_| {
                Error::new(
                    Status::GenericFailure,
                    "Native mouse-move queue lock was poisoned.",
                )
            })?
            .take()
            .ok_or_else(|| {
                Error::new(
                    Status::GenericFailure,
                    "Native mouse-move delivery was scheduled without a payload.",
                )
            })
    }
}

enum EventDelivery {
    Discrete(NativeEventPayload),
    MouseMove(Arc<MoveSlot>),
    Window(NativeWindowEventPayload),
}

type EventCallback = ThreadsafeFunction<EventDelivery, (), NativeTransportPayload, Status, false>;

impl EventDelivery {
    fn into_payload(self) -> Result<NativeTransportPayload> {
        match self {
            Self::Discrete(event) => Ok(NativeTransportPayload::event(event)),
            Self::MouseMove(slot) => Ok(NativeTransportPayload::event(slot.take_for_delivery()?)),
            Self::Window(window) => Ok(NativeTransportPayload::window(window)),
        }
    }
}

#[derive(Default)]
struct EventQueue {
    current_move: Option<Arc<MoveSlot>>,
}

impl EventQueue {
    fn schedule(&mut self, payload: NativeEventPayload) -> Option<EventDelivery> {
        if !payload.is_mouse_move() {
            self.current_move = None;
            return Some(EventDelivery::Discrete(payload));
        }

        let slot = self
            .current_move
            .get_or_insert_with(|| Arc::new(MoveSlot::new()))
            .clone();
        slot.replace_and_mark_queued(payload)
            .then_some(EventDelivery::MouseMove(slot))
    }

    fn schedule_window(&mut self, payload: NativeWindowEventPayload) -> EventDelivery {
        self.current_move = None;
        EventDelivery::Window(payload)
    }
}

struct EventTransport {
    callback: EventCallback,
    queue: Mutex<EventQueue>,
}

impl EventTransport {
    fn new(callback: Function<'_, NativeTransportPayload, ()>) -> Result<Self> {
        let callback = callback
            .build_threadsafe_function::<EventDelivery>()
            .build_callback(|context| context.value.into_payload())?;
        Ok(Self {
            callback,
            queue: Mutex::new(EventQueue::default()),
        })
    }

    fn emit(&self, payload: NativeEventPayload) {
        let Ok(mut queue) = self.queue.lock() else {
            return;
        };
        if let Some(delivery) = queue.schedule(payload) {
            self.callback
                .call(delivery, ThreadsafeFunctionCallMode::NonBlocking);
        }
    }

    fn emit_window(&self, payload: NativeWindowEventPayload) -> bool {
        let Ok(mut queue) = self.queue.lock() else {
            return false;
        };
        self.callback.call(
            queue.schedule_window(payload),
            ThreadsafeFunctionCallMode::NonBlocking,
        ) == Status::Ok
    }
}

static TRANSPORTS: OnceLock<Mutex<HashMap<WindowId, Arc<EventTransport>>>> = OnceLock::new();

fn transports() -> &'static Mutex<HashMap<WindowId, Arc<EventTransport>>> {
    TRANSPORTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn transport(window_id: WindowId) -> Option<Arc<EventTransport>> {
    transports().lock().ok()?.get(&window_id).cloned()
}

fn report_window_delivery(delivered: bool, _kind: &str, _window_id: WindowId) -> bool {
    #[cfg(not(test))]
    if !delivered {
        eprintln!(
            "[retend-gpui] failed to deliver native window event `{_kind}` for window {_window_id}"
        );
    }
    delivered
}

#[cfg(target_os = "macos")]
struct DirectWindowCallback {
    env: Env,
    callback: FunctionRef<NativeTransportPayload, ()>,
}

#[cfg(target_os = "macos")]
thread_local! {
    static DIRECT_WINDOW_CALLBACKS: RefCell<HashMap<WindowId, Rc<DirectWindowCallback>>> = RefCell::new(HashMap::new());
    static DIRECT_WINDOW_DELIVERY: Cell<bool> = const { Cell::new(false) };
}

#[cfg(target_os = "macos")]
fn call_direct(callback: &DirectWindowCallback, payload: NativeWindowEventPayload) -> bool {
    callback
        .callback
        .borrow_back(&callback.env)
        .and_then(|function| function.call(NativeTransportPayload::window(payload)))
        .is_ok()
}

#[cfg(target_os = "macos")]
pub fn with_direct_window_delivery<T>(f: impl FnOnce() -> T) -> T {
    struct Reset<'a>(&'a Cell<bool>, bool);
    impl Drop for Reset<'_> {
        fn drop(&mut self) {
            self.0.set(self.1);
        }
    }

    DIRECT_WINDOW_DELIVERY.with(|active| {
        let _reset = Reset(active, active.replace(true));
        f()
    })
}

#[cfg(target_os = "macos")]
pub fn in_direct_window_delivery() -> bool {
    DIRECT_WINDOW_DELIVERY.with(Cell::get)
}

pub fn register(
    window_id: WindowId,
    callback: Function<'_, NativeTransportPayload, ()>,
) -> Result<()> {
    #[cfg(target_os = "macos")]
    let env: Env = callback.env().into();
    #[cfg(target_os = "macos")]
    let direct_callback = callback.create_ref()?;
    let transport = Arc::new(EventTransport::new(callback)?);
    transports()
        .lock()
        .map_err(|_| {
            Error::new(
                Status::GenericFailure,
                "Native event transport lock was poisoned.",
            )
        })?
        .insert(window_id, transport);
    #[cfg(target_os = "macos")]
    DIRECT_WINDOW_CALLBACKS.with(|callbacks| {
        callbacks.borrow_mut().insert(
            window_id,
            Rc::new(DirectWindowCallback {
                env,
                callback: direct_callback,
            }),
        );
    });
    Ok(())
}

pub fn unregister(window_id: WindowId) {
    if let Ok(mut transports) = transports().lock() {
        transports.remove(&window_id);
    }
    #[cfg(target_os = "macos")]
    DIRECT_WINDOW_CALLBACKS.with(|callbacks| {
        callbacks.borrow_mut().remove(&window_id);
    });
}

#[cfg(test)]
thread_local! {
    static TEST_EMITTED_EVENTS: std::cell::RefCell<Vec<(WindowId, NativeEventPayload)>> =
        const { std::cell::RefCell::new(Vec::new()) };
}

pub fn emit(window_id: WindowId, payload: NativeEventPayload) {
    #[cfg(test)]
    TEST_EMITTED_EVENTS.with(|events| events.borrow_mut().push((window_id, payload.clone())));
    if let Some(transport) = transport(window_id) {
        transport.emit(payload);
    }
}

#[cfg(test)]
pub(crate) fn take_test_emitted_events() -> Vec<(WindowId, NativeEventPayload)> {
    TEST_EMITTED_EVENTS.with(|events| std::mem::take(&mut *events.borrow_mut()))
}

pub fn emit_window(window_id: WindowId, payload: NativeWindowEventPayload) -> bool {
    let kind = payload.kind.clone();
    #[cfg(target_os = "macos")]
    let delivered = if kind == "resize" && in_direct_window_delivery() {
        DIRECT_WINDOW_CALLBACKS.with(|callbacks| {
            callbacks
                .borrow()
                .get(&window_id)
                .is_some_and(|callback| call_direct(callback, payload))
        })
    } else {
        transport(window_id).is_some_and(|transport| transport.emit_window(payload))
    };
    #[cfg(not(target_os = "macos"))]
    let delivered = transport(window_id).is_some_and(|transport| transport.emit_window(payload));

    report_window_delivery(delivered, &kind, window_id)
}

pub fn emit_close(window_id: WindowId) -> bool {
    let transport = transports()
        .lock()
        .ok()
        .and_then(|mut transports| transports.remove(&window_id));

    #[cfg(target_os = "macos")]
    let direct =
        DIRECT_WINDOW_CALLBACKS.with(|callbacks| callbacks.borrow_mut().remove(&window_id));
    #[cfg(target_os = "macos")]
    let delivered = if in_direct_window_delivery() {
        direct.is_some_and(|callback| call_direct(&callback, NativeWindowEventPayload::close()))
    } else {
        transport.is_some_and(|transport| transport.emit_window(NativeWindowEventPayload::close()))
    };
    #[cfg(not(target_os = "macos"))]
    let delivered =
        transport.is_some_and(|transport| transport.emit_window(NativeWindowEventPayload::close()));

    report_window_delivery(delivered, "close", window_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mouse_move_payload(target_id: NodeId, client_x: f64) -> NativeEventPayload {
        let mut payload = NativeEventPayload::new(NativeEventId::MouseMove, target_id);
        payload.client_x = client_x;
        payload
    }

    #[test]
    fn event_queue_coalesces_moves_without_crossing_discrete_boundaries() {
        let mut queue = EventQueue::default();
        let first = queue.schedule(mouse_move_payload(1, 1.0)).unwrap();
        assert!(queue.schedule(mouse_move_payload(2, 2.0)).is_none());
        assert!(queue.schedule(mouse_move_payload(3, 3.0)).is_none());

        let EventDelivery::MouseMove(first_slot) = first else {
            panic!("first mouse move must schedule a move delivery");
        };
        let delivered = first_slot.take_for_delivery().unwrap();
        assert_eq!(delivered.target_id, 3);
        assert_eq!(delivered.client_x, 3.0);

        let discrete = queue
            .schedule(NativeEventPayload::new(NativeEventId::MouseDown, 9))
            .unwrap();
        assert!(matches!(
            discrete,
            EventDelivery::Discrete(NativeEventPayload { target_id: 9, .. })
        ));

        let next = queue.schedule(mouse_move_payload(4, 4.0)).unwrap();
        let EventDelivery::MouseMove(next_slot) = next else {
            panic!("move after a discrete event must schedule a new delivery");
        };
        assert!(!Arc::ptr_eq(&first_slot, &next_slot));
        let delivered = next_slot.take_for_delivery().unwrap();
        assert_eq!(delivered.target_id, 4);
        assert_eq!(delivered.client_x, 4.0);
    }
}
