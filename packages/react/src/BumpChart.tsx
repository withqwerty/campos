import { type ReactNode, useCallback, useMemo, useState } from "react";

import {
  computeBumpChart,
  type BumpChartEndLabelModel,
  type BumpChartLineModel,
  type BumpChartModel,
  type BumpChartPointModel,
  type BumpChartStartLabelModel,
  type ComputeBumpChartInput,
} from "./compute/index.js";

import { useTheme } from "./ThemeContext.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";
import {
  ChartCartesianAxes,
  ChartFrame,
  ChartLegend,
  type ChartMethodologyNotes,
  ChartPointMark,
  ChartPlotAreaBackground,
  ChartSvgEmptyState,
  ChartTooltip,
  EmptyState,
  type PointShape,
  useCursorTooltip,
} from "./primitives/index.js";
import { LIGHT_THEME, type UITheme } from "./theme.js";

/** Props passed to a custom end-label renderer. */
export type EndLabelRenderProps = {
  team: string;
  teamLabel: string;
  rank: number;
  color: string;
  logoUrl: string | undefined;
};

/** Cursor-following tooltip surface for line hover. */
export type BumpChartLineTooltipConfig = {
  /**
   * Render callback invoked when a line is hovered. Receives the full line
   * model (team, points, start/final rank, highlighted flag) so consumers
   * can compute derived stats (highest position, points per game, etc).
   */
  renderContent: (line: BumpChartLineModel) => ReactNode;
};

export type BumpChartProps = ComputeBumpChartInput & {
  /** Map team identifiers to logo image URLs (shown in end labels). */
  teamLogos?: Readonly<Record<string, string>>;
  /** Custom render function for end labels. Receives team info, returns any React node. */
  renderEndLabel?: (props: EndLabelRenderProps) => ReactNode;
  /**
   * Opacity multiplier applied to non-hovered lines when something is being
   * hovered. Default 0.4 — increase for a subtler fade, decrease (e.g. 0.15)
   * for aggressive dimming in dense league-table bump charts.
   */
  inactiveFadeMultiplier?: number;
  /**
   * Cursor-following tooltip shown while hovering anywhere along a line.
   * Distinct from the point-marker tooltip (fixed-position `ChartTooltip`).
   * Useful for line-only charts (`showMarkers={false}`) where markers don't
   * carry hover state.
   */
  lineTooltip?: BumpChartLineTooltipConfig;
  methodologyNotes?: ChartMethodologyNotes;
  staticMode?: boolean;
  lines?: BumpChartLinesStyle;
  points?: BumpChartPointsStyle;
  labels?: BumpChartLabelsStyle;
  guides?: BumpChartGuidesStyle;
};

export type BumpChartLineStyleContext = {
  line: BumpChartLineModel;
  theme: UITheme;
  hoveredTeam: string | null;
};

export type BumpChartLinesStyle = {
  show?: StyleValue<boolean, BumpChartLineStyleContext>;
  stroke?: StyleValue<string, BumpChartLineStyleContext>;
  strokeWidth?: StyleValue<number, BumpChartLineStyleContext>;
  opacity?: StyleValue<number, BumpChartLineStyleContext>;
  strokeDasharray?: StyleValue<string, BumpChartLineStyleContext>;
};

export type BumpChartPointStyleContext = {
  line: BumpChartLineModel;
  point: BumpChartPointModel;
  theme: UITheme;
  hoveredTeam: string | null;
};

export type BumpChartPointsStyle = {
  show?: StyleValue<boolean, BumpChartPointStyleContext>;
  fill?: StyleValue<string, BumpChartPointStyleContext>;
  stroke?: StyleValue<string, BumpChartPointStyleContext>;
  strokeWidth?: StyleValue<number, BumpChartPointStyleContext>;
  opacity?: StyleValue<number, BumpChartPointStyleContext>;
  radius?: StyleValue<number, BumpChartPointStyleContext>;
  shape?: StyleValue<PointShape, BumpChartPointStyleContext>;
};

export type BumpChartLabelStyleContext = {
  label: BumpChartEndLabelModel | BumpChartStartLabelModel;
  placement: "start" | "end";
  theme: UITheme;
};

export type BumpChartLabelsStyle = {
  show?: StyleValue<boolean, BumpChartLabelStyleContext>;
  fill?: StyleValue<string, BumpChartLabelStyleContext>;
  opacity?: StyleValue<number, BumpChartLabelStyleContext>;
};

export type BumpChartGuideStyleContext = {
  tick: number;
  theme: UITheme;
};

export type BumpChartGuidesStyle = {
  show?: StyleValue<boolean, BumpChartGuideStyleContext>;
  stroke?: StyleValue<string, BumpChartGuideStyleContext>;
  strokeWidth?: StyleValue<number, BumpChartGuideStyleContext>;
  strokeDasharray?: StyleValue<string, BumpChartGuideStyleContext>;
  opacity?: StyleValue<number, BumpChartGuideStyleContext>;
};

type HoveredPoint = BumpChartPointModel & {
  team: string;
  teamLabel: string;
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
  model: BumpChartModel;
  theme: UITheme;
  style: BumpChartGuidesStyle | undefined;
}) {
  const { plotArea } = model.layout;
  const [yMin, yMax] = model.axes.y.domain;
  const yRange = yMax - yMin;

  return (
    <g data-testid="bump-y-grid">
      {model.axes.y.ticks.map((tick) => {
        const context: BumpChartGuideStyleContext = { tick, theme };
        if (resolveStyleValue(style?.show, context) === false) {
          return null;
        }
        const opacity = resolveStyleValue(style?.opacity, context);
        const yPos = plotArea.y + ((tick - yMin) / yRange) * plotArea.height;
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

function TeamLines({
  lines,
  hoveredTeam,
  backgroundOpacity,
  inactiveFadeMultiplier,
  onHoverTeam,
  onLineCursorMove,
  onLineCursorLeave,
  theme,
  style,
}: {
  lines: BumpChartLineModel[];
  hoveredTeam: string | null;
  backgroundOpacity: number;
  inactiveFadeMultiplier: number;
  onHoverTeam: (team: string | null) => void;
  onLineCursorMove?: (e: React.MouseEvent, line: BumpChartLineModel) => void;
  onLineCursorLeave?: () => void;
  theme: UITheme;
  style: BumpChartLinesStyle | undefined;
}) {
  return (
    <g data-testid="bump-lines">
      {lines.map((line) => {
        const lineContext: BumpChartLineStyleContext = { line, theme, hoveredTeam };
        if (resolveStyleValue(style?.show, lineContext) === false) {
          return null;
        }
        const isHovered = hoveredTeam === line.team;
        const hasHover = hoveredTeam !== null;
        const baseOpacity = line.highlighted ? 1 : backgroundOpacity;
        // Hovered line always pops to full opacity so non-highlighted
        // (faded) teams are still readable on inspection.
        const opacity =
          resolveStyleValue(style?.opacity, lineContext) ??
          (isHovered ? 1 : hasHover ? baseOpacity * inactiveFadeMultiplier : baseOpacity);

        return (
          <g key={line.team}>
            {/* Visible line */}
            <path
              d={line.path}
              fill="none"
              stroke={resolveStyleValue(style?.stroke, lineContext) ?? line.color}
              strokeWidth={
                resolveStyleValue(style?.strokeWidth, lineContext) ??
                (line.highlighted ? 2.5 : 1.5)
              }
              strokeLinecap="round"
              strokeLinejoin="round"
              {...(resolveStyleValue(style?.strokeDasharray, lineContext) != null
                ? {
                    strokeDasharray: resolveStyleValue(
                      style?.strokeDasharray,
                      lineContext,
                    ),
                  }
                : {})}
              opacity={opacity}
              style={{ transition: "opacity 0.15s" }}
              pointerEvents="none"
            />
            {/* Invisible fat hit target for hover */}
            <path
              d={line.path}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
              role="button"
              tabIndex={0}
              aria-label={`${line.teamLabel} trend`}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => {
                onHoverTeam(line.team);
                onLineCursorMove?.(e, line);
              }}
              onMouseMove={(e) => {
                // Re-assert hovered team: mousemove fires reliably even when
                // overlapping hit targets swap mouseenter/leave out of order.
                onHoverTeam(line.team);
                onLineCursorMove?.(e, line);
              }}
              onMouseLeave={(e) => {
                // Only clear when truly leaving the lines layer, not when
                // moving between overlapping hit targets (crossings).
                const related = e.relatedTarget as Element | null;
                const stillInLines =
                  related instanceof Element
                    ? related.closest("[data-testid='bump-lines']")
                    : null;
                if (!stillInLines) {
                  onHoverTeam(null);
                  onLineCursorLeave?.();
                }
              }}
              onFocus={() => {
                onHoverTeam(line.team);
              }}
              onBlur={() => {
                onHoverTeam(null);
                onLineCursorLeave?.();
              }}
              onClick={() => {
                onHoverTeam(line.team);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onHoverTeam(line.team);
                }
              }}
            />
          </g>
        );
      })}
    </g>
  );
}

function Markers({
  lines,
  markerRadius,
  hoveredTeam,
  backgroundOpacity,
  inactiveFadeMultiplier,
  onHoverPoint,
  theme,
  style,
}: {
  lines: BumpChartLineModel[];
  markerRadius: number;
  hoveredTeam: string | null;
  backgroundOpacity: number;
  inactiveFadeMultiplier: number;
  onHoverPoint: (
    point:
      | (BumpChartPointModel & { team: string; teamLabel: string; color: string })
      | null,
  ) => void;
  theme: UITheme;
  style: BumpChartPointsStyle | undefined;
}) {
  return (
    <g data-testid="bump-markers">
      {lines.map((line) => {
        const isHovered = hoveredTeam === line.team;
        const hasHover = hoveredTeam !== null;
        const baseOpacity = line.highlighted ? 1 : backgroundOpacity;
        const opacity = isHovered
          ? 1
          : hasHover
            ? baseOpacity * inactiveFadeMultiplier
            : baseOpacity;

        return line.points.map((pt) =>
          (() => {
            const markerContext: BumpChartPointStyleContext = {
              line,
              point: pt,
              theme,
              hoveredTeam,
            };
            if (resolveStyleValue(style?.show, markerContext) === false) {
              return null;
            }
            return (
              <g
                key={`${line.team}-${pt.timepoint}`}
                role="button"
                tabIndex={0}
                aria-label={`${line.teamLabel} ${line.teamLabel !== line.team ? `(${line.team})` : ""} matchweek ${pt.timepoint}: position ${pt.rank}`}
                style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                onMouseEnter={() => {
                  onHoverPoint({
                    ...pt,
                    team: line.team,
                    teamLabel: line.teamLabel,
                    color: line.color,
                  });
                }}
                onFocus={() => {
                  onHoverPoint({
                    ...pt,
                    team: line.team,
                    teamLabel: line.teamLabel,
                    color: line.color,
                  });
                }}
                onMouseLeave={() => {
                  onHoverPoint(null);
                }}
                onBlur={() => {
                  onHoverPoint(null);
                }}
                onClick={() => {
                  onHoverPoint({
                    ...pt,
                    team: line.team,
                    teamLabel: line.teamLabel,
                    color: line.color,
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onHoverPoint({
                      ...pt,
                      team: line.team,
                      teamLabel: line.teamLabel,
                      color: line.color,
                    });
                  }
                }}
              >
                <ChartPointMark
                  cx={pt.cx}
                  cy={pt.cy}
                  r={resolveStyleValue(style?.radius, markerContext) ?? markerRadius}
                  shape={resolveStyleValue(style?.shape, markerContext) ?? "circle"}
                  fill={resolveStyleValue(style?.fill, markerContext) ?? line.color}
                  stroke={resolveStyleValue(style?.stroke, markerContext) ?? line.color}
                  strokeWidth={resolveStyleValue(style?.strokeWidth, markerContext) ?? 1}
                  opacity={resolveStyleValue(style?.opacity, markerContext) ?? opacity}
                />
              </g>
            );
          })(),
        );
      })}
    </g>
  );
}

/**
 * Default end-label content: optional logo + team name.
 */
function DefaultEndLabel({ teamLabel, color, logoUrl }: EndLabelRenderProps) {
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
      {logoUrl && (
        <img
          src={logoUrl}
          alt=""
          style={{ width: 14, height: 14, objectFit: "contain", flexShrink: 0 }}
        />
      )}
      {teamLabel}
    </span>
  );
}

/**
 * End labels rendered as HTML overlays positioned via percentages.
 * This allows any React content (logos, badges, custom components).
 */
function HtmlEndLabels({
  endLabels,
  viewBox,
  teamLogos,
  renderEndLabel,
  theme,
  style,
}: {
  endLabels: BumpChartEndLabelModel[];
  viewBox: { width: number; height: number };
  teamLogos: Readonly<Record<string, string>> | undefined;
  renderEndLabel: ((props: EndLabelRenderProps) => ReactNode) | undefined;
  theme: UITheme;
  style: BumpChartLabelsStyle | undefined;
}) {
  if (endLabels.length === 0) return null;

  const render = renderEndLabel ?? DefaultEndLabel;

  return (
    <div data-testid="bump-end-labels" style={{ pointerEvents: "none" }}>
      {endLabels.map((label) => {
        const context: BumpChartLabelStyleContext = {
          label,
          placement: "end",
          theme,
        };
        if (resolveStyleValue(style?.show, context) === false) {
          return null;
        }
        const leftPct = (label.x / viewBox.width) * 100;
        const topPct = (label.y / viewBox.height) * 100;
        const logoUrl: string | undefined = teamLogos?.[label.team];
        const resolvedColor = resolveStyleValue(style?.fill, context) ?? label.color;
        const resolvedOpacity = resolveStyleValue(style?.opacity, context) ?? 1;

        const renderProps: EndLabelRenderProps = {
          team: label.team,
          teamLabel: label.teamLabel,
          rank: label.rank,
          color: resolvedColor,
          logoUrl,
        };

        return (
          <div
            key={label.team}
            style={{
              position: "absolute",
              left: `${leftPct}%`,
              top: `${topPct}%`,
              transform: "translateY(-50%)",
              color: resolvedColor,
              opacity: resolvedOpacity,
            }}
          >
            {render(renderProps)}
          </div>
        );
      })}
    </div>
  );
}

function StartLabels({
  startLabels,
  theme,
  style,
}: {
  startLabels: BumpChartModel["startLabels"];
  theme: UITheme;
  style: BumpChartLabelsStyle | undefined;
}) {
  if (startLabels.length === 0) return null;
  return (
    <g data-testid="bump-start-labels" pointerEvents="none">
      {startLabels.map((label) => {
        const context: BumpChartLabelStyleContext = {
          label,
          placement: "start",
          theme,
        };
        if (resolveStyleValue(style?.show, context) === false) {
          return null;
        }
        const opacity = resolveStyleValue(style?.opacity, context);
        return (
          <text
            key={label.team}
            x={label.x}
            y={label.y + 4}
            textAnchor="end"
            fontSize={10}
            fontWeight={700}
            fill={resolveStyleValue(style?.fill, context) ?? label.color}
            {...(opacity != null ? { opacity } : {})}
          >
            {label.teamLabel}
          </text>
        );
      })}
    </g>
  );
}

function SvgEndLabels({
  endLabels,
  theme,
  style,
}: {
  endLabels: BumpChartModel["endLabels"];
  theme: UITheme;
  style: BumpChartLabelsStyle | undefined;
}) {
  if (endLabels.length === 0) return null;
  return (
    <g data-testid="bump-end-labels-static" pointerEvents="none">
      {endLabels.map((label) => {
        const context: BumpChartLabelStyleContext = {
          label,
          placement: "end",
          theme,
        };
        if (resolveStyleValue(style?.show, context) === false) {
          return null;
        }
        const opacity = resolveStyleValue(style?.opacity, context);
        return (
          <text
            key={label.team}
            x={label.x}
            y={label.y + 4}
            textAnchor="start"
            fontSize={10}
            fontWeight={700}
            fill={resolveStyleValue(style?.fill, context) ?? label.color}
            {...(opacity != null ? { opacity } : {})}
          >
            {label.teamLabel}
          </text>
        );
      })}
    </g>
  );
}

function BumpChartScene({
  model,
  theme,
  showGridLines,
  showMarkers,
  markerRadius,
  backgroundOpacity,
  inactiveFadeMultiplier,
  hoveredTeam,
  staticMode,
  onHoverTeam,
  onHoverPoint,
  onLineCursorMove,
  onLineCursorLeave,
  lineStyle,
  pointStyle,
  labelStyle,
  guideStyle,
}: {
  model: BumpChartModel;
  theme: UITheme;
  showGridLines: boolean;
  showMarkers: boolean;
  markerRadius: number;
  backgroundOpacity: number;
  inactiveFadeMultiplier: number;
  hoveredTeam: string | null;
  staticMode: boolean;
  onHoverTeam?: (team: string | null) => void;
  onHoverPoint?: (point: HoveredPoint | null) => void;
  onLineCursorMove?: (e: React.MouseEvent, line: BumpChartLineModel) => void;
  onLineCursorLeave?: () => void;
  lineStyle: BumpChartLinesStyle | undefined;
  pointStyle: BumpChartPointsStyle | undefined;
  labelStyle: BumpChartLabelsStyle | undefined;
  guideStyle: BumpChartGuidesStyle | undefined;
}) {
  const { viewBox, frame } = model.layout;

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
      <ChartPlotAreaBackground plotArea={frame} theme={theme} />

      {!model.meta.empty ? (
        <>
          {showGridLines ? (
            <GridLines model={model} theme={theme} style={guideStyle} />
          ) : null}

          {staticMode ? (
            <g data-testid="bump-lines-static">
              {model.lines.map((line) => {
                const lineContext: BumpChartLineStyleContext = {
                  line,
                  theme,
                  hoveredTeam,
                };
                if (resolveStyleValue(lineStyle?.show, lineContext) === false) {
                  return null;
                }
                const opacity =
                  resolveStyleValue(lineStyle?.opacity, lineContext) ??
                  (line.highlighted ? 1 : backgroundOpacity);
                return (
                  <path
                    key={line.team}
                    d={line.path}
                    fill="none"
                    stroke={
                      resolveStyleValue(lineStyle?.stroke, lineContext) ?? line.color
                    }
                    strokeWidth={
                      resolveStyleValue(lineStyle?.strokeWidth, lineContext) ??
                      (line.highlighted ? 2.5 : 1.5)
                    }
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    {...(resolveStyleValue(lineStyle?.strokeDasharray, lineContext) !=
                    null
                      ? {
                          strokeDasharray: resolveStyleValue(
                            lineStyle?.strokeDasharray,
                            lineContext,
                          ),
                        }
                      : {})}
                    opacity={opacity}
                  />
                );
              })}
            </g>
          ) : (
            <TeamLines
              lines={model.lines}
              hoveredTeam={hoveredTeam}
              backgroundOpacity={backgroundOpacity}
              inactiveFadeMultiplier={inactiveFadeMultiplier}
              onHoverTeam={onHoverTeam ?? (() => {})}
              {...(onLineCursorMove ? { onLineCursorMove } : {})}
              {...(onLineCursorLeave ? { onLineCursorLeave } : {})}
              theme={theme}
              style={lineStyle}
            />
          )}

          {showMarkers ? (
            staticMode ? (
              <g data-testid="bump-markers-static">
                {model.lines.flatMap((line) =>
                  line.points.map((pt) => {
                    const markerContext: BumpChartPointStyleContext = {
                      line,
                      point: pt,
                      theme,
                      hoveredTeam,
                    };
                    if (resolveStyleValue(pointStyle?.show, markerContext) === false) {
                      return null;
                    }
                    return (
                      <ChartPointMark
                        key={`${line.team}-${pt.timepoint}`}
                        cx={pt.cx}
                        cy={pt.cy}
                        r={
                          resolveStyleValue(pointStyle?.radius, markerContext) ??
                          markerRadius
                        }
                        shape={
                          resolveStyleValue(pointStyle?.shape, markerContext) ?? "circle"
                        }
                        fill={
                          resolveStyleValue(pointStyle?.fill, markerContext) ?? line.color
                        }
                        stroke={
                          resolveStyleValue(pointStyle?.stroke, markerContext) ??
                          line.color
                        }
                        strokeWidth={
                          resolveStyleValue(pointStyle?.strokeWidth, markerContext) ?? 1
                        }
                        opacity={
                          resolveStyleValue(pointStyle?.opacity, markerContext) ??
                          (line.highlighted ? 1 : backgroundOpacity)
                        }
                      />
                    );
                  }),
                )}
              </g>
            ) : (
              <Markers
                lines={model.lines}
                markerRadius={markerRadius}
                hoveredTeam={hoveredTeam}
                backgroundOpacity={backgroundOpacity}
                inactiveFadeMultiplier={inactiveFadeMultiplier}
                onHoverPoint={onHoverPoint ?? (() => {})}
                theme={theme}
                style={pointStyle}
              />
            )
          ) : null}

          <ChartCartesianAxes
            plotArea={model.layout.plotArea}
            frame={model.layout.frame}
            xAxis={model.axes.x}
            yAxis={{ ...model.axes.y, inverted: true }}
            theme={theme}
            testId="bump-axes"
            xLabelOffset={30}
            tickFontSize={9}
          />
          <StartLabels startLabels={model.startLabels} theme={theme} style={labelStyle} />
          {staticMode ? (
            <SvgEndLabels endLabels={model.endLabels} theme={theme} style={labelStyle} />
          ) : null}
        </>
      ) : staticMode ? (
        <ChartSvgEmptyState
          x={viewBox.width / 2}
          y={viewBox.height / 2}
          message={model.emptyState?.message ?? "No ranking data"}
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

function buildBumpChartModel({
  rows,
  highlightTeams,
  interpolation,
  showMarkers = true,
  showEndLabels,
  showStartLabels,
  showGridLines = true,
  rankDomain,
  teamColors,
  timepointLabel,
  rankLabel,
  markerRadius = 3,
  backgroundOpacity = 0.15,
  endLabelsForAllTeams,
  startLabelsForAllTeams,
}: BumpChartProps) {
  return computeBumpChart({
    rows,
    ...(highlightTeams != null ? { highlightTeams } : {}),
    ...(interpolation != null ? { interpolation } : {}),
    showMarkers,
    ...(showEndLabels != null ? { showEndLabels } : {}),
    ...(showStartLabels != null ? { showStartLabels } : {}),
    showGridLines,
    ...(rankDomain != null ? { rankDomain } : {}),
    ...(teamColors != null ? { teamColors } : {}),
    ...(timepointLabel != null ? { timepointLabel } : {}),
    ...(rankLabel != null ? { rankLabel } : {}),
    markerRadius,
    backgroundOpacity,
    ...(endLabelsForAllTeams != null ? { endLabelsForAllTeams } : {}),
    ...(startLabelsForAllTeams != null ? { startLabelsForAllTeams } : {}),
  });
}

export function BumpChartStaticSvg({
  theme = LIGHT_THEME,
  ...props
}: BumpChartProps & { theme?: UITheme }) {
  const {
    showMarkers = true,
    showGridLines = true,
    markerRadius = 3,
    backgroundOpacity = 0.15,
    inactiveFadeMultiplier = 0.4,
    lines,
    points,
    labels,
    guides,
  } = props;
  const model = buildBumpChartModel(props);

  return (
    <BumpChartScene
      model={model}
      theme={theme}
      showGridLines={showGridLines}
      showMarkers={showMarkers}
      markerRadius={markerRadius}
      backgroundOpacity={backgroundOpacity}
      inactiveFadeMultiplier={inactiveFadeMultiplier}
      hoveredTeam={null}
      staticMode={true}
      lineStyle={lines}
      pointStyle={points}
      labelStyle={labels}
      guideStyle={guides}
    />
  );
}

export function BumpChart({
  rows,
  highlightTeams,
  interpolation,
  showMarkers = true,
  showEndLabels,
  showStartLabels,
  showGridLines = true,
  rankDomain,
  teamColors,
  teamLogos,
  renderEndLabel,
  lines,
  points,
  labels,
  guides,
  lineTooltip,
  methodologyNotes,
  staticMode = false,
  timepointLabel,
  rankLabel,
  markerRadius = 3,
  backgroundOpacity = 0.15,
  inactiveFadeMultiplier = 0.4,
  endLabelsForAllTeams,
  startLabelsForAllTeams,
}: BumpChartProps) {
  const theme = useTheme();
  const {
    containerRef: cursorTooltipContainerRef,
    show: showCursorTooltip,
    hide: hideCursorTooltip,
    element: cursorTooltipElement,
  } = useCursorTooltip(theme);

  const model = useMemo(
    () =>
      buildBumpChartModel({
        rows,
        ...(highlightTeams != null ? { highlightTeams } : {}),
        ...(interpolation != null ? { interpolation } : {}),
        showMarkers,
        ...(showEndLabels != null ? { showEndLabels } : {}),
        ...(showStartLabels != null ? { showStartLabels } : {}),
        showGridLines,
        ...(rankDomain != null ? { rankDomain } : {}),
        ...(teamColors != null ? { teamColors } : {}),
        ...(timepointLabel != null ? { timepointLabel } : {}),
        ...(rankLabel != null ? { rankLabel } : {}),
        markerRadius,
        backgroundOpacity,
        ...(endLabelsForAllTeams != null ? { endLabelsForAllTeams } : {}),
        ...(startLabelsForAllTeams != null ? { startLabelsForAllTeams } : {}),
      }),
    [
      rows,
      highlightTeams,
      interpolation,
      showMarkers,
      showEndLabels,
      showStartLabels,
      showGridLines,
      rankDomain,
      teamColors,
      timepointLabel,
      rankLabel,
      markerRadius,
      backgroundOpacity,
      endLabelsForAllTeams,
      startLabelsForAllTeams,
    ],
  );

  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);

  const handleHoverPoint = useCallback((point: HoveredPoint | null) => {
    setHoveredPoint(point);
    setHoveredTeam(point?.team ?? null);
  }, []);

  const handleHoverTeam = useCallback((team: string | null) => {
    setHoveredTeam(team);
    // Clear point tooltip when hovering via line (no specific point)
    if (team === null) setHoveredPoint(null);
  }, []);

  const legendItems = model.lines
    .filter((line) => line.highlighted)
    .map((line) => ({
      key: line.team,
      label: line.teamLabel,
      color: line.color,
    }));

  const plot = (
    <div ref={cursorTooltipContainerRef} style={{ position: "relative" }}>
      <BumpChartScene
        model={model}
        theme={theme}
        showGridLines={showGridLines}
        showMarkers={showMarkers}
        markerRadius={markerRadius}
        backgroundOpacity={backgroundOpacity}
        inactiveFadeMultiplier={inactiveFadeMultiplier}
        hoveredTeam={hoveredTeam}
        staticMode={staticMode}
        onHoverTeam={handleHoverTeam}
        onHoverPoint={handleHoverPoint}
        {...(lineTooltip
          ? {
              onLineCursorMove: (e, line) => {
                showCursorTooltip(e, lineTooltip.renderContent(line));
              },
              onLineCursorLeave: () => {
                hideCursorTooltip();
              },
            }
          : {})}
        lineStyle={lines}
        pointStyle={points}
        labelStyle={labels}
        guideStyle={guides}
      />
      {lineTooltip ? cursorTooltipElement : null}

      {/* 8. End labels (HTML overlay — supports logos and custom renderers) */}
      {!staticMode && !model.meta.empty && (
        <HtmlEndLabels
          endLabels={model.endLabels}
          viewBox={model.layout.viewBox}
          teamLogos={teamLogos}
          renderEndLabel={renderEndLabel}
          theme={theme}
          style={labels}
        />
      )}

      {/* 9. Empty state overlay */}
      {model.emptyState != null && (
        <EmptyState message={model.emptyState.message} theme={theme} />
      )}

      {/* Tooltip on marker hover */}
      {!staticMode && hoveredPoint != null && (
        <ChartTooltip
          testId="bump-tooltip"
          rows={[
            { label: "Team", value: hoveredPoint.teamLabel },
            { label: model.axes.x.label, value: `${hoveredPoint.timepoint}` },
            { label: model.axes.y.label, value: `${hoveredPoint.rank}` },
            ...(hoveredPoint.value != null
              ? [{ label: "Value", value: hoveredPoint.displayValue }]
              : []),
          ]}
          theme={theme}
        />
      )}
    </div>
  );

  const legend =
    legendItems.length > 1 && model.endLabels.length === 0 ? (
      <ChartLegend testId="bump-legend" items={legendItems} theme={theme} />
    ) : null;

  return (
    <ChartFrame
      ariaLabel={model.meta.accessibleLabel}
      chartKind="bump-chart"
      empty={model.emptyState != null}
      maxWidth={800}
      plot={plot}
      legend={legend}
      methodologyNotes={methodologyNotes}
      staticMode={staticMode}
      theme={theme}
      fontFamily={'"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif'}
      warnings={model.meta.warnings}
    />
  );
}
