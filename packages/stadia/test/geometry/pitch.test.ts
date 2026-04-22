import { describe, expect, it } from "vitest";
import { computePitchMarkings } from "../../src/geometry/pitch.js";

describe("computePitchMarkings", () => {
  it("full pitch has boundary, halfway, center circle, both penalty areas", () => {
    const markings = computePitchMarkings("full");
    const ids = markings.map((m) => m.id);
    expect(ids).toContain("boundary");
    expect(ids).toContain("halfway");
    expect(ids).toContain("center-circle");
    expect(ids).toContain("pa-top");
    expect(ids).toContain("pa-bottom");
    expect(ids).toContain("6yd-top");
    expect(ids).toContain("6yd-bottom");
    expect(ids).toContain("pen-spot-top");
    expect(ids).toContain("pen-spot-bottom");
    expect(ids).toContain("pen-arc-top");
    expect(ids).toContain("pen-arc-bottom");
  });

  it("half pitch attack has one penalty area at the attacking end", () => {
    const markings = computePitchMarkings("half");
    const ids = markings.map((m) => m.id);
    expect(ids).toContain("pa-top");
    expect(ids).not.toContain("pa-bottom");
    expect(ids).toContain("halfway");
    expect(ids).toContain("center-spot");
    expect(ids).toContain("center-arc");
  });

  it("penalty-area crop has one attacking penalty area, no halfway, no corners", () => {
    const markings = computePitchMarkings("penalty-area");
    const ids = markings.map((m) => m.id);
    expect(ids).toContain("pa-top");
    expect(ids).not.toContain("pa-bottom");
    expect(ids).not.toContain("halfway");
    expect(ids.filter((id) => id.startsWith("corner"))).toHaveLength(0);
  });

  it("defend half mirrors the visible end of the pitch", () => {
    const markings = computePitchMarkings("half", "vertical", "defend");
    const ids = markings.map((m) => m.id);
    const penaltyArea = markings.find((m) => m.id === "pa-bottom");
    expect(ids).toContain("pa-bottom");
    expect(ids).not.toContain("pa-top");
    expect(penaltyArea?.y).toBeCloseTo(105 - 16.5);
  });

  it("horizontal attack half draws the right-side goal", () => {
    const markings = computePitchMarkings("half", "horizontal", "attack");
    const penaltyArea = markings.find((m) => m.id === "pa-bottom");
    expect(penaltyArea?.x).toBeCloseTo(105 - 16.5);
  });

  it("horizontal defend half draws the left-side goal", () => {
    const markings = computePitchMarkings("half", "horizontal", "defend");
    const penaltyArea = markings.find((m) => m.id === "pa-top");
    expect(penaltyArea?.x).toBeCloseTo(0);
  });

  it("every marking has a type and geometric data", () => {
    const markings = computePitchMarkings("full");
    for (const m of markings) {
      expect(m.id).toBeTruthy();
      expect(["line", "rect", "circle", "arc"]).toContain(m.type);
    }
  });

  it("penalty arc uses correct intersection math, not semicircle", () => {
    const markings = computePitchMarkings("full");
    const arc = markings.find((m) => m.id === "pen-arc-top");
    expect(arc).toBeDefined();
    const a = arc as NonNullable<typeof arc>;
    expect(a.type).toBe("arc");
    const span = (a.endAngle as number) - (a.startAngle as number);
    expect(span).toBeLessThan(Math.PI);
    expect(span).toBeGreaterThan(0);
  });

  it("horizontal orientation swaps coordinates", () => {
    const vertical = computePitchMarkings("full", "vertical");
    const horizontal = computePitchMarkings("full", "horizontal");
    const vBoundary = vertical.find((m) => m.id === "boundary") as NonNullable<
      (typeof vertical)[0]
    >;
    const hBoundary = horizontal.find((m) => m.id === "boundary") as NonNullable<
      (typeof horizontal)[0]
    >;
    // Vertical: 68 wide, 105 tall. Horizontal: 105 wide, 68 tall.
    expect(vBoundary.width).toBe(68);
    expect(vBoundary.height).toBe(105);
    expect(hBoundary.width).toBe(105);
    expect(hBoundary.height).toBe(68);
  });

  it("horizontal corner arcs curve inward at every corner", () => {
    // Each corner's arc should cover a π/2 (90°) sweep and land at the
    // four physical corners of a 105×68 horizontal pitch.
    const markings = computePitchMarkings("full", "horizontal");
    const corners = markings.filter((m) => m.id.startsWith("corner-")) as Array<
      NonNullable<(typeof markings)[number]> & { type: "arc" }
    >;
    expect(corners).toHaveLength(4);

    // Expected center positions after the vertical → horizontal swap
    // (cx, cy is each physical corner of a 105×68 pitch).
    const centers = corners.map((c) => [c.cx, c.cy]).sort();
    expect(centers).toEqual(
      [
        [0, 0],
        [0, 68],
        [105, 0],
        [105, 68],
      ].sort(),
    );

    for (const c of corners) {
      const span = Math.abs((c.endAngle ?? 0) - (c.startAngle ?? 0));
      expect(span).toBeCloseTo(Math.PI / 2, 4);
      // Every corner's arc must include a point that sits INSIDE the pitch
      // rectangle [0, 105] × [0, 68]. We sample the arc's midpoint and
      // check it falls inside.
      const mid = ((c.startAngle ?? 0) + (c.endAngle ?? 0)) / 2;
      const r = c.r ?? 1;
      const midX = (c.cx ?? 0) + r * Math.cos(mid);
      const midY = (c.cy ?? 0) + r * Math.sin(mid);
      expect(midX).toBeGreaterThanOrEqual(0);
      expect(midX).toBeLessThanOrEqual(105);
      expect(midY).toBeGreaterThanOrEqual(0);
      expect(midY).toBeLessThanOrEqual(68);
    }
  });
});
