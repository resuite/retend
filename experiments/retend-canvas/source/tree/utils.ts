import type { JSX } from 'retend/jsx-runtime';

import { type ReconcilerOptions, AsyncCell, Cell, useAwait } from 'retend';

import type { CanvasRenderer } from '../canvas-renderer';
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

function setStyleProperty(
  node: CanvasContainer,
  renderer: CanvasRenderer,
  key: keyof JSX.Style,
  value: unknown
) {
  if (!Cell.isCell(value)) {
    const nextStyle = node.getStyles();
    Reflect.set(nextStyle, key, value);
    node.setStyles(nextStyle);
    if (node.isConnectedTo(renderer.root)) {
      renderer.requestRender();
    }
    return;
  }

  if (value instanceof AsyncCell) useAwait()?.waitUntil(value);
  const updateProperty = (nextValue: any) => {
    const nextStyle = node.getStyles();
    if (nextValue instanceof Promise) nextValue.then(updateProperty);
    else {
      Reflect.set(nextStyle, key, nextValue);
      node.setStyles(nextStyle);
      if (node.isConnectedTo(renderer.root)) {
        renderer.requestRender();
      }
    }
  };

  updateProperty(value.get());
  value.listen(updateProperty);
}

export function setAttribute(
  node: CanvasContainer,
  key: string,
  value: unknown,
  renderer: CanvasRenderer
) {
  if (Cell.isCell(value)) {
    if (value instanceof AsyncCell) useAwait()?.waitUntil(value);
    const updateAttribute = (nextValue: any) => {
      if (nextValue instanceof Promise) nextValue.then(updateAttribute);
      else setAttribute(node, key, nextValue, renderer);
    };

    updateAttribute(value.get());
    value.listen(updateAttribute);
    return;
  }

  if (key === 'style' && value instanceof Object) {
    node.setAttribute(key as never, {} as never);
    for (const styleKey in value) {
      setStyleProperty(
        node,
        renderer,
        styleKey as keyof JSX.Style,
        Reflect.get(value, styleKey)
      );
    }
    return;
  }

  node.setAttribute(key as never, value as never);
  if (node.isConnectedTo(renderer.root)) {
    renderer.requestRender();
  }
}
