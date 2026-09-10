import {
  GpuiAnchor,
  GpuiGroup,
  type GpuiNode,
  type GpuiParentNode,
  type GpuiRange,
} from './nodes.js';

function detachNode(node: GpuiNode, moving = false): void {
  const parent = node.parent;
  if (!parent) return;
  const index = parent.children.indexOf(node);
  if (index !== -1) parent.children.splice(index, 1);
  node.parent = null;
  if (!moving) node.renderer?.moveNode(node, parent, null, 0);
}

function flattenContent(input: readonly GpuiNode[]): GpuiNode[] {
  const nodes: GpuiNode[] = [];
  for (const node of input) {
    if (node instanceof GpuiGroup) {
      detachNode(node);
      const children = node.children.splice(0);
      for (const child of children) child.parent = null;
      nodes.push(...flattenContent(children));
    } else nodes.push(node);
  }
  return nodes;
}

function insertNode(
  parent: GpuiParentNode,
  node: GpuiNode,
  before?: GpuiNode
): void {
  if (node.parent === parent) {
    const index = parent.children.indexOf(node);
    if (parent.children[index + 1] === before) return;
  }
  const previous = node.parent;
  detachNode(node, true);
  const position = before
    ? parent.children.indexOf(before)
    : parent.children.length;
  parent.children.splice(position, 0, node);
  node.parent = parent;
  node.renderer?.moveNode(node, previous, parent, position);
}

export function appendNodes(
  parent: GpuiParentNode,
  input: GpuiNode | readonly GpuiNode[]
): void {
  const roots = Array.isArray(input) ? input : [input];
  if (roots.includes(parent)) {
    throw new Error('A GPUI node cannot be appended to itself.');
  }

  for (const node of flattenContent(roots)) insertNode(parent, node);
}

export function createRange(group: GpuiGroup): GpuiRange {
  const start = new GpuiAnchor(group.host, group.renderer);
  const end = new GpuiAnchor(group.host, group.renderer);
  start.parent = group;
  end.parent = group;
  group.children.unshift(start);
  group.children.push(end);
  return [start, end];
}

export function getRangeNodes(range: GpuiRange): GpuiNode[] {
  const [start, end] = range;
  const parent = start.parent;
  if (!parent || parent !== end.parent) return [];

  const startIndex = parent.children.indexOf(start);
  const endIndex = parent.children.indexOf(end);
  return startIndex === -1 || endIndex <= startIndex
    ? []
    : parent.children.slice(startIndex + 1, endIndex);
}

export function writeRange(
  range: GpuiRange,
  newContent: readonly GpuiNode[]
): void {
  const [start, end] = range;
  const parent = start.parent;
  if (!parent || parent !== end.parent) {
    throw new Error('GPUI range anchors must share the same parent.');
  }

  const startIndex = parent.children.indexOf(start);
  const endIndex = parent.children.indexOf(end);
  if (startIndex === -1 || endIndex <= startIndex) {
    throw new Error('GPUI range anchors are out of order.');
  }
  if (newContent.includes(start) || newContent.includes(end)) {
    throw new Error('A GPUI range cannot contain its boundary anchors.');
  }

  const current = parent.children.slice(startIndex + 1, endIndex);
  const nodes = flattenContent(newContent);
  if (
    current.length === nodes.length &&
    current.every((node, index) => node === nodes[index])
  )
    return;
  const retained = new Set(nodes);
  for (const node of current) {
    if (retained.has(node)) continue;
    detachNode(node);
    node.renderer?.releaseNode(node);
  }
  let before: GpuiNode = end;
  for (let index = nodes.length - 1; index >= 0; index--) {
    const node = nodes[index];
    insertNode(parent, node, before);
    before = node;
  }
}
