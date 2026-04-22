# Heatmap `valueMode` + Colorscale Pass — Implementation Spec

**Status:** archived
**Superseded by:** `docs/specs/heatmap-spec.md`
**Owner:** campos team
**Target version:** v0.2
**Related:** `docs/specs/heatmap-spec.md`, `docs/archived/specs/heatmap-evolution-plan.md`

## Scope

Original in-scope items from the evolution plan:

1. Add a `valueMode: "count" | "intensity" | "share"` prop to `Heatmap`
2. Colorscale consistency pass — add `inferno`, remove `hot` from KDE

**Post-ship addition (same day):** 3. Auto-contrast pitch lines for dark colorscales. See "Post-ship addition" section at the bottom.

Nothing else. See `docs/archived/specs/heatmap-evolution-plan.md` for what's deferred and why.

## Resolved decisions

_Decisions made 2026-04-10. The analysis below is preserved for future reference so the reasoning is discoverable, not because it's still open._

### OQ1 — Color ramp normalization in `share` mode — **RESOLVED: Option A**

When `valueMode="share"`, each cell has `share = count / totalCount`. The color ramp needs to decide which fraction drives the fill. Two options:

**Option A: Normalize ramp to `maxShare`** (ramp value = `share / maxShare`)

- Hottest cell always fills the darkest color.
- Visually identical to `count` and `intensity` modes across all datasets.
- Scale bar shows correct percentage range (e.g. `0 – 18%`).
- Matches the convention used by mplsoccer, d3-soccer, and all cited research. Every sequential-heatmap library I could find does this.
- The mode is a _label_ change, not a visual change.

**Option B: Normalize ramp to `1.0`** (ramp value = `share`, i.e. the fraction itself)

- The hottest cell only fills the darkest color when it contains 100% of events.
- Visually distinct from `count`/`intensity` — charts where no single cell dominates look muted because every ramp value is small (e.g. max share = 18% → darkest cell at 18% of the ramp).
- Semantically honest: "this cell is 18% of the total" corresponds to "18% of the color scale filled".
- Not a convention I can find in any reference library.

**Decision:** Option A. Matches every prior art checked (mplsoccer, d3-soccer, matplotlib). Keeps the mode a pure labeling change without losing visual clarity. Option B's realistic-data-looks-faded anti-property is disqualifying.

---

### OQ2 — `share` denominator: total valid events, or total cropped events? — **RESOLVED: Option A**

When `crop="half"` is set, events outside the attacking half are filtered out before binning. For share mode, what does the denominator count?

**Option A: Total valid events _after_ crop filter** (denominator = same events used for binning)

- If user passes 1000 touches and `crop="half"` excludes 500, denominator = 500.
- Shares sum to 1.0 across the visible grid.
- Matches the current code's mental model — crop is a data filter, events outside the crop don't exist in the component's world.
- Scale bar reading: "this cell is 6% of the touches I'm showing you."

**Option B: Total valid events _before_ crop filter**

- Denominator = 1000 regardless of crop.
- Shares sum to ≤1.0 across the grid; the "missing" share corresponds to events outside the crop.
- Only makes sense if the user reads crop as purely visual ("zoom into this half of the pitch").
- Scale bar reading: "this cell is 3% of the touches overall, even though I only rendered half the pitch."

**Decision:** Option A. The current `computeHeatmap` implementation already treats `crop` as a data filter — `croppedEvents` drives binning and max count. Option B would make the `share` denominator the only thing in the pipeline that ignores crop, which is an internal inconsistency. Users who want "share of all events, cropped view" can pre-filter and pass full-pitch.

---

### OQ3 — KDE `hot` demo card: what replaces it? — **RESOLVED: Option A**

Current `apps/site/src/pages/kde.astro` has a demo card titled "Hot scale" using `colorScale="hot"`. Removing `hot` from KDE means this card needs a disposition:

**Option A:** Replace with `inferno` scale (once added in the colorscale pass). Note: requires adding inferno to KDE too, not just Heatmap.
**Option B:** Replace with `viridis` scale. KDE already has a "viridis scale" card, so this would be a duplicate — reword or delete the old one.
**Option C:** Delete the card entirely. One fewer colorscale-showcase card.

**Decision:** Option A. Replace the `colorScale="hot"` demo with `colorScale="inferno"`, keeping the card structure. Requires adding `inferno` to `KDEColorScale` as well as `HeatmapColorScale` (see Item 2).

---

## Item 1: `valueMode` prop

### Current state (baseline from Batch 1)

`packages/core/src/heatmap.ts` lines 200-313. Compute function:

- Filters events to valid (finite `x`, `y`)
- Crops events to `cropMinX..cropMaxX` based on `crop` prop
- Bins into a `gridX × gridY` grid, producing per-cell `count`
- Computes `maxCount` and per-cell `intensity = count / maxCount`
- Renders each cell with `fill = interpolateStops(stops, intensity)`
- Scale bar: `{ label: metricLabel, domain: [0, maxCount], stops }`

Tooltip in `packages/react/src/Heatmap.tsx` shows two rows: `{metricLabel}: {count}` and `Intensity: {round(intensity × 100)}%`.

### Changes

#### Type changes

```ts
// packages/core/src/heatmap.ts

export type HeatmapValueMode = "count" | "intensity" | "share";

export type HeatmapCell = {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  count: number;
  intensity: number; // count / maxCount, 0–1
  share: number; // count / totalCount, 0–1 — NEW
  fill: string;
  opacity: number;
};

export type ComputeHeatmapInput = {
  // ... existing fields unchanged ...
  /** Value to display in scale bar and tooltip. @default "count" */
  valueMode?: HeatmapValueMode;
};

export type HeatmapModel = {
  // ... existing fields ...
  meta: {
    // ... existing fields ...
    valueMode: HeatmapValueMode; // NEW — echo back resolved mode for renderer
  };
  scaleBar: {
    label: string;
    domain: [number, number]; // mode-dependent; see below
    stops: ColorStop[];
    valueMode: HeatmapValueMode; // NEW — renderer uses this to format tick labels
  } | null;
};
```

`HeatmapProps` in `packages/react/src/Heatmap.tsx` gains the same optional `valueMode` prop and forwards it to `computeHeatmap`.

#### Compute rules

After existing binning produces `counts[]` and `maxCount`:

```ts
const totalCount = croppedEvents.length; // OQ2: denominator is the cropped total
const valueMode = input.valueMode ?? "count";

// Per cell:
const share = totalCount > 0 ? count / totalCount : 0;
const intensity = maxCount > 0 ? count / maxCount : 0;
// `count` is the raw count from binning.

// Fill always uses intensity-normalized ramp (OQ1: ramp is invariant across modes).
const fill = isEmpty ? "rgba(0,0,0,0)" : interpolateStops(stops, intensity);
```

The ramp is unchanged from Batch 1 regardless of mode. Only scale-bar domain and tooltip labels depend on `valueMode`.

#### Scale bar rules

```ts
function scaleBarDomain(
  valueMode: HeatmapValueMode,
  maxCount: number,
  totalCount: number,
): [number, number] {
  switch (valueMode) {
    case "count":
      return [0, maxCount]; // unchanged from Batch 1
    case "intensity":
      return [0, 1];
    case "share":
      return [0, totalCount > 0 ? maxCount / totalCount : 0];
    // OQ1: share domain is [0, maxShare], matching the ramp-normalization convention
  }
}
```

The scale bar `label` field is unchanged — it's the user's `metricLabel` ("Touches", "Passes", etc.). The component does **not** mutate the label based on mode (no auto-appending "(% of total)"). Rationale: the label is the user's intent; the mode changes what the numbers mean, not what the thing being measured is called.

#### Tooltip rules

The tooltip shows exactly two rows:

1. **Primary row:** `{metricLabel}: {formattedValue}` — value depends on `valueMode`
2. **Secondary row:** `Intensity: {intensity}%` — always, **unless** primary row IS intensity

| valueMode   | Primary row example            | Secondary row                 |
| ----------- | ------------------------------ | ----------------------------- |
| `count`     | `Touches: 12`                  | `Intensity: 60%`              |
| `intensity` | `Intensity: 60%`               | _(omitted — same as primary)_ |
| `share`     | `Touches: 8%` (share of total) | `Intensity: 60%`              |

Formatting rules:

- `count`: integer, no unit (`12`)
- `intensity`: percentage rounded to integer (`60%`)
- `share`: percentage rounded to integer (`8%`)

The primary row's label is always `metricLabel` — for `intensity` mode it becomes `Intensity` (literal), not `{metricLabel}`, because the number isn't measuring the metric, it's measuring intensity _of_ the metric. Rationale: consistency with what the number represents.

#### Edge cases

| Case                                | Behavior                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Empty events array                  | `scaleBar: null`, emptyState message, `meta.valueMode` still echoed back       |
| Single cell with all events         | `share[cell] = 1.0`, `intensity[cell] = 1.0`, scale bar `[0, 1]` in share mode |
| All cells equal                     | Every cell same `share`, same `intensity`, uniform color                       |
| `maxCount = 0` (shouldn't happen)   | `intensity = 0` for all cells; share = 0; fill transparent                     |
| `valueMode` invalid at runtime      | TypeScript prevents; no runtime guard needed                                   |
| `crop="half"` + `valueMode="share"` | Denominator = cropped total (OQ2)                                              |

#### Warnings

No new warnings. The existing "fewer than 3 valid events" warning still applies regardless of mode.

## Item 2: Colorscale consistency pass

### Add `inferno` to both `HeatmapColorScale` and `KDEColorScale`

Per OQ3, inferno must be added to both components so the KDE demo card can be migrated off `hot`.

**Shared color stops** — same 5 values in both files (duplication is acceptable; don't extract a shared scales module as part of this work):

```ts
const INFERNO_STOPS: ColorStop[] = [
  { offset: 0, color: "#000004" },
  { offset: 0.25, color: "#420a68" },
  { offset: 0.5, color: "#932667" },
  { offset: 0.75, color: "#dd513a" },
  { offset: 1, color: "#fcffa4" },
];
// Source: matplotlib inferno colormap, sampled at 5 stops to match existing scale granularity
```

**`packages/core/src/heatmap.ts`:**

```ts
export type HeatmapColorScale =
  | "magma"
  | "viridis"
  | "inferno" // NEW
  | "blues"
  | "greens"
  | "custom";

const COLOR_SCALES: Record<string, ColorStop[]> = {
  magma: MAGMA_STOPS,
  viridis: VIRIDIS_STOPS,
  inferno: INFERNO_STOPS, // NEW
  blues: BLUES_STOPS,
  greens: GREENS_STOPS,
};
```

**`packages/core/src/kde.ts`:**

```ts
export type KDEColorScale =
  | "magma"
  | "viridis"
  | "inferno" // NEW — replaces "hot"
  | "blues"
  | "greens"
  | "custom";

const COLOR_SCALES: Record<string, ColorStop[]> = {
  magma: MAGMA_STOPS,
  viridis: VIRIDIS_STOPS,
  inferno: INFERNO_STOPS, // NEW
  blues: BLUES_STOPS,
  greens: GREENS_STOPS,
};
```

Also: delete the `HOT_STOPS` constant from `kde.ts` and remove `"hot"` from the union and the record.

### Demo updates

- **Heatmap demo (`apps/site/src/pages/heatmap.astro`):** no change needed. The demo showcases metrics, not colorscales. Users can opt into inferno via the prop.
- **KDE demo (`apps/site/src/pages/kde.astro`):**
  - Change the existing "Hot scale" `<DemoCard>` to use `colorScale="inferno"`.
  - Update the card title to `"Inferno scale"`.
  - Update the card note from `"Dark purple through red to yellow."` to something like `"High-contrast perceptually uniform ramp — black through purple and orange to cream."`.
- **Props table in `kde.astro`:** replace `"hot"` with `"inferno"` in the `colorScale` type string.

## Migration notes (breaking changes)

This spec ships breaking API changes, consistent with the evolution plan's "break contracts" mandate.

1. **`HeatmapCell` gains a required `share` field.** Any code destructuring cells needs updating. Only internal test files and the Heatmap renderer consume this — grep confirms.
2. **`computeHeatmap` return `meta` gains a required `valueMode` field.** Test snapshots will break; regenerate.
3. **`HeatmapColorScale` adds `"inferno"`.** Purely additive.
4. **`KDEColorScale` adds `"inferno"` and removes `"hot"`.** `inferno` addition is additive. `"hot"` removal breaks any consumer passing `colorScale="hot"` to `<KDE>` — fails TypeScript, runtime falls through to default. Grep confirms only the KDE demo card itself uses it, and that card is migrated to inferno as part of this spec.

No user-facing migration doc needed — the changes are internal to the library and the one demo card.

## Test cases

### `compute-heatmap.test.ts` — new tests for `valueMode`

```ts
it("defaults valueMode to 'count'", () => {
  const model = computeHeatmap({ events: makeEvents([{ x: 50, y: 50 }]) });
  expect(model.meta.valueMode).toBe("count");
  expect(model.scaleBar?.domain).toEqual([0, 1]); // count mode, maxCount=1
});

it("count mode: domain is [0, maxCount]", () => {
  const events = makeEvents([
    { x: 10, y: 10 },
    { x: 10, y: 10 },
    { x: 10, y: 10 },
    { x: 80, y: 80 },
  ]);
  const model = computeHeatmap({ events, valueMode: "count" });
  expect(model.scaleBar?.domain).toEqual([0, 3]);
});

it("intensity mode: domain is [0, 1]", () => {
  const events = makeEvents([
    { x: 10, y: 10 },
    { x: 80, y: 80 },
  ]);
  const model = computeHeatmap({ events, valueMode: "intensity" });
  expect(model.scaleBar?.domain).toEqual([0, 1]);
});

it("share mode: domain is [0, maxShare], cells expose share field", () => {
  const events = makeEvents([
    { x: 10, y: 10 },
    { x: 10, y: 10 },
    { x: 10, y: 10 }, // 3 in one cell
    { x: 80, y: 80 }, // 1 in another cell (total=4)
  ]);
  const model = computeHeatmap({ events, valueMode: "share" });
  const nonZero = model.grid.cells.filter((c) => c.count > 0);
  const maxCell = nonZero.find((c) => c.count === 3)!;
  const minCell = nonZero.find((c) => c.count === 1)!;
  expect(maxCell.share).toBeCloseTo(0.75, 5);
  expect(minCell.share).toBeCloseTo(0.25, 5);
  expect(model.scaleBar?.domain).toEqual([0, 0.75]); // maxShare
});

it("share mode: denominator uses cropped total not full total", () => {
  const events = makeEvents([
    { x: 20, y: 50 }, // defensive half — excluded by crop
    { x: 70, y: 50 }, // attacking half — included
    { x: 80, y: 50 }, // attacking half — included
  ]);
  const model = computeHeatmap({
    events,
    valueMode: "share",
    crop: "half",
  });
  const nonZero = model.grid.cells.filter((c) => c.count > 0);
  // 2 cropped events total, so share should be 0.5 each, not 1/3 each
  expect(nonZero.every((c) => c.share === 0.5)).toBe(true);
});

it("color ramp is invariant across valueMode", () => {
  const events = makeEvents([
    { x: 10, y: 10 },
    { x: 10, y: 10 },
    { x: 80, y: 80 },
  ]);
  const count = computeHeatmap({ events, valueMode: "count" });
  const intensity = computeHeatmap({ events, valueMode: "intensity" });
  const share = computeHeatmap({ events, valueMode: "share" });

  for (let i = 0; i < count.grid.cells.length; i++) {
    expect(count.grid.cells[i]!.fill).toBe(intensity.grid.cells[i]!.fill);
    expect(count.grid.cells[i]!.fill).toBe(share.grid.cells[i]!.fill);
  }
});

it("share mode: empty events still produces valid meta.valueMode", () => {
  const model = computeHeatmap({ events: [], valueMode: "share" });
  expect(model.meta.valueMode).toBe("share");
  expect(model.scaleBar).toBeNull();
});

it("inferno colorscale produces hex fills", () => {
  const model = computeHeatmap({
    events: makeEvents([{ x: 50, y: 50 }]),
    colorScale: "inferno",
  });
  const nonZero = model.grid.cells.filter((c) => c.count > 0);
  expect(nonZero[0]!.fill.startsWith("#")).toBe(true);
});
```

### `compute-kde.test.ts` — new test for KDE inferno

```ts
it("inferno colorscale produces hex fills", () => {
  const model = computeKDE({
    events: [
      { x: 50, y: 50 },
      { x: 55, y: 50 },
      { x: 60, y: 50 },
    ],
    colorScale: "inferno",
  });
  expect(model.density.grid.some((v) => v > 0)).toBe(true);
  // Spot-check: the colorScale resolved without falling back
  expect(model.meta.warnings.find((w) => w.includes("inferno"))).toBeUndefined();
});
```

### `Heatmap.test.tsx` — React renderer tests

```ts
it("tooltip in share mode shows metricLabel with percent, plus Intensity row", () => {
  const { getAllByRole, getByText } = render(
    <Heatmap events={events} metricLabel="Touches" valueMode="share" />
  );
  const cells = getAllByRole("button", { name: /heatmap cell/i });
  fireEvent.focus(cells[0]!);
  expect(getByText(/Touches/)).toBeInTheDocument();
  expect(getByText("Intensity")).toBeInTheDocument();
  // Primary row should contain a percent sign
  expect(getByText(/\d+%/)).toBeInTheDocument();
});

it("tooltip in intensity mode omits the redundant Intensity secondary row", () => {
  const { getAllByRole, queryAllByText } = render(
    <Heatmap events={events} metricLabel="Touches" valueMode="intensity" />
  );
  const cells = getAllByRole("button", { name: /heatmap cell/i });
  fireEvent.focus(cells[0]!);
  // Only one row with "Intensity"
  expect(queryAllByText("Intensity").length).toBe(1);
});
```

## Out of scope (see evolution plan)

- `density` mode — deferred until non-uniform bins (JdP) exist
- `deviation` / diverging mode — deferred pending demand, decision procedure documented in evolution plan
- Text contrast utility — only needed when in-cell labels exist
- Scale bar primitive extraction — only needed when sibling components exist

## Post-ship addition: `autoPitchLines`

Added 2026-04-10 after visual inspection of the demo site. Problem: the default demo pitch preset (`outline`) uses white fill with dark `#1a1a1a` lines. When the heatmap renders with a dark colorscale (magma/inferno/viridis), dark cells obscure the dark pitch lines — the center circle, penalty areas, and six-yard boxes become unreadable on top of filled cells.

### What shipped

Both `Heatmap` and `KDE` gained an `autoPitchLines?: boolean` prop (default `true`). When enabled, the component detects a dark color ramp and forces `pitchColors.lines` and `pitchColors.markings` to near-white values (`#ffffffcc` / `#ffffff66`). When disabled, user `pitchColors` pass through unchanged.

**Dark-ramp detection:** compute the W3C relative luminance of the ramp's first color stop. If `< 0.15`, treat the ramp as dark.

**Threshold justification:** empirical split of the existing sequential ramps:

| Ramp    | First stop | Luminance | Classification |
| ------- | ---------- | --------- | -------------- |
| magma   | `#140e36`  | 0.0073    | dark ✓         |
| inferno | `#000004`  | 0.0001    | dark ✓         |
| viridis | `#440154`  | 0.019     | dark ✓         |
| blues   | `#f7fbff`  | 0.96      | light          |
| greens  | `#f7fcf5`  | 0.96      | light          |

The threshold is intentionally loose — any custom ramp with a near-black first stop (luminance < 0.15) will trip the detection. The check scales with ramp content, not a hardcoded enum of scale names.

### Design choices (intentional, don't flip without a discussion)

1. **Override wins over user `pitchColors.lines`**, not the opposite. This violates the usual "explicit props win" rule, for a specific reason: demo preset systems and design-system wrappers typically set pitch colors globally across all components (via nanostores, theme context, or prop drilling). If user values won, the fix would never fire in the most common case — which is exactly the case the user reported. The boolean escape hatch (`autoPitchLines={false}`) gives full opt-out when it matters.

2. **Only `lines` and `markings` are touched.** User `fill` always passes through. The component doesn't assume what the background should be.

3. **Empty cells still show through to the user's `fill`.** If a consumer uses a white pitch fill with a dark colorscale (`outline` preset + magma), the auto-white lines will be invisible over the empty-cell regions of the pitch. This is an acceptable tradeoff because:
   - The primary visibility concern is FILLED cells (where the data is), where white-on-dark works perfectly.
   - The fix is for data visibility, not pitch-geometry pedagogy.
   - Consumers who want consistent line visibility across filled and empty regions should pick a pitch fill that matches their colorscale (dark fill with dark ramp — e.g. the `dark` preset instead of `outline`).

4. **Empty state passes through user colors unchanged.** When `model.scaleBar` is null (no events), there's no color ramp to analyze, so `resolvePitchColors` returns `userPitchColors` as-is. This is fine because an empty pitch has no cells to obscure any lines.

5. **Helper duplicated in `Heatmap.tsx` and `KDE.tsx`**, not extracted to `@withqwerty/campos-core/color.ts`. Per the "extract when there's a third real consumer" rule from the main spec. The luminance math is ~15 lines; duplication is cheaper than a cross-package dependency for two use-sites. If a third component (e.g. future `PassMap` density mode, `ComparisonHeatmap` diverging) needs it, extract then.

### Test coverage (React layer)

Three new tests in `packages/react/test/Heatmap.test.tsx`:

1. `auto-forces white pitch lines when using a dark colorscale (magma)` — verifies the override fires and replaces user-provided `#1a1a1a` lines with white
2. `respects user pitch line colors when using a light colorscale (blues)` — verifies dark user lines pass through unchanged for light ramps
3. `can be disabled with autoPitchLines={false}` — verifies the escape hatch works even with a dark colorscale

The tests query the DOM under `[data-stadia="pitch-lines"]` and collect all distinct `stroke` attributes, asserting the expected color is present or absent. No snapshot testing — brittle to stadia's internal markup.

### What was NOT done (deferred)

- **Overriding `fill` to match dark ramps.** Would solve the empty-cell invisibility issue but couples the component more tightly to stylistic choices. Consumer responsibility.
- **Midpoint-luminance detection** instead of first-stop. The midpoint of a sequential ramp doesn't distinguish dark-to-light ramps from dark-to-very-dark ones, but in practice all our ramps go from darkest-first-stop upward, so first-stop detection is sufficient.
- **Extraction of `hexLuminance` to `@withqwerty/campos-core/color.ts`.** Waiting for a third consumer per the extraction rule. Future candidates: JdP label placement (needs text-on-cell contrast), diverging heatmap scale bar (needs neutral-midpoint contrast).
- **Applying to other chart components** (ShotMap, PassMap, etc). ShotMap markers don't obscure pitch lines the way heatmap cells do (they're points, not filled regions). Only density-style charts (Heatmap, KDE, future comparison heatmap) need this treatment.

## Decision log

Resolved 2026-04-10.

| #   | Decision                               | Chosen                                  | Rationale                                                                                                                                                                                                           |
| --- | -------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ1 | Color ramp normalization in share mode | A: normalize to `maxShare`              | Matches mplsoccer/d3-soccer/matplotlib. Share mode is a label change, not a visual change. Prevents well-spread data from looking washed out.                                                                       |
| OQ2 | Share denominator                      | A: cropped total                        | Matches the existing pipeline where `crop` is a data filter. Otherwise `share` would be the only stage ignoring the crop — inconsistent.                                                                            |
| OQ3 | KDE `hot` demo card disposition        | A: replace with `inferno` demo card     | Preserves the card slot. Requires adding `inferno` to `KDEColorScale` alongside `HeatmapColorScale` (folded into Item 2's colorscale pass).                                                                         |
| D4  | `autoPitchLines` override precedence   | Auto wins over user `pitchColors.lines` | Violates the usual "explicit props win" rule — but the common case is a global preset setting dark lines for all components, which would never trigger the fix if user won. Escape hatch: `autoPitchLines={false}`. |
| D5  | Dark-ramp detection strategy           | W3C luminance of first stop < 0.15      | Scales with any ramp, not just a hardcoded enum of scale names. Empirically splits magma/inferno/viridis (near 0) from blues/greens (near 0.96) with wide margin on both sides.                                     |
| D6  | Extraction of `hexLuminance` helper    | Duplicate in Heatmap.tsx and KDE.tsx    | Per the "extract on third consumer" rule. ~15 LOC, no cross-package cost. Extract when a third component needs it (likely JdP labels or diverging scale).                                                           |
