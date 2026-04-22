export type WyscoutTag = {
  id: number;
};

export type WyscoutPlayerRole = {
  code2?: string;
  code3?: string;
  name?: string;
};

export type WyscoutPlayer = {
  wyId: number;
  shortName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  role?: WyscoutPlayerRole | null;
};

export type WyscoutTeam = {
  wyId: number;
  name?: string;
  officialName?: string;
};

export type WyscoutPosition = {
  x: number;
  y: number;
};

export type WyscoutEvent = {
  id: number;
  eventId: number;
  eventName: string;
  subEventId: number;
  subEventName: string;
  tags: WyscoutTag[];
  playerId?: number;
  positions: WyscoutPosition[];
  matchId: number;
  teamId: number;
  matchPeriod: string;
  eventSec: number;
};

export type WyscoutMatchTeamData = {
  side: "home" | "away";
  teamId: number;
  hasFormation?: number;
  formation?: WyscoutTeamFormation;
};

export type WyscoutMatch = {
  wyId: number;
  label?: string;
  teamsData: Record<string, WyscoutMatchTeamData>;
};

export type WyscoutMatchData = {
  source: string;
  match: WyscoutMatch;
  events: WyscoutEvent[];
};

export type WyscoutFormationPlayer = {
  playerId: number;
  ownGoals?: string;
  redCards?: string;
  goals?: string;
  yellowCards?: string;
};

export type WyscoutSubstitution = {
  playerIn: number;
  playerOut: number;
  minute: number;
};

export type WyscoutTeamFormation = {
  lineup: WyscoutFormationPlayer[];
  bench: WyscoutFormationPlayer[];
  substitutions: WyscoutSubstitution[];
};

export type WyscoutMatchInfo = {
  matchId?: string;
};

export type WyscoutLineupLookups = {
  players?: readonly WyscoutPlayer[];
  teams?: readonly WyscoutTeam[];
};

export type FromWyscoutMatchLineupsOptions = WyscoutLineupLookups & {
  matchId?: string;
};
