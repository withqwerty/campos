import { useMemo, useState } from "react";

import {
  computePassSonar,
  DEFAULT_PASS_SONAR_BIN_COUNT,
  DEFAULT_PASS_SONAR_DISTANCE_CLIP,
  DEFAULT_PASS_SONAR_SERIES_COLORS,
  polarToScreen as polarToScreenShared,
  roundSvg as roundSvgShared,
  wedgePath as wedgePathShared,
  type ComputePassSonarInput,
  type PassSonarBinCount,
  type PassSonarBinLabel,
  type PassSonarLengthBy,
  type PassSonarModel,
  type PassSonarWedgeModel,
} from "./compute/index.js";
import { interpolateStops } from "./compute/color.js";
import { resolveColorStops } from "./compute/color-scales.js";
import type { ColorStop } from "./compute/color.js";
import {
  ChartFrame,
  ChartGradientLegend,
  ChartLegend,
  type ChartMethodologyNotes,
  ChartSvgEmptyState,
  ChartTooltip,
  EmptyState,
} from "./primitives/index.js";
import { useTheme } from "./ThemeContext.js";
import { LIGHT_THEME, type UITheme } from "./theme.js";
import { resolveThemePalette, type ThemePalette } from "./themePalette.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PassSonarColorBy =
  | "completion"
  | "distance"
  | "frequency"
  | "metric"
  | "none";

/** Named sequential ramp for `colorBy: "distance"`. */
export type PassSonarDistanceScale =
  | "viridis"
  | "magma"
  | "inferno"
  | "blues"
  | "greens"
  | "reds";

/** Named sequential ramp for `colorBy: "frequency"`. Same set as distance. */
export type PassSonarFrequencyScale = PassSonarDistanceScale;

/**
 * Named diverging or sequential ramp for `colorBy: "metric"`. Pick a
 * diverging ramp when the metric is signed (overperformance, deltas) and
 * a sequential ramp when it isn't (latency, pace).
 */
export type PassSonarMetricScale =
  | "diverging-rdylgn"
  | "diverging-rdbu"
  | "sequential-blues"
  | "sequential-reds"
  | "magma"
  | "viridis"
  | "inferno";

/**
 * Where to centre the colour ramp for `colorBy: "metric"`.
 *
 * `"auto"` — sequential if all observed bin metric values have the same
 * sign, diverging with zero at the midpoint otherwise.
 * `"zero"` — force a diverging ramp centred on 0 (per-wedge value of 0
 * maps to the ramp's midpoint, positive saturates toward the top, negative
 * toward the bottom). Use for signed metrics like xP overperformance.
 * `"min-max"` — normalise linearly between the observed min and max across
 * non-empty bins; no special centre. Use for unsigned metrics.
 */
export type PassSonarMetricCenter = "auto" | "zero" | "min-max";

export type PassSonarWedgeStyleContext = {
  wedge: PassSonarWedgeModel;
  /** Convenience copy of `wedge.binIndex`. */
  binIndex: number;
  /** Convenience copy of `wedge.label`. */
  label: PassSonarBinLabel;
  theme: UITheme;
};

export type PassSonarTextStyleContext = {
  /**
   * Which text slot the style applies to. `"direction-label"` is a
   * wedge-aligned bearing label, `"axis-label"` is a cartesian axis label
   * (Toward Goal / Away / 90° Left / 90° Right), `"summary"` is the centre
   * summary block.
   */
  slot: "direction-label" | "axis-label" | "summary";
  theme: UITheme;
};

/**
 * Direction-label rendering mode.
 *
 * `"compass"` (default) — labels follow each wedge's bearing. When
 * `binCount > 8`, only the eight canonical directions are labelled so
 * labels don't collide.
 * `"cartesian"` — four static axis labels at the sonar's top / bottom /
 * left / right edges. Match the Scout Lab idiom ("Toward Goal" / "Away" /
 * "90° Left" / "90° Right").
 * `false` — no labels.
 */
export type PassSonarDirectionLabelsMode = "compass" | "cartesian" | false;

/**
 * Text copy for {@link PassSonarDirectionLabelsMode} `"cartesian"`. Every
 * key is optional; omitting one hides that label.
 */
export type PassSonarDirectionLabelsText = {
  forward?: string;
  back?: string;
  left?: string;
  right?: string;
};

/**
 * Optional polar backdrop drawn behind the wedges: faint concentric
 * rings + radial spokes. Enable when the chart is on a very dark canvas
 * (Scout Lab style) and a hint of structure helps read the wedges. All
 * defaults favour "barely-visible guide, not a dominant grid".
 */
export type PassSonarPolarGridConfig = {
  /** Stroke colour. Default `"currentColor"`. */
  stroke?: string;
  /** Default `0.12`. */
  strokeOpacity?: number;
  /** Default `0.5` (in sonar viewBox units). */
  strokeWidth?: number;
  /**
   * Number of concentric rings (including outer). Default `3`. Rings are
   * evenly spaced between `SUMMARY_INNER_R` (or a small minimum when
   * `showGuide` is off) and the outer radius.
   */
  rings?: number;
  /**
   * Draw radial spokes at every bin boundary. Default `true`. When
   * `binCount > 12` this falls back to spokes at the eight canonical
   * directions only so the grid doesn't dominate.
   */
  spokes?: boolean;
};

export type PassSonarWedgesStyle = {
  attemptedFill?: StyleValue<string, PassSonarWedgeStyleContext>;
  attemptedFillOpacity?: StyleValue<number, PassSonarWedgeStyleContext>;
  completedFill?: StyleValue<string, PassSonarWedgeStyleContext>;
  completedFillOpacity?: StyleValue<number, PassSonarWedgeStyleContext>;
  stroke?: StyleValue<string, PassSonarWedgeStyleContext>;
  strokeWidth?: StyleValue<number, PassSonarWedgeStyleContext>;
};

export type PassSonarTextStyle = {
  fill?: StyleValue<string, PassSonarTextStyleContext>;
  fontSize?: StyleValue<number, PassSonarTextStyleContext>;
};

export type PassSonarStaticLegendSpec =
  | {
      kind: "items";
      items: Array<{ key: string; label: string; color: string }>;
    }
  | {
      kind: "scale";
      label: string;
      startLabel: string;
      endLabel: string;
      colors: string[];
      tickAt?: number;
      tickLabel?: string;
    };

/**
 * Props for the `<PassSonar>` React component.
 *
 * **Frame of reference.** Pass directions are always rendered in the
 * **attack-adjusted frame** — 0 rad on the sonar means "toward the opposition
 * goal", derived from canonical-frame start/end points.
 */
export type PassSonarProps = Omit<ComputePassSonarInput, "subjectKind"> & {
  /** Defaults to "player". */
  subjectKind?: "player" | "team";
  /**
   * Colour encoding.
   * - `"completion"` (default) — two annular wedges per bin: attempted outer
   *   (light) and completed inner (strong). Classic build-up / pressure read.
   * - `"distance"` — single annular wedge per bin, filled from a sequential
   *   ramp keyed off mean pass distance. Matches Eliot McKinley's canonical
   *   PassSonar reference.
   * - `"frequency"` — single annular wedge per bin, filled from a
   *   sequential ramp keyed off attempted pass count. Useful when the
   *   length encoding already carries another dimension (e.g. wedge
   *   length = mean pass length), matching the mplsoccer McLachBot idiom.
   * - `"metric"` — single annular wedge per bin, filled from a sequential
   *   or diverging ramp keyed off {@link ComputePassSonarInput.metricForPass}.
   *   Supply any per-pass numeric function (xP overperformance, xT delta,
   *   pace) and the compute layer aggregates to a per-bin mean.
   * - `"none"` — single wedge per bin in the attempted series colour. Use
   *   when layering custom encodings via the `wedges` render-prop.
   */
  colorBy?: PassSonarColorBy;
  /** Sequential ramp used when `colorBy: "distance"`. Default `"viridis"` (matches the McKinley reference). */
  distanceScale?: PassSonarDistanceScale;
  /** Custom colour stops; overrides `distanceScale`. */
  distanceColorStops?: ReadonlyArray<ColorStop>;
  /**
   * Clip value for the distance ramp, in Campos units. Passes with
   * `averageLength` at or above this value saturate at the top of the ramp.
   * Default `30` (matches the McKinley reference, which is 30 yards).
   */
  distanceClipMax?: number;
  /** Sequential ramp used when `colorBy: "frequency"`. Default `"reds"`. */
  frequencyScale?: PassSonarFrequencyScale;
  /** Custom colour stops; overrides `frequencyScale`. */
  frequencyColorStops?: ReadonlyArray<ColorStop>;
  /**
   * Explicit cap for the frequency ramp. Bins with `attempted` ≥ this
   * saturate at the top. When omitted, the observed max attempted across
   * bins is used so the busiest bin saturates.
   */
  frequencyClipMax?: number;
  /** Named ramp used when `colorBy: "metric"`. Default `"diverging-rdylgn"`. */
  metricScale?: PassSonarMetricScale;
  /** Custom colour stops; overrides `metricScale`. */
  metricColorStops?: ReadonlyArray<ColorStop>;
  /**
   * Where to centre the metric ramp. Default `"auto"` (sequential when the
   * observed metric values have a consistent sign, diverging zero-centred
   * otherwise).
   */
  metricCenter?: PassSonarMetricCenter;
  /**
   * Maximum absolute metric value used for diverging ramps centred on
   * zero. A bin with `metricValue = ±metricClipAbs` saturates at the
   * ramp's top / bottom. When omitted, the max `|metricValue|` observed
   * across bins is used.
   */
  metricClipAbs?: number;
  /**
   * Explicit domain for sequential `colorBy: "metric"` ramps. When
   * omitted, the observed min/max across bins is used.
   */
  metricDomain?: readonly [number, number];
  /** Default true. */
  showLegend?: boolean;
  /** Default true. Centre summary block (attempted / completed / completion %). */
  showSummary?: boolean;
  /**
   * Whether to draw the outer guide ring + inner hub disc. Default `true`.
   * Set to `false` for a minimal wedges-only look (matches Scout Lab /
   * mplsoccer passing-sonar idioms where the wedges float on the chart
   * surface without a frame).
   */
  showGuide?: boolean;
  /**
   * Subtle polar grid drawn *behind* the wedges — concentric rings and
   * radial spokes at the canonical bin centres. Useful when `showGuide`
   * is off but a hint of polar structure still helps read direction
   * (Scout Lab uses this at very low opacity). Default `false`.
   *
   * Accepts `true` (use sensible defaults) or a config object to tune
   * opacity, stroke, ring count, and whether to draw spokes.
   */
  polarGrid?: boolean | PassSonarPolarGridConfig;
  /**
   * Direction-label rendering mode. See {@link PassSonarDirectionLabelsMode}.
   * Default `"compass"`.
   */
  directionLabels?: PassSonarDirectionLabelsMode;
  /** Text override for `directionLabels: "cartesian"`. */
  directionLabelsText?: PassSonarDirectionLabelsText;
  wedges?: PassSonarWedgesStyle;
  text?: PassSonarTextStyle;
  /** Override the default attempted/completed palette. */
  seriesColors?: ThemePalette;
  methodologyNotes?: ChartMethodologyNotes;
};

// ---------------------------------------------------------------------------
// Geometry constants
// ---------------------------------------------------------------------------

const VIEWBOX_SIZE = 320;
const CENTER = VIEWBOX_SIZE / 2;
/** Outer margin reserved for ring labels. */
const LABEL_GUTTER = 28;
/**
 * Inner radius reserved for the central summary block. Wedges are annular —
 * they start at this radius, never at 0 — so the summary text remains
 * legible regardless of how dense the wheel gets.
 */
const SUMMARY_INNER_R = 36;
/**
 * Inner radius when the guide ring and summary are both hidden. Wedges
 * still float off centre by a few pixels so the pointy tips don't
 * overlap each other at the origin.
 */
const MINIMAL_INNER_R = 4;
const OUTER_R = CENTER - LABEL_GUTTER;

const DEFAULT_DISTANCE_SCALE: PassSonarDistanceScale = "viridis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Local wrappers hard-code (cx, cy) to the fixed sonar CENTER so call
// sites can use `polarToScreen(angle, r)` / `wedgePath(inner, outer,
// start, end)`. Geometry itself is in `compute/wedge-geometry`.

const roundSvg = roundSvgShared;

function polarToScreen(canonicalAngle: number, radius: number) {
  return polarToScreenShared(CENTER, CENTER, canonicalAngle, radius);
}

function wedgePath(
  innerR: number,
  outerR: number,
  startCanonical: number,
  endCanonical: number,
): string {
  return wedgePathShared(CENTER, CENTER, innerR, outerR, startCanonical, endCanonical);
}

function buildPassSonarTooltipRows(wedge: PassSonarWedgeModel) {
  const pct = Math.round(wedge.completionRate * 100);
  const rows: { label: string; value: string }[] = [
    { label: "Direction", value: wedge.label },
    { label: "Attempted", value: String(wedge.attempted) },
    { label: "Completed", value: String(wedge.completed) },
    { label: "Completion", value: `${pct}%` },
  ];
  if (wedge.attempted > 0 && wedge.averageLength != null) {
    rows.push({
      label: "Average distance",
      value: `${wedge.averageLength.toFixed(1)} m`,
    });
  }
  return rows;
}

function wedgeAriaLabel(wedge: PassSonarWedgeModel): string {
  const pct = Math.round(wedge.completionRate * 100);
  return `${wedge.label}: ${wedge.attempted} attempted, ${wedge.completed} completed, ${pct}% completion`;
}

function emptyStateMessage(subjectLabel: string | null): string {
  return `No passes for ${subjectLabel ?? "this subject"}`;
}

function resolveDistanceStops(
  distanceScale: PassSonarDistanceScale | undefined,
  distanceColorStops: ReadonlyArray<ColorStop> | undefined,
): ColorStop[] {
  if (distanceColorStops != null && distanceColorStops.length > 0) {
    return [...distanceColorStops];
  }
  return resolveColorStops(distanceScale ?? DEFAULT_DISTANCE_SCALE, undefined);
}

function distanceColor(
  wedge: PassSonarWedgeModel,
  stops: ReadonlyArray<ColorStop>,
  clipMax: number,
  fallback: string,
): string {
  if (wedge.averageLength == null) return fallback;
  const t = Math.min(wedge.averageLength, clipMax) / clipMax;
  return interpolateStops(stops, t);
}

const DEFAULT_FREQUENCY_SCALE: PassSonarFrequencyScale = "reds";
const DEFAULT_METRIC_SCALE: PassSonarMetricScale = "diverging-rdylgn";

function resolveFrequencyStops(
  scale: PassSonarFrequencyScale | undefined,
  colorStops: ReadonlyArray<ColorStop> | undefined,
): ColorStop[] {
  if (colorStops != null && colorStops.length > 0) return [...colorStops];
  return resolveColorStops(scale ?? DEFAULT_FREQUENCY_SCALE, undefined);
}

function resolveMetricStops(
  scale: PassSonarMetricScale | undefined,
  colorStops: ReadonlyArray<ColorStop> | undefined,
): ColorStop[] {
  if (colorStops != null && colorStops.length > 0) return [...colorStops];
  return resolveColorStops(scale ?? DEFAULT_METRIC_SCALE, undefined);
}

function frequencyColor(
  wedge: PassSonarWedgeModel,
  stops: ReadonlyArray<ColorStop>,
  clipMax: number,
  fallback: string,
): string {
  if (wedge.attempted === 0 || clipMax <= 0) return fallback;
  const t = Math.min(wedge.attempted, clipMax) / clipMax;
  return interpolateStops(stops, t);
}

/**
 * Pick a sensible metric centering mode when the caller asks for
 * `"auto"`. Signed data (mix of positive and negative bin values) gets a
 * zero-centred diverging ramp; same-sign data falls back to a min-max
 * sequential ramp. Supplying `metricClipAbs` is treated as an explicit
 * signed-intent signal: even if every observed bin is one-sided, `"auto"`
 * resolves to `"zero"` so the ramp still reads as diverging around 0 with
 * `±clipAbs` saturation.
 */
function resolveMetricCenter(
  requested: PassSonarMetricCenter,
  range: { min: number; max: number } | null,
  clipAbs: number | undefined,
): "zero" | "min-max" {
  if (requested === "zero") return "zero";
  if (requested === "min-max") return "min-max";
  if (clipAbs != null && Number.isFinite(clipAbs) && clipAbs > 0) return "zero";
  if (range == null) return "min-max";
  if (range.min < 0 && range.max > 0) return "zero";
  return "min-max";
}

function metricColor(
  wedge: PassSonarWedgeModel,
  stops: ReadonlyArray<ColorStop>,
  center: "zero" | "min-max",
  domain: readonly [number, number],
  fallback: string,
): string {
  if (wedge.metricValue == null) return fallback;
  let t: number;
  if (center === "zero") {
    const abs = Math.max(Math.abs(domain[0]), Math.abs(domain[1]), 1e-9);
    t = 0.5 + Math.max(-1, Math.min(1, wedge.metricValue / abs)) / 2;
  } else {
    const [lo, hi] = domain;
    if (hi - lo < 1e-9) return interpolateStops(stops, 0.5);
    t = Math.max(0, Math.min(1, (wedge.metricValue - lo) / (hi - lo)));
  }
  return interpolateStops(stops, t);
}

function resolveRampFill({
  wedge,
  colorBy,
  distanceStops,
  distanceClipMax,
  frequencyStops,
  frequencyClipMax,
  metricStops,
  metricCenter,
  metricDomain,
  fallback,
}: {
  wedge: PassSonarWedgeModel;
  colorBy: PassSonarColorBy;
  distanceStops: ReadonlyArray<ColorStop>;
  distanceClipMax: number;
  frequencyStops: ReadonlyArray<ColorStop>;
  frequencyClipMax: number;
  metricStops: ReadonlyArray<ColorStop>;
  metricCenter: "zero" | "min-max";
  metricDomain: readonly [number, number];
  fallback: string;
}): string {
  if (colorBy === "distance") {
    return distanceColor(wedge, distanceStops, distanceClipMax, fallback);
  }
  if (colorBy === "frequency") {
    return frequencyColor(wedge, frequencyStops, frequencyClipMax, fallback);
  }
  if (colorBy === "metric") {
    return metricColor(wedge, metricStops, metricCenter, metricDomain, fallback);
  }
  return fallback;
}

function resolveMetricDomain(
  wedges: ReadonlyArray<PassSonarWedgeModel>,
  override: readonly [number, number] | undefined,
  clipAbs: number | undefined,
  center: "zero" | "min-max",
): readonly [number, number] {
  if (center === "zero") {
    if (clipAbs != null && Number.isFinite(clipAbs) && clipAbs > 0) {
      return [-clipAbs, clipAbs];
    }
    let maxAbs = 0;
    for (const w of wedges) {
      if (w.metricValue == null) continue;
      const v = Math.abs(w.metricValue);
      if (v > maxAbs) maxAbs = v;
    }
    if (maxAbs <= 0) return [-1, 1];
    return [-maxAbs, maxAbs];
  }
  if (override != null) return override;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const w of wedges) {
    if (w.metricValue == null) continue;
    if (w.metricValue < min) min = w.metricValue;
    if (w.metricValue > max) max = w.metricValue;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  return [min, max];
}

// ---------------------------------------------------------------------------
// Shared encoding + draw spec
// ---------------------------------------------------------------------------

/**
 * Everything needed to paint a wedge that depends on props + model, but
 * not on per-render React state. Shared between the interactive
 * `<PassSonar>` and the static `<PassSonarStaticSvg>`. See
 * {@link resolveEncodingSpec}.
 */
type EncodingSpec = {
  attemptedColor: string;
  completedColor: string;
  distanceStops: ColorStop[];
  distanceClipMax: number;
  frequencyStops: ColorStop[];
  resolvedFrequencyClip: number;
  metricStops: ColorStop[];
  resolvedMetricCenter: "zero" | "min-max";
  resolvedMetricDomain: readonly [number, number];
};

function resolveEncodingSpec(
  props: PassSonarProps,
  model: PassSonarModel,
  theme: UITheme,
): EncodingSpec {
  const palette =
    resolveThemePalette(props.seriesColors, theme) ?? DEFAULT_PASS_SONAR_SERIES_COLORS;
  const attemptedColor = palette[0] ?? DEFAULT_PASS_SONAR_SERIES_COLORS[0];
  const completedColor = palette[1] ?? DEFAULT_PASS_SONAR_SERIES_COLORS[1];
  const distanceStops = resolveDistanceStops(
    props.distanceScale,
    props.distanceColorStops,
  );
  const frequencyStops = resolveFrequencyStops(
    props.frequencyScale,
    props.frequencyColorStops,
  );
  const metricStops = resolveMetricStops(props.metricScale, props.metricColorStops);
  const resolvedMetricCenter = resolveMetricCenter(
    props.metricCenter ?? "auto",
    model.meta.metricRange,
    props.metricClipAbs,
  );
  const resolvedMetricDomain = resolveMetricDomain(
    model.wedges,
    props.metricDomain,
    props.metricClipAbs,
    resolvedMetricCenter,
  );
  const resolvedFrequencyClip =
    props.frequencyClipMax != null &&
    Number.isFinite(props.frequencyClipMax) &&
    props.frequencyClipMax > 0
      ? props.frequencyClipMax
      : Math.max(1, model.meta.resolvedScaleMax);
  return {
    attemptedColor,
    completedColor,
    distanceStops,
    distanceClipMax: props.distanceClipMax ?? DEFAULT_PASS_SONAR_DISTANCE_CLIP,
    frequencyStops,
    resolvedFrequencyClip,
    metricStops,
    resolvedMetricCenter,
    resolvedMetricDomain,
  };
}

type WedgeDraw = {
  attemptedD: string;
  completedD: string;
  primaryFill: string;
  attemptedFill: string;
  completedFill: string;
  attemptedOpacity: number;
  completedOpacity: number;
  stroke: string;
  strokeWidth: number;
};

/**
 * Resolve the per-wedge draw values (paths, fills, opacities, stroke)
 * from the encoding spec, theme, and user-supplied `wedges` style hooks.
 * Shared between the interactive and static renderers.
 */
function resolveWedgeDraw(
  wedge: PassSonarWedgeModel,
  spec: EncodingSpec,
  {
    colorBy,
    lengthBy,
    innerR,
    outerR,
    wedgesStyle,
    theme,
  }: {
    colorBy: PassSonarColorBy;
    lengthBy: PassSonarLengthBy;
    innerR: number;
    outerR: number;
    wedgesStyle: PassSonarWedgesStyle | undefined;
    theme: UITheme;
  },
): WedgeDraw {
  const ctx: PassSonarWedgeStyleContext = {
    wedge,
    binIndex: wedge.binIndex,
    label: wedge.label,
    theme,
  };
  const attemptedFill =
    resolveStyleValue(wedgesStyle?.attemptedFill, ctx) ?? spec.attemptedColor;
  const completedFill =
    resolveStyleValue(wedgesStyle?.completedFill, ctx) ?? spec.completedColor;
  const attemptedOpacity =
    resolveStyleValue(wedgesStyle?.attemptedFillOpacity, ctx) ??
    (colorBy === "completion" ? 0.35 : 0.85);
  const completedOpacity =
    resolveStyleValue(wedgesStyle?.completedFillOpacity, ctx) ?? 0.85;
  const stroke = resolveStyleValue(wedgesStyle?.stroke, ctx) ?? theme.surface.plot;
  const strokeWidth = resolveStyleValue(wedgesStyle?.strokeWidth, ctx) ?? 0.5;
  const track = Math.max(0, outerR - innerR);
  const attemptedR = innerR + resolveWedgeRadius(wedge, lengthBy) * track;
  const completedR = innerR + wedge.completedRadius * track;
  const attemptedD =
    wedge.attempted > 0 && attemptedR > innerR
      ? wedgePath(innerR, attemptedR, wedge.angleStart, wedge.angleEnd)
      : "";
  const completedD =
    wedge.completed > 0 && completedR > innerR
      ? wedgePath(innerR, completedR, wedge.angleStart, wedge.angleEnd)
      : "";
  const primaryFill =
    colorBy === "distance" || colorBy === "frequency" || colorBy === "metric"
      ? resolveRampFill({
          wedge,
          colorBy,
          distanceStops: spec.distanceStops,
          distanceClipMax: spec.distanceClipMax,
          frequencyStops: spec.frequencyStops,
          frequencyClipMax: spec.resolvedFrequencyClip,
          metricStops: spec.metricStops,
          metricCenter: spec.resolvedMetricCenter,
          metricDomain: spec.resolvedMetricDomain,
          fallback: theme.axis.grid,
        })
      : attemptedFill;
  return {
    attemptedD,
    completedD,
    primaryFill,
    attemptedFill,
    completedFill,
    attemptedOpacity,
    completedOpacity,
    stroke,
    strokeWidth,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PolarGrid({
  config,
  innerR,
  binCount,
  theme,
}: {
  config: PassSonarPolarGridConfig;
  innerR: number;
  binCount: PassSonarBinCount;
  theme: UITheme;
}) {
  const stroke = config.stroke ?? theme.axis.grid;
  const opacity = config.strokeOpacity ?? 0.12;
  const strokeWidth = config.strokeWidth ?? 0.5;
  const rings = Math.max(1, config.rings ?? 3);
  const drawSpokes = config.spokes ?? true;
  const ringRadii = Array.from({ length: rings }, (_, i) => {
    const t = (i + 1) / rings;
    return innerR + (OUTER_R - innerR) * t;
  });
  // When binCount > 12, spoke-at-every-bin floods the chart. Fall back to
  // the eight canonical directions.
  const spokeAngles: number[] = (() => {
    if (!drawSpokes) return [];
    if (binCount <= 12) {
      const step = (2 * Math.PI) / binCount;
      return Array.from({ length: binCount }, (_, i) => i * step);
    }
    return [
      0,
      Math.PI / 4,
      Math.PI / 2,
      (3 * Math.PI) / 4,
      Math.PI,
      -(3 * Math.PI) / 4,
      -Math.PI / 2,
      -Math.PI / 4,
    ];
  })();
  return (
    <g
      data-testid="pass-sonar-polar-grid"
      pointerEvents="none"
      aria-hidden="true"
      fill="none"
      stroke={stroke}
      strokeOpacity={opacity}
      strokeWidth={strokeWidth}
    >
      {ringRadii.map((r, i) => (
        <circle key={`ring-${i}`} cx={CENTER} cy={CENTER} r={r} />
      ))}
      {spokeAngles.map((angle, i) => {
        const outer = polarToScreen(angle, OUTER_R);
        const inner = polarToScreen(angle, innerR);
        return (
          <line
            key={`spoke-${i}`}
            x1={roundSvg(inner.x)}
            y1={roundSvg(inner.y)}
            x2={roundSvg(outer.x)}
            y2={roundSvg(outer.y)}
          />
        );
      })}
    </g>
  );
}

function GuideRing({ theme }: { theme: UITheme }) {
  return (
    <g pointerEvents="none">
      {/* Outer guide ring */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={OUTER_R}
        fill="none"
        stroke={theme.axis.grid}
        strokeWidth={0.5}
      />
      {/* Inner hub — fill matches the chart canvas so the centre reads as a
          deliberate negative-space disc rather than a hole. The thin stroke
          completes the annular ring so the wedges look intentionally framed. */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={SUMMARY_INNER_R}
        fill={theme.surface.plot}
        stroke={theme.axis.grid}
        strokeWidth={0.5}
      />
    </g>
  );
}

function DirectionLabelsCompass({
  wedges,
  binCount,
  theme,
  textStyle,
}: {
  wedges: ReadonlyArray<PassSonarWedgeModel>;
  binCount: PassSonarBinCount;
  theme: UITheme;
  textStyle: PassSonarTextStyle | undefined;
}) {
  const labelRadius = OUTER_R + 14;
  const ctx: PassSonarTextStyleContext = { slot: "direction-label", theme };
  const fill = resolveStyleValue(textStyle?.fill, ctx) ?? theme.text.muted;
  const fontSize = resolveStyleValue(textStyle?.fontSize, ctx) ?? 11;
  // When binCount > 8 there are too many wedges to label without overlap.
  // Restrict to the eight canonical directions so the compass reads cleanly.
  const visibleWedges = binCount > 8 ? wedges.filter((w) => w.isCanonical) : wedges;
  return (
    <g data-testid="pass-sonar-direction-labels" pointerEvents="none" aria-hidden="true">
      {visibleWedges.map((wedge) => {
        const { x, y } = polarToScreen(wedge.centerAngle, labelRadius);
        return (
          <text
            key={wedge.binIndex}
            x={roundSvg(x)}
            y={roundSvg(y)}
            textAnchor="middle"
            dominantBaseline="central"
            fill={fill}
            fontSize={fontSize}
          >
            {wedge.label}
          </text>
        );
      })}
    </g>
  );
}

function DirectionLabelsCartesian({
  text: labelsText,
  theme,
  textStyle,
}: {
  text: PassSonarDirectionLabelsText;
  theme: UITheme;
  textStyle: PassSonarTextStyle | undefined;
}) {
  const ctx: PassSonarTextStyleContext = { slot: "axis-label", theme };
  const fill = resolveStyleValue(textStyle?.fill, ctx) ?? theme.text.muted;
  const fontSize = resolveStyleValue(textStyle?.fontSize, ctx) ?? 11;
  const outerGap = 14;
  return (
    <g
      data-testid="pass-sonar-axis-labels"
      pointerEvents="none"
      aria-hidden="true"
      fill={fill}
      fontSize={fontSize}
    >
      {labelsText.forward ? (
        <text
          x={CENTER}
          y={CENTER - OUTER_R - outerGap}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {labelsText.forward}
        </text>
      ) : null}
      {labelsText.back ? (
        <text
          x={CENTER}
          y={CENTER + OUTER_R + outerGap}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {labelsText.back}
        </text>
      ) : null}
      {labelsText.left ? (
        <text
          x={CENTER - OUTER_R - outerGap / 2}
          y={CENTER}
          textAnchor="end"
          dominantBaseline="central"
        >
          {labelsText.left}
        </text>
      ) : null}
      {labelsText.right ? (
        <text
          x={CENTER + OUTER_R + outerGap / 2}
          y={CENTER}
          textAnchor="start"
          dominantBaseline="central"
        >
          {labelsText.right}
        </text>
      ) : null}
    </g>
  );
}

function SummaryBlock({
  subjectLabel,
  attempted,
  completed,
  completionRate,
  theme,
  textStyle,
}: {
  subjectLabel: string | null;
  attempted: number;
  completed: number;
  completionRate: number;
  theme: UITheme;
  textStyle: PassSonarTextStyle | undefined;
}) {
  const ctx: PassSonarTextStyleContext = { slot: "summary", theme };
  const fill = resolveStyleValue(textStyle?.fill, ctx) ?? theme.text.primary;
  const fontSize = resolveStyleValue(textStyle?.fontSize, ctx) ?? 12;
  const pct = Math.round(completionRate * 100);
  return (
    <g data-testid="pass-sonar-summary" pointerEvents="none" textAnchor="middle">
      {subjectLabel ? (
        <text x={CENTER} y={CENTER - 8} fill={fill} fontSize={fontSize} fontWeight={600}>
          {subjectLabel}
        </text>
      ) : null}
      <text
        x={CENTER}
        y={CENTER + (subjectLabel ? 10 : 4)}
        fill={theme.text.muted}
        fontSize={11}
      >
        {`${completed} / ${attempted}  (${pct}%)`}
      </text>
    </g>
  );
}

type WedgeRenderProps = {
  wedge: PassSonarWedgeModel;
  colorBy: PassSonarColorBy;
  draw: WedgeDraw;
  focusable: boolean;
  onActivate: (binIndex: number) => void;
  onArrow: (delta: number) => void;
};

/**
 * Resolve the "attempted" radius for a wedge given the active
 * {@link PassSonarLengthBy} mode. `"count"` uses the compute-layer
 * `attemptedRadius`, `"mean-length"` uses `lengthRadius`. The completed
 * wedge always tracks `completedRadius` so the completion encoding still
 * reads meaningfully when `colorBy: "completion"` is combined with a
 * length-based wedge size.
 */
function resolveWedgeRadius(
  wedge: PassSonarWedgeModel,
  lengthBy: PassSonarLengthBy,
): number {
  return lengthBy === "mean-length" ? wedge.lengthRadius : wedge.attemptedRadius;
}

function Wedge({
  wedge,
  colorBy,
  draw,
  focusable,
  onActivate,
  onArrow,
}: WedgeRenderProps) {
  const {
    attemptedD,
    completedD,
    primaryFill,
    completedFill,
    attemptedOpacity,
    completedOpacity,
    stroke,
    strokeWidth,
  } = draw;
  return (
    <g
      data-testid={`pass-sonar-wedge-${wedge.binIndex}`}
      data-bin-index={wedge.binIndex}
      data-bin-label={wedge.label}
      role="img"
      tabIndex={focusable ? 0 : -1}
      aria-label={wedgeAriaLabel(wedge)}
      onMouseEnter={() => {
        onActivate(wedge.binIndex);
      }}
      onMouseLeave={() => {
        onActivate(-1);
      }}
      onFocus={() => {
        onActivate(wedge.binIndex);
      }}
      onBlur={() => {
        onActivate(-1);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          onArrow(1);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          onArrow(-1);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate(wedge.binIndex);
        }
      }}
    >
      {attemptedD ? (
        <path
          d={attemptedD}
          fill={primaryFill}
          fillOpacity={attemptedOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ) : null}
      {colorBy === "completion" && completedD ? (
        <path
          d={completedD}
          fill={completedFill}
          fillOpacity={completedOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DEFAULT_CARTESIAN_LABELS: PassSonarDirectionLabelsText = {
  forward: "Toward goal",
  back: "Away",
  left: "90° Left",
  right: "90° Right",
};

export function PassSonar(props: PassSonarProps) {
  const theme = useTheme();
  const {
    passes,
    subjectLabel,
    subjectId,
    subjectKind,
    scaleMaxAttempts,
    scaleMaxLength,
    binCount = DEFAULT_PASS_SONAR_BIN_COUNT,
    lengthBy = "count",
    metricForPass,
    colorBy = "completion",
    distanceScale,
    distanceColorStops,
    distanceClipMax = DEFAULT_PASS_SONAR_DISTANCE_CLIP,
    frequencyScale,
    frequencyColorStops,
    frequencyClipMax,
    metricScale,
    metricColorStops,
    metricCenter = "auto",
    metricClipAbs,
    metricDomain,
    showLegend = true,
    showSummary = true,
    showGuide = true,
    polarGrid = false,
    directionLabels = "compass",
    directionLabelsText,
    wedges: wedgesStyle,
    text: textStyle,
    seriesColors,
    methodologyNotes,
  } = props;
  const polarGridConfig: PassSonarPolarGridConfig | null =
    polarGrid === false ? null : polarGrid === true ? {} : polarGrid;

  const model = useMemo(
    () =>
      computePassSonar({
        passes,
        ...(subjectLabel != null ? { subjectLabel } : {}),
        ...(subjectId != null ? { subjectId } : {}),
        ...(subjectKind != null ? { subjectKind } : {}),
        ...(scaleMaxAttempts != null ? { scaleMaxAttempts } : {}),
        ...(scaleMaxLength != null ? { scaleMaxLength } : {}),
        ...(metricForPass != null ? { metricForPass } : {}),
        binCount,
        lengthBy,
      }),
    [
      passes,
      subjectLabel,
      subjectId,
      subjectKind,
      scaleMaxAttempts,
      scaleMaxLength,
      metricForPass,
      binCount,
      lengthBy,
    ],
  );

  // Atomic deps drive this memo — callers routinely pass inline prop
  // objects, so relying on `props` identity would recompute every render.
  const spec = useMemo(
    () => resolveEncodingSpec(props, model, theme),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      model,
      theme,
      seriesColors,
      distanceScale,
      distanceColorStops,
      distanceClipMax,
      frequencyScale,
      frequencyColorStops,
      frequencyClipMax,
      metricScale,
      metricColorStops,
      metricCenter,
      metricClipAbs,
      metricDomain,
    ],
  );
  const {
    attemptedColor,
    completedColor,
    distanceStops,
    frequencyStops,
    metricStops,
    resolvedMetricCenter,
    resolvedMetricDomain,
    resolvedFrequencyClip,
  } = spec;

  const [activeBin, setActiveBin] = useState<number>(-1);

  const handleArrow = (delta: number) => {
    // Only wedges with attempted > 0 are tabbable; arrow nav cycles the
    // same focusable set.
    const focusable = model.wedges.filter((w) => w.attempted > 0).map((w) => w.binIndex);
    if (focusable.length === 0) return;
    const current = activeBin;
    const currentPos = current >= 0 ? focusable.indexOf(current) : -1;
    const basePos = currentPos < 0 ? 0 : currentPos;
    const nextPos = (basePos + delta + focusable.length) % focusable.length;
    const next = focusable[nextPos] ?? focusable[0];
    if (next == null) return;
    setActiveBin(next);
    const nextEl = document.querySelector<HTMLElement>(
      `[data-testid="pass-sonar-wedge-${next}"]`,
    );
    if (nextEl) nextEl.focus();
  };

  const activeWedge = activeBin >= 0 ? model.wedges[activeBin] : undefined;
  const tooltipRows = activeWedge ? buildPassSonarTooltipRows(activeWedge) : null;

  const ariaLabel = subjectLabel ? `Pass sonar for ${subjectLabel}` : "Pass sonar";
  const cartesianLabels: PassSonarDirectionLabelsText = {
    ...DEFAULT_CARTESIAN_LABELS,
    ...(directionLabelsText ?? {}),
  };

  const plot = (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        role="img"
        aria-label={ariaLabel}
      >
        {!model.meta.empty ? (
          <>
            {polarGridConfig != null ? (
              <PolarGrid
                config={polarGridConfig}
                innerR={showGuide ? SUMMARY_INNER_R : MINIMAL_INNER_R}
                binCount={binCount}
                theme={theme}
              />
            ) : null}
            {showGuide ? <GuideRing theme={theme} /> : null}
            <g data-testid="pass-sonar-wedges">
              {model.wedges.map((wedge) => {
                const innerR = showGuide ? SUMMARY_INNER_R : MINIMAL_INNER_R;
                const draw = resolveWedgeDraw(wedge, spec, {
                  colorBy,
                  lengthBy,
                  innerR,
                  outerR: OUTER_R,
                  wedgesStyle,
                  theme,
                });
                return (
                  <Wedge
                    key={wedge.binIndex}
                    wedge={wedge}
                    colorBy={colorBy}
                    draw={draw}
                    focusable={wedge.attempted > 0}
                    onActivate={(idx) => {
                      setActiveBin(idx);
                    }}
                    onArrow={handleArrow}
                  />
                );
              })}
            </g>
            {directionLabels === "compass" ? (
              <DirectionLabelsCompass
                wedges={model.wedges}
                binCount={binCount}
                theme={theme}
                textStyle={textStyle}
              />
            ) : null}
            {directionLabels === "cartesian" ? (
              <DirectionLabelsCartesian
                text={cartesianLabels}
                theme={theme}
                textStyle={textStyle}
              />
            ) : null}
            {showSummary ? (
              <SummaryBlock
                subjectLabel={model.meta.subjectLabel}
                attempted={model.summary.attempted}
                completed={model.summary.completed}
                completionRate={model.summary.completionRate}
                theme={theme}
                textStyle={textStyle}
              />
            ) : null}
          </>
        ) : null}
      </svg>
      {model.meta.empty ? (
        <EmptyState message={emptyStateMessage(model.meta.subjectLabel)} theme={theme} />
      ) : null}
      {tooltipRows ? (
        <ChartTooltip testId="pass-sonar-tooltip" rows={tooltipRows} theme={theme} />
      ) : null}
    </div>
  );

  const legendNode = showLegend
    ? renderLegend({
        colorBy,
        empty: model.meta.empty,
        attemptedColor,
        completedColor,
        distanceStops,
        distanceClipMax,
        frequencyStops,
        frequencyClipMax: resolvedFrequencyClip,
        metricStops,
        metricCenter: resolvedMetricCenter,
        metricDomain: resolvedMetricDomain,
        metricRange: model.meta.metricRange,
        theme,
      })
    : null;

  return (
    <ChartFrame
      ariaLabel={ariaLabel}
      chartKind="pass-sonar"
      empty={model.meta.empty}
      maxWidth={420}
      plot={plot}
      legend={legendNode}
      methodologyNotes={methodologyNotes}
      theme={theme}
      warnings={model.meta.warnings}
    />
  );
}

function renderLegend({
  colorBy,
  empty,
  attemptedColor,
  completedColor,
  distanceStops,
  distanceClipMax,
  frequencyStops,
  frequencyClipMax,
  metricStops,
  metricCenter,
  metricDomain,
  metricRange,
  theme,
}: {
  colorBy: PassSonarColorBy;
  empty: boolean;
  attemptedColor: string;
  completedColor: string;
  distanceStops: ReadonlyArray<ColorStop>;
  distanceClipMax: number;
  frequencyStops: ReadonlyArray<ColorStop>;
  frequencyClipMax: number;
  metricStops: ReadonlyArray<ColorStop>;
  metricCenter: "zero" | "min-max";
  metricDomain: readonly [number, number];
  metricRange: { min: number; max: number } | null;
  theme: UITheme;
}) {
  if (colorBy === "distance") {
    return (
      <div data-testid="pass-sonar-legend">
        <ChartGradientLegend
          title="Avg pass distance"
          startLabel="0"
          endLabel={`${distanceClipMax}+`}
          colors={distanceStops.map((stop) => stop.color)}
          theme={theme}
        />
      </div>
    );
  }
  if (colorBy === "frequency") {
    return (
      <div data-testid="pass-sonar-legend">
        <ChartGradientLegend
          title="Passes per bin"
          startLabel="0"
          endLabel={empty ? "—" : `${Math.round(frequencyClipMax)}`}
          colors={frequencyStops.map((stop) => stop.color)}
          theme={theme}
        />
      </div>
    );
  }
  if (colorBy === "metric") {
    const [lo, hi] = metricDomain;
    if (metricCenter === "zero") {
      return (
        <div data-testid="pass-sonar-legend">
          <ChartGradientLegend
            title="Metric"
            startLabel={lo.toFixed(2)}
            endLabel={`+${hi.toFixed(2)}`}
            colors={metricStops.map((stop) => stop.color)}
            ticks={[{ at: 0.5, label: "0" }]}
            theme={theme}
          />
        </div>
      );
    }
    return (
      <div data-testid="pass-sonar-legend">
        <ChartGradientLegend
          title="Metric"
          startLabel={metricRange == null ? "min" : metricRange.min.toFixed(2)}
          endLabel={metricRange == null ? "max" : metricRange.max.toFixed(2)}
          colors={metricStops.map((stop) => stop.color)}
          theme={theme}
        />
      </div>
    );
  }
  if (colorBy === "none") {
    return (
      <ChartLegend
        testId="pass-sonar-legend"
        items={[{ key: "attempted", label: "Attempted passes", color: attemptedColor }]}
        swatchShape="circle"
        theme={theme}
      />
    );
  }
  return (
    <ChartLegend
      testId="pass-sonar-legend"
      items={[
        { key: "attempted", label: "Attempted passes", color: attemptedColor },
        { key: "completed", label: "Completed passes", color: completedColor },
      ]}
      swatchShape="circle"
      theme={theme}
    />
  );
}

export function resolvePassSonarStaticLegendSpec(
  props: PassSonarProps,
  theme: UITheme = LIGHT_THEME,
): PassSonarStaticLegendSpec | null {
  if (props.showLegend === false) return null;

  const colorBy: PassSonarColorBy = props.colorBy ?? "completion";
  const model = computePassSonar({
    passes: props.passes,
    ...(props.subjectLabel != null ? { subjectLabel: props.subjectLabel } : {}),
    ...(props.subjectId != null ? { subjectId: props.subjectId } : {}),
    ...(props.subjectKind != null ? { subjectKind: props.subjectKind } : {}),
    ...(props.scaleMaxAttempts != null
      ? { scaleMaxAttempts: props.scaleMaxAttempts }
      : {}),
    ...(props.scaleMaxLength != null ? { scaleMaxLength: props.scaleMaxLength } : {}),
    ...(props.metricForPass != null ? { metricForPass: props.metricForPass } : {}),
    ...(props.binCount != null ? { binCount: props.binCount } : {}),
    ...(props.lengthBy != null ? { lengthBy: props.lengthBy } : {}),
  });
  const spec = resolveEncodingSpec(props, model, theme);
  const palette = resolveThemePalette(props.seriesColors, theme) ?? [
    "#3b82f6",
    "#22c55e",
  ];

  if (colorBy === "distance") {
    return {
      kind: "scale",
      label: "Avg pass distance",
      startLabel: "0",
      endLabel: `${spec.distanceClipMax}+`,
      colors: spec.distanceStops.map((stop) => stop.color),
    };
  }

  if (colorBy === "frequency") {
    return {
      kind: "scale",
      label: "Passes per bin",
      startLabel: "0",
      endLabel: model.meta.empty ? "—" : `${Math.round(spec.resolvedFrequencyClip)}`,
      colors: spec.frequencyStops.map((stop) => stop.color),
    };
  }

  if (colorBy === "metric") {
    if (spec.resolvedMetricCenter === "zero") {
      const [lo, hi] = spec.resolvedMetricDomain;
      return {
        kind: "scale",
        label: "Metric",
        startLabel: lo.toFixed(2),
        endLabel: `+${hi.toFixed(2)}`,
        colors: spec.metricStops.map((stop) => stop.color),
        tickAt: 0.5,
        tickLabel: "0",
      };
    }

    return {
      kind: "scale",
      label: "Metric",
      startLabel:
        model.meta.metricRange == null ? "min" : model.meta.metricRange.min.toFixed(2),
      endLabel:
        model.meta.metricRange == null ? "max" : model.meta.metricRange.max.toFixed(2),
      colors: spec.metricStops.map((stop) => stop.color),
    };
  }

  if (colorBy === "none") {
    return {
      kind: "items",
      items: [
        { key: "attempted", label: "Attempted passes", color: palette[0] ?? "#3b82f6" },
      ],
    };
  }

  return {
    kind: "items",
    items: [
      { key: "attempted", label: "Attempted passes", color: palette[0] ?? "#3b82f6" },
      { key: "completed", label: "Completed passes", color: palette[1] ?? "#22c55e" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Static SVG export
// ---------------------------------------------------------------------------

export function PassSonarStaticSvg({
  theme = LIGHT_THEME,
  ...props
}: PassSonarProps & { theme?: UITheme }) {
  const binCount = props.binCount ?? DEFAULT_PASS_SONAR_BIN_COUNT;
  const lengthBy: PassSonarLengthBy = props.lengthBy ?? "count";
  const colorBy: PassSonarColorBy = props.colorBy ?? "completion";
  const showGuide = props.showGuide !== false;
  const directionLabels: PassSonarDirectionLabelsMode =
    props.directionLabels ?? "compass";
  const cartesianLabels: PassSonarDirectionLabelsText = {
    ...DEFAULT_CARTESIAN_LABELS,
    ...(props.directionLabelsText ?? {}),
  };
  const model = computePassSonar({
    passes: props.passes,
    ...(props.subjectLabel != null ? { subjectLabel: props.subjectLabel } : {}),
    ...(props.subjectId != null ? { subjectId: props.subjectId } : {}),
    ...(props.subjectKind != null ? { subjectKind: props.subjectKind } : {}),
    ...(props.scaleMaxAttempts != null
      ? { scaleMaxAttempts: props.scaleMaxAttempts }
      : {}),
    ...(props.scaleMaxLength != null ? { scaleMaxLength: props.scaleMaxLength } : {}),
    ...(props.metricForPass != null ? { metricForPass: props.metricForPass } : {}),
    binCount,
    lengthBy,
  });
  const spec = resolveEncodingSpec(props, model, theme);
  const showSummary = props.showSummary !== false;
  const innerR = showGuide ? SUMMARY_INNER_R : MINIMAL_INNER_R;
  const polarGridConfig: PassSonarPolarGridConfig | null =
    props.polarGrid == null || props.polarGrid === false
      ? null
      : props.polarGrid === true
        ? {}
        : props.polarGrid;
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={
        model.meta.subjectLabel
          ? `Pass sonar for ${model.meta.subjectLabel}`
          : "Pass sonar"
      }
      style={{ display: "block", overflow: "visible" }}
    >
      {!model.meta.empty ? (
        <>
          {polarGridConfig != null ? (
            <PolarGrid
              config={polarGridConfig}
              innerR={innerR}
              binCount={binCount}
              theme={theme}
            />
          ) : null}
          {showGuide ? <GuideRing theme={theme} /> : null}
          <g data-testid="pass-sonar-wedges">
            {model.wedges.map((wedge) => {
              const draw = resolveWedgeDraw(wedge, spec, {
                colorBy,
                lengthBy,
                innerR,
                outerR: OUTER_R,
                wedgesStyle: props.wedges,
                theme,
              });
              return (
                <g key={wedge.binIndex}>
                  {draw.attemptedD ? (
                    <path
                      d={draw.attemptedD}
                      fill={draw.primaryFill}
                      fillOpacity={draw.attemptedOpacity}
                      stroke={draw.stroke}
                      strokeWidth={draw.strokeWidth}
                    />
                  ) : null}
                  {colorBy === "completion" && draw.completedD ? (
                    <path
                      d={draw.completedD}
                      fill={draw.completedFill}
                      fillOpacity={draw.completedOpacity}
                      stroke={draw.stroke}
                      strokeWidth={draw.strokeWidth}
                    />
                  ) : null}
                </g>
              );
            })}
          </g>
          {directionLabels === "compass" ? (
            <DirectionLabelsCompass
              wedges={model.wedges}
              binCount={binCount}
              theme={theme}
              textStyle={props.text}
            />
          ) : null}
          {directionLabels === "cartesian" ? (
            <DirectionLabelsCartesian
              text={cartesianLabels}
              theme={theme}
              textStyle={props.text}
            />
          ) : null}
          {showSummary ? (
            <SummaryBlock
              subjectLabel={model.meta.subjectLabel}
              attempted={model.summary.attempted}
              completed={model.summary.completed}
              completionRate={model.summary.completionRate}
              theme={theme}
              textStyle={props.text}
            />
          ) : null}
        </>
      ) : (
        <ChartSvgEmptyState
          x={CENTER}
          y={CENTER}
          message={emptyStateMessage(model.meta.subjectLabel)}
          theme={theme}
          dominantBaseline="central"
        />
      )}
    </svg>
  );
}
