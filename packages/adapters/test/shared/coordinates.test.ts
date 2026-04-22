import { describe, expect, it } from "vitest";

import { statsPerformGoalMouthToCampos } from "../../src/shared/coordinates.js";

describe("statsPerformGoalMouthToCampos", () => {
  it("maps StatsPerform in-frame goal-mouth values into canonical 0..100 goal-frame space", () => {
    expect(statsPerformGoalMouthToCampos(54.8, 0)).toEqual({
      goalMouthY: 0,
      goalMouthZ: 0,
    });
    expect(statsPerformGoalMouthToCampos(45.2, 38)).toEqual({
      goalMouthY: 100,
      goalMouthZ: 100,
    });
    expect(statsPerformGoalMouthToCampos(52.1, 18.4)).toEqual({
      goalMouthY: 28.1,
      goalMouthZ: 48.4,
    });
  });

  it("returns null for axes that fall outside the physical goal frame", () => {
    expect(statsPerformGoalMouthToCampos(61.2, 18.4)).toEqual({
      goalMouthY: null,
      goalMouthZ: 48.4,
    });
    expect(statsPerformGoalMouthToCampos(52.1, 73.6)).toEqual({
      goalMouthY: 28.1,
      goalMouthZ: null,
    });
  });
});
