/**
 * @typedef {() => void} CleanupFn
 */
import { getGlobalContext, matchContext, Modes } from '../context/index.js';

/**
 * @template {Node} T
 * @typedef {((node: T) => CleanupFn | undefined) | ((node: T) => Promise<CleanupFn | undefined>) | ((node: T) => void | Promise<void>) } MountFn
 */

/**
 * @class
 * @description Observes DOM nodes and manages their lifecycle through callbacks
 */
export class DocumentObserver {
  #initialized = false;
  /** @type {Map<Node, Array<CleanupFn>>} */
  #mountedNodes = new Map();
  /** @type {Map<import('@adbl/cells').Cell<Node | null>, Array<MountFn<Node>>>} */
  #callbackSets = new Map();

  constructor() {
    this.#init();
  }

  /**
   * Mounts a callback to a node and manages its cleanup
   * @template {Node} T
   * @param {T} node - The DOM node to mount the callback to
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
   * Registers a callback to be called when the node referenced by the provided `ref` is connected to the DOM.
   * If the node is already connected, the callback is called immediately.
   * The callback can return a cleanup function that will be called when the node is disconnected from the DOM.
   *
   * @template {Node} T
   * @param {import('@adbl/cells').Cell<T | null>} ref - A `Cell` containing the node to observe
   * @param {MountFn<T>} callback - A function that will be called when the node is connected
   */
  onConnected(ref, callback) {
    if (!this.#initialized) this.#init();
    
    ref.get(); // force ref initialization if it is lazy. 
    // we can't use the above value because it is a proxy that can break DOM operations.
    const currentValue = ref.peek();
    if (currentValue?.isConnected) {
      this.#mount(currentValue, callback);
      return;
    }
    const connectedCallbacks = this.#callbackSets.get(ref) || [];
    connectedCallbacks.push(/** @type {MountFn<Node>} */ (callback));
    this.#callbackSets.set(ref, connectedCallbacks);
  }

  /**
   * Initializes the mutation observer to watch for DOM changes
   */
  #init() {
    const { window } = getGlobalContext();
    if (matchContext(window, Modes.VDom)) return;

    this.#initialized = true;
    const observer = new window.MutationObserver(
      this.processMountedNodes.bind(this)
    );
    observer.observe(window.document.body, { subtree: true, childList: true });
  }

  /**
   * Processes the mounted nodes and their associated callbacks.
   * This function is called by the mutation observer when DOM changes occur.
   * It iterates through the `callbackSets` to mount callbacks for newly connected nodes
   * and iterates through the `mountedNodes` to execute cleanup functions for disconnected nodes.
   */
  processMountedNodes() {
    if (!this.#initialized) this.#init();

    for (const [key, callbacks] of this.#callbackSets.entries()) {
      key.get()
      const currentValue = key.peek();
      if (!currentValue?.isConnected) continue;
      for (const callback of callbacks) {
        this.#mount(currentValue, callback);
      }
      this.#callbackSets.delete(key);
    }

    for (const [node, cleanups] of this.#mountedNodes.entries()) {
      if (node.isConnected) continue;
      for (const cleanup of cleanups) {
        cleanup();
      }
      this.#mountedNodes.delete(node);
    }
  }
}

/**
 * Returns the singleton instance of the `DocumentObserver` class,
 * which is responsible for observing the DOM and managing the lifecycle of mounted nodes.
 *
 * @example
 * // Mount a callback when a node is connected to the DOM
 * const nodeRef = Cell.source<HTMLDivElement | null>(null);
 * useObserver().onConnected(nodeRef, (node) => {
 *   console.log('Node connected:', node);
 *   return () => console.log('Node disconnected:', node);
 * });
 *
 * const node = <div ref={nodeRef}>Hello, world!</div>;
 *
 * @returns {DocumentObserver} The singleton instance of the `DocumentObserver` class
 */
export function useObserver() {
  const context = getGlobalContext();
  if (!context.observer) context.observer = new DocumentObserver();
  return context.observer;
}
