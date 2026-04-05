import type { JSX } from 'retend/jsx-runtime';

import type { CanvasRenderer } from '../canvas-renderer';

import {
  Angle,
  durationToMs,
  Length,
  LengthUnit,
  Easing,
  type EasingValue,
  type TransitionableStyleKey,
  Duration,
  type BoxShadowValue,
} from '../style';
import { CanvasContainer } from './container';
import { CanvasTransitionEvent, type CanvasNode } from './node';
import { lengthToPx } from './transform';

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
  started: boolean;
}

type TransitionValue =
  | number
  | string
  | ReturnType<typeof Length.Px>
  | ReturnType<typeof Angle.Deg>
  | BoxShadowValue[];
type ParsedColor = [number, number, number, number];

const transitionableKeys = {
  left: true,
  top: true,
  rotate: true,
  scale: true,
  backgroundColor: true,
  borderColor: true,
  color: true,
  borderWidth: true,
  borderRadius: true,
  fontSize: true,
  boxShadow: true,
  opacity: true,
} as const;
const colorCache = new Map<string, ParsedColor | null>();

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

function parseColor(value: string) {
  if (colorCache.has(value)) {
    return colorCache.get(value) as ParsedColor | null;
  }
  const parsed = parseNormalizedColor(value);
  colorCache.set(value, parsed);
  return parsed;
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
    const inverse = 1 - progress;
    return 1 - 4 * inverse * inverse * inverse;
  }
  const cosine = Math.cos(Math.PI * progress);
  return -((cosine - 1) / 2);
}

function interpolateValue(transition: CanvasTransition, progress: number) {
  const { from, to } = transition;
  if (
    transition.key === 'left' ||
    transition.key === 'top' ||
    transition.key === 'borderWidth' ||
    transition.key === 'fontSize' ||
    transition.key === 'borderRadius'
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
  if (transition.key === 'boxShadow') {
    const start = from as BoxShadowValue[];
    const end = to as BoxShadowValue[];
    return start.map((shadow, i) => {
      const nextShadow = end[i];
      return {
        offsetX: Length.Px(
          shadow.offsetX.value +
            (nextShadow.offsetX.value - shadow.offsetX.value) * progress
        ),
        offsetY: Length.Px(
          shadow.offsetY.value +
            (nextShadow.offsetY.value - shadow.offsetY.value) * progress
        ),
        blur: Length.Px(
          shadow.blur.value +
            (nextShadow.blur.value - shadow.blur.value) * progress
        ),
        color: interpolateColor(
          parseColor(shadow.color) as ParsedColor,
          parseColor(nextShadow.color) as ParsedColor,
          progress
        ),
        inset: shadow.inset,
      };
    });
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

  return Length.Px(lengthToPx(value, baseSize, node.renderer.viewport.width));
}

function resolveTransitionValue<K extends TransitionableStyleKey>(
  node: CanvasContainer,
  key: K,
  value: JSX.Style[K]
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
    if (value && typeof value === 'object' && 'value' in value) {
      return Length.Px(Number(value.value));
    }
    return Length.Px(0);
  }
  if (key === 'boxShadow') {
    if (!value) return [];
    const shadows = Array.isArray(value)
      ? (value as BoxShadowValue[])
      : [value as BoxShadowValue];
    return shadows.map((shadow) => ({
      offsetX: Length.Px(
        lengthToPx(
          shadow.offsetX,
          node.renderer.host.scopeWidth,
          node.renderer.viewport.width
        )
      ),
      offsetY: Length.Px(
        lengthToPx(
          shadow.offsetY,
          node.renderer.host.scopeHeight,
          node.renderer.viewport.width
        )
      ),
      blur: Length.Px(
        lengthToPx(
          shadow.blur,
          node.renderer.host.scopeWidth,
          node.renderer.viewport.width
        )
      ),
      color: shadow.color,
      inset: shadow.inset,
    }));
  }
  if (key === 'opacity') {
    if (value !== undefined) return value as number;
    return 1;
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
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (left[i].inset !== right[i].inset) return false;
      if (left[i].offsetX.value !== right[i].offsetX.value) return false;
      if (left[i].offsetY.value !== right[i].offsetY.value) return false;
      if (left[i].blur.value !== right[i].blur.value) return false;
      if (left[i].color !== right[i].color) return false;
    }
    return true;
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
  return key in transitionableKeys;
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
    const parsedFrom = parseColor(from as string);
    const parsedTo = parseColor(to as string);
    if (!parsedFrom || !parsedTo) return null;
    fromColor = parsedFrom;
    toColor = parsedTo;
  }
  if (key === 'boxShadow') {
    const fromShadows = from as BoxShadowValue[];
    const toShadows = to as BoxShadowValue[];
    if (fromShadows.length !== toShadows.length) return null;
    for (let i = 0; i < fromShadows.length; i += 1) {
      if (fromShadows[i].inset !== toShadows[i].inset) return null;
      if (!parseColor(fromShadows[i].color)) return null;
      if (!parseColor(toShadows[i].color)) return null;
    }
  }

  return {
    node,
    key,
    startTime: performance.now(),
    delay,
    duration: durationToMs(durationValue),
    timingFunction,
    from,
    to,
    fromColor,
    toColor,
    target: value,
    started: false,
  };
}

export function applyStyle(node: CanvasContainer, key: string, value: unknown) {
  if (isTransitionableKey(key)) {
    const transitions = node.renderer.transitions;
    let writeIndex = 0;
    for (let i = 0; i < transitions.length; i += 1) {
      const transition = transitions[i];
      if (transition.node === node && transition.key === key) {
        node.dispatchEvent(
          new CanvasTransitionEvent(
            'transitioncancel',
            key,
            (performance.now() - transition.startTime) / 1000,
            node
          )
        );
        continue;
      }
      transitions[writeIndex] = transition;
      writeIndex += 1;
    }
    transitions.length = writeIndex;
    if (node.isConnected) {
      const transition = createTransition(node, key, value);
      if (transition) {
        transitions.push(transition);
        node.renderer.requestRender();
        node.dispatchEvent(
          new CanvasTransitionEvent('transitionrun', key, 0, node)
        );
        return;
      }
    }
  }

  node.setStyles({ [key]: value } as JSX.Style);
  if (node.isConnected) node.renderer.requestRender();
}

export function stepCanvasTransitions(renderer: CanvasRenderer) {
  const transitions = renderer.transitions;
  if (!transitions.length) return false;

  const now = performance.now();
  let writeIndex = 0;

  for (let i = 0; i < transitions.length; i += 1) {
    const transition = transitions[i];
    const { node, startTime, delay, duration, key, target, timingFunction } =
      transition;
    const elapsed = now - startTime - delay;
    if (!renderer.isActive(node)) {
      node.dispatchEvent(
        new CanvasTransitionEvent(
          'transitioncancel',
          key,
          (now - startTime) / 1000,
          node
        )
      );
      continue;
    }

    if (elapsed <= 0) {
      transitions[writeIndex] = transition;
      writeIndex += 1;
      continue;
    }

    if (!transition.started) {
      transition.started = true;
      node.dispatchEvent(
        new CanvasTransitionEvent('transitionstart', key, 0, node)
      );
    }

    let progress = elapsed / duration;
    if (progress >= 1) {
      node.setStyles({ [key]: target } as JSX.Style);
      node.dispatchEvent(
        new CanvasTransitionEvent('transitionend', key, duration / 1000, node)
      );
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
