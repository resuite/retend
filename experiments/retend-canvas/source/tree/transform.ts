import type { CanvasContainer } from './container';
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

const defaultTransformOrigin = TransformOrigin.At(
  Length.Pct(50),
  Length.Pct(50)
);

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

  if (value.unit === LengthUnit.Lh) {
    const lhInPx = host.lineHeight * host.fontSize;
    return value.value * lhInPx;
  }

  return value.value;
}

export function resolveTransformOrigin(
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
  width: number,
  height: number,
  parentWidth: number,
  parentHeight: number,
  container: CanvasContainer
) {
  const style = container.styles;
  const matrix = container.renderer.transformMatrix;
  const rotate = style.rotate ?? Angle.Deg(0);
  const { scale = 1, translate } = style;
  let scaleX = 1;
  let scaleY = 1;
  if (Array.isArray(scale)) {
    scaleX = scale[0];
    scaleY = scale[1];
  } else {
    scaleX = scale;
    scaleY = scale;
  }
  const transformOrigin = style.transformOrigin ?? defaultTransformOrigin;
  const rotation = rotate.value;
  let translateX = 0;
  let translateY = 0;
  if (style.left !== undefined) {
    translateX = lengthToPx(style.left, parentWidth, container);
  } else if (style.justifySelf === Alignment.Center) {
    translateX = (parentWidth - width) / 2;
  } else if (style.justifySelf === Alignment.End) {
    translateX = parentWidth - width;
  }

  if (style.top !== undefined) {
    translateY = lengthToPx(style.top, parentHeight, container);
  } else if (style.alignSelf === Alignment.Center) {
    translateY = (parentHeight - height) / 2;
  } else if (style.alignSelf === Alignment.End) {
    translateY = parentHeight - height;
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

  const { x, y } = resolveTransformOrigin(
    transformOrigin,
    width,
    height,
    container
  );

  matrix.a = matrix.d = 1;
  matrix.b = matrix.c = matrix.e = matrix.f = 0;

  return matrix
    .translateSelf(translateX, translateY)
    .translateSelf(tx, ty)
    .translateSelf(x, y)
    .rotateSelf(rotation)
    .scaleSelf(scaleX, scaleY)
    .translateSelf(-x, -y);
}
