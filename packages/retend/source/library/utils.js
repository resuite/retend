/** @import { Renderer, RendererTypes } from './renderer.js'; */

/**
 * @template T
 * A list of parameters that are passed to a component as props.
 * It is differentiated from an array of values or a single object.
 */
export class ArgumentList {
  /** @param {T} data */
  constructor(data) {
    this.data = data;
  }
}

/**
 * @template {RendererTypes} Data
 * Generates an array of child nodes from a given input.
 * @param {any} children
 * @param {Renderer<Data>} renderer
 * @returns {Data['Node'][]}
 */
export function createNodesFromTemplate(children, renderer) {
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

  if (renderer.isNode(children)) {
    return [children];
  }

  if (Array.isArray(children)) {
    return children.flatMap((child) =>
      createNodesFromTemplate(child, renderer)
    );
  }

  return [children].filter(Boolean);
}

/**
 * @template {RendererTypes} Data
 * Creates an renderer-defined link between two nodes.
 * @param {Data['Node']} first
 * The first or target node.
 * @param {any} second
 * A node, an array of nodes, or string to append.
 * @param {Renderer<Data>} renderer
 * The renderer instance used for creating nodes.
 * @returns {Data['Node']}
 */
export function linkNodes(first, second, renderer) {
  let _first = first;

  if (Array.isArray(second)) {
    for (const childNode of second) {
      _first = linkNodes(_first, childNode, renderer);
    }
    return _first;
  }

  if (!second) return _first;

  const childNode = normalizeJsxChild(second, renderer);
  return renderer.append(_first, childNode);
}

/**
 * @template {RendererTypes} Types
 * Normalizes a child jsx node for use in the renderer host.
 * @param {any} child - The child element to normalize.
 * @param {Renderer<Types>} renderer - The renderer instance.
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

  return renderer.createText(child);
}
