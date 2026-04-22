import type { TakeOnEvent } from "@withqwerty/campos-schema";
import type { OptaEvent } from "./qualifiers.js";
import {
  normalizeCoordinates,
  normalizePeriod,
  normalizeTime,
  type ContextWithPeriods,
} from "./normalize.js";

export function mapTakeOn(
  event: OptaEvent,
  matchContext: ContextWithPeriods,
): TakeOnEvent {
  const period = normalizePeriod(event.periodId);
  const coordinates = normalizeCoordinates(event, matchContext, period);
  const time = normalizeTime(event);
  return {
    kind: "take-on" as const,
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
    takeOnResult: event.outcome === 1 ? "complete" : "incomplete",
    provider: "opta",
    providerEventId: String(event.id),
    sourceMeta: { typeId: event.typeId, eventId: event.eventId, outcome: event.outcome },
  };
}
