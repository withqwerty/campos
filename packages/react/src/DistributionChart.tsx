import { useMemo, useState } from "react";

import {
  computeDistributionChart,
  type ComputeDistributionChartInput,
  type DistributionChartModel,
} from "./compute/index.js";
import { sampleDensityAtValue } from "./compute/distribution-shared.js";
import {
  clampToDomain,
  clientPointToSvgX,
  createDistributionXScale,
  defaultDistributionColor,
  formatDistributionValue,
} from "./distributionUtils.js";
import { useTheme } from "./ThemeContext.js";
import {
  ChartCartesianAxes,
  ChartFrame,
  ChartLegend,
  ChartPlotAreaBackground,
  ChartSvgEmptyState,
  ChartTooltip,
  type ChartMethodologyNotes,
  type TooltipRow,
} from "./primitives/index.js";
import {
  ChartDistributionDensityLayer,
  type DistributionAreaStyleContext,
  type DistributionAreasStyle,
  type DistributionLineStyleContext,
  type DistributionLinesStyle,
  type DistributionMarkerStyleContext,
  type DistributionMarkersStyle,
} from "./primitives/ChartDistributionDensityLayer.js";

export type DistributionChartAreaStyleContext = DistributionAreaStyleContext<null>;
export type DistributionChartLineStyleContext = DistributionLineStyleContext<null>;
export type DistributionChartMarkerStyleContext = DistributionMarkerStyleContext<null>;
export type DistributionChartAreasStyle = DistributionAreasStyle<null>;
export type DistributionChartLinesStyle = DistributionLinesStyle<null>;
export type DistributionChartMarkersStyle = DistributionMarkersStyle<null>;

export type DistributionChartProps = ComputeDistributionChartInput & {
  methodologyNotes?: ChartMethodologyNotes;
  valueFormatter?: ((value: number) => string) | undefined;
  areas?: DistributionChartAreasStyle;
  lines?: DistributionChartLinesStyle;
  markers?: DistributionChartMarkersStyle;
};

type InteractionState = {
  guideX: number;
  rows: TooltipRow[];
  markerId: string | null;
};

function markerRows(
  series: DistributionChartModel["plot"]["series"][number],
  valueFormatter: ((value: number) => string) | undefined,
): TooltipRow[] {
  if (series.marker == null) {
    return [];
  }

  return [
    { label: "Series", value: series.label },
    {
      label:
        series.marker.source === "value"
          ? "Marker"
          : series.marker.source === "mean"
            ? "Mean"
            : "Median",
      value: formatDistributionValue(series.marker.value, valueFormatter),
    },
    {
      label: "Density",
      value: formatDistributionValue(series.marker.density),
    },
    { label: "Sample", value: String(series.stats.count) },
  ];
}

function hoverRows(
  model: DistributionChartModel,
  value: number,
  valueFormatter: ((value: number) => string) | undefined,
): TooltipRow[] {
  return [
    {
      label: model.axes.x.label,
      value: formatDistributionValue(value, valueFormatter),
    },
    ...model.plot.series.map((series) => ({
      label: series.label,
      value: formatDistributionValue(sampleDensityAtValue(series, value)),
    })),
  ];
}

function DistributionChartSvg({
  model,
  theme,
  interaction,
  valueFormatter,
  onPlotHover,
  onPlotLeave,
  onMarkerEnter,
  onMarkerLeave,
  areas,
  lines,
  markers,
}: {
  model: DistributionChartModel;
  theme: ReturnType<typeof useTheme>;
  interaction: InteractionState | null;
  valueFormatter?: ((value: number) => string) | undefined;
  onPlotHover?: ((event: React.MouseEvent<SVGRectElement>) => void) | undefined;
  onPlotLeave?: (() => void) | undefined;
  onMarkerEnter?: ((seriesId: string) => void) | undefined;
  onMarkerLeave?: ((seriesId: string) => void) | undefined;
  areas: DistributionChartAreasStyle | undefined;
  lines: DistributionChartLinesStyle | undefined;
  markers: DistributionChartMarkersStyle | undefined;
}) {
  const { viewBox, plotArea, frame } = model.layout;
  const baselineY = plotArea.y + plotArea.height;

  return (
    <svg
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <ChartPlotAreaBackground plotArea={frame} theme={theme} rx={theme.radius.md} />
      <ChartCartesianAxes
        plotArea={plotArea}
        frame={frame}
        xAxis={model.axes.x}
        yAxis={model.axes.y}
        theme={theme}
        showXGrid
        showYGrid
        xGridDasharray="3 4"
        yGridDasharray="3 4"
      />

      <ChartDistributionDensityLayer
        series={model.plot.series}
        row={null}
        baselineY={baselineY}
        theme={theme}
        getSeriesColor={(_, index) => defaultDistributionColor(index)}
        areas={areas}
        lines={lines}
        markers={markers}
      />

      {interaction ? (
        <line
          x1={interaction.guideX}
          y1={plotArea.y}
          x2={interaction.guideX}
          y2={baselineY}
          stroke={theme.axis.line}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.75}
        />
      ) : null}

      {model.plot.series.map((series) => {
        if (series.marker == null) {
          return null;
        }

        return (
          <g
            key={`marker-hit-${series.id}`}
            role="button"
            tabIndex={0}
            aria-label={`${series.label}: ${markerRows(series, valueFormatter)
              .map((row) => `${row.label} ${row.value}`)
              .join(", ")}`}
            onMouseEnter={() => onMarkerEnter?.(series.id)}
            onMouseLeave={() => onMarkerLeave?.(series.id)}
            onFocus={() => onMarkerEnter?.(series.id)}
            onBlur={() => onMarkerLeave?.(series.id)}
            onClick={() => onMarkerEnter?.(series.id)}
            style={{ cursor: "pointer", outline: "none" }}
          >
            <circle cx={series.marker.x} cy={series.marker.y} r={12} fill="transparent" />
          </g>
        );
      })}

      {!model.meta.empty ? (
        <rect
          x={plotArea.x}
          y={plotArea.y}
          width={plotArea.width}
          height={plotArea.height}
          fill="transparent"
          onMouseMove={onPlotHover}
          onMouseLeave={onPlotLeave}
        />
      ) : null}

      {model.emptyState ? (
        <ChartSvgEmptyState
          x={viewBox.width / 2}
          y={viewBox.height / 2}
          message={model.emptyState.message}
          theme={theme}
          dominantBaseline="central"
        />
      ) : null}
    </svg>
  );
}

export function DistributionChart({
  series,
  xLabel,
  yLabel,
  domain,
  bandwidth,
  bandwidthAdjust,
  samplePoints,
  defaultMarker,
  showLegend,
  methodologyNotes,
  valueFormatter,
  areas,
  lines,
  markers,
}: DistributionChartProps) {
  const theme = useTheme();
  const model = useMemo(
    () =>
      computeDistributionChart({
        series,
        xLabel,
        yLabel,
        domain,
        bandwidth,
        bandwidthAdjust,
        samplePoints,
        defaultMarker,
        showLegend,
      }),
    [
      series,
      xLabel,
      yLabel,
      domain,
      bandwidth,
      bandwidthAdjust,
      samplePoints,
      defaultMarker,
      showLegend,
    ],
  );
  const [interaction, setInteraction] = useState<InteractionState | null>(null);

  const xScale = useMemo(
    () => createDistributionXScale(model.axes.x.domain, model.layout.plotArea),
    [model.axes.x.domain, model.layout.plotArea],
  );

  const plot = (
    <div style={{ position: "relative" }}>
      <DistributionChartSvg
        model={model}
        theme={theme}
        interaction={interaction}
        valueFormatter={valueFormatter}
        areas={areas}
        lines={lines}
        markers={markers}
        onPlotHover={(event) => {
          const svg = event.currentTarget.ownerSVGElement;
          if (svg == null) {
            return;
          }

          const svgX = clientPointToSvgX(svg, event.clientX, event.clientY);
          const value = clampToDomain(
            model.axes.x.domain[0] +
              ((svgX - model.layout.plotArea.x) / model.layout.plotArea.width) *
                (model.axes.x.domain[1] - model.axes.x.domain[0]),
            model.axes.x.domain,
          );

          setInteraction({
            guideX: xScale(value),
            rows: hoverRows(model, value, valueFormatter),
            markerId: null,
          });
        }}
        onPlotLeave={() => {
          setInteraction(null);
        }}
        onMarkerEnter={(seriesId) => {
          const activeSeries = model.plot.series.find((entry) => entry.id === seriesId);
          if (activeSeries?.marker == null) {
            return;
          }

          setInteraction({
            guideX: activeSeries.marker.x,
            rows: markerRows(activeSeries, valueFormatter),
            markerId: activeSeries.id,
          });
        }}
        onMarkerLeave={(seriesId) => {
          setInteraction((current) => (current?.markerId === seriesId ? null : current));
        }}
      />

      {interaction ? (
        <ChartTooltip
          testId="distributionchart-tooltip"
          rows={interaction.rows}
          theme={theme}
        />
      ) : null}
    </div>
  );

  const legend =
    model.legend != null ? (
      <ChartLegend
        items={model.legend.items.map((item, index) => ({
          key: item.id,
          label: item.label,
          color: defaultDistributionColor(index),
        }))}
        title="Series"
        swatchShape="circle"
        theme={theme}
      />
    ) : undefined;

  return (
    <ChartFrame
      ariaLabel={model.meta.accessibleLabel}
      chartKind="distribution-chart"
      empty={model.emptyState != null}
      maxWidth={model.layout.viewBox.width + 32}
      plot={plot}
      legend={legend}
      methodologyNotes={methodologyNotes}
      warnings={model.meta.warnings}
      theme={theme}
    />
  );
}
