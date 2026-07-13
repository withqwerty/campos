import { asArray, parseXmlDocument } from "../shared/xml.js";

import type { SportecEvent, SportecMeta, SportecTeam } from "./types.js";

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

/** Parse the raw DFL match-information XML into a provider-normalised record. */
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

/** Parse the raw DFL event XML without imposing canonical football semantics. */
export function parseSportecEventXml(xml: string): SportecEvent[] {
  const document = parseXmlDocument(xml) as RawSportecEventDocument;
  const rawEvents = asArray<RawSportecEventNode>(document.PutDataRequest?.Event);

  return rawEvents.map((event) => normalizeSportecEvent(event));
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

function parseSportecScore(result: string): {
  homeScore: number | null;
  awayScore: number | null;
} {
  const match = result.match(/^(\d+):(\d+)$/);
  if (!match) return { homeScore: null, awayScore: null };
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
  if (numeric == null) throw new Error(`Expected numeric value, got ${String(value)}`);
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
