import type { Cell } from 'retend';

import type {
  AngleValue,
  AlignmentValue,
  BorderStyleValue,
  DurationValue,
  FontStyleValue,
  FontWeightValue,
  LengthValue,
  OverflowValue,
  PxLength,
  TextAlignValue,
  TransitionableStyleKey,
  EasingValue,
  TransformOriginValue,
  WhiteSpaceValue,
  BoxShadowValue,
  PointerEventsValue,
} from '../style';
import 'retend/jsx-runtime';

declare module 'retend/jsx-runtime' {
  import('../tree');
  import {
    CanvasNode,
    CanvasPointerEvent,
    CanvasTransitionEvent,
  } from '../tree';

  namespace JSX {
    interface Style {
      left?: LengthValue;
      top?: LengthValue;
      justifySelf?: AlignmentValue;
      alignSelf?: AlignmentValue;
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
      transitionDuration?: DurationValue;
      transitionDelay?: DurationValue;
      transitionTimingFunction?: EasingValue;
      transitionProperty?: TransitionableStyleKey | TransitionableStyleKey[];
      boxShadow?: BoxShadowValue | BoxShadowValue[];
      opacity?: number;
      translate?: LengthValue | [LengthValue, LengthValue];
      clipPath?: string;
      pointerEvents?: PointerEventsValue;
    }

    type StyleValue = Style | Container<JSX.ValueOrCellOrPromise<Style>>;

    type Container<T> = {
      [K in keyof T]: JSX.ValueOrCellOrPromise<T[K]>;
    } & JSX.IntrinsicAttributes;

    interface IntrinsicAttributes {
      ref?: Cell<CanvasNode | null>;
    }

    interface CanvasEventMap {
      onPointerDown: CanvasPointerEvent;
      onPointerMove: CanvasPointerEvent;
      onPointerUp: CanvasPointerEvent;
      onTransitionRun: CanvasTransitionEvent;
      onTransitionStart: CanvasTransitionEvent;
      onTransitionEnd: CanvasTransitionEvent;
      onTransitionCancel: CanvasTransitionEvent;
      onClick: CanvasPointerEvent;
    }

    type JsxCanvasEventHandlers<E> = {
      [K in keyof CanvasEventMap]?: (this: E, event: CanvasEventMap[K]) => void;
    };

    type RemoveOnPrefix<T extends string> = T extends `on${infer Rest}`
      ? Lowercase<Rest>
      : T;

    type CanvasNodeEventName = RemoveOnPrefix<keyof CanvasEventMap>;

    interface ContainerProps extends JsxCanvasEventHandlers<ContainerProps> {
      style?: StyleValue;
    }

    interface ShapeProps extends ContainerProps {
      points: [number, number][];
    }

    interface PathProps extends ContainerProps {
      d: string;
    }

    interface ImageProps extends ContainerProps {
      src?: string;
      alt?: string;
    }

    interface ParticlesProps extends ContainerProps {
      positions: Float32Array | number[];
      colorMap?: string | string[];
      sizeMap?: number | Float32Array | number[];
      shape?: 'circle' | 'rect';
    }

    interface IntrinsicElements {
      /**
       * Draws an image on the canvas.
       */
      img: Container<ImageProps>;
      /**
       * Draws a filled rectangle on the canvas.
       */
      rect: Container<ContainerProps>;
      /**
       * Draws a filled circle on the canvas.
       */
      circle: Container<ContainerProps>;
      /**
       * Draws a filled custom shape on the canvas using the provided points.
       */
      shape: Container<ShapeProps>;
      /**
       * Draws a stroked path on the canvas using the provided path data.
       */
      path: Container<PathProps>;
      /**
       * Draws a text container that only accepts text content.
       */
      text: Container<ContainerProps>;
      /**
       * Draws a high-performance particle swarm driven by data arrays.
       */
      particles: Container<ParticlesProps>;
    }
  }
}
