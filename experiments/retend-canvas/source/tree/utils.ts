import type { ReconcilerOptions } from 'retend';

import type { CanvasContainer } from './container';

import { CanvasFragment, type CanvasNode, type CanvasRange } from './node';

export function write(handle: CanvasRange, newContent: CanvasNode[]) {
  const [start, end] = handle;
  if (!start.parent || start.parent !== end.parent) {
    throw new Error('Range must have the same parent');
  }

  const { parent } = start;
  const allChildren = parent.children;

  const startIndex = allChildren.indexOf(start);
  const endIndex = allChildren.indexOf(end);

  parent.children.splice(startIndex + 1, endIndex - 1, ...newContent);
  // deleted nodes are not accessible and dont need to be removed one by one.
  for (const node of newContent) node.parent = parent;
}

export function collectReconciledNodes(
  options: ReconcilerOptions<CanvasNode>
): CanvasNode[] {
  const nodes: CanvasNode[] = [];
  let i = 0;

  for (const item of options.newList) {
    const key = options.retrieveOrSetItemKey(item, i);
    const cached = options.newCache.get(key);
    if (cached) nodes.push(...cached.nodes);
    i += 1;
  }

  return nodes;
}

export function append(
  parent: CanvasContainer,
  child: CanvasNode | CanvasNode[]
) {
  if (Array.isArray(child)) {
    const children = child.filter(Boolean);
    for (const child of children) parent.append(child);
  } else if (child instanceof CanvasFragment) {
    for (const subchild of child.children) {
      parent.append(subchild);
    }
  } else parent.append(child);
  return parent;
}
