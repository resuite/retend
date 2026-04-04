import type { CanvasRenderer } from '../canvas-renderer';

export class CanvasNode {
  renderer: CanvasRenderer;
  parent: CanvasParentNode | null = null;

  constructor(renderer: CanvasRenderer) {
    this.renderer = renderer;
  }

  isConnectedTo(root: CanvasParentNode): boolean {
    let node: CanvasParentNode | null = this.parent;
    while (node && node !== root) {
      node = node.parent;
    }
    return node === root;
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

  constructor(renderer: CanvasRenderer) {
    super(renderer);
    this.children = [];
  }

  remove(node: CanvasNode) {
    const index = this.children.indexOf(node);
    if (index !== -1) {
      this.children.splice(index, 1);
      node.parent = null;
    }
  }

  prepend(node: CanvasNode) {
    if (node.parent) node.parent.remove(node);
    this.children.splice(0, 0, node);
    node.parent = this;
  }

  append(node: CanvasNode) {
    if (node.parent) node.parent.remove(node);
    this.children.push(node);
    node.parent = this;
  }
}

export class CanvasAnchor extends CanvasNode {
  draw() {
    // anchor nodes are not visible.
  }
}

export type CanvasRange = [CanvasAnchor, CanvasAnchor];

export class CanvasFragment extends CanvasParentNode {}
