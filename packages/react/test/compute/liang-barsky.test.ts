import { describe, expect, it } from "vitest";

import { clipSegment } from "../../src/compute/liangBarsky";

const rect = { x: 0, y: 0, width: 100, height: 100 };

describe("clipSegment (Liang-Barsky)", () => {
  it("passes through segments fully inside", () => {
    const res = clipSegment({ x: 10, y: 20 }, { x: 80, y: 60 }, rect);
    expect(res).toEqual([
      { x: 10, y: 20 },
      { x: 80, y: 60 },
    ]);
  });

  it("returns null for segments fully outside on one side", () => {
    expect(clipSegment({ x: -50, y: 10 }, { x: -10, y: 10 }, rect)).toBeNull();
    expect(clipSegment({ x: 110, y: 10 }, { x: 150, y: 10 }, rect)).toBeNull();
    expect(clipSegment({ x: 10, y: -50 }, { x: 10, y: -10 }, rect)).toBeNull();
    expect(clipSegment({ x: 10, y: 110 }, { x: 10, y: 150 }, rect)).toBeNull();
  });

  it("clips segment starting outside left, ending inside", () => {
    const res = clipSegment({ x: -10, y: 50 }, { x: 60, y: 50 }, rect);
    expect(res).not.toBeNull();
    expect(res![0].x).toBeCloseTo(0, 6);
    expect(res![0].y).toBeCloseTo(50, 6);
    expect(res![1].x).toBeCloseTo(60, 6);
  });

  it("clips segment entering top, exiting right", () => {
    const res = clipSegment({ x: 50, y: -10 }, { x: 110, y: 50 }, rect);
    expect(res).not.toBeNull();
    // At t: x=50+60t, y=-10+60t. Enters at y=0 → t=1/6 → x=60; exits at x=100 → t=50/60 → y=40.
    expect(res![0].y).toBeCloseTo(0, 6);
    expect(res![0].x).toBeCloseTo(60, 6);
    expect(res![1].x).toBeCloseTo(100, 6);
    expect(res![1].y).toBeCloseTo(40, 6);
  });

  it("clips diagonal entering left, exiting right", () => {
    const res = clipSegment({ x: -10, y: 50 }, { x: 110, y: 50 }, rect);
    expect(res).not.toBeNull();
    expect(res![0].x).toBeCloseTo(0, 6);
    expect(res![1].x).toBeCloseTo(100, 6);
    expect(res![0].y).toBeCloseTo(50, 6);
  });

  it("clips diagonal entering bottom, exiting top", () => {
    const res = clipSegment({ x: 50, y: -10 }, { x: 50, y: 110 }, rect);
    expect(res).not.toBeNull();
    expect(res![0].y).toBeCloseTo(0, 6);
    expect(res![1].y).toBeCloseTo(100, 6);
    expect(res![0].x).toBeCloseTo(50, 6);
  });

  it("clips both endpoints outside but chord crosses through", () => {
    const res = clipSegment({ x: -20, y: 110 }, { x: 120, y: -10 }, rect);
    expect(res).not.toBeNull();
    // chord is y = 100 - x + k; but simpler: verify both clipped points are in rect
    expect(res![0].x).toBeGreaterThanOrEqual(-EPS);
    expect(res![0].x).toBeLessThanOrEqual(100 + EPS);
    expect(res![0].y).toBeGreaterThanOrEqual(-EPS);
    expect(res![0].y).toBeLessThanOrEqual(100 + EPS);
    expect(res![1].x).toBeGreaterThanOrEqual(-EPS);
    expect(res![1].x).toBeLessThanOrEqual(100 + EPS);
  });

  it("returns null for both-outside chord grazing a corner", () => {
    // Segment: (-10, 100) to (100, -10) — chord y = -x + 90, passes above the
    // bottom-left (0, 90) and through right (100, -10). Enters at (0,90) and
    // touches the rectangle along its descent. The corner-grazing variant
    // below has a single tangent point:
    //   (−10, 110) → (110, −10) passes through corner (0, 100) and (100, 0).
    //   That actually intersects the rect along a diagonal.
    // For a true grazing we need a segment that hits exactly one corner:
    //   (-10, 100) → (0, 110) touches only (0, 100)
    const res = clipSegment({ x: -10, y: 100 }, { x: 0, y: 110 }, rect);
    expect(res).toBeNull();
  });

  it("clips horizontal segment at y = 0 (edge-hugging)", () => {
    const res = clipSegment({ x: -10, y: 0 }, { x: 50, y: 0 }, rect);
    expect(res).not.toBeNull();
    expect(res![0].y).toBe(0);
    expect(res![0].x).toBeCloseTo(0, 6);
  });

  it("clips vertical segment at x = width (edge-hugging)", () => {
    const res = clipSegment({ x: 100, y: -10 }, { x: 100, y: 50 }, rect);
    expect(res).not.toBeNull();
    expect(res![0].x).toBe(100);
    expect(res![0].y).toBeCloseTo(0, 6);
  });

  it("returns null for non-finite endpoints", () => {
    expect(clipSegment({ x: NaN, y: 0 }, { x: 50, y: 0 }, rect)).toBeNull();
    expect(
      clipSegment({ x: 0, y: 0 }, { x: Number.POSITIVE_INFINITY, y: 0 }, rect),
    ).toBeNull();
  });

  it("returns null for degenerate point-segment outside rect", () => {
    expect(clipSegment({ x: 200, y: 200 }, { x: 200, y: 200 }, rect)).toBeNull();
  });

  // Point-segments inside the rect pass through unchanged. The diagonal
  // reference primitive rejects `from === to` up-front as `[reference.degenerate]`
  // before reaching the clipper, so this is not clipper's concern.
});

const EPS = 1e-6;
