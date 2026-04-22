import { useId, useMemo, useState } from "react";

import {
  computeRadarChart,
  type ComputeRadarChartInput,
  type RadarChartAxisModel,
  type RadarChartBandModel,
  type RadarChartModel,
  type RadarChartPolygonModel,
  type RadarChartRingModel,
} from "./compute/index.js";

import { useTheme } from "./ThemeContext.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";
import { LIGHT_THEME, type UITheme } from "./theme.js";
import { resolveThemePalette, type ThemePalette } from "./themePalette.js";
import {
  ChartFrame,
  ChartLegend,
  type ChartMethodologyNotes,
  ChartSvgEmptyState,
  ChartTooltip,
  EmptyState,
  LABEL_ANGLE_PADDING,
  LABEL_FONT_SIZE,
  LABEL_LINE_HEIGHT,
  labelArcPath,
  ringPath,
  roundSvg,
  wrapLabel,
} from "./primitives/index.js";

export type RadarChartProps = Omit<
  ComputeRadarChartInput,
  "ringColors" | "outerRingColors" | "categoryColors"
> & {
  ringColors?: ThemePalette;
  outerRingColors?: ThemePalette;
  categoryColors?: ThemePalette;
  methodologyNotes?: ChartMethodologyNotes;
  areas?: RadarChartAreasStyle;
  guides?: RadarChartGuidesStyle;
  text?: RadarChartTextStyle;
  /**
   * When true, render a small coloured value pill at each polygon vertex
   * showing the row's displayValue. Useful for comparison radars.
   */
  showVertexValues?: boolean;
};

export type RadarChartAreaStyleContext = {
  polygon: RadarChartPolygonModel;
  /** Convenience copy of polygon.seriesId for series-aware callbacks. */
  seriesId: string;
  /** Convenience copy of polygon.seriesLabel. */
  seriesLabel: string;
  /** 0-based index of this series in the input series array. */
  seriesIndex: number;
  theme: UITheme;
};

export type RadarChartAreasStyle = {
  fill?: StyleValue<string, RadarChartAreaStyleContext>;
  fillOpacity?: StyleValue<number, RadarChartAreaStyleContext>;
  stroke?: StyleValue<string, RadarChartAreaStyleContext>;
  strokeWidth?: StyleValue<number, RadarChartAreaStyleContext>;
  markerFill?: StyleValue<string, RadarChartAreaStyleContext>;
  markerStroke?: StyleValue<string, RadarChartAreaStyleContext>;
};

export type RadarChartGuideStyleContext = {
  theme: UITheme;
};

export type RadarChartGuidesStyle = {
  ringStroke?: StyleValue<string, RadarChartGuideStyleContext>;
  ringStrokeWidth?: StyleValue<number, RadarChartGuideStyleContext>;
  ringStrokeDasharray?: StyleValue<string, RadarChartGuideStyleContext>;
  spokeStroke?: StyleValue<string, RadarChartGuideStyleContext>;
  spokeStrokeWidth?: StyleValue<number, RadarChartGuideStyleContext>;
};

export type RadarChartTextStyleContext = {
  axis: RadarChartAxisModel;
  theme: UITheme;
};

export type RadarChartTextStyle = {
  fill?: StyleValue<string, RadarChartTextStyleContext>;
};

// ---------------------------------------------------------------------------
// Sub-components (chart-specific)
// ---------------------------------------------------------------------------

function Bands({
  bands,
  cx,
  cy,
  clipPathId,
  testId = "radar-bands",
}: {
  bands: RadarChartBandModel[];
  cx: number;
  cy: number;
  clipPathId?: string;
  testId?: string;
}) {
  return (
    <g data-testid={testId} {...(clipPathId ? { clipPath: `url(#${clipPathId})` } : {})}>
      {bands.map((band, i) => {
        // Each band is an annulus: outer circle minus inner circle, filled
        // with even-odd so the ring is preserved. This is what makes
        // alternating colors actually show — a full-circle fill would paint
        // over every inner band.
        const d =
          band.innerRadius > 0
            ? `${ringPath(band.outerRadius, cx, cy)} ${ringPath(band.innerRadius, cx, cy)}`
            : ringPath(band.outerRadius, cx, cy);
        return <path key={i} d={d} fill={band.color} fillRule="evenodd" stroke="none" />;
      })}
    </g>
  );
}

function Rings({
  rings,
  cx,
  cy,
  theme,
  guidesStyle,
}: {
  rings: RadarChartRingModel[];
  cx: number;
  cy: number;
  theme: UITheme;
  guidesStyle: RadarChartGuidesStyle | undefined;
}) {
  const guideContext: RadarChartGuideStyleContext = { theme };
  return (
    <g data-testid="radar-rings">
      {rings.map((ring) => (
        <g key={ring.value}>
          <path
            d={ringPath(ring.radius, cx, cy)}
            fill="none"
            stroke={
              resolveStyleValue(guidesStyle?.ringStroke, guideContext) ?? theme.axis.grid
            }
            strokeWidth={
              resolveStyleValue(guidesStyle?.ringStrokeWidth, guideContext) ?? 0.5
            }
            strokeDasharray={
              resolveStyleValue(guidesStyle?.ringStrokeDasharray, guideContext) ?? "3 3"
            }
          />
          {ring.label && (
            <text
              x={roundSvg(cx)}
              y={roundSvg(cy - ring.radius - 2)}
              textAnchor="middle"
              fill={theme.text.muted}
              fontSize={7}
              pointerEvents="none"
            >
              {ring.label}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

function Spokes({
  axes,
  theme,
  guidesStyle,
}: {
  axes: RadarChartAxisModel[];
  theme: UITheme;
  guidesStyle: RadarChartGuidesStyle | undefined;
}) {
  const guideContext: RadarChartGuideStyleContext = { theme };
  return (
    <g data-testid="radar-spokes">
      {axes.map((axis) => (
        <line
          key={axis.index}
          x1={roundSvg(axis.x1)}
          y1={roundSvg(axis.y1)}
          x2={roundSvg(axis.x2)}
          y2={roundSvg(axis.y2)}
          stroke={
            resolveStyleValue(guidesStyle?.spokeStroke, guideContext) ?? theme.axis.grid
          }
          strokeWidth={
            resolveStyleValue(guidesStyle?.spokeStrokeWidth, guideContext) ?? 0.3
          }
        />
      ))}
    </g>
  );
}

function SpokeTicks({
  axes,
  cx,
  cy,
  theme,
  uid,
  polygon,
  invertInsidePolygon,
  textStyle,
}: {
  axes: RadarChartAxisModel[];
  cx: number;
  cy: number;
  theme: UITheme;
  uid: string;
  polygon: RadarChartPolygonModel | null;
  /**
   * When true, tick labels whose normalized position is within the polygon's
   * extent along the same spoke are rendered in white + bold so they remain
   * readable against dense polygon-interior fill bands.
   */
  invertInsidePolygon: boolean;
  /**
   * Shared text style — `text.fill` is used as the non-inverted tick colour
   * so a single `text={{ fill: "#000" }}` makes both outer metric labels
   * and unemphasised tick labels black in one pass.
   */
  textStyle: RadarChartTextStyle | undefined;
}) {
  const hasTicks = axes.some((a) => a.ticks.length > 0);
  if (!hasTicks) return null;

  const TICK_ARC_FRACTION = 0.6;

  return (
    <g data-testid="radar-spoke-ticks" pointerEvents="none">
      <defs>
        {axes.flatMap((axis) =>
          axis.ticks.map((tick, ti) => {
            const halfAngle = (axis.sliceAngle * TICK_ARC_FRACTION) / 2;
            const r = tick.normalizedPosition * 140;
            return (
              <path
                key={`rtp-${uid}-${axis.index}-${ti}`}
                id={`rtk-${uid}-${axis.index}-${ti}`}
                d={labelArcPath(axis.angle, halfAngle, r, cx, cy, axis.flip)}
                fill="none"
              />
            );
          }),
        )}
      </defs>
      {axes.flatMap((axis) =>
        axis.ticks.map((tick, ti) => {
          const vertexReach = polygon?.vertices[axis.index]?.normalizedValue ?? 0;
          const insidePolygon =
            invertInsidePolygon && tick.normalizedPosition <= vertexReach;
          const nonInvertedFill =
            resolveStyleValue(textStyle?.fill, { axis, theme }) ?? theme.text.muted;
          return (
            <text
              key={`rtt-${uid}-${axis.index}-${ti}`}
              fill={insidePolygon ? "#ffffff" : nonInvertedFill}
              fontSize={6.5}
              fontWeight={insidePolygon ? 700 : 400}
              data-inside-polygon={insidePolygon ? "true" : "false"}
            >
              <textPath
                href={`#rtk-${uid}-${axis.index}-${ti}`}
                startOffset="50%"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {tick.value}
              </textPath>
            </text>
          );
        }),
      )}
    </g>
  );
}

function CurvedLabels({
  axes,
  cx,
  cy,
  theme,
  uid,
  textStyle,
}: {
  axes: RadarChartAxisModel[];
  cx: number;
  cy: number;
  theme: UITheme;
  uid: string;
  textStyle: RadarChartTextStyle | undefined;
}) {
  const labelData = axes.map((axis) => {
    const effectiveAngle = Math.max(0, axis.sliceAngle - 2 * LABEL_ANGLE_PADDING);
    const arcLen = effectiveAngle * axis.labelRadius;
    const lines = wrapLabel(axis.metric, arcLen);
    const halfAngle = effectiveAngle / 2;
    return { axis, lines, halfAngle };
  });

  return (
    <g data-testid="radar-labels" pointerEvents="none">
      <defs>
        {labelData.flatMap(({ axis, lines, halfAngle }) =>
          lines.map((_, lineIdx) => {
            const r = axis.labelRadius + lineIdx * LABEL_LINE_HEIGHT;
            return (
              <path
                key={`rlp-${axis.index}-${lineIdx}`}
                id={`rla-${uid}-${axis.index}-${lineIdx}`}
                d={labelArcPath(axis.angle, halfAngle, r, cx, cy, axis.flip)}
                fill="none"
              />
            );
          }),
        )}
      </defs>
      {labelData.flatMap(({ axis, lines }) =>
        lines.map((line, lineIdx) => (
          <text
            key={`rlt-${axis.index}-${lineIdx}`}
            fill={
              resolveStyleValue(textStyle?.fill, { axis, theme }) ??
              axis.color ??
              theme.axis.label
            }
            fontSize={LABEL_FONT_SIZE}
            fontWeight={600}
          >
            <textPath
              href={`#rla-${uid}-${axis.index}-${lineIdx}`}
              startOffset="50%"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {line}
            </textPath>
          </text>
        )),
      )}
    </g>
  );
}

function PolygonLayer({
  polygon,
  polygonIndex,
  hoveredIndex,
  showMarkers,
  theme,
  areasStyle,
  transparentDefaultFill,
  multipleSeries,
}: {
  polygon: RadarChartPolygonModel;
  polygonIndex: number;
  hoveredIndex: number | null;
  showMarkers: boolean;
  theme: UITheme;
  areasStyle: RadarChartAreasStyle | undefined;
  transparentDefaultFill: boolean;
  /** True when more than one series is being rendered — drops the default
   * fill opacity so overlapping polygons remain legible. */
  multipleSeries: boolean;
}) {
  const areaContext: RadarChartAreaStyleContext = {
    polygon,
    seriesId: polygon.seriesId,
    seriesLabel: polygon.seriesLabel,
    seriesIndex: polygonIndex,
    theme,
  };
  const defaultFill = transparentDefaultFill ? "transparent" : polygon.fillColor;
  const baseFillOpacity = transparentDefaultFill ? 1 : multipleSeries ? 0.35 : 0.25;
  return (
    <g
      data-testid={`radar-polygon-${polygon.seriesId}`}
      data-series-id={polygon.seriesId}
    >
      <path
        d={polygon.path}
        fill={resolveStyleValue(areasStyle?.fill, areaContext) ?? defaultFill}
        fillOpacity={
          resolveStyleValue(areasStyle?.fillOpacity, areaContext) ?? baseFillOpacity
        }
        stroke={resolveStyleValue(areasStyle?.stroke, areaContext) ?? polygon.strokeColor}
        strokeWidth={resolveStyleValue(areasStyle?.strokeWidth, areaContext) ?? 1.5}
        strokeOpacity={0.9}
        strokeLinejoin="round"
      />
      {showMarkers &&
        polygon.vertices.map((v) => {
          const highlighted = hoveredIndex === v.index;
          const r = highlighted ? 4 : 3;
          return (
            <circle
              key={v.index}
              cx={roundSvg(v.x)}
              cy={roundSvg(v.y)}
              r={r}
              fill={
                resolveStyleValue(areasStyle?.markerFill, areaContext) ??
                polygon.fillColor
              }
              stroke={
                resolveStyleValue(areasStyle?.markerStroke, areaContext) ??
                polygon.strokeColor
              }
              strokeWidth={1}
              style={{ transition: "r 0.1s" }}
              pointerEvents="none"
              data-testid={`radar-vertex-${polygon.seriesId}-${v.index}`}
            />
          );
        })}
    </g>
  );
}

/**
 * Small coloured pill above each vertex showing the raw displayValue.
 * In multi-series mode, pills for the same slot are offset radially so
 * they don't overlap.
 */
function VertexValuePills({ polygons }: { polygons: RadarChartPolygonModel[] }) {
  // The pill's default position is the vertex itself, nudged slightly outward
  // along the spoke so it sits on top of the polygon edge rather than inside.
  const PILL_PAD_X = 4;
  const PILL_PAD_Y = 2;
  const PILL_RADIUS = 2.5;
  const FONT_SIZE = 7;
  return (
    <g data-testid="radar-vertex-value-pills" pointerEvents="none">
      {polygons.flatMap((polygon, pi) =>
        polygon.vertices.map((v) => {
          // Nudge outward along the spoke so pills sit just outside the
          // polygon edge. When multiple polygons overlap a slot, stack them
          // radially (further out for later series).
          const outwardOffset = 10 + pi * 14;
          const nudgedX = Math.cos(v.angle) * outwardOffset;
          const nudgedY = Math.sin(v.angle) * outwardOffset;
          const cx = v.x + nudgedX;
          const cy = v.y + nudgedY;
          const charWidth = FONT_SIZE * 0.52;
          const textWidth = Math.max(charWidth * v.displayValue.length, charWidth * 2);
          const pillW = textWidth + PILL_PAD_X * 2;
          const pillH = FONT_SIZE + PILL_PAD_Y * 2;
          return (
            <g key={`${polygon.seriesId}-${v.index}`}>
              <rect
                x={roundSvg(cx - pillW / 2)}
                y={roundSvg(cy - pillH / 2)}
                width={roundSvg(pillW)}
                height={roundSvg(pillH)}
                rx={PILL_RADIUS}
                ry={PILL_RADIUS}
                fill={polygon.fillColor}
                stroke={polygon.strokeColor}
                strokeWidth={0.5}
                opacity={0.92}
              />
              <text
                x={roundSvg(cx)}
                y={roundSvg(cy)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FONT_SIZE}
                fontWeight={700}
                fill="#ffffff"
              >
                {v.displayValue}
              </text>
            </g>
          );
        }),
      )}
    </g>
  );
}

function VertexHitTargets({
  polygons,
  onHover,
}: {
  polygons: RadarChartPolygonModel[];
  onHover: (index: number | null) => void;
}) {
  const [first] = polygons;
  if (first == null) return null;
  return (
    <g data-testid="radar-vertex-hit-targets">
      {first.vertices.map((v) => {
        // Aggregate the aria label across all series at this slot.
        const ariaLabel = polygons
          .map((p) => {
            const match = p.vertices[v.index];
            return match ? `${p.seriesLabel || p.seriesId}: ${match.displayValue}` : "";
          })
          .filter(Boolean)
          .join(", ");
        return (
          <circle
            key={v.index}
            cx={roundSvg(v.x)}
            cy={roundSvg(v.y)}
            r={8}
            fill="transparent"
            stroke="none"
            role="button"
            tabIndex={0}
            aria-label={`${v.metric} — ${ariaLabel || v.displayValue}`}
            onMouseEnter={() => {
              onHover(v.index);
            }}
            onFocus={() => {
              onHover(v.index);
            }}
            onMouseLeave={() => {
              onHover(null);
            }}
            onBlur={() => {
              onHover(null);
            }}
            onClick={() => {
              onHover(v.index);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onHover(v.index);
              }
            }}
            data-testid={`radar-vertex-hit-${v.index}`}
          />
        );
      })}
    </g>
  );
}

function buildRadarTooltipRows(
  model: RadarChartModel,
  hoveredIndex: number,
): Array<{ label: string; value: string }> | null {
  const [first] = model.polygons;
  if (first == null) return null;
  const primaryVertex = first.vertices[hoveredIndex];
  if (!primaryVertex) return null;

  const rows: Array<{ label: string; value: string }> = [
    { label: "Metric", value: primaryVertex.metric },
  ];

  if (model.polygons.length > 1) {
    // Multi-series: one row per series showing its value at this slot.
    for (const polygon of model.polygons) {
      const v = polygon.vertices[hoveredIndex];
      if (!v) continue;
      const label = polygon.seriesLabel || polygon.seriesId;
      rows.push({ label, value: v.displayValue });
    }
  } else {
    rows.push({ label: "Value", value: primaryVertex.displayValue });
  }

  if (primaryVertex.displayRangeMin != null && primaryVertex.displayRangeMax != null) {
    const rangeLabel = primaryVertex.lowerIsBetter ? "Range (lower is better)" : "Range";
    rows.push({
      label: rangeLabel,
      value: `${primaryVertex.displayRangeMin} – ${primaryVertex.displayRangeMax}`,
    });
  }
  if (primaryVertex.category !== "Uncategorized") {
    rows.push({ label: "Category", value: primaryVertex.category });
  }
  return rows;
}

function hasSparsePolygonFallback(model: RadarChartModel): boolean {
  return model.axes.length > 0 && model.axes.length < 3;
}

const SPARSE_POLYGON_MESSAGE = "Too few metrics - radar requires 3 or more";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function buildRadarChartModel(
  {
    rows,
    series,
    metricOrder,
    categoryOrder,
    valueMode,
    showLegend,
    showVertexMarkers = true,
    showAxisLabels,
    ringStyle,
    ringSteps,
    bandSteps,
    ringColors,
    outerRingColors,
    categoryColors,
    seriesColors,
  }: RadarChartProps,
  theme: UITheme,
) {
  const resolvedRingColors = resolveThemePalette(ringColors, theme);
  const resolvedOuterRingColors = resolveThemePalette(outerRingColors, theme);
  const resolvedCategoryColors = resolveThemePalette(categoryColors, theme);
  return computeRadarChart({
    ...(rows != null ? { rows } : {}),
    ...(series != null ? { series } : {}),
    ...(metricOrder != null ? { metricOrder } : {}),
    ...(categoryOrder != null ? { categoryOrder } : {}),
    ...(valueMode != null ? { valueMode } : {}),
    ...(showLegend != null ? { showLegend } : {}),
    showVertexMarkers,
    ...(showAxisLabels != null ? { showAxisLabels } : {}),
    ...(ringStyle != null ? { ringStyle } : {}),
    ...(ringSteps != null ? { ringSteps } : {}),
    ...(bandSteps != null ? { bandSteps } : {}),
    ...(resolvedRingColors != null ? { ringColors: resolvedRingColors } : {}),
    ...(resolvedOuterRingColors != null
      ? { outerRingColors: resolvedOuterRingColors }
      : {}),
    ...(resolvedCategoryColors != null ? { categoryColors: resolvedCategoryColors } : {}),
    ...(seriesColors != null ? { seriesColors } : {}),
  });
}

export function RadarChartStaticSvg({
  theme = LIGHT_THEME,
  ...props
}: RadarChartProps & { theme?: UITheme }) {
  const model = buildRadarChartModel(props, theme);
  const sparsePolygonFallback = hasSparsePolygonFallback(model);
  const uid = "radar-static";
  const { center, outerRadius: outerR, viewBoxSize } = model.geometry;
  const cx = center;
  const cy = center;
  const showVertexMarkers = props.showVertexMarkers ?? true;
  const showVertexValues = props.showVertexValues === true;
  const multipleSeries = model.polygons.length > 1;
  // When polygons clip bands, the first polygon acts as the clip shape.
  // Multi-series comparisons are incompatible with this mode — the clip
  // would bias toward one profile — so ignore the clip in that case.
  const clipBandsToPolygon =
    props.ringStyle === "banded-inside-polygon" &&
    !sparsePolygonFallback &&
    model.polygons.length === 1;
  const clipPolygon = clipBandsToPolygon ? model.polygons[0] : null;
  const bandsClipId = clipPolygon ? `radar-bands-clip-${uid}` : undefined;

  return (
    <svg
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={model.meta.accessibleLabel}
      style={{ display: "block", overflow: "visible" }}
    >
      {!model.meta.empty ? (
        <>
          {clipPolygon ? (
            <defs>
              <clipPath id={bandsClipId}>
                <path d={clipPolygon.path} />
              </clipPath>
            </defs>
          ) : null}
          {model.outerBands.length > 0 ? (
            <Bands bands={model.outerBands} cx={cx} cy={cy} testId="radar-outer-bands" />
          ) : null}
          {model.bands.length > 0 ? (
            <Bands
              bands={model.bands}
              cx={cx}
              cy={cy}
              {...(bandsClipId ? { clipPathId: bandsClipId } : {})}
            />
          ) : null}
          <Rings
            rings={model.rings}
            cx={cx}
            cy={cy}
            theme={theme}
            guidesStyle={props.guides}
          />
          <Spokes axes={model.axes} theme={theme} guidesStyle={props.guides} />
          <SpokeTicks
            axes={model.axes}
            cx={cx}
            cy={cy}
            theme={theme}
            uid={uid}
            polygon={clipPolygon ?? null}
            invertInsidePolygon={clipBandsToPolygon}
            textStyle={props.text}
          />
          <circle
            cx={roundSvg(cx)}
            cy={roundSvg(cy)}
            r={roundSvg(outerR)}
            fill="none"
            stroke={theme.axis.line}
            strokeWidth={0.5}
          />
          {!sparsePolygonFallback &&
            model.polygons.map((p, i) => (
              <PolygonLayer
                key={p.seriesId}
                polygon={p}
                polygonIndex={i}
                hoveredIndex={null}
                showMarkers={showVertexMarkers}
                theme={theme}
                areasStyle={props.areas}
                transparentDefaultFill={clipBandsToPolygon && i === 0}
                multipleSeries={multipleSeries}
              />
            ))}
          {!sparsePolygonFallback && showVertexValues && model.polygons.length > 0 ? (
            <VertexValuePills polygons={model.polygons} />
          ) : null}
          {model.axes.length > 0 ? (
            <CurvedLabels
              axes={model.axes}
              cx={cx}
              cy={cy}
              theme={theme}
              uid={uid}
              textStyle={props.text}
            />
          ) : null}
          {sparsePolygonFallback ? (
            <ChartSvgEmptyState
              x={roundSvg(viewBoxSize / 2)}
              y={roundSvg(viewBoxSize - 28)}
              message={SPARSE_POLYGON_MESSAGE}
              theme={theme}
            />
          ) : null}
        </>
      ) : (
        <ChartSvgEmptyState
          x={roundSvg(viewBoxSize / 2)}
          y={roundSvg(viewBoxSize / 2)}
          message={model.emptyState?.message ?? "No radar data"}
          theme={theme}
          dominantBaseline="central"
        />
      )}
    </svg>
  );
}

export function RadarChart({
  rows,
  series,
  metricOrder,
  categoryOrder,
  valueMode,
  showLegend,
  showVertexMarkers = true,
  showVertexValues = false,
  showAxisLabels,
  ringStyle,
  ringSteps,
  bandSteps,
  ringColors,
  outerRingColors,
  categoryColors,
  seriesColors,
  areas,
  guides,
  text,
  methodologyNotes,
}: RadarChartProps) {
  const theme = useTheme();
  const model = useMemo(
    () =>
      buildRadarChartModel(
        {
          ...(rows != null ? { rows } : {}),
          ...(series != null ? { series } : {}),
          ...(metricOrder != null ? { metricOrder } : {}),
          ...(categoryOrder != null ? { categoryOrder } : {}),
          ...(valueMode != null ? { valueMode } : {}),
          ...(showLegend != null ? { showLegend } : {}),
          showVertexMarkers,
          ...(showAxisLabels != null ? { showAxisLabels } : {}),
          ...(ringStyle != null ? { ringStyle } : {}),
          ...(ringSteps != null ? { ringSteps } : {}),
          ...(bandSteps != null ? { bandSteps } : {}),
          ...(ringColors != null ? { ringColors } : {}),
          ...(outerRingColors != null ? { outerRingColors } : {}),
          ...(categoryColors != null ? { categoryColors } : {}),
          ...(seriesColors != null ? { seriesColors } : {}),
        },
        theme,
      ),
    [
      rows,
      series,
      metricOrder,
      categoryOrder,
      valueMode,
      showLegend,
      showVertexMarkers,
      showAxisLabels,
      ringStyle,
      ringSteps,
      bandSteps,
      ringColors,
      outerRingColors,
      categoryColors,
      seriesColors,
      theme,
    ],
  );

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const sparsePolygonFallback = hasSparsePolygonFallback(model);
  const uid = useId();
  const { center, outerRadius: outerR, viewBoxSize } = model.geometry;
  const cx = center;
  const cy = center;
  const multipleSeries = model.polygons.length > 1;
  const clipBandsToPolygon =
    ringStyle === "banded-inside-polygon" &&
    !sparsePolygonFallback &&
    model.polygons.length === 1;
  const clipPolygon = clipBandsToPolygon ? (model.polygons[0] ?? null) : null;
  const bandsClipId = clipPolygon ? `radar-bands-clip-${uid}` : undefined;

  const tooltipRows =
    hoveredIndex !== null ? buildRadarTooltipRows(model, hoveredIndex) : null;

  const plot = (
    <div
      style={{ position: "relative" }}
      onMouseLeave={() => {
        setHoveredIndex(null);
      }}
    >
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
      >
        {!model.meta.empty && (
          <>
            {clipPolygon && (
              <defs>
                <clipPath id={bandsClipId}>
                  <path d={clipPolygon.path} />
                </clipPath>
              </defs>
            )}
            {model.outerBands.length > 0 && (
              <Bands
                bands={model.outerBands}
                cx={cx}
                cy={cy}
                testId="radar-outer-bands"
              />
            )}
            {model.bands.length > 0 && (
              <Bands
                bands={model.bands}
                cx={cx}
                cy={cy}
                {...(bandsClipId ? { clipPathId: bandsClipId } : {})}
              />
            )}

            <Rings
              rings={model.rings}
              cx={cx}
              cy={cy}
              theme={theme}
              guidesStyle={guides}
            />
            <Spokes axes={model.axes} theme={theme} guidesStyle={guides} />
            <SpokeTicks
              axes={model.axes}
              cx={cx}
              cy={cy}
              theme={theme}
              uid={uid}
              polygon={clipPolygon}
              invertInsidePolygon={clipBandsToPolygon}
              textStyle={text}
            />

            <circle
              cx={roundSvg(cx)}
              cy={roundSvg(cy)}
              r={roundSvg(outerR)}
              fill="none"
              stroke={theme.axis.line}
              strokeWidth={0.5}
            />

            {!sparsePolygonFallback &&
              model.polygons.map((p, i) => (
                <PolygonLayer
                  key={p.seriesId}
                  polygon={p}
                  polygonIndex={i}
                  hoveredIndex={hoveredIndex}
                  showMarkers={showVertexMarkers}
                  theme={theme}
                  areasStyle={areas}
                  transparentDefaultFill={clipBandsToPolygon && i === 0}
                  multipleSeries={multipleSeries}
                />
              ))}

            {!sparsePolygonFallback && showVertexValues && model.polygons.length > 0 ? (
              <VertexValuePills polygons={model.polygons} />
            ) : null}

            <VertexHitTargets
              polygons={sparsePolygonFallback ? [] : model.polygons}
              onHover={setHoveredIndex}
            />

            {model.axes.length > 0 && (
              <CurvedLabels
                axes={model.axes}
                cx={cx}
                cy={cy}
                theme={theme}
                uid={uid}
                textStyle={text}
              />
            )}
          </>
        )}
      </svg>

      {model.emptyState && (
        <EmptyState message={model.emptyState.message} theme={theme} />
      )}

      {!model.emptyState && sparsePolygonFallback && (
        <EmptyState message={SPARSE_POLYGON_MESSAGE} theme={theme} />
      )}

      {tooltipRows && (
        <ChartTooltip testId="radar-tooltip" rows={tooltipRows} theme={theme} />
      )}
    </div>
  );

  const categoryLegendNode = model.legend ? (
    <ChartLegend testId="radar-legend" items={model.legend.items} theme={theme} />
  ) : null;
  const seriesLegendNode = model.seriesLegend ? (
    <ChartLegend
      testId="radar-series-legend"
      items={model.seriesLegend.items}
      theme={theme}
    />
  ) : null;
  const legend =
    seriesLegendNode && categoryLegendNode ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {seriesLegendNode}
        {categoryLegendNode}
      </div>
    ) : (
      (seriesLegendNode ?? categoryLegendNode)
    );

  return (
    <ChartFrame
      ariaLabel={model.meta.accessibleLabel}
      chartKind="radar-chart"
      empty={model.emptyState != null}
      maxWidth={640}
      plot={plot}
      legend={legend}
      methodologyNotes={methodologyNotes}
      theme={theme}
      warnings={model.meta.warnings}
    />
  );
}
