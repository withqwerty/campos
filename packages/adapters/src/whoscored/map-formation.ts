import {
  parseFormationKey,
  getFormationPositions,
  type FormationPlayer,
  type FormationTeamData,
} from "@withqwerty/campos-schema";
import { STARTER_COUNT } from "../shared/constants.js";

/**
 * Shape of a single player inside WhoScored's `matchCentreData.home.players`
 * (or `.away.players`). Only the fields Campos actually uses are listed —
 * real WhoScored payloads carry much more (stats, ratings, etc.) which we
 * intentionally ignore.
 */
export type WhoScoredPlayer = {
  playerId: number;
  shirtNo?: number;
  name: string;
  position?: string;
  isFirstEleven?: boolean;
};

/**
 * A single entry in WhoScored's `formations[]` array. WhoScored records one
 * entry per formation interval, so a team with substitutions will have
 * multiple entries even if the shape never changes. `formations[0]` is the
 * kickoff formation.
 *
 * Parallel arrays (`playerIds`, `jerseyNumbers`, `formationSlots`) describe
 * the full match-day squad (starters + bench). The first 11 entries are
 * starters; `formationSlots` is 1..11 for starters and 0 for bench.
 */
export type WhoScoredFormationEntry = {
  formationId?: number;
  formationName: string;
  period?: number;
  startMinuteExpanded?: number;
  endMinuteExpanded?: number;
  subOnPlayerId?: number;
  subOffPlayerId?: number;
  jerseyNumbers?: number[];
  formationSlots?: number[];
  playerIds?: number[];
  captainPlayerId?: number;
  formationPositions?: Array<{ vertical: number; horizontal: number }>;
};

/**
 * A team object from WhoScored's `matchCentreData`. Campos calls this with
 * either `matchCentreData.home` or `matchCentreData.away`.
 */
export type WhoScoredMatchCentreTeam = {
  teamId?: number;
  name?: string;
  players: WhoScoredPlayer[];
  formations: WhoScoredFormationEntry[];
};

/**
 * Decode a WhoScored `matchCentreData` team object into canonical
 * `FormationTeamData`.
 *
 * Unlike the Opta lineup-event decoder, WhoScored is self-contained: names
 * and jersey numbers live inline on each player, so no squad index join is
 * needed. The function takes `formations[0]` as the kickoff formation and
 * ignores mid-match formation changes (deferred to v0.4). The first 11
 * entries of `playerIds` are treated as starters — WhoScored guarantees
 * this ordering via `formationSlots` (1..11 for starters, 0 for bench).
 *
 * Captain is derived from `formations[0].captainPlayerId` when present; if
 * absent, the `captain` flag is simply omitted.
 *
 * Throws on:
 * - missing or empty `formations[]`
 * - missing `players[]`
 * - missing `playerIds[]` on the kickoff formation
 * - parallel array length mismatch between `playerIds` and `jerseyNumbers`
 * - fewer than 11 entries in `playerIds`
 * - unknown formation name (via `parseFormationKey`)
 */
export function mapWhoScoredFormation(team: WhoScoredMatchCentreTeam): FormationTeamData {
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

  const playerIds = kickoff.playerIds ?? [];
  const jerseyNumbers = kickoff.jerseyNumbers ?? [];
  // WhoScored supplies exact per-player coordinates in `formationPositions`.
  // When present, we skip the mplsoccer slot table entirely and feed the
  // coordinates as explicit `x`, `y` overrides on each player — which the
  // core layout honours in `layoutSingleTeam`. WhoScored coordinates use a
  // 0..10 grid where `vertical` is the attacking axis (0 = own goal) and
  // `horizontal` is the width (0..10). Scale to Campos 0..100.
  const formationPositions = kickoff.formationPositions ?? [];

  if (playerIds.length === 0) {
    throw new Error("WhoScored kickoff formation missing playerIds[]");
  }
  if (jerseyNumbers.length !== playerIds.length) {
    throw new Error(
      `WhoScored parallel arrays inconsistent: playerIds has ${playerIds.length} entries, jerseyNumbers has ${jerseyNumbers.length}`,
    );
  }
  if (playerIds.length < STARTER_COUNT) {
    throw new Error(
      `WhoScored formation has fewer than ${STARTER_COUNT} slots: ${playerIds.length}`,
    );
  }

  // Build a playerId → player lookup so labels stay stable even if the
  // order of `team.players` does not match the order of `playerIds`.
  const playerLookup = new Map<number, WhoScoredPlayer>();
  for (const p of team.players) {
    playerLookup.set(p.playerId, p);
  }

  const captainId = kickoff.captainPlayerId;

  const useFormationPositions = formationPositions.length >= STARTER_COUNT;

  const players: FormationPlayer[] = [];
  for (let i = 0; i < STARTER_COUNT; i += 1) {
    const playerId = playerIds[i];
    const shirtNumber = jerseyNumbers[i];
    const position = positions[i];
    if (playerId == null || shirtNumber == null || position == null) {
      // Defensive: length guards above make this unreachable, but
      // noUncheckedIndexedAccess needs an explicit narrowing path.
      throw new Error(`internal error: missing starter data at slot ${i + 1}`);
    }
    const wsPlayer = playerLookup.get(playerId);
    const label = wsPlayer?.name;
    const player: FormationPlayer = {
      slot: position.slot,
      positionCode: position.code,
      playerId: String(playerId),
      number: shirtNumber,
      ...(label ? { label } : {}),
      ...(captainId != null && captainId === playerId ? { captain: true as const } : {}),
    };
    if (useFormationPositions) {
      const wsPos = formationPositions[i];
      if (wsPos) {
        // WhoScored `vertical` is the attacking axis (0 = own goal, 10 = opposition).
        // `horizontal` is width (0..10). Scale linearly to Campos 0..100. The
        // layout applies touchline insets and side rotation on top.
        player.x = (wsPos.vertical / 10) * 100;
        player.y = (wsPos.horizontal / 10) * 100;
      }
    }
    players.push(player);
  }

  const teamLabel = team.name;
  return {
    formation: formationKey,
    ...(teamLabel ? { teamLabel } : {}),
    players,
  };
}
