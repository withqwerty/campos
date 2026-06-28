import { describe, expect, it } from "vitest";

import type { MatchContext } from "@withqwerty/campos-schema";

import { fromOpta, type OptaEvent } from "../../src/index";

const matchContext: MatchContext = {
  matchId: "surface-match",
  homeTeamId: "home",
  awayTeamId: "away",
  periods: {
    firstHalf: { homeAttacksToward: "increasing-x" },
    secondHalf: { homeAttacksToward: "decreasing-x" },
  },
};

const optaEvents: OptaEvent[] = [
  {
    id: 1,
    eventId: 101,
    typeId: 1,
    periodId: 1,
    timeMin: 12,
    timeSec: 10,
    contestantId: "home",
    playerId: "p1",
    outcome: 1,
    x: 35,
    y: 44,
    qualifier: [
      { qualifierId: 140, value: "58" },
      { qualifierId: 141, value: "52" },
    ],
    timestampUtc: "2025-08-15T19:12:10.000Z",
    sequenceId: "seq-1",
    possessionId: "pos-1",
    hasPressure: true,
    hasPressureReceived: true,
    hasReception: true,
    hasLineBreakingPass: true,
    xThreatApplied: 0.12,
    xThreatRemoved: 0.01,
  },
  {
    id: 2,
    eventId: 102,
    typeId: 16,
    periodId: 1,
    timeMin: 12,
    timeSec: 16,
    contestantId: "home",
    playerId: "p2",
    outcome: 1,
    x: 88,
    y: 50,
    qualifier: [],
    timestampUtc: "2025-08-15T19:12:16.000Z",
    sequenceId: "seq-1",
    possessionId: "pos-1",
    xThreatApplied: 0.4,
  },
];

describe("fromOpta.eventSurface", () => {
  it("packages canonical events, projections, possessions, enrichment, evidence, and caveats", () => {
    const surface = fromOpta.eventSurface(optaEvents, matchContext, {
      f24EventCount: 2,
      ma36EventCount: 2,
      teamNamesById: { home: "Home" },
    });

    expect(surface).toMatchObject({
      id: "surface-match:opta:event-surface",
      matchId: "surface-match",
      provider: "opta",
      coordinateFrame: "team-attacking",
      enrichment: {
        f24Events: 2,
        ma36Events: 2,
        canonicalEvents: 2,
        passes: 1,
        shots: 1,
        eventsWithMa36: 2,
        possessionTaggedEvents: 2,
        sequenceTaggedEvents: 2,
        pressureTaggedEvents: 1,
        pressureReceivedEvents: 1,
        receptionEvents: 1,
        lineBreakingPassEvents: 1,
        xThreatEvents: 2,
        possessionWindows: 1,
        qualifierTaggedEvents: 1,
        timestampedEvents: 2,
      },
    });
    expect(surface.events).toHaveLength(2);
    expect(surface.passes).toHaveLength(1);
    expect(surface.shots).toHaveLength(1);
    expect(surface.possessions).toHaveLength(1);
    expect(surface.contextTags).toHaveLength(2);
    expect(surface.contextTags[0]).toMatchObject({
      eventId: "surface-match:1",
      providerEventId: "1",
      kind: "pass",
      timestampUtc: "2025-08-15T19:12:10.000Z",
      qualifierCount: 2,
      possessionId: "pos-1",
      sequenceId: "seq-1",
      hasPressure: true,
      hasPressureReceived: true,
      hasReception: true,
      hasLineBreakingPass: true,
      xThreatApplied: 0.12,
      xThreatRemoved: 0.01,
    });
    expect(surface.contextTags[0]?.sourceMeta?.caveat).toContain("do not classify");
    expect(surface.possessions[0]?.teamName).toBe("Home");
    expect(surface.evidence).toContain("2 Opta F24 events parsed");
    expect(surface.caveat).toContain("provider context");
    expect(surface.caveat).toContain("consumers own");
    expect(surface).not.toHaveProperty("repeatability");
    expect(surface).not.toHaveProperty("tacticalValue");
  });
});
