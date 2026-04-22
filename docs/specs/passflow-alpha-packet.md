# PassFlow v0.3 Alpha Implementation Packet

**Status:** open, ready for execution (packet adversarial-reviewed 2026-04-17, revised)
**Owner:** Claude Code
**Target version:** v0.3 alpha
**Depends on:**

- `docs/specs/passflow-spec.md` (adversarial-reviewed 2026-04-17)
- existing primitives: `PitchChartFrame`, `ChartLineMark`, `ChartTooltip`, `EmptyState`, `Pitch`
- existing adapters: `fromStatsBomb.passes()` (no widening expected)
- existing static-export architecture: `docs/specs/static-export-phase1-packet.md`

## Product scope

This packet delivers the static PassFlow slice defined in the spec:

- new `PassFlow` chart component (public export)
- new `computePassFlow` compute layer
- new `PassFlowStaticSvg` for Node-first export parity
- demo page + mplsoccer-baseline showcase
- test coverage per spec

**Explicitly out of scope** (deferred to v0.3 beta, tracked in spec §Open Questions):

- marching-dash / pulse animation
- Barcelona GIF battle-test recreation (spec loop 3 also deferred with it)
- binning-utility extraction to `compute/binning.ts`
- flow-differential or per-player decomposition

## Shared-seam fixes required

Per CLAUDE.md — reported explicitly, not hidden inside the PassFlow change:

1. **Circular-mean util.** New pure module `packages/react/src/compute/circular.ts` exposing `circularMean(vectors)` returning `{ meanAngle: number | null; resultantLength: number; count: number }`. ~20 LOC, no other consumers in this packet.

### Non-fix: heatmap half-crop (previously flagged, withdrawn after audit)

An earlier packet revision flagged `heatmap.ts`'s hard-coded `cropMinX = 50` as a direction bug. That was wrong. Per `docs/standards/coordinate-invariants.md`:

- All event coordinates are **attacker-relative**: `x = 100` is always toward the opposition goal, regardless of which physical end the team attacks.
- Therefore `crop="half"` = attacking half = `x ∈ [50, 100]` for every `attackingDirection`.
- `attackingDirection` is only a renderer hint (which way the attacker faces on screen); it does not change data semantics.

Heatmap's current implementation is correct. The same convention applies to PassFlow: `crop="half"` filters to `x ∈ [50, 100]` in canonical data space, regardless of `attackingDirection`. Spec updated to match.

If either fix's scope expands beyond what's listed, stop and propose before continuing.

## File inventory

### New files

| Path                                                             | Purpose                                                                                                                 |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/compute/pass-flow.ts`                        | `computePassFlow`, all model types, binning, gating, value modes                                                        |
| `packages/react/src/compute/circular.ts`                         | circular-mean utility                                                                                                   |
| `packages/react/src/PassFlow.tsx`                                | React renderer (hooks, hover, `<defs>`)                                                                                 |
| `packages/react/src/PassFlowStaticSvg.tsx`                       | static export renderer, stateless (separate file per `PassMapStaticSvg` precedent check — confirm in step 6)            |
| `packages/react/src/primitives/ChartPitchGridLayer.tsx`          | cell rects + hit overlays                                                                                               |
| `packages/react/src/primitives/ChartFlowArrowLayer.tsx`          | arrow + glyph rendering, containment→pixel mapping                                                                      |
| `packages/react/test/compute/circular.test.ts`                   | circular-mean unit tests                                                                                                |
| `packages/react/test/compute/pass-flow.test.ts`                  | compute tests per spec §Test requirements                                                                               |
| `packages/react/test/PassFlow.test.tsx`                          | React component tests (render, hover, focus, a11y)                                                                      |
| `packages/react/test/fixtures/pass-flow.baseline.json`           | **renamed from `__snapshots__/`** to avoid Vitest auto-snapshot collision; manually-maintained regression model fixture |
| `packages/static/test/fixtures/svg/pass-flow.svg`                | golden static-export fixture — baseline                                                                                 |
| `packages/static/test/fixtures/svg/pass-flow-half-left.svg`      | golden — `crop="half"` + `attackingDirection="left"` (proves renderer orientation without breaking data-space crop)     |
| `packages/static/test/fixtures/svg/pass-flow-low-dispersion.svg` | golden — proves gate/glyph branch serializes                                                                            |
| `apps/site/src/pages/components/pass-flow.astro`                 | demo page (7 scenarios per spec §Demo)                                                                                  |
| `apps/site/src/data/passflow-fixture.ts`                         | fixture module, source-credited                                                                                         |

### Modified files

| Path                                                                                                      | Change                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/compute/index.ts`                                                                     | export `computePassFlow`, `circularMean`, all new types                                                                                                                       |
| `packages/react/src/index.ts`                                                                             | export `PassFlow`, `PassFlowStaticSvg`, `PassFlowModel`, `PassFlowBinModel`, `PassFlowLegendModel`                                                                            |
| `packages/react/src/export/types.ts`                                                                      | add `{ kind: "pass-flow"; props: ExportPassFlowProps }` arm; define `ExportPassFlowProps = Pick<PassFlowProps, …>` omitting `StyleValue` callbacks and non-serializable slots |
| `packages/react/src/export/chart-kind.ts`                                                                 | add `"pass-flow"` to `SUPPORTED_EXPORT_CHART_KINDS` tuple                                                                                                                     |
| `packages/react/src/export/createExportFrameSpec.ts`                                                      | validation rejection branch for non-serializable PassFlow props (functions in `cell`/`arrow`/`colorStops`)                                                                    |
| `packages/react/src/export/ExportFrame.tsx`                                                               | preview dispatch arm for `"pass-flow"`                                                                                                                                        |
| `packages/react/src/export/StaticExportSvg.tsx`                                                           | static dispatch arm for `"pass-flow"`                                                                                                                                         |
| `packages/react/src/data/export-fixtures` (or equivalent `apps/site/src/data/export-composition-demo.ts`) | register PassFlow composition demo card — only if the composition-demo app lists every chart kind (verify at step 8)                                                          |
| `packages/static/test/render-static-svg.test.ts`                                                          | add `"pass-flow"` arm + golden SVG comparison                                                                                                                                 |
| `packages/static/test/fixtures/export-fixtures.js`                                                        | register PassFlow card in demo spec                                                                                                                                           |
| `apps/site/src/content/stadiaDocs.ts`                                                                     | add PassFlow docs content entry (verify at step 9 whether site content index includes chart docs)                                                                             |
| `docs/status/matrix.md`                                                                                   | flip PassFlow row to "alpha shipped"                                                                                                                                          |
| `docs/roadmap-v0.3.md`                                                                                    | tick completed alpha item; keep beta items open                                                                                                                               |
| `docs/standards/adapter-gap-matrix.md`                                                                    | confirm StatsBomb coverage row if missing                                                                                                                                     |
| `theme/tokens.json`                                                                                       | add `passflow.dispersionFloor = 0.3` and `passflow.minCountForArrow = 2` so the editorial choice is audit-able                                                                |

### Files to verify (no pre-committed modification)

| Path                                         | Verify                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| `docs/standards/component-ship-checklist.md` | whether it has a per-component completion table needing a PassFlow row     |
| `README.md` at repo root                     | whether it enumerates shipped charts (most recent alpha matrix entry adds) |

## Build order

Each step must pass its own tests before moving on. On review-surfaced shape changes, re-enter the affected step before resuming (see §Re-entry logic).

1. **Circular-mean util** (`compute/circular.ts` + `test/compute/circular.test.ts`)
   - `circularMean(readonly { dx: number; dy: number }[])` → `{ meanAngle: number | null; resultantLength: number; count: number }`
   - `meanAngle = null` when `resultantLength < 1e-9`
   - covered: n=0, n=1, colinear, antiparallel, orthogonal, zero-magnitude vectors, R=0.5
   - verify: `pnpm exec vitest run packages/react/test/compute/circular.test.ts`

2. **(Formerly heatmap fix — withdrawn.)** See §Shared-seam fixes required. No heatmap change needed; coordinate standard makes `cropMinX = 50` correct for all directions.

3. **PassFlow compute** (`compute/pass-flow.ts`)
   - input validation (edges monotonicity, range, crop alignment — throws `InvalidEdgesError`)
   - coordinate clamping (matches heatmap) + pass filtering (`completionFilter`, `minMinute`, `maxMinute`)
   - binning (inline per spec; mirror heatmap conventions for the fixed bin case)
   - per-bin aggregation → delegate to `circularMean` → gating (`R ≥ dispersionFloor && n ≥ minCountForArrow && meanAngle !== null`)
   - value mode computation (`count`, `share`, `relative-frequency` with honest per-bin-area math)
   - color resolution via existing `color-scales.ts`
   - legend + headerStats + tooltip row assembly
   - `magnitudeHint` per `arrowLengthMode`
   - model shape exactly matches spec §Bin model

4. **Compute tests (compute only)** — `packages/react/test/compute/pass-flow.test.ts`
   - full matrix from spec §Test requirements / §Edge-case matrix — the compute subset only
   - snapshot the default baseline model to `fixtures/pass-flow.baseline.json`
   - verify: `pnpm exec vitest run packages/react/test/compute/pass-flow.test.ts`
   - **Review checkpoint 1:** adversarial review of compute diff. On compute-shape change, re-run step 4 to refresh the fixture before proceeding.

5. **Primitives** — `ChartPitchGridLayer`, `ChartFlowArrowLayer`
   - thin; take resolved model + `project` fn; no internal state
   - `ChartFlowArrowLayer` owns `magnitudeHint × arrowContainment × min(binW, binH)` → pixel math, glyph fallback, and `<marker>` arrowhead defs

6. **React renderer** — `PassFlow.tsx`, `PassFlowStaticSvg.tsx`
   - confirm the file-split pattern against `PassMap.tsx` / `PassMapStaticSvg` (inspect whether static is a separate file or co-located export — **current `PassMap.tsx` co-locates `PassMapStaticSvg`**; follow that pattern and collapse to single `PassFlow.tsx` unless there's a reason to split)
   - mirror `PassMap` structure: hover state, `renderKey`, arrow-color `<defs>`, keyboard focus on cells
   - static variant stateless

7. **Component tests** — `packages/react/test/PassFlow.test.tsx`
   - render with correct fill, arrows vs glyphs
   - hover → tooltip with expected rows
   - keyboard focus reaches cells, aria-label describes zone
   - `renderToString(<PassFlow />)` produces stable output (SSR sanity — no export path dependency)

8. **Static-export registration**
   - add `"pass-flow"` to `SUPPORTED_EXPORT_CHART_KINDS` (`chart-kind.ts`)
   - add union arm + `ExportPassFlowProps` in `export/types.ts`
   - add dispatch in `ExportFrame.tsx` (preview) and `StaticExportSvg.tsx` (export)
   - add validation branches in `createExportFrameSpec.ts` (reject functions in style props, reject callbacks in `colorStops`)
   - register demo card in `packages/static/test/fixtures/export-fixtures.js`
   - generate 3 golden SVG fixtures: baseline, `crop="half" + attackingDirection="left"`, low-dispersion (all glyphs)
   - `packages/static/test/render-static-svg.test.ts` arm for `"pass-flow"`
   - verify: `pnpm --filter @campos/static test`
   - **Review checkpoint 2:** adversarial review of the cumulative diff (compute + renderer + export).

9. **Fixture + demo page**
   - `apps/site/src/data/passflow-fixture.ts` — StatsBomb-open match passes, credited source path
   - `apps/site/src/pages/components/pass-flow.astro` — 7 scenarios per spec §Demo, includes both `attackingDirection="right"` and `"left"` half-crop variants
   - wire into `apps/site/src/content/stadiaDocs.ts` if that index lists chart docs (verify first)

10. **Fixture validation gate (deterministic rule)** — spec §Zero-config requires this
    - Render the default (6×4, `valueMode="share"`, sequential-blues, `completionFilter="all"`) against three StatsBomb-open match fixtures: one high-possession (Barcelona-type), one mid-possession, one low-possession.
    - Compute, for each fixture, `medianNonEmptyIntensity` and `maxNonEmptyIntensity` across bins.
    - **Flip rule (deterministic):** if across ≥2 of 3 fixtures `maxNonEmptyIntensity < 0.4` OR `medianNonEmptyIntensity < 0.08`, the default is under-saturated. Flip to `valueMode="relative-frequency"` + `colorScale="diverging-rdbu"` and amend spec §Zero-config happy path (the spec amendment is a tiny 3-line diff; apply in this packet).
    - Else keep the default.
    - This rule is deterministic: no human judgement required. Record the computed numbers in a comment in `passflow-fixture.ts` so the decision is auditable.

11. **Status matrix + adapter-gap matrix** updates
    - `docs/status/matrix.md` PassFlow row → "alpha shipped"
    - `docs/roadmap-v0.3.md` tick alpha item
    - `theme/tokens.json` append `passflow` tokens
    - `docs/standards/adapter-gap-matrix.md` confirm StatsBomb pass coverage
    - README chart list if present
    - Component ship checklist row if that doc maintains per-component state

## Re-entry logic

- **On review checkpoint 1 finding a compute-shape change:** update `pass-flow.ts`, refresh `fixtures/pass-flow.baseline.json`, rerun step 4 tests. Do NOT proceed to primitives (step 5) with a stale fixture.
- **On review checkpoint 2 finding a renderer-level issue that requires compute changes:** fall back to step 3; refresh fixture at step 4; re-do steps 5–8.
- **On step 10 flip:** amend spec (one-time, tracked in this packet), regenerate baseline fixture (step 4 redo), regenerate golden SVG fixtures (step 8 redo). No other rework needed since `valueMode`/`colorScale` defaults are metadata changes.

## Verification

- `pnpm typecheck`
- `pnpm test` (targeted, then full): `pass-flow.test`, `circular.test`, `compute-heatmap.test`, `PassFlow.test`, `render-static-svg.test`
- `pnpm lint`
- `pnpm format:check`
- `pnpm --filter @campos/site build`
- `pnpm check` (umbrella)
- Visual verification of demo page: 7 scenarios render; half-crop fix honours all 4 directions; dispersion-floor demo shows visible arrow-vs-glyph difference.

## Review plan (dovetails with spec §Review plan)

Spec review loop 1 = spec adversarial review (already done).
Spec review loop 2 = implementation adversarial review → split into this packet's **checkpoint 1** (post-compute, step 4) and **checkpoint 2** (post-renderer+export, step 8) for granularity.
Spec review loop 3 = release-readiness adversarial review for the battle-test recreation — **deferred to v0.3 beta** alongside animation and the Barcelona showcase. Not part of this packet.
Additionally: **visual-verifier** run on the demo page after step 9.

## Known risks

- **Static-export golden fixtures.** Adding `pass-flow` fixtures is purely additive; no heatmap change means no heatmap fixture churn.
- **Fixture availability.** OL Reign vs Houston Dash may not be in StatsBomb open data. If not, substitute a similar-shape open match and credit in the fixture module.
- **Component-page/Astro routing.** PassFlow is the first chart to land under `pages/components/` (other charts live at top-level `pages/`). Confirm the routing convention at step 9; if mismatched, align to existing pattern (likely top-level `pass-flow.astro`).

## Close-out checklist

Numbered to align with build-order steps where relevant.

- [ ] Step 1: circular util landed + tests pass
- [ ] Step 2: withdrawn (no heatmap change required)
- [ ] Step 3: compute lands; model shape matches spec §Bin model
- [ ] Step 4: compute tests pass; baseline fixture committed; **checkpoint 1 review completed or findings addressed**
- [ ] Step 5: primitives land thin + typed
- [ ] Step 6: renderer landed; file-split pattern matches `PassMap` precedent
- [ ] Step 7: component tests pass (render, hover, focus, a11y, SSR)
- [ ] Step 8: export registration complete across all 5 listed files; 3 golden SVG fixtures committed; **checkpoint 2 review completed**
- [ ] Step 9: demo page renders all 7 scenarios; visual-verifier recorded
- [ ] Step 10: fixture-validation rule computed; result (keep vs flip) recorded in fixture module comment; spec amended if flipped
- [ ] Step 11: status matrix, roadmap, tokens, adapter-gap, README, ship-checklist updated as applicable
- [ ] `pnpm check` clean
- [ ] Site build clean
- [ ] PR description reports the shared-seam addition (circular util) and notes the withdrawn heatmap false-positive
