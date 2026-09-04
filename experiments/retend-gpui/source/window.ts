import { Cell, createScope, useScopeContext, type SourceCell } from 'retend';

/** Options currently implemented by the Retend-owned native window bridge. */
export interface GpuiWindowOptions {
  /** Initial native window width in logical pixels. */
  width?: number;
  /** Initial native window height in logical pixels. */
  height?: number;
  /** Native window title. */
  title?: string;
  /** Initial application location. Defaults to `/`. */
  location?: string;
}

/** The native window associated with the current Retend root. */
export interface GpuiWindow {
  /** Current native title. Setting the cell updates the OS window title. */
  readonly title: SourceCell<string>;
  /** Requests that this native window close. */
  close(): void;
}

/** @internal Operations bound to one active runtime window. */
interface WindowRuntime {
  close(): void;
  setTitle(title: string): void;
}

/** @internal Window implementation owned by the application runtime. */
interface RuntimeGpuiWindow extends GpuiWindow {
  dispose(): void;
}

/** @internal Creates the stable public window object for one native window. */
export function createRuntimeWindow(
  initialTitle: string,
  runtime: WindowRuntime
): RuntimeGpuiWindow {
  const title = Cell.source(initialTitle);
  const detachTitleListener = title.listen(runtime.setTitle);

  return {
    title,
    close() {
      runtime.close();
    },
    dispose: detachTitleListener,
  };
}

/** @internal Scope provided at the root of each Vite-managed GPUI window. */
export const WindowScope = createScope<GpuiWindow>('retend-gpui:Window');

/** Returns the native window bound to the current Retend root. */
export function useWindow(): GpuiWindow {
  return useScopeContext(WindowScope);
}
