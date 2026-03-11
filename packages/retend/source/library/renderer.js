/** @import { __HMR_UpdatableFn, Renderer, RendererTypes } from '../library/index.js'; */
/** @import { Environments } from '../context/index.js'; */

import { getGlobalContext } from '../context/index.js';

/**
 * Retrieves the currently active renderer from the global context.
 *
 * @returns {Renderer<any>}
 * The renderer instance responsible for the current execution cycle.
 */
export function getActiveRenderer() {
  const { renderer } = getGlobalContext();
  return /** @type {Renderer<any>} */ (renderer);
}

/**
 * Sets the active renderer within the global context.
 *
 * @template {RendererTypes} Types
 * @param {Renderer<Types>} renderer
 * The renderer instance to be used for subsequent rendering operations.
 * @param {Environments} [context]
 */
export function setActiveRenderer(renderer, context) {
  if (context) {
    context.renderer = renderer;
  } else {
    const context = getGlobalContext();
    context.renderer = renderer;
  }
}
