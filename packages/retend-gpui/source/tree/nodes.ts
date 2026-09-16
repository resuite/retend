import type { GpuiHost } from '../gpui-host.js';
import type { RetendGpuiRenderer } from '../gpui-renderer.js';
import type {
  GpuiMeasurement,
  GpuiScrollOffset,
  GpuiSelection,
  GpuiStyle,
} from '../types.js';

import { nativeEventMetadataByType } from '../events.js';

interface ListenerRecord {
  readonly callback: EventListenerOrEventListenerObject;
  readonly capture: boolean;
  readonly once: boolean;
  readonly passive: boolean;
  readonly signal?: AbortSignal;
  abortHandler?: () => void;
}

interface DispatchState {
  target: GpuiNode;
  currentTarget: GpuiNode | null;
  path: GpuiNode[];
  phase: number;
  stopped: boolean;
  immediateStopped: boolean;
  passive: boolean;
}

function captureOption(
  options?: boolean | AddEventListenerOptions | EventListenerOptions
): boolean {
  return typeof options === 'boolean' ? options : (options?.capture ?? false);
}

function cleanupAbort(record: ListenerRecord): void {
  if (record.signal && record.abortHandler) {
    record.signal.removeEventListener('abort', record.abortHandler);
    record.abortHandler = undefined;
  }
}

/**
 * Base node in the GPUI retained tree.
 * Provides lifecycle management and keyed cleanup callbacks that are
 * automatically disposed when the node is destroyed or replaced.
 */
export abstract class GpuiNode implements EventTarget {
  /** Parent in the logical tree, or `null` if detached. */
  parent: GpuiParentNode | null = null;
  /** Abort signal that fires when the node is destroyed; use for reactive subscriptions. */
  readonly lifecycle = new AbortController();
  #host?: GpuiHost;
  #renderer?: RetendGpuiRenderer;
  #destroyed = false;
  #cleanup = new Map<unknown, () => void>();
  #listeners = new Map<string, Set<ListenerRecord>>();

  constructor(host?: GpuiHost, renderer?: RetendGpuiRenderer) {
    this.#host = host;
    this.#renderer = renderer;
  }

  /** Native host shared by related logical nodes. */
  get host(): GpuiHost | undefined {
    return this.#host;
  }

  /** Renderer responsible for logical tree changes and subscriptions. */
  get renderer(): RetendGpuiRenderer | undefined {
    return this.#renderer;
  }

  /** Whether `markDestroyed` has been called. */
  get destroyed(): boolean {
    return this.#destroyed;
  }

  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (!callback || this.#destroyed) return;
    const signal = typeof options === 'object' ? options.signal : undefined;
    if (signal?.aborted) return;

    const capture = captureOption(options);
    let records = this.#listeners.get(type);
    if (!records) this.#listeners.set(type, (records = new Set()));
    for (const record of records) {
      if (record.callback === callback && record.capture === capture) return;
    }

    const first = records.size === 0;
    const record: ListenerRecord = {
      callback,
      capture,
      once: typeof options === 'object' ? (options.once ?? false) : false,
      passive: typeof options === 'object' ? (options.passive ?? false) : false,
      signal,
    };
    records.add(record);
    if (signal) {
      record.abortHandler = () =>
        this.removeEventListener(type, callback, { capture });
      signal.addEventListener('abort', record.abortHandler, { once: true });
    }
    if (first) this.#syncNativeSubscription(type, true);
  }

  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void {
    if (!callback) return;
    const records = this.#listeners.get(type);
    if (!records) return;

    const capture = captureOption(options);
    for (const record of records) {
      if (record.callback === callback && record.capture === capture) {
        this.#removeRecord(type, record);
        return;
      }
    }
  }

  dispatchEvent(event: Event): boolean {
    if (this.#destroyed) return !event.defaultPrevented;
    if (event.eventPhase !== Event.NONE) {
      throw new DOMException(
        'The event is already being dispatched.',
        'InvalidStateError'
      );
    }

    const path: GpuiNode[] = [this];
    for (let current = this.parent; current; current = current.parent)
      path.push(current);
    const state: DispatchState = {
      target: this,
      currentTarget: null,
      path,
      phase: Event.NONE,
      stopped: false,
      immediateStopped: false,
      passive: false,
    };
    const restoreEvent = this.#patchEvent(event, state);

    try {
      const metadata = nativeEventMetadataByType(event.type);
      if (metadata?.captures ?? true) {
        for (let index = path.length - 1; index > 0; index -= 1) {
          path[index].#invokeNode(event, state, Event.CAPTURING_PHASE, true);
          if (state.stopped) break;
        }
      }

      if (!state.stopped) this.#invokeNode(event, state, Event.AT_TARGET);

      const bubbles = metadata?.bubbles ?? event.bubbles;
      if (bubbles && !state.stopped) {
        for (let index = 1; index < path.length; index += 1) {
          path[index].#invokeNode(event, state, Event.BUBBLING_PHASE, false);
          if (state.stopped) break;
        }
      }
    } finally {
      state.currentTarget = null;
      state.phase = Event.NONE;
      restoreEvent();
    }

    return !event.defaultPrevented;
  }

  /**
   * Registers a cleanup callback under `key`. If a previous cleanup exists for the same key
   * it is executed immediately. If the node is already destroyed the callback runs synchronously.
   *
   * @param key - Stable key identifying the cleanup (e.g. `"ref"`, `"style"`).
   * @param cleanup - Function to run on replacement or destruction.
   */
  setCleanup(key: unknown, cleanup: () => void): void {
    if (this.#destroyed) {
      this.#runCleanup(cleanup);
      return;
    }

    this.clearCleanup(key);
    this.#cleanup.set(key, cleanup);
  }

  /** Runs and removes the cleanup registered under `key`, if any. */
  clearCleanup(key: unknown): void {
    const cleanup = this.#cleanup.get(key);
    if (!cleanup) return;
    this.#cleanup.delete(key);
    this.#runCleanup(cleanup);
  }

  /**
   * Marks the node as destroyed, aborts the lifecycle signal, and runs all cleanups.
   * Safe to call multiple times; subsequent calls are no-ops.
   */
  markDestroyed(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.lifecycle.abort();
    for (const records of this.#listeners.values()) {
      for (const record of records) {
        cleanupAbort(record);
      }
    }
    this.#listeners.clear();
    this.#host = undefined;
    this.#renderer = undefined;
    for (const cleanup of this.#cleanup.values()) this.#runCleanup(cleanup);
    this.#cleanup.clear();
  }

  #syncNativeSubscription(type: string, enabled: boolean): void {
    const metadata = nativeEventMetadataByType(type);
    if (metadata)
      this.#renderer?.nativeSubscriptionChanged(this, metadata.id, enabled);
  }

  #removeRecord(type: string, record: ListenerRecord): void {
    const records = this.#listeners.get(type);
    if (!records?.delete(record)) return;
    cleanupAbort(record);
    if (records.size === 0) {
      this.#listeners.delete(type);
      this.#syncNativeSubscription(type, false);
    }
  }

  #invokeListener(
    type: string,
    record: ListenerRecord,
    event: Event,
    state: DispatchState
  ): void {
    if (!this.#listeners.get(type)?.has(record)) return;
    if (record.once) this.#removeRecord(type, record);
    state.passive = record.passive;
    try {
      if (typeof record.callback === 'function')
        record.callback.call(this, event);
      else record.callback.handleEvent(event);
    } catch (error) {
      if (this.#renderer) this.#renderer.reportListenerError(error);
      else console.error('[retend-gpui] event listener failed:', error);
    } finally {
      state.passive = false;
    }
  }

  #invokeNode(
    event: Event,
    state: DispatchState,
    phase: number,
    capture?: boolean
  ): void {
    state.currentTarget = this;
    state.phase = phase;
    state.immediateStopped = false;
    const snapshot = [...(this.#listeners.get(event.type) ?? [])];
    for (const currentCapture of capture === undefined
      ? [true, false]
      : [capture]) {
      for (const record of snapshot) {
        if (record.capture !== currentCapture) continue;
        this.#invokeListener(event.type, record, event, state);
        if (state.immediateStopped) break;
      }
      if (state.immediateStopped) break;
    }
  }

  #patchEvent(event: Event, state: DispatchState): () => void {
    const preventDefault = event.preventDefault.bind(event);

    const properties: PropertyDescriptorMap = {
      target: { get: () => state.target },
      currentTarget: { get: () => state.currentTarget },
      eventPhase: { get: () => state.phase },
      cancelBubble: {
        get: () => state.stopped,
        set: (value: boolean) => {
          if (value) state.stopped = true;
        },
      },
      composedPath: {
        value: () => [...state.path],
      },
      stopPropagation: {
        value: () => {
          state.stopped = true;
        },
      },
      stopImmediatePropagation: {
        value: () => {
          state.stopped = true;
          state.immediateStopped = true;
        },
      },
      preventDefault: {
        value: () => {
          if (!state.passive) preventDefault();
        },
      },
    };

    const descriptors = Object.entries(properties).map(([key, descriptor]) => {
      descriptor.configurable = true;
      return [key, Object.getOwnPropertyDescriptor(event, key)] as const;
    });
    Object.defineProperties(event, properties);

    return () => {
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(event, key, descriptor);
        else delete (event as unknown as Record<string, unknown>)[key];
      }
      Object.defineProperty(event, 'target', {
        configurable: true,
        value: state.target,
      });
    };
  }

  #runCleanup(cleanup: () => void): void {
    try {
      cleanup();
    } catch (error) {
      console.error('[retend-gpui] node cleanup failed:', error);
    }
  }
}

/**
 * Node that can contain children. Used as the base for elements and groups.
 */
export abstract class GpuiParentNode extends GpuiNode {
  /** Ordered logical children, including groups and anchors. */
  readonly children: GpuiNode[] = [];
}

/**
 * Host-level element backed by a retained node in the Retend-owned native bridge.
 * Created via `RetendGpuiRenderer.createContainer` for each intrinsic tag.
 */
export abstract class GpuiElement extends GpuiParentNode {
  /** Resolved author-style snapshot. */
  style: GpuiStyle = {};

  /**
   * @param id - Unique native identifier assigned by the renderer.
   * @param tagName - Intrinsic tag name (e.g. `"div"`, `"img"`).
   * @param acceptsChildren - Whether this native element can contain logical children.
   * @param host - Native host for imperative operations.
   * @param renderer - Renderer for logical tree changes and subscriptions.
   */
  constructor(
    readonly id: number,
    readonly tagName: string,
    readonly acceptsChildren = true,
    host?: GpuiHost,
    renderer?: RetendGpuiRenderer
  ) {
    super(host, renderer);
  }

  protected assertAlive(action: string): void {
    if (this.destroyed)
      throw new Error(`Cannot ${action} a destroyed Retend GPUI node.`);
  }

  protected requireHost(action: string): GpuiHost {
    this.assertAlive(action);
    const host = this.host;
    if (!host)
      throw new Error(
        `Cannot ${action} a Retend GPUI node without a native host.`
      );
    return host;
  }

  /** Requests native keyboard focus for this element. */
  focus(): void {
    this.assertAlive('focus');
    this.host?.focusNode(this.id);
  }

  /** Releases native keyboard focus when this element currently owns it. */
  blur(): void {
    this.assertAlive('blur');
    this.host?.blurNode(this.id);
  }

  /** Scrolls this element to an absolute native scroll offset. */
  scrollTo(x: number, y: number): void {
    this.assertAlive('scroll');
    this.host?.scrollToNode(this.id, x, y);
  }

  /** Scrolls this element relative to its current native scroll offset. */
  scrollBy(x: number, y: number): void {
    this.assertAlive('scroll');
    this.host?.scrollByNode(this.id, x, y);
  }

  /** Scrolls the nearest native scroll containers enough to reveal this element. */
  scrollIntoView(): void {
    this.assertAlive('scroll into view');
    this.host?.scrollIntoViewNode(this.id);
  }

  /** Reads the current authoritative native scroll offset. */
  async getScrollOffset(): Promise<GpuiScrollOffset> {
    return this.requireHost('read scroll state from').getScrollOffsetNode(
      this.id
    );
  }

  /** Reads committed native border-box and scroll-content layout. */
  async measure(): Promise<GpuiMeasurement> {
    return this.requireHost('measure').measureNode(this.id);
  }
}

/** Native `<div>` element. */
export class GpuiDivElement extends GpuiElement {
  constructor(id: number, host?: GpuiHost, renderer?: RetendGpuiRenderer) {
    super(id, 'div', true, host, renderer);
  }
}

/** Native `<anchored>` floating-layer element. */
export class GpuiAnchoredElement extends GpuiElement {
  constructor(id: number, host?: GpuiHost, renderer?: RetendGpuiRenderer) {
    super(id, 'anchored', true, host, renderer);
  }
}

/** Native `<img>` element. */
export class GpuiImageElement extends GpuiElement {
  constructor(id: number, host?: GpuiHost, renderer?: RetendGpuiRenderer) {
    super(id, 'img', false, host, renderer);
  }
}

abstract class GpuiTextControlElement extends GpuiElement {
  /** Sets the authoritative native text selection using UTF-16 offsets. */
  setSelectionRange(start: number, end: number): void {
    this.requireHost('set selection on').setSelectionRangeNode(
      this.id,
      start,
      end
    );
  }

  /** Selects all native text in this control. */
  select(): void {
    this.requireHost('select text in').selectNode(this.id);
  }

  /** Reads the authoritative native text selection. */
  async getSelection(): Promise<GpuiSelection> {
    return this.requireHost('read selection from').getSelectionNode(this.id);
  }
}

/** Native `<input>` element. */
export class GpuiInputElement extends GpuiTextControlElement {
  constructor(id: number, host?: GpuiHost, renderer?: RetendGpuiRenderer) {
    super(id, 'input', false, host, renderer);
  }
}

/** Native `<textarea>` element. */
export class GpuiTextareaElement extends GpuiTextControlElement {
  constructor(id: number, host?: GpuiHost, renderer?: RetendGpuiRenderer) {
    super(id, 'textarea', false, host, renderer);
  }
}

/** Native `<button>` element. Renders its children as the button label. */
export class GpuiButtonElement extends GpuiElement {
  constructor(id: number, host?: GpuiHost, renderer?: RetendGpuiRenderer) {
    super(id, 'button', true, host, renderer);
  }
}

/**
 * Native-backed text leaf with content and shared node lifecycle behavior.
 * Text is not an element and has no styling, layout, focus, or scrolling APIs.
 */
export class GpuiText extends GpuiNode {
  /**
   * @param id - Unique native identifier.
   * @param content - Current text content.
   * @param host - Native host for imperative operations.
   * @param renderer - Renderer for logical tree changes and subscriptions.
   */
  constructor(
    readonly id: number,
    public content: string,
    host?: GpuiHost,
    renderer?: RetendGpuiRenderer
  ) {
    super(host, renderer);
  }
}

/** Nodes backed by a retained native identifier, including text leaves. */
export type GpuiNativeNode = GpuiElement | GpuiText;

/**
 * Renderer-owned logical root bound to the immutable native window root.
 * It has no native node ID and projects its native-backed children directly
 * under the window root.
 */
export class GpuiRoot extends GpuiParentNode {}

/**
 * Logical grouping node with no native counterpart.
 * Groups are flattened when syncing to the native tree but preserve
 * logical structure for ranges and HMR boundaries.
 */
export class GpuiGroup extends GpuiParentNode {}

/**
 * Sentinel anchor node that delimits a {@link GpuiRange}.
 * Anchors are never rendered natively; they mark range boundaries inside a `GpuiGroup`.
 */
export class GpuiAnchor extends GpuiNode {}

/**
 * Stable handle to a dynamic slice of children inside a `GpuiGroup`.
 * Implemented as a pair of `GpuiAnchor` sentinels; content between them
 * can be atomically replaced via `writeRange`.
 */
export type GpuiRange = readonly [GpuiAnchor, GpuiAnchor];

export function* flattenGroups(
  nodes: readonly GpuiNode[]
): Generator<GpuiNode> {
  for (const node of nodes) {
    if (node instanceof GpuiGroup) yield* flattenGroups(node.children);
    else yield node;
  }
}
