# ShotMap Legend Spec

**Status:** active blocking spec for `computeShotMap()`

## Purpose

This document defines the default legend content and grouping for the zero-config `ShotMap`.

## Principle

The legend should explain only the encodings actually visible on the chart. It should stay compact and avoid introducing a second visual taxonomy that the plot is not using.

## Default legend groups

The zero-config `ShotMap` may expose up to three legend groups:

1. `shape`
2. `outline`
3. `colorScale`

`colorScale` is rendered through `scaleBar`, not the legend row.

## Shape group

- Explains marker shape when `bodyPart` is encoded
- Includes only categories present in the current data
- Uses stable chart-level item keys:
  - `foot`
  - `head`
  - `other`
- Default normalized labels:
  - `left-foot` or `right-foot` may collapse to `Foot` if they share the same rendered shape
  - `head` renders as `Head`
  - other residual categories render as `Other`

If all shots map to the same rendered shape, hide the shape group.

When shared filtering lands, this group should bind to a chart-level filter dimension such as `bodyPartFamily`, not directly to the raw `bodyPart` field.

## Outline group

- Explains goal vs non-goal outline treatment
- Uses stable chart-level item keys:
  - `goal`
  - `non-goal`
- Default label pair:
  - `Goal`
  - `Shot`

If outline treatment is visually degenerate or not encoded, hide the outline group.

When shared filtering lands, this group should bind to a chart-level filter dimension such as `goalState`, not directly to the richer raw `outcome` taxonomy.

## Scale bar relationship

- Continuous color meaning belongs in `scaleBar`, not in a legend chip group
- Default label is `xG`
- Hide when xG is absent or the domain is degenerate

## Group ordering

Legend content order is:

1. shape group
2. outline group

The scale bar remains above the plot and is not merged into the legend row.

## Empty and degraded states

- Empty state: hide the entire legend
- Non-xG fallback mode: hide `scaleBar`, keep shape and outline groups if informative
- If both visible legend groups are non-informative, hide the entire legend region

## Core model implication

Core should return grouped legend content, for example:

```ts
type ShotMapLegendModel = {
  groups: Array<
    | {
        kind: "shape";
        items: Array<{ key: "foot" | "head" | "other"; label: string }>;
      }
    | {
        kind: "outline";
        items: Array<{ key: "goal" | "non-goal"; label: string }>;
      }
  >;
};
```

Renderers may style these groups differently, but they should preserve the grouping and auto-hide rules defined here.

The group `kind` values (`shape`, `outline`) act as stable `groupKey` values for future legend-to-filter bindings.
