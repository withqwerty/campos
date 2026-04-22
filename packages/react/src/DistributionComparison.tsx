import { useMemo, useState } from "react";

import {
  computeDistributionComparison,
  type ComputeDistributionComparisonInput,
  type DistributionComparisonModel,
  type DistributionComparisonRowInput,
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
  ChartFrame,
  ChartLegend,
  ChartPlotAreaBackground,
  ChartSvgEmptyState,
  ChartTooltip,
  type ChartMethodologyNotes,
  useCursorTooltip,
} from "./primitives/index.js";
import {
  ChartDistributionDensityLayer,
  type DistributionAreaStyleContext,
  type DistributionAreasStyle,
  type DistributionLineStyleContext,
  type DistributionLinesStyle,
  type DistributionMarkerShadeStyle,
  type DistributionMarkerStyleContext,
  type DistributionMarkersStyle,
} from "./primitives/ChartDistributionDensityLayer.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";
import type { UITheme } from "./theme.js";

export type DistributionComparisonAreaStyleContext = DistributionAreaStyleContext<
  DistributionComparisonModel["rows"][number]
>;
export type DistributionComparisonLineStyleContext = DistributionLineStyleContext<
  DistributionComparisonModel["rows"][number]
>;
export type DistributionComparisonMarkerStyleContext = DistributionMarkerStyleContext<
  DistributionComparisonModel["rows"][number]
>;
export type DistributionComparisonAreasStyle = DistributionAreasStyle<
  DistributionComparisonModel["rows"][number]
>;
export type DistributionComparisonLinesStyle = DistributionLinesStyle<
  DistributionComparisonModel["rows"][number]
>;
export type DistributionComparisonMarkersStyle = DistributionMarkersStyle<
  DistributionComparisonModel["rows"][number]
>;
export type DistributionComparisonMarkerShadeStyle = DistributionMarkerShadeStyle<
  DistributionComparisonModel["rows"][number]
>;

export type DistributionComparisonLabelStyleContext = {
  row: DistributionComparisonModel["rows"][number];
  theme: UITheme;
};

export type DistributionComparisonLabelsStyle = {
  show?: StyleValue<boolean, DistributionComparisonLabelStyleContext>;
  fill?: StyleValue<string, DistributionComparisonLabelStyleContext>;
  opacity?: StyleValue<number, DistributionComparisonLabelStyleContext>;
  fontSize?: StyleValue<number, DistributionComparisonLabelStyleContext>;
};

export type DistributionComparisonRow = DistributionComparisonRowInput & {
  valueFormatter?: ((value: number) => string) | undefined;
};

export type DistributionComparisonProps = Omit<
  ComputeDistributionComparisonInput,
  "rows"
> & {
  rows: readonly DistributionComparisonRow[];
  methodologyNotes?: ChartMethodologyNotes;
  /**
   * Tooltip style. `"chart"` (default) uses the shared ChartTooltip pinned
   * near the chart frame. `"cursor"` uses a small cursor-following pill —
   * recommended when many rows are stacked, since a fixed chart tooltip can
   * appear over adjacent panels. `"none"` suppresses the tooltip.
   */
  tooltip?: "chart" | "cursor" | "none";
  /**
   * When true, suppress the per-row plot-area background rectangle. Useful
   * when the chart sits inside a coloured composite and the default white
   * background would fight the surround.
   */
  transparentBackground?: boolean;
  /**
   * Controls which hover interactions fire the tooltip.
   *   - `"plot"` (default): mousemove anywhere in a row samples density at
   *     the cursor x and updates the tooltip continuously.
   *   - `"markers-only"`: tooltip fires only when hovering a marker. Useful
   *     for comparison strips where "pop-up on scrub" is noisy relative to
   *     "pop-up at the specific player's value".
   */
  hoverMode?: "plot" | "markers-only";
  /**
   * Width in SVG units reserved for the left-hand row labels. Default 108.
   * Increase when labels are long (e.g. `"Deep (<25y) Touches"`) — the
   * viewBox grows so the plot area keeps its previous width. Labels auto-
   * wrap into up to three lines within this region.
   */
  leftLabelWidth?: number;
  areas?: DistributionComparisonAreasStyle;
  lines?: DistributionComparisonLinesStyle;
  markers?: DistributionComparisonMarkersStyle;
  markerShade?: DistributionComparisonMarkerShadeStyle;
  labels?: DistributionComparisonLabelsStyle;
};

type InteractionState = {
  rowId: string;
  guideX: number;
  rows: Array<{ label: string; value: string }>;
  markerId: string | null;
};

function stripRowFormatter(
  row: DistributionComparisonRow,
): DistributionComparisonRowInput {
  return {
    id: row.id,
    label: row.label,
    series: row.series,
    ...(row.domain != null ? { domain: row.domain } : {}),
    ...(row.defaultMarker != null ? { defaultMarker: row.defaultMarker } : {}),
  };
}

const LABEL_MAX_LINES = 3;
const LABEL_CHAR_WIDTH_RATIO = 0.55;

/**
 * Greedy word-wrap by approximate character count. The char-width ratio is
 * conservative (~0.55 × fontSize) so labels rarely overflow even under
 * slightly wider fonts.
 */
function wrapLabelLines(
  label: string,
  availableWidth: number,
  fontSize: number,
): string[] {
  const maxChars = Math.max(
    4,
    Math.floor(availableWidth / Math.max(1, fontSize * LABEL_CHAR_WIDTH_RATIO)),
  );
  if (label.length <= maxChars) return [label];
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [label];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === LABEL_MAX_LINES - 1) {
        const remaining = words.slice(words.indexOf(word)).join(" ");
        lines.push(remaining);
        return lines;
      }
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, LABEL_MAX_LINES);
}

function hoverRows(
  row: DistributionComparisonModel["rows"][number],
  value: number,
  formatter: ((value: number) => string) | undefined,
) {
  return [
    { label: "Metric", value: row.label },
    { label: "Value", value: formatDistributionValue(value, formatter) },
    ...row.series.map((series) => ({
      label: series.label,
      value: formatDistributionValue(sampleDensityAtValue(series, value)),
    })),
  ];
}

function markerRows(
  row: DistributionComparisonModel["rows"][number],
  series: DistributionComparisonModel["rows"][number]["series"][number],
  formatter: ((value: number) => string) | undefined,
) {
  if (series.marker == null) {
    return [];
  }

  return [
    { label: "Metric", value: row.label },
    { label: "Series", value: series.label },
    {
      label:
        series.marker.source === "value"
          ? "Marker"
          : series.marker.source === "mean"
            ? "Mean"
            : "Median",
      value: formatDistributionValue(series.marker.value, formatter),
    },
    {
      label: "Density",
      value: formatDistributionValue(series.marker.density),
    },
  ];
}

function DistributionComparisonSvg({
  model,
  rowFormatters,
  theme,
  interaction,
  areas,
  lines,
  markers,
  markerShade,
  labels,
  colorIndexBySeriesId,
  transparentBackground,
  hoverMode,
  onPlotHover,
  onPlotLeave,
  onMarkerEnter,
  onMarkerLeave,
}: {
  model: DistributionComparisonModel;
  rowFormatters: Map<string, ((value: number) => string) | undefined>;
  theme: UITheme;
  interaction: InteractionState | null;
  areas: DistributionComparisonAreasStyle | undefined;
  lines: DistributionComparisonLinesStyle | undefined;
  markers: DistributionComparisonMarkersStyle | undefined;
  markerShade: DistributionComparisonMarkerShadeStyle | undefined;
  labels: DistributionComparisonLabelsStyle | undefined;
  colorIndexBySeriesId: Map<string, number>;
  transparentBackground: boolean;
  hoverMode: "plot" | "markers-only";
  onPlotHover?:
    | ((rowId: string, event: React.MouseEvent<SVGRectElement>) => void)
    | undefined;
  onPlotLeave?: ((rowId: string) => void) | undefined;
  onMarkerEnter?:
    | ((
        rowId: string,
        seriesId: string,
        event: React.MouseEvent<SVGElement> | React.FocusEvent<SVGElement>,
      ) => void)
    | undefined;
  onMarkerLeave?: ((rowId: string, seriesId: string) => void) | undefined;
}) {
  return (
    <svg
      viewBox={`0 0 ${model.layout.viewBox.width} ${model.layout.viewBox.height}`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {model.rows.map((row) => {
        const baselineY = row.plotArea.y + row.plotArea.height;
        const labelContext: DistributionComparisonLabelStyleContext = { row, theme };
        const formatter = rowFormatters.get(row.id);

        return (
          <g key={row.id}>
            {transparentBackground ? null : (
              <ChartPlotAreaBackground
                plotArea={row.plotArea}
                theme={theme}
                rx={theme.radius.md}
              />
            )}

            {row.xAxis.ticks.map((tick, index) => {
              const xScale = createDistributionXScale(row.xAxis.domain, row.plotArea);
              const x = xScale(tick);

              return (
                <g key={`${row.id}-grid-${index}`}>
                  <line
                    x1={x}
                    y1={row.plotArea.y}
                    x2={x}
                    y2={baselineY}
                    stroke={theme.axis.grid}
                    strokeWidth={0.75}
                    strokeDasharray="3 4"
                  />
                  <line
                    x1={x}
                    y1={baselineY}
                    x2={x}
                    y2={baselineY + 5}
                    stroke={theme.axis.line}
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={baselineY + 16}
                    textAnchor="middle"
                    fill={theme.text.muted}
                    fontSize={10}
                  >
                    {formatDistributionValue(tick, formatter)}
                  </text>
                </g>
              );
            })}

            <line
              x1={row.plotArea.x}
              y1={baselineY}
              x2={row.plotArea.x + row.plotArea.width}
              y2={baselineY}
              stroke={theme.axis.line}
              strokeWidth={1}
            />

            {resolveStyleValue(labels?.show, labelContext) === false
              ? null
              : (() => {
                  const fontSize =
                    resolveStyleValue(labels?.fontSize, labelContext) ?? 12;
                  const anchorX = row.plotArea.x - 12;
                  // Leave a small inset from the left edge of the viewBox
                  // so wrapped lines don't butt up against it.
                  const availableWidth = Math.max(40, row.plotArea.x - 16);
                  const lines = wrapLabelLines(row.label, availableWidth, fontSize);
                  const lineHeight = fontSize * 1.1;
                  const centerY = row.plotArea.y + row.plotArea.height / 2;
                  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
                  return (
                    <text
                      x={anchorX}
                      y={startY}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fill={
                        resolveStyleValue(labels?.fill, labelContext) ??
                        theme.text.primary
                      }
                      opacity={resolveStyleValue(labels?.opacity, labelContext) ?? 1}
                      fontSize={fontSize}
                      fontWeight={700}
                    >
                      {lines.map((line, i) => (
                        <tspan key={i} x={anchorX} dy={i === 0 ? 0 : lineHeight}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  );
                })()}

            <ChartDistributionDensityLayer
              series={row.series}
              row={row}
              baselineY={baselineY}
              theme={theme}
              getSeriesColor={(series) =>
                defaultDistributionColor(colorIndexBySeriesId.get(series.id) ?? 0)
              }
              areas={areas}
              lines={lines}
              markers={markers}
              markerShade={markerShade}
            />

            {interaction?.rowId === row.id ? (
              <line
                x1={interaction.guideX}
                y1={row.plotArea.y}
                x2={interaction.guideX}
                y2={baselineY}
                stroke={theme.axis.line}
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.75}
              />
            ) : null}

            {row.series.map((series) => {
              if (series.marker == null) {
                return null;
              }

              return (
                <g
                  key={`${row.id}-${series.id}-marker-hit`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${row.label}, ${series.label}: ${markerRows(
                    row,
                    series,
                    formatter,
                  )
                    .map((item) => `${item.label} ${item.value}`)
                    .join(", ")}`}
                  onMouseEnter={(event) => onMarkerEnter?.(row.id, series.id, event)}
                  onMouseMove={(event) => onMarkerEnter?.(row.id, series.id, event)}
                  onMouseLeave={() => onMarkerLeave?.(row.id, series.id)}
                  onFocus={(event) => onMarkerEnter?.(row.id, series.id, event)}
                  onBlur={() => onMarkerLeave?.(row.id, series.id)}
                  onClick={(event) => onMarkerEnter?.(row.id, series.id, event)}
                  style={{ cursor: "pointer", outline: "none" }}
                >
                  <circle
                    cx={series.marker.x}
                    cy={series.marker.y}
                    r={12}
                    fill="transparent"
                  />
                </g>
              );
            })}

            {row.series.length > 0 && hoverMode === "plot" ? (
              <rect
                x={row.plotArea.x}
                y={row.plotArea.y}
                width={row.plotArea.width}
                height={row.plotArea.height}
                fill="transparent"
                onMouseMove={(event) => onPlotHover?.(row.id, event)}
                onMouseLeave={() => onPlotLeave?.(row.id)}
              />
            ) : null}

            {row.emptyState ? (
              <ChartSvgEmptyState
                x={row.plotArea.x + row.plotArea.width / 2}
                y={row.plotArea.y + row.plotArea.height / 2}
                message={row.emptyState.message}
                theme={theme}
                fontSize={12}
                dominantBaseline="central"
              />
            ) : null}
          </g>
        );
      })}

      {model.emptyState ? (
        <ChartSvgEmptyState
          x={model.layout.viewBox.width / 2}
          y={model.layout.viewBox.height / 2}
          message={model.emptyState.message}
          theme={theme}
          dominantBaseline="central"
        />
      ) : null}
    </svg>
  );
}

export function DistributionComparison({
  rows,
  bandwidth,
  bandwidthAdjust,
  samplePoints,
  defaultMarker,
  rowScale,
  showLegend,
  rowHeight,
  rowGap,
  methodologyNotes,
  tooltip = "chart",
  transparentBackground = false,
  hoverMode = "plot",
  leftLabelWidth,
  areas,
  lines,
  markers,
  markerShade,
  labels,
}: DistributionComparisonProps) {
  const theme = useTheme();
  const {
    containerRef: cursorContainerRef,
    show: cursorShow,
    hide: cursorHide,
    element: cursorElement,
  } = useCursorTooltip(theme);
  const model = useMemo(
    () =>
      computeDistributionComparison({
        rows: rows.map(stripRowFormatter),
        bandwidth,
        bandwidthAdjust,
        samplePoints,
        defaultMarker,
        rowScale,
        showLegend,
        rowHeight,
        rowGap,
        leftLabelWidth,
      }),
    [
      rows,
      bandwidth,
      bandwidthAdjust,
      samplePoints,
      defaultMarker,
      rowScale,
      showLegend,
      rowHeight,
      rowGap,
      leftLabelWidth,
    ],
  );
  const rowFormatters = useMemo(
    () => new Map(rows.map((row) => [row.id, row.valueFormatter])),
    [rows],
  );
  const colorIndexBySeriesId = useMemo(() => {
    const map = new Map<string, number>();
    model.legend?.items.forEach((item, index) => {
      map.set(item.id, index);
    });
    return map;
  }, [model.legend]);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);

  function renderCursorContent(rowsContent: Array<{ label: string; value: string }>) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rowsContent.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <span style={{ color: theme.text.muted }}>{r.label}</span>
            <span style={{ fontWeight: 600 }}>{r.value}</span>
          </div>
        ))}
      </div>
    );
  }

  const plot = (
    <div ref={cursorContainerRef} style={{ position: "relative" }}>
      <DistributionComparisonSvg
        model={model}
        rowFormatters={rowFormatters}
        theme={theme}
        interaction={interaction}
        areas={areas}
        lines={lines}
        markers={markers}
        markerShade={markerShade}
        labels={labels}
        colorIndexBySeriesId={colorIndexBySeriesId}
        transparentBackground={transparentBackground}
        hoverMode={hoverMode}
        onPlotHover={(rowId, event) => {
          const row = model.rows.find((entry) => entry.id === rowId);
          if (row == null) {
            return;
          }

          const svg = event.currentTarget.ownerSVGElement;
          if (svg == null) {
            return;
          }

          const svgX = clientPointToSvgX(svg, event.clientX, event.clientY);
          const value = clampToDomain(
            row.xAxis.domain[0] +
              ((svgX - row.plotArea.x) / row.plotArea.width) *
                (row.xAxis.domain[1] - row.xAxis.domain[0]),
            row.xAxis.domain,
          );
          const xScale = createDistributionXScale(row.xAxis.domain, row.plotArea);

          const rowsContent = hoverRows(row, value, rowFormatters.get(row.id));
          setInteraction({
            rowId,
            guideX: xScale(value),
            rows: rowsContent,
            markerId: null,
          });
          if (tooltip === "cursor") {
            cursorShow(event, renderCursorContent(rowsContent));
          }
        }}
        onPlotLeave={(rowId) => {
          setInteraction((current) => (current?.rowId === rowId ? null : current));
          if (tooltip === "cursor") cursorHide();
        }}
        onMarkerEnter={(rowId, seriesId, event) => {
          const row = model.rows.find((entry) => entry.id === rowId);
          const series = row?.series.find((entry) => entry.id === seriesId);
          if (row == null || series?.marker == null) {
            return;
          }

          const rowsContent = markerRows(row, series, rowFormatters.get(row.id));
          setInteraction({
            rowId,
            guideX: series.marker.x,
            rows: rowsContent,
            markerId: series.id,
          });
          if (tooltip === "cursor" && event && "clientX" in event) {
            cursorShow(event as React.MouseEvent, renderCursorContent(rowsContent));
          }
        }}
        onMarkerLeave={(rowId, seriesId) => {
          setInteraction((current) =>
            current?.rowId === rowId && current.markerId === seriesId ? null : current,
          );
          if (tooltip === "cursor") cursorHide();
        }}
      />

      {interaction && tooltip === "chart" ? (
        <ChartTooltip
          testId="distributioncomparison-tooltip"
          rows={interaction.rows}
          theme={theme}
        />
      ) : null}
      {tooltip === "cursor" ? cursorElement : null}
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
      chartKind="distribution-comparison"
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
