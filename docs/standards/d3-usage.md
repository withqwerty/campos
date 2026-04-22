# D3 Usage Standard

**Status:** active
**Scope:** D3 package usage inside Campos packages
**Purpose:** define exactly where D3 is allowed, what it is allowed to do, and what it must never become
**Last updated:** 2026-04-15

## Current policy

D3 is allowed as a **narrow internal math dependency**.

It is **not** the rendering architecture.

## Allowed today

Only inside the `compute/` directory of `@withqwerty/campos-react`
(formerly `@withqwerty/campos-core`, collapsed in R1h):

- `d3-scale`
- `d3-array`
- `d3-format`

Current use:

- [packages/react/src/compute/scales/continuous-scale.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/scales/continuous-scale.ts)
- [packages/react/src/compute/scales/numeric-axis.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/scales/numeric-axis.ts)
- [packages/react/src/compute/scales/format-number.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/scales/format-number.ts)
- [packages/react/src/compute/math.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/math.ts)
- chart-level array reductions in
  [kde.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/kde.ts),
  [heatmap.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/heatmap.ts),
  [territory.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/territory.ts),
  [shot-map.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/shot-map.ts),
  [pass-network.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/pass-network.ts),
  [aggregate-pass-network.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/aggregate-pass-network.ts),
  [comet-chart.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/comet-chart.ts),
  [bump-chart.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/bump-chart.ts),
  [xg-timeline.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/xg-timeline.ts),
  and [scatter-plot.ts](https://github.com/withqwerty/campos/blob/main/packages/react/src/compute/scatter-plot.ts)

These currently power:

- continuous scales
- nice numeric domains
- tick generation
- numeric label formatting
- shared statistical / reduction helpers
- chart-level array reductions where a shared helper does not yet exist

## Not allowed

- `d3-selection`
- `d3-axis`
- `d3-transition`
- `d3-zoom`
- `d3-brush`
- D3-owned DOM updates
- D3 objects leaking into public renderer contracts
- the umbrella `d3` package

Campos renderers remain React-owned. Core still returns plain numbers, arrays, and semantic models.

## Usage rules

1. Add D3 modules narrowly, never by default.
2. Add them only to the package that uses them.
3. Prefer Campos helpers such as `math.ts` and `scales/*`; use raw D3 modules in chart files only when a shared helper would be premature.
4. Do not expose D3 scale instances, formatters, or other D3 objects in public APIs.
5. Prefer existing Campos helpers before adding another D3 module.
6. If a new D3 module is proposed, open a tracked packet first and state the exact duplicate code or missing capability it replaces.

## Future candidates

Allowed only with a packet and a concrete consumer need:

- `d3-shape`
- `d3-interpolate`
- `d3-scale-chromatic`
- `d3-force`
- `d3-delaunay`

Default stance: do not add them until a real seam or repeated callsite justifies them.
