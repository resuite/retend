/** @import { jsxDevFileData } from '../hmr/index.js'; */
/** @import { Renderer, UnknownRendererTypes } from './renderer.js'; */
import { getActiveRenderer } from './renderer.js';
import { ArgumentList, linkNodes } from './utils.js';

/**
 * @template {UnknownRendererTypes} Data
 * @param {string | Function | undefined} tagOrFn
 * @param {*} props
 * @param {*} [_]
 * @param {*} [__]
 * @param {jsxDevFileData} [fileData]
 * @param {Renderer<Data>} renderer
 * @returns {any}
 */
export function h(
  tagOrFn,
  props,
  _,
  __,
  fileData,
  // @ts-expect-error: renderer types are a pain.
  renderer = getActiveRenderer()
) {
  if (tagOrFn === undefined) return [];

  if (Object.is(tagOrFn, FragmentPlaceholder)) {
    const childList =
      typeof props === 'object' && !(props instanceof ArgumentList)
        ? props.children
          ? Array.isArray(props.children)
            ? props.children
            : [props.children]
          : []
        : [];
    return renderer.createGroup(childList);
  }

  if (typeof tagOrFn === 'function') {
    const completeProps =
      props instanceof ArgumentList
        ? props.data
        : typeof props === 'object'
          ? [{ ...props }]
          : [];

    return renderer.handleComponent(tagOrFn, completeProps, fileData);
  }

  if (props instanceof ArgumentList || typeof props !== 'object') {
    throw new Error('JSX props for native elements must be an object.');
  }

  let container = renderer.createContainer(tagOrFn, props);
  const { children } = props;
  for (const key in props) {
    const value = props[key];
    container = renderer.setProperty(container, key, value);
  }

  return linkNodes(container, children, renderer);
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
