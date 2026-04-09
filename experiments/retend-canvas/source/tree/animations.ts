import type {
  AnimatableProperty,
  AnimationKeyframe,
  AnimationDefinition,
  CanvasStyle,
} from '../types';
import type { CanvasContainer } from './container';

import { AnimationFillMode, type AnimationFillModeValue } from '../style';
import { interpolateTrackValue } from './interpolate';

export const ANIMATABLE_PROPERTIES = {
  scale: true,
  translate: true,
  opacity: true,
  top: true,
  left: true,
  rotate: true,
} as const satisfies Partial<Record<keyof CanvasStyle, boolean>>;

export interface CanvasAnimation {
  definition: AnimationDefinition;
  target: CanvasContainer;
  tracks: AnimationTrack<AnimatableProperty>[];
  iterations: number;
  fillMode: AnimationFillModeValue;
  progress: number;
  duration: number;
  lastFrame: number;
  easing: [number, number, number, number];
}

export interface AnimationTrack<T extends AnimatableProperty> {
  property: T;
  keyframes: AnimationKeyframe<T>[];
}

export function scheduleAnimations(
  node: CanvasContainer,
  nextStyles: CanvasStyle,
  replace: boolean
) {
  const { renderer, computedStyles: current } = node;
  const animations: CanvasAnimation[] = [];

  if (hasAnimationDataChanged(current, nextStyles, replace)) {
    if (node.isConnected && current.animationName) {
      renderer.cancelAnimation(node, current.animationName);
    }
    const newAnimation = createAnimation(node, nextStyles, replace);
    if (newAnimation) renderer.scheduleAnimations([newAnimation]);
  }

  return animations;
}

function hasAnimationDataChanged(
  current: CanvasStyle,
  next: CanvasStyle,
  replace: boolean
) {
  let animationName = next.animationName;
  let animationDuration = next.animationDuration;
  let animationTimingFunction = next.animationTimingFunction;
  let animationDelay = next.animationDelay;
  let animationFillMode = next.animationFillMode;
  let animationIterationCount = next.animationIterationCount;

  if (!replace) {
    if (!('animationName' in next)) animationName = current.animationName;
    if (!('animationDuration' in next)) {
      animationDuration = current.animationDuration;
    }
    if (!('animationTimingFunction' in next)) {
      animationTimingFunction = current.animationTimingFunction;
    }
    if (!('animationDelay' in next)) animationDelay = current.animationDelay;
    if (!('animationFillMode' in next)) {
      animationFillMode = current.animationFillMode;
    }
    if (!('animationIterationCount' in next)) {
      animationIterationCount = current.animationIterationCount;
    }
  }

  return (
    current.animationName !== animationName ||
    current.animationDuration !== animationDuration ||
    current.animationTimingFunction?.join(',') !==
      animationTimingFunction?.join(',') ||
    current.animationDelay !== animationDelay ||
    current.animationFillMode !== animationFillMode ||
    current.animationIterationCount !== animationIterationCount
  );
}

function convertToTracklist(
  definition: AnimationDefinition,
  finalState: CanvasStyle
) {
  const propertyMap: Partial<
    Record<AnimatableProperty, AnimationTrack<AnimatableProperty>>
  > = {};

  for (const frame in definition) {
    const key = frame as keyof AnimationDefinition;
    const offset =
      key === 'from' ? 0 : key === 'to' ? 1 : parseFloat(key) / 100;

    for (const styleProperty in definition[key]) {
      const property = styleProperty as AnimatableProperty;
      const value = definition[key][property];
      const track = (propertyMap[property] ??= { property, keyframes: [] });
      track.keyframes.push({ offset, value });
    }
  }

  const tracks = Object.values(propertyMap);
  for (const track of tracks) {
    track.keyframes.sort((a, b) => a.offset - b.offset);
    const firstFrame = track.keyframes[0];
    const lastFrame = track.keyframes[track.keyframes.length - 1];
    const staticStyle = finalState[track.property];

    // Filling in missing frames.
    if (firstFrame?.offset !== 0 && staticStyle !== undefined) {
      track.keyframes.unshift({ offset: 0, value: staticStyle });
    }
    if (lastFrame?.offset !== 1 && staticStyle !== undefined) {
      track.keyframes.push({ offset: 1, value: staticStyle });
    }
  }

  return tracks;
}

function createAnimation(
  node: CanvasContainer,
  nextStyles: CanvasStyle,
  replace: boolean
): CanvasAnimation | undefined {
  const current = node.computedStyles;
  const targetStyles = replace ? nextStyles : { ...current, ...nextStyles };
  const {
    animationName,
    animationDuration = 0,
    animationDelay = 0,
    animationFillMode = AnimationFillMode.None,
    animationIterationCount = 1,
    animationTimingFunction = [0, 0, 1, 1],
  } = targetStyles;

  if (!animationName) return undefined;
  const tracks = convertToTracklist(animationName, targetStyles);
  if (!tracks.length) return undefined;

  return {
    target: node,
    definition: animationName,
    iterations: animationIterationCount,
    tracks,
    fillMode: animationFillMode,
    progress: -animationDelay,
    duration: animationDuration,
    lastFrame: performance.now(),
    easing: animationTimingFunction,
  };
}

export function tickAnimations(animations: CanvasAnimation[]): boolean {
  const remainingAnimations: CanvasAnimation[] = [];
  const now = performance.now();

  for (const animation of animations) {
    const { target: node } = animation;
    const animatedStyle: Partial<CanvasStyle> = {};

    animation.progress += now - animation.lastFrame;
    animation.lastFrame = now;

    const tickState = resolveTickState(animation);

    for (const track of animation.tracks) {
      if (tickState.phase !== 'active') {
        animatedStyle[track.property] = resolveFilledValue(
          track.property,
          track.keyframes,
          node,
          tickState.phase
        ) as never;
        continue;
      }

      animatedStyle[track.property] = interpolateTrackValue(
        track.property,
        track.keyframes,
        tickState.progress,
        node,
        animation.easing
      ) as never;
    }

    Object.assign(node.computedStyles, animatedStyle);
    node.checkForPathChange(animatedStyle);
    if (tickState.keepAnimation) remainingAnimations.push(animation);
  }

  animations.length = 0;
  animations.push(...remainingAnimations);

  return remainingAnimations.length > 0;
}

type TickPhase = 'active' | 'from' | 'to' | 'static';

function resolveTickState(animation: CanvasAnimation): {
  keepAnimation: boolean;
  phase: TickPhase;
  progress: number;
} {
  if (animation.duration <= 0 || animation.iterations <= 0) {
    return {
      keepAnimation: false,
      phase: resolveCompletedPhase(animation.fillMode),
      progress: 0,
    };
  }

  if (animation.progress < 0) {
    return {
      keepAnimation: true,
      phase: resolveWaitingPhase(animation.fillMode),
      progress: 0,
    };
  }

  const totalDuration = animation.duration * animation.iterations;
  if (Number.isFinite(totalDuration) && animation.progress >= totalDuration) {
    return {
      keepAnimation: false,
      phase: resolveCompletedPhase(animation.fillMode),
      progress: 1,
    };
  }

  const overallProgress = animation.progress / animation.duration;
  const currentIteration = Math.floor(overallProgress);
  const progress = overallProgress - currentIteration;

  return {
    keepAnimation: true,
    phase: 'active',
    progress,
  };
}

function resolveWaitingPhase(fillMode: AnimationFillModeValue): TickPhase {
  if (fillMode === AnimationFillMode.Backwards) return 'from';
  if (fillMode === AnimationFillMode.Both) return 'from';
  return 'static';
}

function resolveCompletedPhase(fillMode: AnimationFillModeValue): TickPhase {
  if (fillMode === AnimationFillMode.Forwards) return 'to';
  if (fillMode === AnimationFillMode.Both) return 'to';
  return 'static';
}

function resolveFilledValue(
  property: AnimatableProperty,
  keyframes: AnimationKeyframe<AnimatableProperty>[],
  node: CanvasContainer,
  phase: Exclude<TickPhase, 'active'>
) {
  if (phase === 'static') return node.authoredStyles[property];
  if (phase === 'from') return keyframes[0]?.value;
  return keyframes[keyframes.length - 1]?.value;
}
