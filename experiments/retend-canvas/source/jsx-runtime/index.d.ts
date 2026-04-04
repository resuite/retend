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
} from '../style';
import 'retend/jsx-runtime';

declare module 'retend/jsx-runtime' {
  import('../tree');
  import { CanvasNode } from '../tree';

  namespace JSX {
    interface Style {
      left?: LengthValue;
      top?: LengthValue;
      justifySelf?: AlignmentValue;
      alignSelf?: AlignmentValue;
      rotate?: AngleValue;
      scale?: number;
      transformOrigin?: TransformOriginValue;
      width?: LengthValue;
      height?: LengthValue;
      maxWidth?: LengthValue;
      maxHeight?: LengthValue;
      overflow?: OverflowValue;
      borderRadius?: number;
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
    }

    type StyleValue = Style | Container<JSX.ValueOrCellOrPromise<Style>>;

    type Container<T> = {
      [K in keyof T]: JSX.ValueOrCellOrPromise<T[K]>;
    } & JSX.IntrinsicAttributes;

    interface IntrinsicAttributes {
      ref?: Cell<CanvasNode | null>;
    }

    interface ContainerProps {
      style?: StyleValue;
    }

    interface ShapeProps extends ContainerProps {
      points: [number, number][];
    }

    interface IntrinsicElements {
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
    }
  }
}
