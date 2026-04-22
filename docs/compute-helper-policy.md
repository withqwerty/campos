# Compute Helper Policy

**Status:** active
**Scope:** public stance for chart-level `compute*` helpers and shared math helpers re-exported from `@withqwerty/campos-react`
**Date:** 2026-04-15

## Decision

Campos keeps the current compute/helper exports on the main `@withqwerty/campos-react` barrel during the alpha period.

This is a **transitional public surface**.

- It is publicly importable today.
- It is supported for advanced consumers and internal library composition.
- It is **not** the primary package story or the default authoring path.
- It may still move, narrow, or be reclassified before v1.

## What this means

The default happy path remains component-first:

- use `ShotMap`, `PassMap`, `PassNetwork`, `ScatterPlot`, and the other task-shaped React components first
- use style callbacks and chart props first
- use adapters and schema packages for normalized football data first

The compute/helper exports are available when a consumer genuinely needs:

- pre-render aggregation such as `aggregatePassNetwork(...)`
- shared chart-model preparation such as `computeShotMap(...)`
- shared numeric helpers such as `createLinearScale(...)` or `niceTicks(...)`
- internal or app-level build-time data preparation that would otherwise duplicate shipped Campos logic

## Current import rule

If you use these helpers today, import them from `@withqwerty/campos-react`.

Do not introduce fresh `@withqwerty/campos-core` imports.

## Non-goals of this stance

This decision does **not** mean:

- compute helpers are the main beginner-facing API
- every internal helper should be promoted automatically
- the root barrel should grow without review just because a function is pure
- Campos is committing to long-term v1 stability for every helper name and type as-is

## Packaging rule during alpha

During the alpha period:

- keep the current helper exports on the main `@withqwerty/campos-react` barrel
- do not add a new public subpath just to reshuffle existing helpers
- document helper exports as transitional wherever the package surface is described
- prefer component examples over helper-first examples unless the example is specifically about preprocessing or build-time composition

## Review rule for new helper exports

New helper exports should be added only when at least one of the following is true:

1. A shipped chart or export surface already depends on the helper and external consumers credibly need the same seam.
2. The helper replaces ad hoc duplicated logic in apps/site or active docs/examples.
3. The helper represents a stable data-preparation or numeric-encoding concept rather than chart-local glue.

If none of those are true, keep the helper local.

## Revisit point

Before v1, Campos should make one explicit follow-up decision:

- keep the helper surface as a stable public API
- move it to a documented subpath
- or narrow it to a smaller supported set

Until that decision is made, treat the helper surface as public but transitional.
