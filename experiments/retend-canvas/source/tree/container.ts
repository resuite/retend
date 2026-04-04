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
  protected path: Path2D | null;
  protected dirtyPath: boolean;

  constructor() {
    super();
    this.attributes = {} as Props;
    this.style = {};
    this.resolvedWidth = 0;
    this.resolvedHeight = 0;
    this.path = null;
    this.dirtyPath = true;
  }

  getStyles() {
    return { ...this.style };
  }

  setStyles(style: JSX.Style) {
    this.style = { ...this.style, ...style };
    this.dirtyPath = true;
  }

  setAttribute<K extends keyof Props>(key: K, value: Props[K]) {
    this.attributes[key] = value;

    if (key === 'style') {
      this.style = value as JSX.Style;
    }

    this.dirtyPath = true;
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

    if (
      this.resolvedWidth !== nextWidth ||
      this.resolvedHeight !== nextHeight
    ) {
      this.dirtyPath = true;
    }

    this.resolvedWidth = nextWidth;
    this.resolvedHeight = nextHeight;
  }

  override draw(host: CanvasHost): void {
    this.resolveSize(host);
    const {
      color,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      textAlign,
      lineHeight,
      whiteSpace,
      overflow,
    } = this.style;
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
    if (overflow === 'hidden') {
      const path = this.tracePath();
      if (path) host.ctx.clip(path);
    }
    const prevScopeWidth = host.scopeWidth;
    const prevScopeHeight = host.scopeHeight;
    host.scopeWidth = this.resolvedWidth;
    host.scopeHeight = this.resolvedHeight;

    const prevColor = host.color;
    const prevSize = host.fontSize;
    const prevFamily = host.fontFamily;
    const prevWeight = host.fontWeight;
    const prevStyle = host.fontStyle;
    const prevTextAlign = host.textAlign;
    const prevLineHeight = host.lineHeight;
    const prevWhiteSpace = host.whiteSpace;
    if (color !== undefined) host.color = color;
    if (fontSize !== undefined) host.fontSize = fontSize;
    if (fontFamily !== undefined) host.fontFamily = fontFamily;
    if (fontWeight !== undefined) host.fontWeight = fontWeight;
    if (fontStyle !== undefined) host.fontStyle = fontStyle;
    if (textAlign !== undefined) host.textAlign = textAlign;
    if (lineHeight !== undefined) host.lineHeight = lineHeight;
    if (whiteSpace !== undefined) host.whiteSpace = whiteSpace;

    for (const child of this.children) child.draw(host);

    host.color = prevColor;
    host.fontSize = prevSize;
    host.fontFamily = prevFamily;
    host.fontWeight = prevWeight;
    host.fontStyle = prevStyle;
    host.textAlign = prevTextAlign;
    host.lineHeight = prevLineHeight;
    host.whiteSpace = prevWhiteSpace;
    host.scopeWidth = prevScopeWidth;
    host.scopeHeight = prevScopeHeight;
    host.ctx.restore();
  }

  drawContainer(_host: CanvasHost) {
    throw new Error('drawContainer must be implemented by canvas containers.');
  }

  tracePath(): Path2D | null {
    return null;
  }

  protected paintPath(host: CanvasHost) {
    const path = this.tracePath();
    if (!path) return;

    const {
      backgroundColor = 'transparent',
      borderStyle,
      borderWidth = 0,
      borderColor = host.color,
    } = this.style;
    const resolvedBorderStyle = borderStyle ?? (borderWidth ? 'solid' : 'none');
    host.ctx.fillStyle = backgroundColor;
    host.ctx.fill(path);

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
    host.ctx.stroke(path);
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
  override tracePath(): Path2D | null {
    if (!this.dirtyPath && this.path) {
      return this.path;
    }

    const { borderRadius = 0 } = this.style;
    const path = new Path2D();
    if (!borderRadius) {
      path.rect(0, 0, this.resolvedWidth, this.resolvedHeight);
      this.path = path;
      this.dirtyPath = false;
      return path;
    }

    const radius = Math.min(
      borderRadius,
      this.resolvedWidth / 2,
      this.resolvedHeight / 2
    );
    path.roundRect(0, 0, this.resolvedWidth, this.resolvedHeight, radius);
    this.path = path;
    this.dirtyPath = false;
    return path;
  }

  override drawContainer(host: CanvasHost): void {
    this.paintPath(host);
  }
}

export class CanvasCircle extends CanvasContainer {
  override tracePath(): Path2D | null {
    if (!this.dirtyPath && this.path) {
      return this.path;
    }

    const path = new Path2D();
    path.arc(
      this.resolvedWidth / 2,
      this.resolvedHeight / 2,
      Math.min(this.resolvedWidth, this.resolvedHeight) / 2,
      0,
      Math.PI * 2
    );
    this.path = path;
    this.dirtyPath = false;
    return path;
  }

  override drawContainer(host: CanvasHost): void {
    this.paintPath(host);
  }
}

export class CanvasShape extends CanvasContainer<JSX.ShapeProps> {
  override tracePath(): Path2D | null {
    if (!this.dirtyPath && this.path) {
      return this.path;
    }

    const ownPoints = this.attributes.points ?? [];
    const { borderRadius = 0 } = this.style;
    if (!ownPoints.length) {
      this.path = null;
      this.dirtyPath = false;
      return null;
    }

    const path = new Path2D();
    if (!borderRadius || ownPoints.length < 3) {
      const [firstX, firstY] = ownPoints[0];
      path.moveTo(firstX, firstY);
      for (const [px, py] of ownPoints.slice(1)) path.lineTo(px, py);
      path.closePath();
      this.path = path;
      this.dirtyPath = false;
      return path;
    }

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
      if (!prevLength || !nextLength) {
        if (i === 0) path.moveTo(currentX, currentY);
        else path.lineTo(currentX, currentY);
        continue;
      }
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
        path.moveTo(startX, startY);
      } else {
        path.lineTo(startX, startY);
      }

      path.quadraticCurveTo(currentX, currentY, endX, endY);
    }
    path.closePath();
    this.path = path;
    this.dirtyPath = false;
    return path;
  }

  override drawContainer(host: CanvasHost): void {
    this.paintPath(host);
  }
}
