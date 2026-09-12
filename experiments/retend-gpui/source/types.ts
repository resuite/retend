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
 * Rust parses this into the Retend-owned native color representation.
 */
export type GpuiColor = `#${string}`;

export type GpuiTransitionProperty =
  | 'width'
  | 'height'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'opacity'
  | 'borderRadius';

export type GpuiTransitionTimingFunction =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | `cubic-bezier(${string})`;

/** Author-style surface implemented by the Retend-owned native renderer. */
export interface GpuiStyleDeclarations {
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
  overflow?: 'visible' | 'clip' | 'hidden' | 'auto' | 'scroll';

  transitionProperty?: GpuiTransitionProperty | GpuiTransitionProperty[];
  transitionDuration?: string;
  transitionDelay?: string;
  transitionTimingFunction?: GpuiTransitionTimingFunction;
}

export interface GpuiStyle extends GpuiStyleDeclarations {
  hover?: GpuiStyleDeclarations;
  active?: GpuiStyleDeclarations;
}

/** Border-box layout data returned by {@link GpuiElement.measure}. */
export interface GpuiScrollOffset {
  x: number;
  y: number;
}

export interface GpuiMeasurement {
  /** Left edge in window coordinates. */
  x: number;
  /** Top edge in window coordinates. */
  y: number;
  /** Border-box width. */
  width: number;
  /** Border-box height. */
  height: number;
  /** Width of the element's scrollable content extent. */
  scrollWidth: number;
  /** Height of the element's scrollable content extent. */
  scrollHeight: number;
}

/** Native intrinsic tag names. Text remains ordinary JSX content. */
export const GPUI_ELEMENT_TYPES = ['div', 'img', 'input', 'textarea'] as const;

/** Union of currently supported intrinsic element tag names. */
export type GpuiElementType = (typeof GPUI_ELEMENT_TYPES)[number];

/**
 * Custom props for `<img>`.
 */
export interface GpuiImgCustomProps {
  /** HTTP(S) image URL. Bundled asset imports are added with the native Vite asset pipeline. */
  src?: string;
  /** How the image should scale within its bounds. */
  objectFit?: 'fill' | 'contain' | 'cover' | 'scaleDown' | 'none';
}

export interface GpuiInputCustomProps {
  /** Controlled single-line native value. */
  value?: string;
}

export interface GpuiTextareaCustomProps {
  /** Controlled multi-line native value. */
  value?: string;
  /** Minimum visible row count while auto-sizing. */
  minRows?: number;
  /** Maximum visible row count while auto-sizing. */
  maxRows?: number;
}

export interface GpuiSelection {
  start: number;
  end: number;
}
