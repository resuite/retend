import type { CanvasRenderer } from '../canvas-renderer';
import type { FrameBuilder } from '../frame-builder';

const pointerEventListeners = new Map<CanvasNode, [string, EventListener][]>();

export abstract class CanvasNode extends EventTarget {
  renderer: CanvasRenderer;
  id: number;
  #parent: CanvasParentNode | null = null;
  #isConnected = false;

  constructor(renderer: CanvasRenderer) {
    super();
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

  get isPointerInteractive() {
    return Boolean(pointerEventListeners.get(this)?.length);
  }

  addEventListener(...args: Parameters<EventTarget['addEventListener']>): void {
    const wasPointerInteractive = this.isPointerInteractive;
    super.addEventListener(...args);
    const type = args[0];
    const listener = args[1];
    if (
      (type === 'click' || type.startsWith('pointer')) &&
      typeof listener === 'function'
    ) {
      const listeners = pointerEventListeners.get(this) ?? [];
      listeners.push([type, listener]);
      pointerEventListeners.set(this, listeners);
    }
    if (
      !wasPointerInteractive &&
      this.isPointerInteractive &&
      this.isConnected
    ) {
      this.renderer.requestRender();
    }
  }

  removeEventListener(
    ...args: Parameters<EventTarget['removeEventListener']>
  ): void {
    const wasPointerInteractive = this.isPointerInteractive;
    super.removeEventListener(...args);
    const type = args[0];
    if (type === 'click' || type.startsWith('pointer')) {
      const listeners = pointerEventListeners.get(this);
      if (listeners) {
        const updated = listeners.filter(([t]) => t !== type);
        pointerEventListeners.set(this, updated);
      }
    }
    if (
      wasPointerInteractive &&
      !this.isPointerInteractive &&
      this.isConnected
    ) {
      this.renderer.requestRender();
    }
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

  protected setConnected(isConnected: boolean) {
    if (this.isConnected === isConnected) return;
    this.#isConnected = isConnected;
    if (isConnected) {
      this.renderer.nodeMap.set(this.id, this);
    } else {
      this.renderer.releasePointerCaptures(this);
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
