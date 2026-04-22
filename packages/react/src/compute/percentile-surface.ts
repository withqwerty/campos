import { clamp, isFiniteNumber } from "./math.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PercentileComparisonSample = {
  label: string;
  seasonLabel?: string;
  minutesThresholdLabel?: string;
  populationSize?: number;
};

export type PercentileMetric = {
  id: string;
  label: string;
  /** Display-scale percentile — higher is always better. Upstream inverts
   * lower-is-better metrics before passing them here. */
  percentile: number;
  rawValue?: string | number;
  rawValueUnit?: string;
  originalDirection?: "higher" | "lower";
  note?: string;
};

export type PercentileSurfaceInvalidReason =
  | "missingMetricId"
  | "missingMetricLabel"
  | "missingPercentile"
  | "nonFinitePercentile"
  | "missingComparisonLabel";

export type PercentileAccessibleLabel = {
  metricLabel: string;
  percentileText: string;
  sampleText: string;
  inversionNote?: string;
};

export type PercentileSurfaceGeometry = {
  /** Clamped percentile in [0, 100]. */
  clampedPercentile: number;
  tickPositions: readonly [25, 50, 75];
};

export type PercentileSurfaceModel = {
  meta: {
    component: "PercentileSurfaces";
    metricId: string | null;
    invalidReason: PercentileSurfaceInvalidReason | null;
    warnings: string[];
  };
  metric: PercentileMetric | null;
  comparison: PercentileComparisonSample | null;
  accessibleLabel: PercentileAccessibleLabel | null;
  geometry: PercentileSurfaceGeometry | null;
};

export type PercentileSurfaceInput = {
  metric: PercentileMetric | null | undefined;
  comparison?: PercentileComparisonSample | null;
  /** Accessible label used when `comparison.label` is absent. Callers
   * (the pill's accessibleSampleLabel fallback) pass this through. */
  accessibleSampleLabel?: string;
  /** When true, the compute layer requires a comparison sample label
   * and marks missing-comparison inputs as invalid. The `PercentileBar`
   * path sets this; the `PercentilePill` path leaves it false because
   * the fallback `accessibleSampleLabel` can substitute. */
  requireComparisonLabel?: boolean;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function pushUnique(warnings: string[], seen: Set<string>, message: string): void {
  if (seen.has(message)) return;
  seen.add(message);
  warnings.push(message);
}

function ordinalSuffix(n: number): string {
  const integer = Math.trunc(n);
  const abs = Math.abs(integer);
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return "th";
  switch (abs % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatPercentileText(clamped: number): string {
  const rounded = Math.round(clamped);
  return `${rounded}${ordinalSuffix(rounded)} percentile`;
}

function invalidModel(
  reason: PercentileSurfaceInvalidReason,
  metricId: string | null,
  warnings: string[],
): PercentileSurfaceModel {
  return {
    meta: {
      component: "PercentileSurfaces",
      metricId,
      invalidReason: reason,
      warnings,
    },
    metric: null,
    comparison: null,
    accessibleLabel: null,
    geometry: null,
  };
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

/**
 * Resolve the canonical `PercentileSurfaces` model for a single metric +
 * comparison packet. Pure — never reads browser globals or component state.
 *
 * The model is always safe to render: invalid inputs produce an explicit
 * `invalidReason` plus an empty-geometry state; out-of-range percentiles
 * clamp to [0, 100] with a warning string; `NaN` / non-finite values are
 * treated as invalid, not silently zeroed.
 *
 * Warnings are de-duplicated within this single compute call: multiple
 * rules that would emit the same string only emit once. List-parent
 * scenarios (many bars in a column) receive one model per metric, so N
 * metrics may produce up to N warnings total.
 */
export function resolvePercentileSurfaceModel(
  input: PercentileSurfaceInput,
): PercentileSurfaceModel {
  const warnings: string[] = [];
  const seen = new Set<string>();

  const metric = input.metric ?? null;
  const comparison = input.comparison ?? null;

  const metricId =
    metric && typeof metric.id === "string" && metric.id.length > 0 ? metric.id : null;

  if (metric == null) {
    return invalidModel("missingMetricId", null, warnings);
  }

  if (metricId == null) {
    return invalidModel("missingMetricId", null, warnings);
  }

  if (typeof metric.label !== "string" || metric.label.length === 0) {
    return invalidModel("missingMetricLabel", metricId, warnings);
  }

  // NOTE: PercentileMetric.percentile is typed as `number`, but consumers
  // may pass `null` / `undefined` through loose JS callers or malformed
  // fixtures. We coerce through `unknown` to keep the runtime guard honest
  // without weakening the public type surface.
  const percentileValue = metric.percentile as unknown;
  if (percentileValue == null) {
    return invalidModel("missingPercentile", metricId, warnings);
  }

  if (!isFiniteNumber(percentileValue)) {
    return invalidModel("nonFinitePercentile", metricId, warnings);
  }

  const rawPercentile = percentileValue;
  const clampedPercentile = clamp(rawPercentile, 0, 100);

  if (rawPercentile < 0 || rawPercentile > 100) {
    pushUnique(
      warnings,
      seen,
      `percentile ${rawPercentile} clamped to ${clampedPercentile} for metric ${metricId}`,
    );
  }

  const sampleTextCandidate =
    comparison && typeof comparison.label === "string" && comparison.label.length > 0
      ? comparison.label
      : typeof input.accessibleSampleLabel === "string" &&
          input.accessibleSampleLabel.length > 0
        ? input.accessibleSampleLabel
        : null;

  if (input.requireComparisonLabel === true) {
    if (
      comparison == null ||
      typeof comparison.label !== "string" ||
      comparison.label.length === 0
    ) {
      return invalidModel("missingComparisonLabel", metricId, warnings);
    }
  }

  if (sampleTextCandidate == null) {
    // The pill path is legal only when the caller has supplied either
    // `comparison.label` or `accessibleSampleLabel`. The TS type guards
    // this at compile time, but defensive runtime check remains so that
    // loose JS callers still produce a clean invalid state.
    return invalidModel("missingComparisonLabel", metricId, warnings);
  }

  if (
    comparison &&
    typeof comparison.populationSize === "number" &&
    isFiniteNumber(comparison.populationSize) &&
    comparison.populationSize >= 0 &&
    comparison.populationSize <= 1
  ) {
    pushUnique(
      warnings,
      seen,
      `population sample for metric ${metricId} is weak (n=${comparison.populationSize})`,
    );
  }

  const accessibleLabel: PercentileAccessibleLabel = {
    metricLabel: metric.label,
    percentileText: formatPercentileText(clampedPercentile),
    sampleText: sampleTextCandidate,
    ...(metric.originalDirection === "lower" ? { inversionNote: "lower is better" } : {}),
  };

  return {
    meta: {
      component: "PercentileSurfaces",
      metricId,
      invalidReason: null,
      warnings,
    },
    metric,
    comparison,
    accessibleLabel,
    geometry: {
      clampedPercentile,
      tickPositions: [25, 50, 75],
    },
  };
}
