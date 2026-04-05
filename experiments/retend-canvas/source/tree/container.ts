import type { JSX } from 'retend/jsx-runtime';

import type { CanvasRenderer } from '../canvas-renderer';

import { BorderStyle, Length, LengthUnit, Overflow } from '../style';
import { resolveFittedContent } from './fit-content';
import { CanvasParentNode } from './node';
import { createTransformMatrix, lengthToPx } from './transform';

export type CanvasTag = 'root' | keyof JSX.IntrinsicElements;
const pathStyleKeys = [
  'width',
  'height',
  'maxWidth',
  'maxHeight',
  'borderRadius',
] as const;

export class CanvasContainer<
  Props extends JSX.ContainerProps = JSX.ContainerProps,
> extends CanvasParentNode {
  protected attributes: Props;
  protected style: JSX.Style;
  protected width: number;
  protected height: number;
  protected path: Path2D | null;
  protected dirtyPath: boolean;

  constructor(renderer: CanvasRenderer) {
    super(renderer);
    this.attributes = {} as Props;
    this.style = {};
    this.width = 0;
    this.height = 0;
    this.path = null;
    this.dirtyPath = true;
  }

  get styles() {
    return this.style;
  }

  setStyles(style: JSX.Style) {
    for (const key of pathStyleKeys) {
      if (key in style && style[key] !== this.style[key]) {
        this.dirtyPath = true;
        break;
      }
    }
    Object.assign(this.style, style);
  }

  setAttribute<K extends keyof Props>(key: K, value: Props[K]) {
    const currentValue = this.attributes[key];

    const strKey = String(key);
    if (strKey.startsWith('on') && strKey.length > 2) {
      const eventName = strKey.slice(2).toLowerCase();
      if (typeof currentValue === 'function') {
        this.removeEventListener(eventName, currentValue as EventListener);
      }
      if (typeof value === 'function') {
        this.addEventListener(eventName, value as EventListener);
      }
    }
    this.attributes[key] = value;

    if (key === 'style') {
      const style = value as JSX.Style;
      for (const key of pathStyleKeys) {
        if (style[key] !== this.style[key]) {
          this.dirtyPath = true;
          break;
        }
      }
      this.style = style;
      return;
    }
    if (key === 'points') this.dirtyPath = true;
  }

  protected resolveSize() {
    const host = this.renderer.host;
    const {
      width = Length.Pct(100),
      height = Length.FitContent,
      maxWidth,
      maxHeight,
    } = this.style;

    const baseWidth = host.scopeWidth;
    const baseHeight = host.scopeHeight;
    const viewportWidth = this.renderer.viewport.width;

    let nextWidth = lengthToPx(width, baseWidth, viewportWidth);
    let nextHeight = lengthToPx(height, baseHeight, viewportWidth);

    if (width.unit === LengthUnit.FitContent) nextWidth = 0;
    if (height.unit === LengthUnit.FitContent) nextHeight = 0;

    let fitContentWidth = 0;
    let fitContentHeight = 0;
    if (
      width.unit === LengthUnit.FitContent ||
      height.unit === LengthUnit.FitContent ||
      maxWidth?.unit === LengthUnit.FitContent ||
      maxHeight?.unit === LengthUnit.FitContent
    ) {
      ({ nextWidth, fitContentWidth, fitContentHeight } = resolveFittedContent(
        this,
        nextWidth,
        baseWidth,
        viewportWidth
      ));
    }

    if (height.unit === LengthUnit.FitContent) nextHeight = fitContentHeight;

    if (maxWidth?.unit === LengthUnit.FitContent) {
      nextWidth = Math.min(nextWidth, fitContentWidth);
    } else if (maxWidth) {
      nextWidth = Math.min(
        nextWidth,
        lengthToPx(maxWidth, baseWidth, viewportWidth)
      );
    }
    if (maxHeight?.unit === LengthUnit.FitContent) {
      nextHeight = Math.min(nextHeight, fitContentHeight);
    } else if (maxHeight) {
      nextHeight = Math.min(
        nextHeight,
        lengthToPx(maxHeight, baseHeight, viewportWidth)
      );
    }

    if (this.width !== nextWidth || this.height !== nextHeight) {
      this.dirtyPath = true;
    }

    this.width = nextWidth;
    this.height = nextHeight;
  }

  override measure(maxWidth?: number) {
    const host = this.renderer.host;
    const prevScopeWidth = host.scopeWidth;
    if (maxWidth !== undefined) host.scopeWidth = maxWidth;
    this.resolveSize();
    host.scopeWidth = prevScopeWidth;
    return { width: this.width, height: this.height };
  }

  override draw(): void {
    const host = this.renderer.host;
    const hitCtx = host.hitCtx;
    this.resolveSize();
    const { overflow } = this.style;
    const transform = createTransformMatrix(
      this.renderer.transformMatrix,
      this.style,
      this.width,
      this.height,
      host.scopeWidth,
      host.scopeHeight,
      this.renderer.viewport.width
    );

    host.ctx.save();
    hitCtx.save();
    host.ctx.transform(
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f
    );
    hitCtx.transform(
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f
    );
    this.drawContainer();
    if (overflow === Overflow.Hidden) {
      const path = this.tracePath();
      if (path) {
        host.ctx.clip(path);
        hitCtx.clip(path);
      }
    }
    const prevScopeWidth = host.scopeWidth;
    const prevScopeHeight = host.scopeHeight;
    host.scopeWidth = this.width;
    host.scopeHeight = this.height;
    host.pushStyleCtx(this.style);

    for (const child of this.children) child.draw();

    host.popStyleCtx();
    host.scopeWidth = prevScopeWidth;
    host.scopeHeight = prevScopeHeight;
    host.ctx.restore();
    hitCtx.restore();
  }

  drawContainer() {
    throw new Error('drawContainer must be implemented by canvas containers.');
  }

  tracePath(): Path2D | null {
    return null;
  }

  protected paintPath() {
    const host = this.renderer.host;
    const path = this.tracePath();
    if (!path) return;

    const {
      backgroundColor = 'transparent',
      borderStyle,
      borderWidth = Length.Px(0),
      borderColor = host.color,
    } = this.style;
    const resolvedBorderWidth = borderWidth.value;
    const resolvedBorderStyle =
      borderStyle ??
      (resolvedBorderWidth ? BorderStyle.Solid : BorderStyle.None);
    host.ctx.fillStyle = backgroundColor;
    host.ctx.fill(path);
    if (this.hasEventListeners) {
      const id = this.id;
      const r = (id >> 16) & 255;
      const g = (id >> 8) & 255;
      const b = id & 255;
      host.hitCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      host.hitCtx.fill(path);
    }

    if (!resolvedBorderWidth || resolvedBorderStyle === BorderStyle.None) {
      return;
    }

    host.ctx.lineWidth = resolvedBorderWidth;
    host.ctx.strokeStyle = borderColor;
    if (resolvedBorderStyle === BorderStyle.Dashed) {
      host.ctx.setLineDash([resolvedBorderWidth * 3, resolvedBorderWidth * 2]);
    } else if (resolvedBorderStyle === BorderStyle.Dotted) {
      host.ctx.setLineDash([resolvedBorderWidth, resolvedBorderWidth]);
    } else {
      host.ctx.setLineDash([]);
    }
    host.ctx.stroke(path);
    host.ctx.setLineDash([]);
  }
}

export class CanvasRoot extends CanvasContainer {
  constructor(renderer: CanvasRenderer) {
    super(renderer);
    this.setAttribute('style', {
      width: Length.Pct(100),
      height: Length.Pct(100),
    });
  }

  override drawContainer() {}
}

// --------------

export class CanvasRect extends CanvasContainer {
  override tracePath(): Path2D | null {
    if (!this.dirtyPath && this.path) {
      return this.path;
    }

    const { borderRadius = Length.Px(0) } = this.style;
    const path = new Path2D();
    const radiusValue = borderRadius.value;
    if (!radiusValue) {
      path.rect(0, 0, this.width, this.height);
      this.path = path;
      this.dirtyPath = false;
      return path;
    }

    const radius = Math.min(radiusValue, this.width / 2, this.height / 2);
    path.roundRect(0, 0, this.width, this.height, radius);
    this.path = path;
    this.dirtyPath = false;
    return path;
  }

  override drawContainer(): void {
    this.paintPath();
  }
}

export class CanvasCircle extends CanvasContainer {
  override tracePath(): Path2D | null {
    if (!this.dirtyPath && this.path) {
      return this.path;
    }

    const path = new Path2D();
    path.arc(
      this.width / 2,
      this.height / 2,
      Math.min(this.width, this.height) / 2,
      0,
      Math.PI * 2
    );
    this.path = path;
    this.dirtyPath = false;
    return path;
  }

  override drawContainer(): void {
    this.paintPath();
  }
}

export class CanvasShape extends CanvasContainer<JSX.ShapeProps> {
  override tracePath(): Path2D | null {
    if (!this.dirtyPath && this.path) {
      return this.path;
    }

    const ownPoints = this.attributes.points ?? [];
    const { borderRadius = Length.Px(0) } = this.style;
    const radiusValue = borderRadius.value;
    if (!ownPoints.length) {
      this.path = null;
      this.dirtyPath = false;
      return null;
    }

    const path = new Path2D();
    if (!radiusValue || ownPoints.length < 3) {
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
      const radius = Math.min(radiusValue, prevLength / 2, nextLength / 2);
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

  override drawContainer(): void {
    this.paintPath();
  }
}
