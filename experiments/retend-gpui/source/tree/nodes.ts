import type { GpuiStyle } from '../types.js';

/**
 * Base node in the GPUI retained tree.
 * Provides lifecycle management and keyed cleanup callbacks that are
 * automatically disposed when the node is destroyed or replaced.
 */
export abstract class GpuiNode {
  /** Parent in the logical tree, or `null` if detached. */
  parent: GpuiParentNode | null = null;
  /** Abort signal that fires when the node is destroyed; use for reactive subscriptions. */
  readonly lifecycle = new AbortController();
  #destroyed = false;
  #cleanup = new Map<unknown, () => void>();

  /** Whether `markDestroyed` has been called. */
  get destroyed(): boolean {
    return this.#destroyed;
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
    for (const cleanup of this.#cleanup.values()) this.#runCleanup(cleanup);
    this.#cleanup.clear();
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
   */
  constructor(
    readonly id: number,
    readonly tagName: string,
    readonly acceptsChildren = true
  ) {
    super();
  }
}

/**
 * Text node, represented natively as a `text` element.
 */
export class GpuiText extends GpuiElement {
  /**
   * @param id - Unique native identifier.
   * @param content - Current text content.
   */
  constructor(
    id: number,
    public content: string
  ) {
    super(id, 'text', false);
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
