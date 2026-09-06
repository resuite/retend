import type { NativeTransportEventId } from '../events.js';
import type { GpuiStyle } from '../types.js';

import { nativeEventMetadataByType } from '../events.js';

interface ListenerRecord {
  readonly callback: EventListenerOrEventListenerObject;
  readonly capture: boolean;
  readonly once: boolean;
  readonly passive: boolean;
  readonly signal?: AbortSignal;
  abortHandler?: () => void;
  removed: boolean;
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

/** Renderer-owned hooks required by a node's event target implementation. */
export interface GpuiNodeEventOwner {
  nativeSubscriptionChanged(
    node: GpuiNode,
    eventId: NativeTransportEventId,
    enabled: boolean
  ): void;
  reportListenerError(error: unknown): void;
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
  #eventOwner?: GpuiNodeEventOwner;
  #destroyed = false;
  #cleanup = new Map<unknown, () => void>();
  #listeners = new Map<string, ListenerRecord[]>();

  constructor(eventOwner?: GpuiNodeEventOwner) {
    this.#eventOwner = eventOwner;
  }

  /** Renderer-owned event hooks inherited by related logical nodes. */
  get eventOwner(): GpuiNodeEventOwner | undefined {
    return this.#eventOwner;
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
    if (!records) this.#listeners.set(type, (records = []));
    if (
      records.some(
        (record) => record.callback === callback && record.capture === capture
      )
    ) {
      return;
    }

    const first = records.length === 0;
    const record: ListenerRecord = {
      callback,
      capture,
      once: typeof options === 'object' ? (options.once ?? false) : false,
      passive: typeof options === 'object' ? (options.passive ?? false) : false,
      signal,
      removed: false,
    };
    records.push(record);
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
    const record = records.find(
      (candidate) =>
        candidate.callback === callback && candidate.capture === capture
    );
    if (record) this.#removeRecord(type, record);
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

      if (!state.stopped) {
        state.currentTarget = this;
        state.phase = Event.AT_TARGET;
        state.immediateStopped = false;
        const snapshot = [...(this.#listeners.get(event.type) ?? [])];
        for (const capture of [true, false]) {
          for (const record of snapshot) {
            if (record.removed || record.capture !== capture) continue;
            this.#invokeListener(event.type, record, event, state);
            if (state.immediateStopped) break;
          }
          if (state.immediateStopped) break;
        }
      }

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

    const previous = this.#cleanup.get(key);
    if (previous) this.#runCleanup(previous);
    this.#cleanup.set(key, cleanup);
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
        record.removed = true;
        cleanupAbort(record);
      }
    }
    this.#listeners.clear();
    this.#eventOwner = undefined;
    for (const cleanup of this.#cleanup.values()) this.#runCleanup(cleanup);
    this.#cleanup.clear();
  }

  #syncNativeSubscription(type: string, enabled: boolean): void {
    const metadata = nativeEventMetadataByType(type);
    if (metadata)
      this.#eventOwner?.nativeSubscriptionChanged(this, metadata.id, enabled);
  }

  #removeRecord(type: string, record: ListenerRecord): void {
    if (record.removed) return;
    const records = this.#listeners.get(type);
    if (!records) return;
    const index = records.indexOf(record);
    if (index === -1) return;

    records.splice(index, 1);
    record.removed = true;
    cleanupAbort(record);
    if (records.length === 0) {
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
    if (record.removed) return;
    if (record.once) this.#removeRecord(type, record);
    state.passive = record.passive;
    try {
      if (typeof record.callback === 'function')
        record.callback.call(this, event);
      else record.callback.handleEvent(event);
    } catch (error) {
      if (this.#eventOwner) this.#eventOwner.reportListenerError(error);
      else console.error('[retend-gpui] event listener failed:', error);
    } finally {
      state.passive = false;
    }
  }

  #invokeNode(
    event: Event,
    state: DispatchState,
    phase: number,
    capture: boolean
  ): void {
    state.currentTarget = this;
    state.phase = phase;
    state.immediateStopped = false;
    const snapshot = [...(this.#listeners.get(event.type) ?? [])];
    for (const record of snapshot) {
      if (record.removed || record.capture !== capture) continue;
      this.#invokeListener(event.type, record, event, state);
      if (state.immediateStopped) break;
    }
  }

  #patchEvent(event: Event, state: DispatchState): () => void {
    const keys = [
      'target',
      'currentTarget',
      'eventPhase',
      'cancelBubble',
      'composedPath',
      'stopPropagation',
      'stopImmediatePropagation',
      'preventDefault',
    ] as const;
    const descriptors = keys.map(
      (key) => [key, Object.getOwnPropertyDescriptor(event, key)] as const
    );
    const preventDefault = event.preventDefault.bind(event);

    Object.defineProperties(event, {
      target: { configurable: true, get: () => state.target },
      currentTarget: { configurable: true, get: () => state.currentTarget },
      eventPhase: { configurable: true, get: () => state.phase },
      cancelBubble: {
        configurable: true,
        get: () => state.stopped,
        set: (value: boolean) => {
          if (value) state.stopped = true;
        },
      },
      composedPath: {
        configurable: true,
        value: () => [...state.path],
      },
      stopPropagation: {
        configurable: true,
        value: () => {
          state.stopped = true;
        },
      },
      stopImmediatePropagation: {
        configurable: true,
        value: () => {
          state.stopped = true;
          state.immediateStopped = true;
        },
      },
      preventDefault: {
        configurable: true,
        value: () => {
          if (!state.passive) preventDefault();
        },
      },
    });

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
export class GpuiElement extends GpuiParentNode {
  /** Flattened native children synchronized through the Retend command protocol. */
  nativeChildren: GpuiElement[] = [];
  /** Resolved author-style snapshot. */
  style: GpuiStyle = {};

  /**
   * @param id - Unique native identifier assigned by the renderer.
   * @param tagName - Intrinsic tag name (e.g. `"div"`, `"img"`).
   * @param acceptsChildren - Whether this native element can contain logical children.
   * @param eventOwner - Renderer hooks for native event synchronization and errors.
   */
  constructor(
    readonly id: number,
    readonly tagName: string,
    readonly acceptsChildren = true,
    eventOwner?: GpuiNodeEventOwner
  ) {
    super(eventOwner);
  }
}

/**
 * Text node, represented natively as a `text` element.
 */
export class GpuiText extends GpuiElement {
  /**
   * @param id - Unique native identifier.
   * @param content - Current text content.
   * @param eventOwner - Renderer hooks for native event synchronization and errors.
   */
  constructor(
    id: number,
    public content: string,
    eventOwner?: GpuiNodeEventOwner
  ) {
    super(id, 'text', false, eventOwner);
  }
}

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
