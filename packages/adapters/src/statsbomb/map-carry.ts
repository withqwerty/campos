import type { CarryEvent } from "@withqwerty/campos-schema";

import { statsBombToCampos } from "../shared/coordinates.js";
import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

// ---------------------------------------------------------------------------
// Carry builder
// ---------------------------------------------------------------------------

export function mapCarry(
  event: StatsBombEvent,
  matchInfo: StatsBombMatchInfo,
): CarryEvent {
  if (!event.carry) {
    throw new Error(`mapCarry called on event ${event.id} without carry data`);
  }

  const period = normalizePeriod(event.period);
  const coordinates = normalizeCoordinates(event);
  const time = normalizeTime(event);

  const [rawEndX, rawEndY] = event.carry.end_location;
  const endCoords = statsBombToCampos(rawEndX, rawEndY);

  return {
    kind: "carry" as const,
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
    endX: endCoords.x,
    endY: endCoords.y,
    provider: "statsbomb",
    providerEventId: event.id,
    sourceMeta: {
      index: event.index,
      playPattern: event.play_pattern.name,
    },
  };
}
