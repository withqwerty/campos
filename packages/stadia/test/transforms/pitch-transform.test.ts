import { describe, expect, it } from "vitest";
import { createPitchProjection } from "../../src/transforms/pitch-transform.js";
import { PITCH } from "../../src/geometry/constants.js";

describe("createPitchProjection", () => {
  describe("full pitch, vertical orientation", () => {
    const project = createPitchProjection("full", "up");

    it("maps (0, 0) to bottom-right of SVG (own goal, attacker's right)", () => {
      // camposY=0 is the attacker's right side. On a vertical pitch with
      // the attacker at the bottom, their right is on the viewer's right,
      // matching broadcast convention and the horizontal orientation.
      const p = project(0, 0);
      expect(p.x).toBeCloseTo(PITCH.width);
      expect(p.y).toBeCloseTo(PITCH.length);
    });

    it("maps (100, 100) to top-left of SVG (opposition goal, attacker's left)", () => {
      const p = project(100, 100);
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(0);
    });

    it("maps (50, 50) to center of pitch", () => {
      const p = project(50, 50);
      expect(p.x).toBeCloseTo(PITCH.width / 2);
      expect(p.y).toBeCloseTo(PITCH.length / 2);
    });
  });

  describe("half pitch, vertical orientation", () => {
    const project = createPitchProjection("half", "up");

    it("maps (50, 0) to bottom-right of half-pitch SVG", () => {
      // Halfway line at the bottom edge, attacker's right side
      const p = project(50, 0);
      expect(p.x).toBeCloseTo(PITCH.width);
      expect(p.y).toBeCloseTo(PITCH.length / 2);
    });

    it("maps (100, 100) to top-left (opposition goal, attacker's left)", () => {
      const p = project(100, 100);
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(0);
    });

    it("maps out-of-crop (30, 50) to SVG y beyond viewBox height (clipped by viewport)", () => {
      const p = project(30, 50);
      // Campos x=30 → SVG y = ((100-30)/100)*105 = 73.5, beyond half-pitch viewBox height of 52.5
      expect(p.y).toBeGreaterThan(PITCH.length / 2);
    });
  });

  describe("horizontal orientation", () => {
    const project = createPitchProjection("full", "right");

    it("Campos x maps to SVG x (length axis), Campos y inverted to SVG y", () => {
      const p = project(100, 100);
      expect(p.x).toBeCloseTo(PITCH.length);
      expect(p.y).toBeCloseTo(0);
    });

    it("origin (0,0) maps to bottom-left", () => {
      const p = project(0, 0);
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(PITCH.width);
    });
  });

  describe("penalty-area crop", () => {
    const project = createPitchProjection("penalty-area", "up");

    it("maps penalty spot (89.5, 50) near center of view", () => {
      const p = project(89.5, 50);
      expect(p.x).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
    });
  });
});
