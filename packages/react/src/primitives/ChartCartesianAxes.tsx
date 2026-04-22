import type { ReactNode } from "react";

import type { UITheme } from "../theme.js";

export type CartesianAxisSpec = {
  label: string;
  domain: [number, number];
  ticks: number[];
  inverted?: boolean;
};

type PlotArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function scaleTick(
  tick: number,
  domain: [number, number],
  rangeStart: number,
  rangeSize: number,
  inverted = false,
) {
  const span = domain[1] - domain[0];
  if (span === 0) {
    return rangeStart + rangeSize / 2;
  }

  const t = (tick - domain[0]) / span;
  return inverted ? rangeStart + rangeSize - t * rangeSize : rangeStart + t * rangeSize;
}

export function ChartCartesianAxes({
  plotArea,
  frame,
  xAxis,
  yAxis,
  theme,
  testId,
  showXGrid = false,
  showYGrid = false,
  xGridDasharray,
  yGridDasharray,
  xLabelOffset = 34,
  yLabelX = 12,
  tickFontSize = 10,
  axisLabelFontSize = 11,
  formatTick = (tick) => tick,
}: {
  plotArea: PlotArea;
  /**
   * Optional outer frame rect, used when the caller has inset `plotArea`
   * from a wider visible frame (e.g. for axis-padding). When provided, the
   * axis lines and tick extensions render at the frame edges while tick
   * *positions* stay on the `plotArea` scale. Falls back to `plotArea` when
   * omitted — today's behaviour.
   */
  frame?: PlotArea;
  xAxis: CartesianAxisSpec;
  yAxis: CartesianAxisSpec;
  theme: UITheme;
  testId?: string;
  showXGrid?: boolean;
  showYGrid?: boolean;
  xGridDasharray?: string;
  yGridDasharray?: string;
  xLabelOffset?: number;
  yLabelX?: number;
  tickFontSize?: number;
  axisLabelFontSize?: number;
  formatTick?: (tick: number, axis: "x" | "y") => ReactNode;
}) {
  const axisRect = frame ?? plotArea;
  const xTickPos = (tick: number) =>
    scaleTick(tick, xAxis.domain, plotArea.x, plotArea.width, xAxis.inverted);
  const yTickPos = (tick: number) =>
    scaleTick(tick, yAxis.domain, plotArea.y, plotArea.height, !yAxis.inverted);

  return (
    <g {...(testId ? { "data-testid": testId } : {})}>
      {showXGrid
        ? xAxis.ticks.map((tick, i) => (
            <line
              key={`xgrid-${i}`}
              x1={xTickPos(tick)}
              y1={plotArea.y}
              x2={xTickPos(tick)}
              y2={plotArea.y + plotArea.height}
              stroke={theme.axis.grid}
              strokeWidth={0.5}
              strokeDasharray={xGridDasharray}
            />
          ))
        : null}

      {showYGrid
        ? yAxis.ticks.map((tick, i) => (
            <line
              key={`ygrid-${i}`}
              x1={plotArea.x}
              y1={yTickPos(tick)}
              x2={plotArea.x + plotArea.width}
              y2={yTickPos(tick)}
              stroke={theme.axis.grid}
              strokeWidth={0.5}
              strokeDasharray={yGridDasharray}
            />
          ))
        : null}

      <line
        x1={axisRect.x}
        y1={axisRect.y + axisRect.height}
        x2={axisRect.x + axisRect.width}
        y2={axisRect.y + axisRect.height}
        stroke={theme.axis.line}
        strokeWidth={1}
      />
      <line
        x1={axisRect.x}
        y1={axisRect.y}
        x2={axisRect.x}
        y2={axisRect.y + axisRect.height}
        stroke={theme.axis.line}
        strokeWidth={1}
      />

      {xAxis.ticks.map((tick, i) => (
        <g key={`xtick-${i}`}>
          <line
            x1={xTickPos(tick)}
            y1={axisRect.y + axisRect.height}
            x2={xTickPos(tick)}
            y2={axisRect.y + axisRect.height + 5}
            stroke={theme.axis.line}
            strokeWidth={1}
          />
          <text
            x={xTickPos(tick)}
            y={axisRect.y + axisRect.height + 16}
            textAnchor="middle"
            fill={theme.text.muted}
            fontSize={tickFontSize}
          >
            {formatTick(tick, "x")}
          </text>
        </g>
      ))}

      <text
        x={axisRect.x + axisRect.width / 2}
        y={axisRect.y + axisRect.height + xLabelOffset}
        textAnchor="middle"
        fill={theme.text.secondary}
        fontSize={axisLabelFontSize}
        fontWeight={600}
      >
        {xAxis.label}
      </text>

      {yAxis.ticks.map((tick, i) => (
        <g key={`ytick-${i}`}>
          <line
            x1={axisRect.x - 5}
            y1={yTickPos(tick)}
            x2={axisRect.x}
            y2={yTickPos(tick)}
            stroke={theme.axis.line}
            strokeWidth={1}
          />
          <text
            x={axisRect.x - 8}
            y={yTickPos(tick) + 3.5}
            textAnchor="end"
            fill={theme.text.muted}
            fontSize={tickFontSize}
          >
            {formatTick(tick, "y")}
          </text>
        </g>
      ))}

      <text
        x={yLabelX}
        y={axisRect.y + axisRect.height / 2}
        textAnchor="middle"
        fill={theme.text.secondary}
        fontSize={axisLabelFontSize}
        fontWeight={600}
        transform={`rotate(-90, ${yLabelX}, ${axisRect.y + axisRect.height / 2})`}
      >
        {yAxis.label}
      </text>
    </g>
  );
}
