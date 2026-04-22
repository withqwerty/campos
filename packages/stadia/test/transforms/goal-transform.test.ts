import { describe, expect, it } from "vitest";
import { createGoalProjection } from "../../src/transforms/goal-transform.js";
import { GOAL } from "../../src/geometry/constants.js";

describe("createGoalProjection", () => {
  describe("striker facing", () => {
    const project = createGoalProjection("striker");

    it("maps (0, 0) to bottom-left post", () => {
      const p = project(0, 0);
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(GOAL.depth);
    });

    it("maps (100, 100) to top-right (crossbar, right post)", () => {
      const p = project(100, 100);
      expect(p.x).toBeCloseTo(GOAL.width);
      expect(p.y).toBeCloseTo(0);
    });

    it("maps (50, 50) to center of goal", () => {
      const p = project(50, 50);
      expect(p.x).toBeCloseTo(GOAL.width / 2);
      expect(p.y).toBeCloseTo(GOAL.depth / 2);
    });
  });

  describe("goalkeeper facing (mirrored)", () => {
    const project = createGoalProjection("goalkeeper");

    it("mirrors horizontally — (0, 0) maps to bottom-right", () => {
      const p = project(0, 0);
      expect(p.x).toBeCloseTo(GOAL.width);
      expect(p.y).toBeCloseTo(GOAL.depth);
    });

    it("(100, 100) maps to top-left", () => {
      const p = project(100, 100);
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(0);
    });
  });

  describe("frameThickness inset (playfield-aware projection)", () => {
    const THICKNESS = 0.18;
    const project = createGoalProjection("striker", { frameThickness: THICKNESS });

    it("maps (0, 0) to the inside bottom-left corner, not the outer corner", () => {
      const p = project(0, 0);
      expect(p.x).toBeCloseTo(THICKNESS);
      expect(p.y).toBeCloseTo(GOAL.depth);
    });

    it("maps (100, 100) to the inside top-right corner", () => {
      const p = project(100, 100);
      expect(p.x).toBeCloseTo(GOAL.width - THICKNESS);
      expect(p.y).toBeCloseTo(THICKNESS);
    });

    it("maps (50, 50) to the centre of the playfield (same as no-inset)", () => {
      const p = project(50, 50);
      expect(p.x).toBeCloseTo(GOAL.width / 2);
      expect(p.y).toBeCloseTo(GOAL.depth / 2 + THICKNESS / 2);
    });

    it("goalkeeper facing mirrors the inset projection", () => {
      const gk = createGoalProjection("goalkeeper", { frameThickness: THICKNESS });
      const p = gk(0, 0);
      expect(p.x).toBeCloseTo(GOAL.width - THICKNESS);
      expect(p.y).toBeCloseTo(GOAL.depth);
    });
  });
});
