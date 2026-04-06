import type { JSX } from 'retend/jsx-runtime';

import {
  getState,
  normalizeJsxChild,
  type Observer,
  withState,
  type Renderer,
  type ReconcilerOptions,
  type __HMR_UpdatableFn,
  type StateSnapshot,
  type Capabilities,
  setActiveRenderer,
  runPendingSetupEffects,
  createNodesFromTemplate,
} from 'retend';

import {
  CanvasAnchor,
  CanvasContainer,
  CanvasFragment,
  CanvasHost,
  CanvasNode,
  CanvasPointerEvent,
  type CanvasRange,
  CanvasRect,
  CanvasCircle,
  CanvasTextContainer,
  CanvasPath,
  CanvasShape,
  CanvasImage,
  type CanvasTag,
  CanvasText,
  collectReconciledNodes,
  setAttribute,
  write,
  CanvasRoot,
} from './tree';
import {
  type CanvasTransition,
  stepCanvasTransitions,
} from './tree/transitions';

interface CanvasRenderingTypes {
  Node: CanvasNode;
  Handle: CanvasRange;
  Text: CanvasText;
  Container: CanvasContainer;
  Group: CanvasFragment;
  Host: CanvasHost;
}

type CanvasRendererInterface = Renderer<CanvasRenderingTypes>;

/**
 * The CanvasRenderer class implements the Renderer interface for rendering
 * JSX components to an HTML5 Canvas 2D context.
 *
 * This renderer manages a tree of canvas nodes, handling component lifecycle,
 * state updates, and property bindings. It supports reactive updates through
 * Cells and AsyncCells, and provides methods for creating and manipulating
 * the canvas node tree.
 */
export class CanvasRenderer implements CanvasRendererInterface {
  host: CanvasHost;
  observer: Observer | null;
  #state?: StateSnapshot;
  root: CanvasContainer;
  transformMatrix = new DOMMatrix();
  #viewport: { width: number; height: number };
  transitions: CanvasTransition[];
  nextNodeId = 1;
  nodeMap = new Map<number, CanvasNode>();
  #renderFrame: number | null = null;

  get viewport() {
    return this.#viewport;
  }

  capabilities: Capabilities = {
    supportsObserverConnectedCallbacks: true,
    supportsSetupEffects: true,
  };

  constructor(host: CanvasHost, viewport: { width: number; height: number }) {
    this.host = host;
    this.observer = null;
    this.root = new CanvasRoot(this);
    this.root.setConnected(true);
    this.#viewport = viewport;
    this.transitions = [];
  }

  requestRender(viewport?: { width: number; height: number }) {
    if (viewport) this.#viewport = viewport;
    if (this.#renderFrame !== null) return;
    this.#renderFrame = requestAnimationFrame(() => {
      const hitCanvas = this.host.hitCtx.canvas;
      hitCanvas.width = Math.round(this.#viewport.width);
      hitCanvas.height = Math.round(this.#viewport.height);
      this.#renderFrame = null;
      const hasTransitions = stepCanvasTransitions(this);
      this.host.ctx.clearRect(
        0,
        0,
        this.host.ctx.canvas.width,
        this.host.ctx.canvas.height
      );
      this.host.hitCtx.clearRect(0, 0, hitCanvas.width, hitCanvas.height);
      this.host.scopeWidth = this.#viewport.width;
      this.host.scopeHeight = this.#viewport.height;
      this.root.draw();
      if (hasTransitions) this.requestRender();
    });
  }

  render(app: JSX.Template): CanvasNode | CanvasNode[] {
    this.#state = getState();

    return withState(this.#state, () => {
      const result = normalizeJsxChild(app, this);
      if (Array.isArray(result)) {
        for (const child of result) this.root.append(child);
      } else this.root.append(result);
      return result;
    });
  }

  createGroup(): CanvasFragment {
    return new CanvasFragment(this);
  }

  createContainer(tagname: CanvasTag): CanvasContainer {
    switch (tagname) {
      case 'rect':
        return new CanvasRect(this);
      case 'circle':
        return new CanvasCircle(this);
      case 'text':
        return new CanvasTextContainer(this);
      case 'path':
        return new CanvasPath(this);
      case 'shape':
        return new CanvasShape(this);
      case 'img':
        return new CanvasImage(this);
      default:
        return new CanvasContainer(this);
    }
  }

  createText(text: string): CanvasNode {
    return new CanvasText(text, this);
  }

  isNode(child: any): child is CanvasNode {
    return child instanceof CanvasNode;
  }

  isGroup(child: any): child is CanvasFragment {
    return child instanceof CanvasFragment;
  }

  updateText(text: string, node: CanvasText): CanvasNode {
    node.content = text;
    this.requestRender();
    return node;
  }

  setProperty<N extends CanvasNode>(node: N, key: string, value: unknown): N {
    if (!(node instanceof CanvasContainer)) return node;

    setAttribute(node, key, value);
    return node;
  }

  unwrapGroup(fragment: CanvasFragment): CanvasNode[] {
    return fragment.children;
  }

  append(
    parent: CanvasContainer,
    child: CanvasNode | CanvasNode[]
  ): CanvasNode {
    parent.append(...(Array.isArray(child) ? child : [child]));
    return parent;
  }

  createGroupHandle(group: CanvasFragment): CanvasRange {
    const handleStart = new CanvasAnchor(this);
    const handleEnd = new CanvasAnchor(this);
    group.prepend(handleStart);
    group.append(handleEnd);
    return [handleStart, handleEnd];
  }

  write(handle: CanvasRange, newContent: CanvasNode[]) {
    write(handle, newContent);
    this.requestRender();
  }

  reconcile(handle: CanvasRange, options: ReconcilerOptions<CanvasNode>) {
    write(handle, collectReconciledNodes(options));
    this.requestRender();
  }

  handleComponent(
    tagnameOrFunction: __HMR_UpdatableFn,
    props: any[]
  ): CanvasNode | CanvasNode[] {
    const template = tagnameOrFunction(...props);
    const nodes = createNodesFromTemplate(template, this);
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  isActive(node: CanvasNode): boolean {
    return node.isConnected;
  }

  dispatchEvent(eventName: JSX.CanvasNodeEventName, x: number, y: number) {
    const hitCanvas = this.host.hitCtx.canvas;
    const sampleX = Math.floor(x);
    const sampleY = Math.floor(y);
    if (sampleX < 0 || sampleY < 0) return;
    if (sampleX >= hitCanvas.width) return;
    if (sampleY >= hitCanvas.height) return;

    const pixel = this.host.hitCtx.getImageData(sampleX, sampleY, 1, 1).data;
    const id = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
    if (id === 0) return;

    const target = this.nodeMap.get(id);
    if (!target) return;

    const event = new CanvasPointerEvent(eventName, x, y, target);
    let current: CanvasNode | null = target;

    while (current) {
      event.setCurrentTarget(current);
      current.dispatchEvent(event);
      if (event.propagationStopped) break;
      current = current.parent;
    }

    event.setCurrentTarget(null);
  }

  // Stubs.
  save(): number {
    throw new Error('Not implemented');
  }

  restore() {
    throw new Error('Not implemented');
  }
}

/**
 * Renders a JSX template to a 2D canvas context using the retend renderer.
 *
 * @param ctx - The 2D rendering context of a canvas element where the content will be drawn
 * @param App - A function that returns a JSX template to render
 * @returns A Promise that resolves to the CanvasRenderer instance after setup effects have run
 *
 * @example
 * ```typescript
 * const canvas = document.getElementById('canvas');
 * const ctx = canvas.getContext('2d');
 * await renderToCanvasContext(ctx, () => <MyApp />);
 * ```
 */
export async function renderToCanvasContext(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  App: () => JSX.Template
) {
  const host = new CanvasHost(ctx, ctx.canvas.width, ctx.canvas.height);
  const viewport = { width: ctx.canvas.width, height: ctx.canvas.height };
  const renderer = new CanvasRenderer(host, viewport);
  setActiveRenderer(renderer);
  renderer.render(App());
  await runPendingSetupEffects();
  return renderer;
}
