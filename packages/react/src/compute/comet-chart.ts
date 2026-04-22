import { max as d3Max, min as d3Min } from "d3-array";

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
import { isFiniteNumber, mean, median } from "./math.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CometChartAxisModel = {
  label: string;
  domain: [number, number];
  ticks: number[];
  inverted: boolean;
};

export type CometChartPointModel = {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  isLatest: boolean;
  timeLabel: string | null;
  tooltip: CometChartTooltipModel;
};

export type CometChartTooltipModel = {
  rows: Array<{ label: string; value: string }>;
};

export type CometChartTrailSegmentModel = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
};

export type CometChartEntityModel = {
  id: string;
  fill: string;
  points: CometChartPointModel[];
  trail: CometChartTrailSegmentModel[];
  barelyMoved: boolean;
};

export type CometChartLabelModel = {
  entityId: string;
  text: string;
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
  connector: { x1: number; y1: number; x2: number; y2: number } | null;
};

export type CometChartGuideInput = {
  axis: "x" | "y";
  value: number | "median" | "mean";
  label?: string | undefined;
  stroke?: string | undefined;
  strokeDasharray?: string | undefined;
};

export type CometChartGuideModel = {
  axis: "x" | "y";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string | null;
  stroke: string | null;
  strokeDasharray: string | null;
};

export type CometChartLegendItem = {
  key: string;
  label: string;
  color: string;
};

export type CometChartLegendModel = {
  kind: "categorical";
  title: string;
  items: CometChartLegendItem[];
};

export type CometChartModel = {
  meta: {
    component: "CometChart";
    empty: boolean;
    totalEntities: number;
    totalPoints: number;
    warnings: string[];
    accessibleLabel: string;
  };
  layout: {
    viewBox: { width: number; height: number };
    plotArea: { x: number; y: number; width: number; height: number };
    frame: { x: number; y: number; width: number; height: number };
  };
  axes: {
    x: CometChartAxisModel;
    y: CometChartAxisModel;
  };
  plot: {
    entities: CometChartEntityModel[];
    guides: CometChartGuideModel[];
    labels: CometChartLabelModel[];
  };
  legends: CometChartLegendModel[];
  emptyState: { message: string } | null;
};

export type ComputeCometChartInput<T> = {
  points: readonly T[];
  entityKey: keyof T & string;
  xKey: keyof T & string;
  yKey: keyof T & string;
  timeKey?: (keyof T & string) | undefined;
  labelKey?: (keyof T & string) | undefined;
  xLabel?: string | undefined;
  yLabel?: string | undefined;
  invertX?: boolean | undefined;
  invertY?: boolean | undefined;
  guides?: readonly CometChartGuideInput[] | undefined;
  showTimeLabels?: boolean | undefined;
  labelStrategy?: "all" | "none" | "manual" | undefined;
  labelIds?: readonly string[] | undefined;
  /** Pixel gutter between plot rect and axis lines. Default 6. */
  axisPadding?: AxisPaddingInput;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORICAL_PALETTE = [
  "#4665d8",
  "#f27068",
  "#7ce2a1",
  "#f2a93b",
  "#b794f4",
  "#f58fb0",
  "#4fd1c5",
  "#8792a8",
];

const VIEWBOX_W = 400;
const VIEWBOX_H = 320;
const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };

const LATEST_RADIUS = 4.5;
const INTERMEDIATE_RADIUS = 2.5;
const LATEST_OPACITY = 0.9;
const INTERMEDIATE_OPACITY = 0.5;
const EARLIEST_OPACITY = 0.35;

const TRAIL_GRADIENT_OLD = 0.2;
const TRAIL_GRADIENT_NEW = 0.8;
const BARELY_MOVED_THRESHOLD = 0.01;

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

/**
 * Compute a renderer-neutral semantic model for a comet chart.
 *
 * A comet chart is a Cartesian scatter where entities (teams, players) are
 * plotted at multiple time positions with connecting gradient trails showing
 * their movement over time.
 */
export function computeCometChart<T>(input: ComputeCometChartInput<T>): CometChartModel {
  const {
    points,
    entityKey,
    xKey,
    yKey,
    timeKey,
    labelKey,
    xLabel = xKey,
    yLabel = yKey,
    invertX = false,
    invertY = false,
    guides = [],
    showTimeLabels = false,
    labelStrategy = "all",
    labelIds,
    axisPadding = DEFAULT_AXIS_PADDING,
  } = input;
  const [gutterX, gutterY] = resolveAxisPadding(axisPadding);
  const colorKey: (keyof T & string) | undefined = undefined;
  const colorLabel: string | undefined = undefined;
  const palette = CATEGORICAL_PALETTE;
  const warnings: string[] = [];
  const plotW = VIEWBOX_W - MARGIN.left - MARGIN.right;
  const plotH = VIEWBOX_H - MARGIN.top - MARGIN.bottom;
  const frame = { x: MARGIN.left, y: MARGIN.top, width: plotW, height: plotH };
  const plotArea = applyAxisPadding(frame, [gutterX, gutterY]);

  // ---- filter plottable points ------------------------------------------
  const plottable = points.filter((p) => {
    const xVal = p[xKey];
    const yVal = p[yKey];
    const eVal = p[entityKey];
    return isFiniteNumber(xVal) && isFiniteNumber(yVal) && eVal != null;
  });

  // ---- empty state ------------------------------------------------------
  if (plottable.length === 0) {
    const emptyNice = niceTicks(0, 1);
    return {
      meta: {
        component: "CometChart",
        empty: true,
        totalEntities: 0,
        totalPoints: 0,
        warnings: [],
        accessibleLabel: `Comet chart: ${xLabel} vs ${yLabel} — no data`,
      },
      layout: {
        viewBox: { width: VIEWBOX_W, height: VIEWBOX_H },
        frame,
        plotArea,
      },
      axes: {
        x: {
          label: xLabel,
          domain: emptyNice.domain,
          ticks: emptyNice.ticks,
          inverted: invertX,
        },
        y: {
          label: yLabel,
          domain: emptyNice.domain,
          ticks: emptyNice.ticks,
          inverted: invertY,
        },
      },
      plot: { entities: [], guides: [], labels: [] },
      legends: [],
      emptyState: { message: "No data" },
    };
  }

  // ---- group by entity --------------------------------------------------
  const entityMap = new Map<string, T[]>();
  for (const p of plottable) {
    const key = String(p[entityKey]);
    let group = entityMap.get(key);
    if (!group) {
      group = [];
      entityMap.set(key, group);
    }
    group.push(p);
  }

  // ---- deduplicate entityKey + timeKey (last wins) ----------------------
  if (timeKey) {
    for (const [key, group] of entityMap) {
      const seen = new Map<string, number>();
      for (let i = 0; i < group.length; i++) {
        const tVal = String((group[i] as T)[timeKey]);
        seen.set(tVal, i);
      }
      if (seen.size < group.length) {
        const deduped = Array.from(seen.values()).map((i) => group[i] as T);
        entityMap.set(key, deduped);
      }
    }
  }

  // ---- sort by time within each entity ----------------------------------
  if (timeKey) {
    for (const group of entityMap.values()) {
      group.sort((a, b) => {
        const aVal = a[timeKey];
        const bVal = b[timeKey];
        if (isFiniteNumber(aVal) && isFiniteNumber(bVal)) return aVal - bVal;
        return String(aVal ?? "").localeCompare(String(bVal ?? ""));
      });
    }
  }

  // ---- domains ----------------------------------------------------------
  const allXValues = plottable.map((p) => p[xKey] as number);
  const allYValues = plottable.map((p) => p[yKey] as number);

  const xAxis = createNumericAxis({
    min: d3Min(allXValues) ?? 0,
    max: d3Max(allXValues) ?? 0,
    range: [gutterX, plotW - gutterX],
    invert: invertX,
  });
  const yAxis = createNumericAxis({
    min: d3Min(allYValues) ?? 0,
    max: d3Max(allYValues) ?? 0,
    range: [gutterY, plotH - gutterY],
    invert: !invertY,
  });

  const xScale = xAxis.scale;
  const yScale = yAxis.scale;

  // ---- color encoding ---------------------------------------------------
  type ColorEncoding =
    | { kind: "default"; map: Map<string, string> }
    | { kind: "categorical"; map: Map<string, string> };

  let colorEncoding: ColorEncoding;

  if (colorKey) {
    const distinctColors = new Map<string, string>();
    let colorIndex = 0;
    for (const group of entityMap.values()) {
      const first = group[0];
      if (!first) continue;
      const colorVal = String(first[colorKey] ?? "");
      if (!distinctColors.has(colorVal)) {
        distinctColors.set(colorVal, palette[colorIndex % palette.length] ?? "#8792a8");
        colorIndex++;
      }
    }
    // Map entity IDs to their color group's color
    const entityColorMap = new Map<string, string>();
    for (const [entityId, group] of entityMap) {
      const first = group[0];
      if (!first) continue;
      const colorVal = String(first[colorKey] ?? "");
      entityColorMap.set(entityId, distinctColors.get(colorVal) ?? "#8792a8");
    }
    colorEncoding = { kind: "categorical", map: entityColorMap };
  } else {
    const entityColorMap = new Map<string, string>();
    let i = 0;
    for (const entityId of entityMap.keys()) {
      entityColorMap.set(entityId, palette[i % palette.length] ?? "#8792a8");
      i++;
    }
    colorEncoding = { kind: "default", map: entityColorMap };
  }

  // ---- build entity models ----------------------------------------------
  const entityModels: CometChartEntityModel[] = [];

  for (const [entityId, group] of entityMap) {
    const fill = colorEncoding.map.get(entityId) ?? "#8792a8";
    const pointCount = group.length;

    // Compute points
    const pointModels: CometChartPointModel[] = group.map((p, idx) => {
      const xVal = p[xKey] as number;
      const yVal = p[yKey] as number;
      const isLatest = idx === pointCount - 1;
      const isEarliest = idx === 0;

      const cx = MARGIN.left + xScale(xVal);
      const cy = MARGIN.top + yScale(yVal);
      const r = isLatest ? LATEST_RADIUS : INTERMEDIATE_RADIUS;
      const opacity = isLatest
        ? LATEST_OPACITY
        : isEarliest && pointCount > 2
          ? EARLIEST_OPACITY
          : INTERMEDIATE_OPACITY;

      // Time label
      const timeLabel =
        showTimeLabels && timeKey && p[timeKey] != null ? String(p[timeKey]) : null;

      // Tooltip rows
      const tooltipRows: Array<{ label: string; value: string }> = [];
      const entityLabel = labelKey
        ? String(p[labelKey] ?? p[entityKey])
        : String(p[entityKey]);
      tooltipRows.push({ label: "Entity", value: entityLabel });
      if (timeKey && p[timeKey] != null) {
        tooltipRows.push({ label: "Period", value: String(p[timeKey]) });
      }
      tooltipRows.push({ label: xLabel, value: formatNumericTick(xVal) });
      tooltipRows.push({ label: yLabel, value: formatNumericTick(yVal) });

      // Delta from previous point
      if (idx > 0) {
        const prev = group[idx - 1] as T;
        const prevX = prev[xKey] as number;
        const prevY = prev[yKey] as number;
        if (isFiniteNumber(prevX) && isFiniteNumber(prevY)) {
          const dx = xVal - prevX;
          const dy = yVal - prevY;
          const sign = (v: number) => (v >= 0 ? "+" : "");
          tooltipRows.push({
            label: "Change",
            value: `${sign(dx)}${formatNumericTick(dx)} / ${sign(dy)}${formatNumericTick(dy)}`,
          });
        }
      }

      return {
        cx,
        cy,
        r,
        opacity,
        isLatest,
        timeLabel,
        tooltip: { rows: tooltipRows },
      };
    });

    // Barely-moved detection (in normalized [0,1] space)
    let barelyMoved = false;
    if (pointModels.length >= 2) {
      const first = pointModels[0] as CometChartPointModel;
      const last = pointModels[pointModels.length - 1] as CometChartPointModel;
      const normDx = plotW > 0 ? (last.cx - first.cx) / plotW : 0;
      const normDy = plotH > 0 ? (last.cy - first.cy) / plotH : 0;
      const normDist = Math.sqrt(normDx * normDx + normDy * normDy);
      barelyMoved = normDist < BARELY_MOVED_THRESHOLD;
    }

    // Build trail segments
    const trail: CometChartTrailSegmentModel[] = [];
    if (!barelyMoved && pointModels.length >= 2) {
      const segCount = pointModels.length - 1;
      for (let i = 0; i < segCount; i++) {
        const from = pointModels[i] as CometChartPointModel;
        const to = pointModels[i + 1] as CometChartPointModel;

        // Gradient trail opacity is now fixed in core; React owns any non-default
        // trail styling on top of this baseline model.
        const t = segCount === 1 ? 1 : (i + 1) / segCount;
        const segOpacity =
          TRAIL_GRADIENT_OLD + t * (TRAIL_GRADIENT_NEW - TRAIL_GRADIENT_OLD);

        trail.push({
          x1: from.cx,
          y1: from.cy,
          x2: to.cx,
          y2: to.cy,
          opacity: segOpacity,
        });
      }
    }

    // For barely-moved entities, show only latest point
    const visiblePoints = barelyMoved ? pointModels.slice(-1) : pointModels;

    entityModels.push({
      id: entityId,
      fill,
      points: visiblePoints,
      trail,
      barelyMoved,
    });
  }

  // ---- guides -----------------------------------------------------------
  function resolveGuideValue(guide: CometChartGuideInput): number {
    if (typeof guide.value === "number") return guide.value;
    const values = guide.axis === "x" ? allXValues : allYValues;
    if (guide.value === "median") return median(values);
    return mean(values);
  }

  const guideModels: CometChartGuideModel[] = guides
    .map((guide) => {
      const resolved = resolveGuideValue(guide);
      if (guide.axis === "x") {
        const x = MARGIN.left + xScale(resolved);
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
      const y = MARGIN.top + yScale(resolved);
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
    .filter((g) => [g.x1, g.x2, g.y1, g.y2].every((v) => Number.isFinite(v)));

  // ---- labels -----------------------------------------------------------
  const labelModels: CometChartLabelModel[] = [];

  const shouldLabel = (entityId: string): boolean => {
    if (labelStrategy === "none") return false;
    if (labelStrategy === "manual") {
      return labelIds != null && labelIds.includes(entityId);
    }
    return true; // "all"
  };

  if (labelStrategy !== "none") {
    const occupiedRects: Array<{
      left: number;
      right: number;
      top: number;
      bottom: number;
    }> = [];

    for (const entity of entityModels) {
      if (!shouldLabel(entity.id)) continue;

      const latestPoint =
        entity.points.find((p) => p.isLatest) ?? entity.points[entity.points.length - 1];
      if (!latestPoint) continue;

      const labelText = (() => {
        // Find the original data row for the latest point
        const group = entityMap.get(entity.id);
        if (!group || group.length === 0) return entity.id;
        const lastRow = group[group.length - 1] as T;
        if (labelKey) return String(lastRow[labelKey] ?? entity.id);
        return String(lastRow[entityKey] ?? entity.id);
      })();

      const width = approxLabelWidth(labelText);
      const height = 13;
      const baseOffset = latestPoint.r + 6;

      // 4-candidate placement
      const candidates = [
        {
          x: latestPoint.cx + baseOffset,
          y: latestPoint.cy - baseOffset,
          textAnchor: "start" as const,
          rect: {
            left: latestPoint.cx + baseOffset,
            right: latestPoint.cx + baseOffset + width,
            top: latestPoint.cy - baseOffset - height,
            bottom: latestPoint.cy - baseOffset + 2,
          },
        },
        {
          x: latestPoint.cx - baseOffset,
          y: latestPoint.cy - baseOffset,
          textAnchor: "end" as const,
          rect: {
            left: latestPoint.cx - baseOffset - width,
            right: latestPoint.cx - baseOffset,
            top: latestPoint.cy - baseOffset - height,
            bottom: latestPoint.cy - baseOffset + 2,
          },
        },
        {
          x: latestPoint.cx + baseOffset,
          y: latestPoint.cy + baseOffset + 2,
          textAnchor: "start" as const,
          rect: {
            left: latestPoint.cx + baseOffset,
            right: latestPoint.cx + baseOffset + width,
            top: latestPoint.cy + baseOffset - 10,
            bottom: latestPoint.cy + baseOffset + height,
          },
        },
        {
          x: latestPoint.cx - baseOffset,
          y: latestPoint.cy + baseOffset + 2,
          textAnchor: "end" as const,
          rect: {
            left: latestPoint.cx - baseOffset - width,
            right: latestPoint.cx - baseOffset,
            top: latestPoint.cy + baseOffset - 10,
            bottom: latestPoint.cy + baseOffset + height,
          },
        },
      ];

      // Score candidates
      const scored = candidates.map((candidate) => {
        let score = 0;

        // Penalty for being outside the plot area
        const withinPlot =
          candidate.rect.left >= MARGIN.left + 2 &&
          candidate.rect.right <= MARGIN.left + plotW - 2 &&
          candidate.rect.top >= MARGIN.top + 2 &&
          candidate.rect.bottom <= MARGIN.top + plotH - 2;
        if (!withinPlot) score += 10_000;

        // Penalty for overlapping existing labels
        if (occupiedRects.some((occupied) => rectsOverlap(candidate.rect, occupied))) {
          score += 2_000;
        }

        // Penalty for overlapping markers
        for (const otherEntity of entityModels) {
          for (const point of otherEntity.points) {
            if (
              circleIntersectsRect(
                { cx: point.cx, cy: point.cy, r: point.r + 2 },
                candidate.rect,
              )
            ) {
              score += 500;
            }
          }
        }

        return { ...candidate, score };
      });

      const chosen = scored.sort((a, b) => a.score - b.score)[0];
      if (!chosen) continue;

      occupiedRects.push(chosen.rect);

      // Connector line
      const connectorDx = chosen.x - latestPoint.cx;
      const connectorDy = chosen.y - latestPoint.cy;
      const connectorLength = Math.hypot(connectorDx, connectorDy) || 1;
      const connectorStart = latestPoint.r + 1.5;
      const connectorEnd = Math.min(connectorLength * 0.6, connectorStart + 7);
      const connector =
        connectorLength > latestPoint.r + 4
          ? {
              x1: latestPoint.cx + (connectorDx / connectorLength) * connectorStart,
              y1: latestPoint.cy + (connectorDy / connectorLength) * connectorStart,
              x2: latestPoint.cx + (connectorDx / connectorLength) * connectorEnd,
              y2: latestPoint.cy + (connectorDy / connectorLength) * connectorEnd,
            }
          : null;

      labelModels.push({
        entityId: entity.id,
        text: labelText,
        x: chosen.x,
        y: chosen.y,
        textAnchor: chosen.textAnchor,
        connector,
      });
    }
  }

  // ---- legend -----------------------------------------------------------
  const legends: CometChartLegendModel[] = [];

  if (entityModels.length > 1) {
    if (colorKey) {
      // Group by colorKey value
      const colorGroups = new Map<string, { color: string; label: string }>();
      for (const [entityId, group] of entityMap) {
        const first = group[0];
        if (!first) continue;
        const colorVal = String(first[colorKey] ?? "");
        if (!colorGroups.has(colorVal)) {
          colorGroups.set(colorVal, {
            color: colorEncoding.map.get(entityId) ?? "#8792a8",
            label: colorVal,
          });
        }
      }
      legends.push({
        kind: "categorical",
        title: colorLabel ?? colorKey,
        items: Array.from(colorGroups.entries()).map(([key, { color, label }]) => ({
          key,
          label,
          color,
        })),
      });
    } else {
      // One legend item per entity
      legends.push({
        kind: "categorical",
        title: "",
        items: entityModels.map((entity) => {
          const group = entityMap.get(entity.id);
          const first = group?.[0];
          const label =
            first && labelKey ? String(first[labelKey] ?? entity.id) : entity.id;
          return {
            key: entity.id,
            label,
            color: entity.fill,
          };
        }),
      });
    }
  }

  return {
    meta: {
      component: "CometChart",
      empty: false,
      totalEntities: entityModels.length,
      totalPoints: plottable.length,
      warnings,
      accessibleLabel: `Comet chart: ${entityModels.length} ${entityModels.length === 1 ? "entity" : "entities"}, ${xLabel} vs ${yLabel}`,
    },
    layout: {
      viewBox: { width: VIEWBOX_W, height: VIEWBOX_H },
      frame,
      plotArea,
    },
    axes: {
      x: { label: xLabel, domain: xAxis.domain, ticks: xAxis.ticks, inverted: invertX },
      y: { label: yLabel, domain: yAxis.domain, ticks: yAxis.ticks, inverted: invertY },
    },
    plot: {
      entities: entityModels,
      guides: guideModels,
      labels: labelModels,
    },
    legends,
    emptyState: null,
  };
}
