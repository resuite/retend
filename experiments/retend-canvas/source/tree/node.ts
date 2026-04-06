import type { JSX } from 'retend/jsx-runtime';

import type { CanvasRenderer } from '../canvas-renderer';

class CanvasDispatch {
  type: string;
  cancelable: boolean;
  defaultPrevented = false;
  #target: CanvasNode;
  #currentTarget: CanvasNode | null;

  constructor(type: string, cancelable: boolean, target: CanvasNode) {
    this.type = type;
    this.cancelable = cancelable;
    this.#target = target;
    this.#currentTarget = null;
  }

  get target() {
    return this.#target;
  }

  get currentTarget() {
    return this.#currentTarget;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }

  setCurrentTarget(currentTarget: CanvasNode | null) {
    this.#currentTarget = currentTarget;
  }
}

export class CanvasTransitionEvent extends CanvasDispatch {
  propertyName: string;
  elapsedTime: number;

  constructor(
    type: string,
    propertyName: string,
    elapsedTime: number,
    target: CanvasNode
  ) {
    super(type, false, target);
    this.propertyName = propertyName;
    this.elapsedTime = elapsedTime;
  }
}

export class CanvasPointerEvent extends CanvasDispatch {
  x: number;
  y: number;
  #propagationStopped = false;

  constructor(
    type: JSX.CanvasNodeEventName,
    x: number,
    y: number,
    target: CanvasNode
  ) {
    super(type, true, target);
    this.x = x;
    this.y = y;
  }

  get propagationStopped() {
    return this.#propagationStopped;
  }

  stopPropagation() {
    this.#propagationStopped = true;
  }

  stopImmediatePropagation() {
    this.#propagationStopped = true;
  }
}

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
    const hasEventListeners = this.hasEventListeners;
    if (callback) {
      this.#eventListeners.set(type, callback);
    } else {
      this.#eventListeners.delete(type);
    }
    if (hasEventListeners !== this.hasEventListeners && this.isConnected) {
      this.renderer.requestRender();
    }
  }

  dispatchEvent(event: CanvasDispatch) {
    event.setCurrentTarget(this);
    this.#eventListeners.get(event.type)?.call(this, event);
    event.setCurrentTarget(null);
  }

  set parent(parent: CanvasParentNode | null) {
    this.#parent = parent;
    this.setConnected(parent?.isConnected === true);
  }

  setConnected(isConnected: boolean) {
    if (this.isConnected === isConnected) return;
    this.#isConnected = isConnected;
    if (isConnected) {
      this.renderer.nodeMap.set(this.id, this);
    } else {
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
  abstract paint(): void;
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
  paint() {
    // anchor nodes are not visible.
  }
  layout() {
    // anchor nodes do not layout.
  }
}

export type CanvasRange = [CanvasAnchor, CanvasAnchor];

export class CanvasFragment extends CanvasParentNode {
  paint() {
    throw new Error(
      'CanvasFragment cannot be painted. It must be merged into the Canvas tree.'
    );
  }
  layout() {
    throw new Error(
      'CanvasFragment cannot be laid out. It must be merged into the Canvas tree.'
    );
  }
}
