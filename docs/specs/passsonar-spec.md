# PassSonar Spec

**Status:** done — Loop 1 + Loop 2 adversarial reviews closed; W4c expansion shipped 2026-04-21
**Last updated:** 2026-04-21

## Header

- Component / primitive:
  - `PassSonar` (public chart component)
  - `computePassSonar` (public headless helper, exported from `@withqwerty/campos-react`)
- Status: active spec
- Owner: Campos team
- Target version: v0.3
- Depends on:
  - canonical `PassEvent` inputs (start/end coordinates already normalised
    upstream)
  - `@withqwerty/campos-react` shared chart frame, tooltip, legend, theme,
    style-value, and empty-state seams
  - shared circular-statistics helpers in
    `packages/react/src/compute/circular.ts`
  - shared bin-edge helpers in `packages/react/src/compute/edges.ts` (only the
    half-open interval convention is reused; PassSonar uses angular bins, not
    pitch-zone edges)

## Purpose

- What user task this solves:
  - show how one subject distributes passes by direction, volume, and success
    in a compact football-native radial chart
- Why it belongs in Campos:
  - directional passing profiles are a common football idiom and a real gap in
    the current library; the closest neighbouring chart, `PassFlow`, gives a
    pitch-zone arrow density view rather than a single-subject directional
    profile, and `PassMap` shows individual passes rather than directional
    aggregates
- Why it should be public:
  - directional binning, success encoding, legend semantics, default visual
    contract, and the shared-scale seam are all chart-level behaviour that
    consumers should not be reimplementing per app

## Domain framing

### Football concept

`PassSonar` models a directional pass profile for one subject.

The subject can be:

- one player
- one team
- one filtered phase of play (e.g. all open-play passes for a player in the
  first half)

It is not:

- a pitch-positioned 11-player sonar network
- a pitch-zone sonar grid
- a generic polar histogram primitive
- a free-form wagon-wheel composition API

### Bounded-context ownership

- `schema` / canonical data owns pass semantics and canonical coordinates.
- adapters own provider translation into canonical `PassEvent` packets.
- `@withqwerty/campos-react` owns:
  - directional binning
  - success encoding and radial geometry
  - legend, tooltip, summary, and empty-state copy
  - responsive and accessibility behaviour
  - the public headless helper `computePassSonar`

### Canonical input model

The first packet accepts canonical `PassEvent[]` with start and end coordinates
already resolved upstream. That means:

- no provider-angle logic in the component
- no raw-event parsing in the UI layer
- no hidden derivation of player identity from provider-specific fields

### Direction reference frame (load-bearing)

Direction is computed in **Campos canonical frame**:

```
angleRad = Math.atan2(endY - y, endX - x)   // range (-π, +π]
```

Where Campos canonical frame is, per
`docs/standards/coordinate-invariants.md`:

- `x: 0..100` — `0` = own goal, `100` = opposition goal (always
  attacker-relative)
- `y: 0..100` — `0` = attacker's right, `100` = attacker's left

This means the eight directional bins always carry these football-relative
labels, regardless of how the chart is drawn on screen:

| Bin index | Centre angle | Football label  | Compass-friendly alias |
| --------- | ------------ | --------------- | ---------------------- |
| 0         | `0`          | `forward`       | `up`                   |
| 1         | `+π/4`       | `forward-left`  | `up-left`              |
| 2         | `+π/2`       | `left`          | `left`                 |
| 3         | `+3π/4`      | `back-left`     | `down-left`            |
| 4         | `±π`         | `back`          | `down`                 |
| 5         | `−3π/4`      | `back-right`    | `down-right`           |
| 6         | `−π/2`       | `right`         | `right`                |
| 7         | `−π/4`       | `forward-right` | `up-right`             |

The chart always renders `forward` at the visual top of the wedge ring (12
o'clock position). This is the universal published-sonar convention
(mplsoccer, StatsBomb, Athletic, Twelve), and matches the way analysts read
directional pass profiles independently of the pitch's broadcast orientation.

### `attackingDirection` posture (v1)

`PassSonar` does **not** accept an `attackingDirection` prop in v1. The chart
is a non-pitch radial summary; rotating the wedges with broadcast direction
adds confusion (analysts expect `forward` at the top of a sonar) without
adding meaning. This posture is documented as a deliberate v1 choice; if a
future composition demand justifies it, an `attackingDirection?: "up" | "down"
| "left" | "right"` prop can land additively without breaking existing
consumers.

This is a documented divergence from the rest of the chart family — every
pitch-bound chart accepts `attackingDirection`. The divergence is recorded in
this spec and referenced from `docs/standards/component-target-notes.md` so
reviewers do not flag it as drift.

### Bin assignment convention

- Each bin is a half-open angular interval `[θ_lo, θ_hi)` on the unit circle.
- `Math.atan2` returns values in `(-π, +π]`. The `back` bin is the wrap-
  around bin and owns the union of `[+7π/8, +π]` and `(-π, -7π/8)`.
- The other seven bins are simple half-open intervals on `(-π, +π]`:
  `forward` `[-π/8, +π/8)`, `forward-left` `[+π/8, +3π/8)`, `left`
  `[+3π/8, +5π/8)`, `back-left` `[+5π/8, +7π/8)`, `back-right`
  `(-7π/8, -5π/8]` reframed as `[-7π/8, -5π/8)` after the wrap rule, etc.
- Implementation uses modular angular arithmetic, not the linear `assignBin()`
  helper from `compute/edges.ts`:
  ```ts
  const TAU = Math.PI * 2;
  const offset = Math.PI / 8; // forward bin straddles 0
  const wrapped = (((angleRad + offset) % TAU) + TAU) % TAU; // [0, 2π)
  const binIndex = Math.floor(wrapped / (Math.PI / 4)); // 0..7
  ```
- A pass with `angleRad === +π` resolves to `binIndex === 4` (`back`) under
  this rule. A pass with `angleRad === +π/8` resolves to `binIndex === 1`
  (`forward-left`), because `+π/8` is the lower-closed edge of bin 1.
- The half-open boundary _convention_ matches `PassFlow` / `Heatmap`; the
  _assignment function_ differs because angular bins are circular.

### Invariants

- one chart instance = one subject / one filtered cohort. The chart enforces
  this only when `subjectId` is provided (see API).
- v1 uses 8 equal directional bins of `π/4` (45°).
- the main radial encoding is **attempted-pass count**.
- completion is encoded by a **concentric inner wedge** drawn above the
  attempted wedge, with radius proportional to the completed-pass count.
- radial scaling is **area-proportional**: `R(n) = R_max * sqrt(n /
resolvedMax)`. This avoids exaggerating tall/short bins the way a linear
  scale does and matches mplsoccer's sonar convention.
- average pass length is tooltip detail only in v1, not a second main visual
  scale.
- pitch-zoned or formation-positioned sonars are out of scope for this packet.

## Public API

### Proposed public exports

```ts
// PassSonar component props
export type PassSonarProps = {
  passes: ReadonlyArray<PassEvent>;
  /** Display label for the chart (subject identity in summary copy). */
  subjectLabel?: string;
  /**
   * Optional discriminant to enforce the one-subject invariant. When provided,
   * any pass whose `playerId` (or `teamId`, depending on `subjectKind`) does
   * not match is dropped and counted in `model.meta.warnings`.
   * When omitted, the chart trusts the caller to pre-filter.
   */
  subjectId?: string;
  /** Which `PassEvent` field `subjectId` matches against. Defaults to "player". */
  subjectKind?: "player" | "team";
  /**
   * Explicit shared radial scale for side-by-side / SmallMultiples use.
   * Values < 1, non-finite, or NaN are treated as if unset (chart auto-scales)
   * and emit a one-shot `console.warn`. Non-integer values are rounded up via
   * `Math.ceil`.
   */
  scaleMaxAttempts?: number;
  /** Default true. */
  showLegend?: boolean;
  /** Default true. Center summary block (attempted / completed / completion %). */
  showSummary?: boolean;
  /**
   * Direction-label rendering mode. Default `"compass"` (labels follow
   * each wedge's bearing; only the eight canonical directions label when
   * `binCount > 8`). `"cartesian"` draws four static axis labels at the
   * sonar's top/bottom/left/right edges (Scout Lab idiom). `false` hides
   * all labels. Consumers that need labels off in tight cells
   * (SmallMultiples grids, table thumbnails) should pass `false`.
   *
   * v1 does not auto-gate by container width — the SVG viewBox is
   * constant so SSR-safe pixel measurement is not possible.
   */
  directionLabels?: "compass" | "cartesian" | false;
  /** Text override for `directionLabels: "cartesian"`. */
  directionLabelsText?: {
    forward?: string;
    back?: string;
    left?: string;
    right?: string;
  };
  /** Style families — match the rest of the chart family. */
  wedges?: PassSonarWedgesStyle;
  text?: PassSonarTextStyle;
  /** Methodology footnote, surfaced via the shared `ChartMethodologyNotes` slot. */
  methodologyNotes?: ChartMethodologyNotes;
};

// Style-value contexts
export type PassSonarWedgeStyleContext = {
  wedge: PassSonarWedgeModel;
  /** Convenience copy of wedge.binIndex (0..7). */
  binIndex: number;
  /** Convenience copy of wedge.label. */
  label: PassSonarBinLabel;
  theme: UITheme;
};

export type PassSonarTextStyleContext = {
  /** "direction-label" for ring labels, "summary" for the centre summary block. */
  slot: "direction-label" | "summary";
  theme: UITheme;
};

export type PassSonarWedgesStyle = {
  attemptedFill?: StyleValue<string, PassSonarWedgeStyleContext>;
  attemptedFillOpacity?: StyleValue<number, PassSonarWedgeStyleContext>;
  completedFill?: StyleValue<string, PassSonarWedgeStyleContext>;
  completedFillOpacity?: StyleValue<number, PassSonarWedgeStyleContext>;
  stroke?: StyleValue<string, PassSonarWedgeStyleContext>;
  strokeWidth?: StyleValue<number, PassSonarWedgeStyleContext>;
};

export type PassSonarTextStyle = {
  fill?: StyleValue<string, PassSonarTextStyleContext>;
  fontSize?: StyleValue<number, PassSonarTextStyleContext>;
};

// Headless helper
export type ComputePassSonarInput = {
  passes: ReadonlyArray<PassEvent>;
  subjectLabel?: string;
  subjectId?: string;
  subjectKind?: "player" | "team";
  scaleMaxAttempts?: number;
};

export type PassSonarBinLabel =
  | "forward"
  | "forward-left"
  | "left"
  | "back-left"
  | "back"
  | "back-right"
  | "right"
  | "forward-right";

export type PassSonarWedgeModel = {
  /** 0..7. */
  binIndex: number;
  /** Football-relative label. */
  label: PassSonarBinLabel;
  /** Half-open angular interval `[angleStart, angleEnd)` in radians, Campos frame. */
  angleStart: number;
  angleEnd: number;
  /** Centre angle of the bin in radians, for label placement. */
  centerAngle: number;
  /** Number of attempted passes (`complete | incomplete | offside | out`). */
  attempted: number;
  /** Number of `passResult: "complete"` passes. */
  completed: number;
  /** `completed / attempted`, in `[0, 1]`. `0` when `attempted === 0`. */
  completionRate: number;
  /** Mean Euclidean pass length in Campos units. `null` when `attempted === 0`. */
  averageLength: number | null;
  /** Normalised radius for the attempted wedge in `[0, 1]`. */
  attemptedRadius: number;
  /** Normalised radius for the completed wedge in `[0, 1]`. */
  completedRadius: number;
};

export type PassSonarSummaryModel = {
  attempted: number;
  completed: number;
  /** `completed / attempted`, in `[0, 1]`. `0` when `attempted === 0`. */
  completionRate: number;
};

export type PassSonarLegendModel = {
  rows: ReadonlyArray<{
    /** "attempted" | "completed". */
    kind: "attempted" | "completed";
    label: string;
    /** Theme-resolved fill colour. */
    color: string;
  }>;
};

export type PassSonarWarning =
  // Per-pass warnings: `count` is the number of passes that hit the condition.
  | { kind: "missing-coords"; count: number }
  | { kind: "missing-result"; count: number }
  | { kind: "subject-mismatch"; count: number; expected: string }
  // Per-render warnings derived from the prop, not from passes — no `count`.
  | { kind: "scale-max-invalid"; received: number }
  | { kind: "scale-max-clamped"; observedMax: number; resolvedMax: number };

export type PassSonarModel = {
  meta: {
    component: "PassSonar";
    empty: boolean;
    subjectLabel: string | null;
    /** What the consumer asked for. `null` when `scaleMaxAttempts` was not set. */
    requestedScaleMax: number | null;
    /** What the chart actually drew against. */
    resolvedScaleMax: number;
    /**
     * Human-readable warning strings consumed by `ChartFrame.warnings`.
     * Matches the `string[]` convention used by every other chart's
     * `meta.warnings` in this codebase (e.g. RadarChart).
     */
    warnings: ReadonlyArray<string>;
    /**
     * Structured warning records for headless inspection and tests. Emit
     * once per render, deduplicated by `kind`. Same content as `warnings`
     * but typed; callers grep this rather than the rendered string.
     */
    structuredWarnings: ReadonlyArray<PassSonarWarning>;
  };
  summary: PassSonarSummaryModel;
  wedges: ReadonlyArray<PassSonarWedgeModel>;
  legend: PassSonarLegendModel;
};

export function computePassSonar(input: ComputePassSonarInput): PassSonarModel;
```

`computePassSonar()` is a public headless helper. It exposes the full model so
downstream layouts (analyst grids, static reports) can render PassSonar's
geometry without going through React.

### Zero-config happy path

```tsx
import { PassSonar } from "@withqwerty/campos-react";

<PassSonar passes={playerPasses} subjectLabel="Martin Odegaard" />;
```

This must produce a publishable chart with no further props: 8 wedges, both
attempted and completed encodings visible, ring direction labels (auto-on at
common sizes), legend explaining the encoding, and a centre summary line with
`attempted / completed / completionRate%`.

### Comparison / shared-scale seam

```tsx
<PassSonar
  passes={odegaardPasses}
  subjectLabel="Martin Odegaard"
  scaleMaxAttempts={42}
/>
<PassSonar
  passes={riceePasses}
  subjectLabel="Declan Rice"
  scaleMaxAttempts={42}
/>
```

`scaleMaxAttempts` is the explicit comparability seam for side-by-side and
small-multiple use. It keeps cross-chart scaling honest without making the
base chart depend on a grid container.

For SmallMultiples, callers compute the shared max themselves (typically
`Math.max(...cells.map(c => maxBinAttempted(c.passes)))`) and pass the same
value to every cell. A future `computeSharedPassSonarScale(cellPasses)` helper
is deferred to v1.1 once two real grids prove the ergonomic gap (see
Open / Deferred section).

### SmallMultiples compatibility

- `PassSonar` is `SmallMultiples`-compatible via `scaleMaxAttempts` only.
- It does **not** consume pitch view hints (`SharedPitchScale`,
  `pitchOrientation`, `pitchCrop`) because it is not a pitch chart.
- The dense demo composes PassSonar inside `<SmallMultiples>` with consumer-
  computed `scaleMaxAttempts`.

### Filtering

Per `docs/standards/filtering-standard.md`:

- PassSonar exposes **no canonical filter dimensions** and **no chart-side view
  rules** in v1.
- `passes` is consumed as a pre-filtered single-subject cohort.
- Open-play vs set-piece, body-part, pass-type, period, and other slicing are
  all upstream concerns — the caller filters before passing data in.

### Explicit non-goals (v1)

- pitch-positioned multi-player sonars
- pitch-zone / bin-statistic sonars
- arbitrary 4 / 6 / 12-bin configurations
- value-mode proliferation such as `"count" | "avgLength" | "xT" | "completion"`
- hidden player aggregation or lineup reconstruction
- legend-driven interactive filtering (per `filtering-standard.md` ownership)
- `attackingDirection` rotation
- a generic public polar/wedge primitive — `PassSonar` ships its own internal
  renderer; primitive extraction follows the post-Lane-1 rule (extract once a
  second concrete consumer exists)

## Required normalised data

| Field        | Required    | Why it matters      | Behaviour if missing                                               |
| ------------ | ----------- | ------------------- | ------------------------------------------------------------------ |
| `x`          | yes         | pass origin         | pass excluded with `kind: "missing-coords"` warning                |
| `y`          | yes         | pass origin         | pass excluded with `kind: "missing-coords"` warning                |
| `endX`       | yes         | direction / length  | pass excluded with `kind: "missing-coords"` warning                |
| `endY`       | yes         | direction / length  | pass excluded with `kind: "missing-coords"` warning                |
| `passResult` | yes         | success encoding    | pass excluded with `kind: "missing-result"` warning when `null`    |
| `playerId`   | conditional | subject enforcement | required only when `subjectId` is set with `subjectKind: "player"` |
| `teamId`     | conditional | subject enforcement | required only when `subjectId` is set with `subjectKind: "team"`   |
| `playerName` | no          | summary fallback    | fall back to `subjectLabel`, then to `"this subject"`              |
| `length`     | no          | tooltip detail      | recomputed from coords if absent                                   |

`passResult` semantics (load-bearing):

| `passResult`   | Counts toward `attempted` | Counts toward `completed` |
| -------------- | ------------------------- | ------------------------- |
| `"complete"`   | yes                       | yes                       |
| `"incomplete"` | yes                       | no                        |
| `"offside"`    | yes                       | no                        |
| `"out"`        | yes                       | no                        |
| `null`         | no — pass excluded        | no                        |

This matches mplsoccer's sonar convention (any attempted pass counts as
attempted; success is only `complete`). Wyscout's `passResult` semantics need
continued scrutiny — see `docs/standards/adapter-gap-matrix.md` row.

Provider support:

- now: any provider that already normalises `PassEvent` with start/end coords
  and a non-null `passResult` (Opta, StatsBomb, WhoScored)
- partial: Wyscout — `passResult` taxonomy may need adapter-side normalisation
  before it reaches PassSonar; the chart drops `null` values rather than
  guessing.

Acceptable lossy mappings: extra pass qualifiers can be dropped as long as
direction and `passResult` remain correct.

## Default visual contract

### Layout

- one circular sonar inside the shared `ChartFrame`
- centre summary block (when `showSummary !== false`):
  `subjectLabel` (top) + `{completed} / {attempted}  ({completionRate}%)` (bottom)
- compact legend (when `showLegend !== false`) below the sonar, two rows:
  attempted swatch + completed swatch
- methodology notes via the shared `ChartMethodologyNotes` slot

### Encodings

- 8 wedges centred on the cardinal and inter-cardinal directions
  (`π/4` apart), `forward` at the top.
- **Attempted wedge**: outer sector spanning
  `[0, R_max * sqrt(attempted / resolvedMax)]`, filled with the
  `attemptedFill` colour at `attemptedFillOpacity`.
- **Completed wedge**: inner sector spanning
  `[0, R_max * sqrt(completed / resolvedMax)]`, drawn **above** the attempted
  wedge with the `completedFill` colour at `completedFillOpacity`. Identical
  geometry shape, smaller radius. (Concentric inner-wedge, not alpha overlay,
  not stripe.)
- Bins with `attempted === 0` render no path. Bins with `attempted > 0` always
  render the attempted wedge, even when `completed === 0`.

`R_max` is the available inner radius after the centre summary block and
direction-label gutter are reserved.

`resolvedMax` is:

- `Math.ceil(scaleMaxAttempts)` when valid (≥ 1, finite)
- otherwise `Math.max(...wedges.map(w => w.attempted))`, or `1` when all
  wedges are empty (avoids divide-by-zero; an empty chart degrades to the
  empty state instead).

### Labels and legend

- Direction labels (`directionLabels = "compass"` default): rendered on the
  outer ring at each bin's `centerAngle` when `binCount <= 8`; when
  `binCount > 8`, only the eight canonical directions are labelled.
  `directionLabels: "cartesian"` draws four static axis labels at the
  sonar's top/bottom/left/right edges (Scout Lab idiom); pass
  `directionLabels: false` to hide them in tight cells.
- Legend (`showLegend = true` default): two rows:
  - swatch + label `"Attempted passes"`
  - swatch + label `"Completed passes"`
- Tooltip (per-wedge, on hover and keyboard focus):
  - direction (bin label)
  - attempted count
  - completed count
  - completion rate (percentage, rounded to integer)
  - average distance — `"{n.n} m"` (Campos canonical units), omitted when
    `attempted === 0`

### Empty / fallback behaviour

| Case                                       | Behaviour                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| no valid passes (after coord/result drops) | render the shared `<EmptyState>` primitive with `"No passes for {subjectLabel ?? 'this subject'}"`; no axis ring, no wedges, no legend |
| one pass total                             | one wedge visible; legend, summary, and tooltip still render                                                                           |
| all wedges incomplete                      | attempted wedges visible; no inner completed wedge anywhere                                                                            |
| all wedges complete                        | inner completed wedge geometrically equals the attempted wedge in every bin (same radius)                                              |
| all passes in one direction                | one wedge carries the chart; legend still explains semantics; ring direction labels still render                                       |
| `scaleMaxAttempts < observedMax`           | wedges clamp to `R_max`; chart records `kind: "scale-max-clamped"` warning                                                             |
| `scaleMaxAttempts < 1` / non-finite / NaN  | treated as if unset; chart records `kind: "scale-max-invalid"` warning                                                                 |

### Warning channel

Warnings:

- are emitted once per render via `console.warn("[PassSonar] ...")` per warning
  kind (deduplicated with a count)
- are also surfaced on `model.meta.warnings: ReadonlyArray<PassSonarWarning>`
  for headless inspection and tests
- never block rendering of the chart's valid output

This matches the pattern used by `SmallMultiples` (`console.error("[SmallMultiples] ...")`) and the chart-warnings primitive. PassSonar uses `console.warn` because the conditions are recoverable (drops/clamps), not breakages.

### Accessibility

- Each wedge group is rendered as `<g role="img" tabindex="0" aria-label="{label}: {attempted} attempted, {completed} completed, {pct}% completion">`.
- Arrow keys cycle focus around the ring (left/right step by one bin; up/down
  jump 2 bins, matching the keyboard convention used by `ChartTooltip`).
- The summary block is rendered as semantic text inside the SVG so screen
  readers reach the headline numbers without needing focus on individual
  wedges.
- Direction labels are decorative (`aria-hidden="true"`) — the focusable
  wedges already announce the direction.
- Colour is never the only encoding: completed-vs-attempted is communicated
  by both colour and concentric radius.

## Internal primitives required

- `binPassesByDirection(passes, scaleMaxAttempts?, subjectFilter?)` — new,
  internal to `compute/pass-sonar.ts`. Reuses `circularMean`'s atan2 recipe
  but does not aggregate angles (we only need bin assignment).
- polar wedge renderer (sector path generator) — new, chart-local. Exported
  privately from `packages/react/src/PassSonar.tsx`. Do not extract a shared
  primitive in v1.
- shared `<ChartFrame>`, `<ChartLegend>`, `<ChartTooltip>`, `<EmptyState>`,
  `<ChartSvgEmptyState>` — existing.
- shared `StyleValue` resolver (`resolveStyleValue`) — existing.
- shared `ChartMethodologyNotes` slot — existing.

A reusable generic `<PolarWedgeLayer>` is **not** extracted before two concrete
consumers exist. PassSonar is the first; if a future `XGSonar` or similar
chart lands, that's the cue to revisit.

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / file                                                                  | Why relevant                              | What it covers                                              | What Campos should keep                                                                               | What Campos should change                                                                |
| ---------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/Volumes/WQ/ref_code/mplsoccer/examples/sonars/plot_sonar.py`               | strongest public football sonar reference | single-sonar directional profile, area-proportional radii   | fixed 8-bin, sqrt-area scaling, dual-encoding (attempted + completed)                                 | no matplotlib styling-API cargo-cult; Campos uses StyleValue families                    |
| `/Volumes/WQ/ref_code/mplsoccer/examples/sonars/plot_bin_statistic_sonar.py` | adjacent scope boundary                   | bin-statistic sonar and grid patterns                       | useful as a reminder of what a later zone-based packet could be                                       | keep zone sonars out of v1                                                               |
| `/Volumes/WQ/ref_code/football_viz/primitives.md`                            | local research summary                    | bin-count guidance, shared-scale guidance, responsive rules | 8 bins, explicit legend, shared-scale seam                                                            | avoid starting with formation-positioned multi-sonar layouts                             |
| `/Volumes/WQ/ref_code/football_viz/sonar/NOTES.md`                           | local football-viz notes                  | overlap risk, label concerns, scale caveats                 | collision and readability warnings                                                                    | not a v1 requirement because v1 is one subject per chart                                 |
| `packages/react/src/compute/pass-flow.ts`                                    | local prior art                           | direction classification in Campos canonical frame          | `atan2(endY-y, endX-x)` recipe and bin-edge convention                                                | PassSonar uses angular bins not pitch-zone bins; do not reuse the rectangular grid model |
| `packages/react/src/compute/circular.ts`                                     | local helper                              | atan2-based mean angle                                      | circularMean's vector recipe (used to compute average pass angle inside each bin if needed in future) | not used in v1 (we only bin, do not average angles)                                      |

## Edge-case matrix

For each item, behaviour and required test coverage:

- empty passes → render shared `<EmptyState>`, not a zeroed wheel; `meta.empty: true`
- one pass → exactly one wedge renders; legend + summary + tooltip still render
- all incomplete (`attempted > 0`, `completed === 0` everywhere) → attempted wedges visible, no inner completed wedge anywhere
- all complete → inner completed wedge equals attempted wedge in every populated bin
- all passes in one direction → one wedge carries chart; ring labels still render
- missing end coordinates → pass dropped with `kind: "missing-coords"` warning; rest of chart still renders
- missing `passResult` → pass dropped with `kind: "missing-result"` warning
- `scaleMaxAttempts === 0` / negative / `NaN` / `Infinity` → treated as unset; `kind: "scale-max-invalid"` warning
- `scaleMaxAttempts < observedMax` → wedges clamp to `R_max`; `kind: "scale-max-clamped"` warning
- `scaleMaxAttempts === 3.7` → rounded up to `4` via `Math.ceil`; no warning
- `subjectId` set, all passes match → no warning
- `subjectId` set, partial match → mismatched passes dropped, `kind: "subject-mismatch"` warning with expected id
- `subjectId` set, zero match → empty state rendered as if `passes` were empty
- pass at angle exactly `+π` → bins as `back` (normalised to `-π`)
- pass at angle exactly `+π/8` → bins as `forward-left` (right-open `[θ_lo, θ_hi)`; `+π/8` is the lower edge of bin 1)
- narrow width (chart inner radius < 56 px) → callers should pass `directionLabels={false}` in tight cells; wedges still render at full fidelity
- long `subjectLabel` (e.g. 40+ chars, multilingual, RTL) → summary line truncates with ellipsis at the chart-frame width; tooltip surfaces the full label
- dark theme → attempted/completed colours come from theme palette; legend, tooltip, summary all theme-aware
- keyboard focus → arrow keys cycle wedges; aria-labels read attempted/completed/percentage
- mobile/touch → tap on a wedge surfaces the tooltip; tooltip dismisses on outside tap (existing `ChartTooltip` behaviour)

## Pre-implementation prep

- prepare one real or curated pass fixture for a single player subject. Source
  preference (per CLAUDE.md): `/Volumes/WQ/projects/www/data/` or
  `/Volumes/WQ/ref_code/`. Record the source path in the fixture module.
- prepare one side-by-side comparison fixture (two players from the same
  match) that uses `scaleMaxAttempts`.
- prepare a sparse / one-direction subject (e.g. a centre-back's first-half
  passes) to exercise the sparse path.
- verify Opta / StatsBomb / WhoScored adapters can produce the required
  fixture shape; update `docs/standards/adapter-gap-matrix.md` with a
  PassSonar row matching `PassMap`'s coverage and noting Wyscout's
  `passResult` gap.
- decide whether the demo page leads with player or team variant — both ship
  on day one, but the "hero" demo is one player profile (matches the spec's
  default subject).

## Demo requirements

- required page path: `apps/site/src/pages/passsonar.astro` (single-token,
  matching `passmap.astro`, `passflow.astro`, `passnetwork.astro`)
- baseline scenario: one player directional pass profile (hero)
- fallback scenario: sparse single-direction subject (e.g. CB / GK first-half
  passes) showing the empty-state-adjacent path without crashing
- empty-state scenario: explicit demo card with `passes={[]}`
- stress / dense scenario: 4 side-by-side player sonars composed via
  `<SmallMultiples>` sharing a consumer-computed `scaleMaxAttempts`
- comparison scenario: two PassSonars for the same player in different match
  phases (first-half vs second-half) sharing a `scaleMaxAttempts`
- theme scenario: dark-theme card (matches `XGTimeline` / `RadarChart` /
  `PizzaChart` pattern; wrap chart + `ThemeProvider` in the same React island
  to avoid the Astro nested-island regression)
- methodology-notes scenario: card showing how `methodologyNotes` displays
- day-one guidance section: "When to use `PassSonar` vs `PassMap`,
  `PassFlow`, and `PassNetwork`" — short prose comparing the four pass charts
  on what they encode, what subject they aggregate, and when each is the
  honest choice.

## Test requirements

### compute tests (`packages/react/test/compute/compute-pass-sonar.test.ts`)

- direction binning: each bin label resolves to the documented angular
  interval; boundary tests for `+π/8`, `-π/8`, `+π`
- `passResult` semantics: per-row table from the spec maps to attempted /
  completed exactly
- `subjectId` enforcement (player + team): mismatched events dropped, warning
  recorded
- `scaleMaxAttempts` validation: invalid (`0`, `-5`, `NaN`, `Infinity`,
  `1.5`), clamp (`3` when observed max is `7`), valid
- empty inputs → `meta.empty: true`, summary zeros, no wedges
- `averageLength` recomputed when `length` is absent on the input
- `resolvedScaleMax` always ≥ 1, never `Infinity`, integer
- `model.legend.rows` has exactly two entries (`attempted`, `completed`)

### React tests (`packages/react/test/PassSonar.test.tsx`)

- zero-config render produces 8 wedge group elements + summary + legend
- empty state renders the shared `<EmptyState>` text
- wedges have correct `aria-label` text including direction + counts
- focusable wedges respond to arrow keys (jsdom-level focus assertions)
- tooltip rows render the documented columns; `average distance` row absent
  on zero-attempted wedges
- style-family callbacks fire with the documented context shape (constant +
  callback variants)
- dark theme renders without contrast regressions (snapshot-free assertion:
  resolved fills come from the theme palette)
- `methodologyNotes` slot renders when provided
- `scaleMaxAttempts` mismatch surfaces a clamp warning. Tests assert this by
  calling `computePassSonar(input)` directly and inspecting
  `model.meta.warnings`; the React layer never exposes a parallel observation
  surface (the headless helper is the contract).

### a11y checks

- subject + per-wedge counts reachable by keyboard (arrow-key cycle)
- contrast: attempted vs completed swatches meet WCAG AA against the chart
  surface in both light and dark themes
- direction labels are `aria-hidden`; wedges carry the semantic label

### Static export

- v1 ships **with** a static-export entry. PassSonar's API is constant-only
  except for the style-family callbacks; the export path uses constant fills
  resolved at build time. Static-export wiring lives in
  `packages/react/src/export/` and follows the existing 11-chart pattern.

## Review plan

- **Loop 1 — spec review (this packet):** verify v1 scope stays one-subject,
  resists mode sprawl, defines direction frame, and answers the
  `computeSharedPassSonarScale` question explicitly. Status: this spec.
- **Loop 2 — implementation review:** verify completion is encoded honestly
  (concentric inner wedge), bins use the documented half-open intervals,
  warnings are deduplicated and surface in `model.meta.warnings`, style
  families render correctly, and a11y focus cycles work.
- **Loop 3 — release-readiness review:** verify the demo page covers every
  required scenario, neighbouring-chart guidance prevents misuse as a pitch
  map / network, adapter-gap-matrix row is accurate, and the static-export
  contract is exercised by the export-types fixture.

## Open / Deferred questions

### Open (Loop-1 blocking — resolve before implementation closes)

_None remain after the 2026-04-20 spec iteration._

### Deferred to v1.1+ (non-blocking)

- **Zone-based or pitch-positioned sonars** — explicitly out of v1 scope.
  Decision when reopened: separate chart family rather than additive
  extension to `PassSonar`, because the input contract (per-bin pass cohorts)
  differs from one-subject input.
- **`computeSharedPassSonarScale(cellPasses)` helper** — deferred to v1.1.
  v1 ships with `scaleMaxAttempts` only and the demo's SmallMultiples
  composition computes the shared max in user space. Promote to v1.1 once two
  real grids prove the ergonomic gap (per
  `docs/standards/component-target-notes.md` two-consumer rule).
- **`attackingDirection` rotation** — deferred. v1 always renders `forward`
  at the top.
- **Resultant-vector arrow inside each wedge** (mplsoccer's optional
  add-on) — deferred. Adds another encoding without a clear single-subject
  reading benefit.
- **Polar / wedge primitive extraction** — deferred until a second concrete
  consumer exists.
