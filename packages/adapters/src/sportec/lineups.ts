import type { MatchLineups, TeamSheet, TeamSheetPlayer } from "@withqwerty/campos-schema";
import { parseFormationKey } from "@withqwerty/campos-schema";

import { assignFormationSlots } from "../shared/assign-formation-slots.js";
import { STARTER_COUNT } from "../shared/constants.js";

import type { SportecMeta, SportecTeam, SportecTeamPlayer } from "./types.js";

export function mapSportecMatchLineups(meta: SportecMeta): MatchLineups {
  const home = meta.teams.find((team) => team.role === "home");
  const away = meta.teams.find((team) => team.role === "away");
  if (!home || !away) {
    throw new Error("Sportec metadata requires both home and away team entries.");
  }

  return {
    matchId: meta.matchId,
    home: mapSportecTeamSheet(home),
    away: mapSportecTeamSheet(away),
  };
}

function mapSportecTeamSheet(team: SportecTeam): TeamSheet {
  const formation = parseFormationKey(team.lineUp);
  const startersRaw = team.players.filter((player) => player.starting);
  const benchRaw = team.players.filter((player) => !player.starting);
  const slotAssignments = assignFormationSlots(
    formation,
    startersRaw.map((player) => ({
      playerId: player.playerId,
      candidateCodes: candidateCodes(player.playingPosition),
    })),
  );
  const starters = startersRaw.map((player) =>
    toTeamSheetPlayer(player, true, slotAssignments),
  );
  const bench = benchRaw.map((player) =>
    toTeamSheetPlayer(player, false, slotAssignments),
  );

  if (starters.length !== STARTER_COUNT) {
    throw new Error(
      `Sportec lineup for ${team.teamId} expected ${STARTER_COUNT} starters, got ${starters.length}.`,
    );
  }

  const captainPlayerId = starters.find((player) => player.captain)?.playerId;
  return {
    teamId: team.teamId,
    teamLabel: team.teamLabel,
    formation,
    ...(captainPlayerId ? { captainPlayerId } : {}),
    starters,
    bench,
  };
}

function toTeamSheetPlayer(
  player: SportecTeamPlayer,
  starter: boolean,
  slotAssignments: Map<string, { slot?: number; positionCode?: string }>,
): TeamSheetPlayer {
  const assignment = slotAssignments.get(player.playerId);
  const label =
    player.shortName || [player.firstName, player.lastName].filter(Boolean).join(" ");
  return {
    playerId: player.playerId,
    label: label.length > 0 ? label : null,
    number: player.shirtNumber,
    ...(assignment?.positionCode ? { positionCode: assignment.positionCode } : {}),
    ...(assignment?.slot != null ? { slot: assignment.slot } : {}),
    ...(player.captain ? { captain: true } : {}),
    starter,
  };
}

function candidateCodes(position: string | null | undefined): string[] {
  switch (position) {
    case "TW":
      return ["GK"];
    case "RV":
      return ["RB"];
    case "LV":
      return ["LB"];
    case "IVR":
      return ["RCB", "CB"];
    case "IVL":
      return ["LCB", "CB"];
    case "STZ":
      return ["ST", "RCF", "LCF"];
    case "STR":
      return ["RCF", "ST", "RW"];
    case "STL":
      return ["LCF", "ST", "LW"];
    case "ZO":
      return ["CAM", "CM"];
    case "DMR":
    case "DRM":
      return ["RDM", "RCM", "CDM", "CM"];
    case "DML":
    case "DLM":
      return ["LDM", "LCM", "CDM", "CM"];
    case "ORM":
    case "RA":
      return ["RW", "RM"];
    case "OLM":
    case "LA":
      return ["LW", "LM"];
    default:
      return [];
  }
}
