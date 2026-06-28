# @withqwerty/campos-schema

Canonical football entity schemas and generated TypeScript types for Campos.

## Scope

- JSON schemas under `schema/*.schema.json`
- generated TS types under `src/generated.ts`
- shared schema-level helpers in `src/index.ts`

## Second-stage visual contracts

Some schemas describe reusable visual packets that are computed by an
application after provider normalisation, rather than directly emitted by a
provider adapter. `PlayerSurfaceSnapshot` is one of these: it bundles lineups,
average event-touch positions, inferred passing-network geometry, and
evidence-backed role tags while keeping tactical interpretation in the consuming
app. `OptaEventSurface` and `OptaPossessionWindow` are another example: they
package enriched Opta/MA36 event context, provider context tags, and provider
possession windows with source counts and event-value context, without
classifying tactical phases.

## Common Commands

```bash
pnpm --filter @withqwerty/campos-schema generate
pnpm --filter @withqwerty/campos-schema build
```

Update the source schema files first. Do not hand-edit `src/generated.ts`.
