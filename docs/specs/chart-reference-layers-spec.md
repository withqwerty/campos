# Chart reference layers — bands, reference lines, envelopes

**Status:** draft v5 — implementation-ready
**Date:** 2026-04-18
**Review history:** v1 → 7 findings · v2 → 13 findings · v3 → 8 findings · v4 → 7 findings · v5 addresses all v4 findings

## Header

- **Scope:** new cross-chart primitives + `LineChart` extensions + domain helpers + migration of `events`
- **New primitives:** `ChartPlotAreaBands`, `ChartPlotAreaReferenceLines`
- **Extensions:** `LineChart` gains `bands`, `references`, `envelopes` props and `series[].hidden` flag
- **Removed:** `LineChart.events` prop, `LineChartEventInput` / `LineChartEventModel` types, `model.events` field (pre-release breaking change)
- **Renamed in `meta`:** `validSeries` → `dataSeries` + new `visibleSeries`
- **Helpers:** `managerEventRef`, `seasonEventRef`, `goalEventRef`, `diagonalFromLinear`, `envelopeCenterOffset`, `diagonalSeries`
- **Target version:** v0.2.x
- **Not in scope:** `XGTimeline` migration, ScatterPlot / DistributionChart / Beeswarm adoption, gradient fills, non-linear curve support, `y2`-bound bands, confidence intervals around internal trendlines, structured-object warnings (`string[]` stays; `[code]` prefix convention added)

## Purpose

Unlock 6 ideas from the cross-sport viz lab (`apps/site/src/pages/lab/cross-sport-ideas.astro`) by adding three reusable reference-layer concepts:

1. **Bands** — axis-aligned shaded rectangles over data space.
2. **Reference lines** — horizontal, vertical, or diagonal line marks with labels.
3. **Envelopes** — signed area between two bounds (including: two series; a centre ± offset; a series and a reference line).

## Ideas unlocked (audit)

| Idea                        | Shape                                                                | Verdict                                                       |
| --------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| 5. Required-rate pace       | `envelopes: [{kind: "series-pair"}]`                                 | Clean                                                         |
| 9. Elo river zones          | `bands` + helper-based `references`                                  | Clean                                                         |
| 10. Aging curve ± σ         | `envelopes: [{kind: "center-offset"}]` via helper                    | Clean                                                         |
| 21. Rolling form CI         | same as aging curve                                                  | Clean                                                         |
| Off-pitch · Lorenz / Gini   | `references` diagonal + `envelopes: [{kind: "series-to-reference"}]` | Clean (single source of truth — no hidden-series duplication) |
| Off-pitch · Squad-vs-league | `bands`                                                              | Clean                                                         |

## Domain framing

Pure chart-layer work. No football concept, no adapter involvement, no canonical-schema impact.

**Bounded-context ownership:**

- `packages/react/src/primitives/` owns the two new primitives.
- `packages/react/src/compute/line-chart.ts` owns envelope path maths and `hidden`-series semantics.
- `packages/react/src/LineChart.tsx` owns the prop surface.
- `packages/react/src/helpers.ts` (new or existing) owns the factory helpers.

**Invariants:**

- Render z-order is locked (below).
- Empty / degenerate entries are silently dropped with a `[code]-prefixed` warning in `meta.warnings`. No throws.
- All coordinates clip strictly to `plotArea`. Labels may exit only for `labelPlacement: "above" | "below"` or intentional diagonal-label overhang.
- Accessible label mentions labelled layers in a locked order.

## Public API

### Primitive A: `ChartPlotAreaBands`

```ts
// packages/react/src/primitives/ChartPlotAreaBands.tsx

export type PlotAreaBand = {
  axis: "x" | "y";
  /** Data-space bounds. Order-insensitive; normalised to [min, max] internally. */
  range: readonly [number, number];
  id?: string;
  label?: string;
  /**
   * Used for collision resolution when multiple inside-placed labels overlap.
   * Higher priority wins; ties broken by input order. Default 0.
   */
  labelPriority?: number;
  fill?: string;
  opacity?: number;
  /** "inside" (default for bands ≥24px on-axis) | "above" | "below". */
  labelPlacement?: "inside" | "above" | "below";
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
};

export type ChartPlotAreaBandsProps = {
  plotArea: { x: number; y: number; width: number; height: number };
  xDomain: readonly [number, number];
  yDomain: readonly [number, number];
  bands: readonly PlotAreaBand[];
  theme: UITheme;
  style?: PlotAreaBandsStyle;
  testId?: string;
};
```

### Primitive B: `ChartPlotAreaReferenceLines`

```ts
// packages/react/src/primitives/ChartPlotAreaReferenceLines.tsx

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
};

export type ChartPlotAreaReferenceLinesProps = {
  plotArea: { x: number; y: number; width: number; height: number };
  xDomain: readonly [number, number];
  yDomain: readonly [number, number];
  lines: readonly PlotAreaReferenceLine[];
  theme: UITheme;
  style?: PlotAreaReferenceLinesStyle;
  testId?: string;
};
```

### Extension: LineChart envelopes

```ts
// packages/react/src/compute/line-chart.ts additions

export type LineChartEnvelope =
  | {
      kind: "series-pair";
      seriesAId: string;
      seriesBId: string;
      id?: string;
      fillPositive?: string;
      fillNegative?: string;
      fill?: string;
      opacity?: number;
      show?: boolean;
    }
  | {
      kind: "center-offset";
      centerSeriesId: string;
      /** Index-aligned to the resolved centre series' points. */
      bounds: readonly { x: number; upper: number; lower: number }[];
      id?: string;
      fillPositive?: string;
      fillNegative?: string;
      fill?: string;
      opacity?: number;
      show?: boolean;
    }
  | {
      kind: "series-to-reference";
      /** The series one bound is taken from. */
      seriesId: string;
      /**
       * Id of a `PlotAreaReferenceLine` (must be declared in `references`).
       * Only `kind: "horizontal"` and `kind: "diagonal"` references are
       * valid targets; `kind: "vertical"` is rejected (vertical lines have
       * no y-function of x and cannot bound an envelope).
       */
      referenceId: string;
      id?: string;
      fillPositive?: string;
      fillNegative?: string;
      fill?: string;
      opacity?: number;
      show?: boolean;
    };
```

**Three kinds, each genuinely distinct:**

- `series-pair` — canonical two-bound case.
- `center-offset` — ergonomic CI-around-centre case.
- `series-to-reference` — envelope between a series and an already-declared reference line. This is the Lorenz / regression-fit-CI case. The reference line is the single source of truth for the "other bound" — no hidden-series duplication, no sync drift.

### Sign semantics (locked)

- **`series-pair`:** at each merged x, sign of `seriesA.y - seriesB.y`. Positive → `fillPositive`. Negative → `fillNegative`.
- **`center-offset`:** at each merged x, sign of `bound.upper - bound.lower`. Positive → `fillPositive`. Expected case (upper > lower) renders positive. If `upper < lower` at the majority of points (>50%), emit warning `[envelope.inverted-bounds]`.
- **`series-to-reference`:** at each merged x, sign of `series.y - referenceLine.y(x)`. Positive → `fillPositive`.

When `fillPositive === fillNegative` (or only `fill` is set), one closed path. When they differ, crossovers computed linearly and two paths emit.

### LineChart series `hidden` flag

```ts
export type LineChartSeriesInput = {
  // …existing fields…
  /**
   * When true, the series participates in data resolution and x/y-domain
   * inference, but is suppressed from all rendering, legend, end labels,
   * palette allocation, and `meta.visibleSeries` count. Still counted in
   * `meta.totalSeries` and `meta.dataSeries`.
   */
  hidden?: boolean;
};
```

### LineChart prop surface

```ts
export type LineChartProps = ComputeLineChartInput & {
  // …existing props, EXCEPT `events` (removed)…
  bands?: readonly PlotAreaBand[];
  bandsStyle?: PlotAreaBandsStyle;
  references?: readonly PlotAreaReferenceLine[];
  referencesStyle?: PlotAreaReferenceLinesStyle;
  envelopes?: readonly LineChartEnvelope[];
  envelopesStyle?: LineChartEnvelopesStyle;
};
```

### Helpers

```ts
// packages/react/src/helpers.ts (extend or create)

/** Vertical reference styled as a manager change. */
export function managerEventRef(x: number, label?: string): PlotAreaReferenceLine {
  return {
    kind: "vertical",
    x,
    ...(label != null ? { label } : {}),
    stroke: "#3f7cc4",
    strokeWidth: 1.25,
  };
}

/** Vertical reference styled as a season boundary. */
export function seasonEventRef(x: number, label?: string): PlotAreaReferenceLine {
  return {
    kind: "vertical",
    x,
    ...(label != null ? { label } : {}),
    stroke: "#9ca3af",
    strokeWidth: 1,
    strokeDasharray: "4 3",
  };
}

/** Vertical reference styled as a goal event. */
export function goalEventRef(x: number, label?: string): PlotAreaReferenceLine {
  return {
    kind: "vertical",
    x,
    ...(label != null ? { label } : {}),
    stroke: "#c8102e",
    strokeWidth: 1.5,
  };
}

/**
 * Diagonal reference line from a y = slope*x + intercept equation, evaluated
 * across a given x-domain. Overrides via `extra` cannot redefine kind / from / to.
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
 * Center-offset envelope built from sigma / offset arrays aligned to a series.
 * Overrides via `extra` cannot redefine kind / centerSeriesId / bounds.
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

/** 2-point hidden series for use as a straight-line envelope bound. */
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
```

### Zero-config happy paths

**Required-rate pace (idea #5):**

```tsx
<LineChart
  series={[
    { id: "actual", label: "Actual pts", points: actualPoints },
    { id: "pace", label: "Top-4 pace", points: pacePoints, strokeDasharray: "4 3" },
  ]}
  envelopes={[
    {
      kind: "series-pair",
      seriesAId: "pace",
      seriesBId: "actual",
      fillPositive: "#ef4444", // pace > actual = deficit
      fillNegative: "#10b981", // actual > pace = surplus
      opacity: 0.15,
    },
  ]}
/>
```

**Elo river (idea #9):**

```tsx
<LineChart
  series={[{ id: "rating", label: "Rolling rating", points }]}
  bands={[
    { axis: "y", range: [75, 100], label: "Title race", fill: "#10b981", opacity: 0.08 },
    { axis: "y", range: [0, 25], label: "Relegation", fill: "#ef4444", opacity: 0.08 },
  ]}
  references={[managerEventRef(12, "New manager")]}
/>
```

**Aging curve ± σ (idea #10):**

```tsx
<LineChart
  series={[
    { id: "player", label: "Player", points: playerPoints },
    { id: "popMean", label: "Position mean", points: meanPoints },
  ]}
  envelopes={[
    envelopeCenterOffset("popMean", meanPoints, sigmaUpper, sigmaLower, {
      fill: "#6b7280",
      opacity: 0.2,
    }),
  ]}
/>
```

**Lorenz curve (off-pitch, single source of truth):**

```tsx
<LineChart
  series={[{ id: "lorenz", label: "Cumulative share", points: lorenzPoints }]}
  references={[
    {
      kind: "diagonal",
      id: "equality",
      from: [0, 0],
      to: [1, 1],
      label: "Perfect equality",
      strokeDasharray: "4 3",
    },
  ]}
  envelopes={[
    {
      kind: "series-to-reference",
      seriesId: "lorenz",
      referenceId: "equality",
      fill: "#c8102e",
      opacity: 0.12,
    },
  ]}
/>
```

The reference line `"equality"` is the **single source of truth** for the diagonal. The envelope references it by id. No hidden series; no duplicate endpoints; no warning noise.

### Explicit non-goals

- **Non-linear curve interpolation** inside envelopes. Linear only for v1.
- **`y2`-bound bands or references.** Primary axes only.
- **Gradient fills.**
- **Hit-testing / tooltips** on bands / references / envelopes.
- **Legend inclusion** of reference layers (labels render in-place).
- **Animation.**
- **CI around internal regression trendlines** (trendline paths are not exposed as series).
- **Structured-object warnings.** `meta.warnings` remains `string[]`. `[code]` prefix convention adopted for grep-stability without a breaking type change.

## Gap, crossover, and projection rules (locked)

### Envelope x-grid resolution

For every envelope, regardless of kind:

1. **Resolve the two bounds:**
   - `series-pair`: look up `seriesAId` and `seriesBId` from resolved series (including hidden). Drop + warn `[envelope.unknown-series]` if missing or <2 valid points.
   - `center-offset`: centre series points for one bound; derive the other per-point from `bounds[].upper` vs `bounds[].lower`. Drop + warn `[envelope.bounds-mismatch]` if `bounds.length !== centre.points.length` after validation.
   - `series-to-reference`: series for one bound; reference line evaluated as a y(x) function for the other. Vertical references rejected with `[envelope.vertical-reference]`. Horizontal references evaluate to a constant y. Diagonal references evaluate via linear interpolation between `from` and `to`.
   - **Geometry is derived from the reference line's declaration (`from` / `to` / `y`), not from its resolved style.** If `referencesStyle.show` evaluates to false for that reference, the line's body is suppressed from render but the envelope still computes and renders off the declared geometry. Reference endpoints are data, not style.
2. **Overlap x-interval** = `[max(minA, minB), min(maxA, maxB)]`. Empty → drop + warn `[envelope.no-overlap]`.
3. **Merged x-grid** = sorted union of every x from A and B within the overlap interval. For `series-to-reference` with an infinite-support reference line, the reference contributes no x values; the grid is the series' x values clipped to the series' x range (intersected with the reference's support which is the whole x-axis for horizontal and the `from..to` x range for diagonal).
4. **Evaluate** both bounds at every merged x via linear interpolation.
5. **Emit** one polygon through the merged-grid pairs. Single clean sweep — no anchor-sweep ambiguity.

### Crossover splitting

When `fillPositive !== fillNegative`:

1. For each adjacent merged-grid pair `(x0, x1)`, compute `d0 = A - B at x0`, `d1 = A - B at x1`.
2. Same sign → one trapezoid with the matching colour.
3. Different signs → crossover x = `x0 + (0 - d0) / (d1 - d0) * (x1 - x0)`; emit two triangles split at `(x_c, A(x_c) = B(x_c))`.
4. `d0 === 0` exactly → degenerate vertex; handled as zero-width triangle on either side.

Linear only. Non-linear curves are an explicit non-goal.

### Zero-width / degenerate inputs

| Case                                                                                                 | Behaviour                                                                        |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Band `range[0] === range[1]`                                                                         | Drop + warn `[band.zero-width]` (advice: use a reference line)                   |
| Band `range[0] > range[1]`                                                                           | Silently normalise                                                               |
| Band range entirely outside visible domain                                                           | Drop + warn `[band.out-of-domain]`                                               |
| Reference diagonal `from === to`                                                                     | Drop + warn `[reference.degenerate]`                                             |
| Reference diagonal both endpoints outside plot, no chord intersection (includes grazing-corner case) | Drop + warn `[reference.no-plot-intersection]`                                   |
| Reference diagonal endpoints outside, chord visibly crosses                                          | Clip via Liang-Barsky to plot-area boundaries                                    |
| Envelope overlap empty                                                                               | Drop + warn `[envelope.no-overlap]`                                              |
| Envelope <2 points after validation                                                                  | Drop + warn `[envelope.insufficient-points]`                                     |
| `center-offset` with `upper < lower` at >50% of points                                               | Emit warning `[envelope.inverted-bounds]`; render as normal with flipped colours |
| `series-to-reference` with a `vertical` reference                                                    | Drop + warn `[envelope.vertical-reference]`                                      |

## `series[].hidden` semantic specification (locked)

| Concern                       | Behaviour                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Point validation              | Applied normally; per-series warning `[series.dropped-points]` fires                                                                                                                                                                                                                                                            |
| X-domain inference            | **Participates.** Warning `[hidden.extends-x-domain]` always fires when a hidden series extends the x-domain beyond all visible series. Users who rely on hidden series intentionally can filter by code; over-suppression is worse than noise, because a hidden series referenced by one envelope may silently squash another. |
| Y-domain inference            | **Participates.** Same rule for `[hidden.extends-y-domain]`.                                                                                                                                                                                                                                                                    |
| Palette allocation            | **Skipped.** Palette indices assigned to visible series only.                                                                                                                                                                                                                                                                   |
| Series rendering              | **Suppressed** — no path, no markers, no hover target.                                                                                                                                                                                                                                                                          |
| Trendline                     | **Suppressed.** Not computed even if `trendline: true`.                                                                                                                                                                                                                                                                         |
| End-label rendering           | **Excluded.**                                                                                                                                                                                                                                                                                                                   |
| Legend                        | **Excluded.**                                                                                                                                                                                                                                                                                                                   |
| `meta.totalSeries`            | Counts                                                                                                                                                                                                                                                                                                                          |
| `meta.dataSeries`             | Counts (has ≥1 valid point)                                                                                                                                                                                                                                                                                                     |
| `meta.visibleSeries`          | Does NOT count                                                                                                                                                                                                                                                                                                                  |
| `meta.accessibleLabel`        | Uses `visibleSeries`                                                                                                                                                                                                                                                                                                            |
| `highlightSeries` → hidden id | Ignored + warning `[highlight.hidden-target]`                                                                                                                                                                                                                                                                                   |
| Envelope targetability        | Yes — referenced hidden series are the canonical pattern for `series-pair`                                                                                                                                                                                                                                                      |

### Meta type changes (BREAKING within v0.2)

```ts
type LineChartMetaBefore = {
  totalSeries: number;
  validSeries: number; // "has ≥1 valid point"
  // …
};

type LineChartMetaAfter = {
  totalSeries: number;
  dataSeries: number; // renamed from `validSeries`: has ≥1 valid point (incl. hidden)
  visibleSeries: number; // NEW: dataSeries minus hidden
  highlightedSeries: number;
  totalPoints: number;
  droppedPoints: number;
  warnings: string[];
  accessibleLabel: string;
};
```

## Warnings (public contract with `[code]` prefix)

All warnings begin with a bracket-prefix code so consumers can grep reliably even as prose evolves:

| Code                               | Message template                                                                                                         | Fires when                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `[series.dropped-points]`          | `[series.dropped-points] series "id": N point(s) dropped (invalid coordinates)`                                          | Non-finite x or y values filtered                                              |
| `[hidden.extends-x-domain]`        | `[hidden.extends-x-domain] series "id" extends x-domain to [min, max] beyond visible series`                             | Hidden series expands x-bounds (always — consumers filter by code if expected) |
| `[hidden.extends-y-domain]`        | `[hidden.extends-y-domain] series "id" extends y-domain to [min, max] beyond visible series`                             | Same for y                                                                     |
| `[highlight.hidden-target]`        | `[highlight.hidden-target] highlightSeries "id" references a hidden series; highlight has no effect`                     | Highlight list targets a hidden id                                             |
| `[band.zero-width]`                | `[band.zero-width] band at ${axis} [a, a]: zero-width; use a reference line instead`                                     | `range[0] === range[1]`                                                        |
| `[band.out-of-domain]`             | `[band.out-of-domain] band at ${axis} [a, b]: range entirely outside visible domain`                                     | Range lies outside `[domainMin, domainMax]`                                    |
| `[band.label-suppressed]`          | `[band.label-suppressed] band "id": inside label hidden due to collision with higher-priority band`                      | Lower-priority label suppressed                                                |
| `[reference.degenerate]`           | `[reference.degenerate] reference ${kind} "id": degenerate definition`                                                   | `from === to` diagonal, or non-finite coordinates                              |
| `[reference.out-of-domain]`        | `[reference.out-of-domain] reference ${kind} "id": ${y-or-x}=${value} outside visible domain`                            | Horizontal/vertical at a coordinate outside the visible domain                 |
| `[reference.no-plot-intersection]` | `[reference.no-plot-intersection] reference diagonal "id": no intersection with plot area`                               | Diagonal chord fully outside or grazing corner                                 |
| `[envelope.unknown-series]`        | `[envelope.unknown-series] envelope "id": unknown series "seriesId"`                                                     | Series lookup miss                                                             |
| `[envelope.unknown-reference]`     | `[envelope.unknown-reference] envelope "id": unknown reference "referenceId"`                                            | Reference lookup miss for series-to-reference                                  |
| `[envelope.vertical-reference]`    | `[envelope.vertical-reference] envelope "id": cannot use vertical reference "referenceId" as bound (no y-function of x)` | series-to-reference targeting a vertical                                       |
| `[envelope.bounds-mismatch]`       | `[envelope.bounds-mismatch] envelope "id": bounds.length (N) does not match centre series points (M)`                    | center-offset length mismatch                                                  |
| `[envelope.no-overlap]`            | `[envelope.no-overlap] envelope "id": overlap interval empty (A [a,b], B [c,d])`                                         | No x-overlap                                                                   |
| `[envelope.insufficient-points]`   | `[envelope.insufficient-points] envelope "id": <2 valid points after gap-validation`                                     | Too few points after drops                                                     |
| `[envelope.truncated]`             | `[envelope.truncated] envelope "id": effective x-range [a, b] narrower than raw bound range`                             | Cascading — source bounds truncated by validation                              |
| `[envelope.inverted-bounds]`       | `[envelope.inverted-bounds] envelope "id": upper < lower at N of M points (colour-flip may be unintentional)`            | center-offset with majority-inverted bounds                                    |

Code prefixes are public API. Message prose may evolve; codes may not.

## Default visual contract

**Bands:**

- Full extent on non-axis dimension.
- Default fill `theme.surface.muted` at opacity 0.15.
- Label placement: `"inside"` when band ≥24px on-axis; auto-flip to `"above"` when narrower.
- Inside labels: sorted by `labelPriority` (desc), then input order. Later labels suppressed when vertical overlap >4px with a higher-priority label; suppression emits `[band.label-suppressed]`. **Tie-breaking:** when two or more bands share the highest `labelPriority` in a colliding group, input order wins — the later one is suppressed with the same warning code.
- Render order: immediately above `ChartPlotAreaBackground`, below grid lines.

**Reference lines:**

- Default stroke `theme.axis.line` at 1px, dasharray `"4 3"`, opacity 0.7.
- Label position: horizontal → right-end (`labelAnchor: "end"`); vertical → top-centre; diagonal → at `to` endpoint. 6px offset.
- Diagonal clipping via Liang-Barsky segment-clipping.
- Render order: line body above envelopes, below series; labels above everything for legibility.

**Envelopes:**

- Default fill `theme.surface.muted` at opacity 0.2.
- Single-colour path when `fillPositive === fillNegative` or only `fill` is set.
- Render order: above bands, below reference-line bodies.

## Render z-order (locked)

Bottom to top:

1. `ChartPlotAreaBackground`
2. `bands` (plus `"inside"` labels; `"above"`/`"below"` labels render outside)
3. Grid lines
4. `envelopes`
5. Reference-line bodies
6. Series lines
7. Series markers
8. Reference-line labels (elevated for legibility)
9. End labels / score strip / chart frame

## Accessible label composition (locked)

`meta.accessibleLabel` enumerates in this order:

1. `visibleSeries` count and top-level series labels (existing behaviour).
2. Labelled bands (`"N bands: label1, label2, ..."`).
3. Labelled reference lines (`"N references: label1, label2, ..."`).
4. Envelope summary — count only, not labels, because envelopes are contextual overlays between already-named series/references rather than independent marks (`"N envelopes"`). Asymmetric with bands/references by design.

Hidden series and unlabelled layers are omitted.

**Worked example (Lorenz demo):**

> `"Line chart, 1 series: Cumulative share. 1 reference: Perfect equality. 1 envelope."`

## Internal primitives required

| Primitive                                      | Status                                     |
| ---------------------------------------------- | ------------------------------------------ |
| `ChartPlotAreaBands`                           | **new**                                    |
| `ChartPlotAreaReferenceLines`                  | **new**                                    |
| Envelope path builder + crossover-split        | **new** — in `compute/line-chart.ts`       |
| Liang-Barsky 2D segment-clipping               | **new small utility**                      |
| Linear domain-to-plot scale builder            | **small utility** — extract if not present |
| `resolveStyleValue`, `ChartPlotAreaBackground` | **existing**                               |

## Migration list (pre-release breaking changes)

Each file touched + nature of change. Grep-assisted during implementation.

### Delete or rename

- `packages/react/src/compute/line-chart.ts`:
  - Delete `LineChartEventInput` type export
  - Delete `LineChartEventModel` type export
  - Delete `events` field from `ComputeLineChartInput` and `LineChartModel`
  - Rename `validSeries` field in `LineChartModel.meta` to `dataSeries`
  - Add `visibleSeries` field
  - Delete `EventGuides` rendering callsite
- `packages/react/src/LineChart.tsx`:
  - Delete `events` prop from `LineChartProps`
  - Delete `eventStyle` prop + `LineChartEventStyle` type
  - Delete `EventGuides` component
  - Replace `testId="line-events"` with `testId="line-references"` where relevant (the `line-events` id goes away entirely)

### Update consumers

- `apps/site/src/components/LineChartPreview.tsx`:
  - Lines 31 and 53 — replace `events={lineChartDemoEvents}` with `references={lineChartDemoReferences}`
- `apps/site/src/data/line-chart-demo.ts`:
  - Rename export `lineChartDemoEvents` → `lineChartDemoReferences`
  - Convert each entry from `LineChartEventInput` to `PlotAreaReferenceLine` using the appropriate helper (`managerEventRef` / `seasonEventRef` / `goalEventRef`)
- `apps/site/src/data/showcase-newcastle-trendline.ts`:
  - Line 140 — rename `newcastleTrendlineEvents` → `newcastleTrendlineReferences`; convert entries
- `apps/site/src/pages/linechart.astro`:
  - Lines 33, 88–93 — replace prose and example code: `events` → `references`

### Update tests

- `packages/react/test/compute/compute-line-chart.test.ts` lines 143–164: rewrite `events` assertions as `references` assertions. Model field checks change from `model.events` to `model.references`.
- `packages/react/test/LineChart.test.tsx` lines 64–71: replace `events={…}` with `references={…}` via helpers; replace `getByTestId("line-events")` with `getByTestId("line-references")`.
- Existing tests asserting `model.meta.validSeries === N` must migrate to `dataSeries` or `visibleSeries` as appropriate.

Migration is mechanical and localised — the full list above is the complete surface area.

## Reference code consulted

| Repo                                                                                  | Keep                                                                 | Change                                       |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| `mplsoccer` — `fill_between`                                                          | Sign-based fill colour semantics                                     | Declarative API, three-kind union            |
| `d3-shape` / `d3-array` — `d3.area`, scale utilities                                  | Path topology; Liang-Barsky clipping                                 | No `curve` param in v1                       |
| `ref_code/football_viz/trendline/` — CI band idiom                                    | `hidden` flag covers phantom-series pattern                          | —                                            |
| `ggplot2` — `geom_hline` / `geom_vline` / `geom_abline` / `geom_rect` / `geom_ribbon` | Naming convention; `geom_abline` informs `diagonalFromLinear` helper | Three kinds, not the full ggplot geom family |
| `packages/react/src/compute/xg-timeline.ts`                                           | Learned `label` usefulness; rejected SVG-space pre-projection        | —                                            |

## Edge-case matrix

### Bands

| Case                                     | Expected                                                              | Test            |
| ---------------------------------------- | --------------------------------------------------------------------- | --------------- |
| Empty `bands`                            | No-op                                                                 | React smoke     |
| Inverted range                           | Normalise silently                                                    | Compute unit    |
| Range beyond domain                      | Clip to plot area                                                     | Compute unit    |
| Range outside domain                     | Drop + `[band.out-of-domain]`                                         | Compute unit    |
| Zero-width range                         | Drop + `[band.zero-width]`                                            | Compute unit    |
| Mixed-axis bands                         | All render; input-order layering                                      | Compute + React |
| Overlapping bands                        | Later on top                                                          | React snapshot  |
| Narrow band (<24px)                      | `labelPlacement` auto-flips to `"above"`                              | Compute + React |
| Many narrow bands, inside labels collide | Priority-based selection; suppression emits `[band.label-suppressed]` | React visual    |
| Multibyte / emoji label                  | Renders without mangling                                              | React snapshot  |
| `dualYAxis` on                           | Bands use primary y-axis (non-goal for y2)                            | Doc + React     |

### Reference lines

| Case                                                      | Expected                                                                                                                                                                                                                     | Test           |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Horizontal y outside domain                               | Drop + `[reference.out-of-domain]`                                                                                                                                                                                           | Compute unit   |
| Vertical x outside domain                                 | Drop + `[reference.out-of-domain]`                                                                                                                                                                                           | Compute unit   |
| Diagonal `from === to`                                    | Drop + `[reference.degenerate]`                                                                                                                                                                                              | Compute unit   |
| Diagonal both endpoints outside, chord intersects         | Clip via Liang-Barsky; render clipped segment                                                                                                                                                                                | Compute unit   |
| **Diagonal both endpoints outside, chord grazes corner**  | Drop + `[reference.no-plot-intersection]`. Rationale: a single-point reference line is visually indistinguishable from noise and has no meaningful label anchor — rendering it as a point-mark would be worse than dropping. | Compute unit   |
| Diagonal fully inside plot                                | Render as-is                                                                                                                                                                                                                 | React snapshot |
| Label position requires extending outside plot-area       | Permitted                                                                                                                                                                                                                    | React snapshot |
| Reference used as envelope target (`series-to-reference`) | Body renders behind series, envelope fills correctly, label on top                                                                                                                                                           | React snapshot |

### Envelopes

| Case                                                                | Expected                                                                 | Test                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| `series-pair` unknown id                                            | Drop + `[envelope.unknown-series]`                                       | Compute unit                               |
| `series-pair` disjoint x                                            | Drop + `[envelope.no-overlap]`                                           | Compute unit                               |
| `series-pair` identical bounds                                      | Zero-width fill, no crossover maths                                      | Compute unit                               |
| `series-pair` sign alternates                                       | Crossovers + two-colour split                                            | Compute + React                            |
| `series-pair` sparse x on one side                                  | Merged-grid interpolation; single polygon                                | Compute unit                               |
| `center-offset` length mismatch                                     | Drop + `[envelope.bounds-mismatch]`                                      | Compute unit                               |
| `center-offset` upper < lower at >50%                               | Render normally + `[envelope.inverted-bounds]`                           | Compute unit                               |
| `series-to-reference` unknown reference                             | Drop + `[envelope.unknown-reference]`                                    | Compute unit                               |
| `series-to-reference` with vertical reference                       | Drop + `[envelope.vertical-reference]`                                   | Compute unit                               |
| `series-to-reference` with horizontal reference                     | Envelope between series and constant y                                   | Compute + React                            |
| `series-to-reference` with diagonal reference                       | Envelope between series and linear y(x); **Lorenz case**                 | React snapshot (canonical acceptance test) |
| `series-to-reference` with `referencesStyle.show` → false on target | Reference body suppressed; envelope still renders from declared geometry | Compute + React                            |
| Hidden series referenced by envelope                                | Envelope renders; no `[hidden.extends-*]` warning                        | Compute unit                               |
| Hidden series NOT referenced by envelope, extends domain            | `[hidden.extends-*]` warning fires                                       | Compute unit                               |
| Envelope whose source series gets truncated                         | `[envelope.truncated]` emitted                                           | Compute unit                               |

### `series[].hidden`

| Case                                                      | Expected                                              | Test         |
| --------------------------------------------------------- | ----------------------------------------------------- | ------------ |
| Hidden extends x-domain, not referenced                   | Warning fires                                         | Compute unit |
| Hidden extends x-domain, referenced by envelope           | No warning                                            | Compute unit |
| All-hidden chart                                          | Empty state                                           | React test   |
| Palette indices skip hidden                               | Visible #2 gets palette[1] even if input #1 is hidden | Compute unit |
| Hidden with `trendline: true`                             | No trendline computed                                 | Compute unit |
| `highlightSeries` → hidden id                             | Ignored + `[highlight.hidden-target]`                 | Compute unit |
| `totalSeries` / `dataSeries` / `visibleSeries` accounting | All three correct                                     | Compute unit |
| `accessibleLabel` uses visibleSeries                      | A11y test                                             | —            |

### Cross-concern

| Case                                                                           | Expected                                                                               | Test                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------ |
| All layers + trendlines                                                        | Z-order per spec                                                                       | React snapshot                             |
| Theme switch                                                                   | Theme-driven defaults                                                                  | Visual regression                          |
| Static-mode / SSR                                                              | All render; no hover                                                                   | Static snapshot                            |
| **Lorenz** (diagonal reference + series-to-reference envelope + visible curve) | Diagonal dashed visible on top of shading; curve on top of all; single source of truth | React snapshot (canonical acceptance test) |

## Pre-implementation prep

### Demo scenarios for `apps/site/src/pages/linechart.astro`

1. Baseline — unchanged.
2. **Required-rate pace** — 2023–24 PL actual vs top-4 pace.
3. **Aging curve ± σ** — synthetic position-group curve + player overlay via `envelopeCenterOffset()`.
4. **Rolling form CI** — 10-match rolling xG/90 with ± σ via `envelopeCenterOffset()`.
5. **Elo river with zones** — rolling rating + zone bands + `managerEventRef()` helpers.
6. **Lorenz curve** — visible Lorenz + diagonal reference + `series-to-reference` envelope. Canonical acceptance test.

### Fixtures

- `packages/react/test/fixtures/league-table/pl-2023-24-pace.ts` — source `/Volumes/WQ/projects/www/data/` (record path in module).
- `packages/react/test/fixtures/aging-curve/` — FBref position-grouped per-90s.
- `packages/react/test/fixtures/league-table/competitive-balance.ts` — PL final tables 2014–24 for Lorenz.

No adapter work.

## Test requirements

**Compute tests** (`packages/react/test/compute/line-chart.test.ts` + new `line-chart-envelopes.test.ts`):

- Every row in edge-case matrices.
- Every warning code from the table with exact prefix + variable interpolation.
- `meta.totalSeries` / `dataSeries` / `visibleSeries` accounting under every hidden-flag permutation.
- Merged-grid envelope construction (sparse sides, Lorenz topology, crossover splits).
- Liang-Barsky clipping at every corner permutation (including grazing case).
- Legacy `model.events` tests migrated to `model.references`.

**React tests** (`packages/react/test/LineChart.test.tsx` + new primitive tests):

- Full 9-level z-order stack.
- Accessible label composition order.
- Theme switch.
- Smoke + snapshot all 6 demos.
- Lorenz snapshot as canonical z-order test.
- Static-mode parity.
- Migrated `line-events` → `line-references` testIds.

**Accessibility:**

- `@axe-core` on every demo.
- Contrast checks on reference labels against theme defaults.

**Regression fixtures:**

- SVG snapshot for all 6 demos.
- Per-kind snapshot for each reference-line kind.
- Per-kind snapshot for each envelope kind.

## Review plan

- **Loop 1 — spec review:** ✅ v1 (7) → v2 (13) → v3 (8) → v4 (7) → v5 signed off.
- **Loop 2 — implementation review:** focus on merged-grid envelope maths, Liang-Barsky correctness at grazing-corner, `hidden`-flag cross-cuts, warning-code completeness, migration of existing `events` consumers.
- **Loop 3 — release-readiness:** theme integration, static-mode parity, a11y validation, demo polish, confirm no test regressions from `validSeries` rename.

## Decisions locked (2026-04-18)

1. **Three envelope kinds:** `series-pair`, `center-offset`, `series-to-reference`.
2. **Three reference-line kinds:** `horizontal`, `vertical`, `diagonal`. `linear` helper only.
3. **`events` removed.** Replaced by `references` + helpers.
4. **`validSeries` split** into `dataSeries` + `visibleSeries`.
5. **Hidden series** participate in domain inference; `[hidden.extends-*-domain]` warning always fires (no suppression) — consumers filter by code if expected. Over-suppression is worse than noise.
6. **`fillPositive` / `fillNegative`** signed semantics locked; `center-offset` majority-inversion fires warning.
7. **Merged x-grid envelope rule** — single sweep, linear interpolation, single polygon.
8. **Z-order** — reference-line bodies below series, labels above; envelopes below references.
9. **Narrow-band label placement** auto-flips to `"above"` below 24px; inside-label collisions resolved by `labelPriority` with suppression warning.
10. **Warning codes** are public contract; prose prose may evolve. `meta.warnings` stays `string[]`.
11. **`accessibleLabel` order** — visible series → bands → references → envelopes.
12. **Helper `extra` params** use `Omit<>` to prevent overriding computed fields.
13. **Primitive demo pages** shipped on `primitives.astro`, API-only.
14. **`XGTimeline` migration** explicitly not in scope.
15. **ScatterPlot / Distribution / Beeswarm adoption** deferred.
16. **Linear interpolation only** in v1.
17. **Structured-object warnings** deferred; `[code]` prefix convention adopted instead.
18. **Migration list** is exhaustive — no other files touch `events` / `validSeries`.

## Open questions

1. **Performance at 1000+ points per bound.** Merged-grid is `O((n + m) log(n + m))` for sorted union. Should be fine; Loop 2 benchmarks with a dense fixture.
2. **Helper placement.** Ship inside `@withqwerty/campos-react` for now. Revisit if helper count grows beyond ~10.
3. **Re-export of model types** from main entry — yes, users need them for typed helpers.
