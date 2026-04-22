import { statsBombToCampos } from "../shared/coordinates.js";
import type { StatsBombEvent } from "./parse.js";
export { normalizeStatsBombClock as normalizeTime } from "./clock.js";

// ---------------------------------------------------------------------------
// Coordinate normalization
// ---------------------------------------------------------------------------

/**
 * Convert StatsBomb 120x80 coordinates to Campos 0-100 range.
 *
 * StatsBomb coordinates are absolute (always attacking left-to-right in the
 * data regardless of period), so no direction context is needed.
 */
export function normalizeCoordinates(event: StatsBombEvent): {
  x: number | null;
  y: number | null;
} {
  if (!event.location) {
    return { x: null, y: null };
  }

  const [rawX, rawY] = event.location;
  return statsBombToCampos(rawX, rawY);
}

// ---------------------------------------------------------------------------
// Period normalization
// ---------------------------------------------------------------------------

export function normalizePeriod(period: number): 1 | 2 | 3 | 4 | 5 {
  if (period === 1 || period === 2 || period === 3 || period === 4 || period === 5) {
    return period;
  }

  throw new Error(`Unsupported StatsBomb period for event normalization: ${period}`);
}
