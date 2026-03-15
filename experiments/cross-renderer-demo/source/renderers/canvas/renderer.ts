import type { ReconcilerOptions, __HMR_UpdatableFn } from 'retend';

import { Cell, createNodesFromTemplate, normalizeJsxChild } from 'retend';

import type {
  CanvasContainerNode,
  CanvasHandle,
  CanvasNode,
  CanvasNodeProps,
  CanvasRendererTypes,
  CanvasTextNode,
} from './types';

import { getValue, resolveForCanvas } from '../shared/units';

function resolveDimension(
  value: unknown,
  parentSize?: number
): number | undefined {
  const resolvedValue = getValue(value);
  if (resolvedValue === undefined || resolvedValue === null) {
    return undefined;
  }

  return resolveForCanvas(String(resolvedValue), parentSize);
}

function getGap(style: CanvasNodeProps['style'], isRow: boolean): number {
  if (!style) {
    return 0;
  }

  if (isRow) {
    const gap = resolveDimension(style.columnGap);
    if (gap !== undefined) {
      return gap;
    }

    return 0;
  }

  const gap = resolveDimension(style.rowGap);
  if (gap !== undefined) {
    return gap;
  }

  return 0;
}

function isRowLayout(style: CanvasNodeProps['style']): boolean {
  return getValue(style?.flexDirection) === 'row';
}

function toNodeArray(input?: CanvasNode | CanvasNode[]): CanvasNode[] {
  if (input === undefined) {
    return [];
  }

  if (Array.isArray(input)) {
    return input;
  }

  return [input];
}

function collectReconciledNodes(
  options: ReconcilerOptions<CanvasNode>
): CanvasNode[] {
  const nodes: CanvasNode[] = [];
  let i = 0;

  for (const item of options.newList) {
    const key = options.retrieveOrSetItemKey(item, i);
    const cached = options.newCache.get(key);
    if (cached) {
      nodes.push(...cached.nodes);
    }
    i += 1;
  }

  return nodes;
}

function getTextStyle(node: CanvasNode): CanvasNodeProps['style'] {
  const ownStyle = node.props.style;
  if (!node.parent) {
    return ownStyle;
  }

  const parentStyle = node.parent.props.style;
  if (!parentStyle) {
    return ownStyle;
  }

  if (!ownStyle) {
    return parentStyle;
  }

  return {
    ...parentStyle,
    ...ownStyle,
  };
}

function getFont(style: CanvasNodeProps['style']): string {
  let fontSize = 16;
  if (style) {
    const resolvedFontSize = resolveDimension(style.fontSize);
    if (resolvedFontSize !== undefined) {
      fontSize = resolvedFontSize;
    }
  }

  let fontWeight = 'normal';
  if (style) {
    const resolvedFontWeight = getValue(style.fontWeight);
    if (resolvedFontWeight) {
      fontWeight = resolvedFontWeight;
    }
  }

  return `${fontWeight} ${fontSize}px sans-serif`;
}

class BaseNode implements CanvasNode {
  type = 'node';
  parent: CanvasNode | null = null;
  children: CanvasNode[] = [];
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  props: CanvasNodeProps = {};

  constructor(type: string, props: CanvasNodeProps = {}) {
    this.type = type;
    this.props = props;
  }

  measure(
    _ctx: CanvasRenderingContext2D,
    _availableWidth?: number,
    _availableHeight?: number
  ): void {}

  draw(_ctx: CanvasRenderingContext2D): void {}
}

class MarkerNode extends BaseNode {
  constructor() {
    super('marker');
  }
}

class TextNode extends BaseNode implements CanvasTextNode {
  text: string;

  constructor(text: string) {
    super('text-node');
    this.text = text;
  }

  measure(ctx: CanvasRenderingContext2D): void {
    const style = getTextStyle(this);
    ctx.font = getFont(style);

    const metrics = ctx.measureText(this.text);
    this.width = metrics.width;

    let fontSize = 16;
    if (style) {
      const resolvedFontSize = resolveDimension(style.fontSize);
      if (resolvedFontSize !== undefined) {
        fontSize = resolvedFontSize;
      }
    }

    this.height = fontSize;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const style = getTextStyle(this);
    ctx.font = getFont(style);

    let color = 'white';
    if (style) {
      const resolvedColor = getValue(style.color);
      if (resolvedColor) {
        color = resolvedColor;
      }
    }

    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.fillText(this.text, this.x, this.y);
  }
}

class TextContainerNode extends BaseNode implements CanvasContainerNode {
  constructor(props: CanvasNodeProps = {}) {
    super('text', props);
  }

  measure(
    ctx: CanvasRenderingContext2D,
    _availableWidth?: number,
    _availableHeight?: number
  ): void {
    this.width = 0;
    this.height = 0;

    for (const child of this.children) {
      child.measure(ctx);
      this.width += child.width;
      if (child.height > this.height) {
        this.height = child.height;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    let currentX = this.x;

    for (const child of this.children) {
      child.x = currentX;
      child.y = this.y;
      child.draw(ctx);
      currentX += child.width;
    }
  }
}

class BoxNode extends BaseNode implements CanvasContainerNode {
  measure(
    ctx: CanvasRenderingContext2D,
    availableWidth?: number,
    availableHeight?: number
  ): void {
    const style = this.props.style;

    const resolvedWidth = resolveDimension(style?.width, availableWidth);
    const resolvedHeight = resolveDimension(style?.height, availableHeight);

    if (resolvedWidth !== undefined) {
      this.width = resolvedWidth;
    } else if (this.type === 'root' && availableWidth !== undefined) {
      this.width = availableWidth;
    } else {
      this.width = 0;
    }

    if (resolvedHeight !== undefined) {
      this.height = resolvedHeight;
    } else if (this.type === 'root' && availableHeight !== undefined) {
      this.height = availableHeight;
    } else {
      this.height = 0;
    }

    let padding = 0;
    if (style) {
      const resolvedPadding = resolveDimension(style.padding, this.width);
      if (resolvedPadding !== undefined) {
        padding = resolvedPadding;
      }
    }

    let childAvailableWidth = availableWidth;
    if (this.width > 0) {
      childAvailableWidth = this.width - padding * 2;
    }

    let childAvailableHeight = availableHeight;
    if (this.height > 0) {
      childAvailableHeight = this.height - padding * 2;
    }

    for (const child of this.children) {
      child.measure(ctx, childAvailableWidth, childAvailableHeight);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const style = this.props.style;

    if (style) {
      const backgroundColor = getValue(style.backgroundColor);
      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(this.x, this.y, this.width, this.height);
      }

      const borderColor = getValue(style.borderColor);
      if (borderColor) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
      }
    }

    const isRow = isRowLayout(style);
    const gap = getGap(style, isRow);

    let padding = 0;
    if (style) {
      const resolvedPadding = resolveDimension(style.padding, this.width);
      if (resolvedPadding !== undefined) {
        padding = resolvedPadding;
      }
    }

    let totalMainAxisSize = 0;
    for (let i = 0; i < this.children.length; i += 1) {
      const child = this.children[i];
      if (isRow) {
        totalMainAxisSize += child.width;
      } else {
        totalMainAxisSize += child.height;
      }

      if (i > 0) {
        totalMainAxisSize += gap;
      }
    }

    let currentX = this.x + padding;
    let currentY = this.y + padding;

    if (style && getValue(style.justifyContent) === 'center') {
      if (isRow) {
        currentX += (this.width - padding * 2 - totalMainAxisSize) / 2;
      } else {
        currentY += (this.height - padding * 2 - totalMainAxisSize) / 2;
      }
    }

    for (const child of this.children) {
      if (isRow) {
        child.x = currentX;
        child.y = this.y + padding;

        if (style && getValue(style.alignItems) === 'center') {
          child.y =
            this.y + padding + (this.height - padding * 2 - child.height) / 2;
        }

        child.draw(ctx);
        currentX += child.width + gap;
        continue;
      }

      child.x = this.x + padding;
      child.y = currentY;

      if (style && getValue(style.alignItems) === 'center') {
        child.x =
          this.x + padding + (this.width - padding * 2 - child.width) / 2;
      }

      child.draw(ctx);
      currentY += child.height + gap;
    }
  }
}

function findClickTarget(
  node: CanvasNode,
  x: number,
  y: number
): CanvasNode | null {
  for (let i = node.children.length - 1; i >= 0; i -= 1) {
    const child = node.children[i];
    const match = findClickTarget(child, x, y);
    if (match) {
      return match;
    }
  }

  if (!node.props.onClick) {
    return null;
  }

  if (x < node.x) {
    return null;
  }

  if (x > node.x + node.width) {
    return null;
  }

  if (y < node.y) {
    return null;
  }

  if (y > node.y + node.height) {
    return null;
  }

  return node;
}

export class CanvasRenderer {
  host: CanvasRendererTypes['Host'];
  ctx: CanvasRenderingContext2D;
  root: BoxNode;
  observer = null;
  capabilities = {
    supportsSetupEffects: true,
    supportsObserverConnectedCallbacks: false,
  };

  constructor(host: HTMLCanvasElement) {
    this.host = host;

    const context = host.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2d context');
    }

    this.ctx = context;
    this.root = new BoxNode('root');

    this.host.addEventListener('click', (event) => {
      const rect = this.host.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const target = findClickTarget(this.root, x, y);

      if (target && target.props.onClick) {
        target.props.onClick(event);
        this.requestRender();
      }
    });

    this.flush();
  }

  flush(): void {
    const width = this.host.width;
    const height = this.host.height;

    this.ctx.clearRect(0, 0, width, height);

    this.root.x = 0;
    this.root.y = 0;
    this.root.width = width;
    this.root.height = height;
    this.root.measure(this.ctx, width, height);
    this.root.x = 0;
    this.root.y = 0;
    this.root.width = width;
    this.root.height = height;
    this.root.draw(this.ctx);
  }

  requestRender(): void {
    requestAnimationFrame(() => {
      this.flush();
    });
  }

  render(app: unknown): CanvasNode | CanvasNode[] {
    return normalizeJsxChild(app, this);
  }

  isActive(_node: CanvasNode): boolean {
    return true;
  }

  createGroup(): CanvasNode[] {
    return [];
  }

  unwrapGroup(group: CanvasNode[]): CanvasNode[] {
    return group;
  }

  createGroupHandle(group: CanvasNode[]): CanvasHandle {
    const start = new MarkerNode();
    const end = new MarkerNode();
    group.unshift(start);
    group.push(end);
    return [start, end];
  }

  createContainer(
    tagname: string,
    props: CanvasNodeProps = {}
  ): CanvasContainerNode {
    if (tagname === 'text') {
      return new TextContainerNode(props);
    }

    return new BoxNode(tagname, props);
  }

  createText(text: string): CanvasTextNode {
    return new TextNode(text);
  }

  updateText(text: string, node: CanvasTextNode): CanvasTextNode {
    node.text = text;
    this.requestRender();
    return node;
  }

  append(parent: CanvasNode, children: CanvasNode | CanvasNode[]): CanvasNode {
    const nodes = toNodeArray(children);
    for (const node of nodes) {
      node.parent = parent;
      parent.children.push(node);
    }

    this.requestRender();
    return parent;
  }

  write(handle: CanvasHandle, newContent: CanvasNode[]): void {
    const [start, end] = handle;
    const parent = start.parent;
    if (!parent) {
      return;
    }

    const startIndex = parent.children.indexOf(start);
    const endIndex = parent.children.indexOf(end);
    if (startIndex === -1 || endIndex === -1) {
      return;
    }

    for (const node of newContent) {
      node.parent = parent;
    }

    parent.children.splice(
      startIndex + 1,
      endIndex - startIndex - 1,
      ...newContent
    );
    this.requestRender();
  }

  reconcile(
    handle: CanvasHandle,
    options: ReconcilerOptions<CanvasNode>
  ): void {
    this.write(handle, collectReconciledNodes(options));
  }

  setProperty<N extends CanvasNode>(node: N, key: string, value: unknown): N {
    if (Cell.isCell(value)) {
      value.listen((nextValue) => {
        this.setProperty(node, key, nextValue);
      });
      return this.setProperty(node, key, value.get());
    }

    if (key === 'style' && value) {
      const currentStyle = node.props.style;
      if (!currentStyle) {
        node.props.style = value as CanvasNodeProps['style'];
      } else {
        node.props.style = {
          ...currentStyle,
          ...(value as CanvasNodeProps['style']),
        };
      }
      this.requestRender();
      return node;
    }

    node.props[key] = value;
    this.requestRender();
    return node;
  }

  handleComponent(
    tagname: __HMR_UpdatableFn,
    props: unknown[]
  ): CanvasNode | CanvasNode[] {
    const template = tagname(...props);
    const nodes = createNodesFromTemplate(template, this) as CanvasNode[];
    if (nodes.length === 1) {
      return nodes[0];
    }

    return nodes;
  }
  restoreContainerState(): void {}

  isGroup(node: unknown): node is CanvasNode[] {
    return Array.isArray(node);
  }

  isNode(child: unknown): child is CanvasNode {
    return child instanceof BaseNode;
  }
}
