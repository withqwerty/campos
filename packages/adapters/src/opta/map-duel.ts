import type { DuelEvent } from "@withqwerty/campos-schema";

import type { OptaEvent } from "./qualifiers.js";
import {
  normalizeCoordinates,
  normalizePeriod,
  normalizeTime,
  type ContextWithPeriods,
} from "./normalize.js";

// ---------------------------------------------------------------------------
// Duel builder
// ---------------------------------------------------------------------------

/** Opta typeId 44 = Aerial duel. All other duels mapped here are ground duels. */
export function mapDuel(event: OptaEvent, matchContext: ContextWithPeriods): DuelEvent {
  const period = normalizePeriod(event.periodId);
  const coordinates = normalizeCoordinates(event, matchContext, period);
  const time = normalizeTime(event);

  return {
    kind: "duel" as const,
    id: `${matchContext.matchId}:${event.id}`,
    matchId: matchContext.matchId,
    teamId: event.contestantId,
    playerId: event.playerId ?? null,
    playerName: event.playerName ?? null,
    minute: time.minute,
    addedMinute: time.addedMinute,
    second: time.second,
    period,
    x: coordinates.x,
    y: coordinates.y,
    duelType: event.typeId === 44 ? "aerial" : "ground",
    duelOutcome: event.outcome === 1 ? "won" : "lost",
    provider: "opta",
    providerEventId: String(event.id),
    sourceMeta: {
      typeId: event.typeId,
      eventId: event.eventId,
      outcome: event.outcome,
    },
  };
}
