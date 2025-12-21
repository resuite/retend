// @ts-nocheck: globalThis is not typed.

/** @import * as VDom from '../v-dom/index.js' */
/** @import { Observer } from '../library/observer.js' */

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
 * @typedef {{
 *    consistentValues: Map<string, any>,
 *    teleportIdCounter: { value: number }
 *    observer?: Observer
 *    globalData: Map<PropertyKey, any>
 * }} Environments
 */

export function resetGlobalContext() {
  const oldContext = globalThis.__RETEND_GLOBAL_CONTEXT__;
  globalThis.__RETEND_GLOBAL_CONTEXT__ = {};
  oldContext.window?.dispatchEvent?.(
    new GlobalContextChangeEvent(oldContext, undefined)
  );
}

if (!globalThis.__RETEND_GLOBAL_CONTEXT__) {
  globalThis.__RETEND_GLOBAL_CONTEXT__ = {
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
  return context.globalData.get('env:ssr') === true;
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
