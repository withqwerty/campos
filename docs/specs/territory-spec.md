# Territory Component Spec

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `Territory` (public chart component)
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer (`computeTerritory`)
  - `@withqwerty/campos-stadia` pitch primitives
  - `PitchChartFrame` and shared empty-state primitives in `@withqwerty/campos-react`

## Purpose

- What user task this solves:
  - show where a team played or defended using fixed, readable pitch zones rather than dense arbitrary bins
- Why it belongs in Campos:
  - football editorial, broadcast, and quick-scan analysis often needs a two-second territory read, not a full analytical heat surface
- Why it should be public:
  - the fixed-grid contract, in-cell percentages, crop semantics, and label treatment are chart-level behavior, not consumer glue

## Domain framing

### Football concept

`Territory` models a **fixed-zone territorial read** over football events in
Campos canonical pitch space.

It is not:

- a configurable analytical heat surface
- a smoothed density map
- a provider-coordinate viewer

### Bounded-context ownership

- `schema` owns the canonical event-location contract upstream
- `adapters` own translation from provider coordinates into Campos pitch space
- `react` owns:
  - fixed-grid chart semantics
  - in-cell percentage labeling
  - crop/orientation presentation
  - editorial readability defaults
- `stadia` owns the pitch surface primitives, not territory semantics

### Canonical input model

The public component expects canonical event-like points already normalized into
Campos pitch space.

### Invariants

- fixed zones are a chart contract, not a consumer-defined arbitrary bin system
- percentages are shares over the selected event set, not a second event model
- crop and orientation are view rules over the same territory read
- the chart should stay readable immediately, even when the input is sparse

### Territory vs Heatmap

- `Territory` is the broadcast/editorial fixed-zone chart
- `Heatmap` is the analytical configurable-bin chart
- they share a related event input shape, but they are intentionally different product surfaces

Use `Territory` when:

- the answer should be readable immediately
- 3×3 or 5×3 fixed zones are enough
- in-cell percentages are preferable to hover-only detail

Use `Heatmap` when:

- exact bin density matters
- users need tooltip-driven exploration
- the chart should express local intensity rather than fixed editorial zones

## Public API

### Zero-config happy path

```tsx
import { Territory } from "@withqwerty/campos-react";

<Territory events={events} />;
```

This renders a publishable territory chart with:

- a vertical full-pitch 3×3 grid
- sequential fill encoding by share of total events
- in-cell percentage labels
- empty-state handling
- pitch-frame theming through Stadia

### Current public surface

`TerritoryProps` exposes:

- data and layout inputs
  - `events`
  - `grid`
  - `orientation`
  - `crop`
  - `showLabels`
  - `labelStyle`
  - `teamFilter`
  - `metricLabel`
  - `ariaLabel`
- visual controls
  - `colorScale`
  - `colorStops`
  - `pitchTheme`
  - `pitchColors`
  - `autoPitchLines`
- first-class style surfaces
  - `cells`
  - `labels`

### Advanced customization points

- `grid` controls whether the chart uses 3×3 or 5×3 editorial zoning
- `labelStyle` controls placement strategy:
  - `"offset"` keeps labels away from pitch lines
  - `"badge"` centers labels over a pill background
- `teamFilter` is the only built-in filtering convenience because single-team editorial territory is a canonical use case
- `cells` styles fill, opacity, stroke, stroke width, and visibility
- `labels` styles label fill, badge background, opacity, font size, and visibility
- `autoPitchLines` keeps pitch markings legible over darker ramps unless the consumer deliberately disables it

### Export / static posture

- `Territory` is part of the stable `ExportFrameSpec` chart union
- the export-safe surface is narrower than the live React surface:
  - `cells` and `labels` must use constant-only values in the export contract
  - `ariaLabel` is not part of the export chart-props contract because the outer export frame owns chart-level accessibility labeling
- static export is a supported path for the current component

### Filtering

Filtering follows `docs/standards/filtering-standard.md`, but for `Territory` the usual pattern is still upstream selection:

- consumers can filter `events` before passing them in
- `teamFilter` remains as a chart-level convenience for the canonical single-team territory use case
- `grid`, `crop`, `orientation`, and `labelStyle` are configuration, not filtering
- in-cell percentages are explanatory labels, not filter handles

### Explicit non-goals

- arbitrary bin counts beyond `3x3` and `5x3`
- KDE / smoothed density
- custom polygon zones
- built-in tooltips or click handlers
- chart-local title/subtitle props
- generic scene-graph extension seams
- two-team diverging comparison mode in v0.3 alpha

## Required normalized data

| Field  | Required | Why                          | Fallback if missing     |
| ------ | -------- | ---------------------------- | ----------------------- |
| `x`    | yes      | zone assignment              | event excluded          |
| `y`    | yes      | zone assignment              | event excluded          |
| `team` | no       | only needed for `teamFilter` | treated as non-matching |

Also state:

- provider support now:
  - any provider or consumer dataset that already yields Campos-normalized pitch coordinates
- partial / unsupported:
  - none at the chart layer
- acceptable lossy mappings:
  - coarse editorial zoning is intentional; precise local density belongs to `Heatmap`

## Default visual contract

### Layout

- pitch chart with fixed zone rectangles
- no hover-first interaction contract
- percentages are rendered inside the cells rather than hidden behind tooltips

### Encodings

- cell fill encodes share of the total surviving events
- labels show integer percentage values
- pitch crop/orientation semantics come from Stadia

### Empty state

- explicit `No event data` overlay
- cells still render as the quiet structural frame

### Fallback / degraded behavior

- sparse events (fewer than 3) trigger a warning forwarded from the underlying heatmap compute — the territorial split is still rendered but interpretation should be cautious
- concentrated single-zone dominance should resolve cleanly to one `100%` label
- half-pitch crop renormalizes percentages against only visible events
- when labels are disabled, the filled zones still carry the story
- label contrast uses luma-switched black/white text plus a badge pill — not paint-order stroke halos. This is an intentional departure from the earlier spec in favour of consistent rendering across SVG implementations

## Internal primitives required

| Primitive / seam   | Status   | Notes                                                                      |
| ------------------ | -------- | -------------------------------------------------------------------------- |
| `computeTerritory` | existing | fixed-grid territory model, cell shares, labels, and empty-state semantics |
| `Pitch`            | existing | pitch projection, crop, orientation, and theming                           |
| `PitchChartFrame`  | existing | shared pitch-chart shell and accessible section wrapper                    |
| `EmptyState`       | existing | explicit empty overlay                                                     |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                          | Why it was relevant                                              | What it revealed                                                           | What Campos should keep or change                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/Volumes/WQ/ref_code/INDEX.md` survey | checked whether a better fixed-zone football analogue was needed | no new direct analogue was required for this rerun; the gap was spec drift | keep the current broadcast/editorial fixed-zone contract and document the live React/export behavior honestly instead |

## Edge-case matrix

- empty data:
  - show explicit empty state without fake percentages
- sparse data:
  - keep readable percentages and clear zone ownership
- concentrated data:
  - one zone can legitimately own `100%`
- mixed-team streams:
  - `teamFilter` must act before binning and percentage calculation
- crop semantics:
  - half-pitch view renormalizes against the cropped total
- label treatment:
  - `offset` and `badge` both avoid unreadable pitch-line collisions
- static/export:
  - static snapshots remain meaningful with no hover dependency

## Demo requirements

- required page path:
  - `apps/site/src/pages/territory.astro`
- minimum story coverage:
  - hero/default
  - 5×3 zones
  - horizontal orientation
  - team filter
  - badge labels
  - concentrated single-zone case
  - static export
  - empty
  - responsive width pressure

## Test requirements

- React tests:
  - zero-config shell and accessible label
  - 3×3 and 5×3 grid counts
  - empty state
  - labels on/off
  - horizontal orientation
  - half-pitch crop
  - `teamFilter`
  - concentrated `100%` state
  - cell and label style injection
  - dark-theme token pickup
  - accessibility checks
- site verification:
  - page builds cleanly and documents static export honestly

## Review plan

- loop 1:
  - align the active spec with the live React and export surfaces
- loop 2:
  - verify page/API text, tests, and export posture match shipped behavior
- loop 3:
  - verify responsive pressure, static export messaging, and visual readability on desktop/mobile

## Open questions

- whether `Territory` and `Heatmap` should eventually share a more explicit fixed-zone explainer block on the docs site
- whether future two-team territory comparison belongs in this component or a separate comparison chart
