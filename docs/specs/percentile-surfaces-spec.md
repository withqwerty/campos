# Percentile Surfaces Spec

**Status:** active draft - implementation-ready
**Last updated:** 2026-04-20

## Header

- Component / primitive:
  - `PercentileBar` (public chart component)
  - `PercentilePill` (public dense companion component)
  - `resolvePercentileSurfaceModel` (internal compute helper in
    `@withqwerty/campos-react` — not part of the public barrel unless the
    stance in D1c decides otherwise)
- Status: active spec, loop 1 closed
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer and renderer seams
  - shared `ChartFrame` chrome and style-family infrastructure
    (`StyleValue`, empty-state primitive, warning channel, theme tokens)
  - `docs/standards/react-renderer-conventions.md`
  - `docs/standards/component-ship-checklist.md`
  - `docs/standards/adapter-gap-matrix.md` (aggregate row added alongside
    this packet)

## Purpose

- What user task this solves:
  - show a single football metric as a precise percentile read against an
    explicit comparison sample
- Why it belongs in Campos:
  - the library already has overview-first radial charts (`RadarChart`,
    `PizzaChart`) but still lacks a precise linear percentile surface for
    scouting rows, cards, and battle-test recreations
- Why it should be public:
  - explicit comparison-sample labeling, higher-is-better display
    normalization, and dense row readability are chart-level product
    behavior, not consumer glue

## Domain framing

### Football concept

This family models a football scouting idiom:

- "how strong is this metric relative to a named population?"

It is not:

- a generic progress bar
- a hidden-value decoration with no comparison sample
- a table component
- a raw-stat computation engine

### Bounded-context ownership

- consumer/app code owns:
  - cohort definition and percentile generation (the comparison sample and
    the per-metric percentile number are computed upstream)
  - whether a metric is semantically lower-is-better; upstream is
    responsible for inverting the raw value to a display-scale percentile
    before passing it to the component
- `@withqwerty/campos-react` owns:
  - display-scale contract enforcement ("higher on the surface = better")
  - comparison-sample label presence rules (visible and accessible)
  - track / fill / label / tick / pill presentation
  - warning surfaces, empty-state, and responsive fallback behavior
  - the structured `accessibleLabel` exposed on the compute model
- `schema` and `adapters` do not own a first-class percentile canonical
  type in v0.3. Provider coverage is tracked as `aggregate` (see §Required
  normalized data).

### Canonical input model

The component family expects a **precomputed, display-scale** percentile
packet. Provider parsing, cohort definition, percentile computation, and
lower-is-better inversion are already resolved upstream.

This is deliberate: it keeps the first packet honest, avoids pretending
that Campos owns league-wide percentile computation before it really does,
and removes ambiguity about who inverts lower-is-better metrics.

### Invariants

- `metric.percentile` is **always on the display scale** — higher on the
  surface means better. The component never inverts the value.
- `metric.originalDirection` is an informational flag used only to drive
  copy, badges, and the structured `accessibleLabel`. It does not change
  how the bar or pill is drawn.
- the comparison sample is always surfaced both visibly (bar) or through
  an explicit accessible fallback (pill). The component will not render an
  unlabeled percentile surface; see the pill contract in §Public API.
- percentiles outside `[0, 100]` clamp to the endpoint and push a
  warning string onto the model's `warnings: string[]` array. `NaN` and
  non-finite values produce an explicit invalid region in the model
  (not a silent zero bar).
- warnings flow through the compute model's `warnings: string[]` — the
  same pattern used by `RadarChart`, `PizzaChart`, `BumpChart`,
  `XGTimeline`, `LineChart`, `CometChart`, `Beeswarm`, `Envelope`,
  `DistributionChart`, and `PassNetwork`. Components expose warnings
  via an optional `onWarnings?: (warnings: readonly string[]) => void`
  prop for dev tools to surface, and emit a single dev-only
  `console.warn` on mount when `process.env.NODE_ENV !== "production"`.
  Components never `console.warn` from render paths.
- the chart is positioned by explicit coordinates (label block on the
  left, track in the middle, percentile text on the right) and reads
  low→high from left to right regardless of document directionality.
  The root SVG sets `direction="ltr"` so inherited `<text>` runs keep
  a consistent base direction; strong-RTL glyphs inside a metric label
  may still reorder within their own `<text>` run by design.
  Consumers who need mirrored chrome on `dir="rtl"` surfaces handle
  that at the card/layout level.

## Public API

### Zero-config happy path

```tsx
import { PercentileBar } from "@withqwerty/campos-react";

<PercentileBar
  metric={{
    id: "prog-passes",
    label: "Progressive passes",
    percentile: 87,
    rawValue: 7.4,
    rawValueUnit: "/90",
  }}
  comparison={{
    label: "Big Five League midfielders",
    seasonLabel: "2025/26",
    minutesThresholdLabel: "900+ minutes",
  }}
/>;
```

Renders a publishable single-metric bar with:

- labelled track and comparison sample line
- ticks at 25 / 50 / 75 (styled guide lines, no numeric text by default)
- theme-aware fill using the chart-chrome positive-scale tokens
- dev-only warnings when the input violates an invariant
- structured `accessibleLabel` exposed on the root `<svg aria-label>`

### Dense companion (pill)

```tsx
import { PercentilePill } from "@withqwerty/campos-react";

<PercentilePill
  metric={{
    id: "tackles-won",
    label: "Tackles won",
    percentile: 73,
    rawValue: 2.1,
    rawValueUnit: "/90",
  }}
  comparison={{
    label: "Big Five League centre-backs",
  }}
/>;
```

The pill **requires** either a full `comparison` packet **or** an
explicit `accessibleSampleLabel` override prop (see below). Silent
unlabeled pills are a type error.

### Current public surface

```ts
export type PercentileComparisonSample = {
  label: string;
  seasonLabel?: string;
  minutesThresholdLabel?: string;
  populationSize?: number;
};

export type PercentileMetric = {
  id: string;
  label: string;
  percentile: number; // display-scale: higher is always better
  rawValue?: string | number;
  rawValueUnit?: string;
  originalDirection?: "higher" | "lower";
  note?: string;
};

type PercentileSurfaceSharedProps = {
  metric: PercentileMetric;
  showValue?: boolean; // default: true when rawValue is present
  inversionBadgeLabel?: string; // default: "lower is better"
  onWarnings?: (warnings: readonly string[]) => void;
  track?: StyleValue<PercentileTrackStyle, PercentileTrackContext>;
  fill?: StyleValue<PercentileFillStyle, PercentileFillContext>;
  text?: StyleValue<PercentileTextStyle, PercentileTextContext>;
  badges?: StyleValue<PercentileBadgeStyle, PercentileBadgeContext>;
};

export type PercentileBarProps = PercentileSurfaceSharedProps & {
  comparison: PercentileComparisonSample;
  showComparisonLabel?: boolean; // default: true
  showPercentileLabel?: boolean; // default: true
  showTicks?: boolean; // default: true
  ticks?: StyleValue<PercentileTicksStyle, PercentileTicksContext>;
  recipe?: PercentileBarRecipe;
};

// Discriminated union: the pill requires EITHER a full comparison packet
// OR an accessibleSampleLabel fallback. `{ metric }` alone is a compile
// error; so is `{ metric, accessibleSampleLabel: undefined }`.
export type PercentilePillProps = PercentileSurfaceSharedProps & {
  recipe?: PercentilePillRecipe;
} & (
    | {
        comparison: PercentileComparisonSample;
        accessibleSampleLabel?: string;
      }
    | {
        comparison?: undefined;
        accessibleSampleLabel: string;
      }
  );
```

### Style families

Style families follow `react-renderer-conventions.md` § Preset And Variant
Convention and the existing `RadarChart` / `PizzaChart` precedent. Each
family is a `StyleValue<Style, Context>` — constant, object-map, or
callback — resolved per render. The callback context carries:

- `PercentileTrackContext` / `PercentileFillContext`:
  `{ metricId, percentile, originalDirection, comparisonLabel }`
- `PercentileTextContext`:
  `{ metricId, role: "metricLabel" | "percentileLabel" | "sampleLabel" | "valueLabel" }`
- `PercentileTicksContext`: `{ tickValue }` where tickValue ∈ `[25, 50, 75]`
- `PercentileBadgeContext`:
  `{ metricId, role: "inversion" }`

`PercentileTrackStyle` covers `fill`, `stroke`, `strokeWidth`, `opacity`,
`radius`. `PercentileFillStyle` covers `fill`, `opacity`, `radius`.
`PercentileTextStyle` covers `fill`, `fontSize`, `fontWeight`, and a
`valueFormat?: (value: string | number) => string` override for the
raw-value formatter. `PercentileTicksStyle` covers `stroke`,
`strokeWidth`, `opacity`, and an explicit `visible: boolean` so consumers
can hide any subset. `PercentileBadgeStyle` covers only visual
properties — `fill`, `textFill`, `strokeWidth` — since badge label
content is owned by the top-level `inversionBadgeLabel` prop (see
default rendering rule below), not the style family.

The inversion disclosure is owned by the `badges` family only. There is
no `text` role for it; the `text` family covers the four rendered text
slots listed above and nothing else.

### Presets / recipes

Editorial variants ship as named recipes, not boolean props. v0.3 adds:

- `PercentileBarRecipe.default` — the zero-config publishable baseline
- `PercentileBarRecipe.quiet` — muted track/fill for card-sidebar usage
- `PercentilePillRecipe.default`
- `PercentilePillRecipe.compact` — hides the raw value and shrinks the
  label block; used for list rows

Recipes resolve to concrete style-family constants; callers can still
override individual families on top of a recipe. Recipes live alongside
`radarChartRecipes.ts` / `pizzaChartRecipes.ts`.

### Filtering

These surfaces do not own filtering. Cohort, minutes threshold, league,
season, position, and age-band are all fixed upstream in the comparison
packet.

### Explicit non-goals

- computing percentiles from raw provider rows inside the component
- owning a scouting table or card layout
- showing multiple metrics in one chart instance (lists compose at the
  parent level using `PercentileBar` repeated, or a `PercentilePill`
  row stack)
- allowing unlabeled percentiles with no accessible comparison context
- flipping the visual direction for `dir="rtl"` contexts
- inverting lower-is-better metrics inside the component (upstream
  responsibility; see invariants)

## Required normalized data

### `PercentileMetric` fields

| Field               | Required | Why it matters                       | Fallback if missing                                   |
| ------------------- | -------- | ------------------------------------ | ----------------------------------------------------- |
| `id`                | yes      | stable identity for warnings + tests | model returns invalid region with `missingId` code    |
| `label`             | yes      | core chart meaning                   | model returns invalid region with `missingLabel` code |
| `percentile`        | yes      | main encoding                        | model returns invalid region with `missingValue` code |
| `rawValue`          | no       | precision read                       | value row + tooltip detail omitted                    |
| `rawValueUnit`      | no       | disambiguates raw value              | omit                                                  |
| `originalDirection` | no       | drives inversion copy + aria-label   | assume `"higher"` (no inversion note)                 |
| `note`              | no       | freeform per-metric footnote         | omit                                                  |

### `PercentileComparisonSample` fields

| Field                   | Required for `Bar` | Required for `Pill`                                 | Why it matters            | Fallback if missing                             |
| ----------------------- | ------------------ | --------------------------------------------------- | ------------------------- | ----------------------------------------------- |
| `label`                 | yes                | required unless `accessibleSampleLabel` is provided | makes the sample explicit | invalid model region (bar) or type error (pill) |
| `seasonLabel`           | no                 | no                                                  | scouting context          | omit                                            |
| `minutesThresholdLabel` | no                 | no                                                  | cohort caveat             | omit                                            |
| `populationSize`        | no                 | no                                                  | sample transparency       | omit; populationSize of 0 or 1 emits a warning  |

Also state:

- provider support now: `aggregate` across Opta / StatsBomb / Wyscout /
  WhoScored — the chart does not read provider events directly. The
  `adapter-gap-matrix.md` row for `PercentileBar` / `PercentilePill`
  lands alongside this spec.
- acceptable lossy mappings: `rawValue` can be omitted entirely as long as
  the percentile and sample remain explicit.

## Default visual contract

### Layout

`PercentileBar`:

- left label block (metric label on line 1, comparison sample on line 2)
- central horizontal track occupying the main width
- right-aligned percentile text (e.g. "87")
- optional note line below sample when `originalDirection === "lower"` or
  `metric.note` is set

`PercentilePill`:

- compact capsule with short label, fill state behind label text, and
  percentile/value summary on the right
- renders on a single baseline for dense row use

### Encodings

- horizontal fill length = percentile
- visual direction is always low-to-high, left-to-right
- guide ticks at 25 / 50 / 75 are rendered as styled lines (no numeric
  text by default; consumers can show them via `ticks` style family)
- color uses a bounded theme-aware positive-scale ramp. In v0.3 the
  default ramp pulls from the chart-chrome token set:
  - `p >= 75`: `chrome.accent.positive` at full opacity
  - `40 <= p < 75`: `chrome.accent.positive` at `0.72` opacity
  - `25 <= p < 40`: `chrome.accent.neutral`
  - `p < 25`: `chrome.accent.caution`
  - track always uses `chrome.surface.subtle` regardless of percentile
- the ramp is symmetric under dark mode; dark-mode contrast is resolved
  by the existing chart-chrome token system, not by flipping colours
- inversion badge renders unconditionally when
  `originalDirection === "lower"`: a short capsule glyph next to the
  metric label. The badge's **label text** comes from
  `inversionBadgeLabel` (default `"lower is better"`); the badge's
  **visual styling** is overridable via the `badges` family. Setting
  `inversionBadgeLabel=""` hides the visible badge only — the
  inversion note is still emitted into the structured
  `accessibleLabel` so AT users keep the disclosure.

### Raw-value formatting

- strings pass through untouched
- numbers format through `Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })`
- consumers can override the formatter via
  `text: { valueFormat: (v) => … }`; the override is called with the
  raw value and expected to return a string

### Label behavior

- bar: comparison sample appears inline under the metric label by default
  (controlled by `showComparisonLabel`)
- pill: comparison label is visually hidden on the smallest pill
  variants, but remains in the `aria-label` (sourced from
  `comparison.label` or `accessibleSampleLabel`)
- inversion copy: when `originalDirection === "lower"`, the default
  inversion badge renders next to the metric label **and** the
  structured `accessibleLabel.inversionNote` is non-null. Tooltips alone
  are never sufficient for the inversion disclosure.

### Responsive behavior

Both components follow the existing Campos chart convention: a fixed
intrinsic `viewBox` with `width="100%"` so the SVG scales with its
container. There is no runtime DOM-measurement primitive and no
automatic bar→pill fallback — composition is the consumer's tool.

Intrinsic layouts:

- `PercentileBar` ships with an intrinsic width/height ratio that
  preserves the label / track / value / percentile arrangement at its
  natural size; text wrapping is handled by SVG `<text>` elements with
  `textLength` + `lengthAdjust="spacingAndGlyphs"` on the metric label
  only, so content shrinks gracefully but the track always keeps its
  proportions.
- `PercentilePill` ships with a narrower intrinsic ratio suited to
  stacking in list rows.
- Consumers who want a bar at small card widths should swap in
  `PercentilePill` explicitly; the spec does not trap the two
  components into a runtime-switchable seam.

Hidden-content rules (apply to intrinsic layout, not container width):

- `showValue={false}` hides the right-aligned raw value
- `showComparisonLabel={false}` hides the sample line below the label
- `showTicks={false}` hides the 25/50/75 guide ticks
- `showPercentileLabel={false}` hides the right-aligned percentile text
- the structured `aria-label` continues to carry every suppressed field

### Empty / fallback behavior

- empty packet → no fake zero bar; parent surface is responsible for
  suppressing the row entirely
- `percentile === null` or `undefined` → invalid region, empty-state copy
- `percentile` outside `[0, 100]` → clamp to endpoint + model warning
- `NaN` or non-finite `percentile` → invalid region, no bar drawn
- missing required `metric.label` / `metric.id` → invalid region, empty
  state with named reason
- missing bar `comparison.label` → invalid region; bar does not render
- pill without `comparison` **and** without `accessibleSampleLabel` →
  type error at compile time (union enforced)

Invalid regions always render the shared empty-state primitive (no ad
hoc inline text). Each compute call to
`resolvePercentileSurfaceModel` emits at most one entry per unique
reason string on the model's `warnings: string[]`. Because the
component is single-metric, "per model resolution" = "per metric
compute call"; list parents that render N bars receive N model
results and may see up to N warnings. The React component surfaces
them by (a) calling the optional `onWarnings` prop (when provided)
and (b) emitting a single dev-only `console.warn` on mount when
`process.env.NODE_ENV !== "production"`. Components never throw in
render. Components never `console.warn` from a render function.

### Static / export posture

- `PercentileBar` joins the stable `ExportFrameSpec` chart union as
  `"percentile-bar"`. Export-safe subset is the bounded constant-only
  contract:
  - constant-only `track`, `fill`, `text`, `ticks`, `badges`
  - no callback or object-map style values
  - recipes are resolved at build time via constants only
- `PercentilePill` is **export-deferred** for v0.3 with a named reason:
  pill densities below 160px collide with the static SVG's accessible
  label contract (no tooltip, no interactive focus for inversion note
  disclosure). It can be reconsidered when a follow-up packet widens the
  static accessible-label surface for compact components.
- Live callback styling remains valid in interactive React usage but is
  not part of the serialized export contract (same policy as
  `RadarChart` / `PizzaChart`).

## Internal primitives required

| Primitive / seam                | Status   | Notes                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolvePercentileSurfaceModel` | new      | pure compute helper in `packages/react/src/compute/`; returns `{ metric, comparison, accessibleLabel, warnings: string[], invalidReason? }`                                                                                                                                                                               |
| shared `StyleValue` resolution  | existing | same helpers used by `RadarChart`, `PizzaChart`                                                                                                                                                                                                                                                                           |
| shared `ChartFrame` empty-state | existing | used for invalid regions                                                                                                                                                                                                                                                                                                  |
| compute-model warnings pattern  | existing | `warnings: string[]` on the model is the established convention (see `radar-chart.ts`, `pizza-chart.ts`, `xg-timeline.ts`, `bump-chart.ts`, `line-chart.ts`, `comet-chart.ts`, etc.); the component surfaces them through `onWarnings` and a single mount-time dev-only `console.warn`. No new shared helper is required. |
| local `PercentileTrackGeometry` | new      | track / fill / tick layout math; stays local to the percentile-surface module until a second chart demonstrates the same need                                                                                                                                                                                             |
| export-frame adapter            | new      | dedicated export-only prop type per `packages/react/src/export/types.ts`; registers `"percentile-bar"` in `chart-kind.ts`                                                                                                                                                                                                 |

**Extraction threshold divergence:** `PercentileTrackGeometry` and the
track/fill SVG pieces stay local to the percentile-surface module in
v0.3. A generic linear-track primitive is intentionally **not** extracted
until a second chart (e.g. `PassSonar` bin strip, `SmallMultiples`
micro-bar) demonstrably needs the same semantics. The implementation
packet must land an `accepted` entry for this decision in
`docs/status/react-renderer-audit.md` at implementation time — not
conditionally — with the rationale "single consumer in v0.3; extraction
deferred until a second chart demonstrates the need". Any later
reconsideration re-edits that entry instead of adding a new one.

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / file                                                                               | Why relevant                                                    | What it covers                                                                                            | What Campos should keep                                                                                            | What Campos should change                                                                    |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `/Volumes/WQ/ref_code/football_viz/primitives.md` line 429 (Cleveland & McGill)           | Evidence that linear position reads outperform angular position | Perceptual argument for precise linear bars over radial fractions when exact reading matters              | Treat linear percentile bars as the precise companion to pizza/radar overview                                      | Do not overstate `primitives.md` coverage — the argument is evidence, not a chapter          |
| `/Volumes/WQ/ref_code/football_viz/primitives.md` line 466 (responsive degrade rule)      | Shared degrade rule for radial charts below 400px               | "degrade to horizontal bar chart below 400px"                                                             | Position `PercentilePill` as the natural composition target when bars shrink; the bar itself does not auto-degrade | Diverge by keeping the bar→pill choice at the composition layer rather than a runtime switch |
| `/Volumes/WQ/ref_code/football_viz/research/pizza_research.md` line 146 (DataMB layout)   | Prior-art for the hybrid radial + precision-bar layout          | "pizza plot at the top with a linear bar list below … gestalt overview paired with precision readability" | Pair `RadarChart` / `PizzaChart` with `PercentileBar` lists when exact reads matter                                | Keep percentile surfaces standalone rather than baking them into `PizzaChart`                |
| `/Volumes/WQ/ref_code/football_viz/research/pizza_research.md` line 188 (sample labeling) | Direct source for the comparison-sample invariant               | "always display what population the percentiles are computed against"                                     | Make the comparison sample a first-class invariant on the bar and the pill                                         | None — the rule is already baked into the invariants                                         |
| FBref scouting-report convention (verified against live `fbref.com/en/players/...` docs)  | Real-world comparison-sample + minutes-threshold wording        | Dense metric rows with sample transparency                                                                | Mirror the explicit sample label + minutes threshold tone                                                          | Do not copy site chrome or pretend Campos owns FBref's data product                          |

## Edge-case matrix

| Case                                                       | Expected behaviour                                                                                                                                                                            | Test shape                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Empty packet                                               | Parent suppresses the row; if passed to the component, invalid region with named reason                                                                                                       | compute test + React empty-state test                     |
| Single metric (bar)                                        | Renders normally                                                                                                                                                                              | React smoke test                                          |
| `percentile === 0` / `percentile === 100`                  | Clamped visually to endpoints; no overflow, no warning                                                                                                                                        | compute test                                              |
| Out-of-range percentile (`< 0` or `> 100`)                 | Clamp to nearest endpoint + `outOfRange` warning on the model                                                                                                                                 | compute test                                              |
| `NaN` / non-finite percentile                              | Invalid region + `nonFiniteValue` warning; no bar drawn                                                                                                                                       | compute test + React empty-state test                     |
| Missing `metric.label` / `metric.id` / `metric.percentile` | Invalid region with named reason; no render, dev-only console warn                                                                                                                            | compute test                                              |
| Missing bar `comparison.label`                             | Invalid region; bar does not render                                                                                                                                                           | compute test + React empty-state test                     |
| Pill with neither `comparison` nor `accessibleSampleLabel` | Compile-time type error                                                                                                                                                                       | type-only test (tsc / dts-checker)                        |
| Missing `rawValue`                                         | Percentile read preserved; value row hidden                                                                                                                                                   | React test                                                |
| Lower-is-better metric                                     | Badge visible next to label; aria-label includes inversion note; axis still runs low→high                                                                                                     | React test + a11y assertion on structured accessibleLabel |
| `populationSize === 0` or `=== 1`                          | Rendered; model warning `weakSample` emitted                                                                                                                                                  | compute test                                              |
| Duplicate warnings within a single compute call            | De-duped: each `resolvePercentileSurfaceModel` call emits at most one entry per unique reason string on `warnings`                                                                            | compute test                                              |
| Narrow container (CSS-scaled)                              | Intrinsic viewBox scales with container via `width="100%"`; no runtime DOM-measurement fallback exists                                                                                        | demo-page visual check                                    |
| Long / multilingual labels                                 | Wrap allowed on the metric label via `textLength` + `lengthAdjust`; percentile read remains visible                                                                                           | React test snapshot                                       |
| RTL (`dir="rtl"` context)                                  | Root `<svg>` sets `direction="ltr"` so layout coordinates and text baselines are unchanged; strong-RTL glyphs inside a metric label may still reorder within their own `<text>` run by design | React test (attribute assertion + visual snapshot)        |
| Touch / mobile interaction                                 | Focusable via keyboard and touch; structured label survives without hover                                                                                                                     | a11y test                                                 |
| Mixed-null in rows                                         | Rows with invalid metrics render the empty-state; neighbours render normally                                                                                                                  | React test                                                |
| Dense overlap (pill row stack)                             | Pills keep ≥ 4px vertical gap; stacked layout inherits row background                                                                                                                         | demo-page smoke test                                      |
| Identical `rawValue` / different `percentile`              | Both render honestly (legal — different cohorts)                                                                                                                                              | compute test                                              |

## Accessible-label contract

The compute helper returns a structured `accessibleLabel` on the model:

```ts
type PercentileAccessibleLabel = {
  metricLabel: string;
  percentileText: string; // e.g. "87th percentile"
  sampleText: string; // from comparison.label or accessibleSampleLabel
  inversionNote?: string; // present iff originalDirection === "lower"
};
```

The root `<svg>` joins these into its `aria-label`; tests assert against
the structured shape, not the concatenated string, to keep them stable
across copy tweaks. An end-to-end string check covers the final render
once.

## Pre-implementation prep

Resolved before implementation opens:

- demo fixture: **site-owned**. `apps/site/src/data/percentile-surfaces-demo.ts`
  hand-curated from a documented FBref scouting row (the source URL is
  recorded in the fixture module per `CLAUDE.md` Reference Code Library
  policy) and includes at least one lower-is-better metric. The same
  fixture module exports both a `PercentileMetric[]` shape and a
  `RadarChartRow[]` shape derived from the same source rows, so the
  hybrid demo stays honest about normalization differences (e.g.
  `originalDirection` vs `lowerIsBetter`).
- reusable adapter percentile packet: **deferred**. Reopens only if a
  later packet (W4c / W4d or a scouting-data packet) demands it.
- `docs/standards/adapter-gap-matrix.md` gains a new row before any
  implementation code lands. The row to add, verbatim under the
  "Component readiness summary" section:

  ```
  | `PercentileBar` / `PercentilePill` | aggregate | aggregate | aggregate | aggregate | Chart consumes precomputed display-scale percentile packets; provider-level percentile generation and lower-is-better inversion are upstream concerns. See `docs/specs/percentile-surfaces-spec.md`. |
  ```

- `docs/status/react-renderer-audit.md` gains an `accepted` row for the
  local `PercentileTrackGeometry` primitive at the same time, per
  §Internal primitives required.

## Demo requirements

- required page path: `apps/site/src/pages/percentile-surfaces.astro`
- baseline scenario: single-player `PercentileBar` list with explicit
  sample labeling and at least one lower-is-better metric
- fallback scenario: missing raw value + invalid percentile (NaN + out
  of range) rendered via the empty-state primitive
- stress scenario: compact `PercentilePill` row stack (12+ pills) with a
  mix of lower-is-better and higher-is-better metrics, showing that
  composition with the pill is how small-card layouts are handled (the
  bar does not auto-degrade at runtime)
- hybrid scenario: same player rendered side-by-side as `RadarChart`
  (overview) and as a `PercentileBar` list (precision), with a
  methodology note explaining when to pick which. This is the card that
  the FBref-style battle-test recreation (W4a target 1) will pressure.
- theme scenario: dark-theme card showing identical data to the baseline

## Test requirements

### Compute tests (`packages/react/test/compute/compute-percentile-surface.test.ts`)

- clamp behavior at `0`, `100`, `-5`, `105`
- `NaN` / `Infinity` / `-Infinity` → invalid region with `nonFiniteValue`
- missing fields → correct invalid-region codes
- inversion-note emission when `originalDirection === "lower"` only
- `populationSize` edge cases (0, 1, 2, positive integers)
- warning de-duplication per model resolution
- structured `accessibleLabel` shape for higher-is-better and
  lower-is-better metrics

### React tests (`packages/react/test/PercentileSurfaces.test.tsx`)

- zero-config bar renders sample label visibly
- bar with `showComparisonLabel={false}` still exposes the sample via
  `aria-label`
- pill without `comparison` and without `accessibleSampleLabel` fails
  type-check (type-only assertion using `expectTypeOf` or
  `@ts-expect-error`)
- pill with `accessibleSampleLabel` omits the visible line but exposes
  the label via `aria-label`
- lower-is-better metric renders the default inversion badge
  ("lower is better") + includes the note in the root `aria-label`
- setting `inversionBadgeLabel=""` hides the visible badge but keeps
  the inversion note in the structured `accessibleLabel`
- invalid packet renders the shared empty-state primitive; the
  `onWarnings` callback receives the expected warning strings
- RTL context sets `direction="ltr"` on the root `<svg>`
- recipe resolution: `PercentileBarRecipe.quiet` overrides track/fill
  constants but individual style-family overrides still apply on top

### Export tests (`packages/react/test/ExportFrame.test.tsx` extensions)

- `percentile-bar` spec with constant-only style families renders
- `createExportFrameSpec` rejects callback or object-map style values on
  percentile charts at runtime
- `percentile-pill` is not in the supported union (the deferred posture
  is enforced)

### Accessibility tests

- `aria-label` on the root svg includes metric + percentile + sample +
  inversion note (when applicable); assertion reads the structured
  model field, not the concatenated string
- focus reaches the bar/pill with a visible outline

## Review plan

- Loop 1 — spec adversarial review: closed. Verified the family stays
  football-specific, that the export/accessibility contracts are
  explicit, and that inversion ownership is unambiguous.
- Loop 2 — implementation adversarial review: verify the style-family
  shape matches the declared contexts, the warning channel behaves as
  specified, SSR/static render paths are clean, and the demo page meets
  all five scenarios above. Will include a browser-level check of the
  dark-theme and narrow-width cases.
- Loop 3 — release-readiness adversarial review: confirm `pnpm check`,
  `pnpm build`, `pnpm --filter @withqwerty/campos-site build`, and the
  `ExportFrame` test additions all pass; confirm the adapter-gap matrix
  and status matrix rows reflect the implementation; verify the page
  teaches the bar-vs-`PizzaChart`/`RadarChart` choice.

## Open questions

- Should a future adapter-backed scouting packet own a reusable
  percentile data product, or should Campos continue to expect
  precomputed percentile inputs? (Tracked for W4c/W4d cross-check.)
- Does `PercentilePill` need a first-class tooltip seam, or is the
  structured accessible label enough in v1? (Re-evaluate once the pill
  row stack demo is exercised in browser review.)
