# Docs Guide

**Status:** active index
**Scope:** entrypoint for tracked Campos documentation and authority ordering

Use this directory in the following order:

## Start Here

- `architecture-decision.md`: current source of truth for the React-first architecture, product principles, and zero-config `ShotMap` spec.
- `core-package-policy.md`: active decision for the retired `@withqwerty/campos-core` package name, migration guidance, and reserved-package stance.
- `compute-helper-policy.md`: active decision for the current alpha-era public stance on `compute*` and shared math helpers re-exported from `@withqwerty/campos-react`.
- `compatibility-policy.md`: active alpha compatibility and deprecation posture for components, adapters, helper exports, and export schema surfaces.
- `kloppy-relationship.md`: active statement of how Campos uses `kloppy` as a reference, where adapter parity matters, and why Campos is not trying to replace `kloppy`.
- `roadmap-v0.3.md`: active tracked roadmap for the current post-W3 football-viz backlog, including battle-test-driven gap packets, delivery gates, and deferred export follow-up work.
- `status/matrix.md`: current delivery matrix — active packet queue, close-out history for earlier waves, and the live W4 battle-test / gap-closing backlog.
- `adapters-contract.md`: active spec for what provider adapters normalize, where first-stage products stop, and where derived products begin.
- `match-lineups-contract.md`: implementation-aligned draft contract for the richer lineup / team-sheet adapter product above the current `formations()` snapshot surface.
- `core-output-contract.md`: active transitional spec for the internal compute/model layer used by `@withqwerty/campos-react`; see `core-package-policy.md` for the retired-package decision.
- `filtering-model-contract.md`: future shared filter model shape for core input/output, legend bindings, option counts, and selection semantics.
- `opta-fixture-pipeline.md`: first approved real-data fixture pipeline from Cloudflare `opta-data`, including which charts it can honestly support now.
- `coordinate-standardisation.md`: proposed decision for provider-space parsing, canonical Campos space, and where coordinate standardization belongs.
- `component-defaults.md`: zero-config behavior for the first launch primitives.
- `component-composition-standard.md`: standard way to think about chart-shaped public components built from internal coordinate spaces, mark layers, annotations, and utilities.
- `component-extension-standard.md`: standard way to specify states, labels, theme/default color behavior, export considerations, responsive degradation, and bounded customization seams.
- `specs/static-export-composition-spec.md`: active draft for composition-first static SVG/PNG export, export-safe card/report surfaces, and chart static-mode requirements.
- `specs/static-export-phase1-packet.md`: concrete Phase 1 implementation packet for Node-first single-chart export, including the proposed serialized `ExportFrameSpec` and supported-chart list.
- `specs/numeric-encoding-foundation-spec.md`: implementation-ready packet for replacing duplicated scale/tick/format logic in the internal compute/model layer with narrow D3 utility modules while preserving the React-first architecture.
- `specs/distribution-chart-spec.md`: active chart-family spec for non-pitch univariate density curves and stacked comparison rows.
- `standards/filtering-standard.md`: cross-cutting rule for adapter vs core vs renderer ownership of end-user filtering, legend-click filtering, and structured filter semantics.
- `standards/domain-modeling-standard.md`: lightweight DDD-style rule for vocabulary, bounded contexts, anti-corruption boundaries, and invariant-first design in football-specific surfaces.
- `standards/d3-usage.md`: explicit allow-list and deny-list for D3 in Campos, plus the current numeric-encoding callsites.
- `standards/react-renderer-conventions.md`: shared renderer behavior contract for chart chrome, legends, empty states, and static SVG/export-safe paths.
- `standards/demo-page-standard.md`: reusable component-library demo page archetypes, story matrix, controls guidance, and page-quality rubric.
- `standards/battle-test-recreation-standard.md`: workflow for high-fidelity football-viz recreations that should surface reusable library gaps instead of demo-only hacks.
- `specs/battle-test-program-packet.md`: active packet queue for which battle-tests should run next and which reusable gaps they are meant to pressure.
- `standards/runnable-agent-gate-standard.md`: how to turn Campos standards into executable release gates that combine deterministic checks with fixed-contract agent reviews.
- `standards/component-state-review-standard.md`: repeatable audit process for aligning component JSDoc, package docs, repo docs, demo pages, and cross-cutting concerns.
- `status/react-renderer-audit.md`: compact chart-family audit for renderer coherence, accepted divergences, and the next cleanup seams.
- `plans/react-renderer-convergence-plan.md`: historical implementation record for pitch-shell convergence, shared scene extraction, and `Formation` modularization — marked ARCHIVED; fully implemented as of 2026-04-14.
- `plans/chart-library-followthrough-plan-2026-04-19.md`: historical execution plan for the W3a chart-library benchmark follow-through wave — checkpoint landed 2026-04-20; implementation complete.
- `plans/smallmultiples-plan.md`: deferred execution packet for the unified `SmallMultiples` surface; status "deferred post-alpha" as of 2026-04-16, not the current authority (see `docs/specs/smallmultiples-spec.md`).
- `specs/style-injection-foundation-spec.md`: active audit and foundation packet for first-class style injection, shared visual-encoding seams, export-safe customization, and the explicit `sourceMeta` boundary.
- `specs/export-style-parity-spec.md`: current source of truth for which style-injection paths are export-safe, best-effort only, or unsupported in the stable export contract.
- `specs/pitch-analyst-overlay-spec.md`: active design packet for dense analyst-style pitch cells, the `PitchCell` wrapper direction, and the reusable overlay-layer family that sits between raw `Pitch` composition and full chart components.
- `specs/percentile-surfaces-spec.md`: active chart-family spec for `PercentileBar` and `PercentilePill`, the precise scouting-percentile companions to the existing radial charts.
- `specs/passsonar-spec.md`: active chart-family spec for a first honest directional pass-profile chart.
- `specs/smallmultiples-followup-packet.md`: narrow W4 packet for the residual `SmallMultiples` adoption and analyst-grid gaps after the shipped grid baseline.
- `specs/cross-sport-ideas-triage-packet.md`: active packet for turning the cross-sport lab into a small football-relevant shortlist instead of a second roadmap.
- `specs/shotmap-spec.md`: canonical component packet for `ShotMap`, with layout / tooltip / legend sub-specs still acting as blocking detail docs.
- `specs/kde-spec.md`: active v0.3 spec packet for the smoothed density-map chart, distinct from the rectangular-grid `Heatmap`.
- `shotmap-layout-spec.md`: blocking region/layout spec for the first `ShotMap`.
- `shotmap-tooltip-spec.md`: blocking default tooltip payload spec for the first `ShotMap`.
- `shotmap-legend-spec.md`: blocking legend grouping spec for the first `ShotMap`.
- `standards/component-ship-checklist.md`: required quality bar, demo baseline, edge-case matrix, and adversarial review loop for each shipped component.
- `standards/adapter-gap-matrix.md`: current provider coverage and normalization gaps by data shape.
- `standards/adapter-method-matrix.md`: current public adapter method surface, missing reusable data-product methods, and which UI families should consume which prepared adapter packets.
- `plans/adapter-foundation-followups-plan.md`: historical closed packet for a completed v0.2 adapter-hardening wave. The plan is archived; the adapter package is still active and supported.
- `standards/reference-code-usage.md`: how and when to use `/Volumes/WQ/ref_code/` for scope, examples, and edge cases without cargo-culting implementations.
- `standards/document-status-policy.md`: how to mark active, superseded, archived, and internal docs so old plans do not silently remain authoritative.
- `templates/component-spec.md`: required spec template for new primitives and components.
- `templates/review-adversarial.md`: required format for 2-3 adversarial review loops.

> **Historical-core note:** Some active roadmap/spec docs still contain historical `@withqwerty/campos-core` or `packages/core/` references inside older sections. Per `core-package-policy.md`, interpret those as references to the internal compute/model layer or the current helper surface re-exported from `@withqwerty/campos-react`, not as a live standalone package.

## Active Standards

- `testing.md`: quality bar and validation standards carried forward from the Python work. The renderer is changing; the quality expectations are not.
- `standards/react-renderer-conventions.md`: shared React renderer contract for chart behavior, primitive boundaries, and static/export-safe SVG output.
- `standards/domain-modeling-standard.md`: lightweight domain-modeling discipline for football-specific public surfaces; use where Campos encodes football semantics, not for generic UI infrastructure.
- `standards/demo-page-standard.md`: component-library demo page quality standard for pitch surfaces, pitch charts, non-pitch charts, primitive catalogues, and cross-cutting guides.
- `standards/battle-test-recreation-standard.md`: battle-test workflow for converting published football viz into Campos recreations and extracting reusable gaps.
- `standards/runnable-agent-gate-standard.md`: release-gate contract for deterministic checks plus adversarial and visual review agents.
- `standards/component-state-review-standard.md`: post-implementation component state review process for docs/demo/JSDoc/API alignment.
- `standards/source-meta-standard.md`: contract for `sourceMeta` as a provider-scoped provenance/debugging escape hatch rather than a second canonical schema.

## Active Workflow

The tracked workflow for the current post-W3 backlog:

1. Start with `roadmap-v0.3.md` and `status/matrix.md` to confirm which packet is actually active.
2. If the work is a battle-test or recreation, start with `standards/battle-test-recreation-standard.md` before touching code.
3. If the work opens or widens a reusable chart/component packet, use `templates/component-spec.md` plus the relevant active spec in `docs/specs/`.
4. Use `component-composition-standard.md` and `component-extension-standard.md` to keep chart surfaces chart-shaped and zero-config publishable.
5. Implement library seams in `@withqwerty/campos-react` directly; do not reintroduce standalone `@withqwerty/campos-core` package APIs.
6. Update tests and demos for the actual packet scope, then run the required adversarial review loops from `templates/review-adversarial.md`.
7. Update `status/matrix.md` and any touched active docs so the planning layer reflects the real landed state.

For battle-test-driven work:

1. Start with `standards/battle-test-recreation-standard.md`.
2. Decompose the target image before writing code.
3. Open or update a real packet in `status/matrix.md` for any reusable gap the recreation surfaces.
4. Fix the library seam first; only then finish the site recreation.
5. Promote any lasting insight into the roadmap/matrix instead of leaving it buried in the site-only recreation.

## Historical Inputs

These documents are still useful, but they are not the final authority when they conflict with `architecture-decision.md`.

- earlier adversarial and design-lens critiques of the React pivot proposal
- pre-decision architecture research notes
- extraction notes identifying which patterns should inform Campos and which should remain app-specific
- lessons from the Python v2 redesign and earlier visual-quality work
- `archived/roadmap-v0.2.md`: historical roadmap for the previous component wave; useful context, not current coordination.
- `archived/api-redesign.md`: earlier API thinking that informed the current direction.

## Background And Evidence

- audience and product-gap research
- agent-oriented evaluation tasks and rubrics
- implementation history and planning notes
- earlier milestone decisions and evaluation artifacts

When updating architecture, prefer revising `architecture-decision.md` first, then update any historical documents only as needed to mark them as superseded or contextual.

## Historical Context

Some historical evaluation materials live outside the active tracked docs set. They can provide background, but they are not a reliable source of truth for current roadmap or ship criteria. Archived tracked documents now live under `docs/archived/`. If a plan or standard matters for coordination, it belongs in active tracked `docs/`.
