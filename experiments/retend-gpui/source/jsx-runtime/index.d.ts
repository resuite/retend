import type { EventPayload } from '@gpuix/native';
import type { AsyncDerivedCell, Cell, SourceCell } from 'retend';

import type { GpuiElement } from '../gpui-renderer.js';
import type {
  GpuiElementType,
  GpuiEventType,
  GpuiImgCustomProps,
  GpuiInputCustomProps,
  GpuiMotionProps,
  GpuiStyle,
  GpuiTextareaCustomProps,
} from '../types.js';
import 'retend/jsx-runtime';

type ReactiveValue<Value> = Value | Cell<Value> | AsyncDerivedCell<Value>;
type ReactiveProps<Props> = {
  [Key in keyof Props]?: ReactiveValue<Props[Key]>;
};
type ReactiveStyle = {
  [Key in keyof GpuiStyle]?: ReactiveValue<GpuiStyle[Key]>;
};
type EventHandler = (event: EventPayload) => void;

interface CustomPropsByTag {
  img: GpuiImgCustomProps;
  input: GpuiInputCustomProps;
  textarea: GpuiTextareaCustomProps;
}

declare module 'retend/jsx-runtime' {
  namespace JSX {
    /**
     * Reactive event props mapped from `GpuiEventType` to `on*` handlers.
     * A handler Cell may become `null` or `undefined` to remove the listener.
     */
    type ReactiveEventProps = {
      [Type in GpuiEventType as `on${Capitalize<Type>}`]?: EventHandlerValue<EventHandler>;
    };
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
      [Tag in GpuiElementType]: GpuiElementProps & ReactiveCustomProps<Tag>;
    };

    /**
     * Props shared by all GPUI intrinsic elements.
     */
    interface GpuiElementProps extends IntrinsicAttributes, ReactiveEventProps {
      /**
       * Retend GPUI author style. Individual properties may be `Cell`s for
       * reactive updates before the resolved snapshot crosses the native bridge.
       */
      style?: ValueOrCell<ReactiveStyle>;
      /**
       * Ref to the underlying `GpuiElement`. Accepts a `SourceCell` or callback.
       * Callback refs are invoked with `null` on cleanup.
       */
      ref?:
        | SourceCell<GpuiElement | null>
        | ((node: GpuiElement | null) => void);
      /** Whether the element should receive focus on mount. */
      autoFocus?: ValueOrCell<boolean>;
      /** Tab order index for focus navigation. */
      tabIndex?: ValueOrCell<number>;
      /** Test identifier forwarded as a custom prop for automation. */
      testId?: ValueOrCell<string>;
      /** Motion animation spec driving GPUiX's native animation system. */
      motion?: ValueOrCell<GpuiMotionProps>;
    }

    /**
     * Intrinsic element map for GPUI JSX. Augments `retend/jsx-runtime`
     * with the Retend GPUI v1 intrinsic set.
     * Import `"retend-gpui/jsx-runtime"` in your `tsconfig.json` types to enable.
     */
    interface IntrinsicElements extends GpuiIntrinsicElements {}
  }
}
