import type { RecoveryEvent } from "@withqwerty/campos-schema";

import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

export function mapRecovery(
  event: StatsBombEvent,
  matchInfo: StatsBombMatchInfo,
): RecoveryEvent {
  const period = normalizePeriod(event.period);
  const coordinates = normalizeCoordinates(event);
  const time = normalizeTime(event);

  const sourceMeta: Record<string, unknown> = {
    index: event.index,
    playPattern: event.play_pattern.name,
  };
  if (event.ball_recovery?.offensive === true) sourceMeta.offensive = true;
  if (event.ball_recovery?.recovery_failure === true) sourceMeta.recoveryFailure = true;

  return {
    kind: "recovery" as const,
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
    provider: "statsbomb",
    providerEventId: event.id,
    sourceMeta,
  };
}
