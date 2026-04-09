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
  definition: AnimationDefinition;
  target: CanvasContainer;
  tracks: AnimationTrack<AnimatableProperty>[];
  iterations: number;
  currentIteration: number;
  startTime: number;
  progress: number;
  duration: number;
  easing: [number, number, number, number];
}

export interface AnimationTrack<T extends AnimatableProperty> {
  property: T;
  keyframes: AnimationKeyframe<T>[];
}

export function updateAnimationAndTransitionStates(
  node: CanvasContainer,
  nextStyles: CanvasStyle
) {
  if (!node.isConnected) return;
  const { renderer, styles: current } = node;

  const animations = [];

  if (hasAnimationDataChanged(current, nextStyles)) {
    if (current.animationName) {
      renderer.cancelAnimation(node, current.animationName);
    }
    const newAnimation = createAnimation(node, nextStyles);
    if (newAnimation) animations.push(newAnimation);
  }

  // todo: add transitions.
  // const changedAnimatableProperties = [];
  // for (const key in nextStyles) {
  // }

  renderer.scheduleAnimations(animations);
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
    if (firstFrame?.offset !== 0 && staticStyle) {
      track.keyframes.unshift({ offset: 0, value: staticStyle });
    }
    if (lastFrame?.offset !== 1 && staticStyle) {
      track.keyframes.push({ offset: 1, value: staticStyle });
    }
  }

  return tracks;
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
    animationIterationCount = current.animationIterationCount ?? 1,
    animationTimingFunction = current.animationTimingFunction ?? [0, 0, 1, 1],
  } = nextStyles;

  if (!animationName) return undefined;

  const finalState = { ...node.styles, ...nextStyles };
  const tracks = convertToTracklist(animationName, finalState);
  if (!tracks.length) return undefined;

  return {
    target: node,
    definition: animationName,
    iterations: animationIterationCount,
    currentIteration: 0,
    tracks,
    startTime: performance.now() + animationDelay,
    progress: 0,
    duration: animationDuration,
    easing: animationTimingFunction,
  };
}
