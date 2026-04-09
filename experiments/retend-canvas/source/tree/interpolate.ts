import type {
  AnimatableProperty,
  AnimationKeyframe,
  CanvasStyle,
} from '../types';

import {
  Angle,
  type AngleValue,
  type EasingValue,
  Length,
  type LengthValue,
} from '../style';
import { CanvasContainer } from './container';
import { lengthToPx } from './transform';

export function applyTiming(progress: number, easing: EasingValue): number {
  const [x1, y1, x2, y2] = easing;
  if (progress <= 0 || progress >= 1) return Math.max(0, Math.min(1, progress));

  let start = 0;
  let end = 1;
  let time = progress;

  for (let index = 0; index < 12; index += 1) {
    time = (start + end) / 2;
    const inverse = 1 - time;
    const sample =
      3 * inverse * inverse * time * x1 +
      3 * inverse * time * time * x2 +
      time * time * time;

    if (sample < progress) start = time;
    else end = time;
  }

  const inverse = 1 - time;
  return (
    3 * inverse * inverse * time * y1 +
    3 * inverse * time * time * y2 +
    time * time * time
  );
}

export function interpolateTrackValue<T extends AnimatableProperty>(
  property: T,
  keyframes: AnimationKeyframe<T>[],
  progress: number,
  node: CanvasContainer,
  easing: EasingValue
): CanvasStyle[AnimatableProperty] | undefined {
  const firstFrame = keyframes[0];
  const lastFrame = keyframes[keyframes.length - 1];

  if (!firstFrame || !lastFrame) return undefined;
  if (progress <= firstFrame.offset) return firstFrame.value;
  if (progress >= lastFrame.offset) return lastFrame.value;

  let startFrame = firstFrame;
  let endFrame = lastFrame;

  for (let index = 1; index < keyframes.length; index += 1) {
    const frame = keyframes[index];
    if (frame.offset >= progress) {
      startFrame = keyframes[index - 1];
      endFrame = frame;
      break;
    }
  }

  if (startFrame.offset === endFrame.offset) return startFrame.value;

  const linearProgress =
    (progress - startFrame.offset) / (endFrame.offset - startFrame.offset);
  const localProgress = applyTiming(linearProgress, easing);

  switch (property) {
    case 'opacity': {
      const start = startFrame.value as number;
      const end = endFrame.value as number;
      return start + (end - start) * localProgress;
    }

    case 'scale': {
      const start = toPair(startFrame.value);
      const end = toPair(endFrame.value);
      return [
        start[0] + (end[0] - start[0]) * localProgress,
        start[1] + (end[1] - start[1]) * localProgress,
      ];
    }

    case 'rotate': {
      const start = startFrame.value as AngleValue;
      const end = endFrame.value as AngleValue;
      return Angle.Deg(start.value + (end.value - start.value) * localProgress);
    }

    case 'left':
    case 'top': {
      const start = startFrame.value as LengthValue;
      const end = endFrame.value as LengthValue;
      let baseSize = 0;
      if (node.parent instanceof CanvasContainer) {
        const { width, height } = node.parent.resolvedSize;
        baseSize = property === 'left' ? width : height;
      }
      return interpolateLength(start, end, localProgress, baseSize, node);
    }

    case 'translate': {
      const start = startFrame.value as LengthValue;
      const end = endFrame.value as LengthValue;
      let baseWidth = 0;
      let baseHeight = 0;
      if (node.parent instanceof CanvasContainer) {
        const { width, height } = node.parent.resolvedSize;
        baseWidth = width;
        baseHeight = height;
      }

      if (Array.isArray(start) && Array.isArray(end)) {
        return [
          interpolateLength(start[0], end[0], localProgress, baseWidth, node),
          interpolateLength(start[1], end[1], localProgress, baseHeight, node),
        ];
      }

      if (!Array.isArray(start) && !Array.isArray(end)) {
        return interpolateLength(start, end, localProgress, baseWidth, node);
      }

      if (localProgress >= 0.5) return end;
      return start;
    }

    default:
      return startFrame.value;
  }
}

function toPair(value: any): [number, number] {
  if (Array.isArray(value)) return value as [number, number];
  return [value, value];
}

function interpolateLength(
  start: LengthValue,
  end: LengthValue,
  progress: number,
  baseSize: number,
  node: CanvasContainer
) {
  const startPx = lengthToPx(start, baseSize, node);
  const endPx = lengthToPx(end, baseSize, node);

  return Length.Px(startPx + (endPx - startPx) * progress);
}
