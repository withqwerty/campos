import {
  approxLabelWidth,
  circleIntersectsRect,
  rectsOverlap,
} from "./label-geometry.js";
import {
  applyAxisPadding,
  type AxisPaddingInput,
  DEFAULT_AXIS_PADDING,
  resolveAxisPadding,
} from "./scales/axis-padding.js";
import { formatNumericTick } from "./scales/format-number.js";
import { createNumericAxis } from "./scales/numeric-axis.js";
import { niceTicks } from "./scales/nice-ticks.js";
import { extent, isFiniteNumber, mean, median } from "./math.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ScatterPlotAxisModel = {
  label: string;
  domain: [number, number];
  ticks: number[];
};

export type ScatterPlotMarkerModel = {
  id: string;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  label: string | null;
  emphasized: boolean;
  tooltip: ScatterPlotTooltipModel;
};

export type ScatterPlotTooltipModel = {
  rows: Array<{ label: string; value: string }>;
};

export type ScatterPlotLegendItem = {
  key: string;
  label: string;
  color?: string;
  radius?: number;
};

export type ScatterPlotLegendModel = {
  kind: "categorical" | "continuous" | "size";
  title: string;
  items: ScatterPlotLegendItem[];
};

export type ScatterPlotReferenceLineModel = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type ScatterPlotGuideInput = {
  axis: "x" | "y";
  value: number | "median" | "mean";
  label?: string | undefined;
  stroke?: string | undefined;
  strokeDasharray?: string | undefined;
};

export type ScatterPlotGuideModel = {
  axis: "x" | "y";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string | null;
  stroke: string | null;
  strokeDasharray: string | null;
};

export type ScatterPlotRegionInput = {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  fill: string;
  opacity?: number | undefined;
  label?: string | undefined;
  textColor?: string | undefined;
  labelPosition?:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center"
    | undefined;
  labelMode?: "none" | "buffer" | "avoid" | undefined;
};

export type ScatterPlotRegionModel = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity: number;
  label: string | null;
  textColor: string | null;
  labelPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  labelMode: "none" | "buffer" | "avoid";
};

export type ScatterPlotLabelModel = {
  id: string;
  text: string;
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
  connector: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null;
};

export type ScatterPlotModel = {
  meta: {
    component: "ScatterPlot";
    empty: boolean;
    accessibleLabel: string;
  };
  layout: {
    viewBox: { width: number; height: number };
    plotArea: { x: number; y: number; width: number; height: number };
    /** Outer frame — background + clip rect. See `axisPadding`. */
    frame: { x: number; y: number; width: number; height: number };
  };
  axes: {
    x: ScatterPlotAxisModel;
    y: ScatterPlotAxisModel;
  };
  plot: {
    regions: ScatterPlotRegionModel[];
    guides: ScatterPlotGuideModel[];
    ghostMarkers: ScatterPlotMarkerModel[];
    markers: ScatterPlotMarkerModel[];
    labels: ScatterPlotLabelModel[];
    referenceLine: ScatterPlotReferenceLineModel | null;
  };
  legends: ScatterPlotLegendModel[];
  emptyState: { message: string } | null;
};

export type ScatterPlotGhostConfig<T> =
  | { mode: "explicit"; points: readonly T[] }
  | { mode: "unlabeled" }
  | { mode: "below-guides" };

export type ComputeScatterPlotInput<T> = {
  points: readonly T[];
  ghost?: ScatterPlotGhostConfig<T> | undefined;
  idKey?: (keyof T & string) | undefined;
  xKey: keyof T & string;
  yKey: keyof T & string;
  labelKey?: (keyof T & string) | undefined;
  labelStrategy?: "manual" | "extremes" | "outliers" | undefined;
  autoLabelCount?: number | undefined;
  labelIds?: readonly string[] | undefined;
  guides?: readonly ScatterPlotGuideInput[] | undefined;
  regions?: readonly ScatterPlotRegionInput[] | undefined;
  xLabel?: string | undefined;
  yLabel?: string | undefined;
  referenceLine?: "y=x" | undefined;
  /**
   * Pixel gutter between the data-bearing plot rect and the axis lines.
   * Default 6 (both axes). See `docs/specs/plot-padding-spec.md`.
   */
  axisPadding?: AxisPaddingInput;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FILL = "#4665d8";
const DEFAULT_RADIUS = 3.5;

const VIEWBOX_W = 400;
const VIEWBOX_H = 320;
const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };

function uniqueStable<T>(values: readonly T[]): T[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function pointInRect(
  point: { x: number; y: number },
  rect: { left: number; right: number; top: number; bottom: number },
) {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

function pointInCircle(
  point: { x: number; y: number },
  circle: { cx: number; cy: number; r: number },
) {
  const dx = point.x - circle.cx;
  const dy = point.y - circle.cy;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

function crossProductSign(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 0.001) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  return (
    b.x <= Math.max(a.x, c.x) + 0.001 &&
    b.x >= Math.min(a.x, c.x) - 0.001 &&
    b.y <= Math.max(a.y, c.y) + 0.001 &&
    b.y >= Math.min(a.y, c.y) - 0.001
  );
}

function segmentsIntersect(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
) {
  const o1 = crossProductSign(a1, a2, b1);
  const o2 = crossProductSign(a1, a2, b2);
  const o3 = crossProductSign(b1, b2, a1);
  const o4 = crossProductSign(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
}

function segmentIntersectsRect(
  segment: { x1: number; y1: number; x2: number; y2: number },
  rect: { left: number; right: number; top: number; bottom: number },
) {
  const start = { x: segment.x1, y: segment.y1 };
  const end = { x: segment.x2, y: segment.y2 };
  if (pointInRect(start, rect) || pointInRect(end, rect)) return true;

  const topLeft = { x: rect.left, y: rect.top };
  const topRight = { x: rect.right, y: rect.top };
  const bottomLeft = { x: rect.left, y: rect.bottom };
  const bottomRight = { x: rect.right, y: rect.bottom };

  return (
    segmentsIntersect(start, end, topLeft, topRight) ||
    segmentsIntersect(start, end, topRight, bottomRight) ||
    segmentsIntersect(start, end, bottomRight, bottomLeft) ||
    segmentsIntersect(start, end, bottomLeft, topLeft)
  );
}

function segmentIntersectsCircle(
  segment: { x1: number; y1: number; x2: number; y2: number },
  circle: { cx: number; cy: number; r: number },
) {
  const start = { x: segment.x1, y: segment.y1 };
  const end = { x: segment.x2, y: segment.y2 };

  if (pointInCircle(start, circle) || pointInCircle(end, circle)) return true;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return pointInCircle(start, circle);

  const t = ((circle.cx - start.x) * dx + (circle.cy - start.y) * dy) / lengthSquared;
  const clamped = Math.max(0, Math.min(1, t));
  const closestX = start.x + clamped * dx;
  const closestY = start.y + clamped * dy;
  const cx = closestX - circle.cx;
  const cy = closestY - circle.cy;
  return cx * cx + cy * cy <= circle.r * circle.r;
}

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

/**
 * Compute a renderer-neutral semantic model for a Cartesian scatter plot.
 *
 * The function is generic over `T` so callers can pass any record type and
 * pick keys with full type safety.
 */
export function computeScatterPlot<T>(
  input: ComputeScatterPlotInput<T>,
): ScatterPlotModel {
  const {
    points,
    ghost,
    idKey,
    xKey,
    yKey,
    labelKey,
    labelStrategy = "manual",
    autoLabelCount = 6,
    labelIds,
    guides = [],
    regions = [],
    xLabel = xKey,
    yLabel = yKey,
    referenceLine,
    axisPadding = DEFAULT_AXIS_PADDING,
  } = input;
  const [gutterX, gutterY] = resolveAxisPadding(axisPadding);
  // ---- filter plottable points ------------------------------------------
  const plottable = points.filter((p) => {
    const xVal = p[xKey];
    const yVal = p[yKey];
    return isFiniteNumber(xVal) && isFiniteNumber(yVal);
  });

  // ---- empty state ------------------------------------------------------
  if (plottable.length === 0) {
    const emptyNice = niceTicks(0, 1);
    const emptyFrame = {
      x: MARGIN.left,
      y: MARGIN.top,
      width: VIEWBOX_W - MARGIN.left - MARGIN.right,
      height: VIEWBOX_H - MARGIN.top - MARGIN.bottom,
    };
    const emptyPlotArea = applyAxisPadding(emptyFrame, [gutterX, gutterY]);
    return {
      meta: {
        component: "ScatterPlot",
        empty: true,
        accessibleLabel: `Scatter plot: ${xLabel} vs ${yLabel} — no data`,
      },
      layout: {
        viewBox: { width: VIEWBOX_W, height: VIEWBOX_H },
        plotArea: emptyPlotArea,
        frame: emptyFrame,
      },
      axes: {
        x: { label: xLabel, domain: emptyNice.domain, ticks: emptyNice.ticks },
        y: { label: yLabel, domain: emptyNice.domain, ticks: emptyNice.ticks },
      },
      plot: {
        regions: [],
        guides: [],
        ghostMarkers: [],
        markers: [],
        labels: [],
        referenceLine: null,
      },
      legends: [],
      emptyState: { message: "No plottable data" },
    };
  }

  // ---- domains ----------------------------------------------------------
  const xValues = plottable.map((p) => p[xKey] as number);
  const yValues = plottable.map((p) => p[yKey] as number);

  // Expand domain to include explicit ghost points so they aren't clipped
  let allXValues = xValues;
  let allYValues = yValues;
  if (ghost?.mode === "explicit") {
    const ghostXY = ghost.points.filter(
      (p) => isFiniteNumber(p[xKey]) && isFiniteNumber(p[yKey]),
    );
    allXValues = [...xValues, ...ghostXY.map((p) => p[xKey] as number)];
    allYValues = [...yValues, ...ghostXY.map((p) => p[yKey] as number)];
  }

  const plotW = VIEWBOX_W - MARGIN.left - MARGIN.right;
  const plotH = VIEWBOX_H - MARGIN.top - MARGIN.bottom;
  const frame = { x: MARGIN.left, y: MARGIN.top, width: plotW, height: plotH };
  const plotArea = applyAxisPadding(frame, [gutterX, gutterY]);
  const [xMin, xMax] = extent(allXValues) ?? [0, 0];
  const [yMin, yMax] = extent(allYValues) ?? [0, 0];

  // Scale ranges are relative to plotArea (gutter-inset) not frame. Callers
  // add `MARGIN.left + xScale(val)` to get absolute pixel positions, so we
  // need to shift the range by gutter too.
  const xAxis = createNumericAxis({
    min: xMin,
    max: xMax,
    range: [gutterX, plotW - gutterX],
  });
  const yAxis = createNumericAxis({
    min: yMin,
    max: yMax,
    range: [gutterY, plotH - gutterY],
    invert: true,
  });

  const xScale = xAxis.scale;
  const yScale = yAxis.scale;

  // ---- markers ----------------------------------------------------------
  const markerIdForPoint = (point: T, index: number) =>
    idKey && point[idKey] != null ? String(point[idKey]) : String(index);

  let selectedLabelIds = new Set<string>();
  if (labelStrategy === "manual") {
    selectedLabelIds = new Set(labelIds ?? []);
  } else if (labelKey) {
    const desiredCount = Math.max(1, Math.min(autoLabelCount, plottable.length));

    if (labelStrategy === "extremes") {
      const perEdge = Math.max(1, Math.ceil(desiredCount / 4));
      const indexed = plottable.map((point, index) => ({
        point,
        index,
        id: markerIdForPoint(point, index),
        x: point[xKey] as number,
        y: point[yKey] as number,
      }));
      const edgePools = [
        [...indexed].sort((a, b) => a.x - b.x).slice(0, perEdge),
        [...indexed].sort((a, b) => b.x - a.x).slice(0, perEdge),
        [...indexed].sort((a, b) => a.y - b.y).slice(0, perEdge),
        [...indexed].sort((a, b) => b.y - a.y).slice(0, perEdge),
      ];
      const orderedIds = uniqueStable(edgePools.flat().map((entry) => entry.id)).slice(
        0,
        desiredCount,
      );
      selectedLabelIds = new Set(orderedIds);
    } else {
      // "outliers" — label top performers: highest x, highest y, highest x+y
      // Normalise to [0,1] so x and y contribute equally to the combined rank
      const xRange = xAxis.domain[1] - xAxis.domain[0] || 1;
      const yRange = yAxis.domain[1] - yAxis.domain[0] || 1;

      const indexed = plottable.map((point, index) => ({
        id: markerIdForPoint(point, index),
        x: point[xKey] as number,
        y: point[yKey] as number,
        xNorm: ((point[xKey] as number) - xAxis.domain[0]) / xRange,
        yNorm: ((point[yKey] as number) - yAxis.domain[0]) / yRange,
      }));

      // Over-sample each pool so dedup still yields enough unique candidates
      const perPool = Math.max(2, Math.ceil(desiredCount / 2));
      const pools = [
        [...indexed].sort((a, b) => b.x - a.x).slice(0, perPool), // top x
        [...indexed].sort((a, b) => b.y - a.y).slice(0, perPool), // top y
        [...indexed]
          .sort((a, b) => b.xNorm + b.yNorm - (a.xNorm + a.yNorm))
          .slice(0, perPool), // top combined
      ];
      const orderedIds = uniqueStable(pools.flat().map((entry) => entry.id)).slice(
        0,
        desiredCount,
      );
      selectedLabelIds = new Set(orderedIds);
    }
  }

  const markers: ScatterPlotMarkerModel[] = plottable.map((p, i) => {
    const xVal = p[xKey] as number;
    const yVal = p[yKey] as number;
    const label = labelKey ? String(p[labelKey] ?? "") || null : null;

    const tooltipRows: Array<{ label: string; value: string }> = [
      { label: xLabel, value: formatNumericTick(xVal) },
      { label: yLabel, value: formatNumericTick(yVal) },
    ];
    if (label) {
      tooltipRows.unshift({ label: "Label", value: label });
    }

    const markerId = markerIdForPoint(p, i);
    const emphasized = selectedLabelIds.size > 0 && selectedLabelIds.has(markerId);
    const rawCx = MARGIN.left + xScale(xVal);
    const rawCy = MARGIN.top + yScale(yVal);

    return {
      id: markerId,
      cx: Math.min(
        MARGIN.left + plotW - DEFAULT_RADIUS,
        Math.max(MARGIN.left + DEFAULT_RADIUS, rawCx),
      ),
      cy: Math.min(
        MARGIN.top + plotH - DEFAULT_RADIUS,
        Math.max(MARGIN.top + DEFAULT_RADIUS, rawCy),
      ),
      r: DEFAULT_RADIUS,
      fill: DEFAULT_FILL,
      label,
      emphasized,
      tooltip: { rows: tooltipRows },
    };
  });

  // ---- guides and regions ----------------------------------------------
  function resolveGuideValue(guide: ScatterPlotGuideInput): number {
    if (typeof guide.value === "number") return guide.value;
    const values = guide.axis === "x" ? xValues : yValues;
    if (guide.value === "median") return median(values);
    return mean(values);
  }

  const resolvedGuides = guides.map((guide) => ({
    ...guide,
    resolvedValue: resolveGuideValue(guide),
  }));

  const guideModels: ScatterPlotGuideModel[] = resolvedGuides
    .map((guide) => {
      if (guide.axis === "x") {
        const x = MARGIN.left + xScale(guide.resolvedValue);
        return {
          axis: "x" as const,
          x1: x,
          y1: MARGIN.top,
          x2: x,
          y2: MARGIN.top + plotH,
          label: guide.label ?? null,
          stroke: guide.stroke ?? null,
          strokeDasharray: guide.strokeDasharray ?? "4 3",
        };
      }

      const y = MARGIN.top + yScale(guide.resolvedValue);
      return {
        axis: "y" as const,
        x1: MARGIN.left,
        y1: y,
        x2: MARGIN.left + plotW,
        y2: y,
        label: guide.label ?? null,
        stroke: guide.stroke ?? null,
        strokeDasharray: guide.strokeDasharray ?? "4 3",
      };
    })
    .filter((guide) =>
      [guide.x1, guide.x2, guide.y1, guide.y2].every((value) => Number.isFinite(value)),
    );

  const regionModels: ScatterPlotRegionModel[] = regions
    .map((region) => {
      const left = MARGIN.left + xScale(Math.min(region.x1, region.x2));
      const right = MARGIN.left + xScale(Math.max(region.x1, region.x2));
      const top = MARGIN.top + yScale(Math.max(region.y1, region.y2));
      const bottom = MARGIN.top + yScale(Math.min(region.y1, region.y2));

      return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        fill: region.fill,
        opacity: region.opacity ?? 0.12,
        label: region.label ?? null,
        textColor: region.textColor ?? null,
        labelPosition: region.labelPosition ?? "center",
        labelMode: region.labelMode ?? "none",
      };
    })
    .filter(
      (region) =>
        Number.isFinite(region.x) &&
        Number.isFinite(region.y) &&
        region.width > 0 &&
        region.height > 0,
    );

  // ---- reference line ---------------------------------------------------
  let refLine: ScatterPlotReferenceLineModel | null = null;
  if (referenceLine === "y=x") {
    const lo = Math.max(xAxis.domain[0], yAxis.domain[0]);
    const hi = Math.min(xAxis.domain[1], yAxis.domain[1]);
    if (lo < hi) {
      refLine = {
        x1: MARGIN.left + xScale(lo),
        y1: MARGIN.top + yScale(lo),
        x2: MARGIN.left + xScale(hi),
        y2: MARGIN.top + yScale(hi),
      };
    }
  }

  // ---- visible labels --------------------------------------------------
  const visibleLabels: ScatterPlotLabelModel[] = [];
  if (selectedLabelIds.size > 0 && labelKey) {
    const occupiedRects: Array<{
      left: number;
      right: number;
      top: number;
      bottom: number;
    }> = [];
    const occupiedConnectors: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }> = [];
    const labelCandidates = markers
      .filter((marker) => marker.emphasized && marker.label)
      .sort((a, b) => b.r - a.r || a.cx - b.cx);

    for (const marker of labelCandidates) {
      const text = marker.label ?? "";
      const width = approxLabelWidth(text);
      const height = 13;
      const baseOffset = marker.r + 6;
      const candidates = [
        {
          x: marker.cx + baseOffset,
          y: marker.cy - baseOffset,
          textAnchor: "start" as const,
          rect: {
            left: marker.cx + baseOffset,
            right: marker.cx + baseOffset + width,
            top: marker.cy - baseOffset - height,
            bottom: marker.cy - baseOffset + 2,
          },
        },
        {
          x: marker.cx - baseOffset,
          y: marker.cy - baseOffset,
          textAnchor: "end" as const,
          rect: {
            left: marker.cx - baseOffset - width,
            right: marker.cx - baseOffset,
            top: marker.cy - baseOffset - height,
            bottom: marker.cy - baseOffset + 2,
          },
        },
        {
          x: marker.cx + baseOffset,
          y: marker.cy + baseOffset + 2,
          textAnchor: "start" as const,
          rect: {
            left: marker.cx + baseOffset,
            right: marker.cx + baseOffset + width,
            top: marker.cy + baseOffset - 10,
            bottom: marker.cy + baseOffset + height,
          },
        },
        {
          x: marker.cx - baseOffset,
          y: marker.cy + baseOffset + 2,
          textAnchor: "end" as const,
          rect: {
            left: marker.cx - baseOffset - width,
            right: marker.cx - baseOffset,
            top: marker.cy + baseOffset - 10,
            bottom: marker.cy + baseOffset + height,
          },
        },
      ];

      const scoredCandidates = candidates.map((candidate) => {
        const connectorEndX =
          candidate.textAnchor === "start" ? candidate.rect.left : candidate.rect.right;
        const connectorEndY =
          candidate.rect.top + (candidate.rect.bottom - candidate.rect.top) / 2;
        const connectorDx = connectorEndX - marker.cx;
        const connectorDy = connectorEndY - marker.cy;
        const connectorLength = Math.hypot(connectorDx, connectorDy) || 1;
        const connectorStart = marker.r + 1.5;
        const connectorEnd = Math.min(connectorLength, connectorStart + 7);
        const connector = {
          x1: marker.cx + (connectorDx / connectorLength) * connectorStart,
          y1: marker.cy + (connectorDy / connectorLength) * connectorStart,
          x2: marker.cx + (connectorDx / connectorLength) * connectorEnd,
          y2: marker.cy + (connectorDy / connectorLength) * connectorEnd,
        };

        let score = 0;

        const withinPlot =
          candidate.rect.left >= MARGIN.left + 2 &&
          candidate.rect.right <= MARGIN.left + plotW - 2 &&
          candidate.rect.top >= MARGIN.top + 2 &&
          candidate.rect.bottom <= MARGIN.top + plotH - 2;
        if (!withinPlot) score += 10_000;

        if (occupiedRects.some((occupied) => rectsOverlap(candidate.rect, occupied))) {
          score += 2_000;
        }

        if (
          markers.some(
            (other) =>
              other.id !== marker.id &&
              circleIntersectsRect(
                { cx: other.cx, cy: other.cy, r: other.r + 2 },
                candidate.rect,
              ),
          )
        ) {
          score += 2_000;
        }

        if (
          occupiedRects.some((occupied) => segmentIntersectsRect(connector, occupied))
        ) {
          score += 800;
        }

        const connectorMarkerIntersections = markers.filter(
          (other) =>
            other.id !== marker.id &&
            segmentIntersectsCircle(connector, {
              cx: other.cx,
              cy: other.cy,
              r: other.r + 2,
            }),
        ).length;
        score += connectorMarkerIntersections * 900;

        const connectorCrossings = occupiedConnectors.filter((other) =>
          segmentsIntersect(
            { x: connector.x1, y: connector.y1 },
            { x: connector.x2, y: connector.y2 },
            { x: other.x1, y: other.y1 },
            { x: other.x2, y: other.y2 },
          ),
        ).length;
        score += connectorCrossings * 1_200;

        score += connectorLength * 0.02;

        return {
          ...candidate,
          connector,
          score,
        };
      });

      const chosen = scoredCandidates.sort((a, b) => a.score - b.score)[0];
      if (!chosen) continue;

      occupiedRects.push(chosen.rect);
      if (
        chosen.connector.x1 !== chosen.connector.x2 ||
        chosen.connector.y1 !== chosen.connector.y2
      ) {
        occupiedConnectors.push(chosen.connector);
      }
      visibleLabels.push({
        id: marker.id,
        text,
        x: chosen.x,
        y: chosen.y,
        textAnchor: chosen.textAnchor,
        connector: chosen.connector,
      });
    }
  }

  // ---- ghost markers ----------------------------------------------------
  let ghostMarkers: ScatterPlotMarkerModel[] = [];

  if (ghost) {
    const labeledIds = new Set(visibleLabels.map((l) => l.id));

    if (ghost.mode === "explicit") {
      // Separate array of background context points
      const ghostPlottable = ghost.points.filter((p) => {
        const xVal = p[xKey];
        const yVal = p[yKey];
        return isFiniteNumber(xVal) && isFiniteNumber(yVal);
      });
      ghostMarkers = ghostPlottable.map((p, i) => {
        const xVal = p[xKey] as number;
        const yVal = p[yKey] as number;
        const rawCx = MARGIN.left + xScale(xVal);
        const rawCy = MARGIN.top + yScale(yVal);
        const radius = DEFAULT_RADIUS;
        return {
          id: `ghost-${i}`,
          cx: Math.min(
            MARGIN.left + plotW - radius,
            Math.max(MARGIN.left + radius, rawCx),
          ),
          cy: Math.min(MARGIN.top + plotH - radius, Math.max(MARGIN.top + radius, rawCy)),
          r: radius,
          fill: "#8792a8",
          label: null,
          emphasized: false,
          tooltip: { rows: [] },
        };
      });
    } else if (ghost.mode === "unlabeled") {
      // Non-labeled markers become ghosts; labeled markers stay in main set
      const mainSet: ScatterPlotMarkerModel[] = [];
      for (const marker of markers) {
        if (labeledIds.has(marker.id) || marker.emphasized) {
          mainSet.push(marker);
        } else {
          ghostMarkers.push(marker);
        }
      }
      markers.length = 0;
      markers.push(...mainSet);
    } else {
      // Points below ALL guide thresholds become ghosts
      const xGuides = resolvedGuides.filter((g) => g.axis === "x");
      const yGuides = resolvedGuides.filter((g) => g.axis === "y");
      if (xGuides.length > 0 || yGuides.length > 0) {
        const mainSet: ScatterPlotMarkerModel[] = [];
        for (let mi = 0; mi < markers.length; mi++) {
          const point = plottable[mi];
          if (!point) continue;
          const marker = markers[mi] as ScatterPlotMarkerModel;
          const xVal = point[xKey] as number;
          const yVal = point[yKey] as number;
          const belowAllX =
            xGuides.length > 0 && xGuides.every((g) => xVal < g.resolvedValue);
          const belowAllY =
            yGuides.length > 0 && yGuides.every((g) => yVal < g.resolvedValue);
          const belowBoth =
            xGuides.length > 0 && yGuides.length > 0
              ? belowAllX && belowAllY
              : belowAllX || belowAllY;
          if (belowBoth) {
            ghostMarkers.push(marker);
          } else {
            mainSet.push(marker);
          }
        }
        markers.length = 0;
        markers.push(...mainSet);
      }
    }
  }

  // ---- legends ----------------------------------------------------------
  const legends: ScatterPlotLegendModel[] = [];

  return {
    meta: {
      component: "ScatterPlot",
      empty: false,
      accessibleLabel: `Scatter plot: ${plottable.length} points, ${xLabel} vs ${yLabel}`,
    },
    layout: {
      viewBox: { width: VIEWBOX_W, height: VIEWBOX_H },
      frame,
      plotArea,
    },
    axes: {
      x: { label: xLabel, domain: xAxis.domain, ticks: xAxis.ticks },
      y: { label: yLabel, domain: yAxis.domain, ticks: yAxis.ticks },
    },
    plot: {
      regions: regionModels,
      guides: guideModels,
      ghostMarkers,
      markers,
      labels: visibleLabels,
      referenceLine: refLine,
    },
    legends,
    emptyState: null,
  };
}
