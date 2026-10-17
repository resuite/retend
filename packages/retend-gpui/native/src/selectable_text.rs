//! Mouse-selectable, read-only text built on GPUI's shaped text layout.
//! StyledText owns all shaping, measurement, wrapping, and highlighting.

use gpui::{
    accesskit, App, Bounds, DispatchPhase, Element, ElementId, FocusHandle, GlobalElementId,
    HighlightStyle, Hitbox, HitboxBehavior, InspectorElementId, IntoElement, LayoutId, MouseButton,
    MouseDownEvent, MouseMoveEvent, MouseUpEvent, Pixels, SharedString, StyledText, TextLayout,
    Window,
};

use crate::{runtime_state::RuntimeStateRegistry, tree::NodeId};

pub struct SelectableText {
    id: NodeId,
    text: SharedString,
    inner: StyledText,
    runtime: RuntimeStateRegistry,
    focus: FocusHandle,
}

impl SelectableText {
    pub fn new(
        id: NodeId,
        text: SharedString,
        runtime: RuntimeStateRegistry,
        focus: FocusHandle,
    ) -> Self {
        let range = runtime
            .text_selection(id)
            .map(|selection| selection.range())
            .filter(|range| !range.is_empty());
        let mut inner = StyledText::new(text.clone());
        if let Some(range) = range {
            inner = inner.with_highlights([(
                range,
                HighlightStyle {
                    background_color: Some(gpui::rgb(0xaccbff).into()),
                    ..Default::default()
                },
            )]);
        }
        Self {
            id,
            text,
            inner,
            runtime,
            focus,
        }
    }
}

fn text_offset(layout: &TextLayout, position: gpui::Point<Pixels>, text: &str) -> usize {
    let mut index = layout
        .index_for_position(position)
        .unwrap_or_else(|index| index)
        .min(text.len());
    while !text.is_char_boundary(index) {
        index -= 1;
    }
    index
}

impl IntoElement for SelectableText {
    type Element = Self;

    fn into_element(self) -> Self::Element {
        self
    }
}

impl Element for SelectableText {
    type RequestLayoutState = ();
    type PrepaintState = Hitbox;

    fn id(&self) -> Option<ElementId> {
        Some(ElementId::Integer(u64::from(self.id)))
    }

    fn source_location(&self) -> Option<&'static std::panic::Location<'static>> {
        None
    }

    fn a11y_role(&self) -> Option<accesskit::Role> {
        Some(accesskit::Role::Label)
    }

    fn write_a11y_info(&self, node: &mut accesskit::Node) {
        node.set_value(self.text.to_string());
    }

    fn request_layout(
        &mut self,
        _id: Option<&GlobalElementId>,
        inspector_id: Option<&InspectorElementId>,
        window: &mut Window,
        cx: &mut App,
    ) -> (LayoutId, ()) {
        self.inner.request_layout(None, inspector_id, window, cx)
    }

    fn prepaint(
        &mut self,
        _id: Option<&GlobalElementId>,
        inspector_id: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        state: &mut (),
        window: &mut Window,
        cx: &mut App,
    ) -> Hitbox {
        self.inner
            .prepaint(None, inspector_id, bounds, state, window, cx);
        window.insert_hitbox(bounds, HitboxBehavior::Normal)
    }

    fn paint(
        &mut self,
        _id: Option<&GlobalElementId>,
        inspector_id: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        state: &mut (),
        hitbox: &mut Hitbox,
        window: &mut Window,
        cx: &mut App,
    ) {
        self.inner
            .paint(None, inspector_id, bounds, state, &mut (), window, cx);
        if hitbox.is_hovered(window) {
            window.set_cursor_style(gpui::CursorStyle::IBeam, hitbox);
        }

        let id = self.id;
        let text = self.text.clone();
        let layout = self.inner.layout().clone();
        let runtime = self.runtime.clone();
        let focus = self.focus.clone();
        let hitbox = hitbox.clone();
        window.on_mouse_event(move |event: &MouseDownEvent, phase, window, cx| {
            if phase != DispatchPhase::Bubble
                || event.button != MouseButton::Left
                || !hitbox.is_hovered(window)
            {
                return;
            }
            let anchor = text_offset(&layout, event.position, &text);
            runtime.start_text_selection(id, text.clone(), anchor);
            focus.focus(window, cx);
            window.refresh();
        });

        // GPUI rebuilds listeners on each frame. Once a drag starts, the
        // refreshed frame registers move/up only for its active text run.
        if !self
            .runtime
            .text_selection(self.id)
            .is_some_and(|state| state.dragging)
        {
            return;
        }

        let runtime = self.runtime.clone();
        let layout = self.inner.layout().clone();
        let text = self.text.clone();
        let id = self.id;
        window.on_mouse_event(move |event: &MouseMoveEvent, phase, window, _| {
            if phase != DispatchPhase::Bubble || event.pressed_button != Some(MouseButton::Left) {
                return;
            }
            let head = text_offset(&layout, event.position, &text);
            if runtime.update_text_selection(id, head) {
                window.refresh();
            }
        });

        let runtime = self.runtime.clone();
        let id = self.id;
        window.on_mouse_event(move |event: &MouseUpEvent, phase, window, _| {
            if phase == DispatchPhase::Bubble
                && event.button == MouseButton::Left
                && runtime.finish_text_selection(id)
            {
                window.refresh();
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gpui::prelude::*;

    struct TestSelectionView {
        runtime: RuntimeStateRegistry,
        focus: FocusHandle,
    }

    impl gpui::Render for TestSelectionView {
        fn render(
            &mut self,
            _window: &mut Window,
            _cx: &mut gpui::Context<Self>,
        ) -> impl gpui::IntoElement {
            gpui::div()
                .size_full()
                .track_focus(&self.focus)
                .child(SelectableText::new(
                    42,
                    "sample text for selection".into(),
                    self.runtime.clone(),
                    self.focus.clone(),
                ))
        }
    }

    #[gpui::test]
    fn dragging_selects_shaped_text_and_replaces_the_previous_selection(
        cx: &mut gpui::TestAppContext,
    ) {
        use gpui::{point, px, Modifiers};
        let runtime = RuntimeStateRegistry::default();
        let (_, cx) = cx.add_window_view({
            let runtime = runtime.clone();
            move |_, cx| TestSelectionView {
                runtime,
                focus: cx.focus_handle(),
            }
        });
        cx.update(|window, cx| {
            window.activate_window();
            window.draw(cx).clear(cx);
        });
        let at = |x| point(px(x), px(8.0));
        cx.simulate_mouse_down(at(5.0), MouseButton::Left, Modifiers::default());
        cx.simulate_mouse_move(at(90.0), MouseButton::Left, Modifiers::default());
        cx.simulate_mouse_up(at(90.0), MouseButton::Left, Modifiers::default());
        let selection = runtime
            .text_selection(42)
            .expect("drag creates a selection");
        assert!(!selection.dragging);
        assert!(selection.selected_text().is_some());
        assert!(selection.text.is_char_boundary(selection.range().start));
        assert!(selection.text.is_char_boundary(selection.range().end));
        cx.simulate_click(at(5.0), Modifiers::default());
        assert!(
            runtime.text_selection(42).is_none(),
            "single click clears selection"
        );
    }

    #[test]
    fn selected_text_uses_utf8_character_boundaries() {
        let selection = crate::runtime_state::PlainTextSelection {
            node_id: 1,
            text: "é🚀a".into(),
            anchor: 2,
            head: 6,
            dragging: false,
        };
        assert_eq!(selection.selected_text(), Some("🚀"));
    }
}
