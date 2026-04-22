import type { PassEvent } from "@withqwerty/campos-schema";

import type { WyscoutMatchData, WyscoutMatchInfo } from "./parse.js";
import { mapPass } from "./map-pass.js";
import { resolveMatchId } from "./common.js";

const PASS_EVENT_ID = 8;

/**
 * Product-facing pass projection.
 *
 * Filters:
 *  - eventId === 8 (Pass)
 *  - must have a start position
 *
 * Returns canonical PassEvent[].
 */
export function projectPasses(
  matchData: WyscoutMatchData,
  matchInfo: WyscoutMatchInfo = {},
): PassEvent[] {
  const matchId = resolveMatchId(matchData, matchInfo);

  return matchData.events
    .filter((event) => event.eventId === PASS_EVENT_ID)
    .filter((event) => event.positions[0] != null)
    .map((event) => mapPass(event, matchId));
}
