# General Event Adapter Layer — Design Spec

**Status:** archived
**Superseded by:** `docs/adapters-contract.md`

A TS rewrite of kloppy's provider normalization pattern, focused on Opta and StatsBomb, living in `@withqwerty/campos-adapters` with standalone-consumable subpath exports.

## Context

Campos currently normalizes only shot events via `fromOpta.shots()`. The goal is to expand the adapter layer to handle **all event types** (passes, carries, tackles, cards, etc.) across multiple providers, inspired by kloppy's architecture but implemented as idiomatic TypeScript.

Key insight: WhoScored data IS Opta data in a different JSON wrapper. A WhoScored "adapter" is really just a parser that extracts `OptaEvent[]` from the `matchCentreData` envelope, then reuses the full Opta normalization pipeline. This claim is supported by kloppy (which handles WhoScored through its Opta/StatsPerform deserializer) and by the WhoScored scraper in the www project (which uses Opta qualifier constants directly), but must be verified empirically with a parse test comparing WhoScored `matchCentreData` output against raw Opta format for qualifier IDs, event types, and coordinate ranges.

### Why not use kloppy directly?

- Python runtime dependency — adds subprocess or WASM overhead
- No tree-shaking — `import kloppy` pulls everything
- Campos consumers are TS/JS projects — native types and IDE support matter
- We only need 2 providers to start, not kloppy's full 10+

### Why not a separate package?

The adapter code only imports from `@withqwerty/campos-schema` (types). With `"sideEffects": false` and subpath exports, any JS/TS project can import just the Opta adapter without pulling in StatsBomb code or any Campos rendering/core logic. If an independent release cadence is needed later, extracting to a standalone package is a mechanical move (half-day, zero code changes).

## Canonical Event Model

### Approach: Base + Variants (discriminated union)

Shared fields defined once in `BaseEvent`. Each event kind extends it with kind-specific fields. The union `Event = ShotEvent | PassEvent | ...` gives full type narrowing via `event.kind`.

### BaseEvent

```ts
type BaseEvent = {
  kind: EventKind;
  id: string; // "{matchId}:{providerEventId}"
  matchId: string;
  teamId: string;
  playerId: string | null;
  playerName: string | null;
  minute: number; // regulation minute (45 for end of first half, 90 for end of second)
  addedMinute: number | null; // stoppage time offset (e.g., 3 for "90+3"), null if not in added time
  second: number; // 0-59 within the minute
  period: 1 | 2 | 3 | 4 | 5; // 5 = penalty shootout
  x: number; // Campos 0-100 (own goal → opposition goal)
  y: number; // Campos 0-100 (left → right touchline)
  provider: string;
  providerEventId: string;
  sourceMeta?: Record<string, unknown>;
};
```

### Event Kinds

| Kind             | Extra fields                                                        | Notes                                                               |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `shot`           | outcome, xg, bodyPart, isOwnGoal, isPenalty, context                | Extends existing Shot type                                          |
| `pass`           | endX, endY, length, angle, recipient, passType, isAssist            | Core to most analyses                                               |
| `carry`          | endX, endY                                                          | StatsBomb-native; Opta adapter omits (no carry events in Opta feed) |
| `card`           | cardType (yellow / red / second-yellow)                             | Simple                                                              |
| `tackle`         | outcome (won / lost)                                                |                                                                     |
| `interception`   | (none beyond base)                                                  |                                                                     |
| `duel`           | duelType (aerial / ground), outcome                                 |                                                                     |
| `goalkeeper`     | actionType (save / claim / punch / keeper-pick-up)                  |                                                                     |
| `clearance`      | (none beyond base)                                                  |                                                                     |
| `substitution`   | playerInId, playerInName                                            |                                                                     |
| `foul-committed` | (none beyond base)                                                  |                                                                     |
| `set-piece`      | setPieceType (corner / free-kick / goal-kick / throw-in / kick-off) |                                                                     |

### Migration

The existing `Shot` type gains a required `kind: "shot"` discriminant field, becoming `ShotEvent`. This is a breaking schema change. Existing consumers that construct `Shot` objects — test fixtures in `packages/core/test/`, demo data in `apps/site/src/data/`, and the core ShotMap computation — must be updated to include `kind: "shot"`. `type Shot = ShotEvent` remains as a convenience alias, but all literal Shot objects need the new field.

The existing Opta adapter is replaced wholesale (not wrapped). No backward-compatibility shims.

## Metadata Schemas

Inspired by socceraction's metadata hierarchy, but with a critical difference: **all levels are independent**. No schema requires another to be present.

### Two Tiers of Context

Not all context is equal. The adapter distinguishes:

**Safety-critical context (hard requirement, throws if missing):**
MatchContext with period direction remains mandatory for providers like Opta where coordinates cannot be normalized without knowing attacking direction. This preserves the contract in `docs/adapters-contract.md`: adapters must NOT silently guess attacking direction. If direction can't be inferred safely, the adapter fails with an actionable error.

**Enrichment metadata (optional, degrades gracefully):**
Teams, players, competitions, seasons — these enrich events but are never required for correct normalization. Missing enrichment means IDs without names, not wrong coordinates.

### Schema Types

| Schema        | Key fields                                                       | Notes                                           |
| ------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| `Competition` | id, name, country                                                | Enrichment — not needed to normalize events     |
| `Season`      | id, name, competitionId                                          | Enrichment — links to Competition if available  |
| `Game`        | id, date, homeTeamId, awayTeamId, score, seasonId, competitionId | Enrichment — match-level context                |
| `Team`        | id, name, shortName                                              | Enrichment — resolves teamId → name on events   |
| `Player`      | id, name, teamId, jerseyNumber, position                         | Enrichment — resolves playerId → name on events |

### Independence Principle

Each metadata level works standalone. Enrichment metadata is never required — but safety-critical context (like MatchContext for Opta) still throws when missing.

```ts
// Events with required MatchContext — works, throws if context is insufficient
const events = fromOpta.events(rawEvents, matchContext);

// Just teams — works fine
const teams = fromOpta.teams(rawTeamData);

// Just players from a game — works fine
const players = fromOpta.players(rawPlayerData);

// Events + enrichment — adapter cross-references
// (e.g., resolve teamId → teamName, playerId → jerseyNumber)
const events = fromOpta.events(rawEvents, matchContext, { teams, players });
```

The third argument is an optional enrichment bag. If provided, the adapter attaches resolved names/metadata to events. If not, events still normalize correctly — they just have IDs without names where the raw data doesn't include them.

### Bundled vs. Separate Feeds

Some sources bundle everything together (WhoScored's `matchCentreData` includes events, teams, and players in one blob; StatsBomb open data has lineups alongside events). Others arrive as separate feeds (Opta F24 for events, F1/F40 for lineups).

For bundled sources, `parse.ts` extracts events AND metadata in one pass — the user does not need to call `teams()` and `players()` separately then pass them back in. The enrichment bag exists for separate-feed scenarios where metadata genuinely arrives independently.

## Provider Adapter Structure

### Public API

```ts
import { fromOpta, fromStatsBomb } from "@withqwerty/campos-adapters";

// Full event stream
const events = fromOpta.events(rawEvents, matchContext);

// Product-facing projections (filter + product-specific semantics)
const shots = fromOpta.shots(rawEvents, matchContext);
const passes = fromOpta.passes(rawEvents, matchContext);

// Metadata normalization (independent of events)
const teams = fromOpta.teams(rawTeamData);
const players = fromOpta.players(rawPlayerData);
const competitions = fromOpta.competitions(rawCompData);
```

### Two Layers: events() vs. shots()/passes()

`events()` is the **loss-aware normalization layer**. It returns all normalized events from the provider stream — including own goals, penalty shootout shots, disallowed goals. Every valid provider event becomes a canonical event.

`shots()`, `passes()`, etc. are **product-facing projections**. They apply stricter filtering appropriate for their consumer (typically a renderer or analyst). For example, `fromOpta.shots()` filters out:

- Penalty shootout shots (period 5)
- Own goals (qualifier 28)
- Disallowed goals (qualifier 8)
- Events with missing coordinates

These are product decisions, not kind selection. A `ShotEvent` from `events()` may include an own goal; a `Shot` from `shots()` will not. Each projection method owns its own filtering semantics — it is not simply `events().filter(e => e.kind === "shot")`.

### Internal File Organization

```
packages/adapters/src/
  opta/
    index.ts          — public fromOpta object
    parse.ts          — raw JSON variants → OptaEvent[] (handles WhoScored wrapper, MA3 JSON)
    normalize.ts      — OptaEvent → BaseEvent fields (coords, period, identity)
    map-shot.ts       — shot qualifier mapping
    map-pass.ts       — pass qualifier mapping
    map-card.ts       — etc. (one file per event kind)
    project-shots.ts  — product-facing shot filtering (own goals, shootout, disallowed, etc.)
    qualifiers.ts     — qualifier ID constants + helpers
  statsbomb/
    index.ts          — public fromStatsBomb object
    parse.ts          — raw JSON → StatsBombEvent[]
    normalize.ts      — StatsBombEvent → BaseEvent fields
    map-shot.ts       — shot-specific mapping
    project-shots.ts  — product-facing shot filtering
    map-pass.ts       — etc.
  shared/
    coordinates.ts    — clampToCamposRange, normalization utilities
  index.ts            — re-exports fromOpta, fromStatsBomb
```

### Design Principles

- **One file per event-kind mapper** — independently testable, avoids 1000+ line files
- **`parse.ts` handles format variants** — WhoScored `matchCentreData` vs raw Opta JSON share all downstream logic
- **`project-*.ts` files own product filtering** — `shots()` is not a thin filter over `events()`; each projection has its own semantics
- **`shared/` stays minimal** — coordinate utilities and type re-exports only, no base adapter class or provider registry
- **Each provider is independent** — no shared abstract class, no forced inheritance between Opta and StatsBomb

## Schema Changes

### New JSON Schemas

**Event schemas:**

- `schema/base-event.schema.json` — shared BaseEvent fields
- `schema/shot-event.schema.json` — ShotEvent (replaces shot.schema.json)
- `schema/pass-event.schema.json` — PassEvent
- One schema per additional event kind
- Existing `shot.schema.json` becomes a backward-compat alias via `$ref`

**Metadata schemas:**

- `schema/competition.schema.json` — Competition
- `schema/season.schema.json` — Season
- `schema/game.schema.json` — Game
- `schema/team.schema.json` — Team
- `schema/player.schema.json` — Player

All metadata schemas have only `id` as required. Other fields are optional — adapters populate what the raw data provides.

### Type Generation

`pnpm generate:schema` continues to produce `packages/schema/src/generated.ts` with all types. The `Shot` alias is added to `packages/schema/src/index.ts`.

## Subpath Exports

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./opta": "./dist/opta/index.js",
    "./statsbomb": "./dist/statsbomb/index.js"
  },
  "sideEffects": false
}
```

External consumers get tree-shakeable per-provider imports. Canonical types come from `@withqwerty/campos-schema`, not from the adapters package — one public door to types avoids version-skew confusion.

```ts
import { fromOpta } from "@withqwerty/campos-adapters/opta";
import type { ShotEvent, PassEvent } from "@withqwerty/campos-schema";
```

## Testing Strategy

### Fixture-Based Tests

Real event data as JSON fixtures. Existing fixtures:

- Opta: `opta-raw-shots-man-utd-vs-spurs.json`, `opta-raw-goal-everton-vs-watford.json`
- StatsBomb: `statsbomb-raw-shots-bayer-leverkusen-vs-werder-bremen.json`, `statsbomb-raw-extra-time-argentina-vs-france.json`, `statsbomb-raw-penalty-ecuador-vs-senegal.json`

New fixtures needed:

- Full event stream samples (all event types) for both providers
- WhoScored `matchCentreData` wrapper sample (from `/Volumes/WQ/projects/www/`)

### Test Organization

```
packages/adapters/test/
  opta/
    shots.test.ts        — migrated from current opta.test.ts
    passes.test.ts
    cards.test.ts
    events.test.ts       — full stream normalization
    parse.test.ts        — WhoScored vs raw Opta format
  statsbomb/
    shots.test.ts
    passes.test.ts
    events.test.ts
  fixtures/
    opta/     — existing + new full-stream fixtures
    statsbomb/ — existing + new full-stream fixtures
```

### Quality Axes (from 12-axis bar)

| Axis                  | Applied to adapters                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Empty                 | No events → empty array, no throw                                                                                      |
| Sparse                | Single event of each kind normalizes correctly                                                                         |
| Missing fields        | Null/undefined qualifiers → null fields, not crashes                                                                   |
| Extreme               | Coordinates outside 0-100 clamped, xG > 1.0 preserved                                                                  |
| Per-kind correctness  | Each kind: right fields, right outcome/type mapped                                                                     |
| Cross-provider parity | Same match from both providers → structurally equivalent output                                                        |
| Parse variants        | WhoScored wrapper vs raw Opta → same normalized output                                                                 |
| WhoScored-is-Opta     | Verify qualifier IDs, event types, and coordinate ranges match between WhoScored `matchCentreData` and raw Opta format |

### Cross-Provider Parity

Parity tests verify that both adapters produce structurally equivalent output for the same real-world moments. Since event IDs are provider-specific, automatic alignment is not feasible. Instead, use **hand-labeled moment alignment**: pick 2-3 key moments in a shared fixture (e.g., "Messi's goal at 73'") and assert that both adapters produce matching event kind, coordinates (within tolerance), and outcome for each labeled moment. This is manual but sufficient to prove the architecture — and more honest than claiming full algorithmic matching.

## Providers: v1 Scope

### Opta (covers WhoScored)

- All 12 event kinds mapped from Opta event type IDs and qualifiers
- WhoScored `matchCentreData` parsing via `parse.ts`
- Coordinate normalization using period direction from MatchContext
- Qualifier mappings documented in kloppy's StatsPerform deserializer

### StatsBomb

- All 12 event kinds mapped from StatsBomb event types
- StatsBomb provides carries natively (Opta does not)
- StatsBomb uses 120x80 yard coordinates → normalize to Campos 0-100
- StatsBomb freeze frames deferred (available but not part of BaseEvent)

### Future Providers (not in scope)

Wyscout, Second Spectrum, SkillCorner, Metrica — same pattern, new `parse.ts` + `normalize.ts` + mappers.
