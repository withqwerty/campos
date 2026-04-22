import type { StatsBombEvent } from "./parse.js";

const PERIOD_BOUNDARIES: Record<number, number> = {
  1: 45,
  2: 90,
  3: 105,
  4: 120,
};

export function normalizeStatsBombClock(
  event: Pick<StatsBombEvent, "period" | "minute" | "second">,
): {
  minute: number;
  addedMinute: number | null;
  second: number;
} {
  const boundary = PERIOD_BOUNDARIES[event.period];
  if (boundary != null && event.minute > boundary) {
    return {
      minute: boundary,
      addedMinute: event.minute - boundary,
      second: event.second,
    };
  }

  return {
    minute: event.minute,
    addedMinute: null,
    second: event.second,
  };
}
