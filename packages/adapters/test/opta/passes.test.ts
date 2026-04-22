import { describe, expect, it } from "vitest";

import type { Event, MatchContext } from "@withqwerty/campos-schema";

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

describe("fromOpta.passes", () => {
  const passes = fromOpta.passes(matchEvents.liveData.event, ctx);
  const eventPasses = fromOpta
    .events(matchEvents.liveData.event, ctx)
    .filter((event): event is Event & { kind: "pass" } => event.kind === "pass");

  it("returns only pass events", () => {
    expect(passes.length).toBeGreaterThan(0);
    expect(passes.every((event: { kind: string }) => event.kind === "pass")).toBe(true);
  });

  it("matches the pass subset of events()", () => {
    expect(passes).toEqual(eventPasses);
  });

  it("returns empty array for empty input", () => {
    expect(fromOpta.passes([], ctx)).toEqual([]);
  });
});
