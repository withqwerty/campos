import { describe, expect, it } from "vitest";

import { fromWhoScored } from "../../src/index";
import type { WhoScoredMatchData, WhoScoredMatchInfo } from "../../src/index";

import wolvesVsArsenal from "../fixtures/whoscored/wolves-v-arsenal-shots.json";
import arsenalVsWolvesOG from "../fixtures/whoscored/arsenal-v-wolves-with-own-goals.json";

function getRequiredShot(shots: ReturnType<typeof fromWhoScored.shots>, index: number) {
  const shot = shots[index];
  expect(shot).toBeDefined();
  if (!shot) {
    throw new Error(`Expected shot at index ${index}`);
  }
  return shot;
}

describe("fromWhoScored.shots", () => {
  const matchInfo: WhoScoredMatchInfo = { matchId: "1903469" };

  it("normalizes WhoScored shot events into Campos shot entities", () => {
    const shots = fromWhoScored.shots(
      wolvesVsArsenal as unknown as WhoScoredMatchData,
      matchInfo,
    );

    // 15 shots total, no own goals in this match
    expect(shots).toHaveLength(15);

    // First shot: Bukayo Saka goal
    expect(shots[0]).toMatchObject({
      kind: "shot",
      provider: "whoscored",
      outcome: "goal",
      bodyPart: "head",
      teamId: "13",
      playerName: "Bukayo Saka",
    });
  });

  it("sets provider to whoscored on all shots", () => {
    const shots = fromWhoScored.shots(
      wolvesVsArsenal as unknown as WhoScoredMatchData,
      matchInfo,
    );

    for (const shot of shots) {
      expect(shot.provider).toBe("whoscored");
    }
  });

  it("normalizes coordinates into Campos 0-100 space", () => {
    const shots = fromWhoScored.shots(
      wolvesVsArsenal as unknown as WhoScoredMatchData,
      matchInfo,
    );

    for (const shot of shots) {
      expect(shot.x).toBeGreaterThanOrEqual(0);
      expect(shot.x).toBeLessThanOrEqual(100);
      expect(shot.y).toBeGreaterThanOrEqual(0);
      expect(shot.y).toBeLessThanOrEqual(100);
    }
  });

  it("inverts the y-axis (WhoScored y → 100 - y)", () => {
    const shots = fromWhoScored.shots(
      wolvesVsArsenal as unknown as WhoScoredMatchData,
      matchInfo,
    );
    const firstShot = getRequiredShot(shots, 0);

    // First shot: Saka at raw y=50.4 → Campos y=49.6
    expect(firstShot.y).toBeCloseTo(49.6, 1);
  });

  it("passes x through without direction flip", () => {
    const shots = fromWhoScored.shots(
      wolvesVsArsenal as unknown as WhoScoredMatchData,
      matchInfo,
    );
    const firstShot = getRequiredShot(shots, 0);

    // First shot: Saka at raw x=95.2 → Campos x=95.2
    expect(firstShot.x).toBeCloseTo(95.2, 1);
  });

  it("resolves player names from playerIdNameDictionary", () => {
    const shots = fromWhoScored.shots(
      wolvesVsArsenal as unknown as WhoScoredMatchData,
      matchInfo,
    );

    const named = shots.filter((s) => s.playerName != null);
    expect(named.length).toBeGreaterThan(0);

    // Spot-check a known player
    const saka = shots.find((s) => s.playerName === "Bukayo Saka");
    expect(saka).toBeDefined();
  });

  it("populates goalMouthY and goalMouthZ when available", () => {
    const shots = fromWhoScored.shots(
      wolvesVsArsenal as unknown as WhoScoredMatchData,
      matchInfo,
    );
    const firstShot = getRequiredShot(shots, 0);

    // Raw WhoScored/StatsPerform goal-mouth qualifiers are normalized into the
    // canonical Campos goal frame (0 = left post, 100 = right post, 100 = crossbar).
    expect(firstShot.goalMouthY).toBe(37.5);
    expect(firstShot.goalMouthZ).toBe(30);
  });

  it("drops out-of-frame goal-mouth axes instead of exposing raw provider zones", () => {
    const shots = fromWhoScored.shots(
      wolvesVsArsenal as unknown as WhoScoredMatchData,
      matchInfo,
    );
    const wideShot = getRequiredShot(shots, 1);

    expect(wideShot.goalMouthY).toBeNull();
    expect(wideShot.goalMouthZ).toBeCloseTo(21.8, 1);
  });

  it("excludes own goals from shot projection", () => {
    const ogMatchInfo: WhoScoredMatchInfo = { matchId: "1903484" };
    const shots = fromWhoScored.shots(
      arsenalVsWolvesOG as unknown as WhoScoredMatchData,
      ogMatchInfo,
    );

    // Fixture has 3 regular shots + 2 own goals; own goals should be filtered
    expect(shots).toHaveLength(3);
    expect(shots.every((s) => !s.isOwnGoal)).toBe(true);
  });

  it("filters out non-shot events", () => {
    // The wolves fixture includes a non-shot event (pass)
    const shots = fromWhoScored.shots(
      wolvesVsArsenal as unknown as WhoScoredMatchData,
      matchInfo,
    );

    // 16 events in fixture, 15 are shots, 1 is a pass → 15 returned
    expect(shots).toHaveLength(15);
  });

  it("includes WhoScored-specific fields in sourceMeta", () => {
    const shots = fromWhoScored.shots(
      wolvesVsArsenal as unknown as WhoScoredMatchData,
      matchInfo,
    );
    const firstShot = getRequiredShot(shots, 0);
    const meta = firstShot.sourceMeta;
    expect(meta).toBeDefined();
    if (!meta) {
      throw new Error("Expected sourceMeta on first WhoScored shot");
    }
    expect(meta).toHaveProperty("typeId");
    expect(meta).toHaveProperty("satisfiedEventsTypes");
  });
});
