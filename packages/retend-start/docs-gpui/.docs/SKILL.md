# Retend GPUI

This is a native desktop application built with Retend and GPUI. Use `retend` for Cells, lifecycle, scopes, and routing, and `retend-gpui` for native windows, JSX elements, styling, and events. Read the local GPUI reference pages before editing UI code.

- [Elements and text](elements.md)
- [Styles and pseudo-states](styling.md)
- [Application, windows, and native integration](windows.md)
- [Events and controls](events.md)

Do not use DOM nodes, CSS classes, `document`, browser refs, or React hooks. GPUI components return Retend JSX. `style` is an object, and text is ordinary JSX content. Import the Retend JSX types from `retend-gpui/jsx-runtime` in `tsconfig.json`. The application uses Vite with the `retendGpui` plugin. Keep state in Cells and let Retend bind them reactively.

Full API reference: https://retend.dev/docs/gpui
