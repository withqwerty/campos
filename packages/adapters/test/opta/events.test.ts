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
});
