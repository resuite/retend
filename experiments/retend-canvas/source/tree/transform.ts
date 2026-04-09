import type { CanvasNode } from './node';

import {
  Alignment,
  Angle,
  Length,
  type LengthValue,
  LengthUnit,
  TransformOrigin,
  type TransformOriginValue,
} from '../style';
import { CanvasContainer } from './container';

const defaultOrigin = TransformOrigin.At(Length.Pct(50), Length.Pct(50));

export function lengthToPx(
  value: LengthValue,
  baseSize: number,
  node: CanvasNode
) {
  const { renderer } = node;
  const { host } = renderer;

  if (value.unit === LengthUnit.Pct) {
    return (value.value * baseSize) / 100;
  }

  if (value.unit === LengthUnit.Vw) {
    const viewportWidth = renderer.viewport.width;
    return (value.value * (viewportWidth || baseSize)) / 100;
  }

  if (value.unit === LengthUnit.Vh) {
    const viewportHeight = renderer.viewport.height;
    return (value.value * (viewportHeight || baseSize)) / 100;
  }

  if (value.unit === LengthUnit.Lh) {
    const lineHeight = host.getCascadedValue('lineHeight');
    const fontSize = host.getCascadedValue('fontSize');
    const lhInPx = lineHeight * fontSize.value;
    return value.value * lhInPx;
  }

  return value.value;
}

export function resolveOrigin(
  transformOrigin: TransformOriginValue,
  width: number,
  height: number,
  container: CanvasContainer
) {
  return {
    x: lengthToPx(transformOrigin.x, width, container),
    y: lengthToPx(transformOrigin.y, height, container),
  };
}

export function createTransformMatrix(
  container: CanvasContainer,
  width: number,
  height: number
) {
  const { host } = container.renderer;
  const { scopeWidth: parentWidth, scopeHeight: parentHeight } = host;
  const style = container.computedStyles;
  const matrix = new DOMMatrix();

  const {
    scale = [1, 1],
    translate,
    rotate = Angle.Deg(0),
    transformOrigin = defaultOrigin,
  } = style;
  let [scaleX, scaleY] = Array.isArray(scale) ? scale : [scale, scale];

  const rotation = rotate.value;
  let translateX = 0;
  let translateY = 0;

  if (style.left !== undefined) {
    translateX = lengthToPx(style.left, parentWidth, container);
  } else if (style.justifySelf === Alignment.Center) {
    translateX = (parentWidth - width) / 2;
  } else if (style.justifySelf === Alignment.End) {
    translateX = parentWidth - width;
  } else if (
    style.justifySelf === undefined &&
    container.parent instanceof CanvasContainer
  ) {
    if (container.parent.computedStyles.justifyItems === Alignment.Center) {
      translateX = (parentWidth - width) / 2;
    } else if (container.parent.computedStyles.justifyItems === Alignment.End) {
      translateX = parentWidth - width;
    }
  }

  if (style.top !== undefined) {
    translateY = lengthToPx(style.top, parentHeight, container);
  } else if (style.alignSelf === Alignment.Center) {
    translateY = (parentHeight - height) / 2;
  } else if (style.alignSelf === Alignment.End) {
    translateY = parentHeight - height;
  } else if (
    style.alignSelf === undefined &&
    container.parent instanceof CanvasContainer
  ) {
    if (container.parent.computedStyles.alignItems === Alignment.Center) {
      translateY = (parentHeight - height) / 2;
    } else if (container.parent.computedStyles.alignItems === Alignment.End) {
      translateY = parentHeight - height;
    }
  }

  let tx = 0;
  let ty = 0;
  if (translate) {
    if (Array.isArray(translate)) {
      tx = lengthToPx(translate[0], width, container);
      ty = lengthToPx(translate[1], height, container);
    } else {
      tx = lengthToPx(translate, width, container);
    }
  }

  const { x, y } = resolveOrigin(transformOrigin, width, height, container);

  return matrix
    .translateSelf(translateX, translateY)
    .translateSelf(tx, ty)
    .translateSelf(x, y)
    .rotateSelf(rotation)
    .scaleSelf(scaleX, scaleY)
    .translateSelf(-x, -y);
}
