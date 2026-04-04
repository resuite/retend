import type { CanvasRenderer } from '../canvas-renderer';

export class CanvasNode {
  renderer: CanvasRenderer;
  #parent: CanvasParentNode | null = null;
  #isConnected = false;

  constructor(renderer: CanvasRenderer) {
    this.renderer = renderer;
  }

  get isConnected() {
    return this.#isConnected;
  }

  get parent() {
    return this.#parent;
  }

  set parent(parent: CanvasParentNode | null) {
    this.#parent = parent;
    this.setConnected(parent?.isConnected === true);
  }

  setConnected(isConnected: boolean) {
    if (this.isConnected === isConnected) return;
    this.#isConnected = isConnected;
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

  append(node: CanvasNode) {
    if (node.parent) node.parent.remove(node);
    this.children.push(node);
    node.parent = this;
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
