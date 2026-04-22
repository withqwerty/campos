import type { PassEvent } from "@withqwerty/campos-schema";

import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { mapPass } from "./map-pass.js";

const PASS_TYPE_ID = 30;

/**
 * Product-facing pass projection.
 *
 * Filters:
 *  - type.id === 30 (Pass)
 *  - pass object present
 *  - must have start location
 *
 * Returns canonical PassEvent[].
 */
export function projectPasses(
  events: readonly StatsBombEvent[],
  matchInfo: StatsBombMatchInfo,
): PassEvent[] {
  return events
    .filter((event) => event.type.id === PASS_TYPE_ID)
    .filter((event) => event.pass != null)
    .filter((event) => event.location != null)
    .map((event) => mapPass(event, matchInfo));
}
