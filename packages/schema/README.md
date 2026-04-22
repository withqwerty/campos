# @withqwerty/campos-schema

Canonical football entity schemas and generated TypeScript types for Campos.

## Scope

- JSON schemas under `schema/*.schema.json`
- generated TS types under `src/generated.ts`
- shared schema-level helpers in `src/index.ts`

## Common Commands

```bash
pnpm --filter @withqwerty/campos-schema generate
pnpm --filter @withqwerty/campos-schema build
```

Update the source schema files first. Do not hand-edit `src/generated.ts`.
