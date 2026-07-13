import type { MatchContext } from "@withqwerty/campos-schema";

import type { ContextWithPeriods } from "../opta/normalize.js";
import { clampToCamposRange } from "../shared/coordinates.js";
import { validatePeriod } from "../shared/normalize.js";

import type { SportecEvent, SportecMeta, SportecTeamPlayer } from "./types.js";

export function buildSportecMatchContext(
  meta: SportecMeta,
  events: readonly SportecEvent[],
): MatchContext {
  const directions = new Map<number, "increasing-x" | "decreasing-x">();

  for (const event of events) {
    if (event.kind !== "KickOff" || !event.gameSection) continue;
    const period = sportecGameSectionToPeriod(event.gameSection);
    if (!period) continue;

    if (event.teamLeft && event.teamRight) {
      directions.set(
        period,
        sportecLeftRightToHomeDirection(meta, event.teamLeft, event.teamRight),
      );
      continue;
    }

    const previous = directions.get(period - 1);
    if (previous) directions.set(period, invertDirection(previous));
  }

  const firstHalf = directions.get(1);
  const secondHalf =
    directions.get(2) ?? (firstHalf ? invertDirection(firstHalf) : undefined);
  if (!firstHalf || !secondHalf) {
    throw new Error(
      `Sportec match context for ${meta.matchId} requires kickoff direction for the first two periods. Provide a KickOff event for firstHalf and secondHalf with TeamLeft/TeamRight attributes, or pass a pre-built MatchContext.`,
    );
  }

  const extraTimeFirstHalf = directions.get(3);
  const extraTimeSecondHalf = directions.get(4);
  return {
    matchId: meta.matchId,
    homeTeamId: meta.homeTeamId,
    awayTeamId: meta.awayTeamId,
    pitchDimensions: meta.pitchDimensions,
    periods: {
      firstHalf: { homeAttacksToward: firstHalf },
      secondHalf: { homeAttacksToward: secondHalf },
      ...(extraTimeFirstHalf
        ? { extraTimeFirstHalf: { homeAttacksToward: extraTimeFirstHalf } }
        : {}),
      ...(extraTimeSecondHalf
        ? { extraTimeSecondHalf: { homeAttacksToward: extraTimeSecondHalf } }
        : {}),
    },
  };
}

export function normalizeSportecCoordinates(
  matchContext: MatchContext,
  teamId: string,
  period: number,
  x: number,
  y: number,
): { x: number; y: number } | null {
  const normalizedPeriod = validatePeriod(period, "Sportec");
  if (normalizedPeriod === 5) return null;

  if (
    !matchContext.pitchDimensions ||
    !matchContext.periods ||
    !matchContext.homeTeamId ||
    !matchContext.awayTeamId
  ) {
    throw new Error(
      "Sportec coordinate normalization requires pitchDimensions and period directions in matchContext.",
    );
  }

  const homeDirection =
    normalizedPeriod === 1
      ? matchContext.periods.firstHalf.homeAttacksToward
      : normalizedPeriod === 2
        ? matchContext.periods.secondHalf.homeAttacksToward
        : normalizedPeriod === 3
          ? matchContext.periods.extraTimeFirstHalf?.homeAttacksToward
          : matchContext.periods.extraTimeSecondHalf?.homeAttacksToward;
  if (!homeDirection) {
    throw new Error(`Sportec period ${normalizedPeriod} is missing direction metadata.`);
  }

  return sportecToCampos(
    x,
    y,
    matchContext.pitchDimensions.length,
    matchContext.pitchDimensions.width,
    teamId === matchContext.homeTeamId
      ? homeDirection === "increasing-x"
      : homeDirection === "decreasing-x",
  );
}

export function sportecToCampos(
  x: number,
  y: number,
  pitchLength: number,
  pitchWidth: number,
  attacksTowardIncreasingX: boolean,
): { x: number; y: number } {
  const normalizedX = clampToCamposRange((x / pitchLength) * 100);
  const normalizedY = clampToCamposRange((y / pitchWidth) * 100);
  return attacksTowardIncreasingX
    ? { x: normalizedX, y: normalizedY }
    : {
        x: clampToCamposRange(100 - normalizedX),
        y: clampToCamposRange(100 - normalizedY),
      };
}

export function buildSportecAttackRelativeContext(meta: SportecMeta): ContextWithPeriods {
  return {
    matchId: meta.matchId,
    homeTeamId: meta.homeTeamId,
    awayTeamId: meta.awayTeamId,
    attackRelative: true,
    periods: {
      firstHalf: { homeAttacksToward: "increasing-x" },
      secondHalf: { homeAttacksToward: "increasing-x" },
      extraTimeFirstHalf: { homeAttacksToward: "increasing-x" },
      extraTimeSecondHalf: { homeAttacksToward: "increasing-x" },
    },
  };
}

export function buildSportecPlayerIndex(
  meta: SportecMeta,
): Map<string, SportecTeamPlayer & { teamId: string }> {
  const index = new Map<string, SportecTeamPlayer & { teamId: string }>();
  for (const team of meta.teams) {
    for (const player of team.players)
      index.set(player.playerId, { ...player, teamId: team.teamId });
  }
  return index;
}

export function sportecGameSectionToPeriod(section: string): 1 | 2 | 3 | 4 | 5 | null {
  switch (section) {
    case "firstHalf":
      return 1;
    case "secondHalf":
      return 2;
    case "firstHalfExtra":
    case "extraFirstHalf":
    case "firstExtraHalf":
      return 3;
    case "secondHalfExtra":
    case "extraSecondHalf":
    case "secondExtraHalf":
      return 4;
    case "penaltyShootout":
    case "penaltyShootOut":
    case "shootout":
      return 5;
    default:
      return null;
  }
}

function sportecLeftRightToHomeDirection(
  meta: SportecMeta,
  teamLeft: string,
  teamRight: string,
): "increasing-x" | "decreasing-x" {
  if (teamLeft === meta.homeTeamId) return "increasing-x";
  if (teamRight === meta.homeTeamId) return "decreasing-x";
  throw new Error("Sportec kickoff direction does not reference the home team.");
}

function invertDirection(
  direction: "increasing-x" | "decreasing-x",
): "increasing-x" | "decreasing-x" {
  return direction === "increasing-x" ? "decreasing-x" : "increasing-x";
}
