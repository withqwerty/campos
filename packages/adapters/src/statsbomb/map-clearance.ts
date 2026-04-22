import type { ClearanceEvent } from "@withqwerty/campos-schema";

import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

// ---------------------------------------------------------------------------
// Clearance builder
// ---------------------------------------------------------------------------

export function mapClearance(
  event: StatsBombEvent,
  matchInfo: StatsBombMatchInfo,
): ClearanceEvent {
  const period = normalizePeriod(event.period);
  const coordinates = normalizeCoordinates(event);
  const time = normalizeTime(event);

  return {
    kind: "clearance" as const,
    id: `${matchInfo.id}:${event.id}`,
    matchId: String(matchInfo.id),
    teamId: String(event.team.id),
    playerId: event.player ? String(event.player.id) : null,
    playerName: event.player?.name ?? null,
    minute: time.minute,
    addedMinute: time.addedMinute,
    second: time.second,
    period,
    x: coordinates.x,
    y: coordinates.y,
    provider: "statsbomb",
    providerEventId: event.id,
    sourceMeta: {
      index: event.index,
      playPattern: event.play_pattern.name,
    },
  };
}
