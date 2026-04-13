import type { CanvasRenderer } from '../canvas-renderer';
import type { FrameBuilder } from '../frame-builder';
import type { CanvasEvent } from './event';

export abstract class CanvasNode {
  renderer: CanvasRenderer;
  id: number;
  #parent: CanvasParentNode | null = null;
  #isConnected = false;
  #eventListeners = new Map<string, Function>();

  constructor(renderer: CanvasRenderer) {
    this.renderer = renderer;
    this.id = renderer.nextNodeId;
    renderer.nextNodeId += 1;
  }

  get isConnected() {
    return this.#isConnected;
  }

  get parent() {
    return this.#parent;
  }

  get hasEventListeners() {
    return (
      this.#eventListeners.has('click') ||
      this.#eventListeners.has('pointerdown') ||
      this.#eventListeners.has('pointermove') ||
      this.#eventListeners.has('pointerup')
    );
  }

  protected setEventListener(type: string, callback: Function | null) {
    const hadListeners = this.hasEventListeners;
    if (callback) this.#eventListeners.set(type, callback);
    else this.#eventListeners.delete(type);
    if (hadListeners !== this.hasEventListeners && this.isConnected) {
      this.renderer.interactiveNodeCount += this.hasEventListeners ? 1 : -1;
      this.renderer.requestRender();
    }
  }

  dispatchEvent(event: CanvasEvent) {
    event.setCurrentTarget(this);
    this.#eventListeners.get(event.type)?.call(this, event);
    event.setCurrentTarget(null);
  }

  setPointerCapture(pointerId: number) {
    this.renderer.setPointerCapture(this, pointerId);
  }

  releasePointerCapture(pointerId: number) {
    this.renderer.releasePointerCapture(this, pointerId);
  }

  hasPointerCapture(pointerId: number) {
    return this.renderer.hasPointerCapture(this, pointerId);
  }

  set parent(parent: CanvasParentNode | null) {
    this.#parent = parent;
    this.setConnected(parent?.isConnected === true);
  }

  setConnected(isConnected: boolean) {
    if (this.isConnected === isConnected) return;
    this.#isConnected = isConnected;
    if (isConnected) {
      if (this.hasEventListeners) this.renderer.interactiveNodeCount += 1;
      this.renderer.nodeMap.set(this.id, this);
    } else {
      this.renderer.releasePointerCaptures(this);
      if (this.hasEventListeners) this.renderer.interactiveNodeCount -= 1;
      this.renderer.nodeMap.delete(this.id);
    }
    if (this instanceof CanvasParentNode) {
      for (const child of this.children) child.setConnected(isConnected);
    }
  }

  measure(_maxWidth?: number) {
    return { width: 0, height: 0 };
  }

  abstract layout(): void;
  abstract emit(frame: FrameBuilder): void;
}

export abstract class CanvasParentNode extends CanvasNode {
  children: CanvasNode[];
  textVersion = 0;

  constructor(renderer: CanvasRenderer) {
    super(renderer);
    this.children = [];
  }

  remove(node: CanvasNode) {
    const index = this.children.indexOf(node);
    if (index !== -1) {
      this.children.splice(index, 1);
      node.parent = null;
      this.textVersion += 1;
    }
  }

  prepend(node: CanvasNode) {
    if (node.parent) node.parent.remove(node);
    this.children.splice(0, 0, node);
    node.parent = this;
    this.textVersion += 1;
  }

  append(...nodes: CanvasNode[]) {
    const children = nodes.filter(Boolean);
    for (const child of children) {
      if (child instanceof CanvasFragment) {
        for (const subchild of child.children) {
          // Note: not recursive here because it is not possible
          // to have a fragment within a fragment.
          this.children.push(subchild);
          subchild.parent = this;
        }
        child.children = [];
      } else {
        if (child.parent) child.parent.remove(child);
        this.children.push(child);
        child.parent = this;
      }
    }

    this.textVersion += 1;
  }
}

export class CanvasAnchor extends CanvasNode {
  emit() {
    // anchor nodes are not visible.
  }
  layout() {
    // anchor nodes do not layout.
  }
}

export type CanvasRange = [CanvasAnchor, CanvasAnchor];

export class CanvasFragment extends CanvasParentNode {
  emit() {
    throw new Error(
      'CanvasFragment cannot be emitted. It must be merged into the Canvas tree.'
    );
  }
  layout() {
    throw new Error(
      'CanvasFragment cannot be laid out. It must be merged into the Canvas tree.'
    );
  }
}
