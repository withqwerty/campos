# Style Injection Foundation Spec

**Status:** superseded by Wave R1 — see `docs/status/matrix.md`
**Owner:** Campos
**Target version:** v0.3+ (original) — now being executed as Wave R1
**Scope:** first-class style injection and visual-encoding customization across `@withqwerty/campos-react` and static export

> **Updated direction:** This spec described the audit and foundation plan for style injection. That foundation work is now being executed as Wave R1 (React-first style reset). Key changes from this spec's original framing:
>
> - Style vocabulary (`points`, `lines`, `areas`, `glyphs`, `text`, `guides`, `badges`) lives entirely in `@withqwerty/campos-react`, not shared across core and react
> - Callback functions are the primary public API — not just an escape hatch
> - `@withqwerty/campos-core` is not involved in styling decisions
> - Python parity is no longer a goal; export parity is best-effort with explicit unsupported cases documented
>
> The audit table and per-component gap analysis below remain useful as context for the R1 migration. See `docs/status/matrix.md` (packets R1b–R1g) for current per-component status.

## Purpose

Campos currently has strong zero-config defaults, but its customization surface is not yet coherent at the library level.

Today the library mixes several different patterns:

- chart-level mode switches such as `colorBy`, `shapeBy`, `sizeBy`
- renderer-local constant overrides such as `shotTrajectoryStyle`
- richer React-only escape hatches such as `Formation.marker.glyph` and `Formation.marker.slots`
- chart-local style props such as `PizzaChart` grid-ring styling
- primitives that are intentionally geometry-only and expose no library-level style contract

That is enough to ship good defaults, but not enough to support a first-class user story like:

- style shot trajectories by outcome
- style pass lines by recipient, result, or team
- change formation marker glyph shape by position or player status
- keep legends, filtering, and export honest when those styles are data-driven

This packet audits the current surface and defines the improvement plan.

## Core decision

Campos needs a **first-class style injection mechanism** that is separate from:

- canonical data normalization
- `sourceMeta`
- renderer-local one-off escape hatches

The library should explicitly distinguish:

1. **Data**
   - canonical fields in schema packages
   - provider-scoped provenance in `sourceMeta`
2. **Encoding**
   - which data dimension drives a visual channel
   - examples: `colorBy="xg"`, `shapeBy="bodyPart"`
3. **Style injection**
   - constant or data-driven control over mark appearance
   - examples: stroke by outcome, dash by result, glyph kind by position code

`sourceMeta` remains a provenance/debugging escape hatch, not the style system.

## Current library state by family

| Family                           | Current surface                                                                                                  | Main gaps                                                                                                                     | Required direction                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Pitch event overlays             | `ShotMap`, `PassMap`, `PassNetwork` expose a few chart-local encoding switches and some constant style overrides | no shared line-style or point-style injection contract; high-cardinality styling unsupported; legends and export support vary | define shared point/line channel contracts and move data-driven style resolution into core |
| Pitch surfaces                   | `Heatmap`, `Territory`, `KDE` expose some scale and pitch options                                                | cell, label, and overlay styling is chart-local; no common area/text style contract                                           | define area/text style seams and keep pitch treatment consistent                           |
| Formation and marker composition | `Formation` has the richest escape hatch via glyph and slot renderers                                            | powerful but React-specific; export blocks some custom paths; no core-level style categories                                  | split stable styleable channels from renderer-only composition seams                       |
| Cartesian charts                 | `ScatterPlot`, `CometChart`, `XGTimeline`, `BumpChart` each expose local customization points                    | guide, point, line, label, and annotation styling are inconsistent across charts                                              | define shared Cartesian style channel families and standard guide/reference styling        |
| Radial charts                    | `RadarChart` and `PizzaChart` each own local ring/spoke/grid styling                                             | no shared radial style contract; chart-local style props differ                                                               | define shared radial grid/axis/reference style objects                                     |
| Composition primitives           | `StatBadge` is customizable but not through a consistent token contract                                          | no library-level semantic token story for non-SVG composition components                                                      | define a small semantic token surface for HTML composition primitives                      |
| Shared primitives                | geometry primitives are correctly stateless                                                                      | no shared style object types above raw SVG props; no reusable legend/filter/export metadata contract for style channels       | add shared style value types without making primitives own chart semantics                 |

## Component audit

### ShotMap

Current strengths:

- core already resolves marker semantics and legend groups
- chart has useful mode switches: `preset`, `colorBy`, `shapeBy`
- recent shot trajectory work added a constant renderer-level line style seam

Current gaps:

- trajectories only accept a global style object
- there is no first-class split between marker styling and trajectory styling
- users cannot style trajectories by `outcome`, `bodyPart`, `shotContext`, or consumer-owned buckets without chart-local hacks
- legend/filter metadata does not yet cover trajectory channels

Needed improvements:

- separate `markers` and `trajectories` into distinct styleable mark families
- allow data-driven `stroke`, `strokeDasharray`, `opacity`, and possibly `strokeWidth` for trajectories
- return stable trajectory style keys from core when trajectory styling is active
- keep zero-config defaults unchanged when no style injection is provided

### PassMap

Current strengths:

- clear zero-config story
- `colorBy` already exposes a meaningful chart-level encoding choice

Current gaps:

- only one resolved `color` currently survives in the mark model
- no first-class control of dash, width, opacity, arrowhead, or dot fallback styling
- no honest way to style by recipient or other higher-cardinality fields

Needed improvements:

- split line and dot styling as separate mark families
- support data-driven line channels: `stroke`, `strokeDasharray`, `opacity`, `strokeWidth`, `arrowhead`
- support high-cardinality style policies explicitly: legend off, top-N legend, or no legend
- preserve chart-level `colorBy` as the simple path, but make it a thin shorthand over the same style/encoding contract

### PassNetwork

Current strengths:

- core already resolves more of the visual model than PassMap does
- separate node and edge concepts already exist

Current gaps:

- customization is still framed as chart-level knobs like `colorBy`, `sizeBy`, `nodeColor`
- there is no general node/edge style injection mechanism

Needed improvements:

- define `nodes` and `edges` as separate styleable families
- support style injection for node fill/stroke/label treatment and edge stroke/width/opacity/direction affordances
- keep `colorBy` and `sizeBy` as convenience shorthands, not as the only extensibility surface

### Formation

Current strengths:

- best current example of rich customization
- marker glyph and slot composition prove real demand for style injection

Current gaps:

- current customization is mostly React-only and bypasses core
- export explicitly rejects some custom glyph/slot paths
- there is no stable core-level marker style category model

Needed improvements:

- distinguish **stable style channels** from **renderer-only composition seams**
- keep `glyph` and `slots` for advanced React composition, but add a first-class styleable marker contract for:
  - glyph kind
  - glyph fill/stroke/stroke width
  - label treatment
  - badge color semantics
- define an export-safe subset explicitly instead of treating all custom marker work as one bucket

### Heatmap, Territory, KDE

Current strengths:

- already expose pitch theme and scale options
- `Heatmap` and `Territory` share some pitch-line contrast policy

Current gaps:

- area, label, and annotation styling is not consistently modeled
- no common text style seam for in-cell labels or badges
- `KDE` is still especially renderer-local

Needed improvements:

- define shared area-style and text-style channel families where the semantics match
- standardize label/badge styling vocabulary across `Heatmap` and `Territory`
- pull any reusable KDE style controls into the same contract only when they map honestly to a shared concept

### ScatterPlot, CometChart, XGTimeline, BumpChart

Current strengths:

- these charts already share more renderer infrastructure than the pitch family
- `ScatterPlot` is closest to a generic encoding surface through keys like `colorKey` and `sizeKey`

Current gaps:

- guide lines, reference lines, point styling, trail styling, and annotation styling are still chart-local
- similar concepts have different prop shapes across the family

Needed improvements:

- standardize styleable Cartesian families:
  - points
  - lines / trails / steps
  - guides / reference lines
  - labels / annotations
- preserve chart-specific semantics while making style channel names and behavior predictable

### RadarChart and PizzaChart

Current strengths:

- both charts are already internally close in geometry family
- both have obvious styleable concepts: grids, spokes, rings, fills, references

Current gaps:

- grid/reference style APIs are local and inconsistent
- no shared radial style vocabulary exists

Needed improvements:

- define shared radial grid, axis, and reference style contracts
- keep chart-specific semantics local, but stop inventing one-off style object names for equivalent concerns

### StatBadge and other composition primitives

Current strengths:

- simple, useful surface
- not burdened by chart-scene abstraction

Current gaps:

- no shared semantic token contract for HTML composition surfaces
- home/away colors are customizable, but wider chrome/typography treatment is not described as a library-level style story

Needed improvements:

- define a small composition-style token surface for non-SVG components
- avoid forcing these primitives into the full chart encoding model when they only need semantic tokens

## Primitive audit

### Keep geometry primitives geometry-only

The current split is mostly correct:

- `ChartPointMark`
- `ChartLineMark`
- `ChartHeatmapCellLayer`
- `ChartDensitySurfaceImage`

These should stay stateless and projected-coordinate-based.

Needed improvement:

- introduce shared **style object types** that charts can resolve before calling these primitives
- do not move chart semantics, legend policy, or filter state into the primitives

### Legend primitives

Current gaps:

- style-channel metadata is not standardized across categorical, size, and gradient legends
- high-cardinality categories do not have a standard legend suppression policy

Needed improvements:

- add a shared legend metadata contract for style-driven channels
- standardize when legends are hidden, collapsed, or top-N sampled

### Tooltip primitives

Current gaps:

- tooltip chrome is shared, but there is no guidance on style-driven tooltip rows or explanatory copy when injected styling is active

Needed improvements:

- when style injection materially changes interpretation, core should be able to expose explanatory tooltip/legend metadata, not just raw rows

### Marker composition primitives

Current gaps:

- glyphs, pills, badges, and slot layout are powerful but sit outside a shared style vocabulary

Needed improvements:

- define stable token names for marker fill, outline, badge fill, badge text, name pill, and emphasis states
- keep fully custom React slot composition as an advanced seam, not the primary style API

## Required library-level improvements

The following improvements should apply across the library, not chart by chart.

### 1. Add a shared style injection vocabulary

Campos should standardize styleable mark families:

- `point`
- `line`
- `area`
- `glyph`
- `text`
- `guide`
- `badge`

Not every chart will use every family, but the naming should stay stable.

### 2. Add a shared style value model

A style channel should support:

- constant value
- data-driven categorical mapping
- data-driven continuous mapping where honest
- fallback value

At a high level:

```ts
type StyleValue<TValue> =
  | TValue
  | {
      by: string;
      map?: Record<string, TValue>;
      palette?: string;
      fallback?: TValue;
    };
```

The exact type can evolve, but the capability should be shared.

### 3. Keep style resolution in core where semantics matter

Core should resolve:

- style keys and final resolved tokens when cross-renderer consistency matters
- legend/filter metadata for style-driven channels
- auto-hide behavior for non-informative legends

React should keep owning:

- interaction wiring
- DOM/SVG painting
- React-only composition seams that cannot honestly live in core

### 4. Return both semantic keys and resolved tokens

When style injection is active, core models should expose both:

- the resolved visual token used for rendering
- the semantic key that produced it

That keeps legends, filtering, accessibility copy, and export coherent.

### 5. Define high-cardinality policy explicitly

Some user requests imply high-cardinality styling:

- pass line by recipient
- scatter point by player
- bump line by team logo

The library should explicitly define:

- when legends are hidden
- when legends show only top-N
- when styling is allowed without legend emission

### 6. Define an export-safe subset

Style injection must not silently exceed what static export can support.

Each family should define:

- fully supported style channels
- degraded but acceptable fallbacks
- unsupported React-only escape hatches

### 7. Distinguish shorthand props from the general mechanism

Props like:

- `colorBy`
- `shapeBy`
- `sizeBy`
- `nodeColor`

should remain when they are useful, but they should be treated as convenience shorthands over the same underlying style/encoding system, not as a separate competing API.

### 8. Add first-class docs and tests for style injection

For any component that adopts the mechanism, the packet should include:

- zero-config behavior
- one constant override example
- one data-driven style example
- legend/export behavior
- edge cases such as all-same category and all-null category

## Proposed contract shape

This packet does not lock the final TypeScript signatures, but the target shape should look like this conceptually:

```ts
type MarkStyleConfig = {
  defaults?: Record<string, unknown>;
  encode?: Record<string, unknown>;
};
```

Chart examples:

- `ShotMap`
  - `markers?: PointStyleConfig`
  - `trajectories?: LineStyleConfig`
- `PassMap`
  - `lines?: LineStyleConfig`
  - `dots?: PointStyleConfig`
- `PassNetwork`
  - `nodes?: PointStyleConfig`
  - `edges?: LineStyleConfig`
- `Formation`
  - `markers?: GlyphStyleConfig`
  - advanced React-only `marker.glyph` and `marker.slots` remain available as separate composition seams

The contract should be expressed in chart language, but backed by shared style-family types.

## SourceMeta boundary

Style injection must not be routed through `sourceMeta`.

Rules:

- provider provenance stays in `sourceMeta`
- consumer-owned styling should use the chart's style injection API
- if a provider field may be useful as a style dimension, either:
  - keep it honestly provider-scoped in `sourceMeta` until promoted, or
  - promote it into the canonical schema when it becomes reusable and cross-provider
- do not store final visual tokens like `fill`, `stroke`, `markerShape`, or `dashArray` in provider `sourceMeta` as if they were normalized data

## Rollout order

### Phase 1: foundation packet

- lock shared terminology and boundary rules
- update `sourceMeta` guidance
- identify export-safe subset expectations

### Phase 2: first consumers

Start with the highest-confidence components:

1. `ShotMap`
2. `PassMap`
3. `Formation`
4. `ScatterPlot`

These cover the widest spread of styleable families with the clearest user demand.

### Phase 3: family convergence

- `PassNetwork`
- `XGTimeline`
- `BumpChart`
- `RadarChart`
- `PizzaChart`
- `Heatmap`
- `Territory`
- `KDE`

### Phase 4: composition and export closure

- `StatBadge` and composition surfaces
- static export parity
- docs/demo alignment
- filtering/legend convergence where style injection overlaps future shared filtering

## Exit criteria for the foundation

This packet should be considered complete when:

- the library-level audit exists
- the `sourceMeta` boundary is explicit
- the shared style family vocabulary is defined
- the first-consumer rollout order is explicit
- the status matrix records style injection as an active foundation rather than an ad hoc chart-local concern
