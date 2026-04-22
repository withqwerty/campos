import { describe, expect, it } from "vitest";

import { createNumericAxis } from "../../../src/compute/scales/numeric-axis";

describe("createNumericAxis", () => {
  it("builds a nice linear domain and ticks for a typical range", () => {
    const axis = createNumericAxis({
      min: 0.3,
      max: 9.7,
      range: [0, 100],
    });

    expect(axis.domain).toEqual([0, 10]);
    expect(axis.ticks).toEqual([0, 2, 4, 6, 8, 10]);
    expect(axis.scale(0)).toBe(0);
    expect(axis.scale(10)).toBe(100);
  });

  it("normalizes reversed extents instead of rejecting them", () => {
    const axis = createNumericAxis({
      min: 10,
      max: 0,
      range: [0, 100],
    });

    expect(axis.domain).toEqual([0, 10]);
    expect(axis.ticks[0]).toBe(0);
    expect(axis.ticks[axis.ticks.length - 1]).toBe(10);
  });

  it("expands degenerate domains around zero", () => {
    const axis = createNumericAxis({
      min: 0,
      max: 0,
      range: [0, 100],
    });

    expect(axis.domain[0]).toBeLessThan(0);
    expect(axis.domain[1]).toBeGreaterThan(0);
    expect(axis.ticks).toContain(0);
    expect(axis.scale(axis.domain[0])).toBe(0);
    expect(axis.scale(axis.domain[1])).toBe(100);
  });

  it("supports inverted output ranges without reversing the domain", () => {
    const axis = createNumericAxis({
      min: 0,
      max: 10,
      range: [0, 100],
      invert: true,
    });

    expect(axis.domain).toEqual([0, 10]);
    expect(axis.scale(0)).toBe(100);
    expect(axis.scale(10)).toBe(0);
  });

  it("supports sqrt axes while flooring the domain at zero", () => {
    const axis = createNumericAxis({
      min: -4,
      max: 9,
      range: [0, 100],
      kind: "sqrt",
    });

    expect(axis.domain[0]).toBe(0);
    expect(axis.ticks[0]).toBe(0);
    expect(axis.scale(0)).toBe(0);
    expect(axis.scale(4)).toBeGreaterThan(axis.scale(1));
    expect(axis.scale(9)).toBeGreaterThan(axis.scale(4));
  });

  it("produces stable decimal ticks for small ranges", () => {
    const axis = createNumericAxis({
      min: 0.01,
      max: 0.09,
      range: [0, 100],
    });

    const step = axis.ticks[1]! - axis.ticks[0]!;
    expect([0.01, 0.02, 0.05]).toContain(Math.round(step * 1000) / 1000);
    expect(axis.ticks.every((tick) => Number.isFinite(tick))).toBe(true);
  });
});
