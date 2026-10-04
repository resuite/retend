/** WCAG 2.x contrast helpers, used by the kitchen sink to measure live tokens. */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/u, '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/iu.test(full)) return null;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function channel(value: number): number {
  const scaled = value / 255;
  if (scaled <= 0.03928) return scaled / 12.92;
  return ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(color: Rgb): number {
  return (
    0.2126 * channel(color.r) +
    0.7152 * channel(color.g) +
    0.0722 * channel(color.b)
  );
}

/** Returns the contrast ratio, or null when either value is not a hex color. */
export function contrastRatio(
  foreground: string,
  background: string
): number | null {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) return null;

  const lighter = Math.max(luminance(fg), luminance(bg));
  const darker = Math.min(luminance(fg), luminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}
