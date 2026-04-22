# Filtering Model Contract

**Status:** active pre-implementation spec
**Purpose:** define the future shared filter model shape for `@withqwerty/campos-core`, renderers, legends, and external filter controls

## Why this exists

`filtering-standard.md` defines the ownership boundary. This document defines the actual data contract needed to implement that boundary without inventing a different API per chart.

The goal is:

- one filter state shape across chart types
- one way to describe available dimensions and options
- one mapping from legend items to filter options
- one semantic rule for single-select and multi-select behavior

## Scope

This contract is for **interactive end-user filtering** only.

It does not redefine:

- adapter product projections such as `shots()` or `passes()`
- chart view rules such as `crop`, `orientation`, or metric/template selection

## Core rule

Filtering should be expressed as:

1. **dimension definitions** returned by core
2. **selection state** owned by the renderer/app
3. **optional filtering input** passed back into core

Core should not receive opaque predicates as the primary filtering surface.

## Shared types

### Selection state

```ts
type FilterSelectionState = Record<string, readonly string[]>;
```

Rules:

- keys are filter dimension keys
- values are selected option keys for that dimension
- empty or missing array means the dimension is inactive

Example:

```ts
const selection: FilterSelectionState = {
  outcome: ["goal"],
  bodyPart: ["foot", "head"],
};
```

This means:

- `outcome` is active in single- or multi-select terms with one selected value
- `bodyPart` is active with two selected values
- the dataset is filtered by `outcome = goal` **AND** (`bodyPart = foot` **OR** `bodyPart = head`)

### Filter option

```ts
type FilterOptionModel = {
  key: string;
  label: string;
  count: number;
  hidden?: boolean;
  legendBinding?: {
    groupKey: string;
    itemKey: string;
  } | null;
};
```

Rules:

- `key` is the stable semantic key used in selection state
- `label` is the user-facing label
- `count` is based on the currently scoped dataset before this dimension's own selection is applied
- `hidden` allows core to keep a stable option catalog while suppressing non-present options
- `legendBinding` links a filter option to a legend item when the legend is filterable

### Filter dimension

```ts
type FilterDimensionModel = {
  key: string;
  label: string;
  selectionMode: "single" | "multiple";
  defaultBehavior: "include-all" | "require-selection";
  options: FilterOptionModel[];
};
```

Rules:

- `selectionMode` defines radio vs checkbox semantics
- `defaultBehavior: "include-all"` is the normal default for v0 charts
- `defaultBehavior: "require-selection"` is available for future use but should be rare

### Filter metadata block

```ts
type FilteringModel = {
  dimensions: FilterDimensionModel[];
  selection: FilterSelectionState;
  totalItemCount: number;
  filteredItemCount: number;
};
```

Rules:

- `totalItemCount` is the count after adapter projection and chart view rules
- `filteredItemCount` is the count after interactive filtering
- `selection` echoes the selection applied in the current compute call

## Compute input shape

Future chart compute functions may accept:

```ts
type ComputeFilteringInput = {
  selection?: FilterSelectionState;
  exposeDimensions?: readonly string[];
  dimensionModes?: Record<string, "single" | "multiple">;
};
```

Semantics:

- `selection` is the active filter state
- `exposeDimensions` lets the consumer suppress inferred dimensions they do not want to show
- `dimensionModes` lets the consumer override inferred single vs multi-select behavior

Core still owns:

- which dimensions are available at all
- which option keys exist
- labels
- counts
- legend bindings

## Compute output shape

Future chart models may expose:

```ts
type ComponentModel<TPlot, TLegend> = {
  meta: {
    component: string;
    theme: "dark" | "light";
    empty: boolean;
    accessibleLabel: string;
  };
  filtering: FilteringModel | null;
  headerStats: HeaderStatsModel | null;
  scaleBar: ScaleBarModel | null;
  legend: TLegend | null;
  plot: TPlot;
  emptyState: EmptyStateModel | null;
};
```

`filtering` should be `null` when:

- the chart has no meaningful interactive filtering seam
- the consumer disables filtering and no filter metadata is needed

## Selection semantics

### Within one dimension

Selected option keys combine as **OR**.

Examples:

- `bodyPart = ["foot", "head"]`
- `passType = ["cross", "through-ball"]`

### Across dimensions

Active dimensions combine as **AND**.

Examples:

- `outcome = ["goal"]` and `bodyPart = ["foot"]`
- `team = ["home"]` and `context = ["fast-break", "penalty"]`

## Counts

Counts should be computed for UI usefulness, not as a post-hoc afterthought.

Recommended rule:

- for each dimension, option counts are computed against the dataset after all other active dimensions are applied, but before that dimension's own selection is applied

This gives stable, useful counts during interaction.

Example:

- active selection is `outcome = ["goal"]`
- body-part counts should answer "how many foot/head/other shots are available within the currently goal-filtered scope?"

## Legend binding

Legend items and filter options should not drift apart.

When a legend is filterable:

- each legend item must map to exactly one `FilterOptionModel`
- that mapping is expressed through `legendBinding`
- clicking the legend should update `selection`

When a legend is not filterable:

- `legendBinding` should be `null`

Examples:

- `ShotMap` outline legend item `goal` binds to chart-level filter dimension `goalState`, option `goal`
- `ShotMap` outline legend item `non-goal` binds to chart-level filter dimension `goalState`, option `non-goal`
- `PassMap` result legend item `complete` binds to filter dimension `passResult`, option `complete`
- `ScatterPlot` categorical color legend item `forward` binds to filter dimension `positionGroup`, option `forward`

## Inference guidelines

Core may infer:

- dimensions from canonical normalized fields
- chart-level collapsed dimensions when the visible encoding is intentionally coarser than the raw field
- collapsed option keys such as `foot` combining left and right foot
- which dimensions are informative enough to expose
- default selection modes

The consumer may configure:

- whether filtering is enabled
- which inferred dimensions are exposed
- whether an exposed dimension is single- or multi-select

The consumer should not define:

- arbitrary option keys that core does not understand
- independent legend taxonomies disconnected from filter options

## Chart examples

### ShotMap

```ts
const filtering: FilteringModel = {
  dimensions: [
    {
      key: "goalState",
      label: "Result",
      selectionMode: "single",
      defaultBehavior: "include-all",
      options: [
        {
          key: "goal",
          label: "Goal",
          count: 3,
          legendBinding: { groupKey: "outline", itemKey: "goal" },
        },
        {
          key: "non-goal",
          label: "Shot",
          count: 11,
          legendBinding: { groupKey: "outline", itemKey: "non-goal" },
        },
      ],
    },
    {
      key: "bodyPartFamily",
      label: "Body part",
      selectionMode: "multiple",
      defaultBehavior: "include-all",
      options: [
        {
          key: "foot",
          label: "Foot",
          count: 9,
          legendBinding: { groupKey: "shape", itemKey: "foot" },
        },
        {
          key: "head",
          label: "Head",
          count: 4,
          legendBinding: { groupKey: "shape", itemKey: "head" },
        },
      ],
    },
    {
      key: "outcome",
      label: "Outcome",
      selectionMode: "multiple",
      defaultBehavior: "include-all",
      options: [
        { key: "goal", label: "Goal", count: 3, legendBinding: null },
        { key: "saved", label: "Saved", count: 5, legendBinding: null },
        { key: "blocked", label: "Blocked", count: 4, legendBinding: null },
      ],
    },
  ],
  selection: {},
  totalItemCount: 14,
  filteredItemCount: 14,
};
```

In other words:

- the zero-config legend binds to chart-level dimensions `goalState` and `bodyPartFamily`
- richer raw dimensions such as `outcome` may still be exposed in dedicated filter UI
- legend-click filtering must follow the visible encoding, not a richer hidden taxonomy

### PassMap

```ts
const filtering: FilteringModel = {
  dimensions: [
    {
      key: "passResultState",
      label: "Result",
      selectionMode: "multiple",
      defaultBehavior: "include-all",
      options: [
        {
          key: "complete",
          label: "Complete",
          count: 210,
          legendBinding: { groupKey: "result", itemKey: "complete" },
        },
        {
          key: "incomplete",
          label: "Incomplete",
          count: 47,
          legendBinding: { groupKey: "result", itemKey: "incomplete" },
        },
      ],
    },
    {
      key: "passTypeKey",
      label: "Type",
      selectionMode: "multiple",
      defaultBehavior: "include-all",
      options: [
        { key: "cross", label: "Cross", count: 18, legendBinding: null },
        { key: "through-ball", label: "Through ball", count: 7, legendBinding: null },
      ],
    },
  ],
  selection: { passType: ["cross"] },
  totalItemCount: 257,
  filteredItemCount: 18,
};
```

In other words:

- the active legend binds to the active encoded dimension only
- when `colorBy="completion"`, legend clicks bind to `passResultState`
- when `colorBy="passType"`, legend clicks bind to `passTypeKey`
- synthetic options such as `unknown` or `other` are acceptable when the visible encoding needs them

### ScatterPlot

```ts
const filtering: FilteringModel = {
  dimensions: [
    {
      key: "positionGroup",
      label: "Position",
      selectionMode: "multiple",
      defaultBehavior: "include-all",
      options: [
        {
          key: "forward",
          label: "Forward",
          count: 42,
          legendBinding: { groupKey: "categorical", itemKey: "forward" },
        },
        {
          key: "midfielder",
          label: "Midfielder",
          count: 88,
          legendBinding: { groupKey: "categorical", itemKey: "midfielder" },
        },
      ],
    },
  ],
  selection: {},
  totalItemCount: 130,
  filteredItemCount: 130,
};
```

For `ScatterPlot` specifically:

- categorical color legends can bind directly to the configured categorical dimension
- continuous color scale bars are explanatory only and should not pretend to be discrete filters
- size legends are explanatory only and should not act as legend-click filters unless Campos later defines a real bucketed size-filter story

### Heatmap

`Heatmap` usually has no filterable legend seam in the chart chrome itself.

- the scale bar explains density; it is not a legend-click filter control
- any future filtering acts on the underlying event dataset before binning
- if filter controls exist, they should be external controls bound to event-level dimensions, not clicks on the scale bar

### xGTimeline

`xGTimeline` may expose a small explanatory legend, but it should stay honest about what it means.

- if a team legend is shown, it can bind to the chart-level `team` dimension
- richer raw shot dimensions such as `outcome`, `bodyPart`, or `context` should be exposed through dedicated filter controls rather than implied by the minimal legend
- dot or marker-style explanation legends are explanatory unless they map to stable filter options

### RadarChart

`RadarChart` is usually filtered upstream of the chart.

- comparison legends or category legends are explanatory by default
- selecting the profile, cohort, or template happens before the base chart compute call
- if category visibility toggles are added later, they should bind to a stable category dimension rather than ad hoc booleans

### PizzaChart

`PizzaChart` is also usually filtered upstream of the chart.

- category legends are explanatory by default
- selecting the profile, cohort, or metric template happens before the base chart compute call
- if slice-category visibility toggles are added later, they should bind to a stable category dimension rather than ad hoc booleans

## Non-goals

This contract does not define:

- DOM events
- React hooks or components for filter controls
- URL serialization
- cross-chart linked filtering across multiple coordinated views

Those can be layered on later without changing the core model shape.

## v0.2 note

This is a future contract.

In v0.2:

- consumers still pre-filter input arrays
- charts do not yet expose `filtering` blocks from core
- this document exists so v0.3 implementation does not start from an undefined shape
