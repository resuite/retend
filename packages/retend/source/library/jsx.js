/** @import { jsxDevFileData } from '../plugin/hmr.js'; */
import { appendChild } from '../renderers/_shared.js';
import { getActiveRenderer } from '../renderers/index.js';
import { ArgumentList } from './utils.js';

/**
 * @param {string | Function | undefined} tagOrFn
 * @param {*} props
 * @param {*} [_]
 * @param {*} [__]
 * @param {jsxDevFileData} [fileData]
 * @returns {any}
 */
export function h(tagOrFn, props, _, __, fileData) {
  if (tagOrFn === undefined) return [];
  const renderer = getActiveRenderer();

  if (Object.is(tagOrFn, DocumentFragmentPlaceholder)) {
    /** @type {Node[]} */
    const childList =
      typeof props === 'object' && !(props instanceof ArgumentList)
        ? props.children
          ? Array.isArray(props.children)
            ? props.children
            : [props.children]
          : []
        : [];
    return renderer.createFragment(childList);
  }

  if (typeof tagOrFn === 'function') {
    const completeProps =
      props instanceof ArgumentList
        ? props.data
        : typeof props === 'object'
          ? [{ ...props }]
          : [];

    return renderer.renderComponent(tagOrFn, completeProps, fileData);
  }

  if (props instanceof ArgumentList || typeof props !== 'object') {
    throw new Error('JSX props for native elements must be an object.');
  }

  let element = renderer.createElement(tagOrFn, props?.xmlns);
  const { children } = props;
  for (const key in props) {
    element = renderer.setProperty(element, key, props[key]);
  }

  return appendChild(element, children, renderer);
}

export class DocumentFragmentPlaceholder {}

/**
 * Defines the `__jsx` and `__jsxFragment` global functions
 * for computing JSX components.
 */
export function defineJsxGlobals() {
  Reflect.set(globalThis, '__jsx', h);
  Reflect.set(globalThis, '__jsxFragment', DocumentFragmentPlaceholder);
}

export const jsx = h;
export const jsxFragment = DocumentFragmentPlaceholder;
export const Fragment = DocumentFragmentPlaceholder;
export default h;
