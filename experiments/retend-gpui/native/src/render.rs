use gpui::{div, prelude::*, AnyElement};

use crate::protocol_generated::ElementKind;
use crate::tree::{NativeTree, NodeId};

/// Builds a fresh GPUI element tree directly from the authoritative retained tree.
pub fn build(tree: &NativeTree, id: NodeId) -> AnyElement {
    let node = &tree.nodes[&id];

    match node.kind {
        ElementKind::Root | ElementKind::Container => node
            .style
            .apply(div())
            .children(node.children.iter().map(|child_id| build(tree, *child_id)))
            .into_any_element(),
        ElementKind::Text => node
            .text
            .as_ref()
            .expect("native text nodes must always contain text")
            .clone()
            .into_any_element(),
        ElementKind::Anchor => div().hidden().into_any_element(),
        ElementKind::Span | ElementKind::Image | ElementKind::Input | ElementKind::Textarea => {
            unreachable!("unsupported element kinds are rejected during command application")
        }
    }
}
