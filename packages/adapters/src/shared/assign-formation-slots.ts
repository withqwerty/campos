import { getFormationPositions } from "@withqwerty/campos-schema";

export type FormationSlotCandidate = {
  playerId: string;
  candidateCodes: readonly string[];
};

export type FormationSlotAssignment = {
  playerId: string;
  slot?: number;
  positionCode?: string;
};

export function assignFormationSlots(
  formation: string,
  players: readonly FormationSlotCandidate[],
): Map<string, FormationSlotAssignment> {
  const positions = getFormationPositions(formation);
  const assignments = new Map<string, FormationSlotAssignment>();
  const usedSlots = new Set<number>();

  const ordered = [...players].sort((left, right) => {
    const leftCandidates = findCandidateSlots(positions, left.candidateCodes).length;
    const rightCandidates = findCandidateSlots(positions, right.candidateCodes).length;
    if (leftCandidates !== rightCandidates) {
      return leftCandidates - rightCandidates;
    }
    return comparePlayerIds(left.playerId, right.playerId);
  });

  for (const player of ordered) {
    const candidateSlots = findCandidateSlots(positions, player.candidateCodes).filter(
      (position) => !usedSlots.has(position.slot),
    );

    const selected = candidateSlots[0];
    if (selected) {
      usedSlots.add(selected.slot);
      assignments.set(player.playerId, {
        playerId: player.playerId,
        slot: selected.slot,
        positionCode: selected.code,
      });
      continue;
    }

    // Unknown provider position: fall back to the first formation slot not
    // already claimed so downstream projection still renders a full XI.
    const fallback = positions.find((position) => !usedSlots.has(position.slot));
    if (fallback) {
      usedSlots.add(fallback.slot);
      assignments.set(player.playerId, {
        playerId: player.playerId,
        slot: fallback.slot,
        positionCode: player.candidateCodes[0] ?? fallback.code,
      });
      continue;
    }

    assignments.set(player.playerId, {
      playerId: player.playerId,
      ...(player.candidateCodes[0] ? { positionCode: player.candidateCodes[0] } : {}),
    });
  }

  return assignments;
}

// Numeric-aware tiebreak so playerId "10" sorts after "2" rather than before.
function comparePlayerIds(left: string, right: string): number {
  const leftNum = Number(left);
  const rightNum = Number(right);
  if (Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
    if (leftNum !== rightNum) return leftNum - rightNum;
  }
  return left.localeCompare(right);
}

function findCandidateSlots(
  positions: readonly { slot: number; code: string }[],
  candidateCodes: readonly string[],
): Array<{ slot: number; code: string }> {
  const result: Array<{ slot: number; code: string }> = [];
  for (const code of candidateCodes) {
    for (const position of positions) {
      if (position.code !== code) continue;
      if (result.some((entry) => entry.slot === position.slot)) continue;
      result.push(position);
    }
  }
  return result;
}
