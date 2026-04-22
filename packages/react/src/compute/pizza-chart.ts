// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PizzaChartRow = {
  metric: string;
  percentile: number;
  category?: string;
  rawValue?: number | string;
  displayValue?: string;
};

export type PizzaChartCenterContent = {
  kind: "image" | "crest" | "initials";
  src?: string;
  alt?: string;
  label?: string;
} | null;

export type PizzaChartGridRingStyle = {
  strokeWidth?: number;
  stroke?: string;
  strokeDasharray?: string;
};

export type PizzaChartReferenceSetInput = {
  label?: string;
  values: Record<string, number>;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
};

export type PizzaChartSliceModel = {
  index: number;
  metric: string;
  percentile: number;
  category: string;
  rawValue: string | number | null;
  displayValue: string;

  // Polar geometry (angles in radians, 0 = 12 o'clock, clockwise)
  startAngle: number;
  endAngle: number;
  midAngle: number;
  innerRadius: number; // fraction 0..1
  outerRadius: number; // fraction 0..1 (percentile / 100)

  // Colors
  fillColor: string;
};

export type PizzaChartLabelModel = {
  index: number; // matches slice index for hover linkage
  metric: string;
  angle: number; // midAngle in radians (math convention)
  sliceAngle: number; // angular width of this slice in radians
  radius: number; // label radius in px
  flip: boolean; // true if in bottom half (text path should reverse)
};

export type PizzaChartValueBadgeModel = {
  metric: string;
  text: string;
  angle: number;
  radius: number;
  x: number;
  y: number;
};

export type PizzaChartLegendItem = {
  key: string;
  label: string;
  color: string;
};

export type PizzaChartLegendModel = {
  items: PizzaChartLegendItem[];
};

export type PizzaChartTooltipModel = {
  metric: string;
  rows: Array<{ label: string; value: string }>;
};

export type PizzaChartSpokeModel = {
  angle: number; // radians
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type PizzaChartCategoryWashModel = {
  category: string;
  startAngle: number;
  endAngle: number;
  color: string;
};

export type PizzaChartGridRingModel = {
  percentile: number;
  radiusFraction: number;
};

export type PizzaChartReferenceArcModel = {
  metric: string;
  percentile: number;
  startAngle: number;
  endAngle: number;
  radius: number;
};

export type PizzaChartReferenceSetModel = {
  index: number;
  label: string | null;
  stroke: string | null;
  strokeWidth: number | null;
  strokeDasharray: string | null;
  arcs: PizzaChartReferenceArcModel[];
};

export type PizzaChartModel = {
  meta: {
    component: "PizzaChart";
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
    innerRadius: number;
    labelRadius: number;
  };

  slices: PizzaChartSliceModel[];

  spokes: PizzaChartSpokeModel[];
  categoryWashes: PizzaChartCategoryWashModel[];
  gridRings: PizzaChartGridRingModel[];
  referenceSets: PizzaChartReferenceSetModel[];

  labels: PizzaChartLabelModel[];
  valueBadges: PizzaChartValueBadgeModel[];

  legend: PizzaChartLegendModel | null;
  emptyState: { message: string } | null;

  centerContent: PizzaChartCenterContent;
};

export type ComputePizzaChartInput = {
  rows: readonly PizzaChartRow[];
  metricOrder?: readonly string[];
  categoryOrder?: readonly string[];
  showValueBadges?: boolean;
  showAxisLabels?: boolean;
  showLegend?: boolean;
  categoryColors?: readonly string[];
  centerContent?: PizzaChartCenterContent;
  gridRingStep?: number;
  referenceSets?: readonly PizzaChartReferenceSetInput[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEWBOX_SIZE = 400;
const CENTER = VIEWBOX_SIZE / 2;
const OUTER_RADIUS = 140;
const INNER_RADIUS_DEFAULT = OUTER_RADIUS * 0.18;
const INNER_RADIUS_IMAGE = OUTER_RADIUS * 0.28; // larger hole for portraits
const LABEL_RADIUS = OUTER_RADIUS + 10;

/** Angle where first metric sits (12 o'clock) in math convention. */
const START_ANGLE = -Math.PI / 2;

/** Extra gap between category groups, in radians. */
const CATEGORY_GAP = 0.04;

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

function isValidRow(row: PizzaChartRow): boolean {
  return (
    typeof row.metric === "string" &&
    row.metric.length > 0 &&
    typeof row.percentile === "number" &&
    Number.isFinite(row.percentile)
  );
}

function clampPercentile(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function roundCoord(value: number): number {
  return Number(value.toFixed(4));
}

/**
 * Convert polar coordinates (angle from 12 o'clock clockwise, radius as fraction)
 * to Cartesian SVG coordinates relative to center.
 */
function polarToCartesian(
  angleMath: number,
  radiusPx: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  return {
    x: roundCoord(cx + radiusPx * Math.cos(angleMath)),
    y: roundCoord(cy + radiusPx * Math.sin(angleMath)),
  };
}

function formatPercentile(p: number): string {
  const clamped = clampPercentile(p);
  return Math.round(clamped).toString();
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

export function computePizzaChart(input: ComputePizzaChartInput): PizzaChartModel {
  const {
    rows,
    metricOrder,
    categoryOrder,
    showValueBadges = true,
    showAxisLabels = true,
    showLegend,
    categoryColors = DEFAULT_CATEGORY_PALETTE,
    // sliceStroke — consumed by renderer, not core
    centerContent = null,
  } = input;

  const warnings: string[] = [];

  // Enlarge inner hole when center content needs space for a portrait
  const hasImage =
    centerContent != null &&
    (centerContent.kind === "image" || centerContent.kind === "crest");
  const INNER_RADIUS = hasImage ? INNER_RADIUS_IMAGE : INNER_RADIUS_DEFAULT;

  // ---- validate rows ------------------------------------------------------
  const validRows = rows.filter(isValidRow);
  const totalRows = rows.length;

  if (validRows.length === 0) {
    return emptyModel(totalRows, INNER_RADIUS, centerContent);
  }

  if (validRows.length < totalRows) {
    warnings.push(
      `${totalRows - validRows.length} row(s) excluded: missing metric name or non-finite percentile`,
    );
  }

  if (validRows.length === 1) {
    warnings.push("Single metric — radial layout may not be meaningful");
  }

  if (validRows.length < 4) {
    warnings.push(
      `Only ${validRows.length} metrics — radial layout may be visually weak`,
    );
  }

  if (validRows.length > 16) {
    warnings.push(
      `${validRows.length} metrics is dense — consider reducing template to 12-16 for readability`,
    );
  }

  // ---- order metrics ------------------------------------------------------
  let orderedRows: PizzaChartRow[];
  if (metricOrder && metricOrder.length > 0) {
    const orderMap = new Map(metricOrder.map((m, i) => [m, i]));
    orderedRows = [...validRows].sort((a, b) => {
      const ai = orderMap.get(a.metric) ?? Infinity;
      const bi = orderMap.get(b.metric) ?? Infinity;
      return ai - bi;
    });
  } else {
    orderedRows = [...validRows];
  }

  // ---- resolve categories -------------------------------------------------
  const categoryColorMap = new Map<string, string>();
  const uniqueCategories = [
    ...new Set(orderedRows.map((r) => r.category ?? UNCATEGORIZED)),
  ];

  // Respect category order if provided
  const orderedCategories = categoryOrder
    ? [...uniqueCategories].sort((a, b) => {
        const ai = categoryOrder.indexOf(a);
        const bi = categoryOrder.indexOf(b);
        return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
      })
    : uniqueCategories;

  for (let i = 0; i < orderedCategories.length; i++) {
    const cat = orderedCategories[i];
    const color = categoryColors[i % categoryColors.length];
    if (cat != null && color != null) {
      categoryColorMap.set(cat, color);
    }
  }

  // Re-sort by category group, preserving within-group order
  if (categoryOrder && categoryOrder.length > 0) {
    const catOrderMap = new Map(orderedCategories.map((c, i) => [c, i]));
    const stableIndex = new Map(orderedRows.map((r, i) => [r, i]));
    orderedRows = [...orderedRows].sort((a, b) => {
      const ca = catOrderMap.get(a.category ?? UNCATEGORIZED) ?? Infinity;
      const cb = catOrderMap.get(b.category ?? UNCATEGORIZED) ?? Infinity;
      if (ca !== cb) return ca - cb;
      return (stableIndex.get(a) ?? 0) - (stableIndex.get(b) ?? 0);
    });
  }

  // ---- compute slice angles -----------------------------------------------
  const n = orderedRows.length;
  const categoryBoundaries = computeCategoryBoundaries(orderedRows);
  const numGaps = categoryBoundaries.length;
  const totalGapAngle = numGaps * CATEGORY_GAP;
  const availableAngle = 2 * Math.PI - totalGapAngle;
  const sliceAngle = availableAngle / n;

  let currentAngle = START_ANGLE;
  let prevCategory = orderedRows[0]?.category ?? UNCATEGORIZED;

  const slices: PizzaChartSliceModel[] = [];
  const labels: PizzaChartLabelModel[] = [];
  const valueBadges: PizzaChartValueBadgeModel[] = [];

  for (let i = 0; i < n; i++) {
    const row = orderedRows[i];
    if (!row) continue;
    const cat = row.category ?? UNCATEGORIZED;

    // Add category gap
    if (i > 0 && cat !== prevCategory) {
      currentAngle += CATEGORY_GAP;
    }
    prevCategory = cat;

    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    const midAngle = (startAngle + endAngle) / 2;

    const percentile = clampPercentile(row.percentile);
    const innerR = INNER_RADIUS / OUTER_RADIUS;
    const outerR = innerR + (1 - innerR) * (percentile / 100);

    const fillColor = categoryColorMap.get(cat) ?? "#3b82f6";

    const displayValue = row.displayValue ?? formatPercentile(percentile);

    const slice: PizzaChartSliceModel = {
      index: i,
      metric: row.metric,
      percentile,
      category: cat,
      rawValue: row.rawValue ?? null,
      displayValue,
      startAngle,
      endAngle,
      midAngle,
      innerRadius: innerR,
      outerRadius: outerR,
      fillColor,
    };
    slices.push(slice);

    // Labels
    if (showAxisLabels) {
      // Determine if this label is in the "bottom half" of the clock
      // (left side of circle in math convention) and needs path reversal
      const degFromTop = ((((midAngle * 180) / Math.PI + 90) % 360) + 360) % 360;
      const flip = degFromTop > 90 && degFromTop < 270;

      labels.push({
        index: i,
        metric: row.metric,
        angle: midAngle,
        sliceAngle,
        radius: LABEL_RADIUS,
        flip,
      });
    }

    // Value badges — positioned inside the bar, near the tip
    if (showValueBadges && percentile > 0) {
      const badgeR = innerR + (1 - innerR) * (percentile / 100);
      // Place badge inside the bar: offset inward from tip
      const badgePx = Math.max(INNER_RADIUS + 10, badgeR * OUTER_RADIUS - 10);
      const badgePos = polarToCartesian(midAngle, badgePx, CENTER, CENTER);
      valueBadges.push({
        metric: row.metric,
        text: displayValue,
        angle: midAngle,
        radius: badgeR,
        x: badgePos.x,
        y: badgePos.y,
      });
    }

    currentAngle = endAngle;
  }

  // ---- legend -------------------------------------------------------------
  // Default: auto-show when 2+ categories are present. An explicit `showLegend`
  // (true or false) overrides the default unconditionally, even in the degenerate
  // single-category case — the legend will have one item, which is the caller's
  // prerogative.
  let legend: PizzaChartLegendModel | null = null;
  const shouldShowLegend = showLegend ?? orderedCategories.length > 1;

  if (shouldShowLegend && orderedCategories.length > 0) {
    legend = {
      items: orderedCategories.map((cat) => ({
        key: cat,
        label: cat,
        color: categoryColorMap.get(cat) ?? "#3b82f6",
      })),
    };
  }

  // ---- spokes (divider lines between slices) --------------------------------
  const spokes: PizzaChartSpokeModel[] = [];
  for (const slice of slices) {
    const inner = polarToCartesian(slice.startAngle, INNER_RADIUS, CENTER, CENTER);
    const outer = polarToCartesian(slice.startAngle, OUTER_RADIUS, CENTER, CENTER);
    spokes.push({
      angle: slice.startAngle,
      x1: inner.x,
      y1: inner.y,
      x2: outer.x,
      y2: outer.y,
    });
  }
  // Close the last spoke
  const lastSlice = slices[slices.length - 1];
  if (lastSlice) {
    const inner = polarToCartesian(lastSlice.endAngle, INNER_RADIUS, CENTER, CENTER);
    const outer = polarToCartesian(lastSlice.endAngle, OUTER_RADIUS, CENTER, CENTER);
    spokes.push({
      angle: lastSlice.endAngle,
      x1: inner.x,
      y1: inner.y,
      x2: outer.x,
      y2: outer.y,
    });
  }

  // ---- category wash sections -----------------------------------------------
  const categoryWashes: PizzaChartCategoryWashModel[] = [];
  if (orderedCategories.length > 1) {
    let washStart = slices[0]?.startAngle ?? START_ANGLE;
    let washCat = slices[0]?.category ?? UNCATEGORIZED;

    for (let i = 1; i <= slices.length; i++) {
      const curr = slices[i];
      if (i === slices.length || (curr && curr.category !== washCat)) {
        const prev = slices[i - 1];
        if (prev) {
          categoryWashes.push({
            category: washCat,
            startAngle: washStart,
            endAngle: prev.endAngle,
            color: categoryColorMap.get(washCat) ?? "#3b82f6",
          });
        }
        if (curr) {
          washStart = curr.startAngle;
          washCat = curr.category;
        }
      }
    }
  }

  // ---- grid rings ----------------------------------------------------------
  // Guard against zero/negative/non-finite gridRingStep — those cause an
  // infinite loop because `pct += step` never reaches the `<= 100` exit.
  const requestedGridRingStep = input.gridRingStep ?? 25;
  let gridRingStep = requestedGridRingStep;
  if (!(Number.isFinite(gridRingStep) && gridRingStep > 0)) {
    warnings.push(
      `gridRingStep must be a positive finite number; got ${String(requestedGridRingStep)}; using default 25`,
    );
    gridRingStep = 25;
  }
  const gridRings: PizzaChartGridRingModel[] = [];
  for (let pct = gridRingStep; pct <= 100; pct += gridRingStep) {
    gridRings.push({ percentile: pct, radiusFraction: pct / 100 });
  }
  if (gridRings.length === 0 || gridRings[gridRings.length - 1]?.percentile !== 100) {
    gridRings.push({ percentile: 100, radiusFraction: 1.0 });
  }

  // ---- reference sets -----------------------------------------------------
  const referenceSets: PizzaChartReferenceSetModel[] = [];
  if (input.referenceSets && input.referenceSets.length > 0) {
    const sliceByMetric = new Map(slices.map((s) => [s.metric, s]));
    const innerRFrac = INNER_RADIUS / OUTER_RADIUS;

    for (let si = 0; si < input.referenceSets.length; si++) {
      const refSet = input.referenceSets[si];
      if (!refSet) continue;
      const arcs: PizzaChartReferenceArcModel[] = [];

      for (const [metric, rawPct] of Object.entries(refSet.values)) {
        const slice = sliceByMetric.get(metric);
        if (!slice) continue;
        if (!Number.isFinite(rawPct)) continue;

        const pct = clampPercentile(rawPct);
        const r = innerRFrac + (1 - innerRFrac) * (pct / 100);

        arcs.push({
          metric,
          percentile: pct,
          startAngle: slice.startAngle,
          endAngle: slice.endAngle,
          radius: r,
        });
      }

      referenceSets.push({
        index: si,
        label: refSet.label ?? null,
        stroke: refSet.stroke ?? null,
        strokeWidth: refSet.strokeWidth ?? null,
        strokeDasharray: refSet.strokeDasharray ?? null,
        arcs,
      });
    }
  }

  // ---- accessible label ---------------------------------------------------
  const accessibleLabel = `Pizza chart: ${n} metrics`;

  return {
    meta: {
      component: "PizzaChart",
      empty: false,
      totalRows,
      validRows: validRows.length,
      warnings,
      accessibleLabel,
    },
    geometry: {
      viewBoxSize: VIEWBOX_SIZE,
      center: CENTER,
      outerRadius: OUTER_RADIUS,
      innerRadius: INNER_RADIUS,
      labelRadius: LABEL_RADIUS,
    },
    slices,
    spokes,
    categoryWashes,
    gridRings,
    referenceSets,
    labels,
    valueBadges,
    legend,
    emptyState: null,
    centerContent,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyModel(
  totalRows: number,
  innerRadius: number,
  centerContent: PizzaChartCenterContent,
): PizzaChartModel {
  return {
    meta: {
      component: "PizzaChart",
      empty: true,
      totalRows,
      validRows: 0,
      warnings: [],
      accessibleLabel: "Pizza chart: no profile data",
    },
    geometry: {
      viewBoxSize: VIEWBOX_SIZE,
      center: CENTER,
      outerRadius: OUTER_RADIUS,
      innerRadius,
      labelRadius: LABEL_RADIUS,
    },
    slices: [],
    spokes: [],
    categoryWashes: [],
    gridRings: [],
    referenceSets: [],
    labels: [],
    valueBadges: [],
    legend: null,
    emptyState: { message: "No profile data" },
    centerContent,
  };
}

/**
 * Find indices where category changes occur (for gap insertion).
 */
function computeCategoryBoundaries(rows: PizzaChartRow[]): number[] {
  const boundaries: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]?.category ?? UNCATEGORIZED;
    const curr = rows[i]?.category ?? UNCATEGORIZED;
    if (curr !== prev) boundaries.push(i);
  }
  return boundaries;
}
