import {
  applyAxisPadding,
  type AxisPaddingInput,
  createNumericAxis,
  DEFAULT_AXIS_PADDING,
  formatNumericTick,
  resolveAxisPadding,
} from "./scales/index.js";
import {
  computeKernelSeriesModels,
  projectKernelSeries,
  type DistributionBandwidth,
  type DistributionDefaultMarker,
  type DistributionProjectedMarkerModel,
  type DistributionProjectedSeriesModel,
  type DistributionSeriesInput,
} from "./distribution-shared.js";

export type {
  DistributionBandwidth,
  DistributionDefaultMarker,
  DistributionDensityStats,
  DistributionMarkerSource,
  DistributionSeriesInput,
} from "./distribution-shared.js";

export type DistributionChartMarkerModel = DistributionProjectedMarkerModel;
export type DistributionChartSeriesModel = DistributionProjectedSeriesModel;

export type DistributionChartAxisModel = {
  label: string;
  domain: [number, number];
  ticks: number[];
};

export type DistributionChartLegendItem = {
  id: string;
  label: string;
};

export type DistributionChartModel = {
  meta: {
    component: "DistributionChart";
    empty: boolean;
    accessibleLabel: string;
    warnings: string[];
  };
  layout: {
    viewBox: { width: number; height: number };
    plotArea: { x: number; y: number; width: number; height: number };
    frame: { x: number; y: number; width: number; height: number };
  };
  axes: {
    x: DistributionChartAxisModel;
    y: DistributionChartAxisModel;
  };
  plot: {
    series: DistributionChartSeriesModel[];
  };
  legend: {
    items: DistributionChartLegendItem[];
  } | null;
  emptyState: {
    message: string;
  } | null;
};

export type ComputeDistributionChartInput = {
  series: readonly DistributionSeriesInput[];
  xLabel?: string | undefined;
  yLabel?: string | undefined;
  domain?: [number, number] | undefined;
  bandwidth?: DistributionBandwidth | undefined;
  bandwidthAdjust?: number | undefined;
  samplePoints?: number | undefined;
  defaultMarker?: DistributionDefaultMarker | undefined;
  showLegend?: boolean | undefined;
  /** Pixel gutter between plot rect and axis lines. Default 6. */
  axisPadding?: AxisPaddingInput;
};

const VIEWBOX_W = 420;
const VIEWBOX_H = 300;
const MARGIN = {
  top: 18,
  right: 18,
  bottom: 52,
  left: 56,
};

export function computeDistributionChart(
  input: ComputeDistributionChartInput,
): DistributionChartModel {
  const xLabel = input.xLabel ?? "Value";
  const yLabel = input.yLabel ?? "Density";
  const [gutterX, gutterY] = resolveAxisPadding(
    input.axisPadding ?? DEFAULT_AXIS_PADDING,
  );

  const frame = {
    x: MARGIN.left,
    y: MARGIN.top,
    width: VIEWBOX_W - MARGIN.left - MARGIN.right,
    height: VIEWBOX_H - MARGIN.top - MARGIN.bottom,
  };
  const plotArea = applyAxisPadding(frame, [gutterX, gutterY]);

  const kernel = computeKernelSeriesModels(input.series, {
    domain: input.domain,
    bandwidth: input.bandwidth,
    bandwidthAdjust: input.bandwidthAdjust,
    samplePoints: input.samplePoints,
    defaultMarker: input.defaultMarker,
  });

  const nonEmptySeries = kernel.series.filter((series) => series.values.length > 0);
  const maxDensity = nonEmptySeries.reduce(
    (currentMax, series) => Math.max(currentMax, series.maxDensity),
    0,
  );

  const xAxis = createNumericAxis({
    min: kernel.domain[0],
    max: kernel.domain[1],
    range: [plotArea.x, plotArea.x + plotArea.width],
  });
  const yAxis = createNumericAxis({
    min: 0,
    max: maxDensity > 0 ? maxDensity : 1,
    range: [plotArea.y + plotArea.height, plotArea.y],
  });

  const projectedSeries = projectKernelSeries(
    nonEmptySeries,
    plotArea,
    xAxis.domain,
    yAxis.domain[1] > 0 ? yAxis.domain[1] : 1,
  );

  const empty = projectedSeries.length === 0;
  const legendItems = projectedSeries.map((series) => ({
    id: series.id,
    label: series.label,
  }));

  return {
    meta: {
      component: "DistributionChart",
      empty,
      accessibleLabel: empty
        ? `Distribution chart: no valid data for ${xLabel}`
        : `Distribution chart: ${projectedSeries.length} series for ${xLabel}`,
      warnings: kernel.warnings,
    },
    layout: {
      viewBox: { width: VIEWBOX_W, height: VIEWBOX_H },
      plotArea,
      frame,
    },
    axes: {
      x: {
        label: xLabel,
        domain: xAxis.domain,
        ticks: xAxis.ticks,
      },
      y: {
        label: yLabel,
        domain: yAxis.domain,
        ticks: yAxis.ticks,
      },
    },
    plot: {
      series: projectedSeries,
    },
    legend:
      input.showLegend === false || projectedSeries.length <= 1
        ? null
        : {
            items: legendItems,
          },
    emptyState: empty ? { message: "No plottable distribution data" } : null,
  };
}

export function formatDistributionDensity(value: number): string {
  return formatNumericTick(value);
}
