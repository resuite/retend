import { CanvasParentNode } from './node';

export type CanvasTag = 'root' | 'rect';

export class CanvasContainer extends CanvasParentNode {
  attributes: Record<string, unknown>;

  constructor(public tag: CanvasTag) {
    super();
    this.attributes = {};
  }

  coordinates(): [number, number] {
    return [0, 0];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const child of this.children) {
      child.draw(ctx);
    }
  }
}

export class CanvasRect extends CanvasContainer {
  constructor() {
    super('rect');
  }
}
