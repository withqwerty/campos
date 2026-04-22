import { clampToCamposRange } from "../shared/coordinates.js";
import type {
  WyscoutEvent,
  WyscoutMatchData,
  WyscoutMatchInfo,
  WyscoutPosition,
} from "./parse.js";
import { normalizeWyscoutClock } from "./clock.js";

export function hasTag(event: WyscoutEvent, tagId: number): boolean {
  return event.tags.some((tag) => tag.id === tagId);
}

export function normalizePeriod(matchPeriod: string): 1 | 2 | 3 | 4 | 5 {
  switch (matchPeriod) {
    case "1H":
      return 1;
    case "2H":
      return 2;
    case "E1":
      return 3;
    case "E2":
      return 4;
    case "P":
      return 5;
    default:
      throw new Error(`Unsupported Wyscout matchPeriod normalization: ${matchPeriod}`);
  }
}

export function normalizePoint(
  position?: WyscoutPosition | null,
): { x: number; y: number } | null {
  if (position == null) {
    return null;
  }

  return {
    x: clampToCamposRange(position.x),
    y: clampToCamposRange(100 - position.y),
  };
}

export function baseEventFields(
  event: WyscoutEvent,
  matchId: string,
  position?: WyscoutPosition | null,
): {
  id: string;
  matchId: string;
  teamId: string;
  playerId: string | null;
  playerName: null;
  minute: number;
  addedMinute: null;
  second: number;
  period: 1 | 2 | 3 | 4 | 5;
  x: number | null;
  y: number | null;
  provider: "wyscout";
  providerEventId: string;
  sourceMeta: {
    eventId: number;
    eventName: string;
    subEventId: number;
    subEventName: string;
    tags: number[];
  };
} {
  const period = normalizePeriod(event.matchPeriod);
  const time = normalizeWyscoutClock(event.matchPeriod, event.eventSec);
  const point = normalizePoint(position ?? event.positions[0]);

  return {
    id: `${matchId}:${event.id}`,
    matchId,
    teamId: String(event.teamId),
    playerId: event.playerId != null ? String(event.playerId) : null,
    playerName: null,
    minute: time.minute,
    addedMinute: time.addedMinute,
    second: time.second,
    period,
    x: point?.x ?? null,
    y: point?.y ?? null,
    provider: "wyscout",
    providerEventId: String(event.id),
    sourceMeta: {
      eventId: event.eventId,
      eventName: event.eventName,
      subEventId: event.subEventId,
      subEventName: event.subEventName,
      tags: event.tags.map((tag) => tag.id),
    },
  };
}

export function resolveMatchId(
  matchData: WyscoutMatchData,
  matchInfo: WyscoutMatchInfo,
): string {
  return matchInfo.matchId ?? String(matchData.match.wyId);
}
