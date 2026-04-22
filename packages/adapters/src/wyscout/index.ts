import type {
  Event,
  MatchLineups,
  PassEvent,
  ShotEvent,
} from "@withqwerty/campos-schema";

import type {
  FromWyscoutMatchLineupsOptions,
  WyscoutMatchData,
  WyscoutMatchInfo,
} from "./parse.js";
import { hasTag, resolveMatchId } from "./common.js";
import { mapWyscoutMatchLineups } from "./map-lineups.js";
import { mapPass } from "./map-pass.js";
import {
  mapCard,
  mapClearance,
  mapDuel,
  mapFoul,
  mapGoalkeeper,
  mapInterception,
  mapRecovery,
  mapTakeOn,
} from "./map-other-events.js";
import { mapShot } from "./map-shot.js";
import { projectShots } from "./project-shots.js";
import { projectPasses } from "./project-passes.js";

export type {
  FromWyscoutMatchLineupsOptions,
  WyscoutEvent,
  WyscoutFormationPlayer,
  WyscoutLineupLookups,
  WyscoutMatch,
  WyscoutMatchData,
  WyscoutMatchInfo,
  WyscoutMatchTeamData,
  WyscoutPlayer,
  WyscoutSubstitution,
  WyscoutTeam,
  WyscoutTeamFormation,
} from "./parse.js";

const PASS_EVENT_ID = 8;
const DUEL_EVENT_ID = 1;
const GROUND_ATTACKING_DUEL_SUBEVENT_ID = 11;
const FOUL_EVENT_ID = 2;
const OTHERS_ON_BALL_EVENT_ID = 7;
const SAVE_EVENT_ID = 9;
const SHOT_EVENT_IDS = new Set([10]);
const SET_PIECE_SHOT_SUBEVENT_IDS = new Set([33, 35]);
const INTERCEPTION_TAG_ID = 1401;
const ACCELERATION_SUBEVENT_ID = 70;
const CLEARANCE_SUBEVENT_ID = 71;
const TOUCH_SUBEVENT_ID = 72;

export const fromWyscout = {
  events(matchData: WyscoutMatchData, matchInfo: WyscoutMatchInfo = {}): Event[] {
    const matchId = resolveMatchId(matchData, matchInfo);
    const result: Event[] = [];

    for (const event of matchData.events) {
      if (event.eventId === PASS_EVENT_ID && event.positions[0] != null) {
        if (hasTag(event, INTERCEPTION_TAG_ID)) {
          result.push(mapInterception(event, matchId));
        }
        result.push(mapPass(event, matchId));
        continue;
      }

      if (event.eventId === FOUL_EVENT_ID && event.positions[0] != null) {
        result.push(mapFoul(event, matchId));
        const card = mapCard(event, matchId);
        if (card != null) {
          result.push(card);
        }
        continue;
      }

      if (event.eventId === DUEL_EVENT_ID && event.positions[0] != null) {
        if (hasTag(event, INTERCEPTION_TAG_ID)) {
          result.push(mapInterception(event, matchId));
        } else if (event.subEventId === GROUND_ATTACKING_DUEL_SUBEVENT_ID) {
          result.push(mapTakeOn(event, matchId));
        } else {
          result.push(mapDuel(event, matchId));
        }
        continue;
      }

      if (
        event.eventId === OTHERS_ON_BALL_EVENT_ID &&
        event.subEventId === CLEARANCE_SUBEVENT_ID &&
        event.positions[0] != null
      ) {
        if (hasTag(event, INTERCEPTION_TAG_ID)) {
          result.push(mapInterception(event, matchId));
        }
        result.push(mapClearance(event, matchId));
        continue;
      }

      if (
        event.eventId === OTHERS_ON_BALL_EVENT_ID &&
        event.subEventId === TOUCH_SUBEVENT_ID &&
        event.positions[0] != null &&
        hasTag(event, INTERCEPTION_TAG_ID)
      ) {
        result.push(mapInterception(event, matchId));
        continue;
      }

      // OTHERS_ON_BALL acceleration (70) → recovery (following kloppy v2 logic:
      // clearance and touch+interception are handled above; remaining non-touch
      // sub-events like acceleration are ball recoveries)
      if (
        event.eventId === OTHERS_ON_BALL_EVENT_ID &&
        event.subEventId === ACCELERATION_SUBEVENT_ID &&
        event.positions[0] != null
      ) {
        result.push(mapRecovery(event, matchId));
        continue;
      }

      if (event.eventId === SAVE_EVENT_ID && event.positions[0] != null) {
        result.push(mapGoalkeeper(event, matchId));
        continue;
      }

      if (
        (SHOT_EVENT_IDS.has(event.eventId) ||
          SET_PIECE_SHOT_SUBEVENT_IDS.has(event.subEventId)) &&
        event.positions[0] != null &&
        event.matchPeriod !== "P"
      ) {
        result.push(mapShot(event, matchId));
      }
    }

    return result;
  },

  shots(matchData: WyscoutMatchData, matchInfo: WyscoutMatchInfo = {}): ShotEvent[] {
    return projectShots(matchData, matchInfo);
  },

  passes(matchData: WyscoutMatchData, matchInfo: WyscoutMatchInfo = {}): PassEvent[] {
    return projectPasses(matchData, matchInfo);
  },

  matchLineups(
    matchData: WyscoutMatchData,
    options: FromWyscoutMatchLineupsOptions = {},
  ): MatchLineups {
    return mapWyscoutMatchLineups(matchData, options);
  },
};
