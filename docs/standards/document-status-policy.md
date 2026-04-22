# Document Status Policy

**Status:** active
**Scope:** authority metadata and lifecycle rules for tracked docs
**Purpose:** define how planning, standards, and spec docs should declare authority and lifecycle state

Every planning or specification document should declare its authority level clearly at the top.

## Allowed statuses

- `active`
  Current source of truth for its scope.
- `superseded`
  Replaced by a newer tracked doc. Keep only if the history still helps.
- `archived`
  Historical reference only. Not authoritative.
- `internal`
  Useful local note or review, but not reliable as a shared coordination source.
- `draft`
  In progress and not yet authoritative.

## Required metadata

Each planning or standards doc should include, when relevant:

- `Status:`
- `Supersedes:`
- `Superseded by:`
- `Scope:`

## Rules

1. There should be only one active roadmap for the current delivery wave.
2. If a doc in `docs/` replaces an older planning document or private working note, the tracked doc becomes authoritative.
3. Do not silently leave broken references to missing or internal-only files in `docs/README.md`.
4. If an older doc is still linked for context, say explicitly that it is historical input rather than source of truth.
5. When a section inside an otherwise active doc becomes obsolete, mark the section inline rather than leaving stale guidance ambiguous.

## Current application

- `docs/roadmap-v0.3.md` is the active tracked roadmap.
- `docs/archived/roadmap-v0.2.md` is historical and should not be used as the active delivery plan.
