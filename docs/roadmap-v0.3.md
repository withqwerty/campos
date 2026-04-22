# Roadmap v0.3

**Status:** active — post-W3 football-viz backlog
**Supersedes:** picks up from `docs/archived/roadmap-v0.2.md`, which is complete
**Target:** deepen the shipped football showcase surface through battle-tests, reusable gap packets, and selective cross-sport ideas that map cleanly onto Campos components

> **Update — 2026-04-20:** the old two-showcase plan is no longer the active delivery model. Showcase A shipped, the chart-library follow-through wave landed, and the dedicated scouting slice / Showcase B plan has been removed. The current backlog is battle-test-driven gap filling: keep stress-testing the library with real recreations, close the reusable gaps they expose, and use the cross-sport ideas lab as a source of targeted packets rather than as a second showcase program.
>
> **Historical-core note:** Some older packet text below still refers to `@withqwerty/campos-core` or `packages/core/`. Per `docs/core-package-policy.md`, those references are historical shorthand for the internal compute/model layer; they do not imply a live standalone package.

## Goal

The current v0.3 follow-on work has four concrete goals:

- **Keep the shipped match showcase and battle-test page as forcing functions.**
- **Turn battle-test friction into library fixes, not demo hacks.**
- **Close the known reusable gaps:** `PercentileBar` / `PercentilePill`, `PassSonar`, and the next `SmallMultiples` / analyst-grid packet.
- **Use cross-sport ideas as input for targeted reusable packets, not as a separate product line.**

The old scouting-showcase target is intentionally removed. `PercentileBar`,
`PassSonar`, and `SmallMultiples` still matter, but as standalone reusable
surfaces and battle-test enablers rather than as pieces of a second showcase
page.

## Approach: battle-tests + focused gap packets

The active delivery model is:

1. **Run battle-tests against real published football viz.**
2. **Extract only the reusable gaps those recreations expose.**
3. **Ship those gaps as small, reviewable packets.**
4. **Use the cross-sport ideas lab as a shortlist generator, not as a mandate to build novelty charts.**

This keeps the work product-shaped without dragging the roadmap back into a
second showcase program we no longer intend to ship.

## Historical foundation — Match slice (shipped)

Focus: build the components needed to ship a match deep-dive page for one real Opta match. Lineups, shots, passes, territory, match flow.

### Packet order

| Order | Packet                    | Effort                    | Depends on                                                                                                                       | Exit criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----- | ------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | PassNetwork               | shipped (with follow-ups) | stadia, event adapters                                                                                                           | **shipped**: core (`pass-network.ts`, `pass-network-transforms.ts`) + React + 219-line test + demo + follow-ups (ego highlight, collision relaxation, directed mode, `aggregatePassNetwork`/`compressPassNetwork`/`combinePassNetworks`/`deriveInitials`). Open items tracked in `docs/archived/specs/passnetwork-followups-plan.md`.                                                                                                                                                                                                                                                                                                                                                                      |
| 2     | Formation                 | M                         | `@withqwerty/campos-core/formations` module (new) + `fromOpta.formations()` + `fromWhoScored.formations()` (new adapter methods) | port mplsoccer's 68-formation position table via `scripts/extract-mplsoccer-formations.py` (runnable as `pnpm generate:formations`); port kloppy's 24-entry Opta formation-ID-to-name map; implement `fromOpta.formations(lineupEvent, { squads })` decoding typeId 34 qualifiers 130/30/131/44/59/194 with `squads.json` name join; implement `fromWhoScored.formations(matchCentreDataTeam)` decoding `matchCentreData.home`/`.away`; `<Formation>` renders single-team or dual-team vertical broadcast-style lineup card; core + React + demo + adapter tests; builds its own marker rendering (do **not** block on shared primitive); spec: `docs/specs/formation-spec.md`; adapter gap matrix updated |
| 3     | Territory / Zone chart    | S-M                       | Heatmap core                                                                                                                     | fixed 3×3 or 5×3 pitch binning; thin layer over existing heatmap compute; core + React + demo + tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 4     | StatBadge / KPI primitive | S                         | none                                                                                                                             | header row for match KPIs (possession, shots, xG, corners, cards); layout and typography only, no new compute                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 5     | Showcase A page           | M                         | all of the above + Opta match fixture                                                                                            | `apps/site/src/pages/showcase/match.astro`; plain Astro + React islands; real Opta match; passes `pnpm check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Shared marker rendering — deferred to post-Formation

The original plan called for a shared `PlayerMarkerLayer` primitive extracted from PassNetwork _before_ Formation began. That guidance has been **withdrawn** after reviewing the actual state of `PassNetwork.tsx:191`:

- PassNetwork's `renderNode()` is function-extracted, not inlined, but it is coupled to `PassNetworkRenderedNode` and bakes in ego-highlight semantics (`active`/`dimmed`), keyboard-focusable interaction, and pass-network aria labels. Only the dark-outline stroke treatment is obviously generic.
- Designing a shared primitive from a single concrete consumer is the same speculative-abstraction anti-pattern v0.3 is trying to avoid elsewhere.
- Formation's marker needs are not yet known. It probably does not need dimmed/active states, does not need per-node interaction handlers, and will want label treatments specific to lineup cards (jersey numbers, captain armbands) that PassNetwork does not use.

**Revised plan:** Formation builds its own marker rendering. Once both PassNetwork and Formation exist with concrete marker code, open a small follow-up refactor packet to extract a shared `<PlayerMarker>` component informed by both call sites. That extraction is a post-Lane-1 concern and does not block Showcase A.

PassNetwork and Formation have independent compute paths regardless — data-driven average positions vs. label-driven slot parsing. Only the rendering is a candidate for sharing, and that sharing decision is better made after two real implementations exist.

### Reference code

Consult only the repos that actually cover the primitive under work, per the archived v0.2 reference-code rule and current `docs/README.md` workflow:

- `mplsoccer` — pass network conventions, formation slot coordinates, pitch binning
- `socceraction` — any pass-network examples in action-value notebooks
- `kloppy` — player-position and substitution handling for averaging-window decisions

Record divergence explicitly where Campos needs stricter data contracts, headless-core boundaries, or accessibility the reference lacks.

## Next wave — Battle-test + gap-closing packets

Focus: continue battle-test recreations and close the reusable gaps they
surface, plus the explicitly queued gaps that are already well understood.

### Packet order

| Order | Packet                                  | Effort  | Depends on                                            | Exit criteria                                                                                                                                         |
| ----- | --------------------------------------- | ------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Battle-test recreation program          | ongoing | `docs/standards/battle-test-recreation-standard.md`   | next recreation lands with no demo-only hacks hiding reusable library gaps                                                                            |
| 2     | PercentileBar + PercentilePill          | S-M     | comparison-pool + metric-direction decisions          | `PercentileBar` and `PercentilePill` ship with explicit pool labeling, inversion handling, demo pages, and tests                                      |
| 3     | PassSonar                               | M       | zone semantics + averaging convention                 | `PassSonar` ships with one honest convention, docs, demo, and tests                                                                                   |
| 4     | SmallMultiples follow-up / analyst grid | M       | existing `SmallMultiples` + analyst-overlay direction | reopen the shipped `SmallMultiples` surface only for the missing dense-grid / shared-view / analyst-overlay gaps, without turning it into chart magic |
| 5     | Cross-sport ideas triage                | S       | `apps/site/src/pages/lab/cross-sport-ideas.astro`     | shortlist of football-relevant reusable ideas is recorded and concrete follow-up packets are opened where justified                                   |

### Authoritative packet specs

- `W4a`: `docs/specs/battle-test-program-packet.md`
- `W4b`: `docs/specs/percentile-surfaces-spec.md`
- `W4c`: `docs/specs/passsonar-spec.md`
- `W4d`: `docs/specs/smallmultiples-followup-packet.md`
- `W4e`: `docs/specs/cross-sport-ideas-triage-packet.md`

### Open design questions (packet-phase, not roadmap-phase)

Flagged here so they don't get pre-answered in the wrong place:

- **Comparison-sample ownership.** Do percentile surfaces stay precomputed-input only through v0.3, or does a reusable scouting-data product need to appear sooner?
- **First percentile reference.** Which real battle-test reference should anchor the first percentile-led recreation and pressure the family honestly?
- **`PitchCell` gate.** Does a concrete analyst-grid use case justify `PitchCell` in W4, or is the honest answer still chart adoption + better guidance?
- **Cross-sport promotion threshold.** Which deferred ideas are allowed to leap from the lab into active packet status without diluting W4?

## Lane 3 — Phase 1 static export (done)

Phase 1 export is now release-complete for its stated scope: 11 supported chart kinds, demo surface, fixture coverage, theme-aware background schema, and recorded review loops.

### Current state

`docs/specs/static-export-phase1-packet.md` now tracks 11 supported chart kinds with gating rules. The actual implementation has shipped the architecture and all 11 chart-kind render paths:

- **Shipped.** `@withqwerty/campos-static`; `@withqwerty/campos-react/src/export/` (`createExportFrameSpec`, `ExportFrame`, `StaticExportSvg`, `types`); React-SSR-based SVG rendering via `renderToStaticMarkup`; PNG rasterization via `sharp`; static exports for `BumpChart`, `PizzaChart`, `Formation`, `PassNetwork`, `Territory`, `ShotMap`, `PassMap`, `Heatmap`, `ScatterPlot`, `XGTimeline`, and `RadarChart`; gating for Pizza image/crest `centerContent`, Bump `renderEndLabel`/`teamLogos`, Formation photo/custom marker glyph and slot/substitute branches, and XGTimeline crosshair.
- **Current schema.** The shipped schema includes `version`, `preset`, `theme`, additive `eyebrow`, and a tagged `ExportBackgroundSpec` with `{ kind: "theme", token: "canvas" | "surface" }` and `{ kind: "solid", color: string }`.
- **Validation.** Export demo page landed, 11 golden SVG fixtures landed, long-text/empty-state/unsupported-kind/dual-theme regression coverage landed, and review loops L2/L3 are recorded in `docs/specs/static-export-phase1-packet.md`.

### Why the packet is now closed

1. **The architectural bet has paid off.** React-SSR delegation plus chart-specific `ChartNameStaticSvg` renderers is proven across the full Phase 1 chart set.
2. **Context-switching cost.** Still expensive to hold chart-building and SVG-serialization mental models simultaneously.
3. **Scope decisions made once.** Formation, PassNetwork, and Territory are now in the export union, so the remaining packet should avoid reopening that already-proven schema seam unless the export prop subset needs tightening.
4. **Blocked branches are explicit.** The Phase 1 packet ships a deterministic core, with Pizza image/crest content, Bump logo/custom end labels, and Formation photo/substitute branches still intentionally gated.

### Close-out notes

- The export packet is complete for Phase 1.
- Remaining export work belongs to Phase 2: wider asset support, currently gated chart branches, and any future background-token expansion beyond the current theme/solid union.

Percentile surfaces, PassSonar, and the next `SmallMultiples` follow-up are
deliberately excluded from Phase 1. They can ship in a follow-up export packet
once their usage stabilises through battle-tests and real football demos.

## Non-goals for v0.3

Explicit non-goals so they don't creep in during packet work:

- **Momentum / xT flow chart** — deferred to v0.4; existing XGTimeline covers the baseline story
- **Tracking data visualisations** (Voronoi, pitch control) — require a tracking data source first
- **Substitution timelines, formation changes over time**
- **Season-long aggregations** beyond what existing charts already support
- **Dedicated Showcase B scouting page**
- **Full scouting table component** — table markup remains consumer-owned even if percentile surfaces land
- **Goal-mouth shot placement, hexbin, pitch-overlay sonar**
- **Multi-chart composition / page layout primitive** — deferred until the showcase and battle-test surfaces expose real shared patterns
- **KDE and CometChart static export un-blocking** — deferred to Phase 2

## Delivery gates

This follow-on roadmap is not done until all of the following hold:

- Every active gap packet follows `docs/templates/component-spec.md` and has spec, core, React, demo, tests, and adversarial edge-case coverage
- Relevant rows in `docs/status/matrix.md` reflect real state (no lying about partial work)
- Relevant rows in `docs/standards/adapter-gap-matrix.md` reflect any widened provider coverage
- Showcase A and `/showcase/battle-test` both pass `pnpm check`
- Battle-test recreations follow `docs/standards/battle-test-recreation-standard.md` and promote reusable gaps into real library packets
- Phase 1 export packet has shipped all 11 supported chart kinds plus demo, fixtures, schema decision, and review close-out
- Review loops 1-3 are recorded for every shipped component
- This file is updated again once the next wave of battle-test / gap packets settles

## Parallel work discipline

This backlog still does **not** mean "everything at once." The allowed parallelism is:

- battle-test site work can run in parallel with spec prep, provided the shared library seam is already agreed
- cross-sport idea triage can run in parallel with implementation, provided it only opens packets rather than smuggling scope into an in-flight change
- static-export follow-up planning can continue independently because it does not block the next football-viz packets
