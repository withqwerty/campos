import { createLinearScale } from "../compute/scales/index.js";
import { resolveStyleValue, type StyleValue } from "../styleValue.js";
import type { UITheme } from "../theme.js";

/**
 * Declarative axis-aligned band (shaded rectangle) over data space.
 *
 * - `axis: "x"` shades a vertical column covering the full plot height.
 * - `axis: "y"` shades a horizontal strip covering the full plot width.
 *
 * `range` is data-space and order-insensitive: `[a, b]` and `[b, a]` both
 * render the same rectangle.
 */
export type PlotAreaBand = {
  axis: "x" | "y";
  /** Data-space bounds. Order-insensitive — normalised to `[min, max]` internally. */
  range: readonly [number, number];
  id?: string;
  label?: string;
  /**
   * Used when multiple inside-placed labels collide. Higher priority wins;
   * ties broken by input order. Default 0.
   */
  labelPriority?: number;
  fill?: string;
  opacity?: number;
  /**
   * `"inside"` is the default for bands whose on-axis extent is ≥24px.
   * Narrower bands auto-flip to `"above"`. Consumers can force either.
   */
  labelPlacement?: "inside" | "above" | "below";
};

/** Resolved SVG-space band model passed to style callbacks. */
export type PlotAreaBandModel = {
  id: string | null;
  axis: "x" | "y";
  /** Normalised data-space range `[min, max]`. */
  range: readonly [number, number];
  label: string | null;
  labelPriority: number;
  resolvedLabelPlacement: "inside" | "above" | "below";
  /** SVG rect in plot-area coordinates. */
  rect: { x: number; y: number; width: number; height: number };
  /** Whether the inside label was suppressed by collision resolution. */
  labelSuppressed: boolean;
  /** Input-order index, for downstream keying. */
  index: number;
};

export type PlotAreaBandsStyleContext = {
  band: PlotAreaBandModel;
  theme: UITheme;
};

export type PlotAreaBandsStyle = {
  show?: StyleValue<boolean, PlotAreaBandsStyleContext>;
  fill?: StyleValue<string, PlotAreaBandsStyleContext>;
  opacity?: StyleValue<number, PlotAreaBandsStyleContext>;
  labelColor?: StyleValue<string, PlotAreaBandsStyleContext>;
  labelFontSize?: StyleValue<number, PlotAreaBandsStyleContext>;
};

export type ChartPlotAreaBandsProps = {
  plotArea: { x: number; y: number; width: number; height: number };
  xDomain: readonly [number, number];
  yDomain: readonly [number, number];
  bands: readonly PlotAreaBand[];
  theme: UITheme;
  style?: PlotAreaBandsStyle;
  /** Warnings sink. When provided, the primitive pushes `[band.*]` codes. */
  onWarn?: (message: string) => void;
  testId?: string;
};

const NARROW_ON_AXIS_PX = 24;
const LABEL_OVERLAP_PX = 4;
const DEFAULT_FILL_OPACITY = 0.15;
const INSIDE_LABEL_PADDING = 6;
const OUTSIDE_LABEL_OFFSET = 10;

export function ChartPlotAreaBands({
  plotArea,
  xDomain,
  yDomain,
  bands,
  theme,
  style,
  onWarn,
  testId = "plot-bands",
}: ChartPlotAreaBandsProps) {
  if (bands.length === 0) return null;

  const xScale = createLinearScale(
    [xDomain[0], xDomain[1]],
    [plotArea.x, plotArea.x + plotArea.width],
  );
  const yScale = createLinearScale(
    [yDomain[0], yDomain[1]],
    [plotArea.y + plotArea.height, plotArea.y],
  );

  type Resolved = {
    input: PlotAreaBand;
    model: PlotAreaBandModel;
  };

  const resolved: Resolved[] = [];

  bands.forEach((input, index) => {
    const rawA = input.range[0];
    const rawB = input.range[1];
    if (!Number.isFinite(rawA) || !Number.isFinite(rawB)) {
      onWarn?.(
        `[band.out-of-domain] band at ${input.axis} [${rawA}, ${rawB}]: non-finite bounds`,
      );
      return;
    }
    if (rawA === rawB) {
      onWarn?.(
        `[band.zero-width] band at ${input.axis} [${rawA}, ${rawA}]: zero-width; use a reference line instead`,
      );
      return;
    }
    const lo = Math.min(rawA, rawB);
    const hi = Math.max(rawA, rawB);
    const domain = input.axis === "x" ? xDomain : yDomain;
    const dMin = Math.min(domain[0], domain[1]);
    const dMax = Math.max(domain[0], domain[1]);
    if (hi < dMin || lo > dMax) {
      onWarn?.(
        `[band.out-of-domain] band at ${input.axis} [${lo}, ${hi}]: range entirely outside visible domain`,
      );
      return;
    }
    const clippedLo = Math.max(lo, dMin);
    const clippedHi = Math.min(hi, dMax);

    let rect: { x: number; y: number; width: number; height: number };
    let onAxisExtent: number;
    if (input.axis === "x") {
      const px0 = xScale(clippedLo);
      const px1 = xScale(clippedHi);
      const xStart = Math.min(px0, px1);
      const width = Math.abs(px1 - px0);
      rect = { x: xStart, y: plotArea.y, width, height: plotArea.height };
      onAxisExtent = width;
    } else {
      const py0 = yScale(clippedLo);
      const py1 = yScale(clippedHi);
      const yStart = Math.min(py0, py1);
      const height = Math.abs(py1 - py0);
      rect = { x: plotArea.x, y: yStart, width: plotArea.width, height };
      onAxisExtent = height;
    }

    const requestedPlacement = input.labelPlacement ?? "inside";
    const resolvedPlacement: "inside" | "above" | "below" =
      requestedPlacement === "inside" && onAxisExtent < NARROW_ON_AXIS_PX
        ? "above"
        : requestedPlacement;

    const model: PlotAreaBandModel = {
      id: input.id ?? null,
      axis: input.axis,
      range: [lo, hi],
      label: input.label ?? null,
      labelPriority: input.labelPriority ?? 0,
      resolvedLabelPlacement: resolvedPlacement,
      rect,
      labelSuppressed: false,
      index,
    };
    resolved.push({ input, model });
  });

  if (resolved.length === 0) return null;

  // Inside-label collision resolution:
  //   sort (priority desc, input index asc), suppress later labels whose rect
  //   overlaps a higher-priority rect by >4px on both axes.
  const estLineH = 12;
  const estCharW = 6;
  type Placed = { top: number; bottom: number; left: number; right: number };
  const placed: Placed[] = [];
  const insideByPriority = resolved
    .filter(({ model }) => model.resolvedLabelPlacement === "inside" && model.label)
    .sort((a, b) => {
      if (a.model.labelPriority !== b.model.labelPriority) {
        return b.model.labelPriority - a.model.labelPriority;
      }
      return a.model.index - b.model.index;
    });

  for (const entry of insideByPriority) {
    const { rect, label } = entry.model;
    const labelWidth = (label?.length ?? 0) * estCharW;
    const box: Placed = {
      top: rect.y + INSIDE_LABEL_PADDING,
      bottom: rect.y + INSIDE_LABEL_PADDING + estLineH,
      left: rect.x + INSIDE_LABEL_PADDING,
      right: rect.x + INSIDE_LABEL_PADDING + labelWidth,
    };
    const collides = placed.some(
      (p) =>
        box.top < p.bottom - LABEL_OVERLAP_PX &&
        box.bottom > p.top + LABEL_OVERLAP_PX &&
        box.left < p.right - LABEL_OVERLAP_PX &&
        box.right > p.left + LABEL_OVERLAP_PX,
    );
    if (collides) {
      entry.model.labelSuppressed = true;
      onWarn?.(
        `[band.label-suppressed] band "${entry.model.id ?? `#${entry.model.index}`}": inside label hidden due to collision with higher-priority band`,
      );
      continue;
    }
    placed.push(box);
  }

  return (
    <g data-testid={testId}>
      {resolved.map(({ model, input }) => {
        const context: PlotAreaBandsStyleContext = { band: model, theme };
        if (resolveStyleValue(style?.show, context) === false) return null;

        const fill =
          input.fill ?? resolveStyleValue(style?.fill, context) ?? theme.text.muted;
        const opacity =
          input.opacity ??
          resolveStyleValue(style?.opacity, context) ??
          DEFAULT_FILL_OPACITY;
        const labelColor =
          resolveStyleValue(style?.labelColor, context) ?? theme.text.secondary;
        const labelFontSize = resolveStyleValue(style?.labelFontSize, context) ?? 10;

        const { rect } = model;
        const key = model.id ?? `band-${model.index}`;
        const labelPosition = computeLabelPosition(model, plotArea);

        return (
          <g key={key} data-band-id={model.id ?? undefined}>
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill={fill}
              opacity={opacity}
              data-testid={model.id ? `plot-band-${model.id}` : undefined}
            >
              {model.label != null ? <title>{model.label}</title> : null}
            </rect>
            {model.label != null && !model.labelSuppressed && labelPosition != null ? (
              <text
                x={labelPosition.x}
                y={labelPosition.y}
                textAnchor={labelPosition.textAnchor}
                fill={labelColor}
                fontSize={labelFontSize}
                fontWeight={600}
                dominantBaseline={labelPosition.dominantBaseline}
                aria-label={model.label}
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

function computeLabelPosition(
  model: PlotAreaBandModel,
  plotArea: { x: number; y: number; width: number; height: number },
): LabelPosition | null {
  const { rect, resolvedLabelPlacement } = model;
  if (resolvedLabelPlacement === "inside") {
    if (model.axis === "y") {
      return {
        x: rect.x + INSIDE_LABEL_PADDING,
        y: rect.y + INSIDE_LABEL_PADDING,
        textAnchor: "start",
        dominantBaseline: "hanging",
      };
    }
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + INSIDE_LABEL_PADDING,
      textAnchor: "middle",
      dominantBaseline: "hanging",
    };
  }
  if (resolvedLabelPlacement === "above") {
    if (model.axis === "y") {
      return {
        x: rect.x + rect.width / 2,
        y: rect.y - OUTSIDE_LABEL_OFFSET / 2,
        textAnchor: "middle",
        dominantBaseline: "alphabetic",
      };
    }
    return {
      x: rect.x + rect.width / 2,
      y: plotArea.y - OUTSIDE_LABEL_OFFSET / 2,
      textAnchor: "middle",
      dominantBaseline: "alphabetic",
    };
  }
  // below
  if (model.axis === "y") {
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height + OUTSIDE_LABEL_OFFSET,
      textAnchor: "middle",
      dominantBaseline: "hanging",
    };
  }
  return {
    x: rect.x + rect.width / 2,
    y: plotArea.y + plotArea.height + OUTSIDE_LABEL_OFFSET,
    textAnchor: "middle",
    dominantBaseline: "hanging",
  };
}
