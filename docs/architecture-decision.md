# Architecture Decision — Post-Review

**Status:** active architecture decision
**Scope:** source of truth for Campos package architecture, ownership boundaries, and product principles
**Date:** 2026-04-07 — updated 2026-04-15
**Context:** Revised to reflect React-first architecture reset (Wave R1). Previous direction (headless core + Python renderer) is retired.

## Decision

**Campos is a React-first TypeScript component library for football visualizations.**

Target audience is **developers building football products**. React is the renderer. There is no planned Python renderer or multi-renderer abstraction layer. The goal is beautiful viz, always.

Adapters (`@withqwerty/campos-adapters`) remain a supported part of the library. The R1 wave focuses exclusively on the React component layer and does not touch adapters.

## Source of truth

This document is the current architecture source of truth.

- It **supersedes** the earlier pre-renderer research recommendation that argued against a headless-first split.
- It **supersedes** the prior "Option C: Headless core + React renderer first, Python renderer later" framing. Python renderer is no longer a target.
- Earlier pivot reviews remain useful as historical input, but unresolved findings there should be read against the decisions made here.

## Product principles

Campos is a **football UI library for both humans and agents**.

- **Task-shaped primitives, not graphics primitives.** The public API should expose components like `ShotMap`, `ScatterPlot`, and `RadarChart`, not low-level scene assembly as the primary path.
- **One-line happy path.** A user or agent should be able to get to a good result with the smallest possible surface area: e.g. `<ShotMap shots={shots} />`.
- **Callback-first style injection.** Styling is expressed through callback props (`markers`, `lines`, `areas`, `guides`, etc.) that receive data and return style values. Constants and object maps are convenience shorthands, not the primary authoring surface.
- **Defaults must be publishable.** Zero-config output should look intentional, not merely valid.
- **Opinionated where robustness requires it.** Campos should be strict about empty states, accessibility, touch targets, contrast, sensible legend behavior, and minimum marker visibility.
- **Flexible where product context differs.** Themes, composition, visible regions, tooltip rendering, and style callbacks should remain customizable.
- **Agent-usable by design.** Types, JSDoc, examples, error messages, and `llms.txt` are part of the API surface. The library should be easy to point an agent at and trust it to assemble the right pieces.
- **Humans should not be penalized for agent-friendliness.** The same primitives must remain pleasant to hand-code without hidden context or excessive ceremony.

## Design implication

Campos should do most of the repetitive assembly work itself. Users and agents should choose the right component and pass data and optional style callbacks. They should not have to invent coordinate handling, default encodings, legend policy, empty-state behavior, or accessibility basics from scratch.

## Package architecture

```
┌─────────────────────────────────────────┐
│  @withqwerty/campos-schema              │
│  canonical football types               │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  @withqwerty/campos-adapters            │
│  provider normalization                 │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  @withqwerty/campos-stadia              │
│  pitch and goal primitives              │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  @withqwerty/campos-react               │
│  primary runtime package                │
│  charts + chart-level React APIs        │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  @withqwerty/campos-static              │
│  server-side SVG/PNG export             │
└─────────────────────────────────────────┘
```

## Packages

| Package                       | What                                                                                          | Status |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| `@withqwerty/campos-react`    | Primary runtime package for chart components and chart-level React APIs                       | active |
| `@withqwerty/campos-adapters` | Provider data → Campos schema                                                                 | active |
| `@withqwerty/campos-schema`   | Canonical football types and schema helpers                                                   | active |
| `@withqwerty/campos-stadia`   | Pitch and goal primitives for football surfaces                                               | active |
| `@withqwerty/campos-static`   | Node.js SVG-to-PNG export (for social images, OG cards). Best-effort parity with React output | active |

The current consumer-facing package story is intentionally multi-package. There is no active rename plan to collapse `@withqwerty/campos-react` into a single `@withqwerty/campos` package during the current alpha wave.

The historical `@withqwerty/campos-core` package name is retired and reserved. There is no active workspace package with that name, and old imports are unsupported. See [core-package-policy.md](https://github.com/withqwerty/campos/blob/main/docs/core-package-policy.md) for the migration stance.

## Why React-first

The headless-core-plus-multi-renderer split served its original goal (proving the coordinate model before committing to a renderer) but has outlived its usefulness. Campos now presents a React-first package story centered on `@withqwerty/campos-react`, with chart logic and styling owned there rather than by a separate consumer-facing core package.

React-first means:

- **All styling decisions live in `@withqwerty/campos-react`.** Color, stroke, shape, opacity, and any computed visual property flow through callback-style React props.
- **Renderer-neutral helpers still exist**, but they are not the consumer-facing package story. Coordinate transforms, scale utilities, schema types, and layout math remain important; they just do not define the main public entry point.
- **Testing stays easy.** Core functions are still pure (input → output), but React components can be tested with React Testing Library without a detour through a core model.
- **No multi-renderer purity constraint.** Vue, Svelte, and Python renderers are not targets. If a future need arises, the split can be revisited then.

Wave R1 completed the style/API reset. The library now ships with a React-first package story anchored around `@withqwerty/campos-react`. Legacy `@withqwerty/campos-core` references in older docs are handled through the active retired-package policy rather than as part of the current public package story.

## What the internal compute/model layer provides today

The internal compute/model layer used by the React package is responsible for:

- **Coordinate transforms** — pitch space normalization, crop, orientation, projection
- **Scale utilities** — nice tick computation, linear/sequential scales, numeric formatting (using narrow D3 modules internally)
- **Layout math** — aspect ratios, region sizing, marker sizing
- **Schema types** — shared TypeScript types consumed across the workspace

This internal layer is not responsible for:

- Resolving colors, strokes, fill values, or any other visual properties
- Owning legend behavior or tooltip content
- Making decisions that require knowing the React rendering context

The chart-level `compute*` helpers (e.g., `computeShotMap`) now live inside `@withqwerty/campos-react`. Per [compute-helper-policy.md](https://github.com/withqwerty/campos/blob/main/docs/compute-helper-policy.md), they remain publicly importable from the main barrel during alpha as a **transitional public surface**. They are supported for advanced use, but they are not the primary package story and they are not a separate consumer-facing package.

## Adapter layer

Provider normalization (`@withqwerty/campos-adapters`) is a supported part of the library. It is not being changed in the R1 wave — the focus there is exclusively on React component styling.

```typescript
import { fromOpta, fromStatsBomb } from "@withqwerty/campos-adapters";
const shots: Shot[] = fromOpta.shots(optaEvents, matchContext);
```

The adapter contract and gap matrix remain active. See `docs/adapters-contract.md` and `docs/standards/adapter-gap-matrix.md`.

Campos has borrowed ideas and reference seams from `kloppy`, with thanks, but it
is not trying to become a replacement for `kloppy` or "`kloppy` for TypeScript".
Parity only matters on the UI-relevant adapter seams Campos intentionally adopts.
Broader event/tracking parity should not expand scope unless the Campos chart and
match-page surface genuinely needs it. See [kloppy-relationship.md](https://github.com/withqwerty/campos/blob/main/docs/kloppy-relationship.md).

## What this resolves from the reviews

| Review finding               | Resolution                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Pivot premise unvalidated    | Target is product devs, not analysts. Python direction retired.                                                          |
| No headless layer            | React owns the chart package story and all visual decisions; renderer-neutral helpers remain internal/companion support. |
| Naive coordinate transform   | Adapter layer per provider existed and remains active; the React-first reset did not remove adapter normalization.       |
| Forecloses multi-framework   | React-first is an explicit choice. Other renderers are not planned.                                                      |
| Agent-first aspirational     | Agent-usable API is a core product principle; types and JSDoc are part of the surface.                                   |
| Component layout unspecified | Resolved — all 14 components shipped with defined layouts.                                                               |
| Interaction states absent    | Resolved — tooltip, hover, empty, and focus states are implemented per component.                                        |
| Mobile/touch/a11y absent     | Resolved — responsive behavior and a11y implemented per component.                                                       |

## What blocks implementation first

Before writing React component code, these design specs are needed:

1. **Default layout per component** — region-by-region wireframe
2. **Interaction states** — hover, selected, empty, loading, error per component
3. **Tooltip content** — what fields per component type
4. **Legend design** — continuous gradient bar spec (position, size, labels)
5. **Touch target minimum** — probably `max(computed, 12px)` on touch devices
6. **Composition pattern** — how to build a scouting report from multiple components

Specs 1, 3, and 4 block the internal compute/model implementation as well as the React implementation. Stable semantic regions still need those defaults specified. Specs 2, 5, and 6 can iterate after the first model exists, but they should not be ignored.

## Zero-config ShotMap spec

`<ShotMap shots={shots} />` must produce a fully specified, publishable default with no title and no extra setup.

### Default visual contract

- **Theme:** light by default via shared theme context
- **Pitch:** vertical attacking half-pitch
- **Card shape:** portrait card; target outer aspect ratio around `4:5`
- **Pitch geometry:** preserve football proportions internally; do not stretch the pitch to fill the card
- **Position:** shot `x/y`
- **Size:** `xg`
- **Fill colour:** sequential `xg` scale
- **Shape:** `bodyPart` when present
- **Outline:** goal vs non-goal emphasis by default

If `xg` is absent for all shots:

- marker size falls back to a constant accessible minimum
- marker fill falls back to categorical outcome colour
- scale bar is hidden
- stats bar still shows `Shots` and `Goals`; `xG` is omitted rather than shown as fake zero
- the component remains valid zero-config output, but in a degraded non-xG mode

### Regions

1. **Top stats bar** — shown by default. Displays `Shots`, `Goals`, and total `xG`.
2. **Scale bar** — shown by default when colour encodes a continuous field with a meaningful domain. For the default ShotMap this is the xG gradient.
3. **Plot region** — the pitch plus markers; this is the dominant visual area.
4. **Legend row** — shown by default, but only for categories present in the data. Default legend explains marker shape and goal outline treatment.

### Hidden by default

- **Title area:** not part of the base chart component; card chrome belongs in the layout layer
- **Outcome taxonomy legend:** hidden by default; the zero-config view should not introduce a second categorical system unless it is actually encoded
- **Secondary chrome:** no subtitles, filters, tabs, badges, or provider labels by default

### Empty state

`<ShotMap shots={[]} />` keeps the same shell:

- stats bar shown with zero values
- pitch shown in a muted treatment
- centered message: `No shot data`
- legend hidden
- scale bar hidden

### Layout implications for the internal compute/model layer

The internal compute/model layer should return semantic layout regions, not only raw drawing primitives. ShotMap needs model output shaped more like:

```ts
{
  headerStats: {...},
  scaleBar: {...} | null,
  plot: {...},
  legend: {...} | null,
  emptyState: {...} | null,
}
```

Campos pitch space defaults to a canonical standardized football space with `x: 0..100` from own goal to opposition goal and `y: 0..100` from left touchline to right touchline, with origin at the bottom-left corner of the full pitch. This is a visualization-space contract, not a promise of true metric distance, and keeps layout policy out of React while still letting the renderer stay thin.

## Why not D3-first

D3 is still the wrong architectural center of gravity for Campos. The renderer contract is React-first, and the internal compute/model layer returns plain numbers, arrays, and semantic values rather than D3-owned scenes or DOM state.

**What is allowed now.** Narrow D3 utility modules are allowed inside the internal compute/model layer where they reduce duplicated math risk:

- `d3-scale`
- `d3-array`
- `d3-format`

These modules are currently used only for shared numeric encodings such as continuous scales, nice numeric domains, ticks, and numeric label formatting.

**What is still not allowed.** D3 remains out of rendering architecture:

- no `d3-selection`
- no `d3-axis`
- no `d3-transition`
- no `d3-zoom`
- no `d3-brush`
- no D3-owned DOM or scene graph

**Why this boundary exists.** D3 scales return callable objects with chained methods, but Campos renderers should still receive plain computed output. The renderer stays thin, deterministic, and framework-owned; D3 objects do not leak across the core/render boundary.

**The updated trade-off.** Hand-rolled arithmetic helpers were creating avoidable duplication in scale math, tick generation, and numeric formatting. Campos now uses narrow D3 modules where they clearly earn their keep, while keeping the renderer contract framework-owned and deterministic.

The concrete dependency boundary now lives in [d3-usage.md](https://github.com/withqwerty/campos/blob/main/docs/standards/d3-usage.md).

## Build order (Wave R1 — React-first style reset)

1. Style vocabulary foundation in `@withqwerty/campos-react` — shared callback-first types for points, lines, areas, guides, etc.
2. Per-component API resets — replace old shorthand props with unified style props across all 14 charts
3. Package/public contract decisions — document the public compute/export stance and the legacy `@withqwerty/campos-core` package story
4. Export parity documentation — document which callback-driven styling paths are export-safe, degraded, or unsupported
5. `llms.txt`, agent documentation, npm publish once all style APIs are stable
