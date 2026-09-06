use std::{
    collections::HashMap,
    sync::{Arc, Mutex, OnceLock},
    time::Instant,
};

use gpui::{
    ClickEvent, KeyDownEvent, KeyUpEvent, Modifiers, MouseButton, MouseDownEvent, MouseMoveEvent,
    MouseUpEvent, NavigationDirection, Pixels, Point,
};
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
            client_x: 0.0,
            client_y: 0.0,
            button: 0,
            buttons: 0,
            detail: 0,
            alt_key: false,
            ctrl_key: false,
            meta_key: false,
            shift_key: false,
            key: String::new(),
            key_char: None,
            repeat: false,
        }
    }

    fn is_mouse_move(&self) -> bool {
        self.event_id == NativeEventId::MouseMove as u16
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

fn button_code(button: MouseButton) -> i32 {
    match button {
        MouseButton::Left => 0,
        MouseButton::Middle => 1,
        MouseButton::Right => 2,
        MouseButton::Navigate(NavigationDirection::Back) => 3,
        MouseButton::Navigate(NavigationDirection::Forward) => 4,
    }
}

fn button_mask(button: MouseButton) -> u32 {
    match button {
        MouseButton::Left => 1,
        MouseButton::Right => 2,
        MouseButton::Middle => 4,
        MouseButton::Navigate(NavigationDirection::Back) => 8,
        MouseButton::Navigate(NavigationDirection::Forward) => 16,
    }
}

pub fn mouse_down(
    event_id: NativeEventId,
    target_id: NodeId,
    event: &MouseDownEvent,
) -> NativeEventPayload {
    let mut payload = NativeEventPayload::new(event_id, target_id);
    apply_position(&mut payload, event.position);
    apply_modifiers(&mut payload, event.modifiers);
    payload.button = button_code(event.button);
    payload.buttons = button_mask(event.button);
    payload.detail = event.click_count as u32;
    payload
}

pub fn mouse_up(
    event_id: NativeEventId,
    target_id: NodeId,
    event: &MouseUpEvent,
) -> NativeEventPayload {
    let mut payload = NativeEventPayload::new(event_id, target_id);
    apply_position(&mut payload, event.position);
    apply_modifiers(&mut payload, event.modifiers);
    payload.button = button_code(event.button);
    payload.buttons = 0;
    payload.detail = event.click_count as u32;
    payload
}

pub fn mouse_move(target_id: NodeId, event: &MouseMoveEvent) -> NativeEventPayload {
    let mut payload = NativeEventPayload::new(NativeEventId::MouseMove, target_id);
    apply_position(&mut payload, event.position);
    apply_modifiers(&mut payload, event.modifiers);
    payload.button = event.pressed_button.map(button_code).unwrap_or(0);
    payload.buttons = event.pressed_button.map(button_mask).unwrap_or(0);
    payload.detail = 0;
    payload
}

pub fn click(event_id: NativeEventId, target_id: NodeId, event: &ClickEvent) -> NativeEventPayload {
    let mut payload = NativeEventPayload::new(event_id, target_id);
    apply_position(&mut payload, event.position());
    apply_modifiers(&mut payload, event.modifiers());
    payload.detail = event.click_count() as u32;
    payload.buttons = 0;
    payload.button = match event {
        ClickEvent::Mouse(event) => button_code(event.up.button),
        ClickEvent::Keyboard(_) | ClickEvent::Touch(_) => 0,
    };
    payload
}

pub fn hover(
    event_id: NativeEventId,
    target_id: NodeId,
    position: Point<Pixels>,
    modifiers: Modifiers,
) -> NativeEventPayload {
    let mut payload = NativeEventPayload::new(event_id, target_id);
    apply_position(&mut payload, position);
    apply_modifiers(&mut payload, modifiers);
    payload.button = 0;
    payload.buttons = 0;
    payload.detail = 0;
    payload
}

pub fn key_down(target_id: NodeId, event: &KeyDownEvent) -> NativeEventPayload {
    let mut payload = NativeEventPayload::new(NativeEventId::KeyDown, target_id);
    apply_modifiers(&mut payload, event.keystroke.modifiers);
    payload.key = event.keystroke.key.clone();
    payload.key_char = event.keystroke.key_char.clone();
    payload.repeat = event.is_held;
    payload
}

pub fn key_up(target_id: NodeId, event: &KeyUpEvent) -> NativeEventPayload {
    let mut payload = NativeEventPayload::new(NativeEventId::KeyUp, target_id);
    apply_modifiers(&mut payload, event.keystroke.modifiers);
    payload.key = event.keystroke.key.clone();
    payload.key_char = event.keystroke.key_char.clone();
    payload.repeat = false;
    payload
}

struct MoveSlotState {
    payload: Option<NativeEventPayload>,
    queued: bool,
}

struct MoveSlot {
    state: Mutex<MoveSlotState>,
}

impl MoveSlot {
    fn new() -> Self {
        Self {
            state: Mutex::new(MoveSlotState {
                payload: None,
                queued: false,
            }),
        }
    }

    fn replace_and_mark_queued(&self, payload: NativeEventPayload) -> bool {
        let Ok(mut state) = self.state.lock() else {
            return false;
        };
        state.payload = Some(payload);
        if state.queued {
            return false;
        }
        state.queued = true;
        true
    }

    fn take_for_delivery(&self) -> Result<NativeEventPayload> {
        let mut state = self.state.lock().map_err(|_| {
            Error::new(
                Status::GenericFailure,
                "Native mouse-move queue lock was poisoned.",
            )
        })?;
        let payload = state.payload.take().ok_or_else(|| {
            Error::new(
                Status::GenericFailure,
                "Native mouse-move delivery was scheduled without a payload.",
            )
        })?;
        state.queued = false;
        Ok(payload)
    }
}

enum EventDelivery {
    Discrete(NativeEventPayload),
    MouseMove(Arc<MoveSlot>),
}

type EventCallback = ThreadsafeFunction<EventDelivery, (), NativeEventPayload, Status, false>;

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
}

struct EventTransport {
    callback: Arc<EventCallback>,
    queue: Mutex<EventQueue>,
}

impl EventTransport {
    fn new(callback: Function<'_, NativeEventPayload, ()>) -> Result<Self> {
        let callback = callback
            .build_threadsafe_function::<EventDelivery>()
            .build_callback(|context| {
                let payload = match context.value {
                    EventDelivery::Discrete(payload) => payload,
                    EventDelivery::MouseMove(slot) => slot.take_for_delivery()?,
                };
                Ok(payload)
            })?;
        Ok(Self {
            callback: Arc::new(callback),
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
}

static TRANSPORTS: OnceLock<Mutex<HashMap<WindowId, Arc<EventTransport>>>> = OnceLock::new();

fn transports() -> &'static Mutex<HashMap<WindowId, Arc<EventTransport>>> {
    TRANSPORTS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn register(window_id: WindowId, callback: Function<'_, NativeEventPayload, ()>) -> Result<()> {
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
    Ok(())
}

pub fn unregister(window_id: WindowId) {
    if let Ok(mut transports) = transports().lock() {
        transports.remove(&window_id);
    }
}

pub fn emit(window_id: WindowId, payload: NativeEventPayload) {
    let transport = transports()
        .lock()
        .ok()
        .and_then(|transports| transports.get(&window_id).cloned());
    if let Some(transport) = transport {
        transport.emit(payload);
    }
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
