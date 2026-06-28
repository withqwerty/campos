import type {
  Event,
  MatchContext,
  MatchLineups,
  OptaEventSurface,
  OptaPossessionWindow,
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

export type FromOptaPossessionWindowsOptions = {
  matchId?: string;
  teamNamesById?: Record<string, string>;
  maxEventGapSeconds?: number;
};

export type FromOptaEventSurfaceOptions = FromOptaPossessionWindowsOptions & {
  id?: string | null;
  f24EventCount?: number;
  ma36EventCount?: number;
  evidence?: readonly string[];
  caveat?: string;
  sourceMeta?: Record<string, unknown> | null;
};

const DEFAULT_POSSESSION_MAX_EVENT_GAP_SECONDS = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function ma36Meta(event: Event): Record<string, unknown> | null {
  const meta = event.sourceMeta?.ma36;
  return isRecord(meta) ? meta : null;
}

function hasMa36SourceMeta(event: Event): boolean {
  return ma36Meta(event) !== null;
}

function numericMeta(meta: Record<string, unknown>, key: string): number {
  const value = meta[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumberMeta(
  meta: Record<string, unknown> | null,
  key: string,
): number | null {
  if (!meta) return null;
  const value = meta[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableStringMeta(
  meta: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!meta) return null;
  const value = meta[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function booleanMeta(meta: Record<string, unknown> | null, key: string): boolean {
  return meta?.[key] === true;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.floor(value);
}

function eventSecond(event: Pick<Event, "minute" | "second">): number {
  return event.minute * 60 + event.second;
}

type PossessionAccumulator = {
  matchId: string;
  providerPossessionId: string;
  sequenceId: string | null;
  teamId: string;
  teamName: string | null;
  period: OptaPossessionWindow["period"];
  events: Event[];
  sourcePossessionIds: Set<string>;
};

function possessionKey(event: Event): string | null {
  const meta = ma36Meta(event);
  if (!meta) return null;
  const possessionId = meta.possessionId;
  if (typeof possessionId !== "string" || possessionId.length === 0) return null;
  const sequenceId =
    typeof meta.sequenceId === "string" && meta.sequenceId.length > 0
      ? meta.sequenceId
      : "unsequenced";
  return `${event.period}:${event.teamId}:${sequenceId}:${possessionId}`;
}

function sortedPossessionEvents(group: PossessionAccumulator): Event[] {
  return [...group.events].sort(
    (a, b) =>
      eventSecond(a) - eventSecond(b) ||
      a.providerEventId.localeCompare(b.providerEventId),
  );
}

function splitPossessionEvents(events: Event[], maxEventGapSeconds: number): Event[][] {
  const segments: Event[][] = [];
  let current: Event[] = [];

  for (const event of events) {
    const previous = current.at(-1);
    if (previous && eventSecond(event) - eventSecond(previous) > maxEventGapSeconds) {
      segments.push(current);
      current = [];
    }
    current.push(event);
  }

  if (current.length) segments.push(current);
  return segments;
}

function toPossessionWindow(
  group: PossessionAccumulator,
  events: Event[],
  segmentIndex: number,
  segmentCount: number,
): OptaPossessionWindow {
  const first = events.at(0);
  const last = events.at(-1);
  if (!first || !last) {
    throw new Error("Opta possession window requires at least one event.");
  }
  const ma36Rows = events.map(ma36Meta).filter(isRecord);

  return {
    id:
      `${group.matchId}:opta-possession:${group.period}:${group.teamId}:` +
      `${group.sequenceId ?? "unsequenced"}:${group.providerPossessionId}:${segmentIndex}`,
    matchId: group.matchId,
    provider: "opta",
    providerPossessionId: group.providerPossessionId,
    sequenceId: group.sequenceId,
    teamId: group.teamId,
    teamName: group.teamName,
    period: group.period,
    startMinute: first.minute,
    startSecond: first.second,
    endMinute: last.minute,
    endSecond: last.second,
    eventIds: events.map((event) => event.providerEventId),
    metrics: {
      eventCount: events.length,
      passCount: events.filter((event) => event.kind === "pass").length,
      shotCount: events.filter((event) => event.kind === "shot").length,
      pressureTaggedEventCount: ma36Rows.filter((meta) => meta.hasPressure === true)
        .length,
      receptionCount: ma36Rows.filter((meta) => meta.hasReception === true).length,
      lineBreakingPassCount: ma36Rows.filter((meta) => meta.hasLineBreakingPass === true)
        .length,
      xThreatApplied: ma36Rows.reduce(
        (sum, meta) => sum + numericMeta(meta, "xThreatApplied"),
        0,
      ),
      xThreatRemoved: ma36Rows.reduce(
        (sum, meta) => sum + numericMeta(meta, "xThreatRemoved"),
        0,
      ),
    },
    sourceMeta: {
      source: "Opta MA36 possessionId grouped from canonical Campos events",
      sourcePossessionIds: [...group.sourcePossessionIds],
      segmentIndex,
      segmentCount,
      caveat:
        "Possession windows preserve provider grouping and event-value context. Long provider groups are split when the canonical event stream has a large time gap. They do not classify tactical phases or repeatability.",
    },
  };
}

function toContextTag(event: Event): OptaEventSurface["contextTags"][number] {
  const sourceMeta = isRecord(event.sourceMeta) ? event.sourceMeta : null;
  const ma36 = ma36Meta(event);
  const qualifiers = Array.isArray(sourceMeta?.qualifiers) ? sourceMeta.qualifiers : [];

  return {
    eventId: event.id,
    providerEventId: event.providerEventId,
    kind: event.kind,
    period: event.period,
    minute: event.minute,
    second: event.second,
    teamId: event.teamId,
    playerId: event.playerId,
    timestampUtc:
      typeof sourceMeta?.timestampUtc === "string" ? sourceMeta.timestampUtc : null,
    qualifierCount: qualifiers.length,
    possessionId: nullableStringMeta(ma36, "possessionId"),
    sequenceId: nullableStringMeta(ma36, "sequenceId"),
    hasPressure: booleanMeta(ma36, "hasPressure"),
    hasPressureReceived: booleanMeta(ma36, "hasPressureReceived"),
    hasPassOption: booleanMeta(ma36, "hasPassOption"),
    hasPassTarget: booleanMeta(ma36, "hasPassTarget"),
    hasReception: booleanMeta(ma36, "hasReception"),
    hasLineBreakingPass: booleanMeta(ma36, "hasLineBreakingPass"),
    xThreatApplied: nullableNumberMeta(ma36, "xThreatApplied"),
    xThreatRemoved: nullableNumberMeta(ma36, "xThreatRemoved"),
    sourceMeta: {
      source: "Opta F24 sourceMeta with optional MA36 enrichment",
      hasQualifiers: qualifiers.length > 0,
      hasTimestamp: typeof sourceMeta?.timestampUtc === "string",
      hasMa36: ma36 !== null,
      caveat:
        "Context tags preserve provider metadata for audit and visual filtering. They do not classify tactical phases, pressure quality, or repeatability.",
    },
  };
}

function buildOptaEventSurface(
  optaEvents: readonly OptaEvent[],
  matchContext: MatchContext,
  options: FromOptaEventSurfaceOptions = {},
): OptaEventSurface {
  const events = fromOpta.events(optaEvents, matchContext);
  const passes = fromOpta.passes(optaEvents, matchContext);
  const shots = fromOpta.shots(optaEvents, matchContext);
  const possessions = fromOpta.possessionWindows(events, options);
  const contextTags = events.map(toContextTag);
  const ma36Events = events.filter(hasMa36SourceMeta);
  const ma36Rows = ma36Events.map(ma36Meta).filter(isRecord);
  const f24Events = nonNegativeInteger(options.f24EventCount, optaEvents.length);
  const ma36EventCount = nonNegativeInteger(options.ma36EventCount, ma36Events.length);

  return {
    id: options.id ?? `${matchContext.matchId}:opta:event-surface`,
    matchId: matchContext.matchId,
    provider: "opta",
    coordinateFrame: "team-attacking",
    events,
    passes,
    shots,
    possessions,
    contextTags,
    enrichment: {
      f24Events,
      ma36Events: ma36EventCount,
      canonicalEvents: events.length,
      passes: passes.length,
      shots: shots.length,
      eventsWithMa36: ma36Events.length,
      possessionTaggedEvents: ma36Rows.filter((meta) => meta.possessionId).length,
      sequenceTaggedEvents: ma36Rows.filter((meta) => meta.sequenceId).length,
      pressureTaggedEvents: ma36Rows.filter((meta) => meta.hasPressure === true).length,
      pressureReceivedEvents: ma36Rows.filter((meta) => meta.hasPressureReceived === true)
        .length,
      receptionEvents: ma36Rows.filter((meta) => meta.hasReception === true).length,
      lineBreakingPassEvents: ma36Rows.filter((meta) => meta.hasLineBreakingPass === true)
        .length,
      xThreatEvents: ma36Rows.filter(
        (meta) =>
          typeof meta.xThreatApplied === "number" ||
          typeof meta.xThreatRemoved === "number",
      ).length,
      possessionWindows: possessions.length,
      qualifierTaggedEvents: optaEvents.filter((event) => event.qualifier?.length).length,
      timestampedEvents: optaEvents.filter((event) => event.timestampUtc).length,
    },
    evidence: options.evidence
      ? [...options.evidence]
      : [
          `${f24Events} Opta F24 events parsed`,
          `${events.length} canonical Campos events emitted`,
          `${ma36Events.length} canonical events carry MA36 source metadata`,
          `${passes.length} pass projections and ${shots.length} shot projections emitted`,
        ],
    caveat:
      options.caveat ??
      "Campos normalises Opta events into team-attacking pitch space and preserves F24 qualifiers, timestamps, and MA36 enrichment in sourceMeta. Possession, pressure, line-breaking, and xThreat tags remain provider context; consumers own any phase, cost, repeatability, or tactical interpretation.",
    sourceMeta: options.sourceMeta ?? null,
  };
}

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
   * Package canonical Opta events, pass and shot projections, MA36 possession
   * windows, enrichment counts, evidence, and caveats into a reusable provider
   * surface. This is still provider context: it does not classify phases,
   * assign tactical value, or infer repeatability.
   */
  eventSurface(
    events: readonly OptaEvent[],
    matchContext: MatchContext,
    options: FromOptaEventSurfaceOptions = {},
  ): OptaEventSurface {
    return buildOptaEventSurface(events, matchContext, options);
  },

  /**
   * Group canonical Opta events into MA36 possession windows.
   *
   * This keeps provider possession IDs, sequence IDs, pressure tags, receptions,
   * line-breaking tags, and xThreat totals as source context only.
   */
  possessionWindows(
    events: readonly Event[],
    options: FromOptaPossessionWindowsOptions = {},
  ): OptaPossessionWindow[] {
    const groups = new Map<string, PossessionAccumulator>();
    const maxEventGapSeconds =
      options.maxEventGapSeconds ?? DEFAULT_POSSESSION_MAX_EVENT_GAP_SECONDS;

    for (const event of events) {
      const meta = ma36Meta(event);
      if (!meta) continue;
      const possessionId = meta.possessionId;
      if (typeof possessionId !== "string" || possessionId.length === 0) continue;
      const key = possessionKey(event);
      if (!key) continue;
      const matchId = options.matchId ?? event.matchId;
      const existing = groups.get(key);
      const sequenceId =
        typeof meta.sequenceId === "string" && meta.sequenceId.length > 0
          ? meta.sequenceId
          : null;
      if (existing) {
        existing.events.push(event);
        existing.sourcePossessionIds.add(possessionId);
        if (!existing.sequenceId && sequenceId) existing.sequenceId = sequenceId;
        continue;
      }
      groups.set(key, {
        matchId,
        providerPossessionId: possessionId,
        sequenceId,
        teamId: event.teamId,
        teamName: options.teamNamesById?.[event.teamId] ?? null,
        period: event.period,
        events: [event],
        sourcePossessionIds: new Set([possessionId]),
      });
    }

    return [...groups.values()]
      .flatMap((group) => {
        const segments = splitPossessionEvents(
          sortedPossessionEvents(group),
          maxEventGapSeconds,
        );
        return segments.map((events, index) =>
          toPossessionWindow(group, events, index, segments.length),
        );
      })
      .sort(
        (a, b) =>
          a.period - b.period ||
          a.startMinute - b.startMinute ||
          a.startSecond - b.startSecond ||
          a.teamId.localeCompare(b.teamId),
      );
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
