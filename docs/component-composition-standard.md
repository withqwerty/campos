# Component Composition Standard

**Status:** active
**Purpose:** standardize how Campos components are reasoned about, specified, implemented, and reviewed

## Core rule

Campos components are:

- **publicly chart-shaped**
- **internally primitive-driven**

That means:

- users consume components like `ShotMap`, `PassMap`, `ScatterPlot`, `RadarChart`, and `PizzaChart`
- the implementation is explained in terms of reusable internal concerns such as coordinate spaces, mark layers, annotation layers, layout containers, and encoding utilities
- low-level primitives are not the primary public API

This follows the architecture in `architecture-decision.md`: task-shaped public components, React-first rendering, and reusable internals without exposing a scene-assembly API by default. All styling and visual decisions live in `@withqwerty/campos-react`; core provides math and coordinate transforms only.

## Required composition model

Every new component spec must describe the component using the same hierarchy.

### 1. Public component

State the public component being shipped.

Examples:

- `RadarChart`
- `PizzaChart`
- `xGTimeline`

This section answers: what does the user import and render?

### 2. Internal coordinate space

State the coordinate system the component depends on.

Examples:

- `Pitch`
- `CartesianAxes`
- `PolarAxes`

This section answers: what canvas or axis system organizes the chart?

### 3. Internal mark layers

State the main visual mark types used by the chart.

Examples:

- `PointLayer`
- `LineLayer`
- `HeatmapLayer`
- `RadarPolygon`
- `RadialBar`
- `StepLine`

This section answers: what carries the primary visual signal?

### 4. Internal annotation and layout layers

State the supporting layers that make the chart complete and publishable.

Examples:

- `LabelLayer`
- `TooltipLayer`
- `LegendLayer`
- `ColorScaleBar`
- `Header / Endnote`
- `SmallMultiples`
- `SplitView`

This section answers: what makes the chart usable, readable, and explainable?

### 5. Shared encoding utilities

State the shared value-to-visual rules the chart depends on.

Examples:

- categorical palette
- continuous colormap
- size scale
- normalization or percentile rules
- lower-is-better inversion

This section answers: what reusable visual logic is applied to data values?

### 6. Chart-specific logic

State the logic that is specific to this chart and should not be generalized prematurely.

Examples:

- cumulative match-time ordering for `xGTimeline`
- lower-is-better axis inversion for `RadarChart`
- category-based slice grouping for `PizzaChart`

This section answers: what is special about this chart beyond the shared primitives?

### 7. Explicit non-goals

State what is intentionally deferred so the component stays scoped and the internals stay clean.

This section answers: what should not be built into this packet?

## Public vs internal boundary

Every component spec must explicitly separate:

- **public API**
- **internal reusable infrastructure**
- **chart-specific glue**
- **deferred work**

This avoids two failure modes:

- exposing raw primitives too early
- hard-coding one-off chart logic that should be a shared seam

## Extraction rule

Do not extract a new internal primitive just because one component happens to need it.

A proposed primitive should identify:

1. its **first consumer**
2. its **second expected consumer**

Examples:

- `PolarAxes`
  First consumer: `RadarChart`
  Second expected consumer: `PizzaChart`

- `StepLine`
  First consumer: `xGTimeline`
  Second expected consumer: `BumpyChart` or another time-series chart

If no credible second consumer exists, keep the logic chart-local until one does.

## What “composable” means in Campos

Composable does **not** mean users assemble charts from low-level primitives by default.

Composable means:

- components share internal semantic models cleanly
- renderers can reuse shared seams
- multiple charts can coexist without conflicting IDs, state, or coordinate assumptions
- new chart types can be added without rewriting prior logic

The primary composition unit for users remains the chart component.

## Spec requirements

Every component spec should include a section shaped like this:

```md
## Composition Model

### Public component

- `RadarChart`

### Internal coordinate space

- `PolarAxes`

### Internal mark layers

- `RadarPolygon`

### Internal annotation and layout layers

- `LabelLayer`
- `LegendLayer`
- `TooltipLayer`

### Shared encoding utilities

- per-axis normalization
- category color mapping
- lower-is-better inversion

### Chart-specific logic

- fixed metric ordering per template
- per-axis min/max handling

### Primitive extraction plan

- `PolarAxes`
  First consumer: `RadarChart`
  Second expected consumer: `PizzaChart`
- `RadarPolygon`
  First consumer: `RadarChart`

### Explicit non-goals

- any multi-profile overlay (see `docs/specs/radarchart-spec.md` decision section)
- image centerpieces
- public low-level polar API
```

## Review implications

Reviewers should challenge:

- whether the component is truly chart-shaped publicly
- whether the proposed internal primitives are real reusable seams
- whether chart-specific logic is being incorrectly generalized
- whether a supposed primitive has a credible second consumer
- whether the component’s default output remains publishable without exposing low-level assembly

## Current examples

The current component set already implies this structure:

- `ShotMap`
  `Pitch` + `PointLayer` + `LegendLayer` + `TooltipLayer` + `ColorScaleBar`
- `PassMap`
  `Pitch` + `LineLayer` + `LegendLayer` + `TooltipLayer`
- `ScatterPlot`
  `CartesianAxes` + `PointLayer` + `LegendLayer` + `TooltipLayer`
- `Heatmap`
  `Pitch` + `HeatmapLayer` + `ColorScaleBar` + `TooltipLayer`

The next planned charts should follow the same model:

- `RadarChart`
  `PolarAxes` + `RadarPolygon` + `LabelLayer`
- `PizzaChart`
  `PolarAxes` + `RadialBar` + `LabelLayer`
- `xGTimeline`
  `CartesianAxes` + `StepLine` + annotations
