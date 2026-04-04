/**
 * The supported length units.
 *
 * These constants describe the finite set of length units used by modeled
 * canvas length values.
 */
export const LengthUnit = {
  Px: 0,
  Pct: 1,
} as const;

/**
 * A pixel length unit.
 */
export type PxUnit = typeof LengthUnit.Px;

/**
 * A percentage length unit.
 */
export type PctUnit = typeof LengthUnit.Pct;

/**
 * A pixel-based canvas length.
 *
 * Use this when a style value should be interpreted as an absolute device-space
 * length inside the current canvas coordinate system.
 */
export interface PxLength {
  unit: PxUnit;
  value: number;
}

/**
 * A percentage-based canvas length.
 *
 * Percentage values are resolved against the current parent scope at render
 * time, which makes them suitable for layout-style positioning and sizing.
 */
export interface PctLength {
  unit: PctUnit;
  value: number;
}

/**
 * A modeled canvas length value.
 *
 * Retend canvas uses explicit length objects instead of CSS-like strings so
 * style values can be typed, normalized, and interpreted without reparsing.
 */
export type LengthValue = PxLength | PctLength;

/**
 * Creates strongly-typed canvas length values.
 *
 * `Length.Px(...)` creates absolute lengths.
 * `Length.Pct(...)` creates percentage lengths relative to the active scope.
 */
export const Length = {
  Px(value: number): PxLength {
    return { unit: LengthUnit.Px, value };
  },
  Pct(value: number): PctLength {
    return { unit: LengthUnit.Pct, value };
  },
} as const;

/**
 * The supported angle units.
 *
 * Retend canvas currently models degree rotation explicitly.
 */
export const AngleUnit = {
  Deg: 0,
} as const;

/**
 * A degree angle unit.
 */
export type DegUnit = typeof AngleUnit.Deg;

/**
 * A degree-based canvas rotation.
 *
 * Rotation is modeled explicitly so transforms can work with numeric values
 * directly instead of parsing `deg` strings during rendering.
 */
export interface DegreeAngle {
  unit: DegUnit;
  value: number;
}

/**
 * A modeled canvas angle value.
 */
export type AngleValue = DegreeAngle;

/**
 * Creates strongly-typed canvas angle values.
 */
export const Angle = {
  Deg(value: number): DegreeAngle {
    return { unit: AngleUnit.Deg, value };
  },
} as const;

/**
 * A modeled transform origin.
 *
 * Both axes are resolved independently, which makes the shape work well for
 * canvas transforms that need to combine absolute and percentage-based values.
 */
export interface TransformOriginValue {
  x: LengthValue;
  y: LengthValue;
}

/**
 * Creates modeled transform origin values.
 */
export const TransformOrigin = {
  At(x: LengthValue, y: LengthValue): TransformOriginValue {
    return { x, y };
  },
} as const;

/**
 * The supported canvas overflow modes.
 *
 * These constants replace string literals for the closed overflow set without
 * introducing extra wrapper objects.
 */
export const Overflow = {
  Visible: 0,
  Hidden: 1,
} as const;

/**
 * A canvas overflow mode.
 */
export type OverflowValue = (typeof Overflow)[keyof typeof Overflow];

/**
 * The supported canvas border styles.
 *
 * These constants model the finite border style set without exposing string
 * literals through the public style API.
 */
export const BorderStyle = {
  None: 0,
  Solid: 1,
  Dashed: 2,
  Dotted: 3,
} as const;

/**
 * A canvas border style.
 */
export type BorderStyleValue = (typeof BorderStyle)[keyof typeof BorderStyle];

export const Alignment = {
  Start: 0,
  Center: 1,
  End: 2,
} as const;

export type AlignmentValue = (typeof Alignment)[keyof typeof Alignment];

/**
 * The supported canvas text alignment values.
 *
 * These values give style authors a finite, typed alignment vocabulary while
 * keeping alignment selection explicit and discoverable.
 */
export const TextAlign = {
  Left: 0,
  Center: 1,
  Right: 2,
} as const;

/**
 * A canvas text alignment value.
 */
export type TextAlignValue = (typeof TextAlign)[keyof typeof TextAlign];

/**
 * The supported canvas white-space modes.
 *
 * These constants replace stringly white-space configuration with a closed,
 * typed API.
 */
export const WhiteSpace = {
  Normal: 0,
  PreWrap: 1,
} as const;

/**
 * A canvas white-space mode.
 */
export type WhiteSpaceValue = (typeof WhiteSpace)[keyof typeof WhiteSpace];

/**
 * The supported canvas font styles.
 *
 * These values keep the public API compact while still allowing the
 * renderer to map the chosen style onto the canvas font shorthand.
 */
export const FontStyle = {
  Normal: 0,
  Italic: 1,
  Oblique: 2,
} as const;

/**
 * A canvas font style value.
 */
export type FontStyleValue = (typeof FontStyle)[keyof typeof FontStyle];

/**
 * Common numeric font weights for canvas text rendering.
 *
 * The values are numbers so the renderer can feed them directly into the
 * canvas font shorthand without translating from keyword strings.
 */
export const FontWeight = {
  Normal: 400,
  Bold: 700,
} as const;

/**
 * A canvas font weight value.
 */
export type FontWeightValue = number;
