import { clipSegment } from "../compute/liangBarsky.js";
import { createLinearScale } from "../compute/scales/index.js";
import { resolveStyleValue, type StyleValue } from "../styleValue.js";
import type { UITheme } from "../theme.js";

/**
 * Declarative reference line drawn on a chart's plot area.
 *
 * - `horizontal` — constant y spanning the full plot width.
 * - `vertical` — constant x spanning the full plot height.
 * - `diagonal` — line segment between two data-space points, clipped to the
 *   plot area via Liang-Barsky segment clipping.
 */
export type PlotAreaReferenceLine =
  | {
      kind: "horizontal";
      y: number;
      label?: string;
      labelAnchor?: "start" | "middle" | "end";
      id?: string;
      stroke?: string;
      strokeWidth?: number;
      strokeDasharray?: string;
      opacity?: number;
    }
  | {
      kind: "vertical";
      x: number;
      label?: string;
      labelAnchor?: "start" | "middle" | "end";
      id?: string;
      stroke?: string;
      strokeWidth?: number;
      strokeDasharray?: string;
      opacity?: number;
    }
  | {
      kind: "diagonal";
      from: readonly [number, number];
      to: readonly [number, number];
      label?: string;
      labelAnchor?: "start" | "middle" | "end";
      id?: string;
      stroke?: string;
      strokeWidth?: number;
      strokeDasharray?: string;
      opacity?: number;
    };

export type PlotAreaReferenceLineModel = {
  id: string | null;
  kind: "horizontal" | "vertical" | "diagonal";
  label: string | null;
  labelAnchor: "start" | "middle" | "end";
  /** SVG endpoints in plot-area coordinates. */
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Default stroke fields come from theme; overrides win. */
  stroke: string | null;
  strokeWidth: number | null;
  strokeDasharray: string | null;
  opacity: number | null;
  index: number;
};

export type PlotAreaReferenceLinesStyleContext = {
  line: PlotAreaReferenceLineModel;
  theme: UITheme;
};

export type PlotAreaReferenceLinesStyle = {
  show?: StyleValue<boolean, PlotAreaReferenceLinesStyleContext>;
  stroke?: StyleValue<string, PlotAreaReferenceLinesStyleContext>;
  strokeWidth?: StyleValue<number, PlotAreaReferenceLinesStyleContext>;
  strokeDasharray?: StyleValue<string, PlotAreaReferenceLinesStyleContext>;
  opacity?: StyleValue<number, PlotAreaReferenceLinesStyleContext>;
  labelColor?: StyleValue<string, PlotAreaReferenceLinesStyleContext>;
  labelFontSize?: StyleValue<number, PlotAreaReferenceLinesStyleContext>;
};

export type ChartPlotAreaReferenceLinesProps = {
  plotArea: { x: number; y: number; width: number; height: number };
  xDomain: readonly [number, number];
  yDomain: readonly [number, number];
  lines: readonly PlotAreaReferenceLine[];
  theme: UITheme;
  style?: PlotAreaReferenceLinesStyle;
  /**
   * `"body"` renders only lines (no labels). `"labels"` renders only labels.
   * `"both"` (default) renders both. LineChart uses `"body"` under series and
   * `"labels"` above series for legibility.
   */
  layer?: "body" | "labels" | "both";
  onWarn?: (message: string) => void;
  testId?: string;
};

const DEFAULT_STROKE_WIDTH = 1;
const DEFAULT_DASHARRAY = "4 3";
const DEFAULT_OPACITY = 0.7;
const LABEL_OFFSET = 6;

export function ChartPlotAreaReferenceLines({
  plotArea,
  xDomain,
  yDomain,
  lines,
  theme,
  style,
  layer = "both",
  onWarn,
  testId = "plot-references",
}: ChartPlotAreaReferenceLinesProps) {
  if (lines.length === 0) return null;

  const xScale = createLinearScale(
    [xDomain[0], xDomain[1]],
    [plotArea.x, plotArea.x + plotArea.width],
  );
  const yScale = createLinearScale(
    [yDomain[0], yDomain[1]],
    [plotArea.y + plotArea.height, plotArea.y],
  );
  const clipRect = {
    x: plotArea.x,
    y: plotArea.y,
    width: plotArea.width,
    height: plotArea.height,
  };

  const resolved: PlotAreaReferenceLineModel[] = [];

  lines.forEach((input, index) => {
    const id = input.id ?? null;
    const idLabel = id ?? `#${index}`;
    const label = input.label ?? null;
    const labelAnchor = input.labelAnchor ?? null;

    if (input.kind === "horizontal") {
      if (!Number.isFinite(input.y)) {
        onWarn?.(
          `[reference.degenerate] reference horizontal "${idLabel}": non-finite y`,
        );
        return;
      }
      const [ymin, ymax] = [
        Math.min(yDomain[0], yDomain[1]),
        Math.max(yDomain[0], yDomain[1]),
      ];
      if (input.y < ymin || input.y > ymax) {
        onWarn?.(
          `[reference.out-of-domain] reference horizontal "${idLabel}": y=${input.y} outside visible domain`,
        );
        return;
      }
      const py = yScale(input.y);
      resolved.push({
        id,
        kind: "horizontal",
        label,
        labelAnchor: labelAnchor ?? "end",
        from: { x: plotArea.x, y: py },
        to: { x: plotArea.x + plotArea.width, y: py },
        stroke: input.stroke ?? null,
        strokeWidth: input.strokeWidth ?? null,
        strokeDasharray: input.strokeDasharray ?? null,
        opacity: input.opacity ?? null,
        index,
      });
      return;
    }

    if (input.kind === "vertical") {
      if (!Number.isFinite(input.x)) {
        onWarn?.(`[reference.degenerate] reference vertical "${idLabel}": non-finite x`);
        return;
      }
      const [xmin, xmax] = [
        Math.min(xDomain[0], xDomain[1]),
        Math.max(xDomain[0], xDomain[1]),
      ];
      if (input.x < xmin || input.x > xmax) {
        onWarn?.(
          `[reference.out-of-domain] reference vertical "${idLabel}": x=${input.x} outside visible domain`,
        );
        return;
      }
      const px = xScale(input.x);
      resolved.push({
        id,
        kind: "vertical",
        label,
        labelAnchor: labelAnchor ?? "middle",
        from: { x: px, y: plotArea.y },
        to: { x: px, y: plotArea.y + plotArea.height },
        stroke: input.stroke ?? null,
        strokeWidth: input.strokeWidth ?? null,
        strokeDasharray: input.strokeDasharray ?? null,
        opacity: input.opacity ?? null,
        index,
      });
      return;
    }

    // diagonal
    const fx = input.from[0];
    const fy = input.from[1];
    const tx = input.to[0];
    const ty = input.to[1];
    if (
      !Number.isFinite(fx) ||
      !Number.isFinite(fy) ||
      !Number.isFinite(tx) ||
      !Number.isFinite(ty) ||
      (fx === tx && fy === ty)
    ) {
      onWarn?.(
        `[reference.degenerate] reference diagonal "${idLabel}": degenerate definition`,
      );
      return;
    }
    const p0 = { x: xScale(fx), y: yScale(fy) };
    const p1 = { x: xScale(tx), y: yScale(ty) };
    const clipped = clipSegment(p0, p1, clipRect);
    if (clipped == null) {
      onWarn?.(
        `[reference.no-plot-intersection] reference diagonal "${idLabel}": no intersection with plot area`,
      );
      return;
    }
    resolved.push({
      id,
      kind: "diagonal",
      label,
      labelAnchor: labelAnchor ?? "end",
      from: clipped[0],
      to: clipped[1],
      stroke: input.stroke ?? null,
      strokeWidth: input.strokeWidth ?? null,
      strokeDasharray: input.strokeDasharray ?? null,
      opacity: input.opacity ?? null,
      index,
    });
  });

  if (resolved.length === 0) return null;

  return (
    <g data-testid={testId}>
      {resolved.map((model) => {
        const context: PlotAreaReferenceLinesStyleContext = { line: model, theme };
        if (resolveStyleValue(style?.show, context) === false) return null;

        const stroke =
          model.stroke ?? resolveStyleValue(style?.stroke, context) ?? theme.axis.line;
        const strokeWidth =
          model.strokeWidth ??
          resolveStyleValue(style?.strokeWidth, context) ??
          DEFAULT_STROKE_WIDTH;
        const strokeDasharray =
          model.strokeDasharray ??
          resolveStyleValue(style?.strokeDasharray, context) ??
          DEFAULT_DASHARRAY;
        const opacity =
          model.opacity ?? resolveStyleValue(style?.opacity, context) ?? DEFAULT_OPACITY;
        const labelColor =
          resolveStyleValue(style?.labelColor, context) ?? theme.text.secondary;
        const labelFontSize = resolveStyleValue(style?.labelFontSize, context) ?? 10;

        const key = model.id ?? `ref-${model.index}`;
        const labelPosition = model.label != null ? computeLabelPosition(model) : null;

        return (
          <g key={key} data-ref-id={model.id ?? undefined}>
            {layer !== "labels" ? (
              <line
                x1={model.from.x}
                y1={model.from.y}
                x2={model.to.x}
                y2={model.to.y}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                opacity={opacity}
                data-testid={model.id ? `plot-reference-${model.id}` : undefined}
              >
                {model.label != null ? <title>{model.label}</title> : null}
              </line>
            ) : null}
            {layer !== "body" && model.label != null && labelPosition != null ? (
              <text
                x={labelPosition.x}
                y={labelPosition.y}
                textAnchor={labelPosition.textAnchor}
                dominantBaseline={labelPosition.dominantBaseline}
                fill={labelColor}
                fontSize={labelFontSize}
                fontWeight={600}
                aria-label={model.label}
                data-testid={model.id ? `plot-reference-label-${model.id}` : undefined}
              >
                {model.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

type LabelPosition = {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
  dominantBaseline: "hanging" | "alphabetic" | "middle";
};

function computeLabelPosition(model: PlotAreaReferenceLineModel): LabelPosition {
  const { kind, from, to, labelAnchor } = model;
  if (kind === "horizontal") {
    // Label right-end by default, centred vertically on the line with small offset above
    if (labelAnchor === "start") {
      return {
        x: from.x + LABEL_OFFSET,
        y: from.y - LABEL_OFFSET,
        textAnchor: "start",
        dominantBaseline: "alphabetic",
      };
    }
    if (labelAnchor === "middle") {
      return {
        x: (from.x + to.x) / 2,
        y: from.y - LABEL_OFFSET,
        textAnchor: "middle",
        dominantBaseline: "alphabetic",
      };
    }
    return {
      x: to.x - LABEL_OFFSET,
      y: to.y - LABEL_OFFSET,
      textAnchor: "end",
      dominantBaseline: "alphabetic",
    };
  }
  if (kind === "vertical") {
    // Label top-centre by default
    if (labelAnchor === "start") {
      return {
        x: from.x + LABEL_OFFSET,
        y: from.y + LABEL_OFFSET,
        textAnchor: "start",
        dominantBaseline: "hanging",
      };
    }
    if (labelAnchor === "end") {
      return {
        x: from.x + LABEL_OFFSET,
        y: to.y - LABEL_OFFSET,
        textAnchor: "start",
        dominantBaseline: "alphabetic",
      };
    }
    return {
      x: from.x + LABEL_OFFSET,
      y: from.y + LABEL_OFFSET,
      textAnchor: "start",
      dominantBaseline: "hanging",
    };
  }
  // diagonal — at `to` endpoint by default
  if (labelAnchor === "start") {
    return {
      x: from.x + LABEL_OFFSET,
      y: from.y - LABEL_OFFSET,
      textAnchor: "start",
      dominantBaseline: "alphabetic",
    };
  }
  if (labelAnchor === "middle") {
    return {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 - LABEL_OFFSET,
      textAnchor: "middle",
      dominantBaseline: "alphabetic",
    };
  }
  return {
    x: to.x - LABEL_OFFSET,
    y: to.y - LABEL_OFFSET,
    textAnchor: "end",
    dominantBaseline: "alphabetic",
  };
}
