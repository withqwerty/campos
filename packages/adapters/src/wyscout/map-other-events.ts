import type {
  CardEvent,
  ClearanceEvent,
  DuelEvent,
  FoulCommittedEvent,
  GoalkeeperEvent,
  InterceptionEvent,
  RecoveryEvent,
  TakeOnEvent,
} from "@withqwerty/campos-schema";

import { baseEventFields, hasTag } from "./common.js";
import type { WyscoutEvent } from "./parse.js";

const TAG = {
  WON: 703,
  LOST: 701,
  YELLOW_CARD: 1702,
  RED_CARD: 1701,
  SECOND_YELLOW: 1703,
} as const;

export function mapFoul(event: WyscoutEvent, matchId: string): FoulCommittedEvent {
  return {
    kind: "foul-committed",
    ...baseEventFields(event, matchId),
  };
}

export function mapCard(event: WyscoutEvent, matchId: string): CardEvent | null {
  let cardType: CardEvent["cardType"] | null = null;
  if (hasTag(event, TAG.RED_CARD)) {
    cardType = "red";
  } else if (hasTag(event, TAG.SECOND_YELLOW)) {
    cardType = "second-yellow";
  } else if (hasTag(event, TAG.YELLOW_CARD)) {
    cardType = "yellow";
  }

  if (cardType == null) {
    return null;
  }

  return {
    kind: "card",
    ...baseEventFields(event, matchId),
    // A single raw foul can legitimately emit both a foul event and a card.
    // Prefix the canonical id so both can coexist without colliding.
    id: `${matchId}:card-${event.id}`,
    x: null,
    y: null,
    cardType,
  };
}

export function mapDuel(event: WyscoutEvent, matchId: string): DuelEvent {
  const duelType: DuelEvent["duelType"] = event.subEventId === 10 ? "aerial" : "ground";
  const duelOutcome: DuelEvent["duelOutcome"] = hasTag(event, TAG.WON) ? "won" : "lost";

  return {
    kind: "duel",
    ...baseEventFields(event, matchId),
    duelType,
    duelOutcome,
  };
}

export function mapClearance(event: WyscoutEvent, matchId: string): ClearanceEvent {
  return {
    kind: "clearance",
    ...baseEventFields(event, matchId),
  };
}

export function mapInterception(event: WyscoutEvent, matchId: string): InterceptionEvent {
  return {
    kind: "interception",
    ...baseEventFields(event, matchId),
    // Some raw events emit both a primary action and an interception view of
    // the same underlying id, so keep interception ids namespaced.
    id: `${matchId}:interception-${event.id}`,
  };
}

export function mapTakeOn(event: WyscoutEvent, matchId: string): TakeOnEvent {
  return {
    kind: "take-on",
    ...baseEventFields(event, matchId),
    takeOnResult: hasTag(event, TAG.WON) ? "complete" : "incomplete",
  };
}

export function mapRecovery(event: WyscoutEvent, matchId: string): RecoveryEvent {
  return {
    kind: "recovery",
    ...baseEventFields(event, matchId),
  };
}

export function mapGoalkeeper(event: WyscoutEvent, matchId: string): GoalkeeperEvent {
  const base =
    event.positions[1] != null
      ? baseEventFields(event, matchId, {
          x: 100 - event.positions[1].x,
          y: 100 - event.positions[1].y,
        })
      : baseEventFields(event, matchId);

  return {
    kind: "goalkeeper",
    ...base,
    // Wyscout's save family ("Reflexes", "Save attempt") is the only
    // goalkeeper seam we currently route. "Goalkeeper leaving line" stays
    // out of the shipped surface until there is an honest canonical mapping.
    actionType: "save",
  };
}
