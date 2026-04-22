# RadarChart Component Spec

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `RadarChart` (public chart component)
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer (`computeRadarChart`)
  - `@withqwerty/campos-react` renderer seams (`ChartFrame`, shared polar legend/label/tooltip seams)
  - `@withqwerty/campos-adapters` only indirectly, once aggregate rows are prepared upstream

## Purpose

- What user task this solves:
  - present a single profile shape across an ordered set of football metrics
  - answer what kind of player/team this is, not which entity wins a bar-by-bar comparison
- Why it belongs in Campos:
  - radar charts remain a standard football scouting/editorial format even when their comparison limits are well known
- Why it should be public:
  - metric ordering, normalization, single-profile scope, and polar label/legend behavior are chart-level product decisions

## Domain framing

### Football concept

`RadarChart` models a **single football profile across an ordered metric set**.

It is not:

- a raw event viewer
- a multi-entity comparison table
- the owner of football metric computation

### Bounded-context ownership

- consumer/app code owns:
  - which metrics are included
  - how they are computed
  - how they are normalized for display
- `react` owns:
  - polar layout
  - metric ordering behavior
  - range-vs-percentile read
  - legend and label presentation
- `schema` and `adapters` may inform upstream aggregates, but they do not own a
  first-class `RadarChart` canonical type

### Canonical input model

The component expects already-prepared profile rows for one entity, not
provider-normalized event payloads.

### Invariants

- the chart remains a single-profile read by default
- metric order is semantically meaningful, not arbitrary renderer noise
- percentile/range interpretation must be defined upstream before plotting
- the component renders a profile honestly; it does not infer football meaning
  from raw source fields on its own

## Public API

### Zero-config happy path

```tsx
import { RadarChart } from "@withqwerty/campos-react";

<RadarChart rows={rows} />;
```

This renders a publishable single-profile radar with:

- percentile normalization by default
- visible metric labels and optional category legend
- first-class style seams for polygon, guides, and text
- shared chart-frame methodology-note support in the live React path

### Current public surface

`RadarChartProps` combines the compute input with live renderer seams:

- base data/layout inputs from `ComputeRadarChartInput`
  - `rows` (single-profile shorthand)
  - `series` (multi-profile overlay: `[{ id, label, rows, color? }, ...]`)
  - `seriesColors` (palette used to auto-assign colours across series)
  - `metricOrder`
  - `categoryOrder`
  - `valueMode`
  - `showLegend`
  - `showVertexMarkers`
  - `showVertexValues` (renders a coloured value pill at each vertex)
  - `showAxisLabels`
  - `ringStyle`
  - `ringSteps`
  - `bandSteps`
  - `ringColors`
  - `outerRingColors` (full-circle background bands beneath the polygon-clipped layer)
  - `categoryColors`
- first-class style injection seams
  - `areas` (context gains `seriesId`, `seriesLabel`, `seriesIndex`)
  - `guides`
  - `text`
- shared chart chrome
  - `methodologyNotes`

### Advanced customization points

- `valueMode` supports:
  - `"percentile"` as the default football scouting read
  - `"range"` when the consumer has defensible per-axis min/max bounds
- `ringStyle` supports:
  - `"line"` (default) — simple concentric guide rings
  - `"banded"` — full-circle alternating ring bands (StatsBomb-style scoutable background)
  - `"banded-inside-polygon"` — bands clipped to the polygon (StatsBomb classic player-radar look); polygon fill defaults to transparent so the bands read as the polygon fill. `areas.fill` still overrides.
- `ringColors` paints inside-polygon bands in `banded-inside-polygon` mode; paints all bands in `banded` mode.
- `outerRingColors` (optional) paints a full-circle background band layer beneath the polygon-clipped bands — only active when `ringStyle === "banded-inside-polygon"`.
- Banded modes use a denser default `ringSteps` (`[0.1, 0.2, …, 0.9]`) so the scouting-radar read is correct out-of-the-box. `"line"` keeps the original tick-spacing default.
- Spoke tick labels that fall inside the polygon auto-invert to white + bold in `banded-inside-polygon` mode so they stay readable on dense fill colours.
- Range-mode tooltip rows include a `Range: min – max` line (labelled `Range (lower is better)` when a row sets `lowerIsBetter: true`).
- `areas` styles the polygon and optional vertex markers:
  - `fill`
  - `stroke`
  - `strokeWidth`
  - `opacity`
  - `markerFill`
  - `markerStroke`
  - `markerRadius`
- `guides` styles rings and spokes:
  - `ringStroke`
  - `ringStrokeWidth`
  - `spokeStroke`
  - `spokeStrokeWidth`
  - `ringOpacity`
  - `spokeOpacity`
- `text` styles outer metric labels:
  - `fill`
  - `fontSize`
  - `fontWeight`
- `methodologyNotes` provides shared chart-frame note regions for sample, role, and eligibility context

### Export / static posture

- `RadarChart` is part of the stable `ExportFrameSpec` chart union
- the export-safe subset is narrower than the live React surface:
  - constant-only `areas`
  - constant-only `guides`
  - constant-only `text`
  - no `methodologyNotes`
- callback and object-map styling remain valid in-process React usage, but are not the stable serialized export contract

### Filtering

Filtering is upstream of the chart for v0.3 alpha:

- consumers pass already-selected rows
- player/cohort/template selection happens outside the base chart
- legends are explanatory by default rather than filter controls

### Explicit non-goals

- chart-local filter props
- arbitrary center-content slots or portrait-first card composition inside the chart
- implying that live callback styling is automatically export-safe

## Comparison stance

`RadarChart` supports both single-profile and symmetric multi-profile comparison.

- pass `rows` directly for the single-profile case — the canonical scouting read.
- pass `series: [{ id, label, rows }, ...]` for overlaid polygons (e.g. two players compared).
- each series gets its own polygon, hit targets (still keyed by slot index), and legend entry. Default colours come from a blue/red/green palette; individual series can override via `series[i].color`.
- the tooltip at each slot lists values across all series when 2+ are supplied.
- the `banded-inside-polygon` style is not meaningful with more than one series and falls back to the normal `banded`/`line` appearance.
- `showVertexValues` renders a coloured value pill at each vertex — the typical comparison-radar convention where values are labelled inline rather than hidden behind hover.

## Required normalized data

`RadarChart` is aggregate-data driven rather than event-driven.

| Field           | Required               | Why it matters                   | Fallback if missing                            |
| --------------- | ---------------------- | -------------------------------- | ---------------------------------------------- |
| `metric`        | yes                    | axis identity                    | row excluded                                   |
| `value`         | yes                    | plotted value                    | row excluded                                   |
| `percentile`    | yes in percentile mode | preferred football normalization | derive from range inputs if available          |
| `min` / `max`   | yes in range mode      | range normalization              | row excluded if percentile is also unavailable |
| `category`      | no                     | category legend / tinting        | neutral category read                          |
| `lowerIsBetter` | no                     | inversion for negative metrics   | default `false`                                |
| `displayValue`  | no                     | tooltip / note text              | numeric formatting fallback                    |

Also state:

- provider support now:
  - indirect only; all providers can support `RadarChart` once aggregate rows are prepared upstream
- partial / unsupported:
  - none at the chart layer, though percentile generation remains an upstream responsibility
- acceptable lossy mappings:
  - normalized percentiles against a named cohort are the intended contract

## Default visual contract

### Layout

- square profile card with visible ring structure and outer metric labels
- first metric starts at 12 o’clock; ordering proceeds clockwise
- category legend appears when category metadata is present and meaningful

### Encodings

- radial distance encodes normalized value
- polygon shape is the primary gestalt read
- labels and guide rings keep the chart legible without hover
- chart-frame methodology notes carry sample/comparison context outside the polar geometry

### Interaction / accessibility behavior

- vertex markers remain keyboard-focusable
- hover/focus supports tooltip detail in the live component
- the chart still tells the single-profile story without interaction

### Empty / fallback behavior

- no plottable rows:
  - honest empty-state copy
- sparse profiles:
  - still render, but with weaker shape read
- dense profiles:
  - preserve the polygon/ring read before decorative text density

### Fallback / degraded behavior

- long or multilingual labels may abbreviate/wrap, but should not collapse the polar read
- static/export mode must degrade to the bounded constant-only contract

## Internal primitives required

| Primitive / seam     | Status   | Notes                                                          |
| -------------------- | -------- | -------------------------------------------------------------- |
| `computeRadarChart`  | existing | owns normalization, label ordering, and legend/category output |
| shared `ChartFrame`  | existing | owns methodology-note regions and chart chrome                 |
| shared polar seams   | existing | polygon, guide, text, legend, and tooltip rendering            |
| export frame helpers | existing | bounded export-only prop contract with constant-style guards   |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                                | Why relevant                | What it covers                     | What Campos should keep                 | What Campos should change                                                                 |
| -------------------------------------------- | --------------------------- | ---------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/Volumes/WQ/ref_code/mplsoccer` radar usage | football radar conventions  | single-profile radar grammar       | football-native single-profile defaults | diverge by refusing symmetric comparison overlays and by documenting the export-safe path |
| `/Volumes/WQ/ref_code/football_viz` research | chart-specific decision bar | why radar comparison is misleading | explicit single-profile stance          | keep Campos review/docs more honest about the unsupported comparison mode                 |

## Edge-case matrix

- empty data:
  - honest empty-state copy
- single-metric or 2-metric input:
  - fewer than 3 metrics cannot form a readable polygon (2 vertices produce a degenerate line, 1 vertex is a point). The renderer shows a fallback message ("Too few metrics — radar requires 3 or more") instead of attempting to draw. The compute layer pushes warnings for both cases
- sparse profiles (3–4 metrics):
  - valid but weaker chart choice; polygon reads more as a triangle than a profile
- dense profiles (16+ metrics):
  - warning emitted; prioritize label survival and polygon readability
- out-of-range values:
  - percentile mode clamps to `[0, 100]` after normalization; range mode clamps to `[0, 1]`. No warning is emitted for out-of-range inputs — clamping is silent
- percentile mode without `percentile` field:
  - when `valueMode="percentile"` (the default) and a row omits the `percentile` field, the raw `value` is treated as a 0–100 percentile. This is a common misconfiguration trap: a row with `value: 3.4` and no `percentile` draws at the 3.4th percentile. A warning is emitted naming the affected metrics
- comparison stance:
  - symmetric 2-profile comparison overlays are intentionally unsupported. If a consumer needs entity comparison, use a grouped-bar, dumbbell, or small-multiples layout instead. This is an active design choice, not a missing feature
- mixed categories:
  - stable legend and label tinting
- long / multilingual labels:
  - wrap/abbreviate without collapsing the polar read
- touch/mobile interaction:
  - focus/tap usable without hover-only meaning
- export/static:
  - bounded constant-only `areas` / `guides` / `text`, no methodology notes

## Demo requirements

- required page path:
  - `apps/site/src/pages/radarchart.astro`
- minimum story coverage:
  - hero/default
  - category legend
  - banded rings
  - banded-inside-polygon (StatsBomb classic)
  - raw-value mode
  - dense ticks
  - dark theme
  - sparse
  - empty
  - static export
  - methodology notes
  - responsive pressure

## Test requirements

- React tests:
  - zero-config shell
  - empty state
  - value-mode behavior
  - category legend behavior
  - keyboard/focus access
  - constant, object-map, and callback style injection
  - methodology-note support
- export tests:
  - stable contract excludes `methodologyNotes`
  - constant-only style surfaces remain accepted
- site verification:
  - page builds cleanly
  - desktop/mobile visual verification remain publishable
  - no console or hydration noise on `/radarchart`

## Review plan

- loop 1:
  - keep the active spec aligned with the current React-first surface and bounded export-safe subset
- loop 2:
  - verify the page covers the current single-profile stance, methodology-note seam, and responsive pressure honestly
- loop 3:
  - rerun tests, site build, and browser verification against current standards

## Open questions

- whether a later W2 documentation pass should standardize how the library explains “single-profile only” across `RadarChart` and `PizzaChart`
