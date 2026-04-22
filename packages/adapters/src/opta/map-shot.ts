import type { ShotEvent } from "@withqwerty/campos-schema";

import { statsPerformGoalMouthToCampos } from "../shared/coordinates.js";
import { hasQualifier, Q, readNumericQualifier, type OptaEvent } from "./qualifiers.js";
import {
  normalizeCoordinates,
  normalizeEndCoordinatesFromQualifiers,
  normalizePeriod,
  normalizeTime,
  type ContextWithPeriods,
} from "./normalize.js";

// ---------------------------------------------------------------------------
// Field mappers
// ---------------------------------------------------------------------------

export function mapBodyPart(event: OptaEvent): ShotEvent["bodyPart"] {
  if (hasQualifier(event, Q.HEAD)) {
    return "head";
  }
  if (hasQualifier(event, Q.LEFT_FOOT)) {
    return "left-foot";
  }
  if (hasQualifier(event, Q.RIGHT_FOOT)) {
    return "right-foot";
  }
  return "other";
}

export function mapContext(event: OptaEvent): ShotEvent["context"] {
  if (hasQualifier(event, Q.PENALTY)) {
    return "penalty";
  }
  if (hasQualifier(event, Q.FROM_CORNER)) {
    return "from-corner";
  }
  if (hasQualifier(event, Q.DIRECT_FREE_KICK)) {
    return "direct-free-kick";
  }
  if (hasQualifier(event, Q.SET_PIECE)) {
    return "set-piece";
  }
  if (hasQualifier(event, Q.FAST_BREAK)) {
    return "fast-break";
  }
  return "regular-play";
}

export function mapOutcome(event: OptaEvent): ShotEvent["outcome"] {
  switch (event.typeId) {
    case 16:
      return "goal";
    case 14:
      return "hit-woodwork";
    case 15:
      return hasQualifier(event, Q.BLOCKED) ? "blocked" : "saved";
    case 13:
      return "off-target";
    default:
      return "other";
  }
}

// ---------------------------------------------------------------------------
// Shot builder
// ---------------------------------------------------------------------------

export function mapShot(event: OptaEvent, matchContext: ContextWithPeriods): ShotEvent {
  const xg = readNumericQualifier(event, Q.XG) ?? readNumericQualifier(event, Q.XG_EG);
  const xgot = readNumericQualifier(event, Q.XGOT);
  const goalMouth = statsPerformGoalMouthToCampos(
    readNumericQualifier(event, Q.GOAL_MOUTH_Y),
    readNumericQualifier(event, Q.GOAL_MOUTH_Z),
  );
  const period = normalizePeriod(event.periodId);
  const coordinates = normalizeCoordinates(event, matchContext, period);
  const time = normalizeTime(event);
  const endCoords = normalizeEndCoordinatesFromQualifiers(event, matchContext, period);

  return {
    kind: "shot" as const,
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
    ...(endCoords.endX != null && endCoords.endY != null
      ? { endX: endCoords.endX, endY: endCoords.endY }
      : {}),
    xg,
    xgot,
    outcome: mapOutcome(event),
    bodyPart: mapBodyPart(event),
    isOwnGoal: hasQualifier(event, Q.OWN_GOAL),
    isPenalty: hasQualifier(event, Q.PENALTY),
    context: mapContext(event),
    goalMouthY: goalMouth.goalMouthY,
    goalMouthZ: goalMouth.goalMouthZ,
    provider: "opta",
    providerEventId: String(event.id),
    sourceMeta: {
      typeId: event.typeId,
      eventId: event.eventId,
      outcome: event.outcome,
    },
  };
}
