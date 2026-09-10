use std::{
    cell::RefCell,
    collections::{HashMap, HashSet, VecDeque},
    rc::Rc,
    sync::{Arc, Mutex},
};

use gpui::{
    point, px, App, AppContext, Bounds, Context, Entity, FocusHandle, Pixels, Point, ScrollHandle,
    Subscription, Window,
};
use gpui_base::input::{InputEvent, InputState};

use crate::{
    events,
    protocol_generated::NativeEventId,
    style::OverflowValue,
    tree::{NativeTree, NodeId, WindowId},
    BridgeFailure, NativeMeasurement, NativeScrollOffset,
};

pub type Measurement = NativeMeasurement;

type QueryCallback<T> = Box<dyn FnOnce(Result<T, BridgeFailure>) + Send>;

#[derive(Clone)]
pub struct QueryResponder<T>(Arc<Mutex<Option<QueryCallback<T>>>>);

impl<T> QueryResponder<T> {
    pub fn new(callback: impl FnOnce(Result<T, BridgeFailure>) + Send + 'static) -> Self {
        Self(Arc::new(Mutex::new(Some(Box::new(callback)))))
    }

    pub fn respond(&self, result: Result<T, BridgeFailure>) {
        let callback = self.0.lock().ok().and_then(|mut slot| slot.take());
        if let Some(callback) = callback {
            callback(result);
        }
    }
}

pub type MeasureResponder = QueryResponder<Measurement>;

pub type ScrollOffset = NativeScrollOffset;
pub type ScrollResponder = QueryResponder<ScrollOffset>;

#[derive(Clone, Default)]
pub struct RuntimeStateRegistry(Rc<RefCell<RuntimeState>>);

#[derive(Default)]
struct RuntimeState {
    focus: HashMap<NodeId, FocusState>,
    input: HashMap<NodeId, InputRuntimeState>,
    scroll: HashMap<NodeId, ScrollState>,
    generation: u64,
    frame: FrameLayout,
    pending: VecDeque<(u64, LayoutOperation)>,
}

struct FocusState {
    handle: FocusHandle,
    subscriptions: Option<[Subscription; 2]>,
    enabled: bool,
}

struct InputRuntimeState {
    editor: Entity<InputState>,
    value_revision: u64,
    last_value: String,
    dirty: bool,
    _events: Subscription,
}

struct ScrollState {
    handle: ScrollHandle,
    last_event_offset: ScrollOffset,
}

#[derive(Default)]
struct FrameLayout {
    window_id: Option<WindowId>,
    nodes: HashMap<NodeId, FrameNode>,
}

#[derive(Default)]
struct FrameNode {
    parent: Option<NodeId>,
    children: Vec<NodeId>,
    bounds: Option<Bounds<Pixels>>,
    // Parent-owned child bottom-right, relative to its box before its own scroll.
    content_extent: Option<Point<Pixels>>,
}

#[derive(Clone)]
pub enum LayoutOperation {
    Measure(NodeId, MeasureResponder),
    ScrollOffset(NodeId, OverflowValue, ScrollResponder),
    Scroll(NodeId, OverflowValue, f32, f32, bool),
    ScrollIntoView(NodeId),
}

enum QueryCompletion {
    Measure(MeasureResponder, Measurement),
    ScrollOffset(ScrollResponder, ScrollOffset),
}

impl LayoutOperation {
    fn id(&self) -> NodeId {
        match self {
            Self::Measure(id, _)
            | Self::ScrollOffset(id, ..)
            | Self::Scroll(id, ..)
            | Self::ScrollIntoView(id) => *id,
        }
    }

    pub(crate) fn reject(self, failure: BridgeFailure) {
        match self {
            Self::Measure(_, responder) => responder.respond(Err(failure)),
            Self::ScrollOffset(_, _, responder) => responder.respond(Err(failure)),
            _ => {}
        }
    }
}

impl QueryCompletion {
    fn respond(self) {
        match self {
            Self::Measure(responder, measurement) => responder.respond(Ok(measurement)),
            Self::ScrollOffset(responder, offset) => responder.respond(Ok(offset)),
        }
    }
}

#[cfg(test)]
thread_local! {
    static TEST_TEXT_EVENTS: RefCell<Vec<(WindowId, NodeId, NativeEventId, String)>> =
        const { RefCell::new(Vec::new()) };
}

fn emit_text_event(window_id: WindowId, id: NodeId, event: NativeEventId, value: String) {
    #[cfg(test)]
    TEST_TEXT_EVENTS.with(|events| events.borrow_mut().push((window_id, id, event, value.clone())));
    if crate::runtime()
        .lock()
        .is_ok_and(|tree| tree.has_subscription_in_path(window_id, id, event))
    {
        events::emit(window_id, events::NativeEventPayload::text(event, id, value));
    }
}

#[cfg(test)]
pub(crate) fn take_test_text_events() -> Vec<(WindowId, NodeId, NativeEventId, String)> {
    TEST_TEXT_EVENTS.with(|events| std::mem::take(&mut *events.borrow_mut()))
}

impl RuntimeStateRegistry {
    pub fn is_interactive(&self, id: NodeId) -> bool {
        let state = self.0.borrow();
        state.focus.get(&id).is_some_and(|focus| focus.enabled) || state.scroll.contains_key(&id)
    }

    pub fn ensure_focus(
        &self,
        id: NodeId,
        tab_index: isize,
        handle: Option<FocusHandle>,
        cx: &mut App,
    ) -> (FocusHandle, bool) {
        let mut state = self.0.borrow_mut();
        let focus = state.focus.entry(id).or_insert_with(|| FocusState {
            handle: handle.clone().unwrap_or_else(|| cx.focus_handle()),
            subscriptions: None,
            enabled: true,
        });
        if let Some(handle) = handle {
            if focus.handle != handle {
                focus.handle = handle;
                focus.subscriptions = None;
            }
        }
        focus.handle = focus
            .handle
            .clone()
            .tab_index(tab_index)
            .tab_stop(tab_index >= 0);
        focus.enabled = true;
        (focus.handle.clone(), focus.subscriptions.is_none())
    }

    pub fn set_focus_subscriptions(&self, id: NodeId, subscriptions: [Subscription; 2]) {
        if let Some(focus) = self.0.borrow_mut().focus.get_mut(&id) {
            focus.subscriptions = Some(subscriptions);
        }
    }

    pub fn disable_focus(&self, id: NodeId) {
        if let Some(focus) = self.0.borrow_mut().focus.get_mut(&id) {
            focus.enabled = false;
            focus.handle = focus.handle.clone().tab_stop(false);
        }
    }

    pub fn focus_handle(&self, id: NodeId) -> Option<FocusHandle> {
        self.0
            .borrow()
            .focus
            .get(&id)
            .map(|focus| focus.handle.clone())
    }

    pub fn tracked_focus_handle(&self, id: NodeId) -> Option<FocusHandle> {
        self.0
            .borrow()
            .focus
            .get(&id)
            .filter(|focus| focus.enabled)
            .map(|focus| focus.handle.clone())
    }

    pub fn ensure_input<T: 'static>(
        &self,
        window_id: WindowId,
        id: NodeId,
        value: &str,
        value_revision: u64,
        window: &mut Window,
        cx: &mut Context<T>,
    ) -> Entity<InputState> {
        let existing = self.0.borrow_mut().input.get_mut(&id).map(|input| {
            let revision_changed = input.value_revision != value_revision;
            input.value_revision = value_revision;
            (input.editor.clone(), revision_changed)
        });
        if let Some((editor, revision_changed)) = existing {
            if revision_changed {
                let value = single_line(value);
                if editor.read(cx).value().as_ref() != value.as_str() {
                    editor.update(cx, |editor, cx| editor.set_value(value.clone(), window, cx));
                    if let Some(input) = self.0.borrow_mut().input.get_mut(&id) {
                        input.last_value = value;
                        input.dirty = false;
                    }
                }
            }
            return editor;
        }

        let value = single_line(value);
        let editor = cx.new(|cx| {
            let mut editor = InputState::new(window, cx);
            editor.set_value(value.clone(), window, cx);
            editor
        });
        let runtime = Rc::downgrade(&self.0);
        let events = cx.subscribe_in(&editor, window, move |_, editor, event, _, cx| {
            let Some(runtime) = runtime.upgrade() else {
                return;
            };
            let mut state = runtime.borrow_mut();
            let Some(input) = state.input.get_mut(&id) else {
                return;
            };
            let event = match event {
                InputEvent::Change => {
                    let value = editor.read(cx).value().to_string();
                    if input.last_value == value {
                        return;
                    }
                    input.last_value = value;
                    input.dirty = true;
                    NativeEventId::Input
                }
                InputEvent::PressEnter { .. } | InputEvent::Blur
                    if std::mem::take(&mut input.dirty) =>
                {
                    NativeEventId::Change
                }
                _ => return,
            };
            let value = input.last_value.clone();
            drop(state);
            emit_text_event(window_id, id, event, value);
        });
        self.0.borrow_mut().input.insert(
            id,
            InputRuntimeState {
                editor: editor.clone(),
                value_revision,
                last_value: value,
                dirty: false,
                _events: events,
            },
        );
        editor
    }

    pub fn input(&self, id: NodeId) -> Option<Entity<InputState>> {
        self.0
            .borrow()
            .input
            .get(&id)
            .map(|input| input.editor.clone())
    }

    pub fn ensure_scroll(&self, id: NodeId) -> ScrollHandle {
        let mut state = self.0.borrow_mut();
        let scroll = state.scroll.entry(id).or_insert_with(|| ScrollState {
            handle: ScrollHandle::new(),
            last_event_offset: ScrollOffset::default(),
        });
        scroll.handle.clone()
    }

    pub fn sync_scroll(
        &self,
        id: NodeId,
        overflow: crate::style::OverflowValue,
    ) -> Option<ScrollHandle> {
        if overflow.is_scroll_container() {
            return Some(self.ensure_scroll(id));
        }
        self.0.borrow_mut().scroll.remove(&id);
        None
    }

    pub fn scroll_handle(&self, id: NodeId) -> Option<ScrollHandle> {
        self.0
            .borrow()
            .scroll
            .get(&id)
            .map(|scroll| scroll.handle.clone())
    }

    pub fn begin_frame(&self, tree: &NativeTree, window_id: WindowId) -> u64 {
        let mut state = self.0.borrow_mut();
        state.generation = state.generation.saturating_add(1);
        let generation = state.generation;
        state.frame.window_id = Some(window_id);
        state.frame.nodes.clear();
        state.frame.nodes.extend(
            tree.nodes
                .iter()
                .filter(|(_, node)| node.window_id == window_id)
                .map(|(&id, node)| {
                    (
                        id,
                        FrameNode {
                            parent: node.parent,
                            children: node.children.clone(),
                            ..FrameNode::default()
                        },
                    )
                }),
        );
        generation
    }

    pub fn record_bounds(&self, generation: u64, id: NodeId, bounds: Bounds<Pixels>) {
        let mut state = self.0.borrow_mut();
        if state.generation == generation {
            if let Some(node) = state.frame.nodes.get_mut(&id) {
                node.bounds = Some(bounds);
            }
        }
    }

    pub fn record_content_extent(&self, generation: u64, id: NodeId, extent: Point<Pixels>) {
        let mut state = self.0.borrow_mut();
        if state.generation == generation {
            if let Some(node) = state.frame.nodes.get_mut(&id) {
                node.content_extent = Some(extent);
            }
        }
    }

    pub fn enqueue_layout(&self, operation: LayoutOperation) {
        match &operation {
            LayoutOperation::Scroll(id, overflow, ..)
            | LayoutOperation::ScrollOffset(id, overflow, ..) => {
                self.sync_scroll(*id, *overflow);
            }
            _ => {}
        }
        self.enqueue(operation);
    }

    fn enqueue(&self, operation: LayoutOperation) {
        let mut state = self.0.borrow_mut();
        let generation = state.generation.saturating_add(1);
        state.pending.push_back((generation, operation));
    }

    pub fn finish_frame(&self, generation: u64) -> bool {
        let (completions, changed_scrolls, window_id, rerender) = {
            let mut state = self.0.borrow_mut();
            if state.generation != generation {
                return false;
            }

            let mut completions = Vec::new();
            let mut rerender = false;
            // FIFO order makes each query observe exactly the preceding scrolls.
            while state
                .pending
                .front()
                .is_some_and(|(minimum, _)| *minimum <= generation)
            {
                let (_, operation) = state
                    .pending
                    .pop_front()
                    .expect("front operation must exist");
                match operation {
                    LayoutOperation::Measure(id, responder) => {
                        completions.push(QueryCompletion::Measure(responder, measure(&state, id)));
                    }
                    LayoutOperation::ScrollOffset(id, _, responder) => {
                        completions.push(QueryCompletion::ScrollOffset(
                            responder,
                            scroll_offset(&state, id),
                        ));
                    }
                    LayoutOperation::Scroll(id, _, x, y, relative) => {
                        rerender |= scroll_offset_command(&mut state, id, x, y, relative);
                    }
                    LayoutOperation::ScrollIntoView(id) => {
                        rerender |= scroll_into_view(&mut state, id)
                    }
                }
            }
            rerender |= !state.pending.is_empty();

            let mut changed_scrolls = Vec::new();
            for (&id, scroll) in &mut state.scroll {
                let offset = logical_scroll_offset(&scroll.handle);
                if offset != scroll.last_event_offset {
                    scroll.last_event_offset = offset;
                    changed_scrolls.push((id, offset));
                }
            }
            (
                completions,
                changed_scrolls,
                state.frame.window_id,
                rerender,
            )
        };

        for completion in completions {
            completion.respond();
        }
        if let Some(window_id) = window_id {
            for (id, offset) in changed_scrolls {
                if crate::runtime().lock().is_ok_and(|tree| {
                    tree.has_subscription_in_path(window_id, id, NativeEventId::Scroll)
                }) {
                    events::emit(
                        window_id,
                        events::NativeEventPayload::scroll(id, offset.x, offset.y),
                    );
                }
            }
        }
        rerender
    }

    pub fn destroy_nodes(&self, ids: &[NodeId]) {
        let ids: HashSet<_> = ids.iter().copied().collect();
        let rejected = {
            let mut state = self.0.borrow_mut();
            for id in &ids {
                state.focus.remove(id);
                state.input.remove(id);
                state.scroll.remove(id);
                state.frame.nodes.remove(id);
            }
            let pending = std::mem::take(&mut state.pending);
            let (rejected, retained): (VecDeque<_>, VecDeque<_>) = pending
                .into_iter()
                .partition(|(_, operation)| ids.contains(&operation.id()));
            state.pending = retained;
            rejected
        };

        for (_, operation) in rejected {
            let id = operation.id();
            operation.reject(BridgeFailure::destroyed_node(id));
        }
    }

    pub fn reject_queries(&self, code: &'static str, message: impl Into<String>) {
        let message = message.into();
        let queries = {
            let mut state = self.0.borrow_mut();
            let (queries, scrolls) = std::mem::take(&mut state.pending)
                .into_iter()
                .partition::<VecDeque<_>, _>(|(_, operation)| {
                    matches!(
                        operation,
                        LayoutOperation::Measure(..) | LayoutOperation::ScrollOffset(..)
                    )
                });
            state.pending = scrolls;
            queries
        };
        for (_, operation) in queries {
            operation.reject(BridgeFailure::new(code, message.clone()));
        }
    }

    pub fn clear(&self) {
        self.reject_queries(
            "POISONED_RENDERER",
            "Renderer state changed before the native query completed.",
        );
        let mut state = self.0.borrow_mut();
        state.focus.clear();
        state.input.clear();
        state.scroll.clear();
        state.pending.clear();
        state.frame = FrameLayout::default();
    }
}

fn single_line(value: &str) -> String {
    value
        .chars()
        .filter(|character| !matches!(character, '\r' | '\n'))
        .collect()
}

fn scroll_offset_command(
    state: &mut RuntimeState,
    id: NodeId,
    x: f32,
    y: f32,
    relative: bool,
) -> bool {
    let Some(handle) = state.scroll.get(&id).map(|scroll| scroll.handle.clone()) else {
        return false;
    };
    let old = logical_scroll_offset(&handle);
    let (x, y) = if relative {
        (old.x as f32 + x, old.y as f32 + y)
    } else {
        (x, y)
    };
    let new = set_logical_scroll_offset(&handle, x, y);
    shift_descendant_bounds(
        state,
        id,
        new.x as f32 - old.x as f32,
        new.y as f32 - old.y as f32,
    );
    new != old
}

fn shift_descendant_bounds(state: &mut RuntimeState, ancestor: NodeId, dx: f32, dy: f32) {
    if dx == 0.0 && dy == 0.0 {
        return;
    }
    for id in descendant_ids(&state.frame, ancestor) {
        if let Some(bounds) = state
            .frame
            .nodes
            .get_mut(&id)
            .and_then(|node| node.bounds.as_mut())
        {
            bounds.origin.x = px(f32::from(bounds.origin.x) - dx);
            bounds.origin.y = px(f32::from(bounds.origin.y) - dy);
        }
    }
}

fn scroll_into_view(state: &mut RuntimeState, id: NodeId) -> bool {
    if state
        .frame
        .nodes
        .get(&id)
        .and_then(|node| node.bounds)
        .is_none()
    {
        return false;
    }
    let mut current = state.frame.nodes.get(&id).and_then(|node| node.parent);
    let mut changed = false;
    while let Some(parent) = current {
        current = state.frame.nodes.get(&parent).and_then(|node| node.parent);
        let Some(viewport) = state.frame.nodes.get(&parent).and_then(|node| node.bounds) else {
            continue;
        };
        let target = state.frame.nodes[&id]
            .bounds
            .expect("validated target bounds must remain available");
        let dx = nearest_scroll_delta(
            f32::from(target.left()),
            f32::from(target.right()),
            f32::from(viewport.left()),
            f32::from(viewport.right()),
        );
        let dy = nearest_scroll_delta(
            f32::from(target.top()),
            f32::from(target.bottom()),
            f32::from(viewport.top()),
            f32::from(viewport.bottom()),
        );
        changed |= scroll_offset_command(state, parent, dx, dy, true);
    }
    changed
}

fn nearest_scroll_delta(start: f32, end: f32, viewport_start: f32, viewport_end: f32) -> f32 {
    if end - start > viewport_end - viewport_start || start < viewport_start {
        start - viewport_start
    } else if end > viewport_end {
        end - viewport_end
    } else {
        0.0
    }
}

fn set_logical_scroll_offset(handle: &ScrollHandle, x: f32, y: f32) -> ScrollOffset {
    let maximum = handle.max_offset();
    let x = x.clamp(0.0, f32::from(maximum.x));
    let y = y.clamp(0.0, f32::from(maximum.y));
    handle.set_offset(point(px(-x), px(-y)));
    ScrollOffset {
        x: f64::from(x),
        y: f64::from(y),
    }
}

fn measure(state: &RuntimeState, id: NodeId) -> Measurement {
    let frame = &state.frame;
    let Some(target) = frame.nodes.get(&id).and_then(|node| node.bounds) else {
        return Measurement::default();
    };

    let x = f32::from(target.origin.x);
    let y = f32::from(target.origin.y);
    let width = f32::from(target.size.width);
    let height = f32::from(target.size.height);
    let (scroll_width, scroll_height) = if let Some(scroll) = state.scroll.get(&id) {
        let maximum = scroll.handle.max_offset();
        (width + f32::from(maximum.x), height + f32::from(maximum.y))
    } else {
        let mut right = x + width;
        let mut bottom = y + height;
        for candidate_id in std::iter::once(id).chain(descendant_ids(frame, id)) {
            let Some(node) = frame.nodes.get(&candidate_id) else {
                continue;
            };
            let Some(bounds) = node.bounds else {
                continue;
            };
            right = right.max(f32::from(bounds.right()));
            bottom = bottom.max(f32::from(bounds.bottom()));
            if let Some(extent) = node.content_extent {
                // Commands between query barriers can change this offset after paint.
                // Ancestor scrolling already shifts the recorded parent origin.
                let offset = state
                    .scroll
                    .get(&candidate_id)
                    .map(|scroll| scroll.handle.offset())
                    .unwrap_or_default();
                let bottom_right = bounds.origin + extent + offset;
                right = right.max(f32::from(bottom_right.x));
                bottom = bottom.max(f32::from(bottom_right.y));
            }
        }
        ((right - x).max(width), (bottom - y).max(height))
    };

    Measurement {
        x: f64::from(x),
        y: f64::from(y),
        width: f64::from(width),
        height: f64::from(height),
        scroll_width: f64::from(scroll_width),
        scroll_height: f64::from(scroll_height),
    }
}

fn scroll_offset(state: &RuntimeState, id: NodeId) -> ScrollOffset {
    state
        .scroll
        .get(&id)
        .map(|scroll| logical_scroll_offset(&scroll.handle))
        .unwrap_or_default()
}

fn logical_scroll_offset(handle: &ScrollHandle) -> ScrollOffset {
    let offset: Point<Pixels> = handle.offset();
    ScrollOffset {
        x: f64::from((-f32::from(offset.x)).max(0.0)),
        y: f64::from((-f32::from(offset.y)).max(0.0)),
    }
}

fn descendant_ids(frame: &FrameLayout, ancestor: NodeId) -> Vec<NodeId> {
    let mut pending = frame
        .nodes
        .get(&ancestor)
        .map(|node| node.children.clone())
        .unwrap_or_default();
    let mut descendants = Vec::with_capacity(pending.len());
    while let Some(id) = pending.pop() {
        let Some(node) = frame.nodes.get(&id) else {
            continue;
        };
        pending.extend(node.children.iter().copied());
        descendants.push(id);
    }
    descendants
}
