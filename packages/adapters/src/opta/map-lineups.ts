import type { MatchLineups, TeamSheet, TeamSheetPlayer } from "@withqwerty/campos-schema";
import {
  getFormationPositions,
  getMplSlotForOptaSlot,
  optaFormationIdToKey,
} from "@withqwerty/campos-schema";

import type { OptaSquadIndex } from "./parse-squads.js";
import type { RawOptaLineupEvent } from "./map-formation.js";
import {
  findOptionalQualifierValue,
  requireQualifierValue,
  splitCsv,
} from "./qualifier-utils.js";
import { STARTER_COUNT } from "../shared/constants.js";

export type RawOptaLineupPair = {
  home: RawOptaLineupEvent;
  away: RawOptaLineupEvent;
};

export type FromOptaMatchLineupsOptions = {
  squads: OptaSquadIndex;
  matchId?: string;
};

export function mapOptaMatchLineups(
  lineups: RawOptaLineupPair,
  options: FromOptaMatchLineupsOptions,
): MatchLineups {
  return {
    ...(options.matchId ? { matchId: options.matchId } : {}),
    home: mapOptaTeamSheet(lineups.home, options),
    away: mapOptaTeamSheet(lineups.away, options),
  };
}

function mapOptaTeamSheet(
  event: RawOptaLineupEvent,
  options: FromOptaMatchLineupsOptions,
): TeamSheet {
  if (event.typeId !== 34) {
    throw new Error(`expected typeId 34 lineup event, got ${event.typeId}`);
  }

  const formationIdValue = requireQualifierValue(event, 130, "team formation");
  const playerIdsValue = requireQualifierValue(event, 30, "player IDs");
  const shirtNumbersValue = requireQualifierValue(event, 59, "shirt numbers");
  const slotsValue = requireQualifierValue(event, 131, "formation slots");
  const captainValue = findOptionalQualifierValue(event, 194);

  const formationKey = optaFormationIdToKey(formationIdValue);
  const playerIds = splitCsv(playerIdsValue);
  const shirtNumbers = splitCsv(shirtNumbersValue).map((value) =>
    Number.parseInt(value, 10),
  );
  const lineupSlots = splitCsv(slotsValue).map((value) => Number.parseInt(value, 10));

  if (shirtNumbers.length !== playerIds.length) {
    throw new Error(
      `Opta parallel arrays inconsistent: player IDs has ${playerIds.length} entries, shirt numbers has ${shirtNumbers.length}`,
    );
  }
  if (lineupSlots.length !== playerIds.length) {
    throw new Error(
      `Opta parallel arrays inconsistent: player IDs has ${playerIds.length} entries, formation slots has ${lineupSlots.length}`,
    );
  }

  const starterIndices = lineupSlots
    .map((slot, index) => ({ slot, index }))
    .filter((entry) => entry.slot > 0)
    .map((entry) => entry.index);

  if (starterIndices.length < STARTER_COUNT) {
    throw new Error(
      `expected at least ${STARTER_COUNT} starters in qualifier 131, got ${starterIndices.length}`,
    );
  }
  if (starterIndices.length > STARTER_COUNT) {
    throw new Error(
      `expected at most ${STARTER_COUNT} starters in qualifier 131, got ${starterIndices.length}`,
    );
  }

  const positions = getFormationPositions(formationKey);
  const positionBySlot = new Map<number, (typeof positions)[number]>();
  for (const position of positions) {
    positionBySlot.set(position.slot, position);
  }

  const captainId = captainValue?.trim();
  const starters: TeamSheetPlayer[] = [];
  const bench: TeamSheetPlayer[] = [];
  let teamLabel: string | undefined;

  for (let i = 0; i < playerIds.length; i += 1) {
    const playerId = playerIds[i];
    const shirtNumber = shirtNumbers[i];
    const lineupSlot = lineupSlots[i];
    if (playerId == null || shirtNumber == null || lineupSlot == null) {
      throw new Error(`internal error: missing lineup data at index ${i}`);
    }

    const squadEntry = options.squads.get(playerId);
    if (squadEntry != null && !teamLabel) {
      teamLabel = squadEntry.teamName;
    }

    const isStarter = lineupSlot > 0;
    const player = buildTeamSheetPlayer({
      playerId,
      shirtNumber,
      lineupSlot,
      formationKey,
      captainId,
      label: squadEntry?.label,
      positionBySlot,
      isStarter,
    });

    if (isStarter) {
      starters.push(player);
    } else {
      bench.push(player);
    }
  }

  return {
    teamId: event.contestantId ?? teamLabel ?? "unknown-team",
    ...(teamLabel ? { teamLabel } : {}),
    formation: formationKey,
    ...(captainId ? { captainPlayerId: captainId } : {}),
    starters,
    bench,
  };
}

function buildTeamSheetPlayer({
  playerId,
  shirtNumber,
  lineupSlot,
  formationKey,
  captainId,
  label,
  positionBySlot,
  isStarter,
}: {
  playerId: string;
  shirtNumber: number;
  lineupSlot: number;
  formationKey: string;
  captainId: string | undefined;
  label: string | undefined;
  positionBySlot: Map<number, { slot: number; code: string }>;
  isStarter: boolean;
}): TeamSheetPlayer {
  if (!isStarter) {
    return {
      playerId,
      ...(label ? { label } : {}),
      number: shirtNumber,
      ...(captainId && captainId === playerId ? { captain: true } : {}),
      starter: false,
    };
  }

  const mplSlot = getMplSlotForOptaSlot(formationKey, lineupSlot) ?? lineupSlot;
  const position = positionBySlot.get(mplSlot);
  if (position == null) {
    throw new Error(
      `internal error: no mplsoccer position for slot ${mplSlot} in formation ${formationKey}`,
    );
  }

  return {
    playerId,
    ...(label ? { label } : {}),
    number: shirtNumber,
    positionCode: position.code,
    slot: position.slot,
    ...(captainId && captainId === playerId ? { captain: true } : {}),
    starter: true,
  };
}
