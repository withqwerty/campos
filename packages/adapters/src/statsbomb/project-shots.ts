import type { ShotEvent } from "@withqwerty/campos-schema";

import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { mapShot } from "./map-shot.js";

/** StatsBomb type.id for Shot events. */
const SHOT_TYPE_ID = 16;

/**
 * Product-facing shot projection.
 *
 * Filters:
 *  - type.id === 16 (Shot)
 *  - shot object present
 *  - Not penalty shootout (period 5)
 *  - Not own goals ("Own Goal For" / "Own Goal Against")
 *  - Must have location
 *
 * Returns canonical ShotEvent[].
 */
export function projectShots(
  events: readonly StatsBombEvent[],
  matchInfo: StatsBombMatchInfo,
): ShotEvent[] {
  return events
    .filter((event) => event.type.id === SHOT_TYPE_ID)
    .filter((event) => event.shot != null)
    .filter((event) => event.period !== 5)
    .filter((event) => {
      const typeName = event.shot?.type.name;
      return typeName !== "Own Goal For" && typeName !== "Own Goal Against";
    })
    .filter((event) => event.location != null)
    .map((event) => mapShot(event, matchInfo));
}
