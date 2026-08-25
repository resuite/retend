import type { WindowOptions } from '@gpuix/native';

import { Cell, createScope, useScopeContext, type SourceCell } from 'retend';

/** Options shared by the initial window and windows opened at runtime. */
export interface GpuiWindowOptions extends WindowOptions {
  /** Window title shown in the OS chrome. Defaults to the application name. */
  title?: string;
  /** Initial width in logical pixels. */
  width: number;
  /** Initial height in logical pixels. */
  height: number;
  /** Initial application location. Defaults to `/`. */
  location?: string;
  /** Whether this window closes with the window that opened it. Defaults to `true`. */
  closeWithOpener?: boolean;
}

/** The native window associated with the current Retend root. */
export interface GpuiWindow {
  /** Current native width in logical pixels. */
  readonly width: Cell<number>;
  /** Current native height in logical pixels. */
  readonly height: Cell<number>;
  /** Current native title. Setting the cell updates the OS window title. */
  readonly title: SourceCell<string>;
  /** Opens another window with this window recorded as its opener. */
  open(options: GpuiWindowOptions): Promise<WindowHandle>;
  /** Requests that this native window close. */
  close(): void;
}

/** @internal Operations bound to one active runtime window. */
interface WindowRuntime {
  open(options: GpuiWindowOptions): Promise<WindowHandle>;
  close(): void;
  setTitle(title: string): void;
}

interface InitialWindowState {
  width: number;
  height: number;
  title: string;
}

/**
 * Lifecycle handle for an opened GPUI window.
 * Emits `close` after the window has ended.
 */
export class WindowHandle extends EventTarget {
  readonly #close: () => void;

  /** @internal */
  constructor(close: () => void) {
    super();
    this.#close = close;
  }

  /** Requests that the opened window close. */
  close(): void {
    this.#close();
  }
}

/** @internal Window implementation owned by the application runtime. */
interface RuntimeGpuiWindow extends GpuiWindow {
  updateSize(width: number, height: number): void;
  dispose(): void;
}

/** @internal Creates the stable public window object for one native window. */
export function createRuntimeWindow(
  initial: InitialWindowState,
  runtime: WindowRuntime
): RuntimeGpuiWindow {
  const width = Cell.source(initial.width);
  const height = Cell.source(initial.height);
  const title = Cell.source(initial.title);
  const detachTitleListener = title.listen(runtime.setTitle);

  return {
    width,
    height,
    title,
    open(options) {
      return runtime.open(options);
    },
    close() {
      runtime.close();
    },
    updateSize(nextWidth, nextHeight) {
      Cell.batch(() => {
        if (width.peek() !== nextWidth) width.set(nextWidth);
        if (height.peek() !== nextHeight) height.set(nextHeight);
      });
    },
    dispose: detachTitleListener,
  };
}

/** @internal Scope provided at the root of each Vite-managed GPUI window. */
export const WindowScope = createScope<GpuiWindow>('retend-gpui:Window');

/**
 * Returns the native window bound to the current Retend root.
 * The returned object keeps that identity when retained across asynchronous work.
 */
export function useWindow(): GpuiWindow {
  return useScopeContext(WindowScope);
}
