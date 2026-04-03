import type { CanvasHost } from '.';

import { CanvasNode } from './node';

export class CanvasText extends CanvasNode {
  constructor(public content: string) {
    super();
  }

  override draw(host: CanvasHost): void {
    host.ctx.textBaseline = 'top';
    const fillStyle = host.ctx.fillStyle;
    const font = host.ctx.font;
    host.ctx.fillStyle = host.color;
    host.ctx.font = `${host.fontSize}px sans-serif`;
    host.ctx.fillText(this.content, 0, 0);
    host.ctx.font = font;
    host.ctx.fillStyle = fillStyle;
  }
}
