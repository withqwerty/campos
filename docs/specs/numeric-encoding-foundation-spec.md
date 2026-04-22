# Numeric Encoding Foundation Spec

**Status:** implemented, reviewed
**Last updated:** 2026-04-14

## Header

- Component / primitive: internal numeric encoding utilities in `@withqwerty/campos-react/src/compute/` backed by narrow D3 modules
- Status: implemented, reviewed
- Owner: Campos team
- Target version: v0.3+
- Depends on:
  - existing compute modules in `@withqwerty/campos-react/src/compute/`
  - existing `@withqwerty/campos-react` renderers consuming chart axis models
  - no React runtime changes

## Purpose

- **What user task this solves:** keep axes, scales, and numeric encodings consistent across charts so readers are not comparing subtly different tick/domain behaviors chart-by-chart.
- **Why it belongs in Campos:** scale math, tick generation, and numeric formatting are renderer-neutral compute concerns. They should live in the shared compute layer under `@withqwerty/campos-react`, not be reimplemented inside each chart module.
- **Why this is an internal foundation, not a public component:** users do not need another chart; they need existing charts to share one honest numeric-encoding model.
- **Why D3 is involved at all:** D3's scale/array/format modules are the strongest available primary-source implementations for this exact math. Campos should use them as internal utilities, not as a rendering or DOM model.

## Scope boundary

### In scope

1. Add **narrow D3 utility deps to `@withqwerty/campos-react` only**:
   - `d3-scale`
   - `d3-array`
   - `d3-format`
2. Create shared core helpers for:
   - continuous numeric scales
   - nice numeric domains + ticks
   - numeric tick formatting
3. Keep the current public root API stable:
   - `createLinearScale(domain, range)`
   - `niceTicks(min, max, count?)`
     These remain exported and become compatibility wrappers over the new foundation.
4. Migrate the first chart callers with the highest duplication:
   - `ScatterPlot`
   - `CometChart`
   - `XGTimeline`
   - `RadarChart` formatting only
5. Add regression tests around:
   - degenerate domains
   - inverted ranges
   - decimal ticks
   - negative/positive domains
   - sqrt scaling
   - tick-label precision stability
6. Record an explicit policy doc / note saying D3 is allowed in core as a math utility but not as a rendering architecture.

### Out of scope

- `d3-selection`, `d3-axis`, `d3-transition`, `d3-zoom`, `d3-brush`
- browser-DOM ownership by D3
- replacing React renderers with D3 renderers
- moving chart components away from semantic model output
- `d3-shape` path migration in this packet
- `d3-interpolate` / `d3-scale-chromatic` color-scale refactors in this packet
- `d3-force` / `d3-delaunay` geometry and simulation work in this packet
- public chart prop API changes
- adapter-layer changes

## Current duplication inventory

The current duplication is concentrated in the shared compute layer under `@withqwerty/campos-react`.

| Area                    | Current location(s)                                                                                                                                                                         | Problem                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| linear scales           | `packages/react/src/compute/scales/linear-scale.ts`, `packages/react/src/compute/scatter-plot.ts`, `packages/react/src/compute/comet-chart.ts`, `packages/react/src/compute/xg-timeline.ts` | same range/domain behavior is being implemented via bespoke helpers and local conventions |
| sqrt scales             | `packages/react/src/compute/scatter-plot.ts`                                                                                                                                                | local one-off helper, not reusable                                                        |
| nice domains + ticks    | `packages/react/src/compute/scales/nice-ticks.ts`, `packages/react/src/compute/scatter-plot.ts`, `packages/react/src/compute/comet-chart.ts`, `packages/react/src/compute/xg-timeline.ts`   | charts depend on similar but not guaranteed-identical tick/domain logic                   |
| numeric tick formatting | `packages/react/src/compute/scatter-plot.ts`, `packages/react/src/compute/comet-chart.ts`, `packages/react/src/compute/radar-chart.ts`                                                      | local formatting heuristics drift over time                                               |
| axis construction       | `packages/react/src/compute/scatter-plot.ts`, `packages/react/src/compute/comet-chart.ts`, `packages/react/src/compute/xg-timeline.ts`                                                      | every chart reassembles `domain + ticks + scale + inversion` in slightly different shapes |

## Architecture rule

Campos remains:

- schema/adapters first
- headless core compute
- React renderer
- deterministic SVG/static export

D3 is allowed only as a **headless internal dependency** in the shared compute layer under `@withqwerty/campos-react`.

### Explicit allow-list

- `d3-scale`
- `d3-array`
- `d3-format`

### Explicit deny-list for this architecture

- `d3-selection`
- `d3-axis`
- `d3-transition`
- `d3-zoom`
- `d3-brush`

Those modules would pull Campos toward imperative DOM ownership and away from the existing core-output-contract + React renderer boundary.

## Proposed file ownership

### Package wiring

- `packages/react/package.json`
  - add `d3-scale`, `d3-array`, `d3-format`

### New shared encoding helpers

- `packages/react/src/compute/scales/continuous-scale.ts`
  - shared creator for linear/sqrt continuous scales
- `packages/react/src/compute/scales/numeric-axis.ts`
  - derive nice domain, ticks, and scale from numeric extents
- `packages/react/src/compute/scales/format-number.ts`
  - shared numeric/tick label formatter(s)
- `packages/react/src/compute/scales/index.ts`
  - expose compatibility wrappers and any internal shared exports needed by chart modules

### Compatibility wrappers

- `packages/react/src/compute/scales/linear-scale.ts`
  - thin wrapper over `continuous-scale.ts`
- `packages/react/src/compute/scales/nice-ticks.ts`
  - thin wrapper over `numeric-axis.ts`

### First chart migrations

- `packages/react/src/compute/scatter-plot.ts`
  - remove local `createSqrtScale`
  - stop owning tick formatting
  - stop assembling numeric axes ad hoc
- `packages/react/src/compute/comet-chart.ts`
  - replace direct `createLinearScale` / `niceTicks` plumbing with shared numeric-axis helper
  - replace local tick formatting
- `packages/react/src/compute/xg-timeline.ts`
  - replace direct scale/tick setup with shared numeric-axis helper
- `packages/react/src/compute/radar-chart.ts`
  - replace local numeric formatting only; leave geometry/path math alone in this packet

### Tests

- `packages/react/test/compute/scales/continuous-scale.test.ts`
- `packages/react/test/compute/scales/numeric-axis.test.ts`
- `packages/react/test/compute/scales/format-number.test.ts`
- keep existing:
  - `packages/react/test/compute/scales/linear-scale.test.ts`
  - `packages/react/test/compute/scales/nice-ticks.test.ts`

### Docs

- `docs/specs/numeric-encoding-foundation-spec.md`
  - this packet
- `docs/architecture-decision.md` or `docs/standards/d3-usage.md`
  - short policy note once implementation lands

## Implementation contract

### 1. Shared continuous-scale helper

Add an internal helper roughly shaped like:

```ts
export type ContinuousScaleKind = "linear" | "sqrt";

export type CreateContinuousScaleInput = {
  kind: ContinuousScaleKind;
  domain: [number, number];
  range: [number, number];
  clamp?: boolean;
};

export function createContinuousScale(
  input: CreateContinuousScaleInput,
): (value: number) => number;
```

Rules:

- uses `d3-scale`
- supports `linear` and `sqrt` in this packet
- preserves Campos degenerate-domain behavior:
  - if `domain[0] === domain[1]`, return the midpoint of the range
- `sqrt` must clamp the effective domain floor to `0` exactly as the current local scatter implementation does

### 2. Shared numeric-axis helper

Add an internal helper roughly shaped like:

```ts
export type NumericAxisInput = {
  min: number;
  max: number;
  range: [number, number];
  tickCount?: number;
  kind?: "linear" | "sqrt";
  invert?: boolean;
};

export type NumericAxisModel = {
  domain: [number, number];
  ticks: number[];
  scale: (value: number) => number;
};

export function createNumericAxis(input: NumericAxisInput): NumericAxisModel;
```

Rules:

- `tickCount` defaults to current Campos behavior (`6` unless a caller already differs intentionally)
- `invert` flips the output range, not the domain ordering
- `min > max` is normalized, not rejected
- `min === max` expands to a sane display domain before nicening
- tick generation must be deterministic and stable under floating-point noise
- if D3's default nicening output differs from current shipped chart snapshots in a way that materially changes chart labels, prefer compatibility over purity in this packet

### 3. Shared number formatting helper

Add an internal helper roughly shaped like:

```ts
export function formatNumericTick(value: number): string;
```

Rules:

- preserve current human-readable behavior as closely as possible
- no trailing floating-point noise
- integers remain integers
- decimals use bounded precision, not arbitrary stringification
- callers should stop rolling their own `toPrecision` / `toFixed` heuristics where the new helper fits

### 4. Compatibility wrappers stay public

The existing public functions remain available:

```ts
export function createLinearScale(
  domain: [number, number],
  range: [number, number],
): (value: number) => number;

export function niceTicks(
  min: number,
  max: number,
  count?: number,
): { domain: [number, number]; ticks: number[] };
```

Rules:

- callers outside the packet keep compiling unchanged
- wrappers delegate to the new helpers
- any public-behavior change must be justified by tests, not as an incidental side effect of adopting D3

## Migration order

### Step 1 — add deps and shared helpers

- add D3 deps to `packages/react/package.json`
- implement `continuous-scale.ts`, `numeric-axis.ts`, `format-number.ts`
- rewrite `linear-scale.ts` and `nice-ticks.ts` as wrappers
- add tests for the new helpers before migrating charts

### Step 2 — migrate `ScatterPlot`

`ScatterPlot` is the highest-value first consumer because it duplicates:

- linear scale setup
- sqrt scale setup
- nice domains/ticks
- tick formatting

Exit criteria:

- remove local `createSqrtScale`
- remove local `formatTickValue`
- marker radii, axis ticks, and tooltip labels remain stable

### Step 3 — migrate `CometChart`

`CometChart` duplicates:

- linear axis construction
- nicening/ticks
- tick formatting

Exit criteria:

- chart output remains semantically identical
- `invertX` / `invertY` behavior is unchanged

### Step 4 — migrate `XGTimeline`

`XGTimeline` currently owns its own linear x/y scale + ticks. This packet should move that onto the shared axis helper while leaving step-path construction untouched.

Exit criteria:

- guide positions, marker positions, and end labels remain unchanged
- no path-generation work is bundled into this step

### Step 5 — migrate `RadarChart` formatting only

Do not pull radar geometry onto D3 in this packet. Only adopt the shared numeric formatter for spoke tick labels / range-mode values if it meaningfully reduces duplicate formatting logic.

Exit criteria:

- no radial geometry rewrite
- no curved-label rewrite

### Step 6 — land the policy note

Add a short architecture note documenting:

- D3 math utilities allowed in core
- D3 DOM modules out of bounds
- React remains the renderer

## Test requirements

### Shared scale tests

- degenerate domain maps to range midpoint
- reversed `min/max` normalizes correctly
- tiny decimal spans remain stable
- negative-to-positive domains tick sensibly
- inverted ranges still map correctly
- sqrt scale clamps safely at zero
- tick arrays do not contain floating-point garbage

### Chart regression tests

- `computeScatterPlot` snapshots / assertions stay stable
- `computeCometChart` axis/tick expectations stay stable
- `computeXGTimeline` axis/tick expectations stay stable
- `computeRadarChart` formatted tick labels remain stable if migrated

### Package verification

- `pnpm check`
- `pnpm build`
- visual/demo sanity on:
  - `apps/site/src/pages/scatterplot.astro`
  - `apps/site/src/pages/xgtimeline.astro`
  - any CometChart demo surface if present

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Source           | Why relevant                                          | What it covers                                | What Campos should keep                                            | What Campos should change                                                                   |
| ---------------- | ----------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `d3-soccer`      | only D3-oriented football reference currently indexed | D3-driven football charts in the browser      | SVG-first thinking and the idea that scales/geometry can be shared | do not adopt D3 DOM ownership or plugin-style imperative rendering as the Campos basis      |
| `d3-scale` docs  | primary-source scale API                              | linear/sqrt/time/band/point/sequential scales | battle-tested scale math                                           | use only in core as implementation detail, not as public renderer contract                  |
| `d3-array` docs  | primary-source numeric-domain and tick utilities      | extents, ticks, numeric helpers               | stable numeric helper behavior                                     | keep Campos-specific degenerate-domain and compatibility behavior where current charts rely |
| `d3-format` docs | primary-source number formatting                      | deterministic numeric formatting              | formatter ergonomics                                               | wrap behind Campos formatting helpers rather than leaking D3 formatting strings everywhere  |

Official references:

- https://d3js.org/d3-scale
- https://d3js.org/d3-array
- https://d3js.org/d3-format

## Edge cases

| Case                               | Expected behavior                                  | Test shape                                     |
| ---------------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| degenerate domain                  | midpoint scale output; widened nice domain         | shared scale tests                             |
| reversed min/max                   | normalized silently                                | shared scale tests                             |
| very small decimal range           | deterministic ticks without float noise            | shared axis tests                              |
| negative-to-positive domain        | zero-crossing behaves sensibly                     | shared axis tests                              |
| inverted range                     | same domain, reversed output mapping               | shared scale + chart regression tests          |
| sqrt scale with zero/negative min  | clamps safely; no `NaN`                            | shared scale tests + scatter regression        |
| current wrapper callers unchanged  | existing imports keep working                      | typecheck + package tests                      |
| chart output drift after migration | only intentional differences allowed               | targeted compute tests + demo sanity           |
| D3 dependency creep                | DOM/interaction modules do not enter core or react | review checklist item, package diff inspection |

## Review plan

- **Loop 1 — spec adversarial review**
  - challenge whether this packet is truly internal-only and whether D3 scope is narrow enough
- **Loop 2 — implementation adversarial review**
  - challenge behavioral drift in ticks/domains/labels and any accidental public API widening
- **Loop 3 — release-readiness review**
  - challenge whether the helper layer actually removed duplication and whether the D3 policy is documented clearly enough to prevent architectural creep

## Review log

### Loop 2 — implementation adversarial review

- Date: 2026-04-14
- Inputs reviewed:
  - `packages/react/src/compute/scales/continuous-scale.ts`
  - `packages/react/src/compute/scales/numeric-axis.ts`
  - `packages/react/src/compute/scales/format-number.ts`
  - `packages/react/src/compute/scales/linear-scale.ts`
  - `packages/react/src/compute/scales/nice-ticks.ts`
  - `packages/react/src/compute/scatter-plot.ts`
  - `packages/react/src/compute/comet-chart.ts`
  - `packages/react/src/compute/xg-timeline.ts`
  - `packages/react/src/compute/radar-chart.ts`
  - targeted scale/chart regression suites
- Method:
  - tick/domain drift challenge
  - wrapper compatibility challenge
  - D3 dependency boundary challenge
  - chart caller regression challenge
- Findings:
  - no blocking implementation regressions found
  - targeted suites covering shared scales plus `ScatterPlot`, `CometChart`, and `XGTimeline` passed after migration
  - D3 remained scoped to `d3-scale`, `d3-array`, and `d3-format` inside `@withqwerty/campos-react`
- Outcome:
  - implementation review passed

### Loop 3 — release-readiness review

- Date: 2026-04-14
- Inputs reviewed:
  - `docs/specs/numeric-encoding-foundation-spec.md`
  - `docs/architecture-decision.md`
  - `docs/status/matrix.md`
  - `packages/react/package.json`
- Method:
  - docs-to-code drift challenge
  - dependency creep challenge
  - packet-completeness challenge
- Findings:
  - the packet spec still claimed “ready for implementation” after the helpers and migrations had already shipped. Fixed in this close-out.
  - no evidence of D3 DOM/runtime creep beyond the approved math/format modules
- Outcome:
  - release-readiness review passed

## Acceptance criteria

- `@withqwerty/campos-react` depends on `d3-scale`, `d3-array`, `d3-format` only
- shared continuous-scale / numeric-axis / format-number helpers exist
- `createLinearScale` and `niceTicks` remain public compatibility wrappers
- `ScatterPlot`, `CometChart`, and `XGTimeline` are migrated to the new helpers
- `RadarChart` formatting is either migrated or explicitly deferred in the implementation notes
- no React renderer files need D3 imports
- `pnpm check` and `pnpm build` pass

## Open questions

1. Should the new helpers remain internal-only forever, or be exported from `@withqwerty/campos-react` once stable?
2. Should `RadarChart` range-mode formatting move in this packet, or be deferred if it creates noisy snapshot churn?
3. Should `d3-array` be used immediately for `extent` in migrated charts, or only for future domain cleanup once the scale packet is stable?
4. After this packet, is the next highest-value follow-up `d3-shape` (path generators) or color interpolation cleanup?
