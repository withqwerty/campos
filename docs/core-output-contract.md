# Core Output Contract

**Status:** active
**Scope:** renderer-neutral compute/output responsibilities and semantic model shape

> **Package note:** There is no active `@withqwerty/campos-core` workspace package. This document keeps the historical "core" label as shorthand for renderer-neutral compute responsibilities. The current code lives in `@withqwerty/campos-react/src/compute/`, and old `@withqwerty/campos-core` imports are unsupported.

## Purpose

The renderer-neutral compute layer provides math utilities, coordinate transforms, and semantic model helpers. All styling and visual logic belongs in `@withqwerty/campos-react`. React owns all visual decisions via callback-first style props.

## Principle

The renderer-neutral compute layer provides the computational foundation. React provides the visual layer. Compute helpers should not resolve colors, strokes, fill values, or any other style properties as a public contract — those flow through React's callback-style props.

Core models should use semantic regions, canonical Campos football-space coordinates, and abstract data values. They should not use final pixel coordinates such as `cx`, `cy`, or `width` as the primary public contract.

## Responsibilities

The renderer-neutral compute layer owns:

- coordinate transforms (pitch space normalization, crop, orientation);
- scale utilities (nice ticks, linear scales, numeric formatting);
- layout math (aspect ratios, region sizing, marker sizing);
- shared schema types consumed by both core and react;
- future filter dimension models and option metadata when shared filtering is enabled;
- stats summaries and aggregations;
- empty-state detection (returning a flag or model, not the visual treatment);
- accessibility metadata that is renderer-agnostic.

The renderer-neutral compute layer does not own:

- color resolution or any visual property decisions — those belong in React;
- legend policy or tooltip content decisions — those belong in React;
- DOM, SVG, or Canvas primitives;
- CSS classes or visual polish implementation;
- browser interaction wiring;
- export/download mechanics.

For the future shared filter metadata shape, see [filtering-model-contract.md](https://github.com/withqwerty/campos/blob/main/docs/filtering-model-contract.md).

## Output shape

Every component compute function should return a semantic model with stable top-level regions.

Example:

```ts
type ComponentModel<TPlot, TLegend> = {
  meta: {
    component: string;
    theme: "dark" | "light";
    empty: boolean;
    accessibleLabel: string;
  };
  filtering?: FilteringModel | null;
  headerStats: HeaderStatsModel | null;
  scaleBar: ScaleBarModel | null;
  legend: TLegend | null;
  plot: TPlot;
  emptyState: EmptyStateModel | null;
};
```

## ShotMap model

`computeShotMap()` should return:

- `meta`
- future `filtering`
- `headerStats`
- `scaleBar`
- `legend`
- `plot.pitch`
- `plot.markers`
- `emptyState`

Example:

```ts
type ShotMapModel = ComponentModel<
  {
    pitch: PitchModel;
    markers: ShotMarkerModel[];
  },
  ShotMapLegendModel
>;

type ShotMarkerModel = {
  shotId: string;
  x: number;
  y: number;
  sizeValue: number;
  colorValue: number | null;
  fill: string;
  shapeKey: string | null;
  outlineKey: string | null;
  tooltip: ShotMapTooltipModel | null;
};
```

When shared filtering lands, `ShotMap` should align the zero-config legend with chart-level filter dimensions rather than raw schema fields:

- outline legend item keys `goal` and `non-goal` map to filtering dimension `goalState`
- shape legend item keys `foot`, `head`, and `other` map to filtering dimension `bodyPartFamily`
- richer raw dimensions such as `outcome` may still exist in `filtering.dimensions`, but they are separate from the zero-config legend contract

## Layout policy

The renderer-neutral compute layer should define:

- which regions appear by default;
- region ordering;
- when regions are hidden automatically;
- empty-state shell behavior.

Renderers should decide only how to paint those regions.

## Coordinate policy

Compute-layer plot models should expose:

- canonical Campos football-space positions such as `x`, `y`, `endX`, `endY`;
- resolved encoding values such as `colorValue`, `sizeValue`, `shapeKey`;
- final resolved visual tokens such as `fill` where cross-renderer consistency matters;
- enough framing metadata for a renderer to compute a viewport safely.

The renderer-neutral compute layer should not expose:

- final pixel-space coordinates;
- provider-native coordinate systems as part of normal chart computation;
- renderer-specific scene graph instructions;
- assumptions that one renderer owns the viewport math for all others.

The renderer-neutral compute layer should assume coordinate standardization has already happened before chart computation begins.

## Color policy

If the compute layer resolves an encoding value, it should do so as explainable semantic data rather than as a renderer-owned styling contract.

The compute layer may also return the originating continuous value and domain metadata so legends, scale bars, and accessibility text remain explainable.

## Auto-hide rules

The renderer-neutral compute layer should suppress non-informative regions automatically:

- hide legend groups with zero present categories;
- hide scale bars for non-continuous or degenerate domains;
- hide empty-state auxiliary chrome when it adds no value.

## Error model

Compute functions should fail with actionable messages for invalid normalized input, but prefer returning explicit empty states over hard errors when the input is valid but sparse.

## Composition note

Composition remains a known v0 gap. The first implementation may ship self-contained component models, but no shared composition contract is designed yet. Future work should add parent-level layout and legend-consolidation hooks explicitly rather than assuming the current model already solves them.
