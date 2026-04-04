import type { JSX } from 'retend/jsx-runtime';

import type { CanvasHost } from '.';
import type { CanvasNode } from './node';

import { Length, LengthUnit } from '../style';
import { CanvasContainer } from './container';
import { lengthToPx } from './transform';

const FIT_CONTENT_LOOP =
  'retend-canvas: a percent sized container cannot be inside a fit-content container.';
const FIT_CONTENT_HEIGHT_LOOP =
  'retend-canvas: fit-content height loop detected, using current scope height.';

export function resolveFittedContent(
  children: CanvasNode[],
  style: JSX.Style,
  host: CanvasHost,
  nextWidth: number,
  baseWidth: number
) {
  const {
    width = Length.Px(100),
    height = Length.Px(100),
    maxWidth,
    maxHeight,
  } = style;
  let fitContentWidth = 0;
  let fitContentHeight = 0;

  host.pushStyleCtx(style);

  for (const child of children) {
    const childSize = child.measure(host);
    let childX = 0;
    if (child instanceof CanvasContainer) {
      const childStyle = child.styles;
      if (
        width.unit === LengthUnit.FitContent ||
        maxWidth?.unit === LengthUnit.FitContent
      ) {
        if (
          childStyle.width?.unit === LengthUnit.Pct ||
          childStyle.left?.unit === LengthUnit.Pct
        ) {
          console.warn(FIT_CONTENT_LOOP);
        }
        if (childStyle.left?.unit === LengthUnit.Px)
          childX = childStyle.left.value;
      }
      if (
        height.unit === LengthUnit.FitContent ||
        maxHeight?.unit === LengthUnit.FitContent
      ) {
        if (
          childStyle.height?.unit === LengthUnit.Pct ||
          childStyle.top?.unit === LengthUnit.Pct
        ) {
          console.warn(FIT_CONTENT_LOOP);
        }
      }
    }

    if (
      width.unit === LengthUnit.FitContent ||
      maxWidth?.unit === LengthUnit.FitContent
    ) {
      fitContentWidth = Math.max(fitContentWidth, childX + childSize.width);
    }
  }

  if (width.unit === LengthUnit.FitContent) nextWidth = fitContentWidth;
  if (maxWidth?.unit === LengthUnit.FitContent) {
    nextWidth = Math.min(nextWidth, fitContentWidth);
  } else if (maxWidth) {
    nextWidth = Math.min(nextWidth, lengthToPx(maxWidth, baseWidth));
  }

  if (
    height.unit === LengthUnit.FitContent ||
    maxHeight?.unit === LengthUnit.FitContent
  ) {
    for (const child of children) {
      const childSize = child.measure(host, nextWidth);
      let childY = 0;
      if (child instanceof CanvasContainer) {
        const childStyle = child.styles;
        if (
          childStyle.height?.unit === LengthUnit.Pct ||
          childStyle.top?.unit === LengthUnit.Pct
        ) {
          console.warn(FIT_CONTENT_HEIGHT_LOOP);
        }
        if (childStyle.top?.unit === LengthUnit.Px)
          childY = childStyle.top.value;
      }
      fitContentHeight = Math.max(fitContentHeight, childY + childSize.height);
    }
  }

  host.popStyleCtx();

  return { nextWidth, fitContentWidth, fitContentHeight };
}
