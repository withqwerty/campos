# Repository Guidelines

This file provides guidance to coding agents (Claude Code, Codex, Cursor, Aider, and similar) working in the public Campos repository.

## What This Repo Is

Campos is a React-first TypeScript component library for football visualisations. This repo is the public package source and the release origin for the npm-published `@withqwerty/campos-*` packages.

Workspace layout:

```
packages/
  schema/    # @withqwerty/campos-schema    — canonical football types
  adapters/  # @withqwerty/campos-adapters  — provider normalisation (Opta, StatsBomb, etc.)
  stadia/    # @withqwerty/campos-stadia    — pitch and goal primitives
  react/     # @withqwerty/campos-react     — React chart components + internal compute layer
  static/    # @withqwerty/campos-static    — Node-side SVG/PNG export
```

The docs/demo site at `https://campos.withqwerty.com` lives in a separate repo and is not part of this workspace. Internal planning docs, experiments, and private status tracking also live elsewhere — this repo carries only what the community needs to read, build, and extend the packages.

## Campos Architecture

Read `docs/architecture-decision.md` first. It is the source of context for the React-first architecture, product principles, and the zero-config `<ShotMap />` spec.

Canonical pitch coordinate frame: attacker-perspective.

- `x: 0..100` from own goal to opposition goal
- `y: 0..100` from attacker's right touchline to attacker's left touchline
- origin at bottom-left

Every event produced by an adapter must already be in this frame. Downstream consumers never flip axes. Visual orientation is controlled exclusively via the `attackingDirection: "up" | "down" | "left" | "right"` prop on `Pitch` and every chart component. Butterfly layouts use `attackingDirection="left"` / `"right"`, not CSS `scaleX(-1)`. See `docs/standards/coordinate-invariants.md` for the full contract and provider-specific notes.

Flag SVGs in `assets/flags/` use FIFA three-letter country codes (`ENG`, `SCO`, `WAL`, `NIR` are distinct football nations — not ISO 3166). Use `getCountryCode()` from `@withqwerty/campos-schema` to resolve provider country names. Add aliases to `packages/schema/src/country.ts` or `packages/schema/src/countryMapping.json`.

Shared design tokens live in `theme/tokens.json` and `theme/tokens_light.json`.

## Build & Test

```bash
pnpm install
pnpm generate:schema     # generate TS types from schema/*.schema.json
pnpm typecheck
pnpm test
pnpm build
```

Schema generation must run before build, test, and typecheck. Root scripts handle this automatically when you use the top-level commands above.

- `pnpm lint` — ESLint with strict TypeScript rules
- `pnpm format:check` — Prettier check
- `pnpm exec vitest run <path>` — single-file test run
- `pnpm exec vitest run -t "<pattern>"` — run tests matching a pattern

Never hand-edit `packages/schema/src/generated.ts`. Update the relevant `schema/*.schema.json` source and rerun `pnpm generate:schema`.

## Core Constraints

- Zero-config defaults must be publishable. `<ShotMap shots={shots} />` with no props should render a good-looking chart with sensible legend, scale, and empty-state behaviour.
- Adapters are per-provider, not generic scalers. Each adapter handles axis inversion, origin placement, attacking direction, and provider version drift.
- The compute/model layer preserves football semantics (e.g. expected-goal regions, possession phases) rather than collapsing into generic plotting primitives.
- Types, JSDoc, error messages, and public docs are part of the API surface. A change to any of them is an API change.

## Docs & Specs

- `docs/README.md` is the authority-ordered index for tracked docs.
- `docs/architecture-decision.md` is required reading before any significant change.
- `docs/roadmap-v0.3.md` is the active roadmap.
- `docs/specs/` contains per-component specs; read the relevant spec before widening a component or adapter surface.
- `docs/standards/` holds coordinate invariants, the component ship checklist, and the adapter gap matrix.
- `docs/testing.md` defines the 12-axis quality bar for new work: empty, sparse, dense, missing fields, extreme values, text edges, responsive, themeable, composable, React hygiene, accessibility, and explicit checklist coverage.

## Testing Standards

Name tests after behaviour, not implementation. Keep edge cases explicit. Translate the 12-axis bar into:

- adapter fixture tests for raw-provider edge cases
- compute-layer tests for semantic output contracts
- React tests for zero-config rendering, interaction, and empty states

For any visual change (component, demo, chart), verify the rendered output in a browser. Passing typecheck and tests is necessary but not sufficient for visual correctness.

## Contributing

- See `CONTRIBUTING.md` for issue and PR conventions.
- See `CODE_OF_CONDUCT.md` for community expectations.
- Report security issues privately per `SECURITY.md` — do not open public issues for vulnerabilities.

## Release & Stage

Campos is currently in alpha. Published packages are tagged both `alpha` and `latest` at `0.1.0-alpha.x`. See `RELEASING.md` for the release flow.

## Commit Style

Scoped, imperative commits:

- `feat(react): add xG scale computation`
- `fix(adapters): handle missing Opta qualifiers`
- `docs: clarify attacking-direction contract`
- `chore(schema): regenerate types`
