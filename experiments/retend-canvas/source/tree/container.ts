import type { JSX } from 'retend/jsx-runtime';

import type { CanvasRenderer } from '../canvas-renderer';
import type {
  CanvasStyle,
  CanvasContainerProps,
  CanvasShapeProps,
  CanvasPathProps,
} from '../types';

import {
  BorderStyle,
  type BoxShadowValue,
  Length,
  LengthUnit,
  Overflow,
  PointerEvents,
} from '../style';
import { resolveFittedContent } from './fit-content';
import { CanvasParentNode, type CanvasNode } from './node';
import { createTransformMatrix, lengthToPx } from './transform';

export type CanvasTag = 'root' | keyof JSX.IntrinsicElements;

export class CanvasContainer<
  Props extends CanvasContainerProps = CanvasContainerProps,
> extends CanvasParentNode {
  protected attributes: Props;
  protected style: CanvasStyle;
  protected width = 0;
  protected height = 0;
  protected layoutTransform: DOMMatrix | null = null;
  protected path: Path2D | null = null;
  protected clip: Path2D | null = null;
  protected clipValue: string | null = null;

  protected dropShadows: BoxShadowValue[] = [];
  protected insetShadows: BoxShadowValue[] = [];

  protected visualChildrenOrderChanged = false;
  protected visualChildren: CanvasNode[] = [];

  constructor(renderer: CanvasRenderer) {
    super(renderer);
    this.attributes = {} as Props;
    this.style = {};
  }

  get styles() {
    return this.style;
  }

  protected updateChildrenVisualOrder() {
    const children = this.children;
    if (children.length < 2) {
      this.visualChildren = children;
      return;
    }
    this.visualChildren = children.toSorted((a, b) => {
      const az = a instanceof CanvasContainer ? (a.style.zIndex ?? 0) : 0;
      const bz = b instanceof CanvasContainer ? (b.style.zIndex ?? 0) : 0;
      return az - bz;
    });
  }

  override append(...nodes: CanvasNode[]) {
    super.append(...nodes);
    this.visualChildrenOrderChanged = true;
  }

  override prepend(node: CanvasNode) {
    super.prepend(node);
    this.visualChildrenOrderChanged = true;
  }

  override remove(node: CanvasNode) {
    super.remove(node);
    this.visualChildrenOrderChanged = true;
  }

  setStyles(style: CanvasStyle) {
    const previousZIndex = this.style.zIndex ?? 0;
    const newZIndex = style.zIndex ?? 0;

    if (style.scale !== undefined && !Array.isArray(style.scale)) {
      style.scale = [style.scale, style.scale];
    }

    Object.assign(this.style, style);

    if (style.boxShadow) {
      style.boxShadow = Array.isArray(style.boxShadow)
        ? style.boxShadow
        : [style.boxShadow];

      const insetShadows = [];
      const dropShadows = [];
      for (const shadow of style.boxShadow) {
        if (shadow.inset) insetShadows.push(shadow);
        else dropShadows.push(shadow);
      }
      this.insetShadows = insetShadows;
      this.dropShadows = dropShadows;
    }

    if (previousZIndex !== newZIndex) {
      if (this.parent instanceof CanvasContainer) {
        this.parent.visualChildrenOrderChanged = true;
      }
    }
  }

  setAttribute<K extends keyof Props>(key: K, value: Props[K]) {
    const strKey = String(key);
    if (strKey.startsWith('on') && strKey.length > 2) {
      const eventName = strKey.slice(2).toLowerCase();
      const listener = typeof value === 'function' ? value : null;
      this.setEventListener(eventName, listener);
    }
    this.attributes[key] = value;

    if (key === 'style') this.setStyles(value as CanvasStyle);
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
      const fittedSize = resolveFittedContent(this, nextWidth, baseWidth);
      ({ nextWidth, fitContentWidth, fitContentHeight } = fittedSize);
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
    this.layoutTransform = createTransformMatrix(this, this.width, this.height);

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

    if (this.visualChildrenOrderChanged) {
      this.updateChildrenVisualOrder();
      this.visualChildrenOrderChanged = false;
    }
    for (const child of this.visualChildren) child.paint();

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

  protected paintBorders(path: Path2D) {
    const { host } = this.renderer;
    const {
      borderStyle,
      borderWidth = Length.Px(0),
      borderColor = host.getCascadedValue('color'),
    } = this.style;

    const resolvedBorderWidth = borderWidth.value;
    const resolvedBorderStyle =
      borderStyle ??
      (resolvedBorderWidth ? BorderStyle.Solid : BorderStyle.None);

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

  protected drawShadows(tracedPath: Path2D, shadows: BoxShadowValue[]) {
    if (!shadows.length) return;
    const { host, viewport } = this.renderer;
    const baseWidth = host.scopeWidth;
    const baseHeight = host.scopeHeight;

    for (const shadow of shadows) {
      host.ctx.save();
      if (shadow.inset) host.ctx.clip(tracedPath);

      const invertedPath = new Path2D();
      invertedPath.rect(
        -10000,
        -10000,
        viewport.width + 20000,
        viewport.height + 20000
      );
      invertedPath.addPath(tracedPath);
      if (!shadow.inset) host.ctx.clip(invertedPath, 'evenodd');
      host.ctx.shadowOffsetX = lengthToPx(shadow.offsetX, baseWidth, this);
      host.ctx.shadowOffsetY = lengthToPx(shadow.offsetY, baseHeight, this);
      host.ctx.shadowBlur = lengthToPx(shadow.blur, baseWidth, this);
      host.ctx.shadowColor = shadow.color;

      host.ctx.fillStyle = shadow.inset ? shadow.color : 'black';
      if (shadow.inset) host.ctx.fill(invertedPath, 'evenodd');
      else host.ctx.fill(tracedPath);
      host.ctx.restore();
    }
  }

  protected paintPath() {
    const tracedPath = this.tracePath();
    if (!tracedPath) return;

    const { host } = this.renderer;
    const { backgroundColor = 'transparent' } = this.style;

    this.drawShadows(tracedPath, this.dropShadows);

    host.ctx.fillStyle = backgroundColor;
    host.ctx.fill(tracedPath);

    this.drawShadows(tracedPath, this.insetShadows);
    this.paintBorders(tracedPath);

    const shouldDrawToHitScreen =
      this.hasEventListeners &&
      host.getCascadedValue('pointerEvents') !== PointerEvents.None;

    if (shouldDrawToHitScreen) {
      const id = this.id;
      const r = (id >> 16) & 255;
      const g = (id >> 8) & 255;
      const b = id & 255;
      host.hitCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      host.hitCtx.fill(tracedPath);
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
  Props extends CanvasContainerProps = CanvasContainerProps,
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

export class CanvasPath extends CanvasContainer<CanvasPathProps> {
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

export class CanvasShape extends CanvasContainer<CanvasShapeProps> {
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
