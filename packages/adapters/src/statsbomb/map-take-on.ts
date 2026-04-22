import type { TakeOnEvent } from "@withqwerty/campos-schema";

import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

function mapTakeOnResult(outcomeName: string): TakeOnEvent["takeOnResult"] {
  return outcomeName === "Complete" ? "complete" : "incomplete";
}

export function mapTakeOn(
  event: StatsBombEvent,
  matchInfo: StatsBombMatchInfo,
): TakeOnEvent {
  if (!event.dribble) {
    throw new Error(`mapTakeOn called on event ${event.id} without dribble data`);
  }
  const dribble = event.dribble;
  const period = normalizePeriod(event.period);
  const coordinates = normalizeCoordinates(event);
  const time = normalizeTime(event);

  const sourceMeta: Record<string, unknown> = {
    index: event.index,
    playPattern: event.play_pattern.name,
    outcome: dribble.outcome.name,
  };
  if (dribble.nutmeg === true) sourceMeta.nutmeg = true;
  if (dribble.overrun === true) sourceMeta.overrun = true;
  if (dribble.no_touch === true) sourceMeta.noTouch = true;

  return {
    kind: "take-on" as const,
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
    takeOnResult: mapTakeOnResult(dribble.outcome.name),
    provider: "statsbomb",
    providerEventId: event.id,
    sourceMeta,
  };
}
