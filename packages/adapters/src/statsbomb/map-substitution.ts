import type { SubstitutionEvent } from "@withqwerty/campos-schema";

import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { normalizePeriod, normalizeTime } from "./normalize.js";

// ---------------------------------------------------------------------------
// Substitution builder
// ---------------------------------------------------------------------------

export function mapSubstitution(
  event: StatsBombEvent,
  matchInfo: StatsBombMatchInfo,
): SubstitutionEvent {
  const period = normalizePeriod(event.period);
  const time = normalizeTime(event);

  const replacement = event.substitution?.replacement;

  return {
    kind: "substitution" as const,
    id: `${matchInfo.id}:${event.id}`,
    matchId: String(matchInfo.id),
    teamId: String(event.team.id),
    playerId: event.player ? String(event.player.id) : null,
    playerName: event.player?.name ?? null,
    minute: time.minute,
    addedMinute: time.addedMinute,
    second: time.second,
    period,
    x: null,
    y: null,
    playerInId: replacement ? String(replacement.id) : null,
    playerInName: replacement?.name ?? null,
    provider: "statsbomb",
    providerEventId: event.id,
    sourceMeta: {
      index: event.index,
      playPattern: event.play_pattern.name,
    },
  };
}
