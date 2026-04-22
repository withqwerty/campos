import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  computePassMap,
  type ComputePassMapInput,
  type PassMapMarkerModel,
} from "./compute/index.js";
import type { SharedPitchScale } from "./compute/shared-pitch-scale.js";
import type { PassEvent } from "@withqwerty/campos-schema";
import {
  computeViewBox,
  Pitch,
  type ProjectFn,
  type Theme as PitchTheme,
  type PitchColors,
} from "@withqwerty/campos-stadia";

import { useTheme } from "./ThemeContext.js";
import { LIGHT_THEME, type UITheme } from "./theme.js";
import {
  ChartLineMark,
  ChartSvgEmptyState,
  ChartTooltip,
  EmptyState,
  PitchChartFrame,
} from "./primitives/index.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";

export type PassMapLineStyleContext = {
  pass: PassEvent;
  marker: PassMapMarkerModel;
  active: boolean;
  theme: UITheme;
  sharedScale?: SharedPitchScale;
};

export type PassMapDotStyleContext = {
  pass: PassEvent;
  marker: PassMapMarkerModel;
  active: boolean;
  theme: UITheme;
  sharedScale?: SharedPitchScale;
};

export type PassMapLineStyle = {
  show?: StyleValue<boolean, PassMapLineStyleContext>;
  stroke?: StyleValue<string, PassMapLineStyleContext>;
  strokeWidth?: StyleValue<number, PassMapLineStyleContext>;
  strokeLinecap?: StyleValue<"butt" | "round" | "square", PassMapLineStyleContext>;
  strokeDasharray?: StyleValue<string | undefined, PassMapLineStyleContext>;
  opacity?: StyleValue<number, PassMapLineStyleContext>;
};

export type PassMapDotStyle = {
  show?: StyleValue<boolean, PassMapDotStyleContext>;
  fill?: StyleValue<string, PassMapDotStyleContext>;
  radius?: StyleValue<number, PassMapDotStyleContext>;
  opacity?: StyleValue<number, PassMapDotStyleContext>;
  stroke?: StyleValue<string, PassMapDotStyleContext>;
  strokeWidth?: StyleValue<number, PassMapDotStyleContext>;
};

export type PassMapProps = {
  passes: ComputePassMapInput["passes"];
  crop?: ComputePassMapInput["crop"];
  attackingDirection?: ComputePassMapInput["attackingDirection"];
  sharedScale?: SharedPitchScale;
  showHeaderStats?: boolean;
  showLegend?: boolean;
  lines?: PassMapLineStyle;
  dots?: PassMapDotStyle;
  pitchTheme?: PitchTheme;
  pitchColors?: PitchColors;
  /** Override frame padding in pixels. Default 16. Set to 0 for composites. */
  framePadding?: number;
  /** Override the chart frame max-width in pixels. Default varies by attackingDirection/crop. */
  maxWidth?: number;
};

function markerLabel(marker: PassMapMarkerModel): string {
  return marker.tooltip.rows.map((row) => `${row.label}: ${row.value}`).join(", ");
}

function buildPassLookup(passes: ComputePassMapInput["passes"]) {
  return new Map(passes.map((pass) => [pass.id, pass] as const));
}

function resolveLineStyle(
  marker: PassMapMarkerModel,
  pass: PassEvent,
  active: boolean,
  style: PassMapLineStyle | undefined,
  theme: UITheme,
  sharedScale: SharedPitchScale | undefined,
) {
  const context: PassMapLineStyleContext = {
    pass,
    marker,
    active,
    theme,
    ...(sharedScale != null ? { sharedScale } : {}),
  };
  return {
    show: resolveStyleValue(style?.show, context) ?? true,
    stroke: resolveStyleValue(style?.stroke, context) ?? marker.color,
    strokeWidth: resolveStyleValue(style?.strokeWidth, context) ?? 0.5,
    strokeLinecap: resolveStyleValue(style?.strokeLinecap, context) ?? "round",
    strokeDasharray: resolveStyleValue(style?.strokeDasharray, context),
    opacity: resolveStyleValue(style?.opacity, context) ?? (active ? 1 : 0.7),
  };
}

function resolveDotStyle(
  marker: PassMapMarkerModel,
  pass: PassEvent,
  active: boolean,
  style: PassMapDotStyle | undefined,
  theme: UITheme,
  sharedScale: SharedPitchScale | undefined,
) {
  const context: PassMapDotStyleContext = {
    pass,
    marker,
    active,
    theme,
    ...(sharedScale != null ? { sharedScale } : {}),
  };
  return {
    show: resolveStyleValue(style?.show, context) ?? true,
    fill: resolveStyleValue(style?.fill, context) ?? marker.color,
    radius: resolveStyleValue(style?.radius, context) ?? 1.2,
    opacity: resolveStyleValue(style?.opacity, context) ?? (active ? 1 : 0.8),
    stroke: resolveStyleValue(style?.stroke, context),
    strokeWidth: resolveStyleValue(style?.strokeWidth, context),
  };
}

function collectArrowColors(
  markers: PassMapMarkerModel[],
  passById: ReadonlyMap<string, PassEvent>,
  lines: PassMapLineStyle | undefined,
  theme: UITheme,
  sharedScale: SharedPitchScale | undefined,
) {
  const colors = new Set<string>();
  for (const marker of markers) {
    if (marker.isDot) continue;
    const pass = passById.get(marker.passId);
    if (pass == null) continue;
    const inactiveStyle = resolveLineStyle(
      marker,
      pass,
      false,
      lines,
      theme,
      sharedScale,
    );
    if (inactiveStyle.show) {
      colors.add(inactiveStyle.stroke);
    }
    const activeStyle = resolveLineStyle(marker, pass, true, lines, theme, sharedScale);
    if (activeStyle.show) {
      colors.add(activeStyle.stroke);
    }
  }
  return Array.from(colors);
}

function isMarkerVisible(
  marker: PassMapMarkerModel,
  pass: PassEvent,
  active: boolean,
  lines: PassMapLineStyle | undefined,
  dots: PassMapDotStyle | undefined,
  theme: UITheme,
  sharedScale: SharedPitchScale | undefined,
): boolean {
  if (marker.isDot) {
    return resolveDotStyle(marker, pass, active, dots, theme, sharedScale).show;
  }
  return resolveLineStyle(marker, pass, active, lines, theme, sharedScale).show;
}

function renderArrow(
  pass: PassEvent,
  marker: PassMapMarkerModel,
  active: boolean,
  project: ProjectFn,
  arrowId: string,
  lines: PassMapLineStyle | undefined,
  dots: PassMapDotStyle | undefined,
  theme: UITheme,
  sharedScale: SharedPitchScale | undefined,
): ReactNode {
  const { x: x1, y: y1 } = project(marker.x, marker.y);

  if (marker.isDot) {
    const dotStyle = resolveDotStyle(marker, pass, active, dots, theme, sharedScale);
    if (!dotStyle.show) {
      return null;
    }
    return (
      <circle
        cx={x1}
        cy={y1}
        r={dotStyle.radius}
        fill={dotStyle.fill}
        opacity={dotStyle.opacity}
        {...(dotStyle.stroke != null ? { stroke: dotStyle.stroke } : {})}
        {...(dotStyle.strokeWidth != null ? { strokeWidth: dotStyle.strokeWidth } : {})}
      />
    );
  }

  const lineStyle = resolveLineStyle(marker, pass, active, lines, theme, sharedScale);
  if (!lineStyle.show) {
    return null;
  }
  const { x: x2, y: y2 } = project(marker.endX, marker.endY);

  return (
    <>
      {/* Invisible wider hit area */}
      <ChartLineMark
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Visible pass line */}
      <ChartLineMark
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={lineStyle.stroke}
        strokeWidth={lineStyle.strokeWidth}
        strokeLinecap={lineStyle.strokeLinecap}
        {...(lineStyle.strokeDasharray != null
          ? { strokeDasharray: lineStyle.strokeDasharray }
          : {})}
        opacity={lineStyle.opacity}
        markerEnd={`url(#${arrowId})`}
      />
    </>
  );
}

function renderStaticArrow(
  pass: PassEvent,
  marker: PassMapMarkerModel,
  project: ProjectFn,
  arrowId: string,
  lines: PassMapLineStyle | undefined,
  dots: PassMapDotStyle | undefined,
  theme: UITheme,
  sharedScale: SharedPitchScale | undefined,
): ReactNode {
  const { x: x1, y: y1 } = project(marker.x, marker.y);

  if (marker.isDot) {
    const dotStyle = resolveDotStyle(marker, pass, false, dots, theme, sharedScale);
    if (!dotStyle.show) {
      return null;
    }
    return (
      <circle
        cx={x1}
        cy={y1}
        r={dotStyle.radius}
        fill={dotStyle.fill}
        opacity={dotStyle.opacity}
        {...(dotStyle.stroke != null ? { stroke: dotStyle.stroke } : {})}
        {...(dotStyle.strokeWidth != null ? { strokeWidth: dotStyle.strokeWidth } : {})}
      />
    );
  }

  const lineStyle = resolveLineStyle(marker, pass, false, lines, theme, sharedScale);
  if (!lineStyle.show) {
    return null;
  }
  const { x: x2, y: y2 } = project(marker.endX, marker.endY);

  return (
    <ChartLineMark
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={lineStyle.stroke}
      strokeWidth={lineStyle.strokeWidth + 0.05}
      strokeLinecap={lineStyle.strokeLinecap}
      {...(lineStyle.strokeDasharray != null
        ? { strokeDasharray: lineStyle.strokeDasharray }
        : {})}
      opacity={
        resolveStyleValue(lines?.opacity, {
          pass,
          marker,
          active: false,
          theme,
          ...(sharedScale != null ? { sharedScale } : {}),
        }) ?? 0.82
      }
      markerEnd={`url(#${arrowId})`}
    />
  );
}

function buildPassMapModel({ passes, crop, attackingDirection }: PassMapProps) {
  return computePassMap({
    passes,
    ...(crop != null ? { crop } : {}),
    ...(attackingDirection != null ? { attackingDirection } : {}),
  });
}

export function PassMapStaticSvg({
  theme = LIGHT_THEME,
  ...props
}: PassMapProps & { theme?: UITheme }) {
  const model = buildPassMapModel(props);
  const passById = buildPassLookup(props.passes);
  const viewBox = computeViewBox(
    model.plot.pitch.crop,
    model.plot.pitch.attackingDirection,
  );
  const arrowColors = collectArrowColors(
    model.plot.markers,
    passById,
    props.lines,
    theme,
    props.sharedScale,
  );

  return (
    <Pitch
      crop={model.plot.pitch.crop}
      attackingDirection={model.plot.pitch.attackingDirection}
      interactive={false}
      role="img"
      ariaLabel={model.meta.accessibleLabel}
      {...(props.pitchTheme != null ? { theme: props.pitchTheme } : {})}
      {...(props.pitchColors != null ? { colors: props.pitchColors } : {})}
    >
      {({ project }) =>
        model.emptyState ? (
          <ChartSvgEmptyState
            x={viewBox.minX + viewBox.width / 2}
            y={viewBox.minY + viewBox.height / 2}
            message={model.emptyState.message}
            theme={theme}
            fontSize={4}
            dominantBaseline="central"
          />
        ) : (
          <>
            {arrowColors.length > 0 ? (
              <defs>
                {arrowColors.map((color) => {
                  const id = `passmap-static-arrow-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
                  return (
                    <marker
                      key={id}
                      id={id}
                      markerWidth="4"
                      markerHeight="4"
                      refX="3"
                      refY="2"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path d="M0,0 L4,2 L0,4 Z" fill={color} />
                    </marker>
                  );
                })}
              </defs>
            ) : null}

            {model.plot.markers.map((marker) => {
              const pass = passById.get(marker.passId);
              if (pass == null) {
                return null;
              }
              if (
                !isMarkerVisible(
                  marker,
                  pass,
                  false,
                  props.lines,
                  props.dots,
                  theme,
                  props.sharedScale,
                )
              ) {
                return null;
              }
              const arrowColor = resolveLineStyle(
                marker,
                pass,
                false,
                props.lines,
                theme,
                props.sharedScale,
              ).stroke;
              const arrowId = `passmap-static-arrow-${arrowColor.replace(/[^a-zA-Z0-9]/g, "")}`;
              return (
                <g key={marker.passId}>
                  {renderStaticArrow(
                    pass,
                    marker,
                    project,
                    arrowId,
                    props.lines,
                    props.dots,
                    theme,
                    props.sharedScale,
                  )}
                </g>
              );
            })}
          </>
        )
      }
    </Pitch>
  );
}

export function PassMap({
  passes,
  crop,
  attackingDirection,
  sharedScale,
  showHeaderStats = true,
  showLegend = true,
  lines,
  dots,
  pitchTheme,
  pitchColors,
  framePadding,
  maxWidth,
}: PassMapProps) {
  const theme = useTheme();
  const model = useMemo(
    () => buildPassMapModel({ passes, crop, attackingDirection }),
    [passes, crop, attackingDirection],
  );
  const passById = useMemo(() => buildPassLookup(passes), [passes]);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const renderKey = passes.map((pass) => pass.id).join("|");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when passes change
    setActiveMarkerId(null);
  }, [passes]);

  const activeMarker =
    activeMarkerId != null
      ? (() => {
          const marker =
            model.plot.markers.find((candidate) => candidate.passId === activeMarkerId) ??
            null;
          if (marker == null) {
            return null;
          }
          const pass = passById.get(marker.passId);
          if (pass == null) {
            return null;
          }
          if (!isMarkerVisible(marker, pass, true, lines, dots, theme, sharedScale)) {
            return null;
          }
          return marker;
        })()
      : null;

  // Collect unique colors for arrowhead marker defs
  const arrowColors = useMemo(
    () => collectArrowColors(model.plot.markers, passById, lines, theme, sharedScale),
    [model.plot.markers, passById, lines, theme, sharedScale],
  );

  const regions: Record<(typeof model.layout.order)[number], ReactNode | null> = {
    headerStats:
      showHeaderStats && model.headerStats ? (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {model.headerStats.items.map((item) => (
            <div key={item.label} style={{ display: "grid", gap: 2 }}>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: theme.text.muted,
                }}
              >
                {item.label}
              </span>
              <span style={{ fontSize: 20, fontWeight: 600 }}>{item.value}</span>
            </div>
          ))}
        </div>
      ) : null,
    plot: (
      <div style={{ position: "relative", minHeight: 0 }}>
        <Pitch
          crop={model.plot.pitch.crop}
          attackingDirection={model.plot.pitch.attackingDirection}
          {...(pitchTheme != null ? { theme: pitchTheme } : {})}
          {...(pitchColors != null ? { colors: pitchColors } : {})}
        >
          {({ project }) => (
            <>
              <defs>
                {arrowColors.map((color) => {
                  const id = `arrow-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
                  return (
                    <marker
                      key={id}
                      id={id}
                      markerWidth="4"
                      markerHeight="4"
                      refX="3"
                      refY="2"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path d="M0,0 L4,2 L0,4 Z" fill={color} />
                    </marker>
                  );
                })}
              </defs>

              {model.plot.markers.map((marker) => {
                const pass = passById.get(marker.passId);
                if (pass == null) {
                  return null;
                }
                if (
                  !isMarkerVisible(
                    marker,
                    pass,
                    activeMarkerId === marker.passId,
                    lines,
                    dots,
                    theme,
                    sharedScale,
                  )
                ) {
                  return null;
                }
                const arrowColor = resolveLineStyle(
                  marker,
                  pass,
                  activeMarkerId === marker.passId,
                  lines,
                  theme,
                  sharedScale,
                ).stroke;
                const arrowId = `arrow-${arrowColor.replace(/[^a-zA-Z0-9]/g, "")}`;
                return (
                  <g
                    key={marker.passId}
                    role="button"
                    tabIndex={0}
                    aria-label={markerLabel(marker)}
                    onMouseEnter={() => {
                      setActiveMarkerId(marker.passId);
                    }}
                    onMouseLeave={() => {
                      setActiveMarkerId((c) => (c === marker.passId ? null : c));
                    }}
                    onFocus={() => {
                      setActiveMarkerId(marker.passId);
                    }}
                    onBlur={() => {
                      setActiveMarkerId((c) => (c === marker.passId ? null : c));
                    }}
                    onClick={() => {
                      setActiveMarkerId((c) =>
                        c === marker.passId ? null : marker.passId,
                      );
                    }}
                    style={{ cursor: "pointer", outline: "none" }}
                  >
                    {renderArrow(
                      pass,
                      marker,
                      activeMarkerId === marker.passId,
                      project,
                      arrowId,
                      lines,
                      dots,
                      theme,
                      sharedScale,
                    )}
                  </g>
                );
              })}
            </>
          )}
        </Pitch>

        {model.emptyState ? (
          <EmptyState message={model.emptyState.message} theme={theme} />
        ) : null}

        {activeMarker ? (
          <ChartTooltip
            testId="passmap-tooltip"
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
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: theme.text.muted,
              marginBottom: 6,
            }}
          >
            {model.legend.title}
          </div>
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
            {model.legend.items.map((item) => (
              <div
                key={item.key}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 3,
                    borderRadius: 2,
                    background: item.color,
                  }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null,
  };

  const prePlot = model.layout.order
    .filter((region) => region !== "plot" && region !== "legend")
    .map((region) => <div key={region}>{regions[region]}</div>);
  const postPlot = model.layout.order
    .filter((region) => region === "legend")
    .map((region) => <div key={region}>{regions[region]}</div>);

  return (
    <PitchChartFrame
      key={renderKey}
      ariaLabel={model.meta.accessibleLabel}
      chartKind="pass-map"
      empty={model.emptyState != null}
      maxWidth={
        maxWidth ??
        (model.meta.attackingDirection === "right"
          ? 560
          : model.meta.crop === "half"
            ? 420
            : 360)
      }
      prePlot={<>{prePlot}</>}
      plot={regions.plot ?? null}
      postPlot={<>{postPlot}</>}
      theme={theme}
      {...(framePadding != null ? { padding: framePadding } : {})}
    />
  );
}
