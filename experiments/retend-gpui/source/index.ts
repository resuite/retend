/**
 * Main entry point for `retend-gpui`.
 *
 * Re-exports the public renderer, host, window, and type APIs.
 * Import from `"retend-gpui"` for application code.
 *
 * @example
 * ```tsx
 * import { renderToGpui, useWindow } from "retend-gpui";
 * import type { GpuiStyle } from "retend-gpui";
 * ```
 */
export { GpuiEvent, GpuiKeyboardEvent, GpuiMouseEvent } from './events.js';
export * from './gpui-host.js';
export * from './gpui-renderer.js';
export { useAppContext } from './application.js';
export type {
  GpuiAppContext,
  GpuiAppContextTypes,
  GpuiApplication,
} from './application.js';
export * from './types.js';
export { useWindow } from './window.js';
export type { GpuiWindow, GpuiWindowOptions } from './window.js';
