import { describe, expect, it } from "vitest";

import type { Event } from "@withqwerty/campos-schema";
import type { StatsBombEvent, StatsBombMatchInfo } from "../../src/statsbomb/parse";

import { fromStatsBomb } from "../../src/index";

import sampleEvents from "../fixtures/statsbomb/raw-match-events-sample.json";

const sampleEventsTyped = sampleEvents.event as unknown as StatsBombEvent[];

const matchInfo: StatsBombMatchInfo = {
  id: sampleEvents.matchInfo.id,
  homeTeam: sampleEvents.matchInfo.homeTeam,
  awayTeam: sampleEvents.matchInfo.awayTeam,
};

describe("fromStatsBomb.passes", () => {
  const passes = fromStatsBomb.passes(sampleEventsTyped, matchInfo);
  const eventPasses = fromStatsBomb
    .events(sampleEventsTyped, matchInfo)
    .filter((event): event is Event & { kind: "pass" } => event.kind === "pass");

  it("returns only pass events", () => {
    expect(passes.length).toBeGreaterThan(0);
    expect(passes.every((event: { kind: string }) => event.kind === "pass")).toBe(true);
  });

  it("matches the pass subset of events()", () => {
    expect(passes).toEqual(eventPasses);
  });

  it("returns empty array for empty input", () => {
    expect(fromStatsBomb.passes([] as StatsBombEvent[], matchInfo)).toEqual([]);
  });
});
