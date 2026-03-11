import blessed from 'blessed';
import {
  Cell,
  createNodesFromTemplate,
  normalizeJsxChild,
  type ReconcilerOptions,
  type Renderer,
  type __HMR_UpdatableFn,
} from 'retend';

import type {
  TerminalContainerNode,
  TerminalHandle,
  TerminalNode,
  TerminalNodeProps,
  TerminalRendererTypes,
  TerminalTextNode,
} from './types';

import { getValue, resolveForTerminal } from '../shared/units';

function resolveDimension(
  value: unknown,
  parentSize?: number
): number | undefined {
  const resolvedValue = getValue(value);
  if (resolvedValue === undefined || resolvedValue === null) {
    return undefined;
  }

  return resolveForTerminal(String(resolvedValue), parentSize);
}

function getGap(style: TerminalNodeProps['style'], isRow: boolean): number {
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

function isRowLayout(style: TerminalNodeProps['style']): boolean {
  return getValue(style?.flexDirection) === 'row';
}

function toNodeArray(input?: TerminalNode | TerminalNode[]): TerminalNode[] {
  if (input === undefined) {
    return [];
  }

  if (Array.isArray(input)) {
    return input;
  }

  return [input];
}

function collectReconciledNodes(
  options: ReconcilerOptions<TerminalNode>
): TerminalNode[] {
  const nodes: TerminalNode[] = [];
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

function getTextStyle(node: TerminalNode): TerminalNodeProps['style'] {
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

function parseColor(color: string | undefined): string | number | undefined {
  if (!color) {
    return undefined;
  }

  if (color === 'white') {
    return 'white';
  }

  if (color === 'black') {
    return 'black';
  }

  if (color === 'red') {
    return 'red';
  }

  if (color === 'green') {
    return 'green';
  }

  if (color === 'blue') {
    return 'blue';
  }

  if (color === 'yellow') {
    return 'yellow';
  }

  if (color === 'cyan') {
    return 'cyan';
  }

  if (color === 'magenta') {
    return 'magenta';
  }

  return color;
}

class BaseNode implements TerminalNode {
  type = 'node';
  parent: TerminalNode | null = null;
  children: TerminalNode[] = [];
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  props: TerminalNodeProps = {};

  constructor(type: string, props: TerminalNodeProps = {}) {
    this.type = type;
    this.props = props;
  }

  measure(_availableWidth?: number, _availableHeight?: number): void {}

  paint(_screen: TerminalScreen): void {}

  syncToBlessedWidget(screen: TerminalScreen): void {
    this.paint(screen);
  }

  destroy(): void {}
}

class MarkerNode extends BaseNode {
  constructor() {
    super('marker');
  }
}

export class TextNode extends BaseNode implements TerminalTextNode {
  text: string;

  constructor(text: string) {
    super('text-node');
    this.text = text;
  }

  measure(): void {
    this.width = this.text.length;
    this.height = 1;
  }

  paint(screen: TerminalScreen): void {
    const style = getTextStyle(this);
    let color: string | number | undefined;
    if (style) {
      const resolvedColor = getValue(style.color);
      if (resolvedColor) {
        color = parseColor(resolvedColor);
      }
    }

    blessed.text({
      parent: screen.screen,
      top: this.y,
      left: this.x,
      width: this.width + 1,
      height: 1,
      content: this.text,
      style: {
        fg: color,
        bold: style ? getValue(style.fontWeight) === 'bold' : false,
      },
    });
  }
}

class TextContainerNode extends BaseNode implements TerminalContainerNode {
  constructor(props: TerminalNodeProps = {}) {
    super('text', props);
  }

  measure(_availableWidth?: number, _availableHeight?: number): void {
    this.width = 0;
    this.height = 0;

    for (const child of this.children) {
      child.measure();
      this.width += child.width;
      if (child.height > this.height) {
        this.height = child.height;
      }
    }
  }

  paint(screen: TerminalScreen): void {
    let currentX = this.x;

    for (const child of this.children) {
      child.x = currentX;
      child.y = this.y;
      child.paint(screen);
      currentX += child.width;
    }
  }
}

class BoxNode extends BaseNode implements TerminalContainerNode {
  measure(availableWidth?: number, availableHeight?: number): void {
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
      child.measure(childAvailableWidth, childAvailableHeight);
    }
  }

  paint(screen: TerminalScreen): void {
    const style = this.props.style;
    let backgroundColor: string | number | undefined;
    let borderColor: string | number | undefined;

    if (style) {
      const resolvedBackground = getValue(style.backgroundColor);
      if (resolvedBackground) {
        backgroundColor = parseColor(resolvedBackground);
      }

      const resolvedBorder = getValue(style.borderColor);
      if (resolvedBorder) {
        borderColor = parseColor(resolvedBorder);
      }
    }

    const widget = blessed.box({
      parent: screen.screen,
      top: this.y,
      left: this.x,
      width: this.width,
      height: this.height,
      clickable: Boolean(this.props.onClick),
      mouse: Boolean(this.props.onClick),
      border: borderColor ? { type: 'line' } : undefined,
      style: {
        bg: backgroundColor,
        border: borderColor ? { fg: borderColor } : undefined,
      },
    });

    if (this.props.onClick) {
      widget.on('click', (event) => {
        this.props.onClick?.(event);
      });
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
        currentX += Math.floor(
          (this.width - padding * 2 - totalMainAxisSize) / 2
        );
      } else {
        currentY += Math.floor(
          (this.height - padding * 2 - totalMainAxisSize) / 2
        );
      }
    }

    for (const child of this.children) {
      if (isRow) {
        child.x = currentX;
        child.y = this.y + padding;

        if (style && getValue(style.alignItems) === 'center') {
          child.y =
            this.y +
            padding +
            Math.floor((this.height - padding * 2 - child.height) / 2);
        }

        child.paint(screen);
        currentX += child.width + gap;
        continue;
      }

      child.x = this.x + padding;
      child.y = currentY;

      if (style && getValue(style.alignItems) === 'center') {
        child.x =
          this.x +
          padding +
          Math.floor((this.width - padding * 2 - child.width) / 2);
      }

      child.paint(screen);
      currentY += child.height + gap;
    }
  }
}

export class TerminalScreen extends EventTarget {
  screen: blessed.Widgets.Screen;
  width: number;
  height: number;

  constructor() {
    super();

    this.screen = blessed.screen({
      smartCSR: true,
      autoPadding: false,
      fullUnicode: true,
    });

    this.width = this.screen.width as number;
    this.height = this.screen.height as number;

    this.screen.key(['C-c'], () => {
      process.exit(0);
    });

    this.screen.on('resize', () => {
      this.width = this.screen.width as number;
      this.height = this.screen.height as number;
    });

    this.screen.enableMouse();
  }

  render(): void {
    this.screen.render();
  }

  clearAllWidgets(): void {
    const children = [...this.screen.children];
    for (const child of children) {
      child.destroy();
    }
  }

  destroy(): void {
    this.screen.destroy();
  }
}

export class TerminalHost extends EventTarget {
  screen: TerminalScreen;

  constructor(screen: TerminalScreen) {
    super();
    this.screen = screen;
  }

  get width(): number {
    return this.screen.width;
  }

  get height(): number {
    return this.screen.height;
  }

  render(): void {
    this.screen.render();
  }
}

export class TerminalRenderer implements Renderer<TerminalRendererTypes> {
  host: TerminalHost;
  root: BoxNode;
  observer = null;
  capabilities = {
    supportsSetupEffects: true,
    supportsObserverConnectedCallbacks: false,
  };
  #renderPending = false;

  constructor(host: TerminalHost) {
    this.host = host;
    this.root = new BoxNode('root');

    this.host.screen.screen.on('resize', () => {
      this.flush();
    });

    setTimeout(() => {
      this.flush();
    }, 10);
  }

  flush(): void {
    const width = this.host.width;
    const height = this.host.height;

    this.root.x = 0;
    this.root.y = 0;
    this.root.width = width;
    this.root.height = height;
    this.root.measure(width, height);
    this.root.x = 0;
    this.root.y = 0;
    this.root.width = width;
    this.root.height = height;

    this.host.screen.clearAllWidgets();
    this.root.paint(this.host.screen);
    this.host.render();
  }

  requestRender(): void {
    if (this.#renderPending) {
      return;
    }

    this.#renderPending = true;
    setImmediate(() => {
      this.#renderPending = false;
      this.flush();
    });
  }

  render(app: unknown): TerminalNode | TerminalNode[] {
    return normalizeJsxChild(app, this);
  }

  isActive(_node: TerminalNode): boolean {
    return true;
  }

  createGroup(): TerminalNode[] {
    return [];
  }

  unwrapGroup(group: TerminalNode[]): TerminalNode[] {
    return group;
  }

  createGroupHandle(group: TerminalNode[]): TerminalHandle {
    const start = new MarkerNode();
    const end = new MarkerNode();
    group.unshift(start);
    group.push(end);
    return [start, end];
  }

  createContainer(
    tagname: string,
    props: TerminalNodeProps = {}
  ): TerminalContainerNode {
    if (tagname === 'text') {
      return new TextContainerNode(props);
    }

    return new BoxNode(tagname, props);
  }

  createText(text: string): TerminalTextNode {
    return new TextNode(String(text));
  }

  updateText(text: string, node: TerminalTextNode): TerminalTextNode {
    node.text = text;
    this.requestRender();
    return node;
  }

  append(
    parent: TerminalNode,
    children: TerminalNode | TerminalNode[]
  ): TerminalNode {
    const nodes = toNodeArray(children);
    for (const node of nodes) {
      node.parent = parent;
      parent.children.push(node);
    }

    this.requestRender();
    return parent;
  }

  write(handle: TerminalHandle, newContent: TerminalNode[]): void {
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
    handle: TerminalHandle,
    options: ReconcilerOptions<TerminalNode>
  ): void {
    this.write(handle, collectReconciledNodes(options));
  }

  setProperty<N extends TerminalNode>(node: N, key: string, value: unknown): N {
    if (Cell.isCell(value)) {
      value.listen((nextValue) => {
        this.setProperty(node, key, nextValue);
      });
      return this.setProperty(node, key, value.get());
    }

    if (key === 'style' && value) {
      const currentStyle = node.props.style;
      if (!currentStyle) {
        node.props.style = value as TerminalNodeProps['style'];
      } else {
        node.props.style = {
          ...currentStyle,
          ...(value as TerminalNodeProps['style']),
        };
      }
      this.requestRender();
      return node;
    }

    Reflect.set(node.props, key, value);
    this.requestRender();
    return node;
  }

  handleComponent(
    tagname: __HMR_UpdatableFn,
    props: unknown[]
  ): TerminalNode | TerminalNode[] {
    const template = tagname(...props);
    const nodes = createNodesFromTemplate(template, this) as TerminalNode[];
    if (nodes.length === 1) {
      return nodes[0];
    }

    return nodes;
  }

  saveContainerState(): null {
    return null;
  }

  restoreContainerState(): void {}

  isGroup(node: unknown): node is TerminalNode[] {
    return Array.isArray(node);
  }

  isNode(child: unknown): child is TerminalNode {
    return child instanceof BaseNode;
  }
}
