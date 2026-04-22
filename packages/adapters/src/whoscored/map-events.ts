import type {
  Event,
  CardEvent,
  ClearanceEvent,
  DuelEvent,
  FoulCommittedEvent,
  GoalkeeperEvent,
  InterceptionEvent,
  PassEvent,
  RecoveryEvent,
  SubstitutionEvent,
  TackleEvent,
  TakeOnEvent,
} from "@withqwerty/campos-schema";

import { clampToCamposRange } from "../shared/coordinates.js";
import { computePassLengthAndAngle } from "../shared/pass-geometry.js";
import {
  hasQualifier,
  Q,
  readNumericQualifier,
  type OptaEvent,
} from "../opta/qualifiers.js";
import { mapPassType } from "../opta/map-pass.js";
import type { WhoScoredEvent } from "./parse.js";
import { mapShot, normalizeCoordinates } from "./map-shot.js";
import { validatePeriod } from "../shared/normalize.js";
import { WS_SHOT_TYPE_IDS } from "./constants.js";
import { normalizeWhoScoredClock } from "./clock.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type BaseFields = {
  id: string;
  matchId: string;
  teamId: string;
  playerId: string | null;
  playerName: string | null;
  minute: number;
  addedMinute: number | null;
  second: number;
  period: 1 | 2 | 3 | 4 | 5;
  x: number | null;
  y: number | null;
  provider: "whoscored";
  providerEventId: string;
  sourceMeta: Record<string, unknown>;
};

function base(
  optaEvent: OptaEvent,
  matchId: string,
  opts?: { skipCoords?: boolean },
): BaseFields {
  const period = validatePeriod(optaEvent.periodId, "WhoScored");
  const time = normalizeWhoScoredClock(optaEvent);
  const coords = opts?.skipCoords
    ? { x: null, y: null }
    : normalizeCoordinates(optaEvent);

  return {
    id: `${matchId}:${optaEvent.id}`,
    matchId,
    teamId: optaEvent.contestantId,
    playerId: optaEvent.playerId ?? null,
    playerName: optaEvent.playerName ?? null,
    minute: time.minute,
    addedMinute: time.addedMinute,
    second: time.second,
    period,
    x: coords.x,
    y: coords.y,
    provider: "whoscored",
    providerEventId: String(optaEvent.id),
    sourceMeta: {
      typeId: optaEvent.typeId,
      eventId: optaEvent.eventId,
      outcome: optaEvent.outcome,
    },
  };
}

// ---------------------------------------------------------------------------
// Per-kind mappers
// ---------------------------------------------------------------------------

function mapPass(e: OptaEvent, matchId: string): PassEvent {
  const b = base(e, matchId);

  const rawEndX = readNumericQualifier(e, Q.PASS_END_X);
  const rawEndY = readNumericQualifier(e, Q.PASS_END_Y);
  let endX: number | null = null;
  let endY: number | null = null;
  if (rawEndX != null && rawEndY != null) {
    endX = clampToCamposRange(rawEndX);
    endY = clampToCamposRange(100 - rawEndY);
  }

  const { length, angle } = computePassLengthAndAngle(b.x, b.y, endX, endY);

  return {
    kind: "pass",
    ...b,
    endX,
    endY,
    length,
    angle,
    recipient: null,
    passResult: e.outcome === 1 ? "complete" : "incomplete",
    passType: mapPassType(e),
    isAssist: hasQualifier(e, Q.ASSIST),
  };
}

function mapCard(e: OptaEvent, matchId: string): CardEvent {
  const b = base(e, matchId, { skipCoords: true });
  const cardType: CardEvent["cardType"] =
    e.typeId === 65 ? "second-yellow" : e.typeId === 68 ? "red" : "yellow";

  return { kind: "card", ...b, cardType };
}

function mapTackle(e: OptaEvent, matchId: string): TackleEvent {
  const b = base(e, matchId);
  return { kind: "tackle", ...b, tackleOutcome: e.outcome === 1 ? "won" : "lost" };
}

function mapFoul(e: OptaEvent, matchId: string): FoulCommittedEvent {
  return { kind: "foul-committed", ...base(e, matchId) };
}

function mapInterception(e: OptaEvent, matchId: string): InterceptionEvent {
  return { kind: "interception", ...base(e, matchId) };
}

function mapClearance(e: OptaEvent, matchId: string): ClearanceEvent {
  return { kind: "clearance", ...base(e, matchId) };
}

function mapDuel(e: OptaEvent, matchId: string): DuelEvent {
  const b = base(e, matchId);
  return {
    kind: "duel",
    ...b,
    duelType: e.typeId === 44 ? "aerial" : "ground",
    duelOutcome: e.outcome === 1 ? "won" : "lost",
  };
}

function mapGoalkeeper(e: OptaEvent, matchId: string): GoalkeeperEvent {
  const b = base(e, matchId);
  let actionType: GoalkeeperEvent["actionType"];
  // WhoScored goalkeeper typeIds differ from Opta:
  //   10 = Save, 11 = Claim, 41 = Punch, 52 = KeeperPickup, 59 = KeeperSweeper
  switch (e.typeId) {
    case 11:
      actionType = "claim";
      break;
    case 41:
      actionType = "punch";
      break;
    case 52:
    case 59:
      actionType = "keeper-pick-up";
      break;
    default:
      actionType = "save";
  }
  return { kind: "goalkeeper", ...b, actionType };
}

function mapSubstitution(
  e: OptaEvent,
  wsEvent: WhoScoredEvent,
  matchId: string,
): SubstitutionEvent {
  const b = base(e, matchId, { skipCoords: true });
  // Type 18 (SubstitutionOff): relatedPlayerId = incoming player.
  // Type 19 (SubstitutionOn): relatedPlayerId = outgoing player — not playerIn.
  const playerInId =
    wsEvent.type.value === 18 && wsEvent.relatedPlayerId != null
      ? String(wsEvent.relatedPlayerId)
      : null;
  return {
    kind: "substitution",
    ...b,
    playerInId,
    playerInName: null,
  };
}

function mapTakeOn(e: OptaEvent, matchId: string): TakeOnEvent {
  const b = base(e, matchId);
  return {
    kind: "take-on",
    ...b,
    takeOnResult: e.outcome === 1 ? "complete" : "incomplete",
  };
}

function mapRecovery(e: OptaEvent, matchId: string): RecoveryEvent {
  return { kind: "recovery", ...base(e, matchId) };
}

// ---------------------------------------------------------------------------
// WhoScored type-ID constants
//
// IMPORTANT: WhoScored type IDs diverge from Opta for several event kinds.
// Do NOT import Opta constants here — use the WhoScored-specific values.
//
//   Event          WhoScored   Opta
//   Tackle         7           4 (outcome=1)
//   Foul           4           4 (outcome=0)
//   Interception   8           74
//   BlockedPass    74          (no direct equivalent)
//
// Shots (13,15,16), Pass (1), Card (17), Goalkeeper (10,11,41,52),
// Clearance (12), Aerial (44), Substitution (18,19) match Opta.
// ---------------------------------------------------------------------------

const WS_PASS_TYPE_ID = 1;
const WS_TACKLE_TYPE_ID = 7;
const WS_FOUL_TYPE_ID = 4;
const WS_CARD_TYPE_ID = 17;
const WS_INTERCEPTION_TYPE_ID = 8;
const WS_CLEARANCE_TYPE_ID = 12;
const WS_AERIAL_TYPE_ID = 44;
const WS_GOALKEEPER_TYPE_IDS = new Set([10, 11, 41, 52, 54, 59]);
const WS_SUBSTITUTION_TYPE_IDS = new Set([18, 19]);
const WS_TAKE_ON_TYPE_ID = 3;
const WS_RECOVERY_TYPE_ID = 49;

// ---------------------------------------------------------------------------
// Event router
// ---------------------------------------------------------------------------

export function mapEvent(
  optaEvent: OptaEvent,
  wsEvent: WhoScoredEvent,
  matchId: string,
): Event | null {
  const typeId = optaEvent.typeId;

  // Cards and substitutions don't require coordinates
  if (typeId === WS_CARD_TYPE_ID) {
    return mapCard(optaEvent, matchId);
  }
  if (WS_SUBSTITUTION_TYPE_IDS.has(typeId)) {
    return mapSubstitution(optaEvent, wsEvent, matchId);
  }

  // All remaining event kinds require valid coordinates
  if (typeof optaEvent.x !== "number" || typeof optaEvent.y !== "number") {
    return null;
  }

  if (WS_SHOT_TYPE_IDS.has(typeId)) {
    return mapShot(optaEvent, wsEvent, matchId);
  }
  if (typeId === WS_PASS_TYPE_ID) {
    return mapPass(optaEvent, matchId);
  }
  if (typeId === WS_TACKLE_TYPE_ID) {
    return mapTackle(optaEvent, matchId);
  }
  if (typeId === WS_FOUL_TYPE_ID) {
    return mapFoul(optaEvent, matchId);
  }
  if (typeId === WS_INTERCEPTION_TYPE_ID) {
    return mapInterception(optaEvent, matchId);
  }
  if (typeId === WS_CLEARANCE_TYPE_ID) {
    return mapClearance(optaEvent, matchId);
  }
  if (typeId === WS_AERIAL_TYPE_ID) {
    return mapDuel(optaEvent, matchId);
  }
  if (WS_GOALKEEPER_TYPE_IDS.has(typeId)) {
    return mapGoalkeeper(optaEvent, matchId);
  }
  if (typeId === WS_TAKE_ON_TYPE_ID) {
    return mapTakeOn(optaEvent, matchId);
  }
  if (typeId === WS_RECOVERY_TYPE_ID) {
    return mapRecovery(optaEvent, matchId);
  }

  return null;
}
