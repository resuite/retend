#![deny(clippy::all)]

mod platform;
mod protocol;
mod protocol_generated;
mod render;
mod style;
mod tree;

use std::sync::{Mutex, OnceLock};

use napi::bindgen_prelude::Buffer;
use napi::{Error, Result, Status};
use napi_derive::napi;

use protocol::decode_command_batch;
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

    fn binding(code: &'static str, message: impl Into<String>) -> Self {
        Self::new(code, message)
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

#[napi(object)]
#[derive(Clone, Default)]
pub struct NativeWindowOptions {
    pub title: Option<String>,
    pub width: Option<f64>,
    pub height: Option<f64>,
}

#[napi]
pub struct NativeRendererBinding {
    window_id: WindowId,
}

#[napi]
impl NativeRendererBinding {
    #[napi(constructor)]
    pub fn new(root_id: u32, headless: bool, options: Option<NativeWindowOptions>) -> Result<Self> {
        let window_id = with_runtime(|tree| tree.create_window(root_id))?;
        if !headless {
            if let Err(error) = platform::open_window(window_id, options.unwrap_or_default()) {
                lock_runtime()?.close_window(window_id);
                return Err(Error::new(Status::GenericFailure, error));
            }
        }
        Ok(Self { window_id })
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
        platform::invalidate_window(self.window_id);
        result
    }

    #[napi]
    pub fn settle(&self) -> Result<()> {
        with_runtime(|tree| tree.settle(self.window_id))?;
        Ok(())
    }

    #[napi]
    pub fn report_fatal(&self, javascript_stack: String) -> Result<()> {
        with_runtime(|tree| tree.attach_javascript_stack(self.window_id, javascript_stack))?;
        platform::invalidate_window(self.window_id);
        Ok(())
    }

    #[napi]
    pub fn set_window_title(&self, title: String) -> Result<()> {
        if self.is_closed()? {
            return Err(bridge_error(BridgeFailure::binding(
                "CLOSED_WINDOW",
                "Renderer window has already closed.",
            )));
        }
        platform::set_window_title(self.window_id, title);
        Ok(())
    }

    #[napi]
    pub fn close(&self) -> Result<()> {
        platform::close_window(self.window_id);
        lock_runtime()?.close_window(self.window_id);
        Ok(())
    }

    #[napi]
    pub fn is_closed(&self) -> Result<bool> {
        let tree = lock_runtime()?;
        Ok(!tree.windows.contains_key(&self.window_id))
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
            NativeRendererBinding::new(root_id, true, None).unwrap(),
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
