import { describe, expect, it } from "vitest";

import type { MatchContext } from "@withqwerty/campos-schema";

import { fromOpta } from "../../src/index";

// Battle-test fixture — Liverpool 3-1 Arsenal, 2019-08-24, Opta EG feed.
import raw from "../fixtures/opta/liv-ars-2019-shots.json";

/**
 * Physical-correctness integration test.
 *
 * The Opta expected-goals feed encodes every event in the acting team's
 * attacker-perspective frame (x=100 = goal being attacked). Passing events
 * through the adapter with `attackRelative: true` should preserve this
 * semantic, so known physical positions from the actual match should land in
 * the correct canonical Campos y quadrant:
 *
 *   - Robertson (Liverpool left-back) shoots from Liverpool's left wing →
 *     high Campos y (attacker's left = y near 100).
 *   - Aubameyang (Arsenal) shot at minute 10 was on Arsenal's right side →
 *     low Campos y (attacker's right = y near 0).
 *   - Matip's headed goal from a corner (minute 40) was central in front of
 *     the goal → near-centre Campos y (~50).
 */
describe("fromOpta.shots integration — Liverpool vs Arsenal 2019-08-24", () => {
  const matchContext: MatchContext = {
    matchId: raw.matchId,
    homeTeamId: raw.homeTeamId,
    awayTeamId: raw.awayTeamId,
    attackRelative: true,
    periods: {
      firstHalf: { homeAttacksToward: "increasing-x" },
      secondHalf: { homeAttacksToward: "increasing-x" },
    },
  };

  const shots = fromOpta.shots(
    raw.events as Parameters<typeof fromOpta.shots>[0],
    matchContext,
  );

  it("produces the expected number of plottable shots", () => {
    expect(shots.length).toBeGreaterThan(20);
  });

  it("Robertson's 1st-minute shot lands on the attacker's left (left wing)", () => {
    const robertson = shots.find(
      (s) => s.playerName === "A. Robertson" && s.minute === 1,
    );
    expect(robertson).toBeDefined();
    // Left-back attacking right → left wing = attacker's left = high Campos y.
    expect(robertson?.y).toBeGreaterThan(60);
    // Well inside the attacking half.
    expect(robertson?.x).toBeGreaterThan(60);
  });

  it("Aubameyang's 10th-minute shot lands on the attacker's right", () => {
    const aubameyang = shots.find(
      (s) => s.playerName === "P. Aubameyang" && s.minute === 10,
    );
    expect(aubameyang).toBeDefined();
    // Match video confirms the chance was on Arsenal's right side of the
    // pitch → attacker's right = low Campos y.
    expect(aubameyang?.y).toBeLessThan(40);
    expect(aubameyang?.x).toBeGreaterThan(70);
  });

  it("Matip's headed goal from a corner (minute 40) is central and near the goal", () => {
    const matip = shots.find((s) => s.playerName === "J. Matip");
    expect(matip).toBeDefined();
    expect(matip?.outcome).toBe("goal");
    // Headed goal from a corner delivery → central-ish, near the goal line.
    expect(matip?.x).toBeGreaterThan(88);
    expect(matip?.y).toBeGreaterThan(35);
    expect(matip?.y).toBeLessThan(65);
  });

  it("every shot carries high Campos x (all in the attacking third)", () => {
    // Attack-relative feeds put every shot toward x=100. This is a cheap
    // smoke test that the adapter didn't accidentally flip x.
    for (const shot of shots) {
      expect(shot.x).toBeGreaterThan(50);
    }
  });
});
