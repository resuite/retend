// @ts-ignore: Deno has issues with import comments
/** @import * as Static from '../static/v-dom.js' */

/**
 * Defines the possible render contexts for the application.
 * @type {{Static: 1, Interactive: 2}}
 */
export const Modes = {
  Static: 1,
  Interactive: 2,
};

/**
 * @typedef {{
 *    mode: 1,
 *    window: Static.VWindow
 *  } | {
 *    mode: 2
 *    window: Window & typeof globalThis
 *  }} Environments
 */

/** @typedef {Environments['mode']} RenderMode */
/** @typedef {Environments['window']} WindowLike */
/** @typedef {InstanceType<Environments['window']['HTMLElement']>} HTMLElementLike */
/** @typedef {Node & Static.VNode} AsNode */

/** @type {Environments} */
const globalContext = {
  mode: Modes.Interactive,
  window: globalThis.window,
};

/**
 * @template {RenderMode} T
 * @typedef {Environments extends infer U ? U extends Environments ? T extends U['mode'] ? U['window']: never : never: never} ExtractWindowFromEnvironmentMode
 */

/**
 * @template {RenderMode} M
 * @param {WindowLike} window
 * @param {M} mode
 *
 * @returns {window is ExtractWindowFromEnvironmentMode<M>}
 */
export function matchContext(window, mode) {
  return Reflect.get(window.document, '__appRenderMode') === mode;
}

/**
 * @param {InstanceType<WindowLike['Node']>} node
 * @returns {node is Static.VNode}
 */
export function isVNode(node) {
  // @ts-ignore
  return '__isVNode' in node && node.__isVNode;
}

/**
 * Sets the global render context for the application.
 * @param {Environments} context
 */
export function setGlobalContext(context) {
  Object.assign(globalContext, context);
  Reflect.set(document, '__appRenderMode', globalContext.mode);
}

/**
 * Gets the global render context for the application.
 * @returns {Environments}
 */
export function getGlobalContext() {
  return { ...globalContext };
}
