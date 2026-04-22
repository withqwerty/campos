import type { ShotEvent } from "@withqwerty/campos-schema";

import { WS_QUALIFIER, WS_SHOT_TYPE_IDS } from "./constants.js";
import type { WhoScoredMatchData, WhoScoredMatchInfo } from "./parse.js";
import { toOptaEvent } from "./parse.js";
import { hasWhoScoredQualifier, mapShot } from "./map-shot.js";

/**
 * Product-facing shot projection for WhoScored data.
 *
 * Filters:
 *  - Only shot typeIds (13, 14, 15, 16)
 *  - Not penalty shootout (period 5)
 *  - Not own goals (qualifier 28)
 *  - Must have coordinates
 *
 * Returns canonical ShotEvent[].
 */
export function projectShots(
  matchData: WhoScoredMatchData,
  matchInfo: WhoScoredMatchInfo,
): ShotEvent[] {
  return matchData.events
    .filter((event) => WS_SHOT_TYPE_IDS.has(event.type.value))
    .filter((event) => event.period.value !== 5)
    .filter((event) => !hasWhoScoredQualifier(event, WS_QUALIFIER.OWN_GOAL))
    .filter((event) => typeof event.x === "number" && typeof event.y === "number")
    .map((event) => {
      const optaEvent = toOptaEvent(event, matchData.playerIdNameDictionary);
      return mapShot(optaEvent, event, matchInfo.matchId);
    });
}
