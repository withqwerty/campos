import type { GoalkeeperEvent } from "@withqwerty/campos-schema";

import type { OptaEvent } from "./qualifiers.js";
import {
  normalizeCoordinates,
  normalizePeriod,
  normalizeTime,
  type ContextWithPeriods,
} from "./normalize.js";

// ---------------------------------------------------------------------------
// Action type classification
// ---------------------------------------------------------------------------

function mapActionType(event: OptaEvent): GoalkeeperEvent["actionType"] {
  switch (event.typeId) {
    case 10:
      return "save";
    case 11:
      return "claim";
    case 41:
      return "punch";
    case 52:
      return "keeper-pick-up";
    case 53:
      return "claim";
    case 54:
      return "keeper-pick-up";
    case 58:
      return "save";
    case 59:
      return "keeper-pick-up";
    default:
      return "save";
  }
}

// ---------------------------------------------------------------------------
// Goalkeeper builder
// ---------------------------------------------------------------------------

export function mapGoalkeeper(
  event: OptaEvent,
  matchContext: ContextWithPeriods,
): GoalkeeperEvent {
  const period = normalizePeriod(event.periodId);
  const coordinates = normalizeCoordinates(event, matchContext, period);
  const time = normalizeTime(event);

  return {
    kind: "goalkeeper" as const,
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
    actionType: mapActionType(event),
    provider: "opta",
    providerEventId: String(event.id),
    sourceMeta: {
      typeId: event.typeId,
      eventId: event.eventId,
      outcome: event.outcome,
    },
  };
}
