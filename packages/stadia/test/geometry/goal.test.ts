import { describe, expect, it } from "vitest";

import { GOAL } from "../../src/geometry/constants.js";
import { computeGoalMarkings } from "../../src/geometry/goal.js";

describe("computeGoalMarkings", () => {
  it("returns exactly two markings (frame + ground)", () => {
    const markings = computeGoalMarkings();
    expect(markings).toHaveLength(2);
    expect(markings.map((m) => m.id)).toEqual(["frame", "ground"]);
  });

  it("places the frame rectangle at the goal-local origin with GOAL.width × GOAL.depth", () => {
    const [frame] = computeGoalMarkings();
    expect(frame?.type).toBe("rect");
    expect(frame?.x).toBe(0);
    expect(frame?.y).toBe(0);
    expect(frame?.width).toBe(GOAL.width);
    expect(frame?.height).toBe(GOAL.depth);
  });

  it("places the ground line flush with the goal's back edge", () => {
    const [, ground] = computeGoalMarkings();
    expect(ground?.type).toBe("line");
    expect(ground?.x).toBe(0);
    expect(ground?.y).toBe(GOAL.depth);
    expect(ground?.x2).toBe(GOAL.width);
    expect(ground?.y2).toBe(GOAL.depth);
  });

  it("is deterministic — two invocations return structurally equal results", () => {
    expect(computeGoalMarkings()).toEqual(computeGoalMarkings());
  });
});
