import type { MatchLineups, TeamSheet, TeamSheetPlayer } from "@withqwerty/campos-schema";
import {
  getFormationPositions,
  getMplSlotForOptaSlot,
  parseFormationKey,
} from "@withqwerty/campos-schema";

import type { ContextWithPeriods } from "../opta/normalize.js";
import {
  CARD_TYPE_IDS,
  SUBSTITUTION_TYPE_IDS,
  type OptaEvent,
} from "../opta/qualifiers.js";
import { STARTER_COUNT } from "../shared/constants.js";
import { validatePeriod } from "../shared/normalize.js";

export type StatsPerformContestant = {
  id: string;
  name: string;
  position: string;
};

export type StatsPerformMatchInfo = {
  id: string;
  contestant: readonly StatsPerformContestant[];
};

export type StatsPerformQualifier = {
  qualifierId: number;
  id?: number;
  value?: string | null;
};

export type StatsPerformEvent = {
  id?: number;
  eventId?: number;
  typeId: number;
  periodId: number;
  timeMin?: number;
  timeSec?: number;
  contestantId?: string | null;
  playerId?: string | null;
  playerName?: string | null;
  outcome?: number | null;
  x?: number | null;
  y?: number | null;
  qualifier?: readonly StatsPerformQualifier[] | null;
};

export type StatsPerformMa3LineupPair = {
  home: StatsPerformEvent;
  away: StatsPerformEvent;
};

export type StatsPerformMa1Player = {
  playerId: string;
  firstName?: string | null;
  lastName?: string | null;
  knownName?: string | null;
  matchName?: string | null;
  shirtNumber?: number | null;
  position: string;
  subPosition?: string | null;
  formationPlace?: string | null;
  captain?: string | null;
};

export type StatsPerformMa1Lineup = {
  contestantId: string;
  formationUsed: string;
  player: readonly StatsPerformMa1Player[];
};

export type StatsPerformSubstitution = {
  contestantId: string;
  timeMin: number;
  playerOnId: string;
  playerOffId: string;
};

export function buildStatsPerformMatchContext(
  matchInfo: StatsPerformMatchInfo,
  events: readonly StatsPerformEvent[],
): ContextWithPeriods {
  const teams = buildStatsPerformTeamIndex(matchInfo);
  const homeDirectionByPeriod = new Map<number, "increasing-x" | "decreasing-x">();

  for (const event of events) {
    if (event.typeId !== 32 || !event.contestantId) continue;

    const period = validatePeriod(event.periodId, "Stats Perform");
    if (period === 5) continue;

    const direction = findStatsPerformQualifierValue(event, 127);
    if (direction == null) continue;

    if (event.contestantId === teams.home.id) {
      homeDirectionByPeriod.set(period, directionToOrientation(direction));
      continue;
    }

    if (event.contestantId === teams.away.id) {
      homeDirectionByPeriod.set(
        period,
        invertOrientation(directionToOrientation(direction)),
      );
    }
  }

  const firstHalf = homeDirectionByPeriod.get(1);
  const secondHalf = homeDirectionByPeriod.get(2);

  if (!firstHalf || !secondHalf) {
    throw new Error(
      "Stats Perform match context requires direction events for both first and second halves.",
    );
  }

  const extraTimeFirstHalf = homeDirectionByPeriod.get(3);
  const extraTimeSecondHalf = homeDirectionByPeriod.get(4);

  return {
    matchId: matchInfo.id,
    homeTeamId: teams.home.id,
    awayTeamId: teams.away.id,
    periods: {
      firstHalf: { homeAttacksToward: firstHalf },
      secondHalf: { homeAttacksToward: secondHalf },
      ...(extraTimeFirstHalf
        ? {
            extraTimeFirstHalf: {
              homeAttacksToward: extraTimeFirstHalf,
            },
          }
        : {}),
      ...(extraTimeSecondHalf
        ? {
            extraTimeSecondHalf: {
              homeAttacksToward: extraTimeSecondHalf,
            },
          }
        : {}),
    },
  };
}

export function mapStatsPerformMa1MatchLineups(
  matchInfo: StatsPerformMatchInfo,
  lineUps: readonly StatsPerformMa1Lineup[],
  substitutions: readonly StatsPerformSubstitution[] = [],
): MatchLineups {
  const teams = buildStatsPerformTeamIndex(matchInfo);
  const homeLineup = lineUps.find((lineup) => lineup.contestantId === teams.home.id);
  const awayLineup = lineUps.find((lineup) => lineup.contestantId === teams.away.id);

  if (!homeLineup || !awayLineup) {
    throw new Error("Stats Perform MA1 lineups require both home and away team entries.");
  }

  return {
    matchId: matchInfo.id,
    home: mapStatsPerformMa1TeamSheet(teams.home, homeLineup, substitutions),
    away: mapStatsPerformMa1TeamSheet(teams.away, awayLineup, substitutions),
  };
}

export function findStatsPerformMa3LineupEvents(
  matchInfo: StatsPerformMatchInfo,
  events: readonly StatsPerformEvent[],
): StatsPerformMa3LineupPair {
  const teams = buildStatsPerformTeamIndex(matchInfo);
  const home = events.find(
    (event) => event.typeId === 34 && event.contestantId === teams.home.id,
  );
  const away = events.find(
    (event) => event.typeId === 34 && event.contestantId === teams.away.id,
  );

  if (!home || !away) {
    throw new Error(
      "Stats Perform MA3 events require one lineup seed event for each team.",
    );
  }

  return { home, away };
}

export function statsPerformQualifierMap(
  event: StatsPerformEvent,
): Map<number, string | undefined> {
  const result = new Map<number, string | undefined>();
  for (const qualifier of event.qualifier ?? []) {
    const value = qualifier.value?.trim();
    result.set(qualifier.qualifierId, value && value.length > 0 ? value : undefined);
  }
  return result;
}

export function findStatsPerformQualifierValue(
  event: StatsPerformEvent,
  qualifierId: number,
): string | undefined {
  return statsPerformQualifierMap(event).get(qualifierId);
}

export function buildStatsPerformTeamIndex(matchInfo: StatsPerformMatchInfo): {
  home: StatsPerformContestant;
  away: StatsPerformContestant;
} {
  const home = matchInfo.contestant.find((team) => team.position === "home");
  const away = matchInfo.contestant.find((team) => team.position === "away");

  if (!home || !away) {
    throw new Error("Stats Perform match info requires both home and away contestants.");
  }

  return { home, away };
}

export function toStatsPerformOptaEvents(
  events: readonly StatsPerformEvent[],
): OptaEvent[] {
  return events.flatMap((event) => {
    if (!event.contestantId) return [];
    if (typeof event.timeMin !== "number" || typeof event.timeSec !== "number") {
      return [];
    }

    const requiresCoordinates =
      !CARD_TYPE_IDS.has(event.typeId) && !SUBSTITUTION_TYPE_IDS.has(event.typeId);
    if (
      requiresCoordinates &&
      (typeof event.x !== "number" || typeof event.y !== "number")
    ) {
      return [];
    }

    const providerEventId = event.id ?? event.eventId;
    if (typeof providerEventId !== "number" || typeof event.eventId !== "number") {
      return [];
    }

    const optaEvent: OptaEvent = {
      id: providerEventId,
      eventId: event.eventId,
      typeId: event.typeId,
      periodId: event.periodId,
      timeMin: event.timeMin,
      timeSec: event.timeSec,
      contestantId: event.contestantId,
      outcome: event.outcome ?? 0,
      x: typeof event.x === "number" ? event.x : 0,
      y: typeof event.y === "number" ? event.y : 0,
    };

    if (event.playerId) {
      optaEvent.playerId = event.playerId;
    }
    if (event.playerName) {
      optaEvent.playerName = event.playerName;
    }

    const qualifiers =
      event.qualifier?.map((qualifier) => ({
        qualifierId: qualifier.qualifierId,
        ...(qualifier.value != null ? { value: qualifier.value } : {}),
      })) ?? [];
    if (qualifiers.length > 0) {
      optaEvent.qualifier = qualifiers;
    }

    return [optaEvent];
  });
}

function mapStatsPerformMa1TeamSheet(
  team: StatsPerformContestant,
  lineup: StatsPerformMa1Lineup,
  substitutions: readonly StatsPerformSubstitution[],
): TeamSheet {
  const formation = parseFormationKey(lineup.formationUsed);
  const positions = getFormationPositions(formation);
  const positionBySlot = new Map(
    positions.map((position) => [position.slot, position] as const),
  );
  const starters: TeamSheetPlayer[] = [];
  const bench: TeamSheetPlayer[] = [];
  const playerById = new Map<string, TeamSheetPlayer>();
  let captainPlayerId: string | undefined;

  for (const rawPlayer of lineup.player) {
    const playerId = rawPlayer.playerId;
    const isStarter = rawPlayer.position !== "Substitute";
    const player = createStatsPerformTeamSheetPlayer(
      rawPlayer,
      formation,
      positionBySlot,
    );

    if (rawPlayer.captain === "yes") {
      player.captain = true;
      captainPlayerId = playerId;
    }

    if (isStarter) {
      starters.push(player);
    } else {
      bench.push(player);
    }
    playerById.set(playerId, player);
  }

  if (starters.length !== STARTER_COUNT) {
    throw new Error(
      `Stats Perform MA1 lineup for ${team.id} expected ${STARTER_COUNT} starters, got ${starters.length}.`,
    );
  }

  for (const substitution of substitutions) {
    if (substitution.contestantId !== team.id) continue;

    const outgoing = playerById.get(substitution.playerOffId);
    if (outgoing) {
      outgoing.substitutedOut = true;
      outgoing.minuteOff ??= substitution.timeMin;
    }

    const incoming = playerById.get(substitution.playerOnId);
    if (incoming) {
      incoming.substitutedIn = true;
      incoming.minuteOn ??= substitution.timeMin;
    }
  }

  return {
    teamId: team.id,
    teamLabel: team.name,
    formation,
    ...(captainPlayerId ? { captainPlayerId } : {}),
    starters,
    bench,
  };
}

function createStatsPerformTeamSheetPlayer(
  rawPlayer: StatsPerformMa1Player,
  formation: string,
  positionBySlot: Map<number, { slot: number; code: string }>,
): TeamSheetPlayer {
  const isStarter = rawPlayer.position !== "Substitute";
  const formationPlace = Number.parseInt(rawPlayer.formationPlace ?? "", 10);

  if (!isStarter) {
    return {
      playerId: rawPlayer.playerId,
      label: getStatsPerformDisplayName(rawPlayer),
      number: rawPlayer.shirtNumber ?? null,
      starter: false,
    };
  }

  if (!Number.isInteger(formationPlace) || formationPlace <= 0) {
    throw new Error(
      `Stats Perform MA1 starter ${rawPlayer.playerId} is missing a valid formationPlace.`,
    );
  }

  const slot = getMplSlotForOptaSlot(formation, formationPlace) ?? formationPlace;
  const position = positionBySlot.get(slot);

  return {
    playerId: rawPlayer.playerId,
    label: getStatsPerformDisplayName(rawPlayer),
    number: rawPlayer.shirtNumber ?? null,
    ...(position ? { positionCode: position.code, slot: position.slot } : {}),
    starter: true,
  };
}

function getStatsPerformDisplayName(player: StatsPerformMa1Player): string | null {
  const direct = player.matchName?.trim() || player.knownName?.trim() || undefined;
  if (direct) return direct;

  const combined = [player.firstName?.trim(), player.lastName?.trim()]
    .filter((value): value is string => Boolean(value && value.length > 0))
    .join(" ");

  return combined.length > 0 ? combined : null;
}

function directionToOrientation(value: string): "increasing-x" | "decreasing-x" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "left to right") return "increasing-x";
  if (normalized === "right to left") return "decreasing-x";
  throw new Error(`Unsupported Stats Perform direction value: ${value}`);
}

function invertOrientation(
  value: "increasing-x" | "decreasing-x",
): "increasing-x" | "decreasing-x" {
  return value === "increasing-x" ? "decreasing-x" : "increasing-x";
}
