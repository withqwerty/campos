import { createNumericAxis } from "./scales/index.js";
import { formatNumericTick } from "./scales/format-number.js";
import { clamp, isFiniteNumber } from "./math.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BeeswarmOrientation = "horizontal" | "vertical";

export type BeeswarmValueInput = {
  /** Stable identifier — used for React keys and hit-testing. */
  id: string;
  /** The metric value on the shared numeric axis. */
  value: number;
  /** Category key, used when `populationColor.mode === "byCategory"`. */
  category?: string | undefined;
  /** Per-dot tooltip label (e.g. player name). Optional. */
  label?: string | undefined;
  /** Size-encoding field. Required if `sizeField` is configured. */
  size?: number | undefined;
  /** If present, the value is a "highlight" (larger, labelled, optional callout). */
  highlight?: BeeswarmHighlightStyle | undefined;
};

export type BeeswarmHighlightStyle = {
  label?: string | undefined;
  color?: string | undefined;
  radius?: number | undefined;
  stroke?: string | undefined;
  strokeWidth?: number | undefined;
};

export type BeeswarmGroupInput = {
  id: string;
  label: string;
  /** Small secondary caption below the group label (e.g. minutes played). */
  subLabel?: string | undefined;
  values: readonly BeeswarmValueInput[];
};

export type BeeswarmPopulationColor =
  | { mode: "uniform"; color: string }
  | {
      mode: "byCategory";
      colors: Record<string, string>;
      defaultColor?: string;
    }
  | {
      mode: "byQuantile";
      /** Sorted ascending; each band is [prev, threshold]. */
      bands: ReadonlyArray<{ threshold: number; color: string; label?: string }>;
      /** Colour for values above the final threshold. */
      aboveColor: string;
      aboveLabel?: string;
    };

export type BeeswarmReferenceLineInput = {
  value: number;
  label?: string | undefined;
  color?: string | undefined;
  dash?: string | undefined;
};

export type BeeswarmSizeFieldInput = {
  range: [number, number];
  domain?: [number, number] | undefined;
  legendLabel?: string | undefined;
  legendTicks?: readonly number[] | undefined;
};

export type BeeswarmMetric = {
  label: string;
  domain?: [number, number] | undefined;
  format?: ((value: number) => string) | undefined;
  tickCount?: number | undefined;
};

export type BeeswarmLayoutInput = {
  viewBoxWidth?: number | undefined;
  viewBoxHeight?: number | undefined;
  groupLabelSize?: number | undefined;
  axisSize?: number | undefined;
  legendSize?: number | undefined;
  outerPadding?: number | undefined;
  groupGap?: number | undefined;
};

export type BeeswarmLabelStrategy = "direct" | "callout" | "none";

/**
 * Cross-axis placement for highlighted values. Default `"auto"` lets the
 * packer place them inside the swarm at the same natural position a
 * population dot would take; `"centered"` pins them to the cross-axis centre
 * line (ScoutLab style — the subject dot reads as a key indicator above the
 * cluster); `"random"` jitters them within a band. When not `"auto"`,
 * highlights are placed first and the population packs around them as
 * obstacles so the highlight never sits inside the cloud.
 */
export type BeeswarmHighlightPlacement = "auto" | "centered" | "random";

/**
 * Packing algorithm. `"beeswarm"` (default) uses a deterministic greedy
 * circle-packing that produces the characteristic bowtie shape. `"bin"`
 * quantises values into buckets along the major axis and stacks them
 * perpendicularly — the classic dot-plot histogram look.
 */
export type BeeswarmPacking = "beeswarm" | "bin";

export type ComputeBeeswarmInput = {
  orientation?: BeeswarmOrientation | undefined;
  groups: readonly BeeswarmGroupInput[];
  metric: BeeswarmMetric;
  populationColor?: BeeswarmPopulationColor | undefined;
  highlightDefaults?:
    | {
        color?: string | undefined;
        radius?: number | undefined;
        stroke?: string | undefined;
        strokeWidth?: number | undefined;
      }
    | undefined;
  labelStrategy?: BeeswarmLabelStrategy | undefined;
  sizeField?: BeeswarmSizeFieldInput | undefined;
  referenceLines?: readonly BeeswarmReferenceLineInput[] | undefined;
  /** Base radius for population dots. */
  dotRadius?: number | undefined;
  /** Extra gap between dots during packing. */
  dotPadding?: number | undefined;
  /**
   * Packing algorithm. Default `"beeswarm"`. Use `"bin"` for a quantised
   * dot-plot histogram look.
   */
  packing?: BeeswarmPacking | undefined;
  /**
   * Where to position highlighted values on the cross axis. Default `"auto"`
   * — they sit inside the swarm. `"centered"` pins them to the cross-axis
   * center line. `"random"` jitters them within a thin band around the centre.
   */
  highlightPlacement?: BeeswarmHighlightPlacement | undefined;
  /**
   * Font size (in viewBox units) for tick and highlight labels. Threaded into
   * the callout-stagger pass so collision geometry matches what the renderer
   * actually draws. Default 10 (matches the renderer's `tickFontSize` default).
   */
  labelFontSize?: number | undefined;
  /**
   * Draw faint gridlines across the plot at each axis tick. Defaults to `true`.
   */
  showGridlines?: boolean | undefined;
  layout?: BeeswarmLayoutInput | undefined;
  emptyMessage?: string | undefined;
};

// ---------------------------------------------------------------------------
// Output model
// ---------------------------------------------------------------------------

export type BeeswarmDotModel = {
  id: string;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  value: number;
  label: string | null;
  category: string | null;
};

export type BeeswarmHighlightModel = {
  id: string;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke: string | null;
  strokeWidth: number;
  value: number;
  valueLabel: string;
  label: {
    text: string;
    x: number;
    y: number;
    anchor: "start" | "middle" | "end";
  } | null;
  callout: { x1: number; y1: number; x2: number; y2: number } | null;
};

export type BeeswarmGroupModel = {
  id: string;
  label: string;
  subLabel: string | null;
  plotArea: { x: number; y: number; width: number; height: number };
  /** Position of the primary label (above or to-the-left depending on orientation). */
  labelAnchor: { x: number; y: number; textAnchor: "start" | "middle" | "end" };
  subLabelAnchor: { x: number; y: number; textAnchor: "start" | "middle" | "end" } | null;
  dots: BeeswarmDotModel[];
  highlights: BeeswarmHighlightModel[];
};

export type BeeswarmAxisModel = {
  label: string;
  domain: [number, number];
  ticks: Array<{ value: number; position: number; label: string }>;
  /**
   * Axis baseline as a line in viewBox coords. Rendered once shared across
   * groups (it sits inside the per-group plot area but is drawn as a strip).
   */
  line: { x1: number; y1: number; x2: number; y2: number };
  /** Anchor for the axis label. For vertical orientation, rotation pivots here. */
  labelAnchor: { x: number; y: number };
};

export type BeeswarmReferenceLineModel = {
  value: number;
  label: string | null;
  color: string;
  dash: string | null;
  /** Line extends across all group plot areas on the numeric axis. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type BeeswarmLegendSwatch = {
  kind: "category" | "quantile" | "size";
  id: string;
  label: string;
  color?: string | undefined;
  radius?: number | undefined;
};

export type BeeswarmLegendModel = {
  items: BeeswarmLegendSwatch[];
};

export type BeeswarmGridlineModel = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type BeeswarmModel = {
  meta: {
    component: "Beeswarm";
    empty: boolean;
    orientation: BeeswarmOrientation;
    accessibleLabel: string;
    warnings: string[];
  };
  layout: {
    viewBox: { width: number; height: number };
    orientation: BeeswarmOrientation;
  };
  axis: BeeswarmAxisModel;
  groups: BeeswarmGroupModel[];
  referenceLines: BeeswarmReferenceLineModel[];
  gridlines: BeeswarmGridlineModel[];
  legend: BeeswarmLegendModel | null;
  emptyState: { message: string } | null;
};

// ---------------------------------------------------------------------------
// Constants + defaults
// ---------------------------------------------------------------------------

const DEFAULT_VIEWBOX_W = 520;
const DEFAULT_VIEWBOX_H = 340;
const DEFAULT_OUTER_PAD = 16;
const DEFAULT_GROUP_LABEL_SIZE = 36;
const DEFAULT_AXIS_SIZE = 28;
const DEFAULT_GROUP_GAP = 12;
// Defaults tuned for refined out-of-box feel (not matplotlib-default grey):
// — smaller dot radii read as more considered at usual sizes
// — highlight stroke doubles as a halo ring when paired with the drop-shadow
// — reference line is a slightly cooler shade, dashed by default
const DEFAULT_DOT_RADIUS = 2.2;
const DEFAULT_DOT_PADDING = 0.4;
const DEFAULT_HIGHLIGHT_RADIUS = 4.5;
const DEFAULT_HIGHLIGHT_COLOR = "#f97316";
const DEFAULT_POPULATION_COLOR = "#64748b";
const DEFAULT_HIGHLIGHT_STROKE = "#ffffff";
const DEFAULT_HIGHLIGHT_STROKE_WIDTH = 2;
const DEFAULT_REFERENCE_COLOR = "#0ea5e9";
const DEFAULT_REFERENCE_DASH = "4 3";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Packed = { cx: number; cy: number; r: number };

type PackingOpts = {
  /** 1-D (major) axis range (start, end) in viewBox coords. */
  majorRange: [number, number];
  /** Cross-axis (minor) position range; dots pack within [centerMin, centerMax]. */
  minorRange: [number, number];
  /** Radius per dot (constant or per-index). */
  radiusOf: (index: number) => number;
  padding: number;
  /** Scale a value onto the major axis. */
  scaleValue: (value: number) => number;
  values: readonly number[];
  /**
   * Pre-placed obstacles (e.g. already-positioned highlights). The packer
   * seeds its spatial grid with these so newly-placed dots collision-avoid
   * around them but they themselves aren't returned in the output.
   */
  obstacles?: readonly Packed[];
  /**
   * Called with the count of dots that couldn't fit and were clamped onto
   * the cross-axis edge (currently only `packBinned` reports this).
   */
  onOverflow?: (count: number) => void;
};

/**
 * Deterministic beeswarm packing: sort values, then for each dot pick the
 * minor-axis offset closest to the centerline that avoids overlap with already-
 * placed dots. Produces the classic bee-hive / bow-tie shape without force.
 */
function packBeeswarm(opts: PackingOpts): Packed[] {
  const { values, padding, radiusOf, scaleValue, minorRange, majorRange, obstacles } =
    opts;
  const minorCenter = (minorRange[0] + minorRange[1]) / 2;
  const majorLo = Math.min(majorRange[0], majorRange[1]);
  const majorHi = Math.max(majorRange[0], majorRange[1]);

  // Spatial bin grid keyed on major coordinate. Bin width is calibrated so a
  // candidate only needs to check its own bin and the two neighbours to catch
  // any possible collision. This turns the inner scan from O(n) into O(k) where
  // k is the local density — overall O(n) expected instead of O(n²).
  let maxR = 0;
  for (let i = 0; i < values.length; i++) maxR = Math.max(maxR, radiusOf(i));
  if (obstacles) {
    for (const o of obstacles) maxR = Math.max(maxR, o.r);
  }
  const binWidth = Math.max(1, 2 * maxR + padding);
  const bins = new Map<number, Packed[]>();
  const binKey = (cx: number) => Math.floor((cx - majorLo) / binWidth);
  const pushBin = (p: Packed) => {
    const k = binKey(p.cx);
    const arr = bins.get(k);
    if (arr) arr.push(p);
    else bins.set(k, [p]);
  };
  // Seed the grid with pre-placed obstacles so new dots collision-avoid them.
  if (obstacles) {
    for (const o of obstacles) pushBin(o);
  }

  // Process by value to produce the classic bowtie shape.
  const order = values
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v - b.v)
    .map((o) => o.i);

  const placed: Packed[] = new Array<Packed>(values.length);
  for (const i of order) {
    const v = values[i] as number;
    const r = radiusOf(i);
    const major = clamp(scaleValue(v), majorLo + r, majorHi - r);
    const step = r * 2 + padding;
    let minorOffset = 0;
    let direction = 1;
    let steps = 0;
    const maxSteps = Math.ceil(
      (Math.abs(minorRange[1] - minorRange[0]) / 2 + r * 4) / step,
    );
    const k0 = binKey(major);
    while (steps <= maxSteps) {
      const cy = minorCenter + minorOffset;
      if (cy - r >= minorRange[0] && cy + r <= minorRange[1]) {
        let collides = false;
        for (let kk = k0 - 1; kk <= k0 + 1 && !collides; kk++) {
          const bucket = bins.get(kk);
          if (!bucket) continue;
          for (let j = 0; j < bucket.length; j++) {
            const p = bucket[j];
            if (!p) continue;
            const dx = p.cx - major;
            const dy = p.cy - cy;
            const minDist = p.r + r + padding;
            if (dx * dx + dy * dy < minDist * minDist) {
              collides = true;
              break;
            }
          }
        }
        if (!collides) {
          const p = { cx: major, cy, r };
          placed[i] = p;
          pushBin(p);
          break;
        }
      }
      if (direction === 1) {
        minorOffset = Math.abs(minorOffset);
        minorOffset = -minorOffset - step;
        direction = -1;
      } else {
        minorOffset = -minorOffset + step;
        direction = 1;
        steps++;
      }
    }
    if (!placed[i]) {
      const cy = clamp(minorCenter + minorOffset, minorRange[0] + r, minorRange[1] - r);
      const p = { cx: major, cy, r };
      placed[i] = p;
      pushBin(p);
    }
  }
  return placed;
}

/**
 * Alternative to beeswarm packing: bucket values along the major axis and
 * stack them perpendicular to it. Produces a classic histogram-dot-plot look
 * — visible quantisation, useful when exact packing matters less than "how
 * many land in each bucket".
 */
function packBinned(opts: PackingOpts): Packed[] {
  const { values, padding, radiusOf, scaleValue, minorRange, majorRange, onOverflow } =
    opts;
  const minorCenter = (minorRange[0] + minorRange[1]) / 2;
  const majorLo = Math.min(majorRange[0], majorRange[1]);
  const majorHi = Math.max(majorRange[0], majorRange[1]);
  const minorHalf = (minorRange[1] - minorRange[0]) / 2;
  // Bucket width: roughly one dot diameter so dots stack neatly.
  let maxR = 0;
  for (let i = 0; i < values.length; i++) maxR = Math.max(maxR, radiusOf(i));
  const bucketW = Math.max(1, 2 * maxR + padding);
  const buckets = new Map<number, number[]>();
  const bucketOf = (cx: number) => Math.max(0, Math.floor((cx - majorLo) / bucketW));

  const order = values
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v - b.v)
    .map((o) => o.i);

  let overflowCount = 0;
  const placed: Packed[] = new Array<Packed>(values.length);
  for (const i of order) {
    const v = values[i] as number;
    const r = radiusOf(i);
    const major = clamp(scaleValue(v), majorLo + r, majorHi - r);
    const binCenter = majorLo + (bucketOf(major) + 0.5) * bucketW;
    const bin = bucketOf(major);
    const list = buckets.get(bin) ?? [];
    const stackIndex = list.length;
    list.push(i);
    buckets.set(bin, list);
    // Alternate above/below the centerline so the bins grow symmetrically.
    const tier = Math.floor((stackIndex + 1) / 2);
    const sign = stackIndex % 2 === 0 ? 1 : -1;
    const offset = sign * tier * (2 * r + padding);
    // Overflow detection — when the requested offset exceeds the available
    // half-range, the dot will be clamped onto the edge and visually stack on
    // top of any earlier clamped dots. Report so callers know dots were hidden.
    if (Math.abs(offset) > minorHalf - r) overflowCount++;
    const cy = clamp(minorCenter + offset, minorRange[0] + r, minorRange[1] - r);
    placed[i] = { cx: binCenter, cy, r };
  }
  if (overflowCount > 0 && onOverflow) onOverflow(overflowCount);
  return placed;
}

/**
 * Stagger callout labels so neighbouring highlights don't overlap. Sorts by
 * major coord, then for each label assigns it to the first "tier" (stacked
 * offsets above the dot) whose occupied rightmost edge is clear. Updates the
 * highlight's label.y and callout.y1 in place.
 */
function staggerCalloutLabels(
  highlights: BeeswarmHighlightModel[],
  fontSize: number,
): void {
  const charWidth = fontSize * 0.55;
  const tierStep = fontSize + 4;
  const gap = 4;

  const callouts = highlights
    .filter((h) => h.callout && h.label)
    .sort((a, b) => a.cx - b.cx);
  if (callouts.length < 2) return;

  const tierRightmost: number[] = [];
  for (const h of callouts) {
    const label = h.label;
    if (!label) continue;
    const width = label.text.length * charWidth;
    const leftEdge = label.x - width / 2;
    const rightEdge = label.x + width / 2;

    let tier = 0;
    while (
      tier < tierRightmost.length &&
      leftEdge < (tierRightmost[tier] ?? -Infinity) + gap
    ) {
      tier++;
    }
    tierRightmost[tier] = rightEdge;

    if (tier > 0) {
      const shift = tier * tierStep;
      label.y -= shift;
      if (h.callout) h.callout.y1 -= shift;
    }
  }
}

function resolvePopulationColor(
  value: BeeswarmValueInput,
  spec: BeeswarmPopulationColor | undefined,
): string {
  if (!spec) return DEFAULT_POPULATION_COLOR;
  switch (spec.mode) {
    case "uniform":
      return spec.color;
    case "byCategory": {
      const key = value.category ?? "";
      return spec.colors[key] ?? spec.defaultColor ?? DEFAULT_POPULATION_COLOR;
    }
    case "byQuantile": {
      // Sort defensively so caller ordering mistakes don't silently collapse
      // downstream bands into the first match.
      const sorted = [...spec.bands].sort((a, b) => a.threshold - b.threshold);
      for (const band of sorted) {
        if (value.value <= band.threshold) return band.color;
      }
      return spec.aboveColor;
    }
    default: {
      // Exhaustiveness — compile-time catch if a new mode is added.
      spec satisfies never;
      return DEFAULT_POPULATION_COLOR;
    }
  }
}

function sizeScale(
  domain: [number, number],
  range: [number, number],
): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d1 <= d0) return () => (r0 + r1) / 2;
  // sqrt scale preserves perceptual area.
  const a = Math.sqrt(Math.max(d0, 0));
  const b = Math.sqrt(Math.max(d1, 0));
  const spread = b - a || 1;
  return (v: number) => {
    const t = (Math.sqrt(Math.max(v, 0)) - a) / spread;
    return r0 + clamp(t, 0, 1) * (r1 - r0);
  };
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function computeBeeswarm(input: ComputeBeeswarmInput): BeeswarmModel {
  const orientation: BeeswarmOrientation = input.orientation ?? "horizontal";
  const dotRadius = Math.max(input.dotRadius ?? DEFAULT_DOT_RADIUS, 0.5);
  const dotPadding = Math.max(input.dotPadding ?? DEFAULT_DOT_PADDING, 0);
  const warnings: string[] = [];
  const labelStrategy = input.labelStrategy ?? "direct";
  const packing: BeeswarmPacking = input.packing ?? "beeswarm";
  const highlightPlacement: BeeswarmHighlightPlacement =
    input.highlightPlacement ?? "auto";
  const legendEnabled = Boolean(
    input.populationColor?.mode === "byQuantile" ||
    input.populationColor?.mode === "byCategory" ||
    input.sizeField,
  );

  const layout = {
    viewBoxWidth: Math.max(input.layout?.viewBoxWidth ?? DEFAULT_VIEWBOX_W, 100),
    viewBoxHeight: Math.max(input.layout?.viewBoxHeight ?? DEFAULT_VIEWBOX_H, 100),
    outerPad: input.layout?.outerPadding ?? DEFAULT_OUTER_PAD,
    labelSize: input.layout?.groupLabelSize ?? DEFAULT_GROUP_LABEL_SIZE,
    axisSize: input.layout?.axisSize ?? DEFAULT_AXIS_SIZE,
    legendSize: legendEnabled ? (input.layout?.legendSize ?? 24) : 0,
    groupGap: input.layout?.groupGap ?? DEFAULT_GROUP_GAP,
  };

  // Clean groups — filter non-finite values, track warnings.
  const cleanGroups = input.groups.map((g) => {
    const clean = g.values.filter((v) => {
      if (!isFiniteNumber(v.value)) {
        warnings.push(`${g.label}: dropped non-finite value (id=${v.id})`);
        return false;
      }
      return true;
    });
    return { ...g, values: clean };
  });

  const allValues = cleanGroups.flatMap((g) => g.values.map((v) => v.value));
  const isEmpty = allValues.length === 0;

  // Axis domain: derive from all values unless explicit domain is provided.
  let domainMin = 0;
  let domainMax = 1;
  if (allValues.length > 0) {
    domainMin = Math.min(...allValues);
    domainMax = Math.max(...allValues);
  }
  if (input.metric.domain) {
    [domainMin, domainMax] = input.metric.domain;
    // Warn if real data escapes the explicit domain — otherwise the packer
    // would place those dots outside the plot area silently.
    const outOfDomain = allValues.filter((v) => v < domainMin || v > domainMax);
    if (outOfDomain.length > 0) {
      warnings.push(
        `${outOfDomain.length} value(s) outside metric.domain [${domainMin}, ${domainMax}] will be clamped to the axis extent`,
      );
    }
  }

  // Layout:
  //   horizontal — metric on X, each group is a row; group label on the LEFT,
  //                numeric axis at the BOTTOM.
  //   vertical   — metric on Y (inverted so high is top), each group is a column;
  //                group label at the BOTTOM, numeric axis on the LEFT.
  const chartLeft =
    layout.outerPad + (orientation === "horizontal" ? layout.labelSize : layout.axisSize);
  const chartRight = layout.viewBoxWidth - layout.outerPad;
  const chartTop = layout.outerPad;
  const chartBottom =
    layout.viewBoxHeight -
    layout.outerPad -
    (orientation === "horizontal" ? layout.axisSize : layout.labelSize) -
    layout.legendSize;

  // Per-group plot dimensions along the cross axis.
  const groupCount = Math.max(1, cleanGroups.length);
  const available =
    orientation === "horizontal" ? chartBottom - chartTop : chartRight - chartLeft;
  const totalGap = layout.groupGap * Math.max(0, groupCount - 1);
  const perGroup = Math.max(24, (available - totalGap) / groupCount);

  // Numeric axis along the major dimension (shared across groups).
  // For vertical we invert so higher values render upward.
  const majorStart = orientation === "horizontal" ? chartLeft : chartBottom;
  const majorEnd = orientation === "horizontal" ? chartRight : chartTop;
  const axisRange: [number, number] = [majorStart, majorEnd];

  const axis = createNumericAxis({
    min: domainMin,
    max: domainMax,
    range: axisRange,
    tickCount: input.metric.tickCount ?? 5,
  });

  const formatTick = input.metric.format ?? formatNumericTick;

  const populationColorSpec = input.populationColor;
  const highlightColor = input.highlightDefaults?.color ?? DEFAULT_HIGHLIGHT_COLOR;
  const highlightRadius = input.highlightDefaults?.radius ?? DEFAULT_HIGHLIGHT_RADIUS;
  const highlightStroke = input.highlightDefaults?.stroke ?? DEFAULT_HIGHLIGHT_STROKE;
  const highlightStrokeWidth =
    input.highlightDefaults?.strokeWidth ?? DEFAULT_HIGHLIGHT_STROKE_WIDTH;

  const sizeAccessor: ((v: BeeswarmValueInput) => number) | null = (() => {
    if (!input.sizeField) return null;
    const domain =
      input.sizeField.domain ??
      (() => {
        const vs = cleanGroups.flatMap((g) => g.values.map((v) => v.size ?? 0));
        if (vs.length === 0) return [0, 1] as [number, number];
        return [Math.min(...vs), Math.max(...vs)] as [number, number];
      })();
    const scale = sizeScale(domain, input.sizeField.range);
    return (v: BeeswarmValueInput) =>
      isFiniteNumber(v.size) ? scale(v.size) : dotRadius;
  })();

  // Build each group.
  const groupModels: BeeswarmGroupModel[] = cleanGroups.map((g, gi) => {
    // Plot area for this group.
    const crossStart =
      orientation === "horizontal"
        ? chartTop + gi * (perGroup + layout.groupGap)
        : chartLeft + gi * (perGroup + layout.groupGap);
    const crossEnd = crossStart + perGroup;

    const plotArea =
      orientation === "horizontal"
        ? {
            x: majorStart,
            y: crossStart,
            width: majorEnd - majorStart,
            height: perGroup,
          }
        : {
            x: crossStart,
            y: majorEnd,
            width: perGroup,
            height: majorStart - majorEnd,
          };

    // Radii per dot (if size-by-field, use that; else constant + highlight override).
    const radii = g.values.map((v) =>
      v.highlight
        ? (v.highlight.radius ?? highlightRadius)
        : sizeAccessor
          ? sizeAccessor(v)
          : dotRadius,
    );

    const packFn = packing === "bin" ? packBinned : packBeeswarm;
    const majorRangeFor: [number, number] = [majorStart, majorEnd];
    const minorRangeFor: [number, number] = [crossStart + 2, crossEnd - 2];
    const minorCenter = (crossStart + crossEnd) / 2;

    // When a non-default placement is requested, place highlights first at
    // their requested cross-axis position, then pack population around them
    // as pre-seeded obstacles. This keeps centered/random highlights visually
    // clear of the cloud beneath them.
    const packed: Packed[] = new Array<Packed>(g.values.length);
    const highlightIdxs: number[] = [];
    g.values.forEach((v, i) => {
      if (v.highlight) highlightIdxs.push(i);
    });

    if (highlightPlacement !== "auto" && highlightIdxs.length > 0) {
      const seen = new Set<string>();
      const hash = (seed: string, fallback: number) => {
        // Fall back to the highlight index when id is empty or already used,
        // so collisions between blank/duplicate ids don't stack all highlights
        // at the same point.
        const key = seed && !seen.has(seed) ? seed : `__fallback__${fallback}`;
        seen.add(key);
        let h = 2166136261;
        for (let i = 0; i < key.length; i++) {
          h = Math.imul(h ^ key.charCodeAt(i), 16777619);
        }
        return ((h >>> 0) / 0xffffffff - 0.5) * 2; // -1..1
      };
      highlightIdxs.forEach((i, order) => {
        const v = g.values[i];
        if (!v) return;
        const r = radii[i] ?? highlightRadius;
        const major = clamp(
          axis.scale(v.value),
          Math.min(majorStart, majorEnd) + r,
          Math.max(majorStart, majorEnd) - r,
        );
        const band = Math.max(0, (crossEnd - crossStart) / 2 - r - 2);
        const minor =
          highlightPlacement === "centered"
            ? minorCenter
            : minorCenter + hash(v.id, order) * band * 0.4;
        packed[i] = { cx: major, cy: minor, r };
      });
    }

    // Pack the remaining values (population dots, plus highlights when
    // highlightPlacement is "auto") as a single batch.
    const popIdxs: number[] = [];
    const popValues: number[] = [];
    g.values.forEach((v, i) => {
      if (v.highlight && highlightPlacement !== "auto") return;
      popIdxs.push(i);
      popValues.push(v.value);
    });
    const obstacles =
      highlightPlacement !== "auto"
        ? highlightIdxs.map((i) => packed[i]).filter((p): p is Packed => p != null)
        : undefined;
    const popPacked = packFn({
      majorRange: majorRangeFor,
      minorRange: minorRangeFor,
      radiusOf: (local) => {
        const i = popIdxs[local];
        return i != null ? (radii[i] ?? dotRadius) : dotRadius;
      },
      padding: dotPadding,
      scaleValue: (val) => axis.scale(val),
      values: popValues,
      ...(obstacles ? { obstacles } : {}),
      onOverflow: (count) => {
        warnings.push(
          `${g.label}: ${count} dot(s) exceeded the cross-axis range and were clamped onto the edge — consider a wider plot area or a different packing mode`,
        );
      },
    });
    popIdxs.forEach((i, local) => {
      const p = popPacked[local];
      if (p) packed[i] = p;
    });

    const dots: BeeswarmDotModel[] = [];
    const highlights: BeeswarmHighlightModel[] = [];

    g.values.forEach((v, i) => {
      const p = packed[i];
      if (!p) return;
      const cx = orientation === "horizontal" ? p.cx : p.cy;
      const cy = orientation === "horizontal" ? p.cy : p.cx;
      const fill = v.highlight
        ? (v.highlight.color ?? highlightColor)
        : resolvePopulationColor(v, populationColorSpec);
      if (v.highlight) {
        const valueLabel = v.highlight.label ?? formatTick(v.value);
        const labelText = v.label ?? v.highlight.label ?? "";
        const labelPos = computeLabelPosition({
          cx,
          cy,
          r: p.r,
          orientation,
          strategy: labelStrategy,
          plotArea,
        });
        highlights.push({
          id: v.id,
          cx,
          cy,
          r: p.r,
          fill,
          stroke: v.highlight.stroke ?? highlightStroke,
          strokeWidth: v.highlight.strokeWidth ?? highlightStrokeWidth,
          value: v.value,
          valueLabel,
          label:
            labelStrategy === "none" || !labelText
              ? null
              : {
                  text: labelText,
                  x: labelPos.x,
                  y: labelPos.y,
                  anchor: labelPos.anchor,
                },
          callout:
            labelStrategy === "callout" && labelText
              ? { x1: labelPos.x, y1: labelPos.y + 4, x2: cx, y2: cy - p.r }
              : null,
        });
      } else {
        dots.push({
          id: v.id,
          cx,
          cy,
          r: p.r,
          fill,
          value: v.value,
          label: v.label ?? null,
          category: v.category ?? null,
        });
      }
    });

    // Group label: left of row (horizontal) or below column (vertical).
    const labelAnchor =
      orientation === "horizontal"
        ? {
            x: plotArea.x - 8,
            y: plotArea.y + plotArea.height / 2,
            textAnchor: "end" as const,
          }
        : {
            x: plotArea.x + plotArea.width / 2,
            y: chartBottom + 16,
            textAnchor: "middle" as const,
          };
    // Callout labels: post-process to avoid overlapping neighbours. Sort by
    // major coord, then for each label pick the first tier (above the dot) that
    // doesn't collide with a previously-placed label on that tier.
    if (labelStrategy === "callout" && highlights.length > 1) {
      staggerCalloutLabels(highlights, input.labelFontSize ?? 10);
    }

    const subLabelAnchor = g.subLabel
      ? {
          x: labelAnchor.x,
          y: orientation === "horizontal" ? labelAnchor.y + 12 : labelAnchor.y + 14,
          textAnchor: labelAnchor.textAnchor,
        }
      : null;

    return {
      id: g.id,
      label: g.label,
      subLabel: g.subLabel ?? null,
      plotArea,
      labelAnchor,
      subLabelAnchor,
      dots,
      highlights,
    };
  });

  // Axis baseline strip.
  const axisLabel = input.metric.label;
  const axisLine =
    orientation === "horizontal"
      ? { x1: majorStart, y1: chartBottom + 2, x2: majorEnd, y2: chartBottom + 2 }
      : {
          x1: chartLeft - 2,
          y1: majorStart,
          x2: chartLeft - 2,
          y2: majorEnd,
        };
  // Axis label anchor: for horizontal, centred below ticks; for vertical,
  // outside the tick labels and inside the outer padding. Using the real
  // axisSize prevents drift when the caller customises layout.axisSize.
  const axisLabelAnchor =
    orientation === "horizontal"
      ? {
          x: (axisLine.x1 + axisLine.x2) / 2,
          y: axisLine.y1 + 30,
        }
      : {
          x: layout.outerPad + 4,
          y: (axisLine.y1 + axisLine.y2) / 2,
        };
  const axisModel: BeeswarmAxisModel = {
    label: axisLabel,
    domain: axis.domain,
    ticks: axis.ticks.map((t) => ({
      value: t,
      position: axis.scale(t),
      label: formatTick(t),
    })),
    line: axisLine,
    labelAnchor: axisLabelAnchor,
  };

  // Gridlines — one per tick, spanning the plot area across all groups. They
  // visually anchor the numeric axis without the heaviness of a chart border.
  const showGridlines = input.showGridlines ?? true;
  const gridlines: BeeswarmGridlineModel[] = showGridlines
    ? axis.ticks.map((t) => {
        const pos = axis.scale(t);
        if (orientation === "horizontal") {
          return { x1: pos, y1: chartTop, x2: pos, y2: chartBottom };
        }
        return { x1: chartLeft, y1: pos, x2: chartRight, y2: pos };
      })
    : [];

  // Reference lines.
  const referenceLines: BeeswarmReferenceLineModel[] = (input.referenceLines ?? []).map(
    (ref) => {
      const pos = axis.scale(ref.value);
      const line =
        orientation === "horizontal"
          ? {
              x1: pos,
              y1: chartTop,
              x2: pos,
              y2: chartBottom,
            }
          : {
              x1: chartLeft,
              y1: pos,
              x2: chartRight,
              y2: pos,
            };
      return {
        value: ref.value,
        label: ref.label ?? null,
        color: ref.color ?? DEFAULT_REFERENCE_COLOR,
        dash: ref.dash ?? DEFAULT_REFERENCE_DASH,
        ...line,
      };
    },
  );

  // Legend.
  let legend: BeeswarmLegendModel | null = null;
  if (populationColorSpec?.mode === "byQuantile") {
    const items: BeeswarmLegendSwatch[] = populationColorSpec.bands.map((b, i) => ({
      kind: "quantile" as const,
      id: `q-${i}`,
      label: b.label ?? `≤ ${formatTick(b.threshold)}`,
      color: b.color,
    }));
    items.push({
      kind: "quantile",
      id: "q-above",
      label:
        populationColorSpec.aboveLabel ??
        `> ${formatTick(populationColorSpec.bands[populationColorSpec.bands.length - 1]?.threshold ?? 0)}`,
      color: populationColorSpec.aboveColor,
    });
    legend = { items };
  } else if (populationColorSpec?.mode === "byCategory") {
    const items: BeeswarmLegendSwatch[] = Object.entries(populationColorSpec.colors).map(
      ([key, color]) => ({
        kind: "category" as const,
        id: key,
        label: key,
        color,
      }),
    );
    // Add an "Other" swatch whenever any dot fell through to the default
    // colour so grey dots are never invisible in the legend.
    const fallbackColor = populationColorSpec.defaultColor ?? DEFAULT_POPULATION_COLOR;
    const anyFallback = cleanGroups.some((g) =>
      g.values.some((v) => {
        if (v.highlight) return false;
        const key = v.category ?? "";
        return populationColorSpec.colors[key] === undefined;
      }),
    );
    if (anyFallback) {
      items.push({
        kind: "category",
        id: "__fallback__",
        label: "Other",
        color: fallbackColor,
      });
    }
    legend = { items };
  }
  if (input.sizeField) {
    const sizeItems: BeeswarmLegendSwatch[] = (
      input.sizeField.legendTicks ?? [
        input.sizeField.domain?.[0] ?? 0,
        input.sizeField.domain?.[1] ?? 1,
      ]
    ).map((v, i) => ({
      kind: "size" as const,
      id: `s-${i}`,
      label: String(v),
      radius: sizeAccessor ? sizeAccessor({ id: "", value: 0, size: v }) : dotRadius,
    }));
    legend = { items: [...(legend?.items ?? []), ...sizeItems] };
  }

  // A11y label: mention the subject arc explicitly so screen readers get the
  // narrative, not just a count. Format is e.g.:
  //   "Beeswarm of npxG/match: 5 groups, 870 values. Saka: 20-21 0.25, 21-22 0.30, ..."
  const highlightSummaries: string[] = [];
  for (const g of groupModels) {
    for (const h of g.highlights) {
      const label = h.label?.text ?? h.valueLabel;
      highlightSummaries.push(`${g.label} ${label} ${h.valueLabel}`);
    }
  }
  const accessibleLabel = isEmpty
    ? `Beeswarm: no data`
    : highlightSummaries.length > 0
      ? `Beeswarm of ${input.metric.label}: ${cleanGroups.length} group${cleanGroups.length === 1 ? "" : "s"}, ${allValues.length} values. Highlights: ${highlightSummaries.join("; ")}`
      : `Beeswarm of ${input.metric.label}: ${cleanGroups.length} group${cleanGroups.length === 1 ? "" : "s"}, ${allValues.length} values`;

  return {
    meta: {
      component: "Beeswarm",
      empty: isEmpty,
      orientation,
      accessibleLabel,
      warnings,
    },
    layout: {
      viewBox: { width: layout.viewBoxWidth, height: layout.viewBoxHeight },
      orientation,
    },
    axis: axisModel,
    groups: groupModels,
    referenceLines,
    gridlines,
    legend,
    emptyState: isEmpty ? { message: input.emptyMessage ?? "No data to plot" } : null,
  };
}

// ---------------------------------------------------------------------------
// Label positioning
// ---------------------------------------------------------------------------

type LabelPosInput = {
  cx: number;
  cy: number;
  r: number;
  orientation: BeeswarmOrientation;
  strategy: BeeswarmLabelStrategy;
  plotArea: { x: number; y: number; width: number; height: number };
};

function computeLabelPosition(input: LabelPosInput) {
  const { cx, cy, r, orientation, plotArea, strategy } = input;
  // Default intent: place label above the dot. If that puts it above the
  // plot top, flip to below the dot so it stays inside the plot area.
  const gap = strategy === "callout" ? 14 : 6;
  if (orientation === "horizontal") {
    const preferY = cy - r - gap;
    const flippedY = cy + r + gap + 8;
    const y = preferY < plotArea.y + 10 ? flippedY : preferY;
    return { x: cx, y, anchor: "middle" as const };
  }
  // Vertical: label sits above the dot; flip below if we'd escape the top
  // of the plot (most common when the subject's value is near domainMax).
  const x = cx;
  const preferY = cy - r - gap;
  const flippedY = cy + r + gap + 8;
  const y = preferY < plotArea.y + 10 ? flippedY : preferY;
  return { x, y, anchor: "middle" as const };
}
