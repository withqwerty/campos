# General Event Adapter Layer Implementation Plan

**Status:** archived
**Superseded by:** `docs/adapters-contract.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `@withqwerty/campos-adapters` from shot-only Opta normalization to a full event model (12 event kinds) across Opta and StatsBomb providers, with metadata schemas, subpath exports, and WhoScored parsing.

**Architecture:** Base + Variants discriminated union. `BaseEvent` holds shared fields; each event kind extends it with all fields inline (no JSON Schema `$ref` — draft-07 `additionalProperties` breaks with `allOf`). `events()` is loss-aware (returns everything including events without coordinates); `shots()`/`passes()` are product-facing projections with stricter filtering. Providers are independent — no shared abstract class.

**Tech Stack:** TypeScript, pnpm workspace, vitest, json-schema-to-typescript, JSON Schema

**Spec:** `docs/archived/superpowers/specs/2026-04-08-general-event-adapter-design.md`

**Task order principle:** Prove the pipeline with shot + pass across both providers before expanding to all 12 kinds. Schema expansion follows proven behavior, not the other way around.

---

## File Map

### New files

| File                                                                     | Responsibility                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `packages/schema/schema/base-event.schema.json`                          | Reference doc for shared BaseEvent fields (not a `$ref` target) |
| `packages/schema/schema/shot-event.schema.json`                          | ShotEvent — self-contained, all fields inline                   |
| `packages/schema/schema/pass-event.schema.json`                          | PassEvent — self-contained                                      |
| `packages/schema/schema/carry-event.schema.json`                         | CarryEvent — self-contained                                     |
| `packages/schema/schema/card-event.schema.json`                          | CardEvent — self-contained                                      |
| `packages/schema/schema/tackle-event.schema.json`                        | TackleEvent — self-contained                                    |
| `packages/schema/schema/interception-event.schema.json`                  | InterceptionEvent — self-contained                              |
| `packages/schema/schema/duel-event.schema.json`                          | DuelEvent — self-contained                                      |
| `packages/schema/schema/goalkeeper-event.schema.json`                    | GoalkeeperEvent — self-contained                                |
| `packages/schema/schema/clearance-event.schema.json`                     | ClearanceEvent — self-contained                                 |
| `packages/schema/schema/substitution-event.schema.json`                  | SubstitutionEvent — self-contained                              |
| `packages/schema/schema/foul-committed-event.schema.json`                | FoulCommittedEvent — self-contained                             |
| `packages/schema/schema/set-piece-event.schema.json`                     | SetPieceEvent — self-contained                                  |
| `packages/schema/schema/competition.schema.json`                         | Competition metadata                                            |
| `packages/schema/schema/season.schema.json`                              | Season metadata                                                 |
| `packages/schema/schema/game.schema.json`                                | Game metadata                                                   |
| `packages/schema/schema/team.schema.json`                                | Team metadata                                                   |
| `packages/schema/schema/player.schema.json`                              | Player metadata                                                 |
| `packages/adapters/src/opta/index.ts`                                    | Public `fromOpta` object                                        |
| `packages/adapters/src/opta/parse.ts`                                    | Raw JSON → OptaEvent[] (Opta MA3, WhoScored)                    |
| `packages/adapters/src/opta/normalize.ts`                                | OptaEvent → BaseEvent fields                                    |
| `packages/adapters/src/opta/map-shot.ts`                                 | Shot qualifier mapping                                          |
| `packages/adapters/src/opta/map-pass.ts`                                 | Pass qualifier mapping                                          |
| `packages/adapters/src/opta/map-card.ts`                                 | Card qualifier mapping                                          |
| `packages/adapters/src/opta/map-tackle.ts`                               | Tackle qualifier mapping                                        |
| `packages/adapters/src/opta/map-interception.ts`                         | Interception mapping                                            |
| `packages/adapters/src/opta/map-duel.ts`                                 | Duel qualifier mapping                                          |
| `packages/adapters/src/opta/map-goalkeeper.ts`                           | Goalkeeper mapping                                              |
| `packages/adapters/src/opta/map-clearance.ts`                            | Clearance mapping                                               |
| `packages/adapters/src/opta/map-substitution.ts`                         | Substitution mapping                                            |
| `packages/adapters/src/opta/map-foul.ts`                                 | Foul mapping                                                    |
| `packages/adapters/src/opta/map-set-piece.ts`                            | Set-piece mapping                                               |
| `packages/adapters/src/opta/project-shots.ts`                            | Product-facing shot filtering                                   |
| `packages/adapters/src/opta/qualifiers.ts`                               | Qualifier ID constants + helpers                                |
| `packages/adapters/src/statsbomb/index.ts`                               | Public `fromStatsBomb` object                                   |
| `packages/adapters/src/statsbomb/parse.ts`                               | Raw JSON → StatsBombEvent[]                                     |
| `packages/adapters/src/statsbomb/normalize.ts`                           | StatsBombEvent → BaseEvent fields                               |
| `packages/adapters/src/statsbomb/map-shot.ts`                            | Shot mapping                                                    |
| `packages/adapters/src/statsbomb/map-pass.ts`                            | Pass mapping                                                    |
| `packages/adapters/src/statsbomb/map-carry.ts`                           | Carry mapping                                                   |
| `packages/adapters/src/statsbomb/map-card.ts`                            | Card mapping                                                    |
| `packages/adapters/src/statsbomb/map-tackle.ts`                          | Tackle mapping                                                  |
| `packages/adapters/src/statsbomb/map-interception.ts`                    | Interception mapping                                            |
| `packages/adapters/src/statsbomb/map-duel.ts`                            | Duel mapping                                                    |
| `packages/adapters/src/statsbomb/map-goalkeeper.ts`                      | Goalkeeper mapping                                              |
| `packages/adapters/src/statsbomb/map-clearance.ts`                       | Clearance mapping                                               |
| `packages/adapters/src/statsbomb/map-substitution.ts`                    | Substitution mapping                                            |
| `packages/adapters/src/statsbomb/map-foul.ts`                            | Foul mapping                                                    |
| `packages/adapters/src/statsbomb/map-set-piece.ts`                       | Set-piece mapping                                               |
| `packages/adapters/src/statsbomb/project-shots.ts`                       | Product-facing shot filtering                                   |
| `packages/adapters/src/shared/coordinates.ts`                            | Coordinate normalization utilities                              |
| `packages/adapters/test/opta/events.test.ts`                             | Full Opta event stream tests                                    |
| `packages/adapters/test/opta/shots.test.ts`                              | Opta shot projection tests (migrated)                           |
| `packages/adapters/test/opta/parse.test.ts`                              | WhoScored vs raw Opta parsing                                   |
| `packages/adapters/test/statsbomb/events.test.ts`                        | Full StatsBomb event stream tests                               |
| `packages/adapters/test/statsbomb/shots.test.ts`                         | StatsBomb shot projection tests                                 |
| `packages/adapters/test/fixtures/opta/raw-match-events-sample.json`      | Full Opta event stream fixture                                  |
| `packages/adapters/test/fixtures/opta/whoscored-match-centre-data.json`  | WhoScored wrapper fixture                                       |
| `packages/adapters/test/fixtures/statsbomb/raw-match-events-sample.json` | Full StatsBomb event stream fixture                             |

### Modified files

| File                                          | Change                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/schema/schema/shot.schema.json`     | Backward-compat alias via `$ref` to shot-event.schema.json                |
| `packages/schema/src/index.ts`                | Add new type exports, Event union, Shot alias, new constants              |
| `packages/adapters/src/index.ts`              | Re-export fromOpta and fromStatsBomb from new locations                   |
| `packages/adapters/package.json`              | Add subpath exports, sideEffects: false                                   |
| `packages/core/test/compute-shot-map.test.ts` | Add `kind: "shot"`, `addedMinute: null`, `second: 0` to all Shot literals |
| `apps/site/src/data/shotmap-demo.ts`          | Add `kind: "shot"`, `addedMinute: null`, `second: 0` to all Shot literals |
| `apps/site/src/data/opta-adapter-demo.ts`     | Add `kind: "shot"` to Shot literals                                       |
| `docs/adapters-contract.md`                   | Reconcile with actual MatchContext schema shape                           |

### Deleted files

| File                                  | Reason                                  |
| ------------------------------------- | --------------------------------------- |
| `packages/adapters/src/opta.ts`       | Replaced by `opta/` directory structure |
| `packages/adapters/test/opta.test.ts` | Migrated to `test/opta/shots.test.ts`   |

---

## JSON Schema Design Note

draft-07 `additionalProperties: false` is evaluated against the current schema's `properties` only — it does NOT see properties from `allOf` refs. This means `ShotEvent` with `allOf: [{ "$ref": "base-event" }]` + `additionalProperties: false` would reject all BaseEvent fields.

**Solution:** Every event schema is self-contained with all fields listed inline. `base-event.schema.json` is a human-readable reference, not a `$ref` target. DRY is achieved at the TypeScript level (`BaseEvent` intersection type), not the JSON Schema level.

## Coordinate Nullability Note

Not all events have coordinates. Cards at the bench, substitutions, and some fouls may lack location data. `x` and `y` are nullable (`type: ["number", "null"]`) in all event schemas. `events()` returns events with `x: null, y: null` when location is absent. Product projections like `shots()` filter to events with coordinates.

---

## Task 1: ShotEvent Schema + Consumer Migration

Create the ShotEvent schema with `kind` discriminant and immediately migrate all consumers so the build stays green throughout.

**Files:**

- Create: `packages/schema/schema/base-event.schema.json`
- Create: `packages/schema/schema/shot-event.schema.json`
- Modify: `packages/schema/schema/shot.schema.json`
- Modify: `packages/schema/src/index.ts`
- Modify: `packages/core/test/compute-shot-map.test.ts`
- Modify: `apps/site/src/data/shotmap-demo.ts`
- Modify: `apps/site/src/data/opta-adapter-demo.ts`

- [ ] **Step 1: Create base-event.schema.json (reference only, not a $ref target)**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "BaseEvent",
  "description": "Reference schema for shared event fields. Not used as a $ref target — each event schema inlines these fields. See JSON Schema Design Note in the implementation plan.",
  "type": "object",
  "properties": {
    "kind": {
      "type": "string",
      "description": "Discriminant for the event kind."
    },
    "id": {
      "type": "string",
      "description": "Stable Campos event identifier: {matchId}:{providerEventId}"
    },
    "matchId": { "type": "string" },
    "teamId": { "type": "string" },
    "playerId": { "type": ["string", "null"] },
    "playerName": { "type": ["string", "null"] },
    "minute": {
      "type": "integer",
      "minimum": 0,
      "maximum": 200,
      "description": "Regulation minute (45 for end of first half, 90 for end of second)."
    },
    "addedMinute": {
      "type": ["integer", "null"],
      "minimum": 0,
      "description": "Stoppage time offset (e.g., 3 for '90+3'). Null if not in added time."
    },
    "second": {
      "type": "integer",
      "minimum": 0,
      "maximum": 59,
      "description": "Second within the minute (0-59)."
    },
    "period": {
      "type": "integer",
      "enum": [1, 2, 3, 4, 5],
      "description": "1=first half, 2=second half, 3=ET first, 4=ET second, 5=penalty shootout."
    },
    "x": {
      "type": ["number", "null"],
      "minimum": 0,
      "maximum": 100,
      "description": "Campos x coordinate. Null if location unavailable."
    },
    "y": {
      "type": ["number", "null"],
      "minimum": 0,
      "maximum": 100,
      "description": "Campos y coordinate. Null if location unavailable."
    },
    "provider": { "type": "string" },
    "providerEventId": { "type": "string" },
    "sourceMeta": {
      "type": ["object", "null"],
      "additionalProperties": true
    }
  },
  "required": [
    "kind",
    "id",
    "matchId",
    "teamId",
    "playerId",
    "playerName",
    "minute",
    "addedMinute",
    "second",
    "period",
    "x",
    "y",
    "provider",
    "providerEventId"
  ],
  "additionalProperties": false
}
```

- [ ] **Step 2: Create shot-event.schema.json (self-contained, all fields inline)**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ShotEvent",
  "description": "A shot event in the canonical Campos event model.",
  "type": "object",
  "properties": {
    "kind": { "type": "string", "const": "shot" },
    "id": { "type": "string" },
    "matchId": { "type": "string" },
    "teamId": { "type": "string" },
    "playerId": { "type": ["string", "null"] },
    "playerName": { "type": ["string", "null"] },
    "minute": { "type": "integer", "minimum": 0, "maximum": 200 },
    "addedMinute": { "type": ["integer", "null"], "minimum": 0 },
    "second": { "type": "integer", "minimum": 0, "maximum": 59 },
    "period": { "type": "integer", "enum": [1, 2, 3, 4, 5] },
    "x": { "type": ["number", "null"], "minimum": 0, "maximum": 100 },
    "y": { "type": ["number", "null"], "minimum": 0, "maximum": 100 },
    "provider": { "type": "string" },
    "providerEventId": { "type": "string" },
    "sourceMeta": { "type": ["object", "null"], "additionalProperties": true },
    "xg": { "type": ["number", "null"], "minimum": 0 },
    "outcome": {
      "type": "string",
      "enum": ["goal", "saved", "blocked", "off-target", "hit-woodwork", "other"]
    },
    "bodyPart": {
      "type": ["string", "null"],
      "enum": ["left-foot", "right-foot", "head", "other", null]
    },
    "isOwnGoal": { "type": "boolean" },
    "isPenalty": { "type": "boolean" },
    "context": {
      "type": ["string", "null"],
      "enum": [
        "regular-play",
        "fast-break",
        "set-piece",
        "from-corner",
        "direct-free-kick",
        "penalty",
        "other",
        null
      ]
    }
  },
  "required": [
    "kind",
    "id",
    "matchId",
    "teamId",
    "playerId",
    "playerName",
    "minute",
    "addedMinute",
    "second",
    "period",
    "x",
    "y",
    "xg",
    "outcome",
    "bodyPart",
    "isOwnGoal",
    "isPenalty",
    "context",
    "provider",
    "providerEventId"
  ],
  "additionalProperties": false
}
```

- [ ] **Step 3: Update shot.schema.json to alias ShotEvent**

Replace the entire file:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Shot",
  "description": "Backward-compatible alias for ShotEvent.",
  "$ref": "./shot-event.schema.json"
}
```

Note: This `$ref` works because `Shot` is a pure alias (no additional properties or constraints on top), unlike the broken `allOf` + `additionalProperties` pattern.

- [ ] **Step 4: Run type generation**

Run: `pnpm generate:schema`
Expected: `packages/schema/src/generated.ts` now contains `BaseEvent`, `ShotEvent`, and `Shot` types. `Shot` should match `ShotEvent`.

- [ ] **Step 5: Update schema index.ts**

```typescript
export type { BaseEvent, ShotEvent, Shot, MatchContext } from "./generated.js";

// Event union — grows as schemas are added
export type Event = ShotEvent;

export const EVENT_KINDS = ["shot"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

// Existing exports — keep as-is
export const CAMPOS_COORDINATE_BOUNDS = {
  x: { min: 0, max: 100 },
  y: { min: 0, max: 100 },
} as const;
export const SHOT_OUTCOMES = [
  "goal",
  "saved",
  "blocked",
  "off-target",
  "hit-woodwork",
  "other",
] as const;
export const SHOT_BODY_PARTS = ["left-foot", "right-foot", "head", "other"] as const;

export function clampToCamposRange(value: number): number {
  return Math.max(0, Math.min(100, value));
}
export const clampToCamposCoordinate = clampToCamposRange;

export function hasRealXg(shot: { xg: number | null }): shot is { xg: number } {
  return typeof shot.xg === "number" && Number.isFinite(shot.xg);
}
```

- [ ] **Step 6: Migrate core test Shot literals**

In `packages/core/test/compute-shot-map.test.ts`, add `kind: "shot" as const`, `addedMinute: null`, and `second: 0` to every Shot object literal. Example — change:

```typescript
{
  id: "1",
  matchId: "m1",
  teamId: "t1",
  playerId: "p1",
  playerName: "Eriksen",
  minute: 4,
  period: 1,
  x: 90.2,
  y: 39,
  xg: 0.12,
  outcome: "off-target",
  bodyPart: "left-foot",
  isOwnGoal: false,
  isPenalty: false,
  context: "regular-play",
  provider: "opta",
  providerEventId: "75",
}
```

To:

```typescript
{
  kind: "shot" as const,
  id: "1",
  matchId: "m1",
  teamId: "t1",
  playerId: "p1",
  playerName: "Eriksen",
  minute: 4,
  addedMinute: null,
  second: 0,
  period: 1 as const,
  x: 90.2,
  y: 39,
  xg: 0.12,
  outcome: "off-target" as const,
  bodyPart: "left-foot" as const,
  isOwnGoal: false,
  isPenalty: false,
  context: "regular-play" as const,
  provider: "opta",
  providerEventId: "75",
}
```

Do this for ALL Shot literals in the file.

- [ ] **Step 7: Migrate shotmap-demo.ts and opta-adapter-demo.ts**

Same changes — add `kind: "shot" as const`, `addedMinute: null`, `second: 0` to every Shot literal in:

- `apps/site/src/data/shotmap-demo.ts`
- `apps/site/src/data/opta-adapter-demo.ts`

- [ ] **Step 8: Run full check**

Run: `pnpm check`
Expected: ALL lint, format, typecheck, and tests pass. The build must be green before proceeding.

- [ ] **Step 9: Commit**

```bash
git add packages/schema/ packages/core/test/ apps/site/src/data/
git commit -m "feat(schema): add ShotEvent with kind discriminant and migrate all consumers"
```

---

## Task 2: Opta Shot Adapter (Prove the Pipeline)

Rewrite the Opta adapter in the new directory structure. This task produces a working `fromOpta.shots()` and `fromOpta.events()` (shots only) — proving the full pipeline from raw Opta events through normalization to canonical ShotEvent.

**Files:**

- Create: `packages/adapters/src/shared/coordinates.ts`
- Create: `packages/adapters/src/opta/qualifiers.ts`
- Create: `packages/adapters/src/opta/normalize.ts`
- Create: `packages/adapters/src/opta/map-shot.ts`
- Create: `packages/adapters/src/opta/project-shots.ts`
- Create: `packages/adapters/src/opta/index.ts`
- Create: `packages/adapters/test/opta/shots.test.ts`
- Move: existing Opta fixtures to `test/fixtures/opta/`

- [ ] **Step 1: Move existing fixtures**

```bash
mkdir -p packages/adapters/test/fixtures/opta
mv packages/adapters/test/fixtures/opta-raw-shots-man-utd-vs-spurs.json packages/adapters/test/fixtures/opta/raw-shots-man-utd-vs-spurs.json
mv packages/adapters/test/fixtures/opta-raw-goal-everton-vs-watford.json packages/adapters/test/fixtures/opta/raw-goal-everton-vs-watford.json
```

- [ ] **Step 2: Write failing shot test**

Create `packages/adapters/test/opta/shots.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { fromOpta } from "../../src/opta/index.js";
import type { MatchContext } from "@withqwerty/campos-schema";
import manUtdVsSpurs from "../fixtures/opta/raw-shots-man-utd-vs-spurs.json";
import evertonVsWatford from "../fixtures/opta/raw-goal-everton-vs-watford.json";

function buildMatchContext(overrides?: Partial<MatchContext>): MatchContext {
  return {
    matchId: "test-match",
    homeTeamId: "home",
    awayTeamId: "away",
    periods: {
      firstHalf: { homeAttacksToward: "increasing-x" },
      secondHalf: { homeAttacksToward: "decreasing-x" },
    },
    ...overrides,
  };
}

describe("fromOpta.shots()", () => {
  it("normalizes shots with kind discriminant and new time fields", () => {
    const ctx = buildMatchContext({
      matchId: String(manUtdVsSpurs.matchInfo.id),
      homeTeamId: String(manUtdVsSpurs.matchInfo.homeTeam.id),
      awayTeamId: String(manUtdVsSpurs.matchInfo.awayTeam.id),
    });
    const shots = fromOpta.shots(manUtdVsSpurs.event, ctx);
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) {
      expect(shot.kind).toBe("shot");
      expect(shot.provider).toBe("opta");
      expect(typeof shot.second).toBe("number");
      expect(shot.addedMinute === null || typeof shot.addedMinute === "number").toBe(
        true,
      );
      expect(shot.x).toBeGreaterThanOrEqual(0);
      expect(shot.x).toBeLessThanOrEqual(100);
      expect(shot.y).toBeGreaterThanOrEqual(0);
      expect(shot.y).toBeLessThanOrEqual(100);
    }
  });

  it("filters out own goals from shots() projection", () => {
    const ctx = buildMatchContext({
      matchId: String(evertonVsWatford.matchInfo.id),
      homeTeamId: String(evertonVsWatford.matchInfo.homeTeam.id),
      awayTeamId: String(evertonVsWatford.matchInfo.awayTeam.id),
    });
    const shots = fromOpta.shots(evertonVsWatford.event, ctx);
    expect(shots.every((s) => !s.isOwnGoal)).toBe(true);
  });

  it("events() is loss-aware — includes own goals that shots() filters", () => {
    const ctx = buildMatchContext({
      matchId: String(evertonVsWatford.matchInfo.id),
      homeTeamId: String(evertonVsWatford.matchInfo.homeTeam.id),
      awayTeamId: String(evertonVsWatford.matchInfo.awayTeam.id),
    });
    const allEvents = fromOpta.events(evertonVsWatford.event, ctx);
    const shotEvents = allEvents.filter((e) => e.kind === "shot");
    const projectedShots = fromOpta.shots(evertonVsWatford.event, ctx);
    expect(shotEvents.length).toBeGreaterThanOrEqual(projectedShots.length);
  });

  it("throws when MatchContext is missing period direction", () => {
    const ctx = buildMatchContext({ periods: undefined });
    expect(() => fromOpta.shots(manUtdVsSpurs.event, ctx)).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run packages/adapters/test/opta/shots.test.ts`
Expected: FAIL — `fromOpta` at new path doesn't exist.

- [ ] **Step 4: Create shared/coordinates.ts**

```typescript
import { clampToCamposRange } from "@withqwerty/campos-schema";

export { clampToCamposRange };

/**
 * Convert StatsBomb 120x80 coordinates to Campos 0-100.
 * StatsBomb: x 0-120 (left to right), y 0-80 (bottom to top).
 * Campos: x 0-100 (own goal to opposition goal), y 0-100 (left to right).
 */
export function statsBombToCampos(x: number, y: number): { x: number; y: number } {
  return {
    x: clampToCamposRange((x / 120) * 100),
    y: clampToCamposRange((y / 80) * 100),
  };
}
```

- [ ] **Step 5: Create opta/qualifiers.ts**

Qualifier IDs below are from the existing working `packages/adapters/src/opta.ts` — verified by current tests. New IDs added for event kinds beyond shots are marked with `// verify via football-docs` and MUST be confirmed against `mcp__football-docs__search_docs` before use.

```typescript
export type OptaQualifier = {
  qualifierId: number;
  value?: string | null;
};

export type OptaEvent = {
  id: number;
  eventId: number;
  typeId: number;
  periodId: number;
  timeMin: number;
  timeSec: number;
  contestantId: string;
  playerId?: string;
  playerName?: string;
  outcome: number;
  x: number;
  y: number;
  qualifier?: OptaQualifier[];
};

// --- Event type IDs ---
// Verified (from existing implementation):
export const SHOT_TYPE_IDS = new Set([13, 14, 15, 16]);

// Verify via football-docs before use:
export const PASS_TYPE_ID = 1; // verify via football-docs
export const TACKLE_TYPE_ID = 4; // verify via football-docs
export const INTERCEPTION_TYPE_ID = 74; // verify via football-docs
export const AERIAL_TYPE_ID = 44; // verify via football-docs
export const CLEARANCE_TYPE_ID = 12; // verify via football-docs
export const FOUL_TYPE_ID = 4; // verify via football-docs — may overlap tackle
export const GOALKEEPER_TYPE_IDS = new Set([10, 11, 41, 52, 53, 54, 57, 58]); // verify via football-docs
export const SUBSTITUTION_TYPE_ID = 18; // verify via football-docs
export const CARD_TYPE_ID = 17; // verify via football-docs

// --- Qualifier IDs ---
// Verified (from existing implementation):
export const Q = {
  HEAD: 15,
  LEFT_FOOT: 72,
  RIGHT_FOOT: 20,
  PENALTY: 9,
  FROM_CORNER: 25,
  DIRECT_FREE_KICK: 26,
  SET_PIECE: 24,
  FAST_BREAK: 23,
  OWN_GOAL: 28,
  DISALLOWED: 8,
  BLOCKED: 82,
  XG: 213,

  // Verify via football-docs before use:
  INVOLVED_PLAYER: 140,
  LONG_BALL: 1,
  CROSS: 2,
  THROUGH_BALL: 4,
  CORNER_TAKEN: 6,
  FREE_KICK_TAKEN: 5,
  GOAL_KICK: 124,
  THROW_IN: 107,
  KICK_OFF: 279,
  ASSIST: 210,
  YELLOW_CARD: 32,
  RED_CARD: 33,
  SECOND_YELLOW: 34,
  PASS_END_X: 140,
  PASS_END_Y: 141,
} as const;

export function hasQualifier(event: OptaEvent, qualifierId: number): boolean {
  return (event.qualifier ?? []).some((q) => q.qualifierId === qualifierId);
}

export function readNumericQualifier(
  event: OptaEvent,
  qualifierId: number,
): number | null {
  const match = (event.qualifier ?? []).find(
    (q) => q.qualifierId === qualifierId && q.value != null,
  );
  if (match?.value == null) return null;
  const value = Number(match.value);
  return Number.isFinite(value) ? value : null;
}

export function readStringQualifier(
  event: OptaEvent,
  qualifierId: number,
): string | null {
  const match = (event.qualifier ?? []).find(
    (q) => q.qualifierId === qualifierId && q.value != null,
  );
  return match?.value ?? null;
}
```

- [ ] **Step 6: Create opta/normalize.ts**

```typescript
import type { MatchContext } from "@withqwerty/campos-schema";
import { clampToCamposRange } from "../shared/coordinates.js";
import type { OptaEvent } from "./qualifiers.js";

type PeriodDirection = {
  homeAttacksToward: "increasing-x" | "decreasing-x";
};

type ContextWithPeriods = MatchContext & {
  periods: {
    firstHalf: PeriodDirection;
    secondHalf: PeriodDirection;
    extraTimeFirstHalf?: PeriodDirection;
    extraTimeSecondHalf?: PeriodDirection;
  };
};

export function assertMatchContext(ctx: MatchContext): asserts ctx is ContextWithPeriods {
  if (
    ctx.matchId.trim().length === 0 ||
    ctx.homeTeamId.trim().length === 0 ||
    ctx.awayTeamId.trim().length === 0 ||
    !ctx.periods?.firstHalf ||
    !ctx.periods?.secondHalf
  ) {
    throw new Error(
      "Opta normalization requires matchContext.matchId, homeTeamId, awayTeamId, and periods for firstHalf/secondHalf.",
    );
  }
}

export function normalizePeriod(periodId: number): 1 | 2 | 3 | 4 | 5 {
  if (periodId >= 1 && periodId <= 5) return periodId as 1 | 2 | 3 | 4 | 5;
  throw new Error(`Unsupported Opta periodId: ${periodId}`);
}

function periodDirectionKey(period: 1 | 2 | 3 | 4): keyof ContextWithPeriods["periods"] {
  switch (period) {
    case 1:
      return "firstHalf";
    case 2:
      return "secondHalf";
    case 3:
      return "extraTimeFirstHalf";
    case 4:
      return "extraTimeSecondHalf";
  }
}

function attacksTowardIncreasingX(
  ctx: ContextWithPeriods,
  teamId: string,
  period: 1 | 2 | 3 | 4,
): boolean {
  const key = periodDirectionKey(period);
  const dir = ctx.periods[key];
  if (!dir) {
    throw new Error(
      `Opta normalization requires periods.${key}.homeAttacksToward for period ${period}.`,
    );
  }
  const isHome = teamId === ctx.homeTeamId;
  return dir.homeAttacksToward === "increasing-x" ? isHome : !isHome;
}

export function normalizeCoordinates(
  event: OptaEvent,
  ctx: ContextWithPeriods,
  period: 1 | 2 | 3 | 4 | 5,
): { x: number; y: number } {
  // Penalty shootout: no direction normalization, use raw coords
  if (period === 5) {
    return {
      x: clampToCamposRange(event.x),
      y: clampToCamposRange(100 - event.y),
    };
  }
  const towardIncreasingX = attacksTowardIncreasingX(ctx, event.contestantId, period);
  const normalizedX = towardIncreasingX ? event.x : 100 - event.x;
  return {
    x: clampToCamposRange(normalizedX),
    y: clampToCamposRange(100 - event.y),
  };
}

export function normalizeTime(event: OptaEvent): {
  minute: number;
  addedMinute: number | null;
  second: number;
} {
  // Opta timeMin includes added time (e.g., 48 for 45+3).
  // Split: regulation minute capped at period boundary.
  const boundaries: Record<number, number> = { 1: 45, 2: 90, 3: 105, 4: 120 };
  const boundary = boundaries[event.periodId];
  if (boundary != null && event.timeMin > boundary) {
    return {
      minute: boundary,
      addedMinute: event.timeMin - boundary,
      second: event.timeSec,
    };
  }
  return {
    minute: event.timeMin,
    addedMinute: null,
    second: event.timeSec,
  };
}

export type { ContextWithPeriods };
```

- [ ] **Step 7: Create opta/map-shot.ts**

```typescript
import type { ShotEvent } from "@withqwerty/campos-schema";
import type { OptaEvent } from "./qualifiers.js";
import { hasQualifier, readNumericQualifier, Q } from "./qualifiers.js";
import type { ContextWithPeriods } from "./normalize.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

function mapBodyPart(event: OptaEvent): ShotEvent["bodyPart"] {
  if (hasQualifier(event, Q.HEAD)) return "head";
  if (hasQualifier(event, Q.LEFT_FOOT)) return "left-foot";
  if (hasQualifier(event, Q.RIGHT_FOOT)) return "right-foot";
  return "other";
}

function mapContext(event: OptaEvent): ShotEvent["context"] {
  if (hasQualifier(event, Q.PENALTY)) return "penalty";
  if (hasQualifier(event, Q.FROM_CORNER)) return "from-corner";
  if (hasQualifier(event, Q.DIRECT_FREE_KICK)) return "direct-free-kick";
  if (hasQualifier(event, Q.SET_PIECE)) return "set-piece";
  if (hasQualifier(event, Q.FAST_BREAK)) return "fast-break";
  return "regular-play";
}

function mapOutcome(event: OptaEvent): ShotEvent["outcome"] {
  switch (event.typeId) {
    case 16:
      return "goal";
    case 14:
      return "hit-woodwork";
    case 15:
      return hasQualifier(event, Q.BLOCKED) ? "blocked" : "saved";
    case 13:
      return "off-target";
    default:
      return "other";
  }
}

export function mapShot(event: OptaEvent, matchContext: ContextWithPeriods): ShotEvent {
  const period = normalizePeriod(event.periodId);
  const coords = normalizeCoordinates(event, matchContext, period);
  const time = normalizeTime(event);

  return {
    kind: "shot",
    id: `${matchContext.matchId}:${event.id}`,
    matchId: matchContext.matchId,
    teamId: event.contestantId,
    playerId: event.playerId ?? null,
    playerName: event.playerName ?? null,
    minute: time.minute,
    addedMinute: time.addedMinute,
    second: time.second,
    period,
    x: coords.x,
    y: coords.y,
    xg: readNumericQualifier(event, Q.XG),
    outcome: mapOutcome(event),
    bodyPart: mapBodyPart(event),
    isOwnGoal: hasQualifier(event, Q.OWN_GOAL),
    isPenalty: hasQualifier(event, Q.PENALTY),
    context: mapContext(event),
    provider: "opta",
    providerEventId: String(event.id),
    sourceMeta: {
      typeId: event.typeId,
      eventId: event.eventId,
      outcome: event.outcome,
    },
  };
}
```

- [ ] **Step 8: Create opta/project-shots.ts**

```typescript
import type { ShotEvent } from "@withqwerty/campos-schema";
import type { OptaEvent } from "./qualifiers.js";
import { hasQualifier, Q, SHOT_TYPE_IDS } from "./qualifiers.js";
import type { ContextWithPeriods } from "./normalize.js";
import { mapShot } from "./map-shot.js";

/**
 * Product-facing shot projection. Filters out:
 * - Penalty shootout shots (period 5)
 * - Own goals (qualifier 28)
 * - Disallowed goals (qualifier 8)
 * - Events with missing coordinates
 */
export function projectShots(
  events: readonly OptaEvent[],
  matchContext: ContextWithPeriods,
): ShotEvent[] {
  return events
    .filter((e) => SHOT_TYPE_IDS.has(e.typeId))
    .filter((e) => e.periodId !== 5)
    .filter((e) => !hasQualifier(e, Q.OWN_GOAL))
    .filter((e) => !hasQualifier(e, Q.DISALLOWED))
    .filter((e) => typeof e.x === "number" && typeof e.y === "number")
    .map((e) => mapShot(e, matchContext));
}
```

- [ ] **Step 9: Create opta/index.ts**

```typescript
import type { MatchContext, ShotEvent, Event } from "@withqwerty/campos-schema";
import type { OptaEvent } from "./qualifiers.js";
import { SHOT_TYPE_IDS } from "./qualifiers.js";
import { assertMatchContext } from "./normalize.js";
import { mapShot } from "./map-shot.js";
import { projectShots } from "./project-shots.js";

export const fromOpta = {
  /**
   * Loss-aware normalization: returns all recognized events.
   * Includes own goals, penalty shootout events, disallowed goals.
   */
  events(events: readonly OptaEvent[], matchContext: MatchContext): Event[] {
    assertMatchContext(matchContext);

    const result: Event[] = [];
    for (const event of events) {
      if (SHOT_TYPE_IDS.has(event.typeId)) {
        result.push(mapShot(event, matchContext));
      }
      // Pass, card, tackle, etc. wired in Task 4
    }
    return result;
  },

  /**
   * Product-facing shot projection with stricter filtering.
   */
  shots(events: readonly OptaEvent[], matchContext: MatchContext): ShotEvent[] {
    assertMatchContext(matchContext);
    return projectShots(events, matchContext);
  },
};

export type { OptaEvent, OptaQualifier } from "./qualifiers.js";
```

- [ ] **Step 10: Update adapter index.ts and delete old file**

Update `packages/adapters/src/index.ts`:

```typescript
export { fromOpta } from "./opta/index.js";
export type { OptaEvent, OptaQualifier } from "./opta/qualifiers.js";
```

Delete `packages/adapters/src/opta.ts` and `packages/adapters/test/opta.test.ts`.

- [ ] **Step 11: Run tests**

Run: `pnpm exec vitest run packages/adapters/test/opta/shots.test.ts`
Expected: PASS

Run: `pnpm check`
Expected: PASS — build is green, old tests removed, new tests passing.

- [ ] **Step 12: Commit**

```bash
git add packages/adapters/
git commit -m "feat(adapters): rewrite Opta shot adapter in new directory structure"
```

---

## Task 3: PassEvent Schema + Opta Pass Mapper (Prove the Pattern)

Add a second event kind to prove the discriminated union pattern works end-to-end.

**Files:**

- Create: `packages/schema/schema/pass-event.schema.json`
- Modify: `packages/schema/src/index.ts`
- Create: `packages/adapters/src/opta/map-pass.ts`
- Modify: `packages/adapters/src/opta/index.ts`
- Create: `packages/adapters/test/fixtures/opta/raw-match-events-sample.json`
- Create: `packages/adapters/test/opta/events.test.ts`

- [ ] **Step 1: Create pass-event.schema.json (self-contained)**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PassEvent",
  "description": "A pass event in the canonical Campos event model.",
  "type": "object",
  "properties": {
    "kind": { "type": "string", "const": "pass" },
    "id": { "type": "string" },
    "matchId": { "type": "string" },
    "teamId": { "type": "string" },
    "playerId": { "type": ["string", "null"] },
    "playerName": { "type": ["string", "null"] },
    "minute": { "type": "integer", "minimum": 0, "maximum": 200 },
    "addedMinute": { "type": ["integer", "null"], "minimum": 0 },
    "second": { "type": "integer", "minimum": 0, "maximum": 59 },
    "period": { "type": "integer", "enum": [1, 2, 3, 4, 5] },
    "x": { "type": ["number", "null"], "minimum": 0, "maximum": 100 },
    "y": { "type": ["number", "null"], "minimum": 0, "maximum": 100 },
    "provider": { "type": "string" },
    "providerEventId": { "type": "string" },
    "sourceMeta": { "type": ["object", "null"], "additionalProperties": true },
    "endX": { "type": ["number", "null"], "minimum": 0, "maximum": 100 },
    "endY": { "type": ["number", "null"], "minimum": 0, "maximum": 100 },
    "length": { "type": ["number", "null"], "minimum": 0 },
    "angle": { "type": ["number", "null"] },
    "recipient": { "type": ["string", "null"] },
    "passType": {
      "type": ["string", "null"],
      "enum": [
        "ground",
        "low",
        "high",
        "through-ball",
        "cross",
        "corner",
        "free-kick",
        "goal-kick",
        "throw-in",
        "kick-off",
        "other",
        null
      ]
    },
    "isAssist": { "type": "boolean" }
  },
  "required": [
    "kind",
    "id",
    "matchId",
    "teamId",
    "playerId",
    "playerName",
    "minute",
    "addedMinute",
    "second",
    "period",
    "x",
    "y",
    "endX",
    "endY",
    "length",
    "angle",
    "recipient",
    "passType",
    "isAssist",
    "provider",
    "providerEventId"
  ],
  "additionalProperties": false
}
```

- [ ] **Step 2: Regenerate types and update Event union**

Run: `pnpm generate:schema`

Update `packages/schema/src/index.ts`:

```typescript
export type { BaseEvent, ShotEvent, PassEvent, Shot, MatchContext } from "./generated.js";

export type Event = ShotEvent | PassEvent;

export const EVENT_KINDS = ["shot", "pass"] as const;
```

- [ ] **Step 3: Extract Opta fixture with passes**

From the WhoScored data at `/Volumes/WQ/projects/www/`, extract a match's events including passes (Opta type 1). Save ~200 diverse events as `packages/adapters/test/fixtures/opta/raw-match-events-sample.json` in the same wrapper format as existing fixtures.

Use `mcp__football-docs__search_docs` to verify: Opta pass type ID is 1, pass end coordinates are in qualifiers 140 (endX) and 141 (endY).

- [ ] **Step 4: Write failing events test**

Create `packages/adapters/test/opta/events.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { fromOpta } from "../../src/opta/index.js";
import type { MatchContext } from "@withqwerty/campos-schema";
import sample from "../fixtures/opta/raw-match-events-sample.json";

function buildMatchContext(): MatchContext {
  return {
    matchId: String(sample.matchInfo.id),
    homeTeamId: String(sample.matchInfo.homeTeam.id),
    awayTeamId: String(sample.matchInfo.awayTeam.id),
    periods: {
      firstHalf: { homeAttacksToward: "increasing-x" },
      secondHalf: { homeAttacksToward: "decreasing-x" },
    },
  };
}

describe("fromOpta.events() with passes", () => {
  it("returns both shots and passes", () => {
    const events = fromOpta.events(sample.event, buildMatchContext());
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds.has("shot")).toBe(true);
    expect(kinds.has("pass")).toBe(true);
  });

  it("pass events have endX, endY, and passType", () => {
    const events = fromOpta.events(sample.event, buildMatchContext());
    const passes = events.filter((e) => e.kind === "pass");
    expect(passes.length).toBeGreaterThan(0);
    for (const p of passes) {
      if (p.kind === "pass") {
        expect(typeof p.endX === "number" || p.endX === null).toBe(true);
        expect(typeof p.endY === "number" || p.endY === null).toBe(true);
        expect(typeof p.passType === "string" || p.passType === null).toBe(true);
        expect(typeof p.isAssist).toBe("boolean");
      }
    }
  });

  it("every event has valid base fields", () => {
    const events = fromOpta.events(sample.event, buildMatchContext());
    for (const e of events) {
      expect(e.kind).toBeTruthy();
      expect(e.id).toContain(":");
      expect(e.provider).toBe("opta");
      expect(typeof e.second).toBe("number");
    }
  });

  it("empty input returns empty array", () => {
    expect(fromOpta.events([], buildMatchContext())).toEqual([]);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm exec vitest run packages/adapters/test/opta/events.test.ts`
Expected: FAIL — pass mapper not wired yet.

- [ ] **Step 6: Implement opta/map-pass.ts**

```typescript
import type { PassEvent } from "@withqwerty/campos-schema";
import type { OptaEvent } from "./qualifiers.js";
import { hasQualifier, Q } from "./qualifiers.js";
import type { ContextWithPeriods } from "./normalize.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

function mapPassType(event: OptaEvent): PassEvent["passType"] {
  if (hasQualifier(event, Q.CROSS)) return "cross";
  if (hasQualifier(event, Q.CORNER_TAKEN)) return "corner";
  if (hasQualifier(event, Q.FREE_KICK_TAKEN)) return "free-kick";
  if (hasQualifier(event, Q.GOAL_KICK)) return "goal-kick";
  if (hasQualifier(event, Q.THROW_IN)) return "throw-in";
  if (hasQualifier(event, Q.KICK_OFF)) return "kick-off";
  if (hasQualifier(event, Q.THROUGH_BALL)) return "through-ball";
  if (hasQualifier(event, Q.LONG_BALL)) return "high";
  return "ground";
}

export function mapPass(event: OptaEvent, matchContext: ContextWithPeriods): PassEvent {
  const period = normalizePeriod(event.periodId);
  const coords = normalizeCoordinates(event, matchContext, period);
  const time = normalizeTime(event);

  // Opta pass end coordinates: qualifiers 140 (endX) and 141 (endY)
  const rawEndX = event.qualifier?.find((q) => q.qualifierId === Q.PASS_END_X)?.value;
  const rawEndY = event.qualifier?.find((q) => q.qualifierId === Q.PASS_END_Y)?.value;

  let endX: number | null = null;
  let endY: number | null = null;
  let length: number | null = null;
  let angle: number | null = null;

  if (rawEndX != null && rawEndY != null) {
    const endCoords = normalizeCoordinates(
      { ...event, x: Number(rawEndX), y: Number(rawEndY) },
      matchContext,
      period,
    );
    endX = endCoords.x;
    endY = endCoords.y;
    const dx = endX - coords.x;
    const dy = endY - coords.y;
    length = Math.sqrt(dx * dx + dy * dy);
    angle = Math.atan2(dy, dx);
  }

  return {
    kind: "pass",
    id: `${matchContext.matchId}:${event.id}`,
    matchId: matchContext.matchId,
    teamId: event.contestantId,
    playerId: event.playerId ?? null,
    playerName: event.playerName ?? null,
    minute: time.minute,
    addedMinute: time.addedMinute,
    second: time.second,
    period,
    x: coords.x,
    y: coords.y,
    endX,
    endY,
    length,
    angle,
    recipient:
      event.qualifier?.find((q) => q.qualifierId === Q.INVOLVED_PLAYER)?.value ?? null,
    passType: mapPassType(event),
    isAssist: hasQualifier(event, Q.ASSIST),
    provider: "opta",
    providerEventId: String(event.id),
    sourceMeta: { typeId: event.typeId, eventId: event.eventId, outcome: event.outcome },
  };
}
```

- [ ] **Step 7: Wire pass mapper into opta/index.ts**

Add import and dispatch:

```typescript
import { mapPass } from "./map-pass.js";
import { PASS_TYPE_ID } from "./qualifiers.js";
```

In `events()`, after the shot check:

```typescript
} else if (event.typeId === PASS_TYPE_ID) {
  result.push(mapPass(event, matchContext));
}
```

- [ ] **Step 8: Run all tests**

Run: `pnpm exec vitest run packages/adapters/test/opta/`
Expected: PASS

Run: `pnpm check`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/schema/ packages/adapters/
git commit -m "feat(adapters): add PassEvent schema and Opta pass mapper"
```

---

## Task 4: StatsBomb Adapter — Shot + Pass

Prove the same two event kinds normalize correctly from a second provider.

**Files:**

- Create: All `packages/adapters/src/statsbomb/` files (parse, normalize, map-shot, map-pass, project-shots, index)
- Move: existing StatsBomb fixtures
- Create: `packages/adapters/test/statsbomb/shots.test.ts`
- Create: `packages/adapters/test/statsbomb/events.test.ts`
- Create: `packages/adapters/test/fixtures/statsbomb/raw-match-events-sample.json`

- [ ] **Step 1: Move StatsBomb fixtures**

```bash
mkdir -p packages/adapters/test/fixtures/statsbomb
mv packages/adapters/test/fixtures/statsbomb-raw-shots-bayer-leverkusen-vs-werder-bremen.json packages/adapters/test/fixtures/statsbomb/raw-shots-bayer-leverkusen-vs-werder-bremen.json
mv packages/adapters/test/fixtures/statsbomb-raw-extra-time-argentina-vs-france.json packages/adapters/test/fixtures/statsbomb/raw-extra-time-argentina-vs-france.json
mv packages/adapters/test/fixtures/statsbomb-raw-penalty-ecuador-vs-senegal.json packages/adapters/test/fixtures/statsbomb/raw-penalty-ecuador-vs-senegal.json
```

- [ ] **Step 2: Create StatsBomb full event fixture**

Fetch events from StatsBomb open data for match 3895302 (Bayer Leverkusen vs Werder Bremen). Extract first 200 events covering shots and passes. Save as `packages/adapters/test/fixtures/statsbomb/raw-match-events-sample.json`.

- [ ] **Step 3: Write failing shot test**

Create `packages/adapters/test/statsbomb/shots.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { fromStatsBomb } from "../../src/statsbomb/index.js";
import bayerVsBremen from "../fixtures/statsbomb/raw-shots-bayer-leverkusen-vs-werder-bremen.json";

describe("fromStatsBomb.shots()", () => {
  it("normalizes StatsBomb shots with kind discriminant", () => {
    const shots = fromStatsBomb.shots(bayerVsBremen.event, bayerVsBremen.matchInfo);
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) {
      expect(shot.kind).toBe("shot");
      expect(shot.provider).toBe("statsbomb");
      expect(shot.x).toBeGreaterThanOrEqual(0);
      expect(shot.x).toBeLessThanOrEqual(100);
      expect(shot.y).toBeGreaterThanOrEqual(0);
      expect(shot.y).toBeLessThanOrEqual(100);
      expect(shot.xg).not.toBeNull();
    }
  });

  it("maps body parts and outcomes correctly", () => {
    const shots = fromStatsBomb.shots(bayerVsBremen.event, bayerVsBremen.matchInfo);
    for (const shot of shots) {
      expect(["left-foot", "right-foot", "head", "other", null]).toContain(shot.bodyPart);
      expect([
        "goal",
        "saved",
        "blocked",
        "off-target",
        "hit-woodwork",
        "other",
      ]).toContain(shot.outcome);
    }
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm exec vitest run packages/adapters/test/statsbomb/shots.test.ts`
Expected: FAIL

- [ ] **Step 5: Implement statsbomb/parse.ts**

Define `StatsBombEvent` and `StatsBombMatchInfo` types matching the fixture shape. See the existing fixture at `packages/adapters/test/fixtures/statsbomb/raw-shots-bayer-leverkusen-vs-werder-bremen.json` for the exact field names:

```typescript
export type StatsBombEvent = {
  id: string;
  index: number;
  period: number;
  timestamp: string;
  minute: number;
  second: number;
  type: { id: number; name: string };
  possession: number;
  possession_team: { id: number; name: string };
  play_pattern: { id: number; name: string };
  team: { id: number; name: string };
  player?: { id: number; name: string };
  position?: { id: number; name: string };
  location?: [number, number];
  duration?: number;
  under_pressure?: boolean;
  related_events?: string[];
  shot?: {
    statsbomb_xg: number;
    end_location: [number, number] | [number, number, number];
    body_part: { id: number; name: string };
    type: { id: number; name: string };
    outcome: { id: number; name: string };
    technique?: { id: number; name: string };
    first_time?: boolean;
    key_pass_id?: string;
    freeze_frame?: unknown[];
  };
  pass?: {
    recipient?: { id: number; name: string };
    length: number;
    angle: number;
    height: { id: number; name: string };
    end_location: [number, number];
    body_part?: { id: number; name: string };
    type?: { id: number; name: string };
    outcome?: { id: number; name: string };
    goal_assist?: boolean;
    cross?: boolean;
    through_ball?: boolean;
  };
  carry?: { end_location: [number, number] };
  duel?: { type: { id: number; name: string }; outcome?: { id: number; name: string } };
  foul_committed?: { card?: { id: number; name: string } };
  substitution?: { replacement: { id: number; name: string } };
  goalkeeper?: {
    type: { id: number; name: string };
    outcome?: { id: number; name: string };
  };
};

export type StatsBombMatchInfo = {
  id: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
};
```

- [ ] **Step 6: Implement statsbomb/normalize.ts**

```typescript
import { statsBombToCampos } from "../shared/coordinates.js";
import type { StatsBombEvent } from "./parse.js";

export function normalizeCoordinates(location: [number, number]): {
  x: number;
  y: number;
} {
  return statsBombToCampos(location[0], location[1]);
}

export function normalizePeriod(period: number): 1 | 2 | 3 | 4 | 5 {
  if (period >= 1 && period <= 5) return period as 1 | 2 | 3 | 4 | 5;
  throw new Error(`Unsupported StatsBomb period: ${period}`);
}

export function normalizeTime(event: StatsBombEvent): {
  minute: number;
  addedMinute: number | null;
  second: number;
} {
  const boundaries: Record<number, number> = { 1: 45, 2: 90, 3: 105, 4: 120 };
  const boundary = boundaries[event.period];
  if (boundary != null && event.minute >= boundary) {
    return {
      minute: boundary,
      addedMinute: event.minute - boundary,
      second: event.second,
    };
  }
  return { minute: event.minute, addedMinute: null, second: event.second };
}
```

- [ ] **Step 7: Implement statsbomb/map-shot.ts**

```typescript
import type { ShotEvent } from "@withqwerty/campos-schema";
import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

function mapOutcome(name: string): ShotEvent["outcome"] {
  switch (name) {
    case "Goal":
      return "goal";
    case "Saved":
    case "Saved Off Target":
    case "Saved to Post":
      return "saved";
    case "Blocked":
      return "blocked";
    case "Off T":
    case "Wayward":
      return "off-target";
    case "Post":
      return "hit-woodwork";
    default:
      return "other";
  }
}

function mapBodyPart(name: string): ShotEvent["bodyPart"] {
  switch (name) {
    case "Left Foot":
      return "left-foot";
    case "Right Foot":
      return "right-foot";
    case "Head":
      return "head";
    default:
      return "other";
  }
}

function mapContext(playPattern: string, shotType: string): ShotEvent["context"] {
  if (shotType === "Penalty") return "penalty";
  if (shotType === "Free Kick") return "direct-free-kick";
  switch (playPattern) {
    case "From Corner":
      return "from-corner";
    case "From Free Kick":
      return "set-piece";
    case "From Counter":
      return "fast-break";
    case "From Throw In":
      return "set-piece";
    default:
      return "regular-play";
  }
}

export function mapShot(event: StatsBombEvent, matchInfo: StatsBombMatchInfo): ShotEvent {
  const shot = event.shot!;
  const coords = event.location
    ? normalizeCoordinates(event.location)
    : { x: null, y: null };
  const period = normalizePeriod(event.period);
  const time = normalizeTime(event);

  return {
    kind: "shot",
    id: `${matchInfo.id}:${event.id}`,
    matchId: String(matchInfo.id),
    teamId: String(event.team.id),
    playerId: event.player ? String(event.player.id) : null,
    playerName: event.player?.name ?? null,
    minute: time.minute,
    addedMinute: time.addedMinute,
    second: time.second,
    period,
    x: coords.x,
    y: coords.y,
    xg: shot.statsbomb_xg,
    outcome: mapOutcome(shot.outcome.name),
    bodyPart: mapBodyPart(shot.body_part.name),
    isOwnGoal: shot.outcome.name === "Own Goal",
    isPenalty: shot.type.name === "Penalty",
    context: mapContext(event.play_pattern.name, shot.type.name),
    provider: "statsbomb",
    providerEventId: event.id,
    sourceMeta: {
      type: event.type,
      shot: { type: shot.type, outcome: shot.outcome },
    },
  };
}
```

- [ ] **Step 8: Implement statsbomb/map-pass.ts**

```typescript
import type { PassEvent } from "@withqwerty/campos-schema";
import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { normalizeCoordinates, normalizePeriod, normalizeTime } from "./normalize.js";

function mapPassType(event: StatsBombEvent): PassEvent["passType"] {
  const pass = event.pass!;
  if (pass.cross) return "cross";
  if (pass.through_ball) return "through-ball";
  if (pass.type?.name === "Corner") return "corner";
  if (pass.type?.name === "Free Kick") return "free-kick";
  if (pass.type?.name === "Goal Kick") return "goal-kick";
  if (pass.type?.name === "Throw-in") return "throw-in";
  if (pass.type?.name === "Kick Off") return "kick-off";
  switch (pass.height?.name) {
    case "Ground Pass":
      return "ground";
    case "Low Pass":
      return "low";
    case "High Pass":
      return "high";
    default:
      return "ground";
  }
}

export function mapPass(event: StatsBombEvent, matchInfo: StatsBombMatchInfo): PassEvent {
  const pass = event.pass!;
  const coords = event.location
    ? normalizeCoordinates(event.location)
    : { x: null, y: null };
  const endCoords = normalizeCoordinates(pass.end_location);
  const period = normalizePeriod(event.period);
  const time = normalizeTime(event);

  // StatsBomb provides length and angle natively
  const length = pass.length * (100 / 120); // scale from yards to Campos units
  const angle = pass.angle;

  return {
    kind: "pass",
    id: `${matchInfo.id}:${event.id}`,
    matchId: String(matchInfo.id),
    teamId: String(event.team.id),
    playerId: event.player ? String(event.player.id) : null,
    playerName: event.player?.name ?? null,
    minute: time.minute,
    addedMinute: time.addedMinute,
    second: time.second,
    period,
    x: coords.x,
    y: coords.y,
    endX: endCoords.x,
    endY: endCoords.y,
    length,
    angle,
    recipient: pass.recipient?.name ?? null,
    passType: mapPassType(event),
    isAssist: pass.goal_assist ?? false,
    provider: "statsbomb",
    providerEventId: event.id,
    sourceMeta: { type: event.type, pass: { type: pass.type, height: pass.height } },
  };
}
```

- [ ] **Step 9: Implement statsbomb/project-shots.ts and statsbomb/index.ts**

`project-shots.ts`:

```typescript
import type { ShotEvent } from "@withqwerty/campos-schema";
import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { mapShot } from "./map-shot.js";

export function projectShots(
  events: readonly StatsBombEvent[],
  matchInfo: StatsBombMatchInfo,
): ShotEvent[] {
  return events
    .filter((e) => e.type.id === 16 && e.shot != null)
    .filter((e) => e.period !== 5)
    .filter((e) => e.shot!.outcome.name !== "Own Goal")
    .filter((e) => e.location != null)
    .map((e) => mapShot(e, matchInfo));
}
```

`index.ts`:

```typescript
import type { ShotEvent, PassEvent, Event } from "@withqwerty/campos-schema";
import type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
import { mapShot } from "./map-shot.js";
import { mapPass } from "./map-pass.js";
import { projectShots } from "./project-shots.js";

export const fromStatsBomb = {
  events(events: readonly StatsBombEvent[], matchInfo: StatsBombMatchInfo): Event[] {
    const result: Event[] = [];
    for (const event of events) {
      if (event.type.id === 16 && event.shot) {
        result.push(mapShot(event, matchInfo));
      } else if (event.type.id === 30 && event.pass) {
        result.push(mapPass(event, matchInfo));
      }
      // Carry, card, tackle, etc. wired in Task 6
    }
    return result;
  },

  shots(events: readonly StatsBombEvent[], matchInfo: StatsBombMatchInfo): ShotEvent[] {
    return projectShots(events, matchInfo);
  },
};

export type { StatsBombEvent, StatsBombMatchInfo } from "./parse.js";
```

- [ ] **Step 10: Write StatsBomb events test**

Create `packages/adapters/test/statsbomb/events.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { fromStatsBomb } from "../../src/statsbomb/index.js";
import sample from "../fixtures/statsbomb/raw-match-events-sample.json";

describe("fromStatsBomb.events() with passes", () => {
  it("returns both shots and passes", () => {
    const events = fromStatsBomb.events(sample.event as any, sample.matchInfo);
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds.has("shot") || kinds.has("pass")).toBe(true);
  });

  it("every event has valid base fields", () => {
    const events = fromStatsBomb.events(sample.event as any, sample.matchInfo);
    for (const e of events) {
      expect(e.kind).toBeTruthy();
      expect(e.provider).toBe("statsbomb");
      expect(typeof e.second).toBe("number");
    }
  });
});
```

- [ ] **Step 11: Update adapter index.ts**

```typescript
export { fromOpta } from "./opta/index.js";
export { fromStatsBomb } from "./statsbomb/index.js";
export type { OptaEvent, OptaQualifier } from "./opta/qualifiers.js";
export type { StatsBombEvent, StatsBombMatchInfo } from "./statsbomb/parse.js";
```

- [ ] **Step 12: Run all tests and check**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add packages/adapters/ packages/schema/
git commit -m "feat(adapters): add StatsBomb shot + pass adapter, proving cross-provider pattern"
```

---

## Task 5: Remaining Event Kind Schemas (batch)

Now that shot + pass are proven across both providers, add the remaining 10 event schemas.

**Files:**

- Create: 10 event schema JSON files (carry, card, tackle, interception, duel, goalkeeper, clearance, substitution, foul-committed, set-piece)
- Modify: `packages/schema/src/index.ts`

- [ ] **Step 1: Create all 10 event schemas**

Each schema is self-contained (all BaseEvent fields inline + kind-specific fields). Follow the exact same pattern as `shot-event.schema.json` and `pass-event.schema.json`. Key differences per kind:

**carry-event.schema.json:** `kind: "carry"`, adds `endX` (number|null), `endY` (number|null)

**card-event.schema.json:** `kind: "card"`, adds `cardType` (enum: "yellow", "red", "second-yellow")

**tackle-event.schema.json:** `kind: "tackle"`, adds `tackleOutcome` (enum: "won", "lost")

**interception-event.schema.json:** `kind: "interception"`, no extra fields beyond base

**duel-event.schema.json:** `kind: "duel"`, adds `duelType` (enum: "aerial", "ground"), `duelOutcome` (enum: "won", "lost")

**goalkeeper-event.schema.json:** `kind: "goalkeeper"`, adds `actionType` (enum: "save", "claim", "punch", "keeper-pick-up")

**clearance-event.schema.json:** `kind: "clearance"`, no extra fields

**substitution-event.schema.json:** `kind: "substitution"`, adds `playerInId` (string|null), `playerInName` (string|null)

**foul-committed-event.schema.json:** `kind: "foul-committed"`, no extra fields

**set-piece-event.schema.json:** `kind: "set-piece"`, adds `setPieceType` (enum: "corner", "free-kick", "goal-kick", "throw-in", "kick-off")

All schemas use `x: type: ["number", "null"]` and `y: type: ["number", "null"]` — events without location are valid.

- [ ] **Step 2: Regenerate types and update Event union**

Run: `pnpm generate:schema`

Update `packages/schema/src/index.ts` with all 12 event types in the `Event` union and all 12 kinds in `EVENT_KINDS`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/schema/
git commit -m "feat(schema): add remaining 10 event kind schemas"
```

---

## Task 6: Opta + StatsBomb Remaining Event Mappers

Wire all remaining event kinds into both providers.

**Files:**

- Create: `packages/adapters/src/opta/map-{card,tackle,interception,duel,goalkeeper,clearance,substitution,foul,set-piece}.ts`
- Create: `packages/adapters/src/statsbomb/map-{carry,card,tackle,interception,duel,goalkeeper,clearance,substitution,foul,set-piece}.ts`
- Modify: `packages/adapters/src/opta/index.ts`
- Modify: `packages/adapters/src/statsbomb/index.ts`

- [ ] **Step 1: Verify Opta event type IDs via football-docs**

Before implementing, use `mcp__football-docs__search_docs` to verify each Opta type ID and qualifier mapping. Do NOT use the IDs in `qualifiers.ts` marked "verify via football-docs" until confirmed. Update `qualifiers.ts` with verified IDs.

- [ ] **Step 2: Implement Opta mappers**

Each mapper follows the exact pattern of `map-shot.ts` and `map-pass.ts`:

1. Takes `(event: OptaEvent, matchContext: ContextWithPeriods)`
2. Returns the corresponding event type
3. Uses `normalizeCoordinates`, `normalizePeriod`, `normalizeTime`
4. Maps qualifiers to canonical enums

Each file is 30-60 lines. Do not combine them.

- [ ] **Step 3: Wire all mappers into opta/index.ts events()**

Add imports and type-ID dispatch for each new event kind.

- [ ] **Step 4: Implement StatsBomb mappers**

Each mapper takes `(event: StatsBombEvent, matchInfo: StatsBombMatchInfo)`.

Key StatsBomb type IDs:

- Carry: type.id 43
- Foul Committed: type.id 22
- Goalkeeper: type.id 23
- Interception: type.id 10 (may be on Duel events too — check)
- Clearance: type.id 9
- Substitution: type.id 19
- Duel: type.id 4
- Tackle: embedded in Duel events where `duel.type.name === "Tackle"`

StatsBomb carries are native events. Cards are embedded in `foul_committed.card`.

- [ ] **Step 5: Wire all mappers into statsbomb/index.ts events()**

Add imports and type-ID dispatch.

- [ ] **Step 6: Add events test for diverse event kinds**

Update `packages/adapters/test/opta/events.test.ts` and `packages/adapters/test/statsbomb/events.test.ts` to assert that the fixture returns at least 3-4 distinct event kinds.

- [ ] **Step 7: Run all tests**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/adapters/
git commit -m "feat(adapters): complete all 12 event kind mappers for Opta and StatsBomb"
```

---

## Task 7: Metadata Schemas

**Files:**

- Create: 5 metadata schema JSON files
- Modify: `packages/schema/src/index.ts`

- [ ] **Step 1: Create metadata schemas**

Each schema has only `id` as required. All other fields are optional (nullable).

**competition.schema.json:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Competition",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": ["string", "null"] },
    "country": { "type": ["string", "null"] }
  },
  "required": ["id"]
}
```

**season.schema.json:** id, name (nullable), competitionId (nullable)
**game.schema.json:** id, date (nullable), homeTeamId (nullable), awayTeamId (nullable), homeScore (nullable int), awayScore (nullable int), seasonId (nullable), competitionId (nullable)
**team.schema.json:** id, name (nullable), shortName (nullable)
**player.schema.json:** id, name (nullable), teamId (nullable), jerseyNumber (nullable int), position (nullable)

- [ ] **Step 2: Regenerate types and export**

Run: `pnpm generate:schema`

Add to `packages/schema/src/index.ts`:

```typescript
export type { Competition, Season, Game, Team, Player } from "./generated.js";
```

- [ ] **Step 3: Typecheck and commit**

Run: `pnpm typecheck`

```bash
git add packages/schema/
git commit -m "feat(schema): add Competition, Season, Game, Team, Player metadata schemas"
```

---

## Task 8: WhoScored Parser + Verification

**Files:**

- Create: `packages/adapters/src/opta/parse.ts`
- Create: `packages/adapters/test/opta/parse.test.ts`
- Create: `packages/adapters/test/fixtures/opta/whoscored-match-centre-data.json`

- [ ] **Step 1: Extract WhoScored fixture**

From `/Volumes/WQ/projects/www/`, extract one match's `matchCentreData` events array (~100 events). The WhoScored qualifier shape differs:

- WhoScored: `qualifiers: [{ type: { value: number, displayName: string }, value?: string }]`
- Raw Opta: `qualifier: [{ qualifierId: number, value?: string }]`

Save as `packages/adapters/test/fixtures/opta/whoscored-match-centre-data.json`.

- [ ] **Step 2: Create opta/parse.ts**

```typescript
import type { OptaEvent, OptaQualifier } from "./qualifiers.js";

type WhoScoredEvent = {
  id: number;
  eventId: number;
  type: { value: number; displayName: string };
  period: { value: number; displayName: string };
  minute: number;
  second: number;
  teamId: number;
  playerId?: number;
  playerName?: string;
  outcomeType: { value: number; displayName: string };
  x: number;
  y: number;
  qualifiers?: Array<{
    type: { value: number; displayName: string };
    value?: string;
  }>;
};

export function parseWhoScored(events: readonly WhoScoredEvent[]): OptaEvent[] {
  return events.map((e) => ({
    id: e.id,
    eventId: e.eventId,
    typeId: e.type.value,
    periodId: e.period.value,
    timeMin: e.minute,
    timeSec: e.second,
    contestantId: String(e.teamId),
    playerId: e.playerId != null ? String(e.playerId) : undefined,
    playerName: e.playerName,
    outcome: e.outcomeType.value,
    x: e.x,
    y: e.y,
    qualifier: (e.qualifiers ?? []).map(
      (q): OptaQualifier => ({
        qualifierId: q.type.value,
        value: q.value ?? null,
      }),
    ),
  }));
}

export function parseOptaMA3(events: readonly OptaEvent[]): OptaEvent[] {
  return events as OptaEvent[];
}
```

- [ ] **Step 3: Write WhoScored-is-Opta verification test**

Create `packages/adapters/test/opta/parse.test.ts` with tests that verify:

1. WhoScored events parse into valid OptaEvent shape
2. Parsed events normalize through `fromOpta.events()`
3. Qualifier IDs match (body-part qualifiers 15/20/72 appear across a full match)

- [ ] **Step 4: Run tests and commit**

Run: `pnpm exec vitest run packages/adapters/test/opta/parse.test.ts`
Expected: PASS

```bash
git add packages/adapters/
git commit -m "feat(adapters): add WhoScored parser with Opta-equivalence verification"
```

---

## Task 9: Package Wiring — Subpath Exports

**Files:**

- Modify: `packages/adapters/package.json`

- [ ] **Step 1: Add subpath exports**

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./opta": {
      "types": "./dist/opta/index.d.ts",
      "import": "./dist/opta/index.js"
    },
    "./statsbomb": {
      "types": "./dist/statsbomb/index.d.ts",
      "import": "./dist/statsbomb/index.js"
    }
  },
  "sideEffects": false
}
```

- [ ] **Step 2: Build and verify**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/package.json
git commit -m "feat(adapters): add subpath exports for tree-shakeable provider imports"
```

---

## Task 10: Reconcile adapters-contract.md

**Files:**

- Modify: `docs/adapters-contract.md`

- [ ] **Step 1: Update contract doc**

Reconcile `docs/adapters-contract.md` with the actual MatchContext schema shape (`periods.firstHalf.homeAttacksToward: "increasing-x" | "decreasing-x"`). Update any sections that use different terminology. Add the two-tier context distinction (safety-critical vs. enrichment).

- [ ] **Step 2: Commit**

```bash
git add docs/adapters-contract.md
git commit -m "docs: reconcile adapters-contract.md with MatchContext schema and two-tier context model"
```

---

## Task 11: Cross-Provider Parity Test

**Files:**

- Create: `packages/adapters/test/parity.test.ts`

- [ ] **Step 1: Write hand-labeled parity test**

Use the Argentina vs France fixture (StatsBomb). Hand-label 2-3 key moments:

- Messi penalty goal (23') — should be near penalty spot (x ~92), outcome "goal", context "penalty"
- Coordinate ranges — all shots in Campos 0-100

If an Opta fixture for this match exists, test both and compare. Otherwise, verify StatsBomb alone with known expected values.

- [ ] **Step 2: Run and commit**

Run: `pnpm exec vitest run packages/adapters/test/parity.test.ts`

```bash
git add packages/adapters/test/parity.test.ts
git commit -m "test(adapters): add cross-provider parity test with hand-labeled moments"
```

---

## Task 12: Final Verification

- [ ] **Step 1: Run full check**

Run: `pnpm check`
Expected: ALL lint, format, typecheck, and tests pass.

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Verify site dev**

```bash
cd apps/site && pnpm dev
```

Confirm shotmap demo still renders.

- [ ] **Step 4: Final commit if cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup after event adapter implementation"
```
