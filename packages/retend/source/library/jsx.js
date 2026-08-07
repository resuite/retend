/** @import { JSX } from '../jsx-runtime/index.js'; */
import { Block } from './block.js';
import { FragmentPlaceholder } from './fragment.js';

/**
 * @param {string | Function} tagOrFn
 * @param {*} props
 * @param {*} [_]
 * @param {*} [__]
 * @param {JSX.JSXDevFileData} [fileData]
 * @returns {Block}
 */
export function h(tagOrFn, props, _, __, fileData) {
  return new Block(tagOrFn, props, fileData);
}

export const jsx = h;
export const jsxFragment = FragmentPlaceholder;
export const Fragment = FragmentPlaceholder;
export default h;
