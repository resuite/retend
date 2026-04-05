import type { JSX } from 'retend/jsx-runtime';

import type { CanvasRenderer } from '../canvas-renderer';

export class CanvasTransitionEvent extends Event {
  propertyName: string;
  elapsedTime: number;
  #target: CanvasNode;

  constructor(
    type: string,
    propertyName: string,
    elapsedTime: number,
    target: CanvasNode
  ) {
    super(type);
    this.propertyName = propertyName;
    this.elapsedTime = elapsedTime;
    this.#target = target;
  }

  override get target() {
    return this.#target;
  }
}

export class CanvasPointerEvent extends Event {
  x: number;
  y: number;
  #target: CanvasNode;
  #currentTarget: CanvasNode | null;
  #propagationStopped = false;

  constructor(
    type: JSX.CanvasNodeEventName,
    x: number,
    y: number,
    target: CanvasNode
  ) {
    super(type, { cancelable: true });
    this.x = x;
    this.y = y;
    this.#target = target;
    this.#currentTarget = null;
  }

  override get target() {
    return this.#target;
  }

  override get currentTarget() {
    return this.#currentTarget;
  }

  get propagationStopped() {
    return this.#propagationStopped;
  }

  override stopPropagation() {
    this.#propagationStopped = true;
    super.stopPropagation();
  }

  override stopImmediatePropagation() {
    this.#propagationStopped = true;
    super.stopImmediatePropagation();
  }

  setCurrentTarget(currentTarget: CanvasNode | null) {
    this.#currentTarget = currentTarget;
  }
}

export class CanvasNode extends EventTarget {
  static #listenerIds = new WeakMap<
    EventListenerOrEventListenerObject,
    number
  >();
  static #nextListenerId = 1;
  renderer: CanvasRenderer;
  id: number;
  #parent: CanvasParentNode | null = null;
  #isConnected = false;
  #eventListenerKeys = new Set<string>();

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

  get hasEventListeners() {
    return this.#eventListenerKeys.size > 0;
  }

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean
  ) {
    if (callback) {
      if (
        type === 'click' ||
        type === 'pointerdown' ||
        type === 'pointermove' ||
        type === 'pointerup'
      ) {
        let listenerId = CanvasNode.#listenerIds.get(callback);
        if (listenerId === undefined) {
          listenerId = CanvasNode.#nextListenerId;
          CanvasNode.#nextListenerId += 1;
          CanvasNode.#listenerIds.set(callback, listenerId);
        }
        const capture =
          options === true ||
          (options instanceof Object && options.capture === true);
        const prevSize = this.#eventListenerKeys.size;
        this.#eventListenerKeys.add(`${type}:${listenerId}:${Number(capture)}`);
        if (this.#eventListenerKeys.size !== prevSize && this.isConnected) {
          this.renderer.requestRender();
        }
      }
    }

    super.addEventListener(type, callback, options);
  }
  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean
  ) {
    super.removeEventListener(type, callback, options);

    if (!callback) return;
    if (
      type !== 'click' &&
      type !== 'pointerdown' &&
      type !== 'pointermove' &&
      type !== 'pointerup'
    ) {
      return;
    }

    const listenerId = CanvasNode.#listenerIds.get(callback);
    if (listenerId === undefined) return;
    const capture =
      options === true ||
      (options instanceof Object && options.capture === true);
    const prevSize = this.#eventListenerKeys.size;
    this.#eventListenerKeys.delete(`${type}:${listenerId}:${Number(capture)}`);
    if (this.#eventListenerKeys.size !== prevSize && this.isConnected) {
      this.renderer.requestRender();
    }
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

  draw() {
    throw new Error('draw method not implemented.');
  }

  measure(_maxWidth?: number) {
    return { width: 0, height: 0 };
  }
}

export class CanvasParentNode extends CanvasNode {
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
  draw() {
    // anchor nodes are not visible.
  }
}

export type CanvasRange = [CanvasAnchor, CanvasAnchor];

export class CanvasFragment extends CanvasParentNode {}
