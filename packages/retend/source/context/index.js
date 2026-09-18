// @ts-nocheck: globalThis is not typed.
/** @import { Renderer } from '../library/renderer.js' */

/**
 * Environment configuration that pairs a mode with its corresponding window implementation.
 * Each environment provides its own window interface optimized for that context.
 *
 * @typedef {{
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

if (!globalThis.__RETEND_GLOBAL_CONTEXT__) {
  setGlobalContext({
    globalData: new Map(),
  });
}
