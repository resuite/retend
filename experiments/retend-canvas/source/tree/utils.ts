import type { JSX } from 'retend/jsx-runtime';

import {
  type ReconcilerOptions,
  AsyncCell,
  Cell,
  SourceCell,
  useAwait,
} from 'retend';

import type { CanvasContainer } from './container';

import { type CanvasNode, type CanvasRange } from './node';
import { applyStyle } from './transitions';

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
  key: keyof JSX.Style,
  value: unknown
) {
  if (!Cell.isCell(value)) {
    applyStyle(node, key, value);
    return;
  }

  if (value instanceof AsyncCell) useAwait()?.waitUntil(value);
  const updateProperty = (nextValue: any) => {
    if (nextValue instanceof Promise) nextValue.then(updateProperty);
    else applyStyle(node, key, nextValue);
  };

  updateProperty(value.get());
  value.listen(updateProperty);
}

export function setAttribute(
  node: CanvasContainer,
  key: string,
  value: unknown
) {
  if (key === 'ref' && value instanceof SourceCell) {
    value.set(node);
    return;
  }

  if (Cell.isCell(value)) {
    if (value instanceof AsyncCell) useAwait()?.waitUntil(value);
    const updateAttribute = (nextValue: any) => {
      if (nextValue instanceof Promise) nextValue.then(updateAttribute);
      else setAttribute(node, key, nextValue);
    };

    updateAttribute(value.get());
    value.listen(updateAttribute);
    return;
  }

  if (key === 'style' && value instanceof Object) {
    const style = value as JSX.Style;
    node.setAttribute(key as never, {} as never);
    if ('transitionDuration' in style) {
      setStyleProp(node, 'transitionDuration', style.transitionDuration);
    }
    if ('transitionDelay' in style) {
      setStyleProp(node, 'transitionDelay', style.transitionDelay);
    }
    if ('transitionTimingFunction' in style) {
      setStyleProp(
        node,
        'transitionTimingFunction',
        style.transitionTimingFunction
      );
    }
    if ('transitionProperty' in style) {
      setStyleProp(node, 'transitionProperty', style.transitionProperty);
    }

    for (const styleKey in style) {
      if (
        styleKey === 'transitionDuration' ||
        styleKey === 'transitionDelay' ||
        styleKey === 'transitionTimingFunction' ||
        styleKey === 'transitionProperty'
      ) {
        continue;
      }
      setStyleProp(
        node,
        styleKey as keyof JSX.Style,
        style[styleKey as keyof JSX.Style]
      );
    }
    return;
  }

  node.setAttribute(key as never, value as never);
  if (node.isConnected) {
    node.renderer.requestRender();
  }
}
