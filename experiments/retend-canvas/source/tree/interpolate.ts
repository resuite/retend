import type {
  AnimatableProperty,
  AnimationKeyframe,
  CanvasStyle,
} from '../types';
import type { CanvasContainer } from './container';

import { type EasingValue, Length } from '../style';
import { lengthToPx } from './transform';

export function applyTimingFunction(
  progress: number,
  [x1, y1, x2, y2]: [number, number, number, number]
): number {
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

export function interpolateTrackValue(
  property: AnimatableProperty,
  keyframes: AnimationKeyframe<AnimatableProperty>[],
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

  if (startFrame.offset === endFrame.offset) {
    return startFrame.value;
  }

  const linearProgress =
    (progress - startFrame.offset) / (endFrame.offset - startFrame.offset);
  const localProgress = applyTimingFunction(linearProgress, easing);

  switch (property) {
    case 'opacity': {
      const start = startFrame.value as number;
      const end = endFrame.value as number;
      return start + (end - start) * localProgress;
    }

    case 'scale': {
      const start = toScalePair(
        startFrame.value as NonNullable<CanvasStyle['scale']>
      );
      const end = toScalePair(
        endFrame.value as NonNullable<CanvasStyle['scale']>
      );
      return [
        start[0] + (end[0] - start[0]) * localProgress,
        start[1] + (end[1] - start[1]) * localProgress,
      ];
    }

    case 'rotate': {
      const start = startFrame.value as NonNullable<CanvasStyle['rotate']>;
      const end = endFrame.value as NonNullable<CanvasStyle['rotate']>;
      return {
        unit: start.unit,
        value: start.value + (end.value - start.value) * localProgress,
      };
    }

    case 'left': {
      const start = startFrame.value as NonNullable<CanvasStyle['left']>;
      const end = endFrame.value as NonNullable<CanvasStyle['left']>;
      const baseSize = node.renderer.host.scopeWidth;
      return interpolateLengthValue(start, end, localProgress, baseSize, node);
    }

    case 'top': {
      const start = startFrame.value as NonNullable<CanvasStyle['top']>;
      const end = endFrame.value as NonNullable<CanvasStyle['top']>;
      const baseSize = node.renderer.host.scopeHeight;
      return interpolateLengthValue(start, end, localProgress, baseSize, node);
    }

    case 'translate': {
      const start = startFrame.value as NonNullable<CanvasStyle['translate']>;
      const end = endFrame.value as NonNullable<CanvasStyle['translate']>;
      const baseWidth = node.renderer.host.scopeWidth;
      const baseHeight = node.renderer.host.scopeHeight;

      if (Array.isArray(start) && Array.isArray(end)) {
        return [
          interpolateLengthValue(
            start[0],
            end[0],
            localProgress,
            baseWidth,
            node
          ),
          interpolateLengthValue(
            start[1],
            end[1],
            localProgress,
            baseHeight,
            node
          ),
        ];
      }

      if (!Array.isArray(start) && !Array.isArray(end)) {
        return interpolateLengthValue(
          start,
          end,
          localProgress,
          baseWidth,
          node
        );
      }

      if (localProgress >= 0.5) {
        return end;
      }

      return start;
    }

    default:
      return startFrame.value;
  }
}

function toScalePair(
  value: NonNullable<CanvasStyle['scale']>
): [number, number] {
  if (Array.isArray(value)) {
    return value;
  }

  return [value, value];
}

function interpolateLengthValue(
  start: NonNullable<CanvasStyle['left']>,
  end: NonNullable<CanvasStyle['left']>,
  progress: number,
  baseSize: number,
  node: CanvasContainer
) {
  const startPx = lengthToPx(start, baseSize, node);
  const endPx = lengthToPx(end, baseSize, node);

  return Length.Px(startPx + (endPx - startPx) * progress);
}
