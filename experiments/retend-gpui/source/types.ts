/** Value accepted for native length properties. Numbers are logical pixels. */
export type DimensionValue = number | 'auto' | `${number}px` | `${number}%`;

export type GpuiAlign =
  | 'start'
  | 'end'
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'baseline'
  | 'stretch';

export type GpuiContentAlign =
  | 'start'
  | 'end'
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'stretch'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';
/**
 * Hex color string in `#rrggbb` or `#rrggbbaa` form.
 * GPUiX normalizes this into its native color representation.
 */
export type GpuiColor = `#${string}`;

/**
 * Numeric style properties that can be animated via the `motion` prop.
 * Only a subset of layout-adjacent values is motion-capable; other styles
 * should be updated through the regular `style` prop.
 */
export interface GpuiMotionStyle {
  /** Target width in logical pixels. */
  width?: number;
  /** Target height in logical pixels. */
  height?: number;
  /** Target opacity in the range 0–1. */
  opacity?: number;
  /** Target `top` offset in logical pixels. */
  top?: number;
  /** Target `right` offset in logical pixels. */
  right?: number;
  /** Target `bottom` offset in logical pixels. */
  bottom?: number;
  /** Target `left` offset in logical pixels. */
  left?: number;
  /** Target border radius in logical pixels. */
  borderRadius?: number;
}

/**
 * Easing curve for a motion transition.
 * Accepts CSS keyword easings or a cubic-bezier tuple `[x1, y1, x2, y2]`.
 */
export type GpuiMotionEase =
  | 'linear'
  | 'ease'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | [number, number, number, number];

/**
 * Timing configuration for a motion animation.
 */
export interface GpuiMotionTransition {
  /** Duration in milliseconds. */
  duration?: number;
  /** Delay before the animation starts in milliseconds. */
  delay?: number;
  /** Easing curve applied over the transition. */
  ease?: GpuiMotionEase;
}

/**
 * Props for the `motion` attribute on GPUI elements.
 * Drives GPUiX's native animation system for the host element.
 *
 * @example
 * ```tsx
 * <div motion={{ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 200 } }} />
 * ```
 */
export interface GpuiMotionProps {
  /** Starting style before the animation runs. `false` disables the initial state. */
  initial?: GpuiMotionStyle | false;
  /** Target style to animate toward. */
  animate: GpuiMotionStyle;
  /** Optional timing/easing configuration. */
  transition?: GpuiMotionTransition;
}

/** Static author-style surface implemented by the Phase 2 native renderer. */
export interface GpuiStyle {
  display?: 'block' | 'flex' | 'none';
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  flexGrow?: number;
  flexShrink?: number;
  alignItems?: GpuiAlign;
  alignSelf?: GpuiAlign;
  alignContent?: GpuiContentAlign;
  justifyContent?: GpuiContentAlign;
  gap?: number;
  rowGap?: number;
  columnGap?: number;

  width?: DimensionValue;
  height?: DimensionValue;
  minWidth?: DimensionValue;
  minHeight?: DimensionValue;
  maxWidth?: DimensionValue;
  maxHeight?: DimensionValue;

  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;

  margin?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;

  position?: 'relative' | 'absolute';
  top?: DimensionValue;
  right?: DimensionValue;
  bottom?: DimensionValue;
  left?: DimensionValue;

  backgroundColor?: GpuiColor;
  color?: GpuiColor;
  opacity?: number;

  borderWidth?: number;
  borderColor?: GpuiColor;
  borderRadius?: number;

  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  whiteSpace?: 'normal' | 'nowrap';
}

/** v1 intrinsic tag names. Text remains ordinary JSX content, not an intrinsic. */
export const GPUI_ELEMENT_TYPES = ['div', 'img', 'input', 'textarea'] as const;

/**
 * Native event types that can be subscribed to via `on*` props.
 * Each entry maps to a JSX prop `on${Capitalize<Type>}` (e.g. `onClick`).
 */
export const GPUI_EVENT_TYPES = [
  'change',
  'submit',
  'click',
  'mouseDown',
  'mouseUp',
  'mouseEnter',
  'mouseLeave',
  'mouseMove',
  'mouseDownOutside',
  'keyDown',
  'keyUp',
  'focus',
  'blur',
  'scroll',
] as const;

/** Union of supported intrinsic element tag names. */
export type GpuiElementType = (typeof GPUI_ELEMENT_TYPES)[number];
/** Union of supported native event type strings. */
export type GpuiEventType = (typeof GPUI_EVENT_TYPES)[number];

/**
 * Custom props for `<input>`.
 * Values are forwarded as native custom props via `setCustomPropValue`.
 */
export interface GpuiInputCustomProps {
  /** Controlled input value. */
  value?: string;
  /** Placeholder text shown when value is empty. */
  placeholder?: string;
  /** Whether the input is non-editable. */
  readOnly?: boolean;
}

/**
 * Custom props for `<textarea>`.
 * Extends input props with auto-sizing row constraints.
 */
export interface GpuiTextareaCustomProps extends GpuiInputCustomProps {
  /** Minimum visible rows when auto-sizing. */
  minRows?: number;
  /** Maximum visible rows when auto-sizing. */
  maxRows?: number;
}

/**
 * Custom props for `<img>`.
 */
export interface GpuiImgCustomProps {
  /** HTTP(S) image URL. Bundled asset imports are added with the native Vite asset pipeline. */
  src?: string;
  /** How the image should scale within its bounds. */
  objectFit?: 'fill' | 'contain' | 'cover' | 'scaleDown' | 'none';
}
