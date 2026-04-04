import type { JSX } from 'retend/jsx-runtime';

import type { CanvasHost } from '.';

import { CanvasParentNode } from './node';
import { createTransformMatrix } from './transform';

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
    const { color: textColor, fontSize, overflow } = this.style;
    const transform = createTransformMatrix(
      this.style,
      this.resolvedWidth,
      this.resolvedHeight,
      host.scopeWidth,
      host.scopeHeight
    );

    host.ctx.save();
    host.ctx.transform(
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f
    );
    this.drawContainer(host);
    if (overflow === 'hidden' && this.tracePath(host.ctx)) {
      host.ctx.clip();
    }
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

  tracePath(_ctx: CanvasRenderingContext2D): boolean {
    return false;
  }

  protected paintPath(host: CanvasHost) {
    if (!this.tracePath(host.ctx)) return;

    const {
      backgroundColor = 'transparent',
      borderStyle,
      borderWidth = 0,
      borderColor = host.color,
    } = this.style;
    const resolvedBorderStyle = borderStyle ?? (borderWidth ? 'solid' : 'none');
    host.ctx.fillStyle = backgroundColor;
    host.ctx.fill();

    if (!borderWidth || resolvedBorderStyle === 'none') return;

    host.ctx.lineWidth = borderWidth;
    host.ctx.strokeStyle = borderColor;
    if (resolvedBorderStyle === 'dashed') {
      host.ctx.setLineDash([borderWidth * 3, borderWidth * 2]);
    } else if (resolvedBorderStyle === 'dotted') {
      host.ctx.setLineDash([borderWidth, borderWidth]);
    } else {
      host.ctx.setLineDash([]);
    }
    host.ctx.stroke();
    host.ctx.setLineDash([]);
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
  override tracePath(ctx: CanvasRenderingContext2D): boolean {
    const { borderRadius = 0 } = this.style;
    ctx.beginPath();
    if (!borderRadius) {
      ctx.rect(0, 0, this.resolvedWidth, this.resolvedHeight);
      return true;
    }

    const radius = Math.min(
      borderRadius,
      this.resolvedWidth / 2,
      this.resolvedHeight / 2
    );
    ctx.roundRect(0, 0, this.resolvedWidth, this.resolvedHeight, radius);
    return true;
  }

  override drawContainer(host: CanvasHost): void {
    this.paintPath(host);
  }
}

export class CanvasCircle extends CanvasContainer {
  override tracePath(ctx: CanvasRenderingContext2D): boolean {
    ctx.beginPath();
    ctx.arc(
      this.resolvedWidth / 2,
      this.resolvedHeight / 2,
      Math.min(this.resolvedWidth, this.resolvedHeight) / 2,
      0,
      Math.PI * 2
    );
    return true;
  }

  override drawContainer(host: CanvasHost): void {
    this.paintPath(host);
  }
}

export class CanvasShape extends CanvasContainer<JSX.ShapeProps> {
  override tracePath(ctx: CanvasRenderingContext2D): boolean {
    const ownPoints = this.attributes.points ?? [];
    const { borderRadius = 0 } = this.style;
    if (!ownPoints.length) return false;
    if (!borderRadius || ownPoints.length < 3) {
      const [firstX, firstY] = ownPoints[0];
      ctx.beginPath();
      ctx.moveTo(firstX, firstY);
      for (const [px, py] of ownPoints.slice(1)) ctx.lineTo(px, py);
      ctx.closePath();
      return true;
    }

    ctx.beginPath();
    for (let i = 0; i < ownPoints.length; i += 1) {
      const [prevX, prevY] =
        ownPoints[(i - 1 + ownPoints.length) % ownPoints.length];
      const [currentX, currentY] = ownPoints[i];
      const [nextX, nextY] = ownPoints[(i + 1) % ownPoints.length];
      const prevDx = prevX - currentX;
      const prevDy = prevY - currentY;
      const nextDx = nextX - currentX;
      const nextDy = nextY - currentY;
      const prevLength = Math.hypot(prevDx, prevDy);
      const nextLength = Math.hypot(nextDx, nextDy);
      const radius = Math.min(borderRadius, prevLength / 2, nextLength / 2);
      const prevUnitX = prevDx / prevLength;
      const prevUnitY = prevDy / prevLength;
      const nextUnitX = nextDx / nextLength;
      const nextUnitY = nextDy / nextLength;
      const startX = currentX + prevUnitX * radius;
      const startY = currentY + prevUnitY * radius;
      const endX = currentX + nextUnitX * radius;
      const endY = currentY + nextUnitY * radius;

      if (i === 0) {
        ctx.moveTo(startX, startY);
      } else {
        ctx.lineTo(startX, startY);
      }

      ctx.quadraticCurveTo(currentX, currentY, endX, endY);
    }
    ctx.closePath();
    return true;
  }

  override drawContainer(host: CanvasHost): void {
    this.paintPath(host);
  }
}
