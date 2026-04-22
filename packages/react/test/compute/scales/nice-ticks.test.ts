import { describe, expect, it } from "vitest";

import { niceTicks } from "../../../src/compute/scales/nice-ticks";

describe("niceTicks", () => {
  it("produces nice round tick values for a typical range", () => {
    const result = niceTicks(0.3, 9.7);
    expect(result.domain[0]).toBeLessThanOrEqual(0.3);
    expect(result.domain[1]).toBeGreaterThanOrEqual(9.7);
    // All ticks should be "nice" numbers
    for (const tick of result.ticks) {
      expect(Number.isFinite(tick)).toBe(true);
    }
    // Ticks should be evenly spaced
    const steps = result.ticks.slice(1).map((t, i) => t - (result.ticks[i] as number));
    const firstStep = steps[0] as number;
    for (const step of steps) {
      expect(step).toBeCloseTo(firstStep, 10);
    }
  });

  it("includes both domain endpoints as ticks", () => {
    const result = niceTicks(0, 100);
    expect(result.ticks[0]).toBe(0);
    expect(result.ticks[result.ticks.length - 1]).toBe(100);
  });

  it("handles a degenerate range (min === max)", () => {
    const result = niceTicks(5, 5);
    expect(result.domain[0]).toBeLessThan(5);
    expect(result.domain[1]).toBeGreaterThan(5);
    expect(result.ticks.length).toBeGreaterThan(1);
  });

  it("handles zero range at zero", () => {
    const result = niceTicks(0, 0);
    expect(result.domain[0]).toBeLessThan(0);
    expect(result.domain[1]).toBeGreaterThan(0);
    expect(result.ticks.length).toBeGreaterThan(1);
  });

  it("handles min > max by swapping", () => {
    const result = niceTicks(10, 0);
    expect(result.domain[0]).toBeLessThanOrEqual(0);
    expect(result.domain[1]).toBeGreaterThanOrEqual(10);
  });

  it("produces approximately the requested number of ticks", () => {
    const result = niceTicks(0, 100, 10);
    expect(result.ticks.length).toBeGreaterThanOrEqual(5);
    expect(result.ticks.length).toBeLessThanOrEqual(15);
  });

  it("produces nice ticks for small decimal ranges", () => {
    const result = niceTicks(0.01, 0.09);
    // Step should be 0.01 or 0.02
    const step = (result.ticks[1] as number) - (result.ticks[0] as number);
    expect([0.01, 0.02, 0.05]).toContain(Math.round(step * 1000) / 1000);
  });

  it("produces nice ticks for large ranges", () => {
    const result = niceTicks(0, 1_000_000);
    const step = (result.ticks[1] as number) - (result.ticks[0] as number);
    expect(step).toBeGreaterThanOrEqual(100_000);
  });
});
