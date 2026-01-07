import type {
  TerminalNode,
  TerminalTextNode,
  TerminalContainerNode,
  TerminalHandle,
  TerminalNodeProps,
  TerminalRendererTypes,
} from './types';
import {
  createNodesFromTemplate,
  Cell,
  type Renderer,
  type __HMR_UpdatableFn,
} from 'retend';
import blessed from 'blessed';
import { getValue, resolveForTerminal } from '../shared/units';

// --- Color Helpers ---

const colors: Record<string, string | number> = {
  black: 'black',
  red: 'red',
  green: 'green',
  yellow: 'yellow',
  blue: 'blue',
  magenta: 'magenta',
  cyan: 'cyan',
  white: 'white',
  gray: 248,
  grey: 248,
};

function parseColor(color: string): string | number {
  if (!color) return '';

  if (color.startsWith('#')) {
    return color; // blessed supports hex colors
  }

  const mapped = colors[color.toLowerCase()];
  if (mapped !== undefined) return mapped;

  return color; // Return as-is, blessed may understand it
}

/**
 * Resolve a style dimension value, handling Cell values and unit conversion
 */
function resolveDimension(
  value: unknown,
  parentSize?: number
): number | undefined {
  const unwrapped = getValue(value);
  if (unwrapped === undefined || unwrapped === null) return undefined;
  if (typeof unwrapped === 'string') {
    return resolveForTerminal(unwrapped, parentSize);
  }
  // Fallback for raw numbers (shouldn't happen with proper types)
  if (typeof unwrapped === 'number') {
    return Math.floor(unwrapped / 8); // Convert pixels to chars
  }
  return undefined;
}

// --- Blessed Screen Wrapper ---

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

    // Handle Ctrl+C to exit
    this.screen.key(['C-c'], () => {
      process.exit(0);
    });

    // Handle resize
    this.screen.on('resize', () => {
      this.width = this.screen.width as number;
      this.height = this.screen.height as number;
    });

    // Enable mouse support
    this.screen.enableMouse();
  }

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  render() {
    this.screen.render();
  }

  clearAllWidgets() {
    // Remove all children from the screen
    const children = [...this.screen.children];
    for (const child of children) {
      child.destroy();
    }
  }

  destroy() {
    this.screen.destroy();
  }
}

// --- Nodes ---

class BaseNode implements TerminalNode {
  type = 'node';
  parent: TerminalNode | null = null;
  children: TerminalNode[] = [];
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  props: TerminalNodeProps = {};
  blessedWidget: blessed.Widgets.BlessedElement | null = null;

  constructor(type: string, props: TerminalNodeProps = {}) {
    this.type = type;
    this.props = props;
  }

  destroy() {
    if (this.blessedWidget) {
      this.blessedWidget.destroy();
      this.blessedWidget = null;
    }
  }

  measure(_availableWidth?: number, _availableHeight?: number) {
    const style = this.props.style || {};
    this.width = resolveDimension(style.width, _availableWidth) || 0;
    this.height = resolveDimension(style.height, _availableHeight) || 0;
  }

  paint(_screen: TerminalScreen) {
    // Base does nothing visible
  }

  syncToBlessedWidget(_screen: TerminalScreen) {
    // Override in subclasses
  }
}

class BoxNode extends BaseNode implements TerminalContainerNode {
  measure(availableWidth?: number, availableHeight?: number) {
    // --- SIZING PASS: Calculate sizes recursively ---

    const style = this.props.style || {};
    const isRoot = this.type === 'root';

    // Resolve dimensions with parent size for percentages
    const resolvedWidth = resolveDimension(style.width, availableWidth);
    const resolvedHeight = resolveDimension(style.height, availableHeight);

    if (resolvedWidth !== undefined) {
      this.width = resolvedWidth;
    } else if (isRoot && availableWidth) {
      this.width = availableWidth;
    } else if (!isRoot) {
      this.width = 0;
    }

    if (resolvedHeight !== undefined) {
      this.height = resolvedHeight;
    } else if (!isRoot) {
      this.height = 0;
    }

    const whiteSpace = getValue(style.whiteSpace);
    let flexDirection = getValue(style.flexDirection);
    if (!flexDirection && whiteSpace === 'nowrap') flexDirection = 'row';
    flexDirection = flexDirection || 'column';

    const padding = resolveDimension(style.padding, this.width) || 0;
    // Blessed borders take 2 chars total (1 left, 1 right) - must account for this in available space
    const borderColor = getValue(style.borderColor);
    const borderWidth = borderColor ? 2 : 0;

    let totalChildWidth = 0;
    let totalChildHeight = 0;
    let maxChildWidth = 0;
    let maxChildHeight = 0;

    // Available width for children = total width minus padding on both sides minus border
    let childAvailableWidth: number | undefined;
    if (this.width) {
      childAvailableWidth = this.width - padding * 2 - borderWidth;
    } else if (isRoot && resolvedWidth) {
      childAvailableWidth = resolvedWidth - padding * 2 - borderWidth;
    } else if (availableWidth) {
      childAvailableWidth = availableWidth - padding * 2 - borderWidth;
    }

    // Available height for children
    let childAvailableHeight: number | undefined;
    if (this.height) {
      childAvailableHeight = this.height - padding * 2 - borderWidth;
    } else if (isRoot && resolvedHeight) {
      childAvailableHeight = resolvedHeight - padding * 2 - borderWidth;
    } else if (availableHeight) {
      childAvailableHeight = availableHeight - padding * 2 - borderWidth;
    }

    // First pass: Measure children (grouping consecutive text nodes)
    let i = 0;
    while (i < this.children.length) {
      const child = this.children[i];

      if (child.type === 'text-inner') {
        // Find consecutive text nodes
        let j = i + 1;
        const first = child as TextNode;
        let combinedText = first.text;
        const group = [first];

        while (
          j < this.children.length &&
          this.children[j].type === 'text-inner'
        ) {
          const sibling = this.children[j] as TextNode;
          combinedText += sibling.text;
          group.push(sibling);
          j++;
        }

        if (group.length > 1) {
          // Measure the first node with combined text
          const originalText = first.text;
          first.text = combinedText;
          first.measure(childAvailableWidth, childAvailableHeight);
          first.text = originalText;

          // Clear sibling dimensions so they don't take space
          for (let k = 1; k < group.length; k++) {
            const sibling = group[k];
            sibling.width = 0;
            sibling.height = 0;
            sibling.wrappedLines = [];
          }
          i = j;

          // Add to totals
          const childStyle = first.props.style || {};
          if (getValue(childStyle.position) !== 'absolute') {
            if (flexDirection === 'column') {
              totalChildHeight += first.height;
              maxChildWidth = Math.max(maxChildWidth, first.width);
            } else {
              totalChildWidth += first.width;
              maxChildHeight = Math.max(maxChildHeight, first.height);
            }
          }
          continue;
        }
      }

      child.measure(childAvailableWidth, childAvailableHeight);
      const childStyle = child.props.style || {};
      if (getValue(childStyle.position) !== 'absolute') {
        if (flexDirection === 'column') {
          totalChildHeight += child.height;
          maxChildWidth = Math.max(maxChildWidth, child.width);
        } else {
          totalChildWidth += child.width;
          maxChildHeight = Math.max(maxChildHeight, child.height);
        }
      }
      i++;
    }

    if (!this.width && !isRoot) {
      this.width =
        (flexDirection === 'column' ? maxChildWidth : totalChildWidth) +
        padding * 2;
    }
    if (!this.height && !isRoot) {
      this.height =
        (flexDirection === 'column' ? totalChildHeight : maxChildHeight) +
        padding * 2;
    }

    if (!this.width && !isRoot) this.width = 0;
    if (!this.height && !isRoot) this.height = 0;
  }

  layout() {
    // --- LAYOUT PASS: Position children based on this node's position ---
    const style = this.props.style || {};
    const whiteSpace = getValue(style.whiteSpace);
    let flexDirection = getValue(style.flexDirection);
    if (!flexDirection && whiteSpace === 'nowrap') flexDirection = 'row';
    flexDirection = flexDirection || 'column';

    const padding = resolveDimension(style.padding, this.width) || 0;
    const alignItems = getValue(style.alignItems) || 'flex-start';
    const justifyContent = getValue(style.justifyContent) || 'flex-start';
    const availWidth = this.width - padding * 2;
    const availHeight = this.height - padding * 2;

    // Gap support
    const columnGap = resolveDimension(style.columnGap, this.width) || 0;
    const rowGap = resolveDimension(style.rowGap, this.height) || 0;
    const gap = flexDirection === 'row' ? columnGap : rowGap;

    let totalChildExtent = 0;
    const flowChildren = this.children.filter(
      (c) => getValue(c.props.style?.position) !== 'absolute'
    );

    const totalGaps = flowChildren.length > 1 ? (flowChildren.length - 1) * gap : 0;

    if (flexDirection === 'column') {
      totalChildExtent = flowChildren.reduce((acc, c) => acc + c.height, 0) + totalGaps;
    } else {
      totalChildExtent = flowChildren.reduce((acc, c) => acc + c.width, 0) + totalGaps;
    }

    let startOffset = 0;
    if (justifyContent === 'center') {
      const axisSize = flexDirection === 'column' ? availHeight : availWidth;
      startOffset = Math.floor((axisSize - totalChildExtent) / 2);
      if (startOffset < 0) startOffset = 0;
    } else if (justifyContent === 'flex-end') {
      const axisSize = flexDirection === 'column' ? availHeight : availWidth;
      startOffset = axisSize - totalChildExtent;
    }

    let currentX = this.x + padding;
    let currentY = this.y + padding;
    if (flexDirection === 'column') currentY += startOffset;
    else currentX += startOffset;

    for (const child of this.children) {
      const childStyle = child.props.style || {};
      if (getValue(childStyle.position) === 'absolute') {
        const left = resolveDimension(childStyle.left, this.width) || 0;
        const top = resolveDimension(childStyle.top, this.height) || 0;
        child.x = this.x + left;
        child.y = this.y + top;
        // Recursively layout absolute children
        if ('layout' in child && typeof child.layout === 'function') {
          child.layout();
        }
        continue;
      }

      let childX = currentX;
      let childY = currentY;

      if (flexDirection === 'column') {
        if (alignItems === 'center')
          childX =
            this.x + padding + Math.floor(availWidth / 2 - child.width / 2);
        else if (alignItems === 'flex-end')
          childX = this.x + this.width - padding - child.width;
        else childX = this.x + padding;
        childY = currentY;
        currentY += child.height + gap;
      } else {
        if (alignItems === 'center')
          childY =
            this.y + padding + Math.floor(availHeight / 2 - child.height / 2);
        else if (alignItems === 'flex-end')
          childY = this.y + this.height - padding - child.height;
        else childY = this.y + padding;
        childX = currentX;
        currentX += child.width + gap;
      }
      child.x = childX;
      child.y = childY;

      // Recursively layout children after setting their position
      if ('layout' in child && typeof child.layout === 'function') {
        child.layout();
      }
    }
  }

  syncToBlessedWidget(screen: TerminalScreen) {
    const style = this.props.style || {};
    const bg = getValue(style.backgroundColor);
    const fg = getValue(style.color);
    const borderColor = getValue(style.borderColor);

    // Create or update blessed box
    if (!this.blessedWidget) {
      this.blessedWidget = blessed.box({
        parent: screen.screen,
        top: this.y,
        left: this.x,
        width: this.width,
        height: this.height,
        transparent: !bg,
        border: borderColor ? { type: 'line' } : undefined,
        style: {
          bg: bg ? parseColor(bg) : undefined,
          fg: fg ? parseColor(fg) : undefined,
          transparent: !bg,
          border: borderColor
            ? {
                fg: parseColor(borderColor),
                bg: 'black', // Prevent corner artifacts
              }
            : undefined,
        },
        clickable: !!this.props.onClick,
      });

      // Handle click events
      if (this.props.onClick) {
        this.blessedWidget.on('click', (data) => {
          this.props.onClick?.(data);
        });
      }
    } else {
      // Update position and dimensions
      this.blessedWidget.top = this.y;
      this.blessedWidget.left = this.x;
      this.blessedWidget.width = this.width;
      this.blessedWidget.height = this.height;

      // Update style
      if (bg) {
        this.blessedWidget.style.bg = parseColor(bg);
      }
      if (fg) {
        this.blessedWidget.style.fg = parseColor(fg);
      }
    }

    // Sync children
    for (const child of this.children) {
      child.syncToBlessedWidget(screen);
    }
  }

  paint(screen: TerminalScreen) {
    // Sync to blessed widget
    this.syncToBlessedWidget(screen);
  }

  destroy() {
    // Destroy children first
    for (const child of this.children) {
      child.destroy();
    }
    super.destroy();
  }
}

export class TextNode extends BaseNode implements TerminalTextNode {
  text: string;
  wrappedLines: string[] | null = null;

  constructor(text: string, props: TerminalNodeProps) {
    super('text-inner', props);
    this.text = text;
  }

  measure(availableWidth?: number, _availableHeight?: number) {
    const str = String(this.text);

    if (!availableWidth || str.length <= availableWidth) {
      // No wrapping needed
      // +1 to account for blessed's transparent text clipping bug
      this.width = str.length + 1;
      this.height = 1;
      this.wrappedLines = null;
      return;
    }

    // Wrap text to fit available width
    const lines: string[] = [];
    const words = str.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (testLine.length <= availableWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Single word longer than available width - force break
          lines.push(word.substring(0, availableWidth));
          currentLine = word.substring(availableWidth);
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    // +1 to account for blessed's transparent text clipping bug
    this.width = Math.max(...lines.map((l) => l.length)) + 1;
    this.height = lines.length;
    this.wrappedLines = lines;
  }

  syncToBlessedWidget(screen: TerminalScreen) {
    // Skip rendering if this text node was collapsed (width/height = 0)
    if (this.width === 0 && this.height === 0) {
      return;
    }

    let fgColor: string | number = '';
    let bgColor: string | number = '';
    let isBold = false;
    let isUnderline = false;
    let textAlign = 'left';

    // Build style chain for inherited styles
    let p = this.parent;
    while (p) {
      const s = p.props.style || {};
      const C = getValue(s.color);
      if (C && !fgColor) {
        fgColor = parseColor(C);
      }
      const bg = getValue(s.backgroundColor);
      if (bg && !bgColor) {
        bgColor = parseColor(bg);
      }
      const fw = getValue(s.fontWeight);
      if (fw === 'bold' && !isBold) {
        isBold = true;
      }
      const td = getValue(s.textDecoration);
      if (td === 'underline' && !isUnderline) {
        isUnderline = true;
      }
      const ta = getValue(s.textAlign);
      if (ta && textAlign === 'left') {
        textAlign = ta;
      }
      p = p.parent;
    }

    // Gather text from consecutive text siblings
    let combinedText = this.text;
    if (this.parent) {
      const siblings = this.parent.children;
      const myIndex = siblings.indexOf(this);
      for (let i = myIndex + 1; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling.type === 'text-inner') {
          combinedText += (sibling as TextNode).text;
        } else {
          break;
        }
      }
    }

    // Apply text alignment to each line
    let lines = this.wrappedLines ? [...this.wrappedLines] : [combinedText];
    const maxWidth = Math.max(...lines.map((l) => l.length));

    if (textAlign === 'center') {
      lines = lines.map((line) => {
        const padding = Math.floor((maxWidth - line.length) / 2);
        return ' '.repeat(padding) + line;
      });
    } else if (textAlign === 'right') {
      lines = lines.map((line) => {
        const padding = maxWidth - line.length;
        return ' '.repeat(padding) + line;
      });
    }

    // Add trailing space to prevent blessed from clipping last character in transparent text
    const content = `${lines.join('\n')} `;

    // Use transparency only if no parent has a background color
    const useTransparency = !bgColor;

    // Create or update blessed text element
    if (!this.blessedWidget) {
      this.blessedWidget = blessed.text({
        parent: screen.screen,
        top: this.y,
        left: this.x,
        width: this.width,
        height: this.height,
        content: content,
        transparent: useTransparency,
        style: {
          fg: fgColor || undefined,
          bg: bgColor || undefined,
          bold: isBold,
          underline: isUnderline,
          transparent: useTransparency,
        },
      });
    } else {
      // Update position and dimensions
      this.blessedWidget.top = this.y;
      this.blessedWidget.left = this.x;
      this.blessedWidget.width = this.width;
      this.blessedWidget.height = this.height;
      this.blessedWidget.setContent(content);

      if (fgColor) {
        this.blessedWidget.style.fg = fgColor;
      }
      if (bgColor) {
        this.blessedWidget.style.bg = bgColor;
      }
      this.blessedWidget.style.bold = isBold;
    }
  }

  paint(screen: TerminalScreen) {
    this.syncToBlessedWidget(screen);
  }
}

class MarkerNode extends BaseNode {
  constructor(public name: string) {
    super('marker');
  }
  measure() {}
  paint() {}
  syncToBlessedWidget() {}
}

export class TerminalHost extends EventTarget {
  screen: TerminalScreen;
  constructor(screen: TerminalScreen) {
    super();
    this.screen = screen;
  }
  get width() {
    return this.screen.width;
  }
  get height() {
    return this.screen.height;
  }

  render() {
    this.screen.render();
  }
}

export class TerminalRenderer implements Renderer<TerminalRendererTypes> {
  host: TerminalHost;
  root: BoxNode;

  constructor(host: TerminalHost) {
    this.host = host;
    this.root = new BoxNode('root', {});

    // Handle resize via blessed screen events
    this.host.screen.screen.on('resize', () => {
      this.host.screen.resize(
        this.host.screen.screen.width as number,
        this.host.screen.screen.height as number
      );
      this.destroyAllWidgets();
      this.render();
    });

    setTimeout(() => this.render(), 10);
  }

  destroyAllWidgets() {
    // Recursively destroy all blessed widgets to recreate on resize
    const destroyWidgets = (node: TerminalNode) => {
      if ((node as BaseNode).blessedWidget) {
        (node as BaseNode).blessedWidget?.destroy();
        (node as BaseNode).blessedWidget = null;
      }
      for (const child of node.children) {
        destroyWidgets(child);
      }
    };
    destroyWidgets(this.root);
  }

  private renderPending = false;

  requestRender() {
    if (this.renderPending) return;
    this.renderPending = true;

    // Use setImmediate to batch renders after tree construction completes
    setImmediate(() => {
      this.renderPending = false;
      this.render();
    });
  }

  render() {
    // 1. Resize root - pass viewport dimensions as available size for percentage resolution
    this.root.width = this.host.width;
    this.root.height = this.host.height;
    this.root.x = 0;
    this.root.y = 0;

    // 2. Measure (computes all sizes)
    this.root.measure(this.host.width, this.host.height);

    // 3. Layout (computes all positions based on parent positions)
    this.root.layout();

    // 4. Clear ALL widgets from screen (including orphans)
    this.host.screen.clearAllWidgets();
    this.destroyAllWidgets();

    // 5. Paint (sync to blessed widgets with correct positions)
    this.root.paint(this.host.screen);

    // 6. Render blessed screen
    this.host.render();
  }

  // --- Interface minimal impl ---
  isActive(_node: TerminalNode): boolean {
    return true;
  }
  onViewChange(_processor: () => void) {}
  createGroup(input?: TerminalNode | TerminalNode[]) {
    return Array.isArray(input) ? input : [input || new MarkerNode('')];
  }
  unwrapGroup(group: TerminalNode[]) {
    return group;
  }
  createGroupHandle(group: TerminalNode[]): TerminalHandle {
    const s = new MarkerNode('s');
    const e = new MarkerNode('e');
    group.unshift(s);
    group.push(e);
    return [s, e];
  }

  createContainer(tagname: string, props: TerminalNodeProps) {
    if (tagname === 'root') {
      this.root.props = props;
      return this.root;
    }
    return new BoxNode(tagname, props);
  }

  createText(text: string | Cell<unknown>) {
    if (Cell.isCell(text)) {
      const n = new TextNode(String(text.get()), {});
      text.listen((v) => {
        n.text = String(v);
        // Destroy old widget so it gets recreated
        if (n.blessedWidget) {
          n.blessedWidget.destroy();
          n.blessedWidget = null;
        }
        this.requestRender();
      });
      return n;
    }
    return new TextNode(String(text), {});
  }

  append(parent: TerminalNode, child: TerminalNode | TerminalNode[]) {
    if (!parent) return parent;
    const arr = Array.isArray(child) ? child : [child];
    for (const c of arr) {
      c.parent = parent;
      parent.children.push(c);
    }
    this.requestRender();
    return parent;
  }

  write(handle: TerminalHandle, newContent: TerminalNode[]) {
    const [start, end] = handle;
    const parent = start.parent;
    if (!parent) return;
    const startIndex = parent.children.indexOf(start);
    const endIndex = parent.children.indexOf(end);
    if (startIndex === -1) return;

    // Destroy widgets for nodes being removed
    const toRemove = parent.children.slice(startIndex + 1, endIndex);
    for (const node of toRemove) {
      node.destroy();
    }

    parent.children.splice(
      startIndex + 1,
      endIndex - startIndex - 1,
      ...newContent
    );
    for (const n of newContent) {
      n.parent = parent;
    }
    this.requestRender();
  }

  setProperty<N extends TerminalNode>(node: N, key: string, value: unknown): N {
    if (Cell.isCell(value)) {
      value.listen((v) => this.setProperty(node, key, v));
      return this.setProperty(node, key, value.get());
    }
    if (key === 'style' && typeof value === 'object') {
      node.props.style = { ...node.props.style, ...value };
    } else {
      Reflect.set(node.props, key, value);
    }
    this.requestRender();
    return node;
  }

  handleComponent(
    tag: __HMR_UpdatableFn,
    props: unknown
  ): TerminalNode | TerminalNode[] {
    const c = tag(props);
    return createNodesFromTemplate(c, this) as TerminalNode[];
  }

  // Unused strict methods
  finalize(n: TerminalNode) {
    return n;
  }
  isGroup(n: unknown): n is TerminalNode[] {
    return Array.isArray(n);
  }
  isNode(n: unknown): n is TerminalNode {
    return n instanceof BaseNode;
  }
  handlePromise() {
    return new MarkerNode('p');
  }
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  reconcile(handle: any, options: any) {
    // Minimal impl
    this.write(handle, options.nodes || []);
  }
  selectMatchingNodes() {
    return [];
  }
  selectMatchingNode() {
    return null;
  }
  saveContainerState() {
    return null;
  }
  restoreContainerState() {}

  updateText(t: string, n: TextNode) {
    n.text = t;
    if (n.blessedWidget) {
      n.blessedWidget?.destroy();
      n.blessedWidget = null;
    }
    this.requestRender();
    return n;
  }

  observer = null;
  capabilities = {
    supportsSetupEffects: true,
    supportsObserverConnectedCallbacks: false,
  };
}
