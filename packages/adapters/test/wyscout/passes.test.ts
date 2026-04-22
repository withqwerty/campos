import { describe, expect, it } from "vitest";

import type { Event } from "@withqwerty/campos-schema";

import { fromWyscout } from "../../src/index";
import type { WyscoutMatchData } from "../../src/index";

import arsenalVsSouthampton from "../fixtures/wyscout/raw-match-arsenal-v-southampton.json";

const matchData = arsenalVsSouthampton as unknown as WyscoutMatchData;

describe("fromWyscout.passes", () => {
  const passes = fromWyscout.passes(matchData);
  const eventPasses = fromWyscout
    .events(matchData)
    .filter((event): event is Event & { kind: "pass" } => event.kind === "pass");

  it("returns only pass events", () => {
    expect(passes.length).toBeGreaterThan(1000);
    expect(passes.every((event: { kind: string }) => event.kind === "pass")).toBe(true);
  });

  it("matches the pass subset of events()", () => {
    expect(passes).toEqual(eventPasses);
  });

  it("keeps simple passes as ground passes", () => {
    const simplePass = passes.find((event) => event.providerEventId === "241083854");

    expect(simplePass).toMatchObject({
      providerEventId: "241083854",
      passType: "ground",
    });
  });

  it("uses the through-ball tag instead of the smart-pass subevent id", () => {
    const throughBall = passes.find((event) => event.providerEventId === "241084462");
    const smartPassWithoutThroughTag = passes.find(
      (event) => event.providerEventId === "241083996",
    );

    expect(throughBall).toMatchObject({
      providerEventId: "241084462",
      passType: "through-ball",
    });
    expect(smartPassWithoutThroughTag).toMatchObject({
      providerEventId: "241083996",
      passType: "ground",
    });
  });
});
