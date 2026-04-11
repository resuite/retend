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
  node: CanvasContainer
) {
  if (value.unit === LengthUnit.Pct) return (value.value * baseSize) / 100;
  if (value.unit === LengthUnit.Vw)
    return (value.value * (node.renderer.viewport.width || baseSize)) / 100;
  if (value.unit === LengthUnit.Vh)
    return (value.value * (node.renderer.viewport.height || baseSize)) / 100;
  if (value.unit === LengthUnit.Lh) {
    const { host } = node.renderer;
    return (
      value.value *
      host.getCascadedValue('lineHeight') *
      host.getCascadedValue('fontSize').value
    );
  }
  return value.value;
}

function resolvePosition(
  origin: LengthValue | undefined,
  parentSize: number,
  selfAlign: number | undefined,
  parentAlign: number | undefined,
  size: number,
  node: CanvasContainer
): number {
  if (origin !== undefined) return lengthToPx(origin, parentSize, node);
  if (selfAlign === Alignment.Center) return (parentSize - size) / 2;
  if (selfAlign === Alignment.End) return parentSize - size;
  if (selfAlign === undefined) {
    if (parentAlign === Alignment.Center) return (parentSize - size) / 2;
    if (parentAlign === Alignment.End) return parentSize - size;
  }
  return 0;
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

  const parent =
    container.parent instanceof CanvasContainer ? container.parent : null;
  const translateX = resolvePosition(
    style.left,
    parentWidth,
    style.justifySelf,
    parent?.computedStyles.justifyItems,
    width,
    container
  );
  const translateY = resolvePosition(
    style.top,
    parentHeight,
    style.alignSelf,
    parent?.computedStyles.alignItems,
    height,
    container
  );

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
    .rotateSelf(rotate.value)
    .scaleSelf(scaleX, scaleY)
    .translateSelf(-x, -y);
}
