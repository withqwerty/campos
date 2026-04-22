# SmallMultiples Pitch-Component Adoption Spec

**Status:** active reference
**Last updated:** 2026-04-20
**Scope:** which existing pitch-based Campos components should participate in the
`SmallMultiples` story, under what conditions, and in what order

## Purpose

`SmallMultiples` now has an honest shipped baseline:

- repeated `ShotMap`
- repeated `PassMap`
- repeated `Heatmap`
- repeated `Territory`
- repeated `PassFlow`
- bespoke analyst cells via raw `Pitch`

The next question is not "can any pitch chart be dropped into a grid?" The
question is:

1. which pitch-based components belong in the official `SmallMultiples` story
2. what exact seams they need before that claim is honest
3. which ones should stay out of the promise even if consumers can still use
   them manually

This document answers that question for the current pitch-chart surface.

It is deliberately narrower than a component spec. It is an adoption matrix and
packet-ordering document for future `SmallMultiples` widening work.

## Authority boundary

- `docs/specs/smallmultiples-spec.md`
  - owns the public `SmallMultiples` contract
- `docs/specs/smallmultiples-followup-packet.md`
  - records what W4 actually closed
- this document
  - owns the adoption ladder across pitch-based components
  - owns the current participant set and its boundaries
  - owns the reasons some pitch components should stay outside the immediate
    promise
- `docs/specs/pitch-analyst-overlay-spec.md`
  - owns the bespoke `PitchCell` / overlay-layer direction when existing charts
    are the wrong semantic fit

## Decision model

A pitch-based component belongs in the official `SmallMultiples` story only if
all of the following are true:

1. the chart still reads clearly at repeated-cell sizes
2. its view semantics map cleanly from `SmallMultiplesView` or from explicit
   per-cell consumer mapping
3. any shared-domain story is honest rather than decorative
4. the chart can suppress enough chrome for repeated use without becoming a new
   grid-owned abstraction
5. the repeated use case is common enough to deserve first-class docs/demo
   coverage

If any of those fail, the chart may still be usable manually inside
`renderCell`, but it should not be marketed as an official participant.

## Readiness ladder

### A. Official participants now

These are part of the current `SmallMultiples` promise.

| Component   | Why it qualifies                                                                                                                         | Current view/domain contract                                                        | Current bias                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------- |
| `ShotMap`   | repeated shot grids are common, visual density holds up, compact chrome already exists                                                   | reads `pitchOrientation`, `pitchCrop`, `sharedScale`                                | keep as baseline                       |
| `PassMap`   | repeated raw pass direction cells are common, compact chrome already exists, shared width-domain story is honest through style callbacks | reads `pitchCrop`, `sharedScale`; does not consume `pitchOrientation` today         | keep as second baseline                |
| `Heatmap`   | repeated zonal/event-density grids are common; discrete bins stay legible; compact scale-bar suppression now exists                      | maps `pitchOrientation` to `attackingDirection`, reads `pitchCrop`, no shared scale | keep as the discrete-zone participant  |
| `Territory` | editorial zone views are naturally repeatable and remain readable in compact cells                                                       | maps `pitchOrientation` to `attackingDirection`, reads `pitchCrop`, no shared scale | keep as the editorial zone participant |
| `PassFlow`  | coarse binned directional flow cards are useful in repeated tactical comparisons                                                         | maps `pitchOrientation` to `attackingDirection`, reads `pitchCrop`, no shared scale | keep as the tactical flow participant  |

### B. Conditional / specialized participants

These may belong in some repeated use cases, but should not be treated as
default `SmallMultiples` participants yet.

| Component   | Why it is conditional                                                                                                             | Blocking issue                                                                                                                       | Recommended stance                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `KDE`       | smoothed density views can repeat, but they are harder to compare honestly across many cells and easier to misread at small sizes | shared-domain story is still weak; repeated-density use case has not yet been proven by a battle-test                                | keep standalone unless a real repeated-density case appears                              |
| `Formation` | single-team formation cards can repeat across matches, teams, or phases                                                           | formation cards are more lineup panels than chart cells; dual-team and substitutes variants make a generic repeated-grid story messy | spec separately as “formation cards in a grid”, not as a default pitch-chart participant |

### C. Not part of the immediate promise

These should stay outside the official `SmallMultiples` story unless a very
specific battle-test forces them back in.

| Component            | Why it stays out                                                                                                | What would need to change to reopen it                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `PassNetwork`        | dense labels, interaction, aggregation semantics, and chart chrome make it a poor default repeated-grid surface | a battle-test proving repeated pass networks are both common and readable at grid sizes |
| `GoalMouthShotChart` | useful chart, but not pitch-based in the same sense; it is goal-space, not pitch-space                          | separate “repeated goal-frame charts” packet if that pattern becomes important          |

## Component-by-component guidance

### ShotMap

Keep it as the model participant.

It already demonstrates the right pattern:

- repeated football question
- honest shared-scale story
- compact chrome suppression
- clear mapping from `SmallMultiplesView` to chart props

Future widening work should continue to treat `ShotMap` as the reference call
site for repeated-chart ergonomics.

### PassMap

Treat it as the second reference participant, not just a one-off example.

Important caveat:

- `PassMap` is a good participant
- `PassMap` is **not** a symmetric participant with `ShotMap`

That asymmetry is acceptable, but it must stay explicit in the docs:

- `PassMap` currently consumes `pitchCrop`
- `PassMap` currently consumes `sharedScale`
- `PassMap` does **not** consume `pitchOrientation`

### Heatmap

`Heatmap` is now part of the official repeated-chart set.

Why:

- repeated event-density grids are common
- bin semantics stay inspectable in small cells
- the component already has crop, tactical-zone, and compact-chrome-adjacent
  seams

Current stance:

- keep the repeated-grid story explicit: `pitchOrientation` maps to
  `attackingDirection`
- use coarse or tactical bins in compact cells
- suppress the scale bar per cell rather than inventing grid-owned legend logic

### Territory

`Territory` is now part of the official repeated-chart set.

Why:

- repeated editorial zone cards are common
- the chart is fast to read at small sizes
- it already has labels, crop, attacking direction, and zone presets

But:

- it is not just "Heatmap but simpler"
- its semantics are editorial and categorical, not generic density bins

Current stance:

- keep it explicit as the editorial repeated-zone path
- do not collapse it into generic density semantics
- keep label treatment deliberate in compact cells (`offset` vs `badge`)

### PassFlow

`PassFlow` is now part of the official repeated-chart set.

Why it is interesting:

- repeated directional-bin cards can be useful
- crop and attacking-direction seams already exist
- header/legend suppression already exists

Current stance:

- repeated-grid use should stay coarse-bin
- header and legend chrome should be suppressed in compact cells
- participation does not imply a shared-domain protocol

### KDE

Keep it conditional.

KDE is a good chart, but repeated KDE cards are easy to overclaim:

- they smooth away the very differences users may want to compare
- small-cell contour reading is weaker than discrete-bin reading
- the shared-domain story is not yet strong enough

Only reopen it if a real repeated-density use case forces it.

### Formation

Do not treat `Formation` as a normal `SmallMultiples` pitch-chart participant.

The better framing is:

- repeated formation cards
- repeated lineup panels
- repeated team-shape cards

That may still deserve a spec, but it is adjacent to `SmallMultiples`, not part
of the current pitch-chart adoption ladder.

### PassNetwork

Keep it out.

Even though consumers can manually repeat it, that is not enough reason to
market it as an official participant. It is exactly the sort of chart that can
look superficially fine in a grid while being semantically overloaded and too
dense to read well.

### GoalMouthShotChart

Keep it out of this spec entirely except as a boundary note.

It may eventually belong in a separate repeated goal-frame story, but it is not
part of the pitch-component adoption question.

## Proposed next packet order

If `SmallMultiples` is widened again, the recommended order is:

1. optional `KDE` packet only if a real repeated-density use case appears
2. separate `Formation cards` packet if formation repetition becomes important
3. battle-test-driven reopeners only (`PassNetwork`, goal-frame repetition, etc.)

`PassNetwork` should not be on that queue by default.

## What “use any pitch-based component” should mean

The library should distinguish between:

- **allowed manually**
  - any consumer can place a component in `renderCell`
- **officially supported participant**
  - the docs recommend it
  - the repeated use case is proven
  - the repeated-grid ergonomics are tested
  - the chart’s shared-view/shared-domain story is explicit

That distinction is the key guardrail. Without it, `SmallMultiples` becomes a
vague “anything in a grid” story and the docs start lying again.

## Recommendation

The next serious `SmallMultiples` work should be:

1. keep the current five-chart set honest on docs/demo pages
2. reopen only the participants that a real battle-test or usage pattern forces
3. resist turning the grid into hidden chart context just because more charts now participate
