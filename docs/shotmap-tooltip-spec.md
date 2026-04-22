# ShotMap Tooltip Spec

**Status:** active blocking spec for `computeShotMap()`

## Purpose

This document defines the default tooltip payload for `ShotMap`.

## Principle

The default tooltip should answer:

- who took the shot;
- what happened;
- when it happened;
- the main encoded values visible on the chart.

It should not expose raw provider fields or every available qualifier.

## Default field order

For a standard ShotMap marker, the default tooltip rows are:

1. `playerName`
2. `outcome`
3. `minute`
4. `xg` when available
5. `bodyPart` when available

## Field rules

### `playerName`

- Primary identifier row
- If missing, fall back to a stable generic label such as `Unknown player`

### `outcome`

- Human-readable normalized label
- Examples: `Goal`, `Saved`, `Blocked`, `Off target`

### `minute`

- Display in football notation, e.g. `23'`
- Stoppage time should render as `45+2'`

### `xg`

- Include only when the shot has a real xG value
- Display with concise precision suitable for editorial reading
- Omit entirely in non-xG fallback mode

### `bodyPart`

- Include when present and useful
- Use normalized labels such as `Left foot`, `Head`

## Optional secondary rows

The default tooltip model may optionally include one extra row when the data is present and normalized cleanly:

- `assistType`
- `shotContext`
- `isPenalty`

Do not include more than one extra default row without an explicit override.

## Empty and invalid states

- Empty-state plots have no marker tooltips
- Invalid markers should not render interactive tooltip targets

## Core model implication

Core should attach a renderer-neutral tooltip payload to each interactive marker, for example:

```ts
type ShotMapTooltipModel = {
  rows: Array<{
    key:
      | "playerName"
      | "outcome"
      | "minute"
      | "xg"
      | "bodyPart"
      | "assistType"
      | "shotContext"
      | "isPenalty";
    label: string;
    value: string;
  }>;
};
```

React can choose hover and touch mechanics, but it should not decide the default field set on its own.
