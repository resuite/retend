import {
  type ReconcilerOptions,
  AsyncCell,
  Cell,
  SourceCell,
  useAwait,
} from 'retend';

import type { CanvasStyle } from '../types';
import type { CanvasContainer } from './container';

import { type CanvasNode, type CanvasRange } from './node';

export function write(handle: CanvasRange, newContent: CanvasNode[]) {
  const [start, end] = handle;
  if (!start.parent || start.parent !== end.parent) {
    throw new Error('Range must have the same parent');
  }

  const { parent } = start;
  const startIndex = parent.children.indexOf(start);
  const endIndex = parent.children.indexOf(end);
  const removed = parent.children.splice(
    startIndex + 1,
    endIndex - startIndex - 1
  );
  for (const node of removed) {
    node.parent = null;
  }

  for (const node of newContent) {
    if (node.parent) node.parent.remove(node);
  }
  parent.children.splice(parent.children.indexOf(end), 0, ...newContent);
  for (const node of newContent) node.parent = parent;

  // This will force a trigger of the append side effects.
  const content: CanvasNode[] = [];
  parent.append(...content);
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

function setStyleProp(
  node: CanvasContainer,
  key: keyof CanvasStyle,
  value: unknown
) {
  if (Cell.isCell(value)) {
    if (value instanceof AsyncCell) useAwait()?.waitUntil(value);
    const updateProperty = (nextValue: any) => {
      if (nextValue instanceof Promise) nextValue.then(updateProperty);
      else node.setStyles({ [key]: nextValue } as CanvasStyle);
    };
    updateProperty(value.get());
    value.listen(updateProperty);
  } else {
    node.setStyles({ [key]: value } as CanvasStyle);
  }
}

export function setAttribute(
  node: CanvasContainer,
  key: string,
  _value: unknown
) {
  if (key === 'ref' && _value instanceof SourceCell) {
    _value.set(node);
    return;
  }

  if (Cell.isCell(_value)) {
    if (_value instanceof AsyncCell) useAwait()?.waitUntil(_value);
    const updateAttribute = <T>(nextValue: T) => {
      if (nextValue instanceof Promise) nextValue.then(updateAttribute);
      else setAttribute(node, key, nextValue);
    };

    updateAttribute(_value.get());
    _value.listen(updateAttribute);
    return;
  }

  if (key === 'style') {
    if (_value && typeof _value === 'object') {
      const value = _value as Record<string, unknown>;
      for (const prop in value) {
        setStyleProp(node, prop as keyof CanvasStyle, value[prop]);
      }
    }
  }

  node.setAttribute(key as never, _value as never);
  if (node.isConnected) node.renderer.requestRender();
}
