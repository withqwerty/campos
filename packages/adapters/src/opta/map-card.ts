import type { CardEvent } from "@withqwerty/campos-schema";

import type { OptaEvent } from "./qualifiers.js";
import { normalizePeriod, normalizeTime, type ContextWithPeriods } from "./normalize.js";

// ---------------------------------------------------------------------------
// Card type classification
// ---------------------------------------------------------------------------

function mapCardType(event: OptaEvent): CardEvent["cardType"] {
  switch (event.typeId) {
    case 17:
      return "yellow";
    case 65:
      return "second-yellow";
    case 68:
      return "red";
    default:
      // Unreachable in practice: the router calls mapCard only for
      // typeId ∈ {17, 65, 68}. Kept to satisfy the exhaustive return.
      return "yellow";
  }
}

// ---------------------------------------------------------------------------
// Card builder
// ---------------------------------------------------------------------------

export function mapCard(event: OptaEvent, matchContext: ContextWithPeriods): CardEvent {
  const period = normalizePeriod(event.periodId);
  const time = normalizeTime(event);

  return {
    kind: "card" as const,
    id: `${matchContext.matchId}:${event.id}`,
    matchId: matchContext.matchId,
    teamId: event.contestantId,
    playerId: event.playerId ?? null,
    playerName: event.playerName ?? null,
    minute: time.minute,
    addedMinute: time.addedMinute,
    second: time.second,
    period,
    x: null,
    y: null,
    cardType: mapCardType(event),
    provider: "opta",
    providerEventId: String(event.id),
    sourceMeta: {
      typeId: event.typeId,
      eventId: event.eventId,
      outcome: event.outcome,
    },
  };
}
