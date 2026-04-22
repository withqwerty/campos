# Legacy Core Package Policy

**Status:** active
**Scope:** fate of the historical `@withqwerty/campos-core` package name and migration guidance for old imports
**Date:** 2026-04-15

## Decision

`@withqwerty/campos-core` is a retired package name.

It is not an active workspace package, it is not part of the current publish plan, and Campos should not describe it as a live consumer surface in active docs.

The package name remains reserved during the alpha period so it does not get silently reused with a different meaning.

## Current stance

- Old imports from `@withqwerty/campos-core` are unsupported.
- Campos does not promise compatibility for historical examples, unpublished branches, or pre-R1 experiments that imported from `@withqwerty/campos-core`.
- New docs, examples, and implementation work should not introduce fresh `@withqwerty/campos-core` imports.

## Migration guidance

When updating old code or stale docs:

- import chart components from `@withqwerty/campos-react`
- import current transitional `compute*` helpers and shared math helpers from `@withqwerty/campos-react`
- import provider normalization from `@withqwerty/campos-adapters`
- import canonical schema types from `@withqwerty/campos-schema`

The current shared compute/helper code lives in `packages/react/src/compute/` and is re-exported from `@withqwerty/campos-react`. See [compute-helper-policy.md](https://github.com/withqwerty/campos/blob/main/docs/compute-helper-policy.md) for the current alpha-era public stance on that helper surface.

## Reintroduction rule

If Campos ever wants a standalone core package again, that must be an explicit tracked decision with a new architecture or package-policy update. The package name should not be revived implicitly just because compute helpers still exist.
