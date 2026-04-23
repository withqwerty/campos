import { describe, expect, it } from "vitest";

import { computePassLengthAndAngle } from "../../src/shared/pass-geometry";

describe("computePassLengthAndAngle", () => {
  it("returns null length and angle when any coordinate is missing", () => {
    expect(computePassLengthAndAngle(null, 0, 10, 0)).toEqual({
      length: null,
      angle: null,
    });
    expect(computePassLengthAndAngle(0, null, 10, 0)).toEqual({
      length: null,
      angle: null,
    });
    expect(computePassLengthAndAngle(0, 0, null, 0)).toEqual({
      length: null,
      angle: null,
    });
    expect(computePassLengthAndAngle(0, 0, 10, null)).toEqual({
      length: null,
      angle: null,
    });
    expect(computePassLengthAndAngle(undefined, 0, 10, 0)).toEqual({
      length: null,
      angle: null,
    });
  });

  it("computes a horizontal pass to length = Δx and angle = 0", () => {
    expect(computePassLengthAndAngle(0, 0, 10, 0)).toEqual({ length: 10, angle: 0 });
  });

  it("computes a vertical pass (positive y) to angle = π/2", () => {
    const result = computePassLengthAndAngle(0, 0, 0, 10);
    expect(result.length).toBe(10);
    expect(result.angle).toBeCloseTo(Math.PI / 2, 4);
  });

  it("computes a 3-4-5 right triangle to length = 5", () => {
    const result = computePassLengthAndAngle(0, 0, 3, 4);
    expect(result.length).toBe(5);
    expect(result.angle).toBeCloseTo(Math.atan2(4, 3), 4);
  });

  it("handles a reverse-diagonal pass (both Δx and Δy negative)", () => {
    const result = computePassLengthAndAngle(10, 10, 7, 6);
    expect(result.length).toBe(5);
    expect(result.angle).toBeCloseTo(Math.atan2(-4, -3), 4);
  });

  it("collapses a zero-length pass to length = 0 and angle = 0", () => {
    expect(computePassLengthAndAngle(50, 50, 50, 50)).toEqual({ length: 0, angle: 0 });
  });

  it("rounds length to 2dp and angle to 4dp", () => {
    const result = computePassLengthAndAngle(0, 0, 1, 1);
    // √2 ≈ 1.4142135 → rounded to 2dp = 1.41
    expect(result.length).toBe(1.41);
    // atan2(1,1) = π/4 ≈ 0.7853981 → rounded to 4dp = 0.7854
    expect(result.angle).toBe(0.7854);
  });

  it("handles negative angles (Δy < 0) in the (-π, 0) half-plane", () => {
    const result = computePassLengthAndAngle(0, 0, 10, -10);
    expect(result.angle).toBeCloseTo(-Math.PI / 4, 4);
    expect(result.length).toBeCloseTo(Math.SQRT2 * 10, 2);
  });
});
