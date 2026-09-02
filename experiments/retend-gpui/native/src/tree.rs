use std::collections::{HashMap, HashSet};

use serde::Serialize;

use crate::protocol::{Command, PropertyValue};
use crate::protocol_generated::{ElementKind, PropertyId};
use crate::style::NativeStyle;
use crate::BridgeFailure;

pub type NodeId = u32;
pub type WindowId = u32;

fn invalid<T>(
    index: usize,
    code: &'static str,
    message: impl Into<String>,
) -> Result<T, BridgeFailure> {
    Err(BridgeFailure::command(index, code, message))
}

#[derive(Clone, Debug, Serialize)]
pub struct FatalDiagnostic {
    pub native_failure: String,
    pub javascript_stack: String,
}

#[derive(Clone, Debug)]
pub enum NodeData {
    Root,
    Container,
    Text(String),
    Image { src: Option<String> },
    Anchor,
}

pub struct NativeNode {
    pub window_id: WindowId,
    pub data: NodeData,
    pub parent: Option<NodeId>,
    pub children: Vec<NodeId>,
    pub style: NativeStyle,
}

impl NativeNode {
    fn new(window_id: WindowId, data: NodeData) -> Self {
        Self {
            window_id,
            data,
            parent: None,
            children: Vec::new(),
            style: NativeStyle::default(),
        }
    }
}

pub struct WindowState {
    pub root_id: NodeId,
    pub pending_detached: HashSet<NodeId>,
    pub fatal: Option<FatalDiagnostic>,
}

#[derive(Default)]
pub struct NativeTree {
    pub nodes: HashMap<NodeId, NativeNode>,
    pub windows: HashMap<WindowId, WindowState>,
    next_window_id: WindowId,
}

impl NativeTree {
    pub fn create_window(&mut self, root_id: NodeId) -> Result<WindowId, BridgeFailure> {
        if root_id == 0 {
            return Err(BridgeFailure::binding(
                "INVALID_NODE_ID",
                "Node ID 0 is reserved by the protocol.",
            ));
        }
        if self.nodes.contains_key(&root_id) {
            return Err(BridgeFailure::binding(
                "DUPLICATE_NODE_ID",
                format!("Node ID {root_id} already exists."),
            ));
        }
        self.next_window_id = self.next_window_id.checked_add(1).ok_or_else(|| {
            BridgeFailure::binding("WINDOW_ID_EXHAUSTED", "Window ID space exhausted.")
        })?;
        let window_id = self.next_window_id;
        self.nodes
            .insert(root_id, NativeNode::new(window_id, NodeData::Root));
        self.windows.insert(
            window_id,
            WindowState {
                root_id,
                pending_detached: HashSet::new(),
                fatal: None,
            },
        );
        Ok(window_id)
    }

    pub fn apply_commands(
        &mut self,
        window_id: WindowId,
        commands: Vec<Command>,
    ) -> Result<(), BridgeFailure> {
        self.ensure_binding_usable(window_id)?;
        for (index, command) in commands.into_iter().enumerate() {
            if let Err(error) = self.apply_command(window_id, index, command) {
                self.poison_native(window_id, &error)
                    .expect("validated window must still exist while applying a command batch");
                return Err(error);
            }
        }
        Ok(())
    }

    pub fn settle(&mut self, window_id: WindowId) -> Result<Vec<NodeId>, BridgeFailure> {
        self.ensure_binding_usable(window_id)?;
        let pending = std::mem::take(&mut self.window(window_id)?.pending_detached);
        let mut destroyed = Vec::new();
        for id in pending {
            if self
                .nodes
                .get(&id)
                .is_some_and(|node| node.window_id == window_id && node.parent.is_none())
            {
                self.destroy_subtree(id, &mut destroyed);
            }
        }
        Ok(destroyed)
    }

    pub fn poison_native(
        &mut self,
        window_id: WindowId,
        failure: &impl Serialize,
    ) -> Result<(), BridgeFailure> {
        self.window(window_id)?
            .fatal
            .get_or_insert_with(|| FatalDiagnostic {
                native_failure: serde_json::to_string(failure)
                    .expect("native bridge failures must serialize to JSON"),
                javascript_stack: String::new(),
            });
        Ok(())
    }

    pub fn attach_javascript_stack(
        &mut self,
        window_id: WindowId,
        javascript_stack: String,
    ) -> Result<(), BridgeFailure> {
        let fatal = self.window(window_id)?.fatal.as_mut().ok_or_else(|| {
            BridgeFailure::binding(
                "RENDERER_NOT_POISONED",
                "Renderer has no native failure to attach a JavaScript stack to.",
            )
        })?;
        fatal.javascript_stack = javascript_stack;
        Ok(())
    }

    pub fn close_window(&mut self, window_id: WindowId) -> Vec<NodeId> {
        if self.windows.remove(&window_id).is_none() {
            return Vec::new();
        }
        let mut destroyed = Vec::new();
        self.nodes.retain(|id, node| {
            let keep = node.window_id != window_id;
            if !keep {
                destroyed.push(*id);
            }
            keep
        });
        destroyed.sort_unstable();
        destroyed
    }

    pub fn debug_window_json(&self, window_id: WindowId) -> Result<String, BridgeFailure> {
        let window = self.windows.get(&window_id).ok_or_else(|| {
            BridgeFailure::binding("INVALID_WINDOW", "Renderer window does not exist.")
        })?;
        #[derive(Serialize)]
        struct Snapshot<'a> {
            window_id: WindowId,
            root_id: NodeId,
            poisoned: bool,
            pending_detached: Vec<NodeId>,
            fatal: &'a Option<FatalDiagnostic>,
            nodes: Vec<NodeSnapshot<'a>>,
        }
        #[derive(Serialize)]
        struct NodeSnapshot<'a> {
            id: NodeId,
            kind: &'static str,
            parent: Option<NodeId>,
            children: &'a [NodeId],
            text: Option<&'a str>,
            src: Option<&'a str>,
        }

        let mut pending_detached: Vec<_> = window.pending_detached.iter().copied().collect();
        pending_detached.sort_unstable();
        let mut nodes: Vec<_> = self
            .nodes
            .iter()
            .filter(|(_, node)| node.window_id == window_id)
            .map(|(&id, node)| {
                let (kind, text, src) = match &node.data {
                    NodeData::Root => ("Root", None, None),
                    NodeData::Container => ("Container", None, None),
                    NodeData::Text(text) => ("Text", Some(text.as_str()), None),
                    NodeData::Image { src } => ("Image", None, src.as_deref()),
                    NodeData::Anchor => ("Anchor", None, None),
                };
                NodeSnapshot {
                    id,
                    kind,
                    parent: node.parent,
                    children: &node.children,
                    text,
                    src,
                }
            })
            .collect();
        nodes.sort_by_key(|node| node.id);
        serde_json::to_string(&Snapshot {
            window_id,
            root_id: window.root_id,
            poisoned: window.fatal.is_some(),
            pending_detached,
            fatal: &window.fatal,
            nodes,
        })
        .map_err(|error| BridgeFailure::binding("SERIALIZATION_ERROR", error.to_string()))
    }

    fn ensure_binding_usable(&self, window_id: WindowId) -> Result<(), BridgeFailure> {
        let window = self.windows.get(&window_id).ok_or_else(|| {
            BridgeFailure::binding("CLOSED_WINDOW", "Renderer window has already closed.")
        })?;
        if window.fatal.is_some() {
            return Err(BridgeFailure::binding(
                "POISONED_RENDERER",
                "Renderer is permanently poisoned after a fatal bridge failure.",
            ));
        }
        Ok(())
    }

    fn destroy_subtree(&mut self, id: NodeId, destroyed: &mut Vec<NodeId>) {
        let Some(node) = self.nodes.remove(&id) else {
            return;
        };
        for child_id in node.children {
            self.destroy_subtree(child_id, destroyed);
        }
        destroyed.push(id);
    }

    fn apply_command(
        &mut self,
        window_id: WindowId,
        index: usize,
        command: Command,
    ) -> Result<(), BridgeFailure> {
        match command {
            Command::CreateNode { id, kind } => match kind {
                ElementKind::Container => self.create(index, window_id, id, NodeData::Container),
                ElementKind::Image => {
                    self.create(index, window_id, id, NodeData::Image { src: None })
                }
                ElementKind::Anchor => self.create(index, window_id, id, NodeData::Anchor),
                ElementKind::Root => invalid(
                    index,
                    "INVALID_NODE_KIND",
                    "Root nodes are created only when a native window is created.",
                ),
                ElementKind::Text => invalid(
                    index,
                    "INVALID_NODE_KIND",
                    "Text nodes must be created with CREATE_TEXT.",
                ),
                ElementKind::Input | ElementKind::Textarea => invalid(
                    index,
                    "UNSUPPORTED_ELEMENT_KIND",
                    format!("{kind:?} rendering is not implemented yet."),
                ),
            },
            Command::CreateText { id, text } => {
                self.create(index, window_id, id, NodeData::Text(text))
            }
            Command::UpdateText { id, text } => {
                let node = self.node_mut(window_id, index, id)?;
                match &mut node.data {
                    NodeData::Text(current) => {
                        *current = text;
                        Ok(())
                    }
                    _ => invalid(
                        index,
                        "INVALID_NODE_KIND",
                        format!("UPDATE_TEXT target {id} is not a text node."),
                    ),
                }
            }
            Command::SetProperty {
                id,
                property,
                value,
            } => {
                let node = self.node_mut(window_id, index, id)?;
                if property == PropertyId::Src {
                    if let NodeData::Image { src } = &mut node.data {
                        return match value {
                            PropertyValue::Null => {
                                *src = None;
                                Ok(())
                            }
                            PropertyValue::String(value) => {
                                let is_http = url::Url::parse(&value)
                                    .is_ok_and(|url| matches!(url.scheme(), "http" | "https"));
                                *src = is_http.then_some(value);
                                Ok(())
                            }
                            _ => invalid(
                                index,
                                "INVALID_PROPERTY_VALUE",
                                "Image src must be an HTTP(S) URL string or null.",
                            ),
                        };
                    }
                }
                if node.style.set_property(property, &value) {
                    Ok(())
                } else {
                    invalid(
                        index,
                        "UNSUPPORTED_PROPERTY",
                        format!("{property:?} is not implemented by the native renderer yet."),
                    )
                }
            }
            Command::InsertChild {
                parent_id,
                child_id,
                before_id,
            } => self.insert(window_id, index, parent_id, child_id, before_id),
            Command::RemoveChild {
                parent_id,
                child_id,
            } => self.remove(window_id, index, parent_id, child_id),
        }
    }

    fn create(
        &mut self,
        index: usize,
        window_id: WindowId,
        id: NodeId,
        data: NodeData,
    ) -> Result<(), BridgeFailure> {
        if id == 0 {
            return invalid(
                index,
                "INVALID_NODE_ID",
                "Node ID 0 is reserved by the protocol.",
            );
        }
        if self.nodes.contains_key(&id) {
            return invalid(
                index,
                "DUPLICATE_NODE_ID",
                format!("Node ID {id} already exists."),
            );
        }
        self.nodes.insert(id, NativeNode::new(window_id, data));
        Ok(())
    }

    fn node(
        &self,
        window_id: WindowId,
        index: usize,
        id: NodeId,
    ) -> Result<&NativeNode, BridgeFailure> {
        let Some(node) = self.nodes.get(&id) else {
            return invalid(
                index,
                "INVALID_NODE_REFERENCE",
                format!("Node ID {id} does not exist."),
            );
        };
        if node.window_id != window_id {
            return invalid(
                index,
                "CROSS_WINDOW_NODE",
                format!("Node ID {id} belongs to another window."),
            );
        }
        Ok(node)
    }

    fn node_mut(
        &mut self,
        window_id: WindowId,
        index: usize,
        id: NodeId,
    ) -> Result<&mut NativeNode, BridgeFailure> {
        self.node(window_id, index, id)?;
        Ok(self.nodes.get_mut(&id).unwrap())
    }

    fn window(&mut self, window_id: WindowId) -> Result<&mut WindowState, BridgeFailure> {
        self.windows.get_mut(&window_id).ok_or_else(|| {
            BridgeFailure::binding("CLOSED_WINDOW", "Renderer window has already closed.")
        })
    }

    fn child_position(
        &self,
        index: usize,
        parent_id: NodeId,
        child_id: NodeId,
    ) -> Result<usize, BridgeFailure> {
        self.nodes[&parent_id]
            .children
            .iter()
            .position(|id| *id == child_id)
            .ok_or_else(|| {
                BridgeFailure::command(
                    index,
                    "BROKEN_PARENTAGE",
                    "Parent pointer and child list disagree.",
                )
            })
    }

    fn insert(
        &mut self,
        window_id: WindowId,
        index: usize,
        parent_id: NodeId,
        child_id: NodeId,
        before_id: NodeId,
    ) -> Result<(), BridgeFailure> {
        let (parent_accepts_children, parent_kind) =
            match &self.node(window_id, index, parent_id)?.data {
                NodeData::Root => (true, "Root"),
                NodeData::Container => (true, "Container"),
                NodeData::Text(_) => (false, "Text"),
                NodeData::Image { .. } => (false, "Image"),
                NodeData::Anchor => (false, "Anchor"),
            };
        let child_parent = self.node(window_id, index, child_id)?.parent;
        let root_id = self.windows[&window_id].root_id;

        if child_id == root_id {
            return invalid(
                index,
                "ROOT_REPARENT",
                "The immutable window root cannot become a child node.",
            );
        }
        if !parent_accepts_children {
            return invalid(
                index,
                "INVALID_PARENT_KIND",
                format!("{parent_kind} nodes cannot contain native children."),
            );
        }
        if parent_id == child_id {
            return invalid(
                index,
                "STRUCTURAL_CYCLE",
                "A node cannot be inserted into itself.",
            );
        }

        let before_position = if before_id == 0 {
            None
        } else {
            if self.node(window_id, index, before_id)?.parent != Some(parent_id) {
                return invalid(
                    index,
                    "INVALID_BEFORE_NODE",
                    format!("beforeId {before_id} is not a child of parent {parent_id}."),
                );
            }
            Some(self.child_position(index, parent_id, before_id)?)
        };

        let mut ancestor = Some(parent_id);
        while let Some(id) = ancestor {
            if id == child_id {
                return invalid(
                    index,
                    "STRUCTURAL_CYCLE",
                    "Insertion would create a native-tree cycle.",
                );
            }
            ancestor = self.node(window_id, index, id)?.parent;
        }

        let old_position = child_parent
            .map(|parent_id| {
                self.node(window_id, index, parent_id)?;
                self.child_position(index, parent_id, child_id)
            })
            .transpose()?;

        if child_parent == Some(parent_id) && before_id == child_id {
            return Ok(());
        }

        let mut insert_index =
            before_position.unwrap_or_else(|| self.nodes[&parent_id].children.len());
        if child_parent == Some(parent_id)
            && old_position.expect("attached child must have a validated position") < insert_index
        {
            insert_index -= 1;
        }

        if let (Some(old_parent_id), Some(old_position)) = (child_parent, old_position) {
            self.nodes
                .get_mut(&old_parent_id)
                .unwrap()
                .children
                .remove(old_position);
        }
        self.nodes
            .get_mut(&parent_id)
            .unwrap()
            .children
            .insert(insert_index, child_id);
        self.nodes.get_mut(&child_id).unwrap().parent = Some(parent_id);
        self.windows
            .get_mut(&window_id)
            .unwrap()
            .pending_detached
            .remove(&child_id);
        Ok(())
    }

    fn remove(
        &mut self,
        window_id: WindowId,
        index: usize,
        parent_id: NodeId,
        child_id: NodeId,
    ) -> Result<(), BridgeFailure> {
        self.node(window_id, index, parent_id)?;
        if self.node(window_id, index, child_id)?.parent != Some(parent_id) {
            return invalid(
                index,
                "INVALID_PARENT",
                format!("Node {child_id} is not a child of {parent_id}."),
            );
        }
        let position = self.child_position(index, parent_id, child_id)?;

        self.nodes
            .get_mut(&parent_id)
            .unwrap()
            .children
            .remove(position);
        self.nodes.get_mut(&child_id).unwrap().parent = None;
        self.windows
            .get_mut(&window_id)
            .unwrap()
            .pending_detached
            .insert(child_id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{Command, PropertyValue};
    use crate::protocol_generated::PropertyId;

    fn setup() -> (NativeTree, WindowId, NodeId) {
        let mut tree = NativeTree::default();
        let root = 1;
        let window = tree.create_window(root).unwrap();
        (tree, window, root)
    }

    #[test]
    fn set_property_stores_supported_values_in_parsed_native_style() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Container,
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::Width,
                    value: PropertyValue::String("25%".into()),
                },
            ],
        )
        .unwrap();

        assert_eq!(
            tree.nodes[&2].style.width,
            Some(crate::style::LengthValue::Percent(25.0))
        );
    }

    #[test]
    fn image_src_replaces_and_clears_without_poisoning() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Image,
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::Src,
                    value: PropertyValue::String("https://example.com/first.png".into()),
                },
            ],
        )
        .unwrap();
        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::Image { src } if src.as_deref() == Some("https://example.com/first.png")
        ));

        tree.apply_commands(
            window,
            vec![Command::SetProperty {
                id: 2,
                property: PropertyId::Src,
                value: PropertyValue::String("https://example.com/second.png".into()),
            }],
        )
        .unwrap();
        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::Image { src }
                if src.as_deref() == Some("https://example.com/second.png")
        ));

        tree.apply_commands(
            window,
            vec![Command::SetProperty {
                id: 2,
                property: PropertyId::Src,
                value: PropertyValue::Null,
            }],
        )
        .unwrap();
        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::Image { src } if src.is_none()
        ));
        assert!(tree.windows[&window].fatal.is_none());
    }

    #[test]
    fn relative_image_src_is_outside_the_current_native_surface() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Image,
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::Src,
                    value: PropertyValue::String("image.png".into()),
                },
            ],
        )
        .unwrap();

        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::Image { src } if src.is_none()
        ));
        assert!(tree.windows[&window].fatal.is_none());
    }

    #[test]
    fn invalid_image_src_type_is_fatal_and_preserves_the_previous_source() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Image,
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::Src,
                    value: PropertyValue::String("https://example.com/image.png".into()),
                },
            ],
        )
        .unwrap();

        let error = tree
            .apply_commands(
                window,
                vec![Command::SetProperty {
                    id: 2,
                    property: PropertyId::Src,
                    value: PropertyValue::Number(42.0),
                }],
            )
            .unwrap_err();

        assert_eq!(error.code, "INVALID_PROPERTY_VALUE");
        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::Image { src }
                if src.as_deref() == Some("https://example.com/image.png")
        ));
        assert!(tree.windows[&window].fatal.is_some());
    }

    #[test]
    fn unrepresentable_f64_style_values_fail_soft_after_narrowing() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Container,
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::Width,
                    value: PropertyValue::Number(1e300),
                },
            ],
        )
        .unwrap();

        assert_eq!(tree.nodes[&2].style.width, None);
        assert!(tree.windows[&window].fatal.is_none());
    }

    #[test]
    fn failed_batch_keeps_valid_prefix_and_poisons_window() {
        let (mut tree, window, root) = setup();
        let commands = vec![
            Command::CreateNode {
                id: 2,
                kind: ElementKind::Container,
            },
            Command::InsertChild {
                parent_id: root,
                child_id: 999,
                before_id: 0,
            },
        ];
        let error = tree.apply_commands(window, commands).unwrap_err();
        assert_eq!(error.code, "INVALID_NODE_REFERENCE");
        assert!(tree.nodes.contains_key(&2));
        assert!(tree.nodes[&root].children.is_empty());
        assert!(tree.windows[&window].fatal.is_some());
    }

    #[test]
    fn detach_reinsert_then_settle_preserves_node() {
        let (mut tree, window, root) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Container,
                },
                Command::InsertChild {
                    parent_id: root,
                    child_id: 2,
                    before_id: 0,
                },
            ],
        )
        .unwrap();
        tree.apply_commands(
            window,
            vec![
                Command::RemoveChild {
                    parent_id: root,
                    child_id: 2,
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::Opacity,
                    value: PropertyValue::Number(0.5),
                },
                Command::InsertChild {
                    parent_id: root,
                    child_id: 2,
                    before_id: 0,
                },
            ],
        )
        .unwrap();
        assert!(tree.settle(window).unwrap().is_empty());
        assert!(tree.nodes.contains_key(&2));
    }

    #[test]
    fn settlement_destroys_nested_detached_roots_once() {
        let (mut tree, window, root) = setup();
        tree.apply_commands(
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
                Command::InsertChild {
                    parent_id: root,
                    child_id: 2,
                    before_id: 0,
                },
                Command::InsertChild {
                    parent_id: 2,
                    child_id: 3,
                    before_id: 0,
                },
                Command::RemoveChild {
                    parent_id: root,
                    child_id: 2,
                },
                Command::RemoveChild {
                    parent_id: 2,
                    child_id: 3,
                },
            ],
        )
        .unwrap();
        let destroyed = tree.settle(window).unwrap();
        assert_eq!(destroyed.len(), 2);
        assert!(!tree.nodes.contains_key(&2));
        assert!(!tree.nodes.contains_key(&3));
    }

    #[test]
    fn immutable_root_cannot_be_reparented() {
        let (mut tree, window, root) = setup();
        let error = tree
            .apply_commands(
                window,
                vec![
                    Command::CreateNode {
                        id: 2,
                        kind: ElementKind::Container,
                    },
                    Command::InsertChild {
                        parent_id: 2,
                        child_id: root,
                        before_id: 0,
                    },
                ],
            )
            .unwrap_err();
        assert_eq!(error.code, "ROOT_REPARENT");
        assert!(tree.nodes.get(&root).unwrap().parent.is_none());
        assert!(tree.nodes.contains_key(&2));
        assert!(tree.windows[&window].fatal.is_some());
    }

    #[test]
    fn leaf_nodes_cannot_be_structural_parents() {
        let (mut tree, window, root) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateText {
                    id: 2,
                    text: "parent".into(),
                },
                Command::CreateText {
                    id: 3,
                    text: "child".into(),
                },
            ],
        )
        .unwrap();
        let error = tree
            .apply_commands(
                window,
                vec![Command::InsertChild {
                    parent_id: 2,
                    child_id: 3,
                    before_id: 0,
                }],
            )
            .unwrap_err();
        assert_eq!(error.code, "INVALID_PARENT_KIND");
        assert!(tree.nodes.get(&root).unwrap().children.is_empty());
    }

    #[test]
    fn cross_window_reparenting_is_rejected() {
        let mut tree = NativeTree::default();
        let first = tree.create_window(1).unwrap();
        let second = tree.create_window(2).unwrap();
        tree.apply_commands(
            first,
            vec![Command::CreateNode {
                id: 3,
                kind: ElementKind::Container,
            }],
        )
        .unwrap();
        let error = tree
            .apply_commands(
                second,
                vec![Command::InsertChild {
                    parent_id: 2,
                    child_id: 3,
                    before_id: 0,
                }],
            )
            .unwrap_err();
        assert_eq!(error.code, "CROSS_WINDOW_NODE");
    }

    #[test]
    fn live_node_ids_cannot_collide() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![Command::CreateNode {
                id: 2,
                kind: ElementKind::Container,
            }],
        )
        .unwrap();

        let error = tree
            .apply_commands(
                window,
                vec![Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Container,
                }],
            )
            .unwrap_err();
        assert_eq!(error.code, "DUPLICATE_NODE_ID");

        let error = tree.create_window(2).unwrap_err();
        assert_eq!(error.code, "DUPLICATE_NODE_ID");
    }

    #[test]
    fn duplicate_ids_within_one_batch_are_rejected() {
        let (mut tree, window, _) = setup();
        let error = tree
            .apply_commands(
                window,
                vec![
                    Command::CreateNode {
                        id: 2,
                        kind: ElementKind::Container,
                    },
                    Command::CreateNode {
                        id: 2,
                        kind: ElementKind::Container,
                    },
                ],
            )
            .unwrap_err();
        assert_eq!(error.code, "DUPLICATE_NODE_ID");
        assert!(tree.nodes.contains_key(&2));
        assert!(tree.windows[&window].fatal.is_some());
    }

    #[test]
    fn newly_created_never_attached_nodes_are_not_pending_detached() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![Command::CreateNode {
                id: 2,
                kind: ElementKind::Container,
            }],
        )
        .unwrap();

        assert!(tree
            .windows
            .get(&window)
            .unwrap()
            .pending_detached
            .is_empty());
        assert!(tree.settle(window).unwrap().is_empty());
        assert!(tree.nodes.contains_key(&2));
    }

    #[test]
    fn closing_window_destroys_connected_detached_and_never_attached_nodes() {
        let (mut tree, window, root) = setup();
        tree.apply_commands(
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
                Command::CreateNode {
                    id: 4,
                    kind: ElementKind::Container,
                },
                Command::InsertChild {
                    parent_id: root,
                    child_id: 2,
                    before_id: 0,
                },
                Command::InsertChild {
                    parent_id: root,
                    child_id: 3,
                    before_id: 0,
                },
                Command::RemoveChild {
                    parent_id: root,
                    child_id: 3,
                },
            ],
        )
        .unwrap();

        let destroyed = tree.close_window(window);
        assert_eq!(destroyed, vec![1, 2, 3, 4]);
        assert!(tree.nodes.values().all(|node| node.window_id != window));
        assert!(!tree.windows.contains_key(&window));
        assert!(tree.close_window(window).is_empty());
    }

    #[test]
    fn fatal_stack_requires_poisoned_renderer() {
        let (mut tree, window, _) = setup();
        let error = tree
            .attach_javascript_stack(window, "stack".into())
            .unwrap_err();
        assert_eq!(error.code, "RENDERER_NOT_POISONED");
    }

    #[test]
    fn poisoned_renderer_rejects_later_batches() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![Command::CreateNode {
                id: 0,
                kind: ElementKind::Container,
            }],
        )
        .unwrap_err();
        let error = tree.apply_commands(window, vec![]).unwrap_err();
        assert_eq!(error.code, "POISONED_RENDERER");
    }

    fn structural_node_id() -> impl proptest::strategy::Strategy<Value = u32> {
        proptest::prop_oneof![
            8 => 2u32..10,
            1 => proptest::strategy::Just(0),
            1 => proptest::strategy::Just(1),
            1 => proptest::strategy::Just(u32::MAX),
            3 => proptest::num::u32::ANY,
        ]
    }

    proptest::proptest! {
        #[test]
        fn arbitrary_command_batches_never_panic(
            raw in proptest::collection::vec(
                (0u8..7, structural_node_id(), structural_node_id(), structural_node_id()),
                0..64,
            )
        ) {
            let (mut tree, window, _) = setup();
            let commands: Vec<Command> = raw
                .into_iter()
                .map(|(tag, first, second, third)| match tag {
                    0 => Command::CreateNode {
                        id: first,
                        kind: ElementKind::Container,
                    },
                    1 => Command::CreateText {
                        id: first,
                        text: second.to_string(),
                    },
                    2 => Command::CreateNode {
                        id: first,
                        kind: ElementKind::Image,
                    },
                    3 => Command::CreateNode {
                        id: first,
                        kind: ElementKind::Anchor,
                    },
                    4 => Command::InsertChild {
                        parent_id: first,
                        child_id: second,
                        before_id: third,
                    },
                    5 => Command::RemoveChild {
                        parent_id: first,
                        child_id: second,
                    },
                    _ => Command::SetProperty {
                        id: first,
                        property: if third % 2 == 0 {
                            PropertyId::Color
                        } else {
                            PropertyId::Width
                        },
                        value: if third % 2 == 0 {
                            PropertyValue::String("#336699".into())
                        } else {
                            PropertyValue::Number(f64::from(second))
                        },
                    },
                })
                .collect();
            let _ = tree.apply_commands(window, commands);
        }

        #[test]
        fn valid_stateful_sequences_exercise_structural_and_image_lifecycle(
            ops in proptest::collection::vec(proptest::num::u8::ANY, 0..64)
        ) {
            let (mut tree, window, root) = setup();
            let container = 2;
            let image = u32::MAX;
            let anchor = u32::MAX - 1;
            tree.apply_commands(
                window,
                vec![
                    Command::CreateNode { id: container, kind: ElementKind::Container },
                    Command::CreateNode { id: image, kind: ElementKind::Image },
                    Command::CreateNode { id: anchor, kind: ElementKind::Anchor },
                    Command::InsertChild { parent_id: root, child_id: container, before_id: 0 },
                    Command::InsertChild { parent_id: root, child_id: image, before_id: 0 },
                    Command::InsertChild { parent_id: root, child_id: anchor, before_id: 0 },
                ],
            ).unwrap();

            for value in ops {
                let other_parent = |parent| if parent == root { container } else { root };
                let result = match value % 5 {
                    0 => tree.apply_commands(window, vec![Command::InsertChild {
                        parent_id: other_parent(tree.nodes[&image].parent.unwrap()),
                        child_id: image,
                        before_id: 0,
                    }]),
                    1 => {
                        let parent = tree.nodes[&image].parent.unwrap();
                        tree.apply_commands(window, vec![
                            Command::RemoveChild { parent_id: parent, child_id: image },
                            Command::SetProperty {
                                id: image,
                                property: PropertyId::Src,
                                value: PropertyValue::String(format!("https://example.com/{value}.png")),
                            },
                            Command::InsertChild {
                                parent_id: other_parent(parent),
                                child_id: image,
                                before_id: 0,
                            },
                        ])
                    }
                    2 => tree.apply_commands(window, vec![Command::SetProperty {
                        id: image,
                        property: PropertyId::Src,
                        value: if value & 1 == 0 {
                            PropertyValue::Null
                        } else {
                            PropertyValue::String(format!("https://example.com/{value}.png"))
                        },
                    }]),
                    3 => {
                        let parent = tree.nodes[&image].parent.unwrap();
                        let mut commands = Vec::new();
                        if tree.nodes[&anchor].parent != Some(parent) {
                            commands.push(Command::InsertChild { parent_id: parent, child_id: anchor, before_id: 0 });
                        }
                        commands.push(Command::InsertChild { parent_id: parent, child_id: anchor, before_id: image });
                        tree.apply_commands(window, commands)
                    }
                    _ => tree.apply_commands(window, vec![Command::SetProperty {
                        id: if value & 1 == 0 { image } else { container },
                        property: PropertyId::Width,
                        value: PropertyValue::Number(f64::from(value)),
                    }]),
                };
                proptest::prop_assert!(result.is_ok());
                proptest::prop_assert!(tree.windows[&window].fatal.is_none());

                for (&id, node) in &tree.nodes {
                    if let Some(parent) = node.parent {
                        proptest::prop_assert!(tree.nodes[&parent].children.contains(&id));
                    }
                    for child in &node.children {
                        proptest::prop_assert_eq!(tree.nodes[child].parent, Some(id));
                    }
                }
            }
        }
    }
}
