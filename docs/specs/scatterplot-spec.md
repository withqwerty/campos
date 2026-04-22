# ScatterPlot Component Spec

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `ScatterPlot` (public chart component)
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer (`computeScatterPlot`)
  - `@withqwerty/campos-react` renderer seams (`ChartFrame`, `ChartCartesianAxes`, legend primitives, `ChartTooltip`, `ChartPointMark`, empty-state primitives)

## Purpose

- What user task this solves:
  - compare two numeric dimensions for teams, players, or other football entities at a single analytical snapshot
- Why it belongs in Campos:
  - football analytics frequently needs non-pitch metric-pair charts, and the library should provide a publishable default rather than forcing consumers into a generic charting library
- Why it should be public:
  - label strategy, guide behavior, ghosting, legend composition, and region semantics are chart-level product behavior, not consumer glue

## Domain framing

### Football concept

`ScatterPlot` models a **two-metric football snapshot** for one set of entities
at one analytical moment.

It is not:

- a raw event viewer
- a time-series chart
- the owner of football metric computation

### Bounded-context ownership

- consumer/app code owns:
  - the entity set
  - metric derivation
  - labels and annotation choices upstream
- `react` owns:
  - axis, guide, region, and label behavior
  - ghosting and legend composition
  - publishable defaults for the analytical read
- `schema` and `adapters` may inform upstream aggregates, but they do not own a
  first-class `ScatterPlot` packet

### Canonical input model

The component expects aggregate point rows with stable identity plus numeric
`x`/`y` fields already prepared upstream.

### Invariants

- one point represents one entity at one snapshot
- `x` and `y` remain explicit analytical metrics, not implicit provider fields
- regions and guides annotate the analytical read; they do not replace the base
  metric semantics
- provider parsing and metric computation remain outside the component

## Public API

### Zero-config happy path

```tsx
import { ScatterPlot } from "@withqwerty/campos-react";

<ScatterPlot points={points} xKey="xg" yKey="shots" />;
```

This renders a publishable Cartesian scatter chart with:

- auto domains and ticks
- marker rendering
- tooltip behavior
- optional legends when encodings require them
- empty-state handling

### Current public surface

`ScatterPlotProps<T>` combines the compute input with renderer-only seams:

- base data/layout inputs from `ComputeScatterPlotInput<T>`
  - `points`
  - `idKey`
  - `xKey`
  - `yKey`
  - `xLabel`
  - `yLabel`
  - `labelKey`
  - `labelStrategy`
  - `autoLabelCount`
  - `labelIds`
  - `ghost`
  - `guides`
  - `regions`
  - `referenceLine`
- live React/runtime seams
  - `methodologyNotes`
  - `staticMode`
- first-class style injection seams
  - `markers`
  - `regionStyle`
  - `guideStyle`
  - `labelStyle`

### Advanced customization points

- `markers` is the main point-level style surface
- `guides` and `guideStyle` are the main analytical overlay surface
- `regions` and `regionStyle` own quadrant/band semantics
- `labelStrategy`, `labelIds`, and `labelStyle` control annotation density and visible label treatment
- `ghost` keeps full-population context without making every point visually equal
- `methodologyNotes` uses the shared chart-frame note contract instead of chart-local prose props
- `staticMode` switches to the deterministic no-hover SVG path used by the export renderer

### Export / static posture

- `ScatterPlot` is part of the stable `ExportFrameSpec` chart union
- the export-safe surface is narrower than the live React surface:
  - constant-only values for `markers`, `regionStyle`, `guideStyle`, and `labelStyle`
  - no `methodologyNotes`
- `staticMode` is the live-component path when the same chart needs to remain meaningful without hover

### Filtering

Filtering follows `docs/standards/filtering-standard.md`, but for `ScatterPlot` it is usually upstream of the chart:

- consumers pass already-selected points
- canonical future filter dimensions are stable category/grouping fields already present in the plotted dataset
- guide choice, region choice, and axis-key choice are configuration, not filtering
- built-in filter UI is out of scope for v0.3 alpha

### Explicit non-goals

- faceting / small multiples
- lasso / brush selection
- arbitrary scene-graph child injection
- log/custom scales
- built-in app-specific filtering props

## Required normalized data

`ScatterPlot` is dataset-agnostic and metric-pair driven. It does not require a specific football event schema.

| Field            | Required | Why                        | Fallback if missing      |
| ---------------- | -------- | -------------------------- | ------------------------ |
| `xKey` value     | yes      | x-axis position            | point excluded           |
| `yKey` value     | yes      | y-axis position            | point excluded           |
| `idKey` value    | no       | stable identity on reorder | use array index identity |
| `labelKey` value | no       | visible labels / tooltip   | show numeric values only |

Also state:

- provider support now:
  - provider-agnostic by design; consumers can plot any normalized or aggregated football dataset with numeric fields
- partial / unsupported:
  - none at the chart layer
- acceptable lossy mappings:
  - approximate aggregates are acceptable if the page/chart note explains the sample definition upstream

## Default visual contract

### Layout

- landscape Cartesian plot region
- numeric axes
- legends and methodology notes composed through `ChartFrame`

### Encodings

- x-position and y-position encode the chosen metrics
- marker appearance can encode emphasis or categories through the style surface
- regions and guides are analytical overlays, not mandatory furniture

### Legend behavior

- legends appear only when the model has a real encoding to explain
- categorical color, continuous ramps, and size legends use different shared legend primitives

### Tooltip / interaction behavior

- point hover/focus exposes the specific point tooltip
- stable `idKey` should preserve point identity across reorder/rerender cases

### Empty state

- explicit `No plottable data` message
- no fake axes-only story

### Fallback / degraded behavior

- sparse point sets remain valid
- narrow containers should preserve the metric relationship and axis readability before dense annotation survives
- static/no-hover mode should still communicate the main visible labels, regions, and guides

## Internal primitives required

| Primitive / seam     | Status   | Notes                                                                   |
| -------------------- | -------- | ----------------------------------------------------------------------- |
| `computeScatterPlot` | existing | owns domains, legends, marker models, labels, guides, regions, warnings |
| `ChartCartesianAxes` | existing | shared Cartesian axis renderer                                          |
| `ChartFrame`         | existing | shared composition shell for legends + methodology notes                |
| `ChartLegend` family | existing | categorical, size, and gradient legend variants                         |
| `ChartTooltip`       | existing | shared tooltip surface for point interaction                            |
| `ChartPointMark`     | existing | point renderer for static and interactive paths                         |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                                          | Why relevant                                                                                               | What it covers                                                             | What Campos should keep                                                     | What Campos should change                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| No additional direct reference required for this rerun | the review centered on current Campos chart-contract behavior rather than a missing implementation pattern | generic Cartesian scatter conventions were already settled in earlier work | keep the chart-level distinction from CometChart and other non-pitch charts | diverge with explicit React-first style seams and explicit export/static contract notes |

## Edge-case matrix

- empty data:
  - show explicit empty state
- single-point data:
  - degenerate single-value axes are rescued by `expandDegenerateExtent` — the chart renders with artificial padding rather than collapsing. No warning emitted
- non-finite coordinates:
  - points with non-finite `x` or `y` are filtered out before plotting
- sparse data:
  - keep a valid chart with readable labels and tooltip behavior
- dense overlap:
  - label and ghost strategies must keep the main analytical read intact
- reversed region bounds:
  - `x1 > x2` or `y1 > y2` in a region input is normalised via `Math.min/Math.max` and filtered for positive area. No error thrown
- mixed-null optional values:
  - tooltip/labels degrade, chart remains valid
- long / multilingual text:
  - visible labels and connectors stay readable under mixed-script pressure
- touch / mobile interaction:
  - analytical relationship survives before dense annotation does
- degenerate legend / domain:
  - legends only appear when meaningful; empty or uniform encodings should not create noise
- export/static:
  - `staticMode` is a live React prop that suppresses hover/focus interaction while keeping guides, regions, and visible labels meaningful. It is intentionally excluded from `ExportScatterPlotProps` — the stable export contract uses `ScatterPlotStaticSvg` directly
- intentional deletions (pre-alpha):
  - `xDomain` / `yDomain` manual overrides: removed; axis domains are inferred from data with `niceTicks`
  - `grid` toggle: removed; grid lines are not part of the current chart surface
  - `colorPalette` / `colorRamp` / `colorMode` / `sizeRange`: removed with the R1 prop reset; replaced by the `markers` style family
  - `onPointClick` callback: removed; interaction is handled via tooltip/focus, not click handlers
  - `accessibleLabel` consumer override: removed; the accessible label is auto-built from axis labels and point count
  - `headerStats` region: not part of the current ScatterPlot model
  - aspect ratio is now `400×320` (5:4) rather than `1:1`

## Demo requirements

- required page path:
  - `apps/site/src/pages/scatterplot.astro`
- minimum story coverage:
  - hero/default
  - empty
  - dense
  - ghost/context
  - long / multilingual labels
  - dark theme
  - responsive width pressure
  - static/export mode
  - methodology-note composition

## Test requirements

- React tests:
  - shell render and accessible label
  - empty state
  - point tooltip on focus
  - visible labels, guides, and regions
  - stable tooltip identity across point reordering
  - methodology notes
  - marker style injection
  - static SVG path with guide/region/label styling
- site verification:
  - page builds cleanly and documents static/export posture honestly

## Review plan

- loop 1:
  - keep the spec aligned with the live React-first surface and the current export-safe subset
- loop 2:
  - verify docs, page states, and tests match the shipped behavior
- loop 3:
  - verify responsive pressure, dark-theme story, and static/no-hover behavior remain publishable

## Open questions

- whether non-pitch wide charts need a shared responsive demo primitive instead of per-page wrappers
- whether later W1/W2 work should standardize the naming of style-family props across Cartesian charts even further
