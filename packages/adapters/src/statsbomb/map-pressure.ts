import type { PressureEvent } from "@withqwerty/campos-schema";

import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

export function mapPressure(
  event: StatsBombEvent,
  matchInfo: StatsBombMatchInfo,
): PressureEvent {
  const period = normalizePeriod(event.period);
  const coordinates = normalizeCoordinates(event);
  const time = normalizeTime(event);

  const sourceMeta: Record<string, unknown> = {
    index: event.index,
    playPattern: event.play_pattern.name,
  };
  if (typeof event.duration === "number") sourceMeta.duration = event.duration;
  if (event.under_pressure === true) sourceMeta.underPressure = true;

  return {
    kind: "pressure" as const,
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
    counterpress: event.counterpress === true,
    provider: "statsbomb",
    providerEventId: event.id,
    sourceMeta,
  };
}
