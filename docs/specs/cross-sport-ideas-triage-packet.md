# Cross-Sport Ideas Triage Packet

**Status:** active packet
**Last updated:** 2026-04-20

## Purpose

`apps/site/src/pages/lab/cross-sport-ideas.astro` is useful as an idea pool,
but it is too broad to act as a delivery queue.

This packet turns that lab into a narrower W4 decision surface:

- which ideas actively feed current football packets
- which ideas should wait for a battle-test trigger
- which ideas are explicitly deferred beyond W4

## Inputs

- `apps/site/src/pages/lab/cross-sport-ideas.astro`
- `docs/specs/chart-reference-layers-spec.md`
- `docs/roadmap-v0.3.md`
- `docs/status/matrix.md`
- the currently active W4 backlog

## Triage rule

Promote an idea only if it satisfies at least one of these:

1. it directly strengthens an already-active `W4` packet
2. it materially improves battle-test recreatability
3. it maps to an existing football chart family or a clearly reusable
   football-first primitive

Do not promote an idea just because it is novel.

## Current shortlist

### Promote now

| Idea family                                   | Source in lab                          | Maps to                          | Why it survives                                                                        |
| --------------------------------------------- | -------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| Hybrid radial + precise percentile rows       | player-card and scouting idioms        | `W4b` percentile surfaces        | directly pressures the missing precise linear companion to `PizzaChart` / `RadarChart` |
| Directional pass-profile / wagon-wheel idioms | sonar / wagon-wheel notes              | `W4c` `PassSonar`                | direct football fit and already requested in the active backlog                        |
| Dense repeated analyst pitch cells            | repeated pitch grids and analyst cards | `W4d` `SmallMultiples` follow-up | direct fit for the queued analyst-grid residuals                                       |

### Promote only through battle-test trigger

| Idea family                              | Source in lab         | Likely packet                            | Why it is not active yet                                                       |
| ---------------------------------------- | --------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| Layered set-piece landing / delivery map | set-piece landing map | future pitch-chart layer-slot packet     | valuable, but secondary to current W4 gaps                                     |
| Signed xG delta trace                    | xG race trace         | future `XGTimeline` delta-mode extension | useful extension, but not a core W4 gap                                        |
| Match dominance stripe                   | dominance stripe      | future small extension or primitive      | interesting narrative layer, but not yet tied to a forcing-function recreation |

### Explicitly defer beyond W4

| Idea family          | Source in lab                  | Why deferred                                                                                  |
| -------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| Gantt / stint chart  | lineup Gantt                   | distinct new primitive; not required for current W4 gaps                                      |
| Waterfall / bridge   | xT / xG waterfall              | distinct new primitive; valuable, but not next                                                |
| Horizon chart        | horizon                        | distinct new primitive and more off-pitch / career-narrative oriented                         |
| Matrix / cell-grid   | matchup / on-off ideas         | new primitive family; only promote if a football-first use case becomes urgent                |
| Circular arc / chord | passing wheel                  | should not be smuggled in as a novelty network alternative without a concrete football reason |
| Parallel coordinates | multi-metric player comparison | high complexity, high misuse risk, and not needed while percentile surfaces are still missing |

## What this packet should produce

- one short active shortlist that lives in `docs/status/matrix.md`
- one explicit defer list so novelty ideas do not keep re-entering the queue
- one rule for when a future battle-test is allowed to promote a deferred idea

## Promotion rule for deferred ideas

A deferred cross-sport idea may move into the active queue only if:

- a battle-test or product need names it explicitly
- it maps cleanly onto football semantics
- it does not leapfrog a more central active gap packet without a clear reason

## Non-goals

- treating the lab page as a second roadmap
- promising every red primitive in the lab
- opening off-pitch modules by stealth

## Exit criteria

`W4e` is done when:

- the shortlist above is reflected in `docs/status/matrix.md`
- the active roadmap points at this packet rather than the raw lab page alone
- any newly promoted idea is represented by a real packet, not a loose note

## Review plan

- Loop 1: product-fit review
  - verify every promoted idea maps to a real football packet
- Loop 2: scope review
  - verify the shortlist is still small enough to execute
- Loop 3: backlog review
  - verify deferred ideas stay deferred unless a new forcing function appears
