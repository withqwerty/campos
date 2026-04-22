import { formatNumericTick } from "./scales/format-number.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RadarChartRow = {
  metric: string;
  value: number;
  min?: number;
  max?: number;
  percentile?: number;
  category?: string;
  lowerIsBetter?: boolean;
  displayValue?: string;
};

/**
 * Multi-profile comparison input. Each series is one overlaid polygon
 * (e.g. two players being compared). For the single-profile case, prefer
 * passing `rows` directly on `ComputeRadarChartInput` as shorthand — it is
 * wrapped internally as a one-series input.
 *
 * All series should share the same metric set and order; mismatches emit
 * a warning and the first series's metric set becomes the source of truth
 * for axis layout and range ticks.
 */
export type RadarChartSeriesInput = {
  id: string;
  label?: string;
  rows: readonly RadarChartRow[];
  /** Optional explicit fill/stroke colour; overrides the palette pick. */
  color?: string;
};

export type RadarChartVertexModel = {
  index: number;
  metric: string;
  normalizedValue: number; // 0..1 after normalization
  displayValue: string;
  rawValue: number;
  category: string;
  angle: number; // radians (math convention, -π/2 = 12 o'clock)
  x: number; // SVG coordinates
  y: number;
  // Per-axis range metadata. Populated in range mode; null in percentile mode
  // (where the range is implicitly 0..100).
  rangeMin: number | null;
  rangeMax: number | null;
  displayRangeMin: string | null;
  displayRangeMax: string | null;
  lowerIsBetter: boolean;
};

export type RadarChartPolygonModel = {
  /** Stable identity for this series (e.g. "garnacho"). */
  seriesId: string;
  /** Human-readable label (e.g. "Alejandro Garnacho"). May be empty. */
  seriesLabel: string;
  vertices: RadarChartVertexModel[];
  fillColor: string;
  strokeColor: string;
  path: string; // pre-computed SVG path
};

export type RadarChartAxisTickModel = {
  value: string; // display label
  x: number;
  y: number;
  normalizedPosition: number; // 0..1
};

export type RadarChartAxisModel = {
  index: number;
  metric: string;
  category: string;
  /**
   * Category color for this axis label. Non-null only when 2+ distinct
   * categories are present (i.e. when the category legend is emitted);
   * renderers should fall back to the theme's default label color when null.
   */
  color: string | null;
  angle: number;
  sliceAngle: number;
  labelRadius: number;
  flip: boolean;
  // Spoke line endpoints
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // Per-spoke tick labels (populated in range mode)
  ticks: RadarChartAxisTickModel[];
};

export type RadarChartRingModel = {
  radius: number; // px
  value: number; // 0..1 normalized
  label: string | null;
};

export type RadarChartBandModel = {
  innerRadius: number;
  outerRadius: number;
  color: string;
};

export type RadarChartLegendItem = {
  key: string;
  label: string;
  color: string;
};

export type RadarChartLegendModel = {
  items: RadarChartLegendItem[];
};

export type RadarChartModel = {
  meta: {
    component: "RadarChart";
    empty: boolean;
    totalRows: number;
    validRows: number;
    warnings: string[];
    accessibleLabel: string;
  };

  geometry: {
    viewBoxSize: number;
    center: number;
    outerRadius: number;
  };

  /**
   * One polygon per input series. Empty when no valid data was supplied.
   * For single-profile input, this is a one-element array — renderers should
   * iterate rather than assuming a unique polygon.
   */
  polygons: RadarChartPolygonModel[];
  axes: RadarChartAxisModel[];
  rings: RadarChartRingModel[];
  bands: RadarChartBandModel[];
  /**
   * Optional second band layer rendered full-circle beneath the clipped
   * bands when `ringStyle === "banded-inside-polygon"` and
   * `outerRingColors` is supplied. Empty array otherwise.
   */
  outerBands: RadarChartBandModel[];

  /**
   * Category legend (when 2+ metric categories are present).
   */
  legend: RadarChartLegendModel | null;
  /**
   * Series legend (when 2+ series are supplied and at least one has a label).
   * Separate from `legend` — consumers may render both.
   */
  seriesLegend: RadarChartLegendModel | null;
  emptyState: { message: string } | null;
};

export type ComputeRadarChartInput = {
  /**
   * Single-profile shorthand. Equivalent to
   * `series: [{ id: "default", rows }]`. Use `series` for 2+ profiles.
   */
  rows?: readonly RadarChartRow[];
  /** Multi-profile input. One entry per overlaid polygon. */
  series?: readonly RadarChartSeriesInput[];
  metricOrder?: readonly string[];
  categoryOrder?: readonly string[];
  valueMode?: "percentile" | "range";
  showLegend?: boolean;
  showVertexMarkers?: boolean;
  showAxisLabels?: boolean;
  ringStyle?: "line" | "banded" | "banded-inside-polygon";
  ringSteps?: readonly number[];
  bandSteps?: readonly number[];
  ringColors?: readonly string[];
  /**
   * Optional full-circle background band palette used when
   * `ringStyle === "banded-inside-polygon"`. When provided, a second band
   * layer renders beneath the polygon-clipped bands, using these colours.
   * This reproduces the classic StatsBomb look where the whole chart has
   * alternating grey rings and the polygon itself has contrasting bands.
   */
  outerRingColors?: readonly string[];
  categoryColors?: readonly string[];
  /**
   * Palette used to auto-assign a fill colour to each series (in input
   * order) when a series doesn't supply an explicit `color`. Defaults to a
   * blue / red / green comparison palette.
   */
  seriesColors?: readonly string[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEWBOX_SIZE = 400;
const CENTER = VIEWBOX_SIZE / 2;
const OUTER_RADIUS = 140;
const LABEL_RADIUS = OUTER_RADIUS + 10;
const START_ANGLE = -Math.PI / 2;

/** Fallback palette for auto-colouring series without explicit colours. */
const DEFAULT_SERIES_PALETTE = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#a855f7", // purple
  "#f59e0b", // amber
];
const DEFAULT_RING_STEPS = [0.05, 0.25, 0.5, 0.75, 0.95];
// Banded styles read best with evenly-spaced rings at a higher granularity
// than the tick-style default — this gives the classic scouting-radar look
// (~10 alternating bands) without forcing every caller to override.
const DEFAULT_BANDED_RING_STEPS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const DEFAULT_BAND_COLORS = [
  "rgba(0,0,0,0.04)",
  "rgba(0,0,0,0.02)",
  "rgba(0,0,0,0.04)",
  "rgba(0,0,0,0.02)",
];

/** Default 3-category football scouting palette: attacking, possession, defending */
const DEFAULT_CATEGORY_PALETTE = [
  "#3b82f6", // blue — attacking
  "#22c55e", // green — possession
  "#f59e0b", // amber — defending
  "#ef4444", // red — extra category 1
  "#a855f7", // purple — extra category 2
  "#06b6d4", // cyan — extra category 3
];

const UNCATEGORIZED = "Uncategorized";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidRow(row: RadarChartRow): boolean {
  return (
    typeof row.metric === "string" &&
    row.metric.length > 0 &&
    typeof row.value === "number" &&
    Number.isFinite(row.value)
  );
}

function roundCoord(value: number): number {
  return Number(value.toFixed(4));
}

function polarToCartesian(
  angle: number,
  radius: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  return {
    x: roundCoord(cx + radius * Math.cos(angle)),
    y: roundCoord(cy + radius * Math.sin(angle)),
  };
}

function normalizeValue(row: RadarChartRow, valueMode: "percentile" | "range"): number {
  if (valueMode === "percentile") {
    const p = row.percentile ?? row.value;
    const clamped = Math.max(0, Math.min(100, p));
    const normalized = clamped / 100;
    return row.lowerIsBetter ? 1 - normalized : normalized;
  }

  // Range mode: normalize between min and max
  const min = row.min ?? 0;
  const max = row.max ?? 100;
  if (max === min) return 0.5;
  const normalized = Math.max(0, Math.min(1, (row.value - min) / (max - min)));
  return row.lowerIsBetter ? 1 - normalized : normalized;
}

function formatValue(row: RadarChartRow): string {
  if (row.displayValue != null) return row.displayValue;
  if (Number.isInteger(row.value)) return String(row.value);
  return row.value.toFixed(2);
}

function polygonPath(vertices: Array<{ x: number; y: number }>): string {
  if (vertices.length === 0) return "";
  const first = vertices[0];
  if (!first) return "";
  const parts = [`M ${roundCoord(first.x)} ${roundCoord(first.y)}`];
  for (let i = 1; i < vertices.length; i++) {
    const v = vertices[i];
    if (v) parts.push(`L ${roundCoord(v.x)} ${roundCoord(v.y)}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

/** Normalise the input into a series[] array. */
function resolveSeries(input: ComputeRadarChartInput): {
  series: RadarChartSeriesInput[];
  warnings: string[];
} {
  const warnings: string[] = [];
  if (input.series != null && input.rows != null) {
    warnings.push(
      "Both `rows` and `series` were supplied; `series` takes precedence. Pass one, not both.",
    );
  }
  if (input.series != null) {
    return { series: [...input.series], warnings };
  }
  if (input.rows != null) {
    return {
      series: [{ id: "default", label: "", rows: input.rows }],
      warnings,
    };
  }
  return { series: [], warnings };
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

export function computeRadarChart(input: ComputeRadarChartInput): RadarChartModel {
  const {
    metricOrder,
    categoryOrder,
    valueMode = "percentile",
    showLegend,
    // showVertexMarkers — consumed by renderer
    showAxisLabels = true,
    ringStyle = "line",
    bandSteps,
    ringColors = DEFAULT_BAND_COLORS,
    categoryColors = DEFAULT_CATEGORY_PALETTE,
    seriesColors = DEFAULT_SERIES_PALETTE,
  } = input;
  // Per-ringStyle default granularity. Line-style keeps the original
  // tick-label spacing; banded styles pick a denser evenly-spaced default
  // so the rings read as a clean scouting-radar target.
  const ringSteps =
    input.ringSteps ??
    (ringStyle === "banded" || ringStyle === "banded-inside-polygon"
      ? DEFAULT_BANDED_RING_STEPS
      : DEFAULT_RING_STEPS);

  const { series: rawSeries, warnings: inputWarnings } = resolveSeries(input);
  const warnings: string[] = [...inputWarnings];

  // ---- gather totals for meta ---------------------------------------------
  const totalRows = rawSeries.reduce((n, s) => n + s.rows.length, 0);

  if (rawSeries.length === 0 || totalRows === 0) {
    return emptyModel(totalRows);
  }

  // ---- validate each series and keep rows in metric order ------------------
  const seriesValidRows = rawSeries.map((s) => {
    const valid = s.rows.filter(isValidRow);
    const invalid = s.rows.length - valid.length;
    if (invalid > 0) {
      warnings.push(
        `${s.label || s.id}: ${invalid} row(s) excluded (missing metric or non-finite value)`,
      );
    }
    return valid;
  });

  const anyValid = seriesValidRows.some((rows) => rows.length > 0);
  if (!anyValid) {
    return emptyModel(totalRows);
  }

  const orderMap =
    metricOrder && metricOrder.length > 0
      ? new Map(metricOrder.map((m, i) => [m, i]))
      : null;

  function orderRows(validRows: RadarChartRow[]): RadarChartRow[] {
    if (orderMap) {
      return [...validRows].sort((a, b) => {
        const ai = orderMap.get(a.metric) ?? Infinity;
        const bi = orderMap.get(b.metric) ?? Infinity;
        return ai - bi;
      });
    }
    return [...validRows];
  }

  const orderedBySeries = seriesValidRows.map(orderRows);

  // ---- axis source: the first non-empty series establishes axes -----------
  const primaryRowsIndex = orderedBySeries.findIndex((rows) => rows.length > 0);
  const primaryRows = orderedBySeries[primaryRowsIndex]!;
  const primaryMetrics = primaryRows.map((r) => r.metric);

  // Warn if any other series diverges from the primary metric set
  for (let si = 0; si < orderedBySeries.length; si++) {
    if (si === primaryRowsIndex) continue;
    const otherMetrics = orderedBySeries[si]!.map((r) => r.metric);
    if (
      otherMetrics.length !== primaryMetrics.length ||
      otherMetrics.some((m, i) => m !== primaryMetrics[i])
    ) {
      const label = rawSeries[si]!.label || rawSeries[si]!.id;
      warnings.push(
        `Series "${label}" has a different metric set from the primary series; missing metrics render at 0.`,
      );
    }
  }

  if (primaryRows.length === 1) {
    warnings.push("Single metric — cannot render a polygon");
  }

  if (primaryRows.length < 3) {
    warnings.push(`Only ${primaryRows.length} metrics — radar may not be informative`);
  }

  if (primaryRows.length > 16) {
    warnings.push(
      `${primaryRows.length} metrics is dense — consider reducing for readability`,
    );
  }

  if (valueMode === "percentile") {
    const missingCounts: string[] = [];
    for (let si = 0; si < orderedBySeries.length; si++) {
      const missing = orderedBySeries[si]!.filter(
        (r) => r.percentile == null || !Number.isFinite(r.percentile),
      );
      if (missing.length > 0) {
        const label = rawSeries[si]!.label || rawSeries[si]!.id;
        const sample = missing
          .slice(0, 3)
          .map((r) => r.metric)
          .join(", ");
        const suffix = missing.length > 3 ? `, +${missing.length - 3} more` : "";
        missingCounts.push(
          `${label}: ${missing.length} missing percentile (${sample}${suffix})`,
        );
      }
    }
    if (missingCounts.length > 0) {
      warnings.push(
        `valueMode="percentile" but some rows have no percentile; raw value treated as 0–100 percentile (${missingCounts.join("; ")})`,
      );
    }
  }

  // ---- resolve categories (from primary) -----------------------------------
  const uniqueCategories = [
    ...new Set(primaryRows.map((r) => r.category ?? UNCATEGORIZED)),
  ];
  const orderedCategories = categoryOrder
    ? [...uniqueCategories].sort((a, b) => {
        const ai = categoryOrder.indexOf(a);
        const bi = categoryOrder.indexOf(b);
        return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
      })
    : uniqueCategories;

  const categoryColorMap = new Map<string, string>();
  for (let i = 0; i < orderedCategories.length; i++) {
    const cat = orderedCategories[i];
    const color = categoryColors[i % categoryColors.length];
    if (cat != null && color != null) {
      categoryColorMap.set(cat, color);
    }
  }

  // ---- compute angles -------------------------------------------------------
  const n = primaryRows.length;
  const sliceAngle = (2 * Math.PI) / n;

  // ---- build polygon vertices for each series ------------------------------
  // When a series is missing a metric from the primary set, we still place a
  // vertex at zero so the polygon closes — better than a partial polygon.
  function buildVertexForSlot(
    orderedRows: RadarChartRow[],
    primaryRow: RadarChartRow,
    slotIndex: number,
  ): RadarChartVertexModel {
    const match = orderedRows.find((r) => r.metric === primaryRow.metric) ?? null;
    const row = match ?? {
      ...primaryRow,
      value: 0,
      displayValue: "—",
      percentile: 0,
    };
    const angle = START_ANGLE + slotIndex * sliceAngle;
    const norm = match ? normalizeValue(row, valueMode) : 0;
    const r = norm * OUTER_RADIUS;
    const pos = polarToCartesian(angle, r, CENTER, CENTER);
    const rangeMin = valueMode === "range" ? (row.min ?? 0) : null;
    const rangeMax = valueMode === "range" ? (row.max ?? 100) : null;
    return {
      index: slotIndex,
      metric: primaryRow.metric,
      normalizedValue: norm,
      displayValue: match ? formatValue(row) : "—",
      rawValue: match ? row.value : 0,
      category: row.category ?? UNCATEGORIZED,
      angle,
      x: pos.x,
      y: pos.y,
      rangeMin,
      rangeMax,
      displayRangeMin: rangeMin != null ? formatNumericTick(rangeMin) : null,
      displayRangeMax: rangeMax != null ? formatNumericTick(rangeMax) : null,
      lowerIsBetter: row.lowerIsBetter === true,
    };
  }

  const polygons: RadarChartPolygonModel[] = rawSeries.map((rawSpec, si) => {
    const orderedRows = orderedBySeries[si]!;
    const vertices: RadarChartVertexModel[] = primaryRows.map((pRow, slotIndex) =>
      buildVertexForSlot(orderedRows, pRow, slotIndex),
    );
    const palette = seriesColors;
    const paletteColor =
      palette[si % palette.length] ?? DEFAULT_SERIES_PALETTE[0] ?? "#3b82f6";
    const color = rawSpec.color ?? paletteColor;
    return {
      seriesId: rawSpec.id,
      seriesLabel: rawSpec.label ?? "",
      vertices,
      fillColor: color,
      strokeColor: color,
      path: polygonPath(vertices),
    };
  });

  // ---- axes (spokes + labels) ----------------------------------------------
  // Axis ticks in range mode come from the primary series (first with data).
  // Per-axis range assumptions: min/max come from the primary row.
  const axes: RadarChartAxisModel[] = showAxisLabels
    ? primaryRows.map((row, i) => {
        const angle = START_ANGLE + i * sliceAngle;
        const inner = polarToCartesian(angle, 0, CENTER, CENTER);
        const outer = polarToCartesian(angle, OUTER_RADIUS, CENTER, CENTER);
        const degFromTop = ((((angle * 180) / Math.PI + 90) % 360) + 360) % 360;
        // Per-spoke ticks for range mode
        const ticks: RadarChartAxisTickModel[] = [];
        if (valueMode === "range") {
          const min = row.min ?? 0;
          const max = row.max ?? 100;
          // Skip the innermost ring — tick labels converge near center
          for (const step of ringSteps.slice(1)) {
            const rawVal = row.lowerIsBetter
              ? max - step * (max - min)
              : min + step * (max - min);
            const tickPos = polarToCartesian(angle, step * OUTER_RADIUS, CENTER, CENTER);
            ticks.push({
              value: formatNumericTick(rawVal),
              x: tickPos.x,
              y: tickPos.y,
              normalizedPosition: step,
            });
          }
        }

        const cat = row.category ?? UNCATEGORIZED;
        const axisColor =
          orderedCategories.length > 1 ? (categoryColorMap.get(cat) ?? null) : null;
        return {
          index: i,
          metric: row.metric,
          category: cat,
          color: axisColor,
          angle,
          sliceAngle,
          labelRadius: LABEL_RADIUS,
          flip: degFromTop > 90 && degFromTop < 270,
          x1: inner.x,
          y1: inner.y,
          x2: outer.x,
          y2: outer.y,
          ticks,
        };
      })
    : [];

  // ---- rings ----------------------------------------------------------------
  const rings: RadarChartRingModel[] = ringSteps.map((step) => ({
    radius: step * OUTER_RADIUS,
    value: step,
    label: valueMode === "percentile" ? String(Math.round(step * 100)) : null,
  }));

  // ---- bands (for banded ring styles) ---------------------------------------
  const bands: RadarChartBandModel[] = [];
  if (ringStyle === "banded" || ringStyle === "banded-inside-polygon") {
    const bSteps = bandSteps ?? ringSteps;
    const steps = [0, ...bSteps, 1];
    for (let i = 0; i < steps.length - 1; i++) {
      const inner = (steps[i] ?? 0) * OUTER_RADIUS;
      const outer = (steps[i + 1] ?? 1) * OUTER_RADIUS;
      const color =
        ringColors[i % ringColors.length] ?? DEFAULT_BAND_COLORS[0] ?? "rgba(0,0,0,0.03)";
      bands.push({ innerRadius: inner, outerRadius: outer, color });
    }
  }

  // ---- outer bands (full-circle background layer) --------------------------
  const outerBands: RadarChartBandModel[] = [];
  if (ringStyle === "banded-inside-polygon" && input.outerRingColors != null) {
    const bSteps = bandSteps ?? ringSteps;
    const steps = [0, ...bSteps, 1];
    const palette = input.outerRingColors;
    for (let i = 0; i < steps.length - 1; i++) {
      const inner = (steps[i] ?? 0) * OUTER_RADIUS;
      const outer = (steps[i + 1] ?? 1) * OUTER_RADIUS;
      const color =
        palette[i % palette.length] ?? DEFAULT_BAND_COLORS[0] ?? "rgba(0,0,0,0.03)";
      outerBands.push({ innerRadius: inner, outerRadius: outer, color });
    }
  }

  // ---- category legend -----------------------------------------------------
  let legend: RadarChartLegendModel | null = null;
  const shouldShowCategoryLegend = showLegend ?? orderedCategories.length > 1;
  if (shouldShowCategoryLegend && orderedCategories.length > 1) {
    legend = {
      items: orderedCategories.map((cat) => ({
        key: cat,
        label: cat,
        color: categoryColorMap.get(cat) ?? "#3b82f6",
      })),
    };
  }

  // ---- series legend -------------------------------------------------------
  // Emitted when 2+ series are supplied and at least one carries a label.
  // Separate from the category legend so renderers can stack them.
  let seriesLegend: RadarChartLegendModel | null = null;
  const shouldShowSeriesLegend =
    (showLegend ?? polygons.length > 1) &&
    polygons.length > 1 &&
    polygons.some((p) => p.seriesLabel.length > 0);
  if (shouldShowSeriesLegend) {
    seriesLegend = {
      items: polygons.map((p) => ({
        key: p.seriesId,
        label: p.seriesLabel || p.seriesId,
        color: p.fillColor,
      })),
    };
  }

  // ---- accessible label ----------------------------------------------------
  const accessibleLabel =
    polygons.length > 1
      ? `Radar chart: ${polygons.length} profiles across ${n} metrics`
      : `Radar chart: ${n} metrics`;

  return {
    meta: {
      component: "RadarChart",
      empty: false,
      totalRows,
      validRows: seriesValidRows.reduce((acc, rs) => acc + rs.length, 0),
      warnings,
      accessibleLabel,
    },
    geometry: {
      viewBoxSize: VIEWBOX_SIZE,
      center: CENTER,
      outerRadius: OUTER_RADIUS,
    },
    polygons,
    axes,
    rings,
    bands,
    outerBands,
    legend,
    seriesLegend,
    emptyState: null,
  };
}

// ---------------------------------------------------------------------------
// Empty model
// ---------------------------------------------------------------------------

function emptyModel(totalRows: number): RadarChartModel {
  return {
    meta: {
      component: "RadarChart",
      empty: true,
      totalRows,
      validRows: 0,
      warnings: [],
      accessibleLabel: "Radar chart: no profile data",
    },
    geometry: {
      viewBoxSize: VIEWBOX_SIZE,
      center: CENTER,
      outerRadius: OUTER_RADIUS,
    },
    polygons: [],
    axes: [],
    rings: [],
    bands: [],
    outerBands: [],
    legend: null,
    seriesLegend: null,
    emptyState: { message: "No profile data" },
  };
}
