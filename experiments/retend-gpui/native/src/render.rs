use std::sync::Arc;

use gpui::{
    div, img, prelude::*, AnyElement, ElementId, ImageCacheError, ImageSource, StyledImage, Text,
};

use crate::tree::{ImageObjectFit, NativeTree, NodeData, NodeId};

fn to_gpui_object_fit(value: ImageObjectFit) -> gpui::ObjectFit {
    match value {
        ImageObjectFit::Fill => gpui::ObjectFit::Fill,
        ImageObjectFit::Contain => gpui::ObjectFit::Contain,
        ImageObjectFit::Cover => gpui::ObjectFit::Cover,
        ImageObjectFit::ScaleDown => gpui::ObjectFit::ScaleDown,
        ImageObjectFit::None => gpui::ObjectFit::None,
    }
}

/// Builds a fresh GPUI element tree directly from the authoritative retained tree.
pub fn build(tree: &NativeTree, id: NodeId) -> AnyElement {
    let node = &tree.nodes[&id];
    match &node.data {
        NodeData::Root | NodeData::Container => {
            let element = match node.style.as_deref() {
                Some(style) => style.apply(div()),
                None => div().block(),
            };
            let element =
                element.children(node.children.iter().map(|child_id| build(tree, *child_id)));
            #[cfg(test)]
            let element = element.debug_selector(move || format!("retend-node-{id}"));
            element.into_any_element()
        }
        NodeData::Text(text) => {
            Text::new(ElementId::Integer(u64::from(id)), text.clone().into()).into_any_element()
        }
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
            image
                .id(ElementId::Integer(u64::from(id)))
                .into_any_element()
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        cell::RefCell,
        rc::Rc,
        sync::{Arc, Mutex},
    };

    use gpui::{
        http_client::{AsyncBody, FakeHttpClient, Response},
        px, Context, Render, TestAppContext, Window,
    };

    use super::*;
    use crate::protocol::{Command, PropertyValue};
    use crate::protocol_generated::{ElementKind, PropertyId};

    const SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>"#;
    const AFTER_IMAGE: &str = "after-image";

    #[test]
    fn container_styles_are_applied_to_gpui() {
        let mut tree = NativeTree::default();
        let window = tree.create_window(1).unwrap();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Container,
                },
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

        let mut element = build(&tree, 2);
        let actual = element
            .downcast_mut::<gpui::Div>()
            .expect("native containers must render as GPUI Divs");
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

        let mut element = build(&tree, 2);
        element
            .downcast_mut::<gpui::Stateful<gpui::Img>>()
            .expect("native images must render as stateful GPUI Img elements");
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

        let mut element = build(&tree, 2);
        let text = element
            .downcast_mut::<Text>()
            .expect("native text nodes must render as GPUI Text");
        assert_eq!(text.id(), Some(&ElementId::Integer(2)));
        assert_eq!(text.text().as_ref(), "hello");
    }

    struct LayoutTestView {
        tree: Rc<RefCell<NativeTree>>,
    }

    impl Render for LayoutTestView {
        fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
            div().size_full().child(build(&self.tree.borrow(), 1))
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
                    Command::CreateNode {
                        id: 2,
                        kind: ElementKind::Container,
                    },
                    Command::CreateNode {
                        id: 3,
                        kind: ElementKind::Container,
                    },
                    Command::SetStyle {
                        id: 2,
                        properties: vec![(PropertyId::Width, PropertyValue::Number(420.0))],
                    },
                    Command::InsertChild {
                        parent_id: 1,
                        child_id: 2,
                        before_id: 0,
                    },
                    Command::InsertChild {
                        parent_id: 2,
                        child_id: 3,
                        before_id: 0,
                    },
                ],
            )
            .unwrap();

        let (view, cx) = cx.add_window_view({
            let tree = tree.clone();
            move |_, _| LayoutTestView { tree }
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
                    Command::CreateNode {
                        id: 2,
                        kind: ElementKind::Container,
                    },
                    Command::CreateText {
                        id: 3,
                        text: "short".into(),
                    },
                    Command::CreateNode {
                        id: 4,
                        kind: ElementKind::Container,
                    },
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
                    Command::InsertChild {
                        parent_id: 1,
                        child_id: 2,
                        before_id: 0,
                    },
                    Command::InsertChild {
                        parent_id: 2,
                        child_id: 3,
                        before_id: 0,
                    },
                    Command::InsertChild {
                        parent_id: 2,
                        child_id: 4,
                        before_id: 0,
                    },
                ],
            )
            .unwrap();

        let (view, cx) = cx.add_window_view({
            let tree = tree.clone();
            move |_, _| LayoutTestView { tree }
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
    }

    struct ImageTestView {
        tree: Rc<RefCell<NativeTree>>,
    }

    impl Render for ImageTestView {
        fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
            div().flex().child(build(&self.tree.borrow(), 2)).child(
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

        let (view, cx) = cx.add_window_view({
            let tree = tree.clone();
            move |_, _| ImageTestView { tree }
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
