import type { AsyncDerivedCell, Cell, SourceCell } from 'retend';

import type { GpuiElement } from '../gpui-renderer.js';
import type {
  GpuiElementType,
  GpuiImgCustomProps,
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
      [Tag in GpuiElementType]: GpuiElementProps & ReactiveCustomProps<Tag>;
    };

    /**
     * Props shared by all GPUI intrinsic elements.
     */
    interface GpuiElementProps extends IntrinsicAttributes {
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
    }

    /**
     * Intrinsic element map for GPUI JSX. Augments `retend/jsx-runtime`
     * with the Retend GPUI v1 intrinsic set.
     * Import `"retend-gpui/jsx-runtime"` in your `tsconfig.json` types to enable.
     */
    interface IntrinsicElements extends GpuiIntrinsicElements {}
  }
}
