import type {
  AnimatableProperty,
  AnimationKeyframe,
  AnimationDefinition,
  CanvasStyle,
} from '../types';
import type { CanvasContainer } from './container';

import {
  AnimationFillMode,
  Length,
  type AnimationFillModeValue,
} from '../style';
import { interpolateTrackValue } from './interpolate';

const TRANSITION_ANIMATIONS = {
  scale: {} as AnimationDefinition,
  translate: {} as AnimationDefinition,
  opacity: {} as AnimationDefinition,
  top: {} as AnimationDefinition,
  left: {} as AnimationDefinition,
  rotate: {} as AnimationDefinition,
} as const satisfies Record<AnimatableProperty, AnimationDefinition>;

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
  const targetStyles = replace ? nextStyles : { ...current, ...nextStyles };
  const animationChanged = hasAnimationDataChanged(current, targetStyles);

  if (animationChanged && node.isConnected && current.animationName) {
    renderer.cancelAnimation(node, current.animationName);
  }

  const isAnimationActive =
    !!targetStyles.animationName &&
    (animationChanged ||
      renderer.hasAnimation(node, targetStyles.animationName));
  const { transitions, canceledProperties } = collectTransitions(
    node,
    current,
    targetStyles,
    isAnimationActive
  );

  if (node.isConnected) {
    for (const property of canceledProperties) {
      renderer.cancelAnimation(node, TRANSITION_ANIMATIONS[property]);
    }
  }

  if (!animationChanged) {
    if (transitions.length) renderer.scheduleAnimations(transitions);
    return;
  }

  const animation = createAnimation(node, targetStyles);
  if (animation) renderer.scheduleAnimations([animation]);
  if (transitions.length) renderer.scheduleAnimations(transitions);
}

function hasAnimationDataChanged(current: CanvasStyle, next: CanvasStyle) {
  return (
    current.animationName !== next.animationName ||
    current.animationDuration !== next.animationDuration ||
    current.animationTimingFunction?.join(',') !==
      next.animationTimingFunction?.join(',') ||
    current.animationDelay !== next.animationDelay ||
    current.animationFillMode !== next.animationFillMode ||
    current.animationIterationCount !== next.animationIterationCount
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
  targetStyles: CanvasStyle
): CanvasAnimation | undefined {
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

function collectTransitions(
  node: CanvasContainer,
  current: CanvasStyle,
  targetStyles: CanvasStyle,
  isAnimationActive: boolean
): {
  transitions: CanvasAnimation[];
  canceledProperties: AnimatableProperty[];
} {
  const {
    animationName,
    transitionProperty,
    transitionDuration = 0,
    transitionDelay = 0,
    transitionTimingFunction = [0.25, 0.1, 0.25, 1],
  } = targetStyles;

  if (!transitionProperty || transitionDuration <= 0) {
    return { transitions: [], canceledProperties: [] };
  }

  const transitionProperties = Array.isArray(transitionProperty)
    ? transitionProperty
    : [transitionProperty];
  const animationProperties = new Set<AnimatableProperty>();

  if (animationName && isAnimationActive) {
    for (const track of convertToTracklist(animationName, targetStyles)) {
      animationProperties.add(track.property);
    }
  }

  const transitions: CanvasAnimation[] = [];
  const canceledProperties: AnimatableProperty[] = [];

  for (const property of transitionProperties) {
    if (animationProperties.has(property)) {
      canceledProperties.push(property);
      continue;
    }

    const startValue = current[property];
    const endValue = targetStyles[property];
    if (startValue === undefined || endValue === undefined) continue;

    if (!hasChanged(property, startValue, endValue)) continue;

    canceledProperties.push(property);
    transitions.push({
      target: node,
      definition: TRANSITION_ANIMATIONS[property],
      iterations: 1,
      tracks: [
        {
          property,
          keyframes: [
            { offset: 0, value: startValue },
            { offset: 1, value: endValue },
          ],
        },
      ],
      fillMode: AnimationFillMode.Both,
      progress: -transitionDelay,
      duration: transitionDuration,
      lastFrame: performance.now(),
      easing: transitionTimingFunction,
    });
  }

  return { transitions, canceledProperties };
}

export function tickAnimations(animations: CanvasAnimation[]): boolean {
  const remainingAnimations: CanvasAnimation[] = [];
  const now = performance.now();

  for (const animation of animations) {
    const { target: node } = animation;
    const animatedStyle: Partial<CanvasStyle> = {};

    const elapsed = now - animation.lastFrame;
    if (elapsed >= 1) animation.progress += elapsed;
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

function hasChanged(
  property: AnimatableProperty,
  startValue: NonNullable<CanvasStyle[AnimatableProperty]>,
  endValue: NonNullable<CanvasStyle[AnimatableProperty]>
) {
  switch (property) {
    case 'opacity':
      return startValue !== endValue;
    case 'scale': {
      const start = Array.isArray(startValue)
        ? startValue
        : [startValue, startValue];
      const end = Array.isArray(endValue) ? endValue : [endValue, endValue];
      return start[0] !== end[0] || start[1] !== end[1];
    }
    case 'rotate':
    case 'left':
    case 'top': {
      const start = startValue as { unit: number; value: number };
      const end = endValue as { unit: number; value: number };
      return start.unit !== end.unit || start.value !== end.value;
    }
    case 'translate': {
      const start = (
        Array.isArray(startValue) ? startValue : [startValue, Length.Px(0)]
      ) as Array<{ unit: number; value: number }>;
      const end = (
        Array.isArray(endValue) ? endValue : [endValue, Length.Px(0)]
      ) as Array<{ unit: number; value: number }>;
      return (
        start[0].unit !== end[0].unit ||
        start[0].value !== end[0].value ||
        start[1].unit !== end[1].unit ||
        start[1].value !== end[1].value
      );
    }
  }
}
