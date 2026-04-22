# SmallMultiples Follow-Up Packet

**Status:** done
**Last updated:** 2026-04-20

2026-04-20 addendum: the initial W4 close-out described below was later
extended. The current live repeated-chart participant set is now `ShotMap`,
`PassMap`, `Heatmap`, `Territory`, and `PassFlow`, plus the raw `Pitch`
analyst-cell path.

## Purpose

`SmallMultiples` already shipped as a real public primitive:

- responsive grid
- `CellLabel`
- per-cell error isolation
- shared `pitchOrientation`, `pitchCrop`, and `sharedScale` forwarding

What did **not** fully ship is the broader repeated-pitch-chart and
analyst-grid story promised by the merged spec.

This packet exists to close that gap honestly and narrowly.

The goal is not to reopen `SmallMultiples` as a fresh component-family design.
The goal is to:

1. make the docs truthful about what the current grid really supports
2. close the highest-value remaining adoption gaps
3. decide, with evidence, whether `PitchCell` actually belongs in W4

## Resolved outcome

This packet closed with the following decisions, later widened by the
2026-04-20 follow-through:

- `ShotMap` remains the fully aligned repeated-chart baseline.
- `PassMap` is now a first-class `SmallMultiples` participant on the docs page.
  It consumes `pitchCrop` and `sharedScale`; it does **not** consume
  `pitchOrientation` today.
- `Heatmap` is now part of the official repeated-chart story. It maps
  `pitchOrientation` to `attackingDirection` and uses
  `showScaleBar={false}` for compact cells.
- `Territory` is now part of the official repeated-chart story as the editorial
  repeated-zone path.
- `PassFlow` is now part of the official repeated-chart story for coarse,
  compact tactical flow tiles.
- `KDE` is deferred from the immediate repeated-chart promise; keep it
  standalone unless a real repeated-density use case proves it belongs.
- `PassNetwork` is removed from the immediate repeated-chart promise. It remains
  a valid chart, but not a default dense-grid participant.
- `PitchCell` stays queued. Raw `Pitch` remains the explicit analyst-grid escape
  hatch.

## Authority split

- `docs/specs/smallmultiples-spec.md`
  - owns the broad public `SmallMultiples` contract
  - records the full long-term repeated-grid / shared-view story
- `docs/specs/pitch-analyst-overlay-spec.md`
  - owns the adjacent bespoke analyst path (`PitchCell`, overlay-layer family)
- this packet
  - owns the **W4 reopen scope**
  - owns the shipped-state audit
  - owns the order of follow-up slices
  - owns the gate that can conclude "`PitchCell` stays queued"

## Why this packet exists now

The broad spec still names a wider chart-adoption surface than the live code
and demos currently prove.

Today the live state is:

- `SmallMultiples` forwards `pitchOrientation`, `pitchCrop`, and `sharedScale`
  through `SmallMultiplesView`
- the docs page demonstrates:
  - `ShotMap` in each cell
  - `PassMap` in each cell
  - `Heatmap` in each cell
  - `Territory` in each cell
  - `PassFlow` in each cell
  - raw `Pitch` for analyst-style cells
- the docs page still does **not** demonstrate `KDE` or `PassNetwork` as
  participating repeated-chart consumers

So the packet starts with a truthfulness problem before it starts with a missing
primitive problem.

## Current shipped baseline

### Shipped grid contract

Current implementation evidence:

- public types and forwarding:
  - `packages/react/src/SmallMultiples.tsx`
- docs/demo page:
  - `apps/site/src/pages/small-multiples.astro`
- live demo panel:
  - `apps/site/src/components/SmallMultiplesDemoPanel.tsx`

Already landed:

- `SmallMultiples`
- `CellLabel`
- per-cell error boundary
- empty state contract
- responsive columns
- `pitchOrientation`
- `pitchCrop`
- `sharedScale`

### Current participation reality

This table is the packet's starting point and should be treated as the
authoritative live-state audit unless implementation changes it.

| Surface       | Current W4 status                                 | What is actually true today                                                                                                | What this packet should do                                         |
| ------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ShotMap`     | live                                              | supports `orientation`, `crop`, `sharedScale`; already demonstrated on the docs page                                       | keep as the baseline repeated-chart example                        |
| `PassMap`     | live                                              | supports `crop` and `sharedScale`; does not currently consume `pitchOrientation`, but is now demonstrated on the docs page | keep as the second honest repeated-chart example                   |
| `Heatmap`     | live                                              | maps `pitchOrientation` to `attackingDirection`; `showScaleBar={false}` makes compact repeated cells honest                | keep as the discrete-zone repeated-chart participant               |
| `Territory`   | live                                              | maps `pitchOrientation` to `attackingDirection`; repeated editorial zone cards now have docs-page examples                 | keep as the editorial repeated-zone participant                    |
| `PassFlow`    | live                                              | maps `pitchOrientation` to `attackingDirection`; repeated tiles use coarse bins and compact-chrome settings                | keep as the tactical flow repeated-chart participant               |
| `KDE`         | deferred from the immediate promise               | supports `crop` / `attackingDirection`, overlay, and density tooltip, but no shared-domain seam and no docs-page example   | keep standalone until a real repeated-density use case appears     |
| `PassNetwork` | removed from the immediate repeated-chart promise | supports `attackingDirection`; does not currently read `sharedScale`, and is not a good dense-grid default                 | revisit only if a battle-test proves it belongs                    |
| raw `Pitch`   | live                                              | already works for custom analyst cells; docs-page example exists                                                           | keep as the explicit escape hatch                                  |
| `PitchCell`   | queued only                                       | exists as a direction in the adjacent spec, not in live code                                                               | leave queued unless repeated charts or raw Pitch prove too awkward |

### Immediate conclusion

The first packet closed as an **adoption-honesty** slice plus a narrow
`PassMap` promotion slice. Later follow-through widened the official participant
set without reopening `SmallMultiples` as a primitive extraction wave.

## Packet scope

### In scope

- docs and demo honesty about the actual participating repeated-chart set
- promoting `PassMap` into the first-class `SmallMultiples` story if it is
  stable enough
- deciding whether `Heatmap`, `KDE`, and `PassNetwork` should:
  - participate now
  - stay deferred
  - or be dropped from the broad promise for now
- compact-grid pressure on the participating chart set
- `PitchCell` gate decision
- minimum `PitchCell` / overlay-layer implementation only if a real use case
  justifies it

### Explicitly out of scope

- redesigning `SmallMultiplesProps`
- adding hidden chart context to the grid
- grid-owned legends
- grid-owned filtering
- exporting arbitrary analyst compositions as a stable static-export surface
- landing the full overlay-layer family from the adjacent spec by default

## Packet slices

Historical implementation order retained below for close-out clarity.

Implementation order is strict.

### Slice SMF1 - adoption audit + docs honesty

Goal:

- make the docs, broad spec, and demo page match the live code

Required work:

- add one explicit participation matrix to the `small-multiples` docs page
- update the broad `smallmultiples` spec only if it currently implies more live
  participation than exists
- state clearly that raw `Pitch` remains a first-class analyst path

Exit criteria:

- no active docs imply more repeated-chart support than the live code really has
- users can tell which path is real today:
  - repeated existing chart
  - raw `Pitch`
  - queued `PitchCell`

### Slice SMF2 - promote `PassMap` or reject it explicitly

Goal:

- resolve the easiest real repeated-chart gap first

Why `PassMap` first:

- it already has the clearest live protocol support after `ShotMap`
- it is likely to be high-use in match-analysis and analyst-grid contexts
- it gives a real second repeated-chart case without introducing new compute
  seams immediately

Required work:

- add a first-class `PassMap` `SmallMultiples` docs/demo example **or**
- record why `PassMap` should not be presented as part of the repeated-chart
  story after all

Exit criteria:

- `PassMap` is either part of the official repeated-chart path with demo/docs
  evidence, or it is explicitly left out with a named reason

### Slice SMF3 - chart-adoption narrowing for `Heatmap`, `KDE`, `PassNetwork`

Goal:

- stop promising all three automatically

Decision rules:

- adopt now only if the chart can participate without awkward adapter leakage,
  fake shared-scale behavior, or obviously bad dense-grid ergonomics
- defer if the chart needs a real new seam before it is honest in repeated form
- remove from the immediate promise if it was only aspirational

Likely default biases:

- `Heatmap`
  - strongest candidate for adoption because repeated zonal views are common
- `KDE`
  - plausible, but likely less essential than `Heatmap`
- `PassNetwork`
  - highest risk of being a bad dense-grid fit; default bias should be "prove
    it or defer it"

Exit criteria:

- each of `Heatmap`, `KDE`, and `PassNetwork` is explicitly categorized as:
  - adopted now
  - deferred
  - removed from the immediate repeated-chart promise

### Slice SMF4 - compact-grid pressure

Goal:

- verify whether the participating chart set is actually usable in dense analyst
  layouts

This slice is allowed to touch chart-local seams only when they are clearly
about repeated-cell usability, for example:

- tighter chrome suppression
- saner compact defaults
- clearer docs on when raw `Pitch` is preferable

This slice is **not** allowed to mutate `SmallMultiples` into a hidden chart
container.

Exit criteria:

- participating charts have honest compact-grid guidance
- any remaining awkwardness is recorded as chart-local debt, not silently
  pushed into the grid primitive

### Slice SMF5 - `PitchCell` gate

Goal:

- decide whether `PitchCell` is actually needed now

`PitchCell` may land only if a real battle-test or demo proves that:

1. repeated existing charts are not the right semantic fit
2. raw `Pitch` composition is materially too awkward or duplicative
3. the needed wrapper and overlay surface would plausibly be reused

Allowed proof cases:

- repeated custom pitch bins that are not honestly a `Heatmap`
- repeated mixed points + lines + labels where existing pitch charts are the
  wrong semantic tool
- dense goal-kick / box-touch / progressive-pass analyst cells that would
  otherwise duplicate the same `Pitch` glue repeatedly

If that proof does not exist, the honest outcome of this slice is:

- `PitchCell` stays queued
- the adjacent spec remains directionally useful
- W4 does not build it yet

## Packet deliverables

Minimum required deliverables for calling this packet done:

- one explicit participation table in the docs that matches the live code
- updated `small-multiples` page examples using only real supported paths
- one resolved decision for `PassMap`
- one explicit adopt/defer/remove decision for each of:
  - `Heatmap`
  - `KDE`
  - `PassNetwork`
- one explicit `PitchCell` gate outcome:
  - shipped narrowly because a real use case justified it
  - or deliberately deferred with the reason written down

Delivered:

- `apps/site/src/pages/small-multiples.astro` now includes:
  - `ShotMap` repeated-chart story
  - `PassMap` repeated-chart story
  - participation matrix
  - "when to use this / when not to use this" guidance
- `docs/specs/smallmultiples-spec.md` now records the narrowed repeated-chart
  promise
- `docs/specs/pitch-analyst-overlay-spec.md` and `docs/status/matrix.md` now
  record that `PitchCell` remains queued after this packet

## Reference code consulted

| Repo / file                                       | Why relevant                                                | What it covers                                                             | What Campos should keep                             | What Campos should change                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/Volumes/WQ/ref_code/football_viz/primitives.md` | local synthesis of repeated chart and analyst-grid patterns | repeated pitch views, small-multiples expectations, analyst-grid tradeoffs | repeated-chart patterns and honest scope boundaries | do not let the grid absorb chart semantics or become a dashboard system                         |
| `/Volumes/WQ/ref_code/mplsoccer`                  | strongest public football repeated-pitch reference family   | repeated pitch views, sonar grids, dense analyst recipes                   | pressure-test against real football usage patterns  | keep React composition and explicit chart contracts instead of library-wide matplotlib bundling |
| `apps/site/src/pages/lab/cross-sport-ideas.astro` | current internal idea pool                                  | repeated pitch cells and dense-grid inspiration                            | use only as pressure, not as authority              | do not let lab ideas silently widen this packet                                                 |

## Demo requirements

Required close-out state on `apps/site/src/pages/small-multiples.astro`:

- one plain non-chart grid
- one `ShotMap` repeated-chart example
- one `PassMap` repeated-chart example if `PassMap` survives SMF2
- one explicit raw `Pitch` analyst-cell example
- one participation table or guidance block that says which other charts are
  real participants today
- one "when to use this / when not to use this" section covering:
  - `SmallMultiples` + chart
  - `SmallMultiples` + raw `Pitch`
  - queued `PitchCell` path, if still deferred

## Test requirements

This packet is not complete without both docs honesty and code verification.

Required checks depend on the slices that actually land:

- docs-only adoption narrowing:
  - no new component tests required
- `PassMap` or other chart-adoption changes:
  - targeted React tests for the adopted chart path
- compact-grid seam changes:
  - targeted React tests proving the compact behavior
- `PitchCell` landing:
  - dedicated component tests plus at least one site example

Always run:

- `pnpm format:check`
- `pnpm typecheck`
- `pnpm test` if implementation changed
- `pnpm --filter @withqwerty/campos-site build`

## Exit criteria

`W4d` is done when all of the following hold:

- the docs no longer imply more participation than the live code actually has
- the repeated-chart story includes at least two honest chart consumers or an
  explicit reason why it should not
- the remaining adoption candidates are explicitly categorized rather than
  hand-waved
- `PitchCell` is either:
  - justified by a concrete use case and shipped narrowly, or
  - explicitly left queued with no ambiguity about why

## Review plan

- Loop 1: adoption-audit review
  - compare the broad spec, docs page, and live code
- Loop 2: implementation review
  - verify no hidden chart context or accidental grid ownership creep
- Loop 3: release-readiness review
  - verify users can clearly choose between repeated charts, raw `Pitch`, and
    `PitchCell` if it exists

## Remaining open questions

- Does `Heatmap` deserve to be the next official repeated-chart participant, or
  is docs honesty plus `PassMap` enough for the next wave?
- Is `KDE` a meaningful repeated-chart use case, or is it better kept as a
  standalone card/composite surface?
- Which concrete battle-test, if any, could honestly reopen `PassNetwork` as a
  dense-grid participant?
