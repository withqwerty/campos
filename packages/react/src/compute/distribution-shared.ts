import {
  ascending,
  deviation as d3Deviation,
  quantileSorted as d3QuantileSorted,
} from "d3-array";

import { extent, isFiniteNumber, mean, median } from "./math.js";
import { createLinearScale } from "./scales/index.js";

export type DistributionBandwidth = "scott" | "silverman" | number;
export type DistributionDefaultMarker = "none" | "median" | "mean";
export type DistributionMarkerSource = "mean" | "median" | "value";

export type DistributionSeriesInput = {
  id: string;
  label: string;
  values: ReadonlyArray<number | null | undefined>;
  markerValue?: number | null | undefined;
};

export type DistributionDensitySample = {
  value: number;
  density: number;
};

export type DistributionDensityStats = {
  count: number;
  excludedCount: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  bandwidth: number;
};

export type DistributionKernelSeriesModel = {
  id: string;
  label: string;
  values: number[];
  samples: DistributionDensitySample[];
  stats: DistributionDensityStats;
  markerValue: number | null;
  markerSource: DistributionMarkerSource | null;
  maxDensity: number;
  warnings: string[];
};

export type DistributionProjectedMarkerModel = {
  value: number;
  density: number;
  x: number;
  y: number;
  source: DistributionMarkerSource;
};

export type DistributionProjectedSeriesModel = DistributionKernelSeriesModel & {
  areaPath: string;
  linePath: string;
  marker: DistributionProjectedMarkerModel | null;
  /**
   * Sub-area path from the domain's left edge up to the marker value, under
   * the density curve and closed back to the baseline. Populated only when
   * the series has a `marker` — null otherwise. Renderers can use this to
   * shade the population region the marker cuts off from.
   */
  markerAreaPath: string | null;
};

export type DistributionDensityOptions = {
  domain?: [number, number] | undefined;
  bandwidth?: DistributionBandwidth | undefined;
  bandwidthAdjust?: number | undefined;
  samplePoints?: number | undefined;
  defaultMarker?: DistributionDefaultMarker | undefined;
};

const DEFAULT_SAMPLE_POINTS = 160;
const MIN_SAMPLE_POINTS = 32;
const GAUSSIAN_NORMALIZER = 1 / Math.sqrt(2 * Math.PI);

function clampSamplePointCount(value: number | undefined): number {
  if (!Number.isFinite(value) || value == null) {
    return DEFAULT_SAMPLE_POINTS;
  }
  return Math.max(MIN_SAMPLE_POINTS, Math.round(value));
}

function normalizeValues(values: ReadonlyArray<number | null | undefined>) {
  const valid: number[] = [];
  let excludedCount = 0;

  for (const value of values) {
    if (isFiniteNumber(value)) {
      valid.push(value);
    } else {
      excludedCount += 1;
    }
  }

  return { valid, excludedCount };
}

function paddedDomainForValues(values: readonly number[]): [number, number] {
  const numericExtent = extent(values);
  if (numericExtent == null) {
    return [0, 1];
  }

  const [minValue, maxValue] = numericExtent;
  if (minValue === maxValue) {
    const pad = minValue === 0 ? 1 : Math.max(Math.abs(minValue) * 0.1, 0.5);
    return [minValue - pad, maxValue + pad];
  }

  const span = maxValue - minValue;
  const pad = Math.max(span * 0.08, span === 0 ? 1 : 0);
  return [minValue - pad, maxValue + pad];
}

function bandwidthFallback(values: readonly number[]): number {
  const numericExtent = extent(values);
  if (numericExtent == null) {
    return 1;
  }
  const [minValue, maxValue] = numericExtent;
  const span = Math.abs(maxValue - minValue);
  if (span === 0) {
    return Math.max(Math.abs(minValue) * 0.1, 1);
  }
  return Math.max(span / 8, 0.25);
}

function computeBandwidth(
  values: readonly number[],
  requested: DistributionBandwidth | undefined,
  bandwidthAdjust: number,
): { bandwidth: number; warning: string | null } {
  if (values.length < 2) {
    return {
      bandwidth: bandwidthFallback(values),
      warning: "Fewer than 2 valid values — using fallback bandwidth.",
    };
  }

  if (typeof requested === "number") {
    if (!Number.isFinite(requested) || requested <= 0) {
      return {
        bandwidth: bandwidthFallback(values),
        warning: `bandwidth must be a positive finite number; got ${String(requested)}; using fallback bandwidth.`,
      };
    }
    return { bandwidth: requested * bandwidthAdjust, warning: null };
  }

  const sigma = d3Deviation(values) ?? 0;
  const sorted = [...values].sort(ascending);
  const q1 = d3QuantileSorted(sorted, 0.25) ?? sorted[0] ?? 0;
  const q3 = d3QuantileSorted(sorted, 0.75) ?? sorted[sorted.length - 1] ?? 0;
  const iqr = q3 - q1;
  const n = values.length;

  const ruleBandwidth =
    requested === "silverman"
      ? 0.9 * Math.min(sigma, iqr > 0 ? iqr / 1.34 : sigma) * n ** (-1 / 5)
      : sigma * n ** (-1 / 5);

  if (!Number.isFinite(ruleBandwidth) || ruleBandwidth <= 0) {
    return {
      bandwidth: bandwidthFallback(values),
      warning: `Bandwidth rule collapsed for a degenerate sample — using fallback bandwidth.`,
    };
  }

  return { bandwidth: ruleBandwidth * bandwidthAdjust, warning: null };
}

function gaussianKernel(z: number): number {
  return GAUSSIAN_NORMALIZER * Math.exp(-(z * z) / 2);
}

export function sampleDensityAtValue(
  series: Pick<DistributionKernelSeriesModel, "values" | "stats">,
  value: number,
): number {
  if (series.values.length === 0 || !Number.isFinite(value)) {
    return 0;
  }

  const bandwidth = series.stats.bandwidth;
  if (!Number.isFinite(bandwidth) || bandwidth <= 0) {
    return 0;
  }

  let sum = 0;
  for (const sample of series.values) {
    sum += gaussianKernel((value - sample) / bandwidth);
  }

  return sum / (series.values.length * bandwidth);
}

function buildDensitySamples(
  values: readonly number[],
  domain: [number, number],
  bandwidth: number,
  samplePoints: number,
): DistributionDensitySample[] {
  const [domainMin, domainMax] = domain;
  const count = clampSamplePointCount(samplePoints);

  if (count <= 1) {
    return [{ value: domainMin, density: 0 }];
  }

  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    const value = domainMin + (domainMax - domainMin) * t;

    let density = 0;
    if (values.length > 0) {
      let sum = 0;
      for (const sample of values) {
        sum += gaussianKernel((value - sample) / bandwidth);
      }
      density = sum / (values.length * bandwidth);
    }

    return { value, density };
  });
}

function markerValueForSeries(
  series: DistributionSeriesInput,
  validValues: readonly number[],
  defaultMarker: DistributionDefaultMarker,
): { markerValue: number | null; markerSource: DistributionMarkerSource | null } {
  if (isFiniteNumber(series.markerValue)) {
    return { markerValue: series.markerValue, markerSource: "value" };
  }

  if (validValues.length === 0 || defaultMarker === "none") {
    return { markerValue: null, markerSource: null };
  }

  if (defaultMarker === "mean") {
    return { markerValue: mean(validValues), markerSource: "mean" };
  }

  return { markerValue: median(validValues), markerSource: "median" };
}

export function computeKernelSeriesModels(
  series: readonly DistributionSeriesInput[],
  options: DistributionDensityOptions = {},
): {
  domain: [number, number];
  series: DistributionKernelSeriesModel[];
  warnings: string[];
} {
  const bandwidthAdjust =
    Number.isFinite(options.bandwidthAdjust) && (options.bandwidthAdjust ?? 0) > 0
      ? (options.bandwidthAdjust as number)
      : 1;
  const samplePoints = clampSamplePointCount(options.samplePoints);
  const defaultMarker = options.defaultMarker ?? "median";

  const normalized = series.map((entry) => {
    const { valid, excludedCount } = normalizeValues(entry.values);
    return { entry, valid, excludedCount };
  });

  const allValues = normalized.flatMap((entry) => entry.valid);
  const domain = options.domain ?? paddedDomainForValues(allValues);
  const warnings: string[] = [];

  const result = normalized.map(({ entry, valid, excludedCount }) => {
    const seriesWarnings: string[] = [];

    if (excludedCount > 0) {
      seriesWarnings.push(
        `${entry.label}: ${excludedCount} value(s) excluded due to missing or invalid numbers.`,
      );
    }

    if (valid.length > 0 && valid.length < 5) {
      seriesWarnings.push(
        `${entry.label}: only ${valid.length} valid value(s) — KDE smoothing may not be meaningful.`,
      );
    }

    const { bandwidth, warning } = computeBandwidth(
      valid,
      options.bandwidth,
      bandwidthAdjust,
    );
    if (warning) {
      seriesWarnings.push(`${entry.label}: ${warning}`);
    }

    const samples = buildDensitySamples(valid, domain, bandwidth, samplePoints);
    const maxDensity = samples.reduce(
      (currentMax, sample) => Math.max(currentMax, sample.density),
      0,
    );

    const marker = markerValueForSeries(entry, valid, defaultMarker);
    const stats: DistributionDensityStats = {
      count: valid.length,
      excludedCount,
      mean: valid.length > 0 ? mean(valid) : 0,
      median: valid.length > 0 ? median(valid) : 0,
      min: valid.length > 0 ? Math.min(...valid) : domain[0],
      max: valid.length > 0 ? Math.max(...valid) : domain[1],
      bandwidth,
    };

    warnings.push(...seriesWarnings);

    return {
      id: entry.id,
      label: entry.label,
      values: valid,
      samples,
      stats,
      markerValue: marker.markerValue,
      markerSource: marker.markerSource,
      maxDensity,
      warnings: seriesWarnings,
    };
  });

  return {
    domain,
    series: result,
    warnings,
  };
}

function buildLinePath(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return "";
  }

  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(3)} ${point.y.toFixed(3)}`,
    )
    .join(" ");
}

function buildAreaPath(
  points: ReadonlyArray<{ x: number; y: number }>,
  baselineY: number,
): string {
  if (points.length === 0) {
    return "";
  }

  const linePath = buildLinePath(points);
  const lastPoint = points[points.length - 1] ?? points[0];
  const firstPoint = points[0];

  return `${linePath} L ${lastPoint?.x.toFixed(3)} ${baselineY.toFixed(3)} L ${firstPoint?.x.toFixed(3)} ${baselineY.toFixed(3)} Z`;
}

/**
 * Build a sub-area from the first projected sample up to `markerX`, under the
 * curve and closed along the baseline. The marker position is inserted as
 * the last vertex so the boundary meets the curve exactly at the marker,
 * not at the nearest sample.
 */
function buildMarkerAreaPath(
  points: ReadonlyArray<{ x: number; y: number }>,
  marker: { x: number; y: number },
  baselineY: number,
): string | null {
  if (points.length === 0) return null;
  const first = points[0];
  if (!first) return null;
  if (marker.x <= first.x) return null;

  const clipped: Array<{ x: number; y: number }> = [];
  for (const p of points) {
    if (p.x <= marker.x) {
      clipped.push(p);
    } else {
      break;
    }
  }
  // Always finish at exactly (marker.x, marker.y) so the fill lines up
  // perfectly under the stem.
  const last = clipped[clipped.length - 1];
  if (!last || last.x < marker.x) {
    clipped.push({ x: marker.x, y: marker.y });
  }

  if (clipped.length < 2) return null;

  const line = buildLinePath(clipped);
  const edge = clipped[clipped.length - 1]!;
  return `${line} L ${edge.x.toFixed(3)} ${baselineY.toFixed(3)} L ${first.x.toFixed(3)} ${baselineY.toFixed(3)} Z`;
}

export function projectKernelSeries(
  series: readonly DistributionKernelSeriesModel[],
  plotArea: { x: number; y: number; width: number; height: number },
  domain: [number, number],
  maxDensity: number,
): DistributionProjectedSeriesModel[] {
  const xScale = createLinearScale(domain, [plotArea.x, plotArea.x + plotArea.width]);
  const yScale = createLinearScale(
    [0, maxDensity > 0 ? maxDensity : 1],
    [plotArea.y + plotArea.height, plotArea.y],
  );
  const baselineY = plotArea.y + plotArea.height;

  return series.map((entry) => {
    const projectedPoints = entry.samples.map((sample) => ({
      x: xScale(sample.value),
      y: yScale(sample.density),
    }));

    const marker =
      entry.markerValue != null && entry.markerSource != null
        ? {
            value: entry.markerValue,
            density: sampleDensityAtValue(entry, entry.markerValue),
            x: xScale(entry.markerValue),
            y: yScale(sampleDensityAtValue(entry, entry.markerValue)),
            source: entry.markerSource,
          }
        : null;

    return {
      ...entry,
      areaPath: buildAreaPath(projectedPoints, baselineY),
      linePath: buildLinePath(projectedPoints),
      marker,
      markerAreaPath:
        marker != null
          ? buildMarkerAreaPath(projectedPoints, { x: marker.x, y: marker.y }, baselineY)
          : null,
    };
  });
}
