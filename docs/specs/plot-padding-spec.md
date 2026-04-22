# Plot padding — consistent axis-gutter + optional domain-pad across point-plotting charts

**Status:** draft v3 — planning only
**Date:** 2026-04-19
**Target version:** v0.2.x (pre-release, free to break contracts)
**Scope:** every Campos component with a cartesian plot area (see §Component audit)

## Problem

Two closely-related but distinct failure modes:

1. **Marker clipping.** Data at the domain extremes (e.g. matchweeks 1..7, y∈[0.9, 1.8]) puts markers exactly on the plot-area edge. The axis line bisects the first marker; the top marker gets sliced by the upper frame. See reported example: `/linechart` rolling-form variant at 7-point data.
2. **Tight axis framing.** Some users want visible "breathing room" in the _axis itself_ — data ends at 1.8, axis extends to 1.9 or 2.0. This is editorial judgement, not correctness.

v1 of this spec conflated both problems into a single `xDomainPadding` API with fractional units. The simpler fix for problem 1 is **not to touch the domain at all** — push the axis rendering outward by a few pixels (the "axis gutter" idiom from Observable Plot's `inset` and common d3 patterns). Problem 2 needs real domain-padding (ggplot-style `expand`/`mult`, matplotlib `margins`).

## Prior art

Two clearly-distinct idioms in the field:

**Domain padding** (mutate what the scale sees):

- **matplotlib** `Axes.margins(x=0.05, y=0.05)` — fraction, default 5%
- **ggplot2** `scale_*_continuous(expand = expansion(mult, add))` — combined fraction + absolute, default `mult=c(0.05, 0.05)` continuous / `add=c(0.6, 0.6)` discrete
- **Highcharts** `minPadding` / `maxPadding` — fraction of axis length, default 0.05
- **Recharts** `domain={["dataMin - 5", "dataMax + 5"]}` — expression strings, data units
- **d3** — no built-in; community patterns mutate the domain tuple before passing to the scale (`padLinear([x0, x1], k)`)

**Axis gutter** (leave the scale alone; shift axis rendering):

- **Observable Plot** `inset`, `insetLeft/Right/Top/Bottom` — pixels, shrinks the range
- **Classic d3 pattern** — `axis.attr("transform", translate(-7, 0))` to push the axis outward; plot content stays bound to `plotArea`

The two idioms solve overlapping-but-different problems:

| Goal                                                            | Domain pad                                          | Axis gutter                                          |
| --------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| First/last markers clip the frame                               | ✅ (indirectly — widens domain so data sits inside) | ✅ (direct — plot rect stays larger than axis frame) |
| Axis labels reach round numbers above/below data                | ✅                                                  | ❌ (axis still reads exactly the data extent)        |
| Need clamping to prevent silly values (e.g. axis going below 0) | ✅                                                  | ❌ (domain untouched — no clamp possible)            |
| Changes axis tick positions                                     | ✅                                                  | ❌                                                   |

**Insight:** Campos's reported failure mode is purely #1. Axis gutter solves it without clamp semantics, without tick re-computation, without data-scale-dependent magic numbers. Domain padding stays available for the editorial-breathing-room case, as an opt-in fraction with clamps.

## API (two distinct props, two distinct purposes)

Every in-scope chart gains both. The two are composable — users can enable axis gutter AND domain padding together, though typically one or the other is enough.

### 1. `axisPadding` — cosmetic pixel gutter (default ON)

```ts
type AxisPadding =
  | number // symmetric: pixel gutter applied to both axes
  | readonly [x: number, y: number] // per-axis pixel gutter
  | false; // opt-out

export type AxisGutterProps = {
  axisPadding?: AxisPadding;
};
```

**Default: `6` (px both axes).** Domain is untouched. Axis lines + ticks render `6px` outside the plot-area rect, leaving breathing room between data markers and the visible axis. The plot-area rect itself extends to the same widened bounds, so markers draw fully on the first/last data points.

**Semantics:**

- The _scale's range_ keeps mapping to the full viewBox inner rect (just as today).
- The _axis rendering_ (lines, ticks, tick labels) shifts outward by `gutter` pixels from the scale's range bounds on each relevant side.
- Grid lines stay aligned to the scale (not the shifted axis), so the first/last grid line sits inside the gutter — identical to today's appearance for internal grid lines.
- No domain mutation. No clamp needed. No tick re-compute. Safe to enable by default.

**Why `[x, y]` and not `[top, right, bottom, left]`:** Campos charts are left+bottom-axis only. Two values (one per axis) is enough; if dual-y lands later, extend to a four-tuple then.

### 2. `xDomainPadding` / `yDomainPadding` — data-story domain pad (default OFF)

```ts
type DomainPaddingSpec = number
  | readonly [lower: number, upper: number]
  | { mult?: number | readonly [number, number];  // fraction of nice-range
      add?: number | readonly [number, number] }; // absolute data units
  | false;

export type DomainPaddingProps = {
  xDomainPadding?: DomainPaddingSpec;
  yDomainPadding?: DomainPaddingSpec;
  xDomainClamp?: readonly [number | null, number | null];
  yDomainClamp?: readonly [number | null, number | null];
};
```

**Default: `false` (opt-in).** When set, the nice-axis domain is widened per ggplot2's model — fractional `mult` (e.g. `0.05` = 5% of nice-range) plus absolute `add` (in data units). A bare `number` is shorthand for `{ mult: N }`. A `[lower, upper]` tuple is shorthand for `{ mult: [lower, upper] }`.

**Resolution order:**

1. Explicit `xDomain` / `yDomain` override → padding ignored on that axis.
2. Auto-domain from data.
3. `nice-ticks` — produces candidate `[tickMin, tickMax]`.
4. Apply padding: `tickMin - (mult_lower * range + add_lower)` and equivalent upper.
5. Apply clamp: if padded value crosses `clamp[0]`/`clamp[1]`, snap to the clamp.
6. Re-run `nice-ticks` on the widened domain so ticks still land on clean values.

**Clamp shape** `[min | null, max | null]`: mirrors ggplot2's `limits = c(0, NA)`. `null` on a side means no clamp on that side. Distinct from d3's `clamp` (which means value-mapping boundary enforcement — different concept).

**Why combined `mult + add`:** tiny-range-near-zero case (e.g. y∈[0.01, 0.03], 5% mult ≈ 0.001) where a user wants a minimum-of-0.5-data-units breathing room regardless of scale. ggplot has used this for 10+ years; no reason to reinvent.

## Render-time implementation sketch

### Axis gutter

In the compute layer, nothing changes — the scale continues to map the data domain to the plot-area range as today.

In the renderer (per chart):

```ts
const gutterX = resolveGutter(axisPadding, "x"); // px
const gutterY = resolveGutter(axisPadding, "y");

// Axis renders shifted outward from plotArea.
<g transform={`translate(0, ${gutterY})`}>
  <XAxis domain={model.axes.x.domain} ticks={model.axes.x.ticks} />
</g>
<g transform={`translate(${-gutterX}, 0)`}>
  <YAxis domain={model.axes.y.domain} ticks={model.axes.y.ticks} />
</g>

// Plot rect extends the full (non-shifted) bounds so markers at the edge draw fully.
<rect {...plotArea} fill={theme.surface.plot} />
```

Dev note: the tick-label text may collide with the extended plot rect if labels sit inside the gutter. In practice axis labels render below/left of the axis line, so gutter pushes them further out — non-issue. Confirm during implementation.

### Domain padding

In the compute layer, `createNumericAxis` gains optional padding + clamp params. The `nice-ticks` re-fire is one extra call. Existing `xDomain` override bypasses the whole block.

## Component audit — exhaustive

All 21 v0.2 React components classified.

### In scope — both gutter + domain-pad API

| Chart                      | `axisPadding` default             | Domain-pad default | Clamp default | Notes                                                                                       |
| -------------------------- | --------------------------------- | ------------------ | ------------- | ------------------------------------------------------------------------------------------- |
| **LineChart**              | `6`                               | `false`            | —             | Primary driver. Also gets the clipPath fix (markers lifted out of series-clip group).       |
| **ScatterPlot**            | `6`                               | `false`            | —             | Already renders markers un-clipped.                                                         |
| **CometChart**             | `6`                               | `false`            | —             | Gutter covers both comet head + trail.                                                      |
| **Beeswarm**               | `[0, 6]` (pack axis discrete)     | `false`            | —             | Pack axis is categorical; no gutter on it.                                                  |
| **BumpChart**              | `6`                               | `false`            | —             | Integer-stepped axes; gutter is still useful because rank-1 marker clips the top otherwise. |
| **XGTimeline**             | `[0, 6]` (x bound by match clock) | `false`            | —             | X is a fixed timeline with compression bands; don't shift.                                  |
| **DistributionChart**      | `6`                               | `false`            | —             |                                                                                             |
| **DistributionComparison** | `6`                               | `false`            | —             | Per-row value axis.                                                                         |
| **SmallMultiples**         | inherits from cell chart          | inherits           | inherits      | Pass-through.                                                                               |

### Out of scope — pitch-anchored (fixed 0..100 canonical frame)

ShotMap, PassMap, PassFlow, PassNetwork, Heatmap, Territory, KDE, Formation, GoalMouthShotChart. The pitch is the bound; no gutter semantic.

### Out of scope — polar / radial

RadarChart, PizzaChart. Different geometry; revisit if ever requested.

### Out of scope — no plot area

StatBadge.

**Total classified:** 21 (matches `packages/react/src/*.tsx` minus `ThemeContext`).

## Warnings (public contract)

| Code                | Message template                                                                                      | Fires when                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[padding.clamped]` | `[padding.clamped] ${axis}-domain padding would extend to ${paddedValue}; clamped to ${clampedValue}` | Domain-padding pushed past a clamp boundary. Only fires when `xDomainPadding`/`yDomainPadding` is set — the default-OFF state never triggers it. |

Axis-gutter does not need a warning — it can't produce nonsensical output.

## Migration

Pre-release, so no deprecation path.

1. Add `axisPadding` to every in-scope chart's props. Default `6`. This shifts rendered axis lines by 6px in existing charts — acceptable baseline move. Site visual regression will show 6px axis inset everywhere; accept as the new baseline.
2. Add `xDomainPadding`, `yDomainPadding`, `xDomainClamp`, `yDomainClamp` as opt-in. Default `false` — no automatic behaviour change.
3. The existing `clipPath` bug in LineChart (markers clipping inside `<g clipPath="...">`) becomes a smaller issue once `axisPadding` lands, because the plot-area rect widens by 6px. But the clip-group still chops markers at the _data_ edge if the user sets explicit `xDomain`/`yDomain` exactly matching their data. So lift markers out of the series clip group as a separate fix.

## Tests

### Axis gutter

- Default `axisPadding=6` shifts axis rendering 6px from plot-area edge on every in-scope chart.
- `axisPadding=0` (or `false`) reproduces today's behaviour.
- `axisPadding=[0, 6]` on Beeswarm/XGTimeline only shifts the y-axis.
- Asymmetric clamp (`axisPadding=[3, 9]`) honours per-axis values.
- Tick labels still align with their tick values after the shift.
- LineChart: markers at exact data boundary render fully (combined with clipPath fix).

### Domain padding

- `xDomainPadding: 0.05` widens nice-axis by 5% on each side.
- `xDomainPadding: [0.1, 0]` widens only the lower bound.
- `xDomainPadding: { mult: 0.05, add: 0.5 }` stacks both components.
- `yDomainClamp: [0, null]` prevents negative lower bound, emits `[padding.clamped]`.
- Explicit `xDomain` override bypasses padding entirely.
- `nice-ticks` re-fires — widened axis shows clean round ticks, not `0.82`/`1.82`.

### Cross-concern

- Both enabled together — gutter + padding compose correctly (padding widens domain, gutter pushes axis outside padded domain).
- `SmallMultiples` inherits both props into cells.
- Visual smoke on `/linechart`, `/scatterplot`, `/cometchart`, `/beeswarm`, `/bumpchart`, `/xgtimeline`, `/distributionchart`, `/small-multiples`.

## Open questions

1. **Default axis-gutter value.** `6` is Observable Plot's convention and matches default marker radius × 2 + 1px. Alternatives: `4` (tighter), `8` (more generous). **Proposed: 6** — validate in implementation review.
2. **Clamp interaction with `nice-ticks` re-fire.** If clamp absorbs the padded-min, re-ticks might produce an uneven step around the clamp. **Proposed:** clamp wins; accept the one-off uneven step rather than reshape data-story.
3. **`{ mult, add }` object discoverability.** Less common than bare number or tuple. Might only surface in docs. **Proposed:** keep the long form; it's the escape hatch for the tiny-near-zero case.
4. **BumpChart rank-axis clamp.** Rank can't go below 1. Default `yDomainClamp: [1, null]` when `yDomainPadding` is set? **Proposed:** no — stay consistent (default clamp = none); users wanting rank clamp set it explicitly.

## Rollout

1. Prototype axis-gutter on LineChart — fix the reported bug, confirm no regressions. Ship as a small standalone packet (can land without domain-padding).
2. Extend axis-gutter to the other 8 in-scope charts in one sweep.
3. Prototype domain-padding on LineChart + ScatterPlot — verify the shared `createNumericAxis` extension.
4. Extend domain-padding to the remaining in-scope charts.
5. Update per-chart specs + `/demos` hero fixtures (likely no demo changes needed; defaults are already sensible).
6. Visual verification pass for each chart page.

## Why this shape beats v1/v2

- v1 conflated marker clipping with editorial framing; forced every user to reason about clamp values for a purely-cosmetic fix.
- v2 switched to `[lower, upper]` tuples (good) but kept the single API for both problems (bad).
- v3 splits the problems. Default-on `axisPadding` fixes the reported bug for everyone with zero configuration. `xDomainPadding` stays available for users who want ggplot-style axis extension, with proper clamp safety.

No magic fraction. No "why 0.02?" to defend. The pixel value is a direct answer to the direct question: "how much breathing room do markers need?"
