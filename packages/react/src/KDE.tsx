import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  computeKDE,
  type ComputeKDEInput,
  type KDEModel,
  resolveColorStops,
} from "./compute/index.js";
import type { ColorStop } from "./compute/index.js";
import {
  Pitch,
  type ProjectFn,
  type Theme as PitchTheme,
  type PitchColors,
} from "@withqwerty/campos-stadia";

import { useTheme } from "./ThemeContext.js";
import { densityToDataURL } from "./kdeRaster.js";
import { sampleKDEAtPitchPoint, svgPointToPitchPoint } from "./kdeProjection.js";
import { resolveAutoPitchLineColors } from "./pitchContrast.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";
import type { UITheme } from "./theme.js";
import {
  ChartDensitySurfaceImage,
  ChartScaleBar,
  ChartTooltip,
  EmptyState,
  PitchChartFrame,
} from "./primitives/index.js";

export type KDEColorScale =
  | "magma"
  | "viridis"
  | "inferno"
  | "blues"
  | "greens"
  | "custom";

export type KDEAreaStyleContext = {
  model: KDEModel;
  theme: UITheme;
};

export type KDEGuideStyleContext = {
  model: KDEModel;
  theme: UITheme;
};

export type KDEAreasStyle = {
  show?: StyleValue<boolean, KDEAreaStyleContext>;
  palette?: StyleValue<KDEColorScale, KDEAreaStyleContext>;
  colorStops?: StyleValue<ColorStop[], KDEAreaStyleContext>;
  opacity?: StyleValue<number, KDEAreaStyleContext>;
};

export type KDEGuidesStyle = {
  showScaleBar?: StyleValue<boolean, KDEGuideStyleContext>;
  label?: StyleValue<string, KDEGuideStyleContext>;
};

export type KDEProps = {
  events: ComputeKDEInput["events"];
  bandwidth?: "auto" | number;
  resolution?: number;
  normalize?: boolean;
  threshold?: number;
  attackingDirection?: "up" | "down" | "left" | "right";
  crop?: "full" | "half";
  pitchTheme?: PitchTheme;
  pitchColors?: PitchColors;
  /**
   * When true (default), dark colorscales (magma/inferno/viridis/dark custom)
   * automatically force the pitch lines to white so markings stay visible on
   * top of dark density fills. The override takes precedence over any
   * user-provided `pitchColors.lines`. Set to `false` to disable.
   * @default true
   */
  autoPitchLines?: boolean;
  areas?: KDEAreasStyle;
  guides?: KDEGuidesStyle;
  /** Override frame padding in pixels. Default 16. Set to 0 for composites. */
  framePadding?: number;
  /** Override the chart frame max-width in pixels. Default varies by attackingDirection/crop. */
  maxWidth?: number;
  /**
   * Render custom SVG children on top of the density surface (and above the
   * hit-test rect). Receives the same `project` function as `Pitch` children
   * so markers align with the pitch coordinate frame.
   */
  overlay?: (ctx: { project: ProjectFn }) => ReactNode;
  /**
   * When true (default), hovering the density surface shows a tooltip with
   * the sampled density value. Set to `false` when the chart uses an
   * `overlay` with per-marker tooltips so the two don't fight each other.
   * @default true
   */
  showDensityTooltip?: boolean;
};

// ---------------------------------------------------------------------------
// Density surface rendered as an <image> inside the Pitch SVG
// ---------------------------------------------------------------------------

function DensitySurface({
  model,
  project,
  colorStops,
  opacity,
}: {
  model: KDEModel;
  project: ProjectFn;
  colorStops: ColorStop[];
  opacity: number;
}) {
  const [dataURL, setDataURL] = useState<string | null>(null);

  useEffect(() => {
    const url = densityToDataURL(model, colorStops, opacity);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: compute data URL from model on mount/change
    setDataURL(url);
  }, [model, colorStops, opacity]);

  return (
    <ChartDensitySurfaceImage
      href={dataURL}
      project={project}
      opacity={opacity}
      testId="kde-surface"
    />
  );
}

function readSvgPoint(eventTarget: SVGElement, clientX: number, clientY: number) {
  const svg = eventTarget.ownerSVGElement ?? eventTarget.closest("svg");
  if (!svg) return null;
  if (typeof svg.createSVGPoint === "function") {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const inverse = svg.getScreenCTM()?.inverse();
    if (inverse != null) {
      return pt.matrixTransform(inverse);
    }
  }

  const rect = svg.getBoundingClientRect();
  const baseViewBox = svg.viewBox.baseVal;
  const viewBox =
    typeof baseViewBox.width === "number" && baseViewBox.width > 0
      ? baseViewBox
      : { x: 0, y: 0, width: rect.width, height: rect.height };
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: viewBox.x, y: viewBox.y };
  }

  return {
    x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width,
    y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height,
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function KDE({
  events,
  bandwidth,
  resolution,
  normalize,
  threshold,
  attackingDirection,
  crop,
  pitchTheme,
  pitchColors,
  autoPitchLines = true,
  areas,
  guides,
  framePadding,
  maxWidth,
  overlay,
  showDensityTooltip = true,
}: KDEProps) {
  const theme = useTheme();
  const model = useMemo(
    () =>
      computeKDE({
        events,
        ...(bandwidth != null ? { bandwidth } : {}),
        ...(resolution != null ? { resolution } : {}),
        ...(normalize != null ? { normalize } : {}),
        ...(threshold != null ? { threshold } : {}),
        ...(attackingDirection != null ? { attackingDirection } : {}),
        ...(crop != null ? { crop } : {}),
      }),
    [events, bandwidth, resolution, normalize, threshold, attackingDirection, crop],
  );

  const areaContext: KDEAreaStyleContext = { model, theme };
  const guideContext: KDEGuideStyleContext = { model, theme };

  const resolvedAreaStops = (() => {
    const explicitStops = resolveStyleValue(areas?.colorStops, areaContext);
    if (explicitStops != null) {
      return explicitStops;
    }
    const palette = resolveStyleValue(areas?.palette, areaContext) ?? "magma";
    return resolveColorStops(palette, undefined);
  })();

  const surfaceVisible = resolveStyleValue(areas?.show, areaContext) ?? true;
  const surfaceOpacity = resolveStyleValue(areas?.opacity, areaContext) ?? 1;
  // When the surface is hidden, the scale bar legend and the hover hit-rect
  // both have no underlying surface to describe. Suppress them to avoid the
  // misleading "tooltip reports density over blank pitch" failure mode.
  const scaleBarVisible =
    model.scaleBar != null &&
    surfaceVisible &&
    (resolveStyleValue(guides?.showScaleBar, guideContext) ?? true);
  const scaleBarLabel =
    resolveStyleValue(guides?.label, guideContext) ?? model.scaleBar?.label ?? "Density";

  const resolvedPitchColors = useMemo(
    () =>
      resolveAutoPitchLineColors(pitchColors, {
        autoPitchLines,
        stops: resolvedAreaStops,
      }),
    [pitchColors, resolvedAreaStops, autoPitchLines],
  );

  const [tooltipState, setTooltipState] = useState<{
    density: number;
    pitchX: number;
    pitchY: number;
  } | null>(null);

  const scaleBar =
    scaleBarVisible && model.scaleBar ? (
      <ChartScaleBar
        label={scaleBarLabel}
        startLabel={model.scaleBar.domain[0].toFixed(2)}
        endLabel={model.scaleBar.domain[1].toFixed(2)}
        stops={resolvedAreaStops}
        testId="kde-scale-bar"
        theme={theme}
      />
    ) : null;

  const warningNote = model.meta.warnings.find(
    (warning) =>
      warning.includes("not be meaningful") || warning.includes("nearly uniform"),
  );

  return (
    <PitchChartFrame
      ariaLabel={
        model.meta.empty
          ? "KDE density map: no events"
          : `KDE density map: ${model.meta.validEvents} events`
      }
      chartKind="kde"
      empty={model.emptyState != null}
      maxWidth={
        maxWidth ??
        (model.meta.attackingDirection === "right"
          ? 640
          : model.meta.crop === "half"
            ? 420
            : 360)
      }
      plot={
        <div
          style={{ position: "relative" }}
          onMouseLeave={() => {
            setTooltipState(null);
          }}
        >
          <Pitch
            crop={model.pitch.crop}
            attackingDirection={model.pitch.attackingDirection}
            {...(pitchTheme != null ? { theme: pitchTheme } : {})}
            {...(resolvedPitchColors != null ? { colors: resolvedPitchColors } : {})}
            underlay={({ project }) =>
              surfaceVisible ? (
                <DensitySurface
                  model={model}
                  project={project}
                  colorStops={resolvedAreaStops}
                  opacity={surfaceOpacity}
                />
              ) : null
            }
          >
            {({ project }) => (
              <>
                {/* Invisible overlay for mouse interaction. Only attach when
                    the density surface is actually rendered — otherwise the
                    tooltip reports density values over a blank pitch. */}
                {!model.meta.empty && surfaceVisible && showDensityTooltip && (
                  <rect
                    x={Math.min(project(100, 0).x, project(0, 100).x)}
                    y={Math.min(project(100, 0).y, project(0, 100).y)}
                    width={Math.abs(project(100, 0).x - project(0, 100).x)}
                    height={Math.abs(project(100, 0).y - project(0, 100).y)}
                    fill="transparent"
                    onMouseMove={(e) => {
                      const svgPt = readSvgPoint(e.currentTarget, e.clientX, e.clientY);
                      if (svgPt == null) return;

                      const pitchPoint = svgPointToPitchPoint(project, svgPt);
                      const sample = sampleKDEAtPitchPoint(model, pitchPoint);

                      setTooltipState({
                        density: sample.density,
                        pitchX: sample.pitchX,
                        pitchY: sample.pitchY,
                      });
                    }}
                  />
                )}
                {overlay?.({ project })}
              </>
            )}
          </Pitch>

          {model.emptyState ? (
            <EmptyState message={model.emptyState.message} theme={theme} />
          ) : null}

          {showDensityTooltip && tooltipState && tooltipState.density > 0 ? (
            <ChartTooltip
              testId="kde-tooltip"
              rows={[
                {
                  label: "Position",
                  value: `(${Math.round(tooltipState.pitchX)}, ${Math.round(tooltipState.pitchY)})`,
                },
                {
                  label: model.scaleBar?.label ?? "Density",
                  value: tooltipState.density.toFixed(3),
                },
              ]}
              theme={theme}
            />
          ) : null}
        </div>
      }
      postPlot={
        <>
          {warningNote ? (
            <div
              data-testid="kde-warning"
              style={{
                fontSize: 12,
                color: theme.text.secondary,
                lineHeight: 1.4,
              }}
            >
              {warningNote}
            </div>
          ) : null}
          {scaleBar}
        </>
      }
      theme={theme}
      warnings={model.meta.warnings}
      {...(framePadding != null ? { padding: framePadding } : {})}
    />
  );
}
