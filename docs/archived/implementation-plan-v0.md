# Implementation Plan v0

**Status:** archived
**Superseded by:** `docs/roadmap-v0.2.md` and `docs/status/matrix.md`

## Goal

Ship the first working Campos stack with:

- canonical schema types;
- one production-grade provider adapter path;
- one headless core model for a zero-config primitive;
- one React renderer proof that the contract works;
- tests aligned with the surviving quality bar, scaled to a real first slice.

## Proposed workspace

Use a JS/TS workspace from the start.

```text
packages/
  schema/      shared TS types generated from JSON Schema
  adapters/    provider-specific normalization
  core/        compute models for primitives
  react/       React renderer components
examples/
  react-basic/
```

## Sequence

### Phase 1: workspace and schema

- create workspace tooling
- generate TS types from `schema/*.schema.json`
- establish package boundaries and build/test tooling

### Phase 2: first adapter path

- implement `fromOpta.shots()`
- add fixture-based adapter tests for edge cases
- document supported fields and known omissions
- define and type `MatchContext`

### Phase 3: core ShotMap

- implement `computeShotMap()`
- return semantic regions, not renderer primitives
- encode default layout, legend, stats, scale bar, and empty state
- support explicit non-xG fallback mode

### Phase 4: React ShotMap

- implement `<ShotMap shots={shots} />`
- map core model to SVG + HTML tooltip behavior
- support desktop hover and touch-safe interaction

### Phase 5: docs and agent surface

- JSDoc and examples for all exported APIs
- concise README quick start
- `llms.txt`
- actionable runtime errors

## Explicit v0 scope

v0 ships only:

- `@withqwerty/campos-schema`
- `@withqwerty/campos-adapters` with `fromOpta.shots()`
- `@withqwerty/campos-core` with `computeShotMap()`
- `@withqwerty/campos-react` with `<ShotMap shots={shots} />`

v0 does not promise:

- PassMap or ScatterPlot
- StatsBomb, Wyscout, or FBref adapters
- Python renderer
- docs-site packaging
- agent eval infrastructure beyond basic docs and examples

Those move to v0.2 once the first slice proves the contract.

## Blocking design inputs before Phase 3

These are not optional polish items:

1. region-by-region ShotMap layout spec
2. ShotMap tooltip field spec
3. ShotMap legend grouping spec

Core should not be implemented before those are written down.

These are now tracked in:

- `docs/shotmap-layout-spec.md`
- `docs/shotmap-tooltip-spec.md`
- `docs/shotmap-legend-spec.md`

## Testing layers

### Adapters

- fixture tests per provider
- coordinate and taxonomy normalization tests
- edge cases: own goals, disallowed goals, direction flips, missing qualifiers

### Core

- pure compute tests for region presence, domains, legends, summaries, empty states
- property tests or table-driven tests for scale logic where useful

### React

- rendering smoke tests
- accessibility checks
- interaction tests for tooltip and focus behavior

### Product-level validation

- preserve the intent of the 12-axis quality bar, but scaled to the first slice
- add agent-usage evals in v0.2 once the first primitive is stable

## Immediate deliverables

Before coding starts in earnest, create:

1. workspace scaffold
2. generated TS schema package
3. Opta shot adapter fixtures
4. `computeShotMap()` model types
5. React `ShotMap` rendering spike

## Open choices that can be deferred

- exact Python integration path
- whether Canvas is needed for later high-density components
- docs-site packaging
- exact dependency policy for small math/color utilities

These should not block the first React + core + adapter slice.
