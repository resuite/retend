use std::{cell::Cell, rc::Rc, sync::Arc};

use gpui::{
    actions, div, img, prelude::*, AnyElement, App, Bounds, ClickEvent, Element, ElementId,
    GlobalElementId, ImageCacheError, ImageSource, InspectorElementId, KeyBinding, KeyDownEvent,
    KeyUpEvent, LayoutId, MouseButton, MouseDownEvent, MouseMoveEvent, MouseUpEvent,
    NavigationDirection, Pixels, Point, StyledImage, Text, Window,
};

use crate::{
    events,
    protocol_generated::NativeEventId,
    runtime_state::RuntimeStateRegistry,
    style::OverflowValue,
    tree::{event_bit, ImageObjectFit, NativeTree, NodeData, NodeId, WindowId},
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

fn emit_mouse_down(window_id: WindowId, target_id: NodeId, event: &MouseDownEvent, cx: &mut App) {
    let (subscribed, outside) = crate::runtime()
        .lock()
        .map(|tree| {
            (
                tree.has_subscription_in_path(window_id, target_id, NativeEventId::MouseDown),
                tree.outside_subscribers(window_id, target_id),
            )
        })
        .unwrap_or_default();
    if subscribed {
        events::emit(
            window_id,
            events::mouse_down(NativeEventId::MouseDown, target_id, event),
        );
    }
    for id in &outside {
        events::emit(
            window_id,
            events::mouse_down(NativeEventId::MouseDownOutside, *id, event),
        );
    }
    if subscribed || !outside.is_empty() {
        cx.stop_propagation();
    }
}

macro_rules! bubbling_events {
    ($($handler:ident($event:ident: $ty:ty, $id:ident): $kind:ident => $payload:expr;)+) => {
        $(fn $handler(window_id: WindowId, $id: NodeId, $event: &$ty, cx: &mut App) {
            if event_interest(window_id, $id, NativeEventId::$kind) {
                events::emit(window_id, $payload);
                cx.stop_propagation();
            }
        })+
    };
}

bubbling_events! {
    emit_mouse_up(event: MouseUpEvent, id): MouseUp =>
        events::mouse_up(NativeEventId::MouseUp, id, event);
    emit_mouse_move(event: MouseMoveEvent, id): MouseMove => events::mouse_move(id, event);
    emit_key_down(event: KeyDownEvent, id): KeyDown =>
        events::key_event(NativeEventId::KeyDown, id, &event.keystroke, event.is_held);
    emit_key_up(event: KeyUpEvent, id): KeyUp =>
        events::key_event(NativeEventId::KeyUp, id, &event.keystroke, false);
}

fn emit_click(window_id: WindowId, target_id: NodeId, event: &ClickEvent, cx: &mut App) {
    let subscriptions = crate::runtime()
        .lock()
        .map(|tree| tree.subscription_mask_in_path(window_id, target_id))
        .unwrap_or_default();
    let click = subscriptions & event_bit(NativeEventId::Click) != 0;
    let double_click =
        event.click_count() == 2 && subscriptions & event_bit(NativeEventId::DblClick) != 0;
    if click {
        events::emit(
            window_id,
            events::click(NativeEventId::Click, target_id, event),
        );
    }
    if double_click {
        events::emit(
            window_id,
            events::click(NativeEventId::DblClick, target_id, event),
        );
    }
    if click || double_click {
        cx.stop_propagation();
    }
}

fn emit_hover(window_id: WindowId, target_id: NodeId, hovered: bool, window: &Window) {
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
                window.mouse_position(),
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
            $element = $element.$method(button, move |event, _, cx| {
                $handler($window_id, $id, event, cx)
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
) -> T {
    if let Some(focus) = runtime.tracked_focus_handle(id) {
        element = element.track_focus(&focus);
    }
    if let Some(scroll) = runtime.scroll_handle(id) {
        element = element.track_scroll(&scroll);
    }
    if interest.has(NativeEventId::MouseDown) || interest.outside_mouse_down {
        with_mouse_buttons!(element, on_mouse_down, emit_mouse_down, window_id, id);
    }
    if interest.has(NativeEventId::MouseUp) {
        with_mouse_buttons!(element, on_mouse_up, emit_mouse_up, window_id, id);
    }
    if interest.has(NativeEventId::MouseMove) {
        element =
            element.on_mouse_move(move |event, _, cx| emit_mouse_move(window_id, id, event, cx));
    }
    if interest.has(NativeEventId::Click) || interest.has(NativeEventId::DblClick) {
        element = element.on_click(move |event, _, cx| emit_click(window_id, id, event, cx));
    }
    if interest.has(NativeEventId::MouseEnter) || interest.has(NativeEventId::MouseLeave) {
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

fn to_gpui_object_fit(value: ImageObjectFit) -> gpui::ObjectFit {
    match value {
        ImageObjectFit::Fill => gpui::ObjectFit::Fill,
        ImageObjectFit::Contain => gpui::ObjectFit::Contain,
        ImageObjectFit::Cover => gpui::ObjectFit::Cover,
        ImageObjectFit::ScaleDown => gpui::ObjectFit::ScaleDown,
        ImageObjectFit::None => gpui::ObjectFit::None,
    }
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

/// Runs Retend's post-paint bookkeeping after the wrapped element paints.
struct PaintObserver {
    inner: AnyElement,
    callback: Option<PaintCallback>,
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
                runtime.record_bounds(generation, id, bounds);
                let bottom_right = if let Some(handle) = &content_scroll_handle {
                    (0..handle.children_count())
                        .filter_map(|index| handle.bounds_for_item(index))
                        .map(|bounds| bounds.bottom_right())
                        .reduce(|a, b| a.max(&b))
                } else {
                    painted_content.as_ref().and_then(|content| content.get())
                };
                if let Some(bottom_right) = bottom_right {
                    // Prepaint can be speculative. Publish only after paint.
                    runtime.record_content_extent(generation, id, bottom_right - bounds.origin);
                }
            }
        }
    }
}

impl PaintObserver {
    fn new(inner: AnyElement, callback: PaintCallback) -> Self {
        Self {
            inner,
            callback: Some(callback),
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
        _bounds: Bounds<Pixels>,
        _request_layout: &mut (),
        window: &mut Window,
        cx: &mut App,
    ) {
        self.inner.prepaint(window, cx);
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
        if let Some(callback) = self.callback.take() {
            callback.painted(bounds, window);
        }
    }
}

pub fn build_with_runtime(
    tree: &NativeTree,
    id: NodeId,
    runtime_state: &RuntimeStateRegistry,
    generation: u64,
) -> AnyElement {
    let inner = build_inner(
        tree,
        id,
        runtime_state,
        generation,
        EventInterest::for_node(tree, tree.nodes[&id].window_id, id),
    );
    PaintObserver::new(
        inner,
        PaintCallback::Finish {
            runtime: runtime_state.clone(),
            generation,
        },
    )
    .into_any_element()
}

fn build_inner(
    tree: &NativeTree,
    id: NodeId,
    runtime_state: &RuntimeStateRegistry,
    generation: u64,
    interest: EventInterest,
) -> AnyElement {
    let node = &tree.nodes[&id];
    if let NodeData::Text(text) = &node.data {
        return Text::new(ElementId::Integer(u64::from(id)), text.clone().into())
            .into_any_element();
    }
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
            .is_some_and(|style| style.display == crate::style::DisplayValue::None);
    let staged_content = (tracks_content && scroll_handle.is_none())
        .then(|| Rc::new(Cell::new(None::<Point<Pixels>>)));
    let painted_content = staged_content.clone();
    let content_scroll_handle = scroll_handle.clone().filter(|_| tracks_content);
    let record_bounds = PaintCallback::Bounds {
        runtime,
        generation,
        id,
        content_scroll_handle,
        painted_content,
    };
    let element = match &node.data {
        NodeData::Root | NodeData::Container | NodeData::TextControl { .. } => {
            let element = if matches!(node.data, NodeData::Root) {
                root_container()
            } else {
                div()
            };
            let mut element = match node.style.as_deref() {
                Some(style) => style.apply(element),
                None => element.block(),
            };
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
                _ => element.children(node.children.iter().map(|child_id| {
                    build_inner(tree, *child_id, runtime_state, generation, interest)
                })),
            };
            if let Some(content) = staged_content {
                element = element.on_children_prepainted(move |children, _, _| {
                    content.set(
                        children
                            .into_iter()
                            .map(|bounds| bounds.bottom_right())
                            .reduce(|a, b| a.max(&b)),
                    );
                });
            }
            if interest.any()
                || runtime_state.is_interactive(id)
                || matches!(node.data, NodeData::TextControl { .. })
            {
                let element = with_native_events(
                    element.id(ElementId::Integer(u64::from(id))),
                    interest,
                    node.window_id,
                    id,
                    runtime_state,
                );
                #[cfg(test)]
                let element = element.debug_selector(move || format!("retend-node-{id}"));
                element.into_any_element()
            } else {
                #[cfg(test)]
                let element = element.debug_selector(move || format!("retend-node-{id}"));
                element.into_any_element()
            }
        }
        NodeData::Text(_) => unreachable!("text leaves return before bounds tracking"),
        NodeData::Image { src, object_fit } => {
            let source = src.clone().map(ImageSource::from).unwrap_or_else(|| {
                ImageSource::Custom(Arc::new(|_, _| {
                    Some(Err(ImageCacheError::Asset("image source is unset".into())))
                }))
            });
            let image = img(source);
            let mut image = match node.style.as_deref() {
                Some(style) => style.apply(image),
                None => image.block(),
            };
            if let Some(object_fit) = object_fit {
                image = image.object_fit(to_gpui_object_fit(*object_fit));
            }
            let image = with_native_events(
                image.id(ElementId::Integer(u64::from(id))),
                interest,
                node.window_id,
                id,
                runtime_state,
            );
            image.into_any_element()
        }
    };
    let element = PaintObserver::new(element, record_bounds).into_any_element();
    let mode = match (&node.data, node.style.as_deref()) {
        (NodeData::Root | NodeData::Container, Some(style))
            if style.display != crate::style::DisplayValue::None =>
        {
            match style.overflow {
                OverflowValue::Auto => Some(gpui_base::ScrollbarMode::Scrolling),
                OverflowValue::Scroll => Some(gpui_base::ScrollbarMode::Always),
                OverflowValue::Visible | OverflowValue::Clip | OverflowValue::Hidden => None,
            }
        }
        _ => None,
    };
    match (scroll_handle, mode) {
        (Some(scroll), Some(mode)) => ScrollbarOverlay {
            inner: element,
            scroll,
            mode,
            id,
        }
        .into_any_element(),
        _ => element,
    }
}

#[cfg(test)]
mod tests {
    use std::{
        cell::RefCell,
        rc::Rc,
        sync::{
            atomic::{AtomicU32, Ordering},
            mpsc, Arc, Mutex,
        },
    };

    use gpui::{
        http_client::{AsyncBody, FakeHttpClient, Response},
        point, px, Context, Modifiers, Render, TestAppContext, Window,
    };

    use super::*;
    use crate::protocol::{Command, PropertyValue};
    use crate::protocol_generated::{ElementKind, PropertyId};
    use crate::runtime_state::{
        LayoutOperation, MeasureResponder, Measurement, ScrollOffset, ScrollResponder,
    };
    use crate::style::OverflowValue;

    const SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>"#;
    const AFTER_IMAGE: &str = "after-image";
    static NEXT_GLOBAL_TEST_ROOT: AtomicU32 = AtomicU32::new(0xd000_0000);

    fn test_inner(
        tree: &NativeTree,
        id: NodeId,
        runtime: &RuntimeStateRegistry,
        generation: u64,
    ) -> AnyElement {
        let window = tree.nodes[&id].window_id;
        build_inner(
            tree,
            id,
            runtime,
            generation,
            EventInterest::for_node(tree, window, id),
        )
    }

    fn observed_inner(element: &mut AnyElement) -> &mut AnyElement {
        &mut element
            .downcast_mut::<PaintObserver>()
            .expect("measured native elements must use the post-paint observer")
            .inner
    }

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
    fn container_styles_are_applied_to_gpui() {
        let mut tree = NativeTree::default();
        let window = tree.create_window(1).unwrap();
        tree.apply_commands(
            window,
            vec![
                container(2),
                Command::SetStyle {
                    id: 2,
                    properties: vec![
                        (
                            PropertyId::AlignItems,
                            PropertyValue::String("center".into()),
                        ),
                        (PropertyId::Gap, PropertyValue::Number(8.0)),
                        (PropertyId::Padding, PropertyValue::Number(12.0)),
                        (PropertyId::Margin, PropertyValue::Number(3.0)),
                        (
                            PropertyId::Position,
                            PropertyValue::String("absolute".into()),
                        ),
                        (PropertyId::Top, PropertyValue::Number(4.0)),
                        (PropertyId::BorderWidth, PropertyValue::Number(2.0)),
                        (
                            PropertyId::BorderColor,
                            PropertyValue::String("#336699".into()),
                        ),
                        (PropertyId::BorderRadius, PropertyValue::Number(6.0)),
                        (
                            PropertyId::BackgroundColor,
                            PropertyValue::String("#112233".into()),
                        ),
                        (PropertyId::Color, PropertyValue::String("#ddeeff".into())),
                        (PropertyId::FontSize, PropertyValue::Number(18.0)),
                        (
                            PropertyId::TextAlign,
                            PropertyValue::String("center".into()),
                        ),
                        (PropertyId::LineHeight, PropertyValue::Number(24.0)),
                        (
                            PropertyId::WhiteSpace,
                            PropertyValue::String("nowrap".into()),
                        ),
                    ],
                },
            ],
        )
        .unwrap();

        let runtime_state = RuntimeStateRegistry::default();
        let generation = runtime_state.begin_frame(&tree, window);
        let mut rendered = test_inner(&tree, 2, &runtime_state, generation);
        let actual = observed_inner(&mut rendered)
            .downcast_mut::<gpui::Div>()
            .expect("static native containers must keep a plain GPUI Div internally");
        let mut expected = div()
            .block()
            .p(px(12.0))
            .m(px(3.0))
            .top(px(4.0))
            .border(px(2.0))
            .border_color(gpui::rgba(0x336699ff))
            .rounded(px(6.0))
            .bg(gpui::rgba(0x112233ff))
            .text_color(gpui::rgba(0xddeeffff))
            .text_size(px(18.0))
            .text_center()
            .line_height(px(24.0))
            .whitespace_nowrap();
        expected.style().align_items = Some(gpui::AlignItems::Center);
        expected.style().gap.width = Some(px(8.0).into());
        expected.style().gap.height = Some(px(8.0).into());
        expected.style().position = Some(gpui::Position::Absolute);

        assert_eq!(actual.style(), expected.style());
    }

    #[test]
    fn event_interest_only_makes_the_interested_branch_stateful() {
        let mut tree = NativeTree::default();
        let window = tree.create_window(1).unwrap();
        tree.apply_commands(
            window,
            vec![
                container(2),
                container(3),
                container(4),
                Command::SubscribeEvent {
                    id: 2,
                    event: NativeEventId::MouseEnter,
                },
                insert(1, 2),
                insert(2, 3),
                insert(1, 4),
            ],
        )
        .unwrap();

        let runtime_state = RuntimeStateRegistry::default();
        let generation = runtime_state.begin_frame(&tree, window);
        let mut descendant = test_inner(&tree, 3, &runtime_state, generation);
        observed_inner(&mut descendant)
            .downcast_mut::<gpui::Stateful<gpui::Div>>()
            .expect("ancestor hover capture must make descendants interactive");

        let mut unrelated = test_inner(&tree, 4, &runtime_state, generation);
        observed_inner(&mut unrelated)
            .downcast_mut::<gpui::Div>()
            .expect("uninterested branches must stay plain GPUI Divs");
    }

    #[test]
    fn image_render_maps_object_fit_to_gpui() {
        let mut tree = NativeTree::default();
        let window = tree.create_window(1).unwrap();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Image,
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::ObjectFit,
                    value: PropertyValue::String("cover".into()),
                },
            ],
        )
        .unwrap();

        let runtime_state = RuntimeStateRegistry::default();
        let generation = runtime_state.begin_frame(&tree, window);
        let mut rendered = test_inner(&tree, 2, &runtime_state, generation);
        observed_inner(&mut rendered)
            .downcast_mut::<gpui::Stateful<gpui::Img>>()
            .expect("native images must keep a stateful GPUI Img internally");
        assert!(matches!(
            to_gpui_object_fit(ImageObjectFit::Cover),
            gpui::ObjectFit::Cover
        ));
    }

    #[test]
    fn native_text_uses_gpui_text_with_the_retend_node_id() {
        let mut tree = NativeTree::default();
        let window = tree.create_window(1).unwrap();
        tree.apply_commands(
            window,
            vec![Command::CreateText {
                id: 2,
                text: "hello".into(),
            }],
        )
        .unwrap();

        let runtime_state = RuntimeStateRegistry::default();
        let generation = runtime_state.begin_frame(&tree, window);
        let mut rendered = test_inner(&tree, 2, &runtime_state, generation);
        let text = rendered
            .downcast_mut::<Text>()
            .expect("native text nodes must render as GPUI Text");
        assert_eq!(text.id(), Some(&ElementId::Integer(2)));
        assert_eq!(text.text().as_ref(), "hello");
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
            build_with_runtime(&tree, 1, &self.runtime_state, generation)
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
            build_with_runtime(&tree, self.root_id, &self.runtime_state, generation)
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
    fn parent_content_extents_include_text_updates_and_overflow(cx: &mut TestAppContext) {
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window_id = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![
                    container(2),
                    container(3),
                    Command::CreateText {
                        id: 4,
                        text: "a fairly long text value".into(),
                    },
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Display, PropertyValue::String("flex".into())),
                            (
                                PropertyId::AlignItems,
                                PropertyValue::String("start".into()),
                            ),
                            (PropertyId::Width, PropertyValue::Number(30.0)),
                            (PropertyId::Height, PropertyValue::Number(6.0)),
                        ],
                    },
                    Command::SetStyle {
                        id: 3,
                        properties: vec![(PropertyId::FlexShrink, PropertyValue::Number(0.0))],
                    },
                    insert(1, 2),
                    insert(2, 3),
                    insert(3, 4),
                ],
            )
            .unwrap();
        let runtime_state = RuntimeStateRegistry::default();
        let initial = request_measure(&runtime_state, 2);
        let inner = request_measure(&runtime_state, 3);
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
        let initial = initial.try_recv().unwrap().unwrap();
        let inner = inner.try_recv().unwrap().unwrap();
        assert_eq!((initial.width, initial.height), (30.0, 6.0));
        assert!(initial.scroll_width > initial.width);
        assert!(initial.scroll_height > initial.height);
        assert!(inner.width > initial.width, "intrinsic text width survives");
        assert_eq!(inner.scroll_width, inner.width);

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![Command::UpdateText {
                    id: 4,
                    text: "a much longer reactive text value".into(),
                }],
            )
            .unwrap();
        let updated = request_measure(&runtime_state, 2);
        let updated_inner = request_measure(&runtime_state, 3);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        let updated = updated.try_recv().unwrap().unwrap();
        let updated_inner = updated_inner.try_recv().unwrap().unwrap();
        assert!(updated.scroll_width > initial.scroll_width);
        assert!(updated_inner.width > inner.width);
        assert_eq!(updated.scroll_height, initial.scroll_height);

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

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![
                    insert(1, 2),
                    Command::SetStyle {
                        id: 2,
                        properties: vec![(
                            PropertyId::Display,
                            PropertyValue::String("none".into()),
                        )],
                    },
                ],
            )
            .unwrap();
        let hidden = request_measure(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(hidden.try_recv().unwrap().unwrap(), Measurement::default());
    }

    #[gpui::test]
    fn parent_content_extents_follow_scroll_query_barriers_and_ancestor_shifts(
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
                    Command::CreateText {
                        id: 4,
                        text: "a fairly long text value that wraps across several narrow lines"
                            .into(),
                    },
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(20.0)),
                            (PropertyId::Height, PropertyValue::Number(5.0)),
                        ],
                    },
                    Command::SetStyle {
                        id: 3,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(20.0)),
                            (PropertyId::Height, PropertyValue::Number(5.0)),
                            (PropertyId::Overflow, PropertyValue::String("scroll".into())),
                        ],
                    },
                    insert(1, 2),
                    insert(2, 3),
                    insert(3, 4),
                ],
            )
            .unwrap();
        let runtime_state = RuntimeStateRegistry::default();
        let initial = request_measure(&runtime_state, 2);
        let initial_scroll = request_measure(&runtime_state, 3);
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
        let initial = initial.try_recv().unwrap().unwrap();
        let initial_scroll = initial_scroll.try_recv().unwrap().unwrap();
        // Text clamps to the scroller width, so only height overflows.
        assert_eq!(initial_scroll.scroll_width, 20.0);
        assert!(initial_scroll.scroll_height > initial_scroll.height);
        // The ancestor's measurement depends on the scroller's published extent;
        // without it only the 20px scroller box would count.
        assert_eq!(initial.scroll_width, 20.0);
        assert_eq!(initial.scroll_height, initial_scroll.scroll_height);

        let before = request_measure(&runtime_state, 2);
        scroll(&runtime_state, 3, 12.0, false);
        let first = request_measure(&runtime_state, 2);
        scroll(&runtime_state, 3, 24.0, false);
        let second = request_measure(&runtime_state, 2);
        scroll(&runtime_state, 3, -12.0, true);
        let restored = request_measure(&runtime_state, 2);
        let scroller = request_measure(&runtime_state, 3);
        let offset = request_scroll_offset(&runtime_state, 3);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(before.try_recv().unwrap().unwrap(), initial);
        for (query, y) in [(first, 12.0), (second, 24.0), (restored, 12.0)] {
            let measured = query.try_recv().unwrap().unwrap();
            assert_eq!(measured.scroll_width, initial.scroll_width);
            assert_eq!(measured.scroll_height, initial.scroll_height - y);
            assert_eq!((measured.x, measured.y), (initial.x, initial.y));
        }
        assert_eq!(scroller.try_recv().unwrap().unwrap(), initial_scroll);
        assert_eq!(
            offset.try_recv().unwrap().unwrap(),
            ScrollOffset { x: 0.0, y: 12.0 }
        );

        // Repaint while already scrolled: the stored extent must still be pre-scroll.
        let repainted = request_measure(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        let repainted = repainted.try_recv().unwrap().unwrap();
        assert_eq!(repainted.scroll_width, initial.scroll_width);
        assert_eq!(repainted.scroll_height, initial.scroll_height - 12.0);

        scroll(&runtime_state, 3, 0.0, false);
        let reset = request_measure(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(reset.try_recv().unwrap().unwrap(), initial);
    }

    #[gpui::test]
    fn scrollbar_track_uses_retained_handle_and_hidden_suppresses_overlay(cx: &mut TestAppContext) {
        cx.update(init);
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
                            (PropertyId::Height, PropertyValue::Number(100.0)),
                            (PropertyId::Overflow, PropertyValue::String("scroll".into())),
                        ],
                    },
                    Command::SetStyle {
                        id: 3,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(500.0)),
                            (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
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
                window_id,
            }
        });
        finish_test_frames(cx);

        let track_click = {
            let bounds = runtime_state
                .scroll_handle(2)
                .expect("scroll container must retain its handle")
                .bounds();
            point(bounds.right() - px(5.0), bounds.bottom() - px(10.0))
        };
        cx.simulate_click(track_click, Modifiers::default());
        finish_test_frames(cx);
        let scrolled = request_scroll_offset(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert!(scrolled.try_recv().unwrap().unwrap().y > 0.0);

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![Command::SetStyle {
                    id: 2,
                    properties: vec![
                        (PropertyId::Width, PropertyValue::Number(100.0)),
                        (PropertyId::Height, PropertyValue::Number(100.0)),
                        (PropertyId::Overflow, PropertyValue::String("hidden".into())),
                    ],
                }],
            )
            .unwrap();
        scroll(&runtime_state, 2, 0.0, false);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        cx.simulate_click(track_click, Modifiers::default());
        finish_test_frames(cx);
        let hidden = request_scroll_offset(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(hidden.try_recv().unwrap().unwrap(), ScrollOffset::default());
    }

    #[gpui::test]
    fn native_scrollbar_input_emits_authoritative_retend_scroll_event(cx: &mut TestAppContext) {
        cx.update(init);
        let root_id = NEXT_GLOBAL_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        let scroller_id = root_id + 1;
        let content_id = root_id + 2;
        let window_id = {
            let mut tree = crate::runtime()
                .lock()
                .expect("global native tree must remain available in render tests");
            let window_id = tree.create_window(root_id).unwrap();
            tree.apply_commands(
                window_id,
                vec![
                    container(scroller_id),
                    container(content_id),
                    Command::SetStyle {
                        id: scroller_id,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(100.0)),
                            (PropertyId::Overflow, PropertyValue::String("scroll".into())),
                        ],
                    },
                    Command::SetStyle {
                        id: content_id,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(500.0)),
                            (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
                        ],
                    },
                    Command::SubscribeEvent {
                        id: scroller_id,
                        event: NativeEventId::Scroll,
                    },
                    insert(root_id, scroller_id),
                    insert(scroller_id, content_id),
                ],
            )
            .unwrap();
            window_id
        };

        let runtime_state = RuntimeStateRegistry::default();
        crate::events::take_test_emitted_events();
        let (view, cx) = cx.add_window_view({
            let runtime_state = runtime_state.clone();
            move |_, _| GlobalTreeTestView {
                runtime_state,
                window_id,
                root_id,
            }
        });
        finish_test_frames(cx);

        let track_click = {
            let bounds = runtime_state
                .scroll_handle(scroller_id)
                .expect("scroll container must retain its handle")
                .bounds();
            point(bounds.right() - px(5.0), bounds.bottom() - px(10.0))
        };
        cx.simulate_click(track_click, Modifiers::default());
        finish_test_frames(cx);

        let events: Vec<_> = crate::events::take_test_emitted_events()
            .into_iter()
            .filter(|(_, event)| event.event_id == NativeEventId::Scroll as u16)
            .collect();
        assert_eq!(
            events.len(),
            1,
            "one native scrollbar action must emit one scroll event"
        );
        let (event_window, event) = &events[0];
        assert_eq!((*event_window, event.target_id), (window_id, scroller_id));
        let event_offset = ScrollOffset {
            x: event.scroll_x,
            y: event.scroll_y,
        };

        let queried = request_scroll_offset(&runtime_state, scroller_id);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(event_offset, queried.try_recv().unwrap().unwrap());
        assert!(event_offset.y > 0.0);

        crate::runtime()
            .lock()
            .expect("global native tree must remain available in render tests")
            .close_window(window_id);
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
    fn scroll_into_view_waits_for_layout_and_orders_later_queries_after_the_scroll(
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
                    container(5),
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(50.0)),
                            (PropertyId::Overflow, PropertyValue::String("auto".into())),
                        ],
                    },
                    Command::SetStyle {
                        id: 3,
                        properties: vec![
                            (PropertyId::Display, PropertyValue::String("flex".into())),
                            (
                                PropertyId::FlexDirection,
                                PropertyValue::String("column".into()),
                            ),
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(200.0)),
                        ],
                    },
                    Command::SetStyle {
                        id: 4,
                        properties: vec![
                            (PropertyId::Height, PropertyValue::Number(140.0)),
                            (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
                        ],
                    },
                    Command::SetStyle {
                        id: 5,
                        properties: vec![
                            (PropertyId::Height, PropertyValue::Number(20.0)),
                            (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
                        ],
                    },
                    insert(1, 2),
                    insert(2, 3),
                    insert(3, 4),
                    insert(3, 5),
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

        request_scroll_into_view(&runtime_state, 5);
        let offset = request_scroll_offset(&runtime_state, 2);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);

        assert_eq!(
            offset
                .try_recv()
                .expect("scrollIntoView query must resolve before GPUI parks")
                .unwrap(),
            ScrollOffset { x: 0.0, y: 110.0 }
        );
    }

    #[gpui::test]
    fn ordered_scroll_commands_refresh_reveal_bounds_and_clamp_relative_offsets(
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
                    container(5),
                    container(6),
                    container(7),
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(50.0)),
                            (PropertyId::Overflow, PropertyValue::String("auto".into())),
                        ],
                    },
                    Command::SetStyle {
                        id: 3,
                        properties: vec![
                            (PropertyId::Display, PropertyValue::String("flex".into())),
                            (
                                PropertyId::FlexDirection,
                                PropertyValue::String("column".into()),
                            ),
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(240.0)),
                        ],
                    },
                    Command::SetStyle {
                        id: 4,
                        properties: vec![
                            (PropertyId::Height, PropertyValue::Number(100.0)),
                            (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
                        ],
                    },
                    Command::SetStyle {
                        id: 5,
                        properties: vec![
                            (PropertyId::Height, PropertyValue::Number(20.0)),
                            (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
                        ],
                    },
                    Command::SetStyle {
                        id: 6,
                        properties: vec![
                            (PropertyId::Height, PropertyValue::Number(100.0)),
                            (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
                        ],
                    },
                    Command::SetStyle {
                        id: 7,
                        properties: vec![
                            (PropertyId::Height, PropertyValue::Number(20.0)),
                            (PropertyId::FlexShrink, PropertyValue::Number(0.0)),
                        ],
                    },
                    insert(1, 2),
                    insert(2, 3),
                    insert(3, 4),
                    insert(3, 5),
                    insert(3, 6),
                    insert(3, 7),
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

        let offset_after = |runtime_state: &RuntimeStateRegistry,
                            view: &gpui::Entity<QueryLayoutTestView>,
                            cx: &mut gpui::VisualTestContext| {
            let offset = request_scroll_offset(runtime_state, 2);
            view.update(cx, |_, cx| cx.notify());
            finish_test_frames(cx);
            offset
                .try_recv()
                .expect("ordered scroll query must resolve before GPUI parks")
                .unwrap()
        };

        request_scroll_into_view(&runtime_state, 7);
        scroll(&runtime_state, 2, 10.0, false);
        assert_eq!(offset_after(&runtime_state, &view, cx).y, 10.0);

        scroll(&runtime_state, 2, 0.0, false);
        request_scroll_into_view(&runtime_state, 7);
        assert_eq!(offset_after(&runtime_state, &view, cx).y, 190.0);

        request_scroll_into_view(&runtime_state, 7);
        request_scroll_into_view(&runtime_state, 5);
        assert_eq!(offset_after(&runtime_state, &view, cx).y, 100.0);

        scroll(&runtime_state, 2, 1_000.0, false);
        scroll(&runtime_state, 2, -10.0, true);
        assert_eq!(offset_after(&runtime_state, &view, cx).y, 180.0);

        scroll(&runtime_state, 2, 20.0, false);
        let ordered_read = request_scroll_offset(&runtime_state, 2);
        scroll(&runtime_state, 2, 40.0, false);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(
            ordered_read
                .try_recv()
                .expect("query must resolve before a later scroll command")
                .unwrap()
                .y,
            20.0
        );
        assert_eq!(offset_after(&runtime_state, &view, cx).y, 40.0);

        scroll(&runtime_state, 2, 50.0, false);
        let measured = request_measure(&runtime_state, 5);
        view.update(cx, |_, cx| cx.notify());
        finish_test_frames(cx);
        assert_eq!(
            measured
                .try_recv()
                .expect("measure after scroll must resolve from the next layout generation")
                .unwrap()
                .y,
            50.0
        );
    }

    #[gpui::test]
    fn auto_sized_root_retains_viewport_geometry(cx: &mut TestAppContext) {
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window_id = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![
                    Command::SetStyle {
                        id: 1,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::String("auto".into())),
                            (PropertyId::Height, PropertyValue::String("auto".into())),
                        ],
                    },
                    container(2),
                    Command::SetStyle {
                        id: 2,
                        properties: vec![(PropertyId::Height, PropertyValue::Number(25.0))],
                    },
                    insert(1, 2),
                ],
            )
            .unwrap();
        let runtime_state = RuntimeStateRegistry::default();
        let measured = request_measure(&runtime_state, 1);
        let (_, cx) = cx.add_window_view({
            let runtime_state = runtime_state.clone();
            move |_, _| QueryLayoutTestView {
                tree,
                runtime_state,
                window_id,
            }
        });
        finish_test_frames(cx);

        let viewport = cx.update(|window, _| window.viewport_size());
        assert!(viewport.height > px(25.0));
        // A nested auto-height Div would shrink to the child instead of the viewport.
        let root = cx.debug_bounds("retend-node-1").unwrap();
        assert_eq!(root.origin, point(px(0.0), px(0.0)));
        assert_eq!(root.size, viewport);
        let measured = measured.try_recv().unwrap().unwrap();
        assert_eq!((measured.x, measured.y), (0.0, 0.0));
        assert_eq!(measured.width, f64::from(f32::from(viewport.width)));
        assert_eq!(measured.height, f64::from(f32::from(viewport.height)));
    }

    #[gpui::test]
    fn root_paint_completes_children_and_skipped_queries_without_an_extra_frame(
        cx: &mut TestAppContext,
    ) {
        struct View {
            tree: Rc<RefCell<NativeTree>>,
            runtime: RuntimeStateRegistry,
            window_id: WindowId,
            renders: Rc<std::cell::Cell<usize>>,
        }
        impl Render for View {
            fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
                self.renders.set(self.renders.get() + 1);
                let tree = self.tree.borrow();
                let generation = self.runtime.begin_frame(&tree, self.window_id);
                build_with_runtime(&tree, 1, &self.runtime, generation)
            }
        }

        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window_id = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![
                    container(2),
                    Command::CreateText {
                        id: 3,
                        text: "rendered child".into(),
                    },
                    container(4),
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(123.0)),
                            (PropertyId::Height, PropertyValue::Number(45.0)),
                        ],
                    },
                    Command::SetStyle {
                        id: 4,
                        properties: vec![(
                            PropertyId::Display,
                            PropertyValue::String("none".into()),
                        )],
                    },
                    insert(1, 2),
                    insert(2, 3),
                    insert(1, 4),
                ],
            )
            .unwrap();
        let runtime = RuntimeStateRegistry::default();
        let child = request_measure(&runtime, 2);

        let skipped = request_measure(&runtime, 4);
        let renders = Rc::new(std::cell::Cell::new(0));
        let (view, cx) = cx.add_window_view({
            let tree = tree.clone();
            let runtime = runtime.clone();
            let renders = renders.clone();
            move |_, _| View {
                tree,
                runtime,
                window_id,
                renders,
            }
        });
        cx.run_until_parked();
        let child = child.try_recv().unwrap().unwrap();
        assert_eq!((child.width, child.height), (123.0, 45.0));
        assert_eq!(skipped.try_recv().unwrap().unwrap(), Measurement::default());
        assert_eq!(
            cx.update(|window, cx| window.simulate_next_frame(cx)),
            0,
            "completion must not request another frame"
        );
        assert_eq!(renders.get(), 1, "query completion must not refresh");

        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![Command::SetStyle {
                    id: 1,
                    properties: vec![(PropertyId::Display, PropertyValue::String("none".into()))],
                }],
            )
            .unwrap();
        let root = request_measure(&runtime, 1);
        let child = request_measure(&runtime, 2);
        view.update(cx, |_, cx| cx.notify());
        cx.run_until_parked();
        assert_eq!(root.try_recv().unwrap().unwrap(), Measurement::default());
        assert_eq!(child.try_recv().unwrap().unwrap(), Measurement::default());
        assert_eq!(
            cx.update(|window, cx| window.simulate_next_frame(cx)),
            0,
            "hidden-root completion must not request another frame"
        );
        assert_eq!(renders.get(), 2);
    }

    #[gpui::test]
    fn overflow_modes_preserve_expected_content_painting(cx: &mut TestAppContext) {
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window_id = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window_id,
                vec![
                    container(2),
                    container(3),
                    Command::SetStyle {
                        id: 3,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(200.0)),
                            (
                                PropertyId::BackgroundColor,
                                PropertyValue::String("#ff0000".into()),
                            ),
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
                window_id,
            }
        });
        for (overflow, display) in [
            ("auto", "block"),
            ("scroll", "block"),
            ("hidden", "block"),
            ("clip", "block"),
            ("auto", "none"),
            ("scroll", "none"),
        ] {
            tree.borrow_mut()
                .apply_commands(
                    window_id,
                    vec![Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(100.0)),
                            (PropertyId::Height, PropertyValue::Number(50.0)),
                            (PropertyId::Overflow, PropertyValue::String(overflow.into())),
                            (PropertyId::Display, PropertyValue::String(display.into())),
                        ],
                    }],
                )
                .unwrap();
            view.update(cx, |_, cx| cx.notify());
            finish_test_frames(cx);
            let quads = cx.update(|window, _| window.painted_quads());
            let content = quads
                .iter()
                .find(|quad| quad.background == gpui::rgb(0xff0000).into());
            assert_eq!(content.is_some(), display != "none");
            if overflow != "scroll" || display == "none" {
                assert_eq!(
                    quads.len(),
                    if display == "none" { 1 } else { 2 },
                    "{overflow} / {display} must not paint inactive scrollbar UI"
                );
            }
        }
    }

    #[gpui::test]
    fn default_block_child_tracks_the_containing_width(cx: &mut TestAppContext) {
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window,
                vec![
                    container(2),
                    container(3),
                    Command::SetStyle {
                        id: 2,
                        properties: vec![(PropertyId::Width, PropertyValue::Number(420.0))],
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
        cx.run_until_parked();

        let outer = cx.debug_bounds("retend-node-2").unwrap();
        let inner = cx.debug_bounds("retend-node-3").unwrap();
        assert_eq!(outer.size.width, px(420.0));
        assert_eq!(inner.size.width, outer.size.width);

        tree.borrow_mut()
            .apply_commands(
                window,
                vec![Command::SetStyle {
                    id: 2,
                    properties: vec![(PropertyId::Width, PropertyValue::Number(240.0))],
                }],
            )
            .unwrap();
        view.update(cx, |_, cx| cx.notify());
        cx.run_until_parked();

        let outer = cx.debug_bounds("retend-node-2").unwrap();
        let inner = cx.debug_bounds("retend-node-3").unwrap();
        assert_eq!(outer.size.width, px(240.0));
        assert_eq!(inner.size.width, outer.size.width);
    }

    #[gpui::test]
    fn text_keeps_intrinsic_width_and_adjacent_text_advances_layout(cx: &mut TestAppContext) {
        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window,
                vec![
                    container(2),
                    Command::CreateText {
                        id: 3,
                        text: "short".into(),
                    },
                    container(4),
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Display, PropertyValue::String("flex".into())),
                            (PropertyId::Width, PropertyValue::Number(420.0)),
                        ],
                    },
                    Command::SetStyle {
                        id: 4,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(1.0)),
                            (PropertyId::Height, PropertyValue::Number(1.0)),
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
                window_id: window,
            }
        });
        cx.run_until_parked();

        let parent = cx.debug_bounds("retend-node-2").unwrap();
        let marker_before = cx.debug_bounds("retend-node-4").unwrap();
        assert!(marker_before.origin.x > parent.origin.x);
        assert!(marker_before.origin.x < parent.origin.x + parent.size.width);

        tree.borrow_mut()
            .apply_commands(
                window,
                vec![
                    Command::CreateText {
                        id: 5,
                        text: " more text".into(),
                    },
                    Command::InsertChild {
                        parent_id: 2,
                        child_id: 5,
                        before_id: 4,
                    },
                ],
            )
            .unwrap();
        view.update(cx, |_, cx| cx.notify());
        cx.run_until_parked();

        let marker_after = cx.debug_bounds("retend-node-4").unwrap();
        assert!(marker_after.origin.x > marker_before.origin.x);

        tree.borrow_mut()
            .apply_commands(
                window,
                vec![Command::UpdateText {
                    id: 3,
                    text: "a longer reactive text value".into(),
                }],
            )
            .unwrap();
        view.update(cx, |_, cx| cx.notify());
        cx.run_until_parked();

        let marker_updated = cx.debug_bounds("retend-node-4").unwrap();
        assert!(marker_updated.origin.x > marker_after.origin.x);
        assert!(marker_updated.origin.x < parent.origin.x + parent.size.width);

        tree.borrow_mut()
            .apply_commands(
                window,
                vec![Command::UpdateText {
                    id: 3,
                    text: "short".into(),
                }],
            )
            .unwrap();
        view.update(cx, |_, cx| cx.notify());
        cx.run_until_parked();

        let marker_restored = cx.debug_bounds("retend-node-4").unwrap();
        assert_eq!(marker_restored.origin.x, marker_after.origin.x);
    }

    struct ImageTestView {
        tree: Rc<RefCell<NativeTree>>,
        runtime_state: RuntimeStateRegistry,
        window_id: WindowId,
    }

    impl Render for ImageTestView {
        fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
            let tree = self.tree.borrow();
            let generation = self.runtime_state.begin_frame(&tree, self.window_id);
            div()
                .flex()
                .child(test_inner(&tree, 2, &self.runtime_state, generation))
                .child(
                    div()
                        .w(px(1.0))
                        .h(px(1.0))
                        .debug_selector(|| AFTER_IMAGE.into()),
                )
        }
    }

    #[gpui::test]
    fn image_src_clear_and_readd_preserves_mounted_layout_and_loads_the_new_source(
        cx: &mut TestAppContext,
    ) {
        const FIRST: &str = "https://example.com/first.png";
        const SECOND: &str = "https://example.com/second.png";

        let requests = Arc::new(Mutex::new(Vec::new()));
        let client = FakeHttpClient::create({
            let requests = requests.clone();
            move |request| {
                let requests = requests.clone();
                let uri = request.uri().to_string();
                async move {
                    requests.lock().unwrap().push(uri);
                    Ok(Response::builder()
                        .status(200)
                        .body(AsyncBody::from(SVG))
                        .unwrap())
                }
            }
        });
        cx.update(|cx| cx.set_http_client(client));

        let tree = Rc::new(RefCell::new(NativeTree::default()));
        let window = tree.borrow_mut().create_window(1).unwrap();
        tree.borrow_mut()
            .apply_commands(
                window,
                vec![
                    Command::CreateNode {
                        id: 2,
                        kind: ElementKind::Image,
                    },
                    Command::SetProperty {
                        id: 2,
                        property: PropertyId::Src,
                        value: PropertyValue::String(FIRST.into()),
                    },
                    Command::SetStyle {
                        id: 2,
                        properties: vec![
                            (PropertyId::Width, PropertyValue::Number(120.0)),
                            (PropertyId::Height, PropertyValue::Number(40.0)),
                        ],
                    },
                ],
            )
            .unwrap();

        let runtime_state = RuntimeStateRegistry::default();
        let (view, cx) = cx.add_window_view({
            let tree = tree.clone();
            let runtime_state = runtime_state.clone();
            move |_, _| ImageTestView {
                tree,
                runtime_state,
                window_id: window,
            }
        });
        cx.run_until_parked();
        assert!(requests.lock().unwrap().iter().any(|uri| uri == FIRST));
        let image_width = cx
            .debug_bounds(AFTER_IMAGE)
            .expect("sentinel must be laid out after the image")
            .origin
            .x;
        assert_eq!(image_width, px(120.0));

        tree.borrow_mut()
            .apply_commands(
                window,
                vec![Command::SetProperty {
                    id: 2,
                    property: PropertyId::Src,
                    value: PropertyValue::Null,
                }],
            )
            .unwrap();
        view.update(cx, |_, cx| cx.notify());
        cx.run_until_parked();

        assert_eq!(
            cx.debug_bounds(AFTER_IMAGE)
                .expect("source-less image must keep its layout box")
                .origin
                .x,
            image_width
        );
        assert!(!requests.lock().unwrap().iter().any(|uri| uri == SECOND));

        tree.borrow_mut()
            .apply_commands(
                window,
                vec![Command::SetProperty {
                    id: 2,
                    property: PropertyId::Src,
                    value: PropertyValue::String(SECOND.into()),
                }],
            )
            .unwrap();
        view.update(cx, |_, cx| cx.notify());
        cx.run_until_parked();

        assert!(requests.lock().unwrap().iter().any(|uri| uri == SECOND));
        assert_eq!(
            cx.debug_bounds(AFTER_IMAGE)
                .expect("replacement image must keep the same layout box")
                .origin
                .x,
            image_width
        );
    }
}
