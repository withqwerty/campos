import { createNumericAxis } from "./scales/index.js";
import {
  computeKernelSeriesModels,
  projectKernelSeries,
  type DistributionBandwidth,
  type DistributionDefaultMarker,
  type DistributionProjectedSeriesModel,
  type DistributionSeriesInput,
} from "./distribution-shared.js";

export type {
  DistributionBandwidth,
  DistributionDefaultMarker,
  DistributionSeriesInput,
} from "./distribution-shared.js";

export type DistributionComparisonRowInput = {
  id: string;
  label: string;
  series: readonly DistributionSeriesInput[];
  domain?: [number, number] | undefined;
  defaultMarker?: DistributionDefaultMarker | undefined;
};

export type DistributionComparisonRowModel = {
  id: string;
  label: string;
  plotArea: { x: number; y: number; width: number; height: number };
  xAxis: {
    domain: [number, number];
    ticks: number[];
  };
  yDomain: [number, number];
  series: DistributionProjectedSeriesModel[];
  emptyState: { message: string } | null;
};

export type DistributionComparisonModel = {
  meta: {
    component: "DistributionComparison";
    empty: boolean;
    accessibleLabel: string;
    warnings: string[];
  };
  layout: {
    viewBox: { width: number; height: number };
  };
  rows: DistributionComparisonRowModel[];
  legend: {
    items: Array<{ id: string; label: string }>;
  } | null;
  emptyState: {
    message: string;
  } | null;
};

export type ComputeDistributionComparisonInput = {
  rows: readonly DistributionComparisonRowInput[];
  bandwidth?: DistributionBandwidth | undefined;
  bandwidthAdjust?: number | undefined;
  samplePoints?: number | undefined;
  defaultMarker?: DistributionDefaultMarker | undefined;
  rowScale?: "independent" | "shared" | undefined;
  showLegend?: boolean | undefined;
  /**
   * Height in SVG units for each row's plot area. Default 62 preserves the
   * standalone chart proportions; smaller values (e.g. 24-40) are useful
   * when stacking many rows as a small-multiples strip. Values below 12
   * are clamped.
   */
  rowHeight?: number | undefined;
  /**
   * Vertical gap between rows in SVG units. Default 16. Set to 0 for tight
   * small-multiples stacks.
   */
  rowGap?: number | undefined;
  /**
   * Width in SVG units reserved for the left-hand row labels. Default 108.
   * Grows the viewBox so the plot area keeps its previous width. Increase
   * when labels are long enough to wrap or get cropped at the default.
   */
  leftLabelWidth?: number | undefined;
};

const DEFAULT_VIEWBOX_W = 460;
const DEFAULT_LEFT_LABEL_W = 108;
const RIGHT_MARGIN = 18;
const TOP_MARGIN = 16;
const BOTTOM_MARGIN = 16;
const DEFAULT_ROW_HEIGHT = 62;
const ROW_AXIS_H = 20;
const DEFAULT_ROW_GAP = 16;
const MIN_ROW_HEIGHT = 12;

export function computeDistributionComparison(
  input: ComputeDistributionComparisonInput,
): DistributionComparisonModel {
  const rowScale = input.rowScale ?? "independent";
  const rowHeight = Math.max(input.rowHeight ?? DEFAULT_ROW_HEIGHT, MIN_ROW_HEIGHT);
  const rowGap = Math.max(input.rowGap ?? DEFAULT_ROW_GAP, 0);
  const leftLabelWidth = Math.max(input.leftLabelWidth ?? DEFAULT_LEFT_LABEL_W, 0);
  // Grow the viewBox when labels widen so the plot keeps its defensive width.
  const viewBoxW = DEFAULT_VIEWBOX_W + Math.max(0, leftLabelWidth - DEFAULT_LEFT_LABEL_W);
  const processedRows = input.rows.map((row) => {
    const kernel = computeKernelSeriesModels(row.series, {
      domain: row.domain,
      bandwidth: input.bandwidth,
      bandwidthAdjust: input.bandwidthAdjust,
      samplePoints: input.samplePoints,
      defaultMarker: row.defaultMarker ?? input.defaultMarker,
    });

    return {
      input: row,
      kernel,
      nonEmptySeries: kernel.series.filter((series) => series.values.length > 0),
    };
  });

  const warnings = processedRows.flatMap((row) =>
    row.kernel.warnings.map((warning) => `${row.input.label}: ${warning}`),
  );
  const sharedDensityMax =
    rowScale === "shared"
      ? processedRows.reduce(
          (currentMax, row) =>
            Math.max(
              currentMax,
              ...row.nonEmptySeries.map((series) => series.maxDensity),
            ),
          0,
        )
      : 0;

  const rows = processedRows.map((row, index) => {
    const plotArea = {
      x: leftLabelWidth,
      y: TOP_MARGIN + index * (rowHeight + ROW_AXIS_H + rowGap),
      width: viewBoxW - leftLabelWidth - RIGHT_MARGIN,
      height: rowHeight,
    };

    const xAxis = createNumericAxis({
      min: row.kernel.domain[0],
      max: row.kernel.domain[1],
      range: [plotArea.x, plotArea.x + plotArea.width],
      tickCount: 5,
    });

    const maxDensity =
      rowScale === "shared"
        ? sharedDensityMax
        : row.nonEmptySeries.reduce(
            (currentMax, series) => Math.max(currentMax, series.maxDensity),
            0,
          );

    const yAxis = createNumericAxis({
      min: 0,
      max: maxDensity > 0 ? maxDensity : 1,
      range: [plotArea.y + plotArea.height, plotArea.y],
      tickCount: 3,
    });

    const projectedSeries = projectKernelSeries(
      row.nonEmptySeries,
      plotArea,
      xAxis.domain,
      yAxis.domain[1] > 0 ? yAxis.domain[1] : 1,
    );

    return {
      id: row.input.id,
      label: row.input.label,
      plotArea,
      xAxis: {
        domain: xAxis.domain,
        ticks: xAxis.ticks,
      },
      yDomain: yAxis.domain,
      series: projectedSeries,
      emptyState: projectedSeries.length === 0 ? { message: "No valid values" } : null,
    };
  });

  const height =
    TOP_MARGIN +
    BOTTOM_MARGIN +
    rows.length * (rowHeight + ROW_AXIS_H) +
    Math.max(0, rows.length - 1) * rowGap;
  const legendItems = new Map<string, { id: string; label: string }>();
  for (const row of rows) {
    for (const series of row.series) {
      if (!legendItems.has(series.id)) {
        legendItems.set(series.id, { id: series.id, label: series.label });
      }
    }
  }

  const empty = rows.every((row) => row.series.length === 0);

  return {
    meta: {
      component: "DistributionComparison",
      empty,
      accessibleLabel: empty
        ? "Distribution comparison: no valid data"
        : `Distribution comparison: ${rows.length} rows`,
      warnings,
    },
    layout: {
      viewBox: { width: viewBoxW, height },
    },
    rows,
    legend:
      input.showLegend === false || legendItems.size <= 1
        ? null
        : {
            items: Array.from(legendItems.values()),
          },
    emptyState: empty ? { message: "No plottable comparison data" } : null,
  };
}
