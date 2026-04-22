import type {
  CarryEvent,
  MatchLineups,
  TeamSheet,
  TeamSheetPlayer,
} from "@withqwerty/campos-schema";
import { parseFormationKey } from "@withqwerty/campos-schema";

import type { ContextWithPeriods } from "../opta/normalize.js";
import { Q, type OptaEvent } from "../opta/qualifiers.js";
import { assignFormationSlots } from "../shared/assign-formation-slots.js";
import { clampToCamposRange } from "../shared/coordinates.js";
import { STARTER_COUNT } from "../shared/constants.js";

const IMPECT_PITCH_LENGTH = 105;
const IMPECT_PITCH_WIDTH = 68;
const IMPECT_HALF_LENGTH_SECONDS = 45 * 60;

const IMPECT_FORMATION_ALIASES: Record<string, string> = {
  "4-4-2 (diamond)": "4312",
  "4-4-2 (flat)": "442",
  "5-1-2-2": "532",
  "5-1-3-1": "541",
  "5-2-1-2": "532",
  "5-4-1 (flat)": "541",
};

export type ImpectClock = {
  gameTime: string;
  gameTimeInSec: number;
};

export type ImpectCoordinates = {
  x: number;
  y: number;
};

export type ImpectEventLocation = {
  coordinates?: ImpectCoordinates | null;
  adjCoordinates?: ImpectCoordinates | null;
};

export type ImpectPlayerProfile = {
  id: number;
  firstname?: string | null;
  lastname?: string | null;
  commonname?: string | null;
};

export type ImpectSquad = {
  id: number;
  name: string;
};

export type ImpectRosterPlayer = {
  id: number;
  shirtNumber: number;
};

export type ImpectStartingPosition = {
  playerId: number;
  position: string;
  positionSide: string;
};

export type ImpectSubstitution = {
  gameTime: ImpectClock;
  playerId: number;
  toPosition: string;
  positionSide: string;
  fromPosition: string;
  fromPositionSide: string;
};

export type ImpectLineupTeam = {
  id: number;
  players: readonly ImpectRosterPlayer[];
  startingPositions: readonly ImpectStartingPosition[];
  substitutions: readonly ImpectSubstitution[];
  startingFormation: string;
};

export type ImpectLineups = {
  id: number;
  squadHome: ImpectLineupTeam;
  squadAway: ImpectLineupTeam;
};

export type ImpectPlayerRef = {
  id: number;
  position: string;
  positionSide: string;
};

export type ImpectPassReceiver = {
  playerId: number;
  type: string;
};

export type ImpectPass = {
  distance?: number | null;
  angle?: number | null;
  receiver?: ImpectPassReceiver | null;
};

export type ImpectShotTargetPoint = {
  y: number;
  z: number;
};

export type ImpectShot = {
  distance?: number | null;
  angle?: number | null;
  targetPoint?: ImpectShotTargetPoint | null;
  woodwork?: boolean | null;
};

export type ImpectEvent = {
  index: number;
  id: number;
  gameTime: ImpectClock;
  squadId: number;
  player?: ImpectPlayerRef | null;
  pressure?: number | null;
  actionType: string;
  start?: ImpectEventLocation | null;
  end?: ImpectEventLocation | null;
  action?: string | null;
  shot?: ImpectShot | null;
  pass?: ImpectPass | null;
  currentAttackingSquadId?: number | null;
  bodyPart?: string | null;
  bodyPartExtended?: string | null;
  duration?: number | null;
  result?: string | null;
  periodId: number;
  setPiece?: string | null;
  inferredSetPiece?: boolean | null;
};

export function mapImpectMatchLineups(
  lineups: ImpectLineups,
  squads: readonly ImpectSquad[],
  players: readonly ImpectPlayerProfile[],
): MatchLineups {
  const lookups = buildImpectLookups(squads, players);

  return {
    matchId: String(lineups.id),
    home: mapImpectTeamSheet(lineups.squadHome, lookups),
    away: mapImpectTeamSheet(lineups.squadAway, lookups),
  };
}

export function buildImpectLookups(
  squads: readonly ImpectSquad[],
  players: readonly ImpectPlayerProfile[],
): {
  squadById: Map<number, ImpectSquad>;
  playerById: Map<number, ImpectPlayerProfile>;
} {
  return {
    squadById: new Map(squads.map((squad) => [squad.id, squad] as const)),
    playerById: new Map(players.map((player) => [player.id, player] as const)),
  };
}

export function normalizeImpectFormation(rawFormation: string): string {
  const normalized = IMPECT_FORMATION_ALIASES[rawFormation] ?? rawFormation;
  return parseFormationKey(normalized);
}

export function normalizeImpectClock(
  clock: ImpectClock,
  periodId?: number,
): {
  minute: number;
  second: number;
  periodSeconds: number;
} {
  const regularTime = clock.gameTime.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  const addedTime = clock.gameTime.match(
    /^(\d+):(\d+(?:\.\d+)?) \(\+(\d+):(\d+(?:\.\d+)?)\)$/,
  );

  let totalSeconds: number;
  if (regularTime) {
    const [, minuteText, secondText] = regularTime;
    if (minuteText == null || secondText == null) {
      throw new Error(`Unsupported Impect gameTime value: ${clock.gameTime}`);
    }
    totalSeconds = Number.parseInt(minuteText, 10) * 60 + Number.parseFloat(secondText);
  } else if (addedTime) {
    const [, minuteText, secondText, extraMinuteText, extraSecondText] = addedTime;
    if (
      minuteText == null ||
      secondText == null ||
      extraMinuteText == null ||
      extraSecondText == null
    ) {
      throw new Error(`Unsupported Impect gameTime value: ${clock.gameTime}`);
    }
    totalSeconds =
      Number.parseInt(minuteText, 10) * 60 +
      Number.parseFloat(secondText) +
      Number.parseInt(extraMinuteText, 10) * 60 +
      Number.parseFloat(extraSecondText);
  } else {
    throw new Error(`Unsupported Impect gameTime value: ${clock.gameTime}`);
  }

  const minute = Math.floor(totalSeconds / 60);
  const second = Math.floor(totalSeconds % 60);
  // Impect gameTime counts from kickoff of the match; second-half and
  // extra-time-second-half seconds need the preceding half subtracted so a
  // 46-minute-stoppage event in the first half stays at periodSeconds ≈ 46*60,
  // not minute-based nonsense.
  const elapsedPeriods = periodId === 2 || periodId === 4 ? 1 : 0;
  const periodSeconds = Math.floor(
    totalSeconds - elapsedPeriods * IMPECT_HALF_LENGTH_SECONDS,
  );

  return { minute, second, periodSeconds };
}

export function buildImpectAttackRelativeContext(
  lineups: ImpectLineups,
): ContextWithPeriods {
  return {
    matchId: String(lineups.id),
    homeTeamId: String(lineups.squadHome.id),
    awayTeamId: String(lineups.squadAway.id),
    attackRelative: true,
    periods: {
      firstHalf: { homeAttacksToward: "increasing-x" },
      secondHalf: { homeAttacksToward: "increasing-x" },
      extraTimeFirstHalf: { homeAttacksToward: "increasing-x" },
      extraTimeSecondHalf: { homeAttacksToward: "increasing-x" },
    },
  };
}

export function impectToCampos(
  x: number,
  y: number,
  attacksTowardIncreasingX: boolean,
): { x: number; y: number } {
  const normalizedX = clampToCamposRange(
    ((x + IMPECT_PITCH_LENGTH / 2) / IMPECT_PITCH_LENGTH) * 100,
  );
  const normalizedY = clampToCamposRange(
    ((y + IMPECT_PITCH_WIDTH / 2) / IMPECT_PITCH_WIDTH) * 100,
  );

  if (attacksTowardIncreasingX) {
    return { x: normalizedX, y: normalizedY };
  }

  return {
    x: clampToCamposRange(100 - normalizedX),
    y: clampToCamposRange(100 - normalizedY),
  };
}

export function toImpectOptaEvents(
  event: ImpectEvent,
  playerById: Map<number, ImpectPlayerProfile>,
): OptaEvent[] {
  const start = getImpectCamposLocation(event.start);
  const time = normalizeImpectClock(event.gameTime, event.periodId);
  const base: Omit<OptaEvent, "typeId" | "qualifier"> = {
    id: event.id,
    eventId: event.index,
    periodId: event.periodId,
    timeMin: time.minute,
    timeSec: time.second,
    contestantId: String(event.squadId),
    outcome: event.result === "FAIL" ? 0 : 1,
    x: start?.x ?? 0,
    y: start?.y ?? 0,
  };
  if (event.player?.id != null) {
    base.playerId = String(event.player.id);
    const playerName = getImpectDisplayName(playerById.get(event.player.id));
    if (playerName) {
      base.playerName = playerName;
    }
  }

  switch (event.actionType) {
    case "PASS":
    case "FREE_KICK":
    case "THROW_IN":
    case "GOAL_KICK":
    case "CORNER":
    case "KICK_OFF":
      return [
        {
          ...base,
          typeId: 1,
          qualifier: buildImpectPassQualifiers(event),
        },
      ];
    case "SHOT":
    case "PENALTY_KICK":
    case "OWN_GOAL": {
      const shotMapping = buildImpectShotMapping(event);
      return shotMapping
        ? [
            {
              ...base,
              typeId: shotMapping.typeId,
              qualifier: shotMapping.qualifiers,
            },
          ]
        : [];
    }
    case "LOOSE_BALL_REGAIN":
      return [{ ...base, typeId: 49, qualifier: [] }];
    case "INTERCEPTION":
      return [{ ...base, typeId: 74, qualifier: [] }];
    case "CLEARANCE":
      return [{ ...base, typeId: 12, qualifier: [] }];
    case "GK_CATCH":
      return [{ ...base, typeId: 11, qualifier: [] }];
    case "GK_SAVE":
      return [{ ...base, typeId: 10, qualifier: [] }];
    case "FOUL":
      return [{ ...base, typeId: 4, outcome: 0, qualifier: [] }];
    case "YELLOW_CARD":
      return [{ ...base, typeId: 17, qualifier: [] }];
    case "SECOND_YELLOW_CARD":
      return [{ ...base, typeId: 65, qualifier: [] }];
    case "RED_CARD":
      return [{ ...base, typeId: 68, qualifier: [] }];
    default:
      return [];
  }
}

export function mapImpectCarryEvent(
  matchId: string,
  event: ImpectEvent,
  playerById: Map<number, ImpectPlayerProfile>,
): CarryEvent | null {
  if (event.actionType !== "DRIBBLE") return null;

  const start = getImpectCamposLocation(event.start);
  const end = getImpectCamposLocation(event.end);
  if (!start || !end) return null;

  const time = normalizeImpectClock(event.gameTime, event.periodId);
  return {
    kind: "carry",
    id: `${matchId}:${event.id}`,
    matchId,
    teamId: String(event.squadId),
    playerId: event.player?.id != null ? String(event.player.id) : null,
    playerName:
      event.player?.id != null
        ? getImpectDisplayName(playerById.get(event.player.id))
        : null,
    minute: time.minute,
    addedMinute: getAddedMinute(time.minute, event.periodId),
    second: time.second,
    period: normalizeImpectPeriod(event.periodId),
    x: start.x,
    y: start.y,
    endX: end.x,
    endY: end.y,
    provider: "impect",
    providerEventId: String(event.id),
    sourceMeta: {
      actionType: event.actionType,
      action: event.action,
      result: event.result,
      rawIndex: event.index,
    },
  };
}

function mapImpectTeamSheet(
  lineup: ImpectLineupTeam,
  lookups: ReturnType<typeof buildImpectLookups>,
): TeamSheet {
  const formation = normalizeImpectFormation(lineup.startingFormation);
  const squad = lookups.squadById.get(lineup.id);
  const shirtNumberByPlayerId = new Map(
    lineup.players.map((player) => [player.id, player.shirtNumber] as const),
  );
  const starterIds = new Set(lineup.startingPositions.map((entry) => entry.playerId));
  const slotAssignments = assignFormationSlots(
    formation,
    lineup.startingPositions.map((entry) => ({
      playerId: String(entry.playerId),
      candidateCodes: getImpectCandidateCodes(
        formation,
        entry.position,
        entry.positionSide,
      ),
    })),
  );

  const starters = lineup.startingPositions.map((entry) =>
    createImpectStarter(
      entry,
      lookups.playerById.get(entry.playerId),
      shirtNumberByPlayerId,
      slotAssignments,
    ),
  );

  if (starters.length !== STARTER_COUNT) {
    throw new Error(
      `Impect lineup for squad ${lineup.id} expected ${STARTER_COUNT} starters, got ${starters.length}.`,
    );
  }

  const bench = lineup.players
    .filter((player) => !starterIds.has(player.id))
    .map((player) => createImpectBenchPlayer(player, lookups.playerById.get(player.id)));

  const playerById = new Map<string, TeamSheetPlayer>();
  for (const player of [...starters, ...bench]) {
    playerById.set(player.playerId, player);
  }

  const orderedSubstitutions = [...lineup.substitutions].sort((left, right) => {
    const leftMinute = normalizeImpectClock(left.gameTime).minute;
    const rightMinute = normalizeImpectClock(right.gameTime).minute;
    return leftMinute - rightMinute;
  });

  for (const substitution of orderedSubstitutions) {
    const player = playerById.get(String(substitution.playerId));
    if (!player) continue;

    const minute = normalizeImpectClock(substitution.gameTime).minute;
    if (substitution.fromPosition === "BANK") {
      player.substitutedIn = true;
      player.minuteOn ??= minute;
    } else if (substitution.toPosition === "BANK") {
      player.substitutedOut = true;
      player.minuteOff ??= minute;
    } else if (player.starter === true || player.substitutedIn === true) {
      // Tactical shift (neither side BANK) updates the in-play positionCode
      // snapshot without touching minuteOn/minuteOff.
      const shiftCodes = getImpectCandidateCodes(
        formation,
        substitution.toPosition,
        substitution.positionSide,
      );
      if (shiftCodes[0]) {
        player.positionCode = shiftCodes[0];
      }
    }
  }

  return {
    teamId: String(lineup.id),
    ...(squad?.name ? { teamLabel: squad.name } : {}),
    formation,
    starters,
    bench,
  };
}

function createImpectStarter(
  entry: ImpectStartingPosition,
  profile: ImpectPlayerProfile | undefined,
  shirtNumberByPlayerId: Map<number, number>,
  slotAssignments: Map<string, { slot?: number; positionCode?: string }>,
): TeamSheetPlayer {
  const assignment = slotAssignments.get(String(entry.playerId));

  return {
    playerId: String(entry.playerId),
    label: getImpectDisplayName(profile),
    number: shirtNumberByPlayerId.get(entry.playerId) ?? null,
    ...(assignment?.positionCode ? { positionCode: assignment.positionCode } : {}),
    ...(assignment?.slot != null ? { slot: assignment.slot } : {}),
    starter: true,
  };
}

function createImpectBenchPlayer(
  player: ImpectRosterPlayer,
  profile: ImpectPlayerProfile | undefined,
): TeamSheetPlayer {
  return {
    playerId: String(player.id),
    label: getImpectDisplayName(profile),
    number: player.shirtNumber,
    starter: false,
  };
}

function getImpectDisplayName(profile: ImpectPlayerProfile | undefined): string | null {
  const common = profile?.commonname?.trim();
  if (common) return common;

  const combined = [profile?.firstname?.trim(), profile?.lastname?.trim()]
    .filter((value): value is string => Boolean(value && value.length > 0))
    .join(" ");

  return combined.length > 0 ? combined : null;
}

function buildImpectPassQualifiers(event: ImpectEvent) {
  const qualifiers: { qualifierId: number; value?: string }[] = [];
  const end = getImpectCamposLocation(event.end);
  if (end) {
    qualifiers.push({ qualifierId: Q.PASS_END_X, value: String(end.x) });
    qualifiers.push({ qualifierId: Q.PASS_END_Y, value: String(end.y) });
  }

  switch (event.actionType) {
    case "FREE_KICK":
      qualifiers.push({ qualifierId: Q.FREE_KICK_TAKEN });
      break;
    case "THROW_IN":
      qualifiers.push({ qualifierId: Q.THROW_IN });
      break;
    case "GOAL_KICK":
      qualifiers.push({ qualifierId: Q.GOAL_KICK });
      break;
    case "CORNER":
      qualifiers.push({ qualifierId: Q.CORNER_TAKEN });
      break;
    case "KICK_OFF":
      qualifiers.push({ qualifierId: Q.KICK_OFF });
      break;
  }

  switch (event.action) {
    case "LOW_CROSS":
    case "HIGH_CROSS":
      qualifiers.push({ qualifierId: Q.CROSS });
      break;
    case "CHIPPED_PASS":
    case "SHORT_AERIAL_PASS":
      qualifiers.push({ qualifierId: Q.LONG_BALL });
      break;
    case "DIRECT_FREE_KICK":
      qualifiers.push({ qualifierId: Q.FREE_KICK_TAKEN });
      break;
  }

  return qualifiers;
}

function buildImpectShotMapping(
  event: ImpectEvent,
): { typeId: number; qualifiers: { qualifierId: number; value?: string }[] } | null {
  if (!event.shot) return null;

  const qualifiers: { qualifierId: number; value?: string }[] = [];
  const end = getImpectCamposLocation(event.end);
  if (end) {
    qualifiers.push({ qualifierId: Q.PASS_END_X, value: String(end.x) });
    qualifiers.push({ qualifierId: Q.PASS_END_Y, value: String(end.y) });
  }

  const bodyPart = event.bodyPartExtended ?? event.bodyPart;
  if (bodyPart === "HEAD") {
    qualifiers.push({ qualifierId: Q.HEAD });
  } else if (bodyPart === "FOOT_LEFT") {
    qualifiers.push({ qualifierId: Q.LEFT_FOOT });
  } else if (bodyPart === "FOOT_RIGHT" || bodyPart === "FOOT") {
    qualifiers.push({ qualifierId: Q.RIGHT_FOOT });
  }

  const isPenalty =
    event.action === "PENALTY_KICK" || event.actionType === "PENALTY_KICK";
  const isDirectFreeKick =
    event.action === "DIRECT_FREE_KICK" || event.actionType === "FREE_KICK";
  const isFromCorner = event.setPiece === "CORNER";
  const isGenericSetPiece = Boolean(event.setPiece || event.inferredSetPiece);

  if (isPenalty) {
    qualifiers.push({ qualifierId: Q.PENALTY });
  } else if (isDirectFreeKick) {
    qualifiers.push({ qualifierId: Q.DIRECT_FREE_KICK });
  } else if (isFromCorner) {
    qualifiers.push({ qualifierId: Q.FROM_CORNER });
  } else if (isGenericSetPiece) {
    qualifiers.push({ qualifierId: Q.SET_PIECE });
  }

  if (event.actionType === "OWN_GOAL") {
    qualifiers.push({ qualifierId: Q.OWN_GOAL });
  }

  let typeId = 13;
  if (event.result === "SUCCESS") {
    typeId = 16;
  } else if (event.action === "BLOCK") {
    typeId = 15;
    qualifiers.push({ qualifierId: Q.BLOCKED });
  } else if (event.shot.targetPoint) {
    const { y, z } = event.shot.targetPoint;
    if (event.shot.woodwork) {
      typeId = 14;
    } else if (Math.abs(y) < 3.66 && z < 2.44) {
      typeId = 15;
    } else {
      typeId = 13;
    }
  }

  return { typeId, qualifiers };
}

function getImpectCamposLocation(
  location: ImpectEventLocation | null | undefined,
): { x: number; y: number } | null {
  // Only adjCoordinates are attacker-relative. Raw `coordinates` are pitch-
  // absolute and require per-team rotation using kickoff direction, which the
  // open-data slice does not expose. Surface null rather than silently
  // mirroring one team's events.
  const coords = location?.adjCoordinates;
  if (!coords) return null;
  return impectToCampos(coords.x, coords.y, true);
}

function getAddedMinute(minute: number, periodId: number): number | null {
  const boundary =
    periodId === 1
      ? 45
      : periodId === 2
        ? 90
        : periodId === 3
          ? 105
          : periodId === 4
            ? 120
            : null;
  if (boundary != null && minute > boundary) {
    return minute - boundary;
  }
  return null;
}

function normalizeImpectPeriod(periodId: number): 1 | 2 | 3 | 4 | 5 {
  if (
    periodId === 1 ||
    periodId === 2 ||
    periodId === 3 ||
    periodId === 4 ||
    periodId === 5
  ) {
    return periodId;
  }
  throw new Error(`Unsupported Impect periodId: ${periodId}`);
}

function getImpectCandidateCodes(
  formation: string,
  position: string,
  side: string,
): string[] {
  switch (position) {
    case "GOALKEEPER":
      return ["GK"];
    case "RIGHT_WINGBACK_DEFENDER":
      return ["RB"];
    case "LEFT_WINGBACK_DEFENDER":
      return ["LB"];
    case "CENTRAL_DEFENDER":
      if (side === "CENTRE_RIGHT") return ["RCB", "CB"];
      if (side === "CENTRE_LEFT") return ["LCB", "CB"];
      return ["CB", "RCB", "LCB"];
    case "DEFENSE_MIDFIELD":
      if (side === "CENTRE_RIGHT") return ["RDM", "RCM", "CDM", "CM"];
      if (side === "CENTRE_LEFT") return ["LDM", "LCM", "CDM", "CM"];
      return ["CDM", "CM", "RCM", "LCM"];
    case "ATTACKING_MIDFIELD":
      if (formation === "532" || formation === "541" || formation === "4312") {
        if (side === "CENTRE_RIGHT") return ["RCM", "CAM", "RW", "RM"];
        if (side === "CENTRE_LEFT") return ["LCM", "CAM", "LW", "LM"];
      }
      if (side === "CENTRE_RIGHT") return ["RW", "RCM", "RM", "CAM"];
      if (side === "CENTRE_LEFT") return ["LW", "LCM", "LM", "CAM"];
      return ["CAM", "CM"];
    case "RIGHT_WINGER":
      return ["RW", "RM"];
    case "LEFT_WINGER":
      return ["LW", "LM"];
    case "CENTER_FORWARD":
      if (side === "CENTRE_RIGHT") return ["RCF", "ST"];
      if (side === "CENTRE_LEFT") return ["LCF", "ST"];
      return ["ST", "RCF", "LCF"];
    default:
      return [];
  }
}
