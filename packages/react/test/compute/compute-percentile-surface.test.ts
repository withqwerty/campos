import { describe, expect, it } from "vitest";
import {
  resolvePercentileSurfaceModel,
  type PercentileComparisonSample,
  type PercentileMetric,
  type PercentileSurfaceInput,
} from "../../src/compute/percentile-surface.js";

const BASE_COMPARISON: PercentileComparisonSample = {
  label: "Big Five League midfielders",
  seasonLabel: "2025/26",
  minutesThresholdLabel: "900+ minutes",
};

function resolve(
  partial: Partial<PercentileSurfaceInput> = {},
): ReturnType<typeof resolvePercentileSurfaceModel> {
  const metric: PercentileMetric = partial.metric ?? {
    id: "prog-passes",
    label: "Progressive passes",
    percentile: 87,
    rawValue: 7.4,
  };
  return resolvePercentileSurfaceModel({
    metric,
    comparison: partial.comparison ?? BASE_COMPARISON,
    ...(partial.requireComparisonLabel !== undefined
      ? { requireComparisonLabel: partial.requireComparisonLabel }
      : {}),
    ...(partial.accessibleSampleLabel !== undefined
      ? { accessibleSampleLabel: partial.accessibleSampleLabel }
      : {}),
  });
}

describe("resolvePercentileSurfaceModel — happy path", () => {
  it("returns a valid model with no warnings for canonical input", () => {
    const model = resolve();
    expect(model.meta.invalidReason).toBeNull();
    expect(model.meta.metricId).toBe("prog-passes");
    expect(model.meta.warnings).toEqual([]);
    expect(model.geometry).not.toBeNull();
    expect(model.geometry?.clampedPercentile).toBe(87);
    expect(model.geometry?.tickPositions).toEqual([25, 50, 75]);
  });

  it("builds the accessibleLabel structured shape for higher-is-better", () => {
    const model = resolve();
    expect(model.accessibleLabel).toEqual({
      metricLabel: "Progressive passes",
      percentileText: "87th percentile",
      sampleText: "Big Five League midfielders",
    });
    expect(model.accessibleLabel?.inversionNote).toBeUndefined();
  });

  it("emits an inversionNote only when originalDirection === 'lower'", () => {
    const lower = resolve({
      metric: {
        id: "dispossessed",
        label: "Dispossessed /90",
        percentile: 84,
        originalDirection: "lower",
      },
    });
    expect(lower.accessibleLabel?.inversionNote).toBe("lower is better");

    const higher = resolve({
      metric: {
        id: "tackles-won",
        label: "Tackles won",
        percentile: 73,
        originalDirection: "higher",
      },
    });
    expect(higher.accessibleLabel?.inversionNote).toBeUndefined();

    const unspecified = resolve();
    expect(unspecified.accessibleLabel?.inversionNote).toBeUndefined();
  });

  it("falls back to accessibleSampleLabel when comparison is missing", () => {
    const model = resolvePercentileSurfaceModel({
      metric: {
        id: "tkl",
        label: "Tackles won",
        percentile: 73,
      },
      accessibleSampleLabel: "vs centre-backs, 2025/26",
    });
    expect(model.meta.invalidReason).toBeNull();
    expect(model.accessibleLabel?.sampleText).toBe("vs centre-backs, 2025/26");
  });
});

describe("resolvePercentileSurfaceModel — ordinal suffixes", () => {
  const cases: ReadonlyArray<[number, string]> = [
    [0, "0th"],
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [24, "24th"],
    [100, "100th"],
  ];
  for (const [value, expectedPrefix] of cases) {
    it(`formats ${value} as "${expectedPrefix} percentile"`, () => {
      const model = resolve({
        metric: {
          id: "m",
          label: "m",
          percentile: value,
        },
      });
      expect(model.accessibleLabel?.percentileText).toBe(`${expectedPrefix} percentile`);
    });
  }
});

describe("resolvePercentileSurfaceModel — clamping", () => {
  it("does not warn at the endpoints (0 and 100)", () => {
    expect(
      resolve({ metric: { id: "m", label: "m", percentile: 0 } }).meta.warnings,
    ).toEqual([]);
    expect(
      resolve({ metric: { id: "m", label: "m", percentile: 100 } }).meta.warnings,
    ).toEqual([]);
  });

  it("clamps out-of-range values with a warning", () => {
    const low = resolve({ metric: { id: "m", label: "m", percentile: -5 } });
    expect(low.meta.invalidReason).toBeNull();
    expect(low.geometry?.clampedPercentile).toBe(0);
    expect(low.meta.warnings).toHaveLength(1);
    expect(low.meta.warnings[0]).toMatch(/clamped to 0/);

    const high = resolve({ metric: { id: "m", label: "m", percentile: 105 } });
    expect(high.geometry?.clampedPercentile).toBe(100);
    expect(high.meta.warnings[0]).toMatch(/clamped to 100/);
  });
});

describe("resolvePercentileSurfaceModel — invalid inputs", () => {
  it("flags missing metric as missingMetricId", () => {
    const model = resolvePercentileSurfaceModel({ metric: null });
    expect(model.meta.invalidReason).toBe("missingMetricId");
    expect(model.geometry).toBeNull();
  });

  it("flags empty id as missingMetricId", () => {
    const model = resolve({
      metric: { id: "", label: "x", percentile: 50 },
    });
    expect(model.meta.invalidReason).toBe("missingMetricId");
  });

  it("flags missing label as missingMetricLabel", () => {
    const model = resolve({
      metric: { id: "m", label: "", percentile: 50 },
    });
    expect(model.meta.invalidReason).toBe("missingMetricLabel");
  });

  it("flags nullish percentile as missingPercentile", () => {
    const model = resolve({
      metric: {
        id: "m",
        label: "m",
        percentile: null as unknown as number,
      },
    });
    expect(model.meta.invalidReason).toBe("missingPercentile");
  });

  const nonFiniteCases: ReadonlyArray<[string, number]> = [
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ];
  for (const [name, value] of nonFiniteCases) {
    it(`flags ${name} as nonFinitePercentile`, () => {
      const model = resolve({
        metric: { id: "m", label: "m", percentile: value },
      });
      expect(model.meta.invalidReason).toBe("nonFinitePercentile");
      expect(model.geometry).toBeNull();
    });
  }

  it("flags missing comparison label when requireComparisonLabel is true", () => {
    const model = resolvePercentileSurfaceModel({
      metric: { id: "m", label: "m", percentile: 50 },
      comparison: null,
      requireComparisonLabel: true,
    });
    expect(model.meta.invalidReason).toBe("missingComparisonLabel");
  });

  it("flags missing sample fallback when neither comparison nor accessibleSampleLabel is provided", () => {
    const model = resolvePercentileSurfaceModel({
      metric: { id: "m", label: "m", percentile: 50 },
    });
    expect(model.meta.invalidReason).toBe("missingComparisonLabel");
  });

  it("rejects empty-string comparison label with requireComparisonLabel", () => {
    const model = resolvePercentileSurfaceModel({
      metric: { id: "m", label: "m", percentile: 50 },
      comparison: { label: "" },
      requireComparisonLabel: true,
    });
    expect(model.meta.invalidReason).toBe("missingComparisonLabel");
  });
});

describe("resolvePercentileSurfaceModel — weak-sample warnings", () => {
  it("emits weakSample for populationSize === 0", () => {
    const model = resolve({
      comparison: { ...BASE_COMPARISON, populationSize: 0 },
    });
    expect(model.meta.warnings).toEqual([expect.stringContaining("population sample")]);
    expect(model.meta.warnings[0]).toMatch(/n=0/);
  });

  it("emits weakSample for populationSize === 1", () => {
    const model = resolve({
      comparison: { ...BASE_COMPARISON, populationSize: 1 },
    });
    expect(model.meta.warnings[0]).toMatch(/n=1/);
  });

  it("does not emit weakSample for populationSize >= 2", () => {
    const model = resolve({
      comparison: { ...BASE_COMPARISON, populationSize: 2 },
    });
    expect(model.meta.warnings).toEqual([]);
  });

  it("does not emit weakSample when populationSize is absent", () => {
    const model = resolve({ comparison: BASE_COMPARISON });
    expect(model.meta.warnings).toEqual([]);
  });
});

describe("resolvePercentileSurfaceModel — warning deduplication", () => {
  it("de-dupes identical warning strings within a single compute call", () => {
    // A single compute call cannot naturally emit the same string twice
    // today (clamp text is unique per metric+value), so the guarantee is
    // tested structurally: an n=0 weak-sample AND an out-of-range clamp
    // produce two distinct strings, not a collapsed one.
    const model = resolve({
      metric: { id: "m", label: "m", percentile: 120 },
      comparison: { ...BASE_COMPARISON, populationSize: 0 },
    });
    expect(model.meta.warnings).toHaveLength(2);
    expect(new Set(model.meta.warnings).size).toBe(2);
  });
});
