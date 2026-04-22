import type { MatchContext, PassEvent } from "@withqwerty/campos-schema";

import { assertMatchContext } from "./normalize.js";
import { PASS_TYPE_ID, type OptaEvent } from "./qualifiers.js";
import { mapPass } from "./map-pass.js";

/**
 * Product-facing pass projection.
 *
 * Filters:
 *  - Only Opta typeId 1 (Pass)
 *  - Must have start coordinates
 *
 * Returns canonical PassEvent[].
 */
export function projectPasses(
  events: readonly OptaEvent[],
  matchContext: MatchContext,
): PassEvent[] {
  assertMatchContext(matchContext);

  return events
    .filter((event) => event.typeId === PASS_TYPE_ID)
    .filter((event) => typeof event.x === "number" && typeof event.y === "number")
    .map((event) => mapPass(event, matchContext));
}
