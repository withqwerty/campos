import { useMemo, useState } from "react";

import {
  computeCometChart,
  type ComputeCometChartInput,
  type CometChartEntityModel,
  type CometChartGuideModel,
  type CometChartLegendModel,
  type CometChartLabelModel,
  type CometChartPointModel,
  type CometChartTrailSegmentModel,
} from "./compute/index.js";

import { useTheme } from "./ThemeContext.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";
import {
  ChartCartesianAxes,
  ChartFrame,
  ChartLegend,
  ChartPointMark,
  ChartPlotAreaBackground,
  type ChartMethodologyNotes,
  ChartTooltip,
  EmptyState,
  type PointShape,
} from "./primitives/index.js";
import type { UITheme } from "./theme.js";

export type CometChartProps<T> = ComputeCometChartInput<T> & {
  /** Map entity IDs to image URLs. When provided, markers render as logos instead of circles. */
  logoMap?: Record<string, string> | undefined;
  methodologyNotes?: ChartMethodologyNotes;
  lines?: CometChartLinesStyle;
  markers?: CometChartMarkersStyle;
  labels?: CometChartLabelsStyle;
  guideStyle?: CometChartGuidesStyle;
};

export type CometChartLineStyleContext = {
  entity: CometChartEntityModel;
  segment: CometChartTrailSegmentModel;
  point: CometChartPointModel | null;
  theme: UITheme;
  active: boolean;
  hasActiveEntity: boolean;
};

export type CometChartLinesStyle = {
  show?: StyleValue<boolean, CometChartLineStyleContext>;
  stroke?: StyleValue<string, CometChartLineStyleContext>;
  strokeWidth?: StyleValue<number, CometChartLineStyleContext>;
  opacity?: StyleValue<number, CometChartLineStyleContext>;
  strokeDasharray?: StyleValue<string, CometChartLineStyleContext>;
};

export type CometChartMarkerStyleContext = {
  entity: CometChartEntityModel;
  point: CometChartPointModel;
  theme: UITheme;
  active: boolean;
  hasActiveEntity: boolean;
};

export type CometChartMarkersStyle = {
  show?: StyleValue<boolean, CometChartMarkerStyleContext>;
  fill?: StyleValue<string, CometChartMarkerStyleContext>;
  stroke?: StyleValue<string, CometChartMarkerStyleContext>;
  strokeWidth?: StyleValue<number, CometChartMarkerStyleContext>;
  opacity?: StyleValue<number, CometChartMarkerStyleContext>;
  radius?: StyleValue<number, CometChartMarkerStyleContext>;
  shape?: StyleValue<PointShape, CometChartMarkerStyleContext>;
};

export type CometChartLabelStyleContext = {
  label: CometChartLabelModel;
  theme: UITheme;
  active: boolean;
  hasActiveEntity: boolean;
};

export type CometChartLabelsStyle = {
  show?: StyleValue<boolean, CometChartLabelStyleContext>;
  fill?: StyleValue<string, CometChartLabelStyleContext>;
  connectorStroke?: StyleValue<string, CometChartLabelStyleContext>;
  opacity?: StyleValue<number, CometChartLabelStyleContext>;
};

export type CometChartGuideStyleContext = {
  guide: CometChartGuideModel;
  theme: UITheme;
};

export type CometChartGuidesStyle = {
  show?: StyleValue<boolean, CometChartGuideStyleContext>;
  stroke?: StyleValue<string, CometChartGuideStyleContext>;
  strokeWidth?: StyleValue<number, CometChartGuideStyleContext>;
  strokeDasharray?: StyleValue<string, CometChartGuideStyleContext>;
  opacity?: StyleValue<number, CometChartGuideStyleContext>;
  labelColor?: StyleValue<string, CometChartGuideStyleContext>;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LegendBlock({
  legend,
  theme,
}: {
  legend: CometChartLegendModel;
  theme: UITheme;
}) {
  return (
    <ChartLegend
      items={legend.items}
      title={legend.title}
      swatchShape="circle"
      theme={theme}
    />
  );
}

function CometChartGuides({
  guides,
  plotTop,
  theme,
  style,
}: {
  guides: readonly CometChartGuideModel[];
  plotTop: number;
  theme: UITheme;
  style: CometChartGuidesStyle | undefined;
}) {
  if (guides.length === 0) {
    return null;
  }

  return (
    <>
      {guides.map((guide, index) => {
        const context: CometChartGuideStyleContext = { guide, theme };
        if (resolveStyleValue(style?.show, context) === false) {
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
                resolveStyleValue(style?.stroke, context) ??
                guide.stroke ??
                theme.axis.line
              }
              strokeWidth={resolveStyleValue(style?.strokeWidth, context) ?? 1}
              strokeDasharray={
                resolveStyleValue(style?.strokeDasharray, context) ??
                guide.strokeDasharray ??
                undefined
              }
              opacity={resolveStyleValue(style?.opacity, context) ?? 0.7}
            />
            {guide.label ? (
              <text
                x={guide.axis === "x" ? guide.x1 + 4 : guide.x2 - 4}
                y={guide.axis === "x" ? plotTop + 12 : guide.y1 - 6}
                textAnchor={guide.axis === "x" ? "start" : "end"}
                fill={resolveStyleValue(style?.labelColor, context) ?? theme.text.muted}
                fontSize={10}
                fontWeight={600}
              >
                {guide.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CometChart<T>(props: CometChartProps<T>) {
  const {
    points,
    entityKey,
    xKey,
    yKey,
    timeKey,
    labelKey,
    xLabel,
    yLabel,
    invertX,
    invertY,
    guides,
    showTimeLabels,
    labelStrategy,
    labelIds,
    logoMap,
    lines,
    markers,
    labels,
    guideStyle,
    methodologyNotes,
  } = props;
  const theme = useTheme();
  const model = useMemo(
    () =>
      computeCometChart({
        points,
        entityKey,
        xKey,
        yKey,
        ...(timeKey != null ? { timeKey } : {}),
        ...(labelKey != null ? { labelKey } : {}),
        ...(xLabel != null ? { xLabel } : {}),
        ...(yLabel != null ? { yLabel } : {}),
        ...(invertX != null ? { invertX } : {}),
        ...(invertY != null ? { invertY } : {}),
        ...(guides != null ? { guides } : {}),
        ...(showTimeLabels != null ? { showTimeLabels } : {}),
        ...(labelStrategy != null ? { labelStrategy } : {}),
        ...(labelIds != null ? { labelIds } : {}),
      }),

    [
      points,
      entityKey,
      xKey,
      yKey,
      timeKey,
      labelKey,
      xLabel,
      yLabel,
      invertX,
      invertY,
      guides,
      showTimeLabels,
      labelStrategy,
      labelIds,
    ],
  );

  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [activePointKey, setActivePointKey] = useState<string | null>(null);
  const [activeTooltipRows, setActiveTooltipRows] = useState<Array<{
    label: string;
    value: string;
  }> | null>(null);
  const hasActiveEntity = activeEntityId != null;

  const setActiveEntity = (entityId: string | null) => {
    setActiveEntityId(entityId);
    if (entityId === null) {
      setActivePointKey(null);
      setActiveTooltipRows(null);
    }
  };

  const activateTrail = (entityId: string) => {
    setActiveEntityId(entityId);
    setActivePointKey(null);
    const entity = model.plot.entities.find((entry) => entry.id === entityId);
    const latest =
      entity?.points.find((point) => point.isLatest) ??
      entity?.points[entity.points.length - 1];
    setActiveTooltipRows(latest?.tooltip.rows ?? null);
  };

  const activatePoint = (
    entityId: string,
    pointKey: string,
    tooltipRows: Array<{ label: string; value: string }>,
  ) => {
    setActiveEntityId(entityId);
    setActivePointKey(pointKey);
    setActiveTooltipRows(tooltipRows);
  };

  const { viewBox } = model.layout;
  const plot = (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        style={{
          width: "100%",
          height: "auto",
          background: theme.surface.plot,
          borderRadius: theme.radius.xl,
          overflow: "visible",
        }}
      >
        {/* Plot area background */}
        <ChartPlotAreaBackground plotArea={model.layout.frame} theme={theme} />

        <ChartCartesianAxes
          plotArea={model.layout.plotArea}
          frame={model.layout.frame}
          xAxis={model.axes.x}
          yAxis={model.axes.y}
          theme={theme}
          showXGrid={true}
          showYGrid={true}
        />

        <CometChartGuides
          guides={model.plot.guides}
          plotTop={model.layout.plotArea.y}
          theme={theme}
          style={guideStyle}
        />

        {/* Trail segments — skip interactive wrapper for barely-moved entities
            whose trail is empty, so keyboard users don't hit an invisible focus stop */}
        {model.plot.entities.map((entity) => {
          const hasTrail = entity.trail.length > 0;
          const trailInteractiveProps = hasTrail
            ? {
                role: "button" as const,
                tabIndex: 0,
                "aria-label": `${entity.id} trail`,
                style: { cursor: "pointer" },
                onMouseEnter: () => {
                  activateTrail(entity.id);
                },
                onMouseLeave: () => {
                  setActiveEntity(null);
                },
                onFocus: () => {
                  activateTrail(entity.id);
                },
                onBlur: () => {
                  setActiveEntity(null);
                },
                onClick: () => {
                  if (activeEntityId === entity.id) {
                    setActiveEntity(null);
                  } else {
                    activateTrail(entity.id);
                  }
                },
                onKeyDown: (event: React.KeyboardEvent) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (activeEntityId === entity.id) {
                      setActiveEntity(null);
                    } else {
                      activateTrail(entity.id);
                    }
                  }
                },
              }
            : {};
          return (
            <g
              key={`trail-${entity.id}`}
              opacity={hasActiveEntity ? (activeEntityId === entity.id ? 0.85 : 0.08) : 1}
              {...trailInteractiveProps}
            >
              {entity.trail.map((seg, i) => {
                // Segment i connects points[i] → points[i+1]; show the "to" point tooltip
                const toPoint = entity.points[i + 1];
                const lineContext: CometChartLineStyleContext = {
                  entity,
                  segment: seg,
                  point: toPoint ?? null,
                  theme,
                  active: activeEntityId === entity.id,
                  hasActiveEntity,
                };
                if (resolveStyleValue(lines?.show, lineContext) === false) {
                  return null;
                }
                return (
                  <g
                    key={`seg-${i}`}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      if (toPoint) {
                        activatePoint(
                          entity.id,
                          `${entity.id}:${i + 1}`,
                          toPoint.tooltip.rows,
                        );
                      }
                    }}
                  >
                    {/* Invisible wide hit area for easier hovering */}
                    <line
                      x1={seg.x1}
                      y1={seg.y1}
                      x2={seg.x2}
                      y2={seg.y2}
                      stroke="transparent"
                      strokeWidth={12}
                      strokeLinecap="round"
                    />
                    {/* Visible trail line */}
                    <line
                      x1={seg.x1}
                      y1={seg.y1}
                      x2={seg.x2}
                      y2={seg.y2}
                      stroke={
                        resolveStyleValue(lines?.stroke, lineContext) ?? entity.fill
                      }
                      strokeWidth={
                        resolveStyleValue(lines?.strokeWidth, lineContext) ?? 2
                      }
                      strokeLinecap="round"
                      {...(resolveStyleValue(lines?.strokeDasharray, lineContext) != null
                        ? {
                            strokeDasharray: resolveStyleValue(
                              lines?.strokeDasharray,
                              lineContext,
                            ),
                          }
                        : {})}
                      opacity={
                        resolveStyleValue(lines?.opacity, lineContext) ?? seg.opacity
                      }
                    />
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Markers */}
        {model.plot.entities.map((entity) => {
          const logoUrl = logoMap?.[entity.id];
          return entity.points.map((point, pIdx) => {
            const markerContext: CometChartMarkerStyleContext = {
              entity,
              point,
              theme,
              active: activeEntityId === entity.id,
              hasActiveEntity,
            };
            if (resolveStyleValue(markers?.show, markerContext) === false) {
              return null;
            }
            const markerOpacity = hasActiveEntity
              ? activeEntityId === entity.id
                ? 1.0
                : 0.08
              : point.opacity;
            const resolvedOpacity =
              resolveStyleValue(markers?.opacity, markerContext) ?? markerOpacity;
            const resolvedRadius =
              resolveStyleValue(markers?.radius, markerContext) ?? point.r;
            const logoSize = resolvedRadius * 2.6;
            return (
              <g
                key={`marker-${entity.id}-${pIdx}`}
                role="button"
                tabIndex={0}
                aria-label={point.tooltip.rows
                  .map((r) => `${r.label}: ${r.value}`)
                  .join(", ")}
                onMouseEnter={() => {
                  activatePoint(entity.id, `${entity.id}:${pIdx}`, point.tooltip.rows);
                }}
                onMouseLeave={() => {
                  setActiveEntity(null);
                }}
                onFocus={() => {
                  activatePoint(entity.id, `${entity.id}:${pIdx}`, point.tooltip.rows);
                }}
                onBlur={() => {
                  setActiveEntity(null);
                }}
                onClick={() => {
                  const key = `${entity.id}:${pIdx}`;
                  if (activeEntityId === entity.id && activePointKey === key) {
                    setActiveEntity(null);
                  } else {
                    activatePoint(entity.id, key, point.tooltip.rows);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    const key = `${entity.id}:${pIdx}`;
                    if (activeEntityId === entity.id && activePointKey === key) {
                      setActiveEntity(null);
                    } else {
                      activatePoint(entity.id, key, point.tooltip.rows);
                    }
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                {/* Circle always renders — serves as the visible marker when
                    no logo is configured, and as a fallback when an <image>
                    fails to load (broken URL → transparent image → circle
                    shows through underneath). */}
                <ChartPointMark
                  cx={point.cx}
                  cy={point.cy}
                  r={resolvedRadius}
                  shape={resolveStyleValue(markers?.shape, markerContext) ?? "circle"}
                  fill={resolveStyleValue(markers?.fill, markerContext) ?? entity.fill}
                  opacity={resolvedOpacity}
                  stroke={
                    resolveStyleValue(markers?.stroke, markerContext) ??
                    (activeEntityId === entity.id && point.isLatest
                      ? theme.text.primary
                      : "none")
                  }
                  strokeWidth={
                    resolveStyleValue(markers?.strokeWidth, markerContext) ??
                    (activeEntityId === entity.id && point.isLatest ? 1 : 0)
                  }
                />
                {logoUrl && (
                  <image
                    href={logoUrl}
                    x={point.cx - logoSize / 2}
                    y={point.cy - logoSize / 2}
                    width={logoSize}
                    height={logoSize}
                    opacity={resolvedOpacity}
                  />
                )}
              </g>
            );
          });
        })}

        {/* Time labels */}
        {model.plot.entities.map((entity) =>
          entity.points
            .filter((point) => point.timeLabel != null)
            .map((point, tIdx) => {
              const tx = point.cx + point.r + 3;
              const ty = point.cy + 2.5;
              const timeLabelOpacity = hasActiveEntity
                ? activeEntityId === entity.id
                  ? 0.9
                  : 0.08
                : 0.7;
              return (
                <g
                  key={`timelabel-${entity.id}-${tIdx}`}
                  aria-hidden="true"
                  style={{ pointerEvents: "none" }}
                  opacity={timeLabelOpacity}
                >
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="start"
                    fill={theme.text.secondary}
                    fontSize={7}
                    fontWeight={600}
                    style={{
                      paintOrder: "stroke",
                      stroke: theme.surface.plot,
                      strokeWidth: 2.5,
                    }}
                  >
                    {point.timeLabel}
                  </text>
                </g>
              );
            }),
        )}

        {/* Entity labels */}
        {model.plot.labels.map((label) => {
          const labelContext: CometChartLabelStyleContext = {
            label,
            theme,
            active: activeEntityId === label.entityId,
            hasActiveEntity,
          };
          if (resolveStyleValue(labels?.show, labelContext) === false) {
            return null;
          }
          return (
            <g
              key={`label-${label.entityId}`}
              aria-hidden="true"
              style={{ pointerEvents: "none" }}
              opacity={
                resolveStyleValue(labels?.opacity, labelContext) ??
                (hasActiveEntity ? (activeEntityId === label.entityId ? 1 : 0.08) : 1)
              }
            >
              {label.connector ? (
                <line
                  x1={label.connector.x1}
                  y1={label.connector.y1}
                  x2={label.connector.x2}
                  y2={label.connector.y2}
                  stroke={
                    resolveStyleValue(labels?.connectorStroke, labelContext) ??
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
                fill={resolveStyleValue(labels?.fill, labelContext) ?? theme.text.primary}
                fontSize={9.5}
                fontWeight={700}
                style={{
                  paintOrder: "stroke",
                  stroke: theme.surface.plot,
                  strokeWidth: 3,
                }}
              >
                {label.text}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Empty state overlay */}
      {model.emptyState ? (
        <EmptyState message={model.emptyState.message} theme={theme} />
      ) : null}

      {/* Tooltip */}
      {activeTooltipRows ? (
        <ChartTooltip
          testId="cometchart-tooltip"
          rows={activeTooltipRows.map((row) => ({
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
      chartKind="comet-chart"
      empty={model.emptyState != null}
      maxWidth={720}
      plot={plot}
      legend={legend}
      methodologyNotes={methodologyNotes}
      theme={theme}
      gap={10}
      fontFamily={'"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif'}
      warnings={model.meta.warnings}
    />
  );
}
