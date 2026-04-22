import type {
  Event,
  FormationTeamData,
  MatchContext,
  MatchLineups,
  PassEvent,
  ShotEvent,
} from "@withqwerty/campos-schema";

import { fromOpta } from "../opta/index.js";
import { projectTeamSheetToFormation } from "../shared/project-formation.js";
import {
  buildStatsPerformMatchContext,
  mapStatsPerformMa1MatchLineups,
  toStatsPerformOptaEvents,
  type StatsPerformContestant,
  type StatsPerformEvent,
  type StatsPerformMa1Lineup,
  type StatsPerformMatchInfo,
  type StatsPerformQualifier,
  type StatsPerformSubstitution,
} from "./helpers.js";

export type StatsPerformMa1Document = {
  matchInfo: StatsPerformMatchInfo;
  liveData: {
    lineUp: readonly StatsPerformMa1Lineup[];
    substitute?: readonly StatsPerformSubstitution[] | null;
  };
};

export type StatsPerformMa3Document = {
  matchInfo: StatsPerformMatchInfo;
  liveData: {
    event: readonly StatsPerformEvent[];
  };
};

export const fromStatsPerform = {
  matchContext(document: StatsPerformMa3Document): MatchContext {
    return buildStatsPerformMatchContext(document.matchInfo, document.liveData.event);
  },

  events(document: StatsPerformMa3Document): Event[] {
    const context = fromStatsPerform.matchContext(document);
    const optaEvents = toStatsPerformOptaEvents(document.liveData.event);
    return fromOpta.events(optaEvents, context).map(rebrandStatsPerformProduct);
  },

  shots(document: StatsPerformMa3Document): ShotEvent[] {
    const context = fromStatsPerform.matchContext(document);
    const optaEvents = toStatsPerformOptaEvents(document.liveData.event);
    return fromOpta.shots(optaEvents, context).map(rebrandStatsPerformProduct);
  },

  passes(document: StatsPerformMa3Document): PassEvent[] {
    const context = fromStatsPerform.matchContext(document);
    const optaEvents = toStatsPerformOptaEvents(document.liveData.event);
    return fromOpta.passes(optaEvents, context).map(rebrandStatsPerformProduct);
  },

  matchLineups(document: StatsPerformMa1Document): MatchLineups {
    return mapStatsPerformMa1MatchLineups(
      document.matchInfo,
      document.liveData.lineUp,
      document.liveData.substitute ?? [],
    );
  },

  formations(
    document: StatsPerformMa1Document,
    side: "home" | "away",
  ): FormationTeamData {
    const teamSheet = fromStatsPerform.matchLineups(document)[side];
    if (teamSheet == null) {
      throw new Error(
        `missing Stats Perform ${side} team sheet for formation projection`,
      );
    }

    return projectTeamSheetToFormation(teamSheet, `Stats Perform ${side}`);
  },
};

function rebrandStatsPerformProduct<
  T extends { provider: string; sourceMeta?: Record<string, unknown> | null },
>(product: T): T {
  return {
    ...product,
    provider: "statsperform",
    sourceMeta: {
      ...(product.sourceMeta ?? {}),
      providerModel: "ma3",
    },
  };
}

export type {
  StatsPerformContestant,
  StatsPerformEvent,
  StatsPerformMa1Lineup,
  StatsPerformMatchInfo,
  StatsPerformQualifier,
  StatsPerformSubstitution,
};
