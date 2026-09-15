import type { AsyncDerivedCell, Cell, SourceCell } from 'retend';

import type {
  GpuiFocusEvent,
  GpuiInputEvent,
  GpuiKeyboardEvent,
  GpuiMouseEvent,
  GpuiScrollEvent,
  GpuiTransitionEvent,
} from '../events.js';
import type {
  GpuiAnchoredElement,
  GpuiButtonElement,
  GpuiDivElement,
  GpuiImageElement,
  GpuiInputElement,
  GpuiTextareaElement,
} from '../gpui-renderer.js';
import type {
  GpuiAnchoredCustomProps,
  GpuiButtonCustomProps,
  GpuiImgCustomProps,
  GpuiInputCustomProps,
  GpuiTextareaCustomProps,
  GpuiStyleDeclarations,
} from '../types.js';
import 'retend/jsx-runtime';

type ReactiveValue<Value> = Value | Cell<Value> | AsyncDerivedCell<Value>;
type ReactiveProps<Props> = {
  [Key in keyof Props]?: ReactiveValue<Props[Key]>;
};
type ReactiveStyleDeclarations = {
  [Key in keyof GpuiStyleDeclarations]?: ReactiveValue<
    GpuiStyleDeclarations[Key]
  >;
};
type ReactiveStyle = ReactiveStyleDeclarations & {
  hover?: ReactiveStyleDeclarations;
  active?: ReactiveStyleDeclarations;
};
type GpuiEventModifier = 'self' | 'prevent' | 'once' | 'passive' | 'stop';
type GpuiEventModifierHandlers<Events extends object> = {
  [Key in keyof Events as Key extends string
    ? `${Key}--${GpuiEventModifier}`
    : never]?: Events[Key];
};

interface GpuiInputNativeEvents {
  onInput?: ReactiveValue<(event: GpuiInputEvent) => void>;
  onChange?: ReactiveValue<(event: GpuiInputEvent) => void>;
}

type GpuiInputNativeEventModifiers =
  GpuiEventModifierHandlers<GpuiInputNativeEvents>;
type ReactiveGpuiAnchoredCustomProps = ReactiveProps<GpuiAnchoredCustomProps>;
type ReactiveGpuiButtonCustomProps = ReactiveProps<GpuiButtonCustomProps>;
type ReactiveGpuiImgCustomProps = ReactiveProps<GpuiImgCustomProps>;
type ReactiveGpuiInputCustomProps = ReactiveProps<GpuiInputCustomProps>;
type ReactiveGpuiTextareaCustomProps = ReactiveProps<GpuiTextareaCustomProps>;

declare module 'retend/jsx-runtime' {
  namespace JSX {
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
      onTransitionRun?: ReactiveValue<(event: GpuiTransitionEvent) => void>;
      onTransitionStart?: ReactiveValue<(event: GpuiTransitionEvent) => void>;
      onTransitionEnd?: ReactiveValue<(event: GpuiTransitionEvent) => void>;
      onTransitionCancel?: ReactiveValue<(event: GpuiTransitionEvent) => void>;
    }

    type GpuiNativeEventModifiers = GpuiEventModifierHandlers<GpuiNativeEvents>;

    interface GpuiRefAttributes<Element> {
      ref?: SourceCell<Element | null> | ((node: Element | null) => void);
    }

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

    interface GpuiLeafProps<Element>
      extends GpuiElementProps, GpuiRefAttributes<Element> {
      children?: never;
    }

    interface GpuiDivProps
      extends GpuiElementProps, GpuiRefAttributes<GpuiDivElement> {}

    interface GpuiAnchoredProps
      extends
        GpuiElementProps,
        GpuiRefAttributes<GpuiAnchoredElement>,
        ReactiveGpuiAnchoredCustomProps {}

    interface GpuiImageProps
      extends GpuiLeafProps<GpuiImageElement>, ReactiveGpuiImgCustomProps {}

    interface GpuiTextControlProps<Element>
      extends
        GpuiLeafProps<Element>,
        GpuiInputNativeEvents,
        GpuiInputNativeEventModifiers {}

    interface GpuiInputProps
      extends
        GpuiTextControlProps<GpuiInputElement>,
        ReactiveGpuiInputCustomProps {}

    interface GpuiTextareaProps
      extends
        GpuiTextControlProps<GpuiTextareaElement>,
        ReactiveGpuiTextareaCustomProps {}

    interface GpuiButtonProps
      extends
        GpuiElementProps,
        GpuiRefAttributes<GpuiButtonElement>,
        ReactiveGpuiButtonCustomProps {}

    /**
     * Intrinsic element map for GPUI JSX. Augments `retend/jsx-runtime`
     * with the Retend GPUI v1 intrinsic set.
     * Import `"retend-gpui/jsx-runtime"` in your `tsconfig.json` types to enable.
     */
    interface IntrinsicElements {
      div: GpuiDivProps;
      anchored: GpuiAnchoredProps;
      img: GpuiImageProps;
      input: GpuiInputProps;
      textarea: GpuiTextareaProps;
      button: GpuiButtonProps;
    }
  }
}
