/** @import { Renderer, RendererTypes } from './renderer.js'; */

/**
 * @template {RendererTypes} Data
 * Generates an array of child nodes from a given input.
 * @param {any} children
 * @param {Renderer<Data>} renderer
 * @returns {Data['Node'][]}
 */
export function createNodesFromTemplate(children, renderer) {
  /** @type {Data['Node'][]} */
  const nodes = [];
  const stack = [children];

  while (stack.length > 0) {
    const child = stack.pop();
    if (
      typeof child === 'string' ||
      typeof child === 'number' ||
      typeof child === 'boolean'
    ) {
      nodes.push(renderer.createText(String(child)));
      continue;
    }

    if (renderer.isGroup(child)) {
      nodes.push(...renderer.unwrapGroup(child));
      continue;
    }

    if (renderer.isNode(child)) {
      nodes.push(child);
      continue;
    }

    if (Array.isArray(child)) {
      for (let i = child.length - 1; i >= 0; i -= 1) {
        stack.push(child[i]);
      }
      continue;
    }

    if (typeof child === 'function') {
      stack.push(child());
      continue;
    }

    if (child) nodes.push(child);
  }

  return nodes;
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
  let parent = first;
  if (!second) return parent;

  const stack = [second];
  while (stack.length > 0) {
    const childNode = stack.pop();
    if (Array.isArray(childNode)) {
      for (let i = childNode.length - 1; i >= 0; i -= 1) {
        stack.push(childNode[i]);
      }
      continue;
    }
    if (!childNode) continue;

    const normalized = normalizeJsxChild(childNode, renderer);
    parent = renderer.append(parent, normalized);
  }

  return parent;
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
    /** @type {any[]} */
    const stack = [];
    for (let i = child.length - 1; i >= 0; i -= 1) {
      stack.push(child[i]);
    }

    while (stack.length > 0) {
      const subchild = stack.pop();
      if (Array.isArray(subchild)) {
        for (let i = subchild.length - 1; i >= 0; i -= 1) {
          stack.push(subchild[i]);
        }
        continue;
      }

      if (typeof subchild === 'function') {
        stack.push(subchild());
        continue;
      }

      const normalized =
        subchild === null || subchild === undefined
          ? renderer.createText('')
          : renderer.isNode(subchild)
            ? subchild
            : renderer.createText(subchild);
      renderer.append(group, normalized);
    }
    return group;
  }

  if (typeof child === 'function') {
    return normalizeJsxChild(child(), renderer);
  }

  if (child === null || child === undefined) {
    return renderer.createText('');
  }

  return renderer.createText(child);
}
