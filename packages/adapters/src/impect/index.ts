import type {
  Event,
  FormationTeamData,
  MatchLineups,
  PassEvent,
  ShotEvent,
} from "@withqwerty/campos-schema";

import { fromOpta } from "../opta/index.js";
import { projectTeamSheetToFormation } from "../shared/project-formation.js";
import {
  buildImpectAttackRelativeContext,
  buildImpectLookups,
  mapImpectCarryEvent,
  mapImpectMatchLineups,
  toImpectOptaEvents,
  type ImpectClock,
  type ImpectEvent,
  type ImpectLineups,
  type ImpectLineupTeam,
  type ImpectPlayerProfile,
  type ImpectRosterPlayer,
  type ImpectSquad,
  type ImpectStartingPosition,
  type ImpectSubstitution,
} from "./helpers.js";

export type ImpectOpenDataSlice = {
  lineups: ImpectLineups;
  squads: readonly ImpectSquad[];
  players: readonly ImpectPlayerProfile[];
  events?: readonly ImpectEvent[];
};

export const fromImpect = {
  events(data: ImpectOpenDataSlice): Event[] {
    const events = requireImpectEvents(data);
    const matchContext = buildImpectAttackRelativeContext(data.lineups);
    const lookups = buildImpectLookups(data.squads, data.players);
    const matchId = String(data.lineups.id);
    const optaEvents = events.flatMap((event) =>
      event.actionType === "DRIBBLE" ? [] : toImpectOptaEvents(event, lookups.playerById),
    );
    const carries: Event[] = [];
    for (const event of events) {
      if (event.actionType !== "DRIBBLE") continue;
      const carry = mapImpectCarryEvent(matchId, event, lookups.playerById);
      if (carry) carries.push(carry);
    }
    const normalised = fromOpta
      .events(optaEvents, matchContext)
      .map(rebrandImpectProduct);
    return [...normalised, ...carries];
  },

  shots(data: ImpectOpenDataSlice): ShotEvent[] {
    const events = requireImpectEvents(data);
    const matchContext = buildImpectAttackRelativeContext(data.lineups);
    const lookups = buildImpectLookups(data.squads, data.players);
    const optaEvents = events.flatMap((event) =>
      toImpectOptaEvents(event, lookups.playerById),
    );
    return fromOpta.shots(optaEvents, matchContext).map(rebrandImpectProduct);
  },

  passes(data: ImpectOpenDataSlice): PassEvent[] {
    const events = requireImpectEvents(data);
    const matchContext = buildImpectAttackRelativeContext(data.lineups);
    const lookups = buildImpectLookups(data.squads, data.players);
    const optaEvents = events.flatMap((event) =>
      toImpectOptaEvents(event, lookups.playerById),
    );
    return fromOpta.passes(optaEvents, matchContext).map(rebrandImpectProduct);
  },

  matchLineups(data: ImpectOpenDataSlice): MatchLineups {
    return mapImpectMatchLineups(data.lineups, data.squads, data.players);
  },

  formations(data: ImpectOpenDataSlice, side: "home" | "away"): FormationTeamData {
    const teamSheet = fromImpect.matchLineups(data)[side];
    if (teamSheet == null) {
      throw new Error(`missing Impect ${side} team sheet for formation projection`);
    }

    return projectTeamSheetToFormation(teamSheet, `Impect ${side}`);
  },
};

function requireImpectEvents(data: ImpectOpenDataSlice): readonly ImpectEvent[] {
  if (!data.events) {
    throw new Error(
      "Impect event adapters require data.events alongside lineups and lookups.",
    );
  }
  return data.events;
}

function rebrandImpectProduct<
  T extends { provider: string; sourceMeta?: Record<string, unknown> | null },
>(product: T): T {
  const sourceMeta = product.sourceMeta ?? {};
  return {
    ...product,
    provider: "impect",
    sourceMeta: {
      providerModel: "open-data",
      viaOpta: { ...sourceMeta },
    },
  };
}

export type {
  ImpectClock,
  ImpectEvent,
  ImpectLineups,
  ImpectLineupTeam,
  ImpectPlayerProfile,
  ImpectRosterPlayer,
  ImpectSquad,
  ImpectStartingPosition,
  ImpectSubstitution,
};
