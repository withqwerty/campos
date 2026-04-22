import type { PassEvent } from "@withqwerty/campos-schema";

import { computePassLengthAndAngle } from "../shared/pass-geometry.js";
import { hasQualifier, Q, type OptaEvent } from "./qualifiers.js";
import {
  normalizeCoordinates,
  normalizeEndCoordinatesFromQualifiers,
  normalizePeriod,
  normalizeTime,
  type ContextWithPeriods,
} from "./normalize.js";

// ---------------------------------------------------------------------------
// Pass type classification
// ---------------------------------------------------------------------------

export function mapPassType(event: OptaEvent): PassEvent["passType"] {
  if (hasQualifier(event, Q.CORNER_TAKEN)) return "corner";
  if (hasQualifier(event, Q.FREE_KICK_TAKEN)) return "free-kick";
  if (hasQualifier(event, Q.GOAL_KICK)) return "goal-kick";
  if (hasQualifier(event, Q.THROW_IN)) return "throw-in";
  if (hasQualifier(event, Q.KICK_OFF)) return "kick-off";
  if (hasQualifier(event, Q.THROUGH_BALL)) return "through-ball";
  if (hasQualifier(event, Q.CROSS)) return "cross";
  if (hasQualifier(event, Q.LONG_BALL)) return "high";
  return "ground";
}

// ---------------------------------------------------------------------------
// Pass builder
// ---------------------------------------------------------------------------

export function mapPass(event: OptaEvent, matchContext: ContextWithPeriods): PassEvent {
  const period = normalizePeriod(event.periodId);
  const coordinates = normalizeCoordinates(event, matchContext, period);
  const time = normalizeTime(event);
  const endCoords = normalizeEndCoordinatesFromQualifiers(event, matchContext, period);
  const { length, angle } = computePassLengthAndAngle(
    coordinates.x,
    coordinates.y,
    endCoords.endX,
    endCoords.endY,
  );

  return {
    kind: "pass" as const,
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
    endX: endCoords.endX,
    endY: endCoords.endY,
    length,
    angle,
    recipient: null,
    passResult: event.outcome === 1 ? "complete" : "incomplete",
    passType: mapPassType(event),
    isAssist: hasQualifier(event, Q.ASSIST),
    provider: "opta",
    providerEventId: String(event.id),
    sourceMeta: {
      typeId: event.typeId,
      eventId: event.eventId,
      outcome: event.outcome,
    },
  };
}
