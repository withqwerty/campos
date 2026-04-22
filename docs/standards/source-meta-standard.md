# SourceMeta Standard

**Status:** active
**Scope:** `sourceMeta` semantics across Campos adapters and schemas
**Purpose:** define the intended shape and usage of `sourceMeta` across Campos adapters and schemas

## Why this exists

`sourceMeta` is useful, but it is easy to abuse.

Without a rule, it drifts into a grab-bag of:

- duplicated canonical fields
- renamed raw fields that accidentally imply new semantics
- bulky quasi-raw payload dumps
- fake cross-provider parity

Campos should treat `sourceMeta` as a narrow, provider-scoped escape hatch, not a second schema.

This also means it is **not** the first-class style injection mechanism for chart rendering.

## Contract

`sourceMeta` is:

- optional
- provider-scoped
- JSON-serializable
- intentionally non-canonical
- primarily for provenance, debugging, and advanced consumers

`sourceMeta` is **not**:

- a place to duplicate top-level normalized fields
- a place to hide raw payload blobs by default
- a place to invent cross-provider semantics that the canonical schema does not own
- a substitute for promoting a real reusable field into the public schema
- a place to store final rendering instructions such as `fill`, `stroke`, `shape`, `dashArray`, or chart presets

## Rules

1. Keep `sourceMeta` provider-specific.
   - Consumers must not assume cross-provider parity inside `sourceMeta`.
   - If a field matters across providers, it should be promoted into the canonical schema instead.

2. Do not duplicate canonical top-level fields.
   - Bad: copying `teamId`, `playerId`, `formation`, `minuteOn`, or `providerEventId` into `sourceMeta`.
   - Good: keeping residual provider fields that do not have a canonical home.

3. Preserve raw meaning honestly.
   - Do not rename a raw field in a way that changes its semantics.
   - If a provider field is really a minute marker, name it like a minute marker.
   - Example: `yellowCardMinute: 92` is honest. `yellowCards: 92` is misleading.

4. Keep it small and useful.
   - Prefer shallow objects with primitives or small arrays.
   - Do not dump full raw provider objects unless there is a specific documented need.
   - Omit empty or all-zero/no-op metadata where it adds no value.

5. Use stable, descriptive, lower-camel-case names.
   - Prefer names that are readable in TypeScript and explicit about units/meaning.
   - When in doubt, include the unit or interpretation in the key.

6. Treat `sourceMeta` as unstable compared with canonical fields.
   - Canonical top-level fields are the contract.
   - `sourceMeta` may grow or narrow provider by provider without implying a breaking canonical change.

7. Do not use `sourceMeta` as the library-level style API.
   - Provider provenance belongs in `sourceMeta`.
   - Style injection belongs in component props and core style/encoding contracts.
   - If a provider field might later drive styling, keep it as honest provider metadata or promote it into the canonical schema; do not convert it into final visual tokens inside `sourceMeta`.

## Examples

### Good

```ts
sourceMeta: {
  shotType: "Open Play",
  technique: "Volley",
  playPattern: "From Counter",
}
```

```ts
sourceMeta: {
  eventId: 10,
  subEventId: 100,
  tags: [1201, 1801],
}
```

```ts
sourceMeta: {
  goals: 2,
  yellowCardMinute: 92,
}
```

### Bad

```ts
sourceMeta: {
  teamId: "1609",
  playerId: "397098",
}
```

```ts
sourceMeta: {
  yellowCards: 92,
}
```

```ts
sourceMeta: rawProviderEvent;
```

```ts
sourceMeta: {
  fill: "#e04162",
  strokeDasharray: "4 3",
}
```

## Practical guidance

When adding a `sourceMeta` field, ask:

1. Is this provider-specific rather than canonical?
2. Is the meaning honest and obvious from the key name?
3. Is the value small enough to keep around by default?
4. Would a consumer be better served by a real top-level field instead?

If the answer to the fourth question is yes, do not add it to `sourceMeta`. Promote it.

Also ask:

5. Am I trying to solve styling rather than provenance?

If yes, this does not belong in `sourceMeta`. Use an app-owned style map or the chart's style injection API instead.

## Consumer escape hatch

Campos does not currently provide an adapter-level callback like `decorate(event)`
or `mapMeta(output)`.

The supported escape hatch is post-processing in consumer code:

```ts
const shots = fromStatsBomb.shots(rawEvents, matchInfo);

const enrichedShots = shots.map((shot) => ({
  ...shot,
  sourceMeta: {
    ...shot.sourceMeta,
    app: {
      possessionId: getPossessionId(shot),
      modelBucket: bucketShot(shot),
    },
  },
}));
```

Guidance:

- best: keep app-specific metadata outside Campos entities in a parallel map keyed by `id`
- good: wrap Campos entities in an app-owned type
- acceptable inline escape hatch: add consumer metadata under a clearly namespaced key such as `sourceMeta.app`

For styling specifically:

- best: keep consumer style intent in a parallel map keyed by canonical entity `id`
- good: pass style intent through a first-class chart-level style/encoding API
- avoid: storing final render tokens under provider-shaped `sourceMeta`

Avoid writing arbitrary app fields at the top level of `sourceMeta`, because that
blurs provider provenance with consumer-owned state.

## Style boundary examples

### Good

```ts
const lineStyleByShotId = {
  "shot-1": { stroke: "#d33" },
  "shot-2": { stroke: "#2563eb", strokeDasharray: "4 3" },
};
```

```ts
<ShotMap
  shots={shots}
  trajectories={{
    encode: {
      stroke: { by: "outcome", map: { goal: "#d33", blocked: "#2563eb" } },
    },
  }}
/>
```

### Bad

```ts
sourceMeta: {
  lineColor: "#d33",
  markerShape: "square",
}
```

## Current promotion assessment

Pressure-testing the current adapter outputs suggests:

- **do not promote** most event-level `sourceMeta` fields right now
  - examples: raw provider `typeId`, `eventId`, `subEventId`, `index`, `tags`,
    `technique`, `cardName`, `playPattern`
  - reason: these are still provider-specific provenance/debug fields rather than
    stable cross-provider football concepts

- **do not promote** raw duplicate state
  - examples: booleans or labels that merely restate canonical `outcome`,
    `cardType`, `setPieceType`, or similar top-level fields

- **possible future promotion area:** lineup/team-sheet player adornments
  - examples: match goals and dismissal/card timing carried today in some provider
    lineup seams
  - reason: these may prove useful across lineup/team-sheet UIs, but should only
    be promoted once at least several providers can support them honestly

Current recommendation:

- keep event-level provenance in `sourceMeta`
- keep lineup/team-sheet adornments in `sourceMeta` for now
- keep style injection out of `sourceMeta`
- revisit promotion only when a field becomes both reusable and credibly
  cross-provider
