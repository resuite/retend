import { Length, LengthUnit } from '../style';
import { WARNING_FIT_CONTENT_LOOP } from '../warnings';
import { CanvasContainer } from './container';
import { lengthToPx } from './transform';

export function resolveFittedContent(
  container: CanvasContainer,
  nextWidth: number,
  baseWidth: number
) {
  const { children, styles: style } = container;
  const host = container.renderer.host;
  const {
    width = Length.Pct(100),
    height = Length.FitContent,
    maxWidth,
    maxHeight,
  } = style;
  let fitContentWidth = 0;
  let fitContentHeight = 0;
  const needsFitWidth =
    width.unit === LengthUnit.FitContent ||
    maxWidth?.unit === LengthUnit.FitContent;
  const needsFitHeight =
    height.unit === LengthUnit.FitContent ||
    maxHeight?.unit === LengthUnit.FitContent;
  const canReuseMeasure = needsFitWidth && nextWidth === host.scopeWidth;
  const measuredChildren: Array<
    ReturnType<(typeof children)[number]['measure']>
  > = [];

  host.setStyleState(style);

  if (needsFitWidth) {
    for (const child of children) {
      const childSize = child.measure();
      if (canReuseMeasure) measuredChildren.push(childSize);
      let childX = 0;
      if (child instanceof CanvasContainer) {
        const childStyle = child.styles;
        if (
          childStyle.width?.unit === LengthUnit.Pct ||
          childStyle.left?.unit === LengthUnit.Pct
        ) {
          console.warn(WARNING_FIT_CONTENT_LOOP);
        }
        if (childStyle.left?.unit === LengthUnit.Px)
          childX = childStyle.left.value;
      }
      fitContentWidth = Math.max(fitContentWidth, childX + childSize.width);
    }
  }

  if (width.unit === LengthUnit.FitContent) nextWidth = fitContentWidth;
  if (maxWidth?.unit === LengthUnit.FitContent) {
    nextWidth = Math.min(nextWidth, fitContentWidth);
  } else if (maxWidth) {
    nextWidth = Math.min(nextWidth, lengthToPx(maxWidth, baseWidth, container));
  }

  if (needsFitHeight) {
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      const childSize = canReuseMeasure
        ? (measuredChildren[i] ?? child.measure(nextWidth))
        : child.measure(nextWidth);
      let childY = 0;
      if (child instanceof CanvasContainer) {
        const childStyle = child.styles;
        if (
          childStyle.height?.unit === LengthUnit.Pct ||
          childStyle.top?.unit === LengthUnit.Pct
        ) {
          console.warn(WARNING_FIT_CONTENT_LOOP);
        }
        if (childStyle.top?.unit === LengthUnit.Px)
          childY = childStyle.top.value;
      }
      fitContentHeight = Math.max(fitContentHeight, childY + childSize.height);
    }
  }

  host.unsetStyleState(style);

  return { nextWidth, fitContentWidth, fitContentHeight };
}
