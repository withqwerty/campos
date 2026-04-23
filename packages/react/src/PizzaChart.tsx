import { useId, useMemo, useState } from "react";

import {
  computePizzaChart,
  type ComputePizzaChartInput,
  type PizzaChartCategoryWashModel,
  type PizzaChartGridRingModel,
  type PizzaChartLabelModel,
  type PizzaChartModel,
  type PizzaChartReferenceSetModel,
  type PizzaChartSliceModel,
  type PizzaChartSpokeModel,
  type PizzaChartValueBadgeModel,
} from "./compute/index.js";

import { useTheme } from "./ThemeContext.js";
import { resolveStyleValue, type StyleValue } from "./styleValue.js";
import { LIGHT_THEME, type UITheme } from "./theme.js";
import { resolveThemePalette, type ThemePalette } from "./themePalette.js";
import {
  ChartFrame,
  ChartLegend,
  type ChartMethodologyNotes,
  ChartSvgEmptyState,
  ChartTooltip,
  EmptyState,
  LABEL_ANGLE_PADDING,
  LABEL_FONT_SIZE,
  LABEL_LINE_HEIGHT,
  arcSegmentPath,
  labelArcPath,
  ringPath,
  roundSvg,
  slicePath,
  wrapLabel,
} from "./primitives/index.js";

export type PizzaChartProps = Omit<ComputePizzaChartInput, "rows" | "categoryColors"> & {
  rows: ComputePizzaChartInput["rows"];
  categoryColors?: ThemePalette;
  methodologyNotes?: ChartMethodologyNotes;
  staticMode?: boolean;
  areas?: PizzaChartAreasStyle;
  guides?: PizzaChartGuidesStyle;
  text?: PizzaChartTextStyle;
  badges?: PizzaChartBadgesStyle;
};

export type PizzaChartAreaStyleContext = {
  slice: PizzaChartSliceModel;
  theme: UITheme;
  active: boolean;
};

export type PizzaChartAreasStyle = {
  fill?: StyleValue<string, PizzaChartAreaStyleContext>;
  fillOpacity?: StyleValue<number, PizzaChartAreaStyleContext>;
  stroke?: StyleValue<string, PizzaChartAreaStyleContext>;
  strokeWidth?: StyleValue<number, PizzaChartAreaStyleContext>;
};

export type PizzaChartGuideStyleContext =
  | {
      kind: "ring";
      ring: PizzaChartGridRingModel;
      theme: UITheme;
    }
  | {
      kind: "spoke";
      spoke: PizzaChartSpokeModel;
      theme: UITheme;
    }
  | {
      kind: "reference";
      referenceSet: PizzaChartReferenceSetModel;
      theme: UITheme;
    };

export type PizzaChartGuidesStyle = {
  stroke?: StyleValue<string, PizzaChartGuideStyleContext>;
  strokeWidth?: StyleValue<number, PizzaChartGuideStyleContext>;
  strokeDasharray?: StyleValue<string, PizzaChartGuideStyleContext>;
  opacity?: StyleValue<number, PizzaChartGuideStyleContext>;
};

export type PizzaChartTextStyleContext = {
  label: PizzaChartLabelModel;
  theme: UITheme;
};

export type PizzaChartTextStyle = {
  fill?: StyleValue<string, PizzaChartTextStyleContext>;
};

export type PizzaChartBadgeStyleContext = {
  badge: PizzaChartValueBadgeModel;
  theme: UITheme;
};

export type PizzaChartBadgesStyle = {
  fill?: StyleValue<string, PizzaChartBadgeStyleContext>;
  stroke?: StyleValue<string, PizzaChartBadgeStyleContext>;
  textFill?: StyleValue<string, PizzaChartBadgeStyleContext>;
  opacity?: StyleValue<number, PizzaChartBadgeStyleContext>;
};

// ---------------------------------------------------------------------------
// Sub-components (chart-specific — not shared)
// ---------------------------------------------------------------------------

function CategoryWashes({
  washes,
  cx,
  cy,
  outerR,
  innerR,
}: {
  washes: PizzaChartCategoryWashModel[];
  cx: number;
  cy: number;
  outerR: number;
  innerR: number;
}) {
  return (
    <g data-testid="pizza-washes">
      {washes.map((wash) => (
        <path
          key={wash.category}
          d={slicePath(wash.startAngle, wash.endAngle, innerR, outerR, cx, cy)}
          fill={wash.color}
          fillOpacity={0.08}
        />
      ))}
    </g>
  );
}

function GridRings({
  rings,
  cx,
  cy,
  outerR,
  innerR,
  style,
  theme,
}: {
  rings: PizzaChartGridRingModel[];
  cx: number;
  cy: number;
  outerR: number;
  innerR: number;
  style: PizzaChartGuidesStyle | undefined;
  theme: UITheme;
}) {
  return (
    <g data-testid="pizza-grid">
      {rings.map((ring) => {
        const r = innerR + (outerR - innerR) * ring.radiusFraction;
        const context: PizzaChartGuideStyleContext = { kind: "ring", ring, theme };
        return (
          <path
            key={ring.percentile}
            d={ringPath(r, cx, cy)}
            fill="none"
            stroke={resolveStyleValue(style?.stroke, context) ?? theme.axis.grid}
            strokeWidth={resolveStyleValue(style?.strokeWidth, context) ?? 0.5}
            strokeDasharray={resolveStyleValue(style?.strokeDasharray, context) ?? "3 3"}
            {...(() => {
              const opacity = resolveStyleValue(style?.opacity, context);
              return opacity != null ? { opacity } : {};
            })()}
          />
        );
      })}
      {(() => {
        const context: PizzaChartGuideStyleContext = {
          kind: "ring",
          ring: { percentile: 0, radiusFraction: 0 },
          theme,
        };
        return (
          <circle
            cx={cx}
            cy={cy}
            r={innerR}
            fill="none"
            stroke={resolveStyleValue(style?.stroke, context) ?? theme.axis.grid}
            strokeWidth={resolveStyleValue(style?.strokeWidth, context) ?? 0.5}
            strokeDasharray={resolveStyleValue(style?.strokeDasharray, context) ?? "3 3"}
            {...(() => {
              const opacity = resolveStyleValue(style?.opacity, context);
              return opacity != null ? { opacity } : {};
            })()}
          />
        );
      })()}
    </g>
  );
}

function Spokes({
  spokes,
  theme,
  style,
}: {
  spokes: PizzaChartSpokeModel[];
  theme: UITheme;
  style: PizzaChartGuidesStyle | undefined;
}) {
  return (
    <g data-testid="pizza-spokes">
      {spokes.map((spoke, i) => {
        const context: PizzaChartGuideStyleContext = { kind: "spoke", spoke, theme };
        return (
          <line
            key={i}
            x1={roundSvg(spoke.x1)}
            y1={roundSvg(spoke.y1)}
            x2={roundSvg(spoke.x2)}
            y2={roundSvg(spoke.y2)}
            stroke={resolveStyleValue(style?.stroke, context) ?? theme.axis.grid}
            strokeWidth={resolveStyleValue(style?.strokeWidth, context) ?? 0.3}
            {...(() => {
              const opacity = resolveStyleValue(style?.opacity, context);
              return opacity != null ? { opacity } : {};
            })()}
          />
        );
      })}
    </g>
  );
}

function SliceGroup({
  slices,
  cx,
  cy,
  outerR,
  innerR,
  theme,
  areasStyle,
  hoveredIndex,
  onHover,
}: {
  slices: PizzaChartSliceModel[];
  cx: number;
  cy: number;
  outerR: number;
  innerR: number;
  theme: UITheme;
  areasStyle: PizzaChartAreasStyle | undefined;
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
}) {
  return (
    <g data-testid="pizza-slices">
      {slices.map((slice) => {
        const areaContext: PizzaChartAreaStyleContext = {
          slice,
          theme,
          active: hoveredIndex === null || hoveredIndex === slice.index,
        };
        const r = innerR + (outerR - innerR) * (slice.percentile / 100);
        const dimmed = hoveredIndex !== null && hoveredIndex !== slice.index;
        return (
          <path
            key={slice.metric}
            d={slicePath(slice.startAngle, slice.endAngle, innerR, r, cx, cy)}
            fill={resolveStyleValue(areasStyle?.fill, areaContext) ?? slice.fillColor}
            fillOpacity={
              resolveStyleValue(areasStyle?.fillOpacity, areaContext) ??
              (dimmed ? 0.3 : 0.85)
            }
            stroke={
              resolveStyleValue(areasStyle?.stroke, areaContext) ?? theme.surface.plot
            }
            strokeWidth={resolveStyleValue(areasStyle?.strokeWidth, areaContext) ?? 0.5}
            role="button"
            tabIndex={0}
            aria-label={`${slice.metric}: ${slice.displayValue}`}
            style={{ transition: "fill-opacity 0.15s" }}
            onMouseEnter={() => {
              onHover(slice.index);
            }}
            onFocus={() => {
              onHover(slice.index);
            }}
            onMouseLeave={() => {
              onHover(null);
            }}
            onBlur={() => {
              onHover(null);
            }}
            onClick={() => {
              onHover(slice.index);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onHover(slice.index);
              }
            }}
            data-testid={`pizza-slice-${slice.index}`}
          />
        );
      })}
    </g>
  );
}

const REFERENCE_DEFAULT_STROKES = ["#ffffffa0", "#ef4444a0", "#a855f7a0"];

function ReferenceArcs({
  sets,
  cx,
  cy,
  outerR,
  innerR,
  theme,
  style,
}: {
  sets: PizzaChartReferenceSetModel[];
  cx: number;
  cy: number;
  outerR: number;
  innerR: number;
  theme: UITheme;
  style: PizzaChartGuidesStyle | undefined;
}) {
  void theme; // available for future theme-aware defaults
  return (
    <g data-testid="pizza-reference-arcs">
      {sets.map((set) => (
        <g key={set.index} data-testid={`pizza-reference-set-${set.index}`}>
          {set.arcs.map((arc) => {
            const context: PizzaChartGuideStyleContext = {
              kind: "reference",
              referenceSet: set,
              theme,
            };
            const r = innerR + (outerR - innerR) * (arc.percentile / 100);
            return (
              <path
                key={arc.metric}
                d={arcSegmentPath(arc.startAngle, arc.endAngle, r, cx, cy)}
                fill="none"
                stroke={
                  resolveStyleValue(style?.stroke, context) ??
                  set.stroke ??
                  REFERENCE_DEFAULT_STROKES[set.index % REFERENCE_DEFAULT_STROKES.length]
                }
                strokeWidth={
                  resolveStyleValue(style?.strokeWidth, context) ?? set.strokeWidth ?? 1.5
                }
                strokeDasharray={
                  resolveStyleValue(style?.strokeDasharray, context) ??
                  set.strokeDasharray ??
                  undefined
                }
                strokeLinecap="round"
                {...(() => {
                  const opacity = resolveStyleValue(style?.opacity, context);
                  return opacity != null ? { opacity } : {};
                })()}
              />
            );
          })}
        </g>
      ))}
    </g>
  );
}

function Labels({
  labels,
  cx,
  cy,
  theme,
  uid,
  style,
}: {
  labels: PizzaChartLabelModel[];
  cx: number;
  cy: number;
  theme: UITheme;
  uid: string;
  style: PizzaChartTextStyle | undefined;
}) {
  const labelData = labels.map((label) => {
    const effectiveAngle = Math.max(0, label.sliceAngle - 2 * LABEL_ANGLE_PADDING);
    const arcLen = effectiveAngle * label.radius;
    const lines = wrapLabel(label.metric, arcLen);
    const halfAngle = effectiveAngle / 2;
    return { label, lines, halfAngle };
  });

  return (
    <g data-testid="pizza-labels" pointerEvents="none">
      <defs>
        {labelData.flatMap(({ label, lines, halfAngle }) =>
          lines.map((_, lineIdx) => {
            const r = label.radius + lineIdx * LABEL_LINE_HEIGHT;
            return (
              <path
                key={`lp-${label.index}-${lineIdx}`}
                id={`pla-${uid}-${label.index}-${lineIdx}`}
                d={labelArcPath(label.angle, halfAngle, r, cx, cy, label.flip)}
                fill="none"
              />
            );
          }),
        )}
      </defs>
      {labelData.flatMap(({ label, lines }) =>
        lines.map((line, lineIdx) => (
          <text
            key={`lt-${label.index}-${lineIdx}`}
            fill={resolveStyleValue(style?.fill, { label, theme }) ?? theme.axis.label}
            fontSize={LABEL_FONT_SIZE}
            fontWeight={600}
          >
            <textPath
              href={`#pla-${uid}-${label.index}-${lineIdx}`}
              startOffset="50%"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {line}
            </textPath>
          </text>
        )),
      )}
    </g>
  );
}

function ValueBadges({
  badges,
  theme,
  style,
}: {
  badges: PizzaChartValueBadgeModel[];
  theme: UITheme;
  style: PizzaChartBadgesStyle | undefined;
}) {
  const boxW = 26;
  const boxH = 14;
  return (
    <g data-testid="pizza-badges" pointerEvents="none">
      {badges.map((badge, i) => {
        const context: PizzaChartBadgeStyleContext = { badge, theme };
        return (
          <g key={`${badge.metric}-${i}`}>
            <rect
              x={roundSvg(badge.x - boxW / 2)}
              y={roundSvg(badge.y - boxH / 2)}
              width={boxW}
              height={boxH}
              rx={theme.radius.sm}
              fill={resolveStyleValue(style?.fill, context) ?? theme.surface.badge}
              stroke={resolveStyleValue(style?.stroke, context) ?? theme.border.badge}
              strokeWidth={0.5}
              {...(() => {
                const opacity = resolveStyleValue(style?.opacity, context);
                return opacity != null ? { opacity } : {};
              })()}
            />
            <text
              x={roundSvg(badge.x)}
              y={roundSvg(badge.y)}
              textAnchor="middle"
              dominantBaseline="central"
              fill={resolveStyleValue(style?.textFill, context) ?? theme.text.badge}
              fontSize={8}
              fontWeight={600}
            >
              {badge.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function CenterContent({
  model,
  cx,
  cy,
  innerR,
  theme,
  uid,
  staticMode = false,
}: {
  model: PizzaChartModel;
  cx: number;
  cy: number;
  innerR: number;
  theme: UITheme;
  uid: string;
  staticMode?: boolean;
}) {
  const content = model.centerContent;
  if (!content) return null;

  if (content.kind === "image" || content.kind === "crest") {
    if (staticMode) return null;
    if (!content.src) return null;
    const size = innerR * 2;
    const clipPathId = `pizza-center-clip-${uid.replace(/:/g, "")}`;
    return (
      <g>
        <clipPath id={clipPathId}>
          <circle cx={roundSvg(cx)} cy={roundSvg(cy)} r={roundSvg(innerR - 1)} />
        </clipPath>
        <image
          href={content.src}
          x={roundSvg(cx - size / 2)}
          y={roundSvg(cy - size / 2)}
          width={roundSvg(size)}
          height={roundSvg(size)}
          clipPath={`url(#${clipPathId})`}
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    );
  }

  if (!content.label) return null;

  return (
    <g>
      <circle
        cx={roundSvg(cx)}
        cy={roundSvg(cy)}
        r={roundSvg(innerR - 2)}
        fill={theme.surface.badge}
        stroke={theme.border.badge}
        strokeWidth={1}
      />
      <text
        x={roundSvg(cx)}
        y={roundSvg(cy)}
        textAnchor="middle"
        dominantBaseline="central"
        fill={theme.text.badge}
        fontSize={16}
        fontWeight={700}
      >
        {content.label}
      </text>
    </g>
  );
}

function buildTooltipRows(
  slice: PizzaChartSliceModel,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Metric", value: slice.metric },
    { label: "Percentile", value: slice.displayValue },
  ];
  if (slice.rawValue != null) {
    rows.push({ label: "Value", value: String(slice.rawValue) });
  }
  if (slice.category !== "Uncategorized") {
    rows.push({ label: "Category", value: slice.category });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function buildPizzaChartModel(
  {
    rows,
    metricOrder,
    categoryOrder,
    showValueBadges,
    showAxisLabels,
    showLegend,
    categoryColors,
    centerContent,
    gridRingStep,
    referenceSets,
  }: PizzaChartProps,
  theme: UITheme,
) {
  const resolvedCategoryColors = resolveThemePalette(categoryColors, theme);
  return computePizzaChart({
    rows,
    ...(metricOrder != null ? { metricOrder } : {}),
    ...(categoryOrder != null ? { categoryOrder } : {}),
    ...(showValueBadges != null ? { showValueBadges } : {}),
    ...(showAxisLabels != null ? { showAxisLabels } : {}),
    ...(showLegend != null ? { showLegend } : {}),
    ...(resolvedCategoryColors != null ? { categoryColors: resolvedCategoryColors } : {}),
    ...(centerContent !== undefined ? { centerContent } : {}),
    ...(gridRingStep != null ? { gridRingStep } : {}),
    ...(referenceSets != null ? { referenceSets } : {}),
  });
}

export function PizzaChartStaticSvg({
  theme = LIGHT_THEME,
  ...props
}: PizzaChartProps & { theme?: UITheme }) {
  const model = buildPizzaChartModel(props, theme);
  const uid = useId();
  const {
    center,
    outerRadius: outerR,
    innerRadius: innerR,
    viewBoxSize,
  } = model.geometry;
  const cx = center;
  const cy = center;

  return (
    <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} width="100%" height="100%">
      {!model.meta.empty ? (
        <>
          {model.categoryWashes.length > 0 ? (
            <CategoryWashes
              washes={model.categoryWashes}
              cx={cx}
              cy={cy}
              outerR={outerR}
              innerR={innerR}
            />
          ) : null}

          <GridRings
            rings={model.gridRings}
            cx={cx}
            cy={cy}
            outerR={outerR}
            innerR={innerR}
            style={props.guides}
            theme={theme}
          />
          <Spokes spokes={model.spokes} theme={theme} style={props.guides} />

          <SliceGroup
            slices={model.slices}
            cx={cx}
            cy={cy}
            outerR={outerR}
            innerR={innerR}
            theme={theme}
            areasStyle={props.areas}
            hoveredIndex={null}
            onHover={() => {}}
          />

          {model.referenceSets.length > 0 && (
            <ReferenceArcs
              sets={model.referenceSets}
              cx={cx}
              cy={cy}
              outerR={outerR}
              innerR={innerR}
              theme={theme}
              style={props.guides}
            />
          )}

          {model.labels.length > 0 ? (
            <Labels
              labels={model.labels}
              cx={cx}
              cy={cy}
              theme={theme}
              uid={uid}
              style={props.text}
            />
          ) : null}

          {model.valueBadges.length > 0 ? (
            <ValueBadges badges={model.valueBadges} theme={theme} style={props.badges} />
          ) : null}

          <CenterContent
            model={model}
            cx={cx}
            cy={cy}
            innerR={innerR}
            theme={theme}
            uid={uid}
            staticMode={true}
          />
        </>
      ) : (
        <ChartSvgEmptyState
          x={viewBoxSize / 2}
          y={viewBoxSize / 2}
          message={model.emptyState?.message ?? "No profile data"}
          theme={theme}
          fontWeight={600}
        />
      )}
    </svg>
  );
}

export function PizzaChart({
  rows,
  metricOrder,
  categoryOrder,
  showValueBadges,
  showAxisLabels,
  showLegend,
  categoryColors,
  centerContent,
  gridRingStep,
  referenceSets,
  areas,
  guides,
  text,
  badges,
  methodologyNotes,
  staticMode = false,
}: PizzaChartProps) {
  const theme = useTheme();
  // Note: `staticMode` is intentionally omitted from the model memo. It only
  // gates JSX-level behavior (center-image suppression, tooltip visibility),
  // not the computed model — so including it in the dep array would cause
  // unnecessary model recomputes when the caller toggles static rendering.
  const model = useMemo(
    () =>
      buildPizzaChartModel(
        {
          rows,
          ...(metricOrder != null ? { metricOrder } : {}),
          ...(categoryOrder != null ? { categoryOrder } : {}),
          ...(showValueBadges != null ? { showValueBadges } : {}),
          ...(showAxisLabels != null ? { showAxisLabels } : {}),
          ...(showLegend != null ? { showLegend } : {}),
          ...(categoryColors != null ? { categoryColors } : {}),
          ...(centerContent !== undefined ? { centerContent } : {}),
          ...(gridRingStep != null ? { gridRingStep } : {}),
          ...(referenceSets != null ? { referenceSets } : {}),
        },
        theme,
      ),
    [
      rows,
      metricOrder,
      categoryOrder,
      showValueBadges,
      showAxisLabels,
      showLegend,
      categoryColors,
      centerContent,
      gridRingStep,
      referenceSets,
      theme,
    ],
  );

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const uid = useId();

  const {
    center,
    outerRadius: outerR,
    innerRadius: innerR,
    viewBoxSize,
  } = model.geometry;
  const cx = center;
  const cy = center;

  const plot = (
    <div
      style={{ position: "relative" }}
      onMouseLeave={() => {
        setHoveredIndex(null);
      }}
    >
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
      >
        {!model.meta.empty && (
          <>
            {model.categoryWashes.length > 0 && (
              <CategoryWashes
                washes={model.categoryWashes}
                cx={cx}
                cy={cy}
                outerR={outerR}
                innerR={innerR}
              />
            )}

            <GridRings
              rings={model.gridRings}
              cx={cx}
              cy={cy}
              outerR={outerR}
              innerR={innerR}
              style={guides}
              theme={theme}
            />
            <Spokes spokes={model.spokes} theme={theme} style={guides} />

            <SliceGroup
              slices={model.slices}
              cx={cx}
              cy={cy}
              outerR={outerR}
              innerR={innerR}
              theme={theme}
              areasStyle={areas}
              hoveredIndex={hoveredIndex}
              onHover={setHoveredIndex}
            />

            {model.referenceSets.length > 0 && (
              <ReferenceArcs
                sets={model.referenceSets}
                cx={cx}
                cy={cy}
                outerR={outerR}
                innerR={innerR}
                theme={theme}
                style={guides}
              />
            )}

            {model.labels.length > 0 && (
              <Labels
                labels={model.labels}
                cx={cx}
                cy={cy}
                theme={theme}
                uid={uid}
                style={text}
              />
            )}

            {model.valueBadges.length > 0 && (
              <ValueBadges badges={model.valueBadges} theme={theme} style={badges} />
            )}

            <CenterContent
              model={model}
              cx={cx}
              cy={cy}
              innerR={innerR}
              theme={theme}
              uid={uid}
              staticMode={staticMode}
            />
          </>
        )}
      </svg>

      {model.emptyState && (
        <EmptyState message={model.emptyState.message} theme={theme} />
      )}

      {!staticMode && hoveredIndex !== null && model.slices[hoveredIndex] != null && (
        <ChartTooltip
          testId="pizza-tooltip"
          theme={theme}
          rows={buildTooltipRows(model.slices[hoveredIndex])}
        />
      )}
    </div>
  );

  const legend = model.legend ? (
    <ChartLegend testId="pizza-legend" items={model.legend.items} theme={theme} />
  ) : null;

  return (
    <ChartFrame
      ariaLabel={model.meta.accessibleLabel}
      chartKind="pizza-chart"
      empty={model.emptyState != null}
      maxWidth={640}
      plot={plot}
      legend={legend}
      methodologyNotes={methodologyNotes}
      staticMode={staticMode}
      theme={theme}
      warnings={model.meta.warnings}
    />
  );
}
