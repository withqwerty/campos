import { describe, expect, it } from "vitest";
import { computeViewBox } from "../../src/transforms/viewbox.js";
import { PITCH, GOAL } from "../../src/geometry/constants.js";

describe("computeViewBox", () => {
  it("full pitch vertical", () => {
    const vb = computeViewBox("full", "up");
    expect(vb.width).toBeCloseTo(PITCH.width);
    expect(vb.height).toBeCloseTo(PITCH.length);
    expect(vb.minX).toBe(0);
    expect(vb.minY).toBe(0);
  });

  it("half pitch vertical default (attack) viewbox starts at the attacking goal", () => {
    const vb = computeViewBox("half", "up");
    expect(vb.width).toBeCloseTo(PITCH.width);
    expect(vb.height).toBeCloseTo(PITCH.length / 2);
    expect(vb.minY).toBe(0);
  });

  it("half pitch vertical defend viewbox starts at halfway line", () => {
    const vb = computeViewBox("half", "up", "defend");
    expect(vb.minY).toBeCloseTo(PITCH.length / 2);
    expect(vb.height).toBeCloseTo(PITCH.length / 2);
  });

  it("half pitch horizontal default (attack) viewbox is the attacking half", () => {
    // Horizontal projection maps Campos x=100 (opposition goal) to svg x=PITCH.length.
    // The attacking half (Campos x ∈ [50, 100]) therefore lives at svg x ∈ [52.5, 105].
    const vb = computeViewBox("half", "right");
    expect(vb.minX).toBeCloseTo(PITCH.length / 2);
    expect(vb.width).toBeCloseTo(PITCH.length / 2);
    expect(vb.minY).toBe(0);
    expect(vb.height).toBeCloseTo(PITCH.width);
  });

  it("half pitch horizontal defend viewbox starts at the defending goal", () => {
    const vb = computeViewBox("half", "right", "defend");
    expect(vb.minX).toBe(0);
    expect(vb.width).toBeCloseTo(PITCH.length / 2);
  });

  it("full pitch horizontal swaps dimensions", () => {
    const vb = computeViewBox("full", "right");
    expect(vb.width).toBeCloseTo(PITCH.length);
    expect(vb.height).toBeCloseTo(PITCH.width);
  });

  it("uniform padding extends all sides", () => {
    const vb = computeViewBox("full", "up", 5);
    const padMeters = (5 / 100) * PITCH.width;
    expect(vb.minX).toBeCloseTo(-padMeters);
    expect(vb.minY).toBeCloseTo(-padMeters);
    expect(vb.width).toBeCloseTo(PITCH.width + 2 * padMeters);
    expect(vb.height).toBeCloseTo(PITCH.length + 2 * padMeters);
  });

  it("per-side padding", () => {
    const vb = computeViewBox("full", "up", {
      top: 5,
      right: 10,
      bottom: 5,
      left: 0,
    });
    expect(vb.minX).toBe(0);
    expect(vb.minY).toBeLessThan(0);
  });

  it("goal viewbox", () => {
    const vb = computeViewBox("goal", "up");
    expect(vb.width).toBeCloseTo(GOAL.width);
    expect(vb.height).toBeCloseTo(GOAL.depth);
  });

  it("goal viewbox padding is scaled relative to goal width, not pitch width", () => {
    const vb = computeViewBox("goal", "up", 10);
    // 10% of GOAL.width (7.32m) = 0.732m per side, so viewBox width grows by ~1.464m.
    expect(vb.width).toBeCloseTo(
      GOAL.width + (GOAL.width * 10) / 100 + (GOAL.width * 10) / 100,
    );
    expect(vb.minX).toBeCloseTo(-(GOAL.width * 10) / 100);
  });

  it("penalty-area vertical viewbox centered on box", () => {
    const vb = computeViewBox("penalty-area", "up");
    expect(vb.width).toBeCloseTo(PITCH.penaltyAreaWidth + 4);
    // Height includes full D arc: penaltySpot + arcRadius + padding
    expect(vb.height).toBeCloseTo(PITCH.penaltySpotDistance + PITCH.penaltyArcRadius + 3);
    expect(vb.minX).toBeGreaterThan(0);
    expect(vb.minY).toBeLessThan(0);
  });

  it("penalty-area horizontal viewbox has correct origin", () => {
    const vb = computeViewBox("penalty-area", "right");
    expect(vb.minX).toBeGreaterThan(PITCH.length / 2); // attacking goal end
    expect(vb.minY).toBeGreaterThan(0); // centered on pitch width
  });

  it("penalty-area horizontal defend viewbox is anchored to the own goal", () => {
    const vb = computeViewBox("penalty-area", "right", "defend");
    expect(vb.minX).toBeLessThan(0);
    expect(vb.minY).toBeGreaterThan(0);
  });

  it("penalty-area vertical defend viewbox is anchored to the bottom goal", () => {
    const vb = computeViewBox("penalty-area", "up", "defend");
    expect(vb.minY).toBeGreaterThan(PITCH.length / 2);
    expect(vb.minY + vb.height).toBeCloseTo(PITCH.length + 2);
  });
});
