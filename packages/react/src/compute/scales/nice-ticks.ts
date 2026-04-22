import { createNumericAxis } from "./numeric-axis.js";

export type NiceTicksResult = {
  domain: [number, number];
  ticks: number[];
};

/**
 * Compute "nice" tick values for a numeric axis.
 *
 * Expands `[min, max]` outward to round boundaries (multiples of 1, 2, 5,
 * 10, etc.) and returns the widened domain together with evenly-spaced tick
 * values.  Default target is ~5-7 ticks.
 *
 * Handles degenerate ranges (min === max) by padding +/- 1 (or +/- 10 %
 * of |value| when the value itself is large).
 */
export function niceTicks(min: number, max: number, count = 6): NiceTicksResult {
  const axis = createNumericAxis({
    min,
    max,
    range: [0, 1],
    tickCount: count,
  });
  return { domain: axis.domain, ticks: axis.ticks };
}
