/** @import { Renderer, RendererTypes } from './types.js'; */

import { Cell } from '@adbl/cells';
import { addCellListener } from '../library/utils.js';

/**
 * @template {RendererTypes} Data
 * Generates an array of child nodes from a given input.
 * @param {any} children
 * @param {Renderer<Data>} renderer
 * @returns {Data['Node'][]}
 */
export function generateChildNodes(children, renderer) {
  /** @type {Data['Node'][]} */
  const nodes = [];

  if (
    typeof children === 'string' ||
    typeof children === 'number' ||
    typeof children === 'boolean'
  ) {
    return [renderer.createText(String(children))];
  }

  if (children instanceof Promise) {
    return [renderer.handlePromise(children)];
  }

  if (renderer.isGroup(children)) {
    return renderer.unwrapGroup(children);
  }

  if (renderer.isSegment(children)) {
    return renderer.unwrapSegment(children);
  }

  if (renderer.isNode(children)) {
    return [children];
  }

  if (Array.isArray(children)) {
    return children.flatMap((child) => generateChildNodes(child, renderer));
  }

  return nodes;
}

/**
 * @template {RendererTypes} Data
 * Appends a child node or an array of child nodes to a parent node.
 * @param {Data['Node']} parent
 * The tag name of the parent node.
 * @param {any} child
 * The child node, array of child nodes, or string to append.
 * @param {Renderer<Data>} renderer
 * The renderer instance used for creating nodes.
 * @returns {Data['Node']}
 */
export function appendChild(parent, child, renderer) {
  let _parent = parent;
  let _child = child;

  if (renderer.isSegment(_child)) {
    _child = renderer.unwrapSegment(_child);
  }

  if (Array.isArray(_child)) {
    for (const childNode of _child) {
      _parent = appendChild(_parent, childNode, renderer);
    }
    return _parent;
  }

  if (!_child) return _parent;

  const childNode = normalizeJsxChild(_child, renderer);
  return renderer.append(_parent, childNode);
}

/**
 * @template {RendererTypes} Types
 * Normalizes a child jsx element for use in the DOM.
 * @param {any} child - The child element to normalize.
 * @param {Renderer<Types>} renderer - The renderer instance.s
 * @returns {Types['Node']} The normalized child element.
 */
export function normalizeJsxChild(child, renderer) {
  if (renderer.isNode(child)) return child;

  if (Array.isArray(child)) {
    const group = renderer.createGroup();
    for (const subchild of child) {
      const childNodes = normalizeJsxChild(subchild, renderer);
      renderer.append(group, childNodes);
    }
    return group;
  }

  if (child === null || child === undefined) {
    return renderer.createText('');
  }

  if (child instanceof Promise) {
    return renderer.handlePromise(child);
  }

  // @ts-ignore: There is an error with the @adbl/cells library. Booleans should be allowed here.
  if (Cell.isCell(child)) {
    const textNode = renderer.createText(child.get());
    addCellListener(
      textNode,
      child,
      function (value) {
        renderer.updateText(value, this);
      },
      false
    );
    return textNode;
  }

  return renderer.createText(child?.toString() ?? '');
}
