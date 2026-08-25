import {
  GpuixRenderer,
  type EventPayload,
  type TestGpuixRenderer,
  type WindowOptions,
  type WindowSize,
} from '@gpuix/native';

type MutationValue = boolean | number | string | object | null;
type MutationTuple = [string, ...MutationValue[]];
type NativeRenderer = (GpuixRenderer | TestGpuixRenderer) &
  Partial<Pick<GpuixRenderer, 'getWindowSize' | 'setWindowTitle'>>;

interface GpuiHostCallbacks {
  onEvent?: (event: EventPayload) => void;
  onWindowSize?: (size: WindowSize) => void;
}

const FRAME_MS = 8;
const SIZE_POLL_MS = 100;
const LOCATION_BASE = 'retend://app/';

interface GpuiNavigationEntry {
  url: URL;
  state: unknown;
}

class GpuiNavigation {
  readonly #target: EventTarget;
  #entries: GpuiNavigationEntry[] = [
    { url: new URL('/', LOCATION_BASE), state: null },
  ];
  #index = 0;

  constructor(target: EventTarget) {
    this.#target = target;
  }

  get #current(): GpuiNavigationEntry {
    return this.#entries[this.#index];
  }

  get pathname(): string {
    return this.#current.url.pathname;
  }

  get search(): string {
    return this.#current.url.search;
  }

  get hash(): string {
    return this.#current.url.hash;
  }

  get href(): string {
    return `${this.pathname}${this.search}${this.hash}`;
  }

  get length(): number {
    return this.#entries.length;
  }

  get state(): unknown {
    return this.#current.state;
  }

  reset(path: string): void {
    this.#entries = [{ url: this.#resolve(path), state: null }];
    this.#index = 0;
  }

  pushState(state: unknown, _unused: string, path?: string | URL | null): void {
    this.#entries.splice(this.#index + 1);
    this.#entries.push({ url: this.#resolve(path), state });
    this.#index = this.#entries.length - 1;
  }

  replaceState(
    state: unknown,
    _unused: string,
    path?: string | URL | null
  ): void {
    this.#entries[this.#index] = { url: this.#resolve(path), state };
  }

  go(delta = 0): void {
    const offset = Number.isFinite(delta) ? Math.trunc(delta) : 0;
    if (offset === 0) return;

    const nextIndex = this.#index + offset;
    if (nextIndex < 0 || nextIndex >= this.#entries.length) return;

    this.#index = nextIndex;
    this.#target.dispatchEvent(new Event('popstate'));
  }

  back(): void {
    this.go(-1);
  }

  forward(): void {
    this.go(1);
  }

  #resolve(path?: string | URL | null): URL {
    return path === undefined || path === null
      ? new URL(this.#current.url)
      : new URL(String(path), this.#current.url);
  }
}

/**
 * Owns mutation batching, window-local navigation, and the GPUiX event loop.
 * Acts as the `Host` for `RetendGpuiRenderer` and exposes `history`/`location`
 * compatible with the browser navigation API for use with `retend/router`.
 */
export class GpuiHost extends EventTarget {
  readonly #native: NativeRenderer;
  readonly #testing: boolean;
  readonly #callbacks: GpuiHostCallbacks;

  readonly #navigation = new GpuiNavigation(this);
  /**
   * Window-local `location` analog. Read `pathname`, `search`, `hash`, and `href`
   * to inspect the current route. Mutated via `history` methods or `resetLocation`.
   */
  readonly location = this.#navigation;
  /**
   * Window-local `history` analog with `pushState`, `replaceState`, `go`, `back`, and `forward`.
   * Navigations dispatch `popstate` on the host.
   */
  readonly history = this.#navigation;
  /** Minimal `document` shim exposing `title`. */
  readonly document = { title: '' };

  #queue: MutationTuple[] = [];
  #flushScheduled = false;
  #flushing = false;
  #frameTimer: ReturnType<typeof setTimeout> | null = null;
  #sizeTimer: ReturnType<typeof setInterval> | null = null;
  #lastWindowSize: WindowSize | null = null;

  /**
   * Creates a host backed by either a real GPUiX renderer or a test double.
   *
   * @param callbacks - Optional handler for native events forwarded to the renderer.
   * @param testNative - Test double that replaces the native `GpuixRenderer` in unit tests.
   */
  constructor(
    callbacks: GpuiHostCallbacks = {},
    testNative?: TestGpuixRenderer
  ) {
    super();
    this.#callbacks = callbacks;
    this.#testing = Boolean(testNative);
    this.#native =
      testNative ??
      new GpuixRenderer((error, event) => {
        if (error) {
          console.error('[retend-gpui] native event error:', error);
          return;
        }
        if (event) callbacks.onEvent?.(event);
      });
  }

  /** Whether the underlying native renderer has been initialized. */
  get isInitialized(): boolean {
    return this.#testing || (this.#native as GpuixRenderer).isInitialized();
  }

  /**
   * Initializes the native renderer and syncs the document title.
   *
   * @param options - Native `WindowOptions` forwarded to `GpuixRenderer.init`.
   */
  init(options?: WindowOptions): void {
    this.document.title = options?.title ?? '';
    if (!this.#testing) (this.#native as GpuixRenderer).init(options);
    this.#reportWindowSize();
  }

  /** Updates the native window title and the window-like document shim. */
  setWindowTitle(title: string): void {
    this.document.title = title;
    this.#native.setWindowTitle?.(title);
  }

  /**
   * Resets the in-memory navigation stack to a single entry at `path`.
   *
   * @param path - Absolute or relative path (e.g. `"/settings?tab=general"`).
   */
  resetLocation(path: string): void {
    this.history.reset(path);
  }

  /**
   * Enqueues a low-level GPUiX mutation. Mutations are batched and flushed
   * automatically on the next microtask or frame tick.
   *
   * @param name - Native method name (e.g. `"createElement"`, `"setStyle"`).
   * @param values - Arguments for the native method.
   */
  mutate(name: string, ...values: MutationValue[]): void {
    this.#queue.push([name, ...values]);
    this.requestFlush();
  }

  /**
   * Schedules a flush of the mutation queue if one is not already pending.
   * Coalesces multiple mutations into a single `applyBatch` call.
   */
  requestFlush(): void {
    if (this.#flushScheduled || this.#flushing) return;
    this.#flushScheduled = true;
    queueMicrotask(() => {
      this.#flushScheduled = false;
      this.flush();
    });
  }

  /**
   * Synchronously drains the mutation queue via `applyBatch`.
   * Re-schedules itself if new mutations were enqueued during the flush.
   */
  flush(): void {
    if (this.#flushing || this.#queue.length === 0) return;
    this.#flushing = true;
    const operations = this.#queue;
    this.#queue = [];
    try {
      this.#native.applyBatch(JSON.stringify(operations));
    } finally {
      this.#flushing = false;
      if (this.#queue.length > 0) this.requestFlush();
    }
  }

  /**
   * Starts the frame loop that drives `GpuixRenderer.tick` at ~120 Hz.
   * No-ops in test mode or when the native renderer does not require ticking.
   * Emits `close` on the host when `tick()` returns false.
   */
  startFrameLoop(): void {
    this.#reportWindowSize();
    if (this.#sizeTimer === null && this.#callbacks.onWindowSize) {
      this.#sizeTimer = setInterval(
        () => this.#reportWindowSize(),
        SIZE_POLL_MS
      );
      this.#sizeTimer.unref();
    }
    if (this.#testing) return;
    const native = this.#native as GpuixRenderer;
    if (!native.requiresTick() || this.#frameTimer !== null) return;

    const loop = () => {
      const started = performance.now();
      this.flush();
      if (!native.tick()) {
        this.#frameTimer = null;
        this.dispatchEvent(new Event('close'));
        return;
      }
      this.#frameTimer = setTimeout(
        loop,
        Math.max(0, FRAME_MS - (performance.now() - started))
      );
    };

    this.#frameTimer = setTimeout(loop, 0);
  }

  /** Stops the frame loop started by `startFrameLoop`. */
  stopFrameLoop(): void {
    if (this.#frameTimer !== null) clearTimeout(this.#frameTimer);
    this.#frameTimer = null;
    if (this.#sizeTimer !== null) clearInterval(this.#sizeTimer);
    this.#sizeTimer = null;
  }

  #reportWindowSize(): void {
    if (!this.#callbacks.onWindowSize || !this.isInitialized) return;
    const size = this.#native.getWindowSize?.();
    if (!size) return;
    const previous = this.#lastWindowSize;
    if (previous?.width === size.width && previous?.height === size.height) {
      return;
    }
    this.#lastWindowSize = size;
    this.#callbacks.onWindowSize(size);
  }
}
