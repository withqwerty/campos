import type { PassEvent } from "@withqwerty/campos-schema";

import type { WhoScoredMatchData, WhoScoredMatchInfo } from "./parse.js";
import { toOptaEvent } from "./parse.js";
import { mapEvent } from "./map-events.js";

const WS_PASS_TYPE_ID = 1;

/**
 * Product-facing pass projection for WhoScored data.
 *
 * Filters:
 *  - type.value === 1 (Pass)
 *  - must have start coordinates
 *
 * Returns canonical PassEvent[].
 */
export function projectPasses(
  matchData: WhoScoredMatchData,
  matchInfo: WhoScoredMatchInfo,
): PassEvent[] {
  return matchData.events
    .filter((event) => event.type.value === WS_PASS_TYPE_ID)
    .filter((event) => typeof event.x === "number" && typeof event.y === "number")
    .map((event) => {
      const optaEvent = toOptaEvent(event, matchData.playerIdNameDictionary);
      const mapped = mapEvent(optaEvent, event, matchInfo.matchId);
      if (mapped?.kind !== "pass") {
        throw new Error(
          `internal error: expected WhoScored pass projection to map event ${event.id} to PassEvent`,
        );
      }
      return mapped;
    });
}
