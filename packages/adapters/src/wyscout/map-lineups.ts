import type { MatchLineups, TeamSheet, TeamSheetPlayer } from "@withqwerty/campos-schema";

import type {
  FromWyscoutMatchLineupsOptions,
  WyscoutFormationPlayer,
  WyscoutMatchData,
  WyscoutMatchTeamData,
  WyscoutPlayer,
  WyscoutSubstitution,
  WyscoutTeam,
} from "./parse.js";

export function mapWyscoutMatchLineups(
  matchData: WyscoutMatchData,
  options: FromWyscoutMatchLineupsOptions = {},
): MatchLineups {
  const teams = Object.values(matchData.match.teamsData);
  const home = teams.find((team) => team.side === "home");
  const away = teams.find((team) => team.side === "away");

  if (!home || !away) {
    throw new Error("Invalid Wyscout match data: missing home or away teamsData entry");
  }

  const playerById = new Map(
    (options.players ?? []).map((player) => [String(player.wyId), player] as const),
  );
  const teamById = new Map(
    (options.teams ?? []).map((team) => [String(team.wyId), team] as const),
  );

  return {
    matchId: options.matchId ?? String(matchData.match.wyId),
    home: mapWyscoutTeamSheet(home, playerById, teamById),
    away: mapWyscoutTeamSheet(away, playerById, teamById),
  };
}

function mapWyscoutTeamSheet(
  rawTeam: WyscoutMatchTeamData,
  playerById: Map<string, WyscoutPlayer>,
  teamById: Map<string, WyscoutTeam>,
): TeamSheet {
  const formation = rawTeam.formation;
  if (!formation) {
    throw new Error(`missing Wyscout formation payload for team ${rawTeam.teamId}`);
  }

  const starters = formation.lineup.map((player) =>
    buildTeamSheetPlayer(player, playerById, true),
  );
  const bench = formation.bench.map((player) =>
    buildTeamSheetPlayer(player, playerById, false),
  );

  const teamSheetByPlayerId = new Map<string, TeamSheetPlayer>();
  for (const player of starters) {
    teamSheetByPlayerId.set(player.playerId, player);
  }
  for (const player of bench) {
    teamSheetByPlayerId.set(player.playerId, player);
  }

  applySubstitutionMetadata(
    formation.substitutions,
    teamSheetByPlayerId,
    bench,
    playerById,
  );

  const teamLabel = teamById.get(String(rawTeam.teamId))?.name?.trim();

  return {
    teamId: String(rawTeam.teamId),
    ...(teamLabel ? { teamLabel } : {}),
    starters,
    bench,
  };
}

function buildTeamSheetPlayer(
  rawPlayer: WyscoutFormationPlayer,
  playerById: Map<string, WyscoutPlayer>,
  starter: boolean,
): TeamSheetPlayer {
  const playerId = String(rawPlayer.playerId);
  const player = playerById.get(playerId);
  const label = resolvePlayerLabel(player);
  const positionCode = player?.role?.code2?.trim() || undefined;
  const sourceMeta = buildPlayerSourceMeta(rawPlayer);

  return {
    playerId,
    ...(label ? { label } : {}),
    ...(positionCode ? { positionCode } : {}),
    starter,
    ...(sourceMeta ? { sourceMeta } : {}),
  };
}

function applySubstitutionMetadata(
  substitutions: readonly WyscoutSubstitution[],
  playerById: Map<string, TeamSheetPlayer>,
  bench: TeamSheetPlayer[],
  lookupById: Map<string, WyscoutPlayer>,
): void {
  for (const substitution of substitutions) {
    const minute = substitution.minute;
    const offId = String(substitution.playerOut);
    const onId = String(substitution.playerIn);

    const outgoing = playerById.get(offId);
    if (outgoing) {
      outgoing.substitutedOut = true;
      outgoing.minuteOff ??= minute;
    }

    let incoming = playerById.get(onId);
    if (!incoming) {
      const lookup = lookupById.get(onId);
      const label = resolvePlayerLabel(lookup);
      const positionCode = lookup?.role?.code2?.trim() || undefined;
      incoming = {
        playerId: onId,
        ...(label ? { label } : {}),
        ...(positionCode ? { positionCode } : {}),
        starter: false,
      };
      bench.push(incoming);
      playerById.set(onId, incoming);
    }

    incoming.substitutedIn = true;
    incoming.minuteOn ??= minute;
  }
}

function resolvePlayerLabel(player: WyscoutPlayer | undefined): string | undefined {
  const shortName = player?.shortName?.trim();
  if (shortName) return shortName;

  const fullName = [player?.firstName, player?.middleName, player?.lastName]
    .map((part) => part?.trim())
    .filter((part) => part && part.length > 0)
    .join(" ");

  return fullName.length > 0 ? fullName : undefined;
}

function buildPlayerSourceMeta(
  rawPlayer: WyscoutFormationPlayer,
): TeamSheetPlayer["sourceMeta"] | undefined {
  const result: Record<string, number> = {};

  const goals = parseNullableInteger(rawPlayer.goals);
  const ownGoals = parseNullableInteger(rawPlayer.ownGoals);
  const yellowCards = parseNullableInteger(rawPlayer.yellowCards);
  const redCards = parseNullableInteger(rawPlayer.redCards);

  if (goals != null && goals > 0) result.goals = goals;
  if (ownGoals != null && ownGoals > 0) result.ownGoals = ownGoals;
  if (yellowCards != null && yellowCards > 0) result.yellowCardMinute = yellowCards;
  if (redCards != null && redCards > 0) result.redCardMinute = redCards;

  return Object.keys(result).length > 0 ? result : undefined;
}

function parseNullableInteger(input: string | undefined): number | null {
  if (!input || input === "null") return null;
  const parsed = Number.parseInt(input, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
