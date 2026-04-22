import type { MatchLineups, TeamSheet, TeamSheetPlayer } from "@withqwerty/campos-schema";
import { getFormationPositions, parseFormationKey } from "@withqwerty/campos-schema";

import type { WhoScoredMatchCentreData, WhoScoredMatchInfo } from "./parse.js";
import { STARTER_COUNT } from "../shared/constants.js";
import type {
  WhoScoredFormationEntry,
  WhoScoredMatchCentreTeam,
  WhoScoredPlayer,
} from "./map-formation.js";

export function mapWhoScoredMatchLineups(
  matchData: WhoScoredMatchCentreData,
  matchInfo: WhoScoredMatchInfo,
): MatchLineups {
  return {
    matchId: matchInfo.matchId,
    home: mapWhoScoredTeamSheet(matchData.home),
    away: mapWhoScoredTeamSheet(matchData.away),
  };
}

function mapWhoScoredTeamSheet(team: WhoScoredMatchCentreTeam): TeamSheet {
  if (team.teamId == null) {
    throw new Error("Invalid WhoScored team: missing teamId");
  }
  if (!Array.isArray(team.formations) || team.formations.length === 0) {
    throw new Error("Invalid WhoScored team: missing formations[] or empty");
  }
  if (!Array.isArray(team.players)) {
    throw new Error("Invalid WhoScored team: missing players[]");
  }

  const kickoff = team.formations[0];
  if (kickoff == null) {
    throw new Error("Invalid WhoScored team: formations[0] is missing");
  }

  const formationKey = parseFormationKey(kickoff.formationName);
  const positions = getFormationPositions(formationKey);
  const positionBySlot = new Map<number, (typeof positions)[number]>();
  for (const position of positions) {
    positionBySlot.set(position.slot, position);
  }

  const playerIds = kickoff.playerIds ?? [];
  const jerseyNumbers = kickoff.jerseyNumbers ?? [];
  const formationSlots = kickoff.formationSlots ?? [];
  const formationPositions = kickoff.formationPositions ?? [];

  if (playerIds.length === 0) {
    throw new Error("WhoScored kickoff formation missing playerIds[]");
  }
  if (jerseyNumbers.length !== playerIds.length) {
    throw new Error(
      `WhoScored parallel arrays inconsistent: playerIds has ${playerIds.length} entries, jerseyNumbers has ${jerseyNumbers.length}`,
    );
  }
  if (formationSlots.length > 0 && formationSlots.length !== playerIds.length) {
    throw new Error(
      `WhoScored parallel arrays inconsistent: playerIds has ${playerIds.length} entries, formationSlots has ${formationSlots.length}`,
    );
  }

  const starterIndices =
    formationSlots.length > 0
      ? formationSlots
          .map((slot, index) => ({ slot, index }))
          .filter((entry) => entry.slot > 0)
          .map((entry) => entry.index)
      : playerIds.slice(0, STARTER_COUNT).map((_, index) => index);

  if (starterIndices.length < STARTER_COUNT) {
    throw new Error(
      `WhoScored formation has fewer than ${STARTER_COUNT} starters: ${starterIndices.length}`,
    );
  }
  if (starterIndices.length > STARTER_COUNT) {
    throw new Error(
      `WhoScored formation has more than ${STARTER_COUNT} starters: ${starterIndices.length}`,
    );
  }

  const playerLookup = new Map<number, WhoScoredPlayer>();
  for (const player of team.players) {
    playerLookup.set(player.playerId, player);
  }

  const captainId = kickoff.captainPlayerId;
  const useFormationPositions = formationPositions.length >= STARTER_COUNT;
  const starters: TeamSheetPlayer[] = [];
  const bench: TeamSheetPlayer[] = [];
  const playerById = new Map<string, TeamSheetPlayer>();

  let starterOrdinal = 0;
  for (let i = 0; i < playerIds.length; i += 1) {
    const rawPlayerId = playerIds[i];
    const shirtNumber = jerseyNumbers[i];
    if (rawPlayerId == null || shirtNumber == null) {
      throw new Error(`internal error: missing lineup data at index ${i}`);
    }

    const isStarter = starterIndices.includes(i);
    const rawFormationSlot = formationSlots[i];
    const formationSlot =
      isStarter && rawFormationSlot != null && rawFormationSlot > 0
        ? rawFormationSlot
        : isStarter
          ? starterOrdinal + 1
          : null;
    const wsPlayer = playerLookup.get(rawPlayerId);
    const playerId = String(rawPlayerId);
    const player = buildTeamSheetPlayer({
      playerId,
      shirtNumber,
      formationSlot,
      isStarter,
      captainId,
      wsPlayer,
      positionBySlot,
    });

    if (isStarter && useFormationPositions) {
      const wsPosition = formationPositions[starterOrdinal];
      if (wsPosition != null) {
        player.x = (wsPosition.vertical / 10) * 100;
        player.y = (wsPosition.horizontal / 10) * 100;
      }
    }

    if (isStarter) {
      starters.push(player);
      starterOrdinal += 1;
    } else {
      bench.push(player);
    }
    playerById.set(playerId, player);
  }

  applySubstitutionMetadata(team.formations, playerById);

  const kickoffIds = new Set(playerIds.map(String));
  const unavailable = team.players
    .filter((player) => !kickoffIds.has(String(player.playerId)))
    .map((player) =>
      buildTeamSheetPlayer({
        playerId: String(player.playerId),
        shirtNumber: player.shirtNo,
        formationSlot: null,
        isStarter: false,
        captainId,
        wsPlayer: player,
        positionBySlot,
      }),
    );

  return {
    teamId: String(team.teamId),
    ...(team.name ? { teamLabel: team.name } : {}),
    formation: formationKey,
    ...(captainId != null ? { captainPlayerId: String(captainId) } : {}),
    starters,
    bench,
    ...(unavailable.length > 0 ? { unavailable } : {}),
  };
}

function buildTeamSheetPlayer({
  playerId,
  shirtNumber,
  formationSlot,
  isStarter,
  captainId,
  wsPlayer,
  positionBySlot,
}: {
  playerId: string;
  shirtNumber: number | undefined;
  formationSlot: number | null;
  isStarter: boolean;
  captainId: number | undefined;
  wsPlayer: WhoScoredPlayer | undefined;
  positionBySlot: Map<number, { code: string }>;
}): TeamSheetPlayer {
  const rawPosition = wsPlayer?.position;
  const slotPosition =
    formationSlot != null ? positionBySlot.get(formationSlot) : undefined;
  const fallbackPositionCode =
    rawPosition != null && rawPosition !== "Sub" ? rawPosition : undefined;

  return {
    playerId,
    ...(wsPlayer?.name ? { label: wsPlayer.name } : {}),
    number: shirtNumber ?? wsPlayer?.shirtNo ?? null,
    ...(slotPosition?.code
      ? { positionCode: slotPosition.code }
      : fallbackPositionCode
        ? { positionCode: fallbackPositionCode }
        : {}),
    ...(formationSlot != null ? { slot: formationSlot } : {}),
    ...(captainId != null && String(captainId) === playerId ? { captain: true } : {}),
    starter: isStarter,
  };
}

function applySubstitutionMetadata(
  formations: readonly WhoScoredFormationEntry[],
  playerById: Map<string, TeamSheetPlayer>,
): void {
  for (const formation of formations) {
    const minute = formation.startMinuteExpanded;
    if (typeof minute !== "number") continue;

    if (formation.subOnPlayerId != null) {
      const player = playerById.get(String(formation.subOnPlayerId));
      if (player != null) {
        player.substitutedIn = true;
        player.minuteOn ??= minute;
      }
    }

    if (formation.subOffPlayerId != null) {
      const player = playerById.get(String(formation.subOffPlayerId));
      if (player != null) {
        player.substitutedOut = true;
        player.minuteOff ??= minute;
      }
    }
  }
}
