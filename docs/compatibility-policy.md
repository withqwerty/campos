# Compatibility Policy

**Status:** active
**Scope:** alpha compatibility and deprecation posture for Campos package surfaces
**Date:** 2026-04-15

## Current posture

Campos is still in **moving-alpha mode**.

There is no active v1 freeze yet.

The goal in this phase is to stabilize the package story and the main component vocabulary without pretending every exported type and helper is already locked.

## What is relatively stable

These surfaces are the strongest current bets and should change cautiously:

- the multi-package consumer story
  - `@withqwerty/campos-react`
  - `@withqwerty/campos-adapters`
  - `@withqwerty/campos-schema`
  - `@withqwerty/campos-stadia`
  - `@withqwerty/campos-static`
- task-shaped component names such as `ShotMap`, `PassMap`, `PassNetwork`, `ScatterPlot`, `Heatmap`, `Formation`, `RadarChart`, and `PizzaChart`
- the callback-first style vocabulary direction (`markers`, `lines`, `areas`, `guides`, `labels`, `badges`)
- adapter ownership boundaries
  - adapters normalize provider data
  - components render chart/report surfaces
  - second-stage analytical products do not automatically belong in adapters

These are not frozen v1 guarantees, but breaking them should require an explicit tracked decision.

## What is still transitional

These surfaces remain intentionally movable during alpha:

- chart prop details beyond the main family vocabulary
- helper/export typing details for `ExportFrameSpec`
- the public scope of compute/model helpers re-exported from `@withqwerty/campos-react`
- edge-case export parity for advanced render branches
- exact provider completeness for adapter methods whose underlying sources still vary by provider

See:

- [compute-helper-policy.md](https://github.com/withqwerty/campos/blob/main/docs/compute-helper-policy.md)
- [core-package-policy.md](https://github.com/withqwerty/campos/blob/main/docs/core-package-policy.md)
- [specs/export-style-parity-spec.md](https://github.com/withqwerty/campos/blob/main/docs/specs/export-style-parity-spec.md)

## Alpha deprecation rule

Breaking changes are allowed between alpha releases, but they should not land casually.

When a change affects an active public surface, do all of the following:

1. Update the active docs in `docs/` so the new behavior is the clear source of truth.
2. Update demo pages and package READMEs if the old behavior was shown there.
3. Record the change in `docs/status/matrix.md` if it affects tracked delivery or package posture.
4. Add a migration note when the change affects:
   - top-level package imports
   - widely used component props
   - adapter method names
   - the `ExportFrameSpec` contract

## Surface-by-surface posture

### Components

- Component names and zero-config responsibilities should be treated as sticky.
- Prop details may still change during alpha when they simplify the library or remove a known wrong turn.
- Removed props do not require a long grace period in alpha, but active docs/examples must be updated in the same wave.

### Style props

- The callback-first family vocabulary is the intended direction.
- Reintroducing chart-local shorthand prop systems should be treated as a regression.
- Fine-grained style prop details can still change while the family model settles.

### Adapters

- Adapters are active and supported.
- Public adapter method names should change more cautiously than experimental chart internals.
- Provider coverage and richness can improve without implying strict cross-provider parity.

### Compute helpers

- The current helper surface is public but transitional.
- It is supported for advanced use during alpha.
- It may still move to a smaller supported set or a different packaging story before v1.

### Export contract

- `ExportFrameSpec` is versioned and should stay explicit about supported chart kinds and unsupported branches.
- The stable contract is still alpha-era and may tighten.
- If the export schema changes incompatibly, the versioned contract and active docs must change together.

## v1 trigger

Campos should only claim a v1 compatibility target once all of the following are true:

1. the package story is no longer under active structural debate
2. the compute-helper stance is no longer transitional
3. the export contract is typed and enforced consistently with the docs
4. the next roadmap slice has landed without reopening the architecture reset

Until then, plan and communicate as alpha.
