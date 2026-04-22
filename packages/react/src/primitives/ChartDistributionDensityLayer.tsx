import type { ReactNode } from "react";

import type {
  DistributionProjectedMarkerModel,
  DistributionProjectedSeriesModel,
} from "../compute/distribution-shared.js";
import { resolveStyleValue, type StyleValue } from "../styleValue.js";
import type { UITheme } from "../theme.js";
import { ChartPointMark, type PointShape } from "./ChartPointMark.js";

export type DistributionMarkerMode = "glyph" | "stem" | "glyph-and-stem";
/**
 * Where the marker glyph sits along the y-axis.
 *   - `"density"` (default): at the projected density value on the curve.
 *   - `"baseline"`: on the x-axis, so the shape sits below the curve.
 */
export type DistributionMarkerAnchor = "density" | "baseline";

export type DistributionAreaStyleContext<TRow = unknown> = {
  series: DistributionProjectedSeriesModel;
  row: TRow | null;
  theme: UITheme;
};

export type DistributionLineStyleContext<TRow = unknown> = {
  series: DistributionProjectedSeriesModel;
  row: TRow | null;
  theme: UITheme;
};

export type DistributionMarkerStyleContext<TRow = unknown> = {
  series: DistributionProjectedSeriesModel;
  marker: DistributionProjectedMarkerModel;
  row: TRow | null;
  theme: UITheme;
};

export type DistributionAreasStyle<TRow = unknown> = {
  show?: StyleValue<boolean, DistributionAreaStyleContext<TRow>> | undefined;
  fill?: StyleValue<string, DistributionAreaStyleContext<TRow>> | undefined;
  opacity?: StyleValue<number, DistributionAreaStyleContext<TRow>> | undefined;
};

export type DistributionLinesStyle<TRow = unknown> = {
  show?: StyleValue<boolean, DistributionLineStyleContext<TRow>> | undefined;
  stroke?: StyleValue<string, DistributionLineStyleContext<TRow>> | undefined;
  strokeWidth?: StyleValue<number, DistributionLineStyleContext<TRow>> | undefined;
  opacity?: StyleValue<number, DistributionLineStyleContext<TRow>> | undefined;
  strokeDasharray?: StyleValue<string, DistributionLineStyleContext<TRow>> | undefined;
};

export type DistributionMarkersStyle<TRow = unknown> = {
  show?: StyleValue<boolean, DistributionMarkerStyleContext<TRow>> | undefined;
  mode?:
    | StyleValue<DistributionMarkerMode, DistributionMarkerStyleContext<TRow>>
    | undefined;
  anchor?:
    | StyleValue<DistributionMarkerAnchor, DistributionMarkerStyleContext<TRow>>
    | undefined;
  shape?: StyleValue<PointShape, DistributionMarkerStyleContext<TRow>> | undefined;
  radius?: StyleValue<number, DistributionMarkerStyleContext<TRow>> | undefined;
  fill?: StyleValue<string, DistributionMarkerStyleContext<TRow>> | undefined;
  stroke?: StyleValue<string, DistributionMarkerStyleContext<TRow>> | undefined;
  strokeWidth?: StyleValue<number, DistributionMarkerStyleContext<TRow>> | undefined;
  opacity?: StyleValue<number, DistributionMarkerStyleContext<TRow>> | undefined;
  stemStroke?: StyleValue<string, DistributionMarkerStyleContext<TRow>> | undefined;
  stemStrokeWidth?: StyleValue<number, DistributionMarkerStyleContext<TRow>> | undefined;
  stemDasharray?: StyleValue<string, DistributionMarkerStyleContext<TRow>> | undefined;
  stemOpacity?: StyleValue<number, DistributionMarkerStyleContext<TRow>> | undefined;
};

/**
 * Translucent sub-area under the density curve from domain-left to the
 * marker value. Renders only for series with a `marker`, and only when
 * `show` resolves truthy. Typical use: colour-coded "up to this player's
 * value" shading in comparison distribution rows.
 */
export type DistributionMarkerShadeStyle<TRow = unknown> = {
  show?: StyleValue<boolean, DistributionMarkerStyleContext<TRow>> | undefined;
  fill?: StyleValue<string, DistributionMarkerStyleContext<TRow>> | undefined;
  opacity?: StyleValue<number, DistributionMarkerStyleContext<TRow>> | undefined;
};

const DEFAULT_FILL_OPACITY = 0.24;
const DEFAULT_LINE_OPACITY = 0.95;
const DEFAULT_MARKER_RADIUS = 4.5;
const DEFAULT_MARKER_MODE: DistributionMarkerMode = "glyph";

function resolveLineColor<TRow>(
  style: DistributionLinesStyle<TRow> | undefined,
  context: DistributionLineStyleContext<TRow>,
  fallbackColor: string,
) {
  return resolveStyleValue(style?.stroke, context) ?? fallbackColor;
}

function renderMarkerStem<TRow>({
  marker,
  style,
  context,
  baselineY,
  fallbackColor,
}: {
  marker: DistributionProjectedMarkerModel;
  style: DistributionMarkersStyle<TRow> | undefined;
  context: DistributionMarkerStyleContext<TRow>;
  baselineY: number;
  fallbackColor: string;
}) {
  return (
    <line
      x1={marker.x}
      y1={baselineY}
      x2={marker.x}
      y2={marker.y}
      stroke={resolveStyleValue(style?.stemStroke, context) ?? fallbackColor}
      strokeWidth={resolveStyleValue(style?.stemStrokeWidth, context) ?? 1.25}
      strokeDasharray={resolveStyleValue(style?.stemDasharray, context)}
      opacity={resolveStyleValue(style?.stemOpacity, context) ?? 0.72}
    />
  );
}

function renderMarkerGlyph<TRow>({
  marker,
  style,
  context,
  fallbackColor,
  cy,
}: {
  marker: DistributionProjectedMarkerModel;
  style: DistributionMarkersStyle<TRow> | undefined;
  context: DistributionMarkerStyleContext<TRow>;
  fallbackColor: string;
  cy: number;
}) {
  const stroke = resolveStyleValue(style?.stroke, context);
  const strokeWidth = resolveStyleValue(style?.strokeWidth, context);

  return (
    <ChartPointMark
      cx={marker.x}
      cy={cy}
      r={resolveStyleValue(style?.radius, context) ?? DEFAULT_MARKER_RADIUS}
      shape={resolveStyleValue(style?.shape, context) ?? "triangle"}
      fill={resolveStyleValue(style?.fill, context) ?? fallbackColor}
      {...(stroke != null ? { stroke } : {})}
      {...(strokeWidth != null ? { strokeWidth } : {})}
      opacity={resolveStyleValue(style?.opacity, context) ?? 1}
    />
  );
}

const DEFAULT_MARKER_SHADE_OPACITY = 0.35;

export function ChartDistributionDensityLayer<TRow>({
  series,
  row,
  baselineY,
  theme,
  getSeriesColor,
  areas,
  lines,
  markers,
  markerShade,
}: {
  series: readonly DistributionProjectedSeriesModel[];
  row: TRow | null;
  baselineY: number;
  theme: UITheme;
  getSeriesColor: (series: DistributionProjectedSeriesModel, index: number) => string;
  areas?: DistributionAreasStyle<TRow> | undefined;
  lines?: DistributionLinesStyle<TRow> | undefined;
  markers?: DistributionMarkersStyle<TRow> | undefined;
  markerShade?: DistributionMarkerShadeStyle<TRow> | undefined;
}): ReactNode {
  return (
    <>
      {series.map((entry, index) => {
        const fallbackColor = getSeriesColor(entry, index);
        const areaContext: DistributionAreaStyleContext<TRow> = {
          series: entry,
          row,
          theme,
        };
        const lineContext: DistributionLineStyleContext<TRow> = {
          series: entry,
          row,
          theme,
        };

        const markerContext: DistributionMarkerStyleContext<TRow> | null =
          entry.marker != null
            ? {
                series: entry,
                marker: entry.marker,
                row,
                theme,
              }
            : null;

        const markerMode =
          markerContext != null
            ? (resolveStyleValue(markers?.mode, markerContext) ?? DEFAULT_MARKER_MODE)
            : DEFAULT_MARKER_MODE;
        const markerAnchor =
          markerContext != null
            ? (resolveStyleValue(markers?.anchor, markerContext) ?? "density")
            : "density";
        const markerCy =
          entry.marker != null && markerAnchor === "baseline"
            ? baselineY
            : (entry.marker?.y ?? baselineY);

        const showMarkerShade =
          markerContext != null &&
          entry.markerAreaPath != null &&
          resolveStyleValue(markerShade?.show, markerContext) === true;

        return (
          <g key={entry.id}>
            {resolveStyleValue(areas?.show, areaContext) === false ? null : (
              <path
                d={entry.areaPath}
                fill={resolveStyleValue(areas?.fill, areaContext) ?? fallbackColor}
                opacity={
                  resolveStyleValue(areas?.opacity, areaContext) ?? DEFAULT_FILL_OPACITY
                }
              />
            )}

            {showMarkerShade && entry.markerAreaPath != null && markerContext != null ? (
              <path
                d={entry.markerAreaPath}
                fill={
                  resolveStyleValue(markerShade?.fill, markerContext) ?? fallbackColor
                }
                opacity={
                  resolveStyleValue(markerShade?.opacity, markerContext) ??
                  DEFAULT_MARKER_SHADE_OPACITY
                }
              />
            ) : null}

            {resolveStyleValue(lines?.show, lineContext) === false ? null : (
              <path
                d={entry.linePath}
                fill="none"
                stroke={resolveLineColor(lines, lineContext, fallbackColor)}
                strokeWidth={resolveStyleValue(lines?.strokeWidth, lineContext) ?? 2}
                strokeDasharray={resolveStyleValue(lines?.strokeDasharray, lineContext)}
                opacity={
                  resolveStyleValue(lines?.opacity, lineContext) ?? DEFAULT_LINE_OPACITY
                }
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {markerContext == null ||
            resolveStyleValue(markers?.show, markerContext) === false ? null : (
              <g>
                {markerMode === "stem" || markerMode === "glyph-and-stem"
                  ? renderMarkerStem({
                      marker: entry.marker as DistributionProjectedMarkerModel,
                      style: markers,
                      context: markerContext,
                      baselineY,
                      fallbackColor,
                    })
                  : null}
                {markerMode === "glyph" || markerMode === "glyph-and-stem"
                  ? renderMarkerGlyph({
                      marker: entry.marker as DistributionProjectedMarkerModel,
                      style: markers,
                      context: markerContext,
                      fallbackColor,
                      cy: markerCy,
                    })
                  : null}
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}
