import { describe, expect, it } from "vitest";

import {
  computeKernelSeriesModels,
  projectKernelSeries,
  sampleDensityAtValue,
  type DistributionDensityStats,
} from "../../src/compute/distribution-shared";

// Helper to build a full stats object without asserting on individual fields.
// `sampleDensityAtValue` only reads `bandwidth`; the other fields are filler.
function buildStats(bandwidth: number): DistributionDensityStats {
  return {
    count: 0,
    excludedCount: 0,
    mean: 0,
    median: 0,
    min: 0,
    max: 0,
    bandwidth,
  };
}

describe("sampleDensityAtValue", () => {
  it("returns 0 for an empty series", () => {
    expect(sampleDensityAtValue({ values: [], stats: buildStats(1) }, 0.5)).toBe(0);
  });

  it("returns 0 when the evaluation value is non-finite", () => {
    const series = { values: [1, 2, 3], stats: buildStats(1) };
    expect(sampleDensityAtValue(series, Number.NaN)).toBe(0);
    expect(sampleDensityAtValue(series, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("returns 0 when bandwidth is non-positive or non-finite", () => {
    expect(sampleDensityAtValue({ values: [1, 2, 3], stats: buildStats(0) }, 2)).toBe(0);
    expect(sampleDensityAtValue({ values: [1, 2, 3], stats: buildStats(-1) }, 2)).toBe(0);
    expect(
      sampleDensityAtValue({ values: [1, 2, 3], stats: buildStats(Number.NaN) }, 2),
    ).toBe(0);
  });

  it("peaks at the sample centre with a finite bandwidth", () => {
    const series = { values: [0, 0, 0], stats: buildStats(1) };
    const atCentre = sampleDensityAtValue(series, 0);
    const offCentre = sampleDensityAtValue(series, 3);
    expect(atCentre).toBeGreaterThan(offCentre);
    expect(atCentre).toBeGreaterThan(0);
  });
});

describe("computeKernelSeriesModels", () => {
  it("produces stats matching the underlying values for a simple series", () => {
    const result = computeKernelSeriesModels([
      { id: "a", label: "A", values: [1, 2, 3, 4, 5] },
    ]);

    const entry = result.series[0];
    expect(entry).toBeDefined();
    expect(entry?.stats.count).toBe(5);
    expect(entry?.stats.excludedCount).toBe(0);
    expect(entry?.stats.mean).toBe(3);
    expect(entry?.stats.median).toBe(3);
    expect(entry?.stats.min).toBe(1);
    expect(entry?.stats.max).toBe(5);
    expect(entry?.samples.length).toBeGreaterThanOrEqual(32);
  });

  it("pads the auto-domain to include the full value range", () => {
    const result = computeKernelSeriesModels([{ id: "a", label: "A", values: [10, 20] }]);
    expect(result.domain[0]).toBeLessThan(10);
    expect(result.domain[1]).toBeGreaterThan(20);
  });

  it("counts null and NaN values in excludedCount with a per-series warning", () => {
    const result = computeKernelSeriesModels([
      { id: "a", label: "A", values: [1, null, Number.NaN, undefined, 2] },
    ]);
    const entry = result.series[0];
    expect(entry?.stats.count).toBe(2);
    expect(entry?.stats.excludedCount).toBe(3);
    expect(entry?.warnings.some((w) => /excluded/.test(w))).toBe(true);
  });

  it("warns when a series has between 1 and 4 valid values", () => {
    const result = computeKernelSeriesModels([
      { id: "a", label: "A", values: [1, 2, 3] },
    ]);
    const entry = result.series[0];
    expect(entry?.warnings.some((w) => /may not be meaningful/.test(w))).toBe(true);
  });

  it("emits a 'fewer than 2 values' warning for a single-value series", () => {
    const result = computeKernelSeriesModels([{ id: "a", label: "A", values: [5] }]);
    const entry = result.series[0];
    expect(entry?.warnings.some((w) => /fewer than 2/i.test(w))).toBe(true);
  });

  it("emits a bandwidth rule-collapse warning for identical values", () => {
    // Two identical values → sigma = 0 AND iqr = 0, so the silverman rule
    // produces ruleBandwidth = 0 and the fallback path activates.
    const result = computeKernelSeriesModels([{ id: "a", label: "A", values: [5, 5] }]);
    const entry = result.series[0];
    expect(entry?.warnings.some((w) => /collapsed/i.test(w))).toBe(true);
  });

  it("pins a provided marker value with source = 'value'", () => {
    const result = computeKernelSeriesModels([
      { id: "a", label: "A", values: [1, 2, 3, 4, 5], markerValue: 3.5 },
    ]);
    const entry = result.series[0];
    expect(entry?.markerValue).toBe(3.5);
    expect(entry?.markerSource).toBe("value");
  });

  it("defaults the marker to the median when not supplied", () => {
    const result = computeKernelSeriesModels([
      { id: "a", label: "A", values: [1, 2, 3, 4, 5] },
    ]);
    const entry = result.series[0];
    expect(entry?.markerValue).toBe(3);
    expect(entry?.markerSource).toBe("median");
  });

  it("suppresses the default marker when defaultMarker is 'none'", () => {
    const result = computeKernelSeriesModels(
      [{ id: "a", label: "A", values: [1, 2, 3, 4, 5] }],
      { defaultMarker: "none" },
    );
    const entry = result.series[0];
    expect(entry?.markerValue).toBeNull();
    expect(entry?.markerSource).toBeNull();
  });
});

describe("projectKernelSeries", () => {
  it("builds SVG paths that close the area and leave the line open", () => {
    const computed = computeKernelSeriesModels([
      { id: "a", label: "A", values: [1, 2, 3, 4, 5] },
    ]);
    const plotArea = { x: 0, y: 0, width: 200, height: 100 };
    const maxDensity = computed.series[0]?.maxDensity ?? 1;
    const projected = projectKernelSeries(
      computed.series,
      plotArea,
      computed.domain,
      maxDensity,
    );

    const entry = projected[0];
    expect(entry).toBeDefined();
    expect(entry?.linePath.startsWith("M ")).toBe(true);
    expect(entry?.linePath.endsWith("Z")).toBe(false);
    expect(entry?.areaPath.startsWith("M ")).toBe(true);
    expect(entry?.areaPath.endsWith("Z")).toBe(true);
  });

  it("computes a marker projection with numeric screen coordinates", () => {
    const computed = computeKernelSeriesModels([
      { id: "a", label: "A", values: [1, 2, 3, 4, 5], markerValue: 3 },
    ]);
    const plotArea = { x: 0, y: 0, width: 200, height: 100 };
    const maxDensity = computed.series[0]?.maxDensity ?? 1;
    const projected = projectKernelSeries(
      computed.series,
      plotArea,
      computed.domain,
      maxDensity,
    );

    const entry = projected[0];
    expect(entry?.marker).not.toBeNull();
    expect(Number.isFinite(entry?.marker?.x)).toBe(true);
    expect(Number.isFinite(entry?.marker?.y)).toBe(true);
    expect(entry?.marker?.value).toBe(3);
  });
});
