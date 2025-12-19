/** @import { Renderer, UnknownRendererTypes } from "./types.js"; */
import { getGlobalContext } from '../context/index.js';
import { DOMRenderer } from '../web/dom-renderer.js';

const RendererKey = Symbol('Renderer');
export * from './_shared.js';

/**
 * @returns {Renderer<UnknownRendererTypes>}
 */
export function getActiveRenderer() {
  const { globalData } = getGlobalContext();
  const renderer = globalData.get(RendererKey);
  if (!renderer) {
    const newRenderer = new DOMRenderer();
    setActiveRenderer(newRenderer);
    // @ts-expect-error: type of renderer should be opaque
    return newRenderer;
  }
  return renderer;
}

/**
 * @param {Renderer<any>} renderer
 */
export function setActiveRenderer(renderer) {
  const { globalData } = getGlobalContext();
  globalData.set(RendererKey, renderer);
}
