import type { CanvasHost } from '.';

import { CanvasNode } from './node';

export class CanvasText extends CanvasNode {
  constructor(public content: string) {
    super();
  }

  override draw(host: CanvasHost): void {
    host.ctx.textBaseline = 'top';
    const fillStyle = host.ctx.fillStyle;
    host.ctx.fillStyle = host.textColor;
    host.ctx.fillText(this.content, 0, 0);
    host.ctx.fillStyle = fillStyle;
  }
}
