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
    wheel,
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
    | event_bit(NativeEventId::ContextMenu)
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

/// Browsers fire a mouse-triggered `contextmenu` on the secondary-button press
/// on macOS and Linux, and on its release on Windows.
const CONTEXT_MENU_ON_PRESS: bool = !cfg!(target_os = "windows");

fn emit_mouse_down(
    window_id: WindowId,
    target_id: NodeId,
    event: &MouseDownEvent,
    window: &mut Window,
    cx: &mut App,
) {
    let (subscriptions, outside, changed) = crate::runtime()
        .lock()
        .map(|mut tree| {
            let changed =
                event.button == MouseButton::Left && tree.press_node(window_id, target_id);
            (
                tree.subscription_mask_in_path(window_id, target_id),
                tree.outside_subscribers(window_id, target_id),
                changed,
            )
        })
        .unwrap_or_default();
    if changed {
        window.refresh();
    }
    let subscribed = subscriptions & event_bit(NativeEventId::MouseDown) != 0;
    // Where the press is the trigger, `contextmenu` is emitted from this same
    // listener, after `mousedown` as on the web. GPUI runs a node's mouse
    // listeners in reverse registration order and stops at the first
    // `stop_propagation`, so a separate listener would fire first and could
    // swallow `mousedown`. macOS ctrl-click arrives here as a right press.
    let context_menu = CONTEXT_MENU_ON_PRESS
        && event.button == MouseButton::Right
        && subscriptions & event_bit(NativeEventId::ContextMenu) != 0;
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
    if context_menu {
        events::emit(
            window_id,
            events::in_window(
                events::mouse_down(NativeEventId::ContextMenu, target_id, event),
                window,
            ),
        );
    }
    if subscribed || !outside.is_empty() || context_menu {
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

fn emit_aux_click(
    window_id: WindowId,
    target_id: NodeId,
    event: &ClickEvent,
    window: &Window,
    cx: &mut App,
) {
    // GPUI routes every non-primary button through `on_aux_click`; only a
    // secondary activation (right-button press/release, macOS ctrl-click, or
    // touch long-press) maps onto the web `contextmenu` event. Middle-clicks
    // and navigation buttons are intentionally ignored here. Keyboard
    // triggers never produce a `ClickEvent` (`is_secondary()` is always false
    // for them), so they are handled on the key-down path by `emit_key_down`.
    if !event.is_secondary() {
        return;
    }
    // Aux clicks complete on release. Where the press is the trigger, the
    // mouse case was already emitted by `emit_mouse_down`; only touch
    // long-presses, which have no press to report, are emitted here.
    if CONTEXT_MENU_ON_PRESS && matches!(event, ClickEvent::Mouse(_)) {
        return;
    }
    if event_interest(window_id, target_id, NativeEventId::ContextMenu) {
        let payload = events::click(NativeEventId::ContextMenu, target_id, event);
        events::emit(window_id, events::in_window(payload, window));
        cx.stop_propagation();
    }
}

/// Web `contextmenu` also fires from the keyboard: the Windows
/// menu/application key (GPUI keystroke `"menu"`, sourced from `VK_APPS`)
/// and the Shift+F10 accelerator.
fn is_context_menu_key(keystroke: &gpui::Keystroke) -> bool {
    let modifiers = keystroke.modifiers;
    match keystroke.key.as_str() {
        "menu" => !modifiers.modified(),
        "f10" => modifiers.shift && modifiers.number_of_modifiers() == 1,
        _ => false,
    }
}

fn emit_key_down(
    window_id: WindowId,
    target_id: NodeId,
    event: &KeyDownEvent,
    runtime: &RuntimeStateRegistry,
    cx: &mut App,
) {
    // `keydown` and keyboard `contextmenu` share one listener. GPUI calls a
    // node's key listeners in registration order and stops at the first
    // `stop_propagation`, so separate listeners would let one event swallow
    // the other. One listener also keeps web order: `keydown` first.
    let subscriptions = crate::runtime()
        .lock()
        .map(|tree| tree.subscription_mask_in_path(window_id, target_id))
        .unwrap_or_default();
    let key_down = subscriptions & event_bit(NativeEventId::KeyDown) != 0;
    // Auto-repeat must not reopen the menu on every repeated key-down.
    let context_menu = subscriptions & event_bit(NativeEventId::ContextMenu) != 0
        && !event.is_held
        && is_context_menu_key(&event.keystroke);
    if key_down {
        events::emit(
            window_id,
            events::key_event(
                NativeEventId::KeyDown,
                target_id,
                &event.keystroke,
                event.is_held,
            ),
        );
    }
    if context_menu {
        // No pointer is involved, so anchor at the bottom-left of the target's
        // painted client box (the rect `measure` reports, transforms
        // included), as GPUI does for keyboard `ClickEvent`s. This listener
        // only exists on an element painted in the current frame, and that
        // paint recorded its geometry; if it is missing, that invariant broke.
        // Report it and drop the event rather than invent a position.
        match runtime.client_bounds(target_id) {
            Some(bounds) => events::emit(
                window_id,
                events::mouse_event(
                    NativeEventId::ContextMenu,
                    target_id,
                    bounds.bottom_left(),
                    event.keystroke.modifiers,
                ),
            ),
            None => eprintln!(
                "[retend-gpui] keyboard contextmenu for node {target_id} dropped: \
                 the focused element has no painted geometry"
            ),
        }
    }
    if key_down || context_menu {
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
    } else {
        if pseudo.active {
            element = element.on_mouse_down(MouseButton::Left, move |event, window, cx| {
                emit_mouse_down(window_id, id, event, window, cx)
            });
        }
        if CONTEXT_MENU_ON_PRESS && interest.has(NativeEventId::ContextMenu) {
            element = element.on_mouse_down(MouseButton::Right, move |event, window, cx| {
                emit_mouse_down(window_id, id, event, window, cx)
            });
        }
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
    if interest.has(NativeEventId::ContextMenu) {
        element = element
            .on_aux_click(move |event, window, cx| emit_aux_click(window_id, id, event, window, cx));
    }
    if pseudo.hover
        || interest.has(NativeEventId::MouseEnter)
        || interest.has(NativeEventId::MouseLeave)
    {
        element =
            element.on_hover(move |hovered, window, _| emit_hover(window_id, id, *hovered, window));
    }
    if interest.has(NativeEventId::KeyDown) || interest.has(NativeEventId::ContextMenu) {
        let runtime = runtime.clone();
        element = element
            .on_key_down(move |event, _, cx| emit_key_down(window_id, id, event, &runtime, cx));
    }
    if interest.has(NativeEventId::KeyUp) {
        element = element.on_key_up(move |event, _, cx| emit_key_up(window_id, id, event, cx));
    }
    element
}

/// The accessible name for `img`/`svg`, following HTML's `alt` rule: missing
/// or empty `alt` marks the element decorative, so it gets no image role
/// and stays out of the accessibility tree.
fn accessible_label(alt: Option<&str>) -> Option<&str> {
    alt.filter(|alt| !alt.is_empty())
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
                    window_transform(window),
                    bottom_right.map(|bottom_right| bottom_right - bounds.origin),
                );
            }
        }
    }
}

/// The layout-to-window transform active for the element being painted: its
/// own CSS transform composed with its ancestors'. GPUI keeps the matrix
/// private, but `point_to_window` applies it and is affine, so three probes
/// recover it exactly (an untransformed element yields the unit matrix).
fn window_transform(window: &Window) -> gpui::TransformationMatrix {
    let origin = window.point_to_window(gpui::point(px(0.0), px(0.0)));
    let x_axis = window.point_to_window(gpui::point(px(1.0), px(0.0))) - origin;
    let y_axis = window.point_to_window(gpui::point(px(0.0), px(1.0))) - origin;
    gpui::TransformationMatrix {
        rotation_scale: [
            [f32::from(x_axis.x), f32::from(y_axis.x)],
            [f32::from(x_axis.y), f32::from(y_axis.y)],
        ],
        translation: [f32::from(origin.x), f32::from(origin.y)],
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
            if let Some(label) = accessible_label(alt.as_deref()) {
                image = image.role(Role::Image).aria_label(label.to_string());
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
        NodeData::Svg {
            path,
            alt,
            content,
            ..
        } => {
            // 16px matches body text; author width/height override it. The
            // icon paints in the inherited text color (CSS `currentColor`).
            let mut icon = gpui::svg().size(px(16.));
            if let Some(content) = content {
                icon = icon.shared_data(content.key.clone(), content.markup.clone());
            } else if let Some(path) = path {
                icon = icon.external_path(path.to_string_lossy().into_owned());
            }
            let icon = match resolved_style {
                Some(style) => style.apply(icon),
                None => icon,
            };
            #[cfg(test)]
            let icon = icon.debug_selector(move || format!("retend-node-{id}"));
            let mut icon = icon.id(ElementId::Integer(u64::from(id)));
            if let Some(label) = accessible_label(alt.as_deref()) {
                icon = icon.role(Role::Image).aria_label(label.to_string());
            }
            with_native_events(
                icon,
                interest,
                node.window_id,
                id,
                runtime_state,
                pseudo,
            )
            .into_any_element()
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

    let element = if interest.has(NativeEventId::Wheel) {
        wheel::observe(element, window_id, id)
    } else {
        element
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

    fn assert_measured(measured: Measurement, expected: (f64, f64, f64, f64)) {
        let actual = (measured.x, measured.y, measured.width, measured.height);
        let close = |a: f64, b: f64| (a - b).abs() < 0.01;
        assert!(
            close(actual.0, expected.0)
                && close(actual.1, expected.1)
                && close(actual.2, expected.2)
                && close(actual.3, expected.3),
            "measured {actual:?}, expected {expected:?}"
        );
    }

    #[gpui::test]
    fn scaled_ancestor_and_translated_child_measure_like_bounding_client_rect(
        cx: &mut TestAppContext,
    ) {
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        let parent_id = root_id + 1;
        let child_id = root_id + 2;
        let (window_id, runtime_state, cx) = open_global_window(
            cx,
            root_id,
            vec![
                container(parent_id),
                // 100x100 at (100, 100), scaled 2x about its center (150, 150).
                Command::SetStyle {
                    id: parent_id,
                    properties: vec![
                        (
                            PropertyId::Position,
                            PropertyValue::String("absolute".into()),
                        ),
                        (PropertyId::Left, PropertyValue::Number(100.0)),
                        (PropertyId::Top, PropertyValue::Number(100.0)),
                        (PropertyId::Width, PropertyValue::Number(100.0)),
                        (PropertyId::Height, PropertyValue::Number(100.0)),
                        (PropertyId::Scale, PropertyValue::String("2".into())),
                    ],
                },
                container(child_id),
                Command::SetStyle {
                    id: child_id,
                    properties: vec![
                        (
                            PropertyId::Position,
                            PropertyValue::String("absolute".into()),
                        ),
                        (PropertyId::Left, PropertyValue::Number(10.0)),
                        (PropertyId::Top, PropertyValue::Number(10.0)),
                        (PropertyId::Width, PropertyValue::Number(20.0)),
                        (PropertyId::Height, PropertyValue::Number(20.0)),
                        (
                            PropertyId::Translate,
                            PropertyValue::String("5px 0px".into()),
                        ),
                    ],
                },
                focusable(child_id),
                subscribe(child_id, NativeEventId::ContextMenu),
                insert(root_id, parent_id),
                insert(parent_id, child_id),
            ],
        );

        let parent = request_measure(&runtime_state, parent_id);
        let child = request_measure(&runtime_state, child_id);
        cx.update(|window, _| window.refresh());
        finish_test_frames(cx);
        // Parent: 100x100 at (100, 100) scaled 2x about (150, 150).
        assert_measured(parent.try_recv().unwrap().unwrap(), (50.0, 50.0, 200.0, 200.0));
        // Child layout (110, 110, 20x20), shifted 5px right, then scaled with
        // the parent: (115 - 150) * 2 + 150 = 80, (110 - 150) * 2 + 150 = 70.
        let child = child.try_recv().unwrap().unwrap();
        assert_measured(child, (80.0, 70.0, 40.0, 40.0));

        // The keyboard `contextmenu` anchor is the same client rect's bottom-left.
        focus_node(cx, &runtime_state, child_id);
        cx.simulate_keystrokes("shift-f10");
        let menu = crate::events::take_test_emitted_events()
            .into_iter()
            .map(|(_, event)| event)
            .find(|event| event.event_id == NativeEventId::ContextMenu as u16)
            .expect("shift-f10 must emit contextmenu");
        assert!((menu.client_x - child.x).abs() < 0.01);
        assert!((menu.client_y - (child.y + child.height)).abs() < 0.01);

        close_global_window(window_id);
    }

    #[gpui::test]
    fn scroll_into_view_reveals_the_painted_box(cx: &mut TestAppContext) {
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
                            (PropertyId::Overflow, PropertyValue::String("scroll".into())),
                        ],
                    },
                    // Laid out at the top of the viewport, painted 100px lower.
                    Command::SetStyle {
                        id: 3,
                        properties: vec![
                            (PropertyId::Height, PropertyValue::Number(20.0)),
                            (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
                            (
                                PropertyId::Translate,
                                PropertyValue::String("0px 100px".into()),
                            ),
                        ],
                    },
                    Command::SetStyle {
                        id: 4,
                        properties: vec![
                            (PropertyId::Height, PropertyValue::Number(200.0)),
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

        // Painted at 100..120 in a 50px viewport: scroll by 120 - 50 = 70.
        request_scroll_into_view(&runtime_state, 3);
        let offset = request_scroll_offset(&runtime_state, 2);
        let measured = request_measure(&runtime_state, 3);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(offset.try_recv().unwrap().unwrap().y, 70.0);
        // After scrolling, the painted box sits at the bottom of the viewport.
        let measured = measured.try_recv().unwrap().unwrap();
        assert!((measured.y + measured.height - 50.0).abs() < 0.01);
    }

    /// A 100x100 scroll container (node 2) holding a 20x20 target (node 4)
    /// below a `lead`-px spacer (node 3), followed by a 200px spacer (node 5).
    fn scroll_into_view_fixture(
        viewport_style: (PropertyId, &str),
        lead: f64,
    ) -> (Rc<RefCell<NativeTree>>, WindowId) {
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window_id = tree.borrow_mut().create_window(1).unwrap();
        let fixed = |id, height| Command::SetStyle {
            id,
            properties: vec![
                (PropertyId::Width, PropertyValue::Number(20.0)),
                (PropertyId::Height, PropertyValue::Number(height)),
                (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
            ],
        };
        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![
                    container(2),
                    container(3),
                    container(4),
                    container(5),
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Display, PropertyValue::String("flex".into())),
                            (
                                PropertyId::FlexDirection,
                                PropertyValue::String("column".into()),
                            ),
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(100.0)),
                            (PropertyId::Overflow, PropertyValue::String("scroll".into())),
                            (
                                viewport_style.0,
                                PropertyValue::String(viewport_style.1.into()),
                            ),
                        ],
                    },
                    fixed(3, lead),
                    fixed(4, 20.0),
                    fixed(5, 200.0),
                    insert(1, 2),
                    insert(2, 3),
                    insert(2, 4),
                    insert(2, 5),
                ],
            )
            .unwrap();
        (tree, window_id)
    }

    fn scroll_offset_after_scroll_into_view(
        cx: &mut TestAppContext,
        tree: Rc<RefCell<NativeTree>>,
        window_id: WindowId,
    ) -> f64 {
        let runtime_state = RuntimeStateRegistry::default();
        let (view, cx) = cx.add_window_view({
            let runtime_state = runtime_state.clone();
            move |_, _| QueryLayoutTestView {
                tree,
                runtime_state,
                window_id,
            }
        });
        finish_test_frames(cx);
        request_scroll_into_view(&runtime_state, 4);
        let offset = request_scroll_offset(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        offset.try_recv().unwrap().unwrap().y
    }

    #[gpui::test]
    fn scroll_into_view_leaves_visible_content_in_a_rotated_viewport(cx: &mut TestAppContext) {
        // The target sits at 75..95 of a 100px viewport: already visible. The
        // viewport is rotated 45deg, so its window-space bounding box, bounded
        // again after mapping back, would reach past 100 and scroll by ~5.
        let (tree, window_id) =
            scroll_into_view_fixture((PropertyId::Rotate, "45deg"), 75.0);
        assert_eq!(
            scroll_offset_after_scroll_into_view(cx, tree, window_id),
            0.0
        );
    }

    #[gpui::test]
    fn scroll_into_view_skips_a_viewport_with_a_singular_transform(cx: &mut TestAppContext) {
        // The target is laid out below the viewport, but `scale: 0` collapses
        // the viewport and its content: there is no painted position to
        // reveal, so layout coordinates must not be used as a substitute.
        let (tree, window_id) = scroll_into_view_fixture((PropertyId::Scale, "0"), 150.0);
        assert_eq!(
            scroll_offset_after_scroll_into_view(cx, tree, window_id),
            0.0
        );
    }

    #[gpui::test]
    fn programmatic_scroll_moves_scaled_descendants_by_the_scroll_distance(
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
                            (PropertyId::Overflow, PropertyValue::String("scroll".into())),
                        ],
                    },
                    // 100x20 at the top, scaled 2x about its own center.
                    Command::SetStyle {
                        id: 3,
                        properties: vec![
                            (PropertyId::Height, PropertyValue::Number(20.0)),
                            (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
                            (PropertyId::Scale, PropertyValue::String("2".into())),
                        ],
                    },
                    Command::SetStyle {
                        id: 4,
                        properties: vec![
                            (PropertyId::Height, PropertyValue::Number(200.0)),
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

        let before = request_measure(&runtime_state, 3);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        let before = before.try_recv().unwrap().unwrap();
        assert_measured(before, (before.x, before.y, 200.0, 40.0));

        // Measured in the same flush as the scroll, before any repaint: the
        // painted box moves by the scroll distance, not by scale x distance.
        scroll(&runtime_state, 2, 10.0, false);
        let shifted = request_measure(&runtime_state, 3);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        let expected = (before.x, before.y - 10.0, 200.0, 40.0);
        assert_measured(shifted.try_recv().unwrap().unwrap(), expected);

        // A fresh paint at the new offset agrees.
        let repainted = request_measure(&runtime_state, 3);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_measured(repainted.try_recv().unwrap().unwrap(), expected);
    }

    #[gpui::test]
    fn transforms_measure_and_hit_test_in_window_coordinates(cx: &mut TestAppContext) {
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

        // A 90deg turn about the border-box center (70, 120) plus a 150px shift
        // moves the center to (220, 120) and swaps the axes. Like
        // `getBoundingClientRect`, `measure` reports that painted box.
        let measured = request_measure(&runtime_state, target_id);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_measured(
            measured.try_recv().unwrap().unwrap(),
            (200.0, 70.0, 40.0, 100.0),
        );
        crate::events::take_test_emitted_events();
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
    fn pointer_events_none_is_subtree_transparent(cx: &mut TestAppContext) {
        let root = NEXT_GLOBAL_TEST_ROOT.fetch_add(16, Ordering::Relaxed);
        let back = root + 1;
        let parent = root + 2;
        let child = root + 3;
        let pointer = |id: NodeId, left: f64, top: f64, size: f64, value: PropertyValue| {
            let Command::SetStyle { mut properties, .. } = absolute_box(id, left, top, size)
            else {
                unreachable!()
            };
            properties.push((PropertyId::PointerEvents, value));
            Command::SetStyle { id, properties }
        };
        let (window_id, _, cx) = open_global_window(
            cx,
            root,
            vec![
                container(back),
                absolute_box(back, 20.0, 20.0, 100.0),
                subscribe(back, NativeEventId::Click),
                insert(root, back),
                container(parent),
                pointer(
                    parent,
                    20.0,
                    20.0,
                    100.0,
                    PropertyValue::String("none".into()),
                ),
                subscribe(parent, NativeEventId::Click),
                container(child),
                pointer(
                    child,
                    0.0,
                    0.0,
                    40.0,
                    PropertyValue::String("auto".into()),
                ),
                subscribe(child, NativeEventId::Click),
                insert(parent, child),
                insert(root, parent),
            ],
        );
        let click = |cx: &mut gpui::VisualTestContext, x: f32, y: f32| {
            crate::events::take_test_emitted_events();
            cx.simulate_click(point(px(x), px(y)), Modifiers::default());
            finish_test_frames(cx);
            emitted(&[NativeEventId::Click])
        };
        let update = |cx: &mut gpui::VisualTestContext, command: Command| {
            crate::runtime()
                .lock()
                .unwrap()
                .apply_commands(window_id, vec![command])
                .unwrap();
            cx.update(|window, _| window.refresh());
            finish_test_frames(cx);
        };
        // `none` on the parent passes through, even where the child says `auto`.
        assert_eq!(
            click(cx, 30.0, 30.0),
            vec![(NativeEventId::Click, back)]
        );
        assert_eq!(
            click(cx, 90.0, 90.0),
            vec![(NativeEventId::Click, back)]
        );
        // `auto` restores targeting for the subtree.
        update(
            cx,
            pointer(
                parent,
                20.0,
                20.0,
                100.0,
                PropertyValue::String("auto".into()),
            ),
        );
        assert_eq!(
            click(cx, 30.0, 30.0),
            vec![(NativeEventId::Click, child)]
        );
        // Removing the declaration restores the default (`auto`) behavior.
        update(
            cx,
            pointer(parent, 20.0, 20.0, 100.0, PropertyValue::Null),
        );
        assert_eq!(
            click(cx, 30.0, 30.0),
            vec![(NativeEventId::Click, child)]
        );
        close_global_window(window_id);
    }

    #[gpui::test]
    fn secondary_mouse_click_emits_context_menu(cx: &mut TestAppContext) {
        cx.update(init);
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        let target_id = root_id + 1;
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
                        event: NativeEventId::ContextMenu,
                    },
                    insert(root_id, target_id),
                ],
            )
            .unwrap();
            window_id
        };

        let runtime_state = RuntimeStateRegistry::default();
        let (_view, cx) = cx.add_window_view({
            let runtime_state = runtime_state.clone();
            move |_, _| GlobalTreeTestView {
                runtime_state,
                window_id,
                root_id,
            }
        });
        finish_test_frames(cx);
        crate::events::take_test_emitted_events();

        // Right-button press/release is a secondary activation: exactly one
        // `contextmenu` carrying the right-button code, and no primary click.
        // It fires on the press on macOS/Linux and on the release on Windows.
        let target = point(px(140.0), px(140.0));
        let menus = |events: &[(WindowId, events::NativeEventPayload)]| -> Vec<_> {
            events
                .iter()
                .filter(|(_, event)| event.event_id == NativeEventId::ContextMenu as u16)
                .map(|(_, event)| (event.target_id, event.button))
                .collect()
        };
        cx.simulate_mouse_down(target, MouseButton::Right, Modifiers::default());
        finish_test_frames(cx);
        let pressed = crate::events::take_test_emitted_events();
        cx.simulate_mouse_up(target, MouseButton::Right, Modifiers::default());
        finish_test_frames(cx);
        let released = crate::events::take_test_emitted_events();
        let one = vec![(target_id, 2)];
        if CONTEXT_MENU_ON_PRESS {
            assert_eq!(menus(&pressed), one, "macOS/Linux fire on press");
            assert!(menus(&released).is_empty(), "and not again on release");
        } else {
            assert!(menus(&pressed).is_empty(), "Windows waits for release");
            assert_eq!(menus(&released), one, "Windows fires on release");
        }
        assert!(
            pressed
                .iter()
                .chain(&released)
                .all(|(_, event)| event.event_id != NativeEventId::Click as u16),
            "secondary clicks must not produce a primary click"
        );

        // Middle-clicks share the aux-click channel but are not secondary
        // activations, so they must not produce `contextmenu`.
        cx.simulate_mouse_down(target, MouseButton::Middle, Modifiers::default());
        cx.simulate_mouse_up(target, MouseButton::Middle, Modifiers::default());
        finish_test_frames(cx);
        assert!(
            crate::events::take_test_emitted_events()
                .into_iter()
                .all(|(_, event)| event.event_id != NativeEventId::ContextMenu as u16),
            "middle-clicks must not produce contextmenu"
        );

        crate::runtime()
            .lock()
            .expect("global native tree must remain available in render tests")
            .close_window(window_id);
    }

    fn absolute_box(id: NodeId, left: f64, top: f64, size: f64) -> Command {
        Command::SetStyle {
            id,
            properties: vec![
                (
                    PropertyId::Position,
                    PropertyValue::String("absolute".into()),
                ),
                (PropertyId::Left, PropertyValue::Number(left)),
                (PropertyId::Top, PropertyValue::Number(top)),
                (PropertyId::Width, PropertyValue::Number(size)),
                (PropertyId::Height, PropertyValue::Number(size)),
            ],
        }
    }

    fn subscribe(id: NodeId, event: NativeEventId) -> Command {
        Command::SubscribeEvent { id, event }
    }

    fn focusable(id: NodeId) -> Command {
        Command::SetProperty {
            id,
            property: PropertyId::TabIndex,
            value: PropertyValue::Number(0.0),
        }
    }

    /// Opens a window over the global tree with `root_id` and the given
    /// commands applied, then drains events emitted by the first frames.
    fn open_global_window(
        cx: &mut TestAppContext,
        root_id: NodeId,
        commands: Vec<Command>,
    ) -> (WindowId, RuntimeStateRegistry, &mut gpui::VisualTestContext) {
        cx.update(init);
        let window_id = {
            let mut tree = crate::runtime()
                .lock()
                .expect("global native tree must remain available in render tests");
            let window_id = tree.create_window(root_id).unwrap();
            tree.apply_commands(window_id, commands).unwrap();
            window_id
        };
        let runtime_state = RuntimeStateRegistry::default();
        let (_view, cx) = cx.add_window_view({
            let runtime_state = runtime_state.clone();
            move |_, _| GlobalTreeTestView {
                runtime_state,
                window_id,
                root_id,
            }
        });
        finish_test_frames(cx);
        crate::events::take_test_emitted_events();
        (window_id, runtime_state, cx)
    }

    #[gpui::test]
    fn wheel_targets_transformed_non_scrollable_descendants_once(cx: &mut TestAppContext) {
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(16, Ordering::Relaxed);
        let parent = root_id + 1;
        let child = root_id + 2;
        let (window_id, _, cx) = open_global_window(
            cx,
            root_id,
            vec![
                container(parent),
                container(child),
                Command::SetStyle {
                    id: parent,
                    properties: vec![
                        (
                            PropertyId::Position,
                            PropertyValue::String("absolute".into()),
                        ),
                        (PropertyId::Left, PropertyValue::Number(100.0)),
                        (PropertyId::Top, PropertyValue::Number(100.0)),
                        (PropertyId::Width, PropertyValue::Number(100.0)),
                        (PropertyId::Height, PropertyValue::Number(100.0)),
                        (PropertyId::Scale, PropertyValue::String("2".into())),
                    ],
                },
                absolute_box(child, 20.0, 20.0, 20.0),
                subscribe(parent, NativeEventId::Wheel),
                subscribe(child, NativeEventId::Wheel),
                insert(root_id, parent),
                insert(parent, child),
            ],
        );
        for phase in [
            gpui::TouchPhase::Started,
            gpui::TouchPhase::Moved,
            gpui::TouchPhase::Ended,
        ] {
            cx.simulate_event(gpui::ScrollWheelEvent {
                position: point(px(110.0), px(110.0)),
                delta: gpui::ScrollDelta::Pixels(point(px(1.5), px(-2.5))),
                touch_phase: phase,
                ..Default::default()
            });
            let emitted = crate::events::take_test_emitted_events();
            let wheels: Vec<_> = emitted
                .iter()
                .filter(|(_, payload)| payload.event_id == NativeEventId::Wheel as u16)
                .collect();
            assert_eq!(wheels.len(), 1);
            let (window, payload) = wheels[0];
            assert_eq!(*window, window_id);
            assert_eq!(payload.target_id, child);
            assert!((payload.client_x - 110.0).abs() < 0.01);
            assert!((payload.client_y - 110.0).abs() < 0.01);
            assert_eq!((payload.delta_x, payload.delta_y), (-1.5, 2.5));
        }
        close_global_window(window_id);
    }

    #[gpui::test]
    fn wheel_observation_preserves_native_scrolling(cx: &mut TestAppContext) {
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(16, Ordering::Relaxed);
        let parent = root_id + 1;
        let child = root_id + 2;
        let (window_id, runtime, cx) = open_global_window(
            cx,
            root_id,
            vec![
                container(parent),
                container(child),
                Command::SetStyle {
                    id: parent,
                    properties: vec![
                        (PropertyId::Width, PropertyValue::Number(100.0)),
                        (PropertyId::Height, PropertyValue::Number(100.0)),
                        (PropertyId::Overflow, PropertyValue::String("auto".into())),
                    ],
                },
                Command::SetStyle {
                    id: child,
                    properties: vec![
                        (PropertyId::Width, PropertyValue::Number(80.0)),
                        (PropertyId::Height, PropertyValue::Number(300.0)),
                        (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
                    ],
                },
                subscribe(parent, NativeEventId::Wheel),
                subscribe(parent, NativeEventId::Scroll),
                insert(root_id, parent),
                insert(parent, child),
            ],
        );
        cx.simulate_event(gpui::ScrollWheelEvent {
            position: point(px(20.0), px(20.0)),
            delta: gpui::ScrollDelta::Pixels(point(px(0.0), px(-25.0))),
            ..Default::default()
        });
        finish_test_frames(cx);
        let emitted = crate::events::take_test_emitted_events();
        let wheels: Vec<_> = emitted
            .iter()
            .filter(|(_, payload)| payload.event_id == NativeEventId::Wheel as u16)
            .collect();
        assert_eq!(wheels.len(), 1);
        assert_eq!(wheels[0].1.target_id, child);
        assert_eq!(wheels[0].1.delta_y, 25.0);
        assert_eq!(runtime.scroll_handle(parent).unwrap().offset().y, px(-25.0));
        assert!(emitted
            .iter()
            .any(|(_, payload)| payload.event_id == NativeEventId::Scroll as u16));
        close_global_window(window_id);
    }

    #[gpui::test]
    fn wheel_targets_front_siblings_and_deferred_overlays(cx: &mut TestAppContext) {
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(16, Ordering::Relaxed);
        let back = root_id + 1;
        let front = root_id + 2;
        let overlay = root_id + 3;
        let (window_id, _, cx) = open_global_window(
            cx,
            root_id,
            vec![
                container(back),
                container(front),
                absolute_box(back, 120.0, 120.0, 80.0),
                absolute_box(front, 120.0, 120.0, 80.0),
                subscribe(root_id, NativeEventId::Wheel),
                insert(root_id, back),
                insert(root_id, front),
            ],
        );
        let input = gpui::ScrollWheelEvent {
            position: point(px(140.0), px(140.0)),
            delta: gpui::ScrollDelta::Lines(point(0.0, -1.0)),
            ..Default::default()
        };
        cx.simulate_event(input.clone());
        let emitted = crate::events::take_test_emitted_events();
        assert_eq!(emitted.len(), 1);
        assert_eq!(emitted[0].1.target_id, front);

        crate::runtime()
            .lock()
            .unwrap()
            .apply_commands(
                window_id,
                vec![
                    Command::CreateNode {
                        id: overlay,
                        kind: ElementKind::Anchored,
                    },
                    Command::SetProperty {
                        id: overlay,
                        property: PropertyId::AnchoredPosition,
                        value: PropertyValue::Point(120.0, 120.0),
                    },
                    Command::SetProperty {
                        id: overlay,
                        property: PropertyId::AnchoredDeferred,
                        value: PropertyValue::Boolean(true),
                    },
                    Command::SetStyle {
                        id: overlay,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(80.0)),
                            (PropertyId::Height, PropertyValue::Number(80.0)),
                        ],
                    },
                    insert(root_id, overlay),
                ],
            )
            .unwrap();
        cx.update(|window, _| window.refresh());
        finish_test_frames(cx);
        crate::events::take_test_emitted_events();
        cx.simulate_event(input);
        let emitted = crate::events::take_test_emitted_events();
        assert_eq!(emitted.len(), 1);
        assert_eq!(emitted[0].1.target_id, overlay);
        close_global_window(window_id);
    }

    #[gpui::test]
    fn wheel_events_remain_separate_across_windows(cx: &mut TestAppContext) {
        let mut windows = Vec::new();
        for _ in 0..2 {
            let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(16, Ordering::Relaxed);
            let target_id = root_id + 1;
            let (window_id, _, visual) = open_global_window(
                cx,
                root_id,
                vec![
                    container(target_id),
                    absolute_box(target_id, 20.0, 20.0, 80.0),
                    subscribe(target_id, NativeEventId::Wheel),
                    insert(root_id, target_id),
                ],
            );
            let handle = visual.update(|window, _| window.window_handle());
            windows.push((window_id, target_id, handle));
        }
        let mut expected = Vec::new();
        for (index, phase) in [
            (0, gpui::TouchPhase::Started),
            (1, gpui::TouchPhase::Moved),
            (0, gpui::TouchPhase::Ended),
        ] {
            let (window_id, target_id, handle) = windows[index];
            let mut visual = gpui::VisualTestContext::from_window(handle, cx);
            visual.simulate_event(gpui::ScrollWheelEvent {
                position: point(px(40.0), px(40.0)),
                delta: gpui::ScrollDelta::Lines(point(0.0, -(index as f32 + 1.0))),
                touch_phase: phase,
                ..Default::default()
            });
            expected.push((window_id, target_id, index as f64 + 1.0));
        }
        let emitted = crate::events::take_test_emitted_events();
        let actual: Vec<_> = emitted
            .iter()
            .map(|(window, payload)| (*window, payload.target_id, payload.delta_y))
            .collect();
        assert_eq!(actual, expected);
        let phases: Vec<_> = emitted
            .iter()
            .map(|(_, payload)| payload.touch_phase.as_deref())
            .collect();
        assert_eq!(phases, vec![Some("started"), Some("moved"), Some("ended")]);
        for (window_id, _, _) in windows {
            close_global_window(window_id);
        }
    }

    fn close_global_window(window_id: WindowId) {
        crate::runtime()
            .lock()
            .expect("global native tree must remain available in render tests")
            .close_window(window_id);
    }

    fn focus_node(
        cx: &mut gpui::VisualTestContext,
        runtime_state: &RuntimeStateRegistry,
        id: NodeId,
    ) {
        let handle = runtime_state
            .focus_handle(id)
            .expect("focusable test node must have a focus handle after the first frame");
        cx.update(|window, cx| handle.focus(window, cx));
        finish_test_frames(cx);
        crate::events::take_test_emitted_events();
    }

    fn node_bounds(cx: &mut gpui::VisualTestContext, id: NodeId) -> Bounds<Pixels> {
        // `debug_bounds` only accepts `'static` selectors; leaking is fine in tests.
        let selector: &'static str = Box::leak(format!("retend-node-{id}").into_boxed_str());
        cx.debug_bounds(selector)
            .expect("test node must have painted debug bounds")
    }

    /// Emitted `(event, target)` pairs for the given kinds, in emission order.
    fn emitted(kinds: &[NativeEventId]) -> Vec<(NativeEventId, NodeId)> {
        crate::events::take_test_emitted_events()
            .into_iter()
            .filter_map(|(_, event)| {
                kinds
                    .iter()
                    .find(|kind| **kind as u16 == event.event_id)
                    .map(|kind| (*kind, event.target_id))
            })
            .collect()
    }

    #[gpui::test]
    fn keyboard_context_menu_follows_keydown_and_ignores_repeat(cx: &mut TestAppContext) {
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        let target_id = root_id + 1;
        let (window_id, runtime_state, cx) = open_global_window(
            cx,
            root_id,
            vec![
                container(target_id),
                absolute_box(target_id, 120.0, 120.0, 80.0),
                focusable(target_id),
                subscribe(target_id, NativeEventId::KeyDown),
                subscribe(target_id, NativeEventId::ContextMenu),
                insert(root_id, target_id),
            ],
        );
        focus_node(cx, &runtime_state, target_id);
        let kinds = [NativeEventId::KeyDown, NativeEventId::ContextMenu];
        let both = vec![
            (NativeEventId::KeyDown, target_id),
            (NativeEventId::ContextMenu, target_id),
        ];
        let key_down_only = vec![(NativeEventId::KeyDown, target_id)];

        // Both triggers deliver `keydown` first and never swallow it.
        for trigger in ["shift-f10", "menu"] {
            cx.simulate_keystrokes(trigger);
            assert_eq!(emitted(&kinds), both, "{trigger}");
        }

        // The keyboard menu anchors at the target's bottom-left, not (0,0).
        cx.simulate_keystrokes("shift-f10");
        let menu = crate::events::take_test_emitted_events()
            .into_iter()
            .map(|(_, event)| event)
            .find(|event| event.event_id == NativeEventId::ContextMenu as u16)
            .expect("shift-f10 must emit contextmenu");
        let anchor = node_bounds(cx, target_id).bottom_left();
        assert_eq!(
            (menu.client_x, menu.client_y),
            (
                f64::from(f32::from(anchor.x)),
                f64::from(f32::from(anchor.y))
            )
        );
        assert_eq!((menu.button, menu.shift_key), (0, true));

        // Auto-repeat still reports `keydown` but must not reopen the menu.
        cx.simulate_event(KeyDownEvent {
            keystroke: gpui::Keystroke::parse("shift-f10").unwrap(),
            is_held: true,
            prefer_character_input: false,
        });
        assert_eq!(emitted(&kinds), key_down_only);

        // Other keys and modifier combinations are not menu triggers.
        for other in ["f10", "ctrl-shift-f10", "ctrl-menu", "a"] {
            cx.simulate_keystrokes(other);
            assert_eq!(emitted(&kinds), key_down_only, "{other}");
        }

        close_global_window(window_id);
    }

    #[gpui::test]
    fn keyboard_context_menu_without_keydown_subscription(cx: &mut TestAppContext) {
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        let target_id = root_id + 1;
        let (window_id, runtime_state, cx) = open_global_window(
            cx,
            root_id,
            vec![
                container(target_id),
                absolute_box(target_id, 120.0, 120.0, 80.0),
                focusable(target_id),
                subscribe(target_id, NativeEventId::ContextMenu),
                insert(root_id, target_id),
            ],
        );
        focus_node(cx, &runtime_state, target_id);
        let kinds = [NativeEventId::KeyDown, NativeEventId::ContextMenu];

        cx.simulate_keystrokes("menu");
        assert_eq!(
            emitted(&kinds),
            vec![(NativeEventId::ContextMenu, target_id)]
        );
        cx.simulate_keystrokes("a");
        assert!(emitted(&kinds).is_empty());

        close_global_window(window_id);
    }

    #[gpui::test]
    fn ancestor_context_menu_subscription_targets_the_inner_node(cx: &mut TestAppContext) {
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        let parent_id = root_id + 1;
        let child_id = root_id + 2;
        let (window_id, runtime_state, cx) = open_global_window(
            cx,
            root_id,
            vec![
                container(parent_id),
                absolute_box(parent_id, 100.0, 100.0, 200.0),
                subscribe(parent_id, NativeEventId::ContextMenu),
                container(child_id),
                absolute_box(child_id, 20.0, 20.0, 60.0),
                focusable(child_id),
                insert(root_id, parent_id),
                insert(parent_id, child_id),
            ],
        );
        let kinds = [NativeEventId::ContextMenu];
        let child = node_bounds(cx, child_id);

        // The child reports itself once; JS bubbling delivers it to the parent.
        cx.simulate_mouse_down(child.center(), MouseButton::Right, Modifiers::default());
        cx.simulate_mouse_up(child.center(), MouseButton::Right, Modifiers::default());
        finish_test_frames(cx);
        assert_eq!(emitted(&kinds), vec![(NativeEventId::ContextMenu, child_id)]);

        focus_node(cx, &runtime_state, child_id);
        cx.simulate_keystrokes("shift-f10");
        assert_eq!(emitted(&kinds), vec![(NativeEventId::ContextMenu, child_id)]);

        close_global_window(window_id);
    }

    #[gpui::test]
    fn right_press_delivers_mousedown_before_context_menu(cx: &mut TestAppContext) {
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        let target_id = root_id + 1;
        let (window_id, _runtime_state, cx) = open_global_window(
            cx,
            root_id,
            vec![
                container(target_id),
                absolute_box(target_id, 120.0, 120.0, 80.0),
                subscribe(target_id, NativeEventId::MouseDown),
                subscribe(target_id, NativeEventId::ContextMenu),
                insert(root_id, target_id),
            ],
        );
        let kinds = [NativeEventId::MouseDown, NativeEventId::ContextMenu];
        let target = point(px(140.0), px(140.0));

        // Neither event may swallow the other, and `mousedown` comes first.
        cx.simulate_mouse_down(target, MouseButton::Right, Modifiers::default());
        finish_test_frames(cx);
        let pressed = emitted(&kinds);
        cx.simulate_mouse_up(target, MouseButton::Right, Modifiers::default());
        finish_test_frames(cx);
        let released = emitted(&kinds);
        let mouse_down = (NativeEventId::MouseDown, target_id);
        let context_menu = (NativeEventId::ContextMenu, target_id);
        if CONTEXT_MENU_ON_PRESS {
            assert_eq!(pressed, vec![mouse_down, context_menu]);
            assert!(released.is_empty());
        } else {
            assert_eq!(pressed, vec![mouse_down]);
            assert_eq!(released, vec![context_menu]);
        }

        close_global_window(window_id);
    }

    #[gpui::test]
    fn right_click_reopens_context_menu_while_outside_listener_is_active(
        cx: &mut TestAppContext,
    ) {
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        let target_id = root_id + 1;
        let menu_id = root_id + 2;
        let (window_id, _runtime_state, cx) = open_global_window(
            cx,
            root_id,
            vec![
                container(target_id),
                absolute_box(target_id, 120.0, 120.0, 80.0),
                subscribe(target_id, NativeEventId::ContextMenu),
                // An open menu elsewhere that closes on outside presses.
                container(menu_id),
                absolute_box(menu_id, 300.0, 120.0, 80.0),
                subscribe(menu_id, NativeEventId::MouseDownOutside),
                insert(root_id, target_id),
                insert(root_id, menu_id),
            ],
        );
        let kinds = [NativeEventId::MouseDownOutside, NativeEventId::ContextMenu];
        let target = point(px(140.0), px(140.0));

        cx.simulate_mouse_down(target, MouseButton::Right, Modifiers::default());
        cx.simulate_mouse_up(target, MouseButton::Right, Modifiers::default());
        finish_test_frames(cx);
        assert_eq!(
            emitted(&kinds),
            vec![
                (NativeEventId::MouseDownOutside, menu_id),
                (NativeEventId::ContextMenu, target_id),
            ]
        );

        close_global_window(window_id);
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

    const SQUARE_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16"/></svg>"#;

    fn svg_node(id: NodeId, property: PropertyId, value: &str) -> [Command; 2] {
        [
            Command::CreateNode {
                id,
                kind: ElementKind::Svg,
            },
            Command::SetProperty {
                id,
                property,
                value: PropertyValue::String(value.into()),
            },
        ]
    }

    fn set_style(id: NodeId, properties: Vec<(PropertyId, PropertyValue)>) -> Command {
        Command::SetStyle { id, properties }
    }

    /// Renders the window whose root is node 1 after applying `commands`.
    fn render_commands(
        cx: &mut TestAppContext,
        commands: Vec<Command>,
    ) -> &mut gpui::VisualTestContext {
        cx.update(init);
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window_id = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut().apply_commands(window_id, commands).unwrap();
        let runtime_state = RuntimeStateRegistry::default();
        let (_, cx) = cx.add_window_view(move |_, _| QueryLayoutTestView {
            tree,
            runtime_state,
            window_id,
        });
        finish_test_frames(cx);
        cx
    }

    /// Colors of painted monochrome sprites; the fixtures contain no text,
    /// so every sprite is an SVG icon, in paint order.
    fn painted_icon_colors(cx: &mut gpui::VisualTestContext) -> Vec<gpui::Hsla> {
        cx.update(|window, _| {
            window
                .rendered_monochrome_sprites()
                .into_iter()
                .map(|sprite| sprite.color)
                .collect()
        })
    }

    #[gpui::test]
    fn svg_paints_in_its_containers_color_unless_it_sets_its_own(cx: &mut TestAppContext) {
        let red = PropertyValue::String("#ff0000".into());
        let blue = PropertyValue::String("#0000ff".into());
        let mut commands = vec![
            container(2),
            set_style(2, vec![(PropertyId::Color, red)]),
            insert(1, 2),
        ];
        commands.extend(svg_node(3, PropertyId::Content, SQUARE_SVG));
        commands.push(insert(2, 3));
        commands.extend(svg_node(4, PropertyId::Content, SQUARE_SVG));
        commands.push(set_style(4, vec![(PropertyId::Color, blue)]));
        commands.push(insert(2, 4));

        let cx = render_commands(cx, commands);
        assert_eq!(
            painted_icon_colors(cx),
            vec![
                gpui::Hsla::from(gpui::rgba(0xff0000ff)),
                gpui::Hsla::from(gpui::rgba(0x0000ffff)),
            ]
        );
    }

    #[gpui::test]
    fn svg_defaults_to_16px_and_author_size_overrides_it(cx: &mut TestAppContext) {
        let mut commands = Vec::from(svg_node(2, PropertyId::Content, SQUARE_SVG));
        commands.push(insert(1, 2));
        commands.extend(svg_node(3, PropertyId::Content, SQUARE_SVG));
        commands.push(set_style(
            3,
            vec![
                (PropertyId::Width, PropertyValue::Number(24.0)),
                (PropertyId::Height, PropertyValue::Number(24.0)),
            ],
        ));
        commands.push(insert(1, 3));

        let cx = render_commands(cx, commands);
        let size_of = |cx: &mut gpui::VisualTestContext, selector| {
            cx.debug_bounds(selector).expect("svg should be laid out").size
        };
        assert_eq!(size_of(cx, "retend-node-2"), gpui::size(px(16.), px(16.)));
        assert_eq!(size_of(cx, "retend-node-3"), gpui::size(px(24.), px(24.)));
    }

    #[gpui::test]
    fn svg_src_loads_a_local_file(cx: &mut TestAppContext) {
        let file = std::env::temp_dir().join(format!("retend-svg-src-{}.svg", std::process::id()));
        std::fs::write(&file, SQUARE_SVG).unwrap();
        let src = url::Url::from_file_path(&file).unwrap().to_string();
        let mut commands = Vec::from(svg_node(2, PropertyId::Src, &src));
        commands.push(insert(1, 2));

        let cx = render_commands(cx, commands);
        let painted = painted_icon_colors(cx).len();
        std::fs::remove_file(&file).ok();
        assert_eq!(painted, 1);
    }

    #[gpui::test]
    fn svg_content_takes_precedence_over_src(cx: &mut TestAppContext) {
        // `src` names a file that does not exist, so only `content` can paint.
        let mut commands = Vec::from(svg_node(2, PropertyId::Content, SQUARE_SVG));
        commands.push(Command::SetProperty {
            id: 2,
            property: PropertyId::Src,
            value: PropertyValue::String("file:///nonexistent/retend-icon.svg".into()),
        });
        commands.push(insert(1, 2));

        let cx = render_commands(cx, commands);
        assert_eq!(painted_icon_colors(cx).len(), 1);
    }

    #[test]
    fn empty_or_missing_alt_is_decorative() {
        assert_eq!(accessible_label(None), None);
        assert_eq!(accessible_label(Some("")), None);
        assert_eq!(accessible_label(Some("Done")), Some("Done"));
    }
}
