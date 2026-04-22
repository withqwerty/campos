import type {
  MatchContext,
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
import { validatePeriod } from "../shared/normalize.js";
import { asArray, parseXmlDocument } from "../shared/xml.js";

type RawSportecPlayerNode = {
  PersonId: string;
  ShirtNumber?: number;
  FirstName?: string;
  LastName?: string;
  Shortname?: string;
  Starting?: boolean | string;
  PlayingPosition?: string;
  TeamLeader?: boolean | string;
};

type RawSportecTeamNode = {
  TeamId: string;
  TeamName: string;
  Role: string;
  LineUp: string;
  Players?: {
    Player?: RawSportecPlayerNode | readonly RawSportecPlayerNode[];
  };
};

type RawSportecRefereeNode = {
  PersonId: string;
  Role: string;
  FirstName?: string;
  LastName?: string;
  Shortname?: string;
};

type RawSportecMetaDocument = {
  PutDataRequest?: {
    MatchInformation?: {
      General?: Record<string, unknown>;
      Environment?: Record<string, unknown>;
      Teams?: {
        Team?: RawSportecTeamNode | readonly RawSportecTeamNode[];
      };
      Referees?: {
        Referee?: RawSportecRefereeNode | readonly RawSportecRefereeNode[];
      };
      OtherGameInformation?: Record<string, unknown>;
    };
  };
};

type RawSportecEventNode = Record<string, unknown>;

type RawSportecEventDocument = {
  PutDataRequest?: {
    Event?: RawSportecEventNode | readonly RawSportecEventNode[];
  };
};

export type SportecTeamPlayer = {
  playerId: string;
  shirtNumber: number | null;
  firstName?: string | null;
  lastName?: string | null;
  shortName?: string | null;
  starting: boolean;
  playingPosition?: string | null;
  captain: boolean;
};

export type SportecTeam = {
  teamId: string;
  teamLabel: string;
  role: "home" | "away";
  lineUp: string;
  players: SportecTeamPlayer[];
};

export type SportecOfficial = {
  officialId: string;
  name: string;
  role: string;
};

export type SportecMeta = {
  matchId: string;
  competitionId?: string;
  competitionName?: string;
  season?: string;
  kickoffTime?: string;
  homeTeamId: string;
  homeTeamLabel: string;
  awayTeamId: string;
  awayTeamLabel: string;
  homeScore: number | null;
  awayScore: number | null;
  pitchDimensions: {
    length: number;
    width: number;
  };
  stadiumName?: string;
  spectators?: number | null;
  teams: SportecTeam[];
  officials: SportecOfficial[];
  totalTimeFirstHalfMs?: number;
  totalTimeSecondHalfMs?: number;
};

export type SportecEvent = {
  matchId: string;
  eventId: string;
  eventTime: string;
  xPosition?: number;
  yPosition?: number;
  xSourcePosition?: number;
  ySourcePosition?: number;
  kind: string;
  gameSection?: string;
  teamId?: string;
  teamLeft?: string;
  teamRight?: string;
  data: Record<string, unknown>;
  play?: Record<string, unknown>;
};

export type SportecEventChainEntry = {
  kind: string;
  data: Record<string, unknown>;
};

/**
 * Maps Sportec string event ids onto stable numeric ids for the Opta
 * intermediate representation, and preserves the originals so rebrand can
 * restore them on canonical outputs. Substitution player-on events use a
 * synthetic key `${eventId}:in` to keep their numeric id distinct from the
 * organic neighbour at `base.id + 1`.
 */
export type SportecIdAllocator = {
  allocate(key: string): number;
  resolve(numericId: number): string | undefined;
};

export function makeSportecIdAllocator(): SportecIdAllocator {
  const byKey = new Map<string, number>();
  const byNumeric = new Map<number, string>();
  let counter = 0;
  return {
    allocate(key: string): number {
      const existing = byKey.get(key);
      if (existing != null) return existing;
      counter += 1;
      byKey.set(key, counter);
      byNumeric.set(counter, key);
      return counter;
    },
    resolve(numericId: number): string | undefined {
      return byNumeric.get(numericId);
    },
  };
}

const SPORTEC_EVENT_ATTRIBUTE_KEYS = new Set([
  "MatchId",
  "EventId",
  "EventTime",
  "X-Position",
  "Y-Position",
  "X-Source-Position",
  "Y-Source-Position",
  "X-PositionFromTracking",
  "Y-PositionFromTracking",
  "CalculatedFrame",
  "CalculatedTimestamp",
]);

export function parseSportecMetaXml(xml: string): SportecMeta {
  const document = parseXmlDocument(xml) as RawSportecMetaDocument;
  const matchInformation = document.PutDataRequest?.MatchInformation;
  const general = matchInformation?.General;
  const environment = matchInformation?.Environment;

  if (!matchInformation || !general || !environment) {
    throw new Error(
      "Sportec metadata XML is missing MatchInformation/General/Environment.",
    );
  }

  const teams = asArray<RawSportecTeamNode>(matchInformation.Teams?.Team).map((team) =>
    normalizeSportecTeam(team),
  );
  const home = teams.find((team) => team.role === "home");
  const away = teams.find((team) => team.role === "away");
  if (!home || !away) {
    throw new Error("Sportec metadata XML requires both home and away teams.");
  }

  const { homeScore, awayScore } = parseSportecScore(readString(general.Result));
  const officials = asArray<RawSportecRefereeNode>(
    matchInformation.Referees?.Referee,
  ).map((referee) => ({
    officialId: referee.PersonId,
    name:
      referee.Shortname ||
      [referee.FirstName, referee.LastName].filter(Boolean).join(" "),
    role: referee.Role,
  }));
  const stadiumName = readOptionalString(environment.StadiumName);
  const spectators = readOptionalNumber(environment.NumberOfSpectators);
  const competitionId = readOptionalString(general.CompetitionId);
  const competitionName = readOptionalString(general.CompetitionName);
  const season = readOptionalString(general.Season);
  const kickoffTime = readOptionalString(general.KickoffTime);
  const totalTimeFirstHalfMs = readOptionalNumber(
    matchInformation.OtherGameInformation?.TotalTimeFirstHalf,
  );
  const totalTimeSecondHalfMs = readOptionalNumber(
    matchInformation.OtherGameInformation?.TotalTimeSecondHalf,
  );

  return {
    matchId: readString(general.MatchId),
    homeTeamId: readString(general.HomeTeamId),
    homeTeamLabel: readString(general.HomeTeamName),
    awayTeamId: readString(general.GuestTeamId),
    awayTeamLabel: readString(general.GuestTeamName),
    homeScore,
    awayScore,
    pitchDimensions: {
      length: readNumber(environment.PitchX),
      width: readNumber(environment.PitchY),
    },
    teams,
    officials,
    ...(stadiumName ? { stadiumName } : {}),
    ...(spectators != null ? { spectators } : {}),
    ...(competitionId ? { competitionId } : {}),
    ...(competitionName ? { competitionName } : {}),
    ...(season ? { season } : {}),
    ...(kickoffTime ? { kickoffTime } : {}),
    ...(totalTimeFirstHalfMs != null ? { totalTimeFirstHalfMs } : {}),
    ...(totalTimeSecondHalfMs != null ? { totalTimeSecondHalfMs } : {}),
  };
}

export function parseSportecEventXml(xml: string): SportecEvent[] {
  const document = parseXmlDocument(xml) as RawSportecEventDocument;
  const rawEvents = asArray<RawSportecEventNode>(document.PutDataRequest?.Event);

  return rawEvents.map((event) => normalizeSportecEvent(event));
}

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

export function buildSportecMatchContext(
  meta: SportecMeta,
  events: readonly SportecEvent[],
): MatchContext {
  const directions = new Map<number, "increasing-x" | "decreasing-x">();

  for (const event of events) {
    if (event.kind !== "KickOff" || !event.gameSection) continue;
    const period = sportecGameSectionToPeriod(event.gameSection);
    if (!period) continue;

    if (event.teamLeft && event.teamRight) {
      directions.set(
        period,
        sportecLeftRightToHomeDirection(meta, event.teamLeft, event.teamRight),
      );
      continue;
    }

    const previous = directions.get(period - 1);
    if (previous) {
      directions.set(period, invertDirection(previous));
    }
  }

  const firstHalf = directions.get(1);
  const secondHalf =
    directions.get(2) ?? (firstHalf ? invertDirection(firstHalf) : undefined);
  if (!firstHalf || !secondHalf) {
    throw new Error(
      `Sportec match context for ${meta.matchId} requires kickoff direction for the first two periods. Provide a KickOff event for firstHalf and secondHalf with TeamLeft/TeamRight attributes, or pass a pre-built MatchContext.`,
    );
  }

  const extraTimeFirstHalf = directions.get(3);
  const extraTimeSecondHalf = directions.get(4);

  return {
    matchId: meta.matchId,
    homeTeamId: meta.homeTeamId,
    awayTeamId: meta.awayTeamId,
    pitchDimensions: meta.pitchDimensions,
    periods: {
      firstHalf: { homeAttacksToward: firstHalf },
      secondHalf: { homeAttacksToward: secondHalf },
      ...(extraTimeFirstHalf
        ? {
            extraTimeFirstHalf: {
              homeAttacksToward: extraTimeFirstHalf,
            },
          }
        : {}),
      ...(extraTimeSecondHalf
        ? {
            extraTimeSecondHalf: {
              homeAttacksToward: extraTimeSecondHalf,
            },
          }
        : {}),
    },
  };
}

export function normalizeSportecCoordinates(
  matchContext: MatchContext,
  teamId: string,
  period: number,
  x: number,
  y: number,
): { x: number; y: number } | null {
  const normalizedPeriod = validatePeriod(period, "Sportec");
  // Shootout coordinates are not attacker-relative in the Sportec feed.
  if (normalizedPeriod === 5) {
    return null;
  }

  if (
    !matchContext.pitchDimensions ||
    !matchContext.periods ||
    !matchContext.homeTeamId ||
    !matchContext.awayTeamId
  ) {
    throw new Error(
      "Sportec coordinate normalization requires pitchDimensions and period directions in matchContext.",
    );
  }

  const homeDirection =
    normalizedPeriod === 1
      ? matchContext.periods.firstHalf.homeAttacksToward
      : normalizedPeriod === 2
        ? matchContext.periods.secondHalf.homeAttacksToward
        : normalizedPeriod === 3
          ? matchContext.periods.extraTimeFirstHalf?.homeAttacksToward
          : matchContext.periods.extraTimeSecondHalf?.homeAttacksToward;

  if (!homeDirection) {
    throw new Error(`Sportec period ${normalizedPeriod} is missing direction metadata.`);
  }

  const attacksTowardIncreasingX =
    teamId === matchContext.homeTeamId
      ? homeDirection === "increasing-x"
      : homeDirection === "decreasing-x";

  return sportecToCampos(
    x,
    y,
    matchContext.pitchDimensions.length,
    matchContext.pitchDimensions.width,
    attacksTowardIncreasingX,
  );
}

export function sportecToCampos(
  x: number,
  y: number,
  pitchLength: number,
  pitchWidth: number,
  attacksTowardIncreasingX: boolean,
): { x: number; y: number } {
  const normalizedX = clampToCamposRange((x / pitchLength) * 100);
  const normalizedY = clampToCamposRange((y / pitchWidth) * 100);

  if (attacksTowardIncreasingX) {
    return { x: normalizedX, y: normalizedY };
  }

  return {
    x: clampToCamposRange(100 - normalizedX),
    y: clampToCamposRange(100 - normalizedY),
  };
}

export function buildSportecAttackRelativeContext(meta: SportecMeta): ContextWithPeriods {
  return {
    matchId: meta.matchId,
    homeTeamId: meta.homeTeamId,
    awayTeamId: meta.awayTeamId,
    attackRelative: true,
    periods: {
      firstHalf: { homeAttacksToward: "increasing-x" },
      secondHalf: { homeAttacksToward: "increasing-x" },
      extraTimeFirstHalf: { homeAttacksToward: "increasing-x" },
      extraTimeSecondHalf: { homeAttacksToward: "increasing-x" },
    },
  };
}

export function buildSportecPlayerIndex(
  meta: SportecMeta,
): Map<string, SportecTeamPlayer & { teamId: string }> {
  const index = new Map<string, SportecTeamPlayer & { teamId: string }>();
  for (const team of meta.teams) {
    for (const player of team.players) {
      index.set(player.playerId, { ...player, teamId: team.teamId });
    }
  }
  return index;
}

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

function normalizeSportecTeam(team: RawSportecTeamNode): SportecTeam {
  const roleLower = typeof team.Role === "string" ? team.Role.toLowerCase() : null;
  const role =
    roleLower === "home"
      ? "home"
      : roleLower === "guest" || roleLower === "away"
        ? "away"
        : null;
  if (!role) {
    throw new Error(
      `Unsupported Sportec team role (teamId=${team.TeamId}): ${team.Role}`,
    );
  }

  return {
    teamId: team.TeamId,
    teamLabel: team.TeamName,
    role,
    lineUp: team.LineUp,
    players: asArray<RawSportecPlayerNode>(team.Players?.Player).map((player) => ({
      playerId: player.PersonId,
      shirtNumber: readOptionalNumber(player.ShirtNumber) ?? null,
      firstName: player.FirstName ?? null,
      lastName: player.LastName ?? null,
      shortName: player.Shortname ?? null,
      starting: player.Starting === true || player.Starting === "true",
      playingPosition: player.PlayingPosition ?? null,
      captain: player.TeamLeader === true || player.TeamLeader === "true",
    })),
  };
}

function normalizeSportecEvent(event: RawSportecEventNode): SportecEvent {
  const childEntry = Object.entries(event).find(
    ([key]) => !SPORTEC_EVENT_ATTRIBUTE_KEYS.has(key),
  );
  if (!childEntry) {
    throw new Error("Sportec event XML entry is missing an event payload element.");
  }

  const [kind, rawData] = childEntry;
  const data = isRecord(rawData) ? rawData : {};
  const play = isRecord(data.Play) ? data.Play : undefined;
  const teamId =
    readOptionalString(data.Team) ??
    readOptionalString(play?.Team) ??
    readOptionalString(data.WinnerTeam) ??
    readOptionalString(data.LoserTeam);
  const xPosition = readOptionalNumber(event["X-Position"]);
  const yPosition = readOptionalNumber(event["Y-Position"]);
  const xSourcePosition = readOptionalNumber(event["X-Source-Position"]);
  const ySourcePosition = readOptionalNumber(event["Y-Source-Position"]);
  const gameSection = readOptionalString(data.GameSection);
  const teamLeft = readOptionalString(data.TeamLeft);
  const teamRight = readOptionalString(data.TeamRight);

  return {
    matchId: readString(event.MatchId),
    eventId: String(event.EventId),
    eventTime: readString(event.EventTime),
    ...(xPosition != null ? { xPosition } : {}),
    ...(yPosition != null ? { yPosition } : {}),
    ...(xSourcePosition != null ? { xSourcePosition } : {}),
    ...(ySourcePosition != null ? { ySourcePosition } : {}),
    kind,
    ...(gameSection ? { gameSection } : {}),
    ...(teamId ? { teamId } : {}),
    ...(teamLeft ? { teamLeft } : {}),
    ...(teamRight ? { teamRight } : {}),
    data,
    ...(play ? { play } : {}),
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
      candidateCodes: getSportecCandidateCodes(player.playingPosition),
    })),
  );

  const starters = startersRaw.map((player) =>
    createSportecPlayer(player, true, slotAssignments),
  );
  const bench = benchRaw.map((player) =>
    createSportecPlayer(player, false, slotAssignments),
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

function createSportecPlayer(
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

function getSportecCandidateCodes(position: string | null | undefined): string[] {
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

function sportecLeftRightToHomeDirection(
  meta: SportecMeta,
  teamLeft: string,
  teamRight: string,
): "increasing-x" | "decreasing-x" {
  if (teamLeft === meta.homeTeamId) return "increasing-x";
  if (teamRight === meta.homeTeamId) return "decreasing-x";
  throw new Error("Sportec kickoff direction does not reference the home team.");
}

function sportecGameSectionToPeriod(section: string): 1 | 2 | 3 | 4 | 5 | null {
  switch (section) {
    case "firstHalf":
      return 1;
    case "secondHalf":
      return 2;
    case "firstHalfExtra":
    case "extraFirstHalf":
    case "firstExtraHalf":
      return 3;
    case "secondHalfExtra":
    case "extraSecondHalf":
    case "secondExtraHalf":
      return 4;
    case "penaltyShootout":
    case "penaltyShootOut":
    case "shootout":
      return 5;
    default:
      return null;
  }
}

function invertDirection(
  direction: "increasing-x" | "decreasing-x",
): "increasing-x" | "decreasing-x" {
  return direction === "increasing-x" ? "decreasing-x" : "increasing-x";
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

function parseSportecScore(result: string): {
  homeScore: number | null;
  awayScore: number | null;
} {
  const match = result.match(/^(\d+):(\d+)$/);
  if (!match) {
    return { homeScore: null, awayScore: null };
  }

  return {
    homeScore: Number.parseInt(match[1] ?? "", 10),
    awayScore: Number.parseInt(match[2] ?? "", 10),
  };
}

function readString(value: unknown): string {
  if (typeof value === "string" && value.length > 0) return value;
  throw new Error(`Expected string value, got ${String(value)}`);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number {
  const numeric = readOptionalNumber(value);
  if (numeric == null) {
    throw new Error(`Expected numeric value, got ${String(value)}`);
  }
  return numeric;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
