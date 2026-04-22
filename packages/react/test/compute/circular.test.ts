import { describe, expect, it } from "vitest";

import { circularMean } from "../../src/compute/circular.js";

describe("circularMean", () => {
  it("returns null angle and R=0 for empty input", () => {
    const result = circularMean([]);
    expect(result).toEqual({ meanAngle: null, resultantLength: 0, count: 0 });
  });

  it("returns the input angle and R=1 for a single vector", () => {
    const result = circularMean([{ dx: 3, dy: 0 }]);
    expect(result.meanAngle).toBeCloseTo(0, 10);
    expect(result.resultantLength).toBeCloseTo(1, 10);
    expect(result.count).toBe(1);
  });

  it("is magnitude-invariant (only direction matters)", () => {
    const short = circularMean([
      { dx: 1, dy: 0 },
      { dx: 1, dy: 1 },
    ]);
    const long = circularMean([
      { dx: 100, dy: 0 },
      { dx: 50, dy: 50 },
    ]);
    expect(short.meanAngle).toBeCloseTo(long.meanAngle!, 10);
    expect(short.resultantLength).toBeCloseTo(long.resultantLength, 10);
  });

  it("averages colinear vectors to their shared angle with R=1", () => {
    const result = circularMean([
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0 },
      { dx: 3, dy: 0 },
    ]);
    expect(result.meanAngle).toBeCloseTo(0, 10);
    expect(result.resultantLength).toBeCloseTo(1, 10);
  });

  it("handles the ±π seam correctly (not the naive arithmetic mean)", () => {
    // Two vectors near +π and -π: true mean is π (or -π), not 0.
    const near = 0.01;
    const result = circularMean([
      { dx: Math.cos(Math.PI - near), dy: Math.sin(Math.PI - near) },
      { dx: Math.cos(-Math.PI + near), dy: Math.sin(-Math.PI + near) },
    ]);
    // Could wrap to +π or -π; both represent the same angle.
    expect(Math.abs(Math.abs(result.meanAngle!) - Math.PI)).toBeLessThan(1e-9);
    expect(result.resultantLength).toBeGreaterThan(0.99);
  });

  it("returns null meanAngle and R=0 for perfectly antiparallel vectors", () => {
    const result = circularMean([
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
    ]);
    expect(result.meanAngle).toBeNull();
    expect(result.resultantLength).toBe(0);
    expect(result.count).toBe(2);
  });

  it("returns R ≈ 0 for three vectors at 120° spacing", () => {
    const result = circularMean([
      { dx: 1, dy: 0 },
      { dx: Math.cos((2 * Math.PI) / 3), dy: Math.sin((2 * Math.PI) / 3) },
      { dx: Math.cos((4 * Math.PI) / 3), dy: Math.sin((4 * Math.PI) / 3) },
    ]);
    expect(result.meanAngle).toBeNull();
    expect(result.resultantLength).toBeLessThan(1e-9);
  });

  it("computes partial agreement (orthogonal pair gives R ≈ 0.707)", () => {
    const result = circularMean([
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
    ]);
    expect(result.meanAngle).toBeCloseTo(Math.PI / 4, 10);
    expect(result.resultantLength).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it("excludes zero-magnitude vectors from the count", () => {
    const result = circularMean([
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 0 },
    ]);
    expect(result.count).toBe(1);
    expect(result.meanAngle).toBeCloseTo(0, 10);
    expect(result.resultantLength).toBeCloseTo(1, 10);
  });

  it("excludes non-finite vectors", () => {
    const result = circularMean([
      { dx: Number.NaN, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: Number.POSITIVE_INFINITY, dy: Number.POSITIVE_INFINITY },
    ]);
    expect(result.count).toBe(1);
    expect(result.meanAngle).toBeCloseTo(0, 10);
  });

  it("returns angles in the (-π, π] range", () => {
    const result = circularMean([{ dx: -1, dy: -0.0001 }]);
    expect(result.meanAngle).toBeGreaterThan(-Math.PI);
    expect(result.meanAngle).toBeLessThanOrEqual(Math.PI);
  });
});
