import type { CanvasStyle } from './types';

declare global {
  namespace JSX {
    // Re-use basic types from Retend if possible, or define minimal set
    type Booleanish = boolean | 'true' | 'false';
    type Numberish = number | `${number}`;
    type ValueOrCell<T> = T | import('@adbl/cells').Cell<T>;

    interface IntrinsicAttributes {
      key?: string | number;
      children?: unknown;
    }

    interface CanvasElementProps extends IntrinsicAttributes {
      style?: JSX.ValueOrCell<CanvasStyle>;
      onClick?: (e: unknown) => void;
    }

    interface ButtonProps extends CanvasElementProps {
      type?: 'button' | 'submit' | 'reset';
    }

    interface IntrinsicElements {
      view: CanvasElementProps;
      text: CanvasElementProps;
      button: ButtonProps;
    }
  }
}
