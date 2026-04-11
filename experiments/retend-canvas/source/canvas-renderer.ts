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

import type { AnimationDefinition, CanvasNodeEventName } from './types';

import {
  CommandKind,
  FrameBuilder,
  type FrameCommand,
  type ResolvedShadow,
} from './frame-builder';
import {
  CanvasAnchor,
  CanvasContainer,
  CanvasFragment,
  CanvasHost,
  CanvasNode,
  PointerEvent,
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
  nodeIdToRgb,
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
  #viewport: ViewPort;
  #animations: CanvasAnimation[];
  #capturedPointerTargets = new Map<number, CanvasNode>();
  #activePointers = new Set<number>();
  interactiveNodeCount = 0;

  nextNodeId = 1;
  nodeMap = new Map<number, CanvasNode>();
  #renderFrame: number | null = null;
  #frame = new FrameBuilder();
  #frameDirty = true;

  get viewport() {
    return this.#viewport;
  }

  capabilities: Capabilities = {
    supportsObserverConnectedCallbacks: true,
    supportsSetupEffects: true,
  };

  constructor(host: CanvasHost, viewport: ViewPort) {
    this.host = host;
    this.observer = null;
    this.root = new CanvasRoot(this);
    this.root.setConnected(true);
    this.#viewport = viewport;
    this.#animations = [];
    this.drawToScreen = this.drawToScreen.bind(this);
  }

  updateViewport(viewport: ViewPort) {
    this.#viewport = viewport;
    this.#invertedPathCache = new WeakMap();
    this.#frameDirty = true;
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

  drawToScreen() {
    const hitCanvas = this.host.hitCtx.canvas;
    const hitWidth = Math.round(this.#viewport.width);
    const hitHeight = Math.round(this.#viewport.height);
    const paintHit = this.interactiveNodeCount > 0;
    this.#renderFrame = null;
    const hasRunningAnimations = tickAnimations(this.#animations);
    const { ctx } = this.host;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (paintHit) {
      if (hitCanvas.width !== hitWidth || hitCanvas.height !== hitHeight) {
        hitCanvas.width = hitWidth;
        hitCanvas.height = hitHeight;
      }
      this.host.hitCtx.clearRect(0, 0, hitCanvas.width, hitCanvas.height);
    }
    this.host.scopeWidth = this.#viewport.width;
    this.host.scopeHeight = this.#viewport.height;
    if (this.#frameDirty || hasRunningAnimations) {
      this.root.layout();
      this.#frame.reset(paintHit);
      this.root.emit(this.#frame);
      this.#frameDirty = false;
    }
    this.replay(ctx, this.#frame.commands);
    if (paintHit) this.replay(this.host.hitCtx, this.#frame.hitCommands, true);
    if (hasRunningAnimations) this.requestRender();
  }

  #invertedPathCache = new WeakMap<Path2D, Path2D>();

  private invertedPath(path: Path2D) {
    const inverted = this.#invertedPathCache.get(path);
    if (inverted) return inverted;
    const p = new Path2D();
    p.rect(
      -10000,
      -10000,
      this.#viewport.width + 20000,
      this.#viewport.height + 20000
    );
    p.addPath(path);
    this.#invertedPathCache.set(path, p);
    return p;
  }

  replay(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    commands: FrameCommand[],
    isHit = false
  ) {
    const frame = this.#frame;
    ctx.save();
    ctx.setTransform(isHit ? new DOMMatrix() : ctx.getTransform());

    for (const command of commands) {
      const payloadIndex = command.payload;
      switch (command.kind) {
        case CommandKind.Save:
          ctx.save();
          break;
        case CommandKind.Restore:
          ctx.restore();
          break;
        case CommandKind.Transform: {
          const m = frame.transforms[payloadIndex];
          ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
          break;
        }
        case CommandKind.Alpha:
          ctx.globalAlpha *= frame.alphas[payloadIndex];
          break;
        case CommandKind.Clip:
          ctx.clip(frame.clips[payloadIndex]);
          break;
        case CommandKind.PathFill: {
          const payload = frame.pathFills[payloadIndex];
          if (isHit) {
            ctx.fillStyle = nodeIdToRgb(command.nodeId);
            ctx.fill(payload.path);
            break;
          }

          for (const shadow of payload.dropShadows) {
            ctx.save();
            ctx.clip(this.invertedPath(payload.path), 'evenodd');
            this.applyShadow(ctx, shadow);
            ctx.fillStyle = 'black';
            ctx.fill(payload.path);
            ctx.restore();
          }

          ctx.fillStyle = payload.fillStyle;
          ctx.fill(payload.path);

          for (const shadow of payload.insetShadows) {
            ctx.save();
            ctx.clip(payload.path);
            const inv = this.invertedPath(payload.path);
            this.applyShadow(ctx, shadow);
            ctx.fillStyle = shadow.color;
            ctx.fill(inv, 'evenodd');
            ctx.restore();
          }
          break;
        }
        case CommandKind.PathStroke: {
          const payload = frame.pathStrokes[payloadIndex];
          ctx.lineWidth = payload.lineWidth;
          ctx.strokeStyle = isHit
            ? nodeIdToRgb(command.nodeId)
            : payload.strokeStyle;
          ctx.setLineDash(payload.lineDash);
          ctx.stroke(payload.path);
          break;
        }
        case CommandKind.Image: {
          const payload = frame.images[payloadIndex];
          ctx.drawImage(payload.image, 0, 0, payload.width, payload.height);
          break;
        }
        case CommandKind.TextLine: {
          const payload = frame.textLines[payloadIndex];
          ctx.textBaseline = 'top';
          ctx.font = payload.font;
          ctx.fillStyle = payload.fillStyle;
          ctx.fillText(payload.text, payload.x, payload.y);
          break;
        }
        case CommandKind.Particles: {
          const payload = frame.particles[payloadIndex];
          const {
            positions,
            colorBatches,
            sizeMap,
            shape,
            baseColor,
            baseSize,
          } = payload;
          const isRect = shape === 'rect';
          const hasSizeMap =
            sizeMap instanceof Float32Array || Array.isArray(sizeMap);
          const drawAt = (i: number, r: number) => {
            if (isRect)
              ctx.rect(positions[i] - r, positions[i + 1] - r, r * 2, r * 2);
            else {
              ctx.moveTo(positions[i] + r, positions[i + 1]);
              ctx.arc(positions[i], positions[i + 1], r, 0, Math.PI * 2);
            }
          };

          if (!colorBatches) {
            ctx.fillStyle = baseColor;
            ctx.beginPath();
            for (let i = 0; i < positions.length; i += 2)
              drawAt(i, hasSizeMap ? sizeMap[i / 2] : baseSize);
            ctx.fill();
          } else {
            for (const { color, indices } of colorBatches) {
              ctx.fillStyle = color;
              ctx.beginPath();
              for (const i of indices)
                drawAt(i, hasSizeMap ? sizeMap[i / 2] : baseSize);
              ctx.fill();
            }
          }
          break;
        }
      }
    }
    ctx.restore();
  }

  private applyShadow(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    shadow: ResolvedShadow
  ) {
    ctx.shadowOffsetX = shadow.offsetX;
    ctx.shadowOffsetY = shadow.offsetY;
    ctx.shadowBlur = shadow.blur;
    ctx.shadowColor = shadow.color;
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

  dispatchEvent(
    eventName: CanvasNodeEventName,
    x: number,
    y: number,
    pointerId = 1
  ) {
    const capturedTarget = this.#capturedPointerTargets.get(pointerId);
    if (!capturedTarget && this.interactiveNodeCount === 0) {
      if (eventName === 'pointerup') {
        this.#capturedPointerTargets.delete(pointerId);
        this.#activePointers.delete(pointerId);
      }
      return;
    }
    if (eventName === 'pointerdown') this.#activePointers.add(pointerId);
    const target =
      capturedTarget &&
      (eventName === 'pointermove' || eventName === 'pointerup')
        ? capturedTarget
        : this.resolvePointerTarget(x, y);
    if (!target) {
      if (eventName === 'pointerup') {
        this.#capturedPointerTargets.delete(pointerId);
        this.#activePointers.delete(pointerId);
      }
      return;
    }

    const event = new PointerEvent(eventName, pointerId, x, y, target);
    let current: CanvasNode | null = target;

    while (current) {
      current.dispatchEvent(event);
      if (event.propagationStopped) break;
      current = current.parent;
    }

    if (eventName === 'pointerup') {
      this.#capturedPointerTargets.delete(pointerId);
      this.#activePointers.delete(pointerId);
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
