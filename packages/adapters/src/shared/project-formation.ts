import type {
  FormationPlayer,
  FormationTeamData,
  TeamSheet,
} from "@withqwerty/campos-schema";
import { getFormationPositions, parseFormationKey } from "@withqwerty/campos-schema";

import { STARTER_COUNT } from "./constants.js";

export function projectTeamSheetToFormation(
  teamSheet: TeamSheet,
  providerLabel: string,
): FormationTeamData {
  const formation = parseFormationKey(teamSheet.formation ?? "");
  const starters = [...teamSheet.starters];

  if (starters.length < STARTER_COUNT) {
    throw new Error(
      `${providerLabel} team sheet has fewer than ${STARTER_COUNT} starters for formation projection`,
    );
  }

  starters.sort((left, right) => {
    if (left.slot != null && right.slot != null) {
      return left.slot - right.slot;
    }
    if (left.slot != null) return -1;
    if (right.slot != null) return 1;
    return left.playerId.localeCompare(right.playerId);
  });

  const positions = getFormationPositions(formation);
  const positionBySlot = new Map(positions.map((position) => [position.slot, position]));
  const positionByCode = new Map(positions.map((position) => [position.code, position]));

  const players: FormationPlayer[] = starters.slice(0, STARTER_COUNT).map((player) => {
    const resolvedSlot =
      player.slot ??
      (player.positionCode != null
        ? positionByCode.get(player.positionCode)?.slot
        : null);
    const resolvedCode =
      player.positionCode ??
      (resolvedSlot != null ? positionBySlot.get(resolvedSlot)?.code : null);

    if (
      (resolvedSlot == null || resolvedCode == null) &&
      (player.x == null || player.y == null)
    ) {
      throw new Error(
        `${providerLabel} starter ${player.playerId} is missing slot/position data for formation projection (slot=${String(player.slot)} positionCode=${String(player.positionCode)})`,
      );
    }

    return {
      ...(resolvedSlot != null ? { slot: resolvedSlot } : {}),
      ...(resolvedCode != null ? { positionCode: resolvedCode } : {}),
      playerId: player.playerId,
      ...(player.label != null ? { label: player.label } : {}),
      ...(player.number != null ? { number: player.number } : {}),
      ...(player.captain === true ? { captain: true as const } : {}),
      ...(player.rating != null ? { rating: player.rating } : {}),
      ...(player.substitutedOut === true ? { substituted: true as const } : {}),
      ...(player.minuteOff != null ? { subMinute: player.minuteOff } : {}),
      ...(player.x != null ? { x: player.x } : {}),
      ...(player.y != null ? { y: player.y } : {}),
    };
  });

  return {
    formation,
    ...(teamSheet.teamLabel != null ? { teamLabel: teamSheet.teamLabel } : {}),
    players,
  };
}
