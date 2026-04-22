# Heatmap Component Spec

**Status:** active
**Last updated:** 2026-04-20

## Header

- Component / primitive: `Heatmap` (public chart component)
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer (`computeHeatmap`)
  - `@withqwerty/campos-react` renderer seams (`PitchChartFrame`, `ChartHeatmapCellLayer`, `ChartScaleBar`, `ChartTooltip`)
  - `@withqwerty/campos-stadia` pitch surface primitives
  - `@withqwerty/campos-adapters` optionally, when raw provider events are normalized upstream

## Purpose

- What user task this solves:
  - visualize event density across the pitch as inspectable rectangular bins rather than smoothed contours
- Why it belongs in Campos:
  - `Heatmap` is the discrete-bin density surface that sits between raw event charts and smoothed spatial surfaces like `KDE`
- Why it should be public:
  - grid semantics, scale-bar behavior, tooltip rows, auto pitch-line contrast, and empty-state handling are chart-level product behavior

## Domain framing

### Football concept

`Heatmap` models a **discrete-bin spatial density view** over football events in
Campos canonical pitch space.

It is not:

- a smoothed density field
- a provider-coordinate viewer
- a generic tile map detached from football surface semantics

### Bounded-context ownership

- `schema` owns the canonical event-location contract
- `adapters` own translation from provider coordinates into Campos pitch space
- `react` owns:
  - grid/bin defaults
  - color/scale-bar semantics
  - tooltip behavior
  - crop/attacking-direction presentation
- `stadia` owns the pitch surface primitives, not the density semantics

### Canonical input model

The public component expects canonical event-like points already normalized into
Campos pitch space.

Provider coordinate parsing must already be resolved upstream.

### Invariants

- every plottable event location is already in canonical pitch space
- `gridX` and `gridY` change the chart view, not the underlying event model
- `valueMode` changes how density is expressed, not what the events mean
- sparse or empty input degrades honestly to low-information or empty-state
  output

## Public API

### Zero-config happy path

```tsx
import { Heatmap } from "@withqwerty/campos-react";

<Heatmap events={events} />;
```

This renders a publishable full-pitch heatmap with:

- default 12x8 grid binning
- sequential color scale
- scale bar
- focus/hover tooltip behavior for non-empty cells
- empty-state fallback when nothing is plottable

### Current public surface

`HeatmapProps` combines the compute input with live renderer seams:

- base data/layout inputs
  - `events`
  - `gridX`
  - `gridY`
  - `zonePreset`
  - `metricLabel`
  - `valueMode`
  - `showScaleBar`
  - `colorScale`
  - `colorStops`
  - `attackingDirection`
  - `crop`
- pitch chrome hooks
  - `pitchTheme`
  - `pitchColors`
  - `autoPitchLines`
- first-class style injection seam
  - `cells`

### Advanced customization points

- `metricLabel` names what the scale bar and tooltip values represent
- `valueMode` changes how scale-bar and tooltip values are expressed:
  - `"count"`
  - `"intensity"`
  - `"share"`
- `showScaleBar={false}` is the compact repeated-grid seam for `SmallMultiples`
  and similar analyst cards
- `colorScale` selects the sequential ramp, with `colorStops` for custom ramps
- `autoPitchLines` keeps pitch markings legible on dark ramps by forcing light line colors when needed
- `cells` is the main style injection surface:
  - `show`
  - `fill`
  - `opacity`
  - `stroke`
  - `strokeWidth`
- `crop="half"` and `attackingDirection` are view/layout rules, not shared
  filters

### Export / static posture

- `Heatmap` is part of the stable `ExportFrameSpec` chart union
- the export-safe subset is narrower than the live React surface:
  - constant-only `cells`
  - no live hover/focus tooltip layer
- the visible density surface and scale bar still make `HeatmapStaticSvg` meaningful without hover
- callback and object-map styling remain valid in live React usage, but are not the stable serialized export contract

### Filtering

Filtering is upstream of the chart for v0.3 alpha:

- consumers pass the already-selected event array
- future canonical filter dimensions come from normalized event fields upstream, not from rendered cells
- built-in shared filtering is outside this packet

### Explicit non-goals

- smoothed density estimation (`KDE` owns that)
- editorial zone labeling (`Territory` owns that)
- chart-local filter props such as `filterTeam`
- generic low-level cell-grid composition API
- implying that live callback styling is automatically export-safe

## Required normalized data

`Heatmap` expects canonical Campos event points. Provider parsing belongs in adapters or consumer code upstream.

| Field | Required | Why it matters           | Fallback if missing |
| ----- | -------- | ------------------------ | ------------------- |
| `x`   | yes      | event binning on pitch x | event excluded      |
| `y`   | yes      | event binning on pitch y | event excluded      |

Also state:

- provider support now:
  - any normalized event source with canonical `x` / `y` coordinates
- partial / unsupported:
  - no special event-type semantics are required; this is intentionally broader than shots/passes
- acceptable lossy mappings:
  - none beyond ordinary coordinate normalization upstream

## Default visual contract

### Layout

- plot-first pitch frame with a continuous scale bar
- zero-value cells stay transparent so the pitch surface still reads cleanly
- non-empty cells remain the only interactive marks
- attacking-direction and crop combinations remain valid in both live and
  static modes

### Encodings

- rectangular bins encode event-location counts
- cell fill encodes the computed density/intensity ordering
- `valueMode` changes scale-bar and tooltip semantics, not the relative fill ordering
- custom `cells` styling can change the read without mutating the event payload

### Interaction / accessibility behavior

- non-empty cells are keyboard-focusable
- zero-value cells are non-interactive
- hover/focus reveals tooltip content in the live component
- the chart remains meaningful without hover because the visible density surface and scale bar still carry the story

### Empty / fallback behavior

- no events:
  - pitch plus honest empty-state copy, no fake cells
- all invalid coordinates:
  - same empty-state behavior
- sparse datasets:
  - valid but visually limited; still publishable

### Fallback / degraded behavior

- dense grids should remain inspectable, not smoothed
- long text belongs in tooltip/scale labeling, not persistent in-cell labels
- static/export mode must degrade to the bounded constant-only cell-style contract

## Internal primitives required

| Primitive / seam        | Status   | Notes                                                          |
| ----------------------- | -------- | -------------------------------------------------------------- |
| `computeHeatmap`        | existing | owns binning, fill ramp, scale-bar domain, and value semantics |
| `PitchChartFrame`       | existing | shared pitch-chart shell                                       |
| `ChartHeatmapCellLayer` | existing | visible and interactive cell marks                             |
| `ChartScaleBar`         | existing | continuous scale explanation                                   |
| `ChartTooltip`          | existing | live interaction surface                                       |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                                  | Why relevant             | What it covers                          | What Campos should keep                | What Campos should change                                                                     |
| ---------------------------------------------- | ------------------------ | --------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `/Volumes/WQ/ref_code/mplsoccer` heatmap usage | football heatmap grammar | discrete event-density binning on pitch | straightforward football bin-grid read | diverge with accessible interaction, explicit export-safe subset, and React-first style seams |

## Edge-case matrix

- empty data:
  - pitch plus honest empty-state copy
- sparse data (fewer than 3 events):
  - density surface renders but `meta.warnings` includes a sparse-data warning. The chart is still valid; the warning is a signal to the consumer that interpretation should be cautious
- dense data:
  - inspectable cell grid, not smoothed interpolation
- grid-size validation:
  - `gridX` and `gridY` are clamped to `Math.max(1, Math.round(value))`. Zero, negative, and non-integer values are silently corrected. NaN falls back to 1. There is no upper bound — hostile user-controlled values like `gridX=1e6` will allocate proportionally
- out-of-range coordinates:
  - handled safely by the computed binning path
- dark ramps:
  - `autoPitchLines` keeps pitch markings legible by default
- long / multilingual text:
  - stays in tooltip or scale-bar labels, not in cells
- export/static:
  - bounded constant-only `cells`, no hover layer
- explicit non-goals:
  - animated transitions between data states
  - pre-aggregated grid input (Heatmap bins from raw events only)
  - multi-layer compositing (use separate Heatmap instances)
  - KDE-style smoothing (use the KDE component instead)

## Demo requirements

- required page path:
  - `apps/site/src/pages/heatmap.astro`
- minimum story coverage:
  - hero/default
  - share mode
  - fine grid
  - attacking-half crop
  - defensive-shape ramp variant
  - static export
  - empty state
  - responsive pressure
  - themeability via shared controller

## Test requirements

- React tests:
  - zero-config shell
  - empty state
  - non-empty vs zero-value cell interaction
  - custom metric label
  - custom grid sizing
  - value-mode tooltip semantics
  - auto pitch-line contrast
  - cell style injection
- export tests:
  - stable contract uses constant-only `cells`
- site verification:
  - page builds cleanly
  - desktop and mobile visual verification remain publishable
  - current export/static story stays honest

## Review plan

- loop 1:
  - keep the active spec aligned with the current React-first surface and bounded export-safe subset
- loop 2:
  - verify the page/spec/tests tell one honest story about scale, cells, and export posture
- loop 3:
  - rerun tests, site build, and browser verification against current standards

## Open questions

- whether a later W1/W2 pass should standardize page-level wording for `valueMode` across `Heatmap`, `Territory`, and other density/profile surfaces
