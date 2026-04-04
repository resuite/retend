/**
 * The supported length units.
 *
 * Units are modeled as constant objects so the public API can stay fully
 * object-based even at the discriminant level.
 */
export const LengthUnit = {
  Px: { value: 0 },
  Pct: { value: 1 },
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
 * Retend canvas currently models degree rotation explicitly, but the unit is
 * still represented as a constant object for consistency with the rest of the
 * typed style API.
 */
export const AngleUnit = {
  Deg: { value: 0 },
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
 */
export interface OverflowMode {
  value: 0 | 1;
}

/**
 * Constant overflow mode objects.
 *
 * These are shared singleton values so style code can use identity-stable
 * objects instead of string literals for closed overflow options.
 */
export const Overflow = {
  Visible: { value: 0 } as OverflowMode,
  Hidden: { value: 1 } as OverflowMode,
} as const;

/**
 * A canvas overflow mode.
 */
export type OverflowValue = (typeof Overflow)[keyof typeof Overflow];

/**
 * The supported canvas border styles.
 */
export interface BorderStyleMode {
  value: 0 | 1 | 2 | 3;
}

/**
 * Constant border style objects.
 *
 * These values model the finite border style set without exposing string
 * literals through the public style API.
 */
export const BorderStyle = {
  None: { value: 0 } as BorderStyleMode,
  Solid: { value: 1 } as BorderStyleMode,
  Dashed: { value: 2 } as BorderStyleMode,
  Dotted: { value: 3 } as BorderStyleMode,
} as const;

/**
 * A canvas border style.
 */
export type BorderStyleValue = (typeof BorderStyle)[keyof typeof BorderStyle];

/**
 * The supported canvas text alignment values.
 */
export interface TextAlignMode {
  value: 0 | 1 | 2;
}

/**
 * Constant text alignment objects.
 *
 * These values give style authors a finite, typed alignment vocabulary while
 * keeping alignment selection explicit and discoverable.
 */
export const TextAlign = {
  Left: { value: 0 } as TextAlignMode,
  Center: { value: 1 } as TextAlignMode,
  Right: { value: 2 } as TextAlignMode,
} as const;

/**
 * A canvas text alignment value.
 */
export type TextAlignValue = (typeof TextAlign)[keyof typeof TextAlign];

/**
 * The supported canvas white-space modes.
 */
export interface WhiteSpaceMode {
  value: 0 | 1;
}

/**
 * Constant white-space mode objects.
 *
 * These singleton values replace stringly white-space configuration with a
 * closed object-based API.
 */
export const WhiteSpace = {
  Normal: { value: 0 } as WhiteSpaceMode,
  PreWrap: { value: 1 } as WhiteSpaceMode,
} as const;

/**
 * A canvas white-space mode.
 */
export type WhiteSpaceValue = (typeof WhiteSpace)[keyof typeof WhiteSpace];

/**
 * The supported canvas font styles.
 */
export interface FontStyleMode {
  value: 0 | 1 | 2;
}

/**
 * Constant font style objects.
 *
 * These values keep the public API object-based while still allowing the
 * renderer to map the chosen style onto the canvas font shorthand.
 */
export const FontStyle = {
  Normal: { value: 0 } as FontStyleMode,
  Italic: { value: 1 } as FontStyleMode,
  Oblique: { value: 2 } as FontStyleMode,
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
