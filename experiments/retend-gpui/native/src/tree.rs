use std::collections::{HashMap, HashSet};

use serde::Serialize;

use crate::protocol::{Command, PropertyValue};
use crate::protocol_generated::{ElementKind, NativeEventId, PropertyId};
use crate::style::{NativeStyle, OverflowValue};
use crate::BridgeFailure;

pub type NodeId = u32;
pub type WindowId = u32;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TextControlKind {
    Input,
    Textarea,
}

#[derive(Clone, Debug)]
pub struct TextControlSnapshot {
    pub kind: TextControlKind,
    pub value: String,
    pub value_revision: u64,
    pub min_rows: Option<u32>,
    pub max_rows: Option<u32>,
}

pub type FocusTarget = (isize, Option<TextControlSnapshot>);

pub(crate) const fn event_bit(event: NativeEventId) -> u32 {
    1 << (event as u32 - 1)
}

fn invalid<T>(
    index: usize,
    code: &'static str,
    message: impl Into<String>,
) -> Result<T, BridgeFailure> {
    Err(BridgeFailure::command(index, code, message))
}

fn textarea_rows(index: usize, value: PropertyValue) -> Result<Option<u32>, BridgeFailure> {
    match value {
        PropertyValue::Null => Ok(None),
        PropertyValue::Number(value)
            if value.is_finite()
                && value.fract() == 0.0
                && value >= 1.0
                && value <= u32::MAX as f64 =>
        {
            Ok(Some(value as u32))
        }
        PropertyValue::Number(_) => Ok(None),
        _ => invalid(
            index,
            "INVALID_PROPERTY_VALUE",
            "Textarea row counts must be numbers or null.",
        ),
    }
}

fn normalize_textarea_rows(min_rows: &mut Option<u32>, max_rows: &mut Option<u32>) {
    if let (Some(min), Some(max)) = (*min_rows, *max_rows) {
        *max_rows = Some(max.max(min));
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct FatalDiagnostic {
    pub native_failure: String,
    pub javascript_stack: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ImageObjectFit {
    Fill,
    Contain,
    Cover,
    ScaleDown,
    None,
}

#[derive(Clone, Debug)]
pub enum NodeData {
    Root,
    Container,
    Text(String),
    Image {
        src: Option<String>,
        object_fit: Option<ImageObjectFit>,
    },
    TextControl {
        kind: TextControlKind,
        value: String,
        value_revision: u64,
        min_rows: Option<u32>,
        max_rows: Option<u32>,
    },
}

pub struct NativeNode {
    pub window_id: WindowId,
    pub data: NodeData,
    pub parent: Option<NodeId>,
    pub children: Vec<NodeId>,
    pub style: Option<Box<NativeStyle>>,
    pub subscriptions: u32,
    pub tab_index: Option<isize>,
}

impl NativeNode {
    fn new(window_id: WindowId, data: NodeData) -> Self {
        Self {
            window_id,
            data,
            parent: None,
            children: Vec::new(),
            style: None,
            subscriptions: 0,
            tab_index: None,
        }
    }

    pub(crate) fn effective_tab_index(&self) -> Option<isize> {
        self.tab_index
            .or_else(|| matches!(self.data, NodeData::TextControl { .. }).then_some(0))
    }
}

pub struct WindowState {
    pub root_id: NodeId,
    pub pending_detached: HashSet<NodeId>,
    pub mousedownoutside_subscribers: HashSet<NodeId>,
    pub fatal: Option<FatalDiagnostic>,
}

#[derive(Default)]
pub struct NativeTree {
    pub nodes: HashMap<NodeId, NativeNode>,
    pub windows: HashMap<WindowId, WindowState>,
    next_window_id: WindowId,
}

impl NativeTree {
    fn ensure_unused_id(&self, id: NodeId) -> Result<(), BridgeFailure> {
        if id == 0 {
            return Err(BridgeFailure::new(
                "INVALID_NODE_ID",
                "Node ID 0 is reserved by the protocol.",
            ));
        }
        if self.nodes.contains_key(&id) {
            return Err(BridgeFailure::new(
                "DUPLICATE_NODE_ID",
                format!("Node ID {id} already exists."),
            ));
        }
        Ok(())
    }

    pub fn create_window(&mut self, root_id: NodeId) -> Result<WindowId, BridgeFailure> {
        self.ensure_unused_id(root_id)?;
        self.next_window_id = self.next_window_id.checked_add(1).ok_or_else(|| {
            BridgeFailure::new("WINDOW_ID_EXHAUSTED", "Window ID space exhausted.")
        })?;
        let window_id = self.next_window_id;
        self.nodes
            .insert(root_id, NativeNode::new(window_id, NodeData::Root));
        self.windows.insert(
            window_id,
            WindowState {
                root_id,
                pending_detached: HashSet::new(),
                mousedownoutside_subscribers: HashSet::new(),
                fatal: None,
            },
        );
        Ok(window_id)
    }

    pub fn reload_window(&mut self, window_id: WindowId) -> Result<(), BridgeFailure> {
        let window = self
            .windows
            .get_mut(&window_id)
            .ok_or_else(BridgeFailure::closed_window)?;
        if window.fatal.is_none() {
            return Err(BridgeFailure::new(
                "RENDERER_NOT_FATAL",
                "Renderer state can only reload after a fatal bridge failure.",
            ));
        }
        self.nodes.retain(|_, node| node.window_id != window_id);
        self.nodes
            .insert(window.root_id, NativeNode::new(window_id, NodeData::Root));
        window.pending_detached.clear();
        window.mousedownoutside_subscribers.clear();
        window.fatal = None;
        Ok(())
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
            BridgeFailure::new(
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

    fn walk_presented_path(
        &self,
        window_id: WindowId,
        id: NodeId,
        mut visit: impl FnMut(&NativeNode),
    ) -> bool {
        let Some(root_id) = self.windows.get(&window_id).map(|window| window.root_id) else {
            return false;
        };
        let mut current = Some(id);
        while let Some(id) = current {
            let Some(node) = self
                .nodes
                .get(&id)
                .filter(|node| node.window_id == window_id)
            else {
                return false;
            };
            visit(node);
            if id == root_id {
                return true;
            }
            current = node.parent;
        }
        false
    }

    pub fn is_presented(&self, window_id: WindowId, id: NodeId) -> bool {
        self.walk_presented_path(window_id, id, |_| {})
    }

    pub fn subscription_mask_in_path(&self, window_id: WindowId, target_id: NodeId) -> u32 {
        let mut subscriptions = 0;
        if self.walk_presented_path(window_id, target_id, |node| {
            subscriptions |= node.subscriptions
        }) {
            subscriptions
        } else {
            0
        }
    }

    pub fn has_subscription_in_path(
        &self,
        window_id: WindowId,
        target_id: NodeId,
        event: NativeEventId,
    ) -> bool {
        self.subscription_mask_in_path(window_id, target_id) & event_bit(event) != 0
    }

    fn validated_node(
        &self,
        window_id: WindowId,
        id: NodeId,
    ) -> Result<&NativeNode, BridgeFailure> {
        self.ensure_binding_usable(window_id)?;
        let node = self
            .nodes
            .get(&id)
            .ok_or_else(|| BridgeFailure::destroyed_node(id))?;
        if node.window_id != window_id {
            return Err(BridgeFailure::new(
                "CROSS_WINDOW_NODE",
                format!("Node ID {id} belongs to another window."),
            ));
        }
        Ok(node)
    }

    pub fn validate_node(&self, window_id: WindowId, id: NodeId) -> Result<(), BridgeFailure> {
        self.validated_node(window_id, id).map(|_| ())
    }

    pub fn node_focus_target(
        &self,
        window_id: WindowId,
        id: NodeId,
    ) -> Result<Option<FocusTarget>, BridgeFailure> {
        let node = self.validated_node(window_id, id)?;
        let Some(tab_index) = node.effective_tab_index() else {
            return Ok(None);
        };
        let text_control = match &node.data {
            NodeData::TextControl {
                kind,
                value,
                value_revision,
                min_rows,
                max_rows,
            } => Some(TextControlSnapshot {
                kind: *kind,
                value: value.clone(),
                value_revision: *value_revision,
                min_rows: *min_rows,
                max_rows: *max_rows,
            }),
            _ => None,
        };
        Ok(Some((tab_index, text_control)))
    }

    pub fn text_control_snapshot(
        &self,
        window_id: WindowId,
        id: NodeId,
    ) -> Result<TextControlSnapshot, BridgeFailure> {
        match &self.validated_node(window_id, id)?.data {
            NodeData::TextControl {
                kind,
                value,
                value_revision,
                min_rows,
                max_rows,
            } => Ok(TextControlSnapshot {
                kind: *kind,
                value: value.clone(),
                value_revision: *value_revision,
                min_rows: *min_rows,
                max_rows: *max_rows,
            }),
            _ => Err(BridgeFailure::new(
                "INVALID_NODE_KIND",
                format!("Node ID {id} is not a native text control."),
            )),
        }
    }

    pub fn node_overflow(
        &self,
        window_id: WindowId,
        id: NodeId,
    ) -> Result<OverflowValue, BridgeFailure> {
        Ok(self
            .validated_node(window_id, id)?
            .style
            .as_deref()
            .map(|style| style.overflow)
            .unwrap_or_default())
    }

    pub fn has_mousedownoutside_subscribers(&self, window_id: WindowId) -> bool {
        self.windows
            .get(&window_id)
            .is_some_and(|window| !window.mousedownoutside_subscribers.is_empty())
    }

    pub fn outside_subscribers(&self, window_id: WindowId, target_id: NodeId) -> Vec<NodeId> {
        if !self.is_presented(window_id, target_id) {
            return Vec::new();
        }
        let Some(window) = self.windows.get(&window_id) else {
            return Vec::new();
        };
        let target_path: HashSet<_> = std::iter::successors(Some(target_id), |id| {
            self.nodes.get(id).and_then(|node| node.parent)
        })
        .collect();
        let mut subscribers: Vec<_> = window
            .mousedownoutside_subscribers
            .iter()
            .copied()
            .filter(|id| self.is_presented(window_id, *id) && !target_path.contains(id))
            .collect();
        subscribers.sort_unstable();
        subscribers
    }

    pub fn debug_window_json(&self, window_id: WindowId) -> Result<String, BridgeFailure> {
        let window = self.windows.get(&window_id).ok_or_else(|| {
            BridgeFailure::new("INVALID_WINDOW", "Renderer window does not exist.")
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
                    NodeData::Image { src, .. } => ("Image", None, src.as_deref()),
                    NodeData::TextControl { kind, .. } => (
                        match kind {
                            TextControlKind::Input => "Input",
                            TextControlKind::Textarea => "Textarea",
                        },
                        None,
                        None,
                    ),
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
        .map_err(|error| BridgeFailure::new("SERIALIZATION_ERROR", error.to_string()))
    }

    fn ensure_binding_usable(&self, window_id: WindowId) -> Result<(), BridgeFailure> {
        let window = self
            .windows
            .get(&window_id)
            .ok_or_else(BridgeFailure::closed_window)?;
        if window.fatal.is_some() {
            return Err(BridgeFailure::new(
                "POISONED_RENDERER",
                "Renderer cannot accept commands until reloaded after a fatal bridge failure.",
            ));
        }
        Ok(())
    }

    fn destroy_subtree(&mut self, id: NodeId, destroyed: &mut Vec<NodeId>) {
        let Some(node) = self.nodes.remove(&id) else {
            return;
        };
        if node.subscriptions & event_bit(NativeEventId::MouseDownOutside) != 0 {
            if let Some(window) = self.windows.get_mut(&node.window_id) {
                window.mousedownoutside_subscribers.remove(&id);
            }
        }
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
            Command::CreateNode { id, kind } => {
                let data = match kind {
                    ElementKind::Container => NodeData::Container,
                    ElementKind::Image => NodeData::Image {
                        src: None,
                        object_fit: None,
                    },
                    ElementKind::Input => NodeData::TextControl {
                        kind: TextControlKind::Input,
                        value: String::new(),
                        value_revision: 0,
                        min_rows: None,
                        max_rows: None,
                    },
                    ElementKind::Root => {
                        return invalid(
                            index,
                            "INVALID_NODE_KIND",
                            "Root nodes are created only when a native window is created.",
                        )
                    }
                    ElementKind::Text => {
                        return invalid(
                            index,
                            "INVALID_NODE_KIND",
                            "Text nodes must be created with CREATE_TEXT.",
                        )
                    }
                    ElementKind::Textarea => NodeData::TextControl {
                        kind: TextControlKind::Textarea,
                        value: String::new(),
                        value_revision: 0,
                        min_rows: None,
                        max_rows: None,
                    },
                };
                self.create(index, window_id, id, data)
            }
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
                let NativeNode {
                    data, tab_index, ..
                } = self.node_mut(window_id, index, id)?;
                match (property, data) {
                    (PropertyId::TabIndex, _) => {
                        *tab_index = match value {
                            PropertyValue::Null => None,
                            PropertyValue::Number(value)
                                if value.is_finite()
                                    && value.fract() == 0.0
                                    && value >= isize::MIN as f64
                                    && value <= isize::MAX as f64 =>
                            {
                                Some(value as isize)
                            }
                            _ => {
                                return invalid(
                                    index,
                                    "INVALID_PROPERTY_VALUE",
                                    "tabIndex must be an integer or null.",
                                )
                            }
                        };
                        Ok(())
                    }
                    (
                        PropertyId::Value,
                        NodeData::TextControl {
                            value: current,
                            value_revision,
                            ..
                        },
                    ) => {
                        let value = match value {
                            PropertyValue::Null => String::new(),
                            PropertyValue::String(value) => value,
                            _ => {
                                return invalid(
                                    index,
                                    "INVALID_PROPERTY_VALUE",
                                    "Text-control value must be a string or null.",
                                );
                            }
                        };
                        let next_revision = value_revision.checked_add(1).ok_or_else(|| {
                            BridgeFailure::command(
                                index,
                                "VALUE_REVISION_EXHAUSTED",
                                "Text-control value revision space exhausted.",
                            )
                        })?;
                        *current = value;
                        *value_revision = next_revision;
                        Ok(())
                    }
                    (
                        PropertyId::MinRows,
                        NodeData::TextControl {
                            kind: TextControlKind::Textarea,
                            min_rows,
                            max_rows,
                            ..
                        },
                    ) => {
                        *min_rows = textarea_rows(index, value)?;
                        normalize_textarea_rows(min_rows, max_rows);
                        Ok(())
                    }
                    (
                        PropertyId::MaxRows,
                        NodeData::TextControl {
                            kind: TextControlKind::Textarea,
                            min_rows,
                            max_rows,
                            ..
                        },
                    ) => {
                        *max_rows = textarea_rows(index, value)?;
                        normalize_textarea_rows(min_rows, max_rows);
                        Ok(())
                    }
                    (PropertyId::Src, NodeData::Image { src, .. }) => {
                        *src = match value {
                            PropertyValue::Null => None,
                            PropertyValue::String(value) => url::Url::parse(&value)
                                .is_ok_and(|url| matches!(url.scheme(), "http" | "https"))
                                .then_some(value),
                            _ => {
                                return invalid(
                                    index,
                                    "INVALID_PROPERTY_VALUE",
                                    "Image src must be an HTTP(S) URL string or null.",
                                )
                            }
                        };
                        Ok(())
                    }
                    (PropertyId::ObjectFit, NodeData::Image { object_fit, .. }) => {
                        *object_fit = match value {
                            PropertyValue::Null => None,
                            PropertyValue::String(value) => match value.as_str() {
                                "fill" => Some(ImageObjectFit::Fill),
                                "contain" => Some(ImageObjectFit::Contain),
                                "cover" => Some(ImageObjectFit::Cover),
                                "scaleDown" | "scale-down" => Some(ImageObjectFit::ScaleDown),
                                "none" => Some(ImageObjectFit::None),
                                _ => None,
                            },
                            _ => {
                                return invalid(
                                    index,
                                    "INVALID_PROPERTY_VALUE",
                                    "Image objectFit must be a supported string or null.",
                                )
                            }
                        };
                        Ok(())
                    }
                    (property, _) => invalid(
                        index,
                        "UNSUPPORTED_PROPERTY",
                        format!("{property:?} is not an intrinsic property for this node kind."),
                    ),
                }
            }
            Command::SetStyle { id, properties } => {
                let node = self.node_mut(window_id, index, id)?;
                if matches!(&node.data, NodeData::Text(_)) {
                    return invalid(
                        index,
                        "UNSUPPORTED_PROPERTY",
                        "Text nodes cannot receive author-style snapshots.",
                    );
                }
                if properties.is_empty() {
                    node.style = None;
                    return Ok(());
                }

                let mut style = Box::<NativeStyle>::default();
                for (property, value) in properties {
                    if !style.set_property(property, &value) {
                        return invalid(
                            index,
                            "UNSUPPORTED_PROPERTY",
                            format!("{property:?} is not part of the native style surface."),
                        );
                    }
                }
                node.style = Some(style);
                Ok(())
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
            Command::SubscribeEvent { id, event } | Command::UnsubscribeEvent { id, event } => {
                let subscribe = matches!(command, Command::SubscribeEvent { .. });
                let node = self.node_mut(window_id, index, id)?;
                if subscribe {
                    node.subscriptions |= event_bit(event);
                } else {
                    node.subscriptions &= !event_bit(event);
                }
                if event == NativeEventId::MouseDownOutside {
                    let subscribers = &mut self.window(window_id)?.mousedownoutside_subscribers;
                    if subscribe {
                        subscribers.insert(id);
                    } else {
                        subscribers.remove(&id);
                    }
                }
                Ok(())
            }
        }
    }

    fn create(
        &mut self,
        index: usize,
        window_id: WindowId,
        id: NodeId,
        data: NodeData,
    ) -> Result<(), BridgeFailure> {
        self.ensure_unused_id(id).map_err(|mut error| {
            error.command_index = Some(index);
            error
        })?;
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
        self.windows
            .get_mut(&window_id)
            .ok_or_else(BridgeFailure::closed_window)
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
                NodeData::TextControl { kind, .. } => (
                    false,
                    match kind {
                        TextControlKind::Input => "Input",
                        TextControlKind::Textarea => "Textarea",
                    },
                ),
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

    fn style(id: NodeId, property: PropertyId, value: PropertyValue) -> Command {
        Command::SetStyle {
            id,
            properties: vec![(property, value)],
        }
    }

    #[test]
    fn native_event_subscriptions_follow_presented_paths_and_outside_targets() {
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
                Command::SubscribeEvent {
                    id: 2,
                    event: NativeEventId::Click,
                },
                Command::SubscribeEvent {
                    id: 2,
                    event: NativeEventId::MouseDownOutside,
                },
                Command::SubscribeEvent {
                    id: 3,
                    event: NativeEventId::MouseDownOutside,
                },
                Command::SubscribeEvent {
                    id: 4,
                    event: NativeEventId::MouseDownOutside,
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
                Command::InsertChild {
                    parent_id: root,
                    child_id: 4,
                    before_id: 0,
                },
            ],
        )
        .unwrap();

        assert!(tree.is_presented(window, 3));
        assert!(tree.has_subscription_in_path(window, 3, NativeEventId::Click));
        assert!(tree.has_mousedownoutside_subscribers(window));
        assert_eq!(tree.outside_subscribers(window, 3), vec![4]);
        assert_eq!(tree.outside_subscribers(window, 2), vec![3, 4]);
        assert_eq!(tree.outside_subscribers(window, 4), vec![2, 3]);

        tree.apply_commands(
            window,
            vec![Command::UnsubscribeEvent {
                id: 2,
                event: NativeEventId::Click,
            }],
        )
        .unwrap();
        assert!(!tree.has_subscription_in_path(window, 3, NativeEventId::Click));

        tree.apply_commands(
            window,
            vec![Command::RemoveChild {
                parent_id: root,
                child_id: 2,
            }],
        )
        .unwrap();
        assert!(!tree.is_presented(window, 3));
        assert!(tree.outside_subscribers(window, 3).is_empty());
        tree.settle(window).unwrap();

        tree.apply_commands(
            window,
            vec![Command::UnsubscribeEvent {
                id: 4,
                event: NativeEventId::MouseDownOutside,
            }],
        )
        .unwrap();
        assert!(!tree.has_mousedownoutside_subscribers(window));
    }

    #[test]
    fn fatal_window_reload_keeps_the_window_root_and_resets_renderer_state() {
        let (mut tree, window, root) = setup();
        tree.apply_commands(
            window,
            vec![Command::CreateNode {
                id: 2,
                kind: ElementKind::Root,
            }],
        )
        .unwrap_err();
        tree.reload_window(window).unwrap();
        assert!(tree.windows[&window].fatal.is_none());
        assert_eq!(tree.windows[&window].root_id, root);
        assert_eq!(tree.nodes.len(), 1);
        tree.apply_commands(
            window,
            vec![Command::CreateText {
                id: 2,
                text: "fresh".into(),
            }],
        )
        .unwrap();

        assert_eq!(
            tree.reload_window(window).unwrap_err().code,
            "RENDERER_NOT_FATAL"
        );
        assert!(tree.nodes.contains_key(&2));
    }

    #[test]
    fn textarea_retains_multiline_value_and_row_bounds() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Textarea,
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::Value,
                    value: PropertyValue::String("first\nsecond".into()),
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::MinRows,
                    value: PropertyValue::Number(2.0),
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::MaxRows,
                    value: PropertyValue::Number(6.0),
                },
            ],
        )
        .unwrap();

        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::TextControl {
                kind: TextControlKind::Textarea,
                value,
                min_rows: Some(2),
                max_rows: Some(6),
                ..
            } if value == "first\nsecond"
        ));

        tree.apply_commands(
            window,
            vec![
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::MinRows,
                    value: PropertyValue::Number(6.0),
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::MaxRows,
                    value: PropertyValue::Number(2.0),
                },
            ],
        )
        .unwrap();
        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::TextControl {
                min_rows: Some(6),
                max_rows: Some(6),
                ..
            }
        ));

        tree.apply_commands(
            window,
            vec![Command::SetProperty {
                id: 2,
                property: PropertyId::MinRows,
                value: PropertyValue::Number(0.0),
            }],
        )
        .unwrap();
        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::TextControl { min_rows: None, .. }
        ));
        assert!(tree.windows[&window].fatal.is_none());
    }

    #[test]
    fn style_snapshot_replaces_the_previous_sparse_style() {
        let (mut tree, window, _) = setup();
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
                        (PropertyId::Width, PropertyValue::String("25%".into())),
                        (PropertyId::Color, PropertyValue::String("#ffffff".into())),
                    ],
                },
            ],
        )
        .unwrap();

        assert_eq!(
            tree.nodes[&2]
                .style
                .as_deref()
                .and_then(|style| style.width),
            Some(crate::style::LengthValue::Percent(25.0))
        );

        tree.apply_commands(
            window,
            vec![style(
                2,
                PropertyId::Color,
                PropertyValue::String("#22c55e".into()),
            )],
        )
        .unwrap();
        assert_eq!(
            tree.nodes[&2]
                .style
                .as_deref()
                .and_then(|style| style.width),
            None
        );

        tree.apply_commands(
            window,
            vec![Command::SetStyle {
                id: 2,
                properties: Vec::new(),
            }],
        )
        .unwrap();
        assert!(tree.nodes[&2].style.is_none());
    }

    #[test]
    fn style_snapshot_rejects_unsupported_properties_without_replacing_style() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Container,
                },
                style(2, PropertyId::Width, PropertyValue::Number(80.0)),
            ],
        )
        .unwrap();

        let error = tree
            .apply_commands(
                window,
                vec![Command::SetStyle {
                    id: 2,
                    properties: vec![
                        (PropertyId::Height, PropertyValue::Number(40.0)),
                        (PropertyId::Src, PropertyValue::String("invalid".into())),
                    ],
                }],
            )
            .unwrap_err();

        assert_eq!(error.code, "UNSUPPORTED_PROPERTY");
        let retained = tree.nodes[&2].style.as_deref().unwrap();
        assert_eq!(
            retained.width,
            Some(crate::style::LengthValue::Pixels(80.0))
        );
        assert_eq!(retained.height, None);
    }

    #[test]
    fn set_property_does_not_accept_style_properties() {
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
                vec![Command::SetProperty {
                    id: 2,
                    property: PropertyId::Width,
                    value: PropertyValue::Number(80.0),
                }],
            )
            .unwrap_err();

        assert_eq!(error.code, "UNSUPPORTED_PROPERTY");
        assert!(tree.nodes[&2].style.is_none());
    }

    #[test]
    fn text_nodes_reject_style_snapshots() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![Command::CreateText {
                id: 2,
                text: "plain".into(),
            }],
        )
        .unwrap();

        let error = tree
            .apply_commands(
                window,
                vec![style(2, PropertyId::Opacity, PropertyValue::Number(0.5))],
            )
            .unwrap_err();

        assert_eq!(error.code, "UNSUPPORTED_PROPERTY");
        assert!(tree.nodes[&2].style.is_none());
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
            NodeData::Image { src, .. } if src.as_deref() == Some("https://example.com/first.png")
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
            NodeData::Image { src, .. }
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
            NodeData::Image { src, .. } if src.is_none()
        ));
        assert!(tree.windows[&window].fatal.is_none());
    }

    #[test]
    fn image_object_fit_is_parsed_into_retained_image_state() {
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
                    property: PropertyId::ObjectFit,
                    value: PropertyValue::String("cover".into()),
                },
            ],
        )
        .unwrap();
        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::Image {
                object_fit: Some(ImageObjectFit::Cover),
                ..
            }
        ));

        tree.apply_commands(
            window,
            vec![Command::SetProperty {
                id: 2,
                property: PropertyId::ObjectFit,
                value: PropertyValue::String("scale-down".into()),
            }],
        )
        .unwrap();
        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::Image {
                object_fit: Some(ImageObjectFit::ScaleDown),
                ..
            }
        ));

        tree.apply_commands(
            window,
            vec![Command::SetProperty {
                id: 2,
                property: PropertyId::ObjectFit,
                value: PropertyValue::String("not-a-fit".into()),
            }],
        )
        .unwrap();
        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::Image {
                object_fit: None,
                ..
            }
        ));
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
            NodeData::Image { src, .. } if src.is_none()
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
            NodeData::Image { src, .. }
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
                style(2, PropertyId::Width, PropertyValue::Number(1e300)),
            ],
        )
        .unwrap();

        assert_eq!(
            tree.nodes[&2]
                .style
                .as_deref()
                .and_then(|style| style.width),
            None
        );
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
                style(2, PropertyId::Opacity, PropertyValue::Number(0.5)),
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
    fn fatal_stack_requires_failure() {
        let (mut tree, window, _) = setup();
        assert_eq!(
            tree.attach_javascript_stack(window, "stack".into())
                .unwrap_err()
                .code,
            "RENDERER_NOT_POISONED"
        );
        tree.apply_commands(
            window,
            vec![Command::CreateNode {
                id: 0,
                kind: ElementKind::Container,
            }],
        )
        .unwrap_err();
        tree.attach_javascript_stack(window, "stack".into())
            .unwrap();
        assert_eq!(
            tree.windows[&window]
                .fatal
                .as_ref()
                .unwrap()
                .javascript_stack,
            "stack"
        );
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
                (0u8..6, structural_node_id(), structural_node_id(), structural_node_id()),
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
                    3 => Command::InsertChild {
                        parent_id: first,
                        child_id: second,
                        before_id: third,
                    },
                    4 => Command::RemoveChild {
                        parent_id: first,
                        child_id: second,
                    },
                    _ => style(
                        first,
                        if third % 2 == 0 {
                            PropertyId::Color
                        } else {
                            PropertyId::Width
                        },
                        if third % 2 == 0 {
                            PropertyValue::String("#336699".into())
                        } else {
                            PropertyValue::Number(f64::from(second))
                        },
                    ),
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
            tree.apply_commands(
                window,
                vec![
                    Command::CreateNode { id: container, kind: ElementKind::Container },
                    Command::CreateNode { id: image, kind: ElementKind::Image },
                    Command::InsertChild { parent_id: root, child_id: container, before_id: 0 },
                    Command::InsertChild { parent_id: root, child_id: image, before_id: 0 },
                ],
            ).unwrap();

            for value in ops {
                let other_parent = |parent| if parent == root { container } else { root };
                let result = match value % 4 {
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
                    _ => tree.apply_commands(
                        window,
                        vec![style(
                            if value & 1 == 0 { image } else { container },
                            PropertyId::Width,
                            PropertyValue::Number(f64::from(value)),
                        )],
                    ),
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
