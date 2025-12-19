/** @import * as VDom from '../v-dom/index.js' */
import { getActiveRenderer } from '../renderers/index.js';
import { DOMRenderer } from './dom-renderer.js';

/** @typedef {(VDom.VComment | Comment) & { __commentRangeSymbol?: symbol }} ConnectedComment */

/**
 * Creates a pair of connected comment nodes that can be used to represent a range.
 * @returns {[ConnectedComment, ConnectedComment]} A pair of connected comment nodes with a shared symbol.
 */
export function createCommentPair() {
  const renderer = /** @type {DOMRenderer} */ (getActiveRenderer());
  const symbol = Symbol();
  const rangeStart = renderer.host.document.createComment('----');
  const rangeEnd = renderer.host.document.createComment('----');
  Reflect.set(rangeStart, '__commentRangeSymbol', symbol);
  Reflect.set(rangeEnd, '__commentRangeSymbol', symbol);

  return [rangeStart, rangeEnd];
}
