/**
 * Shared axis-padding helpers used by every cartesian chart that exposes an
 * `axisPadding` input.
 *
 * The **frame** is the outer rect — background fill + series clip-path use
 * this. The **plotArea** is `frame` inset by `axisPadding` on each side; the
 * scale range, tick positions, and marker coordinates all live in `plotArea`.
 * When `axisPadding` is 0, `plotArea` equals `frame`.
 *
 * See `docs/specs/plot-padding-spec.md`.
 */

export type AxisPaddingInput = number | readonly [number, number] | false;

export type LayoutRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Normalise the user-facing `axisPadding` prop to a `[gutterX, gutterY]`
 * tuple of non-negative pixels. `false`, `0`, and negatives all clamp to 0.
 */
export function resolveAxisPadding(value: AxisPaddingInput): [number, number] {
  if (value === false) return [0, 0];
  if (typeof value === "number") {
    const v = Math.max(0, value);
    return [v, v];
  }
  return [Math.max(0, value[0]), Math.max(0, value[1])];
}

/**
 * Apply gutter to a frame rect, returning the inset plotArea. Used by charts
 * that build their frame from MARGIN constants and then inset for scale
 * purposes. Safe against small frames (width/height clamped to 0).
 */
export function applyAxisPadding(
  frame: LayoutRect,
  gutter: readonly [number, number],
): LayoutRect {
  const [gx, gy] = gutter;
  return {
    x: frame.x + gx,
    y: frame.y + gy,
    width: Math.max(0, frame.width - 2 * gx),
    height: Math.max(0, frame.height - 2 * gy),
  };
}

/** Default gutter applied when the user doesn't pass `axisPadding` at all. */
export const DEFAULT_AXIS_PADDING = 6;
