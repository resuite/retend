/** @import { Renderer } from "./types.js"; */
import { getGlobalContext } from '../context/index.js';
import { DOMRenderer } from './dom.js';

const RendererKey = Symbol('Renderer');
export * from './_shared.js';

/**
 * @returns {Renderer<any>}
 */
export function getActiveRenderer() {
  const { globalData } = getGlobalContext();
  const renderer = globalData.get(RendererKey);
  if (!renderer) {
    const newRenderer = new DOMRenderer();
    setActiveRenderer(newRenderer);
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
