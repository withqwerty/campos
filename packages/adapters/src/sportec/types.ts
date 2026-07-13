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
