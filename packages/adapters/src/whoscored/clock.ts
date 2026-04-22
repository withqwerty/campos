import type { Shot } from "@withqwerty/campos-schema";

import type { OptaEvent } from "../opta/qualifiers.js";

const PERIOD_BOUNDARIES: Record<number, number> = {
  1: 45,
  2: 90,
  3: 105,
  4: 120,
};

export function normalizeWhoScoredClock(
  event: Pick<OptaEvent, "periodId" | "timeMin" | "timeSec">,
): Pick<Shot, "minute" | "addedMinute" | "second"> {
  const boundary = PERIOD_BOUNDARIES[event.periodId];
  if (boundary != null && event.timeMin > boundary) {
    return {
      minute: boundary,
      addedMinute: event.timeMin - boundary,
      second: event.timeSec,
    };
  }

  return {
    minute: event.timeMin,
    addedMinute: null,
    second: event.timeSec,
  };
}
