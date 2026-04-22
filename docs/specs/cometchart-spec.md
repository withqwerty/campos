# CometChart Component Spec

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `CometChart` (public chart component)
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer (`computeCometChart`)
  - `@withqwerty/campos-react` renderer seams (`ChartFrame`, `ChartCartesianAxes`, `ChartLegend`, `ChartTooltip`, `ChartPointMark`, empty-state primitives)

## Purpose

- What user task this solves:
  - show how teams or players move through a two-metric space over time
- Why it belongs in Campos:
  - temporal scatter trails are a standard football analytics presentation pattern and need a publishable default with honest labeling, tooltip, and guide behavior
- Why it should be public:
  - grouping, temporal ordering, trail emphasis, and latest-point labeling are chart semantics, not consumer glue

## Domain framing

### Football concept

`CometChart` models a **time-ordered movement through a two-metric football
space** for one or more entities.

It is not:

- a generic animation system
- a provider-normalized event model
- a chart that computes football metrics by itself

### Bounded-context ownership

- consumer/app code owns:
  - which metrics are plotted on `x` and `y`
  - how timepoints are derived
  - entity identity and labels
- `react` owns:
  - trail construction
  - temporal ordering semantics
  - latest-point emphasis
  - guide, legend, and label behavior
- `schema` and `adapters` may inform upstream aggregates, but they do not own a
  first-class `CometChart` data product

### Canonical input model

The component expects aggregate point rows with:

- entity identity
- time identity
- numeric `x` and `y` values

That packet should already be computed before it reaches the chart.

### Invariants

- each entity trail is ordered by canonical timepoint semantics
- latest-point labeling depends on that ordering, not on input array position by
  accident
- `x` and `y` are analytical metrics, not raw provider payload fields
- provider parsing and metric derivation remain upstream of the component

## Public API

### Zero-config happy path

```tsx
import { CometChart } from "@withqwerty/campos-react";

<CometChart
  points={points}
  entityKey="team"
  xKey="npxgPer90"
  yKey="npxgaPer90"
  timeKey="season"
/>;
```

This renders a multi-entity comet chart with:

- grouped trail segments
- point markers at each sampled timepoint
- latest-point labels
- optional guides
- legend and tooltip behavior
- empty-state handling

### Current public surface

`CometChartProps<T>` combines the compute input with renderer-only seams:

- base data/layout inputs from `ComputeCometChartInput<T>`
  - `points`
  - `entityKey`
  - `xKey`
  - `yKey`
  - `timeKey`
  - `labelKey`
  - `xLabel`
  - `yLabel`
  - `invertX`
  - `invertY`
  - `guides`
  - `showTimeLabels`
  - `labelStrategy`
  - `labelIds`
- live React/browser seams
  - `logoMap`
  - `methodologyNotes`
- first-class style injection seams
  - `lines`
  - `markers`
  - `labels`
  - `guideStyle`

### Advanced customization points

- `showTimeLabels` is the main “more explicit chronology” toggle
- `labelStrategy` and `labelIds` control annotation density
- `guides` and `guideStyle` are the main analytical overlay surface
- `lines`, `markers`, and `labels` accept constant values, keyed-map shorthands, and callbacks
- `logoMap` swaps circle markers for image markers in the live React renderer
- `methodologyNotes` uses the shared chart-frame note contract instead of chart-local copy props

### Export / static posture

- `CometChart` is intentionally **outside** the current stable `ExportFrameSpec` union
- the stable export contract currently covers 11 chart kinds; `CometChart` is deferred until it has a bounded static/export prop contract
- docs and demos must present `CometChart` as a live React chart today, not as an export-safe chart-card component

### Filtering

Filtering follows `docs/standards/filtering-standard.md`, but for `CometChart` it is usually upstream of the chart:

- consumers pass already-selected entities and time periods
- canonical future filter dimensions are entity identity and time-window choice
- axis-key choice is configuration, not filtering
- built-in filter UI is out of scope for v0.3 alpha

### Explicit non-goals

- generic scatter or time-series chart abstraction
- animation / playback UI
- built-in entity selection controls
- raw event aggregation inside the chart
- stable export/chart-card support before a dedicated packet

## Required normalized data

`CometChart` is aggregate-data driven. Each row represents one entity at one timepoint.

| Field             | Required | Why                         | Fallback if missing   |
| ----------------- | -------- | --------------------------- | --------------------- |
| `entityKey` value | yes      | groups rows into entities   | row excluded          |
| `xKey` value      | yes      | x-axis position             | row excluded          |
| `yKey` value      | yes      | y-axis position             | row excluded          |
| `timeKey` value   | no       | temporal ordering           | use array order       |
| `labelKey` value  | no       | visible/latest-point labels | use `entityKey` value |

Also state:

- provider support now:
  - indirect only; adapters do not emit CometChart rows directly
- partial / unsupported:
  - none at the chart layer, but the consumer or a higher-level aggregation step must shape the time-series points
- acceptable lossy mappings:
  - approximate per-season or per-phase snapshots are acceptable when the page is explicit about what each point represents

## Default visual contract

### Layout

- landscape plot region
- Cartesian axes
- one trail per entity, latest label at the trail end
- legend shown when multi-entity identity needs explanation

### Encodings

- x-position and y-position encode the two chosen metrics
- trail direction encodes time progression within an entity
- markers reinforce the discrete sampled points behind the trail
- latest labels sit near the final point rather than at every intermediate point

### Legend behavior

- multi-entity charts show a legend when identity is not already obvious from labels
- single-entity charts avoid redundant legend chrome

### Tooltip / interaction behavior

- marker hover/focus shows the specific point tooltip, not just the latest point
- trail hover exposes the active entity context
- markers remain keyboard-focusable

### Empty state

- explicit `No data` message
- no fake trails or guides

### Fallback / degraded behavior

- single-entity charts remain valid
- “barely moved” entities collapse to dots instead of exaggerated trails
- narrow containers should preserve the directional read before dense label or guide copy

## Internal primitives required

| Primitive / seam     | Status   | Notes                                                               |
| -------------------- | -------- | ------------------------------------------------------------------- |
| `computeCometChart`  | existing | owns grouping, ordering, trail models, labels, legend, and warnings |
| `ChartCartesianAxes` | existing | shared Cartesian axis renderer                                      |
| `ChartFrame`         | existing | shared composition shell for legend + methodology notes             |
| `ChartLegend`        | existing | shown when multi-entity identity needs explanation                  |
| `ChartTooltip`       | existing | shared tooltip surface for point and trail interaction              |
| `ChartPointMark`     | existing | point/marker renderer, including image-mark rendering via `logoMap` |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                                                                     | Why relevant                                                                                             | What it covers                                            | What Campos should keep                                    | What Campos should change                                                                 |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| No strong direct football-specific CometChart reference in `/Volumes/WQ/ref_code` | the closest analogues are editorial scatter-trail treatments rather than one canonical library component | trajectory-through-metric-space as a storytelling pattern | keep the chart-level distinction from a plain scatter plot | diverge with a clear React-first API, explicit a11y, and explicit export-deferred posture |

## Edge-case matrix

- empty data:
  - show explicit empty state and no fake trail geometry
- one entity:
  - valid chart, no redundant legend
- dense overlap:
  - latest-label strategy must stay readable without over-annotating all points
- mixed-null optional values:
  - point identity falls back to `entityKey`; chart remains valid
- long / multilingual text:
  - latest labels and legend remain legible under mixed-script pressure
- touch / mobile interaction:
  - directional trail read should survive before verbose annotation does
- degenerate legend / identity:
  - single-entity charts hide the legend
- export/static:
  - page/docs must say explicitly that `CometChart` is not yet in the stable export union

## Demo requirements

- required page path:
  - `apps/site/src/pages/cometchart.astro`
- minimum story coverage:
  - hero/default
  - empty
  - single-entity or sparse
  - dense
  - barely-moved / degenerate trail
  - long / multilingual labels
  - dark theme
  - responsive width pressure
  - explicit export-deferred note
  - live React-only image marker seam (`logoMap`)

## Test requirements

- compute / renderer tests:
  - SVG render path
  - trail segments
  - marker render path
  - empty state
  - labels
  - style injection
  - tooltip on marker and trail hover
  - legend behavior
  - keyboard focusability
  - logo-marker seam
  - methodology note seam
- site verification:
  - page builds cleanly and states export-deferred posture honestly

## Review plan

- loop 1:
  - keep the spec aligned with the live React-first surface and export-deferred status
- loop 2:
  - verify docs, page states, and tests match the shipped behavior
- loop 3:
  - verify responsive pressure, theme coverage, and tooltip/focus behavior remain publishable

## Open questions

- whether a future export packet should support a restricted constant-only CometChart subset
- whether non-pitch wide charts need a shared responsive demo primitive rather than per-page wrappers
