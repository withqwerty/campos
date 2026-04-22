import { describe, expect, it } from "vitest";

import { fromWhoScored } from "../../src/whoscored/index.js";
import type { WhoScoredMatchData } from "../../src/whoscored/parse.js";

import sportingVsArsenal from "../fixtures/opta/whoscored-sporting-v-arsenal.json";

const matchInfo = {
  matchId: sportingVsArsenal.matchId,
};

const matchData = sportingVsArsenal as unknown as WhoScoredMatchData;

describe("fromWhoScored with full Sporting vs Arsenal fixture", () => {
  const events = fromWhoScored.events(matchData, matchInfo);
  const shots = fromWhoScored.shots(matchData, matchInfo);

  it("normalizes a large match-scoped event stream", () => {
    expect(events.length).toBeGreaterThan(1000);
    expect(events.length).toBeLessThanOrEqual(sportingVsArsenal.events.length);
  });

  it("produces multiple recognized event kinds from the same fixture", () => {
    const kinds = new Set(events.map((event) => event.kind));
    expect(kinds.has("pass")).toBe(true);
    expect(kinds.has("shot")).toBe(true);
    expect(kinds.has("foul-committed")).toBe(true);
    expect(kinds.has("interception")).toBe(true);
    expect(kinds.has("clearance")).toBe(true);
    expect(kinds.has("duel")).toBe(true);
    expect(kinds.has("goalkeeper")).toBe(true);
  });

  it("keeps provider identity as whoscored", () => {
    for (const event of events) {
      expect(event.provider).toBe("whoscored");
    }
  });

  it("produces canonical shot events with normalized coordinates", () => {
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) {
      expect(shot.kind).toBe("shot");
      expect(shot.provider).toBe("whoscored");
      expect(shot.matchId).toBe(matchInfo.matchId);
      expect(shot.x).toBeGreaterThanOrEqual(0);
      expect(shot.x).toBeLessThanOrEqual(100);
      expect(shot.y).toBeGreaterThanOrEqual(0);
      expect(shot.y).toBeLessThanOrEqual(100);
    }
  });

  it("uses playerIdNameDictionary to populate player names when available", () => {
    const namedEvents = events.filter(
      (event) => event.playerId != null && event.playerName != null,
    );
    expect(namedEvents.length).toBeGreaterThan(100);
  });

  it("preserves WhoScored expandedMinute for stoppage time", () => {
    const firstAddedMinute = events.find(
      (event) => event.providerEventId === "2921065825",
    );
    const secondAddedMinute = events.find(
      (event) => event.providerEventId === "2921066185",
    );

    expect(firstAddedMinute).toMatchObject({
      period: 2,
      minute: 90,
      addedMinute: 1,
      second: 1,
    });
    expect(secondAddedMinute).toMatchObject({
      period: 2,
      minute: 90,
      addedMinute: 2,
      second: 42,
    });
  });
});
