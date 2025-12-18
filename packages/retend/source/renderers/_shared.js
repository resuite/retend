/** @import { JSX } from '../jsx-runtime/index.js' */
/** @import { Renderer } from './types.js'; */

import { Cell } from '@adbl/cells';
import { addCellListener } from '../library/utils.js';

/**
 * @template NodeType
 * @template Output
 * @template {NodeType} Group
 * Generates an array of child nodes from a given input.
 * @param {JSX.Template | TemplateStringsArray} children
 * @param {Renderer<NodeType, Output, Group>} renderer
 * @returns {NodeType[]}
 */
export function generateChildNodes(children, renderer) {
  /** @type {NodeType[]} */
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
    return renderer.unwrapNodeGroup(children);
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
 * @template NodeType
 * @template Output
 * @template {NodeType} Group
 * Appends a child node or an array of child nodes to a parent node.
 * @param {NodeType} parent
 * The tag name of the parent node.
 * @param {any} child
 * The child node, array of child nodes, or string to append.
 * @param {Renderer<NodeType, Output, Group>} renderer
 * The renderer instance used for creating nodes.
 * @returns {NodeType}
 */
export function appendChild(parent, child, renderer) {
  let _parent = parent;
  if (Array.isArray(child)) {
    for (const childNode of child) {
      _parent = appendChild(_parent, childNode, renderer);
    }
    return _parent;
  }

  if (!child) return _parent;

  const childNode = normalizeJsxChild(child, renderer);
  return renderer.append(_parent, childNode);
}

/**
 * @template NodeType
 * @template Output
 * @template {NodeType} Group
 * Normalizes a child jsx element for use in the DOM.
 * @param {unknown} child - The child element to normalize.
 * @param {Renderer<NodeType, Output, Group>} renderer - The renderer instance.s
 * @returns {NodeType} The normalized child element.
 */
export function normalizeJsxChild(child, renderer) {
  if (renderer.isNode(child)) return child;

  if (Array.isArray(child)) {
    const group = renderer.createNodeGroup();
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
    if (renderer.isInteractive) {
      const textNode = renderer.createText('');
      addCellListener(textNode, child, function (value) {
        renderer.setText(value, this);
      });
      return textNode;
    }
    return renderer.createText(child.get());
  }

  return renderer.createText(child?.toString() ?? '');
}
