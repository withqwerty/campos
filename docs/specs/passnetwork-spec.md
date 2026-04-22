# PassNetwork Component Spec

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `PassNetwork` (public chart component)
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer (`computePassNetwork`)
  - `@withqwerty/campos-stadia` pitch primitives
  - `PitchChartFrame`, `ChartPointMark`, `ChartLineMark`, `ChartTooltip`, and shared empty-state primitives

## Purpose

- What user task this solves:
  - show team structure, player relationships, and average positions in an aggregated passing network
- Why it belongs in Campos:
  - passing networks are a canonical football chart and a core bridge between event data and tactical structure
- Why it should be public:
  - thresholding, directed-vs-undirected edge behavior, ego-highlight interaction, and node/edge semantics are chart-level product behavior

## Domain framing

### Football concept

`PassNetwork` models an **aggregated passing structure**: player positions plus
player-to-player pass relationships for one team context.

It is not:

- a raw pass-event chart
- an auto-generated formation card
- a provider-specific network payload viewer

### Bounded-context ownership

- `schema` owns canonical football concepts such as players, teams, and pass
  events upstream of aggregation
- `adapters` own provider translation into canonical pass data
- `react` owns:
  - network node/edge chart behavior
  - thresholding and directedness presentation
  - highlight and tooltip behavior
- `stadia` owns the pitch surface primitives, not pass-network aggregation

### Canonical input model

The public component expects an already-aggregated network packet:

- `nodes` with canonical pitch positions
- `edges` with relationship counts/weights

That packet may be derived from canonical passes upstream, but the component
itself does not parse provider pass feeds.

### Invariants

- node positions are interpreted in canonical pitch space
- edges represent aggregated relationships, not individual pass events
- `minEdgePasses` filters visible structure without changing the underlying
  aggregation semantics
- `directed` changes whether reversed pairs stay distinct, not what a node means

## Public API

### Zero-config happy path

```tsx
import { PassNetwork } from "@withqwerty/campos-react";

<PassNetwork nodes={nodes} edges={edges} />;
```

This renders a publishable passing network with:

- average-position nodes
- aggregated edges above the default threshold
- node labels when legible
- header stats and legend
- hover/focus tooltips
- empty and no-edges-above-threshold fallbacks

### Current public surface

`PassNetworkProps` exposes:

- data and layout inputs
  - `nodes`
  - `edges`
  - `minEdgePasses`
  - `showLabels`
  - `orientation`
  - `directed`
  - `collisionPadding`
  - `egoHighlight`
- pitch styling inputs
  - `pitchTheme`
  - `pitchColors`
- first-class style surfaces
  - `nodeStyle`
  - `edgeStyle`

### Advanced customization points

- `minEdgePasses` is the main decluttering control
- `directed` keeps reversed pairs distinct and adds arrowheads
- `egoHighlight` dims unrelated structure when a node is focused or hovered
- `nodeStyle` controls node fill, stroke, radius, opacity, label color, visibility, and shape
- `edgeStyle` controls stroke, width, dash, opacity, and visibility
- composition helpers such as `compressPassNetwork` and `combinePassNetworks` belong outside the chart and remain recipe-level utilities, not chart props

### Export / static posture

- `PassNetwork` is part of the stable `ExportFrameSpec` chart union
- the export-safe surface is narrower than the live React surface:
  - `nodeStyle` and `edgeStyle` must use constant-only values in export
  - `egoHighlight` is excluded from the export contract because it is an interaction-only seam
- static export is supported for deterministic snapshots

### Filtering

Filtering follows `docs/standards/filtering-standard.md`, but for `PassNetwork` the main pattern is upstream aggregation:

- the chart expects already-aggregated `nodes` and `edges`
- `minEdgePasses`, `directed`, and `showLabels` are configuration, not filtering
- recipe-level transformations such as shared-pitch compression also happen upstream of the base chart

### Explicit non-goals

- built-in pass aggregation from raw events
- generic graph layout or force-directed positioning
- dual-team rendering as a first-class prop surface
- chart-local title/subtitle props
- arbitrary scene-graph child injection
- lasso/brush or custom selection UIs

## Required normalized data

### Nodes

| Field       | Required | Why                       | Fallback if missing |
| ----------- | -------- | ------------------------- | ------------------- |
| `id`        | yes      | stable identity and joins | node excluded       |
| `label`     | yes      | visible label / tooltip   | node excluded       |
| `x`         | yes      | average position          | node excluded       |
| `y`         | yes      | average position          | node excluded       |
| `passCount` | yes      | node size and tooltip     | node excluded       |
| `xT`        | no       | styling / tooltip context | omit                |

### Edges

| Field       | Required | Why                         | Fallback if missing |
| ----------- | -------- | --------------------------- | ------------------- |
| `sourceId`  | yes      | source-node join            | edge excluded       |
| `targetId`  | yes      | target-node join            | edge excluded       |
| `passCount` | yes      | edge width and thresholding | edge excluded       |
| `xT`        | no       | styling / tooltip context   | omit                |

Also state:

- provider support now:
  - any adapter or consumer pipeline that can aggregate normalized pass events into node and edge inputs
- partial / unsupported:
  - raw pass-event arrays are intentionally not accepted by the chart directly
- acceptable lossy mappings:
  - average-position aggregation and thresholding are part of the chart’s intended abstraction

## Default visual contract

### Layout

- pitch chart with node and edge overlays
- header stats and legend remain part of the chart contract
- tooltips are part of the base chart, not an optional add-on

### Encodings

- node radius encodes pass involvement
- edge width encodes connection volume
- node and edge styling can be overridden through first-class style surfaces
- directed mode preserves arrowheaded reversed pairs instead of undirected merging

### Interaction

- node and edge groups are keyboard-focusable and hoverable
- tooltip detail is shown for both nodes and edges
- `egoHighlight` dims unrelated structure by default

### Empty state

- explicit `No passing network data` overlay when nothing is plottable
- explicit `No connections above threshold` fallback when nodes survive but edges do not

### Fallback / degraded behavior

- sparse networks remain valid
- labels drop away before structure becomes unreadable
- vertical orientation is suitable for narrower cards
- static snapshots remain meaningful without hover

## Internal primitives required

| Primitive / seam     | Status   | Notes                                                                 |
| -------------------- | -------- | --------------------------------------------------------------------- |
| `computePassNetwork` | existing | node/edge models, thresholds, legend rows, header stats, and warnings |
| `Pitch`              | existing | pitch projection, orientation, and theming                            |
| `PitchChartFrame`    | existing | pitch-chart shell, header stats, legend, and accessibility wrapper    |
| `ChartPointMark`     | existing | node rendering                                                        |
| `ChartLineMark`      | existing | edge rendering and hit targets                                        |
| `ChartTooltip`       | existing | node and edge tooltip surface                                         |
| `EmptyState`         | existing | explicit empty/no-edges overlays                                      |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                          | Why it was relevant                                                      | What it revealed                                                     | What Campos should keep or change                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/Volumes/WQ/ref_code/INDEX.md` survey | checked whether a stronger football-specific network analogue was needed | no new reference was needed for this rerun; the gap was spec honesty | keep the current aggregated graph-on-pitch contract and document the live React/export seams rather than old modes |

## Edge-case matrix

- empty data:
  - show explicit empty state
- missing node coordinates:
  - nodes with non-finite or null `x`/`y` are dropped before layout. The excluded count is tracked in `meta.warnings` but warnings are not currently surfaced by the renderer
- unknown edge node references:
  - edges referencing a node ID not present in the network are silently dropped. No console warning is emitted — the exclusion is only visible via the `meta.warnings` array
- below-threshold edges:
  - keep surviving nodes and show the no-connections fallback honestly
- directed reversed pairs:
  - separate visually with arrowheads on opposite sides of the pair axis
- sparse networks:
  - remain readable without pretending density
- label legibility:
  - labels render only when node radius clears the legibility floor
- interaction:
  - focus/hover parity for node and edge tooltips
- static/export:
  - deterministic snapshots remain meaningful with no hover dependency

## Demo requirements

- required page path:
  - `apps/site/src/pages/passnetwork.astro`
- minimum story coverage:
  - hero/default
  - xT-colour styling
  - high-threshold decluttered view
  - directed edges
  - vertical orientation
  - sparse fallback
  - static export
  - empty state
  - responsive width pressure
  - recipe-level shared-pitch / side-by-side comparison

## Test requirements

- React tests:
  - zero-config shell with header stats and legend
  - empty state
  - node/edge interactive groups
  - label visibility rules
  - threshold fallback
  - node and edge tooltip behavior
  - ego-highlight on/off
  - directed arrowheads and reversed-pair separation
  - style injection for nodes and edges
  - accessibility checks
- site verification:
  - page builds cleanly and documents export/composition posture honestly

## Review plan

- loop 1:
  - align the active spec with the live React and export surfaces
- loop 2:
  - verify page/API text, tests, and recipe language match shipped behavior
- loop 3:
  - verify desktop/mobile readability, static export messaging, and interaction honesty

## Open questions

- whether a future average-position or defensive-network chart should share more of the graph-on-pitch contract directly
- whether recipe-level compression helpers should eventually move to a more explicit documented utility surface
