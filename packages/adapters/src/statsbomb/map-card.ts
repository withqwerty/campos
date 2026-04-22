import type { CardEvent } from "@withqwerty/campos-schema";

import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { normalizePeriod, normalizeTime } from "./normalize.js";

// ---------------------------------------------------------------------------
// Card type classification
// ---------------------------------------------------------------------------

function mapCardType(cardName: string): CardEvent["cardType"] {
  switch (cardName) {
    case "Yellow Card":
      return "yellow";
    case "Second Yellow":
      return "second-yellow";
    case "Red Card":
      return "red";
    default:
      return "yellow";
  }
}

// ---------------------------------------------------------------------------
// Card builder
// ---------------------------------------------------------------------------

/**
 * Build a CardEvent from any StatsBomb event that carries a card reference.
 *
 * StatsBomb embeds cards on `foul_committed.card` (type.id 22) for in-play
 * bookings, and on `bad_behaviour.card` (type.id 24) for out-of-play
 * bookings. The caller is responsible for extracting the card name and
 * invoking this mapper.
 */
export function mapCard(
  event: StatsBombEvent,
  cardName: string,
  matchInfo: StatsBombMatchInfo,
): CardEvent {
  const period = normalizePeriod(event.period);
  const time = normalizeTime(event);

  return {
    kind: "card" as const,
    id: `${matchInfo.id}:${event.id}:card`,
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
    cardType: mapCardType(cardName),
    provider: "statsbomb",
    providerEventId: event.id,
    sourceMeta: {
      index: event.index,
      cardName,
      playPattern: event.play_pattern.name,
    },
  };
}
