//! OS-rendered popup menus for Retend application code and text editing.
//! The modal platform loop is owned here; only presentation and result handling
//! are shared. Application callbacks run after the modal loop completes.

use gpui::{point, px, Action, App, Pixels, Point, Window};
use gpui_base::input::NativeMenu;

use crate::{runtime_state::QueryResponder, BridgeFailure};

#[derive(Clone)]
pub(crate) enum MenuItem {
    Action {
        id: String,
        label: String,
        disabled: bool,
    },
    Separator,
}

pub(crate) fn validate_items(
    items: Vec<crate::NativePopupMenuItem>,
) -> Result<Vec<MenuItem>, BridgeFailure> {
    let mut ids = std::collections::HashSet::new();
    let mut menu = Vec::with_capacity(items.len());
    for item in items {
        if item.separator.unwrap_or(false) {
            if item.id.is_some() || item.label.is_some() || item.disabled.is_some() {
                return Err(BridgeFailure::new(
                    "INVALID_MENU_ITEM",
                    "Separators cannot have item properties.",
                ));
            }
            menu.push(MenuItem::Separator);
        } else {
            let (Some(id), Some(label)) = (item.id, item.label) else {
                return Err(BridgeFailure::new(
                    "INVALID_MENU_ITEM",
                    "A menu action needs an id and label.",
                ));
            };
            if id.is_empty() || label.is_empty() || !ids.insert(id.clone()) {
                return Err(BridgeFailure::new(
                    "INVALID_MENU_ITEM",
                    "Menu action IDs and labels must be non-empty and IDs unique.",
                ));
            }
            menu.push(MenuItem::Action {
                id,
                label,
                disabled: item.disabled.unwrap_or(false),
            });
        }
    }
    if ids.is_empty() {
        return Err(BridgeFailure::new(
            "INVALID_MENU_ITEM",
            "A menu must contain at least one actionable item.",
        ));
    }
    Ok(menu)
}

#[derive(Clone, Debug, PartialEq, gpui::Action)]
#[action(namespace = retend, no_json)]
struct MenuSelection {
    id: String,
}

pub(crate) fn show(
    items: Vec<MenuItem>,
    x: f32,
    y: f32,
    window: &mut Window,
    cx: &mut App,
    responder: QueryResponder<Option<String>>,
) {
    let mut menu = NativeMenu::new();
    for item in items {
        menu = match item {
            MenuItem::Action {
                id,
                label,
                disabled,
            } => menu.menu_with_disabled(label, disabled, Box::new(MenuSelection { id })),
            MenuItem::Separator => menu.separator(),
        };
    }
    #[cfg(target_os = "macos")]
    crate::macos_text_services::disable(window);

    present(menu, point(px(x), px(y)), window, cx, move |result, _| {
        responder.respond(result.map(|action| {
            action.and_then(|action| {
                action
                    .as_any()
                    .downcast_ref::<MenuSelection>()
                    .map(|pick| pick.id.clone())
            })
        }));
    });
}

pub(crate) fn present(
    menu: NativeMenu,
    position: Point<Pixels>,
    window: &mut Window,
    cx: &mut App,
    on_selected: impl FnOnce(Result<Option<Box<dyn Action>>, BridgeFailure>, &mut App) + 'static,
) {
    // Unit tests cannot safely enter a blocking AppKit menu loop.
    #[cfg(all(test, target_os = "macos"))]
    {
        let _ = (menu, position, window);
        on_selected(Ok(None), cx);
    }

    #[cfg(all(target_os = "macos", not(test)))]
    {
        let handle = Window::window_handle(window);
        cx.spawn(async move |cx| {
            let view = cx
                .update(|cx| {
                    handle.update(cx, |_, window, _| {
                        crate::macos_text_services::view_ptr(window)
                    })
                })
                .ok()
                .flatten();
            let result = view
                .map(|view| unsafe {
                    crate::macos_text_services::show_context_menu(view, position, menu)
                })
                .ok_or_else(BridgeFailure::closed_window);
            cx.update(|cx| on_selected(result, cx));
        })
        .detach();
    }

    #[cfg(target_os = "windows")]
    {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};
        let Ok(native) = HasWindowHandle::window_handle(window) else {
            on_selected(Err(BridgeFailure::closed_window()), cx);
            return;
        };
        let RawWindowHandle::Win32(native) = native.as_raw() else {
            on_selected(Err(BridgeFailure::closed_window()), cx);
            return;
        };
        let hwnd = native.hwnd.get();
        let scale = window.scale_factor();
        let x = (f32::from(position.x) * scale).round() as i32;
        let y = (f32::from(position.y) * scale).round() as i32;
        let handle = Window::window_handle(window);
        cx.spawn(async move |cx| {
            let result = if cx.update(|cx| handle.update(cx, |_, _, _| ())).is_ok() {
                Ok(unsafe { crate::windows_text_menu::popup(hwnd, x, y, menu) })
            } else {
                Err(BridgeFailure::closed_window())
            };
            cx.update(|cx| on_selected(result, cx));
        })
        .detach();
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (menu, position, window);
        on_selected(
            Err(BridgeFailure::new(
                "UNSUPPORTED_PLATFORM",
                "Native popup menus are only supported on macOS and Windows.",
            )),
            cx,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::NativePopupMenuItem;

    fn action(id: &str) -> NativePopupMenuItem {
        NativePopupMenuItem {
            id: Some(id.into()),
            label: Some(id.into()),
            separator: None,
            disabled: None,
        }
    }

    #[test]
    fn parses_actions_and_separators_into_a_discriminated_model() {
        let parsed = validate_items(vec![
            action("open"),
            NativePopupMenuItem {
                id: None,
                label: None,
                separator: Some(true),
                disabled: None,
            },
            NativePopupMenuItem {
                disabled: Some(true),
                ..action("remove")
            },
        ])
        .unwrap();
        assert!(matches!(&parsed[0], MenuItem::Action { id, disabled: false, .. } if id == "open"));
        assert!(matches!(parsed[1], MenuItem::Separator));
        assert!(
            matches!(&parsed[2], MenuItem::Action { id, disabled: true, .. } if id == "remove")
        );
    }

    #[test]
    fn rejects_invalid_payloads_at_the_native_boundary() {
        let invalid = [
            vec![action("open"), action("open")],
            vec![NativePopupMenuItem {
                id: None,
                ..action("open")
            }],
            vec![NativePopupMenuItem {
                label: Some(String::new()),
                ..action("open")
            }],
            vec![NativePopupMenuItem {
                id: Some("wrong".into()),
                label: None,
                separator: Some(true),
                disabled: None,
            }],
            vec![NativePopupMenuItem {
                id: None,
                label: None,
                separator: Some(true),
                disabled: None,
            }],
        ];
        for items in invalid {
            assert!(validate_items(items).is_err());
        }
    }
}
