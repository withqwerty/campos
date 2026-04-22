// ---------------------------------------------------------------------------
// StatsBomb raw event types (derived from StatsBomb Open Data fixtures)
// ---------------------------------------------------------------------------

export type StatsBombRef = {
  id: number;
  name: string;
};

export type StatsBombEvent = {
  id: string;
  index: number;
  period: number;
  timestamp: string;
  minute: number;
  second: number;
  type: StatsBombRef;
  possession: number;
  possession_team: StatsBombRef;
  play_pattern: StatsBombRef;
  team: StatsBombRef;
  player?: StatsBombRef;
  position?: StatsBombRef;
  location?: [number, number];
  duration?: number;
  under_pressure?: boolean;
  counterpress?: boolean;
  off_camera?: boolean;
  related_events?: string[];
  tactics?: StatsBombTactics;
  shot?: StatsBombShot;
  pass?: StatsBombPass;
  carry?: StatsBombCarry;
  duel?: StatsBombDuel;
  foul_committed?: StatsBombFoulCommitted;
  substitution?: StatsBombSubstitution;
  goalkeeper?: StatsBombGoalkeeper;
  clearance?: StatsBombClearance;
  interception?: StatsBombInterception;
  ball_recovery?: StatsBombBallRecovery;
  dribble?: StatsBombDribble;
  bad_behaviour?: StatsBombBadBehaviour;
};

export type StatsBombShot = {
  statsbomb_xg: number;
  end_location: number[];
  key_pass_id?: string;
  body_part: StatsBombRef;
  type: StatsBombRef;
  outcome: StatsBombRef;
  technique?: StatsBombRef;
  first_time?: boolean;
  freeze_frame?: StatsBombFreezeFrameEntry[];
};

export type StatsBombPass = {
  end_location: [number, number];
  length: number;
  angle: number;
  height: StatsBombRef;
  recipient?: StatsBombRef;
  body_part?: StatsBombRef;
  type?: StatsBombRef;
  outcome?: StatsBombRef;
  goal_assist?: boolean;
  cross?: boolean;
  through_ball?: boolean;
  technique?: StatsBombRef;
  assisted_shot_id?: string;
};

export type StatsBombCarry = {
  end_location: [number, number];
};

export type StatsBombDuel = {
  type: StatsBombRef;
  outcome?: StatsBombRef;
};

export type StatsBombFoulCommitted = {
  card?: StatsBombRef;
  type?: StatsBombRef;
  offensive?: boolean;
  penalty?: boolean;
  advantage?: boolean;
};

export type StatsBombSubstitution = {
  replacement: StatsBombRef;
  outcome?: StatsBombRef;
};

export type StatsBombGoalkeeper = {
  type: StatsBombRef;
  outcome?: StatsBombRef;
  body_part?: StatsBombRef;
  technique?: StatsBombRef;
  position?: StatsBombRef;
};

export type StatsBombClearance = {
  body_part?: StatsBombRef;
  head?: boolean;
  aerial_won?: boolean;
};

export type StatsBombInterception = {
  outcome?: StatsBombRef;
};

export type StatsBombBallRecovery = {
  offensive?: boolean;
  recovery_failure?: boolean;
};

export type StatsBombDribble = {
  outcome: StatsBombRef;
  overrun?: boolean;
  nutmeg?: boolean;
  no_touch?: boolean;
};

export type StatsBombBadBehaviour = {
  card?: StatsBombRef;
};

export type StatsBombFreezeFrameEntry = {
  location: [number, number];
  player: StatsBombRef;
  position: StatsBombRef;
  teammate: boolean;
};

export type StatsBombTactics = {
  formation: number;
  lineup: StatsBombTacticsLineupEntry[];
};

export type StatsBombTacticsLineupEntry = {
  player: StatsBombRef;
  position: StatsBombRef;
  jersey_number: number;
};

export type StatsBombLineupTeam = {
  team_id: number;
  team_name: string;
  lineup: StatsBombLineupPlayer[];
};

export type StatsBombLineupPlayer = {
  player_id: number;
  player_name: string;
  player_nickname?: string | null;
  jersey_number: number;
  country?: StatsBombRef;
  cards: StatsBombLineupCard[];
  positions: StatsBombLineupPosition[];
};

export type StatsBombLineupCard = {
  time: string;
  card_type: string;
  reason?: string;
  period: number;
};

export type StatsBombLineupPosition = {
  position_id: number;
  position: string;
  from: string;
  to: string | null;
  from_period: number;
  to_period: number | null;
  start_reason: string;
  end_reason: string;
};

// ---------------------------------------------------------------------------
// Match info — simplified wrapper provided by the consumer
// ---------------------------------------------------------------------------

export type StatsBombMatchInfo = {
  id: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
};
