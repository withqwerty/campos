# PizzaChart Component Spec

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `PizzaChart` (public chart component)
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer (`computePizzaChart`)
  - `@withqwerty/campos-react` renderer seams (`ChartFrame`, shared polar legend/badge/tooltip seams)
  - `@withqwerty/campos-adapters` only indirectly, once aggregate percentile rows are prepared upstream

## Purpose

- What user task this solves:
  - show a single profile through per-metric percentile slices rather than a single polygon shape
  - answer which parts of the profile are strong/weak while keeping each metric visually distinct
- Why it belongs in Campos:
  - pizza charts are now a standard football scouting/editorial format and complement `RadarChart` rather than replacing it
- Why it should be public:
  - slice grouping, value badges, reference arcs, center-content bounds, and polar label behavior are chart-level product decisions

## Domain framing

### Football concept

`PizzaChart` models a **single football profile through ordered metric slices**.

It is not:

- a raw event viewer
- the owner of percentile computation
- a generic radial decoration component

### Bounded-context ownership

- consumer/app code owns:
  - which metrics exist
  - how they are computed
  - how percentile/reference values are prepared
- `react` owns:
  - slice ordering/grouping behavior
  - badge and center-content presentation
  - legend/reference-arc semantics
- `schema` and `adapters` may inform upstream aggregates, but they do not own a
  first-class `PizzaChart` canonical type

### Canonical input model

The component expects already-prepared profile rows for one entity, optionally
with reference sets and category groupings.

### Invariants

- the chart remains a single-profile read by default
- slice order and grouping are semantically meaningful
- percentile/reference semantics must already be defined upstream
- badges and center content enrich the read without changing the underlying
  metric packet

## Public API

### Zero-config happy path

```tsx
import { PizzaChart } from "@withqwerty/campos-react";

<PizzaChart rows={rows} />;
```

This renders a publishable single-profile pizza with:

- percentile slices by default
- optional category grouping and legend behavior
- value badges on by default
- bounded center-content support
- shared chart-frame methodology-note support in the live React path

### Current public surface

`PizzaChartProps` combines the compute input with live renderer seams:

- base data/layout inputs from `ComputePizzaChartInput`
  - `rows`
  - `metricOrder`
  - `categoryOrder`
  - `showValueBadges`
  - `showAxisLabels`
  - `showLegend`
  - `categoryColors`
  - `centerContent`
  - `gridRingStep`
  - `referenceSets`
- first-class style injection seams
  - `areas`
  - `guides`
  - `text`
  - `badges`
- shared chart chrome
  - `methodologyNotes`
  - `staticMode`

### Advanced customization points

- `areas` styles percentile slices:
  - `fill`
  - `stroke`
  - `strokeWidth`
  - `opacity`
- `guides` styles grid rings, spokes, and reference arcs:
  - `stroke`
  - `strokeWidth`
  - `strokeDasharray`
  - `opacity`
- `text` styles outer metric labels:
  - `fill`
  - `fontSize`
  - `fontWeight`
- `badges` styles value badges:
  - `fill`
  - `stroke`
  - `strokeWidth`
  - `textFill`
- `centerContent` is intentionally bounded:
  - live component may render images, crests, or initials
  - it remains identity/decorative chrome, not a second data channel
- `staticMode` is a live-component static-friendly path:
  - hides hover-only UI
  - suppresses image-based center content
  - does not replace the stable `ExportFrameSpec` contract

### Export / static posture

- `PizzaChart` is part of the stable `ExportFrameSpec` chart union
- the export-safe subset is narrower than the live React surface:
  - constant-only `areas`
  - constant-only `guides`
  - constant-only `text`
  - constant-only `badges`
  - no `methodologyNotes`
  - no live `staticMode` prop
  - `centerContent` is export-safe only for initials:
    - `{ kind: "initials"; label?: string }`
- callback and object-map styling remain valid in-process React usage, but are not the stable serialized export contract

### Filtering

Filtering is upstream of the chart for v0.3 alpha:

- consumers pass already-selected percentile rows
- player/cohort/template selection happens outside the base chart
- legends are explanatory by default rather than filter controls

### Explicit non-goals

- symmetric multi-profile comparison overlays
- chart-local filter props
- arbitrary center-slot render callbacks
- implying that live callback styling is automatically export-safe

## Comparison stance

`PizzaChart` remains a single-profile component.

- symmetric player-vs-player overlays are intentionally unsupported
- reference arcs are allowed because they are semantically subordinate to the main profile
- consumers who need direct two-entity comparison should use linear comparison charts instead

## Required normalized data

`PizzaChart` is aggregate-data driven rather than event-driven.

| Field          | Required | Why it matters               | Fallback if missing        |
| -------------- | -------- | ---------------------------- | -------------------------- |
| `metric`       | yes      | slice identity               | row excluded               |
| `percentile`   | yes      | radial slice length          | row excluded               |
| `category`     | no       | grouped colouring / legend   | neutral category read      |
| `rawValue`     | no       | tooltip/reference enrichment | omit from live detail      |
| `displayValue` | no       | badge / tooltip text         | percentile formatting only |

Also state:

- provider support now:
  - indirect only; all providers can support `PizzaChart` once aggregate rows are prepared upstream
- partial / unsupported:
  - none at the chart layer, though percentile generation remains an upstream responsibility
- acceptable lossy mappings:
  - normalized percentiles against a named cohort are the intended contract

## Default visual contract

### Layout

- square profile card with visible slice lengths and outer metric labels
- first metric starts at 12 o’clock; ordering proceeds clockwise
- category grouping and value badges are valid first-class outputs of the same component

### Encodings

- radial slice length encodes percentile
- category colour groups related metrics when categories are present
- badges support exact-value read without replacing the slice-length read
- reference arcs stay subordinate to the main profile
- chart-frame methodology notes carry sample/benchmark context outside the radial geometry

### Interaction / accessibility behavior

- slices remain keyboard-focusable
- hover/focus supports tooltip detail in the live component
- the chart still tells the core story without hover because slice lengths and labels remain visible

### Empty / fallback behavior

- no plottable rows:
  - honest empty-state copy
- sparse profiles:
  - still render, though the chart becomes a weaker choice
- dense profiles:
  - preserve slice read before decorative chrome and badge density

### Fallback / degraded behavior

- long or multilingual labels may abbreviate/wrap, but should not collapse the radial read
- `staticMode` remains a live convenience seam; the stable export path uses the bounded export-only contract instead

## Internal primitives required

| Primitive / seam     | Status   | Notes                                                        |
| -------------------- | -------- | ------------------------------------------------------------ |
| `computePizzaChart`  | existing | owns slice ordering, legend/badge/reference output           |
| shared `ChartFrame`  | existing | owns methodology-note regions and chart chrome               |
| shared polar seams   | existing | slice, guide, text, badge, legend, and tooltip rendering     |
| export frame helpers | existing | bounded export-only prop contract with constant-style guards |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                                | Why relevant                | What it covers                   | What Campos should keep                                 | What Campos should change                                                            |
| -------------------------------------------- | --------------------------- | -------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `/Volumes/WQ/ref_code/mplsoccer` pizza usage | football pizza conventions  | single-profile pizza grammar     | football-native single-profile defaults and grouping    | diverge by bounding center content and by documenting the export-safe subset clearly |
| `/Volumes/WQ/ref_code/football_viz` research | chart-specific decision bar | why comparison overlays are weak | single-profile stance with subordinate reference layers | keep Campos review/docs more honest about unsupported symmetric comparison           |

## Edge-case matrix

- empty data:
  - honest empty-state copy
- sparse profiles:
  - valid but weaker chart choice
- dense profiles:
  - prioritize slice/badge readability
- multiple reference sets:
  - remain subordinate to the main slice read
- long / multilingual labels:
  - wrap/abbreviate without collapsing the radial read
- touch/mobile interaction:
  - focus/tap usable without hover-only meaning
- export/static:
  - bounded constant-only style surfaces, no methodology notes, initials-only center content

## Demo requirements

- required page path:
  - `apps/site/src/pages/pizzachart.astro`
- minimum story coverage:
  - hero/default
  - single-colour
  - dense
  - sparse
  - strong slice stroke
  - no value badges
  - center initials
  - long labels
  - custom grid styling
  - league/reference arcs
  - dark theme
  - static export
  - empty
  - methodology notes
  - responsive pressure

## Test requirements

- React tests:
  - zero-config shell
  - empty state
  - reference arc behavior
  - bounded center-content behavior
  - static-mode behavior
  - keyboard/focus access
  - constant, object-map, and callback style injection
  - methodology-note support
- export tests:
  - stable contract excludes `methodologyNotes` and live `staticMode`
  - initials-only center content remains accepted
- site verification:
  - page builds cleanly
  - desktop/mobile visual verification remain publishable
  - no console or hydration noise on `/pizzachart`

## Review plan

- loop 1:
  - keep the active spec aligned with the current React-first surface and bounded export-safe subset
- loop 2:
  - verify the page covers current reference-line, center-content, and responsive seams honestly
- loop 3:
  - rerun tests, site build, and browser verification against current standards

## Open questions

- whether a later W2 documentation pass should standardize how the library explains reference layers versus unsupported symmetric comparison across `PizzaChart` and `RadarChart`
