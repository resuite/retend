import type { JSX } from 'retend/jsx-runtime';

import type { CanvasHost } from '.';

import { CanvasParentNode } from './node';

export type CanvasTag = 'root' | keyof JSX.IntrinsicElements;

export class CanvasContainer extends CanvasParentNode {
  attributes: JSX.ContainerProps;

  constructor(public tag: CanvasTag) {
    super();
    this.attributes = {};
  }

  override draw(host: CanvasHost): void {
    const { textColor } = this.attributes;

    const prevColor = host.textColor;
    if (textColor) host.textColor = textColor;

    for (const child of this.children) {
      child.draw(host);
    }
    host.textColor = prevColor;
  }
}

export class CanvasRect extends CanvasContainer {
  constructor() {
    super('rect');
  }

  override draw(host: CanvasHost): void {
    const {
      x = 0,
      y = 0,
      width = 100,
      height = 100,
      bgColor = 'black',
    } = this.attributes;

    host.ctx.fillStyle = bgColor as string;
    host.ctx.fillRect(x, y, width, height);

    host.ctx.save();
    host.ctx.translate(x, y);
    super.draw(host);
    host.ctx.restore();
  }
}

export class CanvasCircle extends CanvasContainer {
  constructor() {
    super('circle');
  }

  override draw(host: CanvasHost): void {
    const {
      x = 0,
      y = 0,
      width = 100,
      height = 100,
      bgColor = 'black',
    } = this.attributes;

    host.ctx.fillStyle = bgColor as string;
    host.ctx.beginPath();
    host.ctx.arc(
      x + width / 2,
      y + height / 2,
      Math.min(width, height) / 2,
      0,
      Math.PI * 2
    );
    host.ctx.fill();

    host.ctx.save();
    host.ctx.translate(x, y);
    super.draw(host);
    host.ctx.restore();
  }
}
