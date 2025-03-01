// @ts-ignore: Deno has issues with import comments
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
 * @typedef {{
 *    mode: 1,
 *    window: VDom.VWindow
 *  } | {
 *    mode: 2
 *    window: Window & typeof globalThis
 *  }} Environments
 */

/** @typedef {Environments['mode']} RenderMode */
/** @typedef {Environments['window']} WindowLike */
/** @typedef {InstanceType<Environments['window']['HTMLElement']>} HTMLElementLike */
/** @typedef {Node & VDom.VNode} AsNode */
/** @typedef {Node | VDom.VNode} NodeLike */

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
 * @template [M=VDom.VNode]
 * @param {M} node
 * @returns {node is M extends VDom.VNode ? M : never}
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
  Reflect.set(
    globalContext.window.document,
    '__appRenderMode',
    globalContext.mode
  );
}

/**
 * Gets the global render context for the application.
 * @returns {Environments}
 */
export function getGlobalContext() {
  return globalContext;
}
