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

import { CommandKind, FrameBuilder, type FrameCommand } from './frame-builder';
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
  #viewport: { width: number; height: number };
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

  constructor(host: CanvasHost, viewport: { width: number; height: number }) {
    this.host = host;
    this.observer = null;
    this.root = new CanvasRoot(this);
    this.root.setConnected(true);
    this.#viewport = viewport;
    this.#animations = [];
    this.drawToScreen = this.drawToScreen.bind(this);
  }

  updateViewport(viewport: { width: number; height: number }) {
    this.#viewport = viewport;
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
    const shouldPaintHitCanvas = this.interactiveNodeCount > 0;
    this.#renderFrame = null;
    const hasRunningAnimations = tickAnimations(this.#animations);
    this.host.ctx.clearRect(
      0,
      0,
      this.host.ctx.canvas.width,
      this.host.ctx.canvas.height
    );
    if (shouldPaintHitCanvas) {
      if (hitCanvas.width !== hitWidth || hitCanvas.height !== hitHeight) {
        hitCanvas.width = hitWidth;
        hitCanvas.height = hitHeight;
      }
      this.host.hitCtx.clearRect(0, 0, hitCanvas.width, hitCanvas.height);
    }
    this.host.scopeWidth = this.#viewport.width;
    this.host.scopeHeight = this.#viewport.height;
    const shouldRebuildFrame = this.#frameDirty || hasRunningAnimations;
    if (shouldRebuildFrame) {
      this.root.layout();
      this.#frame.reset(shouldPaintHitCanvas);
      this.root.emit(this.#frame);
      this.#frameDirty = false;
    }
    this.replayCommands(this.host.ctx, this.#frame.commands);
    if (shouldPaintHitCanvas) {
      this.replayCommands(this.host.hitCtx, this.#frame.hitCommands, true);
    }
    if (hasRunningAnimations) this.requestRender();
  }

  replayCommands(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    commands: FrameCommand[],
    isHit = false
  ) {
    const frame = this.#frame;
    const baseTransform = ctx.getTransform();
    ctx.save();
    if (isHit) ctx.setTransform(1, 0, 0, 1, 0, 0);
    else ctx.setTransform(baseTransform);

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
          const matrix = frame.transforms[payloadIndex];
          ctx.transform(
            matrix.a,
            matrix.b,
            matrix.c,
            matrix.d,
            matrix.e,
            matrix.f
          );
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
            const id = command.nodeId;
            const r = (id >> 16) & 255;
            const g = (id >> 8) & 255;
            const b = id & 255;
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fill(payload.path);
            break;
          }

          for (const shadow of payload.dropShadows) {
            ctx.save();
            const invertedPath = new Path2D();
            invertedPath.rect(
              -10000,
              -10000,
              this.#viewport.width + 20000,
              this.#viewport.height + 20000
            );
            invertedPath.addPath(payload.path);
            ctx.clip(invertedPath, 'evenodd');
            ctx.shadowOffsetX = shadow.offsetX;
            ctx.shadowOffsetY = shadow.offsetY;
            ctx.shadowBlur = shadow.blur;
            ctx.shadowColor = shadow.color;
            ctx.fillStyle = 'black';
            ctx.fill(payload.path);
            ctx.restore();
          }

          ctx.fillStyle = payload.fillStyle;
          ctx.fill(payload.path);

          for (const shadow of payload.insetShadows) {
            ctx.save();
            ctx.clip(payload.path);
            const invertedPath = new Path2D();
            invertedPath.rect(
              -10000,
              -10000,
              this.#viewport.width + 20000,
              this.#viewport.height + 20000
            );
            invertedPath.addPath(payload.path);
            ctx.shadowOffsetX = shadow.offsetX;
            ctx.shadowOffsetY = shadow.offsetY;
            ctx.shadowBlur = shadow.blur;
            ctx.shadowColor = shadow.color;
            ctx.fillStyle = shadow.color;
            ctx.fill(invertedPath, 'evenodd');
            ctx.restore();
          }
          break;
        }
        case CommandKind.PathStroke: {
          const payload = frame.pathStrokes[payloadIndex];
          ctx.lineWidth = payload.lineWidth;
          if (isHit) {
            const id = command.nodeId;
            const r = (id >> 16) & 255;
            const g = (id >> 8) & 255;
            const b = id & 255;
            ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
          } else {
            ctx.strokeStyle = payload.strokeStyle;
          }
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

          if (!colorBatches) {
            ctx.fillStyle = baseColor;
            ctx.beginPath();

            for (let i = 0; i < positions.length; i += 2) {
              const cx = positions[i];
              const cy = positions[i + 1];
              const r = hasSizeMap ? sizeMap[i / 2] : baseSize;

              if (isRect) {
                ctx.rect(cx - r, cy - r, r * 2, r * 2);
              } else {
                ctx.moveTo(cx + r, cy);
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
              }
            }
            ctx.fill();
            break;
          }

          for (const { color, indices } of colorBatches) {
            ctx.fillStyle = color;
            ctx.beginPath();

            for (const i of indices) {
              const cx = positions[i];
              const cy = positions[i + 1];
              const r = hasSizeMap ? sizeMap[i / 2] : baseSize;

              if (isRect) {
                ctx.rect(cx - r, cy - r, r * 2, r * 2);
              } else {
                ctx.moveTo(cx + r, cy);
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
              }
            }

            ctx.fill();
          }
          break;
        }
      }
    }
    ctx.restore();
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
