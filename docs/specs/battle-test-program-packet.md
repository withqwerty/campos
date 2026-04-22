# Battle-Test Program Packet

**Status:** active packet
**Last updated:** 2026-04-20

## Purpose

`docs/standards/battle-test-recreation-standard.md` already defines how a
battle-test is built.

This packet owns the next question the standard does not answer on its own:

- which recreations should be tackled next
- what each recreation is supposed to pressure in the library
- when a recreation is allowed to open a reusable packet versus when it should
  wait

The goal is to keep `W4a` productive rather than letting the battle-test page
become a grab bag of interesting references.

## Authority split

- `docs/standards/battle-test-recreation-standard.md`
  - owns the workflow for each individual recreation
  - owns page structure, decomposition rules, and "library fix before demo hack"
- this packet
  - owns the active target order
  - owns which reusable gap each target is meant to surface
  - owns the stopping rules for when a recreation should open or widen a real
    library packet

## Active target order

Only one battle-test should be active at a time.

### 1. Percentile-led scouting card recreation

Primary pressure target: `W4b` percentile surfaces

Why this goes first:

- it is the cleanest forcing function for `PercentileBar` and
  `PercentilePill`
- it pressures explicit comparison-sample labeling, lower-is-better handling,
  and dense row ergonomics
- it tests whether Campos can pair precise percentile surfaces with an existing
  `PizzaChart` or `RadarChart` without inventing a second scouting slice

Expected outcome:

- `docs/specs/percentile-surfaces-spec.md` becomes an implementation packet
- the recreation should not proceed with fake progress bars or unlabeled
  percentiles

Reference family to prefer:

- FBref-style scouting report rows
- hybrid player cards that pair a radial overview with precise metric rows

### 2. Directional pass-profile recreation

Primary pressure target: `W4c` `PassSonar`

Why this goes second:

- it is the cleanest forcing function for a real directional-profile chart
- it pressures honest bin semantics, legend copy, and shared-scaling decisions
- it can later feed `SmallMultiples` without turning `PassSonar` into a
  dashboard-only component

Expected outcome:

- `docs/specs/passsonar-spec.md` becomes the active implementation contract
- if the recreation needs repeated sonars, use that pressure to confirm the
  residual `SmallMultiples` seams rather than smuggling layout logic into the
  sonar packet

Reference family to prefer:

- player pass-direction sonars
- sonar grids
- mplsoccer / StatsBomb-IQ-style directional pass profiles

### 3. Dense analyst-grid recreation

Primary pressure target: `W4d` `SmallMultiples` follow-up

Why this goes third:

- it should only happen after the percentile and sonar contracts are clearer
- it tests the residual grid / shared-view / compact-chart seams that remain
  after the shipped `SmallMultiples` baseline
- it tells us whether `PitchCell` is really needed or whether the existing
  chart + `Pitch` composition paths are already enough

Expected outcome:

- `docs/specs/smallmultiples-followup-packet.md` either closes as a narrow
  chart-adoption packet or widens to include `PitchCell` because a concrete
  recreation proved it necessary

Reference family to prefer:

- dense repeated shot maps / pass maps
- repeated bespoke pitch overlays where existing chart semantics are close but
  not quite enough

### 4. Layered set-piece or delivery recreation

Primary pressure target: future pitch-chart layer-slot packet

Why this is fourth:

- it is useful, but it should not leapfrog the clearer W4 component-family gaps
- it is likely to pressure layer slots on pitch charts or a narrower bespoke
  composition seam, not a wholly new chart family

Expected outcome:

- either a very small shared-seam packet opens, or the recreation is built
  cleanly with existing `Pitch` composition and no new public API

## Selection rules

Every new battle-test target must satisfy all of these:

1. one primary reusable gap, not three
2. real published football-viz reference with clear attribution
3. no more than one likely new primitive in the critical path
4. realistic data path from existing fixtures, adapters, or a narrowly
   documented synthetic reconstruction

Do not pick a target if:

- it mainly exists to show off page chrome rather than chart capability
- it would require multiple unrelated new primitives at once
- it duplicates a pressure test already provided by the current battle-test set

## Deliverables per target

In addition to the standard's page-level requirements, each target must record:

- the primary reusable gap it is meant to pressure
- whether that gap maps to an existing `W4` packet or opens a new one
- which active spec became authoritative because of the recreation
- which parts of the styled recreation are deliberately site-only chrome

## Packet-opening rules

Open or widen a reusable packet when the recreation needs:

- a repeated capability that another recreation would plausibly reuse
- a prop or primitive that fits Campos's chart-shaped component model
- shared compute semantics, not just page styling

Do not open a packet when the need is only:

- card chrome
- attribution layout
- page copy
- one-off typography or art direction

## Exit criteria

`W4a` is in a healthy state when all of the following hold:

- the next battle-test lands against one of the first three targets above
- the recreation opens or tightens a real library packet instead of carrying a
  demo-only hack
- the packet relationship is written into `docs/status/matrix.md`
- the battle-test page remains a forcing function, not an alternate roadmap

## Explicit non-goals

- turning the battle-test page into a second showcase program
- choosing targets mainly because they look impressive in isolation
- hiding reusable library misses inside page-specific SVG composition
- opening more than one active battle-test at once

## Review plan

- Loop 1: target selection review
  - confirm the chosen reference pressures exactly one primary packet
- Loop 2: seam review
  - verify the proposed library fix is really reusable before implementation
- Loop 3: release-readiness review
  - compare target, breakdown, and recreation to ensure the page is proving a
    library capability rather than compensating for a missing one

## Open questions

- Which concrete percentile-led reference should anchor the first W4 battle-test?
- Does the first sonar pressure test belong on a standalone chart page first,
  or can the battle-test open the packet directly?
- Is the layered set-piece target still the highest-value fourth target once the
  first three recreations land?
