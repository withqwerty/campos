import type { MatchLineups, TeamSheet, TeamSheetPlayer } from "@withqwerty/campos-schema";
import { getFormationPositions, parseFormationKey } from "@withqwerty/campos-schema";

import type {
  StatsBombEvent,
  StatsBombLineupPlayer,
  StatsBombLineupTeam,
  StatsBombMatchInfo,
  StatsBombTacticsLineupEntry,
} from "./parse.js";

import { STARTER_COUNT } from "../shared/constants.js";

const STARTING_XI_TYPE_ID = 35;
const TACTICAL_SHIFT_TYPE_ID = 36;
const SUBSTITUTION_TYPE_ID = 19;

export function mapStatsBombMatchLineups(
  lineups: readonly StatsBombLineupTeam[],
  events: readonly StatsBombEvent[],
  matchInfo: StatsBombMatchInfo,
): MatchLineups {
  return {
    matchId: String(matchInfo.id),
    home: mapStatsBombTeamSheet(matchInfo.homeTeam, lineups, events),
    away: mapStatsBombTeamSheet(matchInfo.awayTeam, lineups, events),
  };
}

function mapStatsBombTeamSheet(
  team: StatsBombMatchInfo["homeTeam"],
  lineups: readonly StatsBombLineupTeam[],
  events: readonly StatsBombEvent[],
): TeamSheet {
  const rawTeam = lineups.find((entry) => entry.team_id === team.id);
  if (!rawTeam) {
    throw new Error(`missing StatsBomb lineup payload for team ${team.id}`);
  }

  const teamEvents = events.filter((event) => event.team.id === team.id);
  const kickoff = teamEvents.find(
    (event) =>
      event.type.id === STARTING_XI_TYPE_ID &&
      event.tactics?.lineup != null &&
      event.tactics.lineup.length > 0,
  );
  if (!kickoff?.tactics) {
    throw new Error(`missing Starting XI tactics event for StatsBomb team ${team.id}`);
  }

  if (kickoff.tactics.lineup.length !== STARTER_COUNT) {
    throw new Error(
      `expected ${STARTER_COUNT} starters in StatsBomb Starting XI, got ${kickoff.tactics.lineup.length}`,
    );
  }

  const formation = parseFormationKey(String(kickoff.tactics.formation));
  const kickoffSlots = new Map<string, { slot: number; code: string }>();
  for (const entry of kickoff.tactics.lineup) {
    const mapped = mapTacticsPositionToSlot(formation, entry);
    if (mapped == null) continue;
    kickoffSlots.set(String(entry.player.id), mapped);
  }

  const fallbackPositionCodeByPlayerId = buildFallbackPositionCodeMap(teamEvents);
  const rawPlayerById = new Map(
    rawTeam.lineup.map((player) => [String(player.player_id), player] as const),
  );

  const starters: TeamSheetPlayer[] = kickoff.tactics.lineup.map((entry) => {
    const playerId = String(entry.player.id);
    const rawPlayer = rawPlayerById.get(playerId);
    const kickoffSlot = kickoffSlots.get(playerId);
    return createTeamSheetPlayer({
      playerId,
      label: resolveDisplayLabel(rawPlayer, entry.player.name),
      number: rawPlayer?.jersey_number ?? entry.jersey_number,
      positionCode: kickoffSlot?.code ?? null,
      slot: kickoffSlot?.slot ?? null,
      starter: true,
    });
  });

  const starterIds = new Set(starters.map((player) => player.playerId));
  const bench: TeamSheetPlayer[] = rawTeam.lineup
    .filter((player) => !starterIds.has(String(player.player_id)))
    .map((player) => {
      const playerId = String(player.player_id);
      return createTeamSheetPlayer({
        playerId,
        label: resolveDisplayLabel(player),
        number: player.jersey_number,
        positionCode: fallbackPositionCodeByPlayerId.get(playerId) ?? null,
        starter: false,
      });
    });

  const playerById = new Map<string, TeamSheetPlayer>();
  for (const player of starters) {
    playerById.set(player.playerId, player);
  }
  for (const player of bench) {
    playerById.set(player.playerId, player);
  }

  applySubstitutionMetadata(teamEvents, playerById, bench);

  return {
    teamId: String(rawTeam.team_id),
    teamLabel: rawTeam.team_name,
    formation,
    starters,
    bench,
  };
}

function buildFallbackPositionCodeMap(
  teamEvents: readonly StatsBombEvent[],
): Map<string, string> {
  const result = new Map<string, string>();

  const tacticalEvents = teamEvents.filter(
    (event) =>
      (event.type.id === STARTING_XI_TYPE_ID ||
        event.type.id === TACTICAL_SHIFT_TYPE_ID) &&
      event.tactics?.lineup != null &&
      event.tactics.lineup.length > 0,
  );

  for (const event of tacticalEvents) {
    const formation = safeParseFormationKey(String(event.tactics?.formation ?? ""));
    if (formation == null || !event.tactics) continue;

    for (const entry of event.tactics.lineup) {
      const playerId = String(entry.player.id);
      if (result.has(playerId)) continue;
      const mapped = mapTacticsPositionToSlot(formation, entry);
      if (mapped?.code) {
        result.set(playerId, mapped.code);
      }
    }
  }

  return result;
}

function mapTacticsPositionToSlot(
  formation: string,
  entry: StatsBombTacticsLineupEntry,
): { slot: number; code: string } | null {
  const positions = getFormationPositions(formation);
  const mapped = positions.find((position) =>
    position.statsbomb?.includes(entry.position.id),
  );

  return mapped ? { slot: mapped.slot, code: mapped.code } : null;
}

function applySubstitutionMetadata(
  teamEvents: readonly StatsBombEvent[],
  playerById: Map<string, TeamSheetPlayer>,
  bench: TeamSheetPlayer[],
): void {
  for (const event of teamEvents) {
    if (event.type.id !== SUBSTITUTION_TYPE_ID || !event.substitution?.replacement) {
      continue;
    }

    const minute = event.minute;
    const playerOffId = event.player ? String(event.player.id) : null;
    const playerOnId = String(event.substitution.replacement.id);

    if (playerOffId != null) {
      const outgoing = playerById.get(playerOffId);
      if (outgoing != null) {
        outgoing.substitutedOut = true;
        outgoing.minuteOff ??= minute;
      }
    }

    let incoming = playerById.get(playerOnId);
    if (incoming == null) {
      incoming = createTeamSheetPlayer({
        playerId: playerOnId,
        label: event.substitution.replacement.name,
        number: null,
        starter: false,
      });
      bench.push(incoming);
      playerById.set(playerOnId, incoming);
    }

    incoming.substitutedIn = true;
    incoming.minuteOn ??= minute;
  }
}

function resolveDisplayLabel(
  rawPlayer: StatsBombLineupPlayer | undefined,
  fallbackName?: string,
): string | undefined {
  const nickname = rawPlayer?.player_nickname?.trim();
  if (nickname) return nickname;

  const fullName = rawPlayer?.player_name.trim();
  if (fullName) return fullName;

  const fallback = fallbackName?.trim();
  return fallback && fallback.length > 0 ? fallback : undefined;
}

type TeamSheetPlayerInput = {
  playerId: string;
  starter: boolean;
  label?: string | null | undefined;
  number?: number | null | undefined;
  positionCode?: string | null | undefined;
  slot?: number | null | undefined;
  captain?: boolean | undefined;
  substitutedIn?: boolean | undefined;
  substitutedOut?: boolean | undefined;
  minuteOn?: number | null | undefined;
  minuteOff?: number | null | undefined;
  rating?: number | null | undefined;
  x?: number | null | undefined;
  y?: number | null | undefined;
  sourceMeta?: Record<string, unknown> | null | undefined;
};

function createTeamSheetPlayer(input: TeamSheetPlayerInput): TeamSheetPlayer {
  return {
    playerId: input.playerId,
    label: input.label ?? null,
    number: input.number ?? null,
    positionCode: input.positionCode ?? null,
    ...(input.slot != null ? { slot: input.slot } : {}),
    starter: input.starter,
    ...(input.captain != null ? { captain: input.captain } : {}),
    ...(input.substitutedIn != null ? { substitutedIn: input.substitutedIn } : {}),
    ...(input.substitutedOut != null ? { substitutedOut: input.substitutedOut } : {}),
    ...(input.minuteOn != null ? { minuteOn: input.minuteOn } : {}),
    ...(input.minuteOff != null ? { minuteOff: input.minuteOff } : {}),
    ...(input.rating != null ? { rating: input.rating } : {}),
    ...(input.x != null ? { x: input.x } : {}),
    ...(input.y != null ? { y: input.y } : {}),
    ...(input.sourceMeta != null ? { sourceMeta: input.sourceMeta } : {}),
  };
}

function safeParseFormationKey(input: string): string | null {
  try {
    return parseFormationKey(input);
  } catch {
    return null;
  }
}
