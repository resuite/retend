use std::{cell::Cell, rc::Rc, sync::Arc};

use gpui::{
    actions, anchored, deferred, div, img, prelude::*, px, relative, Anchor, AnyElement, App,
    Bounds, ClickEvent, Element, ElementId, GlobalElementId, ImageCacheError, ImageSource,
    InspectorElementId, KeyBinding, KeyDownEvent, KeyUpEvent, LayoutId, MouseButton,
    MouseDownEvent, MouseMoveEvent, MouseUpEvent, NavigationDirection, Pixels, Point, Resource,
    Role, StyledImage, Text, Window,
};

use crate::{
    events,
    protocol_generated::NativeEventId,
    runtime_state::RuntimeStateRegistry,
    style::OverflowValue,
    tree::{
        event_bit, AnchoredAlign, AnchoredConfig, AnchoredFit, AnchoredSide, ImageLocation,
        ImageObjectFit, NativeTree, NodeData, NodeId, WindowId,
    },
};

actions!(retend, [FocusNext, FocusPrevious]);

pub(crate) fn init(cx: &mut App) {
    gpui_base::init(cx);
    cx.bind_keys([
        KeyBinding::new("tab", FocusNext, None),
        KeyBinding::new("shift-tab", FocusPrevious, None),
        KeyBinding::new("tab", FocusNext, Some("Input")),
        KeyBinding::new("shift-tab", FocusPrevious, Some("Input")),
    ]);
    cx.on_action::<FocusNext>(|_, cx| {
        if let Some(window) = cx.active_window() {
            cx.defer(move |cx| {
                _ = window.update(cx, |_, window, cx| window.focus_next(cx));
            });
        }
    });
    cx.on_action::<FocusPrevious>(|_, cx| {
        if let Some(window) = cx.active_window() {
            cx.defer(move |cx| {
                _ = window.update(cx, |_, window, cx| window.focus_prev(cx));
            });
        }
    });
}

pub(crate) fn root_container() -> gpui::Div {
    div()
        .size_full()
        .bg(gpui::rgb(0xffffff))
        .text_color(gpui::rgb(0x000000))
}

fn event_interest(window_id: WindowId, target_id: NodeId, event: NativeEventId) -> bool {
    crate::runtime()
        .lock()
        .is_ok_and(|tree| tree.has_subscription_in_path(window_id, target_id, event))
}

const RENDER_EVENT_MASK: u32 = event_bit(NativeEventId::MouseDown)
    | event_bit(NativeEventId::MouseUp)
    | event_bit(NativeEventId::MouseMove)
    | event_bit(NativeEventId::Click)
    | event_bit(NativeEventId::DblClick)
    | event_bit(NativeEventId::MouseEnter)
    | event_bit(NativeEventId::MouseLeave)
    | event_bit(NativeEventId::KeyDown)
    | event_bit(NativeEventId::KeyUp);

#[derive(Clone, Copy)]
struct EventInterest {
    subscriptions: u32,
    outside_mouse_down: bool,
}

#[derive(Clone, Copy)]
struct PseudoInterest {
    hover: bool,
    active: bool,
}

impl EventInterest {
    fn for_node(tree: &NativeTree, window_id: WindowId, id: NodeId) -> Self {
        Self {
            subscriptions: tree.subscription_mask_in_path(window_id, id),
            outside_mouse_down: tree.has_mousedownoutside_subscribers(window_id),
        }
    }

    fn has(self, event: NativeEventId) -> bool {
        self.subscriptions & event_bit(event) != 0
    }

    fn any(self) -> bool {
        self.outside_mouse_down || self.subscriptions & RENDER_EVENT_MASK != 0
    }
}

fn emit_mouse_down(
    window_id: WindowId,
    target_id: NodeId,
    event: &MouseDownEvent,
    window: &mut Window,
    cx: &mut App,
) {
    let (subscribed, outside, changed) = crate::runtime()
        .lock()
        .map(|mut tree| {
            let changed =
                event.button == MouseButton::Left && tree.press_node(window_id, target_id);
            (
                tree.has_subscription_in_path(window_id, target_id, NativeEventId::MouseDown),
                tree.outside_subscribers(window_id, target_id),
                changed,
            )
        })
        .unwrap_or_default();
    if changed {
        window.refresh();
    }
    if subscribed {
        events::emit(
            window_id,
            events::in_window(
                events::mouse_down(NativeEventId::MouseDown, target_id, event),
                window,
            ),
        );
    }
    for id in &outside {
        events::emit(
            window_id,
            events::in_window(
                events::mouse_down(NativeEventId::MouseDownOutside, *id, event),
                window,
            ),
        );
    }
    if subscribed || !outside.is_empty() {
        cx.stop_propagation();
    }
}

macro_rules! bubbling_events {
    ($($handler:ident($window_id:ident, $id:ident, $event:ident: $ty:ty $(, $window:ident: $window_ty:ty)?):
        $kind:ident $(before $before:block)? => $payload:expr;)+) => {
        $(fn $handler($window_id: WindowId, $id: NodeId, $event: &$ty, $($window: $window_ty,)? cx: &mut App) {
            $($before)?
            if event_interest($window_id, $id, NativeEventId::$kind) {
                events::emit($window_id, $payload);
                cx.stop_propagation();
            }
        })+
    };
}

bubbling_events! {
    emit_key_down(window_id, id, event: KeyDownEvent): KeyDown =>
        events::key_event(NativeEventId::KeyDown, id, &event.keystroke, event.is_held);
    emit_key_up(window_id, id, event: KeyUpEvent): KeyUp =>
        events::key_event(NativeEventId::KeyUp, id, &event.keystroke, false);
    emit_mouse_move(window_id, id, event: MouseMoveEvent, window: &Window): MouseMove =>
        events::in_window(events::mouse_move(id, event), window);
    emit_mouse_up(window_id, id, event: MouseUpEvent, window: &mut Window): MouseUp before {
        if event.button == MouseButton::Left {
            release_pointer(window_id, window);
        }
    } => events::in_window(events::mouse_up(NativeEventId::MouseUp, id, event), window);
}

fn release_pointer(window_id: WindowId, window: &mut Window) {
    if crate::runtime()
        .lock()
        .is_ok_and(|mut tree| tree.release_pointer(window_id))
    {
        window.refresh();
    }
}

fn emit_click(
    window_id: WindowId,
    target_id: NodeId,
    event: &ClickEvent,
    window: &Window,
    cx: &mut App,
) {
    let payload = |kind| {
        let payload = events::click(kind, target_id, event);
        if matches!(event, ClickEvent::Keyboard(_)) {
            payload
        } else {
            events::in_window(payload, window)
        }
    };
    let subscriptions = crate::runtime()
        .lock()
        .map(|tree| tree.subscription_mask_in_path(window_id, target_id))
        .unwrap_or_default();
    let click = subscriptions & event_bit(NativeEventId::Click) != 0;
    let double_click =
        event.click_count() == 2 && subscriptions & event_bit(NativeEventId::DblClick) != 0;
    if click {
        events::emit(window_id, payload(NativeEventId::Click));
    }
    if double_click {
        events::emit(window_id, payload(NativeEventId::DblClick));
    }
    if click || double_click {
        cx.stop_propagation();
    }
}

fn emit_hover(window_id: WindowId, target_id: NodeId, hovered: bool, window: &mut Window) {
    if crate::runtime()
        .lock()
        .is_ok_and(|mut tree| tree.set_hovered(window_id, target_id, hovered))
    {
        window.refresh();
    }
    let event = if hovered {
        NativeEventId::MouseEnter
    } else {
        NativeEventId::MouseLeave
    };
    if event_interest(window_id, target_id, event) {
        events::emit(
            window_id,
            events::mouse_event(
                event,
                target_id,
                window.point_to_window(window.mouse_position()),
                window.modifiers(),
            ),
        );
    }
}

macro_rules! with_mouse_buttons {
    ($element:ident, $method:ident, $handler:ident, $window_id:ident, $id:ident) => {
        for button in [
            MouseButton::Left,
            MouseButton::Right,
            MouseButton::Middle,
            MouseButton::Navigate(NavigationDirection::Back),
            MouseButton::Navigate(NavigationDirection::Forward),
        ] {
            $element = $element.$method(button, move |event, window, cx| {
                $handler($window_id, $id, event, window, cx)
            });
        }
    };
}

fn with_native_events<T: StatefulInteractiveElement>(
    mut element: T,
    interest: EventInterest,
    window_id: WindowId,
    id: NodeId,
    runtime: &RuntimeStateRegistry,
    pseudo: PseudoInterest,
) -> T {
    if let Some(focus) = runtime.tracked_focus_handle(id) {
        element = element.track_focus(&focus);
    } else if let Some(focus) = runtime.external_focus_handle(id) {
        element = element.on_mouse_down(MouseButton::Left, move |_, window, cx| {
            focus.focus(window, cx)
        });
    }
    if let Some(scroll) = runtime.scroll_handle(id) {
        element = element.track_scroll(&scroll);
    }
    if interest.has(NativeEventId::MouseDown) || interest.outside_mouse_down {
        with_mouse_buttons!(element, on_mouse_down, emit_mouse_down, window_id, id);
    } else if pseudo.active {
        element = element.on_mouse_down(MouseButton::Left, move |event, window, cx| {
            emit_mouse_down(window_id, id, event, window, cx)
        });
    }
    if interest.has(NativeEventId::MouseUp) {
        with_mouse_buttons!(element, on_mouse_up, emit_mouse_up, window_id, id);
    } else if pseudo.active {
        element = element.on_mouse_up(MouseButton::Left, move |event, window, cx| {
            emit_mouse_up(window_id, id, event, window, cx)
        });
    }
    if pseudo.active {
        element = element.on_mouse_up_out(MouseButton::Left, move |_, window, _| {
            release_pointer(window_id, window)
        });
    }
    if interest.has(NativeEventId::MouseMove) {
        element = element.on_mouse_move(move |event, window, cx| {
            emit_mouse_move(window_id, id, event, window, cx)
        });
    }
    if interest.has(NativeEventId::Click) || interest.has(NativeEventId::DblClick) {
        element =
            element.on_click(move |event, window, cx| emit_click(window_id, id, event, window, cx));
    }
    if pseudo.hover
        || interest.has(NativeEventId::MouseEnter)
        || interest.has(NativeEventId::MouseLeave)
    {
        element =
            element.on_hover(move |hovered, window, _| emit_hover(window_id, id, *hovered, window));
    }
    if interest.has(NativeEventId::KeyDown) {
        element = element.on_key_down(move |event, _, cx| emit_key_down(window_id, id, event, cx));
    }
    if interest.has(NativeEventId::KeyUp) {
        element = element.on_key_up(move |event, _, cx| emit_key_up(window_id, id, event, cx));
    }
    element
}

/// `file:` sources load from disk; everything else is a URI.
fn image_resource_from(location: &ImageLocation, src: &str) -> Resource {
    match location {
        ImageLocation::Path(path) => Resource::Path(path.clone().into()),
        _ => Resource::Uri(src.to_string().into()),
    }
}

/// Maps a retained image source to a GPUI image source.
fn image_source_from(location: &ImageLocation, src: &str) -> ImageSource {
    ImageSource::Resource(image_resource_from(location, src))
}

fn to_gpui_object_fit(value: ImageObjectFit) -> gpui::ObjectFit {
    match value {
        ImageObjectFit::Fill => gpui::ObjectFit::Fill,
        ImageObjectFit::Contain => gpui::ObjectFit::Contain,
        ImageObjectFit::Cover => gpui::ObjectFit::Cover,
        ImageObjectFit::ScaleDown => gpui::ObjectFit::ScaleDown,
        ImageObjectFit::None => gpui::ObjectFit::None,
    }
}

fn anchored_anchor(config: &AnchoredConfig) -> Anchor {
    match (config.side, config.align) {
        (AnchoredSide::Top, AnchoredAlign::Start) => Anchor::BottomLeft,
        (AnchoredSide::Top, AnchoredAlign::Center) => Anchor::BottomCenter,
        (AnchoredSide::Top, AnchoredAlign::End) => Anchor::BottomRight,
        (AnchoredSide::Right, AnchoredAlign::Start) => Anchor::TopLeft,
        (AnchoredSide::Right, AnchoredAlign::Center) => Anchor::LeftCenter,
        (AnchoredSide::Right, AnchoredAlign::End) => Anchor::BottomLeft,
        (AnchoredSide::Bottom, AnchoredAlign::Start) => Anchor::TopLeft,
        (AnchoredSide::Bottom, AnchoredAlign::Center) => Anchor::TopCenter,
        (AnchoredSide::Bottom, AnchoredAlign::End) => Anchor::TopRight,
        (AnchoredSide::Left, AnchoredAlign::Start) => Anchor::TopRight,
        (AnchoredSide::Left, AnchoredAlign::Center) => Anchor::RightCenter,
        (AnchoredSide::Left, AnchoredAlign::End) => Anchor::BottomRight,
    }
}

fn anchored_offset(config: &AnchoredConfig) -> Point<Pixels> {
    let (x, y) = match config.side {
        AnchoredSide::Top => (0.0, -config.gap),
        AnchoredSide::Right => (config.gap, 0.0),
        AnchoredSide::Bottom => (0.0, config.gap),
        AnchoredSide::Left => (-config.gap, 0.0),
    };
    gpui::point(gpui::px(x + config.offset.0), gpui::px(y + config.offset.1))
}

fn wrap_at_anchor_slot(layer: AnyElement, config: &AnchoredConfig) -> AnyElement {
    let wrapper = match config.side {
        AnchoredSide::Top => div().absolute().top_0(),
        AnchoredSide::Right => div().absolute().right_0(),
        AnchoredSide::Bottom => div().absolute().bottom_0(),
        AnchoredSide::Left => div().absolute().left_0(),
    };
    let wrapper = match (config.side, config.align) {
        (AnchoredSide::Top | AnchoredSide::Bottom, AnchoredAlign::Start) => {
            wrapper.left_0().size_0()
        }
        (AnchoredSide::Top | AnchoredSide::Bottom, AnchoredAlign::Center) => {
            wrapper.left(gpui::relative(0.5)).size_0()
        }
        (AnchoredSide::Top | AnchoredSide::Bottom, AnchoredAlign::End) => {
            wrapper.right_0().size_0()
        }
        (AnchoredSide::Left | AnchoredSide::Right, AnchoredAlign::Start) => {
            wrapper.top_0().size_0()
        }
        (AnchoredSide::Left | AnchoredSide::Right, AnchoredAlign::Center) => {
            wrapper.top(gpui::relative(0.5)).size_0()
        }
        (AnchoredSide::Left | AnchoredSide::Right, AnchoredAlign::End) => {
            wrapper.bottom_0().size_0()
        }
    };
    wrapper.child(layer).into_any_element()
}

/// Default surface for native buttons; author declarations override per field.
fn button_control_geometry<T: Styled>(element: T) -> T {
    element
        .flex()
        .items_center()
        .justify_center()
        .line_height(relative(1.0))
        .pt(px(6.0))
        .pb(px(6.0))
        .pl(px(14.0))
        .pr(px(14.0))
        .rounded(px(6.0))
        .bg(gpui::rgba(0xe9e9ebff))
        .border_1()
        .border_color(gpui::rgba(0x0000001f))
}

/// Default surface for native text controls; author declarations override per field.
fn text_control_geometry<T: Styled>(element: T) -> T {
    element
        .pt(px(6.0))
        .pb(px(6.0))
        .pl(px(10.0))
        .pr(px(10.0))
        .rounded(px(6.0))
        .bg(gpui::rgba(0xffffffff))
        .border_1()
        .border_color(gpui::rgba(0x0000001f))
}

/// Paints the generic gpui-base scrollbar as an overlay without making it a
/// layout child of the Retend scroll container.
struct ScrollbarOverlay {
    inner: AnyElement,
    scroll: gpui::ScrollHandle,
    mode: gpui_base::ScrollbarMode,
    id: NodeId,
}

impl IntoElement for ScrollbarOverlay {
    type Element = Self;

    fn into_element(self) -> Self::Element {
        self
    }
}

impl Element for ScrollbarOverlay {
    type RequestLayoutState = ();
    type PrepaintState = AnyElement;

    fn id(&self) -> Option<ElementId> {
        None
    }

    fn source_location(&self) -> Option<&'static std::panic::Location<'static>> {
        None
    }

    fn request_layout(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&InspectorElementId>,
        window: &mut Window,
        cx: &mut App,
    ) -> (LayoutId, ()) {
        (self.inner.request_layout(window, cx), ())
    }

    fn prepaint(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&InspectorElementId>,
        _bounds: Bounds<Pixels>,
        _request_layout: &mut (),
        window: &mut Window,
        cx: &mut App,
    ) -> AnyElement {
        self.inner.prepaint(window, cx);
        let bounds = self.scroll.bounds();
        let mut scrollbar = gpui_base::Scrollbar::new(&self.scroll)
            .id(("retend-scrollbar", self.id))
            .mode(self.mode)
            .into_any_element();
        scrollbar.prepaint_as_root(bounds.origin, bounds.size.into(), window, cx);
        scrollbar
    }

    fn paint(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&InspectorElementId>,
        _bounds: Bounds<Pixels>,
        _request_layout: &mut (),
        scrollbar: &mut AnyElement,
        window: &mut Window,
        cx: &mut App,
    ) {
        self.inner.paint(window, cx);
        scrollbar.paint(window, cx);
    }
}

/// Runs Retend bookkeeping after the wrapped element reaches the required phase.
struct PaintObserver {
    inner: AnyElement,
    callback: Option<PaintCallback>,
    phase: ObserverPhase,
}

#[derive(Clone, Copy)]
enum ObserverPhase {
    Prepaint,
    Paint,
}

enum PaintCallback {
    Finish {
        runtime: RuntimeStateRegistry,
        generation: u64,
    },
    Bounds {
        runtime: RuntimeStateRegistry,
        generation: u64,
        id: NodeId,
        content_scroll_handle: Option<gpui::ScrollHandle>,
        painted_content: Option<Rc<Cell<Option<Point<Pixels>>>>>,
    },
}

impl PaintCallback {
    fn painted(self, bounds: Bounds<Pixels>, window: &mut Window) {
        match self {
            Self::Finish {
                runtime,
                generation,
            } => {
                // GPUI suppresses refresh mid-draw, so defer remaining layout work.
                if runtime.finish_frame(generation) {
                    window.on_next_frame(move |window, _| {
                        window.refresh();
                        if runtime.finish_frame(generation) {
                            window.refresh();
                        }
                    });
                }
            }
            Self::Bounds {
                runtime,
                generation,
                id,
                content_scroll_handle,
                painted_content,
            } => {
                let bottom_right = if let Some(handle) = &content_scroll_handle {
                    (0..handle.children_count())
                        .filter_map(|index| handle.bounds_for_item(index))
                        .map(|bounds| bounds.bottom_right())
                        .reduce(|a, b| a.max(&b))
                } else {
                    painted_content.as_ref().and_then(|content| content.get())
                };
                runtime.record_geometry(
                    generation,
                    id,
                    bounds,
                    bottom_right.map(|bottom_right| bottom_right - bounds.origin),
                );
            }
        }
    }
}

impl PaintObserver {
    fn new(inner: AnyElement, callback: PaintCallback, phase: ObserverPhase) -> Self {
        Self {
            inner,
            callback: Some(callback),
            phase,
        }
    }

    fn observe(&mut self, bounds: Bounds<Pixels>, window: &mut Window) {
        if let Some(callback) = self.callback.take() {
            callback.painted(bounds, window);
        }
    }
}

impl IntoElement for PaintObserver {
    type Element = Self;

    fn into_element(self) -> Self::Element {
        self
    }
}

impl Element for PaintObserver {
    type RequestLayoutState = ();
    type PrepaintState = ();

    fn id(&self) -> Option<ElementId> {
        None
    }

    fn source_location(&self) -> Option<&'static std::panic::Location<'static>> {
        None
    }

    fn request_layout(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&InspectorElementId>,
        window: &mut Window,
        cx: &mut App,
    ) -> (LayoutId, ()) {
        (self.inner.request_layout(window, cx), ())
    }

    fn prepaint(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        _request_layout: &mut (),
        window: &mut Window,
        cx: &mut App,
    ) {
        self.inner.prepaint(window, cx);
        if matches!(self.phase, ObserverPhase::Prepaint) {
            self.observe(bounds, window);
        }
    }

    fn paint(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        _request_layout: &mut (),
        _prepaint: &mut (),
        window: &mut Window,
        cx: &mut App,
    ) {
        self.inner.paint(window, cx);
        if matches!(self.phase, ObserverPhase::Paint) {
            self.observe(bounds, window);
        }
    }
}

/// Observes one `img` asset and emits its terminal `load`/`error` once.
///
/// Only `img` with a retained `src` and a `load`/`error` subscription in
/// path is wrapped. State lives in GPUI element state keyed by this
/// observer's own stable id, so delivery is per node per source with no
/// global scan and no manual cleanup: dropping the source (or its last
/// subscription) drops the observer and its state, and a new source resets
/// delivery.
struct ImageEventObserver {
    inner: AnyElement,
    window_id: WindowId,
    id: NodeId,
    src: String,
    location: ImageLocation,
    load_subscribed: bool,
    error_subscribed: bool,
}

struct ImageEventState {
    src: String,
    delivered: bool,
}

impl IntoElement for ImageEventObserver {
    type Element = Self;

    fn into_element(self) -> Self::Element {
        self
    }
}

impl Element for ImageEventObserver {
    type RequestLayoutState = ();
    type PrepaintState = ();

    fn id(&self) -> Option<ElementId> {
        Some(ElementId::NamedInteger(
            "retend-image-event".into(),
            u64::from(self.id),
        ))
    }

    fn source_location(&self) -> Option<&'static std::panic::Location<'static>> {
        None
    }

    fn request_layout(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&InspectorElementId>,
        window: &mut Window,
        cx: &mut App,
    ) -> (LayoutId, ()) {
        (self.inner.request_layout(window, cx), ())
    }

    fn prepaint(
        &mut self,
        id: Option<&GlobalElementId>,
        _inspector_id: Option<&InspectorElementId>,
        _bounds: Bounds<Pixels>,
        _request_layout: &mut (),
        window: &mut Window,
        cx: &mut App,
    ) {
        self.inner.prepaint(window, cx);
        let Some(global_id) = id else { return };
        let window_id = self.window_id;
        let node_id = self.id;
        let load_subscribed = self.load_subscribed;
        let error_subscribed = self.error_subscribed;
        window.with_element_state(global_id, |state: Option<ImageEventState>, window| {
            let mut state = match state {
                Some(existing) if existing.src == self.src => existing,
                _ => ImageEventState {
                    src: self.src.clone(),
                    delivered: false,
                },
            };
            if !state.delivered {
                // The wrapped `Img` already drives re-renders through its own
                // notifying asset query; a non-notifying lookup is enough here.
                let resource = image_resource_from(&self.location, &self.src);
                let event = match window.get_asset::<gpui::ImgResourceLoader>(&resource, cx) {
                    Some(Ok(_)) => Some(NativeEventId::Load),
                    Some(Err(_)) => Some(NativeEventId::Error),
                    None => None,
                };
                if let Some(event) = event {
                    state.delivered = true;
                    let subscribed = match event {
                        NativeEventId::Load => load_subscribed,
                        NativeEventId::Error => error_subscribed,
                        _ => false,
                    };
                    if subscribed {
                        events::emit(window_id, events::NativeEventPayload::new(event, node_id));
                    }
                }
            }
            ((), state)
        });
    }

    fn paint(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&InspectorElementId>,
        _bounds: Bounds<Pixels>,
        _request_layout: &mut (),
        _prepaint: &mut (),
        window: &mut Window,
        cx: &mut App,
    ) {
        self.inner.paint(window, cx);
    }
}

pub fn build_with_runtime(
    tree: &NativeTree,
    id: NodeId,
    runtime_state: &RuntimeStateRegistry,
    generation: u64,
    window: &mut Window,
    cx: &mut App,
) -> AnyElement {
    let mut resolve_style =
        |id, motion, style| crate::motion::resolve_style(id, motion, style, window, cx);
    let inner = build_inner(
        tree,
        id,
        runtime_state,
        generation,
        &mut resolve_style,
        EventInterest::for_node(tree, tree.nodes[&id].window_id, id),
    );
    PaintObserver::new(
        inner,
        PaintCallback::Finish {
            runtime: runtime_state.clone(),
            generation,
        },
        ObserverPhase::Paint,
    )
    .into_any_element()
}

fn build_inner<'a, F>(
    tree: &'a NativeTree,
    id: NodeId,
    runtime_state: &RuntimeStateRegistry,
    generation: u64,
    resolve_style: &mut F,
    interest: EventInterest,
) -> AnyElement
where
    F: FnMut(
        NodeId,
        &'a crate::motion::MotionBridgeState,
        Option<&'a crate::style::NativeStyle>,
    ) -> (
        Option<crate::style::NativeStyle>,
        Vec<crate::motion::TransitionLifecycleEvent>,
    ),
{
    let node = &tree.nodes[&id];
    if let NodeData::Text(text) = &node.data {
        return Text::new(ElementId::Integer(u64::from(id)), text.clone().into())
            .into_any_element();
    }
    let window_id = node.window_id;
    let (motion_style, transition_events) = resolve_style(id, &node.motion, node.style.as_deref());
    for lifecycle in transition_events {
        let event = lifecycle.event;
        if tree.has_subscription_in_path(window_id, id, event) {
            events::emit(
                window_id,
                events::NativeEventPayload::transition(
                    event,
                    id,
                    lifecycle.property_name().to_string(),
                    lifecycle.elapsed,
                ),
            );
        }
    }
    let resolved_style = motion_style.as_ref().or(node.style.as_deref());
    let pseudo = PseudoInterest {
        hover: node.tracks_hover(),
        active: node.tracks_active(),
    };
    let interest = EventInterest {
        subscriptions: interest.subscriptions | node.subscriptions,
        ..interest
    };
    let runtime = runtime_state.clone();
    let scroll_handle = runtime_state.scroll_handle(id);
    // Extents only matter where a direct text child's box is otherwise
    // unrecorded; div/image children already report their own bounds.
    let has_text_child = node
        .children
        .iter()
        .any(|child_id| matches!(tree.nodes[child_id].data, NodeData::Text(_)));
    let tracks_content = has_text_child
        && !node
            .style
            .as_deref()
            .is_some_and(|style| matches!(style.display, Some(crate::style::DisplayValue::None)));
    let staged_content = (tracks_content && scroll_handle.is_none())
        .then(|| Rc::new(Cell::new(None::<Point<Pixels>>)));
    let painted_content = staged_content.clone();
    let content_scroll_handle = scroll_handle.clone().filter(|_| tracks_content);
    let element = match &node.data {
        NodeData::Button
        | NodeData::Root
        | NodeData::Container
        | NodeData::Anchored(_)
        | NodeData::TextControl { .. } => {
            let element = match &node.data {
                NodeData::Button => button_control_geometry(div()),
                NodeData::Root => root_container().block(),
                NodeData::TextControl { .. } => text_control_geometry(div().block()),
                _ => div().block(),
            };
            let mut element = match resolved_style {
                Some(style) => style.apply(element),
                None => element,
            };
            let button = matches!(node.data, NodeData::Button);
            let disabled = button && node.disabled;
            if disabled {
                element = element.opacity(0.5);
            }
            element = match &node.data {
                NodeData::TextControl { kind, .. } => match kind {
                    crate::tree::TextControlKind::Input => {
                        let input = runtime_state.input(id).expect(
                            "native input runtime state must be initialized before rendering",
                        );
                        element.child(gpui_base::input::Input::new(&input))
                    }
                    crate::tree::TextControlKind::Textarea => {
                        let textarea = runtime_state.textarea(id).expect(
                            "native textarea runtime state must be initialized before rendering",
                        );
                        element.child(gpui_base::input::Textarea::new(&textarea))
                    }
                },
                _ => element.children(build_children(
                    tree,
                    &node.children,
                    runtime_state,
                    generation,
                    resolve_style,
                    interest,
                )),
            };
            if let Some(content) = staged_content.clone().filter(|_| !button) {
                element = element.on_children_prepainted(move |children, _, _| {
                    content.set(
                        children
                            .into_iter()
                            .map(|bounds| bounds.bottom_right())
                            .reduce(|a, b| a.max(&b)),
                    );
                });
            }
            if let NodeData::Anchored(config) = &node.data {
                if config.occlude {
                    element = element.occlude();
                }
            }
            let interest = if button {
                EventInterest {
                    // GPUI only maps Enter/Space to a click when a click listener exists.
                    subscriptions: if disabled {
                        0
                    } else {
                        interest.subscriptions | event_bit(NativeEventId::Click)
                    },
                    ..interest
                }
            } else {
                interest
            };
            let pseudo = PseudoInterest {
                hover: pseudo.hover && !disabled,
                active: pseudo.active && !disabled,
            };
            #[cfg(test)]
            let element = element.debug_selector(move || format!("retend-node-{id}"));
            if button
                || interest.any()
                || runtime_state.is_interactive(id)
                || pseudo.hover
                || pseudo.active
                || matches!(node.data, NodeData::TextControl { .. })
            {
                let element = with_native_events(
                    element.id(ElementId::Integer(u64::from(id))),
                    interest,
                    node.window_id,
                    id,
                    runtime_state,
                    pseudo,
                );
                element.into_any_element()
            } else {
                element.into_any_element()
            }
        }
        NodeData::Text(_) => unreachable!("text leaves return before bounds tracking"),
        NodeData::Image {
            src,
            object_fit,
            alt,
            location,
        } => {
            let source = src
                .as_deref()
                .map(|src| image_source_from(location, src))
                .unwrap_or_else(|| {
                    ImageSource::Custom(Arc::new(|_, _| {
                        Some(Err(ImageCacheError::Asset("image source is unset".into())))
                    }))
                });
            let image = img(source);
            let mut image = match resolved_style {
                Some(style) => style.apply(image.block()),
                None => image.block(),
            };
            if let Some(object_fit) = object_fit {
                image = image.object_fit(to_gpui_object_fit(*object_fit));
            }
            if let Some(alt) = alt {
                image = image.role(Role::Image).aria_label(alt.clone());
            }
            let image = with_native_events(
                image.id(ElementId::Integer(u64::from(id))),
                interest,
                node.window_id,
                id,
                runtime_state,
                pseudo,
            );
            match src {
                Some(src)
                    if interest.has(NativeEventId::Load) || interest.has(NativeEventId::Error) =>
                {
                    ImageEventObserver {
                        inner: image.into_any_element(),
                        window_id: node.window_id,
                        id,
                        src: src.clone(),
                        location: location.clone(),
                        load_subscribed: interest.has(NativeEventId::Load),
                        error_subscribed: interest.has(NativeEventId::Error),
                    }
                    .into_any_element()
                }
                _ => image.into_any_element(),
            }
        }
    };
    let bounds = PaintCallback::Bounds {
        runtime,
        generation,
        id,
        content_scroll_handle,
        painted_content,
    };
    let phase = if matches!(&node.data, NodeData::Anchored(config) if config.deferred) {
        ObserverPhase::Prepaint
    } else {
        ObserverPhase::Paint
    };
    let element = PaintObserver::new(element, bounds, phase).into_any_element();
    let mode = match (&node.data, node.style.as_deref()) {
        (NodeData::Root | NodeData::Container | NodeData::Anchored(_), Some(style))
            if !matches!(style.display, Some(crate::style::DisplayValue::None)) =>
        {
            match style.overflow {
                OverflowValue::Auto => Some(gpui_base::ScrollbarMode::Scrolling),
                OverflowValue::Scroll => Some(gpui_base::ScrollbarMode::Always),
                OverflowValue::Visible | OverflowValue::Clip | OverflowValue::Hidden => None,
            }
        }
        _ => None,
    };
    let element = match (scroll_handle, mode) {
        (Some(scroll), Some(mode)) => ScrollbarOverlay {
            inner: element,
            scroll,
            mode,
            id,
        }
        .into_any_element(),
        _ => element,
    };

    let element = crate::transform::wrap(element, resolved_style);
    let NodeData::Anchored(config) = &node.data else {
        return element;
    };
    let mut positioned = anchored()
        .anchor(anchored_anchor(config))
        .offset(anchored_offset(config));
    if let Some((x, y)) = config.position {
        positioned = positioned.position(gpui::point(gpui::px(x), gpui::px(y)));
    }
    if config.fit == AnchoredFit::Snap {
        positioned = positioned.snap_to_window_with_margin(gpui::px(config.snap_margin));
    }
    let layer = positioned.child(element);
    let layer = if config.deferred {
        deferred(layer)
            .with_priority(config.priority)
            .into_any_element()
    } else {
        layer.into_any_element()
    };
    if config.position.is_some() {
        layer
    } else {
        wrap_at_anchor_slot(layer, config)
    }
}

/// Builds the renderable children of a container, coalescing adjacent text
/// leaves into single text runs without staging a second child representation.
fn build_children<'a, F>(
    tree: &'a NativeTree,
    children: &[NodeId],
    runtime_state: &RuntimeStateRegistry,
    generation: u64,
    resolve_style: &mut F,
    interest: EventInterest,
) -> Vec<AnyElement>
where
    F: FnMut(
        NodeId,
        &'a crate::motion::MotionBridgeState,
        Option<&'a crate::style::NativeStyle>,
    ) -> (
        Option<crate::style::NativeStyle>,
        Vec<crate::motion::TransitionLifecycleEvent>,
    ),
{
    let mut rendered = Vec::with_capacity(children.len());
    let mut index = 0;
    while index < children.len() {
        let child_id = children[index];
        if let NodeData::Text(first_text) = &tree.nodes[&child_id].data {
            let first_id = child_id;
            let mut content = first_text.clone();
            index += 1;
            while index < children.len() {
                let next_id = children[index];
                let NodeData::Text(text) = &tree.nodes[&next_id].data else {
                    break;
                };
                content.push_str(text);
                index += 1;
            }
            rendered.push(
                Text::new(ElementId::Integer(u64::from(first_id)), content.into())
                    .into_any_element(),
            );
        } else {
            rendered.push(build_inner(
                tree,
                child_id,
                runtime_state,
                generation,
                resolve_style,
                interest,
            ));
            index += 1;
        }
    }
    rendered
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

    use gpui::{point, px, Context, Modifiers, Render, TestAppContext, Window};

    use super::*;
    use crate::protocol::{Command, PropertyValue};
    use crate::protocol_generated::{ElementKind, PropertyId};
    use crate::runtime_state::{
        LayoutOperation, MeasureResponder, Measurement, ScrollOffset, ScrollResponder,
    };
    use crate::style::OverflowValue;

    static NEXT_GLOBAL_TEST_ROOT: AtomicU32 = AtomicU32::new(0xd000_0000);

    fn container(id: NodeId) -> Command {
        Command::CreateNode {
            id,
            kind: ElementKind::Container,
        }
    }

    fn insert(parent_id: NodeId, child_id: NodeId) -> Command {
        Command::InsertChild {
            parent_id,
            child_id,
            before_id: 0,
        }
    }

    fn remove(parent_id: NodeId, child_id: NodeId) -> Command {
        Command::RemoveChild {
            parent_id,
            child_id,
        }
    }

    #[test]
    fn adjacent_text_children_coalesce_into_single_runs() {
        let mut tree = NativeTree::default();
        let window = tree.create_window(1).unwrap();
        tree.apply_commands(
            window,
            vec![
                container(2),
                Command::CreateText {
                    id: 3,
                    text: "Hello".into(),
                },
                Command::CreateText {
                    id: 4,
                    text: " world".into(),
                },
                Command::CreateText {
                    id: 5,
                    text: "!".into(),
                },
                container(6),
                Command::CreateText {
                    id: 7,
                    text: "tail".into(),
                },
                insert(2, 3),
                insert(2, 4),
                insert(2, 5),
                insert(2, 6),
                insert(2, 7),
            ],
        )
        .unwrap();

        let children = &tree.nodes[&2].children;
        assert_eq!(children.len(), 5, "the fixture must keep every child node");
        let rendered = build_children(
            &tree,
            children,
            &RuntimeStateRegistry::default(),
            0,
            &mut |_, _, _| (None, Vec::new()),
            EventInterest {
                subscriptions: 0,
                outside_mouse_down: false,
            },
        );
        // "Hello" + " world" + "!" collapse into one run, the nested container
        // stays its own element, and "tail" starts a new run.
        assert_eq!(rendered.len(), 3, "five children must render as three runs");
    }

    struct QueryLayoutTestView {
        tree: Rc<RefCell<NativeTree>>,
        runtime_state: RuntimeStateRegistry,
        window_id: WindowId,
    }

    impl Render for QueryLayoutTestView {
        fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
            let tree = self.tree.borrow();
            let generation = crate::platform::prepare_frame(
                &tree,
                &self.runtime_state,
                self.window_id,
                window,
                cx,
            );
            build_with_runtime(&tree, 1, &self.runtime_state, generation, window, cx)
        }
    }

    struct GlobalTreeTestView {
        runtime_state: RuntimeStateRegistry,
        window_id: WindowId,
        root_id: NodeId,
    }

    impl Render for GlobalTreeTestView {
        fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
            let tree = crate::runtime()
                .lock()
                .expect("global native tree must remain available in render tests");
            let generation = crate::platform::prepare_frame(
                &tree,
                &self.runtime_state,
                self.window_id,
                window,
                cx,
            );
            build_with_runtime(
                &tree,
                self.root_id,
                &self.runtime_state,
                generation,
                window,
                cx,
            )
        }
    }

    fn finish_test_frames(cx: &mut gpui::VisualTestContext) {
        for _ in 0..10 {
            cx.run_until_parked();
            if cx.update(|window, cx| window.simulate_next_frame(cx)) == 0 {
                return;
            }
        }
        panic!("render completion kept requesting frames");
    }

    fn request_measure(
        runtime_state: &RuntimeStateRegistry,
        id: NodeId,
    ) -> mpsc::Receiver<Result<Measurement, crate::BridgeFailure>> {
        let (sender, receiver) = mpsc::channel();
        runtime_state.enqueue_layout(LayoutOperation::Measure(
            id,
            MeasureResponder::new(move |result| {
                sender
                    .send(result)
                    .expect("measure test receiver must remain alive");
            }),
        ));
        receiver
    }

    fn request_scroll_offset(
        runtime_state: &RuntimeStateRegistry,
        id: NodeId,
    ) -> mpsc::Receiver<Result<ScrollOffset, crate::BridgeFailure>> {
        let (sender, receiver) = mpsc::channel();
        runtime_state.enqueue_layout(LayoutOperation::ScrollOffset(
            id,
            OverflowValue::Scroll,
            ScrollResponder::new(move |result| {
                sender
                    .send(result)
                    .expect("scroll test receiver must remain alive");
            }),
        ));
        receiver
    }

    fn scroll(runtime: &RuntimeStateRegistry, id: NodeId, y: f32, relative: bool) {
        runtime.enqueue_layout(LayoutOperation::Scroll(
            id,
            OverflowValue::Scroll,
            0.0,
            y,
            relative,
        ));
    }

    fn request_scroll_into_view(runtime: &RuntimeStateRegistry, id: NodeId) {
        runtime.enqueue_layout(LayoutOperation::ScrollIntoView(id));
    }

    #[gpui::test]
    fn textarea_auto_grow_wraps_and_respects_row_bounds(cx: &mut TestAppContext) {
        cx.update(init);
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window_id = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![
                    Command::CreateNode {
                        id: 2,
                        kind: ElementKind::Textarea,
                    },
                    Command::SetProperty {
                        id: 2,
                        property: PropertyId::Value,
                        value: PropertyValue::String("a".into()),
                    },
                    Command::SetProperty {
                        id: 2,
                        property: PropertyId::MinRows,
                        value: PropertyValue::Number(3.0),
                    },
                    Command::SetProperty {
                        id: 2,
                        property: PropertyId::MaxRows,
                        value: PropertyValue::Number(4.0),
                    },
                    Command::SetStyle {
                        id: 2,
                        properties: vec![(PropertyId::Width, PropertyValue::Number(600.0))],
                    },
                    insert(1, 2),
                ],
            )
            .unwrap();

        let runtime_state = RuntimeStateRegistry::default();
        let first = request_measure(&runtime_state, 2);
        let (view, cx) = cx.add_window_view({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| QueryLayoutTestView {
                tree,
                runtime_state,
                window_id,
            }
        });
        finish_test_frames(cx);
        let min_height = first.try_recv().unwrap().unwrap().height;

        let mut measure = |commands: Vec<Command>| {
            tree.borrow_mut()
                .apply_commands(window_id, commands)
                .unwrap();
            view.update(cx, |_, cx| cx.notify());
            finish_test_frames(cx);

            let measured = request_measure(&runtime_state, 2);
            view.update(cx, |_, cx| cx.notify());
            finish_test_frames(cx);
            measured.try_recv().unwrap().unwrap().height
        };

        let max_height = measure(vec![Command::SetProperty {
            id: 2,
            property: PropertyId::Value,
            value: PropertyValue::String("a\nb\nc\nd".into()),
        }]);
        let overflow_height = measure(vec![Command::SetProperty {
            id: 2,
            property: PropertyId::Value,
            value: PropertyValue::String("a\nb\nc\nd\ne\nf\ng\nh".into()),
        }]);
        assert!(max_height > min_height);
        assert_eq!(overflow_height, max_height);

        let wrapped =
            "This long single line must wrap repeatedly when the textarea becomes narrow.";
        let wide_height = measure(vec![Command::SetProperty {
            id: 2,
            property: PropertyId::Value,
            value: PropertyValue::String(wrapped.into()),
        }]);
        let narrow_height = measure(vec![Command::SetStyle {
            id: 2,
            properties: vec![(PropertyId::Width, PropertyValue::Number(120.0))],
        }]);
        assert!(narrow_height > wide_height);
        assert_eq!(narrow_height, max_height);

        let default_height = measure(vec![
            Command::SetProperty {
                id: 2,
                property: PropertyId::MinRows,
                value: PropertyValue::Null,
            },
            Command::SetProperty {
                id: 2,
                property: PropertyId::MaxRows,
                value: PropertyValue::Null,
            },
            Command::SetProperty {
                id: 2,
                property: PropertyId::Value,
                value: PropertyValue::String("reset".into()),
            },
        ]);
        assert!(default_height < min_height);

        let default_wrapped_height = measure(vec![Command::SetProperty {
            id: 2,
            property: PropertyId::Value,
            value: PropertyValue::String(wrapped.into()),
        }]);
        assert_eq!(default_wrapped_height, default_height);
    }

    #[gpui::test]
    fn measure_queries_resolve_from_a_committed_generation_and_observe_later_writes(
        cx: &mut TestAppContext,
    ) {
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window_id = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![
                    container(2),
                    container(3),
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(50.0)),
                        ],
                    },
                    Command::SetStyle {
                        id: 3,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(300.0)),
                            (PropertyId::Height, PropertyValue::Number(80.0)),
                        ],
                    },
                    insert(1, 2),
                    insert(2, 3),
                ],
            )
            .unwrap();

        let runtime_state = RuntimeStateRegistry::default();
        let first = request_measure(&runtime_state, 2);
        let (view, cx) = cx.add_window_view({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| QueryLayoutTestView {
                tree,
                runtime_state,
                window_id,
            }
        });
        finish_test_frames(cx);

        let first = first.try_recv().unwrap().unwrap();
        assert_eq!(first.width, 100.0);
        assert_eq!(first.height, 50.0);
        assert_eq!(first.scroll_width, 300.0);
        assert_eq!(first.scroll_height, 80.0);

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(140.0)),
                            (PropertyId::Height, PropertyValue::Number(60.0)),
                        ],
                    },
                    Command::SetStyle {
                        id: 3,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(240.0)),
                            (PropertyId::Height, PropertyValue::Number(80.0)),
                        ],
                    },
                ],
            )
            .unwrap();
        let second = request_measure(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);

        let second = second.try_recv().unwrap().unwrap();
        assert_eq!(second.width, 140.0);
        assert_eq!(second.height, 60.0);
        assert_eq!(second.scroll_width, 240.0);
        assert_eq!(second.scroll_height, 80.0);

        tree.borrow_mut()
            .apply_commands(window_id, vec![remove(1, 2)])
            .unwrap();
        let detached = request_measure(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);

        assert_eq!(
            detached.try_recv().unwrap().unwrap(),
            Measurement::default()
        );
    }

    #[gpui::test]
    fn scroll_handles_preserve_offsets_for_scroll_container_states_and_reset_when_released(
        cx: &mut TestAppContext,
    ) {
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window_id = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![
                    container(2),
                    container(3),
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(50.0)),
                            (PropertyId::Overflow, PropertyValue::String("scroll".into())),
                        ],
                    },
                    Command::SetStyle {
                        id: 3,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(200.0)),
                        ],
                    },
                    insert(1, 2),
                    insert(2, 3),
                ],
            )
            .unwrap();

        let runtime_state = RuntimeStateRegistry::default();
        let first = request_scroll_offset(&runtime_state, 2);
        let (view, cx) = cx.add_window_view({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| QueryLayoutTestView {
                tree,
                runtime_state,
                window_id,
            }
        });
        finish_test_frames(cx);
        assert_eq!(first.try_recv().unwrap().unwrap(), ScrollOffset::default());

        scroll(&runtime_state, 2, 60.0, false);
        let scrolled = request_scroll_offset(&runtime_state, 2);
        let measured = request_measure(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(
            scrolled.try_recv().unwrap().unwrap(),
            ScrollOffset { x: 0.0, y: 60.0 }
        );
        let measured = measured.try_recv().unwrap().unwrap();
        assert_eq!(measured.scroll_height, 200.0);

        for overflow in ["hidden", "auto", "scroll"] {
            tree.borrow_mut()
                .apply_commands(
                    window_id,
                    vec![Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(50.0)),
                            (PropertyId::Overflow, PropertyValue::String(overflow.into())),
                        ],
                    }],
                )
                .unwrap();
            let offset = request_scroll_offset(&runtime_state, 2);
            view.update(cx, |_, cx| cx.notify());
            finish_test_frames(cx);
            assert_eq!(offset.try_recv().unwrap().unwrap().y, 60.0);
        }

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![Command::SetStyle {
                    id: 2,
                    properties: vec![
                        (PropertyId::Width, PropertyValue::Number(100.0)),
                        (PropertyId::Height, PropertyValue::Number(50.0)),
                        (
                            PropertyId::Overflow,
                            PropertyValue::String("visible".into()),
                        ),
                    ],
                }],
            )
            .unwrap();
        let released = request_scroll_offset(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(
            released.try_recv().unwrap().unwrap(),
            ScrollOffset::default()
        );

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![Command::SetStyle {
                    id: 2,
                    properties: vec![
                        (PropertyId::Width, PropertyValue::Number(100.0)),
                        (PropertyId::Height, PropertyValue::Number(50.0)),
                        (PropertyId::Overflow, PropertyValue::String("scroll".into())),
                    ],
                }],
            )
            .unwrap();
        let recreated = request_scroll_offset(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(
            recreated.try_recv().unwrap().unwrap(),
            ScrollOffset::default()
        );

        scroll(&runtime_state, 2, 30.0, false);
        tree.borrow_mut()
            .apply_commands(window_id, vec![remove(1, 2)])
            .unwrap();
        let detached = request_scroll_offset(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(detached.try_recv().unwrap().unwrap().y, 30.0);

        tree.borrow_mut()
            .apply_commands(window_id, vec![insert(1, 2)])
            .unwrap();
        let reattached = request_scroll_offset(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(reattached.try_recv().unwrap().unwrap().y, 30.0);
    }

    #[gpui::test]
    fn hidden_allows_programmatic_scroll_while_clip_cannot_reveal_descendants(
        cx: &mut TestAppContext,
    ) {
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window_id = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![
                    container(2),
                    container(3),
                    container(4),
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Display, PropertyValue::String("flex".into())),
                            (
                                PropertyId::FlexDirection,
                                PropertyValue::String("column".into()),
                            ),
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(50.0)),
                            (PropertyId::Overflow, PropertyValue::String("hidden".into())),
                        ],
                    },
                    Command::SetStyle {
                        id: 3,
                        properties: vec![
                            (PropertyId::Height, PropertyValue::Number(120.0)),
                            (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
                        ],
                    },
                    Command::SetStyle {
                        id: 4,
                        properties: vec![
                            (PropertyId::Height, PropertyValue::Number(20.0)),
                            (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
                        ],
                    },
                    insert(1, 2),
                    insert(2, 3),
                    insert(2, 4),
                ],
            )
            .unwrap();

        let runtime_state = RuntimeStateRegistry::default();
        let (view, cx) = cx.add_window_view({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| QueryLayoutTestView {
                tree,
                runtime_state,
                window_id,
            }
        });
        finish_test_frames(cx);

        runtime_state.enqueue_layout(LayoutOperation::Scroll(
            2,
            OverflowValue::Hidden,
            0.0,
            40.0,
            false,
        ));
        let hidden = request_scroll_offset(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(hidden.try_recv().unwrap().unwrap().y, 40.0);

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![Command::SetStyle {
                    id: 2,
                    properties: vec![
                        (PropertyId::Display, PropertyValue::String("flex".into())),
                        (
                            PropertyId::FlexDirection,
                            PropertyValue::String("column".into()),
                        ),
                        (PropertyId::Width, PropertyValue::Number(100.0)),
                        (PropertyId::Height, PropertyValue::Number(50.0)),
                        (PropertyId::Overflow, PropertyValue::String("clip".into())),
                    ],
                }],
            )
            .unwrap();
        let before = request_measure(&runtime_state, 4);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        let before = before.try_recv().unwrap().unwrap();
        assert!(runtime_state.scroll_handle(2).is_none());
        assert!(
            before.y >= 120.0,
            "target must begin outside the clipped viewport"
        );

        request_scroll_into_view(&runtime_state, 4);
        let after = request_measure(&runtime_state, 4);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(after.try_recv().unwrap().unwrap(), before);
        assert!(runtime_state.scroll_handle(2).is_none());
    }

    #[gpui::test]
    fn anchored_content_uses_parent_slot_and_deferred_painted_bounds(cx: &mut TestAppContext) {
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window,
                vec![
                    container(2),
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (
                                PropertyId::Position,
                                PropertyValue::String("absolute".into()),
                            ),
                            (PropertyId::Left, PropertyValue::Number(100.0)),
                            (PropertyId::Top, PropertyValue::Number(100.0)),
                            (PropertyId::Width, PropertyValue::Number(200.0)),
                            (PropertyId::Height, PropertyValue::Number(100.0)),
                        ],
                    },
                    Command::CreateNode {
                        id: 3,
                        kind: ElementKind::Anchored,
                    },
                    Command::SetStyle {
                        id: 3,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(40.0)),
                            (PropertyId::Height, PropertyValue::Number(20.0)),
                        ],
                    },
                    insert(1, 2),
                    insert(2, 3),
                ],
            )
            .unwrap();

        let runtime_state = RuntimeStateRegistry::default();
        let (view, cx) = cx.add_window_view({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| QueryLayoutTestView {
                tree,
                runtime_state,
                window_id: window,
            }
        });
        finish_test_frames(cx);

        let parent = cx.debug_bounds("retend-node-2").unwrap();
        for (side, align) in [
            ("top", "start"),
            ("top", "center"),
            ("top", "end"),
            ("right", "start"),
            ("right", "center"),
            ("right", "end"),
            ("bottom", "start"),
            ("bottom", "center"),
            ("bottom", "end"),
            ("left", "start"),
            ("left", "center"),
            ("left", "end"),
        ] {
            tree.borrow_mut()
                .apply_commands(
                    window,
                    vec![
                        Command::SetProperty {
                            id: 3,
                            property: PropertyId::AnchoredSide,
                            value: PropertyValue::String(side.into()),
                        },
                        Command::SetProperty {
                            id: 3,
                            property: PropertyId::AnchoredAlign,
                            value: PropertyValue::String(align.into()),
                        },
                        Command::SetProperty {
                            id: 3,
                            property: PropertyId::AnchoredGap,
                            value: PropertyValue::Number(5.0),
                        },
                    ],
                )
                .unwrap();
            let measured = request_measure(&runtime_state, 3);
            view.update(cx, |_, cx| cx.notify());
            finish_test_frames(cx);

            let floating = cx.debug_bounds("retend-node-3").unwrap();
            let aligned_x = match align {
                "start" => parent.left(),
                "center" => parent.left() + (parent.size.width - floating.size.width) / 2.0,
                "end" => parent.right() - floating.size.width,
                _ => unreachable!(),
            };
            let aligned_y = match align {
                "start" => parent.top(),
                "center" => parent.top() + (parent.size.height - floating.size.height) / 2.0,
                "end" => parent.bottom() - floating.size.height,
                _ => unreachable!(),
            };
            let expected = match side {
                "top" => point(aligned_x, parent.top() - floating.size.height - px(5.0)),
                "right" => point(parent.right() + px(5.0), aligned_y),
                "bottom" => point(aligned_x, parent.bottom() + px(5.0)),
                "left" => point(parent.left() - floating.size.width - px(5.0), aligned_y),
                _ => unreachable!(),
            };
            assert_eq!(floating.origin, expected, "{side}/{align}");
            let measured = measured.try_recv().unwrap().unwrap();
            assert_eq!(
                (measured.x, measured.y),
                (
                    f64::from(f32::from(expected.x)),
                    f64::from(f32::from(expected.y))
                )
            );
        }

        tree.borrow_mut()
            .apply_commands(
                window,
                vec![
                    Command::SetProperty {
                        id: 3,
                        property: PropertyId::AnchoredSide,
                        value: PropertyValue::String("bottom".into()),
                    },
                    Command::SetProperty {
                        id: 3,
                        property: PropertyId::AnchoredAlign,
                        value: PropertyValue::String("start".into()),
                    },
                    Command::SetProperty {
                        id: 3,
                        property: PropertyId::AnchoredOffset,
                        value: PropertyValue::Point(7.0, -3.0),
                    },
                    Command::SetProperty {
                        id: 3,
                        property: PropertyId::AnchoredDeferred,
                        value: PropertyValue::Boolean(false),
                    },
                ],
            )
            .unwrap();
        let measured = request_measure(&runtime_state, 3);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        let floating = cx.debug_bounds("retend-node-3").unwrap();
        assert_eq!(
            floating.origin,
            point(parent.left() + px(7.0), parent.bottom() + px(2.0))
        );
        assert_eq!(measured.try_recv().unwrap().unwrap().width, 40.0);
    }

    #[gpui::test]
    fn anchored_collision_modes_apply_snap_margin_and_switch_anchor(cx: &mut TestAppContext) {
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window,
                vec![
                    Command::CreateNode {
                        id: 2,
                        kind: ElementKind::Anchored,
                    },
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(40.0)),
                            (PropertyId::Height, PropertyValue::Number(20.0)),
                        ],
                    },
                    insert(1, 2),
                ],
            )
            .unwrap();

        let runtime_state = RuntimeStateRegistry::default();
        let (view, cx) = cx.add_window_view({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| QueryLayoutTestView {
                tree,
                runtime_state,
                window_id: window,
            }
        });
        finish_test_frames(cx);
        let viewport = cx.update(|window, _| window.viewport_size());
        let x = f32::from(viewport.width) - 2.0;
        let y = f32::from(viewport.height) - 2.0;

        tree.borrow_mut()
            .apply_commands(
                window,
                vec![
                    Command::SetProperty {
                        id: 2,
                        property: PropertyId::AnchoredPosition,
                        value: PropertyValue::Point(f64::from(x), f64::from(y)),
                    },
                    Command::SetProperty {
                        id: 2,
                        property: PropertyId::AnchoredFit,
                        value: PropertyValue::String("snap".into()),
                    },
                    Command::SetProperty {
                        id: 2,
                        property: PropertyId::AnchoredSnapMargin,
                        value: PropertyValue::Number(12.0),
                    },
                ],
            )
            .unwrap();
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(
            cx.debug_bounds("retend-node-2").unwrap().origin,
            point(viewport.width - px(52.0), viewport.height - px(32.0))
        );

        tree.borrow_mut()
            .apply_commands(
                window,
                vec![Command::SetProperty {
                    id: 2,
                    property: PropertyId::AnchoredFit,
                    value: PropertyValue::String("switch".into()),
                }],
            )
            .unwrap();
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(
            cx.debug_bounds("retend-node-2").unwrap().origin,
            point(viewport.width - px(42.0), viewport.height - px(22.0))
        );
    }

    #[gpui::test]
    fn transforms_preserve_layout_and_hit_test_in_window_coordinates(cx: &mut TestAppContext) {
        cx.update(init);
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        let target_id = root_id + 1;
        let window = {
            let mut tree = crate::runtime()
                .lock()
                .expect("global native tree must remain available in render tests");
            let window = tree.create_window(root_id).unwrap();
            tree.apply_commands(
                window,
                vec![
                    container(target_id),
                    Command::SetStyle {
                        id: target_id,
                        properties: vec![
                            (
                                PropertyId::Position,
                                PropertyValue::String("absolute".into()),
                            ),
                            (PropertyId::Left, PropertyValue::Number(20.0)),
                            (PropertyId::Top, PropertyValue::Number(100.0)),
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(40.0)),
                            (PropertyId::Translate, PropertyValue::Number(150.0)),
                            (PropertyId::Rotate, PropertyValue::String("90deg".into())),
                        ],
                    },
                    Command::SubscribeEvent {
                        id: target_id,
                        event: NativeEventId::Click,
                    },
                    insert(root_id, target_id),
                ],
            )
            .unwrap();
            window
        };

        let runtime_state = RuntimeStateRegistry::default();
        let (view, cx) = cx.add_window_view({
            let runtime_state = runtime_state.clone();
            move |_, _| GlobalTreeTestView {
                runtime_state,
                window_id: window,
                root_id,
            }
        });
        finish_test_frames(cx);

        // Layout is untouched: painting and hit-testing are the only transformed parts.
        let measured = request_measure(&runtime_state, target_id);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        let measured = measured.try_recv().unwrap().unwrap();
        assert_eq!((measured.x, measured.y), (20.0, 100.0));
        assert_eq!((measured.width, measured.height), (100.0, 40.0));
        crate::events::take_test_emitted_events();

        // A 90deg turn about the border-box center (70, 120) plus a 150px shift
        // moves the center to (220, 120) and swaps the axes.
        cx.simulate_click(point(px(220.0), px(160.0)), Modifiers::default());
        finish_test_frames(cx);
        let clicks: Vec<_> = crate::events::take_test_emitted_events()
            .into_iter()
            .filter(|(_, event)| event.event_id == NativeEventId::Click as u16)
            .collect();
        assert_eq!(clicks.len(), 1);
        assert_eq!(clicks[0].1.target_id, target_id);
        assert!((clicks[0].1.client_x - 220.0).abs() < 0.01);
        assert!((clicks[0].1.client_y - 160.0).abs() < 0.01);

        // The untransformed layout position is no longer over the element.
        cx.simulate_click(point(px(70.0), px(120.0)), Modifiers::default());
        finish_test_frames(cx);
        assert!(
            crate::events::take_test_emitted_events()
                .into_iter()
                .all(|(_, event)| event.event_id != NativeEventId::Click as u16),
            "hit-testing must follow the painted transform, not the layout rect"
        );

        crate::runtime()
            .lock()
            .expect("global native tree must remain available in render tests")
            .close_window(window);
    }

    #[gpui::test]
    fn anchored_occlusion_blocks_hit_testing_behind_surface(cx: &mut TestAppContext) {
        cx.update(init);
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        let target_id = root_id + 1;
        let anchored_id = root_id + 2;
        let window_id = {
            let mut tree = crate::runtime()
                .lock()
                .expect("global native tree must remain available in render tests");
            let window_id = tree.create_window(root_id).unwrap();
            tree.apply_commands(
                window_id,
                vec![
                    container(target_id),
                    Command::SetStyle {
                        id: target_id,
                        properties: vec![
                            (
                                PropertyId::Position,
                                PropertyValue::String("absolute".into()),
                            ),
                            (PropertyId::Left, PropertyValue::Number(120.0)),
                            (PropertyId::Top, PropertyValue::Number(120.0)),
                            (PropertyId::Width, PropertyValue::Number(80.0)),
                            (PropertyId::Height, PropertyValue::Number(80.0)),
                        ],
                    },
                    Command::SubscribeEvent {
                        id: target_id,
                        event: NativeEventId::Click,
                    },
                    Command::CreateNode {
                        id: anchored_id,
                        kind: ElementKind::Anchored,
                    },
                    Command::SetProperty {
                        id: anchored_id,
                        property: PropertyId::AnchoredPosition,
                        value: PropertyValue::Point(120.0, 120.0),
                    },
                    Command::SetStyle {
                        id: anchored_id,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(80.0)),
                            (PropertyId::Height, PropertyValue::Number(80.0)),
                        ],
                    },
                    insert(root_id, target_id),
                    insert(root_id, anchored_id),
                ],
            )
            .unwrap();
            window_id
        };

        let runtime_state = RuntimeStateRegistry::default();
        let (view, cx) = cx.add_window_view({
            let runtime_state = runtime_state.clone();
            move |_, _| GlobalTreeTestView {
                runtime_state,
                window_id,
                root_id,
            }
        });
        finish_test_frames(cx);
        crate::events::take_test_emitted_events();
        let click = point(px(140.0), px(140.0));
        cx.simulate_click(click, Modifiers::default());
        finish_test_frames(cx);
        assert!(crate::events::take_test_emitted_events()
            .into_iter()
            .all(|(_, event)| event.event_id != NativeEventId::Click as u16));

        crate::runtime()
            .lock()
            .expect("global native tree must remain available in render tests")
            .apply_commands(
                window_id,
                vec![Command::SetProperty {
                    id: anchored_id,
                    property: PropertyId::AnchoredOcclude,
                    value: PropertyValue::Boolean(false),
                }],
            )
            .unwrap();
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        crate::events::take_test_emitted_events();
        cx.simulate_click(click, Modifiers::default());
        finish_test_frames(cx);
        let clicks: Vec<_> = crate::events::take_test_emitted_events()
            .into_iter()
            .filter(|(_, event)| event.event_id == NativeEventId::Click as u16)
            .collect();
        assert_eq!(clicks.len(), 1);
        assert_eq!(clicks[0].1.target_id, target_id);

        crate::runtime()
            .lock()
            .expect("global native tree must remain available in render tests")
            .close_window(window_id);
    }

    #[gpui::test]
    fn image_load_and_error_events_fire_once(cx: &mut TestAppContext) {
        cx.update(init);
        cx.update(|cx| {
            cx.set_http_client(gpui::http_client::FakeHttpClient::create(|req| async move {
                if req.uri().path().contains("ok") {
                    Ok(gpui::http_client::Response::builder()
                        .status(200)
                        .body(
                            "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\"><rect width=\"10\" height=\"10\" fill=\"red\"/></svg>"
                                .into(),
                        )
                        .unwrap())
                } else {
                    Ok(gpui::http_client::Response::builder()
                        .status(404)
                        .body(Default::default())
                        .unwrap())
                }
            }));
        });
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window_id = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![
                    Command::CreateNode {
                        id: 2,
                        kind: ElementKind::Image,
                    },
                    Command::SetProperty {
                        id: 2,
                        property: PropertyId::Src,
                        value: PropertyValue::String("https://example.com/ok.svg".into()),
                    },
                    Command::SubscribeEvent {
                        id: 2,
                        event: NativeEventId::Load,
                    },
                    Command::CreateNode {
                        id: 3,
                        kind: ElementKind::Image,
                    },
                    Command::SetProperty {
                        id: 3,
                        property: PropertyId::Src,
                        value: PropertyValue::String("https://example.com/bad.png".into()),
                    },
                    Command::SubscribeEvent {
                        id: 3,
                        event: NativeEventId::Error,
                    },
                    insert(1, 2),
                    insert(1, 3),
                ],
            )
            .unwrap();

        let runtime_state = RuntimeStateRegistry::default();
        let (view, cx) = cx.add_window_view({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| QueryLayoutTestView {
                tree,
                runtime_state,
                window_id,
            }
        });
        crate::events::take_test_emitted_events();
        finish_test_frames(cx);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        let events = crate::events::take_test_emitted_events();
        assert!(events.iter().any(|(_, event)| {
            event.target_id == 2 && event.event_id == NativeEventId::Load as u16
        }));
        assert!(events.iter().any(|(_, event)| {
            event.target_id == 3 && event.event_id == NativeEventId::Error as u16
        }));

        // Terminal states must not re-emit on later frames.
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert!(crate::events::take_test_emitted_events().is_empty());
    }
}
