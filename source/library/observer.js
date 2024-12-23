/**
 * @typedef {() => void} CleanupFn
 */

/**
 * @template {Node} T
 * @typedef {((node: T) => CleanupFn) | ((node: T) => void | Promise<void>) } MountFn
 */

/**
 * @class
 * @description Observes DOM nodes and manages their lifecycle through callbacks
 */
class DocumentObserver {
  constructor() {
    /** @type {Map<Node, Array<CleanupFn>>} */
    this.mountedNodes = new Map();
    /** @type {Map<import('@adbl/cells').Cell<Node | null>, Array<MountFn<Node>>>} */
    this.callbackSets = new Map();
    this.init();
  }

  /**
   * Mounts a callback to a node and manages its cleanup
   * @template {Node} T
   * @param {T} node - The DOM node to mount the callback to
   * @param {MountFn<T>} callback - The callback to execute when mounted
   * @private
   */
  async mount(node, callback) {
    const cleanup = await callback(node);
    if (cleanup) {
      const cleanups = this.mountedNodes.get(node);
      if (cleanups) {
        cleanups.push(cleanup);
      } else {
        this.mountedNodes.set(node, [cleanup]);
      }
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
    if (ref.value?.isConnected) {
      this.mount(ref.value, callback);
      return;
    }
    const connectedCallbacks = this.callbackSets.get(ref) || [];
    connectedCallbacks.push(/** @type {MountFn<Node>} */ (callback));
    this.callbackSets.set(ref, connectedCallbacks);
  }

  /**
   * Initializes the mutation observer to watch for DOM changes
   * @private
   */
  init() {
    const observer = new MutationObserver(() => {
      for (const [key, callbacks] of this.callbackSets.entries()) {
        if (!key.value?.isConnected) continue;
        for (const callback of callbacks) this.mount(key.value, callback);
        this.callbackSets.delete(key);
      }

      for (const [node, cleanups] of this.mountedNodes.entries()) {
        if (node.isConnected) continue;
        for (const cleanup of cleanups) {
          console.log('Cleaning up:', cleanup);
          cleanup();
        }
        this.mountedNodes.delete(node);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true });
  }
}

/** @type {DocumentObserver | undefined} */
let observer = undefined;

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
  if (!observer) observer = new DocumentObserver();
  return observer;
}
