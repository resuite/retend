/** @import * as VDom from '../v-dom/index.js' */

/**
 * Defines the possible render contexts for the application.
 * @type {{VDom: 1, Interactive: 2}}
 */
export const Modes = {
  VDom: 1,
  Interactive: 2,
};

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
  return Reflect.get(window.document, '__appRenderMode') === mode;
}

export function resetGlobalContext() {
  //@ts-expect-error: hand waving.
  globalContext = {};
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
  return '__isVNode' in node && Boolean(node.__isVNode);
}

/**
 * Updates the global render context for retent.
 * The default context is the interactive, web DOM environment.
 *
 * @param {Environments} context - New environment configuration
 */
export function setGlobalContext(context) {
  globalContext = context;
  Reflect.set(
    globalContext.window.document,
    '__appRenderMode',
    globalContext.mode
  );
}

// Default context is the interactive, web DOM environment, so that
// older SPA applications can continue to work seamlessly.
if (globalThis.window?.document) {
  setGlobalContext({
    mode: Modes.Interactive,
    window: globalThis.window,
    consistentValues: new Map(),
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
