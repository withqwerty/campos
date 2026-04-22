import type { ShotEvent } from "@withqwerty/campos-schema";

import type { WyscoutMatchData, WyscoutMatchInfo } from "./parse.js";
import { isOwnGoal, mapShot } from "./map-shot.js";
import { resolveMatchId } from "./common.js";

const SHOT_EVENT_IDS = new Set([10]);
const SET_PIECE_SHOT_SUBEVENT_IDS = new Set([33, 35]);

function isShotEvent(event: WyscoutMatchData["events"][number]): boolean {
  return (
    SHOT_EVENT_IDS.has(event.eventId) || SET_PIECE_SHOT_SUBEVENT_IDS.has(event.subEventId)
  );
}

export function projectShots(
  matchData: WyscoutMatchData,
  matchInfo: WyscoutMatchInfo = {},
): ShotEvent[] {
  const matchId = resolveMatchId(matchData, matchInfo);

  return matchData.events
    .filter(isShotEvent)
    .filter((event) => event.matchPeriod !== "P")
    .filter((event) => !isOwnGoal(event))
    .filter((event) => event.positions[0] != null)
    .map((event) => mapShot(event, matchId));
}
