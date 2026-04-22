# Contributing to Campos

Thanks for contributing to Campos.

Campos is a React-first football visualization library with a multi-package
workspace:

- `@withqwerty/campos-react` for chart components and export helpers
- `@withqwerty/campos-adapters` for provider normalization
- `@withqwerty/campos-schema` for canonical types and schema helpers
- `@withqwerty/campos-stadia` for pitch and goal primitives
- `@withqwerty/campos-static` for Node-side SVG/PNG export

## Before You Open An Issue

- Use GitHub Discussions for questions, ideas that still need shaping, and
  general usage help.
- Use GitHub Issues for concrete bugs, documentation gaps, and scoped feature
  requests.
- Do not open public issues for security vulnerabilities. Follow
  [`SECURITY.md`](SECURITY.md).

## Development Setup

Campos uses `pnpm` workspaces.

```bash
pnpm install
pnpm generate:schema
pnpm typecheck
pnpm test
pnpm build
```

Useful commands:

```bash
pnpm check
pnpm lint
pnpm format:check
pnpm --filter @withqwerty/campos-site build
```

## Workflow Expectations

- Keep changes scoped. One bug, one feature packet, or one documentation fix is
  easier to review than a mixed batch.
- Update tests and examples when behavior changes.
- Keep public-facing copy suitable for external readers. Comments, docs, issue
  text, and examples are part of the product surface.
- Prefer honest docs over aspirational docs. If a feature is limited, say so
  directly.

## Pull Requests

Before opening a PR, run:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
pnpm format:check
```

If the change touches the docs/demo site, also run:

```bash
pnpm --filter @withqwerty/campos-site build
```

PRs are easiest to review when they include:

- a short problem statement
- the approach you took
- verification steps
- screenshots or SVG output notes when visual behavior changed

## Coding and Documentation Notes

- Do not hand-edit generated schema output. Update the source schema and rerun
  generation.
- Keep chart APIs task-shaped and zero-config friendly.
- Keep adapters provider-specific rather than building generic scaling layers.
- If you touch public docs, prefer relative or GitHub-safe links over local
  filesystem paths.

## Release Notes

User-facing changes should be reflected in [`CHANGELOG.md`](CHANGELOG.md) before
release.
