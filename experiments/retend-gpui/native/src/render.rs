use std::sync::Arc;

use gpui::{div, img, prelude::*, AnyElement, ElementId, ImageCacheError, ImageSource, Text};

use crate::tree::{NativeTree, NodeData, NodeId};

/// Builds a fresh GPUI element tree directly from the authoritative retained tree.
pub fn build(tree: &NativeTree, id: NodeId) -> AnyElement {
    let node = &tree.nodes[&id];
    match &node.data {
        NodeData::Root | NodeData::Container => node
            .style
            .apply(div())
            .children(node.children.iter().map(|child_id| build(tree, *child_id)))
            .into_any_element(),
        NodeData::Text(text) => {
            Text::new(ElementId::Integer(u64::from(id)), text.clone().into()).into_any_element()
        }
        NodeData::Image { src } => {
            let source = src.clone().map(ImageSource::from).unwrap_or_else(|| {
                ImageSource::Custom(Arc::new(|_, _| {
                    Some(Err(ImageCacheError::Asset("image source is unset".into())))
                }))
            });
            node.style
                .apply(img(source))
                .id(ElementId::Integer(u64::from(id)))
                .into_any_element()
        }
        NodeData::Anchor => gpui::Empty.into_any_element(),
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
                    Command::SetProperty {
                        id: 2,
                        property: PropertyId::Width,
                        value: PropertyValue::Number(120.0),
                    },
                    Command::SetProperty {
                        id: 2,
                        property: PropertyId::Height,
                        value: PropertyValue::Number(40.0),
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
