import { describe, expect, it } from "vitest";

import { createContinuousScale } from "../../../src/compute/scales/continuous-scale";

describe("createContinuousScale", () => {
  it("maps linear domain endpoints to range endpoints", () => {
    const scale = createContinuousScale({
      kind: "linear",
      domain: [0, 100],
      range: [0, 200],
    });

    expect(scale(0)).toBe(0);
    expect(scale(100)).toBe(200);
    expect(scale(50)).toBe(100);
  });

  it("preserves inverted ranges for linear scales", () => {
    const scale = createContinuousScale({
      kind: "linear",
      domain: [0, 10],
      range: [100, 0],
    });

    expect(scale(0)).toBe(100);
    expect(scale(10)).toBe(0);
    expect(scale(5)).toBe(50);
  });

  it("maps degenerate domains to the midpoint of the range", () => {
    const scale = createContinuousScale({
      kind: "linear",
      domain: [5, 5],
      range: [20, 80],
    });

    expect(scale(5)).toBe(50);
    expect(scale(0)).toBe(50);
    expect(scale(999)).toBe(50);
  });

  it("extrapolates for unclamped linear scales", () => {
    const scale = createContinuousScale({
      kind: "linear",
      domain: [0, 10],
      range: [0, 100],
    });

    expect(scale(-5)).toBe(-50);
    expect(scale(15)).toBe(150);
  });

  it("clamps sqrt scales and floors their effective domain at zero", () => {
    const scale = createContinuousScale({
      kind: "sqrt",
      domain: [-4, 9],
      range: [2, 10],
      clamp: true,
    });

    expect(scale(-2)).toBe(2);
    expect(scale(0)).toBe(2);
    expect(scale(9)).toBe(10);
    expect(scale(20)).toBe(10);
    expect(scale(4)).toBeCloseTo(7.3333333333, 10);
  });

  it("returns the range midpoint for degenerate sqrt domains after flooring", () => {
    const scale = createContinuousScale({
      kind: "sqrt",
      domain: [-2, -2],
      range: [4, 12],
      clamp: true,
    });

    expect(scale(-2)).toBe(8);
    expect(scale(0)).toBe(8);
  });
});
