import type { JSX } from 'retend/jsx-runtime';

import type { CanvasHost } from '.';

import { CanvasParentNode } from './node';

export type CanvasTag = 'root' | keyof JSX.IntrinsicElements;

export class CanvasContainer<
  Props extends JSX.ContainerProps = JSX.ContainerProps,
> extends CanvasParentNode {
  protected attributes: Props;
  protected style: JSX.Style;
  protected resolvedWidth: number;
  protected resolvedHeight: number;

  constructor() {
    super();
    this.attributes = {} as Props;
    this.style = {};
    this.resolvedWidth = 0;
    this.resolvedHeight = 0;
  }

  getStyles() {
    return { ...this.style };
  }

  setStyles(style: JSX.Style) {
    this.style = { ...this.style, ...style };
  }

  setAttribute<K extends keyof Props>(key: K, value: Props[K]) {
    this.attributes[key] = value;

    if (key === 'style') {
      this.style = value as JSX.Style;
    }
  }

  protected resolveSize(host: CanvasHost) {
    const { width = 100, height = 100 } = this.style;
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

    const { color: textColor, fontSize, left: x = 0, top: y = 0 } = this.style;

    host.ctx.save();
    host.ctx.translate(x, y);
    const prevScopeWidth = host.scopeWidth;
    const prevScopeHeight = host.scopeHeight;
    host.scopeWidth = this.resolvedWidth;
    host.scopeHeight = this.resolvedHeight;

    const prevColor = host.color;
    const prevSize = host.fontSize;
    if (textColor) host.color = textColor;
    if (fontSize) host.fontSize = fontSize;

    for (const child of this.children) child.draw(host);

    host.color = prevColor;
    host.fontSize = prevSize;
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
    super();
    this.setAttribute('style', { width: '100%', height: '100%' });
  }

  override drawContainer() {}
}

// --------------

export class CanvasRect extends CanvasContainer {
  override drawContainer(host: CanvasHost): void {
    const { left = 0, top = 0, backgroundColor = 'transparent' } = this.style;

    host.ctx.fillStyle = backgroundColor;
    host.ctx.fillRect(left, top, this.resolvedWidth, this.resolvedHeight);
  }
}

export class CanvasCircle extends CanvasContainer {
  override drawContainer(host: CanvasHost): void {
    const { left = 0, top = 0, backgroundColor = 'transparent' } = this.style;

    host.ctx.fillStyle = backgroundColor;
    host.ctx.beginPath();
    host.ctx.arc(
      left + this.resolvedWidth / 2,
      top + this.resolvedHeight / 2,
      Math.min(this.resolvedWidth, this.resolvedHeight) / 2,
      0,
      Math.PI * 2
    );
    host.ctx.fill();
  }
}

export class CanvasShape extends CanvasContainer<JSX.ShapeProps> {
  override drawContainer(host: CanvasHost): void {
    const ownPoints = this.attributes.points ?? [];
    const { left = 0, top = 0, backgroundColor = 'transparent' } = this.style;
    if (!ownPoints.length) return;
    const [firstX, firstY] = ownPoints[0];

    host.ctx.fillStyle = backgroundColor;
    host.ctx.beginPath();
    host.ctx.moveTo(left + firstX, top + firstY);
    for (const [px, py] of ownPoints.slice(1))
      host.ctx.lineTo(left + px, top + py);
    host.ctx.closePath();
    host.ctx.fill();
  }
}
