import type { ShotEvent } from "@withqwerty/campos-schema";

import {
  clampToCamposRange,
  statsPerformGoalMouthToCampos,
} from "../shared/coordinates.js";
import { readNumericQualifier, Q, type OptaEvent } from "../opta/qualifiers.js";
import { mapBodyPart, mapContext, mapOutcome } from "../opta/map-shot.js";
import { validatePeriod } from "../shared/normalize.js";
import { WS_QUALIFIER } from "./constants.js";
import type { WhoScoredEvent } from "./parse.js";
import { normalizeWhoScoredClock } from "./clock.js";

// ---------------------------------------------------------------------------
// Coordinate normalization
// ---------------------------------------------------------------------------

/**
 * WhoScored coordinates are already direction-normalized (all teams attack
 * toward x=100), so no MatchContext direction lookup is needed.
 *
 * The y-axis requires inversion (WhoScored y=0 is right touchline in Campos
 * terms), matching the Opta convention.
 */
export function normalizeCoordinates(event: OptaEvent): {
  x: number | null;
  y: number | null;
} {
  return {
    x: clampToCamposRange(event.x),
    y: clampToCamposRange(100 - event.y),
  };
}

export function hasWhoScoredQualifier(
  event: WhoScoredEvent,
  qualifierId: number,
): boolean {
  return event.qualifiers.some((q) => q.type.value === qualifierId);
}

function shotEndFromOptaQualifiers(optaEvent: OptaEvent): {
  endX: number | null;
  endY: number | null;
} {
  const rawEndX = readNumericQualifier(optaEvent, Q.PASS_END_X);
  const rawEndY = readNumericQualifier(optaEvent, Q.PASS_END_Y);
  if (rawEndX == null || rawEndY == null) {
    return { endX: null, endY: null };
  }
  return {
    endX: clampToCamposRange(rawEndX),
    endY: clampToCamposRange(100 - rawEndY),
  };
}

// ---------------------------------------------------------------------------
// Shot builder
// ---------------------------------------------------------------------------

export function mapShot(
  optaEvent: OptaEvent,
  wsEvent: WhoScoredEvent,
  matchId: string,
): ShotEvent {
  const goalMouth = statsPerformGoalMouthToCampos(
    wsEvent.goalMouthY ?? readNumericQualifier(optaEvent, Q.GOAL_MOUTH_Y),
    wsEvent.goalMouthZ ?? readNumericQualifier(optaEvent, Q.GOAL_MOUTH_Z),
  );
  const period = validatePeriod(optaEvent.periodId, "WhoScored");
  const coordinates = normalizeCoordinates(optaEvent);
  const time = normalizeWhoScoredClock(optaEvent);
  const endCoords = shotEndFromOptaQualifiers(optaEvent);

  return {
    kind: "shot" as const,
    id: `${matchId}:${optaEvent.id}`,
    matchId,
    teamId: optaEvent.contestantId,
    playerId: optaEvent.playerId ?? null,
    playerName: optaEvent.playerName ?? null,
    minute: time.minute,
    addedMinute: time.addedMinute,
    second: time.second,
    period,
    x: coordinates.x,
    y: coordinates.y,
    ...(endCoords.endX != null && endCoords.endY != null
      ? { endX: endCoords.endX, endY: endCoords.endY }
      : {}),
    xg: readNumericQualifier(optaEvent, Q.XG),
    xgot: readNumericQualifier(optaEvent, Q.XGOT),
    outcome: mapOutcome(optaEvent),
    bodyPart: mapBodyPart(optaEvent),
    isOwnGoal: hasWhoScoredQualifier(wsEvent, WS_QUALIFIER.OWN_GOAL),
    isPenalty: hasWhoScoredQualifier(wsEvent, WS_QUALIFIER.PENALTY),
    context: mapContext(optaEvent),
    goalMouthY: goalMouth.goalMouthY,
    goalMouthZ: goalMouth.goalMouthZ,
    provider: "whoscored",
    providerEventId: String(optaEvent.id),
    sourceMeta: {
      typeId: optaEvent.typeId,
      eventId: optaEvent.eventId,
      outcome: optaEvent.outcome,
      satisfiedEventsTypes: wsEvent.satisfiedEventsTypes,
    },
  };
}
