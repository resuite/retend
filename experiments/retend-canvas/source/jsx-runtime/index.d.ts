import type { Cell } from 'retend';

import 'retend/jsx-runtime';

declare module 'retend/jsx-runtime' {
  import('../tree');
  import { CanvasNode } from '../tree';

  namespace JSX {
    type Container<T> = {
      [K in keyof T]: JSX.ValueOrCellOrPromise<T[K]>;
    } & JSX.IntrinsicAttributes;

    interface IntrinsicAttributes {
      ref?: Cell<CanvasNode | null>;
    }

    interface ContainerProps {
      x?: number;
      y?: number;
      width?: number | `${number}%`;
      height?: number | `${number}%`;
      bgColor?: string;
      textColor?: string;
      textSize?: number;
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
      shape: Container<ShapeProps>;
    }
  }
}
