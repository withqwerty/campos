/**
 * Shared bin-edge utilities. Used by both `computePassFlow` and
 * `computeHeatmap` so they accept identical edge shapes (notably the
 * output of `zoneEdgesInCampos()` from `@withqwerty/campos-stadia`).
 *
 * Edges live in Campos 0–100 space; the first edge matches the active
 * crop's left/bottom boundary and the last edge matches the right/top.
 */

/**
 * Error thrown when `xEdges`/`yEdges` fail validation (non-monotonic,
 * out of range, or mismatched to the active crop boundaries). Exposed as
 * a named class so callers can `catch (e) { if (e instanceof
 * InvalidEdgesError) … }` uniformly across charts.
 */
export class InvalidEdgesError extends Error {
  override readonly name = "InvalidEdgesError";
}

/**
 * Build uniform bin edges — `count` bins → `count + 1` edges from `min`
 * to `max`. Snaps the final edge exactly to `max` to avoid FP drift.
 */
export function uniformEdges(count: number, min: number, max: number): number[] {
  const step = (max - min) / count;
  const edges: number[] = [];
  for (let i = 0; i <= count; i += 1) {
    edges.push(i === count ? max : min + i * step);
  }
  return edges;
}

/**
 * Validate explicit bin edges. Throws `InvalidEdgesError` on non-monotonic,
 * out-of-range, or crop-boundary mismatch.
 */
export function validateEdges(
  edges: readonly number[],
  expectedFirst: number,
  expectedLast: number,
  axis: "x" | "y",
): void {
  if (edges.length < 2) {
    throw new InvalidEdgesError(`${axis}Edges must have at least 2 entries`);
  }
  for (let i = 0; i < edges.length; i += 1) {
    const v = edges[i]!;
    if (!Number.isFinite(v)) {
      throw new InvalidEdgesError(`${axis}Edges[${i}] is not finite`);
    }
    if (v < 0 || v > 100) {
      throw new InvalidEdgesError(`${axis}Edges[${i}] = ${v} is outside [0, 100]`);
    }
    if (i > 0 && v <= edges[i - 1]!) {
      throw new InvalidEdgesError(
        `${axis}Edges must be strictly increasing (at index ${i}: ${edges[i - 1]} → ${v})`,
      );
    }
  }
  const EPS = 1e-9;
  if (Math.abs(edges[0]! - expectedFirst) > EPS) {
    throw new InvalidEdgesError(
      `${axis}Edges[0] = ${edges[0]} must equal ${expectedFirst} for the active crop`,
    );
  }
  if (Math.abs(edges[edges.length - 1]! - expectedLast) > EPS) {
    throw new InvalidEdgesError(
      `${axis}Edges[last] = ${edges[edges.length - 1]} must equal ${expectedLast} for the active crop`,
    );
  }
}

/**
 * Assign a value to a bin index using the half-open `[a, b)` rule. The
 * final-edge hit maps to the last bin so boundary values aren't dropped.
 * Returns `-1` if the value lies strictly before the first edge.
 */
export function assignBin(value: number, edges: readonly number[]): number {
  const last = edges.length - 1;
  if (value >= edges[last]!) return last - 1;
  for (let i = 0; i < last; i += 1) {
    if (value >= edges[i]! && value < edges[i + 1]!) return i;
  }
  return -1;
}
