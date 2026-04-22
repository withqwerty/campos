import type { PassEvent } from "@withqwerty/campos-schema";

import { circularMean } from "./circular.js";
import { interpolateStops, type ColorStop } from "./color.js";
import { resolveColorStops } from "./color-scales.js";
import { assignBin, uniformEdges, validateEdges } from "./edges.js";
import { clamp } from "./math.js";
import type { HeaderStatsItem } from "./shot-map.js";

export { InvalidEdgesError } from "./edges.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PassFlowValueMode = "count" | "share" | "relative-frequency";

export type PassFlowColorScale =
  | "sequential-blues"
  | "sequential-reds"
  | "diverging-rdbu"
  | "custom";

export type PassFlowArrowLengthMode =
  | "equal"
  | "scaled-by-count"
  | "scaled-by-resultant"
  | "scaled-by-distance";

export type PassFlowCompletionFilter = "complete" | "incomplete" | "all";

/**
 * Which passes contribute to each bin. Direction is classified by the angle
 * of `(endX − x, endY − y)` in Campos frame:
 *   - `forward`  — within ±45° of +x (toward opposition goal)
 *   - `backward` — within ±45° of −x (toward own goal)
 *   - `lateral`  — within ±45° of ±y (across the pitch)
 *   - `all`      — no filter
 *
 * Analysts typically pair `forward` with this chart to produce the
 * "flow toward goal" reading, in contrast to the overall "how does the team
 * move the ball from each zone" default.
 */
export type PassFlowDirectionFilter = "all" | "forward" | "backward" | "lateral";

export type PassFlowLowDispersionGlyph = "circle" | "cross" | "none";

export type PassFlowTooltipModel = {
  rows: Array<{ key: string; label: string; value: string }>;
};

export type PassFlowBinModel = {
  col: number;
  row: number;
  /**
   * Stable string identifier for the bin in `row-col` form. Emitted once
   * by compute so every layer reads the same key instead of each call-site
   * reconstructing it from col+row (and drifting on separator convention).
   */
  key: string;
  /** Left edge in Campos 0-100 x-space. */
  x: number;
  /** Bottom edge in Campos 0-100 y-space. */
  y: number;
  width: number;
  height: number;
  /** Number of passes with origin in this bin (post-filter, post-clamp). */
  count: number;
  /** Passes that also contributed to the circular mean (have valid endX/endY). */
  directionCount: number;
  /** `count` expressed per `valueMode` (count / share / relative-frequency). */
  value: number;
  /** count / totalValidCount; always emitted, 0 when totalValidCount === 0. */
  share: number;
  /** Observed share divided by expected uniform share (bin.area / totalArea). */
  relativeFrequency: number;
  /** `value / max(value)` across the grid; drives the colour ramp. */
  intensity: number;
  /** Resolved CSS colour for the cell fill (transparent when empty). */
  fill: string;
  /** 0 for empty bins, 1 for non-empty. */
  opacity: number;
  /** Circular mean angle in radians, Campos frame. `null` when the arrow gate fails. */
  meanAngle: number | null;
  /** Mean resultant length R ∈ [0, 1]. Higher = tighter agreement. */
  resultantLength: number;
  /**
   * Mean Euclidean pass distance for the direction-contributing passes in
   * this bin, in Campos units. `0` when `directionCount === 0`. Drives
   * `arrowLengthMode="scaled-by-distance"`.
   */
  meanDistance: number;
  /**
   * Raw `(endX, endY)` destinations for every direction-contributing pass in
   * this bin, in Campos units. Empty array unless the caller opts in via
   * `captureDestinations: true`. Drives the hover-destination overlay in
   * `<PassFlow showHoverDestinations />`.
   */
  destinations: readonly { endX: number; endY: number }[];
  /** Per-arrow-length-mode hint in [0, 1]; renderer multiplies by containment. */
  magnitudeHint: number;
  /** Convenience: `meanAngle !== null`. */
  hasArrow: boolean;
  /** True when count > 0 but no arrow rendered (gated). */
  lowDispersion: boolean;
  tooltip: PassFlowTooltipModel;
};

export type PassFlowLegendModel = {
  title: string;
  /** Domain for the colour bar, mapped to the stops below. */
  domain: [number, number];
  stops: ColorStop[];
  valueMode: PassFlowValueMode;
};

export type PassFlowModel = {
  meta: {
    component: "PassFlow";
    empty: boolean;
    accessibleLabel: string;
    crop: "full" | "half";
    attackingDirection: "up" | "down" | "left" | "right";
    valueMode: PassFlowValueMode;
    lowDispersionGlyph: PassFlowLowDispersionGlyph;
    arrowLengthMode: PassFlowArrowLengthMode;
    dispersionFloor: number;
    minCountForArrow: number;
    warnings: string[];
    /** Counts surfaced for audit; mirror what's in `warnings` as strings. */
    stats: {
      totalInput: number;
      totalValid: number;
      clampedXY: number;
      droppedNonFinite: number;
      droppedNoOutcome: number;
      droppedByFilter: number;
      droppedOutOfCrop: number;
    };
  };
  layout: {
    order: Array<"headerStats" | "plot" | "legend">;
  };
  headerStats: {
    items: HeaderStatsItem[];
  } | null;
  grid: {
    columns: number;
    rows: number;
    bins: PassFlowBinModel[];
  };
  plot: {
    pitch: {
      crop: "full" | "half";
      attackingDirection: "up" | "down" | "left" | "right";
    };
  };
  legend: PassFlowLegendModel | null;
  emptyState: {
    message: string;
  } | null;
};

export type ComputePassFlowInput = {
  passes: readonly PassEvent[];
  crop?: "full" | "half";
  attackingDirection?: "up" | "down" | "left" | "right";
  bins?: { x: number; y: number };
  /** Explicit x-edges in Campos 0-100 space. Overrides `bins.x`. */
  xEdges?: readonly number[];
  /** Explicit y-edges in Campos 0-100 space. Overrides `bins.y`. */
  yEdges?: readonly number[];
  /** @default "all" — the chart does not editorialise. */
  completionFilter?: PassFlowCompletionFilter;
  /**
   * Restrict which passes contribute to the mean direction and density.
   * Use `"forward"` for the "flow toward goal" view.
   * @default "all"
   */
  directionFilter?: PassFlowDirectionFilter;
  minMinute?: number;
  maxMinute?: number;
  /**
   * Include only passes from these match periods. `undefined` (default)
   * includes every period in the input. Useful for halftime-adjustment
   * storytelling (`periodFilter: [1]` vs `[2]` side-by-side).
   */
  periodFilter?: readonly (1 | 2 | 3 | 4 | 5)[];
  /**
   * When true, every bin's `destinations` array is populated with the raw
   * `(endX, endY)` of each direction-contributing pass. Default `false`
   * because this allocates per-pass objects and is only needed for the
   * hover-destination overlay. Toggle at the component level via
   * `<PassFlow showHoverDestinations />`.
   */
  captureDestinations?: boolean;
  /** @default "share" */
  valueMode?: PassFlowValueMode;
  /** @default "sequential-blues" */
  colorScale?: PassFlowColorScale;
  colorStops?: ColorStop[];
  /** @default "equal" */
  arrowLengthMode?: PassFlowArrowLengthMode;
  /** R-threshold below which no arrow is drawn. @default 0.3 */
  dispersionFloor?: number;
  /** Minimum `count` required to render an arrow. @default 2 */
  minCountForArrow?: number;
  /** @default "circle" */
  lowDispersionGlyph?: PassFlowLowDispersionGlyph;
  /** Label for the colour bar, overrides default for the active valueMode. */
  metricLabel?: string;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_BINS_X = 6;
const DEFAULT_BINS_Y = 4;
const DEFAULT_VALUE_MODE: PassFlowValueMode = "share";
const DEFAULT_ARROW_LENGTH_MODE: PassFlowArrowLengthMode = "equal";
const DEFAULT_DISPERSION_FLOOR = 0.3;
const DEFAULT_MIN_COUNT = 2;
const DEFAULT_GLYPH: PassFlowLowDispersionGlyph = "circle";
// Stable empty-array reference so bins with `captureDestinations=false`
// share a single allocation instead of 24 identical empties per model.
const EMPTY_DESTINATIONS: readonly { endX: number; endY: number }[] = Object.freeze([]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeBinCount(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
}

/**
 * Type predicate narrowing only the first argument (TypeScript can't
 * narrow two positional args simultaneously). Callers that need `b`
 * narrowed too assert it as a number right after the guard — safe
 * because the runtime check has already proven `b` is a finite number.
 */
function isFinitePair(
  a: number | null | undefined,
  b: number | null | undefined,
): a is number {
  return a != null && b != null && Number.isFinite(a) && Number.isFinite(b);
}

/**
 * Classify a pass vector by the 4-sector scheme used by `PassFlowDirectionFilter`.
 *   forward  — within ±45° of +x  (toward opposition goal)
 *   backward — within ±45° of −x  (toward own goal)
 *   lateral  — within ±45° of ±y  (across pitch)
 */
function vectorMatchesDirection(
  dx: number,
  dy: number,
  filter: PassFlowDirectionFilter,
): boolean {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  switch (filter) {
    case "all":
      return true;
    case "forward":
      return dx > 0 && absX >= absY;
    case "backward":
      return dx < 0 && absX >= absY;
    case "lateral":
      return absY > absX;
  }
}

function formatAngleDegrees(radians: number): string {
  // Campos frame: 0 rad = +x = attacking direction in data space.
  // Report in degrees in [0, 360), increasing CCW, consistent with math convention.
  let deg = (radians * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return `${deg.toFixed(0)}°`;
}

function footballBearing(radians: number): string {
  // Split the circle into 8 attacker-relative bearings. Angles are CCW
  // from +x in Campos frame (+x = toward opposition goal).
  // y=100 is the attacker's right touchline per coordinate-invariants.md, so
  // +y points to the attacker's right.
  const TWO_PI = Math.PI * 2;
  let a = radians % TWO_PI;
  if (a < 0) a += TWO_PI;
  // 8 sectors of 45° each, centred on the cardinal/diagonal.
  const sector = Math.floor((a + Math.PI / 8) / (Math.PI / 4)) % 8;
  const labels = [
    "forward",
    "forward-right",
    "right",
    "back-right",
    "back",
    "back-left",
    "left",
    "forward-left",
  ];
  return labels[sector]!;
}

function resolveDefaultMetricLabel(valueMode: PassFlowValueMode): string {
  switch (valueMode) {
    case "count":
      return "Pass Count";
    case "share":
      return "Pass Origin Share";
    case "relative-frequency":
      return "Pass Origin Relative Frequency";
  }
}

/**
 * Header-stats items over the *post-filter* pass population — the same set
 * that drives binning. All three numbers describe one population; this
 * matters when `completionFilter`, `minMinute`, `maxMinute`, or `crop`
 * narrow the set (otherwise the three stats describe three different
 * populations).
 *
 * Completion rate uses coded outcomes as the denominator so `passResult:
 * null` is not silently treated as a failure. When no outcomes are coded,
 * completion is reported as `—`.
 */
function buildHeaderStats(filteredPasses: readonly PassEvent[]): HeaderStatsItem[] {
  const total = filteredPasses.length;
  let completed = 0;
  let codedOutcomes = 0;
  let lengthSum = 0;
  let lengthCount = 0;
  for (const p of filteredPasses) {
    if (p.passResult != null) {
      codedOutcomes += 1;
      if (p.passResult === "complete") completed += 1;
    }
    if (p.length != null && Number.isFinite(p.length)) {
      lengthSum += p.length;
      lengthCount += 1;
    }
  }
  const completionRate = codedOutcomes > 0 ? completed / codedOutcomes : null;

  return [
    { label: "Passes", value: String(total) },
    {
      label: "Completion",
      value: completionRate != null ? `${(completionRate * 100).toFixed(0)}%` : "—",
    },
    {
      label: "Mean length",
      value: lengthCount > 0 ? meanLengthFormat(lengthSum / lengthCount) : "—",
    },
  ];
}

function meanLengthFormat(value: number): string {
  return value.toFixed(1);
}

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

/**
 * Compute a renderer-neutral semantic model for a Campos PassFlow.
 *
 * Aggregates pass origins into a rectangular grid and computes the circular
 * mean of each bin's pass vectors. Renderers receive resolved colours, a
 * direction-or-null angle per bin, and a `magnitudeHint` normalized to
 * `[0, 1]` — the renderer owns the hint → pixel mapping.
 */
export function computePassFlow(input: ComputePassFlowInput): PassFlowModel {
  const attackingDirection = input.attackingDirection ?? "right";
  const crop = input.crop ?? "full";
  const valueMode = input.valueMode ?? DEFAULT_VALUE_MODE;
  const arrowLengthMode = input.arrowLengthMode ?? DEFAULT_ARROW_LENGTH_MODE;
  const completionFilter = input.completionFilter ?? "all";
  const directionFilter: PassFlowDirectionFilter = input.directionFilter ?? "all";
  const captureDestinations = input.captureDestinations === true;
  const dispersionFloor = input.dispersionFloor ?? DEFAULT_DISPERSION_FLOOR;
  const minCountForArrow = input.minCountForArrow ?? DEFAULT_MIN_COUNT;
  const lowDispersionGlyph = input.lowDispersionGlyph ?? DEFAULT_GLYPH;
  const metricLabel = input.metricLabel ?? resolveDefaultMetricLabel(valueMode);

  const cropMinX = crop === "half" ? 50 : 0;
  const cropMaxX = 100;
  const cropMinY = 0;
  const cropMaxY = 100;

  // Edges — explicit override or uniform from `bins`.
  const warnings: string[] = [];
  let xEdges: number[];
  let yEdges: number[];
  if (input.xEdges != null) {
    if (input.bins?.x != null) {
      warnings.push("Both xEdges and bins.x supplied — xEdges wins; bins.x is ignored.");
    }
    validateEdges(input.xEdges, cropMinX, cropMaxX, "x");
    xEdges = input.xEdges.slice();
  } else {
    const binsX = normalizeBinCount(input.bins?.x, DEFAULT_BINS_X);
    xEdges = uniformEdges(binsX, cropMinX, cropMaxX);
  }
  if (input.yEdges != null) {
    if (input.bins?.y != null) {
      warnings.push("Both yEdges and bins.y supplied — yEdges wins; bins.y is ignored.");
    }
    validateEdges(input.yEdges, cropMinY, cropMaxY, "y");
    yEdges = input.yEdges.slice();
  } else {
    const binsY = normalizeBinCount(input.bins?.y, DEFAULT_BINS_Y);
    yEdges = uniformEdges(binsY, cropMinY, cropMaxY);
  }

  const binsX = xEdges.length - 1;
  const binsY = yEdges.length - 1;
  const stats = {
    totalInput: input.passes.length,
    totalValid: 0,
    clampedXY: 0,
    droppedNonFinite: 0,
    droppedNoOutcome: 0,
    droppedByFilter: 0,
    droppedOutOfCrop: 0,
  };

  // ---------------------------------------------------------------------
  // Pass-level filtering
  // ---------------------------------------------------------------------

  type ProcessedPass = {
    pass: PassEvent;
    x: number;
    y: number;
    /** Unit vector to pass destination, or null when destination is missing. */
    dx: number | null;
    dy: number | null;
    /** Clamped absolute destination coords, only kept when captureDestinations. */
    endX: number | null;
    endY: number | null;
  };

  const processed: ProcessedPass[] = [];

  for (const pass of input.passes) {
    // Origin must be finite; bin assignment depends on it.
    if (!isFinitePair(pass.x, pass.y)) {
      stats.droppedNonFinite += 1;
      continue;
    }

    // Completion filter — `passResult === null` + non-"all" filter → drop.
    if (completionFilter !== "all") {
      if (pass.passResult == null) {
        stats.droppedNoOutcome += 1;
        continue;
      }
      if (pass.passResult !== completionFilter) {
        stats.droppedByFilter += 1;
        continue;
      }
    }

    // Minute window.
    if (input.minMinute != null && pass.minute < input.minMinute) {
      stats.droppedByFilter += 1;
      continue;
    }
    if (input.maxMinute != null && pass.minute > input.maxMinute) {
      stats.droppedByFilter += 1;
      continue;
    }

    // Period filter.
    if (input.periodFilter != null && !input.periodFilter.includes(pass.period)) {
      stats.droppedByFilter += 1;
      continue;
    }

    // Clamp origin to [0, 100]; count clamps for the warnings surface.
    // `isFinitePair` narrowed `pass.x` above; `pass.y` still carries the
    // nullable declared type so it needs the explicit assertion.
    const rawX = pass.x;
    const rawY = pass.y as number;
    const clampedX = clamp(rawX, 0, 100);
    const clampedY = clamp(rawY, 0, 100);
    if (clampedX !== rawX || clampedY !== rawY) {
      stats.clampedXY += 1;
    }

    // Crop filter (data-space).
    if (
      clampedX < cropMinX ||
      clampedX > cropMaxX ||
      clampedY < cropMinY ||
      clampedY > cropMaxY
    ) {
      stats.droppedOutOfCrop += 1;
      continue;
    }

    // Direction vector: prefer (endX-x, endY-y) when valid.
    let dx: number | null = null;
    let dy: number | null = null;
    let endX: number | null = null;
    let endY: number | null = null;
    if (isFinitePair(pass.endX, pass.endY)) {
      const eX = clamp(pass.endX, 0, 100);
      const eY = clamp(pass.endY as number, 0, 100);
      const rawDx = eX - clampedX;
      const rawDy = eY - clampedY;
      const mag = Math.hypot(rawDx, rawDy);
      if (mag > 0 && vectorMatchesDirection(rawDx, rawDy, directionFilter)) {
        dx = rawDx;
        dy = rawDy;
        if (captureDestinations) {
          endX = eX;
          endY = eY;
        }
      }
    }
    // When a directionFilter is active, the pass must have a matching
    // direction vector to count — otherwise drop it entirely so colour
    // intensity also reflects the filter. With "all" we keep non-direction
    // passes as pure origin-only contributors (preserves existing default).
    if (directionFilter !== "all" && dx === null) {
      stats.droppedByFilter += 1;
      continue;
    }

    processed.push({ pass, x: clampedX, y: clampedY, dx, dy, endX, endY });
    stats.totalValid += 1;
  }

  if (stats.clampedXY > 0) {
    warnings.push(`${stats.clampedXY} passes had coordinates clamped to [0, 100].`);
  }
  if (stats.droppedNonFinite > 0) {
    warnings.push(
      `${stats.droppedNonFinite} passes dropped due to non-finite coordinates.`,
    );
  }
  if (stats.droppedNoOutcome > 0) {
    warnings.push(
      `${stats.droppedNoOutcome} passes dropped due to missing passResult under completion filter.`,
    );
  }
  if (stats.droppedByFilter > 0) {
    warnings.push(
      `${stats.droppedByFilter} passes dropped by an active filter (completionFilter, directionFilter, periodFilter, or minute window).`,
    );
  }
  if (stats.droppedOutOfCrop > 0) {
    warnings.push(
      `${stats.droppedOutOfCrop} passes dropped as origin falls outside the active crop.`,
    );
  }

  const totalValidCount = processed.length;
  const empty = totalValidCount === 0;

  // ---------------------------------------------------------------------
  // Binning
  // ---------------------------------------------------------------------

  const counts = new Array<number>(binsX * binsY).fill(0);
  // Vectors per bin — fed to `circularMean` after binning. Using the shared
  // util (rather than inlining atan2/hypot math) keeps the gating predicate
  // and edge cases in one place.
  const vectors: Array<Array<{ dx: number; dy: number }>> = Array.from(
    { length: binsX * binsY },
    () => [],
  );
  const destinationsPerBin: Array<Array<{ endX: number; endY: number }>> =
    captureDestinations ? Array.from({ length: binsX * binsY }, () => []) : [];

  for (const p of processed) {
    const col = assignBin(p.x, xEdges);
    const row = assignBin(p.y, yEdges);
    if (col < 0 || row < 0) continue;
    const idx = row * binsX + col;
    counts[idx] = (counts[idx] ?? 0) + 1;
    if (p.dx != null && p.dy != null) {
      vectors[idx]!.push({ dx: p.dx, dy: p.dy });
      if (captureDestinations && p.endX != null && p.endY != null) {
        destinationsPerBin[idx]!.push({ endX: p.endX, endY: p.endY });
      }
    }
  }

  // Total area across all bins (sum of rect areas) — used for relative-frequency.
  let totalArea = 0;
  const binAreas = new Array<number>(binsX * binsY).fill(0);
  for (let row = 0; row < binsY; row += 1) {
    const h = yEdges[row + 1]! - yEdges[row]!;
    for (let col = 0; col < binsX; col += 1) {
      const w = xEdges[col + 1]! - xEdges[col]!;
      const a = w * h;
      binAreas[row * binsX + col] = a;
      totalArea += a;
    }
  }

  // First pass to compute `value` per bin (pre-max-normalization).
  const values = new Array<number>(binsX * binsY).fill(0);
  for (let idx = 0; idx < counts.length; idx += 1) {
    const c = counts[idx] ?? 0;
    if (valueMode === "count") {
      values[idx] = c;
    } else if (valueMode === "share") {
      values[idx] = totalValidCount > 0 ? c / totalValidCount : 0;
    } else {
      const expectedShare = totalArea > 0 ? (binAreas[idx] ?? 0) / totalArea : 0;
      const observedShare = totalValidCount > 0 ? c / totalValidCount : 0;
      values[idx] = expectedShare > 0 ? observedShare / expectedShare : 0;
    }
  }
  let maxValue = 0;
  let maxCount = 0;
  for (let idx = 0; idx < values.length; idx += 1) {
    if (values[idx]! > maxValue) maxValue = values[idx]!;
    if (counts[idx]! > maxCount) maxCount = counts[idx]!;
  }

  // ---------------------------------------------------------------------
  // Pre-compute per-bin mean pass distance (Euclidean, Campos units). Drives
  // the `"scaled-by-distance"` arrow mode AND is exposed on every bin model
  // so headless consumers can build their own encodings. The max-tracking
  // is cheap (O(bins)) so it stays in the main loop; the O(totalValid)
  // Math.hypot loop is unavoidable when `meanDistance` is a public field.
  // ---------------------------------------------------------------------

  const meanDistances = new Array<number>(binsX * binsY).fill(0);
  let maxMeanDistance = 0;
  for (let idx = 0; idx < vectors.length; idx += 1) {
    const vs = vectors[idx]!;
    if (vs.length === 0) continue;
    let total = 0;
    for (const v of vs) total += Math.hypot(v.dx, v.dy);
    const mean = total / vs.length;
    meanDistances[idx] = mean;
    if (mean > maxMeanDistance) maxMeanDistance = mean;
  }

  // ---------------------------------------------------------------------
  // Colour + legend resolution
  // ---------------------------------------------------------------------

  const stops = resolveColorStops(input.colorScale, input.colorStops);
  const legendDomain = buildLegendDomain(valueMode, maxValue, maxCount);
  // Relative-frequency intensity is anchored to legendDomain[1] so the
  // colour ramp lines up with the colourbar — see the intensity branch in
  // the bin-assembly loop below.
  const legendDomainMaxRF = valueMode === "relative-frequency" ? legendDomain[1] : 0;

  // ---------------------------------------------------------------------
  // Assemble bins
  // ---------------------------------------------------------------------

  const bins: PassFlowBinModel[] = [];
  for (let row = 0; row < binsY; row += 1) {
    for (let col = 0; col < binsX; col += 1) {
      const idx = row * binsX + col;
      const count = counts[idx] ?? 0;
      const value = values[idx] ?? 0;
      const share = totalValidCount > 0 ? count / totalValidCount : 0;
      const expectedShare = totalArea > 0 ? (binAreas[idx] ?? 0) / totalArea : 0;
      const relativeFrequency =
        expectedShare > 0 && totalValidCount > 0
          ? count / totalValidCount / expectedShare
          : 0;
      // Intensity drives the colour ramp. For `count`/`share`, max-normalize
      // so the fullest bin maps to the top of the ramp. For
      // `relative-frequency`, the ramp is anchored to the legend domain so
      // 1.0 lands exactly at the midpoint (critical for diverging ramps like
      // RdBu — uniform teams should paint as neutral, not red).
      const intensity =
        valueMode === "relative-frequency"
          ? legendDomainMaxRF > 0
            ? Math.min(1, value / legendDomainMaxRF)
            : 0
          : maxValue > 0
            ? value / maxValue
            : 0;

      // Circular-mean via the shared util. The util already returns null
      // when R < 1e-9; we layer the dispersion-floor and min-count gates on
      // top. Keeping the util as the single source of truth means any
      // tightening of its ZERO_RESULTANT threshold propagates here too.
      const circular = circularMean(vectors[idx]!);
      const directionCount = circular.count;
      const resultantLength = circular.resultantLength;
      let meanAngle: number | null = null;
      if (
        circular.meanAngle !== null &&
        resultantLength >= dispersionFloor &&
        directionCount >= minCountForArrow
      ) {
        meanAngle = circular.meanAngle;
      }
      const hasArrow = meanAngle !== null;

      const meanDistance = meanDistances[idx] ?? 0;

      // Magnitude hint per arrow-length mode; 0 when no arrow.
      let magnitudeHint = 0;
      if (hasArrow) {
        if (arrowLengthMode === "equal") {
          magnitudeHint = 1;
        } else if (arrowLengthMode === "scaled-by-count") {
          magnitudeHint = maxCount > 0 ? count / maxCount : 0;
        } else if (arrowLengthMode === "scaled-by-distance") {
          magnitudeHint = maxMeanDistance > 0 ? meanDistance / maxMeanDistance : 0;
        } else {
          magnitudeHint = resultantLength;
        }
      }

      const isEmpty = count === 0;
      const fill = isEmpty ? "rgba(0,0,0,0)" : interpolateStops(stops, intensity);

      const binX = xEdges[col]!;
      const binY = yEdges[row]!;
      const binW = xEdges[col + 1]! - binX;
      const binH = yEdges[row + 1]! - binY;

      bins.push({
        col,
        row,
        key: `${row}-${col}`,
        x: binX,
        y: binY,
        width: binW,
        height: binH,
        count,
        directionCount,
        value,
        share,
        relativeFrequency,
        intensity,
        fill,
        opacity: isEmpty ? 0 : 1,
        meanAngle,
        resultantLength,
        meanDistance,
        destinations: captureDestinations
          ? (destinationsPerBin[idx] ?? [])
          : EMPTY_DESTINATIONS,
        magnitudeHint,
        hasArrow,
        lowDispersion: !hasArrow && count > 0,
        tooltip: buildBinTooltip({
          col,
          row,
          x: binX,
          width: binW,
          count,
          share,
          meanAngle,
          resultantLength,
        }),
      });
    }
  }

  // ---------------------------------------------------------------------
  // Accessible label
  // ---------------------------------------------------------------------

  const accessibleLabel = empty
    ? "Pass flow: no passes"
    : `Pass flow: ${totalValidCount} passes across ${binsX}×${binsY} zones`;

  // ---------------------------------------------------------------------
  // Model
  // ---------------------------------------------------------------------

  return {
    meta: {
      component: "PassFlow",
      empty,
      accessibleLabel,
      crop,
      attackingDirection,
      valueMode,
      lowDispersionGlyph,
      arrowLengthMode,
      dispersionFloor,
      minCountForArrow,
      warnings,
      stats,
    },
    layout: { order: ["headerStats", "plot", "legend"] },
    headerStats: empty ? null : { items: buildHeaderStats(processed.map((p) => p.pass)) },
    grid: { columns: binsX, rows: binsY, bins },
    plot: { pitch: { crop, attackingDirection } },
    legend: empty
      ? null
      : {
          title: metricLabel,
          domain: legendDomain,
          stops,
          valueMode,
        },
    emptyState: empty ? { message: "No passes to chart" } : null,
  };
}

// ---------------------------------------------------------------------------
// Tooltip & legend helpers
// ---------------------------------------------------------------------------

function buildBinTooltip(args: {
  col: number;
  row: number;
  x: number;
  width: number;
  count: number;
  share: number;
  meanAngle: number | null;
  resultantLength: number;
}): PassFlowTooltipModel {
  const directionRow =
    args.meanAngle != null
      ? {
          key: "direction",
          label: "Mean direction",
          value: `${formatAngleDegrees(args.meanAngle)} (${footballBearing(args.meanAngle)})`,
        }
      : { key: "direction", label: "Mean direction", value: "—" };

  // Include the bin's data-space x-extent so agent consumers can locate the
  // zone without visual reference. Values are attacker-relative Campos units.
  const xEnd = args.x + args.width;
  const zoneValue = `col ${args.col + 1}, row ${args.row + 1} (x ${args.x.toFixed(0)}–${xEnd.toFixed(0)})`;

  return {
    rows: [
      { key: "zone", label: "Zone", value: zoneValue },
      { key: "count", label: "Passes", value: String(args.count) },
      {
        key: "share",
        label: "% of total",
        value: `${(args.share * 100).toFixed(1)}%`,
      },
      directionRow,
      {
        key: "consistency",
        label: "Directional consistency",
        value: args.resultantLength.toFixed(2),
      },
    ],
  };
}

function buildLegendDomain(
  valueMode: PassFlowValueMode,
  maxValue: number,
  maxCount: number,
): [number, number] {
  if (valueMode === "count") return [0, maxCount];
  if (valueMode === "share") return [0, Math.max(maxValue, 1e-6)];
  // relative-frequency: anchor midpoint at 1.0 when diverging consumers use
  // this domain. Use max(2, observedMax) so the midpoint stays centred even
  // when observed max is small.
  return [0, Math.max(2, maxValue)];
}
