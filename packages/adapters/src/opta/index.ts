import type {
  Event,
  MatchContext,
  MatchLineups,
  PassEvent,
  ShotEvent,
} from "@withqwerty/campos-schema";

import type { OptaEvent } from "./qualifiers.js";
import { assertMatchContext } from "./normalize.js";
import { mapShot } from "./map-shot.js";
import { mapPass } from "./map-pass.js";
import { mapCard } from "./map-card.js";
import { mapTackle } from "./map-tackle.js";
import { mapInterception } from "./map-interception.js";
import { mapDuel } from "./map-duel.js";
import { mapGoalkeeper } from "./map-goalkeeper.js";
import { mapClearance } from "./map-clearance.js";
import { mapSubstitution } from "./map-substitution.js";
import { mapFoul } from "./map-foul.js";
import { mapTakeOn } from "./map-take-on.js";
import { mapRecovery } from "./map-recovery.js";
// mapSetPiece is available but not wired — Opta set pieces are identified via
// qualifiers on pass events rather than having a dedicated typeId.
import { projectShots } from "./project-shots.js";
import { projectPasses } from "./project-passes.js";
import {
  SHOT_TYPE_IDS,
  PASS_TYPE_ID,
  TACKLE_FOUL_TYPE_ID,
  CARD_TYPE_IDS,
  INTERCEPTION_TYPE_ID,
  CLEARANCE_TYPE_ID,
  AERIAL_TYPE_ID,
  GOALKEEPER_TYPE_IDS,
  TAKE_ON_TYPE_ID,
  RECOVERY_TYPE_ID,
} from "./qualifiers.js";

import { parseOptaSquads } from "./parse-squads.js";
import { mapOptaFormation } from "./map-formation.js";
import { mapOptaMatchLineups } from "./map-lineups.js";

export type { OptaEvent, OptaQualifier } from "./qualifiers.js";
export type {
  OptaSquadEntry,
  OptaSquadIndex,
  RawOptaSquadsFile,
} from "./parse-squads.js";
export type {
  RawOptaQualifier,
  RawOptaLineupEvent,
  FromOptaFormationsOptions,
} from "./map-formation.js";
export type { RawOptaLineupPair, FromOptaMatchLineupsOptions } from "./map-lineups.js";

/**
 * Opta adapter — converts raw Opta F24 events into canonical Campos events.
 */
export const fromOpta = {
  /**
   * Loss-aware event normalization.
   *
   * Returns all recognized event kinds including shots, passes, tackles,
   * cards, interceptions, duels, goalkeeper actions, clearances,
   * substitutions, fouls, take-ons, and recoveries. Unrecognized typeIds
   * are silently skipped.
   *
   * TypeId 4 is shared between tackles and fouls: outcome=1 produces a
   * tackle event, outcome=0 produces a foul-committed event.
   */
  events(events: readonly OptaEvent[], matchContext: MatchContext): Event[] {
    assertMatchContext(matchContext);

    const result: Event[] = [];

    for (let index = 0; index < events.length; index += 1) {
      const event = events[index]!;
      // Cards and substitutions don't require coordinates
      if (CARD_TYPE_IDS.has(event.typeId)) {
        result.push(mapCard(event, matchContext));
        continue;
      }

      if (event.typeId === 18) {
        const nextEvent = events[index + 1];
        const incomingEvent =
          nextEvent?.typeId === 19 && nextEvent.contestantId === event.contestantId
            ? nextEvent
            : undefined;
        result.push(mapSubstitution(event, matchContext, incomingEvent));
        if (incomingEvent != null) {
          index += 1;
        }
        continue;
      }

      if (event.typeId === 19) {
        continue;
      }

      // All remaining event kinds require valid coordinates
      if (typeof event.x !== "number" || typeof event.y !== "number") {
        continue;
      }

      if (SHOT_TYPE_IDS.has(event.typeId)) {
        result.push(mapShot(event, matchContext));
      } else if (event.typeId === PASS_TYPE_ID) {
        result.push(mapPass(event, matchContext));
      } else if (event.typeId === TACKLE_FOUL_TYPE_ID) {
        // TypeId 4: outcome=1 → tackle, outcome=0 → foul
        if (event.outcome === 1) {
          result.push(mapTackle(event, matchContext));
        } else {
          result.push(mapFoul(event, matchContext));
        }
      } else if (event.typeId === INTERCEPTION_TYPE_ID) {
        result.push(mapInterception(event, matchContext));
      } else if (event.typeId === CLEARANCE_TYPE_ID) {
        result.push(mapClearance(event, matchContext));
      } else if (event.typeId === AERIAL_TYPE_ID) {
        result.push(mapDuel(event, matchContext));
      } else if (GOALKEEPER_TYPE_IDS.has(event.typeId)) {
        result.push(mapGoalkeeper(event, matchContext));
      } else if (event.typeId === TAKE_ON_TYPE_ID) {
        result.push(mapTakeOn(event, matchContext));
      } else if (event.typeId === RECOVERY_TYPE_ID) {
        result.push(mapRecovery(event, matchContext));
      }
    }

    return result;
  },

  /**
   * Product-facing shot projection with stricter filtering.
   *
   * Drops own goals, penalty shootout, disallowed goals, and events missing coordinates.
   */
  shots(events: readonly OptaEvent[], matchContext: MatchContext): ShotEvent[] {
    return projectShots(events, matchContext);
  },

  /**
   * Product-facing pass projection with pass-only filtering.
   */
  passes(events: readonly OptaEvent[], matchContext: MatchContext): PassEvent[] {
    return projectPasses(events, matchContext);
  },

  /**
   * Parse a pre-loaded Opta `squads.json` file into a player-ID indexed
   * lookup table used by the formations adapter for name resolution.
   */
  parseSquads: parseOptaSquads,

  /**
   * Decode paired Opta typeId 34 lineup events into canonical home/away team sheets.
   *
   * This first Opta version is intentionally kickoff-lineup focused: starters,
   * bench ordering, captain, formation, shirts, and squad-resolved labels.
   * It does not invent substitution minutes or explicit player coordinates.
   */
  matchLineups(
    lineups: import("./map-lineups.js").RawOptaLineupPair,
    options: import("./map-lineups.js").FromOptaMatchLineupsOptions,
  ): MatchLineups {
    return mapOptaMatchLineups(lineups, options);
  },

  /**
   * Decode an Opta typeId 34 lineup event into canonical `FormationTeamData`.
   *
   * Requires a pre-parsed squad index (via `fromOpta.parseSquads`) for
   * player name resolution.
   */
  formations: mapOptaFormation,
};
