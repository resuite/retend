/** @import { Cell } from '@adbl/cells'; */
/** @import { Renderer } from './renderer.js' */
/**
 * @typedef {() => void} CleanupFn
 */
import { getActiveRenderer } from './renderer.js';

/**
 * @template T
 * @typedef {((node: T) => CleanupFn | undefined) | ((node: T) => Promise<CleanupFn | undefined>) | ((node: T) => void | Promise<void>) } MountFn
 */

/**
 * @class
 * @description Observes nodes and manages their lifecycle through callbacks
 */
export class Observer {
  /** @type {Map<unknown, Array<CleanupFn>>} */
  #mountedNodes = new Map();
  /** @type {Map<Cell<unknown | null>, Array<MountFn<unknown>>>} */
  #callbackSets = new Map();
  /** @type {Renderer<any> | null} */
  #renderer = null;

  /** @param {Renderer<any>} renderer  */
  constructor(renderer) {
    const { capabilities } = renderer;
    if (!capabilities.supportsObserverConnectedCallbacks) return;
    this.#renderer = renderer;
    const processor = this.processMountedNodes.bind(this);
    renderer.onViewChange(processor);
  }

  /**
   * Mounts a callback to a node and manages its cleanup
   * @template T
   * @param {T} node - The node to mount the callback to
   * @param {MountFn<T>} callback - The callback to execute when mounted
   */
  async #mount(node, callback) {
    try {
      const cleanup = await callback(node);
      if (cleanup) {
        const cleanups = this.#mountedNodes.get(node);
        if (cleanups) {
          cleanups.push(cleanup);
        } else {
          this.#mountedNodes.set(node, [cleanup]);
        }
      }
    } catch (error) {
      console.error('Error mounting node:', error);
    }
  }

  /**
   * Registers a callback to be called when the node referenced by the provided `ref` is connected to the host environment.
   * If the node is already connected, the callback is called immediately.
   * The callback can return a cleanup function that will be called when the node is disconnected.
   *
   * @template T
   * @param {Cell<T | null>} ref - A `Cell` containing the node to observe
   * @param {MountFn<T>} callback - A function that will be called when the node is connected
   */
  onConnected(ref, callback) {
    const currentValue = ref.peek();
    if (currentValue && this.#renderer?.isActive(currentValue)) {
      this.#mount(currentValue, callback);
      return;
    }
    const connectedCallbacks = this.#callbackSets.get(ref) || [];
    connectedCallbacks.push(/** @type {MountFn<unknown>} */ (callback));
    this.#callbackSets.set(ref, connectedCallbacks);
  }

  /**
   * Processes the mounted nodes and their associated callbacks.
   * This function is called when changes occur in the host environment.
   * It iterates through the `callbackSets` to mount callbacks for newly connected nodes
   * and iterates through the `mountedNodes` to execute cleanup functions for disconnected nodes.
   */
  processMountedNodes() {
    for (const [key, callbacks] of this.#callbackSets) {
      key.get();
      const currentValue = key.peek();
      if (!currentValue || !this.#renderer?.isActive(currentValue)) continue;
      for (const callback of callbacks) {
        this.#mount(currentValue, callback);
      }
      this.#callbackSets.delete(key);
    }

    for (const [node, cleanups] of this.#mountedNodes) {
      if (this.#renderer?.isActive(node)) continue;
      for (const cleanup of cleanups) {
        cleanup();
      }
      this.#mountedNodes.delete(node);
    }
  }
}

/**
 * Returns the singleton instance of the `Observer` class,
 * which is responsible for observing the host environment and managing the lifecycle of mounted nodes.
 *
 * @example
 * // Mount a callback when a node is connected to the DOM
 * const observer = useObserver()
 * const nodeRef = Cell.source<HTMLDivElement | null>(null);
 * observer.onConnected(nodeRef, (node) => {
 *   console.log('Node connected:', node);
 *   return () => console.log('Node disconnected:', node);
 * });
 *
 * const node = <div ref={nodeRef}>Hello, world!</div>;
 *
 * @returns {Observer} The singleton instance of the `Observer` class
 */
export function useObserver() {
  const renderer = getActiveRenderer();
  if (!renderer.observer) {
    renderer.observer = new Observer(renderer);
  }
  return renderer.observer;
}
