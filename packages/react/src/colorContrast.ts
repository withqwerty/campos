/**
 * Background-aware foreground colour utilities.
 *
 * One canonical place for "given a CSS colour, what's its luminance, and
 * which of these candidate foreground colours reads best on top of it?"
 * Used by every chart that overlays marks (arrows, glyphs, labels) on a
 * data-coloured background — currently PassFlow, Territory, XGTimeline.
 *
 * Algorithm: WCAG 2.x relative luminance. sRGB channels are gamma-decoded
 * to linear light, then weighted with Rec. 709 coefficients
 * `(0.2126 R + 0.7152 G + 0.0722 B)`. Contrast ratio uses the standard
 * `(L1 + 0.05) / (L2 + 0.05)` form, giving 1 (no contrast) … 21 (black on
 * white).
 *
 * Why WCAG 2.x rather than CIE L\* or APCA: WCAG 2 is the ratified
 * standard, dependency-free, and matches what `prismatic`,
 * Observable Plot's `colorContrast` initializer, Highcharts' `"contrast"`
 * sentinel, and CSS `contrast-color()` all use. APCA is more perceptually
 * accurate but still draft (WCAG 3); we'll add it as an opt-in algorithm
 * once it stabilises.
 */

/** sRGB tuple in [0, 1] with optional alpha. */
export type Rgba = { r: number; g: number; b: number; a: number };

const NAMED_COLORS: Record<string, [number, number, number]> = {
  // The CSS named colours we actually use across Campos defaults plus
  // common values that show up in user themes. Not the full list — keep
  // it small; callers needing exotic names should pass hex.
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  silver: [192, 192, 192],
  navy: [0, 0, 128],
  teal: [0, 128, 128],
  orange: [255, 165, 0],
  yellow: [255, 255, 0],
  magenta: [255, 0, 255],
  cyan: [0, 255, 255],
  transparent: [0, 0, 0],
};

const HEX_RE = /^#?([0-9a-f]{3,8})$/i;
const RGB_RE = /^rgba?\(\s*([^)]+)\s*\)$/i;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Parse a CSS colour string into an sRGB tuple in `[0, 1]` plus alpha.
 * Accepts:
 *   - hex: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`
 *   - functional: `rgb(r, g, b)`, `rgba(r, g, b, a)` (commas, spaces, or
 *     CSS Color 4 slash form `rgb(r g b / a)`)
 *   - named: a small set of common CSS names (`white`, `black`, `red`, …)
 *   - the literal `transparent` (returns `{0,0,0,0}`)
 *
 * Returns `null` for unparseable input. PassFlow `bin.fill` for empty
 * bins is `"rgba(0,0,0,0)"`; this returns `{ r:0, g:0, b:0, a:0 }` so
 * callers can decide whether transparent means "skip" or "treat as
 * page background".
 */
export function parseColorString(input: string): Rgba | null {
  if (typeof input !== "string") return null;
  const s = input.trim().toLowerCase();
  if (s.length === 0) return null;

  if (s in NAMED_COLORS) {
    const [r, g, b] = NAMED_COLORS[s]!;
    return {
      r: r / 255,
      g: g / 255,
      b: b / 255,
      a: s === "transparent" ? 0 : 1,
    };
  }

  const hexMatch = s.match(HEX_RE);
  if (hexMatch != null) {
    const body = hexMatch[1]!;
    let r: number;
    let g: number;
    let b: number;
    let a = 1;
    if (body.length === 3 || body.length === 4) {
      r = parseInt(body[0]! + body[0]!, 16) / 255;
      g = parseInt(body[1]! + body[1]!, 16) / 255;
      b = parseInt(body[2]! + body[2]!, 16) / 255;
      if (body.length === 4) a = parseInt(body[3]! + body[3]!, 16) / 255;
    } else if (body.length === 6 || body.length === 8) {
      r = parseInt(body.slice(0, 2), 16) / 255;
      g = parseInt(body.slice(2, 4), 16) / 255;
      b = parseInt(body.slice(4, 6), 16) / 255;
      if (body.length === 8) a = parseInt(body.slice(6, 8), 16) / 255;
    } else {
      return null;
    }
    if (![r, g, b, a].every(Number.isFinite)) return null;
    return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: clamp01(a) };
  }

  const rgbMatch = s.match(RGB_RE);
  if (rgbMatch != null) {
    // Split on commas, whitespace, or slash (CSS Color 4 alpha sep).
    const parts = rgbMatch[1]!
      .split(/[\s,/]+/)
      .filter((p) => p.length > 0)
      .map((p) => p.trim());
    if (parts.length < 3) return null;
    const parseChannel = (raw: string): number => {
      if (raw.endsWith("%")) return clamp01(parseFloat(raw) / 100);
      const n = parseFloat(raw);
      if (!Number.isFinite(n)) return NaN;
      return clamp01(n / 255);
    };
    const parseAlpha = (raw: string): number => {
      if (raw.endsWith("%")) return clamp01(parseFloat(raw) / 100);
      const n = parseFloat(raw);
      return Number.isFinite(n) ? clamp01(n) : 1;
    };
    const r = parseChannel(parts[0]!);
    const g = parseChannel(parts[1]!);
    const b = parseChannel(parts[2]!);
    const a = parts.length >= 4 ? parseAlpha(parts[3]!) : 1;
    if (![r, g, b].every(Number.isFinite)) return null;
    return { r, g, b, a };
  }

  return null;
}

/**
 * sRGB → linear-light gamma decode per WCAG 2.x.
 * `c` is in `[0, 1]`.
 */
function linearise(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Relative luminance per WCAG 2.x. Input is an `Rgba` from
 * `parseColorString`. Returns `0` (black) … `1` (white). Alpha is ignored
 * — luminance is a property of the colour itself, not its opacity.
 */
export function relativeLuminance(c: Rgba): number {
  return 0.2126 * linearise(c.r) + 0.7152 * linearise(c.g) + 0.0722 * linearise(c.b);
}

/**
 * WCAG 2.x contrast ratio between two colour strings, in `[1, 21]`. Black
 * vs white is `21`; identical colours are `1`. Returns `1` if either
 * input is unparseable.
 */
export function contrastRatio(a: string, b: string): number {
  const ca = parseColorString(a);
  const cb = parseColorString(b);
  if (ca == null || cb == null) return 1;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick the candidate colour that has the highest WCAG contrast ratio
 * against `bg`. The pick-from-list pattern matches `prismatic::best_contrast`,
 * Observable Plot's `colorContrast`, CSS `contrast-color()`, and
 * Highcharts' `"contrast"` sentinel — chart-rendering code wants "which
 * colour to use", not a numeric ratio.
 *
 * `holdRange` is the salt-and-pepper hysteresis mitigation: when the
 * background's luminance lies in `[0.5 - holdRange, 0.5 + holdRange]`,
 * return `holdColor` instead of flipping between candidates. Default `0`
 * disables it. A typical anti-flicker setting is `holdRange: 0.08` with
 * `holdColor: theme.text.muted`.
 *
 * Returns the first candidate when `bg` is unparseable (predictable
 * fallback rather than a silent throw).
 */
export function pickContrast(
  bg: string,
  candidates: readonly string[],
  options?: { holdRange?: number; holdColor?: string },
): string {
  if (candidates.length === 0) return "#000000";
  const parsedBg = parseColorString(bg);
  if (parsedBg == null) return candidates[0]!;
  const bgL = relativeLuminance(parsedBg);

  const holdRange = options?.holdRange ?? 0;
  if (holdRange > 0 && Math.abs(bgL - 0.5) <= holdRange) {
    return options?.holdColor ?? candidates[0]!;
  }

  let bestColor = candidates[0]!;
  let bestRatio = -Infinity;
  for (const candidate of candidates) {
    const parsed = parseColorString(candidate);
    if (parsed == null) continue;
    const fgL = relativeLuminance(parsed);
    const lighter = Math.max(bgL, fgL);
    const darker = Math.min(bgL, fgL);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestColor = candidate;
    }
  }
  return bestColor;
}

/**
 * Two-candidate convenience wrapper. Equivalent to
 * `pickContrast(bg, [light, dark])` and preserves the prior
 * `colorUtils.contrastColor` API so existing call sites don't change.
 */
export function contrastColor(bg: string, dark = "#1a1a1a", light = "#ffffff"): string {
  return pickContrast(bg, [light, dark]);
}

/**
 * Backwards-compat luminance function for callers that only have a hex
 * colour. New code should use `parseColorString` + `relativeLuminance`,
 * which handle `rgba()` / named / transparent inputs.
 */
export function hexLuminance(hex: string): number {
  const parsed = parseColorString(hex);
  if (parsed == null) return 1;
  return relativeLuminance(parsed);
}
