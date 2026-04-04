import type { JSX } from 'retend/jsx-runtime';

import type { CanvasRenderer } from '../canvas-renderer';
import type { CanvasNode } from './node';

import {
  Angle,
  durationToMs,
  Length,
  LengthUnit,
  Easing,
  type EasingValue,
  type TransitionableStyleKey,
  Duration,
} from '../style';
import { CanvasContainer } from './container';
import { lengthToPx } from './transform';

interface CanvasTimeline {
  now(): number;
}

export interface CanvasTransition {
  node: CanvasContainer;
  key: TransitionableStyleKey;
  startTime: number;
  delay: number;
  duration: number;
  timingFunction: EasingValue;
  from: TransitionValue;
  to: TransitionValue;
  fromColor?: ParsedColor;
  toColor?: ParsedColor;
  target: JSX.Style[TransitionableStyleKey];
}

type TransitionValue =
  | number
  | string
  | ReturnType<typeof Length.Px>
  | ReturnType<typeof Angle.Deg>;
type ParsedColor = [number, number, number, number];

const canvasTimeline: CanvasTimeline = {
  now() {
    return performance.now();
  },
};

function resolveInheritedColor(node: CanvasNode | null) {
  let current = node;
  while (current) {
    if (current instanceof CanvasContainer) {
      const color = current.styles.color;
      if (color) return color;
    }
    current = current.parent;
  }
  return 'black';
}

function resolveInheritedFontSize(node: CanvasNode | null) {
  let current = node;
  while (current) {
    if (current instanceof CanvasContainer) {
      const fontSize = current.styles.fontSize;
      if (fontSize) return fontSize.value;
    }
    current = current.parent;
  }
  return 16;
}

function parseHexColor(value: string): ParsedColor | null {
  if (value.length === 4) {
    return [
      Number.parseInt(value[1] + value[1], 16),
      Number.parseInt(value[2] + value[2], 16),
      Number.parseInt(value[3] + value[3], 16),
      1,
    ];
  }
  if (value.length === 7) {
    return [
      Number.parseInt(value.slice(1, 3), 16),
      Number.parseInt(value.slice(3, 5), 16),
      Number.parseInt(value.slice(5, 7), 16),
      1,
    ];
  }
  return null;
}

function parseNormalizedColor(value: string): ParsedColor | null {
  if (value.startsWith('#')) return parseHexColor(value);

  const matched = value.match(
    /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/
  );
  if (!matched) return null;

  let alpha = 1;
  if (matched[4]) alpha = Number(matched[4]);
  return [Number(matched[1]), Number(matched[2]), Number(matched[3]), alpha];
}

function parseColor(node: CanvasNode, value: string) {
  const currentFillStyle = node.renderer.host.ctx.fillStyle;
  node.renderer.host.ctx.fillStyle = '#000001';
  const firstSentinel = `${node.renderer.host.ctx.fillStyle}`;
  node.renderer.host.ctx.fillStyle = value;
  const firstValue = `${node.renderer.host.ctx.fillStyle}`;
  node.renderer.host.ctx.fillStyle = '#000002';
  const secondSentinel = `${node.renderer.host.ctx.fillStyle}`;
  node.renderer.host.ctx.fillStyle = value;
  const secondValue = `${node.renderer.host.ctx.fillStyle}`;
  node.renderer.host.ctx.fillStyle = currentFillStyle;

  if (firstValue !== secondValue) return null;
  if (firstValue === firstSentinel && secondValue === secondSentinel) {
    return null;
  }
  return parseNormalizedColor(firstValue);
}

function interpolateColor(
  start: ParsedColor,
  end: ParsedColor,
  progress: number
) {
  const red = start[0] + (end[0] - start[0]) * progress;
  const green = start[1] + (end[1] - start[1]) * progress;
  const blue = start[2] + (end[2] - start[2]) * progress;
  const alpha = start[3] + (end[3] - start[3]) * progress;
  return `rgba(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)}, ${alpha})`;
}

function applyEasing(timingFunction: EasingValue, progress: number) {
  if (timingFunction === Easing.Linear) return progress;
  if (timingFunction === Easing.EaseIn) {
    return progress * progress * progress;
  }
  if (timingFunction === Easing.EaseOut) {
    const inverse = 1 - progress;
    return 1 - inverse * inverse * inverse;
  }
  if (timingFunction === Easing.EaseInOut) {
    if (progress < 0.5) return 4 * progress * progress * progress;
    const inverse = progress - 1;
    return 1 + 4 * inverse * inverse * inverse;
  }

  let start = 0;
  let end = 1;
  let position = progress;
  for (let i = 0; i < 8; i += 1) {
    position = (start + end) / 2;
    const inverse = 1 - position;
    const estimate =
      3 * inverse * inverse * position * 0.25 +
      3 * inverse * position * position * 0.25 +
      position * position * position;
    if (Math.abs(estimate - progress) < 0.0001) break;
    if (estimate < progress) start = position;
    else end = position;
  }

  const inverse = 1 - position;
  return (
    3 * inverse * inverse * position * 0.1 +
    3 * inverse * position * position +
    position * position * position
  );
}

function interpolateValue(transition: CanvasTransition, progress: number) {
  const { from, to } = transition;
  if (
    transition.key === 'left' ||
    transition.key === 'top' ||
    transition.key === 'borderWidth' ||
    transition.key === 'fontSize'
  ) {
    const start = (from as ReturnType<typeof Length.Px>).value;
    const end = (to as ReturnType<typeof Length.Px>).value;
    return Length.Px(start + (end - start) * progress);
  }
  if (transition.key === 'rotate') {
    const start = (from as ReturnType<typeof Angle.Deg>).value;
    const end = (to as ReturnType<typeof Angle.Deg>).value;
    return Angle.Deg(start + (end - start) * progress);
  }
  if (
    transition.key === 'backgroundColor' ||
    transition.key === 'color' ||
    transition.key === 'borderColor'
  ) {
    return interpolateColor(
      transition.fromColor as ParsedColor,
      transition.toColor as ParsedColor,
      progress
    );
  }
  const start = from as number;
  const end = to as number;
  return start + (end - start) * progress;
}

function resolveOffsetValue(
  node: CanvasContainer,
  value: JSX.Style['left'] | JSX.Style['top'],
  isX: boolean
) {
  if (!value) return null;
  if (value.unit === LengthUnit.FitContent) return null;

  let baseSize = 0;

  const parentSize = node.parent?.measure();
  if (parentSize) {
    if (isX) baseSize = parentSize.width;
    else baseSize = parentSize.height;
  }

  if (!baseSize) {
    if (isX) baseSize = node.renderer.host.scopeWidth;
    else baseSize = node.renderer.host.scopeHeight;
  }

  return Length.Px(lengthToPx(value, baseSize));
}

function resolveTransitionValue(
  node: CanvasContainer,
  key: TransitionableStyleKey,
  value: JSX.Style[TransitionableStyleKey]
): TransitionValue | null {
  if (key === 'left') {
    return resolveOffsetValue(node, value as JSX.Style['left'], true);
  }
  if (key === 'top') {
    return resolveOffsetValue(node, value as JSX.Style['top'], false);
  }
  if (key === 'rotate') {
    if (value) return value as ReturnType<typeof Angle.Deg>;
    return Angle.Deg(0);
  }
  if (key === 'scale') {
    if (value !== undefined) return value as number;
    return 1;
  }
  if (key === 'backgroundColor') {
    let nextValue = 'transparent';
    if (value) nextValue = value as string;
    return nextValue;
  }
  if (key === 'borderColor' || key === 'color') {
    let nextValue = resolveInheritedColor(node.parent);
    if (value) nextValue = value as string;
    return nextValue;
  }
  if (key === 'borderWidth') {
    if (value) {
      const borderWidth = value as NonNullable<JSX.Style['borderWidth']>;
      return Length.Px(borderWidth.value);
    }
    return Length.Px(0);
  }
  if (key === 'borderRadius') {
    if (value !== undefined) return value as number;
    return 0;
  }
  if (value) {
    const fontSize = value as NonNullable<JSX.Style['fontSize']>;
    return Length.Px(fontSize.value);
  }
  return Length.Px(resolveInheritedFontSize(node.parent));
}

function isSameTransitionValue(left: TransitionValue, right: TransitionValue) {
  if (left === right) return true;
  if (!(left instanceof Object)) return false;
  if (!(right instanceof Object)) return false;
  if ('unit' in left && 'unit' in right) {
    if (left.unit !== right.unit) return false;
    return left.value === right.value;
  }
  return false;
}

function hasTransitionProperty(node: CanvasContainer, key: string) {
  const { transitionProperty } = node.styles;
  if (!transitionProperty) return false;
  if (Array.isArray(transitionProperty)) {
    for (const property of transitionProperty) {
      if (property === key) return true;
    }
    return false;
  }
  return transitionProperty === key;
}

function isTransitionableKey(key: string): key is TransitionableStyleKey {
  return (
    key === 'left' ||
    key === 'top' ||
    key === 'rotate' ||
    key === 'scale' ||
    key === 'backgroundColor' ||
    key === 'borderColor' ||
    key === 'color' ||
    key === 'borderWidth' ||
    key === 'borderRadius' ||
    key === 'fontSize'
  );
}

function createTransition(
  node: CanvasContainer,
  key: TransitionableStyleKey,
  _value: unknown
): CanvasTransition | null {
  const value = _value as JSX.Style[typeof key];
  const durationValue = node.styles.transitionDuration;
  if (!durationValue) return null;
  if (durationToMs(durationValue) <= 0) return null;
  if (!hasTransitionProperty(node, key)) return null;

  const delayValue = node.styles.transitionDelay ?? Duration.Ms(0);
  const delay = Math.max(0, durationToMs(delayValue));

  const timingFunction = node.styles.transitionTimingFunction ?? Easing.Ease;
  const from = resolveTransitionValue(node, key, node.styles[key]);
  const to = resolveTransitionValue(node, key, value);
  if (!from || !to) return null;
  if (isSameTransitionValue(from, to)) return null;

  let fromColor: ParsedColor | undefined;
  let toColor: ParsedColor | undefined;
  if (key === 'backgroundColor' || key === 'borderColor' || key === 'color') {
    fromColor = parseColor(node, from as string) ?? undefined;
    toColor = parseColor(node, to as string) ?? undefined;
    if (!fromColor || !toColor) return null;
  }

  return {
    node,
    key,
    startTime: canvasTimeline.now(),
    delay,
    duration: durationToMs(durationValue),
    timingFunction,
    from,
    to,
    fromColor,
    toColor,
    target: value,
  };
}

export function applyStyle(node: CanvasContainer, key: string, value: unknown) {
  if (isTransitionableKey(key)) {
    const transitions = node.renderer.transitions;
    let writeIndex = 0;
    for (let i = 0; i < transitions.length; i += 1) {
      const transition = transitions[i];
      if (transition.node === node && transition.key === key) continue;
      transitions[writeIndex] = transition;
      writeIndex += 1;
    }
    transitions.length = writeIndex;
    if (node.isConnectedTo(node.renderer.root)) {
      const transition = createTransition(node, key, value);
      if (transition) {
        transitions.push(transition);
        node.renderer.requestRender();
        return;
      }
    }
  }

  node.setStyles({ [key]: value } as JSX.Style);
  if (node.isConnectedTo(node.renderer.root)) node.renderer.requestRender();
}

export function stepCanvasTransitions(renderer: CanvasRenderer) {
  const transitions = renderer.transitions;
  if (!transitions.length) return false;

  const now = canvasTimeline.now();
  let writeIndex = 0;

  for (let i = 0; i < transitions.length; i += 1) {
    const transition = transitions[i];
    const { node, startTime, delay, duration, key, target, timingFunction } =
      transition;
    if (!renderer.isActive(node)) continue;

    const elapsed = now - startTime - delay;
    if (elapsed <= 0) {
      transitions[writeIndex] = transition;
      writeIndex += 1;
      continue;
    }

    let progress = elapsed / duration;
    if (progress >= 1) {
      node.setStyles({ [key]: target } as JSX.Style);
      continue;
    }

    if (progress < 0) progress = 0;
    const easing = applyEasing(timingFunction, progress);
    node.setStyles({ [key]: interpolateValue(transition, easing) });
    transitions[writeIndex] = transition;
    writeIndex += 1;
  }

  transitions.length = writeIndex;
  return writeIndex > 0;
}
