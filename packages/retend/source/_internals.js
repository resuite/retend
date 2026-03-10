/** @import { Renderer } from './library/renderer.js' */
import { linkNodes } from './library/utils.js';

export const IgnoredHProps = /** @type {const} */ ([
  undefined,
  undefined,
  undefined,
]);

/**
 * @param {any} input
 * @param {Renderer<any>} renderer
 * @returns {any}
 */
export function createGroupFromNodes(input, renderer) {
  const group = renderer.createGroup();
  const children = Array.isArray(input) ? input : [input];
  for (const child of children) {
    linkNodes(group, child, renderer);
  }
  return group;
}
