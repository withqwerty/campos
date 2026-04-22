import type { SubstitutionEvent } from "@withqwerty/campos-schema";

import type { OptaEvent } from "./qualifiers.js";
import { normalizePeriod, normalizeTime, type ContextWithPeriods } from "./normalize.js";

// ---------------------------------------------------------------------------
// Substitution builder
// ---------------------------------------------------------------------------

export function mapSubstitution(
  event: OptaEvent,
  matchContext: ContextWithPeriods,
  incomingEvent?: OptaEvent,
): SubstitutionEvent {
  const period = normalizePeriod(event.periodId);
  const time = normalizeTime(event);

  return {
    kind: "substitution" as const,
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
    playerInId: incomingEvent?.playerId ?? null,
    playerInName: incomingEvent?.playerName ?? null,
    provider: "opta",
    providerEventId: String(event.id),
    sourceMeta: {
      typeId: event.typeId,
      eventId: event.eventId,
      outcome: event.outcome,
      ...(incomingEvent != null
        ? {
            playerInEventId: incomingEvent.eventId,
            playerInProviderEventId: incomingEvent.id,
          }
        : {}),
    },
  };
}
