import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  computeShotMap,
  type ComputeShotMapInput,
  type ShotMapMarkerModel,
  type ShotMapPreset,
  type XgColorScale,
} from "./compute/index.js";
import type { SharedPitchScale } from "./compute/shared-pitch-scale.js";
import type { Shot } from "@withqwerty/campos-schema";
import {
  computeViewBox,
  Pitch,
  type ProjectFn,
  type Theme as PitchTheme,
  type PitchColors,
  type PitchPreset,
  resolvePitchPreset,
} from "@withqwerty/campos-stadia";

import { useTheme } from "./ThemeContext.js";
import { triggerButtonActionOnKeyDown } from "./keyboardActivation.js";
import { LIGHT_THEME, type UITheme } from "./theme.js";
import {
  ChartPointMark,
  ChartScaleBar,
  ChartTooltip,
  EmptyState,
  PitchChartFrame,
  type PointShape,
} from "./primitives/index.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";

export type ShotMapMarkerStyleContext = {
  shot: Shot;
  marker: ShotMapMarkerModel;
  active: boolean;
  isDarkPitch: boolean;
  sharedScale?: SharedPitchScale;
};

export type ShotMapTrajectoryStyleContext = {
  shot: Shot;
  marker: ShotMapMarkerModel & { endX: number; endY: number };
  isDarkPitch: boolean;
  sharedScale?: SharedPitchScale;
};

export type ShotMapMarkersStyle = {
  fill?: StyleValue<string, ShotMapMarkerStyleContext>;
  fillOpacity?: StyleValue<number, ShotMapMarkerStyleContext>;
  stroke?: StyleValue<string, ShotMapMarkerStyleContext>;
  strokeWidth?: StyleValue<number, ShotMapMarkerStyleContext>;
  opacity?: StyleValue<number, ShotMapMarkerStyleContext>;
  size?: StyleValue<number, ShotMapMarkerStyleContext>;
  shape?: StyleValue<PointShape, ShotMapMarkerStyleContext>;
};

/** SVG line styling for shot origin → target segments (pitch viewBox units). */
export type ShotTrajectoryStyle = {
  show?: StyleValue<boolean, ShotMapTrajectoryStyleContext>;
  /** Line color. Defaults by pitch theme when omitted (dark pitch: light stroke). */
  stroke?: StyleValue<string, ShotMapTrajectoryStyleContext>;
  /** Stroke width in pitch SVG space. Default `0.35`. */
  strokeWidth?: StyleValue<number, ShotMapTrajectoryStyleContext>;
  /** Line opacity 0–1. Default `0.88`. */
  opacity?: StyleValue<number, ShotMapTrajectoryStyleContext>;
  /** e.g. `"4 3"` for dashed trajectories. */
  strokeDasharray?: StyleValue<string | undefined, ShotMapTrajectoryStyleContext>;
  strokeLinecap?: StyleValue<"butt" | "round" | "square", ShotMapTrajectoryStyleContext>;
};

export type ShotMapProps = {
  shots: ComputeShotMapInput["shots"];
  preset?: ShotMapPreset;
  /**
   * xG color ramp. Defaults per preset: `opta` → `"turbo"`, `statsbomb` →
   * `"magma"` (perceptually uniform, Tufte-aligned), editorial presets vary.
   *
   * Breaking change (v0.2, chart-library follow-through): marker radius now
   * scales by **area** rather than linear radius — a shot with xG `0.5` has
   * ~71% the radius of a shot at xG `1.0`, not 50%. Legend sample radii and
   * the scale bar use the same transform, so visual encoding is consistent.
   * Existing fixtures/snapshots will re-render; pin `markers.radius` if you
   * need the old radius-linear behaviour.
   */
  colorScale?: XgColorScale;
  crop?: ComputeShotMapInput["crop"];
  /**
   * Direction the attacker is facing. Defaults to `"up"`. Use `"left"` for the
   * left half of a butterfly composite (attacker faces left, goal on the left)
   * and `"right"` for the right half.
   */
  attackingDirection?: ComputeShotMapInput["attackingDirection"];
  /** Which end of the pitch to show when `crop="half"`. Default `"attack"`. */
  side?: ComputeShotMapInput["side"];
  sharedScale?: SharedPitchScale;
  showHeaderStats?: boolean;
  showSizeScale?: boolean;
  showScaleBar?: boolean;
  showLegend?: boolean;
  markers?: ShotMapMarkersStyle;
  /** When false, hides lines from shot origin to `endX`/`endY` when present. Default true. */
  showShotTrajectory?: boolean;
  trajectories?: ShotTrajectoryStyle;
  pitchPreset?: PitchPreset;
  pitchTheme?: PitchTheme;
  pitchColors?: PitchColors;
  /** Override frame padding in pixels. Default 16. Set to 0 for composites. */
  framePadding?: number;
  /** Override the chart frame max-width in pixels. Default 420. */
  maxWidth?: number;
};

function markerLabel(marker: ShotMapMarkerModel): string {
  return marker.tooltip.rows.map((row) => `${row.label}: ${row.value}`).join(", ");
}

function markerShape(shapeKey: string): PointShape {
  switch (shapeKey) {
    case "hexagon":
    case "square":
    case "triangle":
    case "diamond":
      return shapeKey;
    default:
      return "circle";
  }
}

function renderMarkerGlyph({
  cx,
  cy,
  r,
  shapeKey,
  fill,
  fillOpacity,
  stroke,
  strokeWidth,
  opacity,
}: {
  cx: number;
  cy: number;
  r: number;
  shapeKey: string;
  fill: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}) {
  return (
    <ChartPointMark
      cx={cx}
      cy={cy}
      r={r}
      shape={markerShape(shapeKey)}
      fill={fill}
      {...(fillOpacity != null ? { fillOpacity } : {})}
      {...(stroke != null ? { stroke } : {})}
      {...(strokeWidth != null ? { strokeWidth } : {})}
      {...(opacity != null ? { opacity } : {})}
      {...(shapeKey === "square" ? { cornerRadius: r * 0.15 } : {})}
    />
  );
}

function buildShotLookup(shots: ComputeShotMapInput["shots"]) {
  return new Map(shots.map((shot) => [shot.id, shot] as const));
}

function resolveTrajectoryStyle(
  marker: ShotMapMarkerModel & { endX: number; endY: number },
  shot: Shot,
  isDarkPitch: boolean,
  style: ShotTrajectoryStyle | undefined,
  sharedScale: SharedPitchScale | undefined,
) {
  const context: ShotMapTrajectoryStyleContext = {
    shot,
    marker,
    isDarkPitch,
    ...(sharedScale != null ? { sharedScale } : {}),
  };
  const defaultStroke = isDarkPitch ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)";
  const show = resolveStyleValue(style?.show, context) ?? true;
  return {
    show,
    stroke: resolveStyleValue(style?.stroke, context) ?? defaultStroke,
    strokeWidth: resolveStyleValue(style?.strokeWidth, context) ?? 0.35,
    opacity: resolveStyleValue(style?.opacity, context) ?? 0.88,
    strokeLinecap: resolveStyleValue(style?.strokeLinecap, context) ?? "round",
    strokeDasharray: resolveStyleValue(style?.strokeDasharray, context),
  };
}

function ShotTrajectories({
  markers,
  shotById,
  project,
  isDarkPitch,
  enabled,
  style,
  sharedScale,
}: {
  markers: ShotMapMarkerModel[];
  shotById: ReadonlyMap<string, Shot>;
  project: ProjectFn;
  isDarkPitch: boolean;
  enabled: boolean;
  style: ShotTrajectoryStyle | undefined;
  sharedScale: SharedPitchScale | undefined;
}) {
  if (!enabled) {
    return null;
  }
  const withTrajectory = markers.filter(
    (m): m is ShotMapMarkerModel & { endX: number; endY: number } =>
      typeof m.endX === "number" &&
      typeof m.endY === "number" &&
      Number.isFinite(m.endX) &&
      Number.isFinite(m.endY),
  );
  if (withTrajectory.length === 0) {
    return null;
  }
  return (
    <g data-testid="shotmap-trajectories" aria-hidden="true">
      {withTrajectory.map((m) => {
        const shot = shotById.get(m.shotId);
        if (shot == null) {
          return null;
        }
        const resolved = resolveTrajectoryStyle(m, shot, isDarkPitch, style, sharedScale);
        if (!resolved.show) {
          return null;
        }
        const start = project(m.x, m.y);
        const end = project(m.endX, m.endY);
        return (
          <line
            key={`traj-${m.shotId}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={resolved.stroke}
            strokeWidth={resolved.strokeWidth}
            strokeLinecap={resolved.strokeLinecap}
            vectorEffect="non-scaling-stroke"
            opacity={resolved.opacity}
            {...(resolved.strokeDasharray != null
              ? { strokeDasharray: resolved.strokeDasharray }
              : {})}
          />
        );
      })}
    </g>
  );
}

function renderMarker(
  shot: Shot,
  marker: ShotMapMarkerModel,
  active: boolean,
  project: ProjectFn,
  isDarkPitch: boolean,
  style?: ShotMapMarkersStyle,
  sharedScale?: SharedPitchScale,
): ReactNode {
  const { x, y } = project(marker.x, marker.y);
  const context: ShotMapMarkerStyleContext = {
    shot,
    marker,
    active,
    isDarkPitch,
    ...(sharedScale != null ? { sharedScale } : {}),
  };
  const s = resolveStyleValue(style?.size, context) ?? marker.visualSize;
  // Opta preset uses transparent fill for non-goals — give them a thin
  // outline so they're visible on any pitch background.
  const needsContrastOutline = marker.fillOpacity === 0;
  const outlineColor = needsContrastOutline
    ? isDarkPitch
      ? "rgba(255,255,255,0.7)"
      : "rgba(0,0,0,0.35)"
    : marker.stroke;
  const common = {
    fill: resolveStyleValue(style?.fill, context) ?? marker.fill,
    fillOpacity: resolveStyleValue(style?.fillOpacity, context) ?? marker.fillOpacity,
    stroke: resolveStyleValue(style?.stroke, context) ?? outlineColor,
    strokeWidth:
      resolveStyleValue(style?.strokeWidth, context) ??
      (marker.outlineKey === "goal" ? 0.4 : 0.25),
    opacity: resolveStyleValue(style?.opacity, context) ?? (active ? 1 : 0.92),
  };
  return renderMarkerGlyph({
    cx: x,
    cy: y,
    r: s,
    shapeKey: resolveStyleValue(style?.shape, context) ?? markerShape(marker.shapeKey),
    ...common,
  });
}

function LegendShapeSwatch({ shapeKey, color }: { shapeKey: string; color: string }) {
  const s = 5;
  const c = 7;
  return (
    <svg width={14} height={14} aria-hidden="true" style={{ display: "block" }}>
      {renderMarkerGlyph({
        cx: c,
        cy: c,
        r: s,
        shapeKey,
        fill: color,
        stroke: "none",
      })}
    </svg>
  );
}

function buildShotMapModel({
  shots,
  preset,
  colorScale,
  crop,
  attackingDirection,
  side,
  sharedScale,
}: ShotMapProps) {
  return computeShotMap({
    shots,
    ...(preset != null ? { preset } : {}),
    ...(colorScale != null ? { colorScale } : {}),
    ...(crop != null ? { crop } : {}),
    ...(attackingDirection != null ? { attackingDirection } : {}),
    ...(side != null ? { side } : {}),
    ...(sharedScale != null ? { sharedScale } : {}),
  });
}

export function ShotMapStaticSvg({
  theme = LIGHT_THEME,
  showShotTrajectory = true,
  trajectories,
  ...props
}: ShotMapProps & { theme?: UITheme }) {
  const model = buildShotMapModel(props);
  const shotById = buildShotLookup(props.shots);
  const isDarkPitch =
    resolvePitchPreset(props.pitchPreset, props.pitchTheme).theme === "secondary";
  const viewBox = computeViewBox(
    model.plot.pitch.crop,
    model.plot.pitch.attackingDirection,
    model.plot.pitch.side,
  );

  return (
    <Pitch
      crop={model.plot.pitch.crop}
      attackingDirection={model.plot.pitch.attackingDirection}
      side={model.plot.pitch.side}
      interactive={false}
      role="img"
      ariaLabel={model.meta.accessibleLabel}
      {...(props.pitchPreset != null ? { preset: props.pitchPreset } : {})}
      {...(props.pitchTheme != null ? { theme: props.pitchTheme } : {})}
      {...(props.pitchColors != null ? { colors: props.pitchColors } : {})}
      style={{ overflow: "visible" }}
    >
      {({ project }) =>
        model.emptyState ? (
          <text
            x={viewBox.minX + viewBox.width / 2}
            y={viewBox.minY + viewBox.height / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={theme.text.secondary}
            fontSize={4}
            fontWeight={700}
          >
            {model.emptyState.message}
          </text>
        ) : (
          <>
            <ShotTrajectories
              markers={model.plot.markers}
              shotById={shotById}
              project={project}
              isDarkPitch={isDarkPitch}
              enabled={showShotTrajectory}
              style={trajectories}
              sharedScale={props.sharedScale}
            />
            {model.plot.markers.map((marker) => (
              <g key={marker.shotId}>
                {(() => {
                  const shot = shotById.get(marker.shotId);
                  if (shot == null) {
                    return null;
                  }
                  return renderMarker(
                    shot,
                    marker,
                    true,
                    project,
                    isDarkPitch,
                    props.markers,
                    props.sharedScale,
                  );
                })()}
              </g>
            ))}
          </>
        )
      }
    </Pitch>
  );
}

export function ShotMap({
  shots,
  preset,
  colorScale,
  crop,
  attackingDirection,
  side,
  sharedScale,
  showHeaderStats = false,
  showSizeScale = true,
  showScaleBar = true,
  showLegend = true,
  markers,
  showShotTrajectory = true,
  trajectories,
  pitchPreset,
  pitchTheme,
  pitchColors,
  framePadding,
  maxWidth,
}: ShotMapProps) {
  const theme = useTheme();
  const isDarkPitch = resolvePitchPreset(pitchPreset, pitchTheme).theme === "secondary";
  const model = useMemo(
    () =>
      buildShotMapModel({
        shots,
        ...(preset != null ? { preset } : {}),
        ...(colorScale != null ? { colorScale } : {}),
        ...(crop != null ? { crop } : {}),
        ...(attackingDirection != null ? { attackingDirection } : {}),
        ...(side != null ? { side } : {}),
        ...(sharedScale != null ? { sharedScale } : {}),
      }),
    [shots, preset, colorScale, crop, attackingDirection, side, sharedScale],
  );
  const shotById = useMemo(() => buildShotLookup(shots), [shots]);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const renderKey = shots.map((shot) => shot.id).join("|");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when shots prop changes
    setActiveMarkerId(null);
  }, [shots]);

  const activeMarker =
    model.plot.markers.find((marker) => marker.shotId === activeMarkerId) ?? null;
  const regions: Record<(typeof model.layout.order)[number], ReactNode | null> = {
    headerStats:
      showHeaderStats && model.headerStats ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
            minWidth: 0,
          }}
        >
          {model.headerStats.items.map((item) => (
            <div key={item.label} style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: theme.text.muted,
                  lineHeight: 1.2,
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  lineHeight: 1.1,
                  minWidth: 0,
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : null,
    sizeScale:
      showSizeScale && model.sizeScale ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12,
            color: theme.text.muted,
          }}
        >
          <span>{model.sizeScale.label}</span>
          {model.sizeScale.samples.map((sample) => (
            <div
              key={sample.xg}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <svg
                width={sample.size * 6 + 4}
                height={sample.size * 6 + 4}
                style={{ display: "block" }}
              >
                <circle
                  cx={(sample.size * 6 + 4) / 2}
                  cy={(sample.size * 6 + 4) / 2}
                  r={sample.size * 3}
                  fill={theme.text.muted}
                  opacity={0.5}
                />
              </svg>
              <span style={{ fontSize: 10 }}>{sample.xg}</span>
            </div>
          ))}
        </div>
      ) : null,
    scaleBar:
      showScaleBar && model.scaleBar ? (
        <ChartScaleBar
          label={model.scaleBar.label}
          startLabel={model.scaleBar.domain[0].toFixed(2)}
          endLabel={model.scaleBar.domain[1].toFixed(2)}
          stops={model.scaleBar.stops}
          testId="shotmap-scale-bar"
          theme={theme}
        />
      ) : null,
    plot: (
      <div style={{ position: "relative", minHeight: 0 }}>
        <Pitch
          crop={model.plot.pitch.crop}
          attackingDirection={model.plot.pitch.attackingDirection}
          side={model.plot.pitch.side}
          {...(pitchPreset != null ? { preset: pitchPreset } : {})}
          {...(pitchTheme != null ? { theme: pitchTheme } : {})}
          {...(pitchColors != null ? { colors: pitchColors } : {})}
          style={{ overflow: "visible" }}
        >
          {({ project }) => (
            <>
              <ShotTrajectories
                markers={model.plot.markers}
                shotById={shotById}
                project={project}
                isDarkPitch={isDarkPitch}
                enabled={showShotTrajectory}
                style={trajectories}
                sharedScale={sharedScale}
              />
              {model.plot.markers.map((marker) => (
                <g
                  key={marker.shotId}
                  role="button"
                  tabIndex={0}
                  aria-label={markerLabel(marker)}
                  onMouseEnter={() => {
                    setActiveMarkerId(marker.shotId);
                  }}
                  onMouseLeave={() => {
                    setActiveMarkerId((current) =>
                      current === marker.shotId ? null : current,
                    );
                  }}
                  onFocus={() => {
                    setActiveMarkerId(marker.shotId);
                  }}
                  onBlur={() => {
                    setActiveMarkerId((current) =>
                      current === marker.shotId ? null : current,
                    );
                  }}
                  onClick={() => {
                    setActiveMarkerId((current) =>
                      current === marker.shotId ? null : marker.shotId,
                    );
                  }}
                  onKeyDown={(event) => {
                    triggerButtonActionOnKeyDown(event, () => {
                      setActiveMarkerId((current) =>
                        current === marker.shotId ? null : marker.shotId,
                      );
                    });
                  }}
                  style={{ cursor: "pointer", outline: "none" }}
                >
                  {(() => {
                    const shot = shotById.get(marker.shotId);
                    if (shot == null) {
                      return null;
                    }
                    return renderMarker(
                      shot,
                      marker,
                      activeMarkerId === marker.shotId,
                      project,
                      isDarkPitch,
                      markers,
                      sharedScale,
                    );
                  })()}
                </g>
              ))}
            </>
          )}
        </Pitch>

        {model.emptyState ? (
          <EmptyState message={model.emptyState.message} theme={theme} />
        ) : null}

        {activeMarker ? (
          <ChartTooltip
            testId="shotmap-tooltip"
            rows={activeMarker.tooltip.rows.map((row) => ({
              label: row.label,
              value: row.value,
            }))}
            theme={theme}
          />
        ) : null}
      </div>
    ),
    legend:
      showLegend && model.legend ? (
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            fontSize: 12,
            color: theme.text.secondary,
          }}
        >
          {model.legend.groups.map((group) =>
            group.items.map((item) => (
              <div
                key={`${group.kind}:${item.key}`}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                {group.kind === "shape" ? (
                  <LegendShapeSwatch shapeKey={item.key} color={theme.text.muted} />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background:
                        group.kind === "outline" && item.key === "shot"
                          ? "transparent"
                          : (item.color ?? theme.text.muted),
                      border: `1.5px solid ${item.color ?? theme.text.muted}`,
                    }}
                  />
                )}
                <span>{item.label}</span>
              </div>
            )),
          )}
        </div>
      ) : null,
  };

  const prePlot = model.layout.order
    .filter((region) => region !== "plot" && region !== "legend")
    .map((region) => (
      <div key={region} style={{ minWidth: 0 }}>
        {regions[region]}
      </div>
    ));
  const postPlot = model.layout.order
    .filter((region) => region === "legend")
    .map((region) => (
      <div key={region} style={{ minWidth: 0 }}>
        {regions[region]}
      </div>
    ));

  return (
    <PitchChartFrame
      key={renderKey}
      ariaLabel={model.meta.accessibleLabel}
      chartKind="shot-map"
      empty={model.emptyState != null}
      maxWidth={maxWidth ?? 420}
      prePlot={<>{prePlot}</>}
      plot={regions.plot ?? null}
      postPlot={<>{postPlot}</>}
      theme={theme}
      {...(framePadding != null ? { padding: framePadding } : {})}
    />
  );
}
