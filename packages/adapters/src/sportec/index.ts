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
  buildSportecAttackRelativeContext,
  buildSportecMatchContext,
  buildSportecPeriodStarts,
  buildSportecPlayerIndex,
  makeSportecIdAllocator,
  mapSportecMatchLineups,
  normalizeSportecEventClock,
  parseSportecEventXml,
  parseSportecMetaXml,
  toSportecOptaEvents,
  type SportecEvent,
  type SportecIdAllocator,
  type SportecMeta,
  type SportecOfficial,
  type SportecTeam,
  type SportecTeamPlayer,
} from "./helpers.js";

export type SportecMetaSource = SportecMeta | string;
export type SportecEventSource = readonly SportecEvent[] | string;

export const fromSportec = {
  parseMeta(xml: string): SportecMeta {
    return parseSportecMetaXml(xml);
  },

  parseEvents(xml: string): SportecEvent[] {
    return parseSportecEventXml(xml);
  },

  matchContext(
    metaSource: SportecMetaSource,
    eventSource: SportecEventSource,
  ): MatchContext {
    return buildSportecMatchContext(
      resolveSportecMeta(metaSource),
      resolveSportecEvents(eventSource),
    );
  },

  events(metaSource: SportecMetaSource, eventSource: SportecEventSource): Event[] {
    const batch = buildSportecOptaBatch(metaSource, eventSource);
    const rebrand = makeRebrandSportecProduct(batch.idAllocator, batch.meta.matchId);
    return fromOpta.events(batch.optaEvents, batch.optaContext).map(rebrand);
  },

  shots(metaSource: SportecMetaSource, eventSource: SportecEventSource): ShotEvent[] {
    const batch = buildSportecOptaBatch(metaSource, eventSource);
    const rebrand = makeRebrandSportecProduct(batch.idAllocator, batch.meta.matchId);
    return fromOpta.shots(batch.optaEvents, batch.optaContext).map(rebrand);
  },

  passes(metaSource: SportecMetaSource, eventSource: SportecEventSource): PassEvent[] {
    const batch = buildSportecOptaBatch(metaSource, eventSource);
    const rebrand = makeRebrandSportecProduct(batch.idAllocator, batch.meta.matchId);
    return fromOpta.passes(batch.optaEvents, batch.optaContext).map(rebrand);
  },

  matchLineups(metaSource: SportecMetaSource): MatchLineups {
    return mapSportecMatchLineups(resolveSportecMeta(metaSource));
  },

  formations(metaSource: SportecMetaSource, side: "home" | "away"): FormationTeamData {
    const teamSheet = fromSportec.matchLineups(metaSource)[side];
    if (teamSheet == null) {
      throw new Error(`missing Sportec ${side} team sheet for formation projection`);
    }

    return projectTeamSheetToFormation(teamSheet, `Sportec ${side}`);
  },
};

function resolveSportecMeta(source: SportecMetaSource): SportecMeta {
  return typeof source === "string" ? parseSportecMetaXml(source) : source;
}

function resolveSportecEvents(source: SportecEventSource): SportecEvent[] {
  return typeof source === "string" ? parseSportecEventXml(source) : [...source];
}

function buildSportecOptaBatch(
  metaSource: SportecMetaSource,
  eventSource: SportecEventSource,
): {
  meta: SportecMeta;
  optaEvents: ReturnType<typeof toSportecOptaEvents>;
  optaContext: ReturnType<typeof buildSportecAttackRelativeContext>;
  idAllocator: SportecIdAllocator;
} {
  const meta = resolveSportecMeta(metaSource);
  const events = resolveSportecEvents(eventSource);
  const directionContext = buildSportecMatchContext(meta, events);
  const optaContext = buildSportecAttackRelativeContext(meta);
  const playerById = buildSportecPlayerIndex(meta);
  const periodStarts = buildSportecPeriodStarts(events);
  const idAllocator = makeSportecIdAllocator();

  const optaEvents = events.flatMap((event, index) => {
    const time = normalizeSportecEventClock(event, periodStarts);
    return toSportecOptaEvents({
      event,
      nextEvent: events[index + 1],
      playerById,
      time,
      period: time.period,
      directionContext,
      idAllocator,
    });
  });

  return { meta, optaEvents, optaContext, idAllocator };
}

// Rebrand replaces Opta-synthesised ids with the original Sportec string
// eventId and namespaces Opta-coded sourceMeta under `viaOpta` so consumers
// don't see Opta qualifier IDs under `provider: "sportec"`.
function makeRebrandSportecProduct(
  idAllocator: SportecIdAllocator,
  matchId: string,
): <
  T extends {
    id: string;
    provider: string;
    providerEventId: string;
    sourceMeta?: Record<string, unknown> | null;
  },
>(
  product: T,
) => T {
  return (product) => {
    const sourceMeta = product.sourceMeta ?? {};
    const numericEventId =
      typeof sourceMeta.eventId === "number" ? sourceMeta.eventId : null;
    const originalKey =
      numericEventId != null ? idAllocator.resolve(numericEventId) : undefined;
    const providerEventId =
      originalKey != null
        ? originalKey.endsWith(":in")
          ? `${originalKey.slice(0, -3)}#in`
          : originalKey
        : product.providerEventId;
    const id = `${matchId}:${providerEventId}`;
    const viaOpta = { ...sourceMeta };
    return {
      ...product,
      id,
      providerEventId,
      provider: "sportec",
      sourceMeta: {
        providerModel: "open-dfl",
        viaOpta,
      },
    };
  };
}

export type {
  SportecEvent,
  SportecMeta,
  SportecOfficial,
  SportecTeam,
  SportecTeamPlayer,
};
