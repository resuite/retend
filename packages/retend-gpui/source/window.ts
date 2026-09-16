import { Cell, createScope, useScopeContext, type SourceCell } from 'retend';

import type { GpuiHost } from './gpui-host.js';
import type { RetendGpuiRenderer } from './gpui-renderer.js';

/** Options currently implemented by the Retend-owned native window bridge. */
export interface GpuiWindowOptions {
  /** Initial native window width in logical pixels. */
  width?: number;
  /** Initial native window height in logical pixels. */
  height?: number;
  /** Native window title. */
  title?: string;
  /** Whether the user can resize the native window. Defaults to `true`. */
  resizable?: boolean;
  /** Opens the native window in fullscreen mode. */
  fullscreen?: boolean;
  /** Opens the native window maximized. Mutually exclusive with `fullscreen`. */
  maximized?: boolean;
  /** Minimum native content width in logical pixels. */
  minWidth?: number;
  /** Minimum native content height in logical pixels. */
  minHeight?: number;
  /** Maximum native content width in logical pixels. */
  maxWidth?: number;
  /** Maximum native content height in logical pixels. */
  maxHeight?: number;
  /** Initial application location. Defaults to `/`. */
  location?: string;
  /** Whether this window closes automatically with the window that opened it. */
  closeWithOpener?: boolean;
}

/** @internal Validates the shared lower-level/native window option contract. */
export function validateGpuiWindowOptions(options: GpuiWindowOptions): void {
  for (const name of [
    'width',
    'height',
    'minWidth',
    'minHeight',
    'maxWidth',
    'maxHeight',
  ] as const) {
    const value = options[name];
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
      throw new TypeError(
        `Native window ${name} must be a finite positive number.`
      );
    }
  }

  for (const [name, minimum, maximum] of [
    ['Width', options.minWidth, options.maxWidth],
    ['Height', options.minHeight, options.maxHeight],
  ] as const) {
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
      throw new RangeError(
        `Native window min${name} cannot exceed max${name}.`
      );
    }
  }
  if (options.fullscreen && options.maximized) {
    throw new TypeError(
      'Native window fullscreen and maximized cannot both be true.'
    );
  }
}

/** Lifecycle-only handle returned from {@link GpuiWindow.open}. */
export interface GpuiWindowHandle extends EventTarget {
  /** Requests that this native window close. */
  close(): void;
}

/** The native window associated with the current Retend root. */
export interface GpuiWindow extends EventTarget {
  /** Current native content width, updated from native resize events. */
  readonly width: Cell<number>;
  /** Current native content height, updated from native resize events. */
  readonly height: Cell<number>;
  /** Current native title. Setting the cell updates the OS window title. */
  readonly title: SourceCell<string>;
  /**
   * Native host for this window. Exposes window-local `location` and `history`
   * and window lifecycle events, which the router binds to during setup.
   */
  readonly host: GpuiHost;
  /** Opens another independent Retend root/window. */
  open(options?: GpuiWindowOptions): Promise<GpuiWindowHandle>;
  /** Requests that this native window close. */
  close(): void;
}

/** @internal Operations bound to one active runtime window. */
interface WindowRuntime {
  close(window: RuntimeGpuiWindow): void;
  open(options: GpuiWindowOptions): Promise<GpuiWindowHandle>;
}

/** @internal Window implementation owned by the application runtime. */
export class RuntimeGpuiWindow extends EventTarget implements GpuiWindow {
  readonly width: SourceCell<number>;
  readonly height: SourceCell<number>;
  readonly title: SourceCell<string>;
  /** @internal Renderer and native host owned by this runtime window. */
  readonly renderer: RetendGpuiRenderer;
  /** @internal Lifecycle-only view returned to window openers. */
  readonly handle: GpuiWindowHandle;
  get host(): GpuiHost {
    return this.renderer.host;
  }
  readonly #runtime: WindowRuntime;
  readonly #detachTitleListener: () => void;
  readonly #openedWindows = new Set<GpuiWindowHandle>();
  #disposed = false;

  constructor(
    initialTitle: string,
    initialWidth: number,
    initialHeight: number,
    renderer: RetendGpuiRenderer,
    runtime: WindowRuntime
  ) {
    super();
    this.renderer = renderer;
    this.#runtime = runtime;
    this.width = Cell.source(initialWidth);
    this.height = Cell.source(initialHeight);
    this.title = Cell.source(initialTitle);
    this.handle = Object.assign(new EventTarget(), {
      close: () => this.close(),
    });
    this.#detachTitleListener = this.title.listen((title) =>
      renderer.host.setWindowTitle(title)
    );
    renderer.host.addEventListener('resize', (event) => {
      const { width, height } = (event as CustomEvent).detail;
      this.width.set(width);
      this.height.set(height);
    });
    renderer.host.addEventListener('focus', () =>
      this.dispatchEvent(new Event('focus'))
    );
    renderer.host.addEventListener('blur', () =>
      this.dispatchEvent(new Event('blur'))
    );
  }

  async open(options: GpuiWindowOptions = {}): Promise<GpuiWindowHandle> {
    if (this.#disposed) {
      throw new Error('Cannot open a window from a closed GPUI window.');
    }

    const owned = options.closeWithOpener ?? true;
    const handle = await this.#runtime.open(options);
    if (!owned) return handle;
    if (this.#disposed) {
      handle.close();
      throw new Error('The GPUI opener closed before its child window opened.');
    }

    this.#openedWindows.add(handle);
    handle.addEventListener('close', () => this.#openedWindows.delete(handle), {
      once: true,
    });
    return handle;
  }

  close(): void {
    this.#runtime.close(this);
  }

  /** @internal Releases window-local JavaScript subscriptions. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#detachTitleListener();
    for (const handle of this.#openedWindows) handle.close();
    this.#openedWindows.clear();
    this.handle.dispatchEvent(new Event('close'));
  }
}

/** @internal Scope provided at the root of each Vite-managed GPUI window. */
export const WindowScope = createScope<GpuiWindow>('retend-gpui:Window');

/** Returns the native window bound to the current Retend root. */
export function useWindow(): GpuiWindow {
  return useScopeContext(WindowScope);
}
