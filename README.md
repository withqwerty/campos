# Campos

Campos is a React-first TypeScript component library for football visualizations.

Docs and examples: `https://campos.withqwerty.com`

During the beta line, prefer `npm install` when consuming the published packages.
`npm` resolves the live scoped publishes correctly, while some package managers
that rely on npm's abbreviated metadata endpoint can still see temporary `404`
responses on fresh publishes.

The current public package story is:

- `@withqwerty/campos-react` — primary runtime package for chart components and chart-level React APIs
- `@withqwerty/campos-adapters` — provider normalization such as `fromOpta.shots()` and `fromStatsBomb.events()`
- `@withqwerty/campos-schema` — canonical football types and schema helpers
- `@withqwerty/campos-stadia` — pitch and goal primitives for football surfaces
- `@withqwerty/campos-static` — server-side SVG/PNG export for Campos charts

Internal compute/model helpers currently live inside the React package and are publicly importable from `@withqwerty/campos-react` during the beta line as a transitional helper surface.

## Workspace

```text
packages/
  schema/
  adapters/
  stadia/
  react/
  static/
```

## Development

```bash
pnpm install
pnpm generate:schema
pnpm typecheck
pnpm test
pnpm build
```

## Raw Fixture Source

Committed adapter fixtures are anchored to raw Opta event objects.

For local-only reference material, see the gitignored `local/reference/` folder. It contains:

- a raw Opta `match-events` sample copied from the `withqwerty` repo
- Opta and WhoScored event reference docs used during adapter implementation

## Status

Campos is now a multi-package React-first workspace. The primary consumer entry point is `@withqwerty/campos-react`, with adapters, schema, surface primitives, and static export available as companion packages.
