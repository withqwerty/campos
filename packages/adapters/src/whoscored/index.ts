import type {
  Event,
  MatchLineups,
  PassEvent,
  ShotEvent,
} from "@withqwerty/campos-schema";

import type {
  WhoScoredMatchCentreData,
  WhoScoredMatchData,
  WhoScoredMatchInfo,
} from "./parse.js";
import { toOptaEvent } from "./parse.js";
import { projectShots } from "./project-shots.js";
import { projectPasses } from "./project-passes.js";
import { mapEvent } from "./map-events.js";
import { mapWhoScoredFormation } from "./map-formation.js";
import { mapWhoScoredMatchLineups } from "./map-lineups.js";

export type {
  WhoScoredEvent,
  WhoScoredMatchCentreData,
  WhoScoredMatchData,
  WhoScoredMatchInfo,
} from "./parse.js";
export type {
  WhoScoredPlayer,
  WhoScoredFormationEntry,
  WhoScoredMatchCentreTeam,
} from "./map-formation.js";
/**
 * WhoScored adapter — converts WhoScored matchCentreData into canonical Campos events.
 *
 * WhoScored wraps the Opta F24 event family with a different envelope:
 * - `type.value` / `type.displayName` instead of flat `typeId`
 * - Qualifier IDs are identical to Opta
 * - Coordinates are pre-normalized (all teams attack toward x=100)
 * - Player names come from `playerIdNameDictionary`
 * - No xG in the data (qualifier 213 absent)
 * - `goalMouthY` and `goalMouthZ` promoted to top-level fields
 */
export const fromWhoScored = {
  /**
   * Loss-aware event normalization.
   *
   * Returns all recognized event kinds including shots, passes, tackles,
   * cards, interceptions, duels, goalkeeper actions, clearances,
   * substitutions, and fouls. Unrecognized type IDs are silently skipped.
   */
  events(matchData: WhoScoredMatchData, matchInfo: WhoScoredMatchInfo): Event[] {
    const result: Event[] = [];
    for (const wsEvent of matchData.events) {
      const optaEvent = toOptaEvent(wsEvent, matchData.playerIdNameDictionary);
      const mapped = mapEvent(optaEvent, wsEvent, matchInfo.matchId);
      if (mapped != null) {
        result.push(mapped);
      }
    }
    return result;
  },

  /**
   * Product-facing shot projection with filtering.
   *
   * Drops own goals, penalty shootout, and events missing coordinates.
   */
  shots(matchData: WhoScoredMatchData, matchInfo: WhoScoredMatchInfo): ShotEvent[] {
    return projectShots(matchData, matchInfo);
  },

  /**
   * Product-facing pass projection with pass-only filtering.
   */
  passes(matchData: WhoScoredMatchData, matchInfo: WhoScoredMatchInfo): PassEvent[] {
    return projectPasses(matchData, matchInfo);
  },

  /**
   * Decode a full WhoScored match-centre blob into canonical home/away team sheets.
   *
   * Keeps the kickoff team sheet as the base product, then applies any honest
   * substitution metadata exposed by later formation intervals.
   */
  matchLineups(
    matchData: WhoScoredMatchCentreData,
    matchInfo: WhoScoredMatchInfo,
  ): MatchLineups {
    return mapWhoScoredMatchLineups(matchData, matchInfo);
  },

  /**
   * Decode a WhoScored `matchCentreData` team (home or away) into canonical
   * `FormationTeamData`. Self-contained — no squad join needed because
   * names and jersey numbers live inline on each player.
   */
  formations: mapWhoScoredFormation,
};
