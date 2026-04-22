import { createContinuousScale } from "./continuous-scale.js";

/**
 * Create a linear scale mapping values from `domain` to `range`.
 *
 * When the domain is degenerate (min === max), every input maps to the
 * midpoint of the range so the chart degrades gracefully instead of
 * producing NaN.
 */
export function createLinearScale(
  domain: [number, number],
  range: [number, number],
): (value: number) => number {
  return createContinuousScale({ kind: "linear", domain, range });
}
