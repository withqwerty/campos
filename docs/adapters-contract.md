# Adapters Contract

**Status:** active

## Purpose

`@withqwerty/campos-adapters` converts provider-specific football data into canonical Campos entities. Adapters are part of the product promise, not optional glue.

Adapters are also a product in their own right for TypeScript consumers. They should be
useful whether the normalized output feeds Campos UI, custom React views, static reports,
or downstream analysis code.

Campos has learned from `kloppy`, with thanks, and should continue to use it as a
serious reference for provider normalization and coordinate handling. Campos is
not trying to be a replacement for `kloppy` or a full TypeScript port of its
scope. Adapter parity only matters on the seams Campos intentionally adopts for
UI-relevant first-stage products. See [kloppy-relationship.md](https://github.com/withqwerty/campos/blob/main/docs/kloppy-relationship.md).

## Scope

Adapters should normalize:

- coordinates and pitch direction;
- provider coordinate space metadata and any known pitch dimensions;
- event taxonomy and outcome labels;
- body-part and context labels;
- own goals, disallowed goals, and period boundaries;
- team and player identity fields available in the source;
- provider quirks needed for stable rendering defaults.

Adapters should also share internal infrastructure where possible:

- common coordinate conversion helpers;
- a shared provider-space to Campos-space standardizer;
- taxonomy mapping tables;
- provenance and warning formatting;
- cross-provider equivalence fixtures for the same football concepts.

Adapters should not:

- render anything;
- apply product-specific layout or theming;
- compute presentation-only regions like legends or stats bars.
- return chart-shaped packets that bake in one specific visualization.

## Product model

Campos uses a two-stage data model:

- **first-stage adapter products**: provider-normalized football packets such as
  `Event[]`, `ShotEvent[]`, `PassEvent[]`, `MatchSummary`, and `MatchLineups`
- **second-stage derived products**: pass networks, xG timelines, KPI summaries, and
  report-specific aggregates built in core or app code

The important boundary is:

- good adapter methods look like `events()`, `shots()`, `matchLineups()`, `matchSummary()`
- bad adapter methods usually look like `passNetworkData()` or `xgTimelineData()`

## Canonical output requirements

Every adapter output should be:

- **explicitly typed** against Campos schema types;
- **semantically stable** across providers;
- **loss-aware**: preserve raw values or provenance when normalization is approximate;
- **safe by default**: impossible states should be dropped or flagged, not passed through silently.

## Coordinate handling

Adapters must treat coordinate normalization as a two-step concern:

1. parse provider-native coordinate space correctly
2. standardize that space into canonical Campos space

Provider-native parsing and canonical standardization are related, but they are not the same thing.

### Provider coordinate space

Adapters should internally model the source coordinate space explicitly whenever the provider differs materially in extents, origin, axis direction, or units.

Examples:

- StatsBomb: `0..120 x 80..0`, inverted `y`, standardized provider space
- Opta / WhoScored: `0..100 x 0..100`, standardized provider space
- Wyscout: `0..100 x 0..100`, inverted `y`, standardized provider space
- Tracab / SkillCorner / Second Spectrum: centered metric spaces

Adapters should preserve any known pitch dimensions from the source feed or `MatchContext`.

### Campos canonical coordinate space

All spatial event outputs normalize into a single Campos pitch-space:

- origin is the **bottom-left corner** of the full pitch
- `x` runs from `0` to `100` from the team's own goal line to the opposition goal line
- `y` runs from `0` to `100` from the left touchline to the right touchline
- units are canonical football-space units, not screen pixels and not provider-native meters
- this default space is **standardized for visualization**, not guaranteed metric space

Direction fields such as `homeAttacksToward` are defined relative to this Campos coordinate frame, not relative to the final rendered orientation.

Components and renderers should assume coordinates are already in this canonical Campos space.

## Match context

Some providers do not carry enough information on each row to normalize events correctly on their own. Adapters may therefore require a `MatchContext`.

Minimum `MatchContext`:

```ts
type MatchContext = {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  periods?: {
    firstHalf: { homeAttacksToward: "increasing-x" | "decreasing-x" };
    secondHalf: { homeAttacksToward: "increasing-x" | "decreasing-x" };
    extraTimeFirstHalf?: { homeAttacksToward: "increasing-x" | "decreasing-x" };
    extraTimeSecondHalf?: { homeAttacksToward: "increasing-x" | "decreasing-x" };
  } | null;
  pitchDimensions?: {
    length: number;
    width: number;
  } | null;
};
```

`homeAttacksToward: "increasing-x"` means the home team attacks toward higher Campos `x` values (i.e., toward `x = 100`); `"decreasing-x"` means toward lower values (i.e., toward `x = 0`).

### Two-tier context model

Context fields fall into two distinct tiers with different failure behavior:

**Safety-critical context** — `periods` with per-half attacking direction. Required for providers like Opta (F24) where raw coordinates are not normalized to a fixed direction. If missing when the adapter needs it, the adapter must throw with an actionable error. Adapters must never silently guess attacking direction.

**Enrichment metadata** — team names, player names, competition metadata. Optional. When absent, the adapter degrades gracefully: events carry IDs without display names. No error is thrown.

Behavior rules:

1. If provider data already carries reliable period direction, adapters may ignore `periods`.
2. If direction cannot be inferred safely and `MatchContext` is required but missing, the adapter must fail with an actionable error.
3. Adapters must not silently guess attacking direction for production defaults.
4. Enrichment fields (team names, player names, competition info) are always optional and degrade gracefully to ID-only output.

## First-stage adapter products

The current disciplined first-stage surface is:

- **`events()`** — widest canonical event packet
- **`shots()`** — narrower product projection for shot-led UI and analysis
- **`passes()`** — explicit pass projection for pass-led UI and downstream aggregation
- **`matchSummary()`** — narrow scoreline / result / live-status packet for match-page chrome
- **`matchLineups()`** — richer lineup / team-sheet packet where the provider input
  seam honestly supports it
- **`formations()`** — narrower layout-first snapshot convenience surface

This first-stage boundary is one of the main ways Campos intentionally diverges
from `kloppy`: Campos may seek strong parity on these packets, but it does not
inherit `kloppy`'s full product scope or treat every provider/model it supports
as required Campos work.

The next likely missing first-stage packets are things like `touches()` or
`defensiveActions()`, but those should stay derived until repeated use justifies them.

These first-stage packets now cover more of the live chart surface than the
original v0 examples implied:

- **`shots()`** already supports `ShotMap`, `GoalMouthShotChart`, and
  `XGTimeline` where provider xG exists; the same packet also carries
  `endX`/`endY` and goal-mouth fields used by trajectory and finishing views.
- **`passes()`** already supports `PassMap`, `PassFlow`, `PassSonar`, and
  pass-network aggregation in core/app code.
- **`events()`** already supports event-led positional charts such as
  `Heatmap`, `KDE`, and `Territory`; repeated local filters may justify future
  first-stage helpers like `touches()` or `defensiveActions()`, but they are
  not required for the current chart surface.
- **`matchSummary()`** supports scoreline headers, live/result cards, and other
  match-page chrome where the real work is provider-specific status and summary
  normalization rather than chart aggregation.
- **`matchLineups()` / `formations()`** cover the lineup / team-sheet and
  `Formation` families.
- charts such as `PercentileBar`, `PercentilePill`, `RadarChart`,
  `PizzaChart`, `ScatterPlot`, `LineChart`, `BumpChart`, distribution charts,
  and `StatBadge` remain second-stage aggregate consumers, not new adapter
  method candidates.

## Event adapter contract

Adapters currently normalize 13 shipped event kinds: shots, passes, tackles,
cards, interceptions, duels, goalkeeper actions, clearances, substitutions,
fouls, carries, take-ons, and recoveries. The reusable event-family surface now
exposes these canonical packets per provider where the source seam honestly
supports them:

- **`events()`** — loss-aware full normalization; returns all recognized shipped event kinds, silently skips unrecognized ones.
- **`shots()`** — product projection; stricter filtering (drops own goals, penalty shootout events, disallowed goals, events missing coordinates).
- **`passes()`** — product projection for pass-led UI and downstream passing helpers.

### Shot output

Minimum normalized `ShotEvent` output should include the schema-required
baseline fields:

- `id`
- `matchId`
- `teamId`
- `playerId`
- `playerName`
- `minute`
- `addedMinute`
- `second`
- `period`
- `x`, `y` normalized to Campos pitch space
- `xg` when available, otherwise `null`
- `outcome`
- `bodyPart`
- `isOwnGoal`
- `isPenalty`
- `context` such as regular play, fast break, corner, free kick
- `provider`
- `providerEventId`

Recommended / increasingly first-class optional shot fields:

- `endX`, `endY` for shot-end trajectories and endpoint-aware renderers
- `xgot` when the provider exposes post-shot quality
- `goalMouthY`, `goalMouthZ` for goal-mouth / finishing views
- `sourceMeta` for traceability when useful

## Canonical enums

Adapters should normalize to shared Campos enums rather than provider-specific strings.

Minimum `ShotOutcome` enum for v0:

```ts
type ShotOutcome = "goal" | "saved" | "blocked" | "off-target" | "hit-woodwork" | "other";
```

Adapters may keep finer provider detail in `raw` or `sourceMeta`, but the public normalized field should use this enum.

## SourceMeta usage

`sourceMeta` is a provider-scoped provenance and debugging escape hatch, not a
second canonical schema.

Rules:

- keep it provider-specific and JSON-serializable
- do not duplicate canonical top-level fields
- keep raw meanings honest; do not rename provider fields into misleading new semantics
- keep it small; omit empty or no-op metadata
- if a field matters across providers, promote it into the canonical schema instead

See `docs/standards/source-meta-standard.md`.

## Pass-event adapter contract

Minimum normalized `PassEvent` output should include the schema-required
baseline fields:

- `id`
- `matchId`
- `teamId`
- `playerId`
- `playerName`
- `minute`
- `addedMinute`
- `second`
- `period`
- `x`, `y`, `endX`, `endY`
- `length`, `angle`
- `recipient`
- `passType`
- `passResult`
- `isAssist`
- `provider`
- `providerEventId`

Recommended extra fields:

- `sourceMeta`

Provider-specific semantics such as cross / switch / through-ball tags should
stay in `sourceMeta` until Campos promotes them into the canonical `PassEvent`
schema. Do not document fields here that the shipped schema does not actually
export.

## Current packet-to-UI mapping

Use this as the practical sanity check for whether a chart really needs a new
adapter method:

- **`shots()`**: `ShotMap`, `GoalMouthShotChart`, `XGTimeline`
- **`passes()`**: `PassMap`, `PassFlow`, `PassSonar`, pass-network aggregation
- **`events()`**: `Heatmap`, `KDE`, `Territory`, future touch / defensive / goalkeeper subsets
- **`matchLineups()` / `formations()`**: `Formation`, lineup cards, bench/team-sheet UIs
- **aggregate-only second-stage inputs**: `PercentileBar`, `PercentilePill`,
  `RadarChart`, `PizzaChart`, `ScatterPlot`, `LineChart`, `BumpChart`,
  distributions, `StatBadge`

## Adapter behavior rules

1. Parse provider-native coordinate space correctly before standardizing.
2. Normalize to a single canonical Campos coordinate system.
3. Handle period-specific attacking direction where the provider requires it.
4. Normalize labels to Campos enums instead of leaking provider codes.
5. Preserve raw provenance and coordinate-space assumptions for debugging and agent error correction.
6. Surface adapter errors with actionable messages, e.g. missing coordinates, unsupported season format, unknown qualifier combination.

## Public API shape

Supported providers:

- **Opta** (F24 feed) — requires `MatchContext` with period direction for event, shot, and pass normalization; also ships `formations()`, `parseSquads()`, and a narrower kickoff-focused `matchLineups()`
- **StatsBomb** — open and licensed event feeds; current public surface is `events()`, `shots()`, `passes()`, `matchLineups(lineups, events, matchInfo)`, and `formations(lineups, events, matchInfo, side)`
- **WhoScored** — current public surface is `events()`, `shots()`, `passes()`, `formations()`, and the richest shipped `matchLineups()`
- **Wyscout** — current public surface is `events()`, `shots()`, `passes()`, and a narrower `matchLineups(matchData, { players, teams, matchId? })` path grounded in the public dataset rather than claimed official API parity
- **Stats Perform** — reference-backed public surface is `events(ma3Document)`, `shots(ma3Document)`, `passes(ma3Document)`, `matchContext(ma3Document)`, `matchLineups(ma1Document)`, and `formations(ma1Document, side)` from MA1 / MA3 sample seams
- **Impect** — open-data public surface is `events(openDataSlice)`, `shots(openDataSlice)`, `passes(openDataSlice)`, `matchLineups(openDataSlice)`, and `formations(openDataSlice, side)` from the Bundesliga release
- **Sportec** — open-data XML public surface is `events(metaXmlOrMeta, eventXmlOrEvents)`, `shots(metaXmlOrMeta, eventXmlOrEvents)`, `passes(metaXmlOrMeta, eventXmlOrEvents)`, `parseMeta(xml)`, `parseEvents(xml)`, `matchContext(metaXmlOrMeta, eventXmlOrEvents)`, `matchLineups(metaXmlOrMeta)`, and `formations(metaXmlOrMeta, side)` as a narrower real subset rather than full taxonomy parity
- **Understat** — narrow scrape-backed public surface is `matchSummary(scheduleRow)` and `shots(shotRows)` from the `soccerdata` seam
- **FBref** — narrow scrape-backed public surface is `matchSummary(scheduleRow)` from the `soccerdata` schedule seam
- **Sofascore** — narrow scrape-backed public surface is `matchSummary(matchEvent)` from the local `soccerdata` / `ScraperFC` event-status seam

Preferred shape:

```ts
import { fromOpta, fromStatsBomb, fromWhoScored } from "@withqwerty/campos-adapters";

// Loss-aware: all shipped event kinds
const events = fromOpta.events(rawEvents, matchContext);
// Product projection: shots only, stricter filtering
const shots = fromOpta.shots(rawEvents, matchContext);
const passes = fromOpta.passes(rawEvents, matchContext);
const optaLineups = fromOpta.matchLineups(
  { home: homeLineupEvent, away: awayLineupEvent },
  { squads, matchId },
);

const sbEvents = fromStatsBomb.events(rawEvents, matchInfo);
const sbShots = fromStatsBomb.shots(rawEvents, matchInfo);
const sbPasses = fromStatsBomb.passes(rawEvents, matchInfo);
const sbLineups = fromStatsBomb.matchLineups(rawLineups, rawEvents, matchInfo);

const wsPasses = fromWhoScored.passes(matchData, matchInfo);
const wsLineups = fromWhoScored.matchLineups(matchData, matchInfo);
```

Avoid a single generic `normalise(provider, data)` API. Provider-specific entry points make errors, docs, and agent usage clearer.

## Related specs

- `match-lineups-contract.md` defines the richer canonical `MatchLineups` packet and the
  current provider-specific honesty constraints around that surface.
