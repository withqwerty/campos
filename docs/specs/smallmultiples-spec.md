# SmallMultiples + Shared Pitch View/Scale Spec

**Status:** active reference; W4 follow-through widened the official repeated-chart set
**Supersedes:** `docs/specs/shared-pitch-view-protocol-spec.md`
**Last updated:** 2026-04-20

## Header

- Components / helpers:
  - `SmallMultiples<T>` (public responsive grid)
  - `CellLabel` (public label primitive)
  - `SharedPitchScale` (public type)
  - `computeSharedPitchScale<T>()` (public helper, transitional compute surface via `@withqwerty/campos-react`)
- Target version: v0.3+
- Depends on:
  - no new runtime dependencies
  - chart changes only in `@withqwerty/campos-react`
  - no adapter changes
  - no `@withqwerty/campos-stadia` changes

## Purpose

`SmallMultiples` exists to cover the recurring “one chart type, many cells” layout problem with a real library primitive instead of repeated hand-rolled CSS grids.

The full feature set has two parts:

1. **Phase A: grid primitive**
   - responsive CSS grid
   - stable keying
   - per-cell labels
   - per-cell error isolation
   - minimum cell width enforcement
2. **Phase B: honest shared pitch view / scale forwarding**
   - one place to set pitch orientation and crop across cells
   - one place to compute shared encoding domains for comparable pitch-chart cells
   - explicit forwarding into charts rather than “N unrelated charts that only happen to sit in a grid”
   - enough chart-side flexibility for dense analyst grids, not only spacious showcase cards

The dense-grid story has two valid outcomes:

- repeated existing charts when the chart semantics match the analyst task
- custom `Pitch`-based cells when the analyst task is more bespoke than any current chart contract

This unified spec replaces the old “Spec A grid now, separate Spec B later” split. The split helped expose real scope, but it now creates two active documents for one user task. The merged spec is authoritative and implementation-ready in **phased** order: land Phase A first, then Phase B without redesigning the public API.

The custom analyst-overlay ergonomics for that second path are specified separately in [docs/specs/pitch-analyst-overlay-spec.md](https://github.com/withqwerty/campos/blob/main/docs/specs/pitch-analyst-overlay-spec.md). This spec owns the grid and shared-view contract; the analyst-overlay spec owns the middle layer between raw `Pitch` composition and full chart components.

Per [docs/status/matrix.md](https://github.com/withqwerty/campos/blob/main/docs/status/matrix.md), the W4 follow-up work has now widened the honest repeated-chart surface. Treat this spec as the broad contract reference, and read it together with the companion adoption spec for the chart-by-chart ladder and boundaries.

For the per-component adoption ladder across the wider pitch-chart surface, see
[docs/specs/smallmultiples-pitch-component-adoption-spec.md](https://github.com/withqwerty/campos/blob/main/docs/specs/smallmultiples-pitch-component-adoption-spec.md).

## Scope boundary

### In scope

- `SmallMultiples<T>` responsive grid
- `CellLabel`
- per-cell error boundary
- final public `SmallMultiplesProps<T>` shape, including optional pitch-view / shared-scale props
- `SharedPitchScale` and `computeSharedPitchScale<T>()`
- repeated-chart opt-ins proven today for:
  - `ShotMap`
  - `PassMap`
  - `Heatmap`
  - `Territory`
  - `PassFlow`
- explicit future evaluation targets for:
  - `KDE`

### Out of scope

- grid-level shared legend
- generic non-pitch shared-scale system
- automatic chart introspection or “did the cell use the protocol?” heuristics
- `Formation` participation in shared pitch view / scale forwarding
- static multi-panel export (`ExportGrid` / export Phase 2)
- editorial title/subtitle/footer props on the grid itself
- `PassNetwork` as part of the immediate repeated-chart promise unless a future battle-test proves it belongs

## Current live repeated-chart promise

The broad protocol exists, and the currently proven repeated-chart path is now
larger than the first W4 close-out packet originally froze.

Live today:

- `ShotMap` — consumes `pitchOrientation`, `pitchCrop`, and `sharedScale`
- `PassMap` — consumes `pitchCrop` and `sharedScale`; it does **not** consume
  `pitchOrientation` today
- `Heatmap` — maps `pitchOrientation` to `attackingDirection`, consumes
  `pitchCrop`, and now has compact-cell scale-bar suppression
- `Territory` — maps `pitchOrientation` to `attackingDirection` and consumes
  `pitchCrop` as an editorial repeated-zone card
- `PassFlow` — maps `pitchOrientation` to `attackingDirection` and consumes
  `pitchCrop`; repeated-grid use keeps bins coarse and standalone-page chrome off
- raw `Pitch` — explicit analyst-grid escape hatch for bespoke cells

Deferred from the immediate repeated-chart promise:

- `KDE`

Removed from the immediate repeated-chart promise unless reopened by a future
battle-test:

- `PassNetwork`

The wider pitch-chart adoption ladder now lives in the companion adoption spec:

- official now: `ShotMap`, `PassMap`, `Heatmap`, `Territory`, `PassFlow`
- conditional: `KDE`, `Formation`
- out of the immediate promise: `PassNetwork`

## Delivery model

### Phase A — Grid primitive

Shippable on its own:

- `SmallMultiples<T>`
- `CellLabel`
- error boundary
- empty state
- demo page with plain cells and one real chart example

### Phase B — Shared pitch view / scale protocol

Additive follow-up:

- shared pitch orientation / crop hints
- `computeSharedPitchScale<T>()`
- per-chart opt-in for pitch-chart comparability
- compact-grid chart readiness for analyst-style layouts with external editorial copy

Implementation order is strict:

1. land Phase A
2. land Phase B

But the public API should be designed once, here, so Phase B is additive rather than a breaking redesign.

## Public API

### Zero-config

```tsx
import { SmallMultiples, CellLabel } from "@withqwerty/campos-react";

<SmallMultiples
  items={matches}
  getItemKey={(m) => m.id}
  renderCell={(m) => <div>{/* consumer chart */}</div>}
  renderLabel={(m) => <CellLabel title={m.opponent} caption={m.result} />}
/>;
```

### Final public types

```ts
export type SharedPitchScale = {
  sizeDomain?: readonly [number, number];
  colorDomain?: readonly [number, number];
  widthDomain?: readonly [number, number];
  radiusDomain?: readonly [number, number];
  opacityDomain?: readonly [number, number];
  meta?: Record<string, readonly [number, number]>;
};

export type SharedPitchScaleAccessors<T> = {
  size?: (item: T, index: number) => number | readonly number[] | null | undefined;
  color?: (item: T, index: number) => number | readonly number[] | null | undefined;
  width?: (item: T, index: number) => number | readonly number[] | null | undefined;
  radius?: (item: T, index: number) => number | readonly number[] | null | undefined;
  opacity?: (item: T, index: number) => number | readonly number[] | null | undefined;
  meta?: Record<
    string,
    (item: T, index: number) => number | readonly number[] | null | undefined
  >;
};

export type SmallMultiplesView = {
  pitchOrientation?: "horizontal" | "vertical";
  pitchCrop?: "full" | "half";
  sharedScale?: SharedPitchScale;
};

export type SmallMultiplesProps<T> = {
  items: ReadonlyArray<T> | null | undefined;
  getItemKey: (item: T, index: number) => string | number;
  renderCell: (item: T, index: number, view: SmallMultiplesView) => ReactNode;
  renderLabel?: (item: T, index: number) => ReactNode;
  columns?: number | { minCellWidth: number };
  gap?: number;
  labelPlacement?: "above" | "below";
  onCellError?: (error: Error, item: T, index: number) => void;
  ariaLabel?: string;
  emptyState?: ReactNode;

  /** Phase B: optional shared pitch-view hints for participating charts. */
  pitchOrientation?: "horizontal" | "vertical";
  pitchCrop?: "full" | "half";
  sharedScale?: SharedPitchScale;
};

export type CellLabelProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  caption?: ReactNode;
  ariaLabel?: string;
};

export function computeSharedPitchScale<T>(
  items: ReadonlyArray<T> | null | undefined,
  accessors: SharedPitchScaleAccessors<T>,
): SharedPitchScale;
```

### Design choices locked in here

- **Crop vocabulary stays `full | half` for v0.3.**
  - A broader `attacking-half` / `defensive-half` taxonomy is a separate future packet.
- **No `useSharedPitchScale()` hook.**
  - The helper stays pure and renderer-agnostic inside `@withqwerty/campos-react`’s compute layer.
- **No heuristic protocol warnings.**
  - `SmallMultiples` does not introspect rendered React nodes to guess whether the view/scale hints were actually consumed.
  - Consumers opt in explicitly by using the third `renderCell` arg.

## Phase A implementation contract

### Error boundary

- internal class component inside `SmallMultiples.tsx`
- `getDerivedStateFromError` for capture
- reset on `resetKey` change
- `onCellError` wrapped in try/catch
- if `onCellError` throws:
  - both errors go to `console.error`
  - placeholder still renders

### Layout

- root: `<section role="region" aria-label={ariaLabel}>`
- each cell: `<figure>` with optional `<figcaption>`
- `columns` behavior:
  - `number` → `repeat(N, 1fr)`
  - `{ minCellWidth }` → `repeat(auto-fill, minmax(var(--min-cell-width), 1fr))`
- each `<figure>` sets:
  - `min-width: 0`
  - `overflow: hidden`
- no `aspect-ratio` on cells

### Cell outcomes

| Outcome | Rendering                                                      |
| ------- | -------------------------------------------------------------- |
| success | `<figure>` with rendered node                                  |
| `null`  | `<figure data-campos-cell-empty="true">` with no content       |
| throw   | `<figure data-campos-cell-error="true">` with placeholder copy |

### Duplicate key detection

Dev-mode warning when `getItemKey` returns duplicates:

```txt
[SmallMultiples] getItemKey returned duplicate key "X" for items at indices i and j. Error recovery will be incorrect for these items.
```

Keep the current guard:

- dev-only
- skip above 500 items

### `CellLabel`

Fixed typography, no theme slot.

| Slot    | Style                                                                   |
| ------- | ----------------------------------------------------------------------- |
| eyebrow | `0.6875rem`, uppercase, `letter-spacing: 0.06em`, `color: var(--muted)` |
| title   | `0.9375rem`, `font-weight: 700`, `color: var(--ink)`                    |
| caption | `0.75rem`, `color: var(--muted)`, `line-height: 1.3`, wraps             |

DOM order:

- eyebrow
- title
- caption

## Phase B implementation contract

### Protocol model

`SmallMultiples` stays a layout primitive. It does **not** own scale computation or hidden chart context.

That means the protocol has two layers:

1. grid-level forwarding (`pitchOrientation`, `pitchCrop`, `sharedScale`)
2. chart-level compactness and chrome control so repeated pitch cells can actually be used in dense analyst layouts

Phase B is not complete if charts can technically receive a shared view object but still cannot render cleanly inside compact repeated grids.

The protocol is explicit:

1. consumer computes `sharedScale` with `computeSharedPitchScale()`
2. consumer passes `pitchOrientation`, `pitchCrop`, and/or `sharedScale` to `SmallMultiples`
3. `SmallMultiples` passes those hints into the third `renderCell` argument
4. the consumer forwards the relevant hints into participating charts

Example:

```tsx
const sharedScale = computeSharedPitchScale(teams, {
  size: (team) => team.shots.map((shot) => shot.xg ?? 0),
});

<SmallMultiples
  items={teams}
  getItemKey={(team) => team.id}
  pitchOrientation="vertical"
  pitchCrop="half"
  sharedScale={sharedScale}
  renderCell={(team, _index, view) => (
    <ShotMap
      shots={team.shots}
      orientation={view.pitchOrientation}
      crop={view.pitchCrop}
      sharedScale={view.sharedScale}
    />
  )}
/>;
```

### `computeSharedPitchScale<T>()`

Behavior:

- accepts `null`, `undefined`, or empty arrays and returns `{}` safely
- each accessor may return:
  - a single number
  - an array of numbers
  - `null` / `undefined`
- helper flattens finite numbers per axis
- helper returns `[min, max]` for each populated axis
- helper ignores empty axes
- helper throws a descriptive error when an accessor returns a non-finite numeric value

Error format:

```txt
[computeSharedPitchScale] accessor "size" returned a non-finite value for item at index 3.
```

For `meta`, include the meta key in the label:

```txt
[computeSharedPitchScale] accessor "meta.pressure" returned a non-finite value for item at index 3.
```

### Participating charts in the current proven path

| Chart       | View hints read today                                | Shared scale fields read      |
| ----------- | ---------------------------------------------------- | ----------------------------- |
| `ShotMap`   | `pitchOrientation`, `pitchCrop`                      | `sizeDomain`                  |
| `PassMap`   | `pitchCrop`                                          | `widthDomain` via style logic |
| `Heatmap`   | `pitchOrientation → attackingDirection`, `pitchCrop` | none                          |
| `Territory` | `pitchOrientation → attackingDirection`, `pitchCrop` | none                          |
| `PassFlow`  | `pitchOrientation → attackingDirection`, `pitchCrop` | none                          |

Not participating in the immediate repeated-chart promise:

| Chart         | Current stance                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `KDE`         | deferred until a real repeated-density use case proves it belongs                                       |
| `PassNetwork` | removed from the immediate repeated-chart promise; battle-test pressure is required before reopening it |
| `Formation`   | different coordinate/story model; no honest shared pitch-crop semantics here                            |

### Chart API widening

Participating charts gain additive props as needed:

- `sharedScale?: SharedPitchScale`
- `pitchOrientation` / `pitchCrop` are **not** introduced on chart APIs; chart APIs keep their existing prop names:
  - `orientation`
  - `crop`

Consumer mapping remains explicit in `renderCell`.

Chart rules:

- irrelevant domains are ignored silently
  - e.g. `ShotMap` ignores `widthDomain`
- participating charts must document which domain fields they honor and which
  shared view hints they ignore
- charts with existing `orientation` / `crop` defaults keep those defaults when hints are absent

### Chart-specific decisions

- `ShotMap`
  - widen current API to accept `orientation?: "horizontal" | "vertical"` and `crop?: "full" | "half"`
  - keep its existing chrome suppression so analyst-grid cells can stay compact
  - read `sharedScale.sizeDomain` when marker sizing depends on xG
- `PassMap`
  - keep existing chart-owned view props
  - add public header / legend suppression for dense-grid usage
  - expose `sharedScale.widthDomain` to line-style callbacks
  - do **not** add an implicit built-in line-width encoding in this packet
- `Heatmap`
  - official repeated-chart participant now
  - keep the repeated-grid story explicit: `pitchOrientation` maps to `attackingDirection`
  - use `showScaleBar={false}` for compact cells rather than inventing grid-owned legend logic
- `Territory`
  - official repeated-chart participant now
  - treat it as the editorial zone-card option, not as a stand-in for generic density analysis
  - keep label treatment explicit per cell (`offset` vs `badge`) rather than hiding it in grid context
- `PassFlow`
  - official repeated-chart participant now
  - repeated-grid usage should stay coarse-bin and compact-chrome by default
  - no shared-domain contract is implied by participation
- `KDE`
  - deferred from the immediate repeated-chart promise
  - do not market as participating until a real repeated-density use case proves it belongs
- `PassNetwork`
  - not part of the immediate repeated-chart promise
  - revisit only if a future battle-test proves it is a good dense-grid fit

### Why the protocol is explicit instead of context-driven

- chart compute helpers already own the relevant input semantics
- explicit forwarding is easier to audit and test
- context would create hidden coupling between a layout primitive and chart internals
- explicit view hints also work in SSR and export-oriented usage without another React-only layer

## Demo requirements

Single demo page at `apps/site/src/pages/small-multiples.astro`, with two sections.

### Phase A stories

1. minimum-cell-width auto-fill
2. fixed column count
3. one real chart example if it behaves honestly at container width
4. error boundary
5. null cell
6. empty state
7. dense stress
8. `CellLabel` standalone

### Phase B stories

Add after the protocol lands:

1. shared-size `ShotMap` grid
2. shared-width `PassMap` grid
3. repeated `Heatmap` grid
4. repeated `Territory` grid
5. repeated `PassFlow` grid
6. one explicit participation / defer table on the docs page
7. one "when to use repeated charts vs raw Pitch" guidance block

## Test requirements

### Phase A

- `packages/react/test/SmallMultiples.test.tsx`
- `packages/react/test/SmallMultiples.ssr.test.tsx`
- `packages/react/test/SmallMultiples.typecheck.ts`
- `packages/react/test/CellLabel.test.tsx`

Coverage:

1. one cell per item
2. empty state for `[]`, `null`, `undefined`
3. custom `emptyState`
4. numeric `columns`
5. `{ minCellWidth }`
6. `labelPlacement`
7. null cell preserves slot
8. error placeholder
9. `onCellError` semantics
10. duplicate key warning
11. nested grids
12. RTL
13. axe-clean
14. SSR happy/error path
15. required `getItemKey` type checks

### Phase B

- `packages/react/test/compute/shared-pitch-scale.test.ts`
- per-chart compute/render tests for each participating chart
- one integration test proving `renderCell` receives the third `view` arg and it can be forwarded into a participating chart

Coverage:

1. helper returns `{}` for null/empty input
2. helper flattens single values and arrays
3. helper rejects non-finite values with named accessor errors
4. `SmallMultiples` forwards `pitchOrientation`, `pitchCrop`, and `sharedScale` unchanged
5. `ShotMap` honors shared size domain
6. `PassMap` honors shared width domain
7. `Heatmap` supports compact repeated-grid use via `showScaleBar={false}`
8. docs/spec alignment remains honest about official / deferred / removed participants
9. export/static posture remains unchanged by the layout primitive itself

## Edge cases

| Case                                                  | Behavior                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| `items: []` / `null` / `undefined`                    | empty section; optional `emptyState`                                  |
| single item                                           | one-cell grid                                                         |
| `renderCell` returns `null`                           | empty slot preserved                                                  |
| cell throws                                           | per-cell placeholder                                                  |
| `onCellError` throws                                  | both errors logged; placeholder still renders                         |
| duplicate `getItemKey`                                | dev warning                                                           |
| long labels                                           | wrap inside cell                                                      |
| RTL                                                   | cell order and label alignment flip                                   |
| nested `SmallMultiples`                               | inner errors do not bubble to outer handler                           |
| `sharedScale` omitted                                 | charts use their own defaults                                         |
| `sharedScale` provided but consumer ignores third arg | no runtime warning; this is intentional                               |
| `pitchCrop="half"` with a non-participating chart     | no effect unless the consumer forwards it to a chart that supports it |

## Review plan

- **Implementation review**
  - class boundary correctness
  - third `renderCell` arg stability
  - helper error formatting
  - per-chart shared-scale adoption
  - no hidden React-context coupling
- **Release review**
  - demo page is compelling in both Phase A and Phase B modes
  - shared-scale examples are honest, not decorative

## Implementation sequencing

1. add `CellLabel`
2. add `SmallMultiples<T>` with final `renderCell(..., view)` signature
3. export public types from package barrel
4. add Phase A tests + demo page
5. add `SharedPitchScale` + `computeSharedPitchScale<T>()`
6. widen participating chart APIs / compute inputs
7. add Phase B tests + demo stories

## Open questions

None blocking the current shipped surface. Future questions are intentionally
deferred:

- whether `Heatmap` should become the next official repeated-chart participant
- whether `KDE` has a meaningful repeated-density use case worth reopening
- whether `PassNetwork` ever belongs in the repeated-chart promise at all
- whether a later packet broadens crop taxonomy beyond `full | half`
- whether `Territory` should participate in a future shared-domain protocol
- whether a multi-panel export surface should compose directly with `SmallMultiples`
