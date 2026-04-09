import type { Cell } from 'retend';
import type { JSX } from 'retend/jsx-runtime';

import type {
  AngleValue,
  AlignmentValue,
  BorderStyleValue,
  FontStyleValue,
  FontWeightValue,
  LengthValue,
  OverflowValue,
  PxLength,
  TextAlignValue,
  TransformOriginValue,
  WhiteSpaceValue,
  BoxShadowValue,
  PointerEventsValue,
  AnimationFillModeValue,
} from './style';
import type { ANIMATABLE_PROPERTIES } from './tree/animations';
import type { CanvasNode, PointerEvent } from './tree/node';

export interface CanvasStyle {
  left?: LengthValue;
  top?: LengthValue;
  zIndex?: number;
  justifySelf?: AlignmentValue;
  alignSelf?: AlignmentValue;
  justifyItems?: AlignmentValue;
  alignItems?: AlignmentValue;
  rotate?: AngleValue;
  scale?: number | [number, number];
  transformOrigin?: TransformOriginValue;
  width?: LengthValue;
  height?: LengthValue;
  maxWidth?: LengthValue;
  maxHeight?: LengthValue;
  overflow?: OverflowValue;
  borderRadius?: PxLength;
  borderStyle?: BorderStyleValue;
  borderWidth?: PxLength;
  borderColor?: string;
  textAlign?: TextAlignValue;
  lineHeight?: number;
  whiteSpace?: WhiteSpaceValue;
  backgroundColor?: string;
  color?: string;
  fontSize?: PxLength;
  fontFamily?: string;
  fontWeight?: FontWeightValue;
  fontStyle?: FontStyleValue;
  boxShadow?: BoxShadowValue | BoxShadowValue[];
  opacity?: number;
  translate?: LengthValue | [LengthValue, LengthValue];
  clipPath?: string;
  pointerEvents?: PointerEventsValue;
  animationName?: AnimationDefinition;
  animationFillMode?: AnimationFillModeValue;
  animationIterationCount?: number;
  animationDuration?: number; // in ms
  animationTimingFunction?: [number, number, number, number];
  animationDelay?: number;
}

export type AnimatableProperty = keyof typeof ANIMATABLE_PROPERTIES;

export interface AnimationKeyframe<T extends AnimatableProperty> {
  offset: number;
  value: CanvasStyle[T];
}

export type AnimationDefinition = {
  [key in 'from' | 'to' | `${number}%`]?: {
    [key in AnimatableProperty]?: NonNullable<CanvasStyle[key]>;
  };
};

export type CanvasStyleValue =
  | CanvasStyle
  | CanvasContainer<JSX.ValueOrCellOrPromise<CanvasStyle>>;

export interface CanvasIntrinsicAttributes {
  ref?: Cell<CanvasNode | null>;
  children?: JSX.Children;
}

export type CanvasContainer<T> = {
  [K in keyof T]: JSX.ValueOrCellOrPromise<T[K]>;
} & CanvasIntrinsicAttributes;

export interface CanvasEventMap {
  onPointerDown: PointerEvent;
  onPointerMove: PointerEvent;
  onPointerUp: PointerEvent;
  onClick: PointerEvent;
}

export type JsxCanvasEventHandlers<E> = {
  [K in keyof CanvasEventMap]?: (this: E, event: CanvasEventMap[K]) => void;
};

export type RemoveOnPrefix<T extends string> = T extends `on${infer Rest}`
  ? Lowercase<Rest>
  : T;

export type CanvasNodeEventName = RemoveOnPrefix<keyof CanvasEventMap>;

export interface CanvasContainerProps extends JsxCanvasEventHandlers<CanvasContainerProps> {
  style?: CanvasStyleValue;
}

export interface CanvasShapeProps extends CanvasContainerProps {
  points: [number, number][];
}

export interface CanvasPathProps extends CanvasContainerProps {
  d: string;
}

export interface CanvasImageProps extends CanvasContainerProps {
  src?: string;
  alt?: string;
}

export interface CanvasParticlesProps extends CanvasContainerProps {
  positions: Float32Array | number[];
  colorMap?: string | string[];
  sizeMap?: number | Float32Array | number[];
  shape?: 'circle' | 'rect';
}
