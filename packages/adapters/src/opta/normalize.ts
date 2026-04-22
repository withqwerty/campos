import type { MatchContext, Shot } from "@withqwerty/campos-schema";

import { clampToCamposRange } from "../shared/coordinates.js";
import { Q, readNumericQualifier, type OptaEvent } from "./qualifiers.js";
export { normalizeOptaClock as normalizeTime } from "./clock.js";

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

type PeriodDirection = {
  homeAttacksToward: "increasing-x" | "decreasing-x";
};

export type ContextWithPeriods = MatchContext & {
  /**
   * Set to `true` for Opta expected-goals feeds where coordinates are already
   * in attack-relative form: x=100 always means toward the goal the team is
   * currently attacking, for both teams in all periods. No x-axis flip is
   * applied; only the Opta y-axis inversion (100 - y) is performed.
   *
   * Opta expected-goals (EG) feeds use this encoding. Standard Opta F24
   * match-event feeds use absolute pitch coordinates and do NOT set this flag.
   */
  attackRelative?: boolean;
  periods: {
    firstHalf: PeriodDirection;
    secondHalf: PeriodDirection;
    extraTimeFirstHalf?: PeriodDirection;
    extraTimeSecondHalf?: PeriodDirection;
  };
};

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

export function assertMatchContext(
  matchContext: MatchContext,
): asserts matchContext is ContextWithPeriods {
  if (
    matchContext.matchId.trim().length === 0 ||
    matchContext.homeTeamId.trim().length === 0 ||
    matchContext.awayTeamId.trim().length === 0 ||
    !matchContext.periods?.firstHalf
  ) {
    throw new Error(
      "Opta shot normalization requires matchContext.matchId, homeTeamId, awayTeamId, and periods for firstHalf/secondHalf.",
    );
  }
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

export function normalizePeriod(periodId: number): Shot["period"] {
  if (
    periodId === 1 ||
    periodId === 2 ||
    periodId === 3 ||
    periodId === 4 ||
    periodId === 5
  ) {
    return periodId;
  }

  throw new Error(`Unsupported Opta periodId for shot normalization: ${periodId}`);
}

function periodDirectionKey(period: Shot["period"]): keyof ContextWithPeriods["periods"] {
  switch (period) {
    case 1:
      return "firstHalf";
    case 2:
      return "secondHalf";
    case 3:
      return "extraTimeFirstHalf";
    case 4:
      return "extraTimeSecondHalf";
    case 5:
      throw new Error(
        "Penalty shootout shots should be filtered before direction lookup.",
      );
  }
}

function attacksTowardIncreasingX(
  matchContext: ContextWithPeriods,
  shotTeamId: string,
  period: Shot["period"],
): boolean {
  const side = periodDirectionKey(period);
  const periodDirection = matchContext.periods[side];
  if (!periodDirection) {
    throw new Error(
      `Opta shot normalization requires periods.${side}.homeAttacksToward for extra-time shots in period ${period}.`,
    );
  }

  const homeDirection = periodDirection.homeAttacksToward;
  const shotByHomeTeam = shotTeamId === matchContext.homeTeamId;

  if (homeDirection === "increasing-x") {
    return shotByHomeTeam;
  }

  return !shotByHomeTeam;
}

// ---------------------------------------------------------------------------
// Coordinate normalization
// ---------------------------------------------------------------------------

export function normalizeCoordinates(
  event: OptaEvent,
  matchContext: ContextWithPeriods,
  period: Shot["period"],
): Pick<Shot, "x" | "y"> {
  // Attack-relative feeds (e.g. Opta EG) encode every event in the acting
  // team's attacker-perspective frame: x=100 is the goal being attacked,
  // y=0 is attacker's right. This matches the Campos canonical frame
  // directly — no adapter transformation is needed. The feed's own internal
  // 180° rotation for the "wrong direction" team already produces this.
  if (matchContext.attackRelative) {
    return {
      x: clampToCamposRange(event.x),
      y: clampToCamposRange(event.y),
    };
  }

  // Non-attack-relative feeds (e.g. Opta F24) use absolute pitch coordinates
  // with Opta's BOTTOM_LEFT origin + BOTTOM_TO_TOP y. To convert to the
  // canonical Campos attacker frame for a team attacking toward decreasing-x,
  // we rotate the coordinates 180° (flip both x and y). A team already
  // attacking toward increasing-x needs no transformation.
  const towardIncreasingX = attacksTowardIncreasingX(
    matchContext,
    event.contestantId,
    period,
  );
  return {
    x: clampToCamposRange(towardIncreasingX ? event.x : 100 - event.x),
    y: clampToCamposRange(towardIncreasingX ? event.y : 100 - event.y),
  };
}

/**
 * Opta uses qualifiers 140/141 (PASS_END_X / PASS_END_Y) for the ball position at the end
 * of a pass; the same qualifiers appear on shot events when the feed includes a freeze-frame
 * end location toward goal or wide.
 */
export function normalizeEndCoordinatesFromQualifiers(
  event: OptaEvent,
  matchContext: ContextWithPeriods,
  period: Shot["period"],
): { endX: number | null; endY: number | null } {
  const rawEndX = readNumericQualifier(event, Q.PASS_END_X);
  const rawEndY = readNumericQualifier(event, Q.PASS_END_Y);

  if (rawEndX == null || rawEndY == null) {
    return { endX: null, endY: null };
  }

  // Re-use normalizeCoordinates so attack-relative feeds are handled consistently.
  const syntheticEvent: OptaEvent = { ...event, x: rawEndX, y: rawEndY };
  const normalized = normalizeCoordinates(syntheticEvent, matchContext, period);

  return {
    endX: normalized.x,
    endY: normalized.y,
  };
}
