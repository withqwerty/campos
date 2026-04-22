# PassFlow Component Spec

**Status:** shipped (v0.3 beta landed 2026-04-18 — interactive feature set complete)
**Last updated:** 2026-04-18
**Scope for v0.3 alpha:** static chart only. Animation and the Barcelona GIF battle-test recreation were deferred to v0.3 beta and have now landed (see "v0.3 beta addendum" at the bottom of this doc).

## Header

- Component / primitive: `PassFlow` (new public chart component)
- Status: draft spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer (new `computePassFlow`)
  - `@withqwerty/campos-react` renderer seams (`PitchChartFrame`, shared legend primitives)
  - `@withqwerty/campos-stadia` pitch surface primitives
  - `@withqwerty/campos-schema` canonical `PassEvent`

## Purpose

- **User task:** show a team's aggregate passing _style_ on one pitch — where passes originate, how often, and in what average direction from each zone.
- **Why Campos:** existing charts answer "what passes happened" (`PassMap`) and "who linked with whom" (`PassNetwork`). Neither answers "what does this team's passing field _look_ like" — the flow-field view that StatsBomb, mplsoccer, FBref, The Analyst all publish. It is the canonical third pass chart.
- **Why public:** binning, circular mean, consistency thresholds, arrow containment, and colorbar semantics are chart-level product behavior, not consumer glue. Users supplying raw `PassEvent[]` should get a publishable result zero-config.

## Domain framing

### Football concept

`PassFlow` models a **spatial pass-origin aggregate with directional context**: the pitch is partitioned into a regular grid of zones; each zone encodes (a) how much passing originated there and (b) the average onward direction of those passes.

It is not:

- a heatmap of pass _endings_ (that is a destination heatmap)
- a pass network (aggregates by player, not by zone)
- a flow-line chart of individual passes (`PassMap`)
- a momentum / tempo timeline

### Bounded-context ownership

- `schema` owns the canonical `PassEvent` shape (start/end x,y in Campos 0–100 space, attacking direction resolved upstream).
- `adapters` own provider normalization: all inputs must already be in Campos frame (origin bottom-left, attacker shoots toward x=100).
- `react` owns:
  - binning strategy and circular-mean math (compute layer)
  - color ramp choice, default grid resolution, arrow containment, consistency threshold
  - streamline-vs-arrow rendering, animation sequencing
  - legend/colorbar presentation
- `stadia` owns pitch rendering and coordinate projection only.

### Canonical input model

- Input: `readonly PassEvent[]`.
- Only fields read: `x`, `y`, `endX`, `endY`, optional `outcome` (`"complete" | "incomplete" | …`), optional `teamId`, `minute`.
- All provider parsing must have resolved axis inversions, attacking-direction normalization, and cross/corner classification upstream. The chart does not inspect provider IDs or raw qualifiers.

### Invariants

- **Coordinate invariance.** Every input pass is in Campos frame (origin bottom-left, 0..100, attacker shoots toward x=100). The chart never flips axes. Angles are reported in Campos frame: `0°` = `+x` (attacker's attacking direction), increasing counter-clockwise, range `[-180°, 180°]`.
- **Circular mean only.** Arithmetic mean of angles is wrong at the ±180° seam. The compute layer computes `Sx = Σ cos θ`, `Sy = Σ sin θ`, and then:
  - `R = √(Sx² + Sy²) / n` — mean resultant length, in `[0, 1]`.
  - `meanAngle = atan2(Sy, Sx)` **only when** `R ≥ 1e-9` and `n ≥ minCountForArrow`. Otherwise `meanAngle = null`.
  - `n === 1` also forces `meanAngle = null` if `minCountForArrow ≥ 2` (default 2). A single pass is not a direction; it's an event.
- **Arrow gate.** A bin renders an arrow **only** when `meanAngle !== null` AND `R ≥ dispersionFloor` (default 0.3) AND `n ≥ minCountForArrow` (default 2). Otherwise the bin renders `lowDispersionGlyph` (default hollow circle). All three thresholds are reported on the model so callers can override presentation.
- **Arrow length is a hint; renderer owns geometry.** Compute emits `magnitudeHint ∈ [0, 1]` per bin (by mode: `equal` → 1; `scaled-by-count` → `count / maxCount`; `scaled-by-resultant` → `R`). The renderer converts `magnitudeHint × arrowContainment × min(binW, binH)` to pixels. Compute never emits pixel or half-length values.
- **Empty bins degrade silently.** `count === 0` bins render no arrow and a zero-fill cell (theme background colour, opacity 0).
- **Out-of-range coords are clamped, not dropped,** matching existing `Heatmap` behaviour. A pass at `x=-0.5` is treated as `x=0`. `endX`/`endY` outside `[0, 100]` are clamped before the direction vector is computed. Exact `x=100` / `y=100` coordinates fall into the final (highest-index) bin.
- **Animation is cosmetic.** Disabling animation (or `prefers-reduced-motion`) must leave the static model and every test assertion unchanged.

## Public API

### Proposed public export

`PassFlow` from `@withqwerty/campos-react`, alongside:

- `PassFlowStaticSvg` (static export, mirrors `PassMapStaticSvg`)
- `computePassFlow` from `@withqwerty/campos-react`'s compute entry point
- Model types: `PassFlowModel`, `PassFlowBinModel`, `PassFlowLegendModel`

### Zero-config happy path

```tsx
<PassFlow passes={passes} />
```

With no other props this produces:

- Pitch: `crop="full"`, `attackingDirection="right"`, light-themed.
- Grid: `6 × 4` (x × y), equal-size bins over the full pitch.
- Completion filter: **default `"all"`** — the chart does not editorialise. Callers wanting the StatsBomb "Completed Pass Flow" look use the `completedPassFlowPreset()` helper (see Presets below) or pass `completionFilter="complete"` explicitly.
- Colour ramp: sequential blue → dark blue on **share** (`bin.count / totalCount`).
- Arrows: equal length (`arrowLengthMode="equal"`), black, containment-clamped.
- `minCountForArrow=2`, `dispersionFloor=0.3` — sparse / low-consistency bins render a hollow circle, not an arrow.
- Header-stats row with total passes, completion rate, mean pass length.
- Bottom colorbar with 0, mid, max share labels.
- Animation off.

**Default validation (resolved 2026-04-17):** the fixture-validation gate ran against three synthetic fixtures representing high-possession / mid-possession / low-possession profiles, applying the deterministic rule `max(intensity) < 0.4 OR median(intensity) < 0.08` on ≥2 of 3 → flip. None of the three fixtures tripped the rule, so the `share` + `sequential-blues` default is retained for alpha. The gate is locked in as a compute-layer test (`computePassFlow — default-saturation gate`) so regressions surface automatically.

### Presets

- `completedPassFlowPreset()` → `{ completionFilter: "complete", colorScale: "sequential-blues", valueMode: "share" }` — StatsBomb reference look.
- `flowDifferentialPreset()` — deferred to v0.3.1 (requires two pass sets).

### Advanced customization points

```ts
type PassFlowProps = {
  passes: readonly PassEvent[];

  // Coordinate & crop
  crop?: "full" | "half";
  attackingDirection?: "up" | "down" | "left" | "right";

  // Binning
  bins?: { x: number; y: number }; // default { x: 6, y: 4 }
  // Optional explicit grid edges for bespoke layouts (e.g. 1/6/8/3 formation columns).
  // When supplied, overrides `bins`. Must be strictly monotonic, first=0, last=100.
  xEdges?: readonly number[];
  yEdges?: readonly number[];

  // Pass filter (applied in compute layer)
  completionFilter?: "complete" | "incomplete" | "all"; // default "complete"
  minMinute?: number;
  maxMinute?: number;

  // Scaling / colour
  valueMode?: "count" | "share" | "relative-frequency"; // default "share"
  colorScale?: "sequential-blues" | "sequential-reds" | "diverging-rdbu" | "custom";
  colorStops?: readonly { offset: number; color: string }[];

  // Arrow / streamline behaviour
  arrowLengthMode?: "equal" | "scaled-by-count" | "scaled-by-resultant";
  arrowContainment?: number; // default 0.8, clamped to [0.2, 1]; applied in renderer
  dispersionFloor?: number; // default 0.3; R below this → glyph instead of arrow
  minCountForArrow?: number; // default 2; bins with fewer passes render glyph
  lowDispersionGlyph?: "circle" | "cross" | "none"; // default "circle"

  // Animation: out of scope for v0.3 alpha. Deferred to v0.3 beta; see Open Questions.
  // flowAnimation stays off; the prop is reserved but not implemented in alpha.

  // Styles (follows PassMap/ShotMap StyleValue pattern)
  cell?: PassFlowCellStyle;
  arrow?: PassFlowArrowStyle;

  // Standard chart-frame props
  showHeaderStats?: boolean;
  showLegend?: boolean;
  legendPosition?: "bottom" | "right" | "none";
  pitchTheme?: PitchTheme;
  pitchColors?: PitchColors;
  framePadding?: number;
  maxWidth?: number;
  title?: string;
  subtitle?: string;
};
```

### Filtering

- The chart participates in shared filtering via the `minMinute`, `maxMinute`, and (optional future) `teamId` dimensions. See `docs/standards/filtering-standard.md`.
- **Canonical filter dimensions** (surface upward to match `useSharedFilter`): `minMinute`, `maxMinute`. `completionFilter` is a **view rule**, not a filter dimension — defaulting it to `"all"` keeps the chart faithful to the input; consumers wanting completion-only views set it explicitly or use the preset.
- **View rules** (not filter dimensions): `bins`, `xEdges`, `yEdges`, `valueMode`, `colorScale`, `arrowLengthMode`, `arrowContainment`, `dispersionFloor`, `minCountForArrow`, `completionFilter`.

### Explicit non-goals

- Pass-destination heatmap (separate chart; could share binning primitive later).
- Per-player flow decomposition (belongs in `PassNetwork` or a future player dashboard).
- 3D / pressure-weighted flows.
- Live-updating streams; the chart expects a static snapshot.
- Interpolation / smoothing across bins (no kernel smoothing; each bin is independent).
- Streamline-following particles beyond the bin (the "marching dashes" animation stays inside its own bin).

## Required normalized data

| Field     | Required | Why                                 | Fallback if missing                                                                                                       |
| --------- | -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`      | yes      | key stability, tooltip identity     | compute throws (consumer must dedupe)                                                                                     |
| `x`       | yes      | bin assignment                      | pass dropped, counted in `warnings.droppedXY`                                                                             |
| `y`       | yes      | bin assignment                      | pass dropped, counted in `warnings.droppedXY`                                                                             |
| `endX`    | yes      | direction vector                    | pass counted in cell, excluded from mean                                                                                  |
| `endY`    | yes      | direction vector                    | pass counted in cell, excluded from mean                                                                                  |
| `outcome` | no       | completion filtering (when enabled) | when `completionFilter !== "all"` and `outcome` is absent, the pass is dropped with a `warnings.droppedNoOutcome++` entry |
| `minute`  | no       | min/max minute filtering            | pass never excluded by minute filter when absent                                                                          |
| `teamId`  | no       | future filter dim                   | ignored                                                                                                                   |

Provider expectations:

- **Expected to support now:** StatsBomb (open events), Opta F24 (completed passes), Wyscout wyId events.
- **Partial / care needed:** providers where `endX`/`endY` are derived from next-event tracking (e.g. Sportec) — consumer must pre-compute.
- **Lossy mappings acceptable:** collapsing throw-in, corner, free-kick, goal-kick into a single "passes" stream for flow aggregation. Callers wanting to exclude set pieces pre-filter.

## Value modes (definitions)

All three are computed from the **valid, filtered pass set** (the set used for binning after `completionFilter`, `minMinute`, `maxMinute`, and coordinate clamping are applied).

- **`"count"`** — `bin.value = bin.count`. Colorbar is `[0, max(bin.count)]`. Semantic: raw volume.
- **`"share"`** — `bin.value = bin.count / totalValidCount`. Colorbar is `[0, max(share)]`. Semantic: "this zone contributed X% of the team's passes".
- **`"relative-frequency"`** — `bin.value = (bin.count / totalValidCount) / (bin.area / totalArea)`, i.e. observed share divided by the share expected under a uniform spatial distribution. A bin with `relativeFrequency = 1` passes at the rate expected by chance; `> 1` is over-represented; `< 1` is under-represented. This is the StatsBomb "Pass Origin Relative Frequency" quantity. Colorbar is anchored at `1.0` (midpoint) when paired with a diverging ramp; domain is `[0, max(2, observedMax)]` so the midpoint is never truncated.

`bin.area` uses the same Campos-frame bin geometry that binning produced (so `xEdges`/`yEdges` give honest relative frequencies even for non-uniform grids).

## Bin model (shape of `PassFlowBinModel`)

```ts
type PassFlowBinModel = {
  col: number; // 0..binsX-1
  row: number; // 0..binsY-1
  x: number; // left edge in Campos 0-100 x
  y: number; // bottom edge in Campos 0-100 y
  width: number; // in Campos units
  height: number; // in Campos units
  count: number; // passes with origin in this bin (post-filter, post-clamp)
  directionCount: number; // passes that also contributed to mean (have valid endX/endY)
  value: number; // per valueMode
  share: number; // count / totalValidCount (always emitted; colorbar uses when valueMode='share')
  relativeFrequency: number; // always emitted; NaN-safe (0 when totalValidCount===0)
  intensity: number; // value / max(value) — drives colour
  fill: string; // resolved CSS colour
  opacity: number; // 0 if count===0
  meanAngle: number | null; // radians, Campos frame; null iff gate fails
  resultantLength: number; // R in [0,1]
  magnitudeHint: number; // 0..1, per arrowLengthMode
  hasArrow: boolean; // convenience: meanAngle !== null
  lowDispersion: boolean; // true when hasArrow is false and count>0
  tooltip: { rows: Array<{ key: string; label: string; value: string }> };
};
```

## Default visual contract

- **Layout:** `PitchChartFrame` wrapping `Pitch` (crop + attackingDirection from props). Header stats above, colorbar below.
- **Encodings:**
  - Cell fill = `valueMode` mapped through `colorScale`.
  - Cell opacity = 1 for non-empty bins, 0 for empty bins.
  - Arrow angle = circular mean of each bin's pass vectors.
  - Arrow length = `equal` → `arrowContainment × min(binW, binH)`; `scaled-by-count` → proportional to `count / maxCount`; `scaled-by-resultant` → proportional to `R`.
  - Arrowhead = small solid triangle, `marker-end`.
- **Legend:** horizontal colorbar with 3 ticks (0, mid, max) mapped to `valueMode` with unit label (`Pass Origin Share` / `Pass Count` / `Pass Origin Relative Frequency`).
- **Tooltip:** appears on cell hover — rows: `Zone (col, row)`, `Passes`, `% of total`, `Mean direction` (see below), `Directional consistency (R)`.
- **Mean direction formatting.** Internal representation is radians in Campos frame (`0` = `+x` = attacker's attacking direction). Tooltip renders both degrees (`0°–360°`, clockwise-positive for intuition, converted at format time) and a short football bearing relative to the attacker (`forward`, `back`, `left-wing`, `right-wing`, plus 4 diagonals). Never uses compass cardinals — they are ambiguous when `attackingDirection` varies.
- **Empty state:** `emptyState: { message: "No passes to chart" }` when `validCount === 0` after filtering. Renders centered on the pitch.
- **Fallback when `endX`/`endY` missing:** bin still counts the pass (origin is valid), but that pass does not contribute to the circular mean. If every pass in a bin lacks direction, `meanAngle = null`, `hasArrow = false`, and the bin renders as a coloured cell with `lowDispersionGlyph`.
- **`lowDispersionGlyph: "none"`** — when explicitly set to `"none"`, a failing-gate bin renders **only** its coloured cell. The model still emits `hasArrow: false`, so custom renderers can distinguish "no arrow because gated" from "no arrow because empty". Documented trade-off: visual ambiguity between gated and successful-but-centred arrows is the caller's responsibility.
- **Dispersion fallback:** bins where `hasArrow === false && count > 0` render `lowDispersionGlyph` at bin centre.

## Binning rules

- **Default grid.** `bins = { x: 6, y: 4 }`. Equal-width cells over `[0, 100]` on each axis (post-crop — see below).
- **Explicit edges.** `xEdges`/`yEdges` override `bins`. Validation rules (compute throws if violated):
  - length ≥ 2, strictly monotonic increasing
  - first edge equals the crop-left (`0` for `crop="full"`; see crop section for half)
  - last edge equals the crop-right (`100` for `crop="full"`)
  - all values in `[0, 100]`
- **Edge assignment rule** — matches existing `Heatmap` behaviour exactly so the shared seam fix (if we ever extract binning) is mechanical:
  - a pass at `x ∈ [edge[i], edge[i+1])` lands in bin `i`
  - a pass at exactly `x === lastEdge` lands in the final bin (special-case to avoid dropping boundary hits)
  - identical rule on y
- **Coordinate frame.** `xEdges` / `yEdges` are always supplied in raw Campos frame (origin bottom-left, 0..100). Renderer handles visual orientation via `attackingDirection`. Do NOT supply pre-flipped edges.

### Crop semantics

Per `docs/standards/coordinate-invariants.md`, all event coordinates are **attacker-relative**: `x=100` is always toward the opposition goal, regardless of `attackingDirection`. `attackingDirection` is a renderer hint only (which way the attacker faces on screen); it does not change data semantics.

- **`crop="full"`** — bin range is `[0, 100] × [0, 100]`.
- **`crop="half"`** — bin the **attacking half** in data space: always `x ∈ [50, 100]`, full y-range, for every `attackingDirection`. Matches existing `Heatmap` behaviour. `share` and colourbar domains use the attacking-half population so intensities stay meaningful.
- With explicit `xEdges` and `crop="half"`: first edge must equal `50`, last must equal `100`. Compute throws otherwise.
- `bins.x` with `crop="half"` spans 50 Campos x-units (so `bins.x=6` → 6 bins × ~8.33 wide).

## Internal primitives required

| Primitive              | Status                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PitchChartFrame`      | existing                                                                                                                                                                                                                                                                                                                                                                                       |
| `ChartLineMark`        | existing                                                                                                                                                                                                                                                                                                                                                                                       |
| `ChartTooltip`         | existing                                                                                                                                                                                                                                                                                                                                                                                       |
| `EmptyState`           | existing                                                                                                                                                                                                                                                                                                                                                                                       |
| Gridded-cell layer     | **new in this packet** — `ChartPitchGridLayer` (cell `<rect>` + fill + hit overlay). Not shared with Heatmap in alpha.                                                                                                                                                                                                                                                                         |
| Flow-arrow glyph layer | **new in this packet** — `ChartFlowArrowLayer` (owns containment-to-pixel mapping, glyph fallback, arrowhead markers). No animation in alpha.                                                                                                                                                                                                                                                  |
| Colorbar legend        | existing (heatmap) — reuse                                                                                                                                                                                                                                                                                                                                                                     |
| Circular-mean utility  | **new** — `compute/circular.ts` (small pure util, ~20 LOC; shared-seam candidate if a future chart also needs it)                                                                                                                                                                                                                                                                              |
| Binning utility        | **deferred.** PassFlow implements binning inline in `computePassFlow`. Heatmap and PassFlow both have live binning code for ≥1 release before we consider extraction. Extraction deferred until a third consumer appears or we hit a real correctness bug that exists in both. Per adversarial review: "an abstraction with one current consumer and one prospective consumer is speculative". |

## Reference code consulted

Start at `/Volumes/WQ/ref_code/INDEX.md`.

| Repo                                       | Why relevant                                          | What it covers                                                                          | What Campos should keep                                                         | What Campos should change                                                                                         |
| ------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `mplsoccer`                                | `Pitch.flow()` is the canonical python implementation | 6×4 default grid, circular mean, arrow containment, `arrow_type='same'`, statsbomb demo | default grid resolution, circular mean, containment ratio, equal-length default | React/SVG renderer (matplotlib layout choices don't apply), dispersion floor made explicit (mplsoccer skips this) |
| `statsbomb-reference-figures` (if present) | Reference for "Completed Pass Flow" public charts     | diverging colour on relative frequency                                                  | optional `valueMode="relative-frequency"` and `colorScale="diverging-rdbu"`     | our default is sequential-blues on share — cleaner zero-config story                                              |
| `kloppy`                                   | Coordinate system transformations                     | confirms we should not re-invert axes inside the component                              | trust adapter outputs                                                           | n/a                                                                                                               |
| `d3-soccer`                                | JS/SVG pitch viz reference                            | closest-to-SVG pitch rendering patterns                                                 | none directly relevant to flow field                                            | n/a                                                                                                               |

Open-source repos with literal streamline/animation patterns for pitches are not known to exist at the time of this spec. The marching-dashes animation is a Campos design choice informed by the reference GIF at `/Volumes/WQ/ref_code/football_viz/passflow/pass_flow.gif`; the static layout is directly modelled on `mpl_passflow.png`.

## Edge-case matrix

| Case                                                 | Expected behaviour                                                                                                                    | Test shape                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `passes === []`                                      | `model.emptyState` set, `bins[].count === 0`, no arrows, colorbar domain `[0, 1]`                                                     | compute test asserting `empty` + React test asserting `EmptyState` renders        |
| All passes in one bin                                | that bin saturated; others 0 opacity                                                                                                  | compute test on bin values                                                        |
| All passes have identical vector                     | `R === 1`, arrow rendered at exact angle                                                                                              | compute test with synthetic colinear data                                         |
| All passes antiparallel in one bin (R→0)             | `meanAngle = null`, `hasArrow = false`, glyph rendered; compute does NOT emit a spurious 0°                                           | compute test with antiparallel pairs: assert `meanAngle === null` when `R < 1e-9` |
| Single pass in a bin (n=1)                           | `R = 1` but `hasArrow = false` because `n < minCountForArrow` (default 2). Glyph rendered.                                            | compute test asserting n=1 bin → `hasArrow === false`                             |
| Bin with `minCountForArrow=0` override               | All gating comes from `R ≥ dispersionFloor`; user can opt into n=1 arrows explicitly.                                                 | compute test with `minCountForArrow: 0`                                           |
| Passes on a bin edge                                 | `x ∈ [edge[i], edge[i+1])` → bin `i`; `x === lastEdge` → final bin (matches heatmap rule).                                            | compute test at `x=16.666…` (exact default edge) and `x=100`                      |
| Out-of-range coordinates (`x < 0`, `x > 100`)        | **Clamped** to `[0, 100]` (matches heatmap). `warnings.clampedXY` counter increments; pass is retained.                               | compute test on clamp behaviour; asserts warning counter                          |
| `endX` / `endY` missing                              | pass counted in bin origin, `directionCount < count` for that bin; excluded from mean. If `directionCount === 0`, `meanAngle = null`. | compute test                                                                      |
| `crop="half"` across all `attackingDirection` values | Bins always span `[50, 100]` in data space (attacker-relative); only render orientation differs. Model equal under all 4 directions.  | compute test asserts identical model across `"right"`/`"left"`/`"up"`/`"down"`    |
| Explicit `xEdges` mismatches crop boundary           | Compute throws `InvalidEdgesError` with message referencing expected boundaries.                                                      | compute test asserting throw + message                                            |
| Long multilingual title / subtitle                   | Rendered without overflowing frame; truncation handled by frame, not chart                                                            | visual snapshot + a11y test                                                       |
| Touch/mobile hover                                   | Tooltip on tap; hover-rect is per-cell so small targets usable                                                                        | React test asserting `onClick` toggle; visual verification on mobile              |
| Degenerate colorbar domain (max=0)                   | colorbar collapses to a single swatch labelled `0`                                                                                    | compute test + React snapshot                                                     |
| Provider disagreement (open play vs set piece)       | documented as caller-filter concern; `outcome` filter is completion-only                                                              | documented in spec, not behaviour test                                            |
| SSR rendering                                        | Server output identical to client static paint (trivial in alpha since no animation)                                                  | snapshot via `renderToString`                                                     |
| `prefers-reduced-motion: reduce`                     | N/A in alpha (no animation); re-opened when animation lands in beta                                                                   | deferred to beta                                                                  |

## Pre-implementation prep

- Reference images: `/Volumes/WQ/ref_code/football_viz/passflow/mpl_passflow.png` (static mplsoccer, 6×4 sequential blue) and `/Volumes/WQ/ref_code/football_viz/passflow/pass_flow.gif` (animated StatsBomb Barcelona, fine grid, diverging ramp, marching dashes).
- Fixture source: we already have StatsBomb open-data match passes in `apps/site/src/data/` for passmap / passnetwork showcases. Re-use via an importer that restricts to team + completed passes. Record source path in the fixture module. If coverage is missing, derive from `/Volumes/WQ/projects/www/data/` — document the source.
- Adapter check: `fromStatsBomb.passes()` already emits `PassEvent[]` with `x,y,endX,endY,outcome`. No adapter widening expected.
- Demos to ship day one (v0.3 alpha):
  1. Baseline 6×4, full pitch, `completionFilter="all"`, OL Reign (or substitute) fixture — matches mplsoccer reference up to the completion default.
  2. `completedPassFlowPreset()` applied to same fixture — recreates the StatsBomb "Completed Pass Flow" look.
  3. Fine-grid (16×10) diverging-rdbu relative-frequency — demonstrates spatial emphasis (static only in alpha).
  4. Half-pitch attacking third with both `attackingDirection="right"` and `attackingDirection="left"` — the binned data is identical; only the visual orientation differs.
  5. Arrow-length-by-count vs equal comparison (small-multiples).
  6. Dispersion-floor demonstration — contrast `dispersionFloor=0` vs `0.3` AND `minCountForArrow=1` vs `2`.
  7. Edge cases: empty data, all-in-one-bin, antiparallel-in-one-bin (proves glyph output).
- Battle-test recreation of the animated Barcelona GIF is scheduled for v0.3 beta, alongside the animation implementation.

## Demo requirements

- Required page path: `apps/site/src/pages/components/pass-flow.astro` (standard primitive demo page).
- Baseline scenario: OL Reign vs Houston Dash (mplsoccer reference) — 6×4 sequential blue, `valueMode="share"`.
- Fallback scenario: passes with missing `endX`/`endY` — proves cells still render, arrows gracefully omitted.
- Stress / dense scenario: Barcelona 2019/20 season pass origins, 16×10 diverging-rdbu, animated.
- Battle-test target: `apps/site/src/components/showcase/BarcelonaPassFlow.tsx` — **scheduled for v0.3 beta**, not alpha. The target matches the animated GIF; alpha ships the static mplsoccer baseline instead.

## Test requirements

- **Adapter tests:** none new (existing `fromStatsBomb.passes` tests cover input shape).
- **Compute tests** (`packages/react/test/compute/pass-flow.test.ts`):
  - empty input → `emptyState` present
  - single bin saturated
  - circular mean correctness (including 350° + 10° → 0°, not 180°)
  - resultant length correctness at `R=1`, `R=0`, `R=0.5`
  - dispersion floor triggers glyph output (at `R < 0.3` default)
  - `minCountForArrow` gate triggers glyph output (n=1 bin → no arrow by default)
  - `magnitudeHint` equals 1 for `"equal"`, `count/maxCount` for `"scaled-by-count"`, `R` for `"scaled-by-resultant"`
  - `relative-frequency` computed honestly for non-uniform `xEdges`/`yEdges`
  - completion filter behaviour (all / complete / incomplete)
  - minute window filter
  - custom `xEdges` / `yEdges` monotonicity validation (throws informative error)
  - warnings surface dropped counts (out-of-range, missing endXY)
  - valueMode round-trip (`count`, `share`, `relative-frequency`)
- **React tests** (`packages/react/test/PassFlow.test.tsx`):
  - renders cells with correct fill
  - renders arrows for non-low-dispersion bins and glyphs for low-dispersion
  - hover toggles tooltip with expected rows
  - keyboard focus reaches cells (tab order), aria-label describes zone
  - animation respects `prefers-reduced-motion: reduce`
  - SSR static snapshot stable
- **Accessibility checks:** each cell `role="button"` with human-readable label ("Zone col 3 row 2: 42 passes, 12% of total, mean direction north-east, high consistency"). The colorbar has an accessible name. Animation honours reduced-motion media query.
- **Regression fixtures:** snapshot of computed `PassFlowModel` for the OL Reign baseline fixture, checked into `packages/react/test/__snapshots__/pass-flow.baseline.json`.

## Review plan

- Loop 1 — **scope / spec adversarial review** (this doc): pass through `compound-engineering:document-review:adversarial-document-reviewer` and `compound-engineering:document-review:feasibility-reviewer`.
- Loop 2 — **implementation adversarial review**: after compute + React + tests land, run `.claude/agents/adversarial-reviewer.md` against the diff.
- Loop 3 — **release-readiness adversarial review**: after showcase recreation, run `visual-verifier` plus a final adversarial pass focusing on the battle-test recreation fidelity.

## Open questions

1. **Default colour scale: resolve against real data before shipping.** Proposal remains sequential-blues on share; gated by the fixture-validation step in Zero-config happy path. If the default looks under-saturated on 2-of-3 reference fixtures, flip to `valueMode="relative-frequency"` with `colorScale="diverging-rdbu"`.
2. **Animation deferred.** v0.3 alpha ships static only. Marching-dashes animation returns in v0.3 beta once: (a) static visual is locked, (b) SSR snapshot stability is proven with CSS-only animations, (c) `prefers-reduced-motion` is threaded through the existing theme context rather than an ad-hoc `matchMedia` call, (d) reference GIF timings are _measured_ (`ffprobe` the frame timing) rather than guessed. Battle-test recreation of the Barcelona GIF slips to the beta milestone.
3. **Interaction on mobile.** Cell cells can get small at fine grids. Proposal: minimum hit-target of 8 pitch units via a transparent overlay rect per cell (mirrors `PassMap` invisible hit area).
4. **Export parity.** `PassFlowStaticSvg` must render without animation and without React state, matching the static export contract in `export-style-parity-spec.md`. In alpha this is trivial (no animation exists); stays a day-one requirement when animation lands.
5. **Fixture licensing.** The OL Reign vs Houston Dash mplsoccer reference figure is illustrative; confirm the underlying event data is in StatsBomb open data before using it as the baseline fixture. If not, substitute a StatsBomb open-data women's match of similar shape and credit accordingly.
6. **Resultant-length gate default (0.3).** Mplsoccer does not gate by R. 0.3 is a Campos-specific editorial choice. Validate against fixtures: if it hides too many bins, drop to 0.2; document the chosen value in `theme/tokens.json` or component docs so analyst consumers can audit.
7. **Follow-up deferred:** per-player decomposition; pressure-weighted flows; flow differential (team A − team B) — all out of scope for v0.3.
8. **Binning-utility extraction.** Re-examine after v0.3 ships. Trigger: third chart needing gridded binning OR a concrete correctness bug appearing in both heatmap and passflow binning simultaneously.

## v0.3 beta addendum — shipped 2026-04-18

Seven packets delivered on top of v0.3 alpha. Every new surface is covered by unit tests, a demo card on `/passflow`, and an entry in `docs/status/matrix.md`. Source of truth is the JSDoc on `PassFlowProps` in `packages/react/src/PassFlow.tsx`; this addendum is a navigation aid.

### Interaction & data surfaces

- **`arrowColor: string | ((bin: PassFlowBinModel) => string)`** — per-bin colour callback. Invoked only on bins that draw a visible arrow; the resolver emits one `<marker>` per unique colour with a stable SVG-safe id.
- **`arrowheadScale: number`** (default 3) — arrowhead dimensions as a multiple of strokeWidth. Stroke itself scales with bin size (STROKE_RATIO × min(binW, binH) clamped to [0.15, 0.8]m).
- **`directionFilter: "all" | "forward" | "backward" | "lateral"`** — classify pass vectors by 4-sector scheme; non-`all` filters drop passes that don't match so cell colour tracks the filter.
- **`periodFilter: readonly (1|2|3|4|5)[]`** — include only passes from listed match periods. Drives halftime-adjustment storytelling (two charts side-by-side with `[1]` / `[2]`).
- **`arrowLengthMode: "scaled-by-distance"` (new variant)** — encodes mean pass distance per bin as arrow length. Every bin's `meanDistance` is always surfaced on the compute model for headless consumers.
- **`showHoverDestinations: boolean`** (default false) — hover a bin to overlay every destination (`(endX, endY)`) as a dot + optional spoke. Opts the compute layer into `captureDestinations: true`, allocating a per-pass object per direction-contributing pass. `hoverDestinationColor` overrides the default (arrow colour scalar → theme primary).
- **`captureDestinations: boolean` (compute input)** — explicit opt-in so headless consumers can read `bin.destinations: readonly {endX,endY}[]` without rendering. Empty bins share a frozen singleton array (`EMPTY_DESTINATIONS`) to avoid per-model allocation.

### Visual & motion surfaces

- **`animate: "none" | "dashes" | "dashes-on-hover"`** (default `"none"`) — marching-dashes CSS keyframe animation on the arrow strokes. Respects `prefers-reduced-motion: reduce`.
- **`filterTransition: "none" | "morph"`** (default `"none"`) — when `"morph"`, every bin renders both a `<line>` and a glyph (opacity toggles visibility) so CSS transitions on `x1 / y1 / x2 / y2 / cx / cy / r / opacity` fire when prop changes re-run compute. 320ms cubic-bezier; respects `prefers-reduced-motion`. Pairs with `usePassFlowFilters`.
- **`pitchMarkings: PitchMarkingsConfig`** — passthrough to the internal `<Pitch markings={...}>` so tactical zone markings (18 / 20 / half-spaces / thirds) can be drawn underneath the bins.

### Bin-edge utilities

- **`xEdges / yEdges: readonly number[]`** — explicit monotonic bin boundaries in Campos 0–100 space. First/last must match the active crop (`xEdges[0] === 0` for full, `50` for half). Validation throws `InvalidEdgesError` with axis/index/expected-value context.
- **`zoneEdgesInCampos(layout: "18" | "20")`** (from `@withqwerty/campos-stadia`) — returns frozen `{ xEdges, yEdges }` for the two stadia zone layouts. Full-pitch only; combining with `crop="half"` throws `InvalidEdgesError` (both zone layouts span x 0..100 by construction).

### Hook

- **`usePassFlowFilters({ defaults })`** — owns per-filter state and returns `{ state, setFilter, setState, reset, passFlowProps }`. Callback identities are stable across renders even when the caller inlines the defaults object literal (defaults captured in a ref on mount). `passFlowProps` omits undefined entries so the spread doesn't clobber caller-supplied chart defaults. Type-derives the filter shape from `ComputePassFlowInput` so drift is impossible.

### Shared seams

- **`compute/edges.ts`** — `uniformEdges`, `validateEdges`, `assignBin`, `InvalidEdgesError` extracted from both `pass-flow.ts` and `heatmap.ts`. Heatmap now throws the same typed error class as PassFlow, so consumers can `instanceof`-guard uniformly.
- **`PassFlowBinModel.key`** — compute emits a stable `row-col` string id so every layer reads one source of truth instead of reconstructing it.

### Static export contract

`ExportPassFlowProps` is `Omit<PassFlowProps, …>` on the non-serialisable / non-applicable fields: `arrowColor` (callbacks not JSON-safe; narrowed to string), `animate`, `filterTransition`, `showHoverDestinations`, `hoverDestinationColor`. Static SVG exports can't run CSS animations or render hover overlays, so propagating those props to `PassFlowStaticSvg` would only allocate wasted state.

### Background-aware contrast (cross-cutting)

PassFlow now ships a per-bin contrast pick layered with an optional cartographic halo. Three new props on `PassFlowProps`:

- **`arrowColor: string | "contrast" | ((bin) => string)`** — the new `"contrast"` sentinel runs `pickContrast(bin.fill, [theme.contrast.onLight, theme.contrast.onDark])` per bin (WCAG 2.x relative luminance). Recommended for any sequential or diverging colour scale where cell luminance varies sharply.
- **`lowDispersionGlyphColor: string | "contrast"`** — same shape, applied to the circle / cross glyph. Falls back to the resolved arrow colour, so `arrowColor: "contrast"` cascades into the glyph for free.
- **`arrowHalo: boolean | { color?: string | "contrast"; width?: number }`** — a thin contrasting underlay stroke behind each arrow. The cartographic mapping convention; survives any background regardless of luminance. `true` picks halo colour against `bin.fill` from `theme.contrast.halo`. Ideal pairing: `arrowColor: "contrast"` + `arrowHalo: true`.

The contrast utility lives at `packages/react/src/colorContrast.ts` and is exported from the top-level barrel: `pickContrast`, `contrastRatio`, `relativeLuminance`, `parseColorString`, `hexLuminance`, `contrastColor` (back-compat alias), and the `Rgba` type. Territory's previously-inline ITU-R BT.601 contrast helper is now also routed through `pickContrast`, unifying the algorithm across charts.

`UITheme` gained a `contrast: { onLight, onDark, halo: { onLight, onDark } }` field (light + dark themes). Charts pick from it so consumers can theme the candidate colours without touching every chart.
