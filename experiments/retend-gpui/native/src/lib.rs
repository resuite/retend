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

#[napi]
pub struct NativeRendererBinding {
    window_id: WindowId,
}

#[napi]
impl NativeRendererBinding {
    #[napi(constructor)]
    pub fn new(root_id: u32, headless: bool) -> Result<Self> {
        let window_id = with_runtime(|tree| tree.create_window(root_id))?;
        if !headless {
            if let Err(error) = platform::open_window(window_id) {
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
