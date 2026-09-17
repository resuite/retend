#[cfg(target_os = "macos")]
mod imp {
    use std::cell::Cell;
    use std::ffi::c_void;
    use std::ptr;
    use std::sync::{Arc, Mutex, MutexGuard};

    use napi::bindgen_prelude::Function;
    use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
    use napi::{Result, Status};

    type PumpCallback = ThreadsafeFunction<(), (), (), Status, false>;

    struct EventPump {
        identity: Arc<()>,
        callback: PumpCallback,
        pending: bool,
    }

    static PUMP: Mutex<Option<EventPump>> = Mutex::new(None);

    fn lock_pump() -> Result<MutexGuard<'static, Option<EventPump>>> {
        PUMP.lock()
            .map_err(|_| napi::Error::from_reason("GPUI event pump lock was poisoned"))
    }

    thread_local! {
        // Only start/stop on the process main thread access this immortal link.
        static LINK: Cell<*mut sys::CVDisplayLink> = const { Cell::new(ptr::null_mut()) };
    }

    fn require_main_thread() -> Result<()> {
        // SAFETY: pthread_main_np has no arguments or caller preconditions.
        if unsafe { sys::pthread_main_np() } == 0 {
            return Err(napi::Error::from_reason(
                "The GPUI event pump must run on the process main thread",
            ));
        }
        Ok(())
    }

    pub fn start(notify: Function<(), ()>) -> Result<()> {
        require_main_thread()?;
        if lock_pump()?.is_some() {
            return Ok(());
        }

        let identity = Arc::new(());
        let callback_identity = identity.clone();
        let callback = notify
            .build_threadsafe_function::<()>()
            .build_callback(move |_| on_js_thread_pump(&callback_identity))?;

        let link = LINK.with(|stored| -> Result<_> {
            let mut link = stored.get();
            if link.is_null() {
                // SAFETY: The callback uses only static, synchronized state, never a
                // borrowed context. A started link is retained for process lifetime.
                link = unsafe { sys::create_active_displays_link(output_callback) }.map_err(
                    |status| {
                        napi::Error::from_reason(format!(
                            "Failed to create CVDisplayLink for the GPUI event pump ({status})"
                        ))
                    },
                )?;
                stored.set(link);
            }
            Ok(link)
        })?;

        *lock_pump()? = Some(EventPump {
            identity,
            callback,
            pending: false,
        });

        // SAFETY: The link is initialized and never released. No callback mutex
        // is held while entering CoreVideo, which has its own internal locks.
        let status = unsafe { sys::CVDisplayLinkStart(link) };
        if status != sys::SUCCESS {
            let pump = lock_pump()?.take();
            drop(pump);
            return Err(napi::Error::from_reason(format!(
                "Failed to start CVDisplayLink for the GPUI event pump ({status})"
            )));
        }
        Ok(())
    }

    pub fn stop() -> Result<()> {
        require_main_thread()?;
        let pump = lock_pump()?.take();
        let Some(pump) = pump else {
            return Ok(());
        };

        // SAFETY: A pump is installed only after LINK is initialized. Removing it
        // under PUMP makes the callback unreachable before releasing the TSFN.
        // CoreVideo may still issue callbacks, so the link itself is never freed.
        // Crucially, PUMP is no longer locked when we enter CoreVideo.
        let status = LINK.with(|link| unsafe { sys::CVDisplayLinkStop(link.get()) });
        drop(pump);
        if status != sys::SUCCESS {
            return Err(napi::Error::from_reason(format!(
                "Failed to stop CVDisplayLink for the GPUI event pump ({status})"
            )));
        }
        Ok(())
    }

    fn request_pump() {
        let Ok(mut slot) = PUMP.lock() else {
            return;
        };
        let Some(pump) = slot.as_mut() else {
            return;
        };
        if pump.pending {
            return;
        }
        pump.pending = pump
            .callback
            .call((), ThreadsafeFunctionCallMode::NonBlocking)
            == Status::Ok;
    }

    fn on_js_thread_pump(identity: &Arc<()>) -> Result<()> {
        {
            let mut slot = lock_pump()?;
            let Some(pump) = slot.as_mut() else {
                return Ok(());
            };
            // Dropping a TSFN drains queued calls. They must not tick a later pump.
            if !Arc::ptr_eq(&pump.identity, identity) {
                return Ok(());
            }
            pump.pending = false;
        }
        if !crate::platform::tick() {
            let current = lock_pump()?
                .as_ref()
                .is_some_and(|pump| Arc::ptr_eq(&pump.identity, identity));
            // AppKit can deliver JS close handlers that stop/restart during tick.
            if current {
                stop()?;
            }
        }
        Ok(())
    }

    unsafe extern "C" fn output_callback(
        _link: *mut sys::CVDisplayLink,
        _now: *const c_void,
        _output_time: *const c_void,
        _flags_in: i64,
        _flags_out: *mut i64,
        _context: *mut c_void,
    ) -> i32 {
        request_pump();
        sys::SUCCESS
    }

    mod sys {
        use std::ffi::c_void;

        pub const SUCCESS: i32 = 0;

        #[repr(C)]
        pub struct CVDisplayLink {
            _opaque: [u8; 0],
        }

        type OutputCallback = unsafe extern "C" fn(
            *mut CVDisplayLink,
            *const c_void,
            *const c_void,
            i64,
            *mut i64,
            *mut c_void,
        ) -> i32;

        unsafe extern "C" {
            pub fn pthread_main_np() -> i32;
        }

        #[link(name = "CoreVideo", kind = "framework")]
        unsafe extern "C" {
            fn CVDisplayLinkCreateWithActiveCGDisplays(link_out: *mut *mut CVDisplayLink) -> i32;
            fn CVDisplayLinkSetOutputCallback(
                link: *mut CVDisplayLink,
                callback: OutputCallback,
                context: *mut c_void,
            ) -> i32;
            pub fn CVDisplayLinkStart(link: *mut CVDisplayLink) -> i32;
            pub fn CVDisplayLinkStop(link: *mut CVDisplayLink) -> i32;
            fn CVDisplayLinkRelease(link: *mut CVDisplayLink);
        }

        pub unsafe fn create_active_displays_link(
            callback: OutputCallback,
        ) -> Result<*mut CVDisplayLink, i32> {
            let mut link = std::ptr::null_mut();
            // SAFETY: CoreVideo receives a valid out-pointer and initializes it on success.
            let status = unsafe { CVDisplayLinkCreateWithActiveCGDisplays(&mut link) };
            if status != SUCCESS {
                return Err(status);
            }
            // SAFETY: The link was created successfully; the caller supplies a static
            // callback that does not dereference the null context.
            let status =
                unsafe { CVDisplayLinkSetOutputCallback(link, callback, std::ptr::null_mut()) };
            if status != SUCCESS {
                // SAFETY: This link has never started, so no output callback can race release.
                unsafe { CVDisplayLinkRelease(link) };
                return Err(status);
            }
            Ok(link)
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    use napi::bindgen_prelude::Function;
    use napi::Result;

    pub fn start(_: Function<(), ()>) -> Result<()> {
        Ok(())
    }

    pub fn stop() -> Result<()> {
        Ok(())
    }
}

pub use imp::{start, stop};
