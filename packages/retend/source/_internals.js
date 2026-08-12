/** @import { Renderer } from './library/renderer.js' */
/** @import { Scope } from './library/scope.js' */

import { useScopeContext } from './library/scope.js';
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

/**
 * @template T
 * @param {Scope<T>} Scope
 */
export function getSafeScopeContext(Scope) {
  try {
    return useScopeContext(Scope);
  } catch {
    return null;
  }
}

/**
 * @typedef {Object} FragmentTrackerData
 * @property {WeakMap<object, unknown[]>} handleToNodes
 * @property {WeakMap<object, unknown[]>} groupToNodes
 */
