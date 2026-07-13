import type { MatchContext } from "@withqwerty/campos-schema";

import { Q, type OptaEvent } from "../opta/qualifiers.js";
import { validatePeriod } from "../shared/normalize.js";

import { normalizeSportecCoordinates, sportecGameSectionToPeriod } from "./context.js";
import type { SportecIdAllocator } from "./ids.js";
import type { SportecEvent, SportecEventChainEntry, SportecTeamPlayer } from "./types.js";

export function getSportecEventChain(event: SportecEvent): SportecEventChainEntry[] {
  const chain: SportecEventChainEntry[] = [{ kind: event.kind, data: event.data }];
  let current = event.data;

  for (;;) {
    const childEntry = Object.entries(current).find(([, value]) => isRecord(value));
    if (!childEntry) {
      return chain;
    }

    const [kind, rawData] = childEntry;
    const data = rawData as Record<string, unknown>;
    chain.push({ kind, data });
    current = data;
  }
}

export function normalizeSportecEventClock(
  event: SportecEvent,
  periodStarts: readonly { period: 1 | 2 | 3 | 4 | 5; startsAtMs: number }[],
): {
  minute: number;
  addedMinute: number | null;
  second: number;
  period: 1 | 2 | 3 | 4 | 5;
} {
  const eventMs = Date.parse(event.eventTime);
  // Prefer the event's declared gameSection over elapsed-ms inference so
  // half-time events don't land in the wrong period when kickoff events are
  // missing or out of order.
  const sectionPeriod = event.gameSection
    ? sportecGameSectionToPeriod(event.gameSection)
    : null;
  const start =
    (sectionPeriod && periodStarts.find((entry) => entry.period === sectionPeriod)) ||
    [...periodStarts].reverse().find((entry) => entry.startsAtMs <= eventMs) ||
    periodStarts[0];

  if (!start) {
    throw new Error(`Unable to resolve Sportec period for event ${event.eventId}.`);
  }

  const elapsedSeconds = Math.max(0, Math.floor((eventMs - start.startsAtMs) / 1000));
  const baseMinute =
    start.period === 1
      ? 0
      : start.period === 2
        ? 45
        : start.period === 3
          ? 90
          : start.period === 4
            ? 105
            : 120;
  const rawMinute = baseMinute + Math.floor(elapsedSeconds / 60);
  const second = elapsedSeconds % 60;
  const boundary =
    start.period === 1
      ? 45
      : start.period === 2
        ? 90
        : start.period === 3
          ? 105
          : start.period === 4
            ? 120
            : 120;

  return {
    minute: rawMinute > boundary ? boundary : rawMinute,
    addedMinute: rawMinute > boundary ? rawMinute - boundary : null,
    second,
    period: start.period,
  };
}

export function buildSportecPeriodStarts(
  events: readonly SportecEvent[],
): { period: 1 | 2 | 3 | 4 | 5; startsAtMs: number }[] {
  const starts = new Map<1 | 2 | 3 | 4 | 5, number>();

  for (const event of events) {
    if (event.kind !== "KickOff" || !event.gameSection) continue;
    const period = sportecGameSectionToPeriod(event.gameSection);
    if (!period || starts.has(period)) continue;
    starts.set(period, Date.parse(event.eventTime));
  }

  return [...starts.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([period, startsAtMs]) => ({ period, startsAtMs }));
}

export function toSportecOptaEvents(input: {
  event: SportecEvent;
  nextEvent: SportecEvent | undefined;
  playerById: Map<string, SportecTeamPlayer & { teamId: string }>;
  time: {
    minute: number;
    addedMinute: number | null;
    second: number;
    period: 1 | 2 | 3 | 4 | 5;
  };
  period: 1 | 2 | 3 | 4 | 5;
  directionContext: MatchContext;
  idAllocator: SportecIdAllocator;
}): OptaEvent[] {
  const { event, nextEvent, playerById, time, period, directionContext, idAllocator } =
    input;
  // Sportec shootouts have no direction metadata, so downstream coordinate
  // normalisation cannot produce attacker-relative output. Drop them here.
  if ((period as number) === 5) return [];
  const chain = getSportecEventChain(event);
  const wrapper = chain[0];
  const leaf = chain[chain.length - 1];
  if (!wrapper || !leaf) return [];

  const teamId =
    event.teamId ??
    readSportecChainString(chain, "Team") ??
    readSportecChainString(chain, "WinnerTeam") ??
    readSportecChainString(chain, "TeamFouler");
  if (!teamId) return [];

  const playerId =
    readSportecChainString(chain, "Player") ??
    readSportecChainString(chain, "Winner") ??
    readSportecChainString(chain, "Fouler");
  const player = playerId ? playerById.get(playerId) : undefined;
  const start = resolveSportecNormalizedCoordinates(
    directionContext,
    teamId,
    period,
    event.xSourcePosition ?? event.xPosition,
    event.ySourcePosition ?? event.yPosition,
  );

  const numericId = idAllocator.allocate(event.eventId);
  const base: Omit<OptaEvent, "typeId" | "qualifier"> = {
    id: numericId,
    eventId: numericId,
    periodId: period === 5 ? 4 : period,
    timeMin: time.minute + (time.addedMinute ?? 0),
    timeSec: time.second,
    contestantId: teamId,
    outcome: 1,
    x: start?.x ?? 0,
    y: start?.y ?? 0,
  };
  if (playerId) {
    base.playerId = playerId;
  }
  const playerName = player ? getSportecDisplayName(player) : null;
  if (playerName) {
    base.playerName = playerName;
  }

  if (leaf.kind === "Pass" || leaf.kind === "Cross") {
    const end = resolveSportecPassEndCoordinates(
      directionContext,
      teamId,
      period,
      event,
      nextEvent,
    );
    return [
      {
        ...base,
        typeId: 1,
        outcome: isSportecSuccessfulPass(chain) ? 1 : 0,
        qualifier: buildSportecPassQualifiers(chain, end, leaf.kind),
      },
    ];
  }

  if (SPORTEC_SHOT_LEAF_KINDS.has(leaf.kind)) {
    const mapping = buildSportecShotMapping(chain);
    const end = resolveSportecNormalizedCoordinates(
      directionContext,
      teamId,
      period,
      event.xPosition,
      event.yPosition,
    );
    return [
      {
        ...base,
        typeId: mapping.typeId,
        qualifier: [
          ...mapping.qualifiers,
          ...(end
            ? [
                { qualifierId: Q.PASS_END_X, value: String(end.x) },
                { qualifierId: Q.PASS_END_Y, value: String(end.y) },
              ]
            : []),
        ],
      },
    ];
  }

  switch (leaf.kind) {
    case "BallClaiming":
      return [{ ...base, typeId: 49, qualifier: [] }];
    case "TacklingGame":
      return [{ ...base, typeId: 4, outcome: 1, qualifier: [] }];
    case "Foul":
      return [{ ...base, typeId: 4, outcome: 0, qualifier: [] }];
    case "Caution": {
      const typeId = mapSportecCardType(chain);
      return typeId ? [{ ...base, typeId, qualifier: [] }] : [];
    }
    case "Substitution": {
      const playerOutId = readSportecChainString(chain, "PlayerOut");
      const playerInId = readSportecChainString(chain, "PlayerIn");
      if (!playerOutId || !playerInId) return [];
      const playerOut = playerById.get(playerOutId);
      const playerIn = playerById.get(playerInId);
      const playerOutName = playerOut ? getSportecDisplayName(playerOut) : null;
      const playerInName = playerIn ? getSportecDisplayName(playerIn) : null;

      const playerOffEvent: OptaEvent = {
        ...base,
        typeId: 18,
        playerId: playerOutId,
        qualifier: [],
      };
      if (playerOutName) {
        playerOffEvent.playerName = playerOutName;
      }

      const inNumericId = idAllocator.allocate(`${event.eventId}:in`);
      const playerOnEvent: OptaEvent = {
        ...base,
        id: inNumericId,
        eventId: inNumericId,
        typeId: 19,
        playerId: playerInId,
        qualifier: [],
      };
      if (playerInName) {
        playerOnEvent.playerName = playerInName;
      }

      return [playerOffEvent, playerOnEvent];
    }
    default:
      return [];
  }
}

const SPORTEC_SHOT_LEAF_KINDS = new Set([
  "ShotWide",
  "SavedShot",
  "BlockedShot",
  "ShotWoodWork",
  "OtherShot",
  "SuccessfulShot",
  "OwnGoal",
]);

function resolveSportecPassEndCoordinates(
  directionContext: MatchContext,
  teamId: string,
  period: number,
  event: SportecEvent,
  nextEvent?: SportecEvent,
): { x: number; y: number } | null {
  // A pass end that collapses to the start point is a fake zero-length arrow
  // for density/flow metrics. Only return the own end position when it
  // actually differs from the source; otherwise surface null.
  const nextStart = resolveSportecNormalizedCoordinates(
    directionContext,
    teamId,
    period,
    nextEvent?.xSourcePosition ?? null,
    nextEvent?.ySourcePosition ?? null,
  );
  if (nextStart) return nextStart;

  const ownEnd = resolveSportecNormalizedCoordinates(
    directionContext,
    teamId,
    period,
    event.xPosition ?? null,
    event.yPosition ?? null,
  );
  if (!ownEnd) return null;

  const sameAsStart =
    event.xSourcePosition != null &&
    event.ySourcePosition != null &&
    event.xPosition === event.xSourcePosition &&
    event.yPosition === event.ySourcePosition;
  return sameAsStart ? null : ownEnd;
}

function resolveSportecNormalizedCoordinates(
  directionContext: MatchContext,
  teamId: string,
  period: number,
  x: number | null | undefined,
  y: number | null | undefined,
): { x: number; y: number } | null {
  if (typeof x !== "number" || typeof y !== "number") return null;
  const validated = validatePeriod(period, "Sportec");
  if (validated === 5) return null;
  return normalizeSportecCoordinates(directionContext, teamId, period, x, y);
}

function buildSportecPassQualifiers(
  chain: readonly SportecEventChainEntry[],
  end: { x: number; y: number } | null,
  leafKind: string,
): { qualifierId: number; value?: string }[] {
  const qualifiers: { qualifierId: number; value?: string }[] = [];
  if (end) {
    qualifiers.push({ qualifierId: Q.PASS_END_X, value: String(end.x) });
    qualifiers.push({ qualifierId: Q.PASS_END_Y, value: String(end.y) });
  }

  if (leafKind === "Cross") {
    qualifiers.push({ qualifierId: Q.CROSS });
  }
  if (chain.some((entry) => entry.kind === "ThrowIn")) {
    qualifiers.push({ qualifierId: Q.THROW_IN });
  } else if (chain.some((entry) => entry.kind === "GoalKick")) {
    qualifiers.push({ qualifierId: Q.GOAL_KICK });
  } else if (chain.some((entry) => entry.kind === "CornerKick")) {
    qualifiers.push({ qualifierId: Q.CORNER_TAKEN });
  } else if (chain.some((entry) => entry.kind === "FreeKick")) {
    qualifiers.push({ qualifierId: Q.FREE_KICK_TAKEN });
  } else if (chain.some((entry) => entry.kind === "KickOff")) {
    qualifiers.push({ qualifierId: Q.KICK_OFF });
  }

  return qualifiers;
}

function buildSportecShotMapping(chain: readonly SportecEventChainEntry[]): {
  typeId: number;
  qualifiers: { qualifierId: number; value?: string }[];
} {
  const leafKind = chain[chain.length - 1]?.kind;
  const qualifiers: { qualifierId: number; value?: string }[] = [];

  const bodyPart = readSportecChainString(chain, "TypeOfShot");
  if (bodyPart === "head") {
    qualifiers.push({ qualifierId: Q.HEAD });
  } else if (bodyPart === "leftLeg") {
    qualifiers.push({ qualifierId: Q.LEFT_FOOT });
  } else if (bodyPart === "rightLeg") {
    qualifiers.push({ qualifierId: Q.RIGHT_FOOT });
  }

  if (chain.some((entry) => entry.kind === "CornerKick")) {
    qualifiers.push({ qualifierId: Q.FROM_CORNER });
  } else if (chain.some((entry) => entry.kind === "FreeKick")) {
    qualifiers.push({ qualifierId: Q.DIRECT_FREE_KICK });
  } else if (chain.some((entry) => entry.kind === "Penalty")) {
    qualifiers.push({ qualifierId: Q.PENALTY });
  }

  switch (leafKind) {
    case "SuccessfulShot":
      return { typeId: 16, qualifiers };
    case "OwnGoal":
      return { typeId: 16, qualifiers: [...qualifiers, { qualifierId: Q.OWN_GOAL }] };
    case "ShotWoodWork":
      return { typeId: 14, qualifiers };
    case "BlockedShot":
      return { typeId: 15, qualifiers: [...qualifiers, { qualifierId: Q.BLOCKED }] };
    case "SavedShot":
      return { typeId: 15, qualifiers };
    case "ShotWide":
    case "OtherShot":
    default:
      return { typeId: 13, qualifiers };
  }
}

function mapSportecCardType(
  chain: readonly SportecEventChainEntry[],
): 17 | 65 | 68 | null {
  const color = readSportecChainString(chain, "CardColor");
  switch (color) {
    case "yellow":
      return 17;
    case "yellowRed":
      return 65;
    case "red":
      return 68;
    default:
      return null;
  }
}

function isSportecSuccessfulPass(chain: readonly SportecEventChainEntry[]): boolean {
  const evaluation = readSportecChainString(chain, "Evaluation");
  return evaluation === "successfullyCompleted" || evaluation === "successful";
}

function readSportecChainString(
  chain: readonly SportecEventChainEntry[],
  key: string,
): string | undefined {
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const value = chain[index]?.data[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function getSportecDisplayName(
  player: SportecTeamPlayer | (SportecTeamPlayer & { teamId: string }),
): string | null {
  const label =
    player.shortName || [player.firstName, player.lastName].filter(Boolean).join(" ");
  return label.length > 0 ? label : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
