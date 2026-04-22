import { describe, expect, it } from "vitest";

import type { ShotEvent } from "@withqwerty/campos-schema";

import {
  createGoalMouthOutcomeMarkers,
  createGoalMouthPsxgMarkers,
  DEFAULT_GOAL_MOUTH_OUTCOME_PALETTE,
  DEFAULT_GOAL_MOUTH_PSXG_PALETTE,
  goalMouthOutcomeColor,
  goalMouthPsxgColor,
  goalMouthPsxgMarkerSize,
  scaleGoalMouthMarkerSize,
} from "../src/index";
import { resolveStyleValue } from "../src/styleValue";

const goalShot: ShotEvent = {
  kind: "shot",
  id: "goal-1",
  matchId: "m1",
  teamId: "t1",
  playerId: "p1",
  playerName: "Striker",
  minute: 12,
  addedMinute: null,
  second: 4,
  period: 1,
  x: 93,
  y: 51,
  xg: 0.22,
  xgot: 0.56,
  outcome: "goal",
  bodyPart: "right-foot",
  isOwnGoal: false,
  isPenalty: false,
  context: "regular-play",
  provider: "opta",
  providerEventId: "1",
  goalMouthY: 24,
  goalMouthZ: 42,
};

const savedShot: ShotEvent = {
  ...goalShot,
  id: "save-1",
  outcome: "saved",
  xgot: 0.18,
};

describe("goalMouthShotChartHelpers", () => {
  it("maps xGOT values onto the default PSxG palette", () => {
    expect(goalMouthPsxgColor(0)).toBe(DEFAULT_GOAL_MOUTH_PSXG_PALETTE[0]);
    expect(goalMouthPsxgColor(1)).toBe(
      DEFAULT_GOAL_MOUTH_PSXG_PALETTE[DEFAULT_GOAL_MOUTH_PSXG_PALETTE.length - 1],
    );
  });

  it("falls back to the default PSxG palette when a custom palette is empty", () => {
    expect(goalMouthPsxgColor(0.5, [])).toBe(goalMouthPsxgColor(0.5));
  });

  it("scales goal markers larger than non-goal markers by default", () => {
    expect(goalMouthPsxgMarkerSize(goalShot)).toBeGreaterThan(
      goalMouthPsxgMarkerSize(savedShot),
    );
  });

  it("builds a reusable PSxG marker style helper", () => {
    const markers = createGoalMouthPsxgMarkers();

    expect(resolveStyleValue(markers.shape, { shot: goalShot })).toBe("diamond");
    expect(resolveStyleValue(markers.shape, { shot: savedShot })).toBe("circle");
    expect(resolveStyleValue(markers.fill, { shot: goalShot })).toBe(
      goalMouthPsxgColor(goalShot.xgot),
    );
    expect(resolveStyleValue(markers.stroke, { shot: goalShot })).toBe("#f3c515");
    expect(resolveStyleValue(markers.size, { shot: savedShot })).toBe(
      goalMouthPsxgMarkerSize(savedShot),
    );
  });

  describe("outcome-coloured preset", () => {
    it("scales marker size linearly between min and max based on xGOT", () => {
      const min = scaleGoalMouthMarkerSize(0, { minSize: 0.1, maxSize: 0.5 });
      const mid = scaleGoalMouthMarkerSize(0.5, { minSize: 0.1, maxSize: 0.5 });
      const max = scaleGoalMouthMarkerSize(1, { minSize: 0.1, maxSize: 0.5 });
      expect(min).toBeCloseTo(0.1);
      expect(mid).toBeCloseTo(0.3);
      expect(max).toBeCloseTo(0.5);
    });

    it("clamps xGOT values outside the domain", () => {
      expect(scaleGoalMouthMarkerSize(-0.2)).toBe(scaleGoalMouthMarkerSize(0));
      expect(scaleGoalMouthMarkerSize(2)).toBe(scaleGoalMouthMarkerSize(1));
    });

    it("treats missing xGOT as the domain minimum", () => {
      expect(scaleGoalMouthMarkerSize(null)).toBe(scaleGoalMouthMarkerSize(0));
      expect(scaleGoalMouthMarkerSize(undefined)).toBe(scaleGoalMouthMarkerSize(0));
    });

    it("resolves outcome-based colours with caller overrides winning", () => {
      expect(goalMouthOutcomeColor("goal")).toBe(DEFAULT_GOAL_MOUTH_OUTCOME_PALETTE.goal);
      expect(goalMouthOutcomeColor("saved")).toBe(
        DEFAULT_GOAL_MOUTH_OUTCOME_PALETTE.save,
      );
      expect(goalMouthOutcomeColor("blocked")).toBe(
        DEFAULT_GOAL_MOUTH_OUTCOME_PALETTE.save,
      );
      expect(goalMouthOutcomeColor("goal", { goal: "#ff00aa" })).toBe("#ff00aa");
    });

    it("builds a reusable outcome marker style helper", () => {
      const markers = createGoalMouthOutcomeMarkers({
        palette: { goal: "#e2525d", save: "#8d86b3" },
        fillOpacity: 0.45,
      });
      expect(resolveStyleValue(markers.shape, { shot: goalShot })).toBe("circle");
      expect(resolveStyleValue(markers.shape, { shot: savedShot })).toBe("circle");
      expect(resolveStyleValue(markers.fill, { shot: goalShot })).toBe("#e2525d");
      expect(resolveStyleValue(markers.fill, { shot: savedShot })).toBe("#8d86b3");
      expect(resolveStyleValue(markers.fillOpacity, { shot: goalShot })).toBe(0.45);
      expect(resolveStyleValue(markers.stroke, { shot: goalShot })).toBe("none");
      // Size is ordered by xGOT, independent of outcome
      const goalSize = resolveStyleValue(markers.size, { shot: goalShot });
      const savedSize = resolveStyleValue(markers.size, { shot: savedShot });
      expect(goalSize).toBeDefined();
      expect(savedSize).toBeDefined();
      expect(goalSize as number).toBeGreaterThan(savedSize as number);
    });
  });
});
