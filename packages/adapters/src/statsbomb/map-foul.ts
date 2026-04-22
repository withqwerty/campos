import type { FoulCommittedEvent } from "@withqwerty/campos-schema";

import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

// ---------------------------------------------------------------------------
// Foul builder
// ---------------------------------------------------------------------------

export function mapFoul(
  event: StatsBombEvent,
  matchInfo: StatsBombMatchInfo,
): FoulCommittedEvent {
  const period = normalizePeriod(event.period);
  const coordinates = normalizeCoordinates(event);
  const time = normalizeTime(event);

  return {
    kind: "foul-committed" as const,
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
