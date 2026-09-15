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
 * Hex color string in `#rrggbb` or `#rrggbbaa` form, or a CSS named color
 * keyword. Rust parses this into the Retend-owned native color representation.
 */
export type GpuiColor = `#${string}` | GpuiColorKeyword;

/** CSS named color keywords (plus `transparent`) supported by the native parser. */
export type GpuiColorKeyword =
  | 'aliceblue'
  | 'antiquewhite'
  | 'aqua'
  | 'aquamarine'
  | 'azure'
  | 'beige'
  | 'bisque'
  | 'black'
  | 'blanchedalmond'
  | 'blue'
  | 'blueviolet'
  | 'brown'
  | 'burlywood'
  | 'cadetblue'
  | 'chartreuse'
  | 'chocolate'
  | 'coral'
  | 'cornflowerblue'
  | 'cornsilk'
  | 'crimson'
  | 'cyan'
  | 'darkblue'
  | 'darkcyan'
  | 'darkgoldenrod'
  | 'darkgray'
  | 'darkgreen'
  | 'darkgrey'
  | 'darkkhaki'
  | 'darkmagenta'
  | 'darkolivegreen'
  | 'darkorange'
  | 'darkorchid'
  | 'darkred'
  | 'darksalmon'
  | 'darkseagreen'
  | 'darkslateblue'
  | 'darkslategray'
  | 'darkslategrey'
  | 'darkturquoise'
  | 'darkviolet'
  | 'deeppink'
  | 'deepskyblue'
  | 'dimgray'
  | 'dimgrey'
  | 'dodgerblue'
  | 'firebrick'
  | 'floralwhite'
  | 'forestgreen'
  | 'fuchsia'
  | 'gainsboro'
  | 'ghostwhite'
  | 'gold'
  | 'goldenrod'
  | 'gray'
  | 'green'
  | 'greenyellow'
  | 'grey'
  | 'honeydew'
  | 'hotpink'
  | 'indianred'
  | 'indigo'
  | 'ivory'
  | 'khaki'
  | 'lavender'
  | 'lavenderblush'
  | 'lawngreen'
  | 'lemonchiffon'
  | 'lightblue'
  | 'lightcoral'
  | 'lightcyan'
  | 'lightgoldenrodyellow'
  | 'lightgray'
  | 'lightgreen'
  | 'lightgrey'
  | 'lightpink'
  | 'lightsalmon'
  | 'lightseagreen'
  | 'lightskyblue'
  | 'lightslategray'
  | 'lightslategrey'
  | 'lightsteelblue'
  | 'lightyellow'
  | 'lime'
  | 'limegreen'
  | 'linen'
  | 'magenta'
  | 'maroon'
  | 'mediumaquamarine'
  | 'mediumblue'
  | 'mediumorchid'
  | 'mediumpurple'
  | 'mediumseagreen'
  | 'mediumslateblue'
  | 'mediumspringgreen'
  | 'mediumturquoise'
  | 'mediumvioletred'
  | 'midnightblue'
  | 'mintcream'
  | 'mistyrose'
  | 'moccasin'
  | 'navajowhite'
  | 'navy'
  | 'oldlace'
  | 'olive'
  | 'olivedrab'
  | 'orange'
  | 'orangered'
  | 'orchid'
  | 'palegoldenrod'
  | 'palegreen'
  | 'paleturquoise'
  | 'palevioletred'
  | 'papayawhip'
  | 'peachpuff'
  | 'peru'
  | 'pink'
  | 'plum'
  | 'powderblue'
  | 'purple'
  | 'rebeccapurple'
  | 'red'
  | 'rosybrown'
  | 'royalblue'
  | 'saddlebrown'
  | 'salmon'
  | 'sandybrown'
  | 'seagreen'
  | 'seashell'
  | 'sienna'
  | 'silver'
  | 'skyblue'
  | 'slateblue'
  | 'slategray'
  | 'slategrey'
  | 'snow'
  | 'springgreen'
  | 'steelblue'
  | 'tan'
  | 'teal'
  | 'thistle'
  | 'tomato'
  | 'turquoise'
  | 'violet'
  | 'wheat'
  | 'white'
  | 'whitesmoke'
  | 'yellow'
  | 'yellowgreen'
  | 'transparent';

export type GpuiTransitionProperty =
  | 'width'
  | 'height'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'opacity'
  | 'borderRadius'
  | 'backgroundColor'
  | 'color'
  | 'borderColor';

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
  paddingInline?: number;
  paddingBlock?: number;

  margin?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginInline?: number;
  marginBlock?: number;

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
  focused?: GpuiStyleDeclarations;
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
export const GPUI_ELEMENT_TYPES = [
  'div',
  'img',
  'input',
  'textarea',
  'anchored',
  'button',
] as const;

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
  /** Text shown while the control is empty. */
  placeholder?: string;
}

export interface GpuiTextareaCustomProps {
  /** Controlled multi-line native value. */
  value?: string;
  /** Text shown while the control is empty. */
  placeholder?: string;
  /** Minimum visible row count while auto-sizing. */
  minRows?: number;
  /** Maximum visible row count while auto-sizing. */
  maxRows?: number;
}

export interface GpuiButtonCustomProps {
  /** When true, the button ignores pointer and keyboard activation and is skipped by Tab. */
  disabled?: boolean | null;
}

export interface GpuiPoint {
  x: number;
  y: number;
}

/** Native anchored/deferred floating-layer configuration. */
export interface GpuiAnchoredCustomProps {
  /** Explicit anchor position in window coordinates. Omit to anchor at this element's parent-relative slot. */
  position?: GpuiPoint | null;
  /** Side of the local trigger edge to place the floating content on. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Alignment along the selected side. */
  align?: 'start' | 'center' | 'end';
  /** Distance from the selected side in logical pixels. */
  gap?: number;
  /** Additional x/y adjustment after side positioning. */
  offset?: GpuiPoint | null;
  /** Collision policy when the layer would overflow the window. */
  fit?: 'switch' | 'snap';
  /** Window-edge margin used by `fit="snap"`. */
  snapMargin?: number;
  /** Paint in GPUI's deferred layer so the content floats above normal content. */
  deferred?: boolean;
  /** Deferred-layer ordering priority. */
  priority?: number;
  /** Whether the floating surface blocks hit testing behind it. */
  occlude?: boolean;
}

export interface GpuiSelection {
  start: number;
  end: number;
}
