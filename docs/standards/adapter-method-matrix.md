# Adapter Method Matrix

**Status:** active
**Scope:** public adapter data-product surface and missing reusable methods
**Purpose:** track which public adapter methods Campos should expose as reusable data-preparation surfaces for UI work, and make missing methods explicit before site or component work papers over the gap with ad hoc local transforms

## Why this exists

`adapter-gap-matrix.md` tracks field-level provider coverage.

This document tracks a different question:

- what canonical **data products** Campos adapters should expose as public methods
- which UI families should consume those products
- where we currently have to reach into `events()` and hand-filter locally because a better adapter method does not exist yet

This is the place to answer questions like:

- do we have a lineup/team-sheet method, or only a narrow formation snapshot method?
- should `PassMap` consume `passes()` or keep filtering `events()`?
- which UIs need a dedicated adapter product and which should stay aggregate/consumer-owned?

## Core rule

Add an adapter method when all of the following are true:

1. The prepared data shape is useful across more than one UI or app surface.
2. The preparation requires provider-specific normalization, taxonomy cleanup, or joins.
3. The result is a stable football data packet, not a renderer-specific layout packet.

Do **not** add an adapter method when the work is primarily:

- chart aggregation (`aggregatePassNetwork`, percentile tables, KPI summaries)
- view logic (`crop`, `orientation`, binning, smoothing)
- app-specific editorial composition

## Two-stage model

Campos should treat prepared football data in two stages:

1. **First-stage products** come from adapters.
   These are canonical, provider-normalized football entities such as:
   - `ShotEvent[]`
   - `PassEvent[]`
   - `Event[]`
   - lineup / team-sheet packets
2. **Second-stage products** come from the transitional compute/helper surface in `@withqwerty/campos-react` or from consumer/app code.
   These are derived analytical or view-oriented products such as:
   - pass-network `{ nodes, edges }`
   - xG timeline models
   - KPI summary rows
   - filtered subsets for heatmaps, KDEs, or territory charts

The key boundary:

- adapters normalize provider-specific football semantics
- compute helpers/apps derive chart-ready or report-ready products from those normalized packets

### Good pattern

```ts
const shots = fromOpta.shots(raw, matchContext);
const passes = fromOpta.passes(raw, matchContext);
const lineups = fromOpta.matchLineups(raw, matchContext);

const network = aggregatePassNetwork(passes);
const timeline = computeXGTimeline({ shots, homeTeam, awayTeam });
const stats = computeMatchStats(events);
```

### Bad pattern

Avoid adapter methods shaped like specific rendered outputs:

- `fromOpta.passNetworkData()`
- `fromOpta.heatmapData()`
- `fromOpta.formationCardData()`
- `fromOpta.xgTimelineData()`

Those are second-stage products. They should stay in core or app code unless provider-specific normalization is still the hard part.

## Status key

- `shipped`: explicit public adapter method exists and is the preferred surface
- `partial`: a public method exists, but it is narrower than the full reusable data packet the UI family really wants
- `derived`: no dedicated method exists, but consumers can derive the data product cleanly from a broader public method such as `events()`
- `missing`: no clean public surface exists yet
- `not-adapter-owned`: the prep belongs in core or consumer/app code, not adapters

## Canonical adapter data products

| Data product                    | Preferred public method                                 | Opta    | StatsBomb | Wyscout | WhoScored | Notes                                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------- | ------- | --------- | ------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full normalized event stream    | `events(raw, context)`                                  | shipped | shipped   | shipped | shipped   | Base adapter surface for generic event-led UIs                                                                                                                                                            |
| Shot projection                 | `shots(raw, context)`                                   | shipped | shipped   | shipped | shipped   | Canonical packet for `ShotMap`; xG availability still varies by provider                                                                                                                                  |
| Pass projection                 | `passes(raw, context)`                                  | shipped | shipped   | shipped | shipped   | Common UI need. Now the explicit first-stage pass packet instead of a hand-filtered `events()` subset                                                                                                     |
| Rich lineup / team-sheet packet | `lineups(raw, context)` or `matchLineups(raw, context)` | shipped | shipped   | partial | shipped   | Explicit public methods now exist for all four providers. WhoScored is richest; Opta and StatsBomb stay narrower and more source-shaped; Wyscout is public-dataset-driven and still meaningfully narrower |
| Formation snapshot              | `formations(raw, context)`                              | shipped | shipped   | missing | shipped   | Useful for `<Formation>`, but too narrow to stand in for a richer lineup/team-sheet product                                                                                                               |
| Positional touch projection     | `touches(raw, context)`                                 | derived | derived   | derived | derived   | Not yet clearly justified as a dedicated method; current path is `events()` + consumer/core filtering                                                                                                     |
| Defensive-action projection     | `defensiveActions(raw, context)`                        | derived | derived   | derived | derived   | Candidate future helper if repeated site work keeps rebuilding the same filter set                                                                                                                        |
| Goalkeeper-action projection    | `goalkeeperActions(raw, context)`                       | derived | derived   | derived | derived   | Similar status to defensive actions: not yet required as a dedicated public method                                                                                                                        |

## UI to adapter-input plan

| UI / UI family                                                 | Preferred adapter-prepared input                                      | Current status      | Notes                                                                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `ShotMap`                                                      | `shots()`                                                             | good                | This is the cleanest current adapter story                                                                                             |
| `XGTimeline`                                                   | `shots()` with reliable `xg`                                          | mixed               | Opta and StatsBomb are the honest baseline; Wyscout and WhoScored remain xG-limited                                                    |
| `PassMap`                                                      | `passes()`                                                            | shipped             | Explicit public pass projection now exists across all four providers                                                                   |
| `Formation`                                                    | `formations()` today; should also be derivable from `lineups()` later | workable but narrow | Current methods solve the formation card, not the broader lineup/team-sheet problem                                                    |
| Match lineup cards / team sheets / bench views / rating strips | `lineups()` / `matchLineups()`                                        | partial             | No longer a pure gap: all four providers now ship lineup surfaces, but richness still varies sharply and Wyscout remains the narrowest |
| `Heatmap`, `KDE`, `Territory`                                  | normalized positional events from `events()`                          | acceptable          | These are generic event-led charts. A dedicated adapter method is optional unless repeated consumer filtering becomes noisy            |
| `GoalMouthShotChart`                                           | `shots()`                                                             | shipped             | Same first-stage packet as `ShotMap`; depends on `goalMouthY` / `goalMouthZ`, with xGOT remaining provider-variant                     |
| `PassFlow` / `PassSonar`                                       | `passes()`                                                            | shipped             | Same first-stage packet as `PassMap`; downstream compute/rendering differs, but the adapter product does not                           |
| `PassNetwork`                                                  | `passes()` plus lineup/team context                                   | partial             | Network aggregation belongs in core/app code, but the input packets should be cleaner than “filter the whole event stream by hand”     |
| `ScatterPlot`                                                  | aggregate consumer-owned rows                                         | not-adapter-owned   | Adapters normalize the raw events; the plotted rows are analytical aggregates                                                          |
| `RadarChart` / `PizzaChart`                                    | aggregate consumer-owned metrics                                      | not-adapter-owned   | Same rule as `ScatterPlot`                                                                                                             |
| `PercentileBar` / `PercentilePill`                             | aggregate consumer-owned percentile packets                           | not-adapter-owned   | Percentile inversion, cohort choice, and sample framing are upstream analytical concerns, not adapter method candidates                |
| `StatBadgeRow`                                                 | consumer-owned KPI summary rows                                       | not-adapter-owned   | A future stats helper may exist, but it should not be framed as a generic adapter method without a stronger cross-provider contract    |

## Current UI family audit

Use this as the practical checklist when deciding whether Campos needs a first-stage adapter output.

| UI family                                      | Current Campos surface     | First-stage packet it should consume       | Dedicated adapter method wanted?    | Second-stage product involved?      | Ownership note                                                                     |
| ---------------------------------------------- | -------------------------- | ------------------------------------------ | ----------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| Shot maps                                      | `ShotMap`                  | `ShotEvent[]`                              | yes: `shots()`                      | sometimes                           | Canonical example of a direct first-stage consumer                                 |
| Goal-mouth / finishing charts                  | `GoalMouthShotChart`       | `ShotEvent[]`                              | yes: `shots()`                      | maybe                               | Same first-stage packet as `ShotMap`; different renderer/view                      |
| xG timelines                                   | `XGTimeline`               | `ShotEvent[]`                              | yes: `shots()`                      | yes: timeline model                 | Timeline compute belongs in core, not adapters                                     |
| Pass maps                                      | `PassMap`                  | `PassEvent[]`                              | yes: `passes()`                     | no or minimal                       | `passes()` is now the preferred first-stage packet                                 |
| Pass flow / directional passing summaries      | `PassFlow`, `PassSonar`    | `PassEvent[]`                              | yes: `passes()`                     | yes: chart-specific compute models  | Same canonical pass packet; downstream binning / angular aggregation stays in core |
| Pass networks                                  | `PassNetwork`              | `PassEvent[]`                              | yes: `passes()`                     | yes: `{ nodes, edges }` aggregation | Network aggregation belongs in core/app code                                       |
| Generic passing tables / passing profile cards | future                     | `PassEvent[]`                              | yes: `passes()`                     | maybe                               | Strong evidence that `passes()` is a reusable first-stage packet                   |
| Formation cards                                | `Formation`                | formation snapshot or richer lineup packet | partial today                       | no or minimal                       | `formations()` works, but it is narrower than a real team-sheet product            |
| Lineup cards with richer adornments            | current/future site work   | lineup / team-sheet packet                 | yes: `lineups()` / `matchLineups()` | maybe                               | Should support captain, bench, ratings, status, and substitutions where available  |
| Bench / substitutes lists                      | future                     | lineup / team-sheet packet                 | yes: `lineups()` / `matchLineups()` | no                                  | Strong sign that formation snapshot alone is not enough                            |
| Ratings strips on top of lineups               | future                     | lineup / team-sheet packet                 | yes: `lineups()` / `matchLineups()` | maybe                               | Ratings should not require reopening provider blobs in site code                   |
| Heatmaps                                       | `Heatmap`                  | normalized positional events               | maybe later                         | no or minimal                       | Current `events()` + consumer filtering is acceptable                              |
| KDE / density maps                             | `KDE`                      | normalized positional events               | maybe later                         | no or minimal                       | Same as `Heatmap`; only justify a dedicated helper if repetition becomes noisy     |
| Territory diagrams                             | `Territory`                | normalized positional events               | maybe later                         | yes: territory binning/model        | Binning and labeling belong in core                                                |
| Defensive action maps                          | future                     | defensive-action subset                    | maybe later                         | no or minimal                       | Candidate for a dedicated helper only if repeated usage proves it                  |
| Goalkeeper action maps                         | future                     | goalkeeper-action subset                   | maybe later                         | no or minimal                       | Similar to defensive actions: keep derived until repetition justifies promotion    |
| Scatter plots                                  | `ScatterPlot`              | aggregate rows                             | no                                  | yes: consumer-owned aggregate rows  | Adapter role ends at normalized events feeding upstream analysis                   |
| Radar / pizza charts                           | `RadarChart`, `PizzaChart` | aggregate metric rows                      | no                                  | yes: consumer-owned aggregates      | These are profile/report products, not raw adapter products                        |
| KPI strips / stat badges                       | `StatBadgeRow`             | aggregate stat rows                        | no                                  | yes: consumer-owned summaries       | Avoid turning every summary row into adapter API surface                           |

## Likely first-stage product set for Campos v0.x

If we keep the adapter API disciplined, the likely stable first-stage set is small:

- `events()`
- `shots()`
- `passes()`
- `lineups()` / `matchLineups()`

Narrow match-page summary adapters now also justify:

- `matchSummary()` for result/live/header use cases where the real work is provider-specific score, status, and xG normalization rather than chart aggregation

That packet is intentionally narrower than the core event matrix above. The
current landed examples are scrape-backed `Understat`, `FBref`, and `Sofascore`
summary adapters rather than a claim that the original four event providers all
ship the surface already.

Reference-backed provider adapters now also justify:

- `Stats Perform` — `events()`, `shots()`, `passes()`, `matchContext()`, `matchLineups()`, `formations()`
- `Impect` — `events()`, `shots()`, `passes()`, `matchLineups()`, `formations()`
- `Sportec` — `events()`, `shots()`, `passes()`, `matchContext()`, `matchLineups()`, `formations()`

These remain **partial** rather than full provider-parity adapters:

- `Stats Perform` is currently the strongest of the three because the MA3 seam
  is close enough to Opta to reuse the existing event-family mappers honestly.
- `Impect` ships a real open-data event subset plus carries, but still inherits
  open-data taxonomy limits.
- `Sportec` now ships a narrower real XML event subset rather than only a
  future-looking context seam; tackling and other-ball-action taxonomy is still deferred.

Possible later additions only if repeated usage justifies them:

- `touches()`
- `defensiveActions()`
- `goalkeeperActions()`

Everything else should be presumed second-stage until proven otherwise.

## Target contract: `passes()`

### Purpose

Expose an explicit public pass projection so pass-led UIs do not have to recover `PassEvent[]` by filtering `events()` manually.

This is primarily an API-surface improvement, not a new conceptual data model. Campos already has a canonical `PassEvent` shape and provider pass mappers.

### Proposed public shape

```ts
const passes = fromOpta.passes(rawEvents, matchContext);
const passes = fromStatsBomb.passes(rawEvents, matchInfo);
const passes = fromWhoScored.passes(matchData, matchInfo);
const passes = fromWyscout.passes(matchData, matchInfo);
```

### Output contract

Return:

- `PassEvent[]`

The target contract is the existing schema shape, not a chart-shaped wrapper.

Minimum expected fields are the current `PassEvent` contract:

- base event identity and timing
- `x`, `y`, `endX`, `endY`
- `length`, `angle`
- `recipient`
- `passType`
- `passResult`
- `isAssist`
- provider provenance

### Projection rules

`passes()` should be the pass analogue of `shots()`:

- include only canonical pass events
- drop raw rows that do not produce a plottable or semantically valid `PassEvent`
- preserve lossy or provider-limited cases as `null` on canonical fields rather than inventing fake values

Examples:

- missing recipient is acceptable -> `recipient: null`
- provider cannot distinguish nuanced result states -> collapse honestly
- missing end coordinates may still be acceptable for some downstream consumers, but should be explicitly documented if retained

### Why this should exist

- `PassMap` wants `PassEvent[]` directly.
- `PassNetwork` should aggregate from `PassEvent[]`, not from a full mixed `Event[]`.
- passing tables, passing profiles, and direction-based density charts all want the same first-stage packet.

### Implementation status

`passes()` now ships across all current providers.

That confirms the original judgment here was right: this was mostly a public-method and
documentation gap, not a greenfield adapter project.

## Target contract: `matchLineups()`

### Purpose

Expose a richer team-sheet packet than `formations()`, so consumers can render lineup cards, bench lists, captain/status UI, ratings strips, and substitution-aware match sheets without reopening provider blobs in site/app code.

`formations()` should remain the narrow formation-snapshot convenience surface for `<Formation>`.
`matchLineups()` should become the richer first-stage packet for lineup-oriented UI families.

### Proposed public shape

```ts
const lineups = fromOpta.matchLineups(rawLineupInputs, context);
const lineups = fromWhoScored.matchLineups(matchCentreData, matchInfo);
```

Recommended return shape:

```ts
type MatchLineups = {
  matchId?: string;
  home?: TeamSheet | null;
  away?: TeamSheet | null;
};

type TeamSheet = {
  teamId: string;
  teamLabel?: string | null;
  formation?: string | null;
  captainPlayerId?: string | null;
  starters: TeamSheetPlayer[];
  bench: TeamSheetPlayer[];
  unavailable?: TeamSheetPlayer[];
  sourceMeta?: Record<string, unknown> | null;
};

type TeamSheetPlayer = {
  playerId: string;
  label?: string | null;
  number?: number | null;
  positionCode?: string | null;
  slot?: number | null;
  captain?: boolean;
  starter?: boolean;
  substitutedIn?: boolean;
  substitutedOut?: boolean;
  minuteOn?: number | null;
  minuteOff?: number | null;
  rating?: number | null;
  x?: number | null;
  y?: number | null;
  sourceMeta?: Record<string, unknown> | null;
};
```

### Contract notes

- `TeamSheet` is a first-stage football packet, not a renderer layout packet.
- `starters` and `bench` are the key split.
- `formation`, `slot`, and `positionCode` should be present when the provider supports them.
- `x` and `y` are optional explicit player-position overrides when the provider supplies them directly.
- `rating` is optional and should only be populated when the source genuinely carries it.
- substitution and minute fields are optional and should remain null/false when not safely derivable.

### Relationship to `formations()`

`formations()` can be implemented as a narrowing projection from `matchLineups()` when the source packet supports it:

- choose one team
- take the kickoff or current starting XI snapshot
- map to `FormationTeamData`

That direction is healthier than treating `FormationTeamData` as the only canonical lineup surface and then trying to recover bench/captain/rating state later.

### Why this should exist

It supports multiple UI families with one first-stage packet:

- `Formation`
- lineup cards
- bench lists
- captain/rating strips
- match report team sheets
- substitution-aware lineup summaries

This was the clearest historical gap in Campos' adapter surface; it is now a
shipped method family with provider-specific honesty constraints.

### Provider guidance

#### WhoScored

Richest current reference implementation.

Why:

- `matchCentreData` already carries a rich team object
- current formation mapper explicitly notes that real payloads contain more stats/ratings than Campos currently uses
- self-contained input is ergonomically good for a public adapter method

#### Opta

Useful narrower companion surface; keep scope explicit.

Likely viable inputs:

- lineup event(s)
- squad index / squad file
- optionally substitution events if we want minute-aware team sheets

Important constraint:

- do not pretend Opta can provide the same richness as WhoScored unless the source actually carries it

#### StatsBomb / Wyscout

Wyscout now ships as a narrower public-dataset seam using `matchData` plus
optional player/team lookups. Keep that explicit rather than implying official
API parity.

StatsBomb now ships the honest first seam.

Recommended input seam:

```ts
const lineups = fromStatsBomb.matchLineups(rawLineups, rawEvents, matchInfo);
```

Reasoning:

- the separate `lineup` payload holds squad membership, shirt numbers, cards, and
  player position intervals
- the `events` payload holds `Starting XI` (`type.id 35`) with
  `tactics.formation` and lineup-by-position data
- the same event stream also holds `Substitution` (`type.id 19`) and
  `Tactical Shift` (`type.id 36`) events, which are the honest source of lineup
  and formation changes

Recommended v1 scope:

- starters and bench
- stable player IDs and labels
- shirt numbers
- formation label / key
- slot / position from `Starting XI`
- substitution metadata where the event join supports it

Recommended v1 non-goals:

- no events-only overload
- no explicit player coordinates
- no ratings
- no claim of full tactical-state reconstruction

### Current implementation reality

- Opta: `matchLineups()` ships as a narrower kickoff team-sheet packet
- WhoScored: `matchLineups()` is the richest current reference implementation
- StatsBomb: `matchLineups()` ships as a multi-payload lineup surface using `lineups + events + matchInfo`
- Wyscout: `matchLineups()` ships as a narrow public-dataset lineup surface using `match.teamsData.formation` plus optional player/team lookup data
- Canonical schema types for `TeamSheetPlayer`, `TeamSheet`, and `MatchLineups` are live, and all current providers now ship some public implementation of the surface

### Provider field-cluster expectations for `matchLineups()`

This table is intentionally more ambitious than today's shipped surface. It defines what the method should try to expose, while keeping provider support honest. The Opta and WhoScored columns have been pressure-tested against the current `formations()` input paths rather than written from memory.

| Field cluster                                          | Opta                                | WhoScored                                          | StatsBomb              | Wyscout         | Notes                                                                                                     |
| ------------------------------------------------------ | ----------------------------------- | -------------------------------------------------- | ---------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| Team identity (`teamId`, `teamLabel`)                  | available                           | available                                          | available\*            | available\*\*   | Wyscout team labels come from optional `teams.json` lookup data or equivalent external metadata           |
| Starters vs bench split                                | available                           | available                                          | available\*            | available\*\*   | Wyscout public dataset exposes `match.teamsData.formation.lineup` and `.bench` directly                   |
| Shirt numbers                                          | available                           | available                                          | available\*            | unsupported\*\* | Current Wyscout public dataset seam does not include shirt numbers                                        |
| Player labels / names                                  | available with squad join           | available                                          | available\*            | available\*\*   | Wyscout names come from optional `players.json` lookup data or equivalent external metadata               |
| Formation label / key                                  | available                           | available                                          | available\*            | unsupported\*\* | Current Wyscout public dataset seam has lineup/bench/substitutions but no explicit formation string       |
| Captain flag / captain player                          | available                           | available                                          | unknown / deferred     | unsupported\*\* | No captain marker in the current Wyscout public dataset seam                                              |
| Slot / position code                                   | available                           | available                                          | available\*            | partial\*\*     | Wyscout only has coarse role codes from player metadata, not formation-slot assignments                   |
| Explicit player coordinates                            | not in current lineup path          | available                                          | unsupported            | unsupported\*\* | No explicit Wyscout formation coordinates in the current public dataset seam                              |
| Bench ordering / match-day squad                       | available                           | available                                          | partial\*              | available\*\*   | Wyscout lineup/bench arrays preserve match-day squad membership                                           |
| Substitution state (`subOn`, `subOff`, minute on/off`) | derivable with wider event join     | partial to available                               | partial to available\* | available\*\*   | Wyscout public dataset exposes `formation.substitutions[]` directly                                       |
| Ratings                                                | not in current approved source path | possible in broader source, not in trimmed fixture | unsupported            | unsupported\*\* | No ratings in the current Wyscout public dataset seam                                                     |
| Availability / dismissal state                         | derivable with wider event join     | derivable with wider event join                    | partial\*              | partial\*\*     | Wyscout lineup entries expose goals / yellow / red / own-goal stats, but not a broader availability model |

\* StatsBomb expectations now align with the shipped `lineup + events + matchInfo`
implementation. Captain remains undefined, explicit coordinates remain unsupported,
and bench ordering is still intentionally non-promised.

\*\* Wyscout expectations now align with the shipped public-dataset implementation
using `match.teamsData.formation` plus optional `players.json` and `teams.json`
lookup data. This is intentionally not a claim of official API parity.

### Immediate implementation bias

If `matchLineups()` work continues:

1. `fromWhoScored.matchLineups()` remains the richest shipped implementation.
   Why: it remains the richest current reference surface; the source is self-contained and already carries bench, captain, formation intervals, and explicit formation positions.
2. `fromOpta.matchLineups()` now ships as a narrower companion surface.
   Why: it cleanly supports kickoff starters, bench ordering, captain, formation, shirts, and squad-joined labels without inventing richer state.
3. `fromStatsBomb.matchLineups()` now ships as the honest multi-payload implementation.
   Why: the source really is split across `lineups` and `events`, and the shipped surface preserves that boundary instead of hiding it behind an events-only shortcut.
4. Keep Wyscout explicitly marked as the narrow public-dataset implementation, not a parity claim.

## Rich lineup / team-sheet target

This is now a shipped method family. The remaining work is not “add the
method”, but pressure-test richness, parity, and honesty by provider.

The target should be broader than the current `formations()` surface. A lineup/team-sheet packet should be rich enough that a consumer can decide **what** to render and **how** to render it without reopening provider-specific parsing.

Minimum target shape:

- match/team identifiers and labels
- formation label / key when known
- starters
- bench / substitutes
- captain flag
- shirt number
- stable player IDs
- position / slot when known
- player status metadata when known
- ratings when the source carries them
- substitution-in / substitution-out metadata when the source carries it

Provider notes:

- **WhoScored:** richest current `matchLineups()` implementation because `matchCentreData` already carries rich player-level context beyond the current `formations()` snapshot surface.
- **Opta:** useful narrower `matchLineups()` companion via lineup events plus `squads.json`, but the surface should stay explicitly scoped around what Opta can and cannot supply cleanly.
- **StatsBomb:** the honest upstream seam is now shipped as `lineups + events + matchInfo`; keep it source-shaped rather than hiding the second raw input.
- **Wyscout:** now ships, but only through the public-dataset seam plus lookup data. Keep that distinction explicit.

## Workflow rule

When a new UI or demo page is introduced:

1. Name the adapter-prepared input packet it should consume.
2. Decide whether that packet deserves a public adapter method.
3. Update this matrix.
4. Only then decide whether temporary local filtering/derivation is acceptable.

## Current priority additions

1. Pressure-test whether Wyscout lineup support should gain more than team labels, coarse role codes, and substitution metadata without pretending public-dataset parity equals official API parity.
2. Decide whether FotMob belongs as a scrape-backed experimental adapter source rather than a first-class stable provider.
3. Reassess whether repeated density/territory work justifies `touches()` or `defensiveActions()` as dedicated helpers.
