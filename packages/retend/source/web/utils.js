/** @import * as VDom from '../v-dom/index.js' */
import { getGlobalContext } from '../context/index.js';

/** @typedef {(VDom.VComment | Comment) & { __commentRangeSymbol?: symbol }} ConnectedComment */

/**
 * Creates a pair of connected comment nodes that can be used to represent a range.
 * @returns {[ConnectedComment, ConnectedComment]} A pair of connected comment nodes with a shared symbol.
 */
export function createCommentPair() {
  const { window } = getGlobalContext();
  const symbol = Symbol();
  const rangeStart = window.document.createComment('----');
  const rangeEnd = window.document.createComment('----');
  Reflect.set(rangeStart, '__commentRangeSymbol', symbol);
  Reflect.set(rangeEnd, '__commentRangeSymbol', symbol);

  return [rangeStart, rangeEnd];
}
