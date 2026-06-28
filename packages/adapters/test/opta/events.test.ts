import { describe, expect, it } from "vitest";

import { EVENT_KINDS, type Event, type MatchContext } from "@withqwerty/campos-schema";

import { fromOpta } from "../../src/index";

import matchEvents from "../fixtures/opta/raw-match-events-sample.json";

function buildMatchContext(
  homeTeamId: string,
  awayTeamId: string,
  matchId: string,
): MatchContext {
  return {
    matchId,
    homeTeamId,
    awayTeamId,
    periods: {
      firstHalf: { homeAttacksToward: "decreasing-x" },
      secondHalf: { homeAttacksToward: "increasing-x" },
    },
  };
}

const [home, away] = matchEvents.matchInfo.contestant as unknown as [
  { id: string },
  { id: string },
];
const ctx = buildMatchContext(home.id, away.id, matchEvents.matchInfo.id);

describe("fromOpta.events — mixed event stream", () => {
  const events = fromOpta.events(matchEvents.liveData.event, ctx);

  it("returns both shot and pass event kinds", () => {
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds).toContain("shot");
    expect(kinds).toContain("pass");
  });

  it("maps the correct number of shots and passes", () => {
    const shots = events.filter((e) => e.kind === "shot");
    const passes = events.filter((e) => e.kind === "pass");

    // Fixture has 3 shot events (typeId 13, 15, 16) and 7 pass events (typeId 1)
    expect(shots).toHaveLength(3);
    expect(passes).toHaveLength(7);
  });

  it("every event has valid base fields", () => {
    for (const event of events) {
      // Bind the kind check to the production EVENT_KINDS const so adding a
      // new event kind forces this test to recognise it in one place.
      expect(EVENT_KINDS).toContain(event.kind);
      expect(typeof event.id).toBe("string");
      expect(event.id.length).toBeGreaterThan(0);
      expect(typeof event.provider).toBe("string");
      expect(event.provider).toBe("opta");
      expect(typeof event.second).toBe("number");
      expect(event.second).toBeGreaterThanOrEqual(0);
      expect(event.second).toBeLessThanOrEqual(59);
      expect(typeof event.minute).toBe("number");
      expect(event.minute).toBeGreaterThanOrEqual(0);
      expect(event.period).toBeGreaterThanOrEqual(1);
      expect(event.period).toBeLessThanOrEqual(5);
      expect(typeof event.matchId).toBe("string");
      expect(typeof event.teamId).toBe("string");
      expect(typeof event.providerEventId).toBe("string");
    }
  });

  it("pass events carry endX, endY, passType, and isAssist", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");

    for (const pass of passes) {
      expect(pass).toHaveProperty("endX");
      expect(pass).toHaveProperty("endY");
      expect(pass).toHaveProperty("passType");
      expect(pass).toHaveProperty("isAssist");
      expect(typeof pass.isAssist).toBe("boolean");
    }
  });

  it("pass with end coordinates has non-null endX, endY, length, angle", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const passWithEnd = passes.find((p) => p.providerEventId === "1001");

    expect(passWithEnd).toBeDefined();
    const p = passWithEnd as NonNullable<typeof passWithEnd>;
    expect(p.endX).toBeTypeOf("number");
    expect(p.endY).toBeTypeOf("number");
    expect(p.length).toBeTypeOf("number");
    expect(p.length).toBeGreaterThan(0);
    expect(p.angle).toBeTypeOf("number");
  });

  it("pass without end coordinates has null endX, endY, length, angle", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    // Event 1009 has no qualifier 140/141
    const passNoEnd = passes.find((p) => p.providerEventId === "1009");

    expect(passNoEnd).toBeDefined();
    const p = passNoEnd as NonNullable<typeof passNoEnd>;
    expect(p.endX).toBeNull();
    expect(p.endY).toBeNull();
    expect(p.length).toBeNull();
    expect(p.angle).toBeNull();
  });

  it("classifies through-ball assist correctly", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const throughBallAssist = passes.find((p) => p.providerEventId === "1003");

    expect(throughBallAssist).toBeDefined();
    const p = throughBallAssist as NonNullable<typeof throughBallAssist>;
    expect(p.passType).toBe("through-ball");
    expect(p.isAssist).toBe(true);
  });

  it("classifies cross correctly", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const cross = passes.find((p) => p.providerEventId === "1002");

    expect(cross).toBeDefined();
    expect((cross as NonNullable<typeof cross>).passType).toBe("cross");
  });

  it("classifies goal kick correctly", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const goalKick = passes.find((p) => p.providerEventId === "1005");

    expect(goalKick).toBeDefined();
    expect((goalKick as NonNullable<typeof goalKick>).passType).toBe("goal-kick");
  });

  it("classifies throw-in correctly", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const throwIn = passes.find((p) => p.providerEventId === "1006");

    expect(throwIn).toBeDefined();
    expect((throwIn as NonNullable<typeof throwIn>).passType).toBe("throw-in");
  });

  it("classifies corner correctly", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const corner = passes.find((p) => p.providerEventId === "1007");

    expect(corner).toBeDefined();
    expect((corner as NonNullable<typeof corner>).passType).toBe("corner");
  });

  it("defaults to ground pass when no special qualifiers present", () => {
    const passes = events.filter((e): e is Event & { kind: "pass" } => e.kind === "pass");
    const ground = passes.find((p) => p.providerEventId === "1009");

    expect(ground).toBeDefined();
    expect((ground as NonNullable<typeof ground>).passType).toBe("ground");
  });

  it("returns empty array for empty input", () => {
    const result = fromOpta.events([], ctx);
    expect(result).toEqual([]);
  });

  it("preserves Opta qualifiers, timestamps, and MA36 enrichment as source metadata", () => {
    const enriched = fromOpta.events(
      [
        {
          id: 9001,
          eventId: 901,
          typeId: 1,
          periodId: 1,
          timeMin: 12,
          timeSec: 34,
          contestantId: home.id,
          playerId: "p1",
          outcome: 1,
          x: 40,
          y: 45,
          qualifier: [
            { qualifierId: 140, value: "58" },
            { qualifierId: 141, value: "52" },
          ],
          timestampUtc: "2025-08-15T19:12:34.000Z",
          sequenceId: "seq-12",
          possessionId: "pos-7",
          hasPressure: true,
          hasPressureReceived: false,
          hasPassOption: true,
          hasPassTarget: true,
          hasReception: true,
          hasLineBreakingPass: true,
          xThreatApplied: 0.123,
          xThreatRemoved: 0.01,
        },
      ],
      ctx,
    );
    const pass = enriched[0];

    expect(pass?.kind).toBe("pass");
    const sourceMeta = pass?.sourceMeta as Record<string, unknown> | undefined;
    const ma36 = sourceMeta?.ma36 as Record<string, unknown> | undefined;
    expect(sourceMeta?.timestampUtc).toBe("2025-08-15T19:12:34.000Z");
    expect(sourceMeta?.qualifiers).toEqual([
      { qualifierId: 140, value: "58" },
      { qualifierId: 141, value: "52" },
    ]);
    expect(ma36).toMatchObject({
      sequenceId: "seq-12",
      possessionId: "pos-7",
      hasPressure: true,
      hasPassOption: true,
      hasReception: true,
      hasLineBreakingPass: true,
      xThreatApplied: 0.123,
      xThreatRemoved: 0.01,
    });
  });

  it("groups MA36-enriched canonical events into possession windows", () => {
    const canonical = fromOpta.events(
      [
        {
          id: 9101,
          eventId: 911,
          typeId: 1,
          periodId: 1,
          timeMin: 7,
          timeSec: 5,
          contestantId: home.id,
          playerId: "p1",
          outcome: 1,
          x: 40,
          y: 45,
          qualifier: [
            { qualifierId: 140, value: "52" },
            { qualifierId: 141, value: "48" },
          ],
          sequenceId: "seq-a",
          possessionId: "pos-a",
          hasPressure: true,
          hasReception: false,
          hasLineBreakingPass: true,
          xThreatApplied: 0.2,
          xThreatRemoved: 0.03,
        },
        {
          id: 9102,
          eventId: 912,
          typeId: 1,
          periodId: 1,
          timeMin: 7,
          timeSec: 12,
          contestantId: home.id,
          playerId: "p2",
          outcome: 1,
          x: 52,
          y: 48,
          qualifier: [
            { qualifierId: 140, value: "63" },
            { qualifierId: 141, value: "46" },
          ],
          sequenceId: "seq-a",
          possessionId: "pos-a",
          hasPressure: false,
          hasReception: true,
          hasLineBreakingPass: false,
          xThreatApplied: 0.05,
          xThreatRemoved: 0,
        },
      ],
      ctx,
    );
    const windows = fromOpta.possessionWindows(canonical, {
      teamNamesById: { [home.id]: "Home" },
    });

    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({
      provider: "opta",
      providerPossessionId: "pos-a",
      sequenceId: "seq-a",
      teamId: home.id,
      teamName: "Home",
      period: 1,
      startMinute: 7,
      startSecond: 5,
      endMinute: 7,
      endSecond: 12,
      metrics: {
        eventCount: 2,
        passCount: 2,
        shotCount: 0,
        pressureTaggedEventCount: 1,
        receptionCount: 1,
        lineBreakingPassCount: 1,
        xThreatApplied: 0.25,
        xThreatRemoved: 0.03,
      },
    });
    expect(windows[0]?.sourceMeta?.caveat).toContain("do not classify");
  });

  it("splits provider possession windows when canonical events have a large time gap", () => {
    const canonical = fromOpta.events(
      [
        {
          id: 9201,
          eventId: 921,
          typeId: 1,
          periodId: 1,
          timeMin: 2,
          timeSec: 0,
          contestantId: home.id,
          playerId: "p1",
          outcome: 1,
          x: 40,
          y: 45,
          qualifier: [
            { qualifierId: 140, value: "52" },
            { qualifierId: 141, value: "48" },
          ],
          sequenceId: "seq-gap",
          possessionId: "pos-gap",
        },
        {
          id: 9202,
          eventId: 922,
          typeId: 1,
          periodId: 1,
          timeMin: 6,
          timeSec: 0,
          contestantId: home.id,
          playerId: "p2",
          outcome: 1,
          x: 52,
          y: 48,
          qualifier: [
            { qualifierId: 140, value: "63" },
            { qualifierId: 141, value: "46" },
          ],
          sequenceId: "seq-gap",
          possessionId: "pos-gap",
        },
      ],
      ctx,
    );
    const windows = fromOpta.possessionWindows(canonical, {
      maxEventGapSeconds: 30,
    });

    expect(windows).toHaveLength(2);
    expect(windows.map((window) => window.providerPossessionId)).toEqual([
      "pos-gap",
      "pos-gap",
    ]);
    expect(windows.map((window) => window.sourceMeta?.segmentCount)).toEqual([2, 2]);
  });
});
