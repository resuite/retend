/** @import { JSX } from '../jsx-runtime/index.js' */
/** @import { Renderer } from './types.js'; */

import { Cell } from '@adbl/cells';
import { addCellListener } from '../library/utils.js';

/**
 * @template Node
 * Generates an array of child nodes from a given input.
 * @param {JSX.Template | TemplateStringsArray} children
 * @param {Renderer<Node, any>} renderer
 * @returns {Node[]}
 */
export function generateChildNodes(children, renderer) {
  /** @type {Node[]} */
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

  if (renderer.isFragment(children)) {
    return renderer.unwrapFragment(children);
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
 * @template Node
 * Appends a child node or an array of child nodes to a parent node.
 * @param {Node} parent
 * The tag name of the parent node.
 * @param {any} child
 * The child node, array of child nodes, or string to append.
 * @param {Renderer<Node, any>} renderer
 * The renderer instance used for creating nodes.
 * @returns {Node}
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
 * @template Node
 * Normalizes a child jsx element for use in the DOM.
 * @param {unknown} child - The child element to normalize.
 * @param {Renderer<Node, any>} renderer - The renderer instance.s
 * @returns {Node} The normalized child element.
 */
export function normalizeJsxChild(child, renderer) {
  if (renderer.isNode(child)) return child;

  if (Array.isArray(child)) {
    const fragment = renderer.createFragment();
    for (const subchild of child) {
      const childNodes = normalizeJsxChild(subchild, renderer);
      renderer.append(fragment, childNodes);
    }
    return fragment;
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
