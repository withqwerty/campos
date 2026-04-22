import type { GoalkeeperEvent } from "@withqwerty/campos-schema";

import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

// ---------------------------------------------------------------------------
// Action type classification
// ---------------------------------------------------------------------------

function mapActionType(typeName: string): GoalkeeperEvent["actionType"] {
  switch (typeName) {
    case "Shot Saved":
    case "Shot Saved Off Target":
    case "Shot Saved to Post":
    case "Save":
      return "save";
    case "Collected":
    case "Keeper Claim":
      return "claim";
    case "Punch":
      return "punch";
    case "Keeper Pick Up":
      return "keeper-pick-up";
    default:
      return "save";
  }
}

// ---------------------------------------------------------------------------
// Goalkeeper builder
// ---------------------------------------------------------------------------

export function mapGoalkeeper(
  event: StatsBombEvent,
  matchInfo: StatsBombMatchInfo,
): GoalkeeperEvent {
  const period = normalizePeriod(event.period);
  const coordinates = normalizeCoordinates(event);
  const time = normalizeTime(event);

  const typeName = event.goalkeeper?.type.name ?? "";

  return {
    kind: "goalkeeper" as const,
    id: `${matchInfo.id}:${event.id}`,
    matchId: String(matchInfo.id),
    teamId: String(event.team.id),
    playerId: event.player ? String(event.player.id) : null,
    playerName: event.player?.name ?? null,
    minute: time.minute,
    addedMinute: time.addedMinute,
    second: time.second,
    period,
    x: coordinates.x,
    y: coordinates.y,
    actionType: mapActionType(typeName),
    provider: "statsbomb",
    providerEventId: event.id,
    sourceMeta: {
      index: event.index,
      goalkeeperType: typeName,
      playPattern: event.play_pattern.name,
    },
  };
}
