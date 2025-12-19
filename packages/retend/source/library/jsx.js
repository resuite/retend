/** @import { jsxDevFileData } from './hmr.js'; */
/** @import { Renderer, UnknownRendererTypes } from '../renderers/types.js'; */
import { Cell, SourceCell } from '@adbl/cells';
import { appendChild } from '../renderers/_shared.js';
import { getActiveRenderer } from '../renderers/index.js';
import { addCellListener, ArgumentList } from './utils.js';

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
  renderer = getActiveRenderer()
) {
  if (tagOrFn === undefined) return [];

  if (Object.is(tagOrFn, DocumentFragmentPlaceholder)) {
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

  let element = renderer.createContainer(tagOrFn, props);
  const { children } = props;
  for (const key in props) {
    const value = props[key];
    element = renderer.setProperty(element, key, value);
    if (Cell.isCell(value)) {
      if (key === 'ref' && value instanceof SourceCell) value.set(element);
      addCellListener(
        element,
        value,
        function (value) {
          renderer.setProperty(this, key, value);
        },
        false
      );
    }
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
