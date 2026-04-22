import { describe, expect, it } from "vitest";

import { computeMarginalDensity } from "../../src/compute/marginal-density.js";

describe("computeMarginalDensity", () => {
  it("returns an empty, non-empty-shape model when given no finite values", () => {
    const model = computeMarginalDensity({ values: [NaN, Infinity] });
    expect(model.empty).toBe(true);
    expect(model.validCount).toBe(0);
    expect(model.samples).toHaveLength(128);
    expect(model.density).toHaveLength(128);
    expect(model.maxDensity).toBe(0);
  });

  it("ignores values outside the supplied domain", () => {
    const model = computeMarginalDensity({
      values: [-10, 0, 50, 100, 110],
      domain: [0, 100],
    });
    expect(model.validCount).toBe(3);
  });

  it("produces a unimodal ridge for values clustered around one point", () => {
    const values = Array.from({ length: 50 }, (_, i) => 30 + Math.sin(i) * 0.5);
    const model = computeMarginalDensity({ values, resolution: 64 });
    expect(model.empty).toBe(false);
    // Peak should be near 30.
    let peakIndex = 0;
    let peakValue = 0;
    for (let i = 0; i < model.density.length; i += 1) {
      const v = model.density[i]!;
      if (v > peakValue) {
        peakValue = v;
        peakIndex = i;
      }
    }
    expect(model.samples[peakIndex]).toBeGreaterThan(25);
    expect(model.samples[peakIndex]).toBeLessThan(35);
    // Normalised → peak is 1.
    expect(model.maxDensity).toBeCloseTo(1, 5);
  });

  it("respects a caller-specified bandwidth", () => {
    const values = [10, 50, 90];
    const narrow = computeMarginalDensity({ values, bandwidth: 1, resolution: 64 });
    const wide = computeMarginalDensity({ values, bandwidth: 20, resolution: 64 });
    // Narrow bandwidth → crisper peaks → more local variance in density.
    const variance = (a: Float64Array) => {
      const mean = a.reduce((s, v) => s + v, 0) / a.length;
      return a.reduce((s, v) => s + (v - mean) ** 2, 0) / a.length;
    };
    expect(variance(narrow.density)).toBeGreaterThan(variance(wide.density));
  });

  it("falls back to Silverman when bandwidth is non-positive", () => {
    const values = Array.from({ length: 20 }, (_, i) => 40 + i);
    const model = computeMarginalDensity({ values, bandwidth: -3 });
    expect(model.bandwidth).toBeGreaterThan(0);
    expect(model.empty).toBe(false);
  });
});
