/**
 * Domain-facing helper factories for LineChart reference layers.
 *
 * Every `extra` parameter is typed with `Omit<>` so callers cannot override
 * the fields each helper computes.
 */

import type { LineChartEnvelope } from "./compute/envelope.js";
import type { LineChartSeriesInput } from "./compute/line-chart.js";
import type { PlotAreaReferenceLine } from "./primitives/ChartPlotAreaReferenceLines.js";

/**
 * Style knobs for {@link eventRef}. Callers typically reach for one of the
 * exported presets (`EVENT_REF_SUBTLE`, `EVENT_REF_ACCENT`) or pass their own.
 */
export type EventRefStyle = {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
};

/** Options bag for {@link eventRef}. Label + style knobs, all optional. */
export type EventRefOptions = EventRefStyle & {
  label?: string;
};

/**
 * Vertical reference line marking a point-in-time event — a managerial change,
 * new ownership, signing, injury, rule change, or any narrative beat that
 * deserves a guide. Default style is a mid-blue stroke at 1.25px; the primitive's
 * own default dash pattern ("4 3") applies when `strokeDasharray` is not
 * supplied. Pick a preset or pass your own `stroke` / `strokeWidth` /
 * `strokeDasharray` to restyle.
 */
export function eventRef(x: number, opts?: EventRefOptions): PlotAreaReferenceLine {
  const { label, stroke = "#3f7cc4", strokeWidth = 1.25, strokeDasharray } = opts ?? {};
  return {
    kind: "vertical",
    x,
    ...(label != null ? { label } : {}),
    stroke,
    strokeWidth,
    ...(strokeDasharray != null ? { strokeDasharray } : {}),
  };
}

/** Subtle dashed grey — season boundaries, quiet context lines. */
export const EVENT_REF_SUBTLE: EventRefStyle = {
  stroke: "#9ca3af",
  strokeWidth: 1,
  strokeDasharray: "4 3",
};

/** Bold accent red — reserve for the primary narrative beat. */
export const EVENT_REF_ACCENT: EventRefStyle = {
  stroke: "#c8102e",
  strokeWidth: 1.5,
};

/**
 * Diagonal reference line from a linear equation `y = slope * x + intercept`,
 * evaluated across `xDomain`. `extra` cannot redefine `kind`, `from`, or `to`.
 */
export function diagonalFromLinear(
  slope: number,
  intercept: number,
  xDomain: readonly [number, number],
  extra?: Omit<
    Extract<PlotAreaReferenceLine, { kind: "diagonal" }>,
    "kind" | "from" | "to"
  >,
): PlotAreaReferenceLine {
  return {
    kind: "diagonal",
    from: [xDomain[0], slope * xDomain[0] + intercept],
    to: [xDomain[1], slope * xDomain[1] + intercept],
    ...extra,
  };
}

/**
 * Centre-offset envelope built from sigma / offset arrays aligned to a series.
 * `extra` cannot redefine `kind`, `centerSeriesId`, or `bounds`.
 */
export function envelopeCenterOffset(
  centerSeriesId: string,
  centerPoints: readonly { x: number; y: number }[],
  offsetUpper: readonly number[],
  offsetLower: readonly number[],
  extra?: Omit<
    Extract<LineChartEnvelope, { kind: "center-offset" }>,
    "kind" | "centerSeriesId" | "bounds"
  >,
): LineChartEnvelope {
  const bounds = centerPoints.map((pt, i) => ({
    x: pt.x,
    upper: pt.y + (offsetUpper[i] ?? 0),
    lower: pt.y + (offsetLower[i] ?? 0),
  }));
  return {
    kind: "center-offset",
    centerSeriesId,
    bounds,
    ...extra,
  };
}

/** 2-point hidden series that can be used as a straight-line envelope bound. */
export function diagonalSeries(
  id: string,
  from: readonly [number, number],
  to: readonly [number, number],
  extra?: Omit<LineChartSeriesInput, "id" | "points" | "hidden">,
): LineChartSeriesInput {
  return {
    id,
    points: [
      { x: from[0], y: from[1] },
      { x: to[0], y: to[1] },
    ],
    hidden: true,
    ...extra,
  };
}
