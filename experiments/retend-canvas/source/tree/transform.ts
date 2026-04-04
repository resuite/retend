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

export function resolveCanvasLengthPercentage(
  value: LengthValue,
  size: number
) {
  if (value.unit === LengthUnit.Pct) {
    return (value.value * size) / 100;
  }

  return value.value;
}

export function resolveTransformOrigin(
  transformOrigin: TransformOriginValue,
  width: number,
  height: number
) {
  return {
    x: resolveCanvasLengthPercentage(transformOrigin.x, width),
    y: resolveCanvasLengthPercentage(transformOrigin.y, height),
  };
}

export function createTransformMatrix(
  style: JSX.Style,
  width: number,
  height: number,
  parentWidth: number,
  parentHeight: number
) {
  const rotate = style.rotate ?? Angle.Deg(0);
  const { scale = 1 } = style;
  const transformOrigin = style.transformOrigin ?? defaultTransformOrigin;
  const rotation = rotate.value;
  let translateX = 0;
  let translateY = 0;
  if (style.left !== undefined) {
    translateX = resolveCanvasLengthPercentage(style.left, parentWidth);
  } else if (style.justifySelf === Alignment.Center) {
    translateX = (parentWidth - width) / 2;
  } else if (style.justifySelf === Alignment.End) {
    translateX = parentWidth - width;
  }

  if (style.top !== undefined) {
    translateY = resolveCanvasLengthPercentage(style.top, parentHeight);
  } else if (style.alignSelf === Alignment.Center) {
    translateY = (parentHeight - height) / 2;
  } else if (style.alignSelf === Alignment.End) {
    translateY = parentHeight - height;
  }
  const { x, y } = resolveTransformOrigin(transformOrigin, width, height);

  return new DOMMatrix()
    .translateSelf(translateX, translateY)
    .translateSelf(x, y)
    .rotateSelf(rotation)
    .scaleSelf(scale)
    .translateSelf(-x, -y);
}
