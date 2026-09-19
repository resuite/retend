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

    fn is_continuous(&self) -> bool {
        self.event_id == NativeEventId::MouseMove as u16
            || self.event_id == NativeEventId::Scroll as u16
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

pub fn in_window(mut payload: NativeEventPayload, window: &gpui::Window) -> NativeEventPayload {
    let position = gpui::point(
        gpui::px(payload.client_x as f32),
        gpui::px(payload.client_y as f32),
    );
    apply_position(&mut payload, window.point_to_window(position));
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

type ContinuousKey = (u16, NodeId);
type PendingEvents = Mutex<HashMap<ContinuousKey, NativeEventPayload>>;

enum EventDelivery {
    Discrete(NativeEventPayload),
    Continuous {
        pending: Arc<PendingEvents>,
        key: ContinuousKey,
    },
    Window(NativeWindowEventPayload),
}

type EventCallback = ThreadsafeFunction<EventDelivery, (), NativeTransportPayload, Status, false>;

impl EventDelivery {
    fn into_payload(self) -> Result<NativeTransportPayload> {
        match self {
            Self::Discrete(event) => Ok(NativeTransportPayload::event(event)),
            Self::Continuous { pending, key } => {
                let event = pending
                    .lock()
                    .map_err(|_| {
                        Error::new(
                            Status::GenericFailure,
                            "Native event queue lock was poisoned.",
                        )
                    })?
                    .remove(&key)
                    .ok_or_else(|| {
                        Error::new(
                            Status::GenericFailure,
                            "Native continuous delivery was scheduled without a payload.",
                        )
                    })?;
                Ok(NativeTransportPayload::event(event))
            }
            Self::Window(window) => Ok(NativeTransportPayload::window(window)),
        }
    }
}

#[derive(Default)]
struct EventQueue {
    continuous: Option<Arc<PendingEvents>>,
}

impl EventQueue {
    fn schedule(&mut self, payload: NativeEventPayload) -> Result<Option<EventDelivery>> {
        if !payload.is_continuous() {
            self.continuous = None;
            return Ok(Some(EventDelivery::Discrete(payload)));
        }

        // Keep one callback per kind/target until JS consumes it. Scroll payloads are
        // absolute offsets, not deltas. Replacing the entire payload also retains
        // the latest timestamp, button state and modifiers for mouse moves.
        // Continuous callbacks keep their first-pending order, not timestamp order;
        // discrete and queued window events seal the segment so updates cannot cross them.
        let key = (payload.event_id, payload.target_id);
        let pending = self
            .continuous
            .get_or_insert_with(|| Arc::new(Mutex::new(HashMap::new())));
        let replaced = pending
            .lock()
            .map_err(|_| {
                Error::new(
                    Status::GenericFailure,
                    "Native event queue lock was poisoned.",
                )
            })?
            .insert(key, payload)
            .is_some();
        Ok(if replaced {
            None
        } else {
            Some(EventDelivery::Continuous {
                pending: Arc::clone(pending),
                key,
            })
        })
    }

    fn enqueue(
        &mut self,
        payload: NativeEventPayload,
        send: impl FnOnce(EventDelivery) -> Status,
    ) -> Result<()> {
        if let Some(delivery) = self.schedule(payload)? {
            let status = send(delivery);
            if status != Status::Ok {
                // A rejected callback will never consume its payload. Start a new
                // segment so subsequent updates cannot be stranded behind it.
                self.continuous = None;
                return Err(Error::new(status, "Failed to enqueue native event."));
            }
        }
        Ok(())
    }

    fn schedule_window(&mut self, payload: NativeWindowEventPayload) -> EventDelivery {
        self.continuous = None;
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
        if let Err(error) = queue.enqueue(payload, |delivery| {
            self.callback
                .call(delivery, ThreadsafeFunctionCallMode::NonBlocking)
        }) {
            eprintln!("[retend-gpui] {error}");
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

    fn schedule(queue: &mut EventQueue, payload: NativeEventPayload) -> EventDelivery {
        queue.schedule(payload).unwrap().expect("new delivery")
    }

    fn event(delivery: EventDelivery) -> NativeEventPayload {
        delivery.into_payload().unwrap().event.expect("node event")
    }

    #[test]
    fn mouse_move_burst_retains_latest_payload() {
        let mut queue = EventQueue::default();
        let first = schedule(&mut queue, mouse_move_payload(1, 0.0));
        for index in 1..10_000 {
            let mut payload = mouse_move_payload(1, index as f64);
            payload.client_y = -(index as f64);
            payload.time_stamp = index as f64;
            payload.buttons = 2;
            payload.button = 2;
            payload.detail = 3;
            payload.alt_key = true;
            payload.ctrl_key = true;
            payload.meta_key = true;
            payload.shift_key = true;
            assert!(queue.schedule(payload).unwrap().is_none());
        }
        let delivered = event(first);
        assert_eq!(delivered.target_id, 1);
        assert_eq!(delivered.client_x, 9_999.0);
        assert_eq!(delivered.client_y, -9_999.0);
        assert_eq!(delivered.time_stamp, 9_999.0);
        assert_eq!(
            (delivered.button, delivered.buttons, delivered.detail),
            (2, 2, 3)
        );
        assert!(
            delivered.alt_key && delivered.ctrl_key && delivered.meta_key && delivered.shift_key
        );
    }

    #[test]
    fn interleaved_burst_is_bounded_by_event_kinds_and_targets() {
        let mut queue = EventQueue::default();
        let mut deliveries = Vec::new();
        for index in 0..10_000 {
            for target in 1..=8 {
                for payload in [
                    mouse_move_payload(target, index as f64),
                    NativeEventPayload::scroll(target, index as f64, -(index as f64)),
                ] {
                    queue
                        .enqueue(payload, |delivery| {
                            deliveries.push(delivery);
                            Status::Ok
                        })
                        .unwrap();
                }
            }
        }
        // A stalled JS consumer needs only 16 callbacks for 160,000 updates.
        assert_eq!(deliveries.len(), 16);
        assert_eq!(queue.continuous.as_ref().unwrap().lock().unwrap().len(), 16);
        for (index, delivery) in deliveries.into_iter().enumerate() {
            let delivered = event(delivery);
            assert_eq!(delivered.target_id, (index / 2 + 1) as NodeId);
            if index % 2 == 0 {
                assert_eq!(delivered.event_id, NativeEventId::MouseMove as u16);
                assert_eq!(delivered.client_x, 9_999.0);
            } else {
                assert_eq!(delivered.event_id, NativeEventId::Scroll as u16);
                assert_eq!(delivered.scroll_x, 9_999.0);
                // Absolute offsets must be replaced, never summed.
                assert_eq!(delivered.scroll_y, -9_999.0);
            }
        }
        assert!(queue
            .continuous
            .as_ref()
            .unwrap()
            .lock()
            .unwrap()
            .is_empty());
    }

    #[test]
    fn continuous_updates_do_not_cross_discrete_or_window_boundaries() {
        let mut queue = EventQueue::default();
        let mut deliveries = Vec::new();
        let mut expected = Vec::new();
        for kind in [
            NativeEventId::MouseDown,
            NativeEventId::MouseUp,
            NativeEventId::Click,
            NativeEventId::MouseEnter,
            NativeEventId::MouseLeave,
            NativeEventId::KeyDown,
            NativeEventId::KeyUp,
            NativeEventId::Input,
            NativeEventId::Change,
            NativeEventId::Focus,
            NativeEventId::Blur,
        ] {
            for index in 0..100 {
                for payload in [
                    mouse_move_payload(1, index as f64),
                    NativeEventPayload::scroll(2, 0.0, index as f64),
                ] {
                    if let Some(delivery) = queue.schedule(payload).unwrap() {
                        deliveries.push(delivery);
                    }
                }
            }
            deliveries.push(schedule(&mut queue, NativeEventPayload::new(kind, 3)));
            expected.extend([
                (NativeEventId::MouseMove as u16, 1, 99.0),
                (NativeEventId::Scroll as u16, 2, 99.0),
                (kind as u16, 3, 0.0),
            ]);
        }
        let actual: Vec<_> = deliveries
            .into_iter()
            .map(|delivery| {
                let payload = event(delivery);
                (
                    payload.event_id,
                    payload.target_id,
                    payload.client_x + payload.scroll_y,
                )
            })
            .collect();
        assert_eq!(actual, expected);

        for window in [
            NativeWindowEventPayload::resize(800.0, 600.0),
            NativeWindowEventPayload::activation(true),
            NativeWindowEventPayload::activation(false),
            NativeWindowEventPayload::reload(),
            NativeWindowEventPayload::close(),
        ] {
            let before = schedule(&mut queue, NativeEventPayload::scroll(2, 0.0, 1.0));
            let kind = window.kind.clone();
            let boundary = queue.schedule_window(window);
            let after = schedule(&mut queue, NativeEventPayload::scroll(2, 0.0, 2.0));
            assert_eq!(event(before).scroll_y, 1.0);
            assert_eq!(boundary.into_payload().unwrap().window.unwrap().kind, kind);
            assert_eq!(event(after).scroll_y, 2.0);
        }
    }

    #[test]
    fn consumed_targets_rearm_without_retaining_payloads() {
        let mut queue = EventQueue::default();
        for target in 1..=10_000 {
            let first = schedule(&mut queue, mouse_move_payload(target, 1.0));
            assert_eq!(event(first).client_x, 1.0);
            let next = schedule(&mut queue, mouse_move_payload(target, 2.0));
            assert_eq!(event(next).client_x, 2.0);
            assert!(queue
                .continuous
                .as_ref()
                .unwrap()
                .lock()
                .unwrap()
                .is_empty());
        }
    }

    #[test]
    fn rejected_callbacks_do_not_strand_future_updates_or_change_accepted_ones() {
        for status in [Status::QueueFull, Status::Closing] {
            let mut queue = EventQueue::default();
            let accepted = schedule(&mut queue, mouse_move_payload(1, 1.0));
            let result = queue.enqueue(NativeEventPayload::scroll(2, 0.0, 1.0), |_| status);
            assert_eq!(result.unwrap_err().status, status);
            let next_move = schedule(&mut queue, mouse_move_payload(1, 2.0));
            let next_scroll = schedule(&mut queue, NativeEventPayload::scroll(2, 0.0, 2.0));
            assert_eq!(event(accepted).client_x, 1.0);
            assert_eq!(event(next_move).client_x, 2.0);
            assert_eq!(event(next_scroll).scroll_y, 2.0);
        }
    }

    #[test]
    fn independent_window_queues_do_not_coalesce_each_other() {
        let mut first = EventQueue::default();
        let mut second = EventQueue::default();
        let a = schedule(&mut first, NativeEventPayload::scroll(1, 0.0, 1.0));
        let b = schedule(&mut second, NativeEventPayload::scroll(1, 0.0, 2.0));
        assert!(first
            .schedule(NativeEventPayload::scroll(1, 0.0, 3.0))
            .unwrap()
            .is_none());
        assert_eq!(event(a).scroll_y, 3.0);
        assert_eq!(event(b).scroll_y, 2.0);
    }

    #[cfg(feature = "benchmarks")]
    #[test]
    fn hardening_benchmark_event_delivery() {
        use std::time::Duration;

        const TARGETS: usize = 8;
        const ROUNDS: usize = 10_000;
        const CALLBACK_BOUND: usize = TARGETS * 2;
        const WARMUP: usize = 3;
        const SAMPLES: usize = 25;

        fn sample(rounds_per_batch: usize) -> [Duration; 3] {
            let mut queue = EventQueue::default();
            let mut deliveries = Vec::with_capacity(CALLBACK_BOUND);
            let mut consumed = Vec::with_capacity(CALLBACK_BOUND);
            let mut schedule_time = Duration::ZERO;
            let mut consume_time = Duration::ZERO;
            let mut callbacks = 0;
            for start in (0..ROUNDS).step_by(rounds_per_batch) {
                let end = (start + rounds_per_batch).min(ROUNDS);
                let started = Instant::now();
                for index in start..end {
                    for target in 1..=TARGETS as NodeId {
                        for payload in [
                            mouse_move_payload(target, index as f64),
                            NativeEventPayload::scroll(target, index as f64, -(index as f64)),
                        ] {
                            queue
                                .enqueue(payload, |delivery| {
                                    deliveries.push(delivery);
                                    Status::Ok
                                })
                                .unwrap();
                        }
                    }
                }
                schedule_time += started.elapsed();
                assert_eq!(deliveries.len(), CALLBACK_BOUND);
                callbacks += deliveries.len();
                let pending = queue.continuous.as_ref().unwrap();
                assert_eq!(pending.lock().unwrap().len(), CALLBACK_BOUND);

                let started = Instant::now();
                consumed.extend(deliveries.drain(..).map(event));
                consume_time += started.elapsed();
                assert!(pending.lock().unwrap().is_empty());
                assert_eq!(Arc::strong_count(pending), 1);
                for (index, payload) in consumed.drain(..).enumerate() {
                    assert_eq!(payload.target_id, (index / 2 + 1) as NodeId);
                    if index % 2 == 0 {
                        assert_eq!(payload.event_id, NativeEventId::MouseMove as u16);
                        assert_eq!(payload.client_x, (end - 1) as f64);
                    } else {
                        assert_eq!(payload.event_id, NativeEventId::Scroll as u16);
                        assert_eq!(payload.scroll_x, (end - 1) as f64);
                        assert_eq!(payload.scroll_y, -((end - 1) as f64));
                    }
                }
            }
            assert_eq!(
                callbacks,
                ROUNDS.div_ceil(rounds_per_batch) * CALLBACK_BOUND
            );
            let pending = Arc::downgrade(queue.continuous.as_ref().unwrap());
            drop(queue);
            assert!(pending.upgrade().is_none());
            [schedule_time, consume_time, schedule_time + consume_time]
        }

        // Batch boundaries model consumer cadence, not actual frames or elapsed
        // display time. Assertions and reporting stay outside the timed phases.
        println!(
            "RETEND_GPUI_HARDENING_SCOPE scope=event_queue no_os_events=true no_napi=true no_js=true no_contention=true no_transport_lock=true includes_payload_construction=true debug_assertions={} percentile=nearest_rank",
            cfg!(debug_assertions),
        );
        for (scenario, rounds_per_batch) in [("stalled_consumer", ROUNDS), ("per_frame", 100)] {
            let mut samples = Vec::with_capacity(SAMPLES);
            for iteration in 0..WARMUP + SAMPLES {
                let timings = sample(rounds_per_batch);
                if iteration >= WARMUP {
                    samples.push(timings);
                }
            }
            let batches = ROUNDS.div_ceil(rounds_per_batch);
            for (index, phase) in ["schedule", "consume", "schedule_and_consume"]
                .into_iter()
                .enumerate()
            {
                let mut times: Vec<_> = samples.iter().map(|timings| timings[index]).collect();
                times.sort_unstable();
                let percentile = |percent: usize| {
                    times[(SAMPLES * percent).div_ceil(100) - 1].as_secs_f64() * 1_000_000.0
                };
                println!(
                    "RETEND_GPUI_HARDENING scope=event_queue scenario={scenario} phase={phase} targets={TARGETS} input_events={} batches={batches} callbacks={} pending_callback_bound={CALLBACK_BOUND} samples={SAMPLES} warmup={WARMUP} p50_us={:.3} p95_us={:.3}",
                    ROUNDS * CALLBACK_BOUND, batches * CALLBACK_BOUND,
                    percentile(50), percentile(95),
                );
            }
        }
    }

    #[test]
    fn producer_and_consumer_race_without_losing_final_state() {
        let (sender, receiver) = std::sync::mpsc::channel::<EventDelivery>();
        let consumer = std::thread::spawn(move || {
            let mut last = [None; 2];
            for delivery in receiver {
                let payload = event(delivery);
                let index = usize::from(payload.event_id == NativeEventId::Scroll as u16);
                let value = payload.client_x + payload.scroll_y;
                if let Some(previous) = last[index] {
                    assert!(value > previous);
                }
                last[index] = Some(value);
            }
            last
        });
        let mut queue = EventQueue::default();
        for index in 0..20_000 {
            for payload in [
                mouse_move_payload(1, index as f64),
                NativeEventPayload::scroll(1, 0.0, index as f64),
            ] {
                queue
                    .enqueue(payload, |delivery| {
                        sender.send(delivery).unwrap();
                        Status::Ok
                    })
                    .unwrap();
            }
        }
        drop(sender);
        assert_eq!(consumer.join().unwrap(), [Some(19_999.0); 2]);
        assert!(queue
            .continuous
            .as_ref()
            .unwrap()
            .lock()
            .unwrap()
            .is_empty());
    }

}
