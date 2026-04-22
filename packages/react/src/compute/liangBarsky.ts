/**
 * Liang-Barsky 2D line-segment clipper.
 *
 * Clips segment `(p0 → p1)` to the axis-aligned rectangle defined by
 * `{ x, y, width, height }`. Returns clipped endpoints or `null` when the
 * segment lies entirely outside the rectangle (including the grazing-corner
 * case where a segment touches the rectangle only at a single point).
 *
 * Implementation notes:
 * - Epsilon `1e-9` used for zero-span axis handling so a purely horizontal or
 *   vertical segment still clips correctly.
 * - "Grazing-corner": `t0 >= t1` after the final clip step means the chord
 *   degenerates to a single point — we reject these as visually useless.
 */

export type Point = { x: number; y: number };
export type ClipRect = { x: number; y: number; width: number; height: number };

const EPS = 1e-9;

export function clipSegment(p0: Point, p1: Point, rect: ClipRect): [Point, Point] | null {
  if (!Number.isFinite(p0.x) || !Number.isFinite(p0.y)) return null;
  if (!Number.isFinite(p1.x) || !Number.isFinite(p1.y)) return null;

  const xmin = rect.x;
  const xmax = rect.x + rect.width;
  const ymin = rect.y;
  const ymax = rect.y + rect.height;

  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;

  // Four edge tests: p = [-dx, dx, -dy, dy]; q = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0]
  const p = [-dx, dx, -dy, dy];
  const q = [p0.x - xmin, xmax - p0.x, p0.y - ymin, ymax - p0.y];

  let t0 = 0;
  let t1 = 1;

  for (let i = 0; i < 4; i++) {
    const pi = p[i] as number;
    const qi = q[i] as number;
    if (Math.abs(pi) < EPS) {
      // Parallel to this edge. If q < 0 the segment is entirely outside.
      if (qi < 0) return null;
      continue;
    }
    const t = qi / pi;
    if (pi < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }

  // Grazing-corner: chord collapses to a single point.
  if (t1 - t0 <= EPS) return null;

  return [
    { x: p0.x + t0 * dx, y: p0.y + t0 * dy },
    { x: p0.x + t1 * dx, y: p0.y + t1 * dy },
  ];
}
