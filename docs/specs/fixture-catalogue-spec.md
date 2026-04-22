# Fixture Catalogue + Extraction Pipeline Spec

**Status:** draft — pending user review
**Target path:** `apps/site/src/data/fixtures/`, `scripts/extract-fixtures/`
**Kind:** Infrastructure — not a new component. Systematizes the fixture supply that every demo and showcase page already depends on.

---

## Why this exists

Every chart demo page and the four showcase pages currently depend on hand-crafted demo data or one-off real-data extracts:

- `opta-fixtures.ts` is the canonical example: 11 Opta endpoints → one curated module feeding match showcase + passnetwork + scatter + radar + pizza.
- Per-chart demo files (`shotmap-demo.ts`, `heatmap-demo.ts`, etc.) are mostly hand-crafted.
- Showcase files (`showcase-saka-progression.ts`, `showcase-garnacho-doku.ts`) are bespoke one-shots.
- Aggregations inside `opta-fixtures.ts` (e.g. `PLAYER_ATTACKING_AGGREGATES`) are hand-computed committed constants.

Meanwhile `/Volumes/WQ/projects/www/src/data/` holds two classes of data, both fully accessible, both unused by Campos fixtures today:

**Class A — raw provider data** (needs adapter transformation):

- `opta/`, `opta-YYYY-YY/` — 11 seasons of PL, six endpoints per match (match-events, match-stats, pass-matrix, expected-goals, possession, commentary). Mirrored to R2 bucket `opta-data`.
- WhoScored events per match (`whoscored-data` R2 bucket, indexed in D1 `ws_match_index`).
- Wyscout open data for 5 top leagues + WC/Euros (`/Volumes/WQ/reep-custom-data/wyscout/`).

**Class B — pre-computed analyses** (already shaped, ready to import):

- `elo/{club}.json` — daily Elo time series per club, back years
- `season-story/{club}.json` — per-club season narrative rollups
- `game-state/{club}.json` — win probability heatmaps per club
- `run-in/{club}.json` — fixture difficulty forecasts
- `season-simulation/data.json` — Monte Carlo season outputs
- `table-possibilities/data.json` — possibility matrix per club (BumpChart-ready)
- `blockbuster-index/data.json`, `pl-meta/*.json` — league-level tables
- `shot-placement/grid.json`, `shot-placement/villa-cumulative.json`
- `prediction-markets/{snapshots,comparison,volume-history}.json`
- `scorigami/data.json`, `scorigami-laliga/data.json`
- `backtest/results.json`, `weather-impact/*.json`, `availability/story-data.json`, `broadcasters/lookup.json`, `betting-agreements/data.json`

Plus the 379 MB `football-entities` D1 for cross-provider ID resolution.

The fixture catalogue + pipeline closes the data-to-fixture gap for both classes. Class A flows through existing adapters (transform + slice); Class B flows through import + shape validation only (no transform needed — the upstream www pipelines already aggregated it).

---

## What this spec is not

- **Not a new component or adapter.** Adapters already exist (`fromOpta.*`, `fromStatsBomb.*`, `fromWhoScored.*`, `fromWyscout.*`). This spec adds a fixture layer _on top_ of them.
- **Not a runtime fetch path.** All fixtures remain committed JSON/TS. Extraction happens at author-time via scripts; outputs are committed and reviewable in PRs.
- **Not a database or service.** No indexing, no querying, no caching. File-based catalogue only.
- **Not a replacement for `opta-fixtures.ts`.** The existing fixture is the reference shape; this spec generalizes it.
- **Not tied to R2.** R2 is the current primary source, but the pipeline accepts any local path (e.g. `/Volumes/WQ/projects/www/src/data/opta/`) so contributors can extract without R2 credentials.

---

## Catalogue structure

```
apps/site/src/data/fixtures/
  index.ts                       — re-exports every fixture by stable key
  README.md                      — what's in the catalogue, how to add, how to regenerate

  matches/
    liv-bou-25-26-gw1.ts         — LIV 4-2 BOU 2025-08-15   (matchId zhs8gg1h...)
    ars-bou-25-26-gw32.ts        — ARS 1-2 BOU 2026-04-11   (matchId 4h2ew9wa...)
    liv-ars-19-20-gw3.ts         — LIV 3-1 ARS 2019-08-24   (matchId 6n4m8v4z...)
    ...

  players/
    saka-25-26.ts                — per-match and per-season filtered events
    palmer-25-26.ts
    ekitike-25-26.ts
    ...

  seasons/
    pl-25-26-standings.ts        — standings snapshots per GW
    pl-25-26-top-performers.ts   — league leaderboards by metric
    pl-25-26-squads.ts           — rosters + minutes
    ...

  comparisons/
    saka-vs-palmer-25-26.ts      — two profiles for radar/pizza/scatter overlay
    ars-vs-liv-25-26.ts          — two teams, match + season
    pl-vs-laliga-wyscout.ts      — cross-league aggregates
    ...

  trends/
    pl-xg-by-season-2015-2026.ts — 11 seasons of aggregate trend
    ars-elo-10y.ts               — daily Elo for one club
    pl-goals-per-match-decade.ts
    ...
```

### Naming conventions

- **Matches:** `{home-code}-{away-code}-{season}-gw{round}.ts`. Season slug is `YY-YY` (e.g. `25-26`). Matchday for league games, `fa{round}`/`ucl{round}` for cups.
- **Players:** `{lastname-lowercase}-{season}.ts`. Disambiguate collisions with first initial (`silva-b-25-26.ts`).
- **Seasons:** `{league-code}-{season}-{slice}.ts` where slice is `standings` / `top-performers` / `squads`.
- **Comparisons:** `{a}-vs-{b}-{season}.ts`.
- **Trends:** `{league-or-entity}-{metric}-{range}.ts`.

### Per-fixture module shape

Every fixture file follows one shape. Keep it boring, mechanical, and review-friendly:

```ts
// Header comment: source paths, extraction date, extraction script command.
/**
 * Liverpool 3-1 Arsenal — Premier League matchday 3, 2019-08-24.
 *
 * Source:
 *   /Volumes/WQ/projects/www/src/data/opta-2019-20/match-events/6n4m8v4zxnycb012fumln13e2.json
 *   /Volumes/WQ/projects/www/src/data/opta-2019-20/match-stats/6n4m8v4zxnycb012fumln13e2.json
 *   /Volumes/WQ/projects/www/src/data/opta-2019-20/pass-matrix/6n4m8v4zxnycb012fumln13e2.json
 *   /Volumes/WQ/projects/www/src/data/opta-2019-20/expected-goals/6n4m8v4zxnycb012fumln13e2.json
 *
 * Generated by: pnpm fixtures:extract match --opta 6n4m8v4zxnycb012fumln13e2
 * Generated at: 2026-04-16T14:22:00Z
 */
import type {
  MatchContext,
  MatchLineups,
  PassEvent,
  ShotEvent,
  // ...
} from "@withqwerty/campos-schema";

export const meta = {
  fixtureKey: "liv-ars-19-20-gw3",
  provider: "opta",
  matchId: "6n4m8v4zxnycb012fumln13e2",
  competition: "Premier League",
  season: "2019/20",
  date: "2019-08-24",
  venue: "Anfield",
  homeTeamId: "c8h9bw1l82s06h77xxrelzhur",
  homeTeam: "Liverpool",
  awayTeamId: "4dsgumo7d4zupm2ugsvm4zm4d",
  awayTeam: "Arsenal",
  homeScore: 3,
  awayScore: 1,
} as const;

export const matchContext: MatchContext = {
  /* ... */
};
export const shots: ShotEvent[] = [
  /* ... */
];
export const passes: PassEvent[] = [
  /* ... */
];
export const lineups: MatchLineups = {
  /* ... */
};
export const passNetwork = {
  /* ... */
};
export const xgTimeline = [
  /* ... */
];
export const possessionWaves = [
  /* ... */
];
export const matchStats = {
  /* ... */
};
export const defensiveActions = [
  /* ... */
];
```

### Invariants

- **Every fixture declares `meta`.** No untagged data. `fixtureKey` is stable across regenerations.
- **All data runs through adapters.** Never hand-convert Opta F24 coordinates; always call `fromOpta.shots()`, `fromOpta.passes()`, etc. Hand-conversion violates `docs/standards/coordinate-invariants.md`.
- **Serializable-only exports.** No callbacks, no Date objects, no `Map`/`Set`. Everything must round-trip through `JSON.stringify`. This closes the W1i/W1j serialization hazard class by construction.
- **No aggregations inside the fixture file.** If a chart needs aggregated data, the aggregation helper lives in `@withqwerty/campos-react` compute layer and runs at page-build time. Fixtures commit raw adapter output; components compute views.
- **Header comment cites source paths and extraction command.** Auditable regeneration.

---

## Extraction pipeline

The pipeline handles both data classes with a shared CLI and serializer, different backends:

```
scripts/extract-fixtures/
  index.ts                  — CLI entry: `pnpm fixtures:extract <kind> [options]`

  # Class A — raw provider data → adapter transform → fixture
  extract-match.ts          — one matchId → one fixtures/matches/*.ts file
  extract-player.ts         — player + season → fixtures/players/*.ts
  extract-season.ts         — league + season → fixtures/seasons/*.ts

  # Class B — pre-computed www analyses → shape-validate → fixture
  extract-www-analysis.ts   — import + validate pre-aggregated www data
                              (elo/, season-story/, game-state/, run-in/,
                               table-possibilities/, blockbuster-index/, etc.)

  # Derived — from existing fixtures only
  extract-comparison.ts     — 2+ fixtures → one comparison fixture
  extract-trend.ts          — N fixtures (or Class-B time series) → trend fixture

  lib/
    load-opta.ts            — reads from R2 or local Opta path
    load-whoscored.ts
    load-wyscout.ts
    load-www-analysis.ts    — reads /Volumes/WQ/projects/www/src/data/{elo,season-story,...}
    resolve-ids.ts          — uses football-entities D1 for cross-provider IDs
    validate-shape.ts       — Zod-style validation for Class-B imports
    serialize.ts            — consistent formatting, header-comment generation
```

For Class A the pipeline transforms (adapters normalize provider data to Campos canonical frame). For Class B the pipeline _validates and re-exports_ — the www data is already in useful shapes; the fixture wraps it with a `meta` block and typed exports so Campos components can consume it safely. No transformation, no re-aggregation.

### CLI surface

```bash
# Match extraction — Opta is primary, but the pipeline accepts any provider.
pnpm fixtures:extract match --opta zhs8gg1hvcuqvhkk2itb54pg
pnpm fixtures:extract match --whoscored 1375966
pnpm fixtures:extract match --opta 6n4m8v4z... --out liv-ars-19-20-gw3

# Player extraction — filters events by playerId across season.
pnpm fixtures:extract player --opta --player saka --season 25-26

# Season extraction — aggregates.
pnpm fixtures:extract season --opta --season 25-26 --slice standings
pnpm fixtures:extract season --opta --season 25-26 --slice top-performers

# Trend extraction — spans multiple seasons.
pnpm fixtures:extract trend --opta --metric xg-per-match --seasons 2015-2026

# Comparison is always derived from existing fixtures — never raw.
pnpm fixtures:extract comparison --a saka-25-26 --b palmer-25-26

# Source override (default: R2; fall back to local /Volumes/WQ if no creds).
pnpm fixtures:extract match --opta <id> --source /Volumes/WQ/projects/www/src/data/opta
```

### Source resolution

```
1. If --source is passed, use that path.
2. Else if CLOUDFLARE_API_TOKEN_R2 is set, fetch from R2 bucket opta-data.
3. Else fall back to /Volumes/WQ/projects/www/src/data/opta* (and opta-YYYY-YY for historical).
4. Error with a clear message if no source is resolvable.
```

This keeps the pipeline usable by contributors without R2 creds, while CI/authoring can go direct to R2.

### Cross-provider ID resolution

`football-entities` D1 holds the cross-provider ID map (Opta ↔ WhoScored ↔ Wyscout ↔ StatsBomb ↔ FotMob ↔ TheSportsDB). `lib/resolve-ids.ts` wraps queries so comparison and trend fixtures can join data from multiple providers by canonical entity, not provider-specific IDs.

---

## Data-category coverage

Each fixture subdirectory aligns to one data category. This is the concrete answer to "what can we prepare for which components":

| Category   | Source endpoints                                                                                                                              | Subdirectory                               | Feeds components                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Match      | Opta: match-events, match-stats, pass-matrix, expected-goals, possession, commentary, lineups. WhoScored: full event stream. Wyscout: events. | `fixtures/matches/`                        | ShotMap, PassMap, PassNetwork, Heatmap, KDE, Territory, Formation, XGTimeline, StatBadge             |
| Player     | Opta match-events filtered by playerId, top-performers, squads                                                                                | `fixtures/players/`                        | ShotMap, PassMap, Heatmap, KDE, RadarChart, PizzaChart, CometChart, Beeswarm, StatBadge              |
| Seasonal   | Opta standings, top-performers, squads; www season-story, blockbuster, elo, table-possibilities                                               | `fixtures/seasons/`                        | BumpChart, ScatterPlot, Distribution, RadarChart, PizzaChart, Small Multiples                        |
| Comparison | Derived from 2+ existing fixtures                                                                                                             | `fixtures/comparisons/`                    | RadarChart (overlay — deferred per W1n), PizzaChart, ScatterPlot (highlight), Beeswarm, Distribution |
| Trend      | Class-B: `elo/`, `season-story/`, `prediction-markets/`. Class-A: multi-season Opta aggregations                                              | `fixtures/trends/`                         | XGTimeline, LineChart, CometChart, BumpChart                                                         |
| Aggregate  | Class-A rollups inline (compute layer); Class-B is already aggregated by the www pipeline                                                     | Inline in fixture or direct Class-B import | Heatmap (bins), KDE, PassNetwork, StatBadge                                                          |

### Class-B quick-wins

Pre-computed www data that slots directly into components with near-zero transformation work:

- `elo/{club}.json` → LineChart, CometChart (per-club Elo trajectory over years)
- `table-possibilities/data.json` → BumpChart (already possibility-matrix shape)
- `game-state/{club}.json` → Heatmap (win-prob heatmap per club)
- `run-in/{club}.json` → LineChart / projections
- `season-simulation/data.json` → DistributionChart / Beeswarm (final-position distribution)
- `blockbuster-index/data.json` → ScatterPlot / BumpChart
- `pl-meta/*.json` → ScatterPlot (header-shots, goal-types by club)
- `prediction-markets/snapshots.json` → LineChart (market-implied probability over time)
- `shot-placement/grid.json` → Heatmap (shot placement xG grid)
- `season-story/{club}.json` → CometChart / XGTimeline (season narrative)

Every one of these is a single-file fixture that needs only `meta` + typed re-export — the cheapest path to filling the demo catalogue.

---

## Seed content — v1 catalogue

Ship the catalogue with enough fixtures that every demo page and showcase can migrate off hand-crafted data. Minimum viable seed:

### Matches (5)

- `liv-bou-25-26-gw1` — LIV 4-2 BOU (already exists as `opta-fixtures.ts`; migrate)
- `ars-bou-25-26-gw32` — ARS 1-2 BOU (recent, in R2)
- `liv-ars-19-20-gw3` — LFC 3-1 ARS (historical, already locally staged)
- One derby (e.g. MAN derby) — for Territory + defensive-action showcase
- One blowout (e.g. 5+ goals) — for XGTimeline stress test

### Players (4)

- `saka-25-26` — winger, progressive passes + shots
- `palmer-25-26` — creator, passes + xA
- `vvd-25-26` — defender, duels + clearances
- `ederson-25-26` — goalkeeper, distribution

### Seasons (1 league × 2 slices)

- `pl-25-26-standings` — GW-by-GW snapshots for BumpChart
- `pl-25-26-top-performers` — every leaderboard for radar/pizza/scatter league context

### Comparisons (2)

- `saka-vs-palmer-25-26` — player overlay (unblocks Radar/Pizza comparison reopen)
- `ars-vs-liv-25-26` — team overlay

### Trends (1)

- `pl-xg-by-season-2015-2026` — 11-season PL trend for LineChart/BumpChart

---

## Exit criteria

- `apps/site/src/data/fixtures/` exists with the v1 seed content above.
- `scripts/extract-fixtures/` CLI works with Opta (R2 and local fallback). WhoScored and Wyscout can land later.
- Every current chart demo page has migrated at least one demo variant to a catalogue fixture (existing hand-crafted demos can remain alongside; migration is additive).
- `opta-fixtures.ts` has moved into `fixtures/matches/liv-bou-25-26-gw1.ts` with a re-export shim at the old path for back-compat.
- `docs/standards/demo-page-standard.md` updated to reference the catalogue as the preferred data source.
- `docs/standards/adapter-gap-matrix.md` cross-referenced so any fixture that hits an unsupported adapter field surfaces as a named gap.
- Regeneration is deterministic: re-running the CLI for an existing fixture produces a byte-identical file (modulo the `Generated at` timestamp, which lives on its own comment line).
- `pnpm check` and site build pass.

---

## Non-goals for v1

- **Not auto-regenerated in CI.** Fixture extraction is an author action. CI verifies fixtures compile and pass tests; it does not re-extract.
- **Not a runtime API.** No `loadFixture("saka-25-26")` at page-run time. Everything is static imports.
- **Not the home for live production data.** Production consumers fetch through their own pipelines. The catalogue exists for demos, showcases, and tests.
- **Not a full adapter-gap closer.** Some provider fields are still unsupported (see `adapter-gap-matrix.md`); fixtures that hit those gaps document the gap rather than hide it.

---

## Follow-ups (not v1)

- WhoScored and Wyscout extractors reaching parity with Opta.
- Cross-provider fixtures (same match via Opta + WhoScored) for adapter-diff testing.
- Test-fixtures subset under `packages/react/test/fixtures/` derived from the same catalogue for snapshot determinism.
- A `fixtures:audit` CLI that walks the catalogue and reports staleness vs. current schema.
- Small Multiples (roadmap v0.3) consumes `fixtures/seasons/pl-25-26-top-performers` directly once its spec closes.
