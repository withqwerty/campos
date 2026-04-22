# ShotMap Layout Spec

**Status:** active blocking spec for `computeShotMap()`

## Purpose

This document defines the region structure and default layout behavior for the zero-config `ShotMap`.

## Default region order

`ShotMap` is a vertical stack with these regions in order:

1. `headerStats`
2. `scaleBar`
3. `plot`
4. `legend`

`emptyState` is not a separate outer region. It is an overlay inside `plot`.

## Default shell

- Outer card aspect ratio targets `4:5`
- Theme defaults to dark
- No title or subtitle region by default
- Internal spacing should feel compact and editorial rather than dashboard-like

## Region rules

### `headerStats`

- Shown by default when there is at least one useful summary field
- Default fields are `Shots`, `Goals`, and total `xG`
- If all `xg` values are `null`, show only `Shots` and `Goals`
- Values should be short and scannable, not sentence-like

### `scaleBar`

- Appears below `headerStats`
- Shown only when color encodes a continuous field with a non-degenerate domain
- Default ShotMap label is `xG`
- Hidden in empty state
- Hidden in non-xG fallback mode

### `plot`

- Dominant visual region
- Contains half-pitch plus shot markers
- Pitch geometry must preserve football proportions
- Plot should reserve enough inset space that markers near the box and goal line do not clip
- Empty-state message is centered within the plot area

### `legend`

- Appears below `plot`
- Single compact row by default
- Explains only encodings that are actually visible
- Hidden when all legend groups are non-informative
- Hidden in empty state

## Default spacing policy

Core should model testable layout ratios, not vague display tokens.

- `plot` should receive at least `60%` of the available card height after visible non-plot regions are placed
- `headerStats` to `scaleBar`: no more than one compact row gap
- `scaleBar` to `plot`: no more than one compact row gap
- `plot` to `legend`: no more than one compact row gap
- outer card padding should remain smaller than the plot height allocation and never dominate the layout

Renderers may resolve these into concrete units for their environment.

## Auto-hide behavior

Core should apply these layout rules automatically:

1. If `headerStats` has no items, remove the region.
2. If `scaleBar` is hidden, `plot` moves up without leaving a gap.
3. If `legend` is hidden, the card ends at `plot`.
4. Empty state keeps the same outer shell even when `scaleBar` and `legend` are hidden.

## Core model implication

`computeShotMap()` should return enough layout metadata for the renderer to place regions safely, for example:

```ts
type ShotMapLayoutModel = {
  order: Array<"headerStats" | "scaleBar" | "plot" | "legend">;
  aspectRatio: "4:5";
  minPlotHeightRatio: 0.6;
};
```

The renderer can choose exact CSS or SVG sizing, but it should not invent a different region structure.
