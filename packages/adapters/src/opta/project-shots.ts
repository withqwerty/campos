import type { MatchContext, ShotEvent } from "@withqwerty/campos-schema";

import { hasQualifier, Q, SHOT_TYPE_IDS, type OptaEvent } from "./qualifiers.js";
import { assertMatchContext } from "./normalize.js";
import { mapShot } from "./map-shot.js";

/**
 * Product-facing shot projection.
 *
 * Filters:
 *  - Only shot typeIds (13, 14, 15, 16)
 *  - Not penalty shootout (period 5)
 *  - Not own goals
 *  - Not disallowed goals
 *  - Must have coordinates
 *
 * Returns canonical ShotEvent[].
 */
export function projectShots(
  events: readonly OptaEvent[],
  matchContext: MatchContext,
): ShotEvent[] {
  assertMatchContext(matchContext);

  return events
    .filter((event) => SHOT_TYPE_IDS.has(event.typeId))
    .filter((event) => event.periodId !== 5)
    .filter((event) => !hasQualifier(event, Q.OWN_GOAL))
    .filter((event) => !hasQualifier(event, Q.DISALLOWED))
    .filter((event) => typeof event.x === "number" && typeof event.y === "number")
    .map((event) => mapShot(event, matchContext));
}
