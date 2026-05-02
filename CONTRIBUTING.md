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

## How PRs Land

This repo is mirrored from a private monorepo. The export tool wipes the public
tree on each release, so PR commits don't survive a re-export verbatim. The flow
we follow:

1. You open a PR against `withqwerty/campos`.
2. We review and discuss on the PR. If changes are needed, push to your branch
   as normal.
3. Once accepted, a maintainer ports the diff into the source repo, re-exports,
   and the change ships in the next release.
4. The public PR is closed with a link to the release commit and `CHANGELOG.md`
   entry. You're credited there.

Practical implications:

- Your commit SHA won't appear in `main` history on this repo. The release
  commit will reference your PR.
- Don't be surprised if the merged change shows a different author. The
  CHANGELOG entry and release notes are the canonical attribution.
- For larger changes, please open an issue first so we can confirm scope before
  you build — saves a port that might not be wanted.

Filing an issue is also a perfectly good contribution. If you've found a bug or
gap and don't want to write the fix yourself, a clear repro is genuinely useful.

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
