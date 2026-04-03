import type { JSX } from 'retend/jsx-runtime';

import type { CanvasHost } from '.';

import { CanvasParentNode } from './node';

export type CanvasTag = 'root' | keyof JSX.IntrinsicElements;

export class CanvasContainer extends CanvasParentNode {
  attributes: JSX.ContainerProps;
  protected resolvedWidth: number;
  protected resolvedHeight: number;

  constructor(public tag: CanvasTag) {
    super();
    this.attributes = {};
    this.resolvedWidth = 0;
    this.resolvedHeight = 0;
  }

  protected resolveSize(host: CanvasHost) {
    const { width = 100, height = 100 } = this.attributes;
    const baseWidth = host.scopeWidth;
    const baseHeight = host.scopeHeight;
    let nextWidth = Number.parseFloat(String(width));
    let nextHeight = Number.parseFloat(String(height));
    if (String(width).endsWith('%')) {
      nextWidth = (nextWidth * baseWidth) / 100;
    }
    if (String(height).endsWith('%')) {
      nextHeight = (nextHeight * baseHeight) / 100;
    }

    this.resolvedWidth = nextWidth;
    this.resolvedHeight = nextHeight;
  }

  override draw(host: CanvasHost): void {
    this.resolveSize(host);
    this.drawContainer(host);

    const { textColor, textSize, x = 0, y = 0 } = this.attributes;

    host.ctx.save();
    host.ctx.translate(x, y);
    const prevScopeWidth = host.scopeWidth;
    const prevScopeHeight = host.scopeHeight;
    host.scopeWidth = this.resolvedWidth;
    host.scopeHeight = this.resolvedHeight;

    const prevColor = host.textColor;
    const prevSize = host.textSize;
    if (textColor) host.textColor = textColor;
    if (textSize) host.textSize = textSize;

    for (const child of this.children) child.draw(host);

    host.textColor = prevColor;
    host.textSize = prevSize;
    host.scopeWidth = prevScopeWidth;
    host.scopeHeight = prevScopeHeight;
    host.ctx.restore();
  }

  drawContainer(_host: CanvasHost) {
    throw new Error('drawContainer must be implemented by canvas containers.');
  }
}

export class CanvasRoot extends CanvasContainer {
  constructor() {
    super('root');
    this.attributes = {
      width: '100%',
      height: '100%',
    };
  }

  override drawContainer() {}
}

// --------------

export class CanvasRect extends CanvasContainer {
  constructor() {
    super('rect');
  }

  override drawContainer(host: CanvasHost): void {
    const { x = 0, y = 0, bgColor = 'black' } = this.attributes;

    host.ctx.fillStyle = bgColor;
    host.ctx.fillRect(x, y, this.resolvedWidth, this.resolvedHeight);
  }
}

export class CanvasCircle extends CanvasContainer {
  constructor() {
    super('circle');
  }

  override drawContainer(host: CanvasHost): void {
    const { x = 0, y = 0, bgColor = 'black' } = this.attributes;

    host.ctx.fillStyle = bgColor;
    host.ctx.beginPath();
    host.ctx.arc(
      x + this.resolvedWidth / 2,
      y + this.resolvedHeight / 2,
      Math.min(this.resolvedWidth, this.resolvedHeight) / 2,
      0,
      Math.PI * 2
    );
    host.ctx.fill();
  }
}
