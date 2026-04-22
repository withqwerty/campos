# PassMap Component Spec

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `PassMap` (public chart component)
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer (`computePassMap`)
  - `@withqwerty/campos-react` renderer seams (`PitchChartFrame`, `ChartLineMark`, `ChartTooltip`, shared legend primitives)
  - `@withqwerty/campos-stadia` pitch surface primitives
  - `@withqwerty/campos-adapters` optionally, when raw provider passes are normalized upstream

## Purpose

- What user task this solves:
  - visualize individual pass origins, destinations, completion, and directional flow on a football pitch
- Why it belongs in Campos:
  - `PassMap` is the raw event-layer companion to `PassNetwork`; it covers the non-aggregated pass story that football users expect to ship frequently
- Why it should be public:
  - arrow semantics, dot fallback, crop/orientation rules, tooltip rows, and completion-driven defaults are chart-level product behavior, not consumer glue

## Domain framing

### Football concept

`PassMap` models a **pass-event visualization**: where passes started, where
they went, and how they resolved.

It is not:

- an aggregated network chart
- a provider-payload viewer
- a generic line layer over a pitch

### Bounded-context ownership

- `schema` owns the canonical pass vocabulary:
  - start/end locations in Campos pitch space
  - completion/result semantics
  - optional player/team/context fields
- `adapters` own translation from provider pass feeds into canonical pass events
- `react` owns:
  - arrow/dot rendering behavior
  - crop/orientation rules
  - legend and tooltip presentation
- `stadia` owns the football surface primitives, not pass semantics

### Canonical input model

The public component expects canonical Campos pass events that have already had
provider translation resolved upstream.

### Invariants

- pass origins and destinations are interpreted in canonical pitch space
- missing destinations degrade honestly to fallback dots rather than invented
  arrows
- completion semantics come from canonical pass fields, not provider-local
  branches
- crop and orientation are view rules over the same pass-event set

## Public API

### Zero-config happy path

```tsx
import { PassMap } from "@withqwerty/campos-react";

<PassMap passes={passes} />;
```

This renders a publishable vertical full-pitch pass map with:

- completion-colored arrows by default
- broad hit areas with thin visible pass lines
- dot fallback for passes missing destinations
- header stats, legend, and tooltip behavior that remain meaningful without custom props

### Current public surface

`PassMapProps` combines the compute input with live renderer seams:

- base data/layout inputs from `ComputePassMapInput`
  - `passes`
  - `crop`
  - `orientation`
- first-class style injection seams
  - `lines`
  - `dots`
- pitch chrome hooks
  - `pitchTheme`
  - `pitchColors`

### Advanced customization points

- `lines` is the main arrow styling surface:
  - `show`
  - `stroke`
  - `strokeWidth`
  - `strokeLinecap`
  - `strokeDasharray`
  - `opacity`
- `dots` styles fallback markers for passes without end coordinates:
  - `show`
  - `fill`
  - `radius`
  - `opacity`
  - `stroke`
  - `strokeWidth`
- `crop="half"` keeps only passes that end in the attacking half; clipping is a chart view rule, not a shared filter system
- `orientation="horizontal"` rotates the pitch read without changing the underlying football semantics

### Export / static posture

- `PassMap` is part of the stable `ExportFrameSpec` chart union
- the export-safe subset is narrower than the live React surface:
  - constant-only `lines`
  - constant-only `dots`
  - no live hover/focus tooltip layer
- callback and object-map styling remain valid in-process React usage, but are not the stable serialized export contract
- docs-site wrappers must not pass callback or object-map styles through Astro `client:load` props; those presets belong inside the hydrated React component

### Filtering

Filtering is upstream of the chart for v0.3 alpha:

- consumers pass the already-selected pass array
- future canonical filter dimensions come from normalized fields such as `passResult`, `passType`, and assist/context booleans
- built-in shared filtering is outside this packet

### Explicit non-goals

- pass-network aggregation inside the base component
- chart-local filter props such as `filterResult`
- arbitrary consumer overlay children
- generic low-level arrow-layer composition API
- implying that live callback styling is automatically export-safe

## Required normalized data

`PassMap` expects canonical Campos pass events. Provider parsing belongs in adapters or consumer code upstream.

| Field        | Required | Why it matters                   | Fallback if missing                          |
| ------------ | -------- | -------------------------------- | -------------------------------------------- |
| `x`          | yes      | pass origin                      | pass excluded                                |
| `y`          | yes      | pass origin                      | pass excluded                                |
| `endX`       | no       | pass destination                 | fall back to origin dot marker               |
| `endY`       | no       | pass destination                 | fall back to origin dot marker               |
| `passResult` | no       | default completion styling       | neutral fallback color and tooltip text      |
| `passType`   | no       | common styling dimension         | `unknown` in map-style presets               |
| `playerName` | no       | tooltip label                    | generic fallback label                       |
| `recipient`  | no       | tooltip row / recipient presets  | omit row, use `unknown` in recipient presets |
| `minute`     | no       | tooltip chronology               | omit minute row                              |
| `length`     | no       | tooltip enrichment               | omit                                         |
| `isAssist`   | no       | tooltip emphasis / future filter | treat as false                               |

Also state:

- provider support now:
  - adapters with normalized event pass locations and destinations, primarily StatsBomb- and Opta-shaped feeds plus curated WhoScored-derived fixtures
- partial / unsupported:
  - providers without destination coordinates still support an honest dot fallback if normalized that way
- acceptable lossy mappings:
  - missing recipient names or collapsed pass-type buckets are acceptable if the fallback tooltip/style behavior remains explicit

## Default visual contract

### Layout

- full-pitch football frame by default
- header stats for pass count and completion rate
- plot-first layout with compact completion legend
- optional half-pitch crop and horizontal orientation without changing the chart’s core semantics

### Encodings

- point position encodes pass origin
- line geometry encodes direction and destination
- default stroke color follows completion status from the computed model
- dot fallback renders when the pass is missing an end coordinate
- custom `lines` / `dots` styling can change the visual story without mutating the pass payload

### Interaction / accessibility behavior

- each plotted pass marker is keyboard-focusable
- hover/focus reveals the tooltip in the live component
- hit areas are wider than visible lines so thin arrows remain usable
- the chart still tells the core story without hover because the arrows/dots remain visible

### Empty / fallback behavior

- no passes:
  - pitch plus honest empty-state copy
- no plottable destinations:
  - dot markers rather than fake arrows
- sparse datasets:
  - remain publishable without requiring aggregation

### Fallback / degraded behavior

- dense overlap should preserve coordinate precision rather than collapsing into a network-like abstraction
- long or multilingual names stay in tooltips, not as persistent pitch labels
- static/export mode must degrade to the bounded constant-only contract

## Internal primitives required

| Primitive / seam    | Status   | Notes                                                                  |
| ------------------- | -------- | ---------------------------------------------------------------------- |
| `computePassMap`    | existing | owns stats, legend entries, completion rate, crop/orientation behavior |
| `PitchChartFrame`   | existing | shared pitch-chart shell                                               |
| `ChartLineMark`     | existing | visible arrows plus hit-area lines                                     |
| `ChartTooltip`      | existing | live interaction surface                                               |
| shared legend seams | existing | completion legend content                                              |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                                  | Why relevant              | What it covers                            | What Campos should keep                      | What Campos should change                                                                        |
| ---------------------------------------------- | ------------------------- | ----------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/Volumes/WQ/ref_code/mplsoccer` pass examples | pass-map football grammar | arrow density, destination flow, crop use | straightforward football pass-direction read | diverge with accessible interaction, React-first style seams, and an explicit export-safe subset |

## Edge-case matrix

- empty data:
  - pitch plus honest empty-state copy
- sparse data:
  - valid minimal chart
- missing end coordinates:
  - dot fallback, no fake arrow
- out-of-range coordinates:
  - coordinates are clamped to `[0, 100]` in the compute layer (`pass-map.ts`). Providers emitting values outside the pitch range will not produce markers beyond the pitch boundary
- dense overlap:
  - preserve thin arrows and broad hit areas. The topmost SVG element captures the hover event — only one arrow per dense cluster is tooltip-accessible. This is a known limitation accepted for the current architecture
- completion semantics:
  - default completion palette: complete `#7ce2a1`, incomplete `#f27068`, assist `#f2a93b`, other `#8792a8`. Default line opacity: `0.7` (live), `0.82` (static)
  - tooltip rows follow a fixed order: Player → Minute → Result → Type → Recipient → Length → Assist
- aspect ratios:
  - pitch crop and orientation produce fixed aspect ratios (`2:3`, `3:2`, `4:5`, `5:4`) via `aspectRatioFor()` in compute
- mixed/null recipient names:
  - tooltip and preset fallbacks remain explicit
- long / multilingual text:
  - handled in tooltip, not persistent labels
- touch/mobile interaction:
  - tap/focus interaction remains usable without persistent labels
- export/static:
  - bounded constant-only `lines` / `dots`, no hover layer

## Demo requirements

- required page path:
  - `apps/site/src/pages/passmap.astro`
- minimum story coverage:
  - hero/default
  - pass-type styling
  - recipient styling
  - attacking-half crop
  - horizontal orientation
  - dense sample
  - static export
  - empty state
  - responsive pressure
  - themeability via shared controller

## Test requirements

- React tests:
  - zero-config shell
  - empty state
  - arrow vs dot fallback behavior
  - completion stats behavior
  - constant, object-map, and callback style injection for `lines` / `dots`
  - tooltip interaction and accessibility
- export tests:
  - stable contract uses constant-only `lines` / `dots`
- site verification:
  - page builds cleanly
  - no hydration mismatch from the docs-site wrapper
  - desktop and mobile visual verification remain publishable

## Review plan

- loop 1:
  - keep the active spec aligned with the current React-first surface and bounded export-safe subset
- loop 2:
  - verify the site wrapper stays honest about the Astro-to-React serialization boundary
- loop 3:
  - rerun tests, site build, and browser verification against current standards

## Open questions

- whether a later W1/W2 pass should standardize page-level language for “default completion read” vs “analytical styling variant” across `PassMap`, `ShotMap`, and `PassNetwork`
