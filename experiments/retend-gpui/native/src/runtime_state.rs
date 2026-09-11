use std::{
    cell::RefCell,
    collections::{HashMap, HashSet, VecDeque},
    rc::{Rc, Weak},
    sync::{Arc, Mutex},
};

use gpui::{
    point, px, App, AppContext, Bounds, Context, Entity, EntityInputHandler, FocusHandle,
    Focusable, Pixels, Point, ScrollHandle, Subscription, Window,
};
use gpui_base::input::{InputBaseState, InputEvent, InputModeKind, InputState, TextareaState};

use crate::{
    events,
    protocol_generated::NativeEventId,
    style::OverflowValue,
    tree::{NativeTree, NodeId, TextControlKind, WindowId},
    BridgeFailure, NativeMeasurement, NativeScrollOffset, NativeSelection,
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
    text_control: HashMap<NodeId, TextControlRuntimeState>,
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

pub struct TextControlConfig<'a> {
    pub kind: TextControlKind,
    pub value: &'a str,
    pub value_revision: u64,
    pub min_rows: Option<u32>,
    pub max_rows: Option<u32>,
}

#[derive(Clone)]
pub enum TextControlEditor {
    Input(Entity<InputState>),
    Textarea(Entity<TextareaState>),
}

impl TextControlEditor {
    pub fn focus_handle<T: 'static>(&self, cx: &mut Context<T>) -> FocusHandle {
        match self {
            Self::Input(editor) => editor.read(cx).focus_handle(cx),
            Self::Textarea(editor) => editor.read(cx).focus_handle(cx),
        }
    }

    pub fn set_selection(&self, start: u32, end: u32, cx: &mut App) {
        match self {
            Self::Input(editor) => set_editor_selection(editor, start, end, cx),
            Self::Textarea(editor) => set_editor_selection(editor, start, end, cx),
        }
    }

    pub fn select_all(&self, window: &mut Window, cx: &mut App) {
        match self {
            Self::Input(editor) => editor.update(cx, |editor, cx| editor.select_all(window, cx)),
            Self::Textarea(editor) => editor.update(cx, |editor, cx| editor.select_all(window, cx)),
        }
    }

    pub fn selection(
        &self,
        window: &mut Window,
        cx: &mut App,
    ) -> Result<NativeSelection, BridgeFailure> {
        match self {
            Self::Input(editor) => editor_selection(editor, window, cx),
            Self::Textarea(editor) => editor_selection(editor, window, cx),
        }
    }
}

struct TextControlRuntimeState {
    editor: TextControlEditor,
    value_revision: u64,
    min_rows: Option<u32>,
    max_rows: Option<u32>,
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

    pub fn ensure_text_control<T: 'static>(
        &self,
        window_id: WindowId,
        id: NodeId,
        config: TextControlConfig<'_>,
        window: &mut Window,
        cx: &mut Context<T>,
    ) -> TextControlEditor {
        let TextControlConfig {
            kind,
            value,
            value_revision,
            min_rows,
            max_rows,
        } = config;
        let existing = self
            .0
            .borrow_mut()
            .text_control
            .get_mut(&id)
            .map(|control| {
                let revision_changed = control.value_revision != value_revision;
                let rows_changed = control.min_rows != min_rows || control.max_rows != max_rows;
                control.value_revision = value_revision;
                control.min_rows = min_rows;
                control.max_rows = max_rows;
                (control.editor.clone(), revision_changed, rows_changed)
            });
        if let Some((editor, revision_changed, rows_changed)) = existing {
            if rows_changed {
                if let TextControlEditor::Textarea(editor) = &editor {
                    editor.update(cx, |editor, cx| {
                        configure_textarea(editor, min_rows, max_rows, cx)
                    });
                }
            }
            if revision_changed {
                let value = text_control_value(kind, value);
                let current = match &editor {
                    TextControlEditor::Input(editor) => editor.read(cx).value().to_string(),
                    TextControlEditor::Textarea(editor) => editor.read(cx).value().to_string(),
                };
                if current != value {
                    match &editor {
                        TextControlEditor::Input(editor) => editor
                            .update(cx, |editor, cx| editor.set_value(value.clone(), window, cx)),
                        TextControlEditor::Textarea(editor) => editor
                            .update(cx, |editor, cx| editor.set_value(value.clone(), window, cx)),
                    }
                    if let Some(control) = self.0.borrow_mut().text_control.get_mut(&id) {
                        control.last_value = value;
                        control.dirty = false;
                    }
                }
            }
            return editor;
        }

        let value = text_control_value(kind, value);
        let runtime = Rc::downgrade(&self.0);
        let (editor, events) = match kind {
            TextControlKind::Input => {
                let editor = cx.new(|cx| {
                    let mut editor = InputState::new(window, cx);
                    editor.set_value(value.clone(), window, cx);
                    editor
                });
                let events = subscribe_text_control_events(
                    cx,
                    &editor,
                    window,
                    runtime,
                    kind,
                    window_id,
                    id,
                );
                (TextControlEditor::Input(editor), events)
            }
            TextControlKind::Textarea => {
                let editor = cx.new(|cx| {
                    let mut editor = TextareaState::new(window, cx);
                    configure_textarea(&mut editor, min_rows, max_rows, cx);
                    editor.set_value(value.clone(), window, cx);
                    editor
                });
                let events = subscribe_text_control_events(
                    cx,
                    &editor,
                    window,
                    runtime,
                    kind,
                    window_id,
                    id,
                );
                (TextControlEditor::Textarea(editor), events)
            }
        };
        self.0.borrow_mut().text_control.insert(
            id,
            TextControlRuntimeState {
                editor: editor.clone(),
                value_revision,
                min_rows,
                max_rows,
                last_value: value,
                dirty: false,
                _events: events,
            },
        );
        editor
    }

    pub fn text_control(&self, id: NodeId) -> Option<TextControlEditor> {
        self.0
            .borrow()
            .text_control
            .get(&id)
            .map(|control| control.editor.clone())
    }

    pub fn input(&self, id: NodeId) -> Option<Entity<InputState>> {
        match self.text_control(id)? {
            TextControlEditor::Input(editor) => Some(editor),
            TextControlEditor::Textarea(_) => None,
        }
    }

    pub fn textarea(&self, id: NodeId) -> Option<Entity<TextareaState>> {
        match self.text_control(id)? {
            TextControlEditor::Textarea(editor) => Some(editor),
            TextControlEditor::Input(_) => None,
        }
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
                state.text_control.remove(id);
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
        state.text_control.clear();
        state.scroll.clear();
        state.pending.clear();
        state.frame = FrameLayout::default();
    }
}

fn utf16_to_utf8_offset(value: &str, target: usize) -> usize {
    let mut utf16 = 0;
    for (byte, character) in value.char_indices() {
        let next = utf16 + character.len_utf16();
        if target < next {
            return byte;
        }
        if target == next {
            return byte + character.len_utf8();
        }
        utf16 = next;
    }
    value.len()
}

fn set_editor_selection<M: InputModeKind + 'static>(
    editor: &Entity<InputBaseState<M>>,
    start: u32,
    end: u32,
    cx: &mut App,
) {
    editor.update(cx, |editor, cx| {
        let start = start.min(end) as usize;
        let end = end as usize;
        let value = editor.value();
        editor.set_selected_range(
            utf16_to_utf8_offset(value.as_ref(), start)..utf16_to_utf8_offset(value.as_ref(), end),
            cx,
        );
    });
}

fn editor_selection<M: InputModeKind + 'static>(
    editor: &Entity<InputBaseState<M>>,
    window: &mut Window,
    cx: &mut App,
) -> Result<NativeSelection, BridgeFailure> {
    editor.update(cx, |editor, cx| {
        let selection = editor
            .selected_text_range(false, window, cx)
            .ok_or_else(|| {
                BridgeFailure::new(
                    "SELECTION_UNAVAILABLE",
                    "Native text-control selection is unavailable.",
                )
            })?;
        Ok(NativeSelection {
            start: u32::try_from(selection.range.start).map_err(|_| {
                BridgeFailure::new(
                    "SELECTION_RANGE_EXHAUSTED",
                    "Native text-control selection exceeds the bridge UTF-16 offset range.",
                )
            })?,
            end: u32::try_from(selection.range.end).map_err(|_| {
                BridgeFailure::new(
                    "SELECTION_RANGE_EXHAUSTED",
                    "Native text-control selection exceeds the bridge UTF-16 offset range.",
                )
            })?,
        })
    })
}

fn subscribe_text_control_events<T: 'static, M: InputModeKind + 'static>(
    cx: &mut Context<T>,
    editor: &Entity<InputBaseState<M>>,
    window: &mut Window,
    runtime: Weak<RefCell<RuntimeState>>,
    kind: TextControlKind,
    window_id: WindowId,
    id: NodeId,
) -> Subscription {
    cx.subscribe_in(editor, window, move |_, editor, event, _, cx| match event {
        InputEvent::Change => handle_text_control_change(
            &runtime,
            window_id,
            id,
            editor.read(cx).value().to_string(),
        ),
        _ => handle_text_control_commit(&runtime, kind, window_id, id, event),
    })
}

fn handle_text_control_change(
    runtime: &Weak<RefCell<RuntimeState>>,
    window_id: WindowId,
    id: NodeId,
    value: String,
) {
    let Some(runtime) = runtime.upgrade() else {
        return;
    };
    let mut state = runtime.borrow_mut();
    let Some(control) = state.text_control.get_mut(&id) else {
        return;
    };
    if control.last_value == value {
        return;
    }
    control.last_value = value.clone();
    control.dirty = true;
    drop(state);
    emit_text_event(window_id, id, NativeEventId::Input, value);
}

fn handle_text_control_commit(
    runtime: &Weak<RefCell<RuntimeState>>,
    kind: TextControlKind,
    window_id: WindowId,
    id: NodeId,
    event: &InputEvent,
) {
    let Some(runtime) = runtime.upgrade() else {
        return;
    };
    let mut state = runtime.borrow_mut();
    let Some(control) = state.text_control.get_mut(&id) else {
        return;
    };
    let commit = match event {
        InputEvent::PressEnter { .. } if kind == TextControlKind::Input => &mut control.dirty,
        InputEvent::Blur => &mut control.dirty,
        _ => return,
    };
    if !std::mem::take(commit) {
        return;
    }
    let value = control.last_value.clone();
    drop(state);
    emit_text_event(window_id, id, NativeEventId::Change, value);
}

fn configure_textarea(
    editor: &mut TextareaState,
    min_rows: Option<u32>,
    max_rows: Option<u32>,
    cx: &mut Context<TextareaState>,
) {
    let (min_rows, max_rows) = match (min_rows, max_rows) {
        (None, None) => (2, 2),
        (min_rows, max_rows) => (min_rows.unwrap_or(1), max_rows.unwrap_or(u32::MAX)),
    };
    editor.set_auto_grow(min_rows as usize, max_rows as usize, cx);
}

fn text_control_value(kind: TextControlKind, value: &str) -> String {
    match kind {
        TextControlKind::Input => single_line(value),
        TextControlKind::Textarea => value.to_owned(),
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
