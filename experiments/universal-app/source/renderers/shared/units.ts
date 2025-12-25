/**
 * Universal Unit System
 *
 * Provides a unified styling system that translates between environments:
 * - Canvas: Universal units (u) → pixels (1u = 8px)
 * - Terminal: Universal units (u) → character cells (1u = 1 char)
 *
 * Supported unit types:
 * - "Xu" - Universal units (e.g., "2u", "4u")
 * - "X%" - Percentage of parent (e.g., "50%", "100%")
 */

import { Cell } from 'retend';

export type UnitValue = `${number}u` | `${number}%`;

export interface ParsedUnit {
  value: number;
  type: 'u' | '%';
}

/**
 * Parse a unit value string like "2u" or "50%"
 * @throws Error if the value doesn't end with "u" or "%"
 */
export function parseUnit(value: string): ParsedUnit {
  if (value.endsWith('u')) {
    return { value: parseFloat(value), type: 'u' };
  }

  if (value.endsWith('%')) {
    return { value: parseFloat(value), type: '%' };
  }

  throw new Error(`Invalid unit value: "${value}". Must end with "u" or "%".`);
}

/**
 * Unwrap a value that might be wrapped in a Cell
 */
export function getValue<T>(value: T | Cell<T>): T {
  return value instanceof Cell ? value.get() : value;
}

/**
 * Resolve a unit value to pixels for canvas rendering
 * @param value - The unit value ("2u" or "50%")
 * @param parentSize - Parent dimension for percentage calculations.
 *                     For root elements, pass the viewport size.
 * @param unitScale - Pixels per universal unit (default: 8)
 * @returns The resolved pixel value, or undefined if value is undefined
 */
export function resolveForCanvas(
  value: string | undefined,
  parentSize?: number,
  unitScale = 8
): number | undefined {
  if (value === undefined) return undefined;

  const parsed = parseUnit(value);

  if (parsed.type === 'u') {
    return parsed.value * unitScale;
  }

  if (parsed.type === '%') {
    if (parentSize === undefined) return undefined;
    return (parsed.value / 100) * parentSize;
  }

  return undefined;
}

/**
 * Resolve a unit value to character cells for terminal rendering
 * @param value - The unit value ("2u" or "50%")
 * @param parentSize - Parent dimension for percentage calculations.
 *                     For root elements, pass the viewport size (columns/rows).
 * @returns The resolved character cell value, or undefined if value is undefined
 */
export function resolveForTerminal(
  value: string | undefined,
  parentSize?: number
): number | undefined {
  if (value === undefined) return undefined;

  const parsed = parseUnit(value);

  if (parsed.type === 'u') {
    return parsed.value; // 1u = 1 character cell
  }

  if (parsed.type === '%') {
    if (parentSize === undefined) return undefined;
    return Math.floor((parsed.value / 100) * parentSize);
  }

  return undefined;
}
