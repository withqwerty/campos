import type {
  Event,
  FormationTeamData,
  MatchLineups,
  PassEvent,
  ShotEvent,
} from "@withqwerty/campos-schema";

import type { StatsBombEvent, StatsBombLineupTeam, StatsBombMatchInfo } from "./parse.js";
import { mapShot } from "./map-shot.js";
import { mapPass } from "./map-pass.js";
import { mapCarry } from "./map-carry.js";
import { mapCard } from "./map-card.js";
import { mapTackle } from "./map-tackle.js";
import { mapInterception } from "./map-interception.js";
import { mapDuel } from "./map-duel.js";
import { mapGoalkeeper } from "./map-goalkeeper.js";
import { mapClearance } from "./map-clearance.js";
import { mapSubstitution } from "./map-substitution.js";
import { mapFoul } from "./map-foul.js";
import { mapRecovery } from "./map-recovery.js";
import { mapTakeOn } from "./map-take-on.js";
import { mapPressure } from "./map-pressure.js";
import { projectShots } from "./project-shots.js";
import { projectPasses } from "./project-passes.js";
import { mapStatsBombMatchLineups } from "./map-lineups.js";
import { projectTeamSheetToFormation } from "../shared/project-formation.js";

export type { StatsBombEvent, StatsBombLineupTeam, StatsBombMatchInfo } from "./parse.js";

/** StatsBomb type.id constants. */
const BALL_RECOVERY_TYPE_ID = 2;
const DUEL_TYPE_ID = 4;
const CLEARANCE_TYPE_ID = 9;
const INTERCEPTION_TYPE_ID = 10;
const DRIBBLE_TYPE_ID = 14;
const SHOT_TYPE_ID = 16;
const SUBSTITUTION_TYPE_ID = 19;
const FOUL_COMMITTED_TYPE_ID = 22;
const GOALKEEPER_TYPE_ID = 23;
const BAD_BEHAVIOUR_TYPE_ID = 24;
const PASS_TYPE_ID = 30;
const CARRY_TYPE_ID = 43;
const PRESSURE_TYPE_ID = 17;

/**
 * StatsBomb adapter — converts raw StatsBomb events into canonical Campos events.
 *
 * Unlike Opta, StatsBomb coordinates are absolute (always attacking left-to-right),
 * so no MatchContext with period directions is needed. A simpler StatsBombMatchInfo
 * provides matchId and team identification.
 */
export const fromStatsBomb = {
  /**
   * Loss-aware event normalization.
   *
   * Returns all recognized event kinds including shots, passes, carries,
   * tackles, duels, fouls, cards, interceptions, clearances, goalkeeper
   * actions, substitutions, ball recoveries, take-ons, and pressures.
   * Unrecognized type.ids are silently skipped.
   *
   * Special dispatch rules:
   * - Duel (type.id 4): "Tackle" duel type → TackleEvent, others → DuelEvent
   * - Foul (type.id 22): always emits FoulCommittedEvent; if foul_committed.card
   *   exists, also emits a CardEvent
   * - Bad Behaviour (type.id 24): emits a CardEvent only if
   *   bad_behaviour.card is set (out-of-play bookings)
   */
  events(events: readonly StatsBombEvent[], matchInfo: StatsBombMatchInfo): Event[] {
    const result: Event[] = [];

    for (const event of events) {
      switch (event.type.id) {
        case SHOT_TYPE_ID:
          if (event.shot && event.location) {
            result.push(mapShot(event, matchInfo));
          }
          break;

        case PASS_TYPE_ID:
          if (event.pass && event.location) {
            result.push(mapPass(event, matchInfo));
          }
          break;

        case CARRY_TYPE_ID:
          if (event.carry && event.location) {
            result.push(mapCarry(event, matchInfo));
          }
          break;

        case DUEL_TYPE_ID:
          if (event.duel) {
            if (event.duel.type.name === "Tackle") {
              result.push(mapTackle(event, matchInfo));
            } else {
              result.push(mapDuel(event, matchInfo));
            }
          }
          break;

        case FOUL_COMMITTED_TYPE_ID:
          result.push(mapFoul(event, matchInfo));
          if (event.foul_committed?.card) {
            result.push(mapCard(event, event.foul_committed.card.name, matchInfo));
          }
          break;

        case BAD_BEHAVIOUR_TYPE_ID:
          if (event.bad_behaviour?.card) {
            result.push(mapCard(event, event.bad_behaviour.card.name, matchInfo));
          }
          break;

        case GOALKEEPER_TYPE_ID:
          if (event.goalkeeper) {
            result.push(mapGoalkeeper(event, matchInfo));
          }
          break;

        case INTERCEPTION_TYPE_ID:
          result.push(mapInterception(event, matchInfo));
          break;

        case CLEARANCE_TYPE_ID:
          result.push(mapClearance(event, matchInfo));
          break;

        case SUBSTITUTION_TYPE_ID:
          result.push(mapSubstitution(event, matchInfo));
          break;

        case BALL_RECOVERY_TYPE_ID:
          if (event.location) {
            result.push(mapRecovery(event, matchInfo));
          }
          break;

        case DRIBBLE_TYPE_ID:
          if (event.dribble && event.location) {
            result.push(mapTakeOn(event, matchInfo));
          }
          break;

        case PRESSURE_TYPE_ID:
          if (event.location) {
            result.push(mapPressure(event, matchInfo));
          }
          break;
      }
    }

    return result;
  },

  /**
   * Product-facing shot projection with stricter filtering.
   *
   * Drops own goals, penalty shootout, and events missing coordinates.
   */
  shots(events: readonly StatsBombEvent[], matchInfo: StatsBombMatchInfo): ShotEvent[] {
    return projectShots(events, matchInfo);
  },

  /**
   * Product-facing pass projection with pass-only filtering.
   */
  passes(events: readonly StatsBombEvent[], matchInfo: StatsBombMatchInfo): PassEvent[] {
    return projectPasses(events, matchInfo);
  },

  /**
   * Match-day team-sheet product combining StatsBomb lineups and event tactics.
   *
   * Requires both the separate lineup payload and the event stream because
   * starters/formation live in Starting XI while the broader squad lives in
   * the lineup feed.
   */
  matchLineups(
    lineups: readonly StatsBombLineupTeam[],
    events: readonly StatsBombEvent[],
    matchInfo: StatsBombMatchInfo,
  ): MatchLineups {
    return mapStatsBombMatchLineups(lineups, events, matchInfo);
  },

  /**
   * Narrow formation snapshot projected from the richer `matchLineups()` surface.
   *
   * StatsBomb needs both the separate lineup payload and the event stream,
   * then selects the requested home/away team sheet and projects the kickoff
   * starter snapshot into `FormationTeamData`.
   */
  formations(
    lineups: readonly StatsBombLineupTeam[],
    events: readonly StatsBombEvent[],
    matchInfo: StatsBombMatchInfo,
    side: "home" | "away",
  ): FormationTeamData {
    const teamSheet = mapStatsBombMatchLineups(lineups, events, matchInfo)[side];
    if (teamSheet == null) {
      throw new Error(`missing StatsBomb ${side} team sheet for formation projection`);
    }

    return projectTeamSheetToFormation(teamSheet, `StatsBomb ${side}`);
  },
};
