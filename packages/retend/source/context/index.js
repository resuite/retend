/** @import * as VDom from '../v-dom/index.js' */
/** @import { DocumentObserver } from '../library/observer.js' */

/** @type {typeof globalThis.CustomEvent} */
export const CustomEvent =
  globalThis.CustomEvent ??
  class CustomEvent extends Event {
    /** @type {any} */
    #detail;
    /**
     * @param {string} type
     * @param {CustomEventInit} eventInitDict
     */
    constructor(type, eventInitDict) {
      super(type, eventInitDict);
      this.#detail = eventInitDict?.detail ?? null;
    }

    get detail() {
      return this.#detail;
    }
  };

/**
 * Defines the possible render contexts for the application.
 * @type {{VDom: 1, Interactive: 2}}
 */
export const Modes = {
  VDom: 1,
  Interactive: 2,
};

/**
 * @typedef GlobalContextChangeDetail
 * @property {Environments} [newContext]
 * @property {Environments} [oldContext]
 */

/** @extends {CustomEvent<GlobalContextChangeDetail>} */
export class GlobalContextChangeEvent extends CustomEvent {
  /**
   * @param {Environments} [oldContext]
   * @param {Environments} [newContext]
   */
  constructor(oldContext, newContext) {
    super('globalcontextchange', { detail: { oldContext, newContext } });
  }
}

/**
 * Environment configuration that pairs a mode with its corresponding window implementation.
 * Each environment provides its own window interface optimized for that context.
 *
 * @typedef {({
 *    mode: 1,
 *    window: VDom.VWindow
 *  } | {
 *    mode: 2
 *    window: Window & typeof globalThis
 *  }) & {
 *    consistentValues: Map<string, any>,
 *    teleportIdCounter: { value: number }
 *    observer?: DocumentObserver
 *    globalData: Map<string, any>
 * }} Environments
 */

/** @typedef {Environments['mode']} RenderMode */
/** @typedef {Environments['window']} WindowLike */
/** @typedef {InstanceType<Environments['window']['HTMLElement']>} HTMLElementLike */
/** @typedef {Node & VDom.VNode} AsNode */
/** @typedef {Node | VDom.VNode} NodeLike */

/**
 * Global context that tracks the current environment configuration.
 * The mode determines how rendering and DOM operations are handled.
 *
 * @type {Environments}
 */
let globalContext = {
  mode: Modes.Interactive,
  window: globalThis.window,
  consistentValues: new Map(),
  globalData: new Map(),
  teleportIdCounter: { value: 0 },
};

/**
 * @template {RenderMode} T
 * @typedef {Environments extends infer U ? U extends Environments ? T extends U['mode'] ? U['window']: never : never: never} ExtractWindowFromEnvironmentMode
 */

/**
 * Validates if a window instance matches the expected render mode.
 * Used to ensure operations are performed in the correct environment.
 *
 * @template {RenderMode} M
 * @param {WindowLike} window - Window instance to check
 * @param {M} mode - Expected render mode
 * @returns {window is ExtractWindowFromEnvironmentMode<M>}
 */
export function matchContext(window, mode) {
  const windowRenderMode =
    '__appRenderMode__' in window
      ? window.__appRenderMode__
      : Modes.Interactive;
  return windowRenderMode === mode;
}

export function resetGlobalContext() {
  const oldContext = globalContext;
  //@ts-expect-error: hand waving.
  globalContext = {};
  oldContext.window?.dispatchEvent(
    new GlobalContextChangeEvent(oldContext, undefined)
  );
}

/**
 * Identifies virtual nodes in any environment.
 * Useful for conditional logic that needs to handle both real and virtual DOM nodes.
 *
 * @template {object} [M=VDom.VNode]
 * @param {M} node - Node to check
 * @returns {node is M extends VDom.VNode ? M : never}
 */
export function isVNode(node) {
  return (
    typeof node === 'object' &&
    node !== null &&
    '__isVNode' in node &&
    Boolean(node.__isVNode)
  );
}

/**
 * Updates the global render context for retend.
 * The default context is the interactive, web DOM environment.
 *
 * @param {Environments} newContext - New environment configuration
 */
export function setGlobalContext(newContext) {
  const oldContext = globalContext;
  globalContext = newContext;
  if (oldContext !== newContext) {
    oldContext.window?.dispatchEvent(
      new GlobalContextChangeEvent(oldContext, newContext)
    );
  }
}

// Default context is the interactive, web DOM environment, so that
// older SPA applications can continue to work seamlessly.
if (globalThis.window?.document) {
  setGlobalContext({
    mode: Modes.Interactive,
    window: globalThis.window,
    consistentValues: new Map(),
    globalData: new Map(),
    teleportIdCounter: { value: 0 },
  });
}
/**
 * Retrieves the current render context.
 * Use this to check the active environment and access its window implementation.
 *
 * @returns {Environments}
 */
export function getGlobalContext() {
  return globalContext;
}
