//! Native Win32 text-editing popup menus. GPUI remains the text editor.

use std::ffi::c_void;

use gpui_base::input::{NativeMenu, NativeMenuItem};
use windows::{
    core::PCWSTR,
    Win32::{
        Foundation::{HWND, POINT},
        Graphics::Gdi::ClientToScreen,
        UI::WindowsAndMessaging::{
            AppendMenuW, CreatePopupMenu, DestroyMenu, SetForegroundWindow, TrackPopupMenuEx,
            MF_GRAYED, MF_SEPARATOR, MF_STRING, TPM_LEFTALIGN, TPM_NONOTIFY, TPM_RETURNCMD,
            TPM_TOPALIGN,
        },
    },
};

pub(crate) unsafe fn popup(
    hwnd: isize,
    x: i32,
    y: i32,
    menu: NativeMenu,
) -> Option<Box<dyn gpui::Action>> {
    // SAFETY: GPUI created this HWND on the current UI thread. The popup
    // menu is destroyed before its HWND can be released.
    unsafe {
        let hwnd = HWND(hwnd as *mut c_void);
        let popup = CreatePopupMenu().ok()?;
        let mut actions = Vec::new();
        for item in menu.items {
            match item {
                NativeMenuItem::Separator => {
                    let _ = AppendMenuW(popup, MF_SEPARATOR, 0, PCWSTR::null());
                }
                NativeMenuItem::Action {
                    label,
                    disabled,
                    action,
                } => {
                    let wide: Vec<u16> = label.encode_utf16().chain(std::iter::once(0)).collect();
                    let id = if disabled {
                        0
                    } else {
                        actions.push(action);
                        actions.len()
                    };
                    let flags = if disabled {
                        MF_STRING | MF_GRAYED
                    } else {
                        MF_STRING
                    };
                    let _ = AppendMenuW(popup, flags, id, PCWSTR(wide.as_ptr()));
                }
            }
        }

        let mut position = POINT { x, y };
        let _ = ClientToScreen(hwnd, &mut position);
        let _ = SetForegroundWindow(hwnd);
        let selected = TrackPopupMenuEx(
            popup,
            (TPM_LEFTALIGN | TPM_TOPALIGN | TPM_RETURNCMD | TPM_NONOTIFY).0,
            position.x,
            position.y,
            hwnd,
            None,
        );
        let _ = DestroyMenu(popup);
        let index = usize::try_from(selected.0).ok()?.checked_sub(1)?;
        (index < actions.len()).then(|| actions.swap_remove(index))
    }
}
