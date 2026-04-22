# BumpChart Component Spec

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `BumpChart` (public chart component)
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer (`computeBumpChart`)
  - `@withqwerty/campos-react` renderer seams (`ChartFrame`, `ChartCartesianAxes`, `ChartLegend`, `ChartTooltip`, `ChartPointMark`, empty-state primitives)

## Purpose

- What user task this solves:
  - track ordinal rank over time for league tables, form-table slices, and other discrete progression stories
- Why it belongs in Campos:
  - bump charts are a common football editorial/scouting format and need a publishable zero-config implementation with honest label, legend, and fallback behavior
- Why it should be public:
  - the rank-domain inference, line construction, highlight handling, and end-label logic are chart semantics, not page glue

## Domain framing

### Football concept

`BumpChart` models a **rank-over-time football story** for teams, players, or
other entities across discrete snapshots such as matchdays or seasons.

It is not:

- a league-table calculator
- a generic line chart with arbitrary y semantics
- a provider-data parser

### Bounded-context ownership

- consumer/app code owns:
  - the source aggregate rows
  - how ranks are computed
  - which entity and time labels are shown
- `react` owns:
  - line construction
  - ordinal-axis semantics
  - highlight/dimming behavior
  - start/end label treatment
- `schema` and `adapters` do not own a first-class `BumpChart` canonical type
  today

### Canonical input model

The component expects already-prepared rank rows keyed by entity and timepoint.

That is an aggregate chart packet, not a provider-normalized football event
model.

### Invariants

- rank remains an ordinal football read, not a continuous metric
- one visual series represents one entity across timepoints
- highlight behavior changes emphasis, not the underlying ranking semantics
- provider parsing and rank computation happen upstream of the component

## Public API

### Zero-config happy path

```tsx
import { BumpChart } from "@withqwerty/campos-react";

<BumpChart rows={rows} />;
```

This renders a publishable rank-over-time chart with:

- smooth interpolation by default
- rank guides
- point markers
- end labels
- highlight-aware dimming
- empty-state handling

### Current public surface

`BumpChartProps` combines the compute input with renderer-only seams:

- base data/layout inputs from `ComputeBumpChartInput`
  - `rows`
  - `highlightTeams`
  - `interpolation`
  - `showMarkers`
  - `showEndLabels`
  - `showStartLabels`
  - `showGridLines`
  - `rankDomain`
  - `teamColors`
  - `timepointLabel`
  - `rankLabel`
  - `markerRadius`
  - `backgroundOpacity`
- browser/runtime seams
  - `teamLogos`
  - `renderEndLabel`
  - `methodologyNotes`
  - `staticMode`
- first-class style injection seams
  - `lines`
  - `points`
  - `labels`
  - `guides`

### Advanced customization points

- `highlightTeams` is the main editorial emphasis control
- `teamColors` provides stable brand mapping when the default palette is not acceptable
- `lines`, `points`, `labels`, and `guides` accept constant values, keyed-map shorthands, and callbacks
- `teamLogos` and `renderEndLabel` are advanced browser-only identity seams for richer end labels
- `methodologyNotes` uses the shared chart-frame note contract instead of bespoke page chrome
- `staticMode` switches to deterministic SVG labels for no-hover and export-adjacent contexts

### Export / static posture

- `BumpChart` is part of the stable `ExportFrameSpec` chart union
- the export-safe prop surface is narrower than the live React surface:
  - constant-only style values
  - no `methodologyNotes`
  - no `teamLogos`
  - no `renderEndLabel`
- `staticMode` is the preferred live-component path when a page needs deterministic output without hover

### Filtering

Filtering follows `docs/standards/filtering-standard.md`, but for `BumpChart` it is usually upstream of the chart:

- consumers pass already-selected rows
- canonical future filter dimensions are `team`, `competition`, and time-window selection
- `highlightTeams` is visual emphasis, not filtering
- built-in filter UI is out of scope for v0.3 alpha

### Explicit non-goals

- computing league tables from raw match events inside the component
- generic time-series chart behavior
- arbitrary child layers inside the plot
- animation / playback UI
- per-team interpolation modes
- export support for arbitrary custom end-label renderers or logo HTML

## Required normalized data

| Field          | Required | Why                             | Fallback if missing                  |
| -------------- | -------- | ------------------------------- | ------------------------------------ |
| `team`         | yes      | line identity and grouping      | row excluded                         |
| `timepoint`    | yes      | x-axis position                 | row excluded                         |
| `rank`         | yes      | y-axis position (inverted)      | row excluded                         |
| `label`        | no       | display name for visible labels | use `team`                           |
| `value`        | no       | tooltip enrichment              | tooltip shows rank only              |
| `displayValue` | no       | custom tooltip copy             | format `value` if present, else omit |

Also state:

- provider support now:
  - indirect only; any provider can support BumpChart after standings/rank aggregation
- partial / unsupported:
  - none at the chart layer, but adapters do not currently emit ready-made BumpChart rows
- acceptable lossy mappings:
  - upstream rank derivation from points/goal-difference tables is acceptable if documented outside the chart

## Default visual contract

### Layout

- landscape plot region
- inverted y-axis (`1` at the top)
- horizontal guide lines at each visible rank
- end labels outside the right edge by default

### Encodings

- x-position encodes timepoint
- y-position encodes rank
- line color encodes team identity
- dimming encodes highlight/background status
- point markers reinforce exact sampled ranks
- smooth interpolation is the default presentation, with `"linear"` available for a stricter editorial read

### Legend behavior

- when end labels are shown, the chart usually does not need a separate legend
- when end labels are hidden, the component falls back to a legend rather than silently losing identity

### Tooltip / interaction behavior

- hover and focus on markers show team, timepoint, rank, and optional value rows
- if markers are hidden, the line layer stays keyboard-focusable so tooltip access remains possible

### Empty state

- no visible lines or markers
- explicit `No ranking data` message

### Fallback / degraded behavior

- one-team datasets are valid but warning-worthy
- invalid rows are excluded with warnings from the compute layer
- dense end-label collisions are stacked rather than left to overlap
- narrow containers should preserve the line read before secondary annotation density

## Internal primitives required

| Primitive / seam        | Status   | Notes                                                                 |
| ----------------------- | -------- | --------------------------------------------------------------------- |
| `computeBumpChart`      | existing | owns rank-domain inference, line models, warnings, labels, and legend |
| `ChartCartesianAxes`    | existing | shared Cartesian axis renderer                                        |
| `ChartFrame`            | existing | shared composition shell for legend + methodology notes               |
| `ChartLegend`           | existing | used when end labels are hidden                                       |
| `ChartTooltip`          | existing | shared tooltip surface for marker and line-focus interaction          |
| `ChartPointMark`        | existing | marker renderer for visible ranks                                     |
| HTML/SVG end-label seam | existing | HTML overlay in live mode, SVG text in `staticMode`                   |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                                   | Why relevant                        | What it covers                            | What Campos should keep                                              | What Campos should change                                                       |
| ----------------------------------------------- | ----------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `mplsoccer/examples/bumpy_charts/plot_bumpy.py` | strongest football-viz prior art    | line emphasis, markers, inverted ranking  | bump-chart framing, marker-per-point convention, smooth trajectories | React/SVG renderer, stronger accessibility, responsive notes, export-safe split |
| `mplsoccer/mplsoccer/bumpy_chart.py`            | implementation-level behavior check | label placement, upside-down rank mapping | rank-at-top semantics and multi-team comparison framing              | avoid matplotlib-specific API assumptions and styling surface                   |

Campos intentionally diverges by:

- exposing callback-first style seams instead of matplotlib kwargs
- keeping methodology notes and chart-card composition inside shared React seams
- treating export/static support as an explicit contract rather than incidental output

## Edge-case matrix

- empty data:
  - show explicit empty state and no legend noise
- one row / one team:
  - render a valid line and keep accessibility text honest
- timepoint gaps:
  - if a team is missing one or more timepoints that other teams have, the line is drawn through the gap with no visual cue (smooth or linear interpolation across the missing matchweeks). The compute layer emits a warning naming up to 3 affected teams. Consumers should be aware that the chart silently implies known rank at timepoints where the data is absent
- dense overlap:
  - preserve label stacking and highlight readability
- mixed-null optional values:
  - keep the chart valid; only tooltip richness degrades
- invalid / out-of-range ranks:
  - exclude with warnings rather than draw misleading geometry
- long / multilingual text:
  - end labels truncate using grapheme-aware slicing (`Array.from`) to avoid tearing surrogate pairs (emoji flags, astral-plane glyphs). Full identity stays available via tooltip/focus
- touch / mobile interaction:
  - narrow containers preserve lines first; interaction must not depend on tiny hover-only affordances
- degenerate legend / identity:
  - when end labels are hidden, legend fallback must appear
- export/static:
  - no callback or mapped style values in `ExportFrameSpec`; no custom HTML label seams (`renderEndLabel`, `teamLogos` are both rejected at runtime)

## Demo requirements

- required page path:
  - `apps/site/src/pages/bumpchart.astro`
- minimum story coverage:
  - hero/default
  - empty
  - sparse
  - dense
  - long / multilingual labels
  - responsive width pressure
  - theme
  - export/static
  - line-only interaction fallback
  - advanced browser-only label seam (`teamLogos` / `renderEndLabel`)

## Test requirements

- compute tests:
  - empty input
  - single-team validity
  - line construction for multiple teams
  - smooth vs linear interpolation
  - rank inversion
  - highlight truncation
  - end-label overlap handling
  - invalid-row exclusion
- React tests:
  - accessible label contract
  - empty state
  - visible end labels
  - static-mode SVG labels
  - point/label/guide style injection
  - tooltip on focus
  - legend fallback when end labels are hidden
  - keyboard parity when markers are hidden
  - custom end-label seam coverage
- site verification:
  - page builds cleanly and documents export/static limits honestly

## Review plan

- loop 1:
  - keep the spec aligned with the live React-first API and export posture
- loop 2:
  - verify docs, demo states, and tests match shipped behavior
- loop 3:
  - verify static/export, responsive width pressure, and keyboard interaction remain publishable

## Open questions

- whether BumpChart needs a stronger shared responsive demo pattern for non-pitch wide charts
- whether additional adapter-side standing aggregators should be tracked separately for future scouting/table workflows
