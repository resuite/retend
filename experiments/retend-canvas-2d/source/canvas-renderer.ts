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

import type { AnimationDefinition, CanvasKeyboardEventName } from './types';
import type { WorkerContextEventMessage } from './worker-context/types';

import { FrameBuilder } from './frame-builder';
import { replay } from './replay';
import {
  CanvasAnchor,
  CanvasContainer,
  CanvasFragment,
  CanvasHost,
  CanvasNode,
  CanvasKeyboardEvent,
  CanvasPointerEvent,
  type CanvasRange,
  CanvasRect,
  CanvasCircle,
  CanvasTextContainer,
  CanvasPath,
  CanvasShape,
  CanvasImage,
  CanvasParticles,
  type CanvasTag,
  CanvasText,
  collectReconciledNodes,
  setAttribute,
  write,
  CanvasRoot,
} from './tree';
import { tickAnimations, type CanvasAnimation } from './tree/animations';

interface CanvasRenderingTypes {
  Node: CanvasNode;
  Handle: CanvasRange;
  Text: CanvasText;
  Container: CanvasContainer;
  Group: CanvasFragment;
  Host: CanvasHost;
}

interface ViewPort {
  width: number;
  height: number;
}

type CanvasRendererInterface = Renderer<CanvasRenderingTypes>;
type Listener = (event: CanvasKeyboardEvent) => void;

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
  observer: Observer | null = null;
  root: CanvasContainer;
  #state?: StateSnapshot;
  #viewport: ViewPort;
  #animations: CanvasAnimation[] = [];
  #capturedPointerTargets = new Map<number, CanvasNode>();
  #activePointers = new Set<number>();
  #keyListeners = {
    keydown: new Set<Listener>(),
    keyup: new Set<Listener>(),
  };

  nextNodeId = 1;
  nodeMap = new Map<number, CanvasNode>();
  #renderFrame: number | null = null;
  #frame = new FrameBuilder();
  #frameDirty = true;

  capabilities: Capabilities = {
    supportsObserverConnectedCallbacks: true,
    supportsSetupEffects: true,
  };

  get viewport() {
    return this.#viewport;
  }

  constructor(host: CanvasHost, viewport: ViewPort) {
    this.host = host;
    this.root = new CanvasRoot(this);
    this.#viewport = viewport;
    this.drawToScreen = this.drawToScreen.bind(this);
  }

  updateViewport(viewport: ViewPort) {
    this.#viewport = viewport;
    this.requestRender();
  }

  requestRender() {
    this.#frameDirty = true;
    if (this.#renderFrame !== null) return;
    this.#renderFrame = requestAnimationFrame(this.drawToScreen);
  }

  scheduleAnimations(animations: CanvasAnimation[]) {
    this.#animations.push(...animations);
    this.requestRender();
  }

  hasAnimation(node: CanvasContainer, type: AnimationDefinition) {
    return this.#animations.some((animation) => {
      return animation.target === node && animation.definition === type;
    });
  }

  cancelAnimation(node: CanvasContainer, type: AnimationDefinition) {
    const index = this.#animations.findIndex((animation) => {
      return animation.target === node && animation.definition === type;
    });
    if (index === -1) return undefined;
    const [animation] = this.#animations.splice(index, 1);
    this.requestRender();
    return animation;
  }

  setPointerCapture(node: CanvasNode, pointerId: number) {
    if (!this.#activePointers.has(pointerId)) {
      throw new DOMException(
        `No active pointer with id ${pointerId}.`,
        'NotFoundError'
      );
    }
    this.#capturedPointerTargets.set(pointerId, node);
  }

  releasePointerCapture(node: CanvasNode, pointerId: number) {
    if (!this.#activePointers.has(pointerId)) {
      throw new DOMException(
        `No active pointer with id ${pointerId}.`,
        'NotFoundError'
      );
    }
    if (this.#capturedPointerTargets.get(pointerId) === node) {
      this.#capturedPointerTargets.delete(pointerId);
    }
  }

  releasePointerCaptures(node: CanvasNode) {
    for (const [pointerId, capturedNode] of this.#capturedPointerTargets) {
      if (capturedNode === node) this.#capturedPointerTargets.delete(pointerId);
    }
  }

  hasPointerCapture(node: CanvasNode, pointerId: number) {
    return this.#capturedPointerTargets.get(pointerId) === node;
  }

  addKeyboardListener(name: CanvasKeyboardEventName, listener: Listener) {
    this.#keyListeners[name].add(listener);
  }

  removeKeyboardListener(name: CanvasKeyboardEventName, listener: Listener) {
    this.#keyListeners[name].delete(listener);
  }

  drawToScreen() {
    if (this.#renderFrame !== null) {
      cancelAnimationFrame(this.#renderFrame);
      this.#renderFrame = null;
    }
    const { ctx, hitCtx } = this.host;
    const hitCanvas = hitCtx.canvas;
    hitCanvas.width = Math.round(this.#viewport.width);
    hitCanvas.height = Math.round(this.#viewport.height);
    const hasRunningAnimations = tickAnimations(this.#animations);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    hitCtx.clearRect(0, 0, hitCanvas.width, hitCanvas.height);

    this.host.scopeWidth = this.#viewport.width;
    this.host.scopeHeight = this.#viewport.height;
    if (this.#frameDirty || hasRunningAnimations) {
      this.root.layout();
      this.#frame.reset();
      this.root.emit(this.#frame);
      this.#frameDirty = false;
    }
    replay(ctx, this.#frame.commands, this.#frame);
    replay(hitCtx, this.#frame.hitCommands, this.#frame, true);
    if (hasRunningAnimations) this.requestRender();
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
      case 'particles':
        return new CanvasParticles(this);
      default:
        return new CanvasRect(this);
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

  dispatchEvent(message: WorkerContextEventMessage) {
    switch (message.kind) {
      case 'keyboard': {
        const { eventName } = message.data;
        const listeners = this.#keyListeners[eventName];
        if (listeners.size === 0) return;
        const keyboardEvent = new CanvasKeyboardEvent(eventName, message);
        for (const listener of listeners) {
          try {
            listener(keyboardEvent);
          } catch (e) {
            console.error(e);
          }
        }
        return;
      }
      case 'pointer': {
        const { eventName, x, y, pointerId } = message.data;
        const capturedTarget = this.#capturedPointerTargets.get(pointerId);
        if (eventName === 'pointerdown') this.#activePointers.add(pointerId);
        const target =
          capturedTarget &&
          (eventName === 'pointermove' || eventName === 'pointerup')
            ? capturedTarget
            : this.resolvePointerTarget(x, y);
        if (target) {
          const event = CanvasPointerEvent.fromMessage(message, target);
          let current: CanvasNode | null = target;

          while (current) {
            current.dispatchEvent(event);
            if (event.cancelBubble) break;
            current = current.parent;
          }
        }

        if (eventName === 'pointerup') {
          this.#capturedPointerTargets.delete(pointerId);
          this.#activePointers.delete(pointerId);
        }
        return;
      }
    }
  }

  resolvePointerTarget(x: number, y: number) {
    const hitCanvas = this.host.hitCtx.canvas;
    const sampleX = Math.floor(x);
    const sampleY = Math.floor(y);
    if (sampleX < 0 || sampleY < 0) return null;
    if (sampleX >= hitCanvas.width) return null;
    if (sampleY >= hitCanvas.height) return null;

    const pixel = this.host.hitCtx.getImageData(sampleX, sampleY, 1, 1).data;
    const id = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
    if (id === 0) return null;

    return this.nodeMap.get(id);
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
 * @returns A Promise that resolves to the CanvasRenderer instance after setup effects have run and the first frame has been painted
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
  renderer.drawToScreen();
  return renderer;
}
