import type { JSX } from 'retend/jsx-runtime';

import {
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
  if (value.unit.value === LengthUnit.Pct.value) {
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
  const left = style.left ?? Length.Px(0);
  const top = style.top ?? Length.Px(0);
  const rotate = style.rotate ?? Angle.Deg(0);
  const { scale = 1 } = style;
  const transformOrigin = style.transformOrigin ?? defaultTransformOrigin;
  const rotation = rotate.value;
  const translateX = resolveCanvasLengthPercentage(left, parentWidth);
  const translateY = resolveCanvasLengthPercentage(top, parentHeight);
  const { x, y } = resolveTransformOrigin(transformOrigin, width, height);

  return new DOMMatrix()
    .translateSelf(translateX, translateY)
    .translateSelf(x, y)
    .rotateSelf(rotation)
    .scaleSelf(scale)
    .translateSelf(-x, -y);
}
