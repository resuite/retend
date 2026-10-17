# Application and windows

The scaffold uses `retendGpui` in `vite.config.ts` with application identity, `application` class, `entry`, and initial `window` options. Run `pnpm dev` for a native development window and `pnpm build` for packaging. Components use `useWindow()` for per-window size, title, initial route and opening child windows, and `useSystem()` for reactive OS theme and accent color.

Window creation options include title, dimensions, resizability, fullscreen/maximized mode, min/max sizes, and initial route. The plugin's process-wide `system` options include `transparentTitlebar` and macOS-only `trafficLightPosition: { x, y }` (logical pixels).

The application class owns shared resources and lifecycle methods. Use `attachRouter` when integrating Retend Router with a GPUI window. Native APIs are not web APIs.

API: https://retend.dev/docs/gpui-windows and https://retend.dev/docs/gpui-packaging
