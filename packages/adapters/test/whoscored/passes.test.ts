import { describe, expect, it } from "vitest";

import type { Event } from "@withqwerty/campos-schema";

import { fromWhoScored } from "../../src/whoscored/index.js";
import type { WhoScoredMatchData } from "../../src/whoscored/parse.js";

import sportingVsArsenal from "../fixtures/opta/whoscored-sporting-v-arsenal.json";

const matchInfo = {
  matchId: sportingVsArsenal.matchId,
};

const matchData = sportingVsArsenal as unknown as WhoScoredMatchData;

describe("fromWhoScored.passes", () => {
  const passes = fromWhoScored.passes(matchData, matchInfo);
  const eventPasses = fromWhoScored
    .events(matchData, matchInfo)
    .filter((event): event is Event & { kind: "pass" } => event.kind === "pass");

  it("returns only pass events", () => {
    expect(passes.length).toBeGreaterThan(0);
    expect(passes.every((event: { kind: string }) => event.kind === "pass")).toBe(true);
  });

  it("matches the pass subset of events()", () => {
    expect(passes).toEqual(eventPasses);
  });
});
