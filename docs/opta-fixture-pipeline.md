# Opta Fixture Pipeline

**Status:** active
**Last updated:** 2026-04-09

## Purpose

Define the first real-data fixture pipeline Campos should use from the Cloudflare `opta-data` R2 bucket before introducing extra external aggregate sources.

This document is about fixture sourcing and reproducible demo-data prep, not about final public chart APIs.

## Verified source

The primary current source is the Cloudflare R2 bucket `opta-data`.

Verified key families:

- `opta/matches.json`
- `opta/standings.json`
- `opta/squads.json`
- `opta/top-performers.json`
- `opta/match-stats/{matchId}.json`
- `opta/match-events/{matchId}.json`
- `opta/expected-goals/{matchId}.json`
- `opta/pass-matrix/{matchId}.json`

Likely historical layout:

- current season: `opta/...`
- historical seasons: `opta-YYYY-YY/...`

## First committed fixture module

The first committed Opta fixture-prep module now lives at:

- [apps/site/src/data/opta-fixtures.ts](https://github.com/withqwerty/campos/blob/main/apps/site/src/data/opta-fixtures.ts)

Current contents:

- real Opta shot-map fixture array from `expected-goals`
- real first-half pass sample from `match-events`
- dense spatial event coordinates for `Heatmap` / `KDE`
- attacking player aggregate rows
- attacking team aggregate rows
- derived `ScatterPlot` points
- derived attacking `PizzaChart` rows
- derived attacking team `RadarChart` rows
- derived `XGTimeline` points

Current limitation:

- the committed `PassMap` fixture is a curated raw-event sample from one half, not yet a fully adapter-normalized season/match pipeline

## What this source is good for

### Strong immediate fits

- `ShotMap`
  - `expected-goals/{matchId}.json` gives real shot events with coordinates and xG qualifiers
- `PassMap`
  - `pass-matrix/{matchId}.json` gives player nodes, average positions, and pass-link counts
- `XGTimeline`
  - `expected-goals/{matchId}.json` gives time-ordered xG shot events by team
- `Heatmap`
  - `match-events/{matchId}.json` gives coordinate-bearing event streams
- `KDE`
  - same event source as `Heatmap`, with smoothing done downstream

### Good fits with derived aggregation

- `ScatterPlot`
  - derive player/team aggregate rows from `match-stats` and `expected-goals`
- `RadarChart`
  - first attacking player/team templates can be derived honestly from Opta xG and shot-related stats
- `PizzaChart`
  - same story as `RadarChart`

### Weak fits or insufficient alone

- richer all-action player templates needing metrics such as:
  - progressive passes
  - progressive carries
  - recoveries
  - interceptions
  - pressure regains
  - miscontrols

Those should not be claimed from the Opta fixture pipeline until they are either:

- proven available in additional checked Opta payloads, or
- supplied by a second verified aggregate source

## Verified metric families

### From `match-stats`

Useful team/player stat names verified in sampled payloads:

- `accuratePass`
- `totalPass`
- `goals`
- `goalAssist`
- `ontargetScoringAtt`
- `totalScoringAtt`
- `possessionPercentage`
- `totalTackle`
- `wonTackle`
- `totalClearance`

This is useful, but still fairly shallow for advanced profile charts.

### From `expected-goals`

Useful team/player stat names verified in sampled payloads:

- `expectedGoals`
- `expectedGoalsNonpenalty`
- `expectedGoalsontarget`
- `expectedAssists`
- `bigChanceCreated`
- `bigChanceMissed`
- `bigChanceScored`
- `touches`
- `touchesInOppBox`
- `totalScoringAtt`
- `ontargetScoringAtt`
- multiple shot-location / shot-type / body-part-style breakdowns

This is the key source that makes first attacking profile charts viable.

### From `match-events`

Verified event fields include:

- `typeId`
- `periodId`
- `timeMin`
- `timeSec`
- `contestantId`
- `playerId`
- `x`
- `y`
- `qualifier`

This is the base source for:

- event-density demos
- event heatmaps / KDE
- shot/context reconstruction when needed

### From `pass-matrix`

Verified player/link fields include:

- player average `x` / `y`
- `passSuccess`
- `passLost`
- `crossSuccess`
- `crossLost`
- `playerPass[]` with pass counts to teammates

This is the strongest direct fixture path for `PassMap`.

## First approved derived fixture sets

### 1. Attacking player profile

Use for:

- `RadarChart`
- `PizzaChart`
- `ScatterPlot`

First approved metric set:

- `NPG`
- `xG`
- `xGOT`
- `xA`
- `shots`
- `shots on target`
- `big chances scored`
- `big chances created`
- `touches in opp box`

Notes:

- percentiles may be artificial/derived as long as the cohort is stated explicitly
- per-90 normalization is acceptable and expected when minutes vary materially
- this is intentionally an attacking template, not a general all-role template

### 2. Attacking team profile

Use for:

- `RadarChart`
- `PizzaChart`
- `ScatterPlot`

First approved metric set:

- `goals`
- `xG`
- `xA`
- `shots`
- `shots on target`
- `big chances created`
- `touches in opp box`
- `possession`
- `pass completion`

Notes:

- if `xA` proves awkward at team level in the first pass, it may be replaced by `assists` temporarily
- team percentiles may be league-season based and explicitly documented in the fixture module

### 3. Match-level fixtures

Use for:

- `ShotMap`
- `PassMap`
- `XGTimeline`
- `Heatmap`
- `KDE`

First approved source split:

- `ShotMap`: `expected-goals/{matchId}.json`
- `PassMap`: `pass-matrix/{matchId}.json`
- `XGTimeline`: `expected-goals/{matchId}.json`
- `Heatmap`: `match-events/{matchId}.json`
- `KDE`: `match-events/{matchId}.json`

### 4. Season-level aggregate fixtures

Use for:

- `ScatterPlot`
- simple ranking/demo tables around profile charts

Useful season files:

- `standings.json`
- `squads.json`
- `top-performers.json`

These are not rich enough for final profile charts by themselves, but they are valid companion/demo data.

## Artificial aggregates are allowed

Campos may derive reusable fixture tables from Opta payloads even when the payloads are not already shaped as scouting profiles.

Allowed transformations:

- match-to-season aggregation
- per-90 normalization
- explicit percentile calculation against a named cohort
- synthetic comparison averages such as league-average or position-average rows

Not allowed:

- invented raw event fields
- invented xG/xA values
- invented provider support claims

## Chart-by-chart fixture recommendation

| Chart         | Recommended Opta source              | Confidence  | Notes                           |
| ------------- | ------------------------------------ | ----------- | ------------------------------- |
| `ShotMap`     | `expected-goals/{matchId}.json`      | high        | best current source             |
| `PassMap`     | `pass-matrix/{matchId}.json`         | high        | direct structural fit           |
| `XGTimeline`  | `expected-goals/{matchId}.json`      | high        | direct structural fit           |
| `Heatmap`     | `match-events/{matchId}.json`        | high        | event-type subsets required     |
| `KDE`         | `match-events/{matchId}.json`        | high        | same as heatmap, smoothed       |
| `ScatterPlot` | derived aggregate tables from Opta   | medium-high | requires reproducible prep code |
| `RadarChart`  | derived attacking profiles from Opta | medium-high | first template only             |
| `PizzaChart`  | derived attacking profiles from Opta | medium-high | first template only             |

## Required implementation discipline

- every fixture module should record the exact R2 key family or derived source path used
- every derived aggregate fixture should keep its prep step in code
- every percentile-bearing fixture should state the cohort and normalization rule
- if a chart needs richer metrics than this pipeline supports honestly, add a second verified source rather than stretching the Opta claims
