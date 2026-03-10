// @ts-nocheck: globalThis is not typed.
/** @import { Observer } from '../library/observer.js' */
/** @import { Renderer } from '../library/renderer.js' */

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
 * Environment configuration that pairs a mode with its corresponding window implementation.
 * Each environment provides its own window interface optimized for that context.
 *
 * @typedef {{
 *    observer?: Observer
 *    globalData: Map<PropertyKey, any>
 *    renderer?: Renderer<any>
 * }} Environments
 */

export function resetGlobalContext() {
  globalThis.__RETEND_GLOBAL_CONTEXT__ = {};
}

/**
 * Updates the global render context for retend.
 * The default context is the interactive, web DOM environment.
 *
 * @param {Environments} newContext - New environment configuration
 */
export function setGlobalContext(newContext) {
  globalThis.__RETEND_GLOBAL_CONTEXT__ = newContext;
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
