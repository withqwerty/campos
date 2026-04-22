import { Q, type OptaEvent, type OptaQualifier } from "../opta/qualifiers.js";
import type { WhoScoredMatchCentreTeam } from "./map-formation.js";

// ---------------------------------------------------------------------------
// WhoScored raw types (derived from matchCentreData JSON)
// ---------------------------------------------------------------------------

export type WhoScoredRef = {
  value: number;
  displayName: string;
};

export type WhoScoredQualifier = {
  type: WhoScoredRef;
  value?: string;
};

export type WhoScoredEvent = {
  id: number;
  eventId: number;
  minute: number;
  second: number;
  teamId: number | string;
  playerId?: number | string;
  playerName?: string;
  relatedEventId?: number;
  relatedPlayerId?: number;
  x: number;
  y: number;
  expandedMinute: number;
  period: WhoScoredRef;
  type: WhoScoredRef;
  outcomeType: WhoScoredRef;
  qualifiers: WhoScoredQualifier[];
  satisfiedEventsTypes?: number[];
  isTouch: boolean;
  isShot?: boolean;
  isGoal?: boolean;
  endX?: number | null;
  endY?: number | null;
  goalMouthY?: number;
  goalMouthZ?: number;
};

export type WhoScoredMatchData = {
  home: { teamId: number };
  away: { teamId: number };
  events: WhoScoredEvent[];
  playerIdNameDictionary: Record<string, string>;
};

export type WhoScoredMatchInfo = {
  matchId: string;
};

export type WhoScoredMatchCentreData = {
  home: WhoScoredMatchCentreTeam;
  away: WhoScoredMatchCentreTeam;
};

// ---------------------------------------------------------------------------
// Converter: WhoScored event → OptaEvent shape
// ---------------------------------------------------------------------------

/**
 * Convert a WhoScored event into an OptaEvent so we can reuse the Opta
 * qualifier-based mappers (mapBodyPart, mapContext, mapOutcome).
 *
 * The qualifier IDs are identical between WhoScored and Opta; only the
 * envelope differs.
 */
export function toOptaEvent(
  event: WhoScoredEvent,
  playerNames: Record<string, string>,
): OptaEvent {
  const qualifier: OptaQualifier[] = event.qualifiers.map((q) => ({
    qualifierId: q.type.value,
    value: q.value ?? null,
  }));

  const result: OptaEvent = {
    id: event.id,
    eventId: event.eventId,
    typeId: event.type.value,
    periodId: event.period.value,
    timeMin: event.expandedMinute,
    timeSec: event.second,
    contestantId: String(event.teamId),
    outcome: event.outcomeType.value,
    x: event.x,
    y: event.y,
    qualifier,
  };

  if (event.playerId != null) {
    result.playerId = String(event.playerId);
    const name = playerNames[String(event.playerId)];
    if (name != null) {
      result.playerName = name;
    }
  }

  return result;
}

/**
 * Convert WhoScored `matchCentreData.events` into the `OptaEvent[]` shape
 * that `fromOpta.events()` / `fromOpta.shots()` already consume.
 *
 * This bridges the structural gap so all downstream normalization is shared.
 */
export function parseWhoScored(events: readonly WhoScoredEvent[]): OptaEvent[] {
  return events.map((event) => ({
    id: event.id,
    eventId: event.eventId,
    typeId: event.type.value,
    periodId: event.period.value,
    timeMin: event.expandedMinute,
    timeSec: event.second,
    contestantId: String(event.teamId),
    ...(event.playerId != null ? { playerId: String(event.playerId) } : {}),
    ...(event.playerName != null ? { playerName: event.playerName } : {}),
    outcome: event.outcomeType.value,
    x: event.x,
    y: event.y,
    qualifier: [
      ...event.qualifiers.map(
        (q): OptaQualifier => ({
          qualifierId: q.type.value,
          value: q.value ?? null,
        }),
      ),
      ...(event.endX != null
        ? [{ qualifierId: Q.PASS_END_X, value: String(event.endX) }]
        : []),
      ...(event.endY != null
        ? [{ qualifierId: Q.PASS_END_Y, value: String(event.endY) }]
        : []),
    ],
  }));
}
