# ShotMap Component Spec

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `ShotMap` (public chart component)
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer (`computeShotMap`)
  - `@withqwerty/campos-react` renderer seams (`PitchChartFrame`, `ChartPointMark`, `ChartScaleBar`, `ChartTooltip`, shared legend primitives)
  - `@withqwerty/campos-stadia` pitch surface primitives
  - `@withqwerty/campos-adapters` optionally, when raw provider shots are normalized upstream

## Purpose

- What user task this solves:
  - visualize shot location, outcome, body part, and chance quality in a publishable half-pitch football chart
- Why it belongs in Campos:
  - `ShotMap` is one of the core football-native surfaces and remains the clearest zero-config proof point for the library
- Why it should be public:
  - header stats, scale-bar behavior, body-part semantics, target-line behavior, and preset styling are chart-level product behavior, not consumer glue

## Domain framing

### Football concept

`ShotMap` models a **shot-event visualization**: a plotted view of where shots
occurred, what happened, and how much chance quality they carried.

It is not:

- a generic point chart on top of a pitch
- a provider-payload viewer
- a free-form tactical overlay surface

### Bounded-context ownership

- `schema` owns the canonical shot vocabulary:
  - shot coordinates in Campos pitch space
  - normalized `outcome`
  - normalized `bodyPart`
  - optional `xg`, `context`, and related shot fields
- `adapters` own translation from provider shot/event feeds into canonical
  Campos shots
- `react` owns:
  - the publishable half-pitch default
  - marker/trajectory/chart chrome behavior
  - legend, tooltip, and scale-bar presentation
  - preset-specific editorial read
- `stadia` owns the football surface primitives, not shot semantics

Provider quirks such as Opta event shapes or StatsBomb payload structure belong
upstream of the component contract.

### Canonical input model

The public component expects canonical Campos `Shot[]` data that has already had
provider translation resolved upstream.

That means:

- the chart contract is based on football shot semantics
- provider parsing is not part of the component
- fallback behavior is driven by canonical missing fields such as absent `xg`,
  not by provider-specific branches

### Invariants

- plotted shots must already be in canonical Campos pitch space
- `outcome` is required because goal-vs-shot semantics are part of the base
  chart read
- missing `xg` degrades the chart honestly into a non-xG shot map; it does not
  invalidate the component
- `bodyPart` and `context` are semantic enrichments, not prerequisites for the
  chart to remain meaningful
- target-line behavior depends on canonical `endX/endY`, not provider-native
  target semantics
- zero-config output must stay publishable even when the input is sparse or
  partially degraded

## Public API

### Zero-config happy path

```tsx
import { ShotMap } from "@withqwerty/campos-react";

<ShotMap shots={shots} />;
```

This renders a publishable attacking-half shot map with:

- default editorial pitch treatment
- marker semantics for goals vs shots
- xG-driven size/color behavior when xG is present
- fallback behavior when xG is missing
- accessible hover/focus marker interaction

### Current public surface

`ShotMapProps` combines the compute input with live renderer seams:

- base data/layout inputs from `ComputeShotMapInput`
  - `shots`
  - `preset`
  - `colorScale`
  - `pitchTheme`
  - `pitchColors`
  - `showHeaderStats`
  - `showSizeScale`
  - `showLegend`
  - `showShotTrajectory`
- first-class style injection seams
  - `markers`
  - `trajectories`

### Migration note

- As of the 2026-04 chart-library pass, the built-in analytical default is
  `colorScale="magma"` rather than `"turbo"`.
- Consumers who want the earlier analytical output should now pass
  `colorScale="turbo"` explicitly.
- `XgColorScale` also widened to include `"cividis"`.

### Advanced customization points

- `markers` is the main point-level style surface:
  - `fill`
  - `fillOpacity`
  - `stroke`
  - `strokeWidth`
  - `opacity`
  - `size`
  - `shape`
- `trajectories` is the shot-target line surface:
  - `show`
  - `stroke`
  - `strokeWidth`
  - `opacity`
  - `strokeDasharray`
  - `strokeLinecap`
- `preset="opta"` stays the editorial default; `preset="statsbomb"` switches the base read toward the more analytical color/shape grammar
- `showHeaderStats`, `showSizeScale`, and `showLegend` are the bounded layout knobs for tighter cards and small-multiple-style usage

### Export / static posture

- `ShotMap` is part of the stable `ExportFrameSpec` chart union
- the export-safe subset is narrower than the live React surface:
  - constant-only `markers`
  - constant-only `trajectories`
  - no hover/focus tooltip layer
- `ShotMapStaticSvg` remains meaningful without hover because the pitch, markers, legend, and optional scale/header chrome are still visible
- live callback and object-map styling may work in-process, but they are not the stable export contract

### Filtering

Filtering is upstream of the chart for v0.3 alpha:

- consumers pass the already-selected shot array
- future canonical filter dimensions come from normalized shot fields such as `outcome`, `bodyPart`, and `context`
- built-in shared filtering is out of scope for this packet

### Explicit non-goals

- arbitrary consumer-authored overlay children
- dual-team or mirrored shot-map layouts inside the base component
- chart-local filter props such as `filterOutcome`
- custom tooltip payload builders in the base public API
- generic low-level pitch mark composition API

## Required normalized data

`ShotMap` expects canonical Campos shots. Provider parsing belongs in adapters or consumer code upstream.

| Field        | Required | Why it matters                     | Fallback if missing                 |
| ------------ | -------- | ---------------------------------- | ----------------------------------- |
| `x`          | yes      | shot origin                        | shot excluded                       |
| `y`          | yes      | shot origin                        | shot excluded                       |
| `outcome`    | yes      | goal-vs-shot semantics and tooltip | shot excluded if not normalized     |
| `minute`     | no       | tooltip chronology                 | tooltip omits minute                |
| `playerName` | no       | tooltip primary label              | show a generic fallback             |
| `xg`         | no       | size/color encoding and scale bar  | neutral fallback mode, no size bar  |
| `bodyPart`   | no       | shape semantics                    | fall back to `other` / default mark |
| `endX/endY`  | no       | target-line rendering              | omit trajectory line                |
| `context`    | no       | tooltip context row                | omit                                |

Also state:

- provider support now:
  - adapters with normalized shot locations, primarily StatsBomb and Opta-derived feeds
- partial / unsupported:
  - providers without xG still support an honest fallback shot map, but not the full xG encoding story
- acceptable lossy mappings:
  - body-part collapse and missing xG are acceptable if they are handled through the documented fallback behavior

## Default visual contract

### Layout

- attacking-half pitch view
- optional header stats
- optional xG scale bar
- plot-first layout with compact legend behavior

### Encodings

- point position encodes shot origin
- marker outline/fill semantics distinguish goals from non-goals
- marker size and color encode xG when available
- shape can encode body-part or analytical grouping through the explicit style surface
- trajectory lines are optional and only render when the shot carries a target location

### Interaction / accessibility behavior

- each plottable shot marker is keyboard-focusable
- hover/focus reveals the tooltip in the live component
- the chart remains meaningful without hover because the visible geometry still tells the core story

### Empty / fallback behavior

- no shots:
  - show the attacking half with honest empty-state copy
- no xG:
  - drop the size scale and fall back to neutral marker semantics without breaking the shot/outcome read
- sparse datasets:
  - remain valid and publishable

### Fallback / degraded behavior

- dense clusters should stay location-first rather than inflate into imprecise bubbles
- long or multilingual names should remain inside tooltip, not become persistent on-pitch labels
- static/export mode must degrade to the bounded contract rather than implying live tooltip parity

## Internal primitives required

| Primitive / seam    | Status   | Notes                                                              |
| ------------------- | -------- | ------------------------------------------------------------------ |
| `computeShotMap`    | existing | owns stats, legends, scale-bar decisions, presets, and shot models |
| `PitchChartFrame`   | existing | shared pitch-chart shell                                           |
| `ChartPointMark`    | existing | shot markers                                                       |
| `ChartScaleBar`     | existing | xG size/color explanation when xG is present                       |
| `ChartTooltip`      | existing | live interaction surface                                           |
| shared legend seams | existing | goal-vs-shot and body-part / preset legend content                 |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                                  | Why relevant              | What it covers                             | What Campos should keep                 | What Campos should change                                                                         |
| ---------------------------------------------- | ------------------------- | ------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/Volumes/WQ/ref_code/mplsoccer` shot examples | shot-map football grammar | half-pitch framing, dense-cluster handling | compact attacking-half football grammar | diverge with accessible interaction, explicit React-first style seams, and bounded export posture |

## Edge-case matrix

- empty data:
  - pitch plus honest empty-state copy
- sparse data:
  - valid minimal chart
- dense overlap:
  - preserve coordinate precision before marker size drama
- all-null `xg`:
  - disable scale-bar behavior and use fallback shot semantics
- mixed-null `xg`:
  - xG-bearing shots still encode xG; null shots degrade safely
  - NaN xG is treated as the no-xG branch (fallback size, no color encoding)
- out-of-range `xg`:
  - xG is clamped to `[0, 1]` for both marker size and color. A shot with `xg: 5` (e.g. an adapter emitting permilles) must not produce a marker larger than the penalty area. Clamping is applied inside `optaMarkerSize` and `statsbombMarkerSize` (`compute/shot-map.ts`)
- out-of-range coordinates:
  - shots with non-finite `x` or `y` are filtered before plotting; the remainder must clamp to pitch bounds
- long / multilingual text:
  - tooltip remains stable and on-pitch labels stay restrained
- touch/mobile interaction:
  - tap/focus interaction remains usable without persistent labels
- responsive behavior:
  - the demo page shows three tiers (normal, small, smallest). At `smallest`, `showSizeScale` and `showLegend` are suppressed; `showHeaderStats` follows suit. The pitch-marker read must survive before chrome density does
- export/static:
  - bounded constant-only style subset, no hover layer

## Demo requirements

- required page path:
  - `apps/site/src/pages/shotmap.astro`
- minimum story coverage:
  - hero/default
  - analytical preset
  - body-part shape encoding
  - no-xG fallback
  - static export
  - empty state
  - responsive pressure
  - themeability

## Test requirements

- React tests:
  - zero-config shell
  - header/legend/scale toggles
  - empty state
  - no-xG fallback
  - trajectory rendering and hiding
  - constant and object-map style injection for markers/trajectories
  - dark-theme visibility for hollow non-goal markers
  - body-part edge cases such as `other`
  - tooltip interaction and accessibility
- export tests:
  - stable contract uses constant-only `markers` / `trajectories`
- site verification:
  - page builds cleanly and visually remains publishable at desktop and mobile widths

## Review plan

- loop 1:
  - keep the spec aligned with the current React-first surface and bounded export-safe subset
- loop 2:
  - verify the page and tests still cover the actual product contract
- loop 3:
  - re-run tests, site build, and browser verification on current standards

## Open questions

- whether a later W1/W2 pass should standardize the page-level wording for “editorial preset” vs “analytical preset” across ShotMap and PassMap
