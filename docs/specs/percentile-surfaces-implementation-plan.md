# Percentile Surfaces Implementation Plan

**Status:** active, ready to execute
**Last updated:** 2026-04-20
**Authoritative spec:** `docs/specs/percentile-surfaces-spec.md`

## Goal

Ship `PercentileBar`, `PercentilePill`, and the compute helper
`resolvePercentileSurfaceModel` from the approved v0.3-alpha spec, with
the demo page, tests, export contract, and the required docs/matrix
updates. No scope beyond the spec.

## Build order

Layer order per `CLAUDE.md` Component Dev Workflow: schema (none) →
adapters (none) → compute → React → recipes → export adapter → index
exports → site fixture/page → tests (co-developed) → docs + matrix
updates → verification.

### Phase 1 — Compute layer

**File:** `packages/react/src/compute/percentile-surface.ts` (new)

Exports:

- types: `PercentileMetric`, `PercentileComparisonSample`,
  `PercentileAccessibleLabel`, `PercentileSurfaceInvalidReason`,
  `PercentileSurfaceModel`
- function: `resolvePercentileSurfaceModel(input: PercentileSurfaceInput): PercentileSurfaceModel`

The model shape is:

```ts
export type PercentileSurfaceInvalidReason =
  | "missingMetricId"
  | "missingMetricLabel"
  | "missingPercentile"
  | "nonFinitePercentile"
  | "missingComparisonLabel";

export type PercentileSurfaceModel = {
  meta: {
    component: "PercentileSurfaces";
    metricId: string | null;
    invalidReason: PercentileSurfaceInvalidReason | null;
    warnings: string[];
  };
  metric: PercentileMetric | null;
  comparison: PercentileComparisonSample | null;
  accessibleLabel: PercentileAccessibleLabel | null;
  // Resolved geometry for renderers. Null when invalidReason is non-null.
  geometry: {
    clampedPercentile: number; // [0, 100]
    tickPositions: readonly [25, 50, 75];
  } | null;
};
```

Validation rules:

1. If `metric.id` missing or empty string → `invalidReason = "missingMetricId"`, no geometry.
2. If `metric.label` missing or empty → `missingMetricLabel`.
3. If `metric.percentile` is `null`/`undefined` → `missingPercentile`.
4. If `metric.percentile` is `NaN`, `Infinity`, `-Infinity` → `nonFinitePercentile`.
5. If the bar-path requires a comparison sample and `comparison.label` is empty → `missingComparisonLabel`.
6. If `metric.percentile < 0` or `> 100` → clamp to endpoint and push the string
   `"percentile ${originalValue} clamped to ${clamped} for metric ${id}"` onto `warnings`.
7. If `comparison.populationSize` is `0` or `1` → push
   `"population sample for metric ${id} is weak (n=${populationSize})"`.
8. Warnings are de-duped: each compute call drops any string identical
   to one already pushed (cheap `new Set<string>()` scoped to this call).
9. On success, build `accessibleLabel`:
   - `metricLabel: metric.label`
   - `percentileText: "${clamped}th percentile"` (handle `1st`/`2nd`/`3rd`/ `-th` suffixes via a tiny helper)
   - `sampleText: comparison.label ?? accessibleSampleLabel` (the React layer
     passes either `comparison.label` or the pill's fallback into the input)
   - `inversionNote: originalDirection === "lower" ? "lower is better" : undefined`

Input shape accepts both the bar's required-comparison path and the
pill's either/or path via a single field `sampleLabel: string` that
both callers resolve upstream — keeps the compute helper independent of
the two renderer APIs.

No rendering-layer imports.

**Test file:** `packages/react/test/compute/compute-percentile-surface.test.ts` (new)

Cover the spec's edge-case matrix directly:

- happy path emits correct `accessibleLabel` for higher-is-better
- happy path emits `inversionNote` only when `originalDirection === "lower"`
- clamp at `0` / `100` (no warning)
- out-of-range (`-5`, `105`) clamp + warning
- `NaN` / `Infinity` / `-Infinity` → invalid reason `"nonFinitePercentile"`
- missing `id` / `label` / `percentile` / `comparison.label` → correct invalid reasons
- `populationSize: 0` and `populationSize: 1` emit weakSample warning; `2`, `absent` do not
- ordinal suffix helper: `1`, `2`, `3`, `4`, `11`, `12`, `13`, `21`, `22`, `23`, `100`
- de-dup: two successive rules that would emit the same string only emit once

### Phase 2 — React renderer

**File:** `packages/react/src/PercentileSurfaces.tsx` (new)

Exports:

- types: `PercentileSurfaceSharedProps`, `PercentileBarProps`,
  `PercentilePillProps`, `PercentileTrackStyle`, `PercentileFillStyle`,
  `PercentileTextStyle`, `PercentileTicksStyle`, `PercentileBadgeStyle`,
  and each context type
- components: `PercentileBar`, `PercentilePill`

Implementation notes:

- Call `resolvePercentileSurfaceModel` once per render. Pass
  `sampleLabel` from `comparison?.label ?? accessibleSampleLabel`.
- When `meta.invalidReason` is non-null, render the shared empty-state
  primitive inside the root `<svg>` — reuse whatever `RadarChart` uses
  for invalid/empty cases (inline text inside the svg, not a separate
  HTML block).
- When valid, resolve each style family via `resolveStyleValue(family, context)`
  with a fallback to the theme-derived default for that family.
- `<svg>` root: `role="img"`, `direction="ltr"`, `aria-label={joinAccessibleLabel(accessibleLabel)}`.
- Warnings: `useEffect` on mount compares `warnings` (join) to a ref,
  emits `onWarnings?.(warnings)` if non-empty, and emits a single
  `console.warn("[campos/percentile-surfaces] <warnings joined>")`
  when `process.env.NODE_ENV !== "production"`. No rerenders, no render-path warns.
- `inversionBadgeLabel` defaults to `"lower is better"`. When
  `originalDirection === "lower"` and `inversionBadgeLabel !== ""`,
  draw the badge capsule. Empty string suppresses the visible badge
  only; `accessibleLabel.inversionNote` is independent.
- Geometry constants live in a private const block at the top of the file
  (e.g. `const BAR_VIEWBOX = { width: 360, height: 56 } as const;`).
  The local `PercentileTrackGeometry` helpers are file-scoped (not exported)
  until a second chart demonstrates the same need.
- Raw-value formatting: default `formatValue = (v) => typeof v === "string" ? v : Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v)`.
  Override via `text.valueFormat`.

**Test file:** `packages/react/test/PercentileSurfaces.test.tsx` (new)

Cover:

- zero-config bar renders metric label + sample label + percentile text
- invalid packet renders empty-state inside the svg; `onWarnings` fires with the expected strings
- lower-is-better: default badge renders ("lower is better" label); root `aria-label` includes inversion note
- `inversionBadgeLabel=""`: visible badge hidden, `aria-label` still carries inversion note
- `showComparisonLabel={false}`: sample label hidden visually, `aria-label` still carries it
- pill with `comparison`: renders sample line
- pill with `accessibleSampleLabel` and `comparison?: undefined`: sample line hidden, `aria-label` uses fallback
- RTL context: `direction="ltr"` set on root `<svg>` (simulated via wrapping `<div dir="rtl">`)
- style family overrides: constant, map, callback for `track` and `fill`
- recipe: `percentileBarRecipes.default` produces expected base props; individual overrides merge on top
- `onWarnings` dedup: two out-of-range updates emit warnings only once per compute call
- keyboard focus: the root `<svg>` receives focus and renders a visible
  focus outline (use `userEvent.tab()` + computed-style assertion on the
  focused element)
- structured `accessibleLabel` fields are asserted directly against the
  compute-model shape (`metricLabel`, `percentileText`, `sampleText`,
  `inversionNote`) independently of the concatenated `aria-label` string
  check — the concatenated check is a single end-to-end smoke test

**Type-only assertion file:** `packages/react/test/PercentileSurfaces.typecheck.ts`
(or extend `export-types.typecheck.ts`)

Cover the pill's discriminated union:

- `<PercentilePill metric={m} />` → `@ts-expect-error` (both required fields missing)
- `<PercentilePill metric={m} accessibleSampleLabel={undefined as any} />` →
  rejected under strict mode
- `<PercentilePill metric={m} comparison={c} />` → accepted
- `<PercentilePill metric={m} accessibleSampleLabel="vs CBs" />` → accepted
- `<PercentilePill metric={m} comparison={c} accessibleSampleLabel="alt" />` → accepted

### Phase 3 — Recipes

**File:** `packages/react/src/percentileSurfaceRecipes.ts` (new)

Mirror the `radarChartRecipes` pattern. Export:

- `percentileBarRecipes` (via `defineChartRecipes`) with keys:
  - `default`: baseline track/fill/text matching the zero-config look
  - `quiet`: muted accents for card-sidebar usage (reduced fill opacity,
    `chrome.surface.muted` track)
- `percentilePillRecipes` with keys:
  - `default`
  - `compact`: hides value (`showValue: false`), smaller intrinsic viewBox

Recipes are theme-aware (they receive `{ theme }`).

**Test file:** extend `packages/react/test/chartRecipes.test.ts` (existing)
— assert both recipes resolve against a theme and produce constants only.

### Phase 4 — Export adapter

**File:** `packages/react/src/export/chart-kind.ts` (existing)

Add `"percentile-bar"` to the `SUPPORTED_EXPORT_CHART_KINDS` tuple.
Do **not** add `"percentile-pill"` — deferred per spec.

**File:** `packages/react/src/export/types.ts` (existing)

- Add import block for the percentile style types
- Add `ExportPercentileBarProps = Omit<PercentileBarProps, ...callback-capable props>` with each style family narrowed via `ExportConstantStyleProps<...>`
- Add `percentile-bar` branch to `ExportChartSpec` union

**File:** `packages/react/src/export/createExportFrameSpec.ts` (existing)

Add the runtime guard branch: reject callback or map values for each
style family on percentile-bar inputs. Follow the precedent used for
`pass-flow` / `pizza-chart` in that file.

**Files:** the chart-kind dispatch is split across two renderers —
update both:

- `packages/react/src/export/StaticExportSvg.tsx` — has **two** `case`
  sites for each chart kind (the pre-render size/props dispatch around
  line 89 and the actual render around line 492). Both need a
  `percentile-bar` branch.
- `packages/react/src/export/ExportFrame.tsx` — has one `case` site
  (around line 45) for the interactive in-app export frame. Add a
  `percentile-bar` branch that renders the same `PercentileBar`
  component with the constant-only props.
- `packages/react/src/export/createExportFrameSpec.ts` — has a
  `radar-chart` branch for spec construction around line 223; add
  `percentile-bar` there too.

**Test:** extend `packages/react/test/ExportFrame.test.tsx`:

- `percentile-bar` with constant-only props renders through `createExportFrameSpec`
- callback `track.fill` rejected at runtime
- `percentile-pill` is not a valid `kind` → type-level assertion

### Phase 5 — Index exports

**File:** `packages/react/src/index.ts` (existing)

Add:

- components: `PercentileBar`, `PercentilePill`
- types: all public types from `PercentileSurfaces.tsx` + compute types
  from `compute/percentile-surface.ts`
- recipes: `percentileBarRecipes`, `percentilePillRecipes`
- compute helper: `resolvePercentileSurfaceModel` (on the main barrel,
  consistent with the D1c public compute-helper stance)

### Phase 6 — Site fixture + demo page

**File:** `apps/site/src/data/percentile-surfaces-demo.ts` (new)

Top-of-file comment: record source URL for the scouting row (pick a
public FBref player page; drop the URL there; mark fixture as
hand-curated).

Export two parallel shapes derived from the same source rows:

```ts
export type PercentileDemoRow = {
  metricId: string;
  metricLabel: string;
  percentile: number;
  rawValue: number;
  rawValueUnit?: string;
  originalDirection?: "higher" | "lower";
  // For the radar conversion:
  radarMin?: number;
  radarMax?: number;
  category?: string;
};

export const percentileDemoRows: readonly PercentileDemoRow[];

// Derived exports:
export const percentileMetrics: readonly PercentileMetric[];
export const percentileRadarRows: readonly RadarChartRow[];
export const percentileDemoComparison: PercentileComparisonSample;
```

Include at least one lower-is-better metric (e.g. "Goals conceded /90" or
"Dispossessed /90") so the inversion badge is demonstrable.

Add a site-level assertion file
(`apps/site/src/data/percentile-surfaces-demo.test.ts`, next to the
fixture) that round-trips the inversion flag:

- every row with `originalDirection === "lower"` in `percentileMetrics`
  maps to `lowerIsBetter: true` in the derived `percentileRadarRows`
  (same index)
- rows without `originalDirection` map to `lowerIsBetter: false` or
  undefined

This guards the honesty-critical mapping the spec's hybrid-demo
methodology note depends on.

**File:** `apps/site/src/pages/percentile-surfaces.astro` (new)

Five scenario cards, one section each:

1. **Baseline** — `PercentileBar` list of ~6 metrics with explicit sample
2. **Fallback** — one bar with a deliberately invalid percentile (NaN) to show the empty-state primitive
3. **Stress** — `PercentilePill` row stack (12+ pills, mix of directions)
4. **Hybrid** — side-by-side `RadarChart` (from `percentileRadarRows`) and `PercentileBar` list (from `percentileMetrics`) with a methodology note explaining when to use which
5. **Theme** — baseline card wrapped in a dark-theme island, identical data

Use the existing `DemoCard`/page-section helpers in `apps/site/src/components/`
if available; match the shape of `radarchart.astro` for layout parity.

### Phase 7 — Docs + matrix updates

**File:** `docs/standards/adapter-gap-matrix.md` — append the row from
the spec's Pre-implementation prep section, under
"Component readiness summary".

**File:** `docs/status/react-renderer-audit.md` — append the
`accepted` entry for the local `PercentileTrackGeometry` primitive with
the rationale from the spec.

**File:** `docs/status/matrix.md` — flip W4b status from `partial` to
`done`; update exit criteria narrative to reference the shipped files.

**File:** `docs/status/matrix.md` Components table — add a row for
`PercentileBar` / `PercentilePill` under Components (analogous to
`RadarChart` and `PizzaChart` rows), marking all R1 columns `n/a` or
`done` as appropriate. Add demo page to the Demo Pages table.

### Phase 8 — Verification

Run in this order; stop and fix if any step fails:

1. `pnpm install` (safety — picks up any new files)
2. `pnpm generate:schema` (no changes expected, run for consistency)
3. `pnpm lint` → `pnpm lint:fix` if needed
4. `pnpm format:check` → `pnpm format` if needed
5. `pnpm typecheck`
6. `pnpm test` — full suite
7. `pnpm --filter @withqwerty/campos-site build` — site build must pass
8. `pnpm verify:package-imports` — per `feedback_pre_push_checks`
9. Visual verification in Chrome for `/percentile-surfaces` — five
   scenarios load, dark theme card has acceptable contrast, inversion
   badge renders on the lower-is-better metric, hybrid demo teaches the
   choice. (Use the existing dev server if one is running; otherwise
   ask the user to start it — per `feedback_dev_server`.)

## Files touched — summary

**Create:**

- `packages/react/src/compute/percentile-surface.ts`
- `packages/react/src/PercentileSurfaces.tsx`
- `packages/react/src/percentileSurfaceRecipes.ts`
- `packages/react/test/compute/compute-percentile-surface.test.ts`
- `packages/react/test/PercentileSurfaces.test.tsx`
- `packages/react/test/PercentileSurfaces.typecheck.ts` (or extend existing)
- `apps/site/src/data/percentile-surfaces-demo.ts`
- `apps/site/src/pages/percentile-surfaces.astro`

**Modify:**

- `packages/react/src/index.ts`
- `packages/react/src/export/chart-kind.ts`
- `packages/react/src/export/types.ts`
- `packages/react/src/export/createExportFrameSpec.ts`
- `packages/react/src/export/StaticExportSvg.tsx` (two case sites)
- `packages/react/src/export/ExportFrame.tsx`
- `packages/react/test/ExportFrame.test.tsx`
- `packages/react/test/chartRecipes.test.ts`
- `docs/standards/adapter-gap-matrix.md`
- `docs/status/react-renderer-audit.md`
- `docs/status/matrix.md`

## Risks and mitigations

- **Empty-state primitive shape unknown until mid-build.** `RadarChart`
  uses inline svg `<text>` with a fallback message for "too few
  metrics". Mirror that pattern; do not introduce a new empty-state
  seam.
- **Ordinal suffix helper may already exist.** Grep for `ordinalSuffix`
  / `"th"` / `"st"` usages in `packages/react/src/compute/scales/` and
  reuse if found; otherwise add a 10-line helper inside
  `compute/percentile-surface.ts` without exporting it.
- **`chartRecipes.ts` may expect a specific theme shape.** Match the
  `radarChartRecipes.ts` callable-token pattern exactly.
- **Hybrid demo radar shape mismatch.** Source rows carry both `percentile`
  and `rawValue`; radar derivation sets `value = rawValue`, uses
  `percentile` directly, and flags `lowerIsBetter: originalDirection === "lower"`.
  Keep the conversion in the fixture module, not in the chart.
- **Export dispatcher pattern.** Before editing, read the existing
  `pass-flow` / `radar-chart` branches to confirm the exact function
  that maps `ExportChartSpec` → React element. Do not invent a new
  dispatcher seam.

## Out of scope

- Adapter-level percentile generation (deferred per spec)
- PassSonar / SmallMultiples coordination (W4c / W4d packets)
- Reusable Campos percentile fixture module
- Extracting a generic linear-track primitive
- Static export for `PercentilePill`
