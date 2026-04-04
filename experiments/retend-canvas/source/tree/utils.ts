import type { JSX } from 'retend/jsx-runtime';

import { type ReconcilerOptions, AsyncCell, Cell, useAwait } from 'retend';

import type { CanvasRenderer } from '../canvas-renderer';
import type { CanvasContainer } from './container';

import { CanvasFragment, type CanvasNode, type CanvasRange } from './node';
import { applyStyle } from './transitions';

export function write(handle: CanvasRange, newContent: CanvasNode[]) {
  const [start, end] = handle;
  if (!start.parent || start.parent !== end.parent) {
    throw new Error('Range must have the same parent');
  }

  const { parent } = start;
  const startIndex = parent.children.indexOf(start);
  while (parent.children[startIndex + 1] !== end) {
    parent.remove(parent.children[startIndex + 1]);
  }

  for (const node of newContent) {
    if (node.parent) node.parent.remove(node);
    parent.children.splice(parent.children.indexOf(end), 0, node);
    node.parent = parent;
  }
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

function setStyleProp(
  node: CanvasContainer,
  renderer: CanvasRenderer,
  key: keyof JSX.Style,
  value: unknown
) {
  if (!Cell.isCell(value)) {
    applyStyle(renderer, node, key, value);
    return;
  }

  if (value instanceof AsyncCell) useAwait()?.waitUntil(value);
  const updateProperty = (nextValue: any) => {
    if (nextValue instanceof Promise) nextValue.then(updateProperty);
    else applyStyle(renderer, node, key, nextValue);
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
    const style = value as JSX.Style;
    node.setAttribute(key as never, {} as never);
    if ('transitionDuration' in style) {
      setStyleProp(
        node,
        renderer,
        'transitionDuration',
        style.transitionDuration
      );
    }
    if ('transitionDelay' in style) {
      setStyleProp(node, renderer, 'transitionDelay', style.transitionDelay);
    }
    if ('transitionTimingFunction' in style) {
      setStyleProp(
        node,
        renderer,
        'transitionTimingFunction',
        style.transitionTimingFunction
      );
    }
    if ('transitionProperty' in style) {
      setStyleProp(
        node,
        renderer,
        'transitionProperty',
        style.transitionProperty
      );
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
        renderer,
        styleKey as keyof JSX.Style,
        style[styleKey as keyof JSX.Style]
      );
    }
    return;
  }

  node.setAttribute(key as never, value as never);
  if (node.isConnectedTo(renderer.root)) {
    renderer.requestRender();
  }
}
