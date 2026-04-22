# Heatmap Evolution Plan

**Status:** archived
**Superseded by:** `docs/specs/heatmap-spec.md`
**Last updated:** 2026-04-10
**Owner:** campos team
**Related:** `docs/specs/heatmap-spec.md`, `docs/archived/roadmap-v0.2.md`

## Context

Batch 1 (shipped 2026-04-10) was a labeling-honesty pass on the existing `Heatmap` component:

- Tooltip "Share %" row was misleading (`count/maxCount`, not share-of-total). Replaced with an `Intensity` row.
- Removed the `normalize: boolean` prop — it muddled presentation and semantics.
- Removed the `hot` colorscale (perceptually non-uniform — research flagged).
- Added `metricLabel` prop — scale bar and tooltip now name what the heatmap measures.
- Demo page now shows one component computing five different football questions (touches, pass origins, defensive actions, final-third receptions, recoveries) instead of five colorscales of the same touches.

Follow-up (same day, shipped):

- **`valueMode` + colorscale consistency pass** — implemented per `docs/archived/specs/heatmap-value-mode-spec.md`. Adds `valueMode: "count" | "intensity" | "share"`, adds `inferno` to both Heatmap and KDE, removes `hot` from KDE.
- **`autoPitchLines` auto-contrast** — both Heatmap and KDE now detect dark color ramps (magma/inferno/viridis/dark custom) via W3C luminance of the first stop and auto-force pitch lines to white. User can disable via `autoPitchLines={false}`. Full design decisions documented in the "Post-ship addition" section of `docs/archived/specs/heatmap-value-mode-spec.md`.

This document originally proposed 11 follow-up items across "Batch 2" and "Batch 3". After adversarial review (three reviewers: adversarial-document, scope-guardian, feasibility), the scope is reduced to **two items to ship now** plus **a deferred-pending-demand list**. Section "Corrections from original plan" at the bottom records what changed and why.

## Guiding principle

Research tells us **how** to implement things correctly, not **what** to build. Every new prop or component in this plan must trace back to a concrete user need, not to research completeness or analytical surface area. If nobody has asked for it, don't pre-build it.

## What's in scope now

### 1. `valueMode: "count" | "intensity" | "share"`

**Why:** The current component computes counts and renders intensity, but it cannot express share-of-total. A user asking "what fraction of Arsenal's touches happened in zone 14?" cannot get that from the current component. Share is the one legitimate gap from the Batch 1 labeling pass — same compute, different denominator, different honest label.

**What changes:**

- `HeatmapCell` gains a `share: number` field alongside `count` and `intensity`.
- `computeHeatmap` accepts `valueMode?: "count" | "intensity" | "share"` (default `"count"`).
- Scale-bar domain and tooltip metric row derive from the selected mode.
- **Color ramp normalizes against the active mode's max**, not a hardcoded `intensity`. For `count` and `intensity` modes this is identical to the current behavior. For `share` mode it's still a monotonic rescaling of the same binning, so the ramp shape is preserved — but cell colors and tooltip labels always agree, which matters for sparse data where `maxCount` and `totalCount` diverge.
- Tooltip always shows the selected mode's value as the primary row and `intensity` as a secondary row (the universal "how hot is this relative to peak" answer).

**What's NOT included:**

- **`density` mode.** On uniform grids, density is a constant rescaling of count by `1/cellArea` — a label-and-units change, not added information. Shipping it now as a no-op with a warning is cargo-cult forward compatibility: adding a union value later is additive in TypeScript, not a break. Ship `density` when JdP (non-uniform bins) lands, because that's the first context where it's meaningful.
- **`deviation` mode** (reference-relative comparison). See "Deferred pending demand" below.

**Tests:**

- Each mode produces the correct scale-bar domain and tooltip value
- Color ramp and tooltip labels agree cell-by-cell under every mode
- Sparse-data case: single dominant cell with `share ≠ intensity` — verify the ramp matches the mode, not a hardcoded intensity

**Note on heatmap-spec.md Resolved Decision #3:** The spec defers "statistic functions beyond count" to v0.3. Share-of-total is technically a new statistic. I'm reading Decision #3 as applying to aggregation functions (mean, sum over a second variable, etc.) rather than denominator choices on the existing count statistic. If the team disagrees, this item also defers to v0.3.

### 2. Colorscale consistency pass

One commit, two files:

- Add `"inferno"` to `HeatmapColorScale` union in `packages/core/src/heatmap.ts`. Research recommends `magma`, `inferno`, `viridis` as the three perceptually uniform defaults; we ship two of three. Inferno has higher mid-range contrast than magma, useful on dark-green pitch backgrounds.
- Remove `"hot"` from `KDEColorScale` union in `packages/core/src/kde.ts`. Batch 1 removed it from Heatmap; the same reasoning applies to KDE. Update the KDE demo card that currently uses `colorScale="hot"`.

That's the whole item. Not a batch, not a milestone — a PR.

## Deferred pending demand

The capabilities below are real structural gaps, but none of them has a concrete user scenario attached today. Build them when a user asks. Until then, flagging them as "next batch" reserves complexity budget for speculative work.

### Diverging / comparison mode

**Gap:** The component cannot render data relative to a reference (league average, opponent, z-score vs baseline). Diverging heatmaps are the standard football-analytics visualization for this kind of comparison.

**Open design question:** `valueMode: "deviation"` extension OR `ComparisonHeatmap` sibling component?

- The original plan chose a sibling component. The adversarial review challenged this: the plan introduces `valueMode` specifically to separate "what we count" from "what we render", then immediately creates a parallel API for the most natural fifth mode. A `valueMode: "deviation"` with a `reference` prop reuses ~95% of the binning, color, and scale machinery.
- The counter-argument: the scale bar is genuinely different (two-arm, centered on zero, neutral midpoint). The color ramp system needs diverging stops (`RdBu`). The `reference` prop is only meaningful in one mode. These are enough differences that a sibling may genuinely be cleaner.

**Decision procedure (when the feature is actually built):** Sketch the conditional prop logic for the `valueMode: "deviation"` path first. If it's clean — no props become "only valid when mode='deviation'" — extend `valueMode`. If the conditionals pile up, ship `ComparisonHeatmap` as a sibling and extract a `DivergingScaleBar` primitive alongside. Don't decide abstractly from this document.

**Prerequisites either way:**

- Base scale-bar extraction is already shipped as [ChartScaleBar.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/primitives/ChartScaleBar.tsx). Reuse that primitive rather than reopening the extraction.
- Add diverging color ramp definitions: `RdBu_r` at minimum, with a neutral midpoint. Never `RdYlGn` (red/green is the worst colorblind combination).
- New core compute helper (shared with `computeHeatmap`'s binning) that takes a reference — either a number or a second event array — and emits per-cell deviation and z-scores.

### Juego de Posición (JdP) positional heatmap

**Gap:** The component can only render uniform rectangular bins. JdP zones (Guardiola's positional-play grid) use non-uniform tactical zones derived from pitch landmarks. This is the most common tactical heatmap in professional football analysis; Campos currently can't express it.

**Key constraint:** JdP zones are _not_ configurable bins. They're constants derived from pitch geometry (penalty area, six-yard box, halfway line).

**Zone boundaries are not hardcoded in this plan.** The original draft included specific numbers that were mathematically wrong — see "Corrections from original plan" below. The correct approach when the feature is built:

- Derive boundaries at module load from `PITCH` constants in `packages/stadia/src/geometry/constants.ts` (`length`, `penaltyAreaLength`, `penaltyAreaWidth`, `goalAreaWidth`), then normalize to the Campos 0–100 space.
- There are (at least) two plausible X-boundary conventions that differ in the middle-column split:
  - **mplsoccer convention:** midpoint between penalty area and center line. First boundary = `penaltyAreaLength`; middle boundary = `(penaltyAreaLength + length/2) / 2`.
  - **Pitch-thirds convention:** `length/3` and `2*length/3` for the middle boundaries.

These are subtly different tactical interpretations. Pick one by reading mplsoccer source directly when implementing, not by guessing in a plan doc. Commit a reference to the exact mplsoccer source file/line in the constant's docstring.

**Other requirements:**

- **Area-normalized values.** Penalty-box zones are smaller than midfield zones. A 10-event penalty-box cell is not hotter than a 15-event midfield cell if the midfield cell is 3× the area. Always compute density (events per unit area) or share-of-total, never raw count. This is when `valueMode: "density"` becomes meaningful — ship it as part of this work.
- **Inline percentage labels** per zone, with W3C dynamic text contrast (threshold 0.179) plus subtle shadow/stroke fallback for mid-luminance cells where neither pure black nor pure white achieves WCAG AA contrast. Research is explicit that shadow is not optional at mid-luminance.
- **Sharing with `Heatmap`:** uses the same `<Pitch underlay={...}>` API, the same sequential color scales, and (once extracted) the same `ScaleBar` primitive. Does **not** share "`PitchBackground`/`PitchLines`" — those don't exist as React-layer primitives; they live inside stadia's `Pitch` component. See "Corrections" below.

**This reverses heatmap-spec.md Resolved Decision #8** (zone maps deferred to v0.3 as a separate `ZoneMap` component). If built before v0.3, update the spec with the reversal and its rationale.

### KDE-style smoothing on Heatmap

**Gap:** None — `<KDE>` already exists as a sibling component for smooth density rendering.

**Verdict:** Deferred. The original plan's bilinear-smoothing proposal would duplicate KDE's capability without adding user value. This **confirms** `heatmap-spec.md` Resolved Decision #7 (KDE/smoothing deferred).

If a user asks for smoothing on the binned Heatmap specifically, feasibility confirmed the implementation path is viable: KDE already ships the "canvas + SVG `<image>`" pattern in `packages/react/src/KDE.tsx` lines 39-120, including a vertical-orientation transpose. Copy that pattern. But don't build it on spec.

### Raw-point overlay

**Gap:** The Modifiable Areal Unit Problem (MAUP) means any binned pattern depends on bin choice. Showing raw events on top of bins lets viewers judge local density independently of the grid.

**Verdict:** Deferred. MAUP mitigation is analyst discipline, not component API. Users who want raw event scatter can stack `<ShotMap>` (or a future scatter primitive) over `<Heatmap>`. Coupling two rendering concerns into one prop buys nothing a composition doesn't.

### Hexbin

**Verdict:** Deferred to v0.3 per the original plan. Substantial new component, not blocking v0.2. Single log entry, no expansion.

## Shared primitive extraction

Don't build these on spec. Build when the first sibling component actually needs them:

1. **`projectRect` helper** — extract from `Heatmap.tsx` lines 38-51. `PositionalHeatmap` would need the same logic for non-uniform JdP cells.
2. **`DivergingScaleBar` primitive** — only if the `ComparisonHeatmap` sibling path wins over the `valueMode: "deviation"` path.
3. **`pickTextColor(fill, dark, light)` helper** — only when a component needs in-cell text labels. When built, it lives next to the existing `hexToRgb`/`rgbToHex`/`interpolateStops` in `packages/core/src/color.ts` and is used inline at the one callsite (JdP labels). It is not a standalone "utility" with independent versioning — it's 8 lines of arithmetic.

Extraction cost ≈ 1 day total, but should happen alongside the first consumer, not as a speculative primitive pass.

## Corrections from original plan

Recorded so future readers don't reintroduce the same mistakes:

1. **JdP X-boundaries were numerically wrong.** Original: `[0, 17.14, 35.0, 50.0, 65.0, 82.86, 100]`. The first value `17.14` implied an 18m penalty area, not the FIFA standard 16.5m. The `35.0` and `65.0` values mixed the pitch-thirds convention with the wrong penalty-area width. Correct approach documented above: derive from `PITCH` constants, cite the mplsoccer source for the convention chosen, don't hardcode.

2. **"Color ramp always uses intensity regardless of valueMode" invariant was mathematically wrong.** The original plan claimed changing the ramp math would "collapse the visual". For sparse data where one cell dominates, `share = intensity × (maxCount/totalCount)` diverges from `intensity`, so cell colors and tooltip labels would disagree under the original rule. Corrected: ramp normalizes against the active mode. Since all three modes are monotonic rescalings of the same binning, the ramp _shape_ is invariant — only the domain changes.

3. **"Shares `PitchBackground`/`PitchLines` with `Heatmap`" was an invented seam.** Those aren't React-layer primitives; they live inside stadia's `Pitch` component. The correct sharing model is: all sibling chart components consume `<Pitch underlay={...}>` from `@withqwerty/campos-stadia`, not new extracted primitives.

4. **Silent reversal of `heatmap-spec.md` Resolved Decisions #7 and #8.** The original plan proposed smoothing and positional heatmaps without acknowledging they had been explicitly deferred to v0.3 in the component spec. This revision confirms #7 as deferred and flags #8 as a pending decision that requires updating the spec if revived.

5. **`density` valueMode shipped-but-no-op.** Original plan proposed shipping the union value early "to prevent an API break." TypeScript union widening is additive, not breaking. Cut until JdP makes it meaningful.

6. **Standalone primitives proposed for one-callsite utilities.** Original plan listed `caption` slot, text contrast utility, two-arm scale bar, and `metricLabel` audit as named plan items. All fold into either inline implementation at their single callsite or into the relevant sibling component's implementation. Cut from the plan; they're not decisions, they're code.

7. **Over-citation of research as user-requirements proxy.** The research doc describes what academic/editorial heatmap literature considers rigorous. It's not a user-request list. Original plan grounded most "why" statements in research citations rather than concrete user needs. Corrected: every scoped item now has a user-scenario justification, and deferred items explicitly wait for demand.

## Revision history

| Date       | Change                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-10 | Original plan written (11 items across two batches)                                                                                                                 |
| 2026-04-10 | Revised after adversarial review. Reduced to 2 in-scope items + 5 deferred-pending-demand. Fixed 4 factual errors. Acknowledged walked-back heatmap-spec decisions. |
