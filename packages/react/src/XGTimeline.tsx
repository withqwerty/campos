import { useCallback, useMemo, useState, type ReactNode } from "react";

import {
  computeXGTimeline,
  type ComputeXGTimelineInput,
  type XGTimelineMarkerModel,
  type XGTimelineModel,
  type XGTimelineStepLineModel,
  type XGTimelineStepPoint,
} from "./compute/index.js";

import { useTheme } from "./ThemeContext.js";
import { contrastColor } from "./colorUtils.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";
import {
  ChartCartesianAxes,
  ChartFrame,
  ChartLineMark,
  type ChartMethodologyNotes,
  ChartPointMark,
  ChartPlotAreaBackground,
  ChartSvgEmptyState,
  ChartTooltip,
  EmptyState,
  type PointShape,
} from "./primitives/index.js";
import { LIGHT_THEME, type UITheme } from "./theme.js";

export type XGTimelineProps = ComputeXGTimelineInput & {
  methodologyNotes?: ChartMethodologyNotes;
  markers?: XGTimelineMarkersStyle;
  lines?: XGTimelineLinesStyle;
  guides?: XGTimelineGuidesStyle;
  areas?: XGTimelineAreasStyle;
};

export type XGTimelineMarkerStyleContext = {
  marker: XGTimelineMarkerModel;
  theme: UITheme;
};

export type XGTimelineMarkersStyle = {
  show?: StyleValue<boolean, XGTimelineMarkerStyleContext>;
  fill?: StyleValue<string, XGTimelineMarkerStyleContext>;
  stroke?: StyleValue<string, XGTimelineMarkerStyleContext>;
  strokeWidth?: StyleValue<number, XGTimelineMarkerStyleContext>;
  opacity?: StyleValue<number, XGTimelineMarkerStyleContext>;
  radius?: StyleValue<number, XGTimelineMarkerStyleContext>;
  shape?: StyleValue<PointShape, XGTimelineMarkerStyleContext>;
};

export type XGTimelineLineStyleContext = {
  line: XGTimelineStepLineModel;
  theme: UITheme;
};

export type XGTimelineLinesStyle = {
  show?: StyleValue<boolean, XGTimelineLineStyleContext>;
  stroke?: StyleValue<string, XGTimelineLineStyleContext>;
  strokeWidth?: StyleValue<number, XGTimelineLineStyleContext>;
  opacity?: StyleValue<number, XGTimelineLineStyleContext>;
  strokeDasharray?: StyleValue<string, XGTimelineLineStyleContext>;
};

export type XGTimelineGuideStyleContext = {
  guide: XGTimelineModel["guides"][number];
  theme: UITheme;
};

export type XGTimelineGuidesStyle = {
  show?: StyleValue<boolean, XGTimelineGuideStyleContext>;
  stroke?: StyleValue<string, XGTimelineGuideStyleContext>;
  strokeWidth?: StyleValue<number, XGTimelineGuideStyleContext>;
  strokeDasharray?: StyleValue<string, XGTimelineGuideStyleContext>;
  opacity?: StyleValue<number, XGTimelineGuideStyleContext>;
  labelColor?: StyleValue<string, XGTimelineGuideStyleContext>;
};

export type XGTimelineAreaStyleContext = {
  segment: XGTimelineModel["areaSegments"][number];
  theme: UITheme;
};

export type XGTimelineAreasStyle = {
  show?: StyleValue<boolean, XGTimelineAreaStyleContext>;
  fill?: StyleValue<string, XGTimelineAreaStyleContext>;
  opacity?: StyleValue<number, XGTimelineAreaStyleContext>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Binary-search the step points to find the cumulative xG at a given minute.
 * Step-after semantics: the value holds until the next point.
 */
function cumXgAtMinute(points: XGTimelineStepPoint[], minute: number): number {
  if (points.length === 0) return 0;
  // Walk backwards from end to find the last point whose minute <= target
  let result = 0;
  for (const pt of points) {
    if (pt.minute <= minute) {
      result = pt.cumXg;
    } else {
      break;
    }
  }
  return result;
}

function stepPointAtMinute(
  points: XGTimelineStepPoint[],
  minute: number,
): XGTimelineStepPoint | null {
  if (points.length === 0) return null;
  let result = points[0] ?? null;
  for (const pt of points) {
    if (pt.minute <= minute) {
      result = pt;
    } else {
      break;
    }
  }
  return result;
}

function formatXg(xg: number): string {
  return xg.toFixed(2);
}

function clientPointToSvgX(svg: SVGSVGElement, clientX: number, clientY: number): number {
  if (typeof svg.createSVGPoint === "function") {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const inverse = svg.getScreenCTM()?.inverse();
    if (inverse != null) {
      return point.matrixTransform(inverse).x;
    }
  }

  const rect = svg.getBoundingClientRect();
  const viewBox =
    typeof svg.viewBox?.baseVal?.width === "number" && svg.viewBox.baseVal.width > 0
      ? svg.viewBox.baseVal
      : { x: 0, width: rect.width };
  if (rect.width <= 0) {
    return viewBox.x;
  }
  return viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BackgroundBands({
  bands,
  theme,
}: {
  bands: XGTimelineModel["backgroundBands"];
  theme: UITheme;
}) {
  if (bands.length === 0) return null;
  return (
    <g data-testid="xg-background-bands">
      {bands.map((band, i) => (
        <g key={i}>
          <rect
            x={band.x}
            y={band.y}
            width={band.width}
            height={band.height}
            fill={band.fill}
            opacity={band.opacity}
          />
          {band.label != null && (
            <text
              x={band.x + band.width / 2}
              y={band.y + 12}
              textAnchor="middle"
              fontSize={8}
              fill={theme.text.muted}
              pointerEvents="none"
            >
              {band.label}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

function AreaFillSegments({
  segments,
  theme,
  style,
}: {
  segments: XGTimelineModel["areaSegments"];
  theme: UITheme;
  style: XGTimelineAreasStyle | undefined;
}) {
  if (segments.length === 0) return null;
  return (
    <g data-testid="xg-area-fill">
      {segments.map((seg, i) => {
        const context: XGTimelineAreaStyleContext = { segment: seg, theme };
        if (resolveStyleValue(style?.show, context) === false) {
          return null;
        }
        return (
          <path
            key={i}
            d={seg.path}
            fill={resolveStyleValue(style?.fill, context) ?? seg.fill}
            opacity={resolveStyleValue(style?.opacity, context) ?? seg.opacity}
          />
        );
      })}
    </g>
  );
}

function StepLines({
  stepLines,
  theme,
  style,
}: {
  stepLines: XGTimelineStepLineModel[];
  theme: UITheme;
  style: XGTimelineLinesStyle | undefined;
}) {
  if (stepLines.length === 0) return null;
  return (
    <g data-testid="xg-step-lines">
      {stepLines.map((line) => {
        const context: XGTimelineLineStyleContext = { line, theme };
        if (resolveStyleValue(style?.show, context) === false) {
          return null;
        }
        const strokeDasharray = resolveStyleValue(style?.strokeDasharray, context);
        const opacity = resolveStyleValue(style?.opacity, context);
        return (
          <ChartLineMark
            key={line.teamId}
            kind="path"
            d={line.path}
            stroke={resolveStyleValue(style?.stroke, context) ?? line.color}
            strokeWidth={resolveStyleValue(style?.strokeWidth, context) ?? 2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            {...(strokeDasharray != null ? { strokeDasharray } : {})}
            {...(opacity != null ? { opacity } : {})}
          />
        );
      })}
    </g>
  );
}

function TimeGuides({
  guides,
  theme,
  style,
}: {
  guides: XGTimelineModel["guides"];
  theme: UITheme;
  style: XGTimelineGuidesStyle | undefined;
}) {
  if (guides.length === 0) return null;
  return (
    <g data-testid="xg-guides">
      {guides.map((guide, i) => {
        const context: XGTimelineGuideStyleContext = { guide, theme };
        if (resolveStyleValue(style?.show, context) === false) {
          return null;
        }
        return (
          <g key={i}>
            <ChartLineMark
              x1={guide.x}
              y1={guide.y1}
              x2={guide.x}
              y2={guide.y2}
              stroke={resolveStyleValue(style?.stroke, context) ?? theme.axis.line}
              strokeWidth={resolveStyleValue(style?.strokeWidth, context) ?? 0.75}
              strokeDasharray={
                resolveStyleValue(style?.strokeDasharray, context) ?? "4 3"
              }
              opacity={resolveStyleValue(style?.opacity, context) ?? 0.6}
            />
            <text
              x={guide.x}
              y={guide.y1 - 5}
              textAnchor="middle"
              fontSize={9}
              fill={resolveStyleValue(style?.labelColor, context) ?? theme.text.muted}
              fontWeight={600}
              pointerEvents="none"
            >
              {guide.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ShotMarkers({
  markers,
  onHover,
  theme,
  style,
}: {
  markers: XGTimelineMarkerModel[];
  onHover: (marker: XGTimelineMarkerModel | null) => void;
  theme: UITheme;
  style: XGTimelineMarkersStyle | undefined;
}) {
  if (markers.length === 0) return null;
  return (
    <g data-testid="xg-markers">
      {markers.map((marker) => {
        const context: XGTimelineMarkerStyleContext = { marker, theme };
        if (resolveStyleValue(style?.show, context) === false) {
          return null;
        }
        const opacity = resolveStyleValue(style?.opacity, context);
        return (
          <g
            key={marker.id}
            role="button"
            tabIndex={0}
            aria-label={`${marker.playerName ?? "Unknown player"} ${Math.round(marker.minute)} minutes xG ${formatXg(marker.xg)}`}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => {
              onHover(marker);
            }}
            onFocus={() => {
              onHover(marker);
            }}
            onMouseLeave={() => {
              onHover(null);
            }}
            onBlur={() => {
              onHover(null);
            }}
            onClick={() => {
              onHover(marker);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onHover(marker);
              }
            }}
          >
            <ChartPointMark
              cx={marker.cx}
              cy={marker.cy}
              r={resolveStyleValue(style?.radius, context) ?? marker.r}
              shape={resolveStyleValue(style?.shape, context) ?? "circle"}
              fill={resolveStyleValue(style?.fill, context) ?? marker.fill}
              stroke={resolveStyleValue(style?.stroke, context) ?? marker.stroke}
              strokeWidth={
                resolveStyleValue(style?.strokeWidth, context) ?? (marker.isGoal ? 2 : 1)
              }
              {...(opacity != null ? { opacity } : {})}
            />
          </g>
        );
      })}
    </g>
  );
}

function StaticShotMarkers({
  markers,
  theme,
  style,
}: {
  markers: XGTimelineMarkerModel[];
  theme: UITheme;
  style: XGTimelineMarkersStyle | undefined;
}) {
  if (markers.length === 0) return null;
  return (
    <g data-testid="xg-markers">
      {markers.map((marker) => {
        const context: XGTimelineMarkerStyleContext = { marker, theme };
        if (resolveStyleValue(style?.show, context) === false) {
          return null;
        }
        const opacity = resolveStyleValue(style?.opacity, context);
        return (
          <ChartPointMark
            key={marker.id}
            cx={marker.cx}
            cy={marker.cy}
            r={resolveStyleValue(style?.radius, context) ?? marker.r}
            shape={resolveStyleValue(style?.shape, context) ?? "circle"}
            fill={resolveStyleValue(style?.fill, context) ?? marker.fill}
            stroke={resolveStyleValue(style?.stroke, context) ?? marker.stroke}
            strokeWidth={
              resolveStyleValue(style?.strokeWidth, context) ?? (marker.isGoal ? 2 : 1)
            }
            {...(opacity != null ? { opacity } : {})}
          />
        );
      })}
    </g>
  );
}

function Annotations({
  annotations,
  theme,
}: {
  annotations: XGTimelineModel["annotations"];
  theme: UITheme;
}) {
  if (annotations.length === 0) return null;
  return (
    <g data-testid="xg-annotations" pointerEvents="none">
      {annotations.map((ann) => (
        <text
          key={ann.markerId}
          x={ann.x}
          y={ann.y}
          textAnchor={ann.textAnchor}
          fontSize={9}
          fontWeight={600}
          fill={theme.text.primary}
          style={{
            paintOrder: "stroke",
            stroke: theme.surface.plot,
            strokeWidth: 3,
          }}
        >
          {ann.text}
        </text>
      ))}
    </g>
  );
}

function EndLabels({ endLabels }: { endLabels: XGTimelineModel["endLabels"] }) {
  if (endLabels.length === 0) return null;
  return (
    <g data-testid="xg-end-labels" pointerEvents="none">
      {endLabels.map((label) => (
        <text
          key={label.teamId}
          x={label.x}
          y={label.y + 4}
          textAnchor="start"
          fontSize={12}
          fontWeight={700}
          fill={label.color}
        >
          {label.text}
        </text>
      ))}
    </g>
  );
}

function ScoreStrip({
  segments,
  theme,
}: {
  segments: XGTimelineModel["scoreStrip"];
  theme: UITheme;
}) {
  if (segments.length === 0) return null;
  return (
    <g data-testid="xg-score-strip">
      {segments.map((seg, i) => {
        const width = seg.x2 - seg.x1;
        if (width <= 0) return null;
        return (
          <g key={i}>
            <rect
              x={seg.x1}
              y={seg.y}
              width={width}
              height={seg.height}
              fill={seg.fill === "transparent" ? theme.surface.plot : seg.fill}
              stroke={theme.border.subtle}
              strokeWidth={0.5}
              rx={2}
            />
            <text
              x={seg.x1 + width / 2}
              y={seg.y + seg.height / 2 + 3.5}
              textAnchor="middle"
              fontSize={9}
              fontWeight={600}
              fill={
                seg.fill === "transparent"
                  ? theme.text.secondary
                  : contrastColor(seg.fill)
              }
              pointerEvents="none"
            >
              {seg.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function CrosshairOverlay({
  mouseX,
  model,
  theme,
}: {
  mouseX: number;
  model: XGTimelineModel;
  theme: UITheme;
}) {
  const { plotArea } = model.layout;
  const [xMin, xMax] = model.axes.x.domain;
  const [yMin, yMax] = model.axes.y.domain;
  const yRange = yMax - yMin;

  // Clamp mouseX to plot area
  const clampedX = Math.max(plotArea.x, Math.min(plotArea.x + plotArea.width, mouseX));
  // Convert to minute
  const minute = ((clampedX - plotArea.x) / plotArea.width) * (xMax - xMin) + xMin;

  return (
    <g data-testid="xg-crosshair" pointerEvents="none">
      {/* Vertical dashed line */}
      <ChartLineMark
        x1={clampedX}
        y1={plotArea.y}
        x2={clampedX}
        y2={plotArea.y + plotArea.height}
        stroke={theme.text.muted}
        strokeWidth={0.75}
        strokeDasharray="3 2"
        opacity={0.7}
      />

      {/* Cumulative xG labels at each step line intersection */}
      {model.stepLines.map((line) => {
        const point = stepPointAtMinute(line.points, minute);
        const cumXg = point?.cumXg ?? cumXgAtMinute(line.points, minute);
        const yPos =
          point?.cy ??
          plotArea.y + plotArea.height - ((cumXg - yMin) / yRange) * plotArea.height;

        return (
          <g key={`ch-${line.teamId}`}>
            {/* Small background pill */}
            <rect
              x={clampedX + 4}
              y={yPos - 7}
              width={32}
              height={14}
              rx={theme.radius.sm}
              fill={theme.surface.badge}
              stroke={theme.border.badge}
              strokeWidth={0.5}
              opacity={0.92}
            />
            <text
              x={clampedX + 6}
              y={yPos + 3}
              fontSize={9}
              fontWeight={600}
              fill={line.color}
            >
              {formatXg(cumXg)}
            </text>
            {/* Small dot at intersection */}
            <ChartPointMark
              cx={clampedX}
              cy={yPos}
              r={3}
              shape="circle"
              fill={line.color}
              opacity={0.9}
            />
          </g>
        );
      })}

      {/* Minute label at bottom */}
      <text
        x={clampedX}
        y={plotArea.y + plotArea.height + 28}
        textAnchor="middle"
        fontSize={9}
        fontWeight={600}
        fill={theme.text.secondary}
      >
        {Math.round(minute)}'
      </text>
    </g>
  );
}

function TimelineMarkers({
  markers,
  interactive,
  onHover,
  theme,
  style,
}: {
  markers: XGTimelineMarkerModel[];
  interactive: boolean;
  onHover?: (marker: XGTimelineMarkerModel | null) => void;
  theme: UITheme;
  style: XGTimelineMarkersStyle | undefined;
}) {
  if (interactive) {
    return (
      <ShotMarkers
        markers={markers}
        onHover={onHover ?? (() => {})}
        theme={theme}
        style={style}
      />
    );
  }
  return <StaticShotMarkers markers={markers} theme={theme} style={style} />;
}

function XGTimelineScene({
  model,
  theme,
  interactive,
  onHoverMarker,
  overlay,
  markersStyle,
  linesStyle,
  guidesStyle,
  areasStyle,
}: {
  model: XGTimelineModel;
  theme: UITheme;
  interactive: boolean;
  onHoverMarker?: (marker: XGTimelineMarkerModel | null) => void;
  overlay?: ReactNode;
  markersStyle: XGTimelineMarkersStyle | undefined;
  linesStyle: XGTimelineLinesStyle | undefined;
  guidesStyle: XGTimelineGuidesStyle | undefined;
  areasStyle: XGTimelineAreasStyle | undefined;
}) {
  const { viewBox, frame } = model.layout;

  return (
    <svg
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      width="100%"
      height="100%"
      role={interactive ? undefined : "img"}
      aria-label={interactive ? undefined : model.meta.accessibleLabel}
      style={
        interactive
          ? { width: "100%", height: "auto", overflow: "visible", display: "block" }
          : { display: "block", overflow: "visible" }
      }
    >
      <ChartPlotAreaBackground plotArea={frame} theme={theme} />

      {!model.meta.empty ? (
        <>
          <BackgroundBands bands={model.backgroundBands} theme={theme} />
          <AreaFillSegments
            segments={model.areaSegments}
            theme={theme}
            style={areasStyle}
          />
          <StepLines stepLines={model.stepLines} theme={theme} style={linesStyle} />
          <TimeGuides guides={model.guides} theme={theme} style={guidesStyle} />
          <TimelineMarkers
            markers={model.markers}
            interactive={interactive}
            {...(onHoverMarker != null ? { onHover: onHoverMarker } : {})}
            theme={theme}
            style={markersStyle}
          />
          <Annotations annotations={model.annotations} theme={theme} />
          <ChartCartesianAxes
            plotArea={model.layout.plotArea}
            frame={model.layout.frame}
            xAxis={model.axes.x}
            yAxis={model.axes.y}
            theme={theme}
            testId="xg-axes"
            showYGrid={true}
            yGridDasharray="3 3"
            xLabelOffset={32}
          />
          <EndLabels endLabels={model.endLabels} />
          <ScoreStrip segments={model.scoreStrip} theme={theme} />
          {overlay}
        </>
      ) : interactive ? null : (
        <ChartSvgEmptyState
          x={viewBox.width / 2}
          y={viewBox.height / 2}
          message={model.emptyState?.message ?? "No xG data"}
          theme={theme}
          dominantBaseline="central"
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function buildXGTimelineModel({
  shots,
  homeTeam,
  awayTeam,
  layout,
  showAreaFill,
  showScoreStrip,
  showShotDots,
  showCrosshair = true,
  teamColors,
}: XGTimelineProps) {
  return computeXGTimeline({
    shots,
    homeTeam,
    awayTeam,
    ...(layout != null ? { layout } : {}),
    ...(showAreaFill != null ? { showAreaFill } : {}),
    ...(showScoreStrip != null ? { showScoreStrip } : {}),
    ...(showShotDots != null ? { showShotDots } : {}),
    showCrosshair,
    ...(teamColors != null ? { teamColors } : {}),
  });
}

export function XGTimelineStaticSvg({
  theme = LIGHT_THEME,
  ...props
}: XGTimelineProps & { theme?: UITheme }) {
  const model = buildXGTimelineModel({ ...props, showCrosshair: false });

  return (
    <XGTimelineScene
      model={model}
      theme={theme}
      interactive={false}
      markersStyle={props.markers}
      linesStyle={props.lines}
      guidesStyle={props.guides}
      areasStyle={props.areas}
    />
  );
}

export function XGTimeline({
  shots,
  homeTeam,
  awayTeam,
  layout,
  showAreaFill,
  showScoreStrip,
  showShotDots,
  showCrosshair = true,
  teamColors,
  markers,
  lines,
  guides,
  areas,
  methodologyNotes,
}: XGTimelineProps) {
  const theme = useTheme();

  const model = useMemo(
    () =>
      buildXGTimelineModel({
        shots,
        homeTeam,
        awayTeam,
        ...(layout != null ? { layout } : {}),
        ...(showAreaFill != null ? { showAreaFill } : {}),
        ...(showScoreStrip != null ? { showScoreStrip } : {}),
        ...(showShotDots != null ? { showShotDots } : {}),
        showCrosshair,
        ...(teamColors != null ? { teamColors } : {}),
      }),
    [
      shots,
      homeTeam,
      awayTeam,
      layout,
      showAreaFill,
      showScoreStrip,
      showShotDots,
      showCrosshair,
      teamColors,
    ],
  );

  const [hoveredMarker, setHoveredMarker] = useState<XGTimelineMarkerModel | null>(null);
  const [crosshairX, setCrosshairX] = useState<number | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      if (!showCrosshair) return;
      const svg = e.currentTarget.closest("svg");
      if (!(svg instanceof SVGSVGElement)) return;
      setCrosshairX(clientPointToSvgX(svg, e.clientX, e.clientY));
    },
    [showCrosshair],
  );

  const handleMouseLeave = useCallback(() => {
    setCrosshairX(null);
  }, []);

  const plot = (
    <div style={{ position: "relative" }}>
      <XGTimelineScene
        model={model}
        theme={theme}
        interactive={true}
        onHoverMarker={setHoveredMarker}
        markersStyle={markers}
        linesStyle={lines}
        guidesStyle={guides}
        areasStyle={areas}
        overlay={
          showCrosshair ? (
            <>
              {crosshairX != null ? (
                <CrosshairOverlay mouseX={crosshairX} model={model} theme={theme} />
              ) : null}
              <rect
                x={model.layout.plotArea.x}
                y={model.layout.plotArea.y}
                width={model.layout.plotArea.width}
                height={model.layout.plotArea.height}
                fill="transparent"
                style={{ cursor: "crosshair" }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />
            </>
          ) : null
        }
      />

      {/* 14. Empty state overlay */}
      {model.emptyState != null && (
        <EmptyState message={model.emptyState.message} theme={theme} />
      )}

      {/* Tooltip on marker hover */}
      {hoveredMarker != null && (
        <ChartTooltip
          testId="xg-tooltip"
          rows={[
            { label: "Minute", value: `${Math.round(hoveredMarker.minute)}'` },
            ...(hoveredMarker.playerName
              ? [{ label: "Player", value: hoveredMarker.playerName }]
              : []),
            { label: "xG", value: formatXg(hoveredMarker.xg) },
            { label: "Outcome", value: hoveredMarker.outcome },
          ]}
          theme={theme}
        />
      )}
    </div>
  );

  return (
    <ChartFrame
      ariaLabel={model.meta.accessibleLabel}
      chartKind="xg-timeline"
      empty={model.emptyState != null}
      maxWidth={720}
      plot={plot}
      methodologyNotes={methodologyNotes}
      theme={theme}
      fontFamily={'"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif'}
      warnings={model.meta.warnings}
    />
  );
}
