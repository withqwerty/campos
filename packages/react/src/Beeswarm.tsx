import { useMemo, type CSSProperties, type ReactNode } from "react";

import {
  computeBeeswarm,
  type BeeswarmDotModel,
  type BeeswarmHighlightModel,
  type BeeswarmModel,
  type ComputeBeeswarmInput,
} from "./compute/index.js";
import { useTheme } from "./ThemeContext.js";
import { useCursorTooltip } from "./primitives/CursorTooltip.js";

export type BeeswarmProps = ComputeBeeswarmInput & {
  /** Outer wrapper style. */
  style?: CSSProperties;
  className?: string;
  /** Cap the rendered width in CSS pixels. Default: viewBox width. */
  maxWidth?: number;
  /**
   * Custom tooltip renderer. Receives the dot (population or highlight) that
   * the cursor is over. Default renders the player label + formatted value.
   */
  renderTooltip?: (dot: {
    id: string;
    value: number;
    label: string | null;
    category: string | null;
    isHighlight: boolean;
  }) => ReactNode;
  /** Optional axis label font size. Default 10. */
  tickFontSize?: number;
  /** Optional group label font size. Default 10. */
  groupLabelFontSize?: number;
  /** Background colour behind the plot. Default transparent. */
  background?: string;
  /**
   * Opacity applied to population dots. Lower values let dense clusters
   * accumulate into visibly darker zones — the whole point of a beeswarm.
   * Default 0.55. Highlights are always rendered at 1.
   */
  populationOpacity?: number;
};

export function Beeswarm(props: BeeswarmProps): ReactNode {
  const {
    style,
    className,
    maxWidth,
    renderTooltip,
    tickFontSize = 10,
    groupLabelFontSize = 10,
    background,
    populationOpacity = 0.55,
    ...computeInput
  } = props;

  // Memoise on the spread inputs individually so identity of the inline
  // rest object doesn't invalidate every render (would trigger the O(n²)
  // packer on every cursor move).
  const model = useMemo(
    () => computeBeeswarm({ ...computeInput, labelFontSize: tickFontSize }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      computeInput.groups,
      computeInput.metric,
      computeInput.orientation,
      computeInput.populationColor,
      computeInput.highlightDefaults,
      computeInput.labelStrategy,
      computeInput.sizeField,
      computeInput.referenceLines,
      computeInput.dotRadius,
      computeInput.dotPadding,
      computeInput.packing,
      computeInput.highlightPlacement,
      computeInput.showGridlines,
      computeInput.layout,
      computeInput.emptyMessage,
      tickFontSize,
    ],
  );
  const theme = useTheme();

  const { containerRef, show, hide, element: tooltipElement } = useCursorTooltip(theme);

  const renderDot = (dot: BeeswarmDotModel, opts: { isHighlight?: boolean }) => {
    const tooltipHandler = (e: React.MouseEvent) => {
      const content = renderTooltip
        ? renderTooltip({
            id: dot.id,
            value: dot.value,
            label: dot.label,
            category: dot.category,
            isHighlight: Boolean(opts.isHighlight),
          })
        : defaultTooltip(dot);
      show(e, content);
    };
    const titleText = dot.label
      ? `${dot.label} — ${formatValue(dot.value)}`
      : formatValue(dot.value);
    return (
      <circle
        key={dot.id}
        cx={dot.cx}
        cy={dot.cy}
        r={dot.r}
        fill={dot.fill}
        fillOpacity={populationOpacity}
        onMouseEnter={tooltipHandler}
        onMouseLeave={hide}
      >
        <title>{titleText}</title>
      </circle>
    );
  };

  const renderHighlight = (h: BeeswarmHighlightModel) => {
    const tooltipHandler = (e: React.MouseEvent) => {
      const content = renderTooltip
        ? renderTooltip({
            id: h.id,
            value: h.value,
            label: h.label?.text ?? null,
            category: null,
            isHighlight: true,
          })
        : defaultTooltip({ ...h, label: h.label?.text ?? null, category: null });
      show(e, content);
    };
    return (
      <g key={h.id} pointerEvents="visiblePainted">
        {h.callout && (
          <line
            x1={h.callout.x1}
            y1={h.callout.y1}
            x2={h.callout.x2}
            y2={h.callout.y2}
            stroke={h.fill}
            strokeWidth={0.8}
            opacity={0.6}
          />
        )}
        <circle
          cx={h.cx}
          cy={h.cy}
          r={h.r}
          fill={h.fill}
          stroke={h.stroke ?? undefined}
          strokeWidth={h.strokeWidth}
          // Subtle ambient shadow lifts the highlight off the population cloud
          // without making the chart feel ornamental.
          style={{ filter: "drop-shadow(0 1px 1.5px rgba(15, 23, 42, 0.22))" }}
          onMouseEnter={tooltipHandler}
          onMouseLeave={hide}
        >
          <title>{`${h.label?.text ?? ""} — ${h.valueLabel}`.trim()}</title>
        </circle>
        {h.label && (
          <text
            x={h.label.x}
            y={h.label.y}
            textAnchor={h.label.anchor}
            fontSize={tickFontSize}
            fill="currentColor"
            style={{ fontWeight: 600, pointerEvents: "none" }}
          >
            {h.label.text}
          </text>
        )}
      </g>
    );
  };

  const width = model.layout.viewBox.width;
  const height = model.layout.viewBox.height;
  const widthStyle = maxWidth != null ? { width: "100%", maxWidth } : { width: "100%" };

  return (
    <div
      ref={containerRef}
      className={className}
      data-slot="frame"
      data-chart-kind="beeswarm"
      data-empty={model.meta.empty ? "true" : "false"}
      style={{ position: "relative", ...widthStyle, ...style }}
    >
      <svg
        data-slot="plot"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={model.meta.accessibleLabel}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          background,
          // Pick up a refined native UI stack + tabular numerics. Every numeric
          // tick and value label in the chart now lines up perfectly.
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontFeatureSettings: '"tnum" 1, "ss01" 1',
        }}
        onMouseLeave={hide}
      >
        {/* Gridlines — faint guide strokes at each tick. */}
        {model.gridlines.map((g, i) => (
          <line
            key={`grid-${i}`}
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth={0.5}
          />
        ))}

        {/* Axis line + ticks */}
        <line
          x1={model.axis.line.x1}
          y1={model.axis.line.y1}
          x2={model.axis.line.x2}
          y2={model.axis.line.y2}
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={0.6}
        />
        {model.axis.ticks.map((tick) => {
          const isHorizontal = model.layout.orientation === "horizontal";
          const x = isHorizontal ? tick.position : model.axis.line.x1;
          const y = isHorizontal ? model.axis.line.y1 : tick.position;
          return (
            <g key={`tick-${tick.value}`}>
              <text
                x={isHorizontal ? x : x - 6}
                y={isHorizontal ? y + 14 : y + 3}
                textAnchor={isHorizontal ? "middle" : "end"}
                fontSize={tickFontSize}
                fill="currentColor"
                opacity={0.55}
                style={{ fontWeight: 400 }}
              >
                {tick.label}
              </text>
            </g>
          );
        })}

        {/* Reference lines */}
        {model.referenceLines.map((ref, i) => (
          <g key={`ref-${i}`}>
            <line
              x1={ref.x1}
              y1={ref.y1}
              x2={ref.x2}
              y2={ref.y2}
              stroke={ref.color}
              strokeDasharray={ref.dash ?? undefined}
              strokeWidth={1}
              opacity={0.75}
            />
            {ref.label && (
              <text
                x={model.layout.orientation === "horizontal" ? ref.x1 + 4 : ref.x2 + 4}
                y={model.layout.orientation === "horizontal" ? ref.y1 + 10 : ref.y1 - 4}
                fontSize={tickFontSize}
                fill={ref.color}
                opacity={0.9}
              >
                {ref.label}
              </text>
            )}
          </g>
        ))}

        {/* Groups */}
        {model.groups.map((group) => (
          <g key={group.id}>
            {/* Population dots — rendered first so highlights sit on top */}
            {group.dots.map((d) => renderDot(d, {}))}
            {/* Highlights */}
            {group.highlights.map((h) => renderHighlight(h))}
            {/* Group label — small-caps / tracked treatment so it reads as a
                section label rather than a bold caption. */}
            <text
              x={group.labelAnchor.x}
              y={group.labelAnchor.y}
              textAnchor={group.labelAnchor.textAnchor}
              fontSize={groupLabelFontSize}
              fill="currentColor"
              style={{
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                pointerEvents: "none",
              }}
            >
              {group.label}
            </text>
            {group.subLabel && group.subLabelAnchor && (
              <text
                x={group.subLabelAnchor.x}
                y={group.subLabelAnchor.y}
                textAnchor={group.subLabelAnchor.textAnchor}
                fontSize={tickFontSize - 1}
                fill="currentColor"
                opacity={0.5}
                style={{ pointerEvents: "none", fontWeight: 400 }}
              >
                {group.subLabel}
              </text>
            )}
          </g>
        ))}

        {/* Axis label */}
        <text
          x={model.axis.labelAnchor.x}
          y={model.axis.labelAnchor.y}
          textAnchor="middle"
          transform={
            model.layout.orientation === "vertical"
              ? `rotate(-90, ${model.axis.labelAnchor.x}, ${model.axis.labelAnchor.y})`
              : undefined
          }
          fontSize={tickFontSize}
          fill="currentColor"
          opacity={0.55}
          style={{
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          {model.axis.label}
        </text>

        {/* Legend */}
        {model.legend && renderLegend(model, tickFontSize)}

        {/* Empty state */}
        {model.emptyState && (
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fontSize={12}
            fill="currentColor"
            opacity={0.6}
          >
            {model.emptyState.message}
          </text>
        )}
      </svg>
      {tooltipElement}
    </div>
  );
}

function defaultTooltip(dot: {
  label: string | null;
  value: number;
  category: string | null;
}) {
  const { label, value, category } = dot;
  return (
    <span>
      {label && <strong>{label}</strong>}
      {label && <br />}
      <span>{formatValue(value)}</span>
      {category && <span style={{ opacity: 0.7 }}> · {category}</span>}
    </span>
  );
}

function formatValue(v: number): string {
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

function renderLegend(model: BeeswarmModel, fontSize: number) {
  if (!model.legend) return null;
  const startX = 16;
  const y = model.layout.viewBox.height - 8;
  const gap = 92;
  return (
    <g pointerEvents="none">
      {model.legend.items.map((item, i) => (
        <g key={item.id} transform={`translate(${startX + i * gap}, ${y})`}>
          <circle
            cx={0}
            cy={0}
            r={item.kind === "size" ? (item.radius ?? 3) : 3.5}
            fill={item.color ?? "currentColor"}
          />
          <text
            x={10}
            y={3}
            fontSize={fontSize - 1}
            fill="currentColor"
            opacity={0.65}
            style={{ fontWeight: 500, letterSpacing: "0.04em" }}
          >
            {item.label}
          </text>
        </g>
      ))}
    </g>
  );
}
