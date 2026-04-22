import { describe, expect, it } from "vitest";
import { PITCH, GOAL } from "../../src/geometry/constants.js";

describe("PITCH constants", () => {
  it("has FIFA standard dimensions", () => {
    expect(PITCH.length).toBe(105);
    expect(PITCH.width).toBe(68);
  });

  it("penalty area fits within pitch width", () => {
    expect(PITCH.penaltyAreaWidth).toBeLessThan(PITCH.width);
  });

  it("goal area fits within penalty area", () => {
    expect(PITCH.goalAreaWidth).toBeLessThan(PITCH.penaltyAreaWidth);
  });

  it("goal fits within goal area", () => {
    expect(GOAL.width).toBeLessThan(PITCH.goalAreaWidth);
  });

  it("penalty spot is inside penalty area", () => {
    expect(PITCH.penaltySpotDistance).toBeLessThan(PITCH.penaltyAreaLength);
  });
});
