import { extent as d3Extent } from "d3-array";

import {
  computeEnvelopes,
  type EnvelopeReferenceGeometry,
  type LineChartEnvelope,
  type LineChartEnvelopeModel,
} from "./envelope.js";
import {
  applyAxisPadding,
  type AxisPaddingInput,
  createNumericAxis,
  DEFAULT_AXIS_PADDING,
  type NumericAxisModel,
  resolveAxisPadding,
} from "./scales/index.js";
import type { PlotAreaBand } from "../primitives/ChartPlotAreaBands.js";
import type { PlotAreaReferenceLine } from "../primitives/ChartPlotAreaReferenceLines.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LineChartPoint = {
  /** Numeric x position. Convert dates to epoch-ms or matchweek index before passing in. */
  x: number;
  /** Numeric y value. */
  y: number;
  /** Optional display label (used in tooltip). */
  label?: string;
  /**
   * Optional marker override — renderers consult this to switch shape (e.g.
   * star for a lockdown on the FT covid chart). Purely advisory; compute
   * does not interpret it.
   */
  markerKind?: string;
};

export type LineChartSeriesInput = {
  /** Stable series identifier. */
  id: string;
  /** Display label (falls back to `id`). */
  label?: string;
  /** Line color (hex). Auto-assigned from palette when omitted. */
  color?: string;
  /** Data points — can arrive unsorted; compute sorts by x. */
  points: readonly LineChartPoint[];
  /**
   * Render a linear-regression trendline for this series. Defaults to the
   * top-level `trendlines` flag; set explicitly to opt in/out per series.
   */
  trendline?: boolean;
  /**
   * When true, the series participates in data resolution and x/y-domain
   * inference (and can be referenced by envelopes), but is suppressed from
   * rendering, legend, end labels, palette allocation, and
   * `meta.visibleSeries` count. Still counted in `meta.totalSeries` and
   * `meta.dataSeries`.
   */
  hidden?: boolean;
  /**
   * Per-series SVG `stroke-dasharray` (e.g. `"6 4"`). Useful for reference or
   * threshold lines that share the axis with real data (pace lines, targets,
   * projections). The `lines.strokeDasharray` style callback overrides this.
   */
  strokeDasharray?: string;
  /**
   * Suppress markers for this series only, leaving other series' markers in
   * place. Useful for reference / threshold lines that share the chart with
   * real data. Top-level `showMarkers={false}` still overrides and hides all
   * markers.
   */
  showMarkers?: boolean;
};

export type LineChartPointModel = {
  /** Original x value. */
  x: number;
  /** Original y value. */
  y: number;
  /** SVG x-coordinate. */
  cx: number;
  /** SVG y-coordinate. */
  cy: number;
  /** Display label from input, or formatted fallback. */
  label: string;
  /** Pass-through marker kind hint from input. */
  markerKind: string | null;
};

export type LineChartSeriesModel = {
  /** Series identifier. */
  id: string;
  /** Display label. */
  label: string;
  /** Resolved color (hex). */
  color: string;
  /** Whether this series is highlighted (full opacity). */
  highlighted: boolean;
  /** Whether this series is hidden from rendering (still in model for envelopes). */
  hidden: boolean;
  /**
   * Per-series `stroke-dasharray` passed through from input. `null` falls
   * back to the style callback or theme default (a solid line).
   */
  strokeDasharray: string | null;
  /**
   * Per-series markers flag. `false` suppresses markers for this series
   * only; the top-level chart `showMarkers={false}` still overrides and
   * hides all markers.
   */
  showMarkers: boolean;
  /** SVG path for the main line. */
  path: string;
  /** Resolved points (sorted by x). */
  points: LineChartPointModel[];
  /** Summary stats — useful for tooltips without re-deriving. */
  summary: {
    firstX: number;
    lastX: number;
    firstY: number;
    lastY: number;
    minY: number;
    maxY: number;
    meanY: number;
    count: number;
  };
  /**
   * Linear-regression trendline when enabled. Null when the series has
   * fewer than 2 points or the trendline is disabled.
   */
  trendline: {
    path: string;
    slope: number;
    intercept: number;
    /** Trendline endpoints in data space, for labels/legends. */
    startY: number;
    endY: number;
  } | null;
};

export type LineChartEndLabelModel = {
  /** Series id. */
  id: string;
  /** Display label. */
  label: string;
  /** SVG x-coordinate (right edge of plot). */
  x: number;
  /** SVG y-coordinate (adjusted for overlap avoidance). */
  y: number;
  /** Color matching the series. */
  color: string;
  /** Y value at the last point. */
  value: number;
};

export type LineChartAxisModel = {
  label: string;
  domain: [number, number];
  ticks: number[];
  /**
   * Pre-formatted tick strings. Renderers can fall back to raw numbers,
   * but most charts want these (date labels, thousands separators, etc.).
   */
  tickLabels: string[];
};

export type LineChartModel = {
  meta: {
    component: "LineChart";
    empty: boolean;
    totalSeries: number;
    /** Series with ≥1 valid point (includes hidden series). Renamed from `validSeries`. */
    dataSeries: number;
    /** Series with ≥1 valid point AND not hidden. */
    visibleSeries: number;
    highlightedSeries: number;
    totalPoints: number;
    droppedPoints: number;
    warnings: string[];
    accessibleLabel: string;
  };
  layout: {
    viewBox: { width: number; height: number };
    /**
     * Data-bearing rect — scale range, tick positions, marker coordinates
     * all live inside this. Inset from `frame` by `axisPadding` on each side.
     */
    plotArea: { x: number; y: number; width: number; height: number };
    /**
     * Outer frame rect — the background fill and series clip-path use this.
     * Equals `plotArea` when `axisPadding` is `0`. Separate so markers at
     * the data extremes can draw fully (within `frame`) even though the
     * scale inset them (within `plotArea`).
     */
    frame: { x: number; y: number; width: number; height: number };
  };
  axes: {
    x: LineChartAxisModel;
    y: LineChartAxisModel;
    /** Present when `dualYAxis` is enabled. Same domain/ticks as `y`. */
    y2: LineChartAxisModel | null;
  };
  series: LineChartSeriesModel[];
  endLabels: LineChartEndLabelModel[];
  /**
   * Declared bands (data-space). SVG-space projection happens inside the
   * `ChartPlotAreaBands` primitive, not here — the input carries through.
   */
  bands: readonly PlotAreaBand[];
  /** Declared reference lines (data-space) passed through. */
  references: readonly PlotAreaReferenceLine[];
  /** Resolved envelope polygon models (data-space, projected by renderer). */
  envelopes: LineChartEnvelopeModel[];
  emptyState: { message: string } | null;
};

export type ComputeLineChartInput = {
  series: readonly LineChartSeriesInput[];
  /** Override x domain (otherwise inferred from data). */
  xDomain?: readonly [number, number];
  /** Override y domain. */
  yDomain?: readonly [number, number];
  /** Explicit x ticks (numbers) or tick count. Defaults to auto. */
  xTicks?: readonly number[] | number;
  /** Explicit y ticks (numbers) or tick count. Defaults to auto. */
  yTicks?: readonly number[] | number;
  /** Tick formatter for x axis. Default: number with thousands separator. */
  xTickFormat?: (value: number) => string;
  /** Tick formatter for y axis. */
  yTickFormat?: (value: number) => string;
  /** Axis labels (shown below / left of plot). */
  xAxisLabel?: string;
  yAxisLabel?: string;
  /**
   * Mirror the y axis on the right side of the plot. Same domain and ticks
   * as the primary y axis — intended for readability on dense trendline
   * charts, not for independent dual scales.
   */
  dualYAxis?: boolean;
  /**
   * Draw a linear-regression trendline for every series unless the series
   * opts out via `trendline: false`. Default false.
   */
  trendlines?: boolean;
  /** Highlighted series ids. Non-highlighted render at reduced opacity. */
  highlightSeries?: readonly string[];
  /** Highlight cap — beyond this, only the first N are honoured. */
  maxHighlight?: number;
  /** Render end labels (anchored at final point). Default true. */
  showEndLabels?: boolean;
  /** Emit end labels for every series, not just highlighted ones. */
  endLabelsForAllSeries?: boolean;
  /** Declarative reference lines (horizontal / vertical / diagonal). */
  references?: readonly PlotAreaReferenceLine[];
  /** Declarative bands (axis-aligned shaded rectangles). */
  bands?: readonly PlotAreaBand[];
  /** Signed-area envelopes between two bounds. */
  envelopes?: readonly LineChartEnvelope[];
  /**
   * Pixel gutter between the data-bearing plot rect and the axis lines.
   * Default `6`. Insets the scale range on each side by this many pixels so
   * markers at the data extremes don't clip against the axis frame. The
   * surrounding frame rect and clip path still extend to the full plot-area
   * bounds, so markers draw fully.
   *
   * Accepts a scalar (both axes) or `[x, y]` for per-axis values. Pass `0`
   * or `false` to restore the tight-frame behaviour.
   */
  axisPadding?: AxisPaddingInput;
  /**
   * Y-scale kind. Linear is the v1 default; `"log"` is accepted as a
   * forward-compatibility signal but currently behaves as linear and emits
   * a warning — log support is planned for the FT covid chart battle-test.
   */
  yScale?: "linear" | "log";
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEWBOX_W = 640;
const VIEWBOX_H = 380;
const MARGIN = { top: 16, right: 64, bottom: 36, left: 52 };
/**
 * Dual-y axis needs room for a mirrored tick-label strip (~28px) plus a gap
 * and an end-label column. Without the extra space end labels collide with
 * the mirrored ticks.
 */
const MARGIN_DUAL_RIGHT = 92;
const PLOT_H = VIEWBOX_H - MARGIN.top - MARGIN.bottom;

const MAX_HIGHLIGHT_DEFAULT = 8;
const END_LABEL_MIN_GAP = 12;
const END_LABEL_OFFSET_PX = 8;
const END_LABEL_DUAL_OFFSET_PX = 40;
const DEFAULT_TICK_COUNT = 6;

const DEFAULT_PALETTE = [
  "#c8102e",
  "#6cabdd",
  "#fdb913",
  "#132257",
  "#00a650",
  "#d71920",
  "#7a263a",
  "#0057b8",
  "#fbee23",
  "#003090",
  "#ee2737",
  "#241f20",
] as const;

const BACKGROUND_COLOR = "#b5b5b5";
const DEFAULT_ENVELOPE_FILL = "#8a8f9a";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function defaultNumberFormat(v: number): string {
  if (!Number.isFinite(v)) return "";
  if (Math.abs(v) >= 1000) {
    return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (Math.abs(v) >= 10) {
    return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function isValidPoint(p: LineChartPoint): boolean {
  return (
    typeof p.x === "number" &&
    Number.isFinite(p.x) &&
    typeof p.y === "number" &&
    Number.isFinite(p.y)
  );
}

function buildLinearPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const first = points[0] as { x: number; y: number };
  const parts: string[] = [`M ${round(first.x)} ${round(first.y)}`];
  for (const pt of points.slice(1)) {
    parts.push(`L ${round(pt.x)} ${round(pt.y)}`);
  }
  return parts.join(" ");
}

/**
 * Ordinary least-squares slope/intercept of y on x. Caller must filter
 * non-finite values beforehand.
 */
function linearRegression(points: readonly { x: number; y: number }[]): {
  slope: number;
  intercept: number;
} | null {
  if (points.length < 2) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  const n = points.length;
  for (const pt of points) {
    sumX += pt.x;
    sumY += pt.y;
    sumXY += pt.x * pt.y;
    sumXX += pt.x * pt.x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function resolveOverlaps(sortedYs: number[], minGap: number): number[] {
  if (sortedYs.length <= 1) return [...sortedYs];
  const result = [...sortedYs];
  for (let i = 1; i < result.length; i++) {
    const curr = result[i] as number;
    const prev = result[i - 1] as number;
    if (curr - prev < minGap) result[i] = prev + minGap;
  }
  for (let i = result.length - 2; i >= 0; i--) {
    const next = result[i + 1] as number;
    const curr = result[i] as number;
    if (next - curr < minGap) result[i] = next - minGap;
  }
  return result;
}

function resolveAxis(
  min: number,
  max: number,
  range: [number, number],
  override: ReadonlyArray<number> | number | undefined,
  invert: boolean,
  tickCountDefault: number,
): NumericAxisModel {
  const tickCount =
    typeof override === "number"
      ? override
      : Array.isArray(override)
        ? Math.max(2, override.length)
        : tickCountDefault;
  const axis = createNumericAxis({
    min,
    max,
    range,
    tickCount,
    invert,
  });
  if (Array.isArray(override) && override.length > 0) {
    // Use explicit ticks but keep the axis-derived domain & scale.
    const explicitTicks = [...(override as readonly number[])].sort((a, b) => a - b);
    return {
      domain: axis.domain,
      ticks: explicitTicks,
      scale: axis.scale,
    };
  }
  return axis;
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

export function computeLineChart(input: ComputeLineChartInput): LineChartModel {
  const {
    series: seriesInput,
    xDomain: xDomainOverride,
    yDomain: yDomainOverride,
    xTicks: xTicksOverride,
    yTicks: yTicksOverride,
    xTickFormat = defaultNumberFormat,
    yTickFormat = defaultNumberFormat,
    xAxisLabel = "",
    yAxisLabel = "",
    dualYAxis = false,
    trendlines = false,
    highlightSeries,
    maxHighlight = MAX_HIGHLIGHT_DEFAULT,
    showEndLabels = true,
    endLabelsForAllSeries = false,
    references: referencesInput = [],
    bands: bandsInput = [],
    envelopes: envelopesInput = [],
    axisPadding = DEFAULT_AXIS_PADDING,
    yScale = "linear",
  } = input;

  const [gutterX, gutterY] = resolveAxisPadding(axisPadding);

  const warnings: string[] = [];

  if (yScale === "log") {
    warnings.push(
      "yScale: 'log' is not implemented in v1 — falling back to linear; " +
        "log support lands with the FT covid chart battle-test",
    );
  }

  const totalSeries = seriesInput.length;
  if (totalSeries === 0) {
    return emptyModel(totalSeries, warnings);
  }

  // ---- validate & collect points ------------------------------------------
  type WorkingSeries = {
    id: string;
    label: string;
    colorOverride: string | null;
    trendlineEnabled: boolean;
    hidden: boolean;
    strokeDasharray: string | null;
    showMarkers: boolean;
    raw: LineChartPoint[];
  };

  const working: WorkingSeries[] = [];
  let totalPoints = 0;
  let droppedPoints = 0;

  for (const s of seriesInput) {
    if (!s.id || typeof s.id !== "string") {
      warnings.push(`[series.dropped-points] series skipped: missing id`);
      continue;
    }
    const sorted = [...s.points].filter(isValidPoint).sort((a, b) => a.x - b.x);
    const dropped = s.points.length - sorted.length;
    if (dropped > 0) {
      droppedPoints += dropped;
      warnings.push(
        `[series.dropped-points] series "${s.id}": ${dropped} point(s) dropped (invalid coordinates)`,
      );
    }
    totalPoints += sorted.length;
    working.push({
      id: s.id,
      label: s.label ?? s.id,
      colorOverride: s.color ?? null,
      trendlineEnabled: s.trendline ?? trendlines,
      hidden: s.hidden === true,
      strokeDasharray: s.strokeDasharray ?? null,
      showMarkers: s.showMarkers ?? true,
      raw: sorted,
    });
  }

  const dataSeriesCount = working.filter((w) => w.raw.length > 0).length;
  const visibleSeriesCount = working.filter((w) => w.raw.length > 0 && !w.hidden).length;
  if (dataSeriesCount === 0) {
    return emptyModel(totalSeries, [
      ...warnings,
      "no series contained any finite (x, y) points",
    ]);
  }
  // All series are hidden — the chart has nothing to render even though
  // data exists. Fall into empty state (per spec §Edge-case matrix).
  if (visibleSeriesCount === 0) {
    return emptyModel(totalSeries, [...warnings, "all series are hidden"]);
  }

  // ---- domains ------------------------------------------------------------
  const allPoints = working.flatMap((w) => w.raw);
  const visiblePoints = working.filter((w) => !w.hidden).flatMap((w) => w.raw);
  const [dataMinX = 0, dataMaxX = 1] = d3Extent(allPoints, (p) => p.x);
  const [dataMinY = 0, dataMaxY = 1] = d3Extent(allPoints, (p) => p.y);

  // Emit [hidden.extends-*] warnings when a hidden series extends the domain
  // beyond what visible series alone would produce. Fires always — consumers
  // filter by code if the hidden-extends-domain case is expected.
  if (visiblePoints.length > 0) {
    const [visMinX = dataMinX, visMaxX = dataMaxX] = d3Extent(visiblePoints, (p) => p.x);
    const [visMinY = dataMinY, visMaxY = dataMaxY] = d3Extent(visiblePoints, (p) => p.y);
    for (const w of working) {
      if (!w.hidden || w.raw.length === 0) continue;
      const [hMinX = Infinity, hMaxX = -Infinity] = d3Extent(w.raw, (p) => p.x);
      const [hMinY = Infinity, hMaxY = -Infinity] = d3Extent(w.raw, (p) => p.y);
      if (hMinX < visMinX || hMaxX > visMaxX) {
        warnings.push(
          `[hidden.extends-x-domain] series "${w.id}" extends x-domain to [${hMinX}, ${hMaxX}] beyond visible series`,
        );
      }
      if (hMinY < visMinY || hMaxY > visMaxY) {
        warnings.push(
          `[hidden.extends-y-domain] series "${w.id}" extends y-domain to [${hMinY}, ${hMaxY}] beyond visible series`,
        );
      }
    }
  }

  const xMin = xDomainOverride ? xDomainOverride[0] : dataMinX;
  const xMax = xDomainOverride ? xDomainOverride[1] : dataMaxX;
  const yMin = yDomainOverride ? yDomainOverride[0] : dataMinY;
  const yMax = yDomainOverride ? yDomainOverride[1] : dataMaxY;

  // Warn when a caller-supplied yDomain clips real data. The clipPath in the
  // renderer hides the overflow visually — surface it here so consumers
  // notice silently-dropped data.
  if (yDomainOverride) {
    let clippedCount = 0;
    for (const p of allPoints) {
      if (p.y < yMin || p.y > yMax) clippedCount += 1;
    }
    if (clippedCount > 0) {
      warnings.push(
        `yDomain [${yMin}, ${yMax}] clips ${clippedCount} point(s) outside the range — they render clipped to the plot area.`,
      );
    }
  }

  // ---- layout -------------------------------------------------------------
  const marginRight = dualYAxis ? MARGIN_DUAL_RIGHT : MARGIN.right;
  const plotW = VIEWBOX_W - MARGIN.left - marginRight;
  // `frame` is the outer rect — background fill + series clip-path use this.
  // `plotArea` is inset by `axisPadding` on each side so the scale range leaves
  // breathing room for markers at the data extremes.
  const frame = { x: MARGIN.left, y: MARGIN.top, width: plotW, height: PLOT_H };
  const plotArea = applyAxisPadding(frame, [gutterX, gutterY]);

  // ---- scales -------------------------------------------------------------
  const xAxis = resolveAxis(
    xMin,
    xMax,
    [plotArea.x, plotArea.x + plotArea.width],
    xTicksOverride,
    false,
    DEFAULT_TICK_COUNT,
  );
  const yAxis = resolveAxis(
    yMin,
    yMax,
    [plotArea.y + plotArea.height, plotArea.y],
    yTicksOverride,
    false,
    DEFAULT_TICK_COUNT,
  );

  const xScale = xAxis.scale;
  const yScaleFn = yAxis.scale;

  // ---- highlight resolution -----------------------------------------------
  const hiddenIds = new Set(working.filter((w) => w.hidden).map((w) => w.id));
  const highlightSet = new Set<string>();
  if (highlightSeries && highlightSeries.length > 0) {
    const truncated = highlightSeries.slice(0, maxHighlight);
    for (const id of truncated) {
      if (hiddenIds.has(id)) {
        warnings.push(
          `[highlight.hidden-target] highlightSeries "${id}" references a hidden series; highlight has no effect`,
        );
        continue;
      }
      highlightSet.add(id);
    }
    if (highlightSeries.length > maxHighlight) {
      warnings.push(
        `highlightSeries truncated to ${maxHighlight}; ` +
          `${highlightSeries.length - maxHighlight} entry(ies) ignored`,
      );
    }
  }
  const hasHighlighting = highlightSet.size > 0;

  // Palette allocation skips hidden series: visible series N gets palette[N].
  const paletteIndexById = new Map<string, number>();
  let visibleCounter = 0;
  for (const w of working) {
    if (w.hidden) continue;
    paletteIndexById.set(w.id, visibleCounter);
    visibleCounter += 1;
  }

  function resolveColor(s: WorkingSeries): string {
    if (s.colorOverride) return s.colorOverride;
    if (hasHighlighting && !highlightSet.has(s.id)) return BACKGROUND_COLOR;
    const paletteIndex = paletteIndexById.get(s.id) ?? 0;
    return DEFAULT_PALETTE[paletteIndex % DEFAULT_PALETTE.length] as string;
  }

  // ---- build series models ------------------------------------------------
  // Draw order: background first, highlighted last (so they sit on top).
  // Hidden series remain in the model (envelopes may reference them) but skip
  // path / trendline / marker construction.
  const ordered = [...working]
    .map((w, index) => ({ w, index }))
    .sort((a, b) => {
      const aHi = !hasHighlighting || highlightSet.has(a.w.id);
      const bHi = !hasHighlighting || highlightSet.has(b.w.id);
      if (aHi !== bHi) return aHi ? 1 : -1;
      return 0;
    });

  const seriesModels: LineChartSeriesModel[] = ordered.map(({ w }) => {
    const color = resolveColor(w);
    const isHighlighted = !hasHighlighting || highlightSet.has(w.id);

    const svgPoints: { x: number; y: number }[] = [];
    const pointModels: LineChartPointModel[] = [];
    let minY = Infinity;
    let maxYLocal = -Infinity;
    let sumY = 0;
    // Hidden series skip SVG projection entirely — we still retain the raw
    // points in the working record for envelope lookups.
    if (!w.hidden) {
      for (const p of w.raw) {
        const cx = xScale(p.x);
        const cy = yScaleFn(p.y);
        svgPoints.push({ x: cx, y: cy });
        pointModels.push({
          x: p.x,
          y: p.y,
          cx,
          cy,
          label: p.label ?? defaultNumberFormat(p.y),
          markerKind: p.markerKind ?? null,
        });
        if (p.y < minY) minY = p.y;
        if (p.y > maxYLocal) maxYLocal = p.y;
        sumY += p.y;
      }
    }

    const path = buildLinearPath(svgPoints);

    const first = w.raw[0];
    const last = w.raw[w.raw.length - 1];
    const count = w.raw.length;

    let trendline: LineChartSeriesModel["trendline"] = null;
    if (!w.hidden && w.trendlineEnabled && count >= 2) {
      const fit = linearRegression(w.raw);
      if (fit) {
        // Extend the trendline to the resolved axis domain (post nice-ticks),
        // not the data min/max. This matches Hudl / FT convention — the
        // regression is still computed from raw points, but drawn across the
        // full x range so it reaches the plot edges.
        const [axisXMin, axisXMax] = xAxis.domain;
        const startY = fit.slope * axisXMin + fit.intercept;
        const endY = fit.slope * axisXMax + fit.intercept;
        const p0 = { x: xScale(axisXMin), y: yScaleFn(startY) };
        const p1 = { x: xScale(axisXMax), y: yScaleFn(endY) };
        trendline = {
          path: buildLinearPath([p0, p1]),
          slope: fit.slope,
          intercept: fit.intercept,
          startY,
          endY,
        };
      }
    }

    return {
      id: w.id,
      label: w.label,
      color,
      highlighted: isHighlighted,
      hidden: w.hidden,
      strokeDasharray: w.strokeDasharray,
      showMarkers: w.showMarkers,
      path,
      points: pointModels,
      summary: {
        firstX: first ? first.x : 0,
        lastX: last ? last.x : 0,
        firstY: first ? first.y : 0,
        lastY: last ? last.y : 0,
        minY: count > 0 ? minY : 0,
        maxY: count > 0 ? maxYLocal : 0,
        meanY: count > 0 ? sumY / count : 0,
        count,
      },
      trendline,
    };
  });

  // ---- end labels ---------------------------------------------------------
  const endLabels: LineChartEndLabelModel[] = [];
  if (showEndLabels) {
    type Raw = {
      id: string;
      label: string;
      rawY: number;
      color: string;
      value: number;
    };
    const raw: Raw[] = seriesModels
      .filter(
        (s) =>
          !s.hidden && (endLabelsForAllSeries || s.highlighted) && s.points.length > 0,
      )
      .map((s) => {
        const last = s.points[s.points.length - 1] as LineChartPointModel;
        return {
          id: s.id,
          label: s.label,
          rawY: last.cy,
          color: s.color,
          value: last.y,
        };
      })
      .sort((a, b) => a.rawY - b.rawY);
    const resolved = resolveOverlaps(
      raw.map((r) => r.rawY),
      END_LABEL_MIN_GAP,
    );
    // When dualYAxis is on, the right tick-label strip lives ~28px past the
    // plot edge. Push end labels past that strip so they don't collide.
    const endLabelX =
      plotArea.x +
      plotArea.width +
      (dualYAxis ? END_LABEL_DUAL_OFFSET_PX : END_LABEL_OFFSET_PX);
    for (let i = 0; i < raw.length; i++) {
      const r = raw[i] as Raw;
      endLabels.push({
        id: r.id,
        label: r.label,
        x: endLabelX,
        y: resolved[i] as number,
        color: r.color,
        value: r.value,
      });
    }
  }

  // ---- envelopes ----------------------------------------------------------
  // ---- bands validation (compute-level) ----------------------------------
  // Validate bands at compute time so drop warnings land in meta.warnings.
  // SVG projection still happens in the primitive — we only check domain +
  // finiteness + zero-width here.
  const resolvedBands: PlotAreaBand[] = [];
  for (const band of bandsInput) {
    const rawA = band.range[0];
    const rawB = band.range[1];
    if (!Number.isFinite(rawA) || !Number.isFinite(rawB)) {
      warnings.push(
        `[band.out-of-domain] band at ${band.axis} [${rawA}, ${rawB}]: non-finite bounds`,
      );
      continue;
    }
    if (rawA === rawB) {
      warnings.push(
        `[band.zero-width] band at ${band.axis} [${rawA}, ${rawA}]: zero-width; use a reference line instead`,
      );
      continue;
    }
    const lo = Math.min(rawA, rawB);
    const hi = Math.max(rawA, rawB);
    const domain = band.axis === "x" ? xAxis.domain : yAxis.domain;
    const dMin = Math.min(domain[0], domain[1]);
    const dMax = Math.max(domain[0], domain[1]);
    if (hi < dMin || lo > dMax) {
      warnings.push(
        `[band.out-of-domain] band at ${band.axis} [${lo}, ${hi}]: range entirely outside visible domain`,
      );
      continue;
    }
    resolvedBands.push(band);
  }

  // ---- references validation (compute-level) -----------------------------
  const seenRefIds = new Set<string>();
  const resolvedReferences: PlotAreaReferenceLine[] = [];
  for (const ref of referencesInput) {
    const idLabel = ref.id ?? `#${resolvedReferences.length}`;
    if (ref.id != null && seenRefIds.has(ref.id)) {
      warnings.push(
        `[reference.duplicate-id] reference "${ref.id}": duplicate id; later entries override envelope lookup`,
      );
    }
    if (ref.id != null) seenRefIds.add(ref.id);
    if (ref.kind === "horizontal") {
      if (!Number.isFinite(ref.y)) {
        warnings.push(
          `[reference.degenerate] reference horizontal "${idLabel}": non-finite y`,
        );
        continue;
      }
      const [yMin, yMax] = yAxis.domain;
      if (ref.y < Math.min(yMin, yMax) || ref.y > Math.max(yMin, yMax)) {
        warnings.push(
          `[reference.out-of-domain] reference horizontal "${idLabel}": y=${ref.y} outside visible domain`,
        );
        continue;
      }
    } else if (ref.kind === "vertical") {
      if (!Number.isFinite(ref.x)) {
        warnings.push(
          `[reference.degenerate] reference vertical "${idLabel}": non-finite x`,
        );
        continue;
      }
      const [xMin, xMax] = xAxis.domain;
      if (ref.x < Math.min(xMin, xMax) || ref.x > Math.max(xMin, xMax)) {
        warnings.push(
          `[reference.out-of-domain] reference vertical "${idLabel}": x=${ref.x} outside visible domain`,
        );
        continue;
      }
    } else {
      // diagonal: degenerate if from === to or non-finite
      const [fx, fy] = ref.from;
      const [tx, ty] = ref.to;
      if (
        !Number.isFinite(fx) ||
        !Number.isFinite(fy) ||
        !Number.isFinite(tx) ||
        !Number.isFinite(ty) ||
        (fx === tx && fy === ty)
      ) {
        warnings.push(
          `[reference.degenerate] reference diagonal "${idLabel}": degenerate definition`,
        );
        continue;
      }
      // Diagonal plot-area intersection check delegated to the primitive
      // (requires plotArea dimensions, which the compute doesn't own).
    }
    resolvedReferences.push(ref);
  }

  // ---- envelopes ---------------------------------------------------------
  // Convert reference inputs to data-space geometries the envelope compute
  // understands. Use only resolved references (validated above).
  const envelopeReferences: EnvelopeReferenceGeometry[] = [];
  for (const r of resolvedReferences) {
    if (r.id == null) continue; // envelope targetability requires an id
    if (r.kind === "horizontal") {
      envelopeReferences.push({ id: r.id, kind: "horizontal", y: r.y });
    } else if (r.kind === "vertical") {
      envelopeReferences.push({ id: r.id, kind: "vertical" });
    } else {
      envelopeReferences.push({
        id: r.id,
        kind: "diagonal",
        from: r.from,
        to: r.to,
      });
    }
  }
  // Track which series had point drops so envelopes referencing them can
  // emit [envelope.truncated].
  const truncatedSeriesIds = new Set<string>();
  for (const s of seriesInput) {
    const w = working.find((ww) => ww.id === s.id);
    if (w && w.raw.length < s.points.length) {
      truncatedSeriesIds.add(s.id);
    }
  }
  // Pass all known series (including those with <2 points) so the envelope
  // compute can distinguish unknown-id from insufficient-points.
  const envelopeInputSeries = working.map((w) => ({
    id: w.id,
    points: w.raw.map((p) => ({ x: p.x, y: p.y })),
  }));
  const envelopeResult = computeEnvelopes({
    envelopes: envelopesInput,
    workingSeries: envelopeInputSeries,
    references: envelopeReferences,
    defaultFill: DEFAULT_ENVELOPE_FILL,
  });
  warnings.push(...envelopeResult.warnings);

  // Emit [envelope.truncated] for every resolved envelope whose source
  // series had dropped points.
  for (const env of envelopesInput) {
    if (env.show === false) continue;
    const sourceIds: string[] = [];
    if (env.kind === "series-pair") sourceIds.push(env.seriesAId, env.seriesBId);
    else if (env.kind === "center-offset") sourceIds.push(env.centerSeriesId);
    else if (env.kind === "series-to-reference") sourceIds.push(env.seriesId);
    for (const sid of sourceIds) {
      if (truncatedSeriesIds.has(sid)) {
        const label = env.id ?? "?";
        warnings.push(
          `[envelope.truncated] envelope "${label}": source series "${sid}" had point(s) dropped by validation`,
        );
        break;
      }
    }
  }

  // ---- axis models --------------------------------------------------------
  const xAxisModel: LineChartAxisModel = {
    label: xAxisLabel,
    domain: xAxis.domain,
    ticks: xAxis.ticks,
    tickLabels: xAxis.ticks.map(xTickFormat),
  };
  const yAxisModel: LineChartAxisModel = {
    label: yAxisLabel,
    domain: yAxis.domain,
    ticks: yAxis.ticks,
    tickLabels: yAxis.ticks.map(yTickFormat),
  };
  const y2AxisModel: LineChartAxisModel | null = dualYAxis ? { ...yAxisModel } : null;

  // ---- accessible label ---------------------------------------------------
  // Composition order per spec: visible series → bands → references → envelopes.
  // Count only resolved (post-validation) bands/references so screen readers
  // match the visible output.
  const labelledBands = resolvedBands.filter((b) => b.label != null);
  const labelledRefs = resolvedReferences.filter((r) => r.label != null);
  const envelopeCount = envelopeResult.models.length;
  const bandNoun = labelledBands.length === 1 ? "band" : "bands";
  const refNoun = labelledRefs.length === 1 ? "reference" : "references";
  const envNoun = envelopeCount === 1 ? "envelope" : "envelopes";
  let accessibleLabel =
    `Line chart: ${visibleSeriesCount} series` +
    (hasHighlighting ? `, ${highlightSet.size} highlighted` : "") +
    (trendlines || seriesModels.some((s) => s.trendline) ? ", with trendline(s)" : "");
  if (labelledBands.length > 0) {
    accessibleLabel +=
      `. ${labelledBands.length} ${bandNoun}: ` +
      labelledBands.map((b) => b.label).join(", ");
  }
  if (labelledRefs.length > 0) {
    accessibleLabel +=
      `. ${labelledRefs.length} ${refNoun}: ` +
      labelledRefs.map((r) => r.label).join(", ");
  }
  if (envelopeCount > 0) {
    accessibleLabel += `. ${envelopeCount} ${envNoun}`;
  }

  return {
    meta: {
      component: "LineChart",
      empty: false,
      totalSeries,
      dataSeries: dataSeriesCount,
      visibleSeries: visibleSeriesCount,
      highlightedSeries: hasHighlighting ? highlightSet.size : visibleSeriesCount,
      totalPoints,
      droppedPoints,
      warnings,
      accessibleLabel,
    },
    layout: {
      viewBox: { width: VIEWBOX_W, height: VIEWBOX_H },
      plotArea,
      frame,
    },
    axes: {
      x: xAxisModel,
      y: yAxisModel,
      y2: y2AxisModel,
    },
    series: seriesModels,
    endLabels,
    bands: resolvedBands,
    references: resolvedReferences,
    envelopes: envelopeResult.models,
    emptyState: null,
  };
}

// ---------------------------------------------------------------------------
// Empty model
// ---------------------------------------------------------------------------

function emptyModel(totalSeries: number, warnings: string[]): LineChartModel {
  const plotArea = {
    x: MARGIN.left,
    y: MARGIN.top,
    width: VIEWBOX_W - MARGIN.left - MARGIN.right,
    height: PLOT_H,
  };
  // Empty-state ticks are placeholders; use empty labels so consumers who
  // pass a custom tickFormat don't see locale-formatted stubs leak through.
  const axis: LineChartAxisModel = {
    label: "",
    domain: [0, 1],
    ticks: [0, 0.5, 1],
    tickLabels: ["", "", ""],
  };
  return {
    meta: {
      component: "LineChart",
      empty: true,
      totalSeries,
      dataSeries: 0,
      visibleSeries: 0,
      highlightedSeries: 0,
      totalPoints: 0,
      droppedPoints: 0,
      warnings,
      accessibleLabel: "Line chart: no data",
    },
    layout: {
      viewBox: { width: VIEWBOX_W, height: VIEWBOX_H },
      plotArea,
      frame: plotArea,
    },
    axes: {
      x: axis,
      y: axis,
      y2: null,
    },
    series: [],
    endLabels: [],
    bands: [],
    references: [],
    envelopes: [],
    emptyState: { message: "No data" },
  };
}
