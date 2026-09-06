import {
  GpuiAnchor,
  GpuiElement,
  GpuiGroup,
  type GpuiNode,
  type GpuiParentNode,
  type GpuiRange,
} from './nodes.js';

export interface StructureMutation {
  affectedParents: Set<GpuiParentNode>;
  detachedNodes: Set<GpuiNode>;
}

function createMutation(): StructureMutation {
  return { affectedParents: new Set(), detachedNodes: new Set() };
}

function detachNode(node: GpuiNode, mutation: StructureMutation): void {
  const parent = node.parent;
  if (!parent) return;

  const index = parent.children.indexOf(node);
  if (index !== -1) parent.children.splice(index, 1);
  node.parent = null;
  mutation.affectedParents.add(parent);
}

function flattenContent(
  input: readonly GpuiNode[],
  mutation: StructureMutation
): GpuiNode[] {
  const nodes: GpuiNode[] = [];
  const visit = (node: GpuiNode): void => {
    if (!(node instanceof GpuiGroup)) {
      nodes.push(node);
      return;
    }

    detachNode(node, mutation);
    for (const child of node.children.splice(0)) {
      child.parent = null;
      visit(child);
    }
  };

  for (const node of input) visit(node);
  return nodes;
}

export function* flattenGroups(
  nodes: readonly GpuiNode[]
): Generator<GpuiNode> {
  for (const node of nodes) {
    if (node instanceof GpuiGroup) yield* flattenGroups(node.children);
    else yield node;
  }
}

export function appendNodes(
  parent: GpuiParentNode,
  input: GpuiNode | readonly GpuiNode[]
): StructureMutation {
  const roots = Array.isArray(input) ? input : [input];
  if (roots.includes(parent)) {
    throw new Error('A GPUI node cannot be appended to itself.');
  }

  const mutation = createMutation();
  const nodes = flattenContent(roots, mutation);
  for (const node of nodes) detachNode(node, mutation);
  for (const node of nodes) {
    node.parent = parent;
    parent.children.push(node);
  }

  mutation.affectedParents.add(parent);
  return mutation;
}

export function createRange(group: GpuiGroup): GpuiRange {
  const start = new GpuiAnchor(group.eventOwner);
  const end = new GpuiAnchor(group.eventOwner);
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
): StructureMutation {
  const [start, end] = range;
  const parent = start.parent;
  if (!parent || parent !== end.parent) {
    throw new Error('GPUI range anchors must share the same parent.');
  }

  let startIndex = parent.children.indexOf(start);
  let endIndex = parent.children.indexOf(end);
  if (startIndex === -1 || endIndex <= startIndex) {
    throw new Error('GPUI range anchors are out of order.');
  }
  if (newContent.includes(start) || newContent.includes(end)) {
    throw new Error('A GPUI range cannot contain its boundary anchors.');
  }

  const current = parent.children.slice(startIndex + 1, endIndex);
  const mutation = createMutation();
  const hadGroup = newContent.some((node) => node instanceof GpuiGroup);
  const nodes = flattenContent(newContent, mutation);
  if (
    !hadGroup &&
    current.length === nodes.length &&
    current.every((node, index) => node === nodes[index])
  ) {
    return mutation;
  }

  const currentSet = new Set(current);
  for (const node of nodes) {
    if (node.parent !== parent || !currentSet.has(node)) {
      detachNode(node, mutation);
    }
  }

  startIndex = parent.children.indexOf(start);
  endIndex = parent.children.indexOf(end);

  const nextSet = new Set(nodes);
  for (const node of parent.children.slice(startIndex + 1, endIndex)) {
    if (nextSet.has(node)) continue;
    node.parent = null;
    mutation.detachedNodes.add(node);
  }

  for (const node of nodes) node.parent = parent;
  parent.children.splice(startIndex + 1, endIndex - startIndex - 1, ...nodes);
  mutation.affectedParents.add(parent);
  return mutation;
}

export function collectNativeChildren(parent: GpuiParentNode): GpuiElement[] {
  return [...flattenGroups(parent.children)].filter(
    (node): node is GpuiElement => node instanceof GpuiElement
  );
}
