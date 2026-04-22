import { useMemo, useState } from "react";

import {
  computeScatterPlot,
  type ComputeScatterPlotInput,
  type ScatterPlotLegendModel,
  type ScatterPlotMarkerModel,
  type ScatterPlotModel,
} from "./compute/index.js";

import { useTheme } from "./ThemeContext.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";
import {
  ChartCartesianAxes,
  ChartFrame,
  ChartGradientLegend,
  ChartLegend,
  ChartPointMark,
  ChartPlotAreaBackground,
  ChartSizeLegend,
  ChartSvgEmptyState,
  type ChartMethodologyNotes,
  ChartTooltip,
  type PointShape,
} from "./primitives/index.js";
import { LIGHT_THEME, type UITheme } from "./theme.js";

export type ScatterPlotProps<T> = ComputeScatterPlotInput<T> & {
  methodologyNotes?: ChartMethodologyNotes;
  markers?: ScatterPlotMarkersStyle<T>;
  regionStyle?: ScatterPlotRegionsStyle;
  guideStyle?: ScatterPlotGuidesStyle;
  labelStyle?: ScatterPlotLabelsStyle;
  tickFontSize?: number;
  axisLabelFontSize?: number;
  staticMode?: boolean;
};

type ScatterPlotGuideModel = ScatterPlotModel["plot"]["guides"][number];
type ScatterPlotLabelModel = ScatterPlotModel["plot"]["labels"][number];
type ScatterPlotRegionModel = ScatterPlotModel["plot"]["regions"][number];

export type ScatterPlotMarkerStyleContext<T = unknown> = {
  marker: ScatterPlotMarkerModel;
  point: T | undefined;
  theme: UITheme;
  active: boolean;
  hasActiveMarker: boolean;
  hasEmphasis: boolean;
};

export type ScatterPlotMarkersStyle<T = unknown> = {
  show?: StyleValue<boolean, ScatterPlotMarkerStyleContext<T>>;
  fill?: StyleValue<string, ScatterPlotMarkerStyleContext<T>>;
  opacity?: StyleValue<number, ScatterPlotMarkerStyleContext<T>>;
  stroke?: StyleValue<string, ScatterPlotMarkerStyleContext<T>>;
  strokeWidth?: StyleValue<number, ScatterPlotMarkerStyleContext<T>>;
  radius?: StyleValue<number, ScatterPlotMarkerStyleContext<T>>;
  shape?: StyleValue<PointShape, ScatterPlotMarkerStyleContext<T>>;
};

export type ScatterPlotRegionStyleContext = {
  region: ScatterPlotRegionModel;
  theme: UITheme;
};

export type ScatterPlotRegionsStyle = {
  show?: StyleValue<boolean, ScatterPlotRegionStyleContext>;
  fill?: StyleValue<string, ScatterPlotRegionStyleContext>;
  opacity?: StyleValue<number, ScatterPlotRegionStyleContext>;
  labelColor?: StyleValue<string, ScatterPlotRegionStyleContext>;
  labelFontSize?: StyleValue<number, ScatterPlotRegionStyleContext>;
};

export type ScatterPlotGuideStyleContext = {
  guide: ScatterPlotGuideModel;
  theme: UITheme;
};

export type ScatterPlotGuidesStyle = {
  show?: StyleValue<boolean, ScatterPlotGuideStyleContext>;
  stroke?: StyleValue<string, ScatterPlotGuideStyleContext>;
  strokeWidth?: StyleValue<number, ScatterPlotGuideStyleContext>;
  strokeDasharray?: StyleValue<string, ScatterPlotGuideStyleContext>;
  opacity?: StyleValue<number, ScatterPlotGuideStyleContext>;
  labelColor?: StyleValue<string, ScatterPlotGuideStyleContext>;
  labelFontSize?: StyleValue<number, ScatterPlotGuideStyleContext>;
};

export type ScatterPlotLabelStyleContext = {
  label: ScatterPlotLabelModel;
  theme: UITheme;
};

export type ScatterPlotLabelsStyle = {
  show?: StyleValue<boolean, ScatterPlotLabelStyleContext>;
  fill?: StyleValue<string, ScatterPlotLabelStyleContext>;
  connectorStroke?: StyleValue<string, ScatterPlotLabelStyleContext>;
  opacity?: StyleValue<number, ScatterPlotLabelStyleContext>;
  fontSize?: StyleValue<number, ScatterPlotLabelStyleContext>;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function regionLabelPosition(
  region: ScatterPlotModel["plot"]["regions"][number],
  _width: number,
  height: number,
): { x: number; y: number; anchor: "start" | "middle" | "end" } {
  const insetX = 10;
  const insetY = 8;

  switch (region.labelPosition) {
    case "top-left":
      return { x: region.x + insetX, y: region.y + insetY + 8, anchor: "start" };
    case "top-right":
      return {
        x: region.x + region.width - insetX,
        y: region.y + insetY + 8,
        anchor: "end",
      };
    case "bottom-left":
      return {
        x: region.x + insetX,
        y: region.y + region.height - insetY - height + 16,
        anchor: "start",
      };
    case "bottom-right":
      return {
        x: region.x + region.width - insetX,
        y: region.y + region.height - insetY - height + 16,
        anchor: "end",
      };
    case "center":
    default:
      return {
        x: region.x + region.width / 2,
        y: region.y + region.height / 2 - height / 2 + 12,
        anchor: "middle",
      };
  }
}

function approxTextWidth(text: string, fontSize = 10) {
  return Math.max(28, Math.min(160, text.length * (fontSize * 0.62) + 10));
}

function markerIdForPoint<T>(
  point: T,
  index: number,
  idKey: ComputeScatterPlotInput<T>["idKey"],
) {
  return idKey && point[idKey] != null ? String(point[idKey]) : String(index);
}

function buildPointLookup<T>(
  points: readonly T[],
  idKey: ComputeScatterPlotInput<T>["idKey"],
) {
  return new Map(
    points.map((point, index) => [markerIdForPoint(point, index, idKey), point]),
  );
}

function rectsOverlap(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function circleIntersectsRect(
  circle: { cx: number; cy: number; r: number },
  rect: { left: number; right: number; top: number; bottom: number },
) {
  const closestX = Math.max(rect.left, Math.min(circle.cx, rect.right));
  const closestY = Math.max(rect.top, Math.min(circle.cy, rect.bottom));
  const dx = circle.cx - closestX;
  const dy = circle.cy - closestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

function pointLabelRect(label: ScatterPlotModel["plot"]["labels"][number]) {
  const width = approxTextWidth(label.text, 10.5);
  if (label.textAnchor === "start") {
    return {
      left: label.x,
      right: label.x + width,
      top: label.y - 12,
      bottom: label.y + 4,
    };
  }
  if (label.textAnchor === "end") {
    return {
      left: label.x - width,
      right: label.x,
      top: label.y - 12,
      bottom: label.y + 4,
    };
  }
  return {
    left: label.x - width / 2,
    right: label.x + width / 2,
    top: label.y - 12,
    bottom: label.y + 4,
  };
}

function LegendBlock({
  legend,
  theme,
}: {
  legend: ScatterPlotLegendModel;
  theme: UITheme;
}) {
  if (legend.kind === "categorical") {
    return (
      <ChartLegend
        items={legend.items.map((item) => ({
          key: item.key,
          label: item.label,
          color: item.color ?? theme.text.secondary,
        }))}
        title={legend.title}
        swatchShape="circle"
        theme={theme}
      />
    );
  }

  if (legend.kind === "continuous") {
    const colors = legend.items
      .map((item) => item.color)
      .filter((color): color is string => Boolean(color));
    return (
      <ChartGradientLegend
        title={legend.title}
        startLabel={legend.items[0]?.label ?? ""}
        endLabel={legend.items[legend.items.length - 1]?.label ?? ""}
        colors={colors}
        theme={theme}
      />
    );
  }

  return (
    <ChartSizeLegend
      title={legend.title}
      items={legend.items.map((item) => ({
        key: item.key,
        label: item.label,
        radius: item.radius ?? 5,
      }))}
      theme={theme}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function resolveRegionLabelLayouts(model: ScatterPlotModel, theme: UITheme) {
  const occupiedRegionRects: Array<{
    left: number;
    right: number;
    top: number;
    bottom: number;
  }> = [];
  const occupiedPointLabelRects = model.plot.labels.map((label) => pointLabelRect(label));

  return model.plot.regions
    .map((region) => {
      if (!region.label) return null;

      const chipWidth = approxTextWidth(region.label, 10) + 12;
      const chipHeight = 18;
      if (region.labelMode === "none") {
        const { x, y, anchor } = regionLabelPosition(region, chipWidth, chipHeight);
        return {
          x,
          y,
          anchor,
          rect: null,
          buffered: false,
          text: region.label,
          textColor: region.textColor ?? theme.text.secondary,
        };
      }

      if (region.labelMode === "buffer") {
        const touchesTopEdge = Math.abs(region.y - model.layout.plotArea.y) < 1;
        const topBufferBaseline = model.layout.plotArea.y - 6;
        const { x, y, anchor } =
          touchesTopEdge && region.labelPosition === "top-left"
            ? { x: region.x + 10, y: topBufferBaseline, anchor: "start" as const }
            : touchesTopEdge && region.labelPosition === "top-right"
              ? {
                  x: region.x + region.width - 10,
                  y: topBufferBaseline,
                  anchor: "end" as const,
                }
              : regionLabelPosition(region, chipWidth, chipHeight);
        const rect =
          anchor === "start"
            ? {
                left: x - 5,
                right: x - 5 + chipWidth,
                top: y - 12,
                bottom: y - 12 + chipHeight,
              }
            : anchor === "end"
              ? {
                  left: x + 5 - chipWidth,
                  right: x + 5,
                  top: y - 12,
                  bottom: y - 12 + chipHeight,
                }
              : {
                  left: x - chipWidth / 2,
                  right: x + chipWidth / 2,
                  top: y - 12,
                  bottom: y - 12 + chipHeight,
                };

        return {
          x,
          y,
          anchor,
          rect,
          buffered: true,
          text: region.label,
          textColor: region.textColor ?? theme.text.secondary,
        };
      }

      const positions = [
        region.labelPosition,
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
        "center",
      ].filter(
        (
          value,
          index,
          values,
        ): value is ScatterPlotModel["plot"]["regions"][number]["labelPosition"] =>
          values.indexOf(value) === index,
      );

      const scored = positions.map((position) => {
        const { x, y, anchor } = regionLabelPosition(
          { ...region, labelPosition: position },
          chipWidth,
          chipHeight,
        );

        const rect =
          anchor === "start"
            ? {
                left: x - 5,
                right: x - 5 + chipWidth,
                top: y - 12,
                bottom: y - 12 + chipHeight,
              }
            : anchor === "end"
              ? {
                  left: x + 5 - chipWidth,
                  right: x + 5,
                  top: y - 12,
                  bottom: y - 12 + chipHeight,
                }
              : {
                  left: x - chipWidth / 2,
                  right: x + chipWidth / 2,
                  top: y - 12,
                  bottom: y - 12 + chipHeight,
                };

        let score = position === region.labelPosition ? 0 : 40;
        score +=
          occupiedPointLabelRects.filter((other) => rectsOverlap(rect, other)).length *
          500;
        score +=
          occupiedRegionRects.filter((other) => rectsOverlap(rect, other)).length * 600;
        score +=
          model.plot.markers.filter((marker) =>
            circleIntersectsRect({ cx: marker.cx, cy: marker.cy, r: marker.r + 4 }, rect),
          ).length * 400;

        return { x, y, anchor, rect, score };
      });

      const chosen = scored.sort((a, b) => a.score - b.score)[0];
      if (!chosen) return null;
      occupiedRegionRects.push(chosen.rect);

      return {
        ...chosen,
        buffered: true,
        text: region.label,
        textColor: region.textColor ?? theme.text.secondary,
      };
    })
    .filter((r) => r != null);
}

function ScatterPlotSvg<T>({
  model,
  pointsById,
  theme,
  activeId,
  setActiveId,
  staticMode = false,
  markersStyle,
  regionStyle,
  guideStyle,
  labelStyle,
  tickFontSize = 10,
  axisLabelFontSize = 11,
}: {
  model: ScatterPlotModel;
  pointsById: ReadonlyMap<string, T>;
  theme: UITheme;
  activeId: string | null;
  setActiveId?: (id: string | null) => void;
  staticMode?: boolean;
  markersStyle: ScatterPlotMarkersStyle<T> | undefined;
  regionStyle: ScatterPlotRegionsStyle | undefined;
  guideStyle: ScatterPlotGuidesStyle | undefined;
  labelStyle: ScatterPlotLabelsStyle | undefined;
  tickFontSize?: number;
  axisLabelFontSize?: number;
}) {
  const hasActiveMarker = activeId != null;
  const hasEmphasis = model.plot.markers.some((marker) => marker.emphasized);
  const orderedMarkers = [...model.plot.markers].sort(
    (a, b) => Number(a.emphasized) - Number(b.emphasized) || a.r - b.r,
  );
  const regionLabelLayouts = resolveRegionLabelLayouts(model, theme);
  const { viewBox } = model.layout;

  return (
    <svg
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      width="100%"
      height="100%"
      role={staticMode ? "img" : undefined}
      aria-label={staticMode ? model.meta.accessibleLabel : undefined}
      style={{
        display: "block",
        background: theme.surface.plot,
        borderRadius: theme.radius.xl,
        overflow: "visible",
      }}
    >
      <ChartPlotAreaBackground plotArea={model.layout.frame} theme={theme} />

      {model.plot.regions.map((region, index) => {
        const regionContext: ScatterPlotRegionStyleContext = { region, theme };
        if (resolveStyleValue(regionStyle?.show, regionContext) === false) {
          return null;
        }
        const labelLayout = regionLabelLayouts[index];
        return (
          <g key={`region-${index}`} aria-hidden="true">
            <rect
              x={region.x}
              y={region.y}
              width={region.width}
              height={region.height}
              fill={resolveStyleValue(regionStyle?.fill, regionContext) ?? region.fill}
              opacity={
                resolveStyleValue(regionStyle?.opacity, regionContext) ?? region.opacity
              }
            />
            {region.label && labelLayout ? (
              <g>
                {labelLayout.buffered && labelLayout.rect ? (
                  <rect
                    x={labelLayout.rect.left}
                    y={labelLayout.rect.top}
                    width={labelLayout.rect.right - labelLayout.rect.left}
                    height={labelLayout.rect.bottom - labelLayout.rect.top}
                    rx={theme.radius.sm}
                    fill={theme.surface.plot}
                    opacity={0.82}
                  />
                ) : null}
                <text
                  x={labelLayout.x}
                  y={labelLayout.y}
                  textAnchor={labelLayout.anchor}
                  fill={
                    resolveStyleValue(regionStyle?.labelColor, regionContext) ??
                    labelLayout.textColor
                  }
                  fontSize={
                    resolveStyleValue(regionStyle?.labelFontSize, regionContext) ?? 10
                  }
                  fontWeight={700}
                  letterSpacing="0.04em"
                  style={{ textTransform: "uppercase" }}
                  opacity={0.96}
                >
                  {labelLayout.text}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      <ChartCartesianAxes
        plotArea={model.layout.plotArea}
        frame={model.layout.frame}
        xAxis={model.axes.x}
        yAxis={model.axes.y}
        theme={theme}
        showXGrid={true}
        showYGrid={true}
        tickFontSize={tickFontSize}
        axisLabelFontSize={axisLabelFontSize}
      />

      {model.plot.guides.map((guide, index) => {
        const guideContext: ScatterPlotGuideStyleContext = { guide, theme };
        if (resolveStyleValue(guideStyle?.show, guideContext) === false) {
          return null;
        }
        return (
          <g key={`guide-${index}`} aria-hidden="true">
            <line
              x1={guide.x1}
              y1={guide.y1}
              x2={guide.x2}
              y2={guide.y2}
              stroke={
                resolveStyleValue(guideStyle?.stroke, guideContext) ??
                guide.stroke ??
                theme.axis.line
              }
              strokeWidth={resolveStyleValue(guideStyle?.strokeWidth, guideContext) ?? 1}
              strokeDasharray={
                resolveStyleValue(guideStyle?.strokeDasharray, guideContext) ??
                guide.strokeDasharray ??
                undefined
              }
              opacity={resolveStyleValue(guideStyle?.opacity, guideContext) ?? 0.7}
            />
            {guide.label ? (
              <text
                x={guide.axis === "x" ? guide.x1 + 4 : guide.x2 - 4}
                y={guide.axis === "x" ? model.layout.plotArea.y + 12 : guide.y1 - 6}
                textAnchor={guide.axis === "x" ? "start" : "end"}
                fill={
                  resolveStyleValue(guideStyle?.labelColor, guideContext) ??
                  theme.text.muted
                }
                fontSize={
                  resolveStyleValue(guideStyle?.labelFontSize, guideContext) ?? 10
                }
                fontWeight={600}
              >
                {guide.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {model.plot.referenceLine ? (
        <line
          x1={model.plot.referenceLine.x1}
          y1={model.plot.referenceLine.y1}
          x2={model.plot.referenceLine.x2}
          y2={model.plot.referenceLine.y2}
          stroke={theme.axis.line}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      ) : null}

      {model.plot.ghostMarkers.map((ghost) => (
        <ChartPointMark
          key={ghost.id}
          cx={ghost.cx}
          cy={ghost.cy}
          r={ghost.r}
          shape="circle"
          fill={ghost.fill}
          opacity={0.12}
        />
      ))}

      {orderedMarkers.map((marker) => {
        const markerContext: ScatterPlotMarkerStyleContext<T> = {
          marker,
          point: pointsById.get(marker.id),
          theme,
          active: activeId === marker.id,
          hasActiveMarker,
          hasEmphasis,
        };
        if (resolveStyleValue(markersStyle?.show, markerContext) === false) {
          return null;
        }
        const markerOpacity =
          activeId === marker.id
            ? 1
            : hasActiveMarker
              ? marker.emphasized
                ? 0.24
                : 0.1
              : marker.emphasized
                ? 0.96
                : hasEmphasis
                  ? 0.24
                  : 0.42;

        const interactiveProps =
          !staticMode && setActiveId
            ? {
                role: "button",
                tabIndex: 0,
                "aria-label": marker.label
                  ? `${marker.label}: ${marker.tooltip.rows.map((r) => `${r.label} ${r.value}`).join(", ")}`
                  : marker.tooltip.rows.map((r) => `${r.label}: ${r.value}`).join(", "),
                onMouseEnter: () => {
                  setActiveId(marker.id);
                },
                onMouseLeave: () => {
                  setActiveId(activeId === marker.id ? null : activeId);
                },
                onFocus: () => {
                  setActiveId(marker.id);
                },
                onBlur: () => {
                  setActiveId(activeId === marker.id ? null : activeId);
                },
                onClick: () => {
                  setActiveId(activeId === marker.id ? null : marker.id);
                },
                style: { cursor: "pointer", outline: "none" },
              }
            : {};

        return (
          <g key={marker.id} {...interactiveProps}>
            <ChartPointMark
              cx={marker.cx}
              cy={marker.cy}
              r={resolveStyleValue(markersStyle?.radius, markerContext) ?? marker.r}
              shape={resolveStyleValue(markersStyle?.shape, markerContext) ?? "circle"}
              fill={resolveStyleValue(markersStyle?.fill, markerContext) ?? marker.fill}
              opacity={
                resolveStyleValue(markersStyle?.opacity, markerContext) ?? markerOpacity
              }
              stroke={
                resolveStyleValue(markersStyle?.stroke, markerContext) ??
                (activeId === marker.id ? theme.text.primary : "none")
              }
              strokeWidth={
                resolveStyleValue(markersStyle?.strokeWidth, markerContext) ??
                (activeId === marker.id ? 1 : 0)
              }
            />
          </g>
        );
      })}

      {model.plot.labels.map((label) => {
        const labelContext: ScatterPlotLabelStyleContext = { label, theme };
        if (resolveStyleValue(labelStyle?.show, labelContext) === false) {
          return null;
        }
        return (
          <g
            key={`label-${label.id}`}
            aria-hidden="true"
            style={{ pointerEvents: "none" }}
            opacity={resolveStyleValue(labelStyle?.opacity, labelContext) ?? 1}
          >
            {label.connector ? (
              <line
                x1={label.connector.x1}
                y1={label.connector.y1}
                x2={label.connector.x2}
                y2={label.connector.y2}
                stroke={
                  resolveStyleValue(labelStyle?.connectorStroke, labelContext) ??
                  theme.text.muted
                }
                strokeWidth={0.75}
                opacity={0.55}
              />
            ) : null}
            <text
              x={label.x}
              y={label.y}
              textAnchor={label.textAnchor}
              fill={
                resolveStyleValue(labelStyle?.fill, labelContext) ?? theme.text.primary
              }
              fontSize={resolveStyleValue(labelStyle?.fontSize, labelContext) ?? 9.5}
              fontWeight={600}
              style={{
                paintOrder: "stroke",
                stroke: theme.surface.plot,
                strokeWidth: 4,
              }}
            >
              {label.text}
            </text>
          </g>
        );
      })}

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

export function ScatterPlotStaticSvg<T>({
  theme = LIGHT_THEME,
  ...props
}: ScatterPlotProps<T> & { theme?: UITheme }) {
  const model = computeScatterPlot(props);
  const pointsById = buildPointLookup(props.points, props.idKey);
  return (
    <ScatterPlotSvg
      model={model}
      pointsById={pointsById}
      theme={theme}
      activeId={null}
      staticMode={true}
      markersStyle={props.markers}
      regionStyle={props.regionStyle}
      guideStyle={props.guideStyle}
      labelStyle={props.labelStyle}
      {...(props.tickFontSize !== undefined ? { tickFontSize: props.tickFontSize } : {})}
      {...(props.axisLabelFontSize !== undefined
        ? { axisLabelFontSize: props.axisLabelFontSize }
        : {})}
    />
  );
}

export function ScatterPlot<T>(props: ScatterPlotProps<T>) {
  const {
    points,
    xKey,
    yKey,
    labelKey,
    labelIds,
    guides,
    regions,
    xLabel,
    yLabel,
    referenceLine,
    markers,
    regionStyle,
    guideStyle,
    labelStyle,
    tickFontSize,
    axisLabelFontSize,
    methodologyNotes,
    staticMode,
  } = props;
  const theme = useTheme();
  const pointsById = useMemo(
    () => buildPointLookup(points, props.idKey),
    [points, props.idKey],
  );
  const model = useMemo(
    () => computeScatterPlot(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depend on individual values, not the object reference
    [
      points,
      xKey,
      yKey,
      labelKey,
      labelIds,
      guides,
      regions,
      xLabel,
      yLabel,
      referenceLine,
    ],
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeMarker = model.plot.markers.find((m) => m.id === activeId) ?? null;

  const plot = (
    <div style={{ position: "relative" }}>
      <ScatterPlotSvg
        model={model}
        pointsById={pointsById}
        theme={theme}
        activeId={staticMode ? null : activeId}
        markersStyle={markers}
        regionStyle={regionStyle}
        guideStyle={guideStyle}
        labelStyle={labelStyle}
        {...(tickFontSize !== undefined ? { tickFontSize } : {})}
        {...(axisLabelFontSize !== undefined ? { axisLabelFontSize } : {})}
        {...(staticMode ? { staticMode: true } : { setActiveId })}
      />

      {activeMarker ? (
        <ChartTooltip
          testId="scatterplot-tooltip"
          rows={activeMarker.tooltip.rows.map((row) => ({
            label: row.label,
            value: row.value,
          }))}
          theme={theme}
        />
      ) : null}
    </div>
  );

  const legend =
    model.legends.length > 0 ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "0 4px",
          color: theme.text.secondary,
        }}
      >
        {model.legends.map((legendModel, i) => (
          <LegendBlock key={i} legend={legendModel} theme={theme} />
        ))}
      </div>
    ) : null;

  return (
    <ChartFrame
      ariaLabel={model.meta.accessibleLabel}
      chartKind="scatter-plot"
      empty={model.emptyState != null}
      maxWidth={720}
      plot={plot}
      legend={legend}
      methodologyNotes={methodologyNotes}
      theme={theme}
      gap={10}
      fontFamily={'"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif'}
      {...(staticMode ? { staticMode: true } : {})}
    />
  );
}
