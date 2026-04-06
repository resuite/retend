import type { JSX } from 'retend/jsx-runtime';

import type { CanvasRenderer } from '../canvas-renderer';

import {
  BorderStyle,
  Length,
  LengthUnit,
  Overflow,
  PointerEvents,
} from '../style';
import { resolveFittedContent } from './fit-content';
import { CanvasParentNode } from './node';
import { createTransformMatrix, lengthToPx } from './transform';

export type CanvasTag = 'root' | keyof JSX.IntrinsicElements;

export class CanvasContainer<
  Props extends JSX.ContainerProps = JSX.ContainerProps,
> extends CanvasParentNode {
  protected attributes: Props;
  protected style: JSX.Style;
  protected width: number;
  protected height: number;
  protected layoutTransform: DOMMatrix | null;
  protected path: Path2D | null;
  protected clip: Path2D | null;
  protected clipValue: string | null;

  constructor(renderer: CanvasRenderer) {
    super(renderer);
    this.attributes = {} as Props;
    this.style = {};
    this.width = 0;
    this.height = 0;
    this.layoutTransform = null;
    this.path = null;
    this.clip = null;
    this.clipValue = null;
  }

  get styles() {
    return this.style;
  }

  getAttribute<K extends keyof Props>(key: K) {
    return this.attributes[key];
  }

  setStyles(style: JSX.Style) {
    Object.assign(this.style, style);
  }

  setAttribute<K extends keyof Props>(key: K, value: Props[K]) {
    const strKey = String(key);
    if (strKey.startsWith('on') && strKey.length > 2) {
      const eventName = strKey.slice(2).toLowerCase();
      this.setEventListener(
        eventName,
        typeof value === 'function' ? value : null
      );
    }
    this.attributes[key] = value;

    if (key === 'style') {
      const style = value as JSX.Style;
      Object.assign(this.style, style);
      return;
    }
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

    let nextWidth = lengthToPx(width, baseWidth, this);
    let nextHeight = lengthToPx(height, baseHeight, this);

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
        baseWidth
      ));
    }

    if (height.unit === LengthUnit.FitContent) nextHeight = fitContentHeight;

    if (maxWidth?.unit === LengthUnit.FitContent) {
      nextWidth = Math.min(nextWidth, fitContentWidth);
    } else if (maxWidth) {
      nextWidth = Math.min(nextWidth, lengthToPx(maxWidth, baseWidth, this));
    }
    if (maxHeight?.unit === LengthUnit.FitContent) {
      nextHeight = Math.min(nextHeight, fitContentHeight);
    } else if (maxHeight) {
      nextHeight = Math.min(
        nextHeight,
        lengthToPx(maxHeight, baseHeight, this)
      );
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

  override layout(): void {
    const host = this.renderer.host;
    this.resolveSize();
    this.layoutTransform = createTransformMatrix(
      this.width,
      this.height,
      host.scopeWidth,
      host.scopeHeight,
      this
    );

    const prevScopeWidth = host.scopeWidth;
    const prevScopeHeight = host.scopeHeight;
    host.scopeWidth = this.width;
    host.scopeHeight = this.height;

    host.setStyleState(this.style);

    for (const child of this.children) child.layout();

    host.unsetStyleState(this.style);

    host.scopeWidth = prevScopeWidth;
    host.scopeHeight = prevScopeHeight;
  }

  override paint(): void {
    const host = this.renderer.host;
    const hitCtx = host.hitCtx;
    const { clipPath, overflow, opacity = 1 } = this.style;
    const transform = this.layoutTransform;
    if (!transform) {
      throw new Error('paint called before layout.');
    }

    host.ctx.save();
    hitCtx.save();
    host.ctx.globalAlpha *= opacity;
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
    if (clipPath) {
      if (this.clipValue !== clipPath) {
        this.clip = new Path2D(clipPath);
        this.clipValue = clipPath;
      }
      host.ctx.clip(this.clip!);
      hitCtx.clip(this.clip!);
    } else if (this.clipValue !== null) {
      this.clip = null;
      this.clipValue = null;
    }
    this.paintContainer();
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

    host.setStyleState(this.style);

    for (const child of this.children) child.paint();

    host.unsetStyleState(this.style);

    host.scopeWidth = prevScopeWidth;
    host.scopeHeight = prevScopeHeight;

    host.ctx.restore();
    hitCtx.restore();
  }

  paintContainer() {}

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
      borderColor = host.getCascadedValue('color'),
      boxShadow,
    } = this.style;
    const resolvedBorderWidth = borderWidth.value;
    const resolvedBorderStyle =
      borderStyle ??
      (resolvedBorderWidth ? BorderStyle.Solid : BorderStyle.None);

    const shadows = boxShadow
      ? Array.isArray(boxShadow)
        ? boxShadow
        : [boxShadow]
      : [];

    const baseWidth = host.scopeWidth;
    const baseHeight = host.scopeHeight;

    const paintBorders = () => {
      if (!resolvedBorderWidth || resolvedBorderStyle === BorderStyle.None) {
        return;
      }

      host.ctx.lineWidth = resolvedBorderWidth;
      host.ctx.strokeStyle = borderColor;
      if (resolvedBorderStyle === BorderStyle.Dashed) {
        host.ctx.setLineDash([
          resolvedBorderWidth * 3,
          resolvedBorderWidth * 2,
        ]);
      } else if (resolvedBorderStyle === BorderStyle.Dotted) {
        host.ctx.setLineDash([resolvedBorderWidth, resolvedBorderWidth]);
      } else {
        host.ctx.setLineDash([]);
      }
      host.ctx.stroke(path);
      host.ctx.setLineDash([]);
    };

    if (shadows.length > 0) {
      const dropShadows = shadows.filter((s) => !s.inset);
      const insetShadows = shadows.filter((s) => s.inset);

      // Phase 1: Draw Drop Shadows
      for (let i = dropShadows.length - 1; i >= 0; i -= 1) {
        const shadow = dropShadows[i];
        host.ctx.save();
        const invertedPath = new Path2D();
        invertedPath.rect(
          -10000,
          -10000,
          this.renderer.viewport.width + 20000,
          this.renderer.viewport.height + 20000
        );
        invertedPath.addPath(path);
        host.ctx.clip(invertedPath, 'evenodd');
        host.ctx.shadowOffsetX = lengthToPx(shadow.offsetX, baseWidth, this);
        host.ctx.shadowOffsetY = lengthToPx(shadow.offsetY, baseHeight, this);
        host.ctx.shadowBlur = lengthToPx(shadow.blur, baseWidth, this);
        host.ctx.shadowColor = shadow.color;

        host.ctx.fillStyle = 'black';
        host.ctx.fill(path);
        host.ctx.restore();
      }

      // Phase 2: Draw Background Color
      host.ctx.fillStyle = backgroundColor;
      host.ctx.fill(path);

      // Phase 3: Draw Inset Shadows
      // We clip to the path so nothing spills outside,
      // and stroke an inverted cutout to cast shadows into the element constraint
      if (insetShadows.length > 0) {
        for (let i = insetShadows.length - 1; i >= 0; i -= 1) {
          const shadow = insetShadows[i];
          host.ctx.save();
          host.ctx.clip(path);

          const invertedPath = new Path2D();
          // Provide a giant canvas that is a cutout over the shape
          invertedPath.rect(
            -10000,
            -10000,
            this.renderer.viewport.width + 20000,
            this.renderer.viewport.height + 20000
          );
          invertedPath.addPath(path);

          host.ctx.shadowOffsetX = lengthToPx(shadow.offsetX, baseWidth, this);
          host.ctx.shadowOffsetY = lengthToPx(shadow.offsetY, baseHeight, this);
          host.ctx.shadowBlur = lengthToPx(shadow.blur, baseWidth, this);
          host.ctx.shadowColor = shadow.color;

          host.ctx.fillStyle = shadow.color;
          host.ctx.fill(invertedPath, 'evenodd');

          host.ctx.restore();
        }
      }

      // Phase 4: Paint Borders on Top
      paintBorders();
    } else {
      host.ctx.fillStyle = backgroundColor;
      host.ctx.fill(path);
      paintBorders();
    }

    if (
      this.hasEventListeners &&
      host.getCascadedValue('pointerEvents') !== PointerEvents.None
    ) {
      const id = this.id;
      const r = (id >> 16) & 255;
      const g = (id >> 8) & 255;
      const b = id & 255;
      host.hitCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      host.hitCtx.fill(path);
    }
  }
}

export class CanvasRoot extends CanvasContainer {
  constructor(renderer: CanvasRenderer) {
    super(renderer);
    this.style = { width: Length.Pct(100), height: Length.Pct(100) };
  }
}

// --------------

export class CanvasRect<
  Props extends JSX.ContainerProps = JSX.ContainerProps,
> extends CanvasContainer<Props> {
  override tracePath(): Path2D | null {
    const { borderRadius = Length.Px(0) } = this.style;
    const path = new Path2D();
    const radiusValue = borderRadius.value;
    if (!radiusValue) {
      path.rect(0, 0, this.width, this.height);
      this.path = path;
      return path;
    }

    const radius = Math.min(radiusValue, this.width / 2, this.height / 2);
    path.roundRect(0, 0, this.width, this.height, radius);
    this.path = path;
    return path;
  }

  override paintContainer() {
    this.paintPath();
  }
}

export class CanvasCircle extends CanvasContainer {
  override tracePath(): Path2D | null {
    const path = new Path2D();
    path.arc(
      this.width / 2,
      this.height / 2,
      Math.min(this.width, this.height) / 2,
      0,
      Math.PI * 2
    );
    this.path = path;
    return path;
  }

  override paintContainer(): void {
    this.paintPath();
  }
}

export class CanvasTextContainer extends CanvasRect {
  constructor(renderer: CanvasRenderer) {
    super(renderer);
    this.style = { width: Length.FitContent };
  }
}

export class CanvasPath extends CanvasContainer<JSX.PathProps> {
  override tracePath(): Path2D | null {
    const d = this.attributes.d;
    if (!d) {
      this.path = null;
      return null;
    }

    this.path = new Path2D(d);
    return this.path;
  }

  override paintContainer(): void {
    const host = this.renderer.host;
    const path = this.tracePath();
    if (!path) return;

    const {
      borderStyle,
      borderWidth = Length.Px(0),
      borderColor = host.getCascadedValue('color'),
    } = this.style;
    const resolvedBorderWidth = borderWidth.value;
    let resolvedBorderStyle = borderStyle;
    if (!resolvedBorderStyle) {
      if (resolvedBorderWidth) resolvedBorderStyle = BorderStyle.Solid;
      else resolvedBorderStyle = BorderStyle.None;
    }

    if (resolvedBorderWidth && resolvedBorderStyle !== BorderStyle.None) {
      host.ctx.lineWidth = resolvedBorderWidth;
      host.ctx.strokeStyle = borderColor;
      if (resolvedBorderStyle === BorderStyle.Dashed) {
        host.ctx.setLineDash([
          resolvedBorderWidth * 3,
          resolvedBorderWidth * 2,
        ]);
      } else if (resolvedBorderStyle === BorderStyle.Dotted) {
        host.ctx.setLineDash([resolvedBorderWidth, resolvedBorderWidth]);
      } else {
        host.ctx.setLineDash([]);
      }
      host.ctx.stroke(path);
      host.ctx.setLineDash([]);
    }

    if (
      this.hasEventListeners &&
      resolvedBorderWidth &&
      resolvedBorderStyle !== BorderStyle.None
    ) {
      const id = this.id;
      const r = (id >> 16) & 255;
      const g = (id >> 8) & 255;
      const b = id & 255;
      host.hitCtx.lineWidth = Math.max(resolvedBorderWidth, 1);
      host.hitCtx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      if (resolvedBorderStyle === BorderStyle.Dashed) {
        host.hitCtx.setLineDash([
          resolvedBorderWidth * 3,
          resolvedBorderWidth * 2,
        ]);
      } else if (resolvedBorderStyle === BorderStyle.Dotted) {
        host.hitCtx.setLineDash([resolvedBorderWidth, resolvedBorderWidth]);
      } else {
        host.hitCtx.setLineDash([]);
      }
      host.hitCtx.stroke(path);
      host.hitCtx.setLineDash([]);
    }
  }
}

export class CanvasShape extends CanvasContainer<JSX.ShapeProps> {
  override tracePath(): Path2D | null {
    const ownPoints = this.attributes.points ?? [];
    const { borderRadius = Length.Px(0) } = this.style;
    const radiusValue = borderRadius.value;
    if (!ownPoints.length) {
      this.path = null;
      return null;
    }

    const path = new Path2D();
    if (!radiusValue || ownPoints.length < 3) {
      const [firstX, firstY] = ownPoints[0];
      path.moveTo(firstX, firstY);
      for (const [px, py] of ownPoints.slice(1)) path.lineTo(px, py);
      path.closePath();
      this.path = path;
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
    return path;
  }

  override paintContainer(): void {
    this.paintPath();
  }
}
