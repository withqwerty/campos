# Pitch Analyst Overlay + Small-Multiples Composition Spec

**Status:** queued adjacent packet
**Last updated:** 2026-04-20

## Header

- Components / primitives:
  - existing:
    - `SmallMultiples<T>`
    - `CellLabel`
    - `Pitch`
    - `ShotMap`
    - `PassMap`
    - `Heatmap`
    - `KDE`
    - `PassNetwork`
  - proposed:
    - `PitchCell`
    - `PitchPointsLayer<T>`
    - `PitchLinesLayer<T>`
    - `PitchBinsLayer`
    - `PitchLabelsLayer<T>`
- Target version: v0.3+
- Depends on:
  - `docs/specs/smallmultiples-spec.md`
  - `docs/standards/react-renderer-conventions.md`
  - `@withqwerty/campos-stadia` `Pitch`
  - shared style vocabulary already established in `@withqwerty/campos-react`

## Purpose

Campos already has two useful ends of the spectrum:

- high-level pitch charts with football-native defaults (`ShotMap`, `PassMap`, `Heatmap`, `KDE`, `PassNetwork`)
- low-level pitch surface composition through `Pitch`

What is still missing is the middle layer:

- a clean, supported way to build dense analyst-style pitch cells inside `SmallMultiples`
- a reusable set of pitch-overlay layer primitives so consumers do not have to drop to raw SVG for every custom analyst view

This spec defines that middle layer.

Per [docs/status/matrix.md](https://github.com/withqwerty/campos/blob/main/docs/status/matrix.md), the `SmallMultiples` analyst-grid follow-up has now closed without opening `PitchCell`. This document remains directionally useful, but `PitchCell` and the overlay-layer family are still queued rather than in flight.

## Problem statement

Users want all of these to be honest and ergonomic:

1. repeat existing pitch charts in a grid
   - half-pitch team shot maps
   - compact pass maps
2. build bespoke repeated pitch analysis that does **not** match an existing chart contract
   - full-pitch progressive-pass heat maps
   - seasonal penalty-box touches by top scorer
   - goal-kick ending locations
   - mixed point + line + label overlays in one cell
3. stay inside Campos primitives while doing so
   - reuse marker, arrow, cell, and label primitives
   - avoid hand-authoring all SVG geometry for each analyst recipe

The library should support all three without lying about what each layer is for.

## Core decision

Campos should support **three explicit composition paths** for pitch analysis inside `SmallMultiples`.

### Path 1 — Reuse an existing chart

Preferred when the analyst question is already the chart's semantic job.

Examples:

- half-pitch team shot map → `ShotMap`
- repeated pass-origin/destination cells → `PassMap`
- repeated event-density cells with the chart's own semantics → `Heatmap` or `KDE`
- repeated editorial zone cards → `Territory`
- repeated coarse flow tiles → `PassFlow`

### Path 2 — Use a purpose-built pitch cell with reusable overlay layers

Preferred when the analyst question is pitch-based but more bespoke than any one shipped chart.

Examples:

- progressive-pass heat map with custom binning
- penalty-box touches by player
- goal-kick ending locations
- mixed overlays: bins + arrows + points + text

### Path 3 — Use raw `Pitch` with custom SVG

Still explicitly supported as the escape hatch for shapes or semantics the reusable layer family does not yet cover.

Examples:

- one-off custom tactical diagrams
- highly specialized annotations
- unusual mark geometry not represented by points, lines, bins, or labels

The presence of Path 3 is intentional, but it must not be the only way to build honest analyst grids.

## What this spec is not

This spec does **not** say:

- every bespoke analyst view should become a chart component
- `ShotMap` or `Heatmap` should absorb arbitrary overlay use cases
- `Pitch` itself should become a chart shell or legend system
- `SmallMultiples` should introspect cell content or own pitch rendering
- arbitrary custom `renderCell` functions become part of the stable export contract

## Decision table

| Use case                                         | Preferred surface                                    | Why                                                                       |
| ------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| team shot maps on attacking half                 | `ShotMap` in `SmallMultiples`                        | existing chart semantics match the task                                   |
| compact repeated pass maps                       | `PassMap` in `SmallMultiples`                        | existing chart semantics match the task                                   |
| compact repeated heatmaps                        | `Heatmap` in `SmallMultiples`                        | existing chart semantics match the task                                   |
| editorial repeated zone cards                    | `Territory` in `SmallMultiples`                      | existing chart semantics match the task                                   |
| repeated tactical flow tiles                     | `PassFlow` in `SmallMultiples`                       | existing chart semantics match the task                                   |
| progressive-pass heat maps with custom binning   | `PitchCell` + `PitchBinsLayer`                       | aggregation semantics are bespoke                                         |
| penalty-box touches by player                    | `PitchCell` + `PitchPointsLayer`                     | bespoke point analysis, no need for chart chrome                          |
| goal-kick inside/outside-box end locations       | `PitchCell` + `PitchPointsLayer`                     | bespoke point analysis, dense editor-facing layout                        |
| custom shot map with marker + trajectory grammar | `PitchCell` + `PitchPointsLayer` + `PitchLinesLayer` | reuse Campos mark primitives without forcing the whole `ShotMap` contract |
| unusual tactical annotations                     | raw `Pitch` + custom SVG                             | escape hatch remains necessary                                            |

## Ownership boundaries

### `@withqwerty/campos-stadia`

Owns:

- pitch projection
- pitch markings
- crop / side / frame math
- pitch theme and color treatment

Does **not** own:

- football-event semantics
- analyst overlay layers
- comparison-grid behavior
- chart-level legends, labels, or stats

### `@withqwerty/campos-react`

Owns:

- analyst overlay layer primitives
- chart-level compact-mode seams
- the ergonomic `PitchCell` wrapper
- style callbacks and shared-scale plumbing

### `SmallMultiples`

Owns:

- layout
- per-cell labels
- per-cell error handling
- optional shared pitch-view hints

Does **not** own:

- pitch rendering
- overlay semantics
- legend generation
- tooltip state for custom overlays

## Public API direction

## Existing support that remains valid

This is already a supported pattern and stays supported:

```tsx
<SmallMultiples
  items={teams}
  getItemKey={(team) => team.id}
  pitchOrientation="horizontal"
  pitchCrop="full"
  renderCell={(team, _index, view) => (
    <Pitch
      crop={view.pitchCrop ?? "full"}
      orientation={view.pitchOrientation ?? "horizontal"}
      interactive={false}
    >
      {({ project }) => <g>{/* custom marks */}</g>}
    </Pitch>
  )}
/>
```

That path is already first-class. The new overlay family is an ergonomic and consistency layer on top of it, not a replacement.

## Proposed `PitchCell`

`PitchCell` is a React-layer wrapper around `Pitch` for chart/cell composition.

It is **not** a new Stadia primitive.

### Why it should exist

It removes repeated glue:

- map `SmallMultiplesView` into `Pitch`
- set sensible cell-oriented defaults
- keep underlay/overlay layering explicit
- give users a stable place to start when building custom repeated pitch visuals

### Proposed API

```ts
export type PitchCellProps = {
  view?: SmallMultiplesView;
  crop?: "full" | "half";
  orientation?: "horizontal" | "vertical";
  side?: "attack" | "defend";
  frame?: "crop" | "full";
  theme?: "primary" | "secondary";
  colors?: PitchColors;
  markings?: PitchMarkingsConfig;
  grass?: GrassPattern | undefined;
  padding?: PitchPadding;
  interactive?: boolean;
  ariaLabel?: string;
  underlay?: (ctx: PitchCellRenderContext) => ReactNode;
  children: (ctx: PitchCellRenderContext) => ReactNode;
};

export type PitchCellRenderContext = {
  project: ProjectFn;
  sharedScale?: SharedPitchScale;
  crop: "full" | "half";
  orientation: "horizontal" | "vertical";
  side: "attack" | "defend";
};
```

### `PitchCell` defaults

- `interactive={false}`
- `frame="crop"`
- `theme="primary"`
- if `view` is provided:
  - `orientation` defaults from `view.pitchOrientation`
  - `crop` defaults from `view.pitchCrop`
  - `sharedScale` is forwarded into the render context
- `side` remains local for now
  - it is a real pitch concern, but not yet part of `SmallMultiplesView`

### Why `PitchCell` should be a wrapper, not a fork

- Stadia `Pitch` is already the correct pitch surface
- the missing piece is ergonomic composition, not new projection math
- keeping `PitchCell` in `@withqwerty/campos-react` preserves the boundary:
  - Stadia = surface
  - React = analyst layers and chart composition

## Proposed analyst overlay layer family

The first layer family should stay narrow and cover the common repeated analyst recipes.

### 1. `PitchPointsLayer<T>`

Purpose:

- shots
- touches
- receptions
- goal-kick end locations
- any repeated point distribution on a pitch

```ts
export type PitchPointLayerContext<T> = {
  datum: T;
  index: number;
  sharedScale?: SharedPitchScale;
};

export type PitchPointsStyle<T> = {
  show?: StyleValue<boolean, PitchPointLayerContext<T>>;
  fill?: StyleValue<string, PitchPointLayerContext<T>>;
  fillOpacity?: StyleValue<number, PitchPointLayerContext<T>>;
  stroke?: StyleValue<string, PitchPointLayerContext<T>>;
  strokeWidth?: StyleValue<number, PitchPointLayerContext<T>>;
  opacity?: StyleValue<number, PitchPointLayerContext<T>>;
  size?: StyleValue<number, PitchPointLayerContext<T>>;
  shape?: StyleValue<PointShape, PitchPointLayerContext<T>>;
};

export type PitchPointsLayerProps<T> = {
  data: readonly T[] | null | undefined;
  project: ProjectFn;
  getX: (datum: T, index: number) => number | null | undefined;
  getY: (datum: T, index: number) => number | null | undefined;
  sharedScale?: SharedPitchScale;
  points?: PitchPointsStyle<T>;
};
```

Implementation note:

- built on `ChartPointMark`
- accepts pitch-space coordinates, not projected coordinates
- silently skips null / non-finite points

### 2. `PitchLinesLayer<T>`

Purpose:

- shot trajectories
- pass arrows
- carry segments
- connection lines

```ts
export type PitchLineLayerContext<T> = {
  datum: T;
  index: number;
  sharedScale?: SharedPitchScale;
};

export type PitchLinesStyle<T> = {
  show?: StyleValue<boolean, PitchLineLayerContext<T>>;
  stroke?: StyleValue<string, PitchLineLayerContext<T>>;
  strokeWidth?: StyleValue<number, PitchLineLayerContext<T>>;
  opacity?: StyleValue<number, PitchLineLayerContext<T>>;
  strokeDasharray?: StyleValue<string | undefined, PitchLineLayerContext<T>>;
  strokeLinecap?: StyleValue<"butt" | "round" | "square", PitchLineLayerContext<T>>;
};

export type PitchLinesLayerProps<T> = {
  data: readonly T[] | null | undefined;
  project: ProjectFn;
  getX1: (datum: T, index: number) => number | null | undefined;
  getY1: (datum: T, index: number) => number | null | undefined;
  getX2: (datum: T, index: number) => number | null | undefined;
  getY2: (datum: T, index: number) => number | null | undefined;
  sharedScale?: SharedPitchScale;
  lines?: PitchLinesStyle<T>;
  markerEnd?: "none" | "arrow";
};
```

Implementation note:

- built on `ChartLineMark`
- arrowheads are a bounded affordance because they are a repeated football pattern
- no built-in tooltip or hit-state ownership

### 3. `PitchBinsLayer`

Purpose:

- progressive-pass heat maps
- touch density by custom zones
- rectangular event counts or shares

```ts
export type PitchBin = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  value?: number | null;
  fill?: string;
  label?: ReactNode;
};

export type PitchBinsLayerProps = {
  bins: readonly PitchBin[] | null | undefined;
  project: ProjectFn;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
};
```

Implementation note:

- built on `ChartHeatmapCellLayer`
- binning stays upstream; the layer does not compute grids from raw events

### 4. `PitchLabelsLayer<T>`

Purpose:

- zone values
- player initials
- on-pitch annotation copy
- compact per-cell analyst callouts

```ts
export type PitchLabelLayerContext<T> = {
  datum: T;
  index: number;
  sharedScale?: SharedPitchScale;
};

export type PitchLabelsStyle<T> = {
  show?: StyleValue<boolean, PitchLabelLayerContext<T>>;
  fill?: StyleValue<string, PitchLabelLayerContext<T>>;
  opacity?: StyleValue<number, PitchLabelLayerContext<T>>;
  fontSize?: StyleValue<number, PitchLabelLayerContext<T>>;
  fontWeight?: StyleValue<number | string, PitchLabelLayerContext<T>>;
  textAnchor?: StyleValue<"start" | "middle" | "end", PitchLabelLayerContext<T>>;
};

export type PitchLabelsLayerProps<T> = {
  data: readonly T[] | null | undefined;
  project: ProjectFn;
  getX: (datum: T, index: number) => number | null | undefined;
  getY: (datum: T, index: number) => number | null | undefined;
  getText: (datum: T, index: number) => ReactNode;
  sharedScale?: SharedPitchScale;
  labels?: PitchLabelsStyle<T>;
};
```

Implementation note:

- text stays an SVG overlay, not an HTML overlay
- rich chips/badges remain out of scope for the first packet

## What the layer family should intentionally not do

- no provider parsing
- no event filtering
- no hidden aggregation from raw events into bins
- no built-in tooltip system
- no built-in legend generation
- no automatic label collision avoidance in the first packet
- no automatic “shot map” or “pass map” semantic bundle

Those concerns either belong upstream or in full chart components.

## Reusable “build your own shot map” story

Yes, this should be explicitly supported.

The intended path is:

```tsx
<PitchCell view={view}>
  {({ project, sharedScale }) => (
    <>
      <PitchLinesLayer
        data={shots}
        project={project}
        getX1={(shot) => shot.x}
        getY1={(shot) => shot.y}
        getX2={(shot) => shot.endX}
        getY2={(shot) => shot.endY}
        lines={{
          stroke: ({ datum }) => (datum.outcome === "goal" ? "#dc2626" : "#64748b"),
          strokeDasharray: ({ datum }) =>
            datum.outcome === "blocked" ? "4 3" : undefined,
        }}
      />
      <PitchPointsLayer
        data={shots}
        project={project}
        getX={(shot) => shot.x}
        getY={(shot) => shot.y}
        sharedScale={sharedScale}
        points={{
          size: ({ datum, sharedScale }) => {
            const domain = sharedScale?.sizeDomain ?? [0, 1];
            return 0.8 + ((datum.xg ?? 0) - domain[0]) / (domain[1] - domain[0] || 1);
          },
          fill: ({ datum }) => (datum.outcome === "goal" ? "#dc2626" : "#ffffff"),
          stroke: ({ datum }) => (datum.outcome === "goal" ? "#dc2626" : "#475569"),
        }}
      />
    </>
  )}
</PitchCell>
```

That gives users:

- a custom shot-map grammar
- Campos marker and line primitives
- no need to fork `ShotMap`

## Small Multiples integration rules

### What should be shared at grid level

`SmallMultiplesView` remains the grid-owned comparability contract:

- `pitchOrientation`
- `pitchCrop`
- `sharedScale`

### What should remain local to the cell

These stay cell-owned for now:

- `side`
- `frame`
- `padding`
- tactical `markings`
- any bespoke legend or subtitle logic

Reason:

- they are editorial / surface decisions, not always comparability decisions
- forwarding too much pitch state from the grid risks turning `SmallMultiples` into a pitch container rather than a layout primitive

### Grid-level custom-overlay story

The intended custom-overlay pattern is:

```tsx
<SmallMultiples
  items={teams}
  pitchOrientation="horizontal"
  pitchCrop="full"
  sharedScale={sharedScale}
  renderLabel={(team) => <CellLabel title={team.name} caption={team.summary} />}
  renderCell={(team, _index, view) => (
    <PitchCell view={view}>
      {({ project, sharedScale }) => (
        <>
          <PitchBinsLayer bins={team.progressivePassBins} project={project} />
          <PitchPointsLayer
            data={team.touches}
            project={project}
            getX={(touch) => touch.x}
            getY={(touch) => touch.y}
            sharedScale={sharedScale}
          />
        </>
      )}
    </PitchCell>
  )}
/>
```

This is the preferred bespoke analyst path.

## Dense analyst-grid contract

Any surface used in dense repeated pitch grids must satisfy all of these:

1. no required internal header chrome
2. no required internal legend chrome
3. no HTML overlay that depends on roomy cards
4. pitch remains readable at small cell sizes
5. labels and editorial copy can live outside the pitch itself

This applies both to:

- existing charts used in grids
- `PitchCell` plus custom overlay layers

## Interaction policy

### Existing charts

Keep their chart-owned interaction semantics.

### Analyst overlay layers

Default policy:

- geometry-only
- `aria-hidden` by default
- no built-in selection or tooltip state

If a consumer wants interactive custom overlays, they can wrap layer output with chart-owned groups or own event handling directly in the render function.

That keeps primitive ownership honest.

## Export / SSR posture

- existing export-safe charts keep their current bounded `ExportFrameSpec` contract
- `PitchCell` and arbitrary custom overlay composition are **not** part of the stable export schema in this packet
- SSR/live React rendering should work because the surfaces stay pure and SVG-based
- serializable export support for arbitrary custom pitch cells is explicitly deferred

## Internal primitive mapping

| Public surface     | Internal primitive base                                  | Status         |
| ------------------ | -------------------------------------------------------- | -------------- |
| `PitchCell`        | `@withqwerty/campos-stadia` `Pitch`                      | new wrapper    |
| `PitchPointsLayer` | `ChartPointMark`                                         | new extraction |
| `PitchLinesLayer`  | `ChartLineMark`                                          | new extraction |
| `PitchBinsLayer`   | `ChartHeatmapCellLayer`                                  | new extraction |
| `PitchLabelsLayer` | local SVG `<text>` plus shared style callback resolution | new extraction |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                       | Why relevant                            | What it covers                                   | What Campos should keep                                       | What Campos should change                                                                   |
| ----------------------------------- | --------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/Volumes/WQ/ref_code/mplsoccer`    | dense football analyst grids            | shot maps, pass maps, event overlays, pitch bins | football-native repeated pitch patterns and analyst recipes   | diverge with React composition, explicit callback styling, and no matplotlib-style bundling |
| `/Volumes/WQ/ref_code/d3-soccer`    | browser SVG layering                    | pitch diagrams, heatmaps, event overlays         | thin SVG layering over a stable pitch surface                 | diverge by separating Stadia surface ownership from React overlay and chart semantics       |
| `/Volumes/WQ/ref_code/kloppy`       | canonical event-coordinate discipline   | normalized football event coordinates            | upstream normalization before visualization                   | keep provider parsing out of the overlay layer family                                       |
| `/Volumes/WQ/ref_code/socceraction` | bespoke derived football event products | progressive-pass and action-value style products | analyst views often start from derived products, not raw rows | keep aggregation/derivation upstream instead of teaching overlay layers raw-event semantics |

## Edge-case matrix

| Case                                             | Expected behavior                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| empty `items` in `SmallMultiples`                | grid empty state, not a pitch cell                                                    |
| item exists but local overlay data is empty      | still render the pitch cell honestly; no marks is a valid per-cell outcome            |
| points outside pitch bounds                      | do not throw; project or clip consistently with the pitch viewport                    |
| points/lines outside the visible crop            | clipped by the pitch viewport unless the consumer chooses a full frame                |
| half-pitch custom overlay needs defensive half   | consumer sets `side="defend"` locally on `PitchCell` / `Pitch`                        |
| shared scale omitted                             | cells fall back to local style logic                                                  |
| shared scale partially populated                 | only relevant channels read it                                                        |
| dense overlap on tiny cells                      | preserve geometry first; do not add automatic collision logic in this packet          |
| long labels/captions outside pitch               | `CellLabel` or custom figcaption handles wrapping; pitch surface stays uncluttered    |
| bins with `value: null`                          | cell still renders if `fill` is present; otherwise treat as visually empty            |
| mixed chart and custom-overlay cells in one grid | valid, but discouraged unless editorially intentional                                 |
| custom overlay plus built-in chart in same cell  | valid if consumer composes it deliberately; library should not assume this by default |
| interactive custom overlays on touch/mobile      | consumer-owned; no built-in tooltip contract                                          |
| arbitrary custom overlay export                  | unsupported in stable export schema                                                   |
| SSR for custom overlay cells                     | supported if render functions stay pure and SVG-only                                  |

## Demo requirements

When implemented, the demo page should include:

1. existing `ShotMap` in `SmallMultiples`
2. existing `PassMap` in `SmallMultiples`
3. analyst goal-kick location grid using `PitchCell` + `PitchPointsLayer`
4. progressive-pass bin grid using `PitchCell` + `PitchBinsLayer`
5. penalty-box touches grid using `PitchCell` + `PitchPointsLayer`
6. custom “build your own shot map” example using points + lines
7. raw `Pitch` escape-hatch example to prove the library still allows it

## Test requirements

When implemented, coverage should include:

1. `PitchCell` forwards `view.pitchOrientation`, `view.pitchCrop`, and `sharedScale`
2. layer primitives skip null / invalid coordinates safely
3. points layer supports constant, object-map, and callback styling
4. lines layer supports constant, object-map, and callback styling
5. bins layer renders explicit rectangles correctly across crop/orientation variants
6. labels layer renders text correctly in full and half-pitch cells
7. dense analyst grid example stays SSR-safe and site-build-safe
8. no layer primitive claims export support beyond the current bounded contract

## Implementation sequencing

This sequence is intentionally **outside** the `SM1`-`SM8` packet plan in [docs/plans/smallmultiples-plan.md](https://github.com/withqwerty/campos/blob/main/docs/plans/smallmultiples-plan.md). Reopen it as a separate follow-up packet rather than folding it silently into the core Small Multiples execution wave.

1. land the spec and Small Multiples references
2. add `PitchCell`
3. add `PitchPointsLayer` + `PitchLinesLayer`
4. add `PitchBinsLayer` + `PitchLabelsLayer`
5. add analyst demo stories
6. only after real usage, decide whether a higher-level `PitchEventMap` or `PitchOverlayChart` is justified

## Explicit non-goals

- a universal “generic football chart” component in the first packet
- automatic legend generation for bespoke overlay layers
- automatic tooltip generation for bespoke overlay layers
- automatic scale computation inside `PitchCell`
- a second layout primitive separate from `SmallMultiples`
- replacing raw `Pitch` composition as an escape hatch

## Open questions

These are deferred deliberately, not blockers for the first packet:

- should `SmallMultiplesView` eventually gain `pitchSide`?
- should a future packet add a density-surface overlay primitive beyond `PitchBinsLayer`?
- is a higher-level `PitchEventMap` justified after two or three real consumer recipes exist?
