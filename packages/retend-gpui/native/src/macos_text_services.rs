//! AppKit text services for GPUI-rendered inputs.
//!
//! GPUIView already implements NSTextInputClient, but it is not an NSTextView.
//! Exposing a selected plain-text range through NSServicesMenuRequestor lets
//! AppKit add Writing Tools to the contextual menu without moving text rendering
//! or editing out of GPUI.

use std::{
    ffi::{c_char, CStr},
    ops::Range,
};

use cocoa::{
    base::{id, nil, BOOL, NO, YES},
    foundation::{NSPoint, NSRect, NSString},
};
use gpui::{Action, App, Pixels, Point, WeakEntity, Window};
use gpui_base::input::{InputBaseState, InputModeKind, NativeMenu, NativeMenuItem};
use objc::{
    class,
    declare::ClassDecl,
    msg_send,
    runtime::{Class, Object, Sel},
    sel, sel_impl,
};
use raw_window_handle::{HasWindowHandle, RawWindowHandle};

pub(crate) struct MenuRequest<M: InputModeKind + 'static> {
    pub editor: WeakEntity<InputBaseState<M>>,
    pub original: String,
    pub range: Range<usize>,
    pub editable: bool,
    pub services_enabled: bool,
}

fn view_ptr(window: &Window) -> Option<usize> {
    let handle = HasWindowHandle::window_handle(window).ok()?;
    let RawWindowHandle::AppKit(handle) = handle.as_raw() else {
        return None;
    };
    Some(handle.ns_view.as_ptr() as usize)
}

pub(crate) fn disable(window: &Window) {
    if let Some(view) = view_ptr(window) {
        // SAFETY: GPUI supplies the live GPUIView on its UI thread.
        unsafe { gpui_macos::configure_text_services(view as *mut _, false, false) };
    }
}

#[cfg(test)]
thread_local! {
    static TEST_CONTEXT_MENUS: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
}

#[cfg(test)]
pub(crate) fn take_test_context_menus() -> usize {
    TEST_CONTEXT_MENUS.with(|count| count.replace(0))
}

#[cfg(test)]
fn record_test_context_menu() -> bool {
    TEST_CONTEXT_MENUS.with(|count| count.set(count.get() + 1));
    true
}

pub(crate) fn show<M: InputModeKind + 'static>(
    request: MenuRequest<M>,
    menu: NativeMenu,
    position: Point<Pixels>,
    window: &mut Window,
    cx: &mut App,
) {
    // Tests exercise the real right-click callback and deferred entity access,
    // but must never run AppKit's blocking modal menu loop.
    #[cfg(test)]
    if record_test_context_menu() {
        return;
    }

    let MenuRequest {
        original,
        range,
        editable,
        services_enabled,
        editor,
    } = request;
    let Some(view) = view_ptr(window) else { return };
    // GPUIView reads live selection data from its existing GPUI text handler.
    unsafe {
        gpui_macos::configure_text_services(view as *mut _, services_enabled, editable);
    }

    let corrections = if editable && services_enabled {
        spelling_suggestions(&original, &range)
    } else {
        Vec::new()
    };
    let mut native_menu = NativeMenu::new();
    for (suggestion, word_range) in corrections {
        native_menu = native_menu.menu(
            suggestion.clone(),
            Box::new(SpellingCorrection {
                word: suggestion,
                range: word_range,
            }),
        );
    }
    if !native_menu.items.is_empty() {
        native_menu = native_menu.separator();
    }
    native_menu.items.extend(menu.items);

    let handle = Window::window_handle(window);
    cx.spawn(async move |cx| {
        let selected = unsafe { show_context_menu(view, position, native_menu) };
        cx.update(|app| {
            let _ = handle.update(app, |_, window, app| {
                if let Some(action) = selected {
                    if let Some(correction) = action.as_any().downcast_ref::<SpellingCorrection>() {
                        if let Some(entity) = editor.upgrade() {
                            // Do not overwrite edits made after this menu was opened.
                            if entity.read(app).value().as_ref() == original {
                                entity.update(app, |editor, cx| {
                                    editor.set_selected_range(correction.range.clone(), cx);
                                    editor.replace(correction.word.clone(), window, cx);
                                });
                            }
                        }
                    } else {
                        window.dispatch_action(action, app);
                    }
                }
                window.refresh();
            });
        });
    })
    .detach();
}

#[repr(C)]
#[derive(Copy, Clone)]
struct NativeRange {
    location: usize,
    length: usize,
}

unsafe impl objc::Encode for NativeRange {
    fn encode() -> objc::Encoding {
        unsafe { objc::Encoding::from_str("{NSRange=QQ}") }
    }
}

#[derive(Clone, Debug, PartialEq, gpui::Action)]
#[action(namespace = retend, no_json)]
struct SpellingCorrection {
    word: String,
    range: Range<usize>,
}

fn utf16_to_byte(text: &str, offset: usize) -> usize {
    let mut count = 0;
    for (byte, ch) in text.char_indices() {
        if count >= offset {
            return byte;
        }
        count += ch.len_utf16();
    }
    text.len()
}

fn spelling_suggestions(text: &str, selection: &Range<usize>) -> Vec<(String, Range<usize>)> {
    if selection.start > text.len() || !text.is_char_boundary(selection.start) {
        return Vec::new();
    }
    let caret = text[..selection.start].encode_utf16().count();
    let selection_end = text.get(..selection.end).map(|s| s.encode_utf16().count());
    let Some(selection_end) = selection_end else {
        return Vec::new();
    };
    unsafe {
        let string = NSString::alloc(nil).init_str(text);
        let checker: id = msg_send![class!(NSSpellChecker), sharedSpellChecker];
        let mut count = 0isize;
        let mut index = 0usize;
        let mut found = None;
        while index <= caret {
            let range: NativeRange = msg_send![
                checker,
                checkSpellingOfString: string
                startingAt: index
                language: nil
                wrap: NO
                inSpellDocumentWithTag: 0isize
                wordCount: &mut count
            ];
            if range.location == isize::MAX as usize || range.length == 0 {
                break;
            }
            let end = range.location.saturating_add(range.length);
            if range.location <= caret
                && caret <= end
                && (caret == selection_end || (caret == range.location && selection_end == end))
            {
                found = Some(range);
                break;
            }
            if end <= index || end > caret {
                break;
            }
            index = end;
        }
        let suggestions: id = found.map_or(nil, |range| {
            msg_send![
                checker,
                guessesForWordRange: range
                inString: string
                language: nil
                inSpellDocumentWithTag: 0isize
            ]
        });
        let mut results = Vec::new();
        if !suggestions.is_null() {
            let range = found.expect("suggestions require a misspelled range");
            let bytes = utf16_to_byte(text, range.location)
                ..utf16_to_byte(text, range.location + range.length);
            let count: usize = msg_send![suggestions, count];
            for index in 0..count.min(5) {
                let suggestion: id = msg_send![suggestions, objectAtIndex: index];
                let string: *const c_char = msg_send![suggestion, UTF8String];
                if !string.is_null() {
                    if let Ok(text) = CStr::from_ptr(string).to_str() {
                        results.push((text.to_owned(), bytes.clone()));
                    }
                }
            }
        }
        let _: () = msg_send![string, release];
        results
    }
}

extern "C" fn menu_clicked(this: &mut Object, _: Sel, sender: id) {
    let tag: isize = unsafe { msg_send![sender, tag] };
    unsafe { this.set_ivar("selectedTag", tag) };
}

fn menu_target_class() -> &'static Class {
    static TARGET: std::sync::OnceLock<usize> = std::sync::OnceLock::new();
    let pointer = *TARGET.get_or_init(|| {
        let mut cls = ClassDecl::new("RetendTextContextMenuTarget", class!(NSObject))
            .expect("native text-menu target must register once");
        cls.add_ivar::<isize>("selectedTag");
        unsafe {
            cls.add_method(
                sel!(selectTextMenuItem:),
                menu_clicked as extern "C" fn(&mut Object, Sel, id),
            );
        }
        cls.register() as *const Class as usize
    });
    unsafe { &*(pointer as *const Class) }
}

// The menu runs outside GPUI's App borrow; AppKit can synchronously ask the
// first responder for its selected text and later deliver replacements.
unsafe fn show_context_menu(
    view: usize,
    position: Point<Pixels>,
    menu: NativeMenu,
) -> Option<Box<dyn Action>> {
    unsafe {
        let view = view as id;
        let target: id = msg_send![menu_target_class(), new];
        (*target).set_ivar("selectedTag", -1isize);
        let native_menu: id = msg_send![class!(NSMenu), new];
        let _: () = msg_send![native_menu, setAutoenablesItems: NO];
        let mut actions = Vec::new();
        for entry in menu.items {
            match entry {
                NativeMenuItem::Separator => {
                    let separator: id = msg_send![class!(NSMenuItem), separatorItem];
                    let _: () = msg_send![native_menu, addItem: separator];
                }
                NativeMenuItem::Action {
                    label,
                    disabled,
                    action,
                } => {
                    let title = NSString::alloc(nil).init_str(&label);
                    let key = NSString::alloc(nil).init_str("");
                    let item: id = msg_send![class!(NSMenuItem), alloc];
                    let item: id = msg_send![item, initWithTitle: title
                        action: sel!(selectTextMenuItem:) keyEquivalent: key];
                    let _: () = msg_send![item, setTarget: target];
                    let _: () = msg_send![item, setTag: actions.len() as isize];
                    let _: () = msg_send![item, setEnabled: if disabled { NO } else { YES }];
                    let _: () = msg_send![native_menu, addItem: item];
                    let _: () = msg_send![item, release];
                    let _: () = msg_send![title, release];
                    let _: () = msg_send![key, release];
                    actions.push(action);
                }
            }
        }
        // AppKit augments a view's contextual menu based on
        // validRequestorForSendType:returnType: (e.g. Writing Tools).
        let previous: id = msg_send![view, menu];
        if !previous.is_null() {
            let _: () = msg_send![previous, retain];
        }
        let _: () = msg_send![view, setMenu: native_menu];
        let app: id = msg_send![class!(NSApplication), sharedApplication];
        let event: id = msg_send![app, currentEvent];
        // The menu runs after GPUI's input event has unwound. AppKit's
        // currentEvent may be unrelated to the click by this point.
        let right_click_event = if event.is_null() {
            false
        } else {
            let event_type: usize = msg_send![event, type];
            matches!(event_type, 3 | 4) // NSRightMouseDown / NSRightMouseUp
        };
        if right_click_event {
            let _: () = msg_send![class!(NSMenu), popUpContextMenu: native_menu
                withEvent: event forView: view];
        } else {
            // Use the actual GPUI click coordinates if AppKit has no matching event.
            let bounds: NSRect = msg_send![view, bounds];
            let location = NSPoint::new(
                f32::from(position.x) as f64,
                bounds.size.height - f32::from(position.y) as f64,
            );
            let _: BOOL = msg_send![native_menu, popUpMenuPositioningItem: nil
                atLocation: location inView: view];
        }
        let _: () = msg_send![view, setMenu: previous];
        if !previous.is_null() {
            let _: () = msg_send![previous, release];
        }
        let chosen: isize = *(*target).get_ivar("selectedTag");
        let _: () = msg_send![target, release];
        let _: () = msg_send![native_menu, release];
        (chosen >= 0).then(|| actions.swap_remove(chosen as usize))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spelling_ranges_convert_utf16_offsets_without_splitting_unicode() {
        let text = "café don't🚀";
        assert_eq!(utf16_to_byte(text, 4), 5);
        assert_eq!(utf16_to_byte(text, 5), 6);
        assert_eq!(utf16_to_byte(text, 10), 11);
        assert_eq!(utf16_to_byte(text, 12), text.len());
    }
}
