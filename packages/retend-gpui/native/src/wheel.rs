use std::cell::RefCell;

use gpui::{
    AnyElement, App, Bounds, Element, ElementId, GlobalElementId, Hitbox, HitboxBehavior,
    InspectorElementId, IntoElement, LayoutId, Pixels, ScrollWheelEvent, Window,
};

use crate::{
    events,
    tree::{NodeId, WindowId},
};

type WheelTarget = (WindowId, events::NativeEventPayload);

thread_local! {
    // GPUI flushes deferred work at the end of each platform input update.
    static PENDING: RefCell<Option<WheelTarget>> = const { RefCell::new(None) };
}

pub(crate) fn observe(inner: AnyElement, window_id: WindowId, id: NodeId) -> AnyElement {
    WheelObserver {
        inner,
        window_id,
        id,
    }
    .into_any_element()
}

struct WheelObserver {
    inner: AnyElement,
    window_id: WindowId,
    id: NodeId,
}

impl IntoElement for WheelObserver {
    type Element = Self;

    fn into_element(self) -> Self {
        self
    }
}

impl Element for WheelObserver {
    type RequestLayoutState = ();
    type PrepaintState = Hitbox;

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
    ) -> Hitbox {
        self.inner.prepaint(window, cx);
        window.insert_hitbox(bounds, HitboxBehavior::Normal)
    }

    fn paint(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&InspectorElementId>,
        _bounds: Bounds<Pixels>,
        _request_layout: &mut (),
        hitbox: &mut Hitbox,
        window: &mut Window,
        cx: &mut App,
    ) {
        let hitbox = hitbox.clone();
        let window_id = self.window_id;
        let id = self.id;
        // Capture visits parents before children and back layers before front
        // layers. The last hit is the native target; Retend handles bubbling.
        window.on_mouse_event(move |event: &ScrollWheelEvent, phase, window, cx| {
            if phase.capture() && hitbox.should_handle_scroll(window) {
                let payload = events::in_window(events::wheel(id, event), window);
                if PENDING.replace(Some((window_id, payload))).is_none() {
                    // Flush after all capture listeners, including deferred
                    // overlays, without interrupting native scroll handling.
                    cx.defer(|_| {
                        if let Some((window_id, payload)) = PENDING.take() {
                            events::emit(window_id, payload);
                        }
                    });
                }
            }
        });
        self.inner.paint(window, cx);
    }
}
