
import type { TerminalStyle } from "./types";

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

    interface TerminalElementProps extends IntrinsicAttributes {
      style?: JSX.ValueOrCell<TerminalStyle>;
      onClick?: (e: unknown) => void;
    }

    interface IntrinsicElements {
      view: TerminalElementProps;
      text: TerminalElementProps;
    }
  }
}
