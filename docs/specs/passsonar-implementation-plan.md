# PassSonar Implementation Plan

**Status:** active — Loop 1 plan ready
**Last updated:** 2026-04-20
**Spec source of truth:** `docs/specs/passsonar-spec.md`

This is the file-by-file build plan for W4c. It exists to:

- pin every file path, export, and test name before any code is written
- pin the implementation order so check failures do not cascade
- pin the verification gate (typecheck, tests, lint, format, site build,
  visual verification)

If a build decision diverges from this plan, update this file in the same
commit so the plan never lies about the shipped state.

## File map

### New files (compute layer)

```
packages/react/src/compute/pass-sonar.ts
packages/react/test/compute/compute-pass-sonar.test.ts
```

### New files (React layer)

```
packages/react/src/PassSonar.tsx
packages/react/test/PassSonar.test.tsx
```

### New files (demo layer)

```
apps/site/src/pages/passsonar.astro
apps/site/src/components/PassSonarPreview.tsx
apps/site/src/data/passsonar-demo.ts
```

### Edited files

```
packages/react/src/compute/index.ts          (re-export new types + helper)
packages/react/src/index.ts                  (re-export PassSonar + props/types)
packages/react/src/export/types.ts           (add ExportPassSonarProps + union member)
packages/react/src/export/createExportFrameSpec.ts (add normalizeChart branch)
packages/react/src/export/StaticExportSvg.tsx (add render branch)
packages/react/src/export/chart-kind.ts      (add "pass-sonar" to supported set)
apps/site/src/components/Nav.astro            (add { href: "/passsonar", label: "PassSonar" } to the Non-pitch group at lines 36-49)
docs/status/matrix.md                        (flip W4c row to done after merge)
```

## Layer order

Build in this order — each step is independently reviewable, and tests run
between every step.

1. Compute (`pass-sonar.ts` + tests)
2. React component (`PassSonar.tsx` + tests)
3. Static export wiring (`export/types.ts`, `chart-kind.ts`,
   `createExportFrameSpec.ts`, `StaticExportSvg.tsx`)
4. Public re-exports (`compute/index.ts`, `react/src/index.ts`)
5. Demo page (`passsonar-demo.ts`, `PassSonarPreview.tsx`, `passsonar.astro`)
6. Visual verification + site build

## 1. Compute — `packages/react/src/compute/pass-sonar.ts`

### Public exports

All from `pass-sonar.ts`, re-exported from `compute/index.ts`:

- `PassSonarBinLabel` (string-literal union)
- `PassSonarWedgeModel`
- `DEFAULT_PASS_SONAR_SERIES_COLORS` (constant)
- `formatPassSonarWarning(w): string` (helper used by both compute and React)

Style-context types (`PassSonarWedgeStyleContext`, `PassSonarTextStyleContext`)
live in `PassSonar.tsx` because they reference `UITheme`, not in compute.

- `PassSonarSummaryModel`
- `PassSonarLegendModel`
- `PassSonarWarning` (discriminated union)
- `PassSonarModel`
- `ComputePassSonarInput`
- `computePassSonar(input: ComputePassSonarInput): PassSonarModel`

### Internals

- `BIN_COUNT = 8`, `BIN_WIDTH = Math.PI / 4`, `OFFSET = Math.PI / 8`
- Static label table:
  ```ts
  const BIN_LABELS = [
    "forward",
    "forward-left",
    "left",
    "back-left",
    "back",
    "back-right",
    "right",
    "forward-right",
  ] as const;
  ```
- `assignAngularBin(angleRad: number): number` — implements:
  ```ts
  const TAU = Math.PI * 2;
  const wrapped = (((angleRad + OFFSET) % TAU) + TAU) % TAU;
  return Math.floor(wrapped / BIN_WIDTH); // 0..7
  ```
- `binIntervals(): Array<{ start: number; end: number; centerAngle: number }>`
  — derived once; exported only via `PassSonarWedgeModel.angleStart` / `angleEnd`.
- `accumulator` shape: `{ attempted: number; completed: number; lengthSum: number; lengthCount: number; }`
  per bin.

### Compute pipeline (top-down)

```ts
export function computePassSonar(input: ComputePassSonarInput): PassSonarModel {
  const subjectLabel = input.subjectLabel?.trim() || null;
  const subjectKind = input.subjectKind ?? "player";

  // 1. Validate scaleMaxAttempts
  const { requestedScaleMax, normalisedScaleMax, scaleInvalidWarning } =
    normaliseScaleMax(input.scaleMaxAttempts);

  // 2. Iterate input passes once. Drop missing-coords / missing-result /
  //    subject-mismatch with deduped counters.
  const buckets = emptyBuckets();
  let missingCoords = 0;
  let missingResult = 0;
  let subjectMismatch = 0;

  for (const pass of input.passes) {
    if (input.subjectId != null) {
      const observed = subjectKind === "player" ? pass.playerId : pass.teamId;
      if (observed !== input.subjectId) {
        subjectMismatch += 1;
        continue;
      }
    }
    if (pass.x == null || pass.y == null || pass.endX == null || pass.endY == null) {
      missingCoords += 1;
      continue;
    }
    if (pass.passResult == null) {
      missingResult += 1;
      continue;
    }
    const angle = Math.atan2(pass.endY - pass.y, pass.endX - pass.x);
    const binIndex = assignAngularBin(angle);
    const bucket = buckets[binIndex];
    bucket.attempted += 1;
    if (pass.passResult === "complete") bucket.completed += 1;
    const len = pass.length ?? Math.hypot(pass.endX - pass.x, pass.endY - pass.y);
    if (Number.isFinite(len)) {
      bucket.lengthSum += len;
      bucket.lengthCount += 1;
    }
  }

  // 3. Resolve scaleMax
  const observedMax = Math.max(0, ...buckets.map((b) => b.attempted));
  const totalAttempted = buckets.reduce((s, b) => s + b.attempted, 0);
  const totalCompleted = buckets.reduce((s, b) => s + b.completed, 0);
  const empty = totalAttempted === 0;

  let resolvedMax: number;
  let clampedWarning: PassSonarWarning | null = null;
  if (normalisedScaleMax != null) {
    resolvedMax = normalisedScaleMax;
    if (observedMax > resolvedMax) {
      clampedWarning = { kind: "scale-max-clamped", observedMax, resolvedMax };
    }
  } else {
    resolvedMax = Math.max(1, observedMax); // avoid /0; empty chart degrades to empty state
  }

  // 4. Build wedges
  const intervals = binIntervals();
  const wedges: PassSonarWedgeModel[] = buckets.map((bucket, binIndex) => ({
    binIndex,
    label: BIN_LABELS[binIndex],
    angleStart: intervals[binIndex].start,
    angleEnd: intervals[binIndex].end,
    centerAngle: intervals[binIndex].centerAngle,
    attempted: bucket.attempted,
    completed: bucket.completed,
    completionRate: bucket.attempted === 0 ? 0 : bucket.completed / bucket.attempted,
    averageLength:
      bucket.lengthCount === 0 ? null : bucket.lengthSum / bucket.lengthCount,
    attemptedRadius: Math.sqrt(bucket.attempted / resolvedMax),
    completedRadius: Math.sqrt(bucket.completed / resolvedMax),
  }));

  // 5. Aggregate warnings — both structured (for tests/agents) and string-formatted (for ChartFrame)
  const structuredWarnings: PassSonarWarning[] = [];
  if (missingCoords > 0)
    structuredWarnings.push({ kind: "missing-coords", count: missingCoords });
  if (missingResult > 0)
    structuredWarnings.push({ kind: "missing-result", count: missingResult });
  if (subjectMismatch > 0)
    structuredWarnings.push({
      kind: "subject-mismatch",
      count: subjectMismatch,
      expected: input.subjectId!,
    });
  if (scaleInvalidWarning != null) structuredWarnings.push(scaleInvalidWarning);
  if (clampedWarning != null) structuredWarnings.push(clampedWarning);
  const warnings = structuredWarnings.map(formatPassSonarWarning);

  // 6. Build summary + legend models
  return {
    meta: {
      component: "PassSonar",
      empty,
      subjectLabel,
      requestedScaleMax,
      resolvedScaleMax: resolvedMax,
      warnings,
      structuredWarnings,
    },
    summary: {
      attempted: totalAttempted,
      completed: totalCompleted,
      completionRate: totalAttempted === 0 ? 0 : totalCompleted / totalAttempted,
    },
    wedges,
    legend: {
      rows: [
        { kind: "attempted", label: "Attempted passes", color: "" }, // colour assigned by React layer from theme
        { kind: "completed", label: "Completed passes", color: "" },
      ],
    },
  };
}
```

Key decision: **legend `color` is populated by the React layer from theme**,
not by compute. This keeps compute renderer-agnostic and matches what
RadarChart does for ring colors. Compute returns the structural shape; the
component fills theme-derived fills.

### `formatPassSonarWarning`

```ts
function formatPassSonarWarning(w: PassSonarWarning): string {
  switch (w.kind) {
    case "missing-coords":
      return `Dropped ${w.count} pass${w.count === 1 ? "" : "es"} with missing start/end coordinates`;
    case "missing-result":
      return `Dropped ${w.count} pass${w.count === 1 ? "" : "es"} with no passResult`;
    case "subject-mismatch":
      return `Dropped ${w.count} pass${w.count === 1 ? "" : "es"} not matching subject "${w.expected}"`;
    case "scale-max-invalid":
      return `scaleMaxAttempts=${w.received} is invalid; chart auto-scaled instead`;
    case "scale-max-clamped":
      return `scaleMaxAttempts=${w.resolvedMax} is below observed max ${w.observedMax}; wedges clamped`;
  }
}
```

These exact strings are what the test "scale-max-clamped warning appears in
chart warnings region" asserts against.

### `normaliseScaleMax`

```ts
function normaliseScaleMax(raw: number | undefined): {
  requestedScaleMax: number | null;
  normalisedScaleMax: number | null;
  scaleInvalidWarning: PassSonarWarning | null;
} {
  if (raw == null) {
    return {
      requestedScaleMax: null,
      normalisedScaleMax: null,
      scaleInvalidWarning: null,
    };
  }
  if (!Number.isFinite(raw) || raw < 1) {
    return {
      requestedScaleMax: raw,
      normalisedScaleMax: null,
      scaleInvalidWarning: { kind: "scale-max-invalid", received: raw },
    };
  }
  return {
    requestedScaleMax: raw,
    normalisedScaleMax: Math.ceil(raw),
    scaleInvalidWarning: null,
  };
}
```

## 1b. Compute tests — `packages/react/test/compute/compute-pass-sonar.test.ts`

Vitest. One `describe("computePassSonar", ...)` block. Test names mirror the
spec edge-case matrix.

```
describe("computePassSonar")
  describe("direction binning")
    test("forward bin spans [-π/8, +π/8)")
    test("forward-left bin owns +π/8 inclusive (lower-closed boundary)")
    test("back bin owns +π via wrap-around")
    test("8 contiguous non-overlapping bins tile the unit circle")
    test("Campos canonical frame: pass with (endX>x, endY=y) bins as forward")
    test("Campos canonical frame: pass with (endX<x, endY=y) bins as back")
    test("Campos canonical frame: pass with (endX=x, endY>y) bins as left (attacker's left)")
    test("Campos canonical frame: pass with (endX=x, endY<y) bins as right (attacker's right)")

  describe("passResult semantics")
    test("complete counts attempted and completed")
    test("incomplete counts attempted only")
    test("offside counts attempted only")
    test("out counts attempted only")
    test("null is dropped with kind=missing-result warning")
    test("totals: 5 complete + 3 incomplete + 1 offside + 1 out = 10 attempted, 5 completed")

  describe("missing coordinates")
    test("x null is dropped with kind=missing-coords warning")
    test("y null is dropped with kind=missing-coords warning")
    test("endX null is dropped with kind=missing-coords warning")
    test("endY null is dropped with kind=missing-coords warning")
    test("warning count aggregates across multiple drops")

  describe("subject enforcement")
    test("no subjectId: all passes accepted")
    test("subjectId set with subjectKind=player: drops mismatched playerId")
    test("subjectId set with subjectKind=team: drops mismatched teamId")
    test("subject-mismatch warning carries expected id")
    test("zero matches: model.meta.empty is true and warnings record the mismatches")

  describe("scaleMaxAttempts validation")
    test("undefined: chart auto-scales to observed max")
    test("0 → invalid warning, treat as auto-scale")
    test("-5 → invalid warning")
    test("NaN → invalid warning")
    test("Infinity → invalid warning")
    test("3.7 → ceil to 4, no warning")
    test("integer >= observedMax: no warning, used as resolvedMax")
    test("integer < observedMax: clamped warning recorded")
    test("requestedScaleMax preserved verbatim in meta")

  describe("model shape")
    test("empty input → meta.empty true, summary zeros, no wedges populated")
    test("single pass → exactly one wedge has attempted > 0")
    test("legend.rows has exactly two rows (attempted + completed)")
    test("each wedge has angleStart < angleEnd (modular OK for back bin)")
    test("attemptedRadius and completedRadius are in [0, 1]")
    test("completionRate is 0 when attempted is 0, NaN-safe")
    test("averageLength is null when wedge has zero attempted, otherwise mean of input length")
    test("averageLength recomputed when length is null on input (Math.hypot fallback)")
    test("resolvedScaleMax is always >= 1, integer, finite")

  describe("warnings dedup")
    test("multiple drops of the same kind are merged into one warning with summed count")
    test("warnings array is empty when no drops/clamps occurred")
```

Fixture inputs are constructed inline (small `PassEvent` literals built via a
local `makePass({ x, y, endX, endY, passResult, ... })` helper). Real-data
fixtures live in the demo layer, not the compute test layer — compute tests
prove the math, not the integration.

## 2. React component — `packages/react/src/PassSonar.tsx`

### Public API

```ts
export type PassSonarProps = {
  passes: ReadonlyArray<PassEvent>;
  subjectLabel?: string;
  subjectId?: string;
  subjectKind?: "player" | "team";
  scaleMaxAttempts?: number;
  showLegend?: boolean;
  showSummary?: boolean;
  directionLabels?: "compass" | "cartesian" | false;
  directionLabelsText?: {
    forward?: string;
    back?: string;
    left?: string;
    right?: string;
  };
  wedges?: PassSonarWedgesStyle;
  text?: PassSonarTextStyle;
  methodologyNotes?: ChartMethodologyNotes;
};

export type PassSonarWedgeStyleContext = { wedge, binIndex, label, theme };
export type PassSonarTextStyleContext = { slot: "direction-label" | "summary"; theme };

export type PassSonarWedgesStyle = { ... };  // verbatim from spec
export type PassSonarTextStyle = { ... };
```

### Internal helpers

- `wedgePath(cx, cy, innerR, outerR, startAngle, endAngle): string`
  — SVG `A` arc path generator. innerR is `0` for the attempted/completed
  rendering (wedge sectors, not annular).
- `centerAngleToScreen(centerAngle: number): { x: number; y: number }`
  — converts Campos canonical-frame angle (0 = +x = forward) to screen-space
  coordinates with `forward` at the **top** (12 o'clock). The transform is:
  ```ts
  // Forward (canonical 0 rad / +x) maps to screen "up" (-y in SVG).
  // Attacker's left (canonical +π/2 / +y) maps to screen "left" (-x in SVG).
  // Pre-rotation: rotate canonical angle by -π/2 so 0 rad → -π/2 (up).
  const screenAngle = canonicalAngle - Math.PI / 2;
  return { x: cx + r * Math.cos(screenAngle), y: cy + r * Math.sin(screenAngle) };
  ```
- `buildPassSonarTooltipRows(wedge: PassSonarWedgeModel)` — returns
  `{ label, value }[]`:
  - `Direction → wedge.label`
  - `Attempted → wedge.attempted.toString()`
  - `Completed → wedge.completed.toString()`
  - `Completion → ${Math.round(wedge.completionRate * 100)}%`
  - `Average distance → ${wedge.averageLength.toFixed(1)} m` (omitted when `averageLength == null`)

### Layout constants

```ts
const VIEWBOX_SIZE = 320;
const CENTER = VIEWBOX_SIZE / 2;
const SUMMARY_RESERVED_R = 28; // central pill / summary block
const LABEL_GUTTER = 18; // ring-label outer gutter
const OUTER_R = CENTER - LABEL_GUTTER;
const INNER_R = OUTER_R; // wedges are sectors; inner = OUTER_R * radius factor
const DIRECTION_LABEL_THRESHOLD = 56; // chart inner radius below which "auto" hides labels
```

### Render structure (matches RadarChart pattern)

```tsx
return (
  <ChartFrame
    ariaLabel={ariaLabel}
    chartKind="pass-sonar"
    empty={model.meta.empty}
    maxWidth={420}
    plot={plot}
    legend={legendNode}
    methodologyNotes={methodologyNotes}
    theme={theme}
    warnings={model.meta.warnings}
  />
);
```

The `plot` block is a `<div>` containing:

1. `<svg viewBox="0 0 320 320" ...>` with:
   - `<g data-testid="pass-sonar-wedges">` containing 8 `<g role="img" tabindex="0" aria-label="...">` — each with two `<path>` children (attempted outer, completed inner).
   - `<g data-testid="pass-sonar-direction-labels">` (rendered when `directionLabels === "compass"`) or `<g data-testid="pass-sonar-axis-labels">` (rendered when `directionLabels === "cartesian"`).
   - `<g data-testid="pass-sonar-summary">` (rendered when `showSummary !== false`) — central two-line text: subject label + counts.
2. `<EmptyState>` overlay when `model.meta.empty`.
3. `<ChartTooltip>` when a wedge is hovered/focused.

### Keyboard navigation

- Wedge groups are focusable (`tabIndex={0}`).
- `onKeyDown` handler on each group: arrow-left/up move focus to `(binIndex - 1 + 8) % 8`; arrow-right/down move to `(binIndex + 1) % 8`; Enter/Space toggles the tooltip on/off.
- Focus ring uses native browser outline; do not strip with CSS.

### Theme-derived defaults

`UITheme` has no `chart.series` field; it has `accent.{blue,green,red,...}`
and `surface.{frame,tooltip,plot,badge}`. Per RadarChart's `seriesColors`
pattern (`compute/radar-chart.ts:208-214`), PassSonar exposes a
`seriesColors?: ThemePalette` prop and a `DEFAULT_PASS_SONAR_SERIES_COLORS`
constant living in `pass-sonar.ts`:

```ts
export const DEFAULT_PASS_SONAR_SERIES_COLORS = ["#3b82f6", "#22c55e"]; // blue, green
```

Resolution at the React layer: `const [attemptedColor, completedColor] =
resolveThemePalette(seriesColors, theme) ?? DEFAULT_PASS_SONAR_SERIES_COLORS;`

- `attemptedFill` default: `attemptedColor`
- `completedFill` default: `completedColor`
- `attemptedFillOpacity` default: `0.35`
- `completedFillOpacity` default: `0.85`
- `stroke` default: `theme.surface.plot` (matches the chart canvas — gives
  wedges a visible separator on dense rings; `surface.canvas` does not exist)
- `strokeWidth` default: `0.5`

### Static SVG export entry

`PassSonarStaticSvg` follows the RadarChart pattern: same compute call, same
SVG structure, but no hover/focus handlers, no `<EmptyState>` overlay
(uses `<ChartSvgEmptyState>` inline instead).

## 2b. React tests — `packages/react/test/PassSonar.test.tsx`

```
describe("PassSonar")
  test("zero-config render produces 8 wedge groups + legend + summary")
  test("empty input renders shared EmptyState text 'No passes for this subject'")
  test("custom subjectLabel surfaces in summary and empty-state copy")
  test("subjectId enforcement drops mismatched passes; warnings reflected in chart-warnings slot")
  test("forward wedge renders at 12 o'clock (top of viewBox)")
  test("aria-label on each wedge contains label + attempted/completed counts + percentage")
  test("arrow-right key cycles focus to next wedge index")
  test("arrow-left key cycles focus to previous wedge (wraps at 0 → 7)")
  test("hover surfaces tooltip with documented row order")
  test("tooltip omits 'Average distance' row when wedge has zero attempted passes")
  test("showLegend=false hides the legend slot")
  test("showSummary=false hides the central summary block")
  test("directionLabels='compass' renders wedge-aligned labels")
  test("directionLabels='cartesian' renders four static axis labels")
  test("directionLabels=false hides labels even at default size")
  test("style callback fires with the documented context shape")
  test("style constant overrides default fill")
  test("style map overrides per-bin via context.label")
  test("dark theme picks dark-palette defaults (no contrast regression assertion)")
  test("methodologyNotes slot renders when provided")
  test("scale-max-clamped warning appears in chart warnings region")
```

## 3. Static export wiring

### `packages/react/src/export/types.ts`

Add at the bottom of the import block:

```ts
import type {
  PassSonarProps,
  PassSonarTextStyle,
  PassSonarWedgesStyle,
} from "../PassSonar.js";
```

Add the export-prop alias:

```ts
export type ExportPassSonarProps = Omit<
  PassSonarProps,
  "methodologyNotes" | "wedges" | "text"
> & {
  wedges?: ExportConstantStyleProps<PassSonarWedgesStyle>;
  text?: ExportConstantStyleProps<PassSonarTextStyle>;
};
```

Add to `ExportChartSpec` union:

```ts
| {
    kind: "pass-sonar";
    props: ExportPassSonarProps;
  }
```

### `packages/react/src/export/chart-kind.ts`

Add `"pass-sonar"` to the supported-kind allowlist (mirror existing entries).

### `packages/react/src/export/createExportFrameSpec.ts`

In `normalizeChart()` add a branch:

```ts
if (chart.kind === "pass-sonar") {
  assertConstantStyleObject(chart.props.wedges, "pass-sonar.wedges");
  assertConstantStyleObject(chart.props.text, "pass-sonar.text");
  return chart;
}
```

### `packages/react/src/export/StaticExportSvg.tsx`

- Add import: `import { PassSonarStaticSvg } from "../PassSonar.js";`
- Add to `chartAspectRatio()`: `case "pass-sonar": return 1;`
- Add render branch in the main switch.
- Add `resolveLegend()` branch: returns the two-row legend with theme-resolved colours.

## 4. Public re-exports

### `packages/react/src/compute/index.ts`

Add re-exports immediately after the `pass-network-transforms` block (around
line 88, keeping the `pass-*` cluster contiguous; the file groups by topic,
not alphabetically):

```ts
export { computePassSonar } from "./pass-sonar.js";
export type {
  ComputePassSonarInput,
  PassSonarBinLabel,
  PassSonarLegendModel,
  PassSonarModel,
  PassSonarSummaryModel,
  PassSonarWarning,
  PassSonarWedgeModel,
} from "./pass-sonar.js";
```

### `packages/react/src/index.ts`

Add at the appropriate alphabetical position:

```ts
export { PassSonar, PassSonarStaticSvg } from "./PassSonar.js";
export type {
  PassSonarProps,
  PassSonarTextStyle,
  PassSonarTextStyleContext,
  PassSonarWedgeStyleContext,
  PassSonarWedgesStyle,
} from "./PassSonar.js";
```

Append to the existing barrel of compute re-exports — `computePassSonar` and the
model types — so consumers can import everything from
`@withqwerty/campos-react`.

Add `ExportPassSonarProps` to the existing export-types re-export block.

## 5. Demo layer

### `apps/site/src/data/passsonar-demo.ts`

Curated fixtures derived from a real Premier League match (source recorded
inline). Suggested source: `/Volumes/WQ/projects/www/data/` or one of the
existing fixture modules in the repo. **Decision during build:** scan
`apps/site/src/data/` for an existing match fixture that already exposes
player passes, prefer reusing it over creating a new one.

Fixtures to export:

- `playerSonarPasses` — one player's passes from an entire match (~50–80 passes)
- `comparisonPlayerAPasses`, `comparisonPlayerBPasses` — two midfielders from
  the same match (for the `scaleMaxAttempts` comparison demo)
- `firstHalfPasses`, `secondHalfPasses` — same player, split by period
- `sparseDefenderPasses` — a CB or GK first-half passes (~5–8 passes,
  one-direction-heavy)
- `EMPTY_PASSES: PassEvent[] = []`

Each fixture is `ReadonlyArray<PassEvent>` typed.

### `apps/site/src/components/PassSonarPreview.tsx`

Client React component (mounted as Astro island via `client:load`). All
non-trivial preset wiring lives here, not in props from Astro, to avoid the
pre-W1g/i hydration mismatch pattern.

```tsx
"use client";

import { PassSonar } from "@withqwerty/campos-react";

type Variant =
  | "hero"
  | "comparison-a"
  | "comparison-b"
  | "first-half"
  | "second-half"
  | "sparse"
  | "empty"
  | "dark";

export function PassSonarPreview({
  variant,
  passes,
  subjectLabel,
  scaleMaxAttempts,
}: {
  variant: Variant;
  passes: ReadonlyArray<PassEvent>;
  subjectLabel?: string;
  scaleMaxAttempts?: number;
}) {
  if (variant === "dark") {
    return (
      <ThemeProvider value={DARK_THEME}>
        <PassSonar passes={passes} subjectLabel={subjectLabel} />
      </ThemeProvider>
    );
  }
  return (
    <PassSonar
      passes={passes}
      subjectLabel={subjectLabel}
      scaleMaxAttempts={scaleMaxAttempts}
    />
  );
}
```

### `apps/site/src/pages/passsonar.astro`

Use the existing `ChartComponentPage` layout pattern (matches `radarchart.astro`).
Card list:

1. Hero: zero-config — `<PassSonarPreview variant="hero" passes={...} subjectLabel="..." />`
2. Comparison: two-up grid with shared `scaleMaxAttempts`
3. First half vs second half: two-up grid, same player, shared scale
4. Sparse: defender or GK passes
5. Empty state: `passes={EMPTY_PASSES}`
6. SmallMultiples: 4 player sonars composed via `<SmallMultiples>`
7. Dark theme: same hero, dark variant
8. Methodology-notes example
9. "When to use" guidance section comparing PassSonar vs PassMap, PassFlow,
   PassNetwork (prose).

### `apps/site/src/components/SiteNav.astro` (or equivalent)

Add a nav entry for PassSonar in the Charts section. **Find at build time:**
search the components directory for the nav file pattern other charts use
(grep for `passmap.astro` references).

## 6. Verification gate

After every layer (compute, React, export, demo) and again at the end:

```bash
pnpm typecheck
pnpm exec vitest run packages/react/test/compute/compute-pass-sonar.test.ts
pnpm exec vitest run packages/react/test/PassSonar.test.tsx
pnpm exec vitest run packages/react/test/ExportFrame.test.tsx
pnpm lint
pnpm format:check
pnpm --filter @withqwerty/campos-site build
```

Final pre-commit gate (per `feedback_pre_push_checks.md`):

```bash
pnpm check && pnpm build && pnpm verify:package-imports
```

### Visual verification (browser)

I (Claude) will start the dev server only if it isn't already running, then
visit `/passsonar` in Chrome and verify each card:

- forward wedge sits at top of the wheel
- attempted (translucent) vs completed (opaque) wedges legible at default size
- legend rows render with theme colours
- summary block readable
- ring labels visible at default size, hidden in narrow / SmallMultiples cells
- dark-theme card has no contrast regression
- empty-state card shows the shared EmptyState pill
- arrow keys cycle focus around the ring
- tooltip appears on hover and includes Direction / Attempted / Completed / Completion / Average distance rows
- average-distance row absent on zero-attempted wedges
- no console errors, no hydration warnings

Per `feedback_dev_server.md`: do **not** restart any service. If dev server is
already running, use it; if not, start once and leave running.

## 7. Status updates after merge

After the implementation packet ships:

- `docs/status/matrix.md` W4c row: `in-progress → done`
- `docs/status/matrix.md` Demo Pages table: add `PassSonar` row
- `docs/status/matrix.md` Components table: add `PassSonar` row with style API target props
- `docs/specs/passsonar-spec.md`: append a "Loop 2 outcome" + "Loop 3 outcome" section
- `docs/standards/adapter-gap-matrix.md`: confirm Wyscout `passResult` row stays accurate after build observation

## Open implementation-time decisions

These are non-blocking — the build can choose, document the decision in code
comments, and update this plan in the same commit.

1. **Demo fixture source** — first scan `apps/site/src/data/` for an existing
   per-player pass fixture before creating a new one.
2. **Theme palette default for attempted/completed fills** — confirm
   `theme.chart.series` exists or pick the established alternative.
3. **SmallMultiples scale-max helper in user space** — the demo can either
   inline the `Math.max(...cells.flatMap(...))` calculation or extract a
   private `apps/site/src/lib/passSonarSharedScale.ts` helper. Inline is
   simpler unless the demo grows.
4. **Static export inclusion in v1** — the spec says yes. If the export
   wiring is materially heavier than the existing 11-chart pattern (e.g.
   needs a new aspect-ratio handling beyond `1:1`), descope to a follow-up
   packet and document the deferral.

## Out of scope for this implementation packet

- `computeSharedPassSonarScale` helper (deferred per spec)
- `<PolarWedgeLayer>` primitive extraction (deferred per spec)
- Wyscout `passResult` adapter normalisation (separate adapter packet)
- battle-test recreation that uses PassSonar (W4a, separate packet)
