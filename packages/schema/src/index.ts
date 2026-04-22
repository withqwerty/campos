export type {
  BaseEvent,
  ShotEvent,
  PassEvent,
  MatchSummary,
  MatchSummaryTeam,
  MatchLineups,
  TeamSheet,
  TeamSheetPlayer,
  CarryEvent,
  CardEvent,
  TackleEvent,
  InterceptionEvent,
  DuelEvent,
  GoalkeeperEvent,
  ClearanceEvent,
  SubstitutionEvent,
  FoulCommittedEvent,
  TakeOnEvent,
  RecoveryEvent,
  PressureEvent,
  Shot,
  MatchContext,
  Competition,
  Season,
  Game,
  Team,
  Player,
} from "./generated.js";

import type {
  ShotEvent,
  PassEvent,
  CarryEvent,
  CardEvent,
  TackleEvent,
  InterceptionEvent,
  DuelEvent,
  GoalkeeperEvent,
  ClearanceEvent,
  SubstitutionEvent,
  FoulCommittedEvent,
  TakeOnEvent,
  RecoveryEvent,
  PressureEvent,
} from "./generated.js";

/** Union of all event kinds. */
export type Event =
  | ShotEvent
  | PassEvent
  | CarryEvent
  | CardEvent
  | TackleEvent
  | InterceptionEvent
  | DuelEvent
  | GoalkeeperEvent
  | ClearanceEvent
  | SubstitutionEvent
  | FoulCommittedEvent
  | TakeOnEvent
  | RecoveryEvent
  | PressureEvent;

/** Discriminant values for the Event union. */
export const EVENT_KINDS = [
  "shot",
  "pass",
  "carry",
  "card",
  "tackle",
  "interception",
  "duel",
  "goalkeeper",
  "clearance",
  "substitution",
  "foul-committed",
  "take-on",
  "recovery",
  "pressure",
] as const;

/** String‐literal union of every event kind. */
export type EventKind = (typeof EVENT_KINDS)[number];

export const CAMPOS_COORDINATE_BOUNDS = {
  xMin: 0,
  xMax: 100,
  yMin: 0,
  yMax: 100,
} as const;

export const SHOT_OUTCOMES = [
  "goal",
  "saved",
  "blocked",
  "off-target",
  "hit-woodwork",
  "other",
] as const;

export const SHOT_BODY_PARTS = ["left-foot", "right-foot", "head", "other"] as const;

export function clampToCamposRange(value: number): number {
  return Math.max(
    CAMPOS_COORDINATE_BOUNDS.xMin,
    Math.min(CAMPOS_COORDINATE_BOUNDS.xMax, value),
  );
}

export const clampToCamposCoordinate = clampToCamposRange;

export function hasRealXg(shot: { xg: number | null }): shot is { xg: number } {
  return typeof shot.xg === "number" && Number.isFinite(shot.xg);
}

export {
  getCountryCode,
  getCountryCodeOrFallback,
  hasFlag,
  countryMapping,
} from "./country.js";
export type { FifaCode } from "./country.js";

export {
  parseFormationKey,
  isValidFormationKey,
  allFormationKeys,
  getFormationPositions,
  getFormationSlot,
  getMplSlotForOptaSlot,
} from "./formation.js";
export type {
  FormationKey,
  FormationPlayer,
  FormationTeamData,
  FormationPositionEntry,
} from "./formation.js";

export { optaFormationIdToKey, OPTA_FORMATION_ID_MAP } from "./formation-opta-ids.js";
