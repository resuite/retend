import type { CanvasHost } from '.';

export class CanvasNode {
  parent: CanvasParentNode | null = null;

  isConnectedTo(root: CanvasParentNode): boolean {
    let node: CanvasParentNode | null = this.parent;
    while (node && node !== root) {
      node = node.parent;
    }
    return node === root;
  }

  draw(_host: CanvasHost) {
    throw new Error('draw method not implemented.');
  }
}

export class CanvasParentNode extends CanvasNode {
  children: CanvasNode[];

  constructor() {
    super();
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
