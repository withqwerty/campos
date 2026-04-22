import type { PassEvent } from "@withqwerty/campos-schema";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Human-readable bearing label for a wedge. Bins whose centre coincides with
 * one of the eight canonical directions (`forward`, `forward-left`, `left`,
 * `back-left`, `back`, `back-right`, `right`, `forward-right`) use the
 * canonical name. All other bins use a degree-based label of the form
 * `"15° left"` / `"30° right"`, measured CCW positive in the Campos
 * attacker-perspective frame.
 *
 * For binCount = 8, every bin is canonical; for binCount = 12, only four
 * cardinals (forward, left, back, right) are canonical; for binCount = 24,
 * all eight canonicals are canonical and 16 bins fall back to degree labels.
 *
 * Angles are always in the **attack-adjusted frame** (0 rad = toward the
 * opposition goal).
 */
export type PassSonarBinLabel = string;

/** Supported bin counts. */
export type PassSonarBinCount = 8 | 12 | 16 | 24;

export type PassSonarWedgeModel = {
  /** 0..binCount-1. */
  binIndex: number;
  /** Human-readable bearing label. See {@link PassSonarBinLabel}. */
  label: PassSonarBinLabel;
  /**
   * `true` when the wedge sits on one of the eight canonical directions
   * (`forward`, cardinals, inter-cardinals). Renderers use this to decide
   * which wedges get visual direction labels when `binCount > 8`.
   */
  isCanonical: boolean;
  /** Half-open angular interval `[angleStart, angleEnd)` in radians, Campos frame. */
  angleStart: number;
  angleEnd: number;
  /** Centre angle of the bin in radians, Campos frame. */
  centerAngle: number;
  /** Number of attempted passes (`complete | incomplete | offside | out`). */
  attempted: number;
  /** Number of `passResult: "complete"` passes. */
  completed: number;
  /** `completed / attempted`, in `[0, 1]`. `0` when `attempted === 0`. */
  completionRate: number;
  /** Mean Euclidean pass length in Campos units. `null` when `attempted === 0`. */
  averageLength: number | null;
  /**
   * Mean of {@link ComputePassSonarInput.metricForPass} over the passes in
   * this bin, or `null` when either the caller didn't supply a metric, the
   * bin is empty, or every pass in it returned `null`.
   *
   * Use with `colorBy: "metric"` on the React component to drive any
   * per-pass diverging encoding (xP overperformance, xT delta, pace index).
   */
  metricValue: number | null;
  /** Normalised radius for the attempted wedge in `[0, 1]`. */
  attemptedRadius: number;
  /** Normalised radius for the completed wedge in `[0, 1]`. */
  completedRadius: number;
  /**
   * Normalised radius in `[0, 1]` when {@link ComputePassSonarInput.lengthBy}
   * is `"mean-length"`. Derived from `averageLength` against either the
   * observed max across all bins or an explicit `scaleMaxLength`. `0` when
   * the bin is empty.
   */
  lengthRadius: number;
};

export type PassSonarSummaryModel = {
  attempted: number;
  completed: number;
  /** `completed / attempted`, in `[0, 1]`. `0` when `attempted === 0`. */
  completionRate: number;
};

export type PassSonarLegendRow = {
  kind: "attempted" | "completed";
  label: string;
  /** Resolved fill colour (filled in by the React layer from theme). Empty in the compute output. */
  color: string;
};

export type PassSonarLegendModel = {
  rows: ReadonlyArray<PassSonarLegendRow>;
};

export type PassSonarWarning =
  | { kind: "missing-coords"; count: number }
  | { kind: "missing-result"; count: number }
  | { kind: "subject-mismatch"; count: number; expected: string }
  | { kind: "scale-max-invalid"; received: number }
  | { kind: "scale-max-clamped"; observedMax: number; resolvedMax: number }
  | { kind: "scale-max-length-invalid"; received: number }
  | {
      kind: "scale-max-length-clamped";
      observedMax: number;
      resolvedMax: number;
    };

export type PassSonarModel = {
  meta: {
    component: "PassSonar";
    empty: boolean;
    subjectLabel: string | null;
    /** Active bin count (8 | 12 | 24). Mirrors the input. */
    binCount: PassSonarBinCount;
    /** Active length encoding. Mirrors the input. */
    lengthBy: PassSonarLengthBy;
    requestedScaleMax: number | null;
    resolvedScaleMax: number;
    /**
     * Requested length-scale max, if provided. Only used when
     * `lengthBy: "mean-length"`.
     */
    requestedScaleMaxLength: number | null;
    /**
     * Resolved length-scale max in Campos units. Only meaningful when
     * `lengthBy: "mean-length"`; equals `1` (neutral) when `lengthBy:
     * "count"` so wedges ignore it.
     */
    resolvedScaleMaxLength: number;
    /** Observed min/max of `wedge.metricValue` across the non-null bins, or `null` when no metric was supplied. */
    metricRange: { min: number; max: number } | null;
    /** Human-readable warnings consumed by `ChartFrame.warnings`. */
    warnings: ReadonlyArray<string>;
    /** Structured warnings for headless inspection and tests. */
    structuredWarnings: ReadonlyArray<PassSonarWarning>;
  };
  summary: PassSonarSummaryModel;
  wedges: ReadonlyArray<PassSonarWedgeModel>;
  legend: PassSonarLegendModel;
};

/**
 * Wedge length encoding. Default `"count"` — radius grows with attempted
 * pass count in the bin. `"mean-length"` — radius grows with the mean
 * Euclidean pass length in the bin (Campos units), matching the
 * mplsoccer / McKinley reference pattern where long balls produce longer
 * wedges.
 *
 * Scale behaviour:
 * - `"count"` uses {@link ComputePassSonarInput.scaleMaxAttempts} as the
 *   max attempts threshold (falls back to the observed max).
 * - `"mean-length"` uses {@link ComputePassSonarInput.scaleMaxLength} as the
 *   max length threshold (falls back to the observed max across bins).
 *
 * Both modes always populate the full wedge model; renderers pick which
 * radius field they read.
 */
export type PassSonarLengthBy = "count" | "mean-length";

/**
 * Input to `computePassSonar`.
 *
 * **Frame of reference.** Pass angles are derived from canonical-frame
 * start/end points (`atan2(endY - y, endX - x)`). Because Campos canonical
 * coordinates are attacker-perspective with `+x` toward the opposition goal,
 * the resulting angle is always in the **attack-adjusted frame** — 0 rad
 * means "toward the opposition goal", regardless of provider or half.
 * Heading-frame ("regular") sonars are deferred until tracking adapters
 * land.
 */
export type ComputePassSonarInput = {
  passes: ReadonlyArray<PassEvent>;
  subjectLabel?: string;
  subjectId?: string;
  subjectKind?: "player" | "team";
  scaleMaxAttempts?: number;
  /**
   * Explicit cap for the length scale when
   * {@link ComputePassSonarInput.lengthBy} is `"mean-length"`. In Campos
   * units. When omitted, the compute layer uses the observed max
   * `averageLength` across non-empty bins so the largest wedge saturates
   * the track. Pass a shared value across a grid of sonars to keep cells
   * visually comparable (use {@link computeSharedScaleMax}).
   */
  scaleMaxLength?: number;
  /**
   * Number of angular bins. Default `24` (matches Eliot McKinley's canonical
   * reference and mplsoccer).
   *
   * Pass `8` for coarse layouts (SmallMultiples cells, small thumbnails).
   * Pass `12` for a middle ground (30° wedges, aligns with clock positions).
   */
  binCount?: PassSonarBinCount;
  /** See {@link PassSonarLengthBy}. Default `"count"`. */
  lengthBy?: PassSonarLengthBy;
  /**
   * Per-pass metric extractor. When supplied the compute layer averages
   * the returned values per bin and emits `wedge.metricValue`.
   *
   * Return `null` to exclude a pass from the bin mean (e.g. when the
   * metric isn't defined for that pass). Bins with no non-null values
   * emit `metricValue: null`.
   *
   * The metric channel is a generic escape-hatch. The React component's
   * `colorBy: "metric"` mode uses this to drive any diverging/sequential
   * encoding without the compute layer needing to know about xPass, xT,
   * or any domain-specific derivation.
   */
  metricForPass?: (pass: PassEvent) => number | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default series palette for PassSonar wedges. Index 0 = attempted fill,
 * index 1 = completed fill. Override via `seriesColors?: ThemePalette`
 * on the React component.
 */
export const DEFAULT_PASS_SONAR_SERIES_COLORS = ["#3b82f6", "#22c55e"] as const;

/** Default bin count. */
export const DEFAULT_PASS_SONAR_BIN_COUNT: PassSonarBinCount = 24;

/**
 * Default clip for the `colorBy: "distance"` ramp, in Campos units. Matches
 * Eliot McKinley's reference (30 yards). Passes with `averageLength` above
 * this value saturate at the top of the sequential ramp.
 */
export const DEFAULT_PASS_SONAR_DISTANCE_CLIP = 30;

const CANONICAL_CENTERS = [
  { angle: 0, label: "forward" },
  { angle: Math.PI / 4, label: "forward-left" },
  { angle: Math.PI / 2, label: "left" },
  { angle: (3 * Math.PI) / 4, label: "back-left" },
  { angle: Math.PI, label: "back" },
  { angle: -Math.PI, label: "back" },
  { angle: (-3 * Math.PI) / 4, label: "back-right" },
  { angle: -Math.PI / 2, label: "right" },
  { angle: -Math.PI / 4, label: "forward-right" },
] as const;

const CANONICAL_EPSILON = 1e-6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function binWidth(binCount: PassSonarBinCount): number {
  return (2 * Math.PI) / binCount;
}

function binOffset(binCount: PassSonarBinCount): number {
  return Math.PI / binCount;
}

/**
 * Assign a Campos-frame angle in radians (-π, +π] to one of `binCount`
 * directional bins centred on multiples of `2π/binCount`, with the forward
 * bin straddling 0 rad on `[-π/binCount, +π/binCount)`. Uses modular angular
 * arithmetic so the back bin (the wrap-around) is handled cleanly.
 */
export function assignAngularBin(
  angleRad: number,
  binCount: PassSonarBinCount = DEFAULT_PASS_SONAR_BIN_COUNT,
): number {
  const TAU = Math.PI * 2;
  const offset = binOffset(binCount);
  const width = binWidth(binCount);
  const wrapped = (((angleRad + offset) % TAU) + TAU) % TAU;
  return Math.floor(wrapped / width);
}

/**
 * Return the canonical bearing name for a centre angle that coincides with
 * one of the eight canonical directions, or `null` otherwise. Degree labels
 * are the fallback for non-canonical bins.
 */
function canonicalLabel(centerAngleRad: number): string | null {
  for (const canonical of CANONICAL_CENTERS) {
    if (Math.abs(centerAngleRad - canonical.angle) < CANONICAL_EPSILON) {
      return canonical.label;
    }
  }
  return null;
}

/**
 * Produce the human-readable label for a bin centred at `centerAngleRad`.
 * Canonical directions use their named form; all other bins use degree
 * bearings relative to forward (`"15° left"`, `"30° right"`).
 */
export function bearingLabel(centerAngleRad: number): string {
  const canonical = canonicalLabel(centerAngleRad);
  if (canonical != null) return canonical;
  const degrees = Math.round((centerAngleRad * 180) / Math.PI);
  // Positive angles → attacker's left (Campos canonical y grows toward left).
  // Negative angles → attacker's right.
  if (degrees > 0) return `${degrees}° left`;
  return `${-degrees}° right`;
}

/**
 * Format a structured `PassSonarWarning` as a human-readable string for
 * `ChartFrame.warnings`. Exact strings are part of the public contract —
 * tests and consumers depend on them.
 */
export function formatPassSonarWarning(w: PassSonarWarning): string {
  switch (w.kind) {
    case "missing-coords":
      return `Dropped ${w.count} pass${w.count === 1 ? "" : "es"} with missing start/end coordinates`;
    case "missing-result":
      return `Dropped ${w.count} pass${w.count === 1 ? "" : "es"} with no passResult`;
    case "subject-mismatch":
      return `Dropped ${w.count} pass${w.count === 1 ? "" : "es"} not matching subject "${w.expected}"`;
    case "scale-max-invalid":
      return `scaleMaxAttempts=${String(w.received)} is invalid; chart auto-scaled instead`;
    case "scale-max-clamped":
      return `scaleMaxAttempts=${w.resolvedMax} is below observed max ${w.observedMax}; wedges clamped`;
    case "scale-max-length-invalid":
      return `scaleMaxLength=${String(w.received)} is invalid; chart auto-scaled instead`;
    case "scale-max-length-clamped":
      return `scaleMaxLength=${w.resolvedMax} is below observed max ${w.observedMax.toFixed(1)}; wedges clamped`;
  }
}

type ScaleMaxResolution = {
  requestedScaleMax: number | null;
  normalisedScaleMax: number | null;
  scaleInvalidWarning: PassSonarWarning | null;
};

function normaliseScaleMax(raw: number | undefined): ScaleMaxResolution {
  if (raw == null) {
    return {
      requestedScaleMax: null,
      normalisedScaleMax: null,
      scaleInvalidWarning: null,
    };
  }
  if (!Number.isFinite(raw) || raw < 1) {
    return {
      requestedScaleMax: raw,
      normalisedScaleMax: null,
      scaleInvalidWarning: { kind: "scale-max-invalid", received: raw },
    };
  }
  return {
    requestedScaleMax: raw,
    normalisedScaleMax: Math.ceil(raw),
    scaleInvalidWarning: null,
  };
}

type Bucket = {
  attempted: number;
  completed: number;
  lengthSum: number;
  lengthCount: number;
  metricSum: number;
  metricCount: number;
};

function emptyBuckets(binCount: PassSonarBinCount): Bucket[] {
  return Array.from({ length: binCount }, () => ({
    attempted: 0,
    completed: 0,
    lengthSum: 0,
    lengthCount: 0,
    metricSum: 0,
    metricCount: 0,
  }));
}

type ScaleMaxLengthResolution = {
  requestedScaleMaxLength: number | null;
  normalisedScaleMaxLength: number | null;
  scaleInvalidWarning: PassSonarWarning | null;
};

function normaliseScaleMaxLength(raw: number | undefined): ScaleMaxLengthResolution {
  if (raw == null) {
    return {
      requestedScaleMaxLength: null,
      normalisedScaleMaxLength: null,
      scaleInvalidWarning: null,
    };
  }
  if (!Number.isFinite(raw) || raw <= 0) {
    return {
      requestedScaleMaxLength: raw,
      normalisedScaleMaxLength: null,
      scaleInvalidWarning: { kind: "scale-max-length-invalid", received: raw },
    };
  }
  return {
    requestedScaleMaxLength: raw,
    normalisedScaleMaxLength: raw,
    scaleInvalidWarning: null,
  };
}

type IntervalEntry = { start: number; end: number; centerAngle: number };

function binIntervals(binCount: PassSonarBinCount): IntervalEntry[] {
  // Every bin's centre and bounds are derived deterministically from the
  // half-open interval rule with the `forward` bin straddling 0 rad on
  // `[-π/binCount, +π/binCount)`. Intervals are emitted in
  // canonical-frame radians.
  const width = binWidth(binCount);
  const offset = binOffset(binCount);
  return Array.from({ length: binCount }, (_, i) => {
    let centerAngle = i * width;
    if (centerAngle > Math.PI) centerAngle -= 2 * Math.PI;
    return {
      start: centerAngle - offset,
      end: centerAngle + offset,
      centerAngle,
    };
  });
}

// ---------------------------------------------------------------------------
// Public helper
// ---------------------------------------------------------------------------

export function computePassSonar(input: ComputePassSonarInput): PassSonarModel {
  const subjectLabel = input.subjectLabel?.trim() || null;
  const subjectKind = input.subjectKind ?? "player";
  const binCount = input.binCount ?? DEFAULT_PASS_SONAR_BIN_COUNT;
  const lengthBy: PassSonarLengthBy = input.lengthBy ?? "count";

  const { requestedScaleMax, normalisedScaleMax, scaleInvalidWarning } =
    normaliseScaleMax(input.scaleMaxAttempts);
  const {
    requestedScaleMaxLength,
    normalisedScaleMaxLength,
    scaleInvalidWarning: scaleLengthInvalidWarning,
  } = normaliseScaleMaxLength(input.scaleMaxLength);

  const buckets = emptyBuckets(binCount);
  let missingCoords = 0;
  let missingResult = 0;
  let subjectMismatch = 0;

  const metricForPass = input.metricForPass;

  for (const pass of input.passes) {
    if (input.subjectId != null) {
      const observed = subjectKind === "player" ? pass.playerId : pass.teamId;
      if (observed !== input.subjectId) {
        subjectMismatch += 1;
        continue;
      }
    }
    if (pass.x == null || pass.y == null || pass.endX == null || pass.endY == null) {
      missingCoords += 1;
      continue;
    }
    if (pass.passResult == null) {
      missingResult += 1;
      continue;
    }
    // Angle is computed from canonical-frame start/end points. In Campos
    // canonical coords `+x` points to the opposition goal, so the resulting
    // angle is intrinsically attack-adjusted (0 rad = forward toward the
    // opposition goal), regardless of which team is passing or which half.
    // See the attack-adjusted-frame decision doc.
    const angle = Math.atan2(pass.endY - pass.y, pass.endX - pass.x);
    const binIndex = assignAngularBin(angle, binCount);
    const bucket = buckets[binIndex];
    if (bucket == null) continue;
    bucket.attempted += 1;
    if (pass.passResult === "complete") bucket.completed += 1;
    const len = pass.length ?? Math.hypot(pass.endX - pass.x, pass.endY - pass.y);
    if (Number.isFinite(len)) {
      bucket.lengthSum += len;
      bucket.lengthCount += 1;
    }
    if (metricForPass != null) {
      const value = metricForPass(pass);
      if (value != null && Number.isFinite(value)) {
        bucket.metricSum += value;
        bucket.metricCount += 1;
      }
    }
  }

  const observedMax = buckets.reduce((m, b) => Math.max(m, b.attempted), 0);
  const observedMaxLength = buckets.reduce((m, b) => {
    if (b.lengthCount === 0) return m;
    return Math.max(m, b.lengthSum / b.lengthCount);
  }, 0);
  const totalAttempted = buckets.reduce((s, b) => s + b.attempted, 0);
  const totalCompleted = buckets.reduce((s, b) => s + b.completed, 0);
  const empty = totalAttempted === 0;

  let resolvedScaleMax: number;
  let clampedWarning: PassSonarWarning | null = null;
  if (normalisedScaleMax != null) {
    resolvedScaleMax = normalisedScaleMax;
    if (observedMax > resolvedScaleMax) {
      clampedWarning = {
        kind: "scale-max-clamped",
        observedMax,
        resolvedMax: resolvedScaleMax,
      };
    }
  } else {
    resolvedScaleMax = Math.max(1, observedMax);
  }

  let resolvedScaleMaxLength: number;
  let clampedLengthWarning: PassSonarWarning | null = null;
  if (normalisedScaleMaxLength != null) {
    resolvedScaleMaxLength = normalisedScaleMaxLength;
    if (observedMaxLength > resolvedScaleMaxLength) {
      clampedLengthWarning = {
        kind: "scale-max-length-clamped",
        observedMax: observedMaxLength,
        resolvedMax: resolvedScaleMaxLength,
      };
    }
  } else {
    // Fall back to the observed max so the largest wedge saturates the
    // track. Neutral `1` when no bin has any length data.
    resolvedScaleMaxLength = observedMaxLength > 0 ? observedMaxLength : 1;
  }

  const intervals = binIntervals(binCount);
  let metricMin = Number.POSITIVE_INFINITY;
  let metricMax = Number.NEGATIVE_INFINITY;
  const wedges: PassSonarWedgeModel[] = buckets.map((bucket, binIndex) => {
    const interval = intervals[binIndex] ?? {
      start: 0,
      end: 0,
      centerAngle: 0,
    };
    const label = bearingLabel(interval.centerAngle);
    const isCanonical = canonicalLabel(interval.centerAngle) != null;
    const attemptedClamped = Math.min(bucket.attempted, resolvedScaleMax);
    const completedClamped = Math.min(bucket.completed, resolvedScaleMax);
    const averageLength =
      bucket.lengthCount === 0 ? null : bucket.lengthSum / bucket.lengthCount;
    const metricValue =
      bucket.metricCount === 0 ? null : bucket.metricSum / bucket.metricCount;
    if (metricValue != null) {
      if (metricValue < metricMin) metricMin = metricValue;
      if (metricValue > metricMax) metricMax = metricValue;
    }
    const lengthClamped =
      averageLength == null ? 0 : Math.min(averageLength, resolvedScaleMaxLength);
    const lengthRadius =
      resolvedScaleMaxLength > 0 ? Math.sqrt(lengthClamped / resolvedScaleMaxLength) : 0;
    return {
      binIndex,
      label,
      isCanonical,
      angleStart: interval.start,
      angleEnd: interval.end,
      centerAngle: interval.centerAngle,
      attempted: bucket.attempted,
      completed: bucket.completed,
      completionRate: bucket.attempted === 0 ? 0 : bucket.completed / bucket.attempted,
      averageLength,
      metricValue,
      attemptedRadius: Math.sqrt(attemptedClamped / resolvedScaleMax),
      completedRadius: Math.sqrt(completedClamped / resolvedScaleMax),
      lengthRadius,
    };
  });

  const structuredWarnings: PassSonarWarning[] = [];
  if (missingCoords > 0)
    structuredWarnings.push({ kind: "missing-coords", count: missingCoords });
  if (missingResult > 0)
    structuredWarnings.push({ kind: "missing-result", count: missingResult });
  if (subjectMismatch > 0 && input.subjectId != null)
    structuredWarnings.push({
      kind: "subject-mismatch",
      count: subjectMismatch,
      expected: input.subjectId,
    });
  if (scaleInvalidWarning != null) structuredWarnings.push(scaleInvalidWarning);
  if (clampedWarning != null) structuredWarnings.push(clampedWarning);
  if (scaleLengthInvalidWarning != null)
    structuredWarnings.push(scaleLengthInvalidWarning);
  if (clampedLengthWarning != null) structuredWarnings.push(clampedLengthWarning);

  const warnings = structuredWarnings.map(formatPassSonarWarning);

  return {
    meta: {
      component: "PassSonar",
      empty,
      subjectLabel,
      binCount,
      lengthBy,
      requestedScaleMax,
      resolvedScaleMax,
      requestedScaleMaxLength,
      resolvedScaleMaxLength,
      metricRange: Number.isFinite(metricMin) ? { min: metricMin, max: metricMax } : null,
      warnings,
      structuredWarnings,
    },
    summary: {
      attempted: totalAttempted,
      completed: totalCompleted,
      completionRate: totalAttempted === 0 ? 0 : totalCompleted / totalAttempted,
    },
    wedges,
    legend: {
      rows: [
        { kind: "attempted", label: "Attempted passes", color: "" },
        { kind: "completed", label: "Completed passes", color: "" },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Shared-scale helper for grids of sonars
// ---------------------------------------------------------------------------

export type SharedScaleMetric = "count" | "length";

/**
 * Compute the maximum bin count (or mean pass length) across a grid of
 * sonar cells so every cell can share the same scale. Pass the returned
 * number as `scaleMaxAttempts` / `scaleMaxLength` to every cell.
 *
 * Each cell may optionally scope its aggregation with `subjectId` +
 * `subjectKind`, mirroring {@link computePassSonar}'s filtering so the
 * shared max reflects what the chart will actually render. Events with
 * missing coordinates or `passResult`, or whose subject doesn't match,
 * are skipped silently.
 */
export function computeSharedScaleMax(
  cells: ReadonlyArray<{
    passes: ReadonlyArray<PassEvent>;
    subjectId?: string;
    subjectKind?: "player" | "team";
  }>,
  options: {
    metric: SharedScaleMetric;
    binCount?: PassSonarBinCount;
  },
): number {
  const binCount = options.binCount ?? DEFAULT_PASS_SONAR_BIN_COUNT;
  let max = 0;
  for (const cell of cells) {
    const cellKind = cell.subjectKind ?? "player";
    const buckets = emptyBuckets(binCount);
    for (const pass of cell.passes) {
      if (cell.subjectId != null) {
        const observed = cellKind === "player" ? pass.playerId : pass.teamId;
        if (observed !== cell.subjectId) continue;
      }
      if (
        pass.x == null ||
        pass.y == null ||
        pass.endX == null ||
        pass.endY == null ||
        pass.passResult == null
      )
        continue;
      const angle = Math.atan2(pass.endY - pass.y, pass.endX - pass.x);
      const bin = assignAngularBin(angle, binCount);
      const bucket = buckets[bin];
      if (bucket == null) continue;
      bucket.attempted += 1;
      if (pass.passResult === "complete") bucket.completed += 1;
      const len = pass.length ?? Math.hypot(pass.endX - pass.x, pass.endY - pass.y);
      if (Number.isFinite(len)) {
        bucket.lengthSum += len;
        bucket.lengthCount += 1;
      }
    }
    if (options.metric === "count") {
      for (const bucket of buckets) {
        if (bucket.attempted > max) max = bucket.attempted;
      }
    } else {
      for (const bucket of buckets) {
        if (bucket.lengthCount === 0) continue;
        const mean = bucket.lengthSum / bucket.lengthCount;
        if (mean > max) max = mean;
      }
    }
  }
  return max;
}
