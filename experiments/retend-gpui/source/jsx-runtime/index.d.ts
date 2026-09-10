import type { AsyncDerivedCell, Cell, SourceCell } from 'retend';

import type {
  GpuiFocusEvent,
  GpuiInputEvent,
  GpuiKeyboardEvent,
  GpuiMouseEvent,
  GpuiScrollEvent,
} from '../events.js';
import type {
  GpuiDivElement,
  GpuiImageElement,
  GpuiInputElement,
} from '../gpui-renderer.js';
import type {
  GpuiElementType,
  GpuiImgCustomProps,
  GpuiInputCustomProps,
  GpuiStyle,
} from '../types.js';
import 'retend/jsx-runtime';

type ReactiveValue<Value> = Value | Cell<Value> | AsyncDerivedCell<Value>;
type ReactiveProps<Props> = {
  [Key in keyof Props]?: ReactiveValue<Props[Key]>;
};
type ReactiveStyle = {
  [Key in keyof GpuiStyle]?: ReactiveValue<GpuiStyle[Key]>;
};
interface CustomPropsByTag {
  img: GpuiImgCustomProps;
  input: GpuiInputCustomProps;
}
interface ElementByTag {
  div: GpuiDivElement;
  img: GpuiImageElement;
  input: GpuiInputElement;
}
interface GpuiInputNativeEvents {
  onInput?: ReactiveValue<(event: GpuiInputEvent) => void>;
  onChange?: ReactiveValue<(event: GpuiInputEvent) => void>;
}

declare module 'retend/jsx-runtime' {
  namespace JSX {
    /**
     * Reactive custom props for a given intrinsic tag.
     * Tags without custom props resolve to an empty object.
     */
    type ReactiveCustomProps<Tag extends GpuiElementType> =
      Tag extends keyof CustomPropsByTag
        ? ReactiveProps<CustomPropsByTag[Tag]>
        : {};
    /**
     * Props for a GPUI intrinsic element, combining standard element props,
     * reactive style, refs, and tag-specific custom props. Each prop value may
     * be a plain value or a `Cell` for fine-grained reactivity.
     */
    type GpuiIntrinsicElements = {
      [Tag in GpuiElementType]: GpuiElementProps &
        ReactiveCustomProps<Tag> & {
          ref?:
            | SourceCell<ElementByTag[Tag] | null>
            | ((node: ElementByTag[Tag] | null) => void);
        } & (Tag extends 'input'
          ? GpuiInputNativeEvents & EventModifierHandlers<GpuiInputNativeEvents>
          : {}) &
        (Tag extends 'div' ? {} : { children?: never });
    };

    interface GpuiNativeEvents {
      onClick?: ReactiveValue<(event: GpuiMouseEvent) => void>;
      onDblClick?: ReactiveValue<(event: GpuiMouseEvent) => void>;
      onMouseDown?: ReactiveValue<(event: GpuiMouseEvent) => void>;
      onMouseUp?: ReactiveValue<(event: GpuiMouseEvent) => void>;
      onMouseEnter?: ReactiveValue<(event: GpuiMouseEvent) => void>;
      onMouseLeave?: ReactiveValue<(event: GpuiMouseEvent) => void>;
      onMouseMove?: ReactiveValue<(event: GpuiMouseEvent) => void>;
      onMouseDownOutside?: ReactiveValue<(event: GpuiMouseEvent) => void>;
      onKeyDown?: ReactiveValue<(event: GpuiKeyboardEvent) => void>;
      onKeyUp?: ReactiveValue<(event: GpuiKeyboardEvent) => void>;
      onFocus?: ReactiveValue<(event: GpuiFocusEvent) => void>;
      onBlur?: ReactiveValue<(event: GpuiFocusEvent) => void>;
      onScroll?: ReactiveValue<(event: GpuiScrollEvent) => void>;
    }

    type GpuiNativeEventModifiers = EventModifierHandlers<GpuiNativeEvents>;

    /**
     * Props shared by all GPUI intrinsic elements.
     */
    interface GpuiElementProps
      extends IntrinsicAttributes, GpuiNativeEvents, GpuiNativeEventModifiers {
      /**
       * Retend GPUI author style. Individual properties may be `Cell`s for
       * reactive updates before the resolved snapshot crosses the native bridge.
       */
      style?: ValueOrCell<ReactiveStyle>;
      /** Native tab order. Negative values remain programmatically focusable. */
      tabIndex?: ReactiveValue<number | null>;
    }

    /**
     * Intrinsic element map for GPUI JSX. Augments `retend/jsx-runtime`
     * with the Retend GPUI v1 intrinsic set.
     * Import `"retend-gpui/jsx-runtime"` in your `tsconfig.json` types to enable.
     */
    interface IntrinsicElements extends GpuiIntrinsicElements {}
  }
}
