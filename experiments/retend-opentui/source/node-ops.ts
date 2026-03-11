import {
  InputRenderable,
  InputRenderableEvents,
  TextRenderable,
  type Renderable,
} from '@opentui/core';
import {
  AsyncCell,
  Cell,
  SourceCell,
  useAwait,
  type ReconcilerOptions,
} from 'retend';

import type { RenderableRange } from './extensions';

export function writeToRange(range: RenderableRange, newContent: Renderable[]) {
  const [start, end] = range;
  if (!start.parent || start.parent !== end.parent) {
    throw new Error('Range must have the same parent');
  }

  const { parent } = start;
  const allChildren = parent.getChildren();
  let nextSibling = allChildren[allChildren.indexOf(start) + 1];
  while (nextSibling && nextSibling !== end) {
    parent.remove(nextSibling.id);
    nextSibling = allChildren[allChildren.indexOf(nextSibling) + 1];
  }
  for (const node of newContent) parent.insertBefore(node, end);
}

export function collectReconciledNodes(
  options: ReconcilerOptions<Renderable>
): Renderable[] {
  const nodes: Renderable[] = [];
  let i = 0;

  for (const item of options.newList) {
    const key = options.retrieveOrSetItemKey(item, i);
    const cached = options.newCache.get(key);
    if (cached) nodes.push(...cached.nodes);
    i += 1;
  }

  return nodes;
}

export function setProperty<N extends Renderable>(
  node: N,
  key: string,
  value: any
): N {
  if (key === 'onSubmit' && node instanceof InputRenderable) {
    // @ts-expect-error: something wrong with the opentui types.
    node.on(InputRenderableEvents.ENTER, value);
    return node;
  }

  if (!Cell.isCell(value)) {
    Reflect.set(node, key, value);
    return node;
  }

  if (key === 'ref' && value instanceof SourceCell) {
    value.set(node);
    return node;
  }

  if (value instanceof AsyncCell) useAwait()?.waitUntil(value);
  const updateProperty = (nextValue: any) => {
    if (nextValue instanceof Promise) nextValue.then(updateProperty);
    else Reflect.set(node, key, nextValue);
  };

  const rawVal = value.get();
  updateProperty(rawVal);
  value.listen(updateProperty);
  return node;
}

export function append<N extends Renderable>(parent: N, child: Renderable) {
  if (parent instanceof TextRenderable && child instanceof TextRenderable) {
    parent.add(child.content);
  } else parent.add(child);
}

export function isConnected(root: Renderable, node: Renderable): boolean {
  let current: Renderable | null = node;
  while (current) {
    if (current === root) return true;
    current = current.parent;
  }
  return false;
}
