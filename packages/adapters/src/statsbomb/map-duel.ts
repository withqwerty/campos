import type { DuelEvent } from "@withqwerty/campos-schema";

import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

// ---------------------------------------------------------------------------
// Duel builder
// ---------------------------------------------------------------------------

/**
 * Build a DuelEvent from a StatsBomb Duel event (non-tackle duels).
 */
export function mapDuel(event: StatsBombEvent, matchInfo: StatsBombMatchInfo): DuelEvent {
  const period = normalizePeriod(event.period);
  const coordinates = normalizeCoordinates(event);
  const time = normalizeTime(event);

  const duelType: DuelEvent["duelType"] =
    event.duel?.type.name === "Aerial Lost" || event.duel?.type.name === "Aerial Won"
      ? "aerial"
      : "ground";

  const won =
    event.duel?.outcome?.name === "Won" ||
    event.duel?.outcome?.name === "Success" ||
    event.duel?.outcome?.name === "Success In Play" ||
    event.duel?.outcome?.name === "Success Out";

  return {
    kind: "duel" as const,
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
    duelType,
    duelOutcome: won ? "won" : "lost",
    provider: "statsbomb",
    providerEventId: event.id,
    sourceMeta: {
      index: event.index,
      duelType: event.duel?.type.name,
      duelOutcome: event.duel?.outcome?.name,
      playPattern: event.play_pattern.name,
    },
  };
}
