import { describe, expect, it } from "vitest";

import { createLinearScale } from "../../../src/compute/scales/linear-scale";

describe("createLinearScale", () => {
  it("maps domain endpoints to range endpoints", () => {
    const scale = createLinearScale([0, 100], [0, 200]);
    expect(scale(0)).toBe(0);
    expect(scale(100)).toBe(200);
  });

  it("interpolates intermediate values linearly", () => {
    const scale = createLinearScale([0, 10], [0, 100]);
    expect(scale(5)).toBe(50);
    expect(scale(2.5)).toBe(25);
  });

  it("handles inverted ranges", () => {
    const scale = createLinearScale([0, 10], [100, 0]);
    expect(scale(0)).toBe(100);
    expect(scale(10)).toBe(0);
    expect(scale(5)).toBe(50);
  });

  it("extrapolates beyond domain", () => {
    const scale = createLinearScale([0, 10], [0, 100]);
    expect(scale(15)).toBe(150);
    expect(scale(-5)).toBe(-50);
  });

  it("maps degenerate domain (min === max) to center of range", () => {
    const scale = createLinearScale([5, 5], [0, 100]);
    expect(scale(5)).toBe(50);
    expect(scale(0)).toBe(50);
    expect(scale(999)).toBe(50);
  });

  it("handles negative domain", () => {
    const scale = createLinearScale([-10, 10], [0, 200]);
    expect(scale(-10)).toBe(0);
    expect(scale(0)).toBe(100);
    expect(scale(10)).toBe(200);
  });
});
