// @ts-nocheck: globalThis is not typed.

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
 *    globalData: Map<PropertyKey, any>
 * }} Environments
 */

/** @typedef {Environments['mode']} RenderMode */
/** @typedef {Environments['window']} WindowLike */
/** @typedef {InstanceType<Environments['window']['HTMLElement']>} HTMLElementLike */
/** @typedef {Node & VDom.VNode} AsNode */
/** @typedef {Node | VDom.VNode} NodeLike */
/** @typedef {DocumentFragment | VDom.VDocumentFragment} FragmentLike */

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
  const oldContext = globalThis.__RETEND_GLOBAL_CONTEXT__;
  globalThis.__RETEND_GLOBAL_CONTEXT__ = {};
  oldContext.window?.dispatchEvent?.(
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

if (!globalThis.__RETEND_GLOBAL_CONTEXT__) {
  globalThis.__RETEND_GLOBAL_CONTEXT__ = {
    mode: Modes.Interactive,
    window: globalThis.window,
    consistentValues: new Map(),
    globalData: new Map(),
    teleportIdCounter: { value: 0 },
  };
}

/**
 * Determines if the current environment is a server-side rendering (SSR) context.
 *
 * @returns {boolean} True if the current context is a virtual DOM mode with SSR enabled, false otherwise.
 */
export function isSSREnvironment() {
  const context = getGlobalContext();
  return (
    context.mode === Modes.VDom && context.globalData.get('env:ssr') === true
  );
}

/**
 * Updates the global render context for retend.
 * The default context is the interactive, web DOM environment.
 *
 * @param {Environments} newContext - New environment configuration
 */
export function setGlobalContext(newContext) {
  const oldContext = globalThis.__RETEND_GLOBAL_CONTEXT__;
  globalThis.__RETEND_GLOBAL_CONTEXT__ = newContext;
  if (oldContext !== newContext) {
    oldContext.window?.dispatchEvent(
      new GlobalContextChangeEvent(oldContext, newContext)
    );
  }
}

/**
 * Retrieves the current render context.
 * Use this to check the active environment and access its window implementation.
 *
 * @returns {Environments}
 */
export function getGlobalContext() {
  return globalThis.__RETEND_GLOBAL_CONTEXT__;
}
