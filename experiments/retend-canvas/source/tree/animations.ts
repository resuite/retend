import type {
  AnimatableProperty,
  AnimationDefinition,
  AnimationKeyframe,
  CanvasStyle,
} from '../types';
import type { CanvasContainer } from './container';

export const ANIMATABLE_PROPERTIES = {
  scale: true,
  translate: true,
  opacity: true,
  top: true,
  left: true,
  rotate: true,
} as const satisfies Partial<Record<keyof CanvasStyle, boolean>>;

export interface CanvasAnimation {
  target: CanvasContainer;
  keyframes: AnimationKeyframe[];
  startTime: number;
  progress: number;
  duration: number;
  easing: [number, number, number, number];
}

export function updateAnimationAndTransitionStates(
  node: CanvasContainer,
  nextStyles: CanvasStyle
) {
  if (!node.isConnected) return;
  const { renderer, styles: current } = node;

  const animations = [];

  if (current.animationName && hasAnimationDataChanged(current, nextStyles)) {
    renderer.cancelAnimation(node, current.animationName);
    const newAnimation = createAnimation(node, nextStyles);
    if (newAnimation) animations.push(newAnimation);
  }

  // const changedAnimatableProperties = [];
  // for (const key in nextStyles) {
  // }

  for (const animation of animations) renderer.scheduleAnimation(animation);
}

function hasAnimationDataChanged(current: CanvasStyle, next: CanvasStyle) {
  const {
    animationName: currentAnimationName,
    animationDuration: currentAnimationDuration,
    animationTimingFunction: currentTimingFunction,
    animationDelay: currentDelay,
  } = current;

  const {
    animationName: nextAnimationName,
    animationDuration: nextAnimationDuration,
    animationTimingFunction: nextTimingFunction,
    animationDelay: nextDelay,
  } = next;

  return (
    currentAnimationName !== nextAnimationName ||
    currentAnimationDuration !== nextAnimationDuration ||
    currentTimingFunction?.join(',') !== nextTimingFunction?.join(',') ||
    currentDelay !== nextDelay
  );
}

function getAnimatableStyles(style: CanvasStyle) {
  const result: Partial<{
    [key in AnimatableProperty]: CanvasStyle[key];
  }> = {};
  for (const key in style) {
    if (key in ANIMATABLE_PROPERTIES) {
      const _key = key as AnimatableProperty;
      result[_key] = style[_key] as never;
    }
  }
  return result;
}

function convertToKeyframes(
  definition: AnimationDefinition,
  finalState: CanvasStyle
): AnimationKeyframe[] {
  const keyframes: AnimationKeyframe[] = [];

  for (const key in definition) {
    const stepKey = key as keyof AnimationDefinition;
    const styles = definition[stepKey];

    if (!styles) continue;

    let offset =
      stepKey === 'from' ? 0 : stepKey === 'to' ? 1 : parseFloat(stepKey) / 100;
    offset = Math.max(0, Math.min(1, offset));
    keyframes.push({ offset, styles });
  }

  const sorted = keyframes.toSorted((a, b) => a.offset - b.offset);

  if (sorted.length && sorted[0].offset !== 0) {
    sorted.unshift({
      offset: 0,
      styles: getAnimatableStyles(finalState),
    });
  }
  if (sorted.length && sorted[sorted.length - 1].offset !== 1) {
    sorted.push({
      offset: 1,
      styles: getAnimatableStyles(finalState),
    });
  }

  return sorted;
}

function createAnimation(
  node: CanvasContainer,
  nextStyles: CanvasStyle
): CanvasAnimation | undefined {
  const current = node.styles;
  const {
    animationName = current.animationName,
    animationDuration = current.animationDuration ?? 0,
    animationDelay = current.animationDelay ?? 0,
    animationTimingFunction = current.animationTimingFunction ?? [0, 0, 1, 1],
  } = nextStyles;

  if (!animationName) return undefined;

  const finalState = { ...node.styles, ...nextStyles };
  const keyframes = convertToKeyframes(animationName, finalState);
  if (!keyframes.length) return undefined;

  return {
    target: node,
    keyframes,
    startTime: performance.now() + animationDelay,
    progress: 0,
    duration: animationDuration,
    easing: animationTimingFunction,
  };
}
