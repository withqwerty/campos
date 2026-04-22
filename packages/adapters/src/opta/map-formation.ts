import {
  optaFormationIdToKey,
  getFormationPositions,
  getMplSlotForOptaSlot,
  type FormationPlayer,
  type FormationTeamData,
} from "@withqwerty/campos-schema";

import type { OptaSquadIndex } from "./parse-squads.js";
import {
  findOptionalQualifierValue,
  requireQualifierValue,
  splitCsv,
} from "./qualifier-utils.js";
import { STARTER_COUNT } from "../shared/constants.js";

/**
 * Opta's typeId 34 lineup event serialises starters in Opta's own
 * formation-place order (q131 = 1..11), and Opta's slot convention does
 * **not** match mplsoccer's slot ordering. For example, in 4-2-3-1, Opta
 * formation-place 4 is the LDM (left defensive midfielder) while
 * mplsoccer's slot 4 is LCB. Without a per-formation translation every
 * player in the lineup lands in the wrong slot.
 *
 * Campos delegates the translation to
 * {@link getMplSlotForOptaSlot} in `@withqwerty/campos-schema`, which reads
 * the `opta` field stored on each entry in `formation-positions.json`.
 * That JSON is regenerated from mplsoccer's `formations.py` via
 * `scripts/extract-mplsoccer-formations.py`, so mplsoccer is the single
 * source of truth for the slot convention and all 24 supported Opta
 * formations get the correct mapping automatically.
 */

export type RawOptaQualifier = {
  qualifierId: number;
  value?: string;
};

export type RawOptaLineupEvent = {
  typeId: number;
  contestantId?: string;
  qualifier: RawOptaQualifier[];
};

export type FromOptaFormationsOptions = {
  squads: OptaSquadIndex;
};

/**
 * Decode an Opta typeId 34 lineup event (from the match-events stream)
 * into a canonical `FormationTeamData`.
 *
 * Requires a pre-parsed `OptaSquadIndex` for player name resolution.
 * Without it, players render with just jersey numbers and playerIds.
 *
 * Qualifier decoding:
 * - q130 → team formation (Opta numeric ID)
 * - q30  → comma-separated player IDs (first 11 are starters)
 * - q59  → comma-separated shirt numbers (parallel to q30)
 * - q194 → optional captain player ID
 *
 * Throws on missing/empty required qualifiers, unknown Opta formation ID,
 * or fewer than 11 starters in q30/q59.
 */
export function mapOptaFormation(
  event: RawOptaLineupEvent,
  options: FromOptaFormationsOptions,
): FormationTeamData {
  if (event.typeId !== 34) {
    throw new Error(`expected typeId 34 lineup event, got ${event.typeId}`);
  }

  const { squads } = options;

  const formationIdValue = requireQualifierValue(event, 130, "team formation");
  const playerIdsValue = requireQualifierValue(event, 30, "player IDs");
  const shirtNumbersValue = requireQualifierValue(event, 59, "shirt numbers");
  const captainValue = findOptionalQualifierValue(event, 194);

  const formationKey = optaFormationIdToKey(formationIdValue);

  const playerIds = splitCsv(playerIdsValue);
  const shirtNumbers = splitCsv(shirtNumbersValue).map((s) => Number.parseInt(s, 10));
  const captainId = captainValue?.trim();

  if (playerIds.length < STARTER_COUNT) {
    throw new Error(
      `expected at least ${STARTER_COUNT} starters in qualifier 30, got ${playerIds.length}`,
    );
  }
  if (shirtNumbers.length < STARTER_COUNT) {
    throw new Error(
      `expected at least ${STARTER_COUNT} shirt numbers in qualifier 59, got ${shirtNumbers.length}`,
    );
  }

  const positions = getFormationPositions(formationKey);
  // Map of mplsoccer slot → formation position (for quick lookup by slot).
  const positionBySlot = new Map<number, (typeof positions)[number]>();
  for (const p of positions) positionBySlot.set(p.slot, p);

  const players: FormationPlayer[] = [];
  let teamLabel: string | undefined;

  for (let i = 0; i < STARTER_COUNT; i += 1) {
    const playerId = playerIds[i];
    const shirtNumber = shirtNumbers[i];
    if (playerId == null || shirtNumber == null) {
      // Defensive: the length guards above mean this is unreachable, but
      // noUncheckedIndexedAccess requires an explicit narrowing path.
      throw new Error(`internal error: missing starter data at slot ${i + 1}`);
    }
    // Opta q30 is ordered by Opta's own formation-place convention
    // (q131 = 1..11 for the starters), so i + 1 is the Opta slot. Translate
    // to the matching mplsoccer slot via the core helper, which reads
    // mplsoccer's own `opta=N` attribute from formation-positions.json. If
    // the formation has no Opta mapping (historical/Wyscout-only shapes,
    // or mplsoccer simply omitted the tag) we fall back to identity so the
    // adapter stays non-throwing — in practice every formation in
    // OPTA_FORMATION_ID_MAP has complete coverage.
    const optaSlot = i + 1;
    const mplSlot = getMplSlotForOptaSlot(formationKey, optaSlot) ?? optaSlot;
    const position = positionBySlot.get(mplSlot);
    if (position == null) {
      throw new Error(
        `internal error: no mplsoccer position for slot ${mplSlot} in formation ${formationKey}`,
      );
    }
    const squadEntry = squads.get(playerId);
    if (squadEntry && !teamLabel) {
      teamLabel = squadEntry.teamName;
    }
    const label = squadEntry?.label;
    const player: FormationPlayer = {
      slot: position.slot,
      positionCode: position.code,
      playerId,
      number: shirtNumber,
      ...(label ? { label } : {}),
      ...(captainId && captainId === playerId ? { captain: true as const } : {}),
    };
    players.push(player);
  }

  return {
    formation: formationKey,
    ...(teamLabel ? { teamLabel } : {}),
    players,
  };
}
