import type { JSX } from 'retend/jsx-runtime';

function isHorizontalKeyword(token: string) {
  return token === 'left' || token === 'right';
}

function isVerticalKeyword(token: string) {
  return token === 'top' || token === 'bottom';
}

function resolveKeyword(token: string, size: number) {
  if (token === 'left' || token === 'top') {
    return 0;
  }

  if (token === 'center') {
    return size / 2;
  }

  if (token === 'right' || token === 'bottom') {
    return size;
  }

  return null;
}

function resolveLengthPercentage(token: string, size: number) {
  const keyword = resolveKeyword(token, size);
  if (keyword !== null) {
    return keyword;
  }

  const value = Number.parseFloat(token);
  if (token.endsWith('%')) {
    return (value * size) / 100;
  }

  return value;
}

export function resolveCanvasLengthPercentage(
  value: number | string,
  size: number
) {
  return resolveLengthPercentage(String(value), size);
}

export function resolveTransformOrigin(
  transformOrigin: string,
  width: number,
  height: number
) {
  const tokens = transformOrigin.trim().split(/\s+/).slice(0, 2);
  if (tokens.length === 0 || tokens[0] === '') {
    return {
      x: width / 2,
      y: height / 2,
    };
  }

  if (tokens.length === 1) {
    const token = tokens[0];
    if (isVerticalKeyword(token)) {
      return {
        x: width / 2,
        y: resolveLengthPercentage(token, height),
      };
    }

    return {
      x: resolveLengthPercentage(token, width),
      y: height / 2,
    };
  }

  let xToken = tokens[0];
  let yToken = tokens[1];
  if (isVerticalKeyword(tokens[0]) || isHorizontalKeyword(tokens[1])) {
    xToken = tokens[1];
    yToken = tokens[0];
  }

  return {
    x: resolveLengthPercentage(xToken, width),
    y: resolveLengthPercentage(yToken, height),
  };
}

export function createTransformMatrix(
  style: JSX.Style,
  width: number,
  height: number,
  parentWidth: number,
  parentHeight: number
) {
  const {
    left = 0,
    top = 0,
    rotate = '0deg',
    scale = 1,
    transformOrigin = '50% 50%',
  } = style;
  const rotation = Number.parseFloat(rotate);
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
