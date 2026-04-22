# KDE Component Spec

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `KDE` (public chart component)
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer (`computeKDE`)
  - `@withqwerty/campos-react` renderer seams (`PitchChartFrame`, `ChartDensitySurfaceImage`, `ChartScaleBar`, `ChartTooltip`)
  - `@withqwerty/campos-stadia` pitch surface primitives
  - `@withqwerty/campos-adapters` optionally, when raw provider events are normalized upstream

## Purpose

- What user task this solves:
  - visualize spatial event concentration as a smoothed density field rather than explicit rectangular bins
- Why it belongs in Campos:
  - `KDE` is the smoothed counterpart to `Heatmap`; it fits the football/editorial use case where concentration matters more than exact cell counts
- Why it should be public:
  - bandwidth defaults, sparse-data warnings, scale-bar semantics, raster rendering behavior, and tooltip sampling are chart-level product behavior

## Domain framing

### Football concept

`KDE` models a **smoothed spatial concentration surface** over football events in
Campos canonical pitch space.

It is not:

- a fixed-bin territory/heat chart
- a provider-coordinate viewer
- a generic image overlay detached from football surface semantics

### Bounded-context ownership

- `schema` owns the canonical event-location contract upstream
- `adapters` own provider-coordinate translation into Campos pitch space
- `react` owns:
  - smoothing defaults
  - raster/surface presentation
  - scale-bar and sparse-data warning behavior
  - crop/orientation presentation
- `stadia` owns the pitch surface primitives, not KDE semantics

### Canonical input model

The public component expects canonical event-like points already normalized into
Campos pitch space.

### Invariants

- smoothing happens over canonical pitch-space events only
- `bandwidth`, `resolution`, and `threshold` are view/modeling controls over the
  same event set, not alternate domain packets
- sparse samples should warn or degrade honestly rather than imply false
  certainty
- pitch-line contrast is presentation support, not density semantics

## Public API

### Zero-config happy path

```tsx
import { KDE } from "@withqwerty/campos-react";

<KDE events={events} />;
```

This renders a publishable pitch density surface with:

- automatic bandwidth selection
- normalized density read by default
- scale bar
- sparse-data warning when the sample is too small for a confident read
- hover/focus tooltip sampling over the density field

### Current public surface

`KDEProps` combines the compute input with live renderer seams:

- base data/layout inputs
  - `events`
  - `bandwidth`
  - `resolution`
  - `normalize`
  - `threshold`
  - `orientation`
  - `crop`
- pitch chrome hooks
  - `pitchTheme`
  - `pitchColors`
  - `autoPitchLines`
- first-class style injection seams
  - `areas`
  - `guides`

### Advanced customization points

- `bandwidth` controls smoothing strength:
  - `"auto"`
  - numeric pitch-coordinate bandwidth
- `resolution` controls the intermediate density raster resolution
- `threshold` hides very low-density values by making them transparent
- `areas` styles the density surface:
  - `show`
  - `palette`
  - `colorStops`
  - `opacity`
- `guides` styles the scale-bar surface:
  - `showScaleBar`
  - `label`
- `autoPitchLines` keeps pitch markings legible on dark density ramps

### Export / static posture

- `KDE` is **not** part of the stable `ExportFrameSpec` chart union
- current browser rendering uses a raster density image (`<image href="data:...">`) generated in-process from the computed density model
- that browser/runtime path is valid for the interactive docs and direct React usage, but it is intentionally outside the current Phase 1 static export contract
- a future export packet can revisit this once the raster/static parity rules are deliberately specified

### Filtering

Filtering is upstream of the chart for v0.3 alpha:

- consumers pass the already-selected event array
- future canonical filter dimensions come from normalized event fields upstream, not from sampled raster points
- built-in shared filtering is outside this packet

### Explicit non-goals

- discrete rectangular bin semantics (`Heatmap` owns that)
- editorial zone labeling (`Territory` owns that)
- stable `ExportFrameSpec` support in the current alpha wave
- generic low-level contour or kernel plug-in API
- implying that the browser raster path already defines a static export contract

## Required normalized data

`KDE` expects canonical Campos event points. Provider parsing belongs in adapters or consumer code upstream.

| Field | Required | Why it matters           | Fallback if missing |
| ----- | -------- | ------------------------ | ------------------- |
| `x`   | yes      | density estimation input | event excluded      |
| `y`   | yes      | density estimation input | event excluded      |

Also state:

- provider support now:
  - any normalized event source with canonical `x` / `y` coordinates
- partial / unsupported:
  - no special event-type semantics are required
- acceptable lossy mappings:
  - none beyond ordinary coordinate normalization upstream

## Default visual contract

### Layout

- pitch-first density surface with scale bar
- density rendered as a rasterized image inside the pitch SVG
- sparse-data warning shown when the sample is too small for a strong KDE read
- orientation and crop remain valid in live usage

### Encodings

- density surface encodes smoothed spatial concentration
- scale bar explains the current normalized or raw-density read
- `areas` and `guides` can restyle the surface without mutating the event payload

### Interaction / accessibility behavior

- the chart shell has an accessible label describing the event count
- hover/touch sampling reads pitch coordinate plus density value from the rendered surface
- empty-state mode remains meaningful without hover

### Empty / fallback behavior

- no events:
  - pitch plus honest empty-state copy, no density surface
- sparse datasets:
  - valid chart plus explicit low-confidence warning
- disabled guides:
  - surface remains valid, but the explanatory scale bar is intentionally hidden

### Fallback / degraded behavior

- export is explicitly deferred rather than pretending the browser raster path is already stable everywhere
- long text belongs in warning/tooltip/guide labels, not on the pitch
- dense surfaces should stay readable through ramp and warning choices rather than exposing arbitrary kernel internals

## Internal primitives required

| Primitive / seam           | Status   | Notes                                                     |
| -------------------------- | -------- | --------------------------------------------------------- |
| `computeKDE`               | existing | owns density model, sparse warnings, and scale-bar domain |
| `ChartDensitySurfaceImage` | existing | raster density image in SVG                               |
| `PitchChartFrame`          | existing | shared pitch-chart shell                                  |
| `ChartScaleBar`            | existing | density scale explanation                                 |
| `ChartTooltip`             | existing | live sampled tooltip surface                              |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                              | Why relevant             | What it covers                | What Campos should keep              | What Campos should change                                                                  |
| ------------------------------------------ | ------------------------ | ----------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `/Volumes/WQ/ref_code/mplsoccer` KDE usage | football KDE grammar     | smoothed density storytelling | football-native density storytelling | diverge with explicit React-first runtime boundaries and a deferred static export contract |
| `/Volumes/WQ/ref_code/d3-soccer` patterns  | interaction expectations | pitch interaction vocabulary  | simple football pitch interaction    | diverge with explicit tooltip/accessibility behavior over the sampled raster               |

## Edge-case matrix

- empty data:
  - pitch plus honest empty-state copy
- sparse data (fewer than 3 events):
  - density surface renders but `meta.warnings` includes a low-confidence warning (`"KDE smoothing may not be meaningful"`)
- dense data:
  - stable smoothed density field
- input validation:
  - `bandwidth` must be a positive finite number. Zero produces `Infinity` in the kernel denominator → NaN grid. Negative values silently collapse to absolute value. Non-finite values poison the entire grid. Invalid bandwidth falls back to Silverman's rule with a warning
  - `resolution` must be a finite integer >= 4. Zero or negative values produce an empty grid with no diagnostic. Falls back to default 100 with a warning
  - `threshold` must be in `[0, 1)`. Values outside this range silently produce fully-coloured or fully-transparent surfaces. Falls back to default 0.05 with a warning
- bandwidth selection:
  - default bandwidth uses Silverman's rule: `h = n^(-1/6) × σ` per axis, computed at `compute/kde.ts`. The rule is designed for unimodal distributions; multi-cluster football event patterns may over-smooth
- scale bar honesty:
  - the scale bar label must honestly reflect what the domain represents. When `normalize=true` the domain is `[0, 1]` relative density. When `normalize=false` the domain is the raw kernel sum — **not event counts**. The label reads `"Kernel sum"` to avoid false precision. Tooltip labels must match the scale bar
  - this constraint exists because consumers reasonably interpret a label reading "Events 0 – 3.47" as meaning 3.47 events touched the hotspot, when the actual meaning is the summed Gaussian kernel value at the peak cell
- surface visibility:
  - when the density surface is hidden via `areas.show`, the hit-rect overlay and scale bar are also suppressed. Otherwise the tooltip reports density readings over a blank pitch, defeating the purpose of hiding the surface
- dark ramps:
  - `autoPitchLines` keeps pitch markings legible by default
- long / multilingual text:
  - stays in warning/tooltip/guide labels, not on the pitch
- export/static:
  - intentionally deferred; browser/runtime path only

## Demo requirements

- required page path:
  - `apps/site/src/pages/kde.astro`
- minimum story coverage:
  - hero/default
  - alternate palette
  - tight bandwidth
  - wide bandwidth
  - vertical orientation
  - sparse data warning
  - empty state
  - responsive pressure
  - explicit export-deferred note

## Test requirements

- React tests:
  - shell labeling
  - empty state
  - scale-bar label behavior
  - sparse-data warning
  - guide overrides
  - tooltip sampling
  - area opacity callback
- export/static tests:
  - none in the stable `ExportFrameSpec` contract for this wave
- site verification:
  - page builds cleanly
  - desktop and mobile visual verification remain publishable
  - export-deferred language stays explicit

## Review plan

- loop 1:
  - keep the active spec aligned with the React-first runtime surface and explicit export-deferred posture
- loop 2:
  - verify the page/spec/tests tell one honest story about browser raster rendering vs deferred static export
- loop 3:
  - rerun tests, site build, and browser verification against current standards

## Open questions

- what a future stable static/export contract for raster density surfaces should guarantee: embedded data URL parity, server-side raster generation, or an alternate vector fallback
