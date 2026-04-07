import type { JSX } from 'retend/jsx-runtime';

import { interpolatePath } from 'd3-interpolate-path';

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
  target: unknown;
  interpolatePath?: (t: number) => string;
  started: boolean;
}

type TransitionValue =
  | number
  | [number, number]
  | string
  | ReturnType<typeof Length.Px>
  | ReturnType<typeof Angle.Deg>
  | BoxShadowValue[];
type ParsedColor = [number, number, number, number];

const transitionableKeys = {
  left: true,
  top: true,
  d: true,
  clipPath: true,
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
  translate: true,
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
  if (Array.isArray(timingFunction)) {
    const [x1, y1, x2, y2] = timingFunction;
    let start = 0;
    let end = 1;
    let t = progress;
    for (let i = 0; i < 8; i += 1) {
      t = (start + end) / 2;
      const inverse = 1 - t;
      const x =
        3 * inverse * inverse * t * x1 + 3 * inverse * t * t * x2 + t * t * t;
      if (x < progress) {
        start = t;
      } else {
        end = t;
      }
    }
    const inverse = 1 - t;
    return (
      3 * inverse * inverse * t * y1 + 3 * inverse * t * t * y2 + t * t * t
    );
  }
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
  switch (transition.key) {
    case 'left':
    case 'top':
    case 'borderWidth':
    case 'fontSize':
    case 'borderRadius': {
      const start = (from as ReturnType<typeof Length.Px>).value;
      const end = (to as ReturnType<typeof Length.Px>).value;
      return Length.Px(start + (end - start) * progress);
    }
    case 'rotate': {
      const start = (from as ReturnType<typeof Angle.Deg>).value;
      const end = (to as ReturnType<typeof Angle.Deg>).value;
      return Angle.Deg(start + (end - start) * progress);
    }
    case 'scale': {
      if (Array.isArray(from) && Array.isArray(to)) {
        const start = from as number[];
        const end = to as number[];
        return [
          start[0] + (end[0] - start[0]) * progress,
          start[1] + (end[1] - start[1]) * progress,
        ] as [number, number];
      }
      const start = from as number;
      const end = to as number;
      return start + (end - start) * progress;
    }
    case 'translate': {
      const start = from as [number, number];
      const end = to as [number, number];
      return [
        Length.Px(start[0] + (end[0] - start[0]) * progress),
        Length.Px(start[1] + (end[1] - start[1]) * progress),
      ];
    }
    case 'backgroundColor':
    case 'color':
    case 'borderColor':
      return interpolateColor(
        transition.fromColor as ParsedColor,
        transition.toColor as ParsedColor,
        progress
      );
    case 'boxShadow': {
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

  return Length.Px(lengthToPx(value, baseSize, node));
}

function resolveTransitionValue(
  node: CanvasContainer,
  key: TransitionableStyleKey,
  value: unknown
): TransitionValue | null {
  switch (key) {
    case 'left':
      return resolveOffsetValue(node, value as JSX.Style['left'], true);
    case 'top':
      return resolveOffsetValue(node, value as JSX.Style['top'], false);
    case 'd':
    case 'clipPath':
      if (value) return value as string;
      return '';
    case 'rotate':
      if (value) return value as ReturnType<typeof Angle.Deg>;
      return Angle.Deg(0);
    case 'translate': {
      if (!value) return [0, 0] as TransitionValue;
      const isArray = Array.isArray(value);
      const txValue = isArray ? value[0] : value;
      const tyValue = isArray ? value[1] : undefined;

      const size = node.measure();

      const tx = txValue ? lengthToPx(txValue, size.width, node) : 0;
      const ty = tyValue ? lengthToPx(tyValue, size.height, node) : 0;
      return [tx, ty] as TransitionValue;
    }
    case 'scale':
      return (value as number | [number, number]) ?? 1;
    case 'backgroundColor': {
      return (value as string) || 'transparent';
    }
    case 'borderColor':
    case 'color': {
      const nextValue = value || resolveInheritedColor(node.parent);
      return nextValue as string;
    }
    case 'borderWidth':
      if (value) {
        const borderWidth = value as NonNullable<JSX.Style['borderWidth']>;
        return Length.Px(borderWidth.value);
      }
      return Length.Px(0);
    case 'borderRadius':
      if (value instanceof Object && 'value' in value) {
        return Length.Px(Number(value.value));
      }
      return Length.Px(0);
    case 'boxShadow': {
      if (!value) return [];
      const shadows = Array.isArray(value)
        ? (value as BoxShadowValue[])
        : [value as BoxShadowValue];
      return shadows.map((shadow) => ({
        offsetX: Length.Px(
          lengthToPx(shadow.offsetX, node.renderer.host.scopeWidth, node)
        ),
        offsetY: Length.Px(
          lengthToPx(shadow.offsetY, node.renderer.host.scopeHeight, node)
        ),
        blur: Length.Px(
          lengthToPx(shadow.blur, node.renderer.host.scopeWidth, node)
        ),
        color: shadow.color,
        inset: shadow.inset,
      }));
    }
    case 'opacity':
      if (value !== undefined) return value as number;
      return 1;
    case 'fontSize':
      if (value) {
        const fontSize = value as NonNullable<JSX.Style['fontSize']>;
        return Length.Px(fontSize.value);
      }
      return Length.Px(resolveInheritedFontSize(node.parent));
  }
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
    if (
      typeof left[0] === 'number' &&
      typeof left[1] === 'number' &&
      typeof right[0] === 'number' &&
      typeof right[1] === 'number'
    ) {
      if (left.length !== right.length) return false;
      for (let i = 0; i < left.length; i += 1) {
        if (left[i] !== right[i]) return false;
      }
      return true;
    }
    const leftShadows = left as BoxShadowValue[];
    const rightShadows = right as BoxShadowValue[];
    if (left.length !== right.length) return false;
    for (let i = 0; i < leftShadows.length; i += 1) {
      if (leftShadows[i].inset !== rightShadows[i].inset) return false;
      if (leftShadows[i].offsetX.value !== rightShadows[i].offsetX.value)
        return false;
      if (leftShadows[i].offsetY.value !== rightShadows[i].offsetY.value)
        return false;
      if (leftShadows[i].blur.value !== rightShadows[i].blur.value)
        return false;
      if (leftShadows[i].color !== rightShadows[i].color) return false;
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
  value: unknown
): CanvasTransition | null {
  const durationValue = node.styles.transitionDuration;
  if (!durationValue) return null;
  if (durationToMs(durationValue) <= 0) return null;
  if (!hasTransitionProperty(node, key)) return null;

  const delayValue = node.styles.transitionDelay ?? Duration.Ms(0);
  const delay = Math.max(0, durationToMs(delayValue));

  const timingFunction = node.styles.transitionTimingFunction ?? Easing.Ease;
  let currentValue: unknown = node.getAttribute('d' as never);
  if (key === 'clipPath') {
    currentValue = node.styles.clipPath;
  } else if (key !== 'd') {
    currentValue = node.styles[key as Exclude<TransitionableStyleKey, 'd'>];
  }
  const from = resolveTransitionValue(node, key, currentValue);
  const to = resolveTransitionValue(node, key, value);
  if (!from || !to) return null;
  if (isSameTransitionValue(from, to)) return null;

  let fromColor: ParsedColor | undefined;
  let toColor: ParsedColor | undefined;
  let nextInterpolatePath: ((t: number) => string) | undefined;
  if (key === 'd' || key === 'clipPath') {
    const fromPath = (
      key === 'd' ? node.getAttribute('d' as never) : node.styles.clipPath
    ) as string | undefined;
    const toPath = value as string | undefined;
    if (!fromPath || !toPath) return null;
    try {
      nextInterpolatePath = interpolatePath(fromPath, toPath);
    } catch {
      return null;
    }
  }
  if (key === 'scale' && Array.isArray(from) && Array.isArray(to)) {
    if (from.length !== to.length) return null;
  }
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
    interpolatePath: nextInterpolatePath,
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

  if (key === 'd') {
    node.setAttribute(key as never, value as never);
    if (node.isConnected) node.renderer.requestRender();
    return;
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
      if (key === 'd') {
        node.setAttribute(key as never, target as never);
      } else {
        node.setStyles({ [key]: target } as JSX.Style);
      }
      node.dispatchEvent(
        new CanvasTransitionEvent('transitionend', key, duration / 1000, node)
      );
      continue;
    }

    if (progress < 0) progress = 0;
    const easing = applyEasing(timingFunction, progress);
    if (key === 'd') {
      node.setAttribute(
        key as never,
        transition.interpolatePath?.(easing) as never
      );
    } else if (key === 'clipPath') {
      node.setStyles({
        [key]: transition.interpolatePath?.(easing),
      } as JSX.Style);
    } else {
      node.setStyles({ [key]: interpolateValue(transition, easing) });
    }
    transitions[writeIndex] = transition;
    writeIndex += 1;
  }

  transitions.length = writeIndex;
  return writeIndex > 0;
}
