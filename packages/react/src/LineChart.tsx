import { type ReactNode, useCallback, useId, useMemo, useState } from "react";

import {
  computeLineChart,
  type ComputeLineChartInput,
  type LineChartEndLabelModel,
  type LineChartEnvelopeModel,
  type LineChartModel,
  type LineChartPointModel,
  type LineChartSeriesModel,
} from "./compute/index.js";

import { useTheme } from "./ThemeContext.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";
import {
  ChartCartesianAxes,
  ChartFrame,
  type ChartMethodologyNotes,
  ChartPlotAreaBackground,
  ChartPlotAreaBands,
  ChartPlotAreaReferenceLines,
  ChartPointMark,
  ChartSvgEmptyState,
  ChartTooltip,
  EmptyState,
  type PlotAreaBandsStyle,
  type PlotAreaReferenceLinesStyle,
  type PointShape,
  useCursorTooltip,
} from "./primitives/index.js";
import { LIGHT_THEME, type UITheme } from "./theme.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Props passed to a custom end-label renderer. */
export type LineChartEndLabelRenderProps = {
  id: string;
  label: string;
  color: string;
  value: number;
};

/** Cursor-following tooltip surface for line / trendline hover. */
export type LineChartLineTooltipConfig = {
  /** Receives the full series model so consumers can compute derived stats. */
  renderContent: (series: LineChartSeriesModel) => ReactNode;
};

/**
 * Controls which tooltip wins when both a marker and the underlying line
 * could render one at the same cursor position:
 * - `"marker"` (default): marker tooltip takes priority; the cursor-following
 *   `lineTooltip` is suppressed while a marker is hovered.
 * - `"line"`: `lineTooltip` always renders when hovering a series, even if
 *   a marker on that line is also under the cursor.
 * - `"both"`: previous behaviour — both can render simultaneously.
 */
export type LineChartTooltipPriority = "marker" | "line" | "both";

export type LineChartProps = ComputeLineChartInput & {
  /** Custom render function for end labels; defaults to label + value. */
  renderEndLabel?: (props: LineChartEndLabelRenderProps) => ReactNode;
  /**
   * Opacity multiplier applied to non-hovered series when something is being
   * hovered. Default 0.35.
   */
  inactiveFadeMultiplier?: number;
  /** Background-series opacity when highlighting is in effect. Default 0.25. */
  backgroundOpacity?: number;
  /** Show per-point markers. Default true. */
  showMarkers?: boolean;
  /** Show grid lines (y only). Default true. */
  showGridLines?: boolean;
  /** Default marker radius. Default 3. */
  markerRadius?: number;
  /** Cursor-following tooltip on line hover. */
  lineTooltip?: LineChartLineTooltipConfig;
  /**
   * Resolve overlap between the per-point marker tooltip and the
   * cursor-following `lineTooltip`. Default `"marker"` — markers take
   * priority because they carry more specific data.
   */
  tooltipPriority?: LineChartTooltipPriority;
  /**
   * Format the x value for marker aria-labels. Default: `String(x)`. Use
   * this when x is an epoch-ms timestamp or another non-human-readable
   * numeric so screen readers get a sensible label.
   */
  formatAccessibleX?: (x: number) => string;
  methodologyNotes?: ChartMethodologyNotes;
  /** Suppress hover interactions. Useful for print/SSR. */
  staticMode?: boolean;
  lines?: LineChartLinesStyle;
  points?: LineChartPointsStyle;
  labels?: LineChartLabelsStyle;
  guides?: LineChartGuidesStyle;
  trendlines?: boolean;
  trendlineStyle?: LineChartTrendlineStyle;
  bandsStyle?: PlotAreaBandsStyle;
  referencesStyle?: PlotAreaReferenceLinesStyle;
  envelopesStyle?: LineChartEnvelopesStyle;
};

export type LineChartEnvelopeStyleContext = {
  envelope: LineChartEnvelopeModel;
  theme: UITheme;
};

export type LineChartEnvelopesStyle = {
  show?: StyleValue<boolean, LineChartEnvelopeStyleContext>;
  fill?: StyleValue<string, LineChartEnvelopeStyleContext>;
  opacity?: StyleValue<number, LineChartEnvelopeStyleContext>;
};

export type LineChartLineStyleContext = {
  series: LineChartSeriesModel;
  theme: UITheme;
  hoveredId: string | null;
};

export type LineChartLinesStyle = {
  show?: StyleValue<boolean, LineChartLineStyleContext>;
  stroke?: StyleValue<string, LineChartLineStyleContext>;
  strokeWidth?: StyleValue<number, LineChartLineStyleContext>;
  opacity?: StyleValue<number, LineChartLineStyleContext>;
  strokeDasharray?: StyleValue<string, LineChartLineStyleContext>;
};

export type LineChartPointStyleContext = {
  series: LineChartSeriesModel;
  point: LineChartPointModel;
  theme: UITheme;
  hoveredId: string | null;
};

export type LineChartPointsStyle = {
  show?: StyleValue<boolean, LineChartPointStyleContext>;
  fill?: StyleValue<string, LineChartPointStyleContext>;
  stroke?: StyleValue<string, LineChartPointStyleContext>;
  strokeWidth?: StyleValue<number, LineChartPointStyleContext>;
  opacity?: StyleValue<number, LineChartPointStyleContext>;
  radius?: StyleValue<number, LineChartPointStyleContext>;
  shape?: StyleValue<PointShape, LineChartPointStyleContext>;
};

export type LineChartLabelStyleContext = {
  label: LineChartEndLabelModel;
  theme: UITheme;
};

export type LineChartLabelsStyle = {
  show?: StyleValue<boolean, LineChartLabelStyleContext>;
  fill?: StyleValue<string, LineChartLabelStyleContext>;
  opacity?: StyleValue<number, LineChartLabelStyleContext>;
  fontSize?: StyleValue<number, LineChartLabelStyleContext>;
};

export type LineChartGuideStyleContext = {
  tick: number;
  theme: UITheme;
};

export type LineChartGuidesStyle = {
  show?: StyleValue<boolean, LineChartGuideStyleContext>;
  stroke?: StyleValue<string, LineChartGuideStyleContext>;
  strokeWidth?: StyleValue<number, LineChartGuideStyleContext>;
  strokeDasharray?: StyleValue<string, LineChartGuideStyleContext>;
  opacity?: StyleValue<number, LineChartGuideStyleContext>;
};

export type LineChartTrendlineStyleContext = {
  series: LineChartSeriesModel;
  theme: UITheme;
};

export type LineChartTrendlineStyle = {
  show?: StyleValue<boolean, LineChartTrendlineStyleContext>;
  stroke?: StyleValue<string, LineChartTrendlineStyleContext>;
  strokeWidth?: StyleValue<number, LineChartTrendlineStyleContext>;
  strokeDasharray?: StyleValue<string, LineChartTrendlineStyleContext>;
  opacity?: StyleValue<number, LineChartTrendlineStyleContext>;
};

/**
 * The hovered-marker record carries both the series identity and the
 * point's own formatted value. `label` is the series label (shown in the
 * tooltip's "Series" row); `pointLabel` is the point's formatted y value
 * (shown in the y row).
 */
type HoveredPoint = Omit<LineChartPointModel, "label"> & {
  id: string;
  label: string;
  pointLabel: string;
  color: string;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GridLines({
  model,
  theme,
  style,
}: {
  model: LineChartModel;
  theme: UITheme;
  style: LineChartGuidesStyle | undefined;
}) {
  const { plotArea } = model.layout;
  const [yMin, yMax] = model.axes.y.domain;
  const yRange = yMax - yMin || 1;
  return (
    <g data-testid="line-y-grid">
      {model.axes.y.ticks.map((tick) => {
        const context: LineChartGuideStyleContext = { tick, theme };
        if (resolveStyleValue(style?.show, context) === false) return null;
        const opacity = resolveStyleValue(style?.opacity, context);
        const yPos =
          plotArea.y + plotArea.height - ((tick - yMin) / yRange) * plotArea.height;
        return (
          <line
            key={tick}
            x1={plotArea.x}
            y1={yPos}
            x2={plotArea.x + plotArea.width}
            y2={yPos}
            stroke={resolveStyleValue(style?.stroke, context) ?? theme.axis.grid}
            strokeWidth={resolveStyleValue(style?.strokeWidth, context) ?? 0.5}
            strokeDasharray={resolveStyleValue(style?.strokeDasharray, context) ?? "3 3"}
            {...(opacity != null ? { opacity } : {})}
          />
        );
      })}
    </g>
  );
}

function Envelopes({
  envelopes,
  plotArea,
  xDomain,
  yDomain,
  theme,
  style,
}: {
  envelopes: LineChartEnvelopeModel[];
  plotArea: LineChartModel["layout"]["plotArea"];
  xDomain: readonly [number, number];
  yDomain: readonly [number, number];
  theme: UITheme;
  style: LineChartEnvelopesStyle | undefined;
}) {
  if (envelopes.length === 0) return null;
  const xRange = xDomain[1] - xDomain[0] || 1;
  const yRange = yDomain[1] - yDomain[0] || 1;
  const projectX = (x: number) =>
    plotArea.x + ((x - xDomain[0]) / xRange) * plotArea.width;
  const projectY = (y: number) =>
    plotArea.y + plotArea.height - ((y - yDomain[0]) / yRange) * plotArea.height;

  return (
    <g data-testid="line-envelopes" pointerEvents="none">
      {envelopes.map((env, i) => {
        const context: LineChartEnvelopeStyleContext = { envelope: env, theme };
        if (resolveStyleValue(style?.show, context) === false) return null;
        const opacity = resolveStyleValue(style?.opacity, context) ?? env.opacity;
        return (
          <g key={env.id ?? `envelope-${i}`} data-envelope-id={env.id ?? undefined}>
            {env.paths.map((path, j) => {
              const pts = path.points
                .map((p) => `${projectX(p.x)},${projectY(p.y)}`)
                .join(" ");
              const fill = resolveStyleValue(style?.fill, context) ?? path.fill;
              return (
                <polygon
                  key={`${env.id ?? i}-${j}`}
                  points={pts}
                  fill={fill}
                  opacity={opacity}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

function DualYAxis({
  model,
  theme,
  tickFontSize,
}: {
  model: LineChartModel;
  theme: UITheme;
  tickFontSize: number;
}) {
  if (model.axes.y2 == null) return null;
  const { plotArea } = model.layout;
  const [yMin, yMax] = model.axes.y2.domain;
  const yRange = yMax - yMin || 1;
  const x = plotArea.x + plotArea.width;
  return (
    <g data-testid="line-y2-axis">
      <line
        x1={x}
        y1={plotArea.y}
        x2={x}
        y2={plotArea.y + plotArea.height}
        stroke={theme.axis.line}
        strokeWidth={1}
      />
      {model.axes.y2.ticks.map((tick, i) => {
        const yPos =
          plotArea.y + plotArea.height - ((tick - yMin) / yRange) * plotArea.height;
        return (
          <g key={`y2tick-${i}`}>
            <line
              x1={x}
              y1={yPos}
              x2={x + 5}
              y2={yPos}
              stroke={theme.axis.line}
              strokeWidth={1}
            />
            <text
              x={x + 8}
              y={yPos + 3.5}
              textAnchor="start"
              fill={theme.text.muted}
              fontSize={tickFontSize}
            >
              {model.axes.y2?.tickLabels[i]}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function SeriesLines({
  series,
  hoveredId,
  backgroundOpacity,
  inactiveFadeMultiplier,
  staticMode,
  onHoverSeries,
  onLineCursorMove,
  onLineCursorLeave,
  theme,
  style,
}: {
  series: LineChartSeriesModel[];
  hoveredId: string | null;
  backgroundOpacity: number;
  inactiveFadeMultiplier: number;
  staticMode: boolean;
  onHoverSeries?: (id: string | null) => void;
  onLineCursorMove?: (e: React.MouseEvent, s: LineChartSeriesModel) => void;
  onLineCursorLeave?: () => void;
  theme: UITheme;
  style: LineChartLinesStyle | undefined;
}) {
  return (
    <g data-testid="line-series">
      {series.map((s) => {
        const context: LineChartLineStyleContext = { series: s, theme, hoveredId };
        if (resolveStyleValue(style?.show, context) === false) return null;
        const isHovered = hoveredId === s.id;
        const hasHover = hoveredId !== null;
        const base = s.highlighted ? 1 : backgroundOpacity;
        const opacity =
          resolveStyleValue(style?.opacity, context) ??
          (isHovered ? 1 : hasHover ? base * inactiveFadeMultiplier : base);

        const dash =
          resolveStyleValue(style?.strokeDasharray, context) ?? s.strokeDasharray;
        const stroke = resolveStyleValue(style?.stroke, context) ?? s.color;
        const strokeWidth =
          resolveStyleValue(style?.strokeWidth, context) ?? (s.highlighted ? 2 : 1.25);

        return (
          <g key={s.id}>
            <path
              d={s.path}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              {...(dash != null ? { strokeDasharray: dash } : {})}
              opacity={opacity}
              style={{ transition: "opacity 0.15s" }}
              pointerEvents="none"
            />
            {!staticMode && onHoverSeries ? (
              <path
                d={s.path}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                strokeLinecap="round"
                strokeLinejoin="round"
                role="button"
                tabIndex={0}
                aria-label={`${s.label} trend`}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => {
                  onHoverSeries(s.id);
                  onLineCursorMove?.(e, s);
                }}
                onMouseMove={(e) => {
                  onHoverSeries(s.id);
                  onLineCursorMove?.(e, s);
                }}
                onMouseLeave={(e) => {
                  const related = e.relatedTarget as Element | null;
                  const stillInside =
                    related instanceof Element
                      ? related.closest("[data-testid='line-series']")
                      : null;
                  if (!stillInside) {
                    onHoverSeries(null);
                    onLineCursorLeave?.();
                  }
                }}
                onFocus={() => {
                  onHoverSeries(s.id);
                }}
                onBlur={() => {
                  onHoverSeries(null);
                  onLineCursorLeave?.();
                }}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

function Trendlines({
  series,
  hoveredId,
  backgroundOpacity,
  inactiveFadeMultiplier,
  theme,
  style,
}: {
  series: LineChartSeriesModel[];
  hoveredId: string | null;
  backgroundOpacity: number;
  inactiveFadeMultiplier: number;
  theme: UITheme;
  style: LineChartTrendlineStyle | undefined;
}) {
  const visible = series.filter((s) => s.trendline != null);
  if (visible.length === 0) return null;
  return (
    <g data-testid="line-trendlines" pointerEvents="none">
      {visible.map((s) => {
        const context: LineChartTrendlineStyleContext = { series: s, theme };
        if (resolveStyleValue(style?.show, context) === false) return null;
        const isHovered = hoveredId === s.id;
        const hasHover = hoveredId !== null;
        const base = s.highlighted ? 0.8 : backgroundOpacity;
        const opacity =
          resolveStyleValue(style?.opacity, context) ??
          (isHovered ? 1 : hasHover ? base * inactiveFadeMultiplier : base);
        return (
          <path
            key={`tl-${s.id}`}
            d={s.trendline?.path ?? ""}
            fill="none"
            stroke={resolveStyleValue(style?.stroke, context) ?? s.color}
            strokeWidth={resolveStyleValue(style?.strokeWidth, context) ?? 1.5}
            strokeDasharray={resolveStyleValue(style?.strokeDasharray, context) ?? "5 4"}
            opacity={opacity}
          />
        );
      })}
    </g>
  );
}

/**
 * If markerKind is a known PointShape, use it as the default marker shape
 * for that point. Consumers can still override via `points.shape` style.
 */
const KNOWN_POINT_SHAPES: ReadonlyArray<PointShape> = [
  "circle",
  "square",
  "triangle",
  "hexagon",
  "diamond",
];
function shapeFromMarkerKind(kind: string | null): PointShape | undefined {
  if (kind == null) return undefined;
  return (KNOWN_POINT_SHAPES as readonly string[]).includes(kind)
    ? (kind as PointShape)
    : undefined;
}

function Markers({
  series,
  markerRadius,
  hoveredId,
  backgroundOpacity,
  inactiveFadeMultiplier,
  staticMode,
  onHoverPoint,
  formatAccessibleX,
  theme,
  style,
}: {
  series: LineChartSeriesModel[];
  markerRadius: number;
  hoveredId: string | null;
  backgroundOpacity: number;
  inactiveFadeMultiplier: number;
  staticMode: boolean;
  onHoverPoint?: (point: HoveredPoint | null) => void;
  formatAccessibleX: (x: number) => string;
  theme: UITheme;
  style: LineChartPointsStyle | undefined;
}) {
  return (
    <g data-testid="line-markers">
      {series.map((s) => {
        if (!s.showMarkers) return null;
        const isHovered = hoveredId === s.id;
        const hasHover = hoveredId !== null;
        const base = s.highlighted ? 1 : backgroundOpacity;
        const seriesOpacity = isHovered
          ? 1
          : hasHover
            ? base * inactiveFadeMultiplier
            : base;

        return s.points.map((pt) => {
          const context: LineChartPointStyleContext = {
            series: s,
            point: pt,
            theme,
            hoveredId,
          };
          if (resolveStyleValue(style?.show, context) === false) return null;
          const defaultShape = shapeFromMarkerKind(pt.markerKind) ?? "circle";
          const mark = (
            <ChartPointMark
              cx={pt.cx}
              cy={pt.cy}
              r={resolveStyleValue(style?.radius, context) ?? markerRadius}
              shape={resolveStyleValue(style?.shape, context) ?? defaultShape}
              fill={resolveStyleValue(style?.fill, context) ?? "#ffffff"}
              stroke={resolveStyleValue(style?.stroke, context) ?? s.color}
              strokeWidth={resolveStyleValue(style?.strokeWidth, context) ?? 1.5}
              opacity={resolveStyleValue(style?.opacity, context) ?? seriesOpacity}
            />
          );
          if (staticMode || !onHoverPoint) {
            return <g key={`${s.id}-${pt.x}`}>{mark}</g>;
          }
          const activate = () => {
            onHoverPoint({
              x: pt.x,
              y: pt.y,
              cx: pt.cx,
              cy: pt.cy,
              markerKind: pt.markerKind,
              pointLabel: pt.label,
              id: s.id,
              label: s.label,
              color: s.color,
            });
          };
          return (
            <g
              key={`${s.id}-${pt.x}`}
              role="button"
              tabIndex={0}
              aria-label={`${s.label} at ${formatAccessibleX(pt.x)}: ${pt.label}`}
              style={{ cursor: "pointer" }}
              onMouseEnter={activate}
              onMouseMove={activate}
              onFocus={activate}
              onClick={activate}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate();
                }
              }}
              onMouseLeave={(e) => {
                // Only clear when leaving the markers layer entirely; quick
                // traversal between adjacent markers can fire leave-after-enter
                // and briefly drop hoveredId otherwise.
                const related = e.relatedTarget as Element | null;
                const stillInside =
                  related instanceof Element
                    ? related.closest("[data-testid='line-markers']")
                    : null;
                if (!stillInside) onHoverPoint(null);
              }}
              onBlur={() => {
                onHoverPoint(null);
              }}
            >
              {mark}
            </g>
          );
        });
      })}
    </g>
  );
}

function DefaultEndLabel({ label, value, color }: LineChartEndLabelRenderProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color,
        fontWeight: 700,
        fontSize: 10,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {label}
      <span style={{ opacity: 0.7, fontWeight: 500 }}>
        {Number.isFinite(value) ? value.toFixed(2) : ""}
      </span>
    </span>
  );
}

function HtmlEndLabels({
  endLabels,
  viewBox,
  renderEndLabel,
  theme,
  style,
}: {
  endLabels: LineChartEndLabelModel[];
  viewBox: { width: number; height: number };
  renderEndLabel: ((props: LineChartEndLabelRenderProps) => ReactNode) | undefined;
  theme: UITheme;
  style: LineChartLabelsStyle | undefined;
}) {
  if (endLabels.length === 0) return null;
  const render = renderEndLabel ?? DefaultEndLabel;
  return (
    <div data-testid="line-end-labels" style={{ pointerEvents: "none" }}>
      {endLabels.map((label) => {
        const context: LineChartLabelStyleContext = { label, theme };
        if (resolveStyleValue(style?.show, context) === false) return null;
        const leftPct = (label.x / viewBox.width) * 100;
        const topPct = (label.y / viewBox.height) * 100;
        const resolvedColor = resolveStyleValue(style?.fill, context) ?? label.color;
        const resolvedOpacity = resolveStyleValue(style?.opacity, context) ?? 1;
        return (
          <div
            key={label.id}
            style={{
              position: "absolute",
              left: `${leftPct}%`,
              top: `${topPct}%`,
              transform: "translateY(-50%)",
              color: resolvedColor,
              opacity: resolvedOpacity,
            }}
          >
            {render({
              id: label.id,
              label: label.label,
              color: resolvedColor,
              value: label.value,
            })}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

function LineChartScene({
  model,
  theme,
  showGridLines,
  showMarkers,
  markerRadius,
  backgroundOpacity,
  inactiveFadeMultiplier,
  hoveredId,
  staticMode,
  onHoverSeries,
  onHoverPoint,
  onLineCursorMove,
  onLineCursorLeave,
  formatAccessibleX,
  lineStyle,
  pointStyle,
  guideStyle,
  trendlineStyle,
  bandsStyle,
  referencesStyle,
  envelopesStyle,
  onWarn,
}: {
  model: LineChartModel;
  theme: UITheme;
  showGridLines: boolean;
  showMarkers: boolean;
  markerRadius: number;
  backgroundOpacity: number;
  inactiveFadeMultiplier: number;
  hoveredId: string | null;
  staticMode: boolean;
  onHoverSeries?: (id: string | null) => void;
  onHoverPoint?: (point: HoveredPoint | null) => void;
  onLineCursorMove?: (e: React.MouseEvent, s: LineChartSeriesModel) => void;
  onLineCursorLeave?: () => void;
  formatAccessibleX: (x: number) => string;
  lineStyle: LineChartLinesStyle | undefined;
  pointStyle: LineChartPointsStyle | undefined;
  guideStyle: LineChartGuidesStyle | undefined;
  trendlineStyle: LineChartTrendlineStyle | undefined;
  bandsStyle: PlotAreaBandsStyle | undefined;
  referencesStyle: PlotAreaReferenceLinesStyle | undefined;
  envelopesStyle: LineChartEnvelopesStyle | undefined;
  onWarn?: (message: string) => void;
}) {
  const { viewBox, plotArea, frame } = model.layout;
  const tickFontSize = 10;
  const reactId = useId();
  const clipId = `line-plot-clip-${reactId.replace(/:/g, "_")}`;

  return (
    <svg
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      width="100%"
      height="100%"
      role={staticMode ? "img" : undefined}
      aria-label={staticMode ? model.meta.accessibleLabel : undefined}
      style={
        staticMode
          ? undefined
          : { width: "100%", height: "auto", overflow: "visible", display: "block" }
      }
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} />
        </clipPath>
      </defs>

      <ChartPlotAreaBackground plotArea={frame} theme={theme} />

      {!model.meta.empty ? (
        <>
          {model.bands.length > 0 ? (
            <ChartPlotAreaBands
              plotArea={plotArea}
              xDomain={model.axes.x.domain}
              yDomain={model.axes.y.domain}
              bands={model.bands}
              theme={theme}
              {...(bandsStyle ? { style: bandsStyle } : {})}
              {...(onWarn ? { onWarn } : {})}
              testId="line-bands"
            />
          ) : null}

          {showGridLines ? (
            <GridLines model={model} theme={theme} style={guideStyle} />
          ) : null}

          {(() => {
            const clipped = model.envelopes.filter((e) => e.clip);
            const overflowed = model.envelopes.filter((e) => !e.clip);
            return (
              <>
                {clipped.length > 0 ? (
                  <g clipPath={`url(#${clipId})`} data-testid="line-envelopes-clipped">
                    <Envelopes
                      envelopes={clipped}
                      plotArea={plotArea}
                      xDomain={model.axes.x.domain}
                      yDomain={model.axes.y.domain}
                      theme={theme}
                      style={envelopesStyle}
                    />
                  </g>
                ) : null}
                {overflowed.length > 0 ? (
                  <Envelopes
                    envelopes={overflowed}
                    plotArea={plotArea}
                    xDomain={model.axes.x.domain}
                    yDomain={model.axes.y.domain}
                    theme={theme}
                    style={envelopesStyle}
                  />
                ) : null}
              </>
            );
          })()}

          {model.references.length > 0 ? (
            <ChartPlotAreaReferenceLines
              plotArea={plotArea}
              xDomain={model.axes.x.domain}
              yDomain={model.axes.y.domain}
              lines={model.references}
              theme={theme}
              {...(referencesStyle ? { style: referencesStyle } : {})}
              {...(onWarn ? { onWarn } : {})}
              layer="body"
              testId="line-references"
            />
          ) : null}

          <g clipPath={`url(#${clipId})`}>
            <SeriesLines
              series={model.series}
              hoveredId={hoveredId}
              backgroundOpacity={backgroundOpacity}
              inactiveFadeMultiplier={inactiveFadeMultiplier}
              staticMode={staticMode}
              {...(onHoverSeries ? { onHoverSeries } : {})}
              {...(onLineCursorMove ? { onLineCursorMove } : {})}
              {...(onLineCursorLeave ? { onLineCursorLeave } : {})}
              theme={theme}
              style={lineStyle}
            />

            <Trendlines
              series={model.series}
              hoveredId={hoveredId}
              backgroundOpacity={backgroundOpacity}
              inactiveFadeMultiplier={inactiveFadeMultiplier}
              theme={theme}
              style={trendlineStyle}
            />

            {showMarkers ? (
              <Markers
                series={model.series}
                markerRadius={markerRadius}
                hoveredId={hoveredId}
                backgroundOpacity={backgroundOpacity}
                inactiveFadeMultiplier={inactiveFadeMultiplier}
                staticMode={staticMode}
                {...(onHoverPoint ? { onHoverPoint } : {})}
                formatAccessibleX={formatAccessibleX}
                theme={theme}
                style={pointStyle}
              />
            ) : null}
          </g>

          {model.references.length > 0 ? (
            <ChartPlotAreaReferenceLines
              plotArea={plotArea}
              xDomain={model.axes.x.domain}
              yDomain={model.axes.y.domain}
              lines={model.references}
              theme={theme}
              {...(referencesStyle ? { style: referencesStyle } : {})}
              layer="labels"
              testId="line-reference-labels"
            />
          ) : null}

          <ChartCartesianAxes
            plotArea={plotArea}
            frame={frame}
            xAxis={{
              label: model.axes.x.label,
              domain: model.axes.x.domain,
              ticks: model.axes.x.ticks,
            }}
            yAxis={{
              label: model.axes.y.label,
              domain: model.axes.y.domain,
              ticks: model.axes.y.ticks,
            }}
            theme={theme}
            testId="line-axes"
            tickFontSize={tickFontSize}
            formatTick={(tick, axis) => {
              const source = axis === "x" ? model.axes.x : model.axes.y;
              const idx = source.ticks.indexOf(tick);
              return idx >= 0 ? source.tickLabels[idx] : `${tick}`;
            }}
          />

          <DualYAxis model={model} theme={theme} tickFontSize={tickFontSize} />
        </>
      ) : staticMode ? (
        <ChartSvgEmptyState
          x={viewBox.width / 2}
          y={viewBox.height / 2}
          message={model.emptyState?.message ?? "No data"}
          theme={theme}
          fontWeight={600}
        />
      ) : null}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function buildModel(
  props: ComputeLineChartInput & { trendlines?: boolean },
): LineChartModel {
  return computeLineChart(props);
}

const defaultAccessibleX = (x: number) => String(x);

export function LineChartStaticSvg({
  theme = LIGHT_THEME,
  ...props
}: LineChartProps & { theme?: UITheme }) {
  const {
    showMarkers = true,
    showGridLines = true,
    markerRadius = 3,
    backgroundOpacity = 0.25,
    inactiveFadeMultiplier = 0.35,
    formatAccessibleX = defaultAccessibleX,
    lines,
    points,
    guides,
    trendlineStyle,
    bandsStyle,
    referencesStyle,
    envelopesStyle,
  } = props;
  const model = buildModel(props);
  return (
    <LineChartScene
      model={model}
      theme={theme}
      showGridLines={showGridLines}
      showMarkers={showMarkers}
      markerRadius={markerRadius}
      backgroundOpacity={backgroundOpacity}
      inactiveFadeMultiplier={inactiveFadeMultiplier}
      hoveredId={null}
      staticMode={true}
      formatAccessibleX={formatAccessibleX}
      lineStyle={lines}
      pointStyle={points}
      guideStyle={guides}
      trendlineStyle={trendlineStyle}
      bandsStyle={bandsStyle}
      referencesStyle={referencesStyle}
      envelopesStyle={envelopesStyle}
    />
  );
}

export function LineChart(props: LineChartProps) {
  const {
    renderEndLabel,
    inactiveFadeMultiplier = 0.35,
    backgroundOpacity = 0.25,
    showMarkers = true,
    showGridLines = true,
    markerRadius = 3,
    lineTooltip,
    tooltipPriority = "marker",
    formatAccessibleX = defaultAccessibleX,
    methodologyNotes,
    staticMode = false,
    lines,
    points,
    labels,
    guides,
    trendlineStyle,
    bandsStyle,
    referencesStyle,
    envelopesStyle,
  } = props;

  const theme = useTheme();
  const {
    containerRef: cursorTooltipContainerRef,
    show: showCursorTooltip,
    hide: hideCursorTooltip,
    element: cursorTooltipElement,
  } = useCursorTooltip(theme);

  // Memo deps are the individual inputs that affect the model, not `props`
  // itself (which is a fresh object every render). Listing them keeps the
  // cache hot while still recomputing when inputs genuinely change.
  const {
    series,
    xDomain,
    yDomain,
    xTicks,
    yTicks,
    xTickFormat,
    yTickFormat,
    xAxisLabel,
    yAxisLabel,
    dualYAxis,
    trendlines,
    highlightSeries,
    maxHighlight,
    showEndLabels,
    endLabelsForAllSeries,
    references,
    bands,
    envelopes,
    axisPadding,
    yScale,
  } = props;
  const model = useMemo(
    () =>
      buildModel({
        series,
        ...(xDomain != null ? { xDomain } : {}),
        ...(yDomain != null ? { yDomain } : {}),
        ...(xTicks != null ? { xTicks } : {}),
        ...(yTicks != null ? { yTicks } : {}),
        ...(xTickFormat != null ? { xTickFormat } : {}),
        ...(yTickFormat != null ? { yTickFormat } : {}),
        ...(xAxisLabel != null ? { xAxisLabel } : {}),
        ...(yAxisLabel != null ? { yAxisLabel } : {}),
        ...(dualYAxis != null ? { dualYAxis } : {}),
        ...(trendlines != null ? { trendlines } : {}),
        ...(highlightSeries != null ? { highlightSeries } : {}),
        ...(maxHighlight != null ? { maxHighlight } : {}),
        ...(showEndLabels != null ? { showEndLabels } : {}),
        ...(endLabelsForAllSeries != null ? { endLabelsForAllSeries } : {}),
        ...(axisPadding != null ? { axisPadding } : {}),
        ...(references != null ? { references } : {}),
        ...(bands != null ? { bands } : {}),
        ...(envelopes != null ? { envelopes } : {}),
        ...(yScale != null ? { yScale } : {}),
      }),
    [
      series,
      xDomain,
      yDomain,
      xTicks,
      yTicks,
      xTickFormat,
      yTickFormat,
      xAxisLabel,
      yAxisLabel,
      dualYAxis,
      trendlines,
      highlightSeries,
      maxHighlight,
      showEndLabels,
      endLabelsForAllSeries,
      references,
      bands,
      envelopes,
      axisPadding,
      yScale,
    ],
  );

  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleHoverPoint = useCallback((pt: HoveredPoint | null) => {
    setHoveredPoint(pt);
    setHoveredId(pt?.id ?? null);
  }, []);

  const handleHoverSeries = useCallback((id: string | null) => {
    setHoveredId(id);
    if (id === null) setHoveredPoint(null);
  }, []);

  const plot = (
    <div ref={cursorTooltipContainerRef} style={{ position: "relative" }}>
      <LineChartScene
        model={model}
        theme={theme}
        showGridLines={showGridLines}
        showMarkers={showMarkers}
        markerRadius={markerRadius}
        backgroundOpacity={backgroundOpacity}
        inactiveFadeMultiplier={inactiveFadeMultiplier}
        hoveredId={hoveredId}
        staticMode={staticMode}
        onHoverSeries={handleHoverSeries}
        onHoverPoint={handleHoverPoint}
        formatAccessibleX={formatAccessibleX}
        {...(lineTooltip
          ? {
              onLineCursorMove: (e, s) => {
                // Marker priority suppresses the cursor tooltip when a
                // marker is hovered simultaneously. `"line"` suppresses the
                // marker path instead (handled below). `"both"` keeps both.
                if (tooltipPriority === "marker" && hoveredPoint != null) {
                  hideCursorTooltip();
                  return;
                }
                showCursorTooltip(e, lineTooltip.renderContent(s));
              },
              onLineCursorLeave: () => {
                hideCursorTooltip();
              },
            }
          : {})}
        lineStyle={lines}
        pointStyle={points}
        guideStyle={guides}
        trendlineStyle={trendlineStyle}
        bandsStyle={bandsStyle}
        referencesStyle={referencesStyle}
        envelopesStyle={envelopesStyle}
      />
      {lineTooltip ? cursorTooltipElement : null}

      {!staticMode && !model.meta.empty ? (
        <HtmlEndLabels
          endLabels={model.endLabels}
          viewBox={model.layout.viewBox}
          renderEndLabel={renderEndLabel}
          theme={theme}
          style={labels}
        />
      ) : null}

      {model.emptyState != null ? (
        <EmptyState message={model.emptyState.message} theme={theme} />
      ) : null}

      {!staticMode && hoveredPoint != null && tooltipPriority !== "line" ? (
        <ChartTooltip
          testId="line-tooltip"
          rows={[
            { label: "Series", value: hoveredPoint.label },
            {
              label: model.axes.x.label || "x",
              value: formatAccessibleX(hoveredPoint.x),
            },
            { label: model.axes.y.label || "y", value: hoveredPoint.pointLabel },
          ]}
          theme={theme}
        />
      ) : null}
    </div>
  );

  return (
    <ChartFrame
      ariaLabel={model.meta.accessibleLabel}
      chartKind="line-chart"
      empty={model.emptyState != null}
      maxWidth={800}
      plot={plot}
      methodologyNotes={methodologyNotes}
      staticMode={staticMode}
      theme={theme}
      fontFamily={'"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif'}
      warnings={model.meta.warnings}
    />
  );
}
