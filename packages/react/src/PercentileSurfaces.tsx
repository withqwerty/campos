import { useEffect, useMemo, useRef } from "react";

import {
  resolvePercentileSurfaceModel,
  type PercentileAccessibleLabel,
  type PercentileComparisonSample,
  type PercentileMetric,
  type PercentileSurfaceModel,
} from "./compute/percentile-surface.js";
import { pickContrast } from "./colorContrast.js";
import { ChartSvgEmptyState } from "./primitives/index.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";
import { useTheme } from "./ThemeContext.js";
import type { UITheme } from "./theme.js";

// ---------------------------------------------------------------------------
// Style-family context + shape types
// ---------------------------------------------------------------------------

export type PercentileTrackStyleContext = {
  metricId: string;
  percentile: number;
  originalDirection: "higher" | "lower" | undefined;
  comparisonLabel: string;
  theme: UITheme;
};

export type PercentileFillStyleContext = PercentileTrackStyleContext;

export type PercentileTextRole =
  | "metricLabel"
  | "percentileLabel"
  | "sampleLabel"
  | "valueLabel";

export type PercentileTextStyleContext = {
  metricId: string;
  role: PercentileTextRole;
  theme: UITheme;
};

export type PercentileTicksStyleContext = {
  metricId: string;
  tickValue: 25 | 50 | 75;
  theme: UITheme;
};

export type PercentileBadgeStyleContext = {
  metricId: string;
  role: "inversion";
  theme: UITheme;
};

export type PercentileLeadingBadgeStyleContext = {
  metricId: string;
  percentile: number;
  theme: UITheme;
};

export type PercentileTrackStyle = {
  fill?: StyleValue<string, PercentileTrackStyleContext>;
  stroke?: StyleValue<string, PercentileTrackStyleContext>;
  strokeWidth?: StyleValue<number, PercentileTrackStyleContext>;
  opacity?: StyleValue<number, PercentileTrackStyleContext>;
  radius?: StyleValue<number, PercentileTrackStyleContext>;
};

export type PercentileFillStyle = {
  fill?: StyleValue<string, PercentileFillStyleContext>;
  opacity?: StyleValue<number, PercentileFillStyleContext>;
  radius?: StyleValue<number, PercentileFillStyleContext>;
};

export type PercentileTextStyle = {
  fill?: StyleValue<string, PercentileTextStyleContext>;
  fontSize?: StyleValue<number, PercentileTextStyleContext>;
  fontWeight?: StyleValue<number, PercentileTextStyleContext>;
  valueFormat?: (value: string | number) => string;
};

export type PercentileTicksStyle = {
  stroke?: StyleValue<string, PercentileTicksStyleContext>;
  strokeWidth?: StyleValue<number, PercentileTicksStyleContext>;
  opacity?: StyleValue<number, PercentileTicksStyleContext>;
  visible?: StyleValue<boolean, PercentileTicksStyleContext>;
};

export type PercentileBadgeStyle = {
  fill?: StyleValue<string, PercentileBadgeStyleContext>;
  textFill?: StyleValue<string, PercentileBadgeStyleContext>;
  strokeWidth?: StyleValue<number, PercentileBadgeStyleContext>;
};

/**
 * Leading value badge — an opt-in circular chip at the LEFT end of the bar
 * track that contains the rounded percentile integer. Matches the
 * scouting-report style (@adnaaan433, CannonStats, StatsBomb scouting
 * reports). Off by default so existing consumers are unchanged; enable by
 * passing `leadingBadge={{ visible: true }}`.
 *
 * When visible, the track shrinks by roughly 26 viewBox units to make
 * room. Callers that also want to hide the right-aligned percentile
 * number (which becomes redundant) should set `showPercentileLabel={false}`.
 */
export type PercentileLeadingBadgeStyle = {
  visible?: StyleValue<boolean, PercentileLeadingBadgeStyleContext>;
  fill?: StyleValue<string, PercentileLeadingBadgeStyleContext>;
  textFill?: StyleValue<string, PercentileLeadingBadgeStyleContext>;
  stroke?: StyleValue<string, PercentileLeadingBadgeStyleContext>;
  strokeWidth?: StyleValue<number, PercentileLeadingBadgeStyleContext>;
  radius?: StyleValue<number, PercentileLeadingBadgeStyleContext>;
  fontSize?: StyleValue<number, PercentileLeadingBadgeStyleContext>;
  fontWeight?: StyleValue<number, PercentileLeadingBadgeStyleContext>;
};

// ---------------------------------------------------------------------------
// Component prop types
// ---------------------------------------------------------------------------

/**
 * A `recipe` is a preset bundle applied before individual style families.
 * Recipes follow the `defineChartRecipe` convention: a `props` object
 * that may contain callback style values resolved per render against
 * the current theme. Individual family overrides win at the prop level.
 */
import type { ChartRecipe } from "./chartRecipes.js";
import { mergeChartRecipeProps } from "./chartRecipes.js";

export type PercentileBarRecipe = ChartRecipe<PercentileBarProps>;
export type PercentilePillRecipe = ChartRecipe<PercentilePillProps>;

export type PercentileSurfaceSharedProps = {
  metric: PercentileMetric;
  showValue?: boolean;
  inversionBadgeLabel?: string;
  onWarnings?: (warnings: readonly string[]) => void;
  track?: PercentileTrackStyle;
  fill?: PercentileFillStyle;
  text?: PercentileTextStyle;
  badges?: PercentileBadgeStyle;
};

export type PercentileBarProps = PercentileSurfaceSharedProps & {
  comparison: PercentileComparisonSample;
  showComparisonLabel?: boolean;
  showPercentileLabel?: boolean;
  showTicks?: boolean;
  ticks?: PercentileTicksStyle;
  leadingBadge?: PercentileLeadingBadgeStyle;
  recipe?: PercentileBarRecipe;
};

// Discriminated union enforcing: pill requires comparison OR a fallback
// accessibleSampleLabel. `{ metric }` alone is a compile error.
type PercentilePillSampleBranch =
  | {
      comparison: PercentileComparisonSample;
      accessibleSampleLabel?: string;
    }
  | {
      comparison?: undefined;
      accessibleSampleLabel: string;
    };

export type PercentilePillProps = PercentileSurfaceSharedProps &
  PercentilePillSampleBranch & {
    recipe?: PercentilePillRecipe;
  };

// ---------------------------------------------------------------------------
// Geometry + defaults (local; not exported)
// ---------------------------------------------------------------------------

const BAR_VIEWBOX_WIDTH = 320;
const BAR_VIEWBOX_HEIGHT = 30;
const BAR_LABEL_BLOCK_WIDTH = 132;
const BAR_PERCENTILE_BLOCK_WIDTH = 24;
const BAR_TRACK_PADDING_X = 8;
const BAR_TRACK_TOP = 12;
const BAR_TRACK_HEIGHT = 6;
const BAR_METRIC_LABEL_Y = 9;
const BAR_COMPARISON_LABEL_Y = 26;
const BAR_VALUE_LABEL_Y = 26;
const BAR_LEADING_BADGE_DIAMETER = 22;
const BAR_LEADING_BADGE_GAP = 4;

const PILL_VIEWBOX_WIDTH = 180;
const PILL_VIEWBOX_HEIGHT = 22;
const PILL_PADDING_X = 10;
const PILL_LABEL_WIDTH = 86;

const DEFAULT_INVERSION_LABEL = "lower is better";

const EMPTY_STATE_COPY: Record<string, string> = {
  missingMetricId: "Missing metric id",
  missingMetricLabel: "Missing metric label",
  missingPercentile: "No percentile supplied",
  nonFinitePercentile: "Invalid percentile value",
  missingComparisonLabel: "Missing comparison sample",
};

export const PERCENTILE_BAR_STATIC_VIEWBOX = {
  width: BAR_VIEWBOX_WIDTH,
  height: BAR_VIEWBOX_HEIGHT,
} as const;

function accessibleLabelString(label: PercentileAccessibleLabel | null): string {
  if (label == null) return "";
  const parts = [label.metricLabel, label.percentileText, label.sampleText];
  if (label.inversionNote) parts.push(label.inversionNote);
  return parts.join(", ");
}

function defaultFillColor(percentile: number, theme: UITheme): string {
  if (percentile >= 75) return theme.accent.green;
  if (percentile >= 40) return theme.accent.blue;
  if (percentile >= 25) return theme.accent.slate;
  return theme.accent.orange;
}

function defaultFillOpacity(percentile: number): number {
  if (percentile >= 75) return 1;
  if (percentile >= 40) return 0.85;
  if (percentile >= 25) return 0.8;
  return 0.85;
}

function formatRawValue(
  raw: string | number,
  formatter: PercentileTextStyle["valueFormat"] | undefined,
  unit: string | undefined,
): string {
  if (formatter) {
    const out = formatter(raw);
    if (unit && out.indexOf(unit) === -1) return `${out}${unit}`;
    return out;
  }
  const base =
    typeof raw === "string"
      ? raw
      : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(raw);
  return unit ? `${base}${unit}` : base;
}

// Hook: surface warnings through the optional onWarnings callback and a
// single mount-time dev-only console.warn. Never fires from the render
// path — only once per distinct warnings-signature.
function useWarningsEffect(
  warnings: readonly string[],
  onWarnings: ((warnings: readonly string[]) => void) | undefined,
  metricId: string | null,
): void {
  const previousSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    const signature = warnings.join("|");
    if (signature === previousSignatureRef.current) return;
    previousSignatureRef.current = signature;
    if (warnings.length === 0) return;
    if (onWarnings) {
      onWarnings(warnings);
    }
    const nodeEnv =
      typeof globalThis.process !== "undefined"
        ? globalThis.process.env.NODE_ENV
        : undefined;
    if (nodeEnv !== "production") {
      console.warn(
        `[campos/percentile-surfaces]${metricId ? ` (${metricId})` : ""}: ${warnings.join(" | ")}`,
      );
    }
  }, [warnings, onWarnings, metricId]);
}

// ---------------------------------------------------------------------------
// PercentileBar
// ---------------------------------------------------------------------------

type PercentileBarSvgProps = {
  resolved: PercentileBarProps;
  theme: UITheme;
  width: string | number;
  height: string | number;
  preserveAspectRatio: string;
  focusable?: boolean;
  tabIndex?: number;
  responsive?: boolean;
};

function PercentileBarSvg({
  resolved,
  theme,
  width,
  height,
  preserveAspectRatio,
  focusable,
  tabIndex,
  responsive = false,
}: PercentileBarSvgProps) {
  const {
    metric,
    comparison,
    showValue = metric.rawValue != null,
    showComparisonLabel = true,
    showPercentileLabel = true,
    showTicks = true,
    inversionBadgeLabel = DEFAULT_INVERSION_LABEL,
    track,
    fill,
    text,
    ticks,
    badges,
    leadingBadge,
    onWarnings,
  } = resolved;

  const model: PercentileSurfaceModel = useMemo(
    () =>
      resolvePercentileSurfaceModel({
        metric,
        comparison,
        requireComparisonLabel: true,
      }),
    [metric, comparison],
  );

  useWarningsEffect(model.meta.warnings, onWarnings, model.meta.metricId);

  const ariaLabel = accessibleLabelString(model.accessibleLabel);

  return (
    <svg
      role="img"
      direction="ltr"
      viewBox={`0 0 ${BAR_VIEWBOX_WIDTH} ${BAR_VIEWBOX_HEIGHT}`}
      width={width}
      height={height}
      preserveAspectRatio={preserveAspectRatio}
      style={
        responsive
          ? { maxWidth: "100%", height: "auto", display: "block" }
          : { display: "block" }
      }
      aria-label={ariaLabel}
      aria-description={
        model.meta.invalidReason != null
          ? EMPTY_STATE_COPY[model.meta.invalidReason]
          : undefined
      }
      data-slot="percentile-bar"
      {...(tabIndex != null ? { tabIndex } : {})}
      {...(focusable != null ? { focusable } : {})}
    >
      {model.meta.invalidReason != null ? (
        <ChartSvgEmptyState
          x={BAR_VIEWBOX_WIDTH / 2}
          y={BAR_VIEWBOX_HEIGHT / 2}
          message={EMPTY_STATE_COPY[model.meta.invalidReason] ?? "Invalid input"}
          theme={theme}
          dominantBaseline="central"
        />
      ) : (
        <BarContent
          metric={metric}
          comparison={comparison}
          model={model}
          theme={theme}
          showValue={showValue}
          showComparisonLabel={showComparisonLabel}
          showPercentileLabel={showPercentileLabel}
          showTicks={showTicks}
          inversionBadgeLabel={inversionBadgeLabel}
          track={track}
          fill={fill}
          text={text}
          ticks={ticks}
          badges={badges}
          leadingBadge={leadingBadge}
        />
      )}
    </svg>
  );
}

function resolvePercentileBarProps(props: PercentileBarProps): PercentileBarProps {
  if (!props.recipe) return props;
  const base = mergeChartRecipeProps<PercentileBarProps>(props.recipe);
  return { ...base, ...props } as PercentileBarProps;
}

export function PercentileBar(props: PercentileBarProps) {
  const theme = useTheme();
  const resolved = useMemo(() => resolvePercentileBarProps(props), [props]);

  return (
    <PercentileBarSvg
      resolved={resolved}
      theme={theme}
      width={BAR_VIEWBOX_WIDTH}
      height={BAR_VIEWBOX_HEIGHT}
      preserveAspectRatio="xMinYMid meet"
      tabIndex={0}
      focusable={true}
      responsive={true}
    />
  );
}

export function PercentileBarStaticSvg(props: PercentileBarProps) {
  const theme = useTheme();
  const resolved = useMemo(() => resolvePercentileBarProps(props), [props]);

  return (
    <PercentileBarSvg
      resolved={resolved}
      theme={theme}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

type BarContentProps = {
  metric: PercentileMetric;
  comparison: PercentileComparisonSample;
  model: PercentileSurfaceModel;
  theme: UITheme;
  showValue: boolean;
  showComparisonLabel: boolean;
  showPercentileLabel: boolean;
  showTicks: boolean;
  inversionBadgeLabel: string;
  track: PercentileTrackStyle | undefined;
  fill: PercentileFillStyle | undefined;
  text: PercentileTextStyle | undefined;
  ticks: PercentileTicksStyle | undefined;
  badges: PercentileBadgeStyle | undefined;
  leadingBadge: PercentileLeadingBadgeStyle | undefined;
};

function BarContent(props: BarContentProps) {
  const {
    metric,
    comparison,
    model,
    theme,
    showValue,
    showComparisonLabel,
    showPercentileLabel,
    showTicks,
    inversionBadgeLabel,
    track,
    fill,
    text,
    ticks,
    badges,
    leadingBadge,
  } = props;

  const clamped = model.geometry?.clampedPercentile ?? 0;

  const leadingBadgeCtx: PercentileLeadingBadgeStyleContext = {
    metricId: metric.id,
    percentile: clamped,
    theme,
  };
  const leadingBadgeVisible =
    resolveStyleValue(leadingBadge?.visible, leadingBadgeCtx) === true;

  const trackCtx: PercentileTrackStyleContext = {
    metricId: metric.id,
    percentile: clamped,
    originalDirection: metric.originalDirection,
    comparisonLabel: comparison.label,
    theme,
  };

  const leadingBadgeReserve = leadingBadgeVisible
    ? BAR_LEADING_BADGE_DIAMETER + BAR_LEADING_BADGE_GAP
    : 0;
  const trackX = BAR_LABEL_BLOCK_WIDTH + leadingBadgeReserve;
  const trackWidth =
    BAR_VIEWBOX_WIDTH -
    BAR_LABEL_BLOCK_WIDTH -
    leadingBadgeReserve -
    BAR_PERCENTILE_BLOCK_WIDTH -
    BAR_TRACK_PADDING_X;
  const fillWidth = (trackWidth * clamped) / 100;

  const trackFill = resolveStyleValue(track?.fill, trackCtx) ?? theme.border.subtle;
  const trackStroke = resolveStyleValue(track?.stroke, trackCtx);
  const trackStrokeWidth = resolveStyleValue(track?.strokeWidth, trackCtx);
  const trackOpacity = resolveStyleValue(track?.opacity, trackCtx);
  const trackRadius = resolveStyleValue(track?.radius, trackCtx) ?? 4;

  const fillCtx: PercentileFillStyleContext = trackCtx;
  const fillColor =
    resolveStyleValue(fill?.fill, fillCtx) ?? defaultFillColor(clamped, theme);
  const fillOpacity =
    resolveStyleValue(fill?.opacity, fillCtx) ?? defaultFillOpacity(clamped);
  const fillRadius = resolveStyleValue(fill?.radius, fillCtx) ?? trackRadius;

  const metricLabelCtx: PercentileTextStyleContext = {
    metricId: metric.id,
    role: "metricLabel",
    theme,
  };
  const sampleLabelCtx: PercentileTextStyleContext = {
    ...metricLabelCtx,
    role: "sampleLabel",
  };
  const percentileLabelCtx: PercentileTextStyleContext = {
    ...metricLabelCtx,
    role: "percentileLabel",
  };
  const valueLabelCtx: PercentileTextStyleContext = {
    ...metricLabelCtx,
    role: "valueLabel",
  };

  const metricLabelFill =
    resolveStyleValue(text?.fill, metricLabelCtx) ?? theme.text.primary;
  const metricLabelFontSize = resolveStyleValue(text?.fontSize, metricLabelCtx) ?? 10;
  const metricLabelFontWeight =
    resolveStyleValue(text?.fontWeight, metricLabelCtx) ?? 600;

  const sampleLabelFill =
    resolveStyleValue(text?.fill, sampleLabelCtx) ?? theme.text.secondary;
  const sampleLabelFontSize = resolveStyleValue(text?.fontSize, sampleLabelCtx) ?? 8.5;

  const percentileLabelFill =
    resolveStyleValue(text?.fill, percentileLabelCtx) ?? theme.text.primary;
  const percentileLabelFontSize =
    resolveStyleValue(text?.fontSize, percentileLabelCtx) ?? 11;
  const percentileLabelFontWeight =
    resolveStyleValue(text?.fontWeight, percentileLabelCtx) ?? 700;

  const valueLabelFill =
    resolveStyleValue(text?.fill, valueLabelCtx) ?? theme.text.secondary;
  const valueLabelFontSize = resolveStyleValue(text?.fontSize, valueLabelCtx) ?? 8.5;

  const showInversionBadge =
    metric.originalDirection === "lower" && inversionBadgeLabel.length > 0;

  const badgeCtx: PercentileBadgeStyleContext = {
    metricId: metric.id,
    role: "inversion",
    theme,
  };
  const badgeFill = resolveStyleValue(badges?.fill, badgeCtx) ?? theme.surface.badge;
  const badgeTextFill = resolveStyleValue(badges?.textFill, badgeCtx) ?? theme.text.badge;
  const badgeStrokeWidth = resolveStyleValue(badges?.strokeWidth, badgeCtx);

  const valueText =
    showValue && metric.rawValue != null
      ? formatRawValue(metric.rawValue, text?.valueFormat, metric.rawValueUnit)
      : null;

  return (
    <g>
      {/* Metric label */}
      <text
        x={0}
        y={BAR_METRIC_LABEL_Y}
        fill={metricLabelFill}
        fontSize={metricLabelFontSize}
        fontWeight={metricLabelFontWeight}
        data-slot="percentile-bar-metric-label"
      >
        {metric.label}
      </text>

      {showInversionBadge ? (
        <g
          data-slot="percentile-bar-inversion-badge"
          transform={`translate(0, ${BAR_VIEWBOX_HEIGHT - 11})`}
        >
          <rect
            x={0}
            y={0}
            rx={5}
            ry={5}
            width={68}
            height={10}
            fill={badgeFill}
            stroke={theme.border.badge}
            strokeWidth={badgeStrokeWidth ?? 0.5}
          />
          <text
            x={34}
            y={7.5}
            textAnchor="middle"
            fill={badgeTextFill}
            fontSize={7}
            fontWeight={600}
          >
            {inversionBadgeLabel}
          </text>
        </g>
      ) : null}

      {showComparisonLabel && !showInversionBadge ? (
        <text
          x={0}
          y={BAR_COMPARISON_LABEL_Y}
          fill={sampleLabelFill}
          fontSize={sampleLabelFontSize}
          data-slot="percentile-bar-sample-label"
        >
          {comparison.label}
        </text>
      ) : null}

      {/* Leading value badge (opt-in circular chip holding the percentile) */}
      {leadingBadgeVisible ? (
        <g data-slot="percentile-bar-leading-badge">
          <circle
            cx={BAR_LABEL_BLOCK_WIDTH + BAR_LEADING_BADGE_DIAMETER / 2}
            cy={BAR_TRACK_TOP + BAR_TRACK_HEIGHT / 2}
            r={
              resolveStyleValue(leadingBadge?.radius, leadingBadgeCtx) ??
              BAR_LEADING_BADGE_DIAMETER / 2
            }
            fill={
              resolveStyleValue(leadingBadge?.fill, leadingBadgeCtx) ??
              defaultFillColor(clamped, theme)
            }
            {...(resolveStyleValue(leadingBadge?.stroke, leadingBadgeCtx) != null
              ? {
                  stroke: resolveStyleValue(
                    leadingBadge?.stroke,
                    leadingBadgeCtx,
                  ) as string,
                }
              : {})}
            {...(resolveStyleValue(leadingBadge?.strokeWidth, leadingBadgeCtx) != null
              ? {
                  strokeWidth: resolveStyleValue(
                    leadingBadge?.strokeWidth,
                    leadingBadgeCtx,
                  ) as number,
                }
              : {})}
          />
          <text
            x={BAR_LABEL_BLOCK_WIDTH + BAR_LEADING_BADGE_DIAMETER / 2}
            y={BAR_TRACK_TOP + BAR_TRACK_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={
              resolveStyleValue(leadingBadge?.textFill, leadingBadgeCtx) ??
              theme.text.badge
            }
            fontSize={resolveStyleValue(leadingBadge?.fontSize, leadingBadgeCtx) ?? 10}
            fontWeight={
              resolveStyleValue(leadingBadge?.fontWeight, leadingBadgeCtx) ?? 700
            }
          >
            {Math.round(clamped)}
          </text>
        </g>
      ) : null}

      {/* Track */}
      <rect
        x={trackX}
        y={BAR_TRACK_TOP}
        width={trackWidth}
        height={BAR_TRACK_HEIGHT}
        rx={trackRadius}
        ry={trackRadius}
        fill={trackFill}
        {...(trackStroke != null ? { stroke: trackStroke } : {})}
        {...(trackStrokeWidth != null ? { strokeWidth: trackStrokeWidth } : {})}
        {...(trackOpacity != null ? { opacity: trackOpacity } : {})}
        data-slot="percentile-bar-track"
      />

      {/* Ticks at 25 / 50 / 75 */}
      {showTicks
        ? ([25, 50, 75] as const).map((tickValue) => {
            const ticksCtx: PercentileTicksStyleContext = {
              metricId: metric.id,
              tickValue,
              theme,
            };
            const visible = resolveStyleValue(ticks?.visible, ticksCtx) ?? true;
            if (!visible) return null;
            const tickX = trackX + (trackWidth * tickValue) / 100;
            return (
              <line
                key={tickValue}
                x1={tickX}
                x2={tickX}
                y1={BAR_TRACK_TOP - 2}
                y2={BAR_TRACK_TOP + BAR_TRACK_HEIGHT + 2}
                stroke={resolveStyleValue(ticks?.stroke, ticksCtx) ?? theme.axis.tick}
                strokeWidth={resolveStyleValue(ticks?.strokeWidth, ticksCtx) ?? 1}
                opacity={resolveStyleValue(ticks?.opacity, ticksCtx) ?? 0.5}
                data-slot="percentile-bar-tick"
                data-tick-value={tickValue}
              />
            );
          })
        : null}

      {/* Fill */}
      {fillWidth > 0 ? (
        <rect
          x={trackX}
          y={BAR_TRACK_TOP}
          width={fillWidth}
          height={BAR_TRACK_HEIGHT}
          rx={fillRadius}
          ry={fillRadius}
          fill={fillColor}
          opacity={fillOpacity}
          data-slot="percentile-bar-fill"
        />
      ) : null}

      {/* Percentile label (right-aligned) */}
      {showPercentileLabel ? (
        <text
          x={BAR_VIEWBOX_WIDTH}
          y={BAR_METRIC_LABEL_Y + 4}
          textAnchor="end"
          fill={percentileLabelFill}
          fontSize={percentileLabelFontSize}
          fontWeight={percentileLabelFontWeight}
          data-slot="percentile-bar-percentile-label"
        >
          {Math.round(clamped)}
        </text>
      ) : null}

      {/* Raw value (right-aligned, below) */}
      {valueText ? (
        <text
          x={BAR_VIEWBOX_WIDTH}
          y={BAR_VALUE_LABEL_Y}
          textAnchor="end"
          fill={valueLabelFill}
          fontSize={valueLabelFontSize}
          data-slot="percentile-bar-value-label"
        >
          {valueText}
        </text>
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// PercentilePill
// ---------------------------------------------------------------------------

export function PercentilePill(props: PercentilePillProps) {
  const theme = useTheme();
  const resolved: PercentilePillProps = useMemo(() => {
    if (!props.recipe) return props;
    const base = mergeChartRecipeProps<PercentilePillProps>(props.recipe);
    return { ...base, ...props } as PercentilePillProps;
  }, [props]);

  const {
    metric,
    showValue = metric.rawValue != null,
    inversionBadgeLabel = DEFAULT_INVERSION_LABEL,
    track,
    fill,
    text,
    badges,
    onWarnings,
  } = resolved;

  const comparison = "comparison" in resolved ? resolved.comparison : undefined;
  const accessibleSampleLabel =
    "accessibleSampleLabel" in resolved ? resolved.accessibleSampleLabel : undefined;

  const model: PercentileSurfaceModel = useMemo(
    () =>
      resolvePercentileSurfaceModel({
        metric,
        ...(comparison ? { comparison } : {}),
        ...(accessibleSampleLabel ? { accessibleSampleLabel } : {}),
        requireComparisonLabel: false,
      }),
    [metric, comparison, accessibleSampleLabel],
  );

  useWarningsEffect(model.meta.warnings, onWarnings, model.meta.metricId);

  const ariaLabel = accessibleLabelString(model.accessibleLabel);
  const clamped = model.geometry?.clampedPercentile ?? 0;

  const trackCtx: PercentileTrackStyleContext = {
    metricId: metric.id,
    percentile: clamped,
    originalDirection: metric.originalDirection,
    comparisonLabel: comparison?.label ?? accessibleSampleLabel ?? "",
    theme,
  };

  const trackFill = resolveStyleValue(track?.fill, trackCtx) ?? theme.border.subtle;
  const fillCtx: PercentileFillStyleContext = trackCtx;
  const fillColor =
    resolveStyleValue(fill?.fill, fillCtx) ?? defaultFillColor(clamped, theme);
  const fillOpacity =
    resolveStyleValue(fill?.opacity, fillCtx) ?? defaultFillOpacity(clamped);

  const metricLabelCtx: PercentileTextStyleContext = {
    metricId: metric.id,
    role: "metricLabel",
    theme,
  };
  const percentileLabelCtx: PercentileTextStyleContext = {
    ...metricLabelCtx,
    role: "percentileLabel",
  };
  const valueLabelCtx: PercentileTextStyleContext = {
    ...metricLabelCtx,
    role: "valueLabel",
  };

  const metricLabelFontSize = resolveStyleValue(text?.fontSize, metricLabelCtx) ?? 9;
  const percentileLabelFontSize =
    resolveStyleValue(text?.fontSize, percentileLabelCtx) ?? 10;
  // valueLabelCtx is kept resolvable for consumers that want a distinct
  // fill per role via callbacks, but the pill concatenates percentile +
  // value into a single run so the value inherits the percentile fill.
  void valueLabelCtx;

  // Pick label text colours by contrast: each text slot may sit over the
  // fill (high percentile) or the track (low percentile), so resolve each
  // slot against the background it actually lands on. Consumers can still
  // override via the `text` style family; overrides win.
  const fillWidth = (PILL_VIEWBOX_WIDTH * clamped) / 100;
  const LABEL_END_APPROX = PILL_VIEWBOX_WIDTH * 0.55; // label generally ends ~55% across
  const PERCENTILE_START_APPROX = PILL_VIEWBOX_WIDTH * 0.7; // right-aligned block begins ~70%
  const labelBg = fillWidth > LABEL_END_APPROX ? fillColor : trackFill;
  const percentileBg = fillWidth > PERCENTILE_START_APPROX ? fillColor : trackFill;
  const onLightColor = theme.contrast.onLight;
  const onDarkColor = theme.contrast.onDark;
  const metricLabelFill =
    resolveStyleValue(text?.fill, metricLabelCtx) ??
    pickContrast(labelBg, [onLightColor, onDarkColor]);
  const percentileLabelFill =
    resolveStyleValue(text?.fill, percentileLabelCtx) ??
    pickContrast(percentileBg, [onLightColor, onDarkColor]);

  const badgeCtx: PercentileBadgeStyleContext = {
    metricId: metric.id,
    role: "inversion",
    theme,
  };
  const badgeFill = resolveStyleValue(badges?.fill, badgeCtx) ?? theme.surface.badge;
  const badgeTextFill = resolveStyleValue(badges?.textFill, badgeCtx) ?? theme.text.badge;

  const showInversionBadge =
    metric.originalDirection === "lower" && inversionBadgeLabel.length > 0;

  const valueText =
    showValue && metric.rawValue != null
      ? formatRawValue(metric.rawValue, text?.valueFormat, metric.rawValueUnit)
      : null;

  return (
    <svg
      role="img"
      direction="ltr"
      viewBox={`0 0 ${PILL_VIEWBOX_WIDTH} ${PILL_VIEWBOX_HEIGHT}`}
      width={PILL_VIEWBOX_WIDTH}
      height={PILL_VIEWBOX_HEIGHT}
      preserveAspectRatio="xMinYMid meet"
      style={{ maxWidth: "100%", height: "auto", display: "block" }}
      aria-label={ariaLabel}
      aria-description={
        model.meta.invalidReason != null
          ? EMPTY_STATE_COPY[model.meta.invalidReason]
          : undefined
      }
      data-slot="percentile-pill"
      tabIndex={0}
      focusable={true}
    >
      {model.meta.invalidReason != null ? (
        <ChartSvgEmptyState
          x={PILL_VIEWBOX_WIDTH / 2}
          y={PILL_VIEWBOX_HEIGHT / 2}
          message={EMPTY_STATE_COPY[model.meta.invalidReason] ?? "Invalid input"}
          theme={theme}
          dominantBaseline="central"
        />
      ) : (
        <g>
          <rect
            x={0}
            y={0}
            width={PILL_VIEWBOX_WIDTH}
            height={PILL_VIEWBOX_HEIGHT}
            rx={14}
            ry={14}
            fill={trackFill}
            data-slot="percentile-pill-track"
          />
          {fillWidth > 0 ? (
            <rect
              x={0}
              y={0}
              width={fillWidth}
              height={PILL_VIEWBOX_HEIGHT}
              rx={14}
              ry={14}
              fill={fillColor}
              opacity={fillOpacity}
              data-slot="percentile-pill-fill"
            />
          ) : null}
          <text
            x={PILL_PADDING_X}
            y={PILL_VIEWBOX_HEIGHT / 2 + 3}
            fill={metricLabelFill}
            fontSize={metricLabelFontSize}
            fontWeight={600}
            data-slot="percentile-pill-metric-label"
          >
            {metric.label}
          </text>
          <text
            x={PILL_VIEWBOX_WIDTH - PILL_PADDING_X}
            y={PILL_VIEWBOX_HEIGHT / 2 + 3}
            textAnchor="end"
            fill={percentileLabelFill}
            fontSize={percentileLabelFontSize}
            fontWeight={700}
            data-slot="percentile-pill-percentile-label"
          >
            {valueText
              ? `${Math.round(clamped)} · ${valueText}`
              : `${Math.round(clamped)}`}
          </text>
          {showInversionBadge ? (
            <g
              data-slot="percentile-pill-inversion-badge"
              transform={`translate(${PILL_LABEL_WIDTH}, 6)`}
            >
              <rect
                x={0}
                y={0}
                rx={7}
                ry={7}
                width={24}
                height={14}
                fill={badgeFill}
                opacity={0.9}
              />
              <text
                x={12}
                y={10}
                textAnchor="middle"
                fill={badgeTextFill}
                fontSize={8}
                fontWeight={600}
              >
                LIB
              </text>
            </g>
          ) : null}
        </g>
      )}
    </svg>
  );
}

// Re-export the compute types for convenience on the main library barrel.
export type {
  PercentileAccessibleLabel,
  PercentileComparisonSample,
  PercentileMetric,
  PercentileSurfaceModel,
};
