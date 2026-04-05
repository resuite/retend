import type { JSX } from 'retend/jsx-runtime';

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
  viewportWidth?: number
) {
  if (value.unit === LengthUnit.Pct) {
    return (value.value * baseSize) / 100;
  }

  if (value.unit === LengthUnit.Vw) {
    return (value.value * (viewportWidth || baseSize)) / 100;
  }

  return value.value;
}

export function resolveTransformOrigin(
  transformOrigin: TransformOriginValue,
  width: number,
  height: number,
  viewportWidth?: number
) {
  return {
    x: lengthToPx(transformOrigin.x, width, viewportWidth),
    y: lengthToPx(transformOrigin.y, height, viewportWidth),
  };
}

export function createTransformMatrix(
  matrix: DOMMatrix,
  style: JSX.Style,
  width: number,
  height: number,
  parentWidth: number,
  parentHeight: number,
  viewportWidth?: number
) {
  const rotate = style.rotate ?? Angle.Deg(0);
  const { scale = 1 } = style;
  const transformOrigin = style.transformOrigin ?? defaultTransformOrigin;
  const rotation = rotate.value;
  let translateX = 0;
  let translateY = 0;
  if (style.left !== undefined) {
    translateX = lengthToPx(style.left, parentWidth, viewportWidth);
  } else if (style.justifySelf === Alignment.Center) {
    translateX = (parentWidth - width) / 2;
  } else if (style.justifySelf === Alignment.End) {
    translateX = parentWidth - width;
  }

  if (style.top !== undefined) {
    translateY = lengthToPx(style.top, parentHeight, viewportWidth);
  } else if (style.alignSelf === Alignment.Center) {
    translateY = (parentHeight - height) / 2;
  } else if (style.alignSelf === Alignment.End) {
    translateY = parentHeight - height;
  }
  const { x, y } = resolveTransformOrigin(
    transformOrigin,
    width,
    height,
    viewportWidth
  );

  matrix.a = matrix.d = 1;
  matrix.b = matrix.c = matrix.e = matrix.f = 0;

  return matrix
    .translateSelf(translateX, translateY)
    .translateSelf(x, y)
    .rotateSelf(rotation)
    .scaleSelf(scale)
    .translateSelf(-x, -y);
}
