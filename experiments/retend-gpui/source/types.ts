/**
 * Value accepted for dimensional style properties such as `width` or `minHeight`.
 * Numbers are interpreted as logical pixels; strings allow percentages, `auto`,
 * or other CSS-like tokens forwarded to GPUiX's StyleDesc parser.
 */
export type DimensionValue = number | string;
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

/** Style vocabulary accepted by GPUiX's native StyleDesc parser. */
export interface GpuiStyle {
  display?: string;
  visibility?: string;
  flexDirection?: string;
  flexWrap?: string;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
  alignItems?: string;
  alignSelf?: string;
  alignContent?: string;
  justifyContent?: string;
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  gridTemplateColumns?: number;
  gridTemplateRows?: number;
  gridColumnMin?: 'zero' | 'min-content' | 'max-content';
  gridRowMin?: 'zero' | 'min-content' | 'max-content';

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

  position?: string;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;

  backgroundColor?: GpuiColor;
  color?: GpuiColor;
  opacity?: number;

  borderWidth?: number;
  borderColor?: GpuiColor;
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;

  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  textAlign?: string;
  lineHeight?: number;
  whiteSpace?: 'normal' | 'nowrap';
  textOverflow?: 'ellipsis' | 'ellipsis-start';
  lineClamp?: number;

  overflow?: string;
  overflowX?: string;
  overflowY?: string;

  cursor?: string;
  pointerEvents?: 'auto' | 'none';
  userSelect?: 'text' | 'none' | 'auto';
  selectionColor?: GpuiColor;

  hover?: Omit<GpuiStyle, 'hover' | 'active'>;
  active?: Omit<GpuiStyle, 'hover' | 'active'>;
}

/**
 * Token colors for syntax-highlighted surfaces (`code`, `diff`, `markdown`).
 * Each field maps a syntactic category to a hex color applied by the native theme.
 */
export interface GpuiSyntaxTheme {
  comment?: string;
  keyword?: string;
  string?: string;
  stringSpecial?: string;
  escape?: string;
  number?: string;
  boolean?: string;
  typeName?: string;
  typeBuiltin?: string;
  constructor?: string;
  function?: string;
  functionBuiltin?: string;
  macroName?: string;
  property?: string;
  constant?: string;
  variable?: string;
  variableSpecial?: string;
  parameter?: string;
  operator?: string;
  punctuation?: string;
  tag?: string;
  attribute?: string;
  label?: string;
  invalid?: string;
}

/**
 * Pixel metrics controlling code/diff/markdown layout.
 * Adjust these to tune density and readability for the native renderers.
 */
export interface GpuiMetrics {
  codeTextSize?: number;
  codeLineHeight?: number;
  codePaddingX?: number;
  codePaddingY?: number;
  codeRadius?: number;
  codeHeaderPaddingY?: number;
  codeHeaderTextSize?: number;
  codeGutterDigitWidth?: number;
  codeGutterPaddingRight?: number;
  codeGutterMinWidth?: number;
  diffTextSize?: number;
  diffLineHeight?: number;
  diffFileHeaderHeight?: number;
  diffHunkHeaderHeight?: number;
  diffNoticeHeight?: number;
  diffBodyBottomPad?: number;
  diffGutterWidth?: number;
  diffMarkerWidth?: number;
  diffAccentBarWidth?: number;
  diffRowPaddingX?: number;
  mdTextSize?: number;
  mdLineHeight?: number;
  mdBlockGap?: number;
  mdHeadingSizes?: number[];
  mdHeadingLineHeights?: number[];
  mdTableCellPadding?: number;
  mdTableMinColumnWidth?: number;
  mdTableMinColumnContent?: number;
  mdInlineCodeRadius?: number;
}

/**
 * Theme applied to GPUI native widgets and the root surface.
 * Colors are forwarded to GPUiX; `fontSans`/`fontMono` select system fonts.
 */
export interface GpuiTheme {
  /** Preferred color scheme; influences default widget colors when omitted. */
  appearance?: 'dark' | 'light';
  bg?: string;
  border?: string;
  text?: string;
  textMuted?: string;
  textFaint?: string;
  textDim?: string;
  accent?: string;
  caret?: string;
  codeText?: string;
  codeWash?: string;
  diffAdd?: string;
  diffDel?: string;
  diffHunkBg?: string;
  fontSans?: string;
  fontMono?: string;
  syntax?: GpuiSyntaxTheme;
  metrics?: GpuiMetrics;
}

/**
 * Intrinsic tag names supported by the GPUI renderer.
 * Use these as JSX tag names (e.g. `<div>`, `<code>`, `<virtual-list>`).
 */
export const GPUI_ELEMENT_TYPES = [
  'div',
  'text',
  'img',
  'svg',
  'canvas',
  'input',
  'textarea',
  'anchored',
  'code',
  'diff',
  'markdown',
  'virtual-list',
] as const;

/**
 * Native event types that can be subscribed to via `on*` props.
 * Each entry maps to a JSX prop `on${Capitalize<Type>}` (e.g. `onClick`).
 */
export const GPUI_EVENT_TYPES = [
  'toggleFile',
  'showMore',
  'lineClick',
  'linkClick',
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
  /** Theme override scoped to this input. */
  theme?: GpuiTheme;
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
  /** Accessible description for the image. */
  alt?: string;
}

/**
 * Custom props for `<svg>`.
 */
export interface GpuiSvgCustomProps {
  /** Inline SVG source or URL. */
  src?: string;
}

/**
 * Custom props for `<code>`.
 * Renders a syntax-highlighted code block via GPUiX.
 */
export interface GpuiCodeCustomProps {
  /** Source code to display. */
  code?: string;
  /** Language identifier for syntax highlighting (e.g. `"ts"`, `"rust"`). */
  language?: string;
  /** File path shown in the header when `showHeader` is enabled. */
  path?: string;
  /** Whether to render line numbers in the gutter. */
  showLineNumbers?: boolean;
  /** Whether to render the file header bar. */
  showHeader?: boolean;
  /** Theme override for the code surface. */
  theme?: GpuiTheme;
}

/**
 * Custom props for `<diff>`.
 * Renders a unified diff/patch view.
 */
export interface GpuiDiffCustomProps {
  /** Unified diff patch text. */
  patch?: string;
  /** Whether to highlight intra-line word changes. */
  wordDiff?: boolean;
  /** File paths that should render collapsed. */
  collapsedPaths?: string[];
  /** Whether the diff surface scrolls independently. */
  scroll?: boolean;
  /** Maximum number of lines to render before virtualizing. */
  maxLines?: number;
  /** Theme override for the diff surface. */
  theme?: GpuiTheme;
}

/**
 * Custom props for `<markdown>`.
 */
export interface GpuiMarkdownCustomProps {
  /** Markdown source text to render. */
  source?: string;
  /** Theme override for the markdown surface. */
  theme?: GpuiTheme;
}

/**
 * Two-dimensional point in logical pixels, typically used for anchoring.
 */
export interface GpuiPoint {
  x: number;
  y: number;
}

/**
 * Custom props for `<anchored>`.
 * Positions its children relative to an anchor point with automatic flipping.
 */
export interface GpuiAnchoredCustomProps {
  /** Explicit anchor position in logical pixels. */
  position?: GpuiPoint;
  /** Preferred side relative to the anchor rect. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Alignment along the orthogonal axis. */
  align?: 'start' | 'center' | 'end';
  /** Gap between anchor and content in logical pixels. */
  gap?: number;
  anchor?:
    | 'topLeft'
    | 'topCenter'
    | 'topRight'
    | 'rightCenter'
    | 'bottomRight'
    | 'bottomCenter'
    | 'bottomLeft'
    | 'leftCenter';
  offset?: GpuiPoint;
  fit?: 'switch' | 'snap';
  snapMargin?: number;
  deferred?: boolean;
  priority?: number;
  occlude?: boolean;
}

/**
 * Custom props for `<virtual-list>`.
 * Provides a windowed scrolling container for large collections.
 */
export interface GpuiVirtualListCustomProps {
  /** Scroll anchoring strategy; `bottom` keeps the tail visible for chat-like lists. */
  alignment?: 'top' | 'bottom';
  /** Whether to automatically follow new items appended at the tail. */
  followTail?: boolean;
  /** Number of off-screen items to render for smoother scrolling. */
  overdraw?: number;
  /** Estimated height of a single item used before measurement. */
  estimatedItemHeight?: number;
}
