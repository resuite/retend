/** @import { Renderer } from "./types.js"; */
import { getGlobalContext } from '../context/index.js';
import { DomRenderer } from './dom.js';

const RendererKey = Symbol('Renderer');
export * from './_shared.js';

/**
 * @returns {Renderer<any, any, any>}
 */
export function getActiveRenderer() {
  const { globalData } = getGlobalContext();
  const renderer = globalData.get(RendererKey);
  if (!renderer) {
    const newRenderer = new DomRenderer();
    setActiveRenderer(newRenderer);
    return newRenderer;
  }
  return renderer;
}

/**
 * @param {Renderer<any, any, any>} renderer
 */
export function setActiveRenderer(renderer) {
  const { globalData } = getGlobalContext();
  globalData.set(RendererKey, renderer);
}
