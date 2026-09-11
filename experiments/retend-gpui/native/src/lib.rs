#![deny(clippy::all)]

mod events;
mod platform;
mod protocol;
mod protocol_generated;
mod render;
mod runtime_state;
mod style;
mod tree;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};

use napi::bindgen_prelude::{Buffer, Function, Object, ToNapiValue};
use napi::{Env, Error, Result, Status};
use napi_derive::napi;

use platform::{TextControlOperation, WindowOperation};
use protocol::decode_command_batch;
use runtime_state::{LayoutOperation, QueryResponder};
use tree::{NativeTree, WindowId};

#[derive(Debug, serde::Serialize)]
struct BridgeFailure {
    code: &'static str,
    message: String,
    #[serde(rename = "commandIndex", skip_serializing_if = "Option::is_none")]
    command_index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    offset: Option<usize>,
}

impl BridgeFailure {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            command_index: None,
            offset: None,
        }
    }

    fn command(index: usize, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            command_index: Some(index),
            ..Self::new(code, message)
        }
    }

    fn closed_window() -> Self {
        Self::new("CLOSED_WINDOW", "Renderer window has already closed.")
    }

    fn destroyed_node(id: u32) -> Self {
        Self::new("DESTROYED_NODE", format!("Node ID {id} no longer exists."))
    }

    fn wire(code: &'static str, message: impl Into<String>, offset: Option<usize>) -> Self {
        Self {
            offset,
            ..Self::new(code, message)
        }
    }
}

static RUNTIME: OnceLock<Mutex<NativeTree>> = OnceLock::new();

fn runtime() -> &'static Mutex<NativeTree> {
    RUNTIME.get_or_init(|| Mutex::new(NativeTree::default()))
}

fn bridge_error(error: impl serde::Serialize) -> Error {
    let payload =
        serde_json::to_string(&error).expect("native bridge errors must serialize to JSON");
    Error::new(Status::InvalidArg, format!("RETEND_GPUI_FAILURE:{payload}"))
}

fn lock_runtime() -> Result<std::sync::MutexGuard<'static, NativeTree>> {
    runtime().lock().map_err(|_| {
        Error::new(
            Status::GenericFailure,
            "Retend GPUI native runtime lock was poisoned.",
        )
    })
}

fn with_runtime<T>(
    action: impl FnOnce(&mut NativeTree) -> std::result::Result<T, BridgeFailure>,
) -> Result<T> {
    action(&mut *lock_runtime()?).map_err(bridge_error)
}

fn scroll_coordinate(value: f64) -> Result<f32> {
    if !value.is_finite() || value.abs() > f64::from(f32::MAX) {
        return Err(bridge_error(BridgeFailure::new(
            "INVALID_SCROLL_OFFSET",
            "Scroll coordinates must be finite values within GPUI limits.",
        )));
    }
    Ok(value as f32)
}

#[napi(object)]
#[derive(Clone, Default)]
pub struct NativeWindowOptions {
    pub title: Option<String>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub resizable: Option<bool>,
    pub fullscreen: Option<bool>,
    pub maximized: Option<bool>,
    pub min_width: Option<f64>,
    pub min_height: Option<f64>,
    pub max_width: Option<f64>,
    pub max_height: Option<f64>,
}

#[napi(object)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct NativeMeasurement {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub scroll_width: f64,
    pub scroll_height: f64,
}

#[napi(object)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct NativeScrollOffset {
    pub x: f64,
    pub y: f64,
}

#[napi(object)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct NativeSelection {
    pub start: u32,
    pub end: u32,
}

#[napi]
pub struct NativeRendererBinding {
    window_id: WindowId,
    root_id: u32,
    headless: bool,
    options: NativeWindowOptions,
    opened: AtomicBool,
}

impl NativeRendererBinding {
    fn dispatch(&self, operation: WindowOperation) -> bool {
        platform::dispatch(self.window_id, operation)
    }

    fn query<'env, T: Clone + Default + Send + ToNapiValue + 'static>(
        &self,
        env: &'env Env,
        submit: impl FnOnce(QueryResponder<T>) -> bool,
    ) -> Result<Object<'env>> {
        let (deferred, promise) = env.create_deferred()?;
        let responder = QueryResponder::new(move |result| match result {
            Ok(value) => deferred.resolve(move |_| Ok(value)),
            Err(failure) => deferred.reject(bridge_error(failure)),
        });
        if self.headless {
            responder.respond(Ok(T::default()));
        } else if !submit(responder.clone()) {
            responder.respond(Err(BridgeFailure::closed_window()));
        }
        Ok(promise)
    }

    fn scroll_node(&self, id: u32, x: f64, y: f64, relative: bool) -> Result<()> {
        let overflow = with_runtime(|tree| tree.node_overflow(self.window_id, id))?;
        if !overflow.is_scroll_container() || self.headless {
            return Ok(());
        }
        let (x, y) = (scroll_coordinate(x)?, scroll_coordinate(y)?);
        self.dispatch(WindowOperation::Layout(LayoutOperation::Scroll(
            id, overflow, x, y, relative,
        )));
        Ok(())
    }

    /// Opens the OS window once application content has been committed, so the
    /// window's first drawn frame already contains the app instead of an empty root.
    fn open_window(&self) -> Result<()> {
        if self.headless || self.opened.load(Ordering::Acquire) {
            return Ok(());
        }
        let has_content = with_runtime(|tree| {
            Ok(tree
                .nodes
                .get(&self.root_id)
                .is_some_and(|node| !node.children.is_empty()))
        })?;
        if !has_content {
            return Ok(());
        }
        if self.opened.swap(true, Ordering::AcqRel) {
            return Ok(());
        }
        if let Err(error) = platform::open_window(self.window_id, self.options.clone()) {
            self.opened.store(false, Ordering::Release);
            return Err(Error::new(Status::GenericFailure, error));
        }
        Ok(())
    }
}

#[napi]
impl NativeRendererBinding {
    #[napi(constructor)]
    pub fn new(
        root_id: u32,
        headless: bool,
        options: Option<NativeWindowOptions>,
        on_event: Option<Function<'_, events::NativeTransportPayload, ()>>,
    ) -> Result<Self> {
        let window_id = with_runtime(|tree| tree.create_window(root_id))?;
        if let Some(callback) = on_event {
            if let Err(error) = events::register(window_id, callback) {
                lock_runtime()?.close_window(window_id);
                return Err(error);
            }
        }
        Ok(Self {
            window_id,
            root_id,
            headless,
            options: options.unwrap_or_default(),
            opened: AtomicBool::new(false),
        })
    }

    #[napi(getter)]
    pub fn window_id(&self) -> u32 {
        self.window_id
    }

    #[napi]
    pub fn apply_command_batch(&self, buffer: Buffer) -> Result<()> {
        let commands = match decode_command_batch(buffer.as_ref()) {
            Ok(commands) => commands,
            Err(error) => {
                with_runtime(|tree| tree.poison_native(self.window_id, &error))?;
                platform::invalidate_window(self.window_id);
                return Err(bridge_error(error));
            }
        };
        let result = with_runtime(|tree| tree.apply_commands(self.window_id, commands));
        if result.is_ok() {
            self.open_window()?;
        }
        platform::invalidate_window(self.window_id);
        result
    }

    #[napi]
    pub fn settle(&self) -> Result<()> {
        let destroyed = with_runtime(|tree| tree.settle(self.window_id))?;
        if !destroyed.is_empty() {
            self.dispatch(WindowOperation::DestroyRuntimeNodes(destroyed));
        }
        Ok(())
    }

    #[napi]
    pub fn focus_node(&self, id: u32) -> Result<()> {
        if let Some((tab_index, input)) =
            with_runtime(|tree| tree.node_focus_target(self.window_id, id))?
        {
            self.dispatch(WindowOperation::Focus(id, tab_index, input));
        }
        Ok(())
    }

    #[napi]
    pub fn blur_node(&self, id: u32) -> Result<()> {
        with_runtime(|tree| tree.validate_node(self.window_id, id))?;
        self.dispatch(WindowOperation::Blur(id));
        Ok(())
    }

    #[napi]
    pub fn set_selection_range_node(&self, id: u32, start: u32, end: u32) -> Result<()> {
        let control = with_runtime(|tree| tree.text_control_snapshot(self.window_id, id))?;
        if !self.headless {
            self.dispatch(WindowOperation::TextControl(
                id,
                control,
                TextControlOperation::SetSelection(start, end),
            ));
        }
        Ok(())
    }

    #[napi]
    pub fn select_node(&self, id: u32) -> Result<()> {
        let control = with_runtime(|tree| tree.text_control_snapshot(self.window_id, id))?;
        if !self.headless {
            self.dispatch(WindowOperation::TextControl(
                id,
                control,
                TextControlOperation::Select,
            ));
        }
        Ok(())
    }

    #[napi]
    pub fn get_selection_node<'env>(&self, env: &'env Env, id: u32) -> Result<Object<'env>> {
        let control = with_runtime(|tree| tree.text_control_snapshot(self.window_id, id))?;
        self.query(env, |responder| {
            self.dispatch(WindowOperation::TextControl(
                id,
                control,
                TextControlOperation::GetSelection(responder),
            ))
        })
    }

    #[napi]
    pub fn scroll_to_node(&self, id: u32, x: f64, y: f64) -> Result<()> {
        self.scroll_node(id, x, y, false)
    }

    #[napi]
    pub fn scroll_by_node(&self, id: u32, x: f64, y: f64) -> Result<()> {
        self.scroll_node(id, x, y, true)
    }

    #[napi]
    pub fn scroll_into_view_node(&self, id: u32) -> Result<()> {
        with_runtime(|tree| tree.validate_node(self.window_id, id))?;
        if !self.headless {
            self.dispatch(WindowOperation::Layout(LayoutOperation::ScrollIntoView(id)));
        }
        Ok(())
    }

    #[napi]
    pub fn get_scroll_offset_node<'env>(&self, env: &'env Env, id: u32) -> Result<Object<'env>> {
        let overflow = with_runtime(|tree| tree.node_overflow(self.window_id, id))?;
        self.query(env, |responder| {
            self.dispatch(WindowOperation::Layout(LayoutOperation::ScrollOffset(
                id, overflow, responder,
            )))
        })
    }

    #[napi]
    pub fn measure_node<'env>(&self, env: &'env Env, id: u32) -> Result<Object<'env>> {
        with_runtime(|tree| tree.validate_node(self.window_id, id))?;
        self.query(env, |responder| {
            self.dispatch(WindowOperation::Layout(LayoutOperation::Measure(
                id, responder,
            )))
        })
    }

    #[napi]
    pub fn report_fatal(&self, javascript_stack: String) -> Result<()> {
        with_runtime(|tree| tree.attach_javascript_stack(self.window_id, javascript_stack))?;
        platform::invalidate_window(self.window_id);
        Ok(())
    }

    #[napi]
    pub fn set_window_title(&self, title: String) -> Result<()> {
        if !lock_runtime()?.windows.contains_key(&self.window_id) {
            return Err(bridge_error(BridgeFailure::closed_window()));
        }
        self.dispatch(WindowOperation::SetTitle(title));
        Ok(())
    }

    #[napi]
    pub fn close(&self) -> Result<()> {
        platform::close_window(self.window_id);
        events::unregister(self.window_id);
        lock_runtime()?.close_window(self.window_id);
        Ok(())
    }

    #[napi]
    pub fn is_node_presented(&self, id: u32) -> Result<bool> {
        let tree = lock_runtime()?;
        Ok(tree.is_presented(self.window_id, id))
    }

    #[napi]
    pub fn debug_tree_json(&self) -> Result<String> {
        with_runtime(|tree| tree.debug_window_json(self.window_id))
    }
}

#[napi]
pub fn tick() -> Result<bool> {
    platform::tick().map_err(|error| Error::new(Status::GenericFailure, error))
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU32, Ordering};

    use serde_json::{json, Value};

    use super::*;
    use crate::{
        protocol::HEADER_BYTES,
        protocol_generated::{ElementKind, Opcode, PROTOCOL_MAGIC, PROTOCOL_VERSION},
    };

    static NEXT_TEST_ROOT: AtomicU32 = AtomicU32::new(0xe000_0000);

    fn command_batch(commands: &[u8], command_count: u32) -> Buffer {
        let mut bytes = vec![0; HEADER_BYTES];
        bytes[0..4].copy_from_slice(&PROTOCOL_MAGIC.to_le_bytes());
        bytes[4..6].copy_from_slice(&PROTOCOL_VERSION.to_le_bytes());
        bytes[8..12].copy_from_slice(&(commands.len() as u32).to_le_bytes());
        bytes[12..16].copy_from_slice(&command_count.to_le_bytes());
        bytes[16..20].copy_from_slice(&((HEADER_BYTES + commands.len()) as u32).to_le_bytes());
        bytes.extend_from_slice(commands);
        Buffer::from(bytes)
    }

    fn new_binding() -> (NativeRendererBinding, u32) {
        let root_id = NEXT_TEST_ROOT.fetch_add(8, Ordering::Relaxed);
        (
            NativeRendererBinding::new(root_id, true, None, None).unwrap(),
            root_id,
        )
    }

    fn invalidation_snapshot(binding: &NativeRendererBinding) -> Value {
        let invalidations = platform::take_test_invalidations();
        assert_eq!(
            invalidations.len(),
            1,
            "each submission must invalidate exactly once"
        );
        assert_eq!(invalidations[0].0, binding.window_id);
        serde_json::from_str(
            invalidations[0]
                .1
                .as_deref()
                .expect("invalidation must happen after releasing the retained-tree lock"),
        )
        .unwrap()
    }

    #[test]
    fn binding_invalidates_once_after_successful_and_empty_batches() {
        let (binding, root_id) = new_binding();
        let child_id = root_id + 1;
        platform::take_test_invalidations();

        let mut commands = vec![Opcode::CreateNode as u8];
        commands.extend_from_slice(&child_id.to_le_bytes());
        commands.push(ElementKind::Container as u8);
        commands.push(Opcode::InsertChild as u8);
        commands.extend_from_slice(&root_id.to_le_bytes());
        commands.extend_from_slice(&child_id.to_le_bytes());
        commands.extend_from_slice(&0u32.to_le_bytes());
        binding
            .apply_command_batch(command_batch(&commands, 2))
            .unwrap();

        let snapshot = invalidation_snapshot(&binding);
        assert_eq!(snapshot["poisoned"], false);
        let root = snapshot["nodes"]
            .as_array()
            .unwrap()
            .iter()
            .find(|node| node["id"].as_u64() == Some(u64::from(root_id)))
            .unwrap();
        assert_eq!(root["children"], json!([child_id]));

        binding.apply_command_batch(command_batch(&[], 0)).unwrap();
        let snapshot = invalidation_snapshot(&binding);
        assert_eq!(snapshot["poisoned"], false);
        assert_eq!(snapshot["nodes"].as_array().unwrap().len(), 2);
        binding.close().unwrap();
    }

    #[test]
    fn binding_command_failure_invalidates_once_after_poisoning() {
        let (binding, root_id) = new_binding();
        let valid_id = root_id + 1;
        let invalid_id = root_id + 2;
        platform::take_test_invalidations();

        let mut commands = vec![Opcode::CreateNode as u8];
        commands.extend_from_slice(&valid_id.to_le_bytes());
        commands.push(ElementKind::Container as u8);
        commands.push(Opcode::CreateNode as u8);
        commands.extend_from_slice(&invalid_id.to_le_bytes());
        commands.push(ElementKind::Root as u8);
        assert!(binding
            .apply_command_batch(command_batch(&commands, 2))
            .is_err());

        let snapshot = invalidation_snapshot(&binding);
        assert_eq!(snapshot["poisoned"], true);
        assert!(snapshot["nodes"]
            .as_array()
            .unwrap()
            .iter()
            .any(|node| node["id"].as_u64() == Some(u64::from(valid_id))));
        binding.close().unwrap();
    }

    #[test]
    fn binding_decode_failure_invalidates_once_after_poisoning() {
        let (binding, _) = new_binding();
        platform::take_test_invalidations();

        assert!(binding.apply_command_batch(Buffer::from(vec![0])).is_err());

        let snapshot = invalidation_snapshot(&binding);
        assert_eq!(snapshot["poisoned"], true);
        assert!(snapshot["fatal"]["native_failure"]
            .as_str()
            .is_some_and(|failure| failure.contains("TRUNCATED_HEADER")));
        binding.close().unwrap();
    }
}
