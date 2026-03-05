/** @import { JSX } from '../jsx-runtime/index.js'; */
/** @import { Renderer } from './renderer.js'; */
import { AsyncCell } from '@adbl/cells';

import { useAwait } from './await.js';
import { getActiveRenderer } from './renderer.js';
import { createNodesFromTemplate, linkNodes } from './utils.js';

/**
 * @param {string | Function | undefined} tagOrFn
 * @param {*} props
 * @param {*} [_]
 * @param {*} [__]
 * @param {JSX.JSXDevFileData} [fileData]
 * @param {Renderer<any>} renderer
 * @returns {any}
 */
export function h(
  tagOrFn,
  props,
  _,
  __,
  fileData,
  renderer = getActiveRenderer()
) {
  if (!renderer?.handleComponent) renderer = getActiveRenderer();
  if (tagOrFn === undefined) return [];

  if (Object.is(tagOrFn, FragmentPlaceholder)) {
    const Fragment = () => {
      const childList =
        typeof props === 'object'
          ? props.children
            ? Array.isArray(props.children)
              ? props.children
              : [props.children]
            : []
          : [];
      return renderer.createGroup(childList);
    };
    Object.defineProperty(Fragment, 'name', { value: '{Fragment}' });
    return Fragment;
  }

  if (typeof tagOrFn === 'function') {
    const completeProps = typeof props === 'object' ? [props] : [];
    const comp = () => {
      return renderer.handleComponent(
        tagOrFn,
        completeProps,
        undefined,
        fileData
      );
    };
    Object.defineProperty(comp, 'name', { value: `{${tagOrFn.name}}` });
    return comp;
  }

  if (typeof props !== 'object') {
    throw new Error('JSX props for native elements must be an object.');
  }

  const __renderElement = () => {
    props.children = createNodesFromTemplate(props.children, renderer);
    let container = renderer.createContainer(tagOrFn, props);
    for (const key in props) {
      if (key === 'children') continue;
      const value = props[key];
      if (value instanceof AsyncCell) useAwait()?.waitUntil(value);
      container = renderer.setProperty(container, key, value);
    }

    return linkNodes(container, props.children, renderer);
  };
  Object.defineProperty(__renderElement, 'name', { value: `{${tagOrFn}}` });
  return __renderElement;
}

export class FragmentPlaceholder {}

/**
 * Defines the `__jsx` and `__jsxFragment` global functions
 * for computing JSX components.
 */
export function defineJsxGlobals() {
  Reflect.set(globalThis, '__jsx', h);
  Reflect.set(globalThis, '__jsxFragment', FragmentPlaceholder);
}

export const jsx = h;
export const jsxFragment = FragmentPlaceholder;
export const Fragment = FragmentPlaceholder;
export default h;
