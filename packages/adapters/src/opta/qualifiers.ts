// ---------------------------------------------------------------------------
// Opta raw event types
// ---------------------------------------------------------------------------

export type OptaQualifier = {
  qualifierId: number;
  value?: string | null;
};

export type OptaEvent = {
  id: number;
  eventId: number;
  typeId: number;
  periodId: number;
  timeMin: number;
  timeSec: number;
  contestantId: string;
  playerId?: string;
  playerName?: string;
  outcome: number;
  x: number;
  y: number;
  qualifier?: OptaQualifier[];
};

// ---------------------------------------------------------------------------
// Qualifier ID constants (verified against Opta F24 spec)
// ---------------------------------------------------------------------------

export const Q = {
  HEAD: 15,
  LEFT_FOOT: 72,
  RIGHT_FOOT: 20,
  PENALTY: 9,
  FROM_CORNER: 25,
  DIRECT_FREE_KICK: 26,
  SET_PIECE: 24,
  FAST_BREAK: 23,
  OWN_GOAL: 28,
  DISALLOWED: 8,
  BLOCKED: 82,
  XG: 213,
  XG_EG: 321, // xG in Opta expected-goals feed (F24 EG variant)
  XGOT: 322,
  GOAL_MOUTH_Y: 102,
  GOAL_MOUTH_Z: 103,

  // Pass qualifiers (verified via football-docs)
  LONG_BALL: 1,
  CROSS: 2,
  THROUGH_BALL: 4,
  FREE_KICK_TAKEN: 5,
  CORNER_TAKEN: 6,
  GOAL_KICK: 7,
  THROW_IN: 107,
  KICK_OFF: 279,
  ASSIST: 210,
  PASS_END_X: 140,
  PASS_END_Y: 141,
} as const;

/** Opta typeIds that represent shot events. */
export const SHOT_TYPE_IDS = new Set([13, 14, 15, 16]);

/** Opta typeId for pass events. */
export const PASS_TYPE_ID = 1;

/**
 * Opta typeId for tackle/foul events.
 *
 * TypeId 4 is shared: outcome=1 → tackle, outcome=0 → foul-committed.
 */
export const TACKLE_FOUL_TYPE_ID = 4;

/** Opta typeIds for card events. */
export const CARD_TYPE_IDS = new Set([17, 65, 68]);

/** Opta typeId for interception events. */
export const INTERCEPTION_TYPE_ID = 74;

/** Opta typeId for clearance events. */
export const CLEARANCE_TYPE_ID = 12;

/** Opta typeId for aerial duel events. */
export const AERIAL_TYPE_ID = 44;

/** Opta typeIds for goalkeeper events. */
export const GOALKEEPER_TYPE_IDS = new Set([10, 11, 41, 52, 53, 54, 58, 59]);

/** Opta typeIds for substitution events (player off / player on). */
export const SUBSTITUTION_TYPE_IDS = new Set([18, 19]);

/** Opta typeId for take-on (dribble) events. */
export const TAKE_ON_TYPE_ID = 3;

/** Opta typeId for ball recovery events. */
export const RECOVERY_TYPE_ID = 49;

// ---------------------------------------------------------------------------
// Qualifier helpers
// ---------------------------------------------------------------------------

export function hasQualifier(event: OptaEvent, qualifierId: number): boolean {
  return (event.qualifier ?? []).some(
    (qualifier) => qualifier.qualifierId === qualifierId,
  );
}

export function readNumericQualifier(
  event: OptaEvent,
  qualifierId: number,
): number | null {
  const match = (event.qualifier ?? []).find(
    (qualifier) => qualifier.qualifierId === qualifierId && qualifier.value != null,
  );
  if (match?.value == null) {
    return null;
  }

  const value = Number(match.value);
  return Number.isFinite(value) ? value : null;
}

export function readStringQualifier(
  event: OptaEvent,
  qualifierId: number,
): string | null {
  const match = (event.qualifier ?? []).find(
    (qualifier) => qualifier.qualifierId === qualifierId && qualifier.value != null,
  );
  return match?.value ?? null;
}
