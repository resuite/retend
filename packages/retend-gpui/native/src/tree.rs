use std::{
    cell::RefCell,
    collections::{HashMap, HashSet},
    path::PathBuf,
};

use serde::Serialize;

use crate::motion::MotionBridgeState;
use crate::protocol::{Command, PropertyValue};
use crate::protocol_generated::{ElementKind, NativeEventId, PropertyId, StyleState};
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
    pub placeholder: String,
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

fn nullable_string(
    index: usize,
    value: PropertyValue,
    message: &'static str,
) -> Result<Option<String>, BridgeFailure> {
    match value {
        PropertyValue::Null => Ok(None),
        PropertyValue::String(value) => Ok(Some(value)),
        _ => invalid(index, "INVALID_PROPERTY_VALUE", message),
    }
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

/// Where an image source loads from. Parsed when the property is applied so
/// rendering does not re-parse the string every frame.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub enum ImageLocation {
    #[default]
    Unset,
    /// Remote URL, loaded through GPUI's asset source.
    Uri,
    /// Local file, loaded from disk.
    Path(PathBuf),
}

impl ImageLocation {
    fn parse(value: &str) -> Self {
        let Ok(url) = url::Url::parse(value) else {
            return Self::Unset;
        };
        match url.scheme() {
            "http" | "https" => Self::Uri,
            "file" => url.to_file_path().map_or(Self::Unset, Self::Path),
            _ => Self::Unset,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum AnchoredSide {
    Top,
    Right,
    #[default]
    Bottom,
    Left,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum AnchoredAlign {
    #[default]
    Start,
    Center,
    End,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum AnchoredFit {
    Switch,
    #[default]
    Snap,
}

#[derive(Clone, Debug, PartialEq)]
pub struct AnchoredConfig {
    pub position: Option<(f32, f32)>,
    pub side: AnchoredSide,
    pub align: AnchoredAlign,
    pub gap: f32,
    pub offset: (f32, f32),
    pub fit: AnchoredFit,
    pub snap_margin: f32,
    pub deferred: bool,
    pub priority: usize,
    pub occlude: bool,
}

impl Default for AnchoredConfig {
    fn default() -> Self {
        Self {
            position: None,
            side: AnchoredSide::Bottom,
            align: AnchoredAlign::Start,
            gap: 0.0,
            offset: (0.0, 0.0),
            fit: AnchoredFit::Snap,
            snap_margin: 8.0,
            deferred: true,
            priority: 1,
            occlude: true,
        }
    }
}

impl AnchoredConfig {
    fn number(index: usize, value: PropertyValue, name: &str) -> Result<f32, BridgeFailure> {
        match value {
            PropertyValue::Number(value)
                if value.is_finite() && value.abs() <= f64::from(f32::MAX) =>
            {
                Ok(value as f32)
            }
            _ => invalid(
                index,
                "INVALID_PROPERTY_VALUE",
                format!("{name} must be a finite number."),
            ),
        }
    }

    fn point(index: usize, value: PropertyValue, name: &str) -> Result<(f32, f32), BridgeFailure> {
        match value {
            PropertyValue::Point(x, y)
                if x.is_finite()
                    && y.is_finite()
                    && x.abs() <= f64::from(f32::MAX)
                    && y.abs() <= f64::from(f32::MAX) =>
            {
                Ok((x as f32, y as f32))
            }
            _ => invalid(
                index,
                "INVALID_PROPERTY_VALUE",
                format!("{name} must be a finite point."),
            ),
        }
    }

    fn keyword<T: Copy>(
        index: usize,
        value: PropertyValue,
        name: &str,
        choices: &[(&str, T)],
    ) -> Result<T, BridgeFailure> {
        let PropertyValue::String(value) = value else {
            return invalid(
                index,
                "INVALID_PROPERTY_VALUE",
                format!("anchored {name} must be a string."),
            );
        };
        choices
            .iter()
            .find(|(keyword, _)| *keyword == value)
            .map(|(_, value)| *value)
            .ok_or_else(|| {
                BridgeFailure::command(
                    index,
                    "INVALID_PROPERTY_VALUE",
                    format!("Unsupported anchored {name}: {value}."),
                )
            })
    }

    fn set_property(
        &mut self,
        index: usize,
        property: PropertyId,
        value: PropertyValue,
    ) -> Result<(), BridgeFailure> {
        macro_rules! assign {
            ($field:ident, $parsed:expr) => {
                self.$field = if value == PropertyValue::Null {
                    Self::default().$field
                } else {
                    $parsed
                }
            };
        }
        match property {
            PropertyId::AnchoredPosition => assign!(
                position,
                Some(Self::point(index, value, "anchored position")?)
            ),
            PropertyId::AnchoredGap => assign!(gap, Self::number(index, value, "anchored gap")?),
            PropertyId::AnchoredOffset => {
                assign!(offset, Self::point(index, value, "anchored offset")?)
            }
            PropertyId::AnchoredSnapMargin => assign!(snap_margin, {
                let value = Self::number(index, value, "anchored snapMargin")?;
                if value < 0.0 {
                    return invalid(
                        index,
                        "INVALID_PROPERTY_VALUE",
                        "anchored snapMargin must be non-negative.",
                    );
                }
                value
            }),
            PropertyId::AnchoredSide => assign!(
                side,
                Self::keyword(
                    index,
                    value,
                    "side",
                    &[
                        ("top", AnchoredSide::Top),
                        ("right", AnchoredSide::Right),
                        ("bottom", AnchoredSide::Bottom),
                        ("left", AnchoredSide::Left),
                    ],
                )?
            ),
            PropertyId::AnchoredAlign => assign!(
                align,
                Self::keyword(
                    index,
                    value,
                    "align",
                    &[
                        ("start", AnchoredAlign::Start),
                        ("center", AnchoredAlign::Center),
                        ("end", AnchoredAlign::End),
                    ],
                )?
            ),
            PropertyId::AnchoredFit => assign!(
                fit,
                Self::keyword(
                    index,
                    value,
                    "fit",
                    &[("switch", AnchoredFit::Switch), ("snap", AnchoredFit::Snap)],
                )?
            ),
            PropertyId::AnchoredDeferred => assign!(deferred, {
                let PropertyValue::Boolean(value) = value else {
                    return invalid(
                        index,
                        "INVALID_PROPERTY_VALUE",
                        "anchored deferred must be a boolean.",
                    );
                };
                value
            }),
            PropertyId::AnchoredOcclude => assign!(occlude, {
                let PropertyValue::Boolean(value) = value else {
                    return invalid(
                        index,
                        "INVALID_PROPERTY_VALUE",
                        "anchored occlude must be a boolean.",
                    );
                };
                value
            }),
            PropertyId::AnchoredPriority => assign!(
                priority,
                match value {
                    PropertyValue::Number(value)
                        if value.is_finite()
                            && value.fract() == 0.0
                            && value >= 0.0
                            && value <= usize::MAX as f64 =>
                    {
                        value as usize
                    }
                    _ => {
                        return invalid(
                            index,
                            "INVALID_PROPERTY_VALUE",
                            "anchored priority must be a non-negative integer.",
                        );
                    }
                }
            ),
            _ => {
                return invalid(
                    index,
                    "UNSUPPORTED_PROPERTY",
                    format!("{property:?} is not an anchored property."),
                )
            }
        }
        Ok(())
    }
}

#[derive(Clone, Debug)]
pub enum NodeData {
    Root,
    Container,
    Anchored(AnchoredConfig),
    Text(String),
    Image {
        src: Option<String>,
        object_fit: Option<ImageObjectFit>,
        alt: Option<String>,
        location: ImageLocation,
    },
    TextControl {
        kind: TextControlKind,
        value: String,
        value_revision: u64,
        placeholder: String,
        min_rows: Option<u32>,
        max_rows: Option<u32>,
    },
    Button,
}

pub struct NativeNode {
    pub window_id: WindowId,
    pub data: NodeData,
    pub parent: Option<NodeId>,
    pub children: Vec<NodeId>,
    pub style: Option<Box<NativeStyle>>,
    base_style: Vec<(PropertyId, PropertyValue)>,
    hover_style: Option<Vec<(PropertyId, PropertyValue)>>,
    focused_style: Option<Vec<(PropertyId, PropertyValue)>>,
    active_style: Option<Vec<(PropertyId, PropertyValue)>>,
    hovered: bool,
    focused: bool,
    pub(crate) motion: MotionBridgeState,
    pub subscriptions: u32,
    pub tab_index: Option<isize>,
    pub disabled: bool,
}

impl NativeNode {
    fn new(window_id: WindowId, data: NodeData) -> Self {
        Self {
            window_id,
            data,
            parent: None,
            children: Vec::new(),
            style: None,
            base_style: Vec::new(),
            hover_style: None,
            focused_style: None,
            active_style: None,
            hovered: false,
            focused: false,
            motion: MotionBridgeState::default(),
            subscriptions: 0,
            tab_index: None,
            disabled: false,
        }
    }

    pub(crate) fn effective_tab_index(&self) -> Option<isize> {
        if self.disabled {
            return None;
        }
        self.tab_index
            .or_else(|| self.default_tab_index().then_some(0))
    }

    fn text_control_snapshot(&self) -> Option<TextControlSnapshot> {
        match &self.data {
            NodeData::TextControl {
                kind,
                value,
                value_revision,
                placeholder,
                min_rows,
                max_rows,
            } => Some(TextControlSnapshot {
                kind: *kind,
                value: value.clone(),
                value_revision: *value_revision,
                placeholder: placeholder.clone(),
                min_rows: *min_rows,
                max_rows: *max_rows,
            }),
            _ => None,
        }
    }

    fn default_tab_index(&self) -> bool {
        matches!(self.data, NodeData::TextControl { .. } | NodeData::Button)
    }

    pub(crate) fn tracks_hover(&self) -> bool {
        self.hover_style.is_some()
    }

    pub(crate) fn tracks_active(&self) -> bool {
        self.active_style.is_some()
    }

    pub(crate) fn tracks_focused(&self) -> bool {
        self.focused_style.is_some()
    }

    fn has_hover_style(&self) -> bool {
        self.hover_style
            .as_ref()
            .is_some_and(|style| !style.is_empty())
    }

    fn has_focused_style(&self) -> bool {
        self.focused_style
            .as_ref()
            .is_some_and(|style| !style.is_empty())
    }

    fn has_active_style(&self) -> bool {
        self.active_style
            .as_ref()
            .is_some_and(|style| !style.is_empty())
    }

    fn store_style_snapshot(
        &mut self,
        state: Option<StyleState>,
        properties: Vec<(PropertyId, PropertyValue)>,
    ) {
        match state {
            None => self.base_style = properties,
            Some(StyleState::Hover) => self.hover_style = Some(properties),
            Some(StyleState::Focused) => self.focused_style = Some(properties),
            Some(StyleState::Active) => self.active_style = Some(properties),
        }
    }

    fn resolve_author_style(&mut self, active: bool) {
        let layers = [
            (true, self.base_style.as_slice()),
            (
                self.hovered,
                self.hover_style.as_deref().unwrap_or_default(),
            ),
            (
                self.focused,
                self.focused_style.as_deref().unwrap_or_default(),
            ),
            (active, self.active_style.as_deref().unwrap_or_default()),
        ];
        let mut next = None;
        for (_, declarations) in layers.into_iter().filter(|(enabled, _)| *enabled) {
            for (property, value) in declarations {
                let style = next.get_or_insert_with(Box::<NativeStyle>::default);
                _ = style.set_property(*property, value);
            }
        }
        self.style = next;
    }
}

pub struct WindowState {
    pub root_id: NodeId,
    pub revision: u64,
    presented_paths: RefCell<HashMap<NodeId, Option<u32>>>,
    pub pending_detached: HashSet<NodeId>,
    pub mousedownoutside_subscribers: HashSet<NodeId>,
    active_nodes: HashSet<NodeId>,
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
                revision: 0,
                presented_paths: RefCell::default(),
                pending_detached: HashSet::new(),
                mousedownoutside_subscribers: HashSet::new(),
                active_nodes: HashSet::new(),
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
        window.revision = window.revision.wrapping_add(1);
        window.presented_paths.get_mut().clear();
        window.pending_detached.clear();
        window.mousedownoutside_subscribers.clear();
        window.active_nodes.clear();
        window.fatal = None;
        Ok(())
    }

    pub fn apply_commands(
        &mut self,
        window_id: WindowId,
        commands: Vec<Command>,
    ) -> Result<(), BridgeFailure> {
        self.ensure_binding_usable(window_id)?;
        if !commands.is_empty() {
            let window = self.window(window_id)?;
            window.revision = window.revision.wrapping_add(1);
            window.presented_paths.get_mut().clear();
        }
        let mut style_nodes = HashSet::new();
        for (index, command) in commands.into_iter().enumerate() {
            let style_node = match &command {
                Command::SetStyle { id, .. } | Command::SetPseudoStyle { id, .. } => Some(*id),
                _ => None,
            };
            if let Err(error) = self.apply_command(window_id, index, command) {
                self.resolve_style_nodes(window_id, &style_nodes);
                self.poison_native(window_id, &error)
                    .expect("validated window must still exist while applying a command batch");
                return Err(error);
            }
            if let Some(id) = style_node {
                style_nodes.insert(id);
            }
        }
        self.resolve_style_nodes(window_id, &style_nodes);
        Ok(())
    }

    pub fn set_hovered(&mut self, window_id: WindowId, id: NodeId, hovered: bool) -> bool {
        let active = self
            .windows
            .get(&window_id)
            .expect("pointer events must reference a live native window")
            .active_nodes
            .contains(&id);
        let Some(node) = self
            .nodes
            .get_mut(&id)
            .filter(|node| node.window_id == window_id && node.tracks_hover())
        else {
            return false;
        };
        if node.hovered == hovered {
            return false;
        }
        node.hovered = hovered;
        let changed = node.has_hover_style();
        node.resolve_author_style(active);
        if changed {
            self.mark_window_style_changed(window_id);
        }
        changed
    }

    pub fn set_focused(&mut self, window_id: WindowId, id: NodeId, focused: bool) -> bool {
        let Some(active) = self
            .windows
            .get(&window_id)
            .map(|window| window.active_nodes.contains(&id))
        else {
            return false;
        };
        let Some(node) = self
            .nodes
            .get_mut(&id)
            .filter(|node| node.window_id == window_id && node.tracks_focused())
        else {
            return false;
        };
        if node.focused == focused {
            return false;
        }
        node.focused = focused;
        let changed = node.has_focused_style();
        node.resolve_author_style(active);
        if changed {
            self.mark_window_style_changed(window_id);
        }
        changed
    }

    pub fn press_node(&mut self, window_id: WindowId, id: NodeId) -> bool {
        if self
            .nodes
            .get(&id)
            .is_none_or(|node| node.window_id != window_id)
        {
            return false;
        }
        let ancestors: Vec<_> = std::iter::successors(Some(id), |id| {
            self.nodes.get(id).and_then(|node| node.parent)
        })
        .filter(|id| self.nodes[id].tracks_active())
        .collect();
        let window = self
            .windows
            .get_mut(&window_id)
            .expect("pointer events must reference a live native window");
        let mut changed = false;
        for id in ancestors {
            if !window.active_nodes.insert(id) {
                continue;
            }
            let node = self
                .nodes
                .get_mut(&id)
                .expect("tracked active nodes must remain in the native tree");
            changed |= node.has_active_style();
            node.resolve_author_style(true);
        }
        if changed {
            self.mark_window_style_changed(window_id);
        }
        changed
    }

    pub fn release_pointer(&mut self, window_id: WindowId) -> bool {
        let window = self
            .windows
            .get_mut(&window_id)
            .expect("pointer events must reference a live native window");
        if window.active_nodes.is_empty() {
            return false;
        }
        let active = std::mem::take(&mut window.active_nodes);
        let mut changed = false;
        for id in active {
            let node = self
                .nodes
                .get_mut(&id)
                .expect("tracked active nodes must remain in the native tree");
            changed |= node.has_active_style();
            node.resolve_author_style(false);
        }
        if changed {
            self.mark_window_style_changed(window_id);
        }
        changed
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
        if !destroyed.is_empty() {
            let window = self.window(window_id)?;
            window.revision = window.revision.wrapping_add(1);
            window.presented_paths.get_mut().clear();
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
        self.presented_subscription_mask(window_id, id).is_some()
    }

    pub fn subscription_mask_in_path(&self, window_id: WindowId, target_id: NodeId) -> u32 {
        self.presented_subscription_mask(window_id, target_id)
            .unwrap_or_default()
    }

    fn presented_subscription_mask(&self, window_id: WindowId, id: NodeId) -> Option<u32> {
        let window = self.windows.get(&window_id)?;
        // Do not retain arbitrary IDs supplied by callers in the event cache.
        if self.nodes.get(&id)?.window_id != window_id {
            return None;
        }
        if let Some(mask) = window.presented_paths.borrow().get(&id) {
            return *mask;
        }
        let mut subscriptions = 0;
        let presented = self.walk_presented_path(window_id, id, |node| {
            subscriptions |= node.subscriptions;
        });
        let mask = presented.then_some(subscriptions);
        window.presented_paths.borrow_mut().insert(id, mask);
        mask
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
        Ok(Some((tab_index, node.text_control_snapshot())))
    }

    pub fn text_control_snapshot(
        &self,
        window_id: WindowId,
        id: NodeId,
    ) -> Result<TextControlSnapshot, BridgeFailure> {
        self.validated_node(window_id, id)?
            .text_control_snapshot()
            .ok_or_else(|| {
                BridgeFailure::new(
                    "INVALID_NODE_KIND",
                    format!("Node ID {id} is not a native text control."),
                )
            })
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
                    NodeData::Anchored(_) => ("Anchored", None, None),
                    NodeData::Text(text) => ("Text", Some(text.as_str()), None),
                    NodeData::Image { src, .. } => ("Image", None, src.as_deref()),
                    NodeData::Button => ("Button", None, None),
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
        if let Some(window) = self.windows.get_mut(&node.window_id) {
            if node.subscriptions & event_bit(NativeEventId::MouseDownOutside) != 0 {
                window.mousedownoutside_subscribers.remove(&id);
            }
            window.active_nodes.remove(&id);
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
                    ElementKind::Anchored => NodeData::Anchored(AnchoredConfig::default()),
                    ElementKind::Image => NodeData::Image {
                        src: None,
                        object_fit: None,
                        alt: None,
                        location: ImageLocation::Unset,
                    },
                    ElementKind::Button => NodeData::Button,
                    ElementKind::Input | ElementKind::Textarea => NodeData::TextControl {
                        kind: if matches!(kind, ElementKind::Input) {
                            TextControlKind::Input
                        } else {
                            TextControlKind::Textarea
                        },
                        value: String::new(),
                        value_revision: 0,
                        placeholder: String::new(),
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
                    data,
                    tab_index,
                    disabled,
                    ..
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
                    (PropertyId::Disabled, _) => {
                        *disabled = match value {
                            PropertyValue::Null => false,
                            PropertyValue::Boolean(value) => value,
                            _ => {
                                return invalid(
                                    index,
                                    "INVALID_PROPERTY_VALUE",
                                    "Disabled must be a boolean or null.",
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
                        let value = nullable_string(
                            index,
                            value,
                            "Text-control value must be a string or null.",
                        )?
                        .unwrap_or_default();
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
                    (PropertyId::Placeholder, NodeData::TextControl { placeholder, .. }) => {
                        *placeholder = nullable_string(
                            index,
                            value,
                            "Text-control placeholder must be a string or null.",
                        )?
                        .unwrap_or_default();
                        Ok(())
                    }
                    (
                        PropertyId::MinRows,
                        NodeData::TextControl {
                            kind: TextControlKind::Textarea,
                            min_rows: rows,
                            ..
                        },
                    )
                    | (
                        PropertyId::MaxRows,
                        NodeData::TextControl {
                            kind: TextControlKind::Textarea,
                            max_rows: rows,
                            ..
                        },
                    ) => {
                        *rows = textarea_rows(index, value)?;
                        Ok(())
                    }
                    (PropertyId::Src, NodeData::Image { src, location, .. }) => {
                        let parsed = nullable_string(
                            index,
                            value,
                            "Image src must be a URL string or null.",
                        )?;
                        let parsed_location = parsed
                            .as_deref()
                            .map_or(ImageLocation::Unset, ImageLocation::parse);
                        *src = if matches!(&parsed_location, ImageLocation::Unset) {
                            None
                        } else {
                            parsed
                        };
                        *location = parsed_location;
                        Ok(())
                    }
                    (PropertyId::Alt, NodeData::Image { alt, .. }) => {
                        *alt = nullable_string(
                            index,
                            value,
                            "Image alt must be a string or null.",
                        )?;
                        Ok(())
                    }
                    (PropertyId::ObjectFit, NodeData::Image { object_fit, .. }) => {
                        *object_fit = nullable_string(
                            index,
                            value,
                            "Image objectFit must be a supported string or null.",
                        )?
                        .as_deref()
                        .and_then(|value| match value {
                            "fill" => Some(ImageObjectFit::Fill),
                            "contain" => Some(ImageObjectFit::Contain),
                            "cover" => Some(ImageObjectFit::Cover),
                            "scaleDown" | "scale-down" => Some(ImageObjectFit::ScaleDown),
                            "none" => Some(ImageObjectFit::None),
                            _ => None,
                        });
                        Ok(())
                    }
                    (property, NodeData::Anchored(config)) => {
                        config.set_property(index, property, value)
                    }
                    (property, _) => invalid(
                        index,
                        "UNSUPPORTED_PROPERTY",
                        format!("{property:?} is not an intrinsic property for this node kind."),
                    ),
                }
            }
            Command::SetStyle { id, properties } => {
                self.set_style_snapshot(window_id, index, id, None, properties)
            }
            Command::SetPseudoStyle {
                id,
                state,
                properties,
            } => self.set_style_snapshot(window_id, index, id, Some(state), properties),
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

    fn set_style_snapshot(
        &mut self,
        window_id: WindowId,
        index: usize,
        id: NodeId,
        state: Option<StyleState>,
        properties: Vec<(PropertyId, PropertyValue)>,
    ) -> Result<(), BridgeFailure> {
        let node = self.node_mut(window_id, index, id)?;
        if matches!(&node.data, NodeData::Text(_)) {
            return invalid(
                index,
                "UNSUPPORTED_PROPERTY",
                "Text nodes cannot receive author-style snapshots.",
            );
        }
        if matches!(&node.data, NodeData::Anchored(_))
            && properties.iter().any(|(property, _)| {
                matches!(
                    property,
                    PropertyId::Margin
                        | PropertyId::MarginTop
                        | PropertyId::MarginRight
                        | PropertyId::MarginBottom
                        | PropertyId::MarginLeft
                        | PropertyId::MarginInline
                        | PropertyId::MarginBlock
                )
            })
        {
            return invalid(
                index,
                "UNSUPPORTED_PROPERTY",
                "Anchored nodes cannot use margins; use gap/offset or wrap the anchored node instead.",
            );
        }
        for (property, _) in &properties {
            if !NativeStyle::supports_property(*property) {
                return invalid(
                    index,
                    "UNSUPPORTED_PROPERTY",
                    format!("{property:?} is not part of the native style surface."),
                );
            }
        }
        node.store_style_snapshot(state, properties);
        Ok(())
    }

    fn resolve_style_nodes(&mut self, window_id: WindowId, ids: &HashSet<NodeId>) {
        // Disjoint fields allow borrowing the active set without cloning it.
        let active_nodes = &self
            .windows
            .get(&window_id)
            .expect("validated style batches must keep their native window alive")
            .active_nodes;
        for id in ids {
            let node = self
                .nodes
                .get_mut(id)
                .expect("successfully styled nodes must remain in the native tree");
            assert_eq!(
                node.window_id, window_id,
                "successfully styled nodes must remain in their native window"
            );
            node.resolve_author_style(active_nodes.contains(id));
        }
    }

    fn mark_window_style_changed(&mut self, window_id: WindowId) {
        let window = self
            .windows
            .get_mut(&window_id)
            .expect("validated pointer state must keep its native window alive");
        window.revision = window.revision.wrapping_add(1);
        window.presented_paths.get_mut().clear();
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
                NodeData::Anchored(_) => (true, "Anchored"),
                NodeData::Button => (true, "Button"),
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
    use crate::protocol_generated::{PropertyId, StyleState};

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

    fn pseudo_style(
        id: NodeId,
        state: StyleState,
        properties: Vec<(PropertyId, PropertyValue)>,
    ) -> Command {
        Command::SetPseudoStyle {
            id,
            state,
            properties,
        }
    }

    #[test]
    fn focused_style_resolves_between_hover_and_active() {
        let (mut tree, window, _) = setup();
        let opacity = |tree: &NativeTree| {
            tree.nodes[&2]
                .style
                .as_deref()
                .and_then(|style| style.opacity)
        };
        let pseudo = |state, value| {
            pseudo_style(
                2,
                state,
                vec![(PropertyId::Opacity, PropertyValue::Number(value))],
            )
        };
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Container,
                },
                style(2, PropertyId::Opacity, PropertyValue::Number(1.0)),
                pseudo(StyleState::Hover, 0.5),
                pseudo(StyleState::Focused, 0.25),
                pseudo(StyleState::Active, 0.1),
            ],
        )
        .unwrap();
        assert_eq!(opacity(&tree), Some(1.0));

        assert!(tree.set_focused(window, 2, true));
        assert_eq!(opacity(&tree), Some(0.25));
        tree.set_hovered(window, 2, true);
        assert_eq!(opacity(&tree), Some(0.25));
        tree.press_node(window, 2);
        assert_eq!(opacity(&tree), Some(0.1));

        tree.release_pointer(window);
        tree.set_hovered(window, 2, false);
        assert!(tree.set_focused(window, 2, false));
        assert_eq!(opacity(&tree), Some(1.0));
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
    fn batched_style_snapshots_keep_only_the_final_author_target() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Container,
                },
                style(2, PropertyId::Width, PropertyValue::Number(0.0)),
            ],
        )
        .unwrap();

        tree.apply_commands(
            window,
            vec![
                style(2, PropertyId::Width, PropertyValue::Number(100.0)),
                Command::SetStyle {
                    id: 2,
                    properties: vec![
                        (PropertyId::Width, PropertyValue::Number(200.0)),
                        (
                            PropertyId::TransitionProperty,
                            PropertyValue::String("width".into()),
                        ),
                        (
                            PropertyId::TransitionDuration,
                            PropertyValue::String("200ms".into()),
                        ),
                        (
                            PropertyId::TransitionTimingFunction,
                            PropertyValue::String("linear".into()),
                        ),
                    ],
                },
            ],
        )
        .unwrap();

        assert_eq!(
            tree.nodes[&2].style.as_deref().unwrap().width,
            Some(crate::style::LengthValue::Pixels(200.0))
        );
    }

    #[test]
    fn pseudo_styles_resolve_active_over_hover_over_base() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Container,
                },
                style(2, PropertyId::Opacity, PropertyValue::Number(1.0)),
                pseudo_style(
                    2,
                    StyleState::Hover,
                    vec![(PropertyId::Opacity, PropertyValue::Number(0.7))],
                ),
                pseudo_style(
                    2,
                    StyleState::Active,
                    vec![(PropertyId::Opacity, PropertyValue::Number(0.3))],
                ),
            ],
        )
        .unwrap();

        assert_eq!(tree.nodes[&2].style.as_deref().unwrap().opacity, Some(1.0));
        assert!(tree.set_hovered(window, 2, true));
        assert_eq!(tree.nodes[&2].style.as_deref().unwrap().opacity, Some(0.7));
        assert!(tree.press_node(window, 2));
        assert_eq!(tree.nodes[&2].style.as_deref().unwrap().opacity, Some(0.3));

        assert!(tree.set_hovered(window, 2, false));
        assert_eq!(
            tree.nodes[&2].style.as_deref().unwrap().opacity,
            Some(0.3),
            "active must keep precedence after the pointer leaves"
        );
        assert!(tree.release_pointer(window));
        assert_eq!(tree.nodes[&2].style.as_deref().unwrap().opacity, Some(1.0));
    }

    #[test]
    fn active_state_follows_the_styled_ancestor_path() {
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
                style(2, PropertyId::Opacity, PropertyValue::Number(1.0)),
                style(3, PropertyId::Opacity, PropertyValue::Number(1.0)),
                pseudo_style(
                    2,
                    StyleState::Active,
                    vec![(PropertyId::Opacity, PropertyValue::Number(0.6))],
                ),
                pseudo_style(
                    3,
                    StyleState::Active,
                    vec![(PropertyId::Opacity, PropertyValue::Number(0.3))],
                ),
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
            ],
        )
        .unwrap();

        assert!(tree.press_node(window, 3));
        assert_eq!(tree.nodes[&2].style.as_deref().unwrap().opacity, Some(0.6));
        assert_eq!(tree.nodes[&3].style.as_deref().unwrap().opacity, Some(0.3));
        assert!(
            !tree.press_node(window, 2),
            "bubbling through the active ancestor must not erase the child state"
        );
        assert_eq!(tree.nodes[&3].style.as_deref().unwrap().opacity, Some(0.3));

        assert!(tree.release_pointer(window));
        assert_eq!(tree.nodes[&2].style.as_deref().unwrap().opacity, Some(1.0));
        assert_eq!(tree.nodes[&3].style.as_deref().unwrap().opacity, Some(1.0));
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
    fn anchored_properties_validate_and_reset_to_defaults() {
        fn anchored_tree() -> (NativeTree, WindowId) {
            let (mut tree, window, _) = setup();
            tree.apply_commands(
                window,
                vec![Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Anchored,
                }],
            )
            .unwrap();
            (tree, window)
        }

        for (property, value) in [
            (
                PropertyId::AnchoredSide,
                PropertyValue::String("botom".into()),
            ),
            (
                PropertyId::AnchoredAlign,
                PropertyValue::String("middle".into()),
            ),
            (
                PropertyId::AnchoredFit,
                PropertyValue::String("clamp".into()),
            ),
        ] {
            let (mut tree, window) = anchored_tree();
            let error = tree
                .apply_commands(
                    window,
                    vec![Command::SetProperty {
                        id: 2,
                        property,
                        value,
                    }],
                )
                .unwrap_err();
            assert_eq!(error.code, "INVALID_PROPERTY_VALUE");
        }

        let (mut tree, window) = anchored_tree();
        tree.apply_commands(
            window,
            vec![
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::AnchoredPosition,
                    value: PropertyValue::Point(300.0, 200.0),
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::AnchoredSide,
                    value: PropertyValue::String("top".into()),
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::AnchoredAlign,
                    value: PropertyValue::String("end".into()),
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::AnchoredGap,
                    value: PropertyValue::Number(9.0),
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::AnchoredOffset,
                    value: PropertyValue::Point(4.0, -2.0),
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::AnchoredFit,
                    value: PropertyValue::String("switch".into()),
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::AnchoredSnapMargin,
                    value: PropertyValue::Number(0.0),
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::AnchoredDeferred,
                    value: PropertyValue::Boolean(false),
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::AnchoredPriority,
                    value: PropertyValue::Number(4.0),
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::AnchoredOcclude,
                    value: PropertyValue::Boolean(false),
                },
            ],
        )
        .unwrap();
        let NodeData::Anchored(config) = &tree.nodes[&2].data else {
            unreachable!();
        };
        assert_ne!(config, &AnchoredConfig::default());

        for property in [
            PropertyId::AnchoredPosition,
            PropertyId::AnchoredSide,
            PropertyId::AnchoredAlign,
            PropertyId::AnchoredGap,
            PropertyId::AnchoredOffset,
            PropertyId::AnchoredFit,
            PropertyId::AnchoredSnapMargin,
            PropertyId::AnchoredDeferred,
            PropertyId::AnchoredPriority,
            PropertyId::AnchoredOcclude,
        ] {
            tree.apply_commands(
                window,
                vec![Command::SetProperty {
                    id: 2,
                    property,
                    value: PropertyValue::Null,
                }],
            )
            .unwrap();
        }
        let NodeData::Anchored(config) = &tree.nodes[&2].data else {
            unreachable!();
        };
        assert_eq!(config, &AnchoredConfig::default());

        let (mut tree, window) = anchored_tree();
        let error = tree
            .apply_commands(
                window,
                vec![Command::SetProperty {
                    id: 2,
                    property: PropertyId::AnchoredPosition,
                    value: PropertyValue::Point(f64::NAN, 10.0),
                }],
            )
            .unwrap_err();
        assert_eq!(error.code, "INVALID_PROPERTY_VALUE");

        let (mut tree, window) = anchored_tree();
        let error = tree
            .apply_commands(
                window,
                vec![style(
                    2,
                    PropertyId::MarginBottom,
                    PropertyValue::Number(8.0),
                )],
            )
            .unwrap_err();
        assert_eq!(error.code, "UNSUPPORTED_PROPERTY");
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
    fn file_image_src_is_retained_for_bundled_assets() {
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
                    value: PropertyValue::String("file:///Applications/App.app/Contents/Resources/assets/icon.png".into()),
                },
            ],
        )
        .unwrap();

        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::Image { src, .. }
                if src.as_deref()
                    == Some("file:///Applications/App.app/Contents/Resources/assets/icon.png")
        ));
        assert!(tree.windows[&window].fatal.is_none());
    }

    #[test]
    fn image_alt_is_retained_and_cleared_without_poisoning() {
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
                    property: PropertyId::Alt,
                    value: PropertyValue::String("A red square".into()),
                },
            ],
        )
        .unwrap();
        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::Image { alt, .. } if alt.as_deref() == Some("A red square")
        ));
        assert!(tree.windows[&window].fatal.is_none());

        tree.apply_commands(
            window,
            vec![Command::SetProperty {
                id: 2,
                property: PropertyId::Alt,
                value: PropertyValue::Null,
            }],
        )
        .unwrap();
        assert!(matches!(
            &tree.nodes[&2].data,
            NodeData::Image { alt, .. } if alt.is_none()
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
    fn repeated_detach_reattach_settle_cycles_leave_no_residue() {
        let (mut tree, window, root) = setup();
        let mut commands = vec![Command::CreateNode {
            id: 2,
            kind: ElementKind::Container,
        }];
        for id in 3u32..=52 {
            commands.push(Command::CreateNode {
                id,
                kind: ElementKind::Container,
            });
            commands.push(Command::InsertChild {
                parent_id: 2,
                child_id: id,
                before_id: 0,
            });
        }
        commands.push(Command::InsertChild {
            parent_id: root,
            child_id: 2,
            before_id: 0,
        });
        tree.apply_commands(window, commands).unwrap();
        let baseline = tree.nodes.len();
        assert_eq!(baseline, 52);

        for _ in 0..50 {
            tree.apply_commands(
                window,
                vec![Command::RemoveChild {
                    parent_id: root,
                    child_id: 2,
                }],
            )
            .unwrap();
            tree.apply_commands(
                window,
                vec![Command::InsertChild {
                    parent_id: root,
                    child_id: 2,
                    before_id: 0,
                }],
            )
            .unwrap();

            let destroyed = tree.settle(window).unwrap();
            assert!(destroyed.is_empty());
        }

        assert_eq!(tree.nodes.len(), baseline);
        assert!(tree.windows[&window].pending_detached.is_empty());
        assert!(tree.nodes.contains_key(&2));
    }

    #[test]
    fn repeated_create_detach_settle_cycles_return_to_baseline() {
        let (mut tree, window, root) = setup();
        let baseline = tree.nodes.len();

        for _ in 0..50 {
            let mut commands = vec![Command::CreateNode {
                id: 2,
                kind: ElementKind::Container,
            }];
            for id in 3u32..=12 {
                commands.push(Command::CreateNode {
                    id,
                    kind: ElementKind::Container,
                });
                commands.push(Command::InsertChild {
                    parent_id: 2,
                    child_id: id,
                    before_id: 0,
                });
            }
            commands.push(Command::InsertChild {
                parent_id: root,
                child_id: 2,
                before_id: 0,
            });
            tree.apply_commands(window, commands).unwrap();

            tree.apply_commands(
                window,
                vec![Command::RemoveChild {
                    parent_id: root,
                    child_id: 2,
                }],
            )
            .unwrap();
            let destroyed = tree.settle(window).unwrap();
            assert_eq!(destroyed.len(), 11);
        }

        assert_eq!(tree.nodes.len(), baseline);
        assert!(tree.windows[&window].pending_detached.is_empty());
    }

    #[test]
    fn repeated_image_replacement_reattachment_and_destruction_retains_only_current_values() {
        let (mut tree, window, root) = setup();
        for cycle in 0..32 {
            tree.apply_commands(
                window,
                vec![
                    Command::CreateNode {
                        id: 2,
                        kind: ElementKind::Image,
                    },
                    Command::InsertChild {
                        parent_id: root,
                        child_id: 2,
                        before_id: 0,
                    },
                ],
            )
            .unwrap();
            assert!(matches!(
                &tree.nodes[&2].data,
                NodeData::Image {
                    src: None,
                    alt: None,
                    object_fit: None,
                    location: ImageLocation::Unset
                }
            ));

            let uri = format!("https://example.com/image-{cycle}.png");
            let path = format!("/tmp/image-{cycle}.png");
            let file_uri = format!("file://{path}");
            for (source, expected_location) in [
                (Some(uri.clone()), ImageLocation::Uri),
                (Some(file_uri), ImageLocation::Path(path.into())),
                (None, ImageLocation::Unset),
                (Some(uri), ImageLocation::Uri),
            ] {
                let alt = format!("image {cycle}");
                tree.apply_commands(
                    window,
                    vec![
                        Command::RemoveChild {
                            parent_id: root,
                            child_id: 2,
                        },
                        Command::SetProperty {
                            id: 2,
                            property: PropertyId::Src,
                            value: source
                                .clone()
                                .map_or(PropertyValue::Null, PropertyValue::String),
                        },
                        Command::SetProperty {
                            id: 2,
                            property: PropertyId::Alt,
                            value: PropertyValue::String(alt.clone()),
                        },
                        Command::SetProperty {
                            id: 2,
                            property: PropertyId::ObjectFit,
                            value: PropertyValue::String("cover".into()),
                        },
                    ],
                )
                .unwrap();
                assert!(!tree.is_presented(window, 2));
                assert_eq!(tree.windows[&window].pending_detached.len(), 1);
                tree.apply_commands(
                    window,
                    vec![Command::InsertChild {
                        parent_id: root,
                        child_id: 2,
                        before_id: 0,
                    }],
                )
                .unwrap();
                assert!(tree.settle(window).unwrap().is_empty());
                let NodeData::Image {
                    src,
                    alt: retained_alt,
                    object_fit,
                    location,
                } = &tree.nodes[&2].data
                else {
                    panic!("image kind must survive reattachment");
                };
                assert_eq!(src, &source);
                assert_eq!(location, &expected_location);
                assert_eq!(retained_alt.as_deref(), Some(alt.as_str()));
                assert_eq!(*object_fit, Some(ImageObjectFit::Cover));
                assert!(tree.is_presented(window, 2));
                assert_eq!(tree.nodes.len(), 2);
                assert!(tree.windows[&window].pending_detached.is_empty());
            }
            tree.apply_commands(
                window,
                vec![Command::RemoveChild {
                    parent_id: root,
                    child_id: 2,
                }],
            )
            .unwrap();
            assert_eq!(tree.settle(window).unwrap(), vec![2]);
            assert!(tree.settle(window).unwrap().is_empty());
            assert_eq!(tree.nodes.len(), 1);
            assert!(tree.nodes[&root].children.is_empty());
            assert!(tree.windows[&window].presented_paths.borrow().is_empty());
            assert!(tree.windows[&window].fatal.is_none());
        }
    }

    #[test]
    fn repeated_settle_reload_and_close_clear_state_without_touching_a_live_peer() {
        let (mut tree, peer, root) = setup();
        tree.apply_commands(
            peer,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Textarea,
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::Value,
                    value: PropertyValue::String("retained 🦀\nvalue".into()),
                },
                Command::InsertChild {
                    parent_id: root,
                    child_id: 2,
                    before_id: 0,
                },
                pseudo_style(
                    2,
                    StyleState::Focused,
                    vec![(PropertyId::Opacity, PropertyValue::Number(0.5))],
                ),
                Command::SubscribeEvent {
                    id: 2,
                    event: NativeEventId::MouseDownOutside,
                },
            ],
        )
        .unwrap();
        assert!(tree.set_focused(peer, 2, true));
        assert!(tree.is_presented(peer, 2));
        let peer_revision = tree.windows[&peer].revision;
        let peer_snapshot = tree.text_control_snapshot(peer, 2).unwrap();
        let peer_paths = tree.windows[&peer].presented_paths.borrow().clone();

        for _ in 0..32 {
            let window = tree.create_window(100).unwrap();
            for cleanup in ["settle", "reload", "close"] {
                tree.apply_commands(
                    window,
                    vec![
                        Command::CreateNode {
                            id: 101,
                            kind: ElementKind::Container,
                        },
                        Command::CreateNode {
                            id: 102,
                            kind: ElementKind::Image,
                        },
                        Command::CreateNode {
                            id: 103,
                            kind: ElementKind::Input,
                        },
                        Command::InsertChild {
                            parent_id: 100,
                            child_id: 101,
                            before_id: 0,
                        },
                        Command::InsertChild {
                            parent_id: 100,
                            child_id: 102,
                            before_id: 0,
                        },
                        Command::RemoveChild {
                            parent_id: 100,
                            child_id: 102,
                        },
                        Command::SubscribeEvent {
                            id: 101,
                            event: NativeEventId::MouseDownOutside,
                        },
                        Command::SubscribeEvent {
                            id: 102,
                            event: NativeEventId::MouseDownOutside,
                        },
                        pseudo_style(
                            101,
                            StyleState::Active,
                            vec![(PropertyId::Opacity, PropertyValue::Number(0.2))],
                        ),
                        pseudo_style(
                            101,
                            StyleState::Hover,
                            vec![(PropertyId::Opacity, PropertyValue::Number(0.4))],
                        ),
                        pseudo_style(
                            101,
                            StyleState::Focused,
                            vec![(PropertyId::Opacity, PropertyValue::Number(0.6))],
                        ),
                    ],
                )
                .unwrap();
                assert!(tree.press_node(window, 101));
                assert!(tree.set_hovered(window, 101, true));
                assert!(tree.set_focused(window, 101, true));
                assert!(tree.is_presented(window, 101));
                assert!(!tree.is_presented(window, 102));
                assert_eq!(tree.windows[&window].active_nodes.len(), 1);
                assert_eq!(tree.windows[&window].pending_detached.len(), 1);
                assert_eq!(tree.windows[&window].mousedownoutside_subscribers.len(), 2);

                if cleanup == "settle" {
                    tree.apply_commands(
                        window,
                        vec![Command::RemoveChild {
                            parent_id: 100,
                            child_id: 101,
                        }],
                    )
                    .unwrap();
                    let mut destroyed = tree.settle(window).unwrap();
                    destroyed.sort_unstable();
                    assert_eq!(destroyed, vec![101, 102]);
                    assert!(
                        tree.nodes.contains_key(&103),
                        "never-attached controls live until attached or the window resets"
                    );
                    tree.apply_commands(
                        window,
                        vec![
                            Command::InsertChild {
                                parent_id: 100,
                                child_id: 103,
                                before_id: 0,
                            },
                            Command::RemoveChild {
                                parent_id: 100,
                                child_id: 103,
                            },
                        ],
                    )
                    .unwrap();
                    assert_eq!(tree.settle(window).unwrap(), vec![103]);
                    assert!(tree.settle(window).unwrap().is_empty());
                    let state = &tree.windows[&window];
                    assert!(state.active_nodes.is_empty());
                    assert!(state.pending_detached.is_empty());
                    assert!(state.mousedownoutside_subscribers.is_empty());
                    assert!(state.presented_paths.borrow().is_empty());
                    assert!(!tree.release_pointer(window));
                    assert_eq!(tree.nodes.len(), 3);
                } else if cleanup == "reload" {
                    tree.poison_native(window, &"stress reload").unwrap();
                    tree.attach_javascript_stack(window, "old stack".into())
                        .unwrap();
                    tree.reload_window(window).unwrap();
                    let state = &tree.windows[&window];
                    assert_eq!(state.root_id, 100);
                    assert!(state.pending_detached.is_empty());
                    assert!(state.active_nodes.is_empty());
                    assert!(state.mousedownoutside_subscribers.is_empty());
                    assert!(state.presented_paths.borrow().is_empty());
                    assert!(state.fatal.is_none());
                    assert!(tree.nodes[&100].children.is_empty());
                    assert_eq!(tree.nodes.len(), 3);
                    assert!(!tree.release_pointer(window));
                } else {
                    assert_eq!(tree.close_window(window), vec![100, 101, 102, 103]);
                    assert!(tree.close_window(window).is_empty());
                    assert_eq!(tree.nodes.len(), 2);
                    assert_eq!(tree.windows.len(), 1);
                }
                assert_eq!(tree.windows[&peer].revision, peer_revision);
                assert_eq!(*tree.windows[&peer].presented_paths.borrow(), peer_paths);
                let snapshot = tree.text_control_snapshot(peer, 2).unwrap();
                assert_eq!(snapshot.value, peer_snapshot.value);
                assert_eq!(snapshot.value_revision, peer_snapshot.value_revision);
                assert!(matches!(snapshot.kind, TextControlKind::Textarea));
                assert!(tree.nodes[&2].focused);
                assert_eq!(
                    tree.windows[&peer].mousedownoutside_subscribers,
                    HashSet::from([2])
                );
                assert!(tree.windows[&peer].fatal.is_none());
            }
        }
    }

    #[test]
    fn repeated_window_create_close_cycles_release_every_node() {
        let (mut tree, _window, _root) = setup();
        let baseline = tree.nodes.len();

        for cycle in 0..20u32 {
            let root_id = 1000 + cycle * 10;
            let window_id = tree.create_window(root_id).unwrap();
            tree.apply_commands(
                window_id,
                vec![
                    Command::CreateNode {
                        id: root_id + 1,
                        kind: ElementKind::Container,
                    },
                    Command::InsertChild {
                        parent_id: root_id,
                        child_id: root_id + 1,
                        before_id: 0,
                    },
                ],
            )
            .unwrap();

            let destroyed = tree.close_window(window_id);
            assert_eq!(destroyed.len(), 2);
        }

        assert_eq!(tree.nodes.len(), baseline);
        assert_eq!(tree.windows.len(), 1);
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
                        value: if value & 4 == 0 {
                            PropertyValue::Null
                        } else {
                            PropertyValue::String(format!("https://example.com/{value}.png"))
                        },
                    }]),
                    _ => tree.apply_commands(
                        window,
                        vec![style(
                            if value & 4 == 0 { image } else { container },
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

    #[test]
    fn native_buttons_retain_kind_defaults_and_disabled_state() {
        let (mut tree, window, root) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Button,
                },
                Command::InsertChild {
                    parent_id: root,
                    child_id: 2,
                    before_id: 0,
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::Disabled,
                    value: PropertyValue::Boolean(true),
                },
            ],
        )
        .unwrap();

        assert!(matches!(tree.nodes[&2].data, NodeData::Button));
        assert!(tree.nodes[&2].disabled);
        assert!(tree.windows[&window].fatal.is_none());

        tree.apply_commands(
            window,
            vec![Command::SetProperty {
                id: 2,
                property: PropertyId::Disabled,
                value: PropertyValue::Null,
            }],
        )
        .unwrap();
        assert!(!tree.nodes[&2].disabled);
    }

    #[test]
    fn invalid_disabled_value_is_rejected_without_replacing_the_previous_state() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Button,
                },
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::Disabled,
                    value: PropertyValue::Boolean(true),
                },
            ],
        )
        .unwrap();

        let error = tree
            .apply_commands(
                window,
                vec![Command::SetProperty {
                    id: 2,
                    property: PropertyId::Disabled,
                    value: PropertyValue::Number(1.0),
                }],
            )
            .unwrap_err();

        assert_eq!(error.code, "INVALID_PROPERTY_VALUE");
        assert!(tree.nodes[&2].disabled);
        assert!(tree.windows[&window].fatal.is_some());
    }

    #[test]
    fn control_tab_targets_default_on_and_follow_disabled_and_explicit_tab_index() {
        let (mut tree, window, _) = setup();
        tree.apply_commands(
            window,
            vec![
                Command::CreateNode {
                    id: 2,
                    kind: ElementKind::Button,
                },
                Command::CreateNode {
                    id: 3,
                    kind: ElementKind::Input,
                },
                Command::CreateNode {
                    id: 4,
                    kind: ElementKind::Container,
                },
            ],
        )
        .unwrap();

        let tab = |tree: &NativeTree, id: NodeId| {
            tree.node_focus_target(window, id)
                .unwrap()
                .map(|(tab_index, _)| tab_index)
        };
        assert_eq!(tab(&tree, 2), Some(0));
        assert_eq!(tab(&tree, 3), Some(0));
        assert_eq!(tab(&tree, 4), None);

        tree.apply_commands(
            window,
            vec![
                Command::SetProperty {
                    id: 2,
                    property: PropertyId::Disabled,
                    value: PropertyValue::Boolean(true),
                },
                Command::SetProperty {
                    id: 3,
                    property: PropertyId::TabIndex,
                    value: PropertyValue::Number(-1.0),
                },
            ],
        )
        .unwrap();
        assert_eq!(tab(&tree, 2), None);
        assert_eq!(tab(&tree, 3), Some(-1));
    }
}
