import { describe, expect, it } from "vitest";

import { fromWyscout } from "../../src/index";
import type { WyscoutMatchData } from "../../src/index";

import arsenalVsSouthampton from "../fixtures/wyscout/raw-match-arsenal-v-southampton.json";

const matchData = arsenalVsSouthampton as unknown as WyscoutMatchData;

describe("fromWyscout.events", () => {
  const events = fromWyscout.events(matchData);

  it("normalizes a mixed Wyscout stream into passes and shots", () => {
    expect(events.length).toBeGreaterThan(1000);
    expect(events.some((event) => event.kind === "pass")).toBe(true);
    expect(events.some((event) => event.kind === "shot")).toBe(true);
    expect(events.some((event) => event.kind === "foul-committed")).toBe(true);
    expect(events.some((event) => event.kind === "card")).toBe(true);
    expect(events.some((event) => event.kind === "duel")).toBe(true);
    expect(events.some((event) => event.kind === "interception")).toBe(true);
    expect(events.some((event) => event.kind === "clearance")).toBe(true);
    expect(events.some((event) => event.kind === "goalkeeper")).toBe(true);
  });

  it("maps all pass events from the fixture", () => {
    const passes = events.filter((event) => event.kind === "pass");
    expect(passes).toHaveLength(1038);

    expect(passes[0]).toMatchObject({
      kind: "pass",
      provider: "wyscout",
      providerEventId: "241083854",
      teamId: "1619",
      playerId: "383",
      playerName: null,
      x: 52,
      y: 48,
      endX: 27,
      endY: 50,
      passType: "ground",
      isAssist: false,
    });
  });

  it("computes pass length and angle from normalized coordinates", () => {
    const pass = events.find((event) => event.providerEventId === "241083854");
    expect(pass?.kind).toBe("pass");
    if (pass?.kind !== "pass") {
      throw new Error("Expected sample Wyscout pass to be present");
    }

    expect(pass.length).toBeCloseTo(25.08, 2);
    expect(pass.angle).toBeCloseTo(3.0618, 4);
  });

  it("maps pass subevent types into Campos pass types", () => {
    const passes = events.filter((event) => event.kind === "pass");

    expect(passes.some((event) => event.passType === "cross")).toBe(true);
    expect(passes.some((event) => event.passType === "high")).toBe(true);
    expect(passes.some((event) => event.passType === "ground")).toBe(true);
    expect(passes.some((event) => event.passType === "through-ball")).toBe(true);
  });

  it("normalizes Wyscout period-local seconds into match-relative minutes", () => {
    const secondHalfPass = events.find((event) => event.providerEventId === "241084813");

    expect(secondHalfPass).toMatchObject({
      kind: "pass",
      period: 2,
      minute: 45,
      addedMinute: null,
      second: 26,
    });
  });

  it("maps foul and card events from tagged fouls", () => {
    const fouls = events.filter((event) => event.kind === "foul-committed");
    const cards = events.filter((event) => event.kind === "card");

    expect(fouls).toHaveLength(21);
    expect(cards).toHaveLength(5);
    expect(cards.some((event) => event.cardType === "yellow")).toBe(true);
    expect(cards.some((event) => event.cardType === "red")).toBe(true);
  });

  it("maps duels, interceptions, clearances, and goalkeeper actions", () => {
    const duels = events.filter((event) => event.kind === "duel");
    const interceptions = events.filter((event) => event.kind === "interception");
    const clearances = events.filter((event) => event.kind === "clearance");
    const goalkeeper = events.filter((event) => event.kind === "goalkeeper");

    expect(duels.length).toBeGreaterThan(250);
    expect(interceptions).toHaveLength(113);
    expect(clearances).toHaveLength(38);
    expect(goalkeeper).toHaveLength(15);

    expect(duels.some((event) => event.duelType === "aerial")).toBe(true);
    expect(duels.some((event) => event.duelOutcome === "won")).toBe(true);
    expect(goalkeeper.some((event) => event.actionType === "save")).toBe(true);
    expect(goalkeeper.every((event) => event.actionType === "save")).toBe(true);
  });

  it("keeps shot parity with shots()", () => {
    const eventShots = events.filter((event) => event.kind === "shot");
    const projectedShots = fromWyscout.shots(matchData);

    expect(eventShots).toEqual(projectedShots);
  });

  it("sets provider to wyscout on all normalized events", () => {
    for (const event of events) {
      expect(event.provider).toBe("wyscout");
    }
  });
});
