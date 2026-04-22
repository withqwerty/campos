# Chart Reference Layers Implementation Packet

**Status:** open, ready for execution
**Owner:** Claude Code
**Target version:** v0.2.x
**Depends on:**

- `docs/specs/chart-reference-layers-spec.md` (signed off at v5, 2026-04-18)
- existing `LineChart` + `computeLineChart` + primitives (`ChartPlotAreaBackground`, `ChartCartesianAxes`, `resolveStyleValue`)
- existing theme types (`UITheme`)
- no adapter changes

## Product scope

This packet delivers the full spec:

- **Two new primitives:** `ChartPlotAreaBands`, `ChartPlotAreaReferenceLines`
- **LineChart extensions:** `bands`, `references`, `envelopes` props; `series[].hidden` flag
- **Pre-release breaking changes:** delete `events` prop, rename `validSeries` → `dataSeries` + add `visibleSeries`
- **Six helper factories:** `managerEventRef`, `seasonEventRef`, `goalEventRef`, `diagonalFromLinear`, `envelopeCenterOffset`, `diagonalSeries`
- **Six demo scenarios** on `/linechart` page, including Lorenz as canonical z-order acceptance test
- **Three fixture modules** sourced from real data

**Explicitly out of scope** (deferred, tracked in spec §Explicit non-goals):

- `XGTimeline.backgroundBands` migration
- ScatterPlot / DistributionChart / Beeswarm adoption of the new primitives
- Non-linear curve interpolation inside envelopes
- `y2`-bound bands / references
- Gradient fills, hit-testing/tooltips on layers, animation
- Structured-object warnings (`meta.warnings` stays `string[]` with `[code]` prefix convention)
- CI around internal regression trendlines

If any scope creeps beyond this list, stop and propose before continuing.

## Shared-seam fixes required

None detected. The two new primitives are additive, the `LineChart` extensions are prop-level, and the migration is a clean find-replace. No other charts touched.

## File inventory

### New files

| Path                                                                  | Purpose                                                        |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `packages/react/src/primitives/ChartPlotAreaBands.tsx`                | Bands primitive                                                |
| `packages/react/src/primitives/ChartPlotAreaReferenceLines.tsx`       | Reference-lines primitive                                      |
| `packages/react/src/compute/linearScale.ts`                           | Domain-to-plot linear scale helper (extract if not present)    |
| `packages/react/src/compute/liangBarsky.ts`                           | 2D segment-clipping utility                                    |
| `packages/react/src/compute/envelope.ts`                              | Envelope merged-grid resolver + crossover-split path builder   |
| `packages/react/src/helpers.ts`                                       | Six helper factories (create or extend existing)               |
| `packages/react/test/primitives/ChartPlotAreaBands.test.tsx`          | Primitive tests                                                |
| `packages/react/test/primitives/ChartPlotAreaReferenceLines.test.tsx` | Primitive tests                                                |
| `packages/react/test/compute/liang-barsky.test.ts`                    | Clipping unit tests                                            |
| `packages/react/test/compute/envelope.test.ts`                        | Envelope compute tests                                         |
| `packages/react/test/helpers.test.ts`                                 | Helper factory tests                                           |
| `packages/react/test/fixtures/league-table/pl-2023-24-pace.ts`        | Fixture: PL 23-24 actual + top-4 pace series                   |
| `packages/react/test/fixtures/aging-curve/index.ts`                   | Fixture: synthetic position-group aging curve + player overlay |
| `packages/react/test/fixtures/league-table/competitive-balance.ts`    | Fixture: PL 2014-24 cumulative-share curve (Lorenz)            |

### Modified files

| Path                                                     | Change                                                                                                                                                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/compute/line-chart.ts`               | Add envelope types + compute; add `hidden` flag semantics; rename `validSeries` → `dataSeries`; add `visibleSeries`; delete `LineChartEventInput` + `LineChartEventModel` + `events` field; remove `EventGuides` model emission |
| `packages/react/src/LineChart.tsx`                       | Add `bands`/`references`/`envelopes` props; delete `events` prop + `EventGuides` component + `LineChartEventStyle` type; wire primitives into scene; enforce z-order                                                            |
| `packages/react/src/index.ts`                            | Re-export new types + helpers; drop `LineChartEventInput` / `LineChartEventModel` re-exports (lines 28-29, 428-429)                                                                                                             |
| `packages/react/src/compute/index.ts`                    | Drop `LineChartEventInput` / `LineChartEventModel` re-exports (lines 209-210)                                                                                                                                                   |
| `packages/react/test/compute/compute-line-chart.test.ts` | Lines 143-164: rewrite `events` assertions as `references` assertions; migrate `model.events` → `model.references` (removed), `validSeries` → `dataSeries`/`visibleSeries`                                                      |
| `packages/react/test/LineChart.test.tsx`                 | Lines 64-71: swap `events` prop for `references`; change `getByTestId("line-events")` → `getByTestId("line-references")`                                                                                                        |
| `apps/site/src/components/LineChartPreview.tsx`          | Lines 31, 53: `events={lineChartDemoEvents}` → `references={lineChartDemoReferences}`                                                                                                                                           |
| `apps/site/src/data/line-chart-demo.ts`                  | Rename export `lineChartDemoEvents` → `lineChartDemoReferences`; convert each entry from `LineChartEventInput` to `PlotAreaReferenceLine` using helpers                                                                         |
| `apps/site/src/data/showcase-newcastle-trendline.ts`     | Line 140: rename `newcastleTrendlineEvents` → `newcastleTrendlineReferences`; convert                                                                                                                                           |
| `apps/site/src/pages/linechart.astro`                    | Lines 33 + 88-93: update docs and example code from `events` to `references`; add 5 new demo scenarios                                                                                                                          |
| `apps/site/src/pages/primitives.astro`                   | Add API-only entries for `ChartPlotAreaBands` and `ChartPlotAreaReferenceLines`                                                                                                                                                 |
| `docs/status/matrix.md`                                  | Update LineChart row; add entries for new primitives                                                                                                                                                                            |

### Deleted files

None — everything scoped into the two modified `LineChart` files.

## Phase ordering

Phases 1, 2, 3 can run in parallel. Phase 4 depends on 1. Phase 5 depends on 1+4. Phase 6 depends on 2+3+4+5+7. **Phase 6b must complete atomically with the consumer migration** because the `events` prop deletion breaks `apps/site` compile until consumers migrate. Phase 7 can interleave from phase 4 onward. Phase 8 depends on 6. Phases 9+10 are verification + close-out.

For a single-implementer sequential path (recommended): 1 → 2 → 3 → 4 → 5 → 7 → 6a → 6b → 8 → 9 → 10.

---

## Phase 1 — Meta-type migration (isolated breaking change)

**Goal:** Rename `LineChartModel.meta.validSeries` → `dataSeries`, add `visibleSeries` field populated identically to `dataSeries` for now (they diverge in Phase 4 when `hidden` lands).

**Why first:** isolates the test churn from breaking-type changes before behaviour changes. Lets later phases layer cleanly.

**Files touched:**

- `packages/react/src/compute/line-chart.ts` — update `LineChartModel.meta` type and `computeLineChart` meta-building block.
- `packages/react/test/compute/compute-line-chart.test.ts` — update every `validSeries` assertion to `dataSeries`; no `visibleSeries` assertions yet (Phase 4 adds them).
- Any other consumer of `model.meta.validSeries` — grep; expected to be only in tests.

**Tests required:**

- Existing tests pass after rename.
- New assertion: `visibleSeries === dataSeries` when no series has `hidden: true`.

**Exit criteria:**

- `pnpm typecheck` passes with no `validSeries` references left.
- `pnpm test` green.

---

## Phase 2 — Primitive A: `ChartPlotAreaBands`

**Goal:** Ship the first new primitive with its own compute model, rendering, label placement, and collision logic.

**Files:**

- `packages/react/src/compute/linearScale.ts` (new) — extract `(domain, plotDim) => (v) => px` linear scale builder used by both primitives. Check if existing charts have this inline; if so, extract with a single-import migration.
- `packages/react/src/primitives/ChartPlotAreaBands.tsx` (new) — types: `PlotAreaBand`, `PlotAreaBandModel` (resolved SVG-space model), `PlotAreaBandsStyleContext`, `PlotAreaBandsStyle`, `ChartPlotAreaBandsProps`. Component resolves bands via `linearScale`, handles `labelPlacement` auto-flip at <24px, computes `labelPriority`-ordered collision suppression with >4px overlap rule, emits `[band.zero-width]` / `[band.out-of-domain]` / `[band.label-suppressed]` warnings.
- `packages/react/src/index.ts` — re-export `PlotAreaBand`, `PlotAreaBandModel`, `PlotAreaBandsStyle`, `ChartPlotAreaBandsProps`.
- `packages/react/test/primitives/ChartPlotAreaBands.test.tsx` (new) — cover every row in the Bands edge-case matrix from the spec.

**Warnings emitted:**

- `[band.zero-width]`
- `[band.out-of-domain]`
- `[band.label-suppressed]`

**Tests required (matches spec §Edge-case matrix → Bands):**

- Empty bands renders nothing.
- Inverted range silently normalised.
- Range beyond domain clipped to plot area.
- Range outside domain → drop + warn.
- Zero-width range → drop + warn.
- Mixed-axis bands: all render, input-order layering.
- Overlapping bands: later on top.
- Narrow band (<24px on-axis) auto-flips `labelPlacement` to `"above"`.
- Many narrow bands: priority-ordered selection; later ties suppressed; warning fires.
- Multibyte / emoji label: no mangling.

**Exit criteria:**

- Primitive compiles and renders standalone.
- All edge cases covered.
- Accessible `<title>` and `aria-label` produce expected strings for labelled bands.

---

## Phase 3 — Primitive B: `ChartPlotAreaReferenceLines`

**Goal:** Ship the second primitive with Liang-Barsky diagonal clipping.

**Files:**

- `packages/react/src/compute/liangBarsky.ts` (new) — 2D segment-clipping function `clipSegment(p0, p1, rect): [p0', p1'] | null`. Returns null for fully outside / grazing-corner.
- `packages/react/src/primitives/ChartPlotAreaReferenceLines.tsx` (new) — types: `PlotAreaReferenceLine` (3 kinds union), `PlotAreaReferenceLineModel`, `PlotAreaReferenceLinesStyleContext`, `PlotAreaReferenceLinesStyle`, `ChartPlotAreaReferenceLinesProps`. Handles the three kinds (`horizontal`, `vertical`, `diagonal`) with per-kind label positioning, uses `liangBarsky` for diagonal clipping, emits `[reference.degenerate]` / `[reference.out-of-domain]` / `[reference.no-plot-intersection]` warnings.
  - **Design lock:** the component accepts a `layer?: "body" | "labels" | "both"` prop defaulting to `"both"`. LineChart in Phase 6 uses `layer="body"` below series and `layer="labels"` above series to satisfy the spec z-order where reference labels elevate above data for legibility. Ship Phase 3 with all three `layer` values tested — NOT as a breaking follow-up.
- `packages/react/src/index.ts` — re-export.
- `packages/react/test/compute/liang-barsky.test.ts` (new) — every corner permutation: both in, one in, chord enters-top-exits-right / enters-left-exits-right / enters-bottom-exits-top, both out same side, both out opposite sides with chord through, both out grazing corner.
- `packages/react/test/primitives/ChartPlotAreaReferenceLines.test.tsx` (new) — spec §Edge-case matrix → Reference lines.

**Warnings emitted:**

- `[reference.degenerate]`
- `[reference.out-of-domain]`
- `[reference.no-plot-intersection]`

**Tests required:**

- Horizontal y outside domain → drop + `[reference.out-of-domain]`.
- Vertical x outside domain → drop + `[reference.out-of-domain]`.
- Diagonal `from === to` → drop + `[reference.degenerate]`.
- Diagonal with non-finite coordinates → drop + `[reference.degenerate]`.
- Diagonal both endpoints outside, chord intersects → Liang-Barsky clip to plot area.
- Diagonal both endpoints outside, chord grazes corner → drop + `[reference.no-plot-intersection]`.
- Diagonal fully inside → render as-is.
- Label position outside plot area → permitted.
- Label anchor variants (`start` / `middle` / `end`) for each kind.
- `layer="body"`: only bodies render; no labels.
- `layer="labels"`: only labels render; no line bodies.
- `layer="both"` (default): both render.

**Exit criteria:**

- Primitive compiles and renders standalone.
- All edge cases covered.
- Diagonal label renders at `to` endpoint by default.

---

## Phase 4 — `series[].hidden` semantics

**Goal:** Implement the full spec §`series[].hidden` semantic specification table.

**Files:**

- `packages/react/src/compute/line-chart.ts` — add `hidden?: boolean` to `LineChartSeriesInput`. Update 8 code paths:
  1. Point validation runs normally.
  2. X-domain inference includes hidden series; emit `[hidden.extends-x-domain]` always when it extends.
  3. Y-domain inference same; `[hidden.extends-y-domain]`.
  4. Palette index assignment skips hidden entries (visible-only enumeration).
  5. Series-render loop excludes hidden (no path, no markers).
  6. Trendline computation skipped entirely when `hidden`.
  7. End-label building excludes hidden.
  8. `highlightSeries` targeting a hidden id → ignore + `[highlight.hidden-target]` warning.
  9. `meta.visibleSeries` = count of series that have ≥1 valid point AND are not hidden.
  10. `meta.accessibleLabel` uses `visibleSeries`.
- `packages/react/src/LineChart.tsx` — update legend / end-label / marker render paths to respect `hidden` on `seriesModel`.
- `packages/react/test/compute/compute-line-chart.test.ts` — new test block covering every hidden-flag row in the spec matrix.

**Warnings emitted (new):**

- `[hidden.extends-x-domain]`
- `[hidden.extends-y-domain]`
- `[highlight.hidden-target]`

**Tests required (matches spec §Edge-case matrix → `series[].hidden`):**

- Hidden extends x-domain → warning fires.
- Hidden extends y-domain → warning fires.
- All-hidden chart → empty state.
- Palette indices skip hidden: visible series #2 gets `palette[1]` even if input index #1 is hidden between them.
- Hidden with `trendline: true` → trendline not computed.
- `highlightSeries` → hidden id → ignored + warning.
- `totalSeries` / `dataSeries` / `visibleSeries` accounting verified for every permutation.
- `accessibleLabel` counts visible only.

**Exit criteria:**

- All hidden-flag tests pass.
- No regressions on existing LineChart tests.
- `visibleSeries < dataSeries` when hidden series exist.

---

## Phase 5 — Envelope compute

**Goal:** Implement envelope compute in `packages/react/src/compute/envelope.ts` and integrate into `computeLineChart`.

**Files:**

- `packages/react/src/compute/envelope.ts` (new) — types: `LineChartEnvelope` (3 kinds union), `LineChartEnvelopeModel` (resolved SVG-space model with polygon path + per-segment colour map). Functions:
  - `mergeXGrid(boundA, boundB, overlap)` — sorted union of x values within overlap interval.
  - `interpolate(bound, x)` — linear interpolation between nearest two points.
  - `resolveSeriesPair(model, env)` — returns `{boundA, boundB}` or emits `[envelope.unknown-series]`.
  - `resolveCenterOffset(model, env)` — returns bounds or emits `[envelope.bounds-mismatch]`.
  - `resolveSeriesToReference(model, env, references)` — returns bounds or emits `[envelope.unknown-reference]` / `[envelope.vertical-reference]`.
  - `computeEnvelopePath(boundA, boundB)` — walks merged grid, detects crossovers, emits signed SVG path segments keyed by `fillPositive` / `fillNegative`.
- `packages/react/src/compute/line-chart.ts` — thread `envelopes` input through into `model.envelopes` resolved via the above.
- `packages/react/test/compute/envelope.test.ts` (new) — cover every row in the spec §Edge-case matrix → Envelopes.

**Warnings emitted (new):**

- `[envelope.unknown-series]`
- `[envelope.unknown-reference]`
- `[envelope.vertical-reference]`
- `[envelope.bounds-mismatch]`
- `[envelope.no-overlap]`
- `[envelope.insufficient-points]`
- `[envelope.truncated]`
- `[envelope.inverted-bounds]`

**Tests required (matches spec §Edge-case matrix → Envelopes):**

- `series-pair` unknown id → drop + warn.
- `series-pair` disjoint x → drop + warn.
- `series-pair` identical bounds → zero-width render.
- `series-pair` sign alternates → crossovers + two-colour split.
- `series-pair` sparse x on one side → merged-grid single polygon.
- `center-offset` length mismatch → drop + warn.
- `center-offset` with majority inverted → warning + render normally.
- `series-to-reference` unknown reference → drop + warn.
- `series-to-reference` with vertical reference → drop + warn.
- `series-to-reference` with horizontal reference → constant-y envelope.
- `series-to-reference` with diagonal reference → linear y(x) envelope (Lorenz topology verified).
- `series-to-reference` with `referencesStyle.show === false` → envelope still computes off declared geometry.
- Hidden series referenced by envelope → no `[hidden.extends-*]` suppression (fires always per v5 lock).
- Envelope whose source series gets truncated → `[envelope.truncated]` emitted.

**Exit criteria:**

- All envelope tests pass.
- Merged-grid path construction snapshot-stable for Lorenz fixture.
- `model.envelopes` is an array of resolved `LineChartEnvelopeModel`.

---

## Phase 6 — LineChart integration (two sub-phases)

Phase 6 is split because deleting the `events` prop breaks `apps/site` compile. Phase 6a is non-breaking additive. Phase 6b is the breaking deletion + consumer migration in one atomic commit.

### Phase 6a — additive integration (non-breaking)

**Goal:** Wire the two primitives and envelope renderer into `LineChartScene` alongside existing `events`. Enforce z-order. No deletions.

**Files:**

- `packages/react/src/LineChart.tsx`:
  - Add `bands`, `bandsStyle`, `references`, `referencesStyle`, `envelopes`, `envelopesStyle` props (all optional — `events` remains working).
  - Import `ChartPlotAreaBands`, `ChartPlotAreaReferenceLines` from primitives.
  - Inside `LineChartScene`, render in the locked z-order:
    1. `ChartPlotAreaBackground`
    2. `ChartPlotAreaBands` (bodies + `inside` labels + `above/below` labels outside plot)
    3. Grid lines
    4. Envelope paths (from `model.envelopes`)
    5. `ChartPlotAreaReferenceLines` bodies (`layer="body"`)
    6. Series lines
    7. Series markers
    8. `ChartPlotAreaReferenceLines` labels (`layer="labels"`)
    9. `EventGuides` (temporarily still rendering; deleted in 6b)
    10. End labels / score strip / chart frame
  - Update `model.meta.accessibleLabel` composition to enumerate in spec order: visible series → bands → references → envelopes. **Note:** this is the second rewrite of `accessibleLabel` — Phase 4 already added `visibleSeries` awareness. Tests written in Phase 4 for `accessibleLabel` must be updated here to include the bands/references/envelopes suffix.
  - Update static-mode path to match.
- `packages/react/src/compute/line-chart.ts`:
  - Add `bands`, `references`, `envelopes` inputs to `ComputeLineChartInput`.
  - Resolve bands / references into `model.bands` / `model.references` (data-space spec carried through; SVG-space projection happens in primitives).
- `packages/react/src/index.ts` — re-export `PlotAreaBand`, `PlotAreaReferenceLine`, `LineChartEnvelope`, and their model + style types.
- `packages/react/test/LineChart.test.tsx` — add new tests for bands / references / envelopes props alongside existing `events` tests.
- `packages/react/test/compute/compute-line-chart.test.ts` — add new assertions for `model.bands` / `model.references` / `model.envelopes`.

**Tests required:**

- All layers + trendlines + existing `events` in one chart render in spec z-order (compatibility check).
- Theme switch renders all layers with theme defaults.
- Static-mode / SSR: all layers render.

**Exit criteria:**

- `pnpm check` green with both `events` and `references` coexisting.
- All existing tests still pass.

### Phase 6b — breaking deletion + consumer migration (atomic)

**Goal:** Delete `events` across the whole workspace in a single commit so the typechecker is never red on `main`.

**Files (all modified in one commit):**

- `packages/react/src/LineChart.tsx`:
  - Delete `events` prop from `LineChartProps`; delete `eventStyle` prop + `LineChartEventStyle` + `LineChartEventStyleContext`; delete `EventGuides` component and its render site.
- `packages/react/src/compute/line-chart.ts`:
  - Delete `LineChartEventInput`, `LineChartEventModel` type exports.
  - Delete `events` field from `ComputeLineChartInput` and `LineChartModel`.
  - Delete event-resolution block.
- `packages/react/src/index.ts` — drop `LineChartEventInput` / `LineChartEventModel` / `LineChartEventStyle` re-exports (lines 28-29 + 428-429 — grep to confirm exact lines at implementation time).
- `packages/react/src/compute/index.ts` — drop `LineChartEventInput` / `LineChartEventModel` re-exports (lines 209-210).
- `packages/react/test/LineChart.test.tsx` — delete `events` tests; rename `getByTestId("line-events")` → `getByTestId("line-references")` in shared scenarios.
- `packages/react/test/compute/compute-line-chart.test.ts` lines 143-164 — delete `events` assertions; `model.events` field is gone; verify no references remain.
- `apps/site/src/data/line-chart-demo.ts`:
  - Rename export `lineChartDemoEvents` → `lineChartDemoReferences`.
  - Convert each entry. Mapping: `kind: "manager"` → `managerEventRef(x, label)`; `kind: "season"` → `seasonEventRef(x, label)`; `kind: "goal"` → `goalEventRef(x, label)`; `kind: "generic"` or absent → `{ kind: "vertical", x, label, strokeDasharray, stroke }` (plain literal, preserving original styling).
  - Drop `LineChartEventInput` import; add `PlotAreaReferenceLine` import.
- `apps/site/src/data/showcase-newcastle-trendline.ts` line 140 — rename `newcastleTrendlineEvents` → `newcastleTrendlineReferences`; convert entries identically.
- `apps/site/src/components/LineChartPreview.tsx` lines 31, 53 — replace `events={lineChartDemoEvents}` with `references={lineChartDemoReferences}`.
- `apps/site/src/pages/linechart.astro` lines 33, 88-93 — update prose from `events` to `references`; update example code block.

**Tests required (spec §Edge-case matrix → Cross-concern):**

- All layers + trendlines in one chart render in spec z-order (no more `events` layer).
- Lorenz snapshot — the canonical z-order acceptance test (even though the user-facing demo is added in Phase 8, snapshot-pin the underlying rendering here using a local synthetic fixture).
- `accessibleLabel` order matches spec worked example.

**Exit criteria:**

- `pnpm check` green across the whole workspace.
- `pnpm --filter @withqwerty/campos-site build` succeeds.
- Zero `events` references anywhere in `packages/react/src/` or `apps/site/src/` — grep to verify.
- Existing site demos render identically to pre-migration (visual verification in browser; see Phase 9 for dev-server policy).

---

## Phase 7 — Helpers

**Goal:** Ship the six helper factories with `Omit<>` type safety.

**Files:**

- `packages/react/src/helpers.ts` (new or extend) — six exports:
  - `managerEventRef(x, label?)`
  - `seasonEventRef(x, label?)`
  - `goalEventRef(x, label?)`
  - `diagonalFromLinear(slope, intercept, xDomain, extra?)` — `extra` typed with `Omit<Extract<PlotAreaReferenceLine, {kind: "diagonal"}>, "kind" | "from" | "to">` to prevent override of computed fields.
  - `envelopeCenterOffset(centerSeriesId, centerPoints, offsetUpper, offsetLower, extra?)` — `extra` typed with `Omit<Extract<LineChartEnvelope, {kind: "center-offset"}>, "kind" | "centerSeriesId" | "bounds">`.
  - `diagonalSeries(id, from, to, extra?)` — `extra` typed with `Omit<LineChartSeriesInput, "id" | "points" | "hidden">`.
- `packages/react/src/index.ts` — re-export all six.
- `packages/react/test/helpers.test.ts` (new) — unit tests per helper; `Omit<>` behaviour verified via type assertion tests (`expectTypeOf`).

**Tests required:**

- Each helper returns the expected shape.
- `extra` parameter cannot override computed fields (type-level assertion).
- Default stroke / dasharray / colour values match spec.

**Exit criteria:**

- Helpers exported and typed.
- Tests pass including type-level assertions.

---

## Phase 8 — Fixtures + demos + primitive pages

**Goal:** Real-data fixtures + 5 new demo scenarios on `/linechart` + API-only entries on `/primitives`.

### 8a — Fixtures

- `packages/react/test/fixtures/league-table/pl-2023-24-pace.ts` (new):
  - Two series: `actual` (weekly cumulative points) and `pace` (top-4 reference pace computed as average of 4th-placed cumulative points per matchweek across recent seasons, OR a flat linear extrapolation of the 4th-placed final total).
  - **Expected source file:** `/Volumes/WQ/projects/www/data/understat/time-series-leagues.json` (probe schema first; it should carry per-matchweek cumulative points per team).
  - **Fallback source** if schema mismatches: FBref CSV at `https://fbref.com/en/comps/9/history/Premier-League-Seasons` — fetch the 2023-24 league-table history page and parse the matchweek table.
  - Record the exact chosen source path + extraction date in the fixture module header comment.
- `packages/react/test/fixtures/aging-curve/index.ts` (new):
  - Two series: `playerTrajectory` (one footballer's per-90 metric over ages 18-34) and `positionMean` (smoothed mean for that position group).
  - Two offset arrays: `sigmaUpper`, `sigmaLower` aligned to `positionMean`.
  - Synthetic is fine for v1; mark as synthetic in the module header.
- `packages/react/test/fixtures/league-table/competitive-balance.ts` (new):
  - Lorenz curve points for PL 2023-24 final table: `x` ∈ [0, 1] = cumulative club share, `y` ∈ [0, 1] = cumulative points share.
  - **Expected source file:** `/Volumes/WQ/projects/www/data/understat/league-chemp.json` (final-table points per club per season; sort ascending, cumulate both axes, normalise to [0, 1]).
  - **Fallback source:** FBref final standings for 2023-24 PL season at `https://fbref.com/en/comps/9/2023-2024/2023-2024-Premier-League-Stats`.
  - Record source path + extraction date in the header.

### 8b — Demo scenarios on `/linechart`

Extend `apps/site/src/pages/linechart.astro` with five new scenario cards (keep baseline unchanged):

1. **Required-rate pace** (fixture 9a.1) — series-pair envelope with `fillPositive` red / `fillNegative` green.
2. **Aging curve ± σ** (fixture 9a.2) — `envelopeCenterOffset()` helper.
3. **Rolling form CI** (fixture 9a.2 or synthetic) — `envelopeCenterOffset()` on rolling xG/90 with ±σ.
4. **Elo river with zones** (synthetic rolling rating) — three bands + `managerEventRef()`.
5. **Lorenz curve** (fixture 9a.3) — diagonal reference + `series-to-reference` envelope. **Canonical z-order acceptance test.**

### 8c — Primitive pages

Extend `apps/site/src/pages/primitives.astro`:

- Section for `ChartPlotAreaBands`: synopsis, signature, one minimal SVG example with synthetic data.
- Section for `ChartPlotAreaReferenceLines`: same shape.

**Tests required:**

- Visual verification in browser of all 5 new demos (interactive inspection, not just snapshot).
- Snapshot tests for each demo scenario on the demo page itself (if the site has snapshot infra).

**Exit criteria:**

- All 5 demos render correctly with real-data fixtures.
- Lorenz demo visually shows dashed diagonal on top of shading, with Lorenz curve on top of everything.
- Primitive pages render with API examples.

---

## Phase 9 — Verification gate

Per `CLAUDE.md` execution contract. Run all checks; fix anything in this packet's change set; report anything outside it without fixing.

```bash
pwd                                                  # confirm we are at the repo root
pnpm check                                           # lint + format + typecheck + test
pnpm build                                           # full workspace build
pnpm --filter @withqwerty/campos-site build          # site build
pnpm verify:package-imports                          # per-memory policy
```

**Gates:**

- `pnpm check` green on files in this packet's change set.
- `pnpm build` produces no type errors in `packages/react/` or `apps/site/`.
- `pnpm verify:package-imports` green.
- **Visual verification** (per CLAUDE.md for UI changes): open `/linechart` in browser and inspect all 6 scenarios. Confirm the Lorenz z-order by eye — dashed diagonal visible on top of the Gini fill, Lorenz curve on top of everything.
- **Dev-server policy:** if the dev server is not already running on `localhost:4321`, **stop and ask the user to start it** — per CLAUDE.md, do not start or restart services without permission.

**Performance baseline** (resolves the envelope-perf known risk):

- Record compute time for the densest demo scenario (rolling form CI) using `console.time`.
- Record compute time for a synthetic 1000-point series + envelope as a stress fixture.
- If the 1000-point compute exceeds 50ms on a typical dev machine, investigate before shipping. Otherwise no action needed — envelope-perf risk is resolved.

If any test outside this packet's change set fails, report — do not fix.

---

## Phase 10 — Review + close-out

Per CLAUDE.md execution contract.

### 10a — Adversarial review (two loops minimum)

- **Loop 2 review (implementation):** spawn `adversarial-reviewer` against the diff. Focus on:
  - Merged-grid envelope correctness vs the spec's worked Lorenz example.
  - Liang-Barsky grazing-corner detection (test + rationale).
  - `hidden`-flag cross-cuts (all 10 rows of the spec table covered in tests?).
  - Warning code completeness (every spec-listed code fires on the expected trigger).
  - Migration completeness (no `events` / `validSeries` references anywhere).
- **Loop 3 review (release-readiness):** visual verification + accessibility pass.

### 10b — Status matrix update

- `docs/status/matrix.md`:
  - Mark `LineChart` row with new extensions (bands / references / envelopes).
  - Add rows for `ChartPlotAreaBands`, `ChartPlotAreaReferenceLines` primitives.
- `docs/roadmap-v0.2.md` if applicable.

### 10c — Close-out checklist

- [ ] All phases complete.
- [ ] `pnpm check` + `pnpm build` + `pnpm verify:package-imports` green.
- [ ] Six demos rendered and verified in browser.
- [ ] Adversarial review loops complete with findings addressed.
- [ ] Status matrix updated.

---

## Known risks

1. **`validSeries` rename ripples outside this packet.** Phase 1 should grep for every `validSeries` consumer in the workspace before renaming. If any external-looking consumer exists, stop and report.
2. **Liang-Barsky grazing-corner precision.** Floating-point equality near zero can misclassify. Use an epsilon of `1e-9` in the intersection calc and test boundary cases explicitly.
3. **Fixture-source access.** `/Volumes/WQ/projects/www/data/` may not contain PL 23-24 matchweek data. Fallback is FBref CSV download into the fixture module's source comment — if that's needed, record the URL explicitly per CLAUDE.md fixture policy.
4. **Grep completeness for `events` / `validSeries`.** Phase 6b's "zero references anywhere" exit criterion assumes the grep finds everything. If any consumer lives outside `packages/react/src/` or `apps/site/src/` (e.g. future-added workspace package), the typecheck will flag it — but grep before committing to catch early. Run `grep -rn "LineChartEventInput\|LineChartEventModel\|validSeries" packages/ apps/` as part of Phase 6b exit.
5. **Envelope polygon with many crossovers + large point counts.** Baseline measured in Phase 9 with a concrete 50ms-at-1000-points threshold. If exceeded, investigate before shipping; fallback options are (a) skip crossover-split for single-colour envelopes, (b) cache merged-grid intermediate.

## Rollback

The packet is one coherent breaking change. Rollback means reverting the merge commit and restoring `events` + `validSeries` code paths from prior. No partial rollback path because the migration phase deletes the old types entirely.

If rollback is needed mid-implementation, branch-level revert before Phase 9. Any phase completed before rollback can be preserved on a separate branch for restart.
