# Codebase Audit Scratchpad

<!-- internal working note -->

Audit date: 2026-04-14
Scope: live sweep of pitch and non-pitch React components, plus the Stadia seams they lean on.

This replaces the older 2026-04-13 dump. That version had drifted: several previously-flagged duplications had already been extracted, so keeping them in the scratchpad was just lying to ourselves.

## Close-out

Resolved in code on 2026-04-14:

- `PitchChartFrame` now exists and is used by `Heatmap`, `Territory`, `KDE`, `ShotMap`, `PassMap`, and `PassNetwork`.
- `BumpChart`, `XGTimeline`, and `PassNetwork` now share extracted scene paths between static and interactive renderers.
- `Formation.tsx` is no longer a subsystem monolith; it now dispatches into package-private modules.
- `projectPitchRect()` and shared `ShotMap` marker glyph rendering landed in the touched pitch family.

Still live:

- `KDE` still owns browser-local rasterization and reverse-projection logic.
- Pitch-family legend/annotation composition still varies more than it should.
- Tooltip row pass-through is still duplicated in some charts outside the touched packet.

## Lens

Directional DHH rules for this sweep:

- Prefer one obvious path over two half-abstractions.
- Shared seams should represent a real concept, not just save 20 lines.
- If static and interactive output are the same chart, they should usually share the same render tree.
- Big files need to earn their size by holding one idea. If a file is acting as dispatcher, layout engine, renderer, export path, and utility bag, split it.
- Component-library realities matter, but "it's a library" is not a license to accumulate alternate architectures forever.

## High-confidence findings

### P0 — There are three renderer architectures in `@withqwerty/campos-react`, not one library

Evidence:

- `ChartFrame` already gives the card-chart family a clear shell: [packages/react/src/primitives/ChartFrame.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/primitives/ChartFrame.tsx#L36).
- Pitch charts hand-roll near-identical `<section>` shells instead: [ShotMap](https://github.com/withqwerty/campos/blob/main/packages/react/src/ShotMap.tsx#L446), [Heatmap](https://github.com/withqwerty/campos/blob/main/packages/react/src/Heatmap.tsx#L348), [KDE](https://github.com/withqwerty/campos/blob/main/packages/react/src/KDE.tsx#L208), [Territory](https://github.com/withqwerty/campos/blob/main/packages/react/src/Territory.tsx#L287), [PassMap](https://github.com/withqwerty/campos/blob/main/packages/react/src/PassMap.tsx#L366), [PassNetwork](https://github.com/withqwerty/campos/blob/main/packages/react/src/PassNetwork.tsx#L851).
- Formation is a third bespoke composition system again: [packages/react/src/Formation.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/Formation.tsx#L703).
- The repo already knows this divergence exists: [docs/status/react-renderer-audit.md](https://github.com/withqwerty/campos/blob/main/docs/status/react-renderer-audit.md#L16).

Why it smells:

- The codebase now has different answers to "how do we lay out a chart surface?" depending on which family you happen to touch.
- That creates drift in spacing, legend placement, empty-state placement, and future export behavior.
- This is not healthy polymorphism. It is architectural indecision.

Direction:

- Keep `ChartFrame` for card charts.
- Introduce a package-private `PitchChartFrame` for pitch overlays.
- Either pull Formation onto a narrow `CompositionFrame` seam or explicitly document it as permanently bespoke. Do not leave it in the mushy middle.

### P0 — Static SVG and interactive renderers still duplicate too much code

Good example:

- `ScatterPlot` has a shared `ScatterPlotSvg` render path reused by both static and interactive variants: [packages/react/src/ScatterPlot.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/ScatterPlot.tsx#L321).

Counterexamples:

- `BumpChartStaticSvg` and `BumpChart` duplicate the same scene structure with slightly different branches: [packages/react/src/BumpChart.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/BumpChart.tsx#L397), [packages/react/src/BumpChart.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/BumpChart.tsx#L486).
- `XGTimelineStaticSvg` and `XGTimeline` do the same: [packages/react/src/XGTimeline.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/XGTimeline.tsx#L456), [packages/react/src/XGTimeline.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/XGTimeline.tsx#L508).
- Same story in `RadarChart`, `PizzaChart`, `PassNetwork`, `PassMap`, `ShotMap`, and `Formation`: [RadarChart](https://github.com/withqwerty/campos/blob/main/packages/react/src/RadarChart.tsx#L385), [PizzaChart](https://github.com/withqwerty/campos/blob/main/packages/react/src/PizzaChart.tsx#L471), [PassNetwork](https://github.com/withqwerty/campos/blob/main/packages/react/src/PassNetwork.tsx#L350), [PassMap](https://github.com/withqwerty/campos/blob/main/packages/react/src/PassMap.tsx#L114), [ShotMap](https://github.com/withqwerty/campos/blob/main/packages/react/src/ShotMap.tsx#L169), [Formation](https://github.com/withqwerty/campos/blob/main/packages/react/src/Formation.tsx#L391).

Why it smells:

- Two render trees for one chart guarantees slow drift.
- Static/export work becomes expensive because every tweak has a twin.
- This is exactly the kind of duplication that looks "harmless" until accessibility, export, and bugfix work all start landing unevenly.

Direction:

- Default pattern should be `render scene once, gate interactivity with props`.
- Use `ScatterPlotSvg` as the model.
- If a chart truly needs separate HTML overlays in interactive mode, keep that as a thin wrapper around one shared SVG scene.

### P0 — `Formation.tsx` is a monolith with too many jobs

Evidence:

- File size: 1389 lines: `packages/react/src/Formation.tsx`.
- It currently holds public dispatch, static rendering, single-team rendering, dual-team rendering, legend composition, bench composition, marker rendering, slot normalization, slot measurement protocol glue, warnings, and ARIA helpers: [dispatch/static](https://github.com/withqwerty/campos/blob/main/packages/react/src/Formation.tsx#L379), [single](https://github.com/withqwerty/campos/blob/main/packages/react/src/Formation.tsx#L554), [dual](https://github.com/withqwerty/campos/blob/main/packages/react/src/Formation.tsx#L703), [legend](https://github.com/withqwerty/campos/blob/main/packages/react/src/Formation.tsx#L918), [marker](https://github.com/withqwerty/campos/blob/main/packages/react/src/Formation.tsx#L1044), [measurement helpers](https://github.com/withqwerty/campos/blob/main/packages/react/src/Formation.tsx#L1275).

Why it smells:

- The file is no longer "the Formation component". It is the entire Formation subsystem.
- That makes safe change hard because every edit drags unrelated responsibilities into the review.
- The numbered internal explanations are useful, but they are also a sign the file has exceeded a sane cognitive unit.

Direction:

- Split into package-private modules: `FormationSingle`, `FormationDual`, `FormationStaticSvg`, `FormationMarker`, `formationLegend`, `slotMeasurement`.
- Keep the public API surface in one thin file.

## Pitch family

### P1 — Pitch overlays need a shared frame and overlay seam

Evidence:

- `Heatmap`, `KDE`, and `Territory` all hand-roll the same section wrapper pattern and plot overlay structure: [Heatmap](https://github.com/withqwerty/campos/blob/main/packages/react/src/Heatmap.tsx#L348), [KDE](https://github.com/withqwerty/campos/blob/main/packages/react/src/KDE.tsx#L208), [Territory](https://github.com/withqwerty/campos/blob/main/packages/react/src/Territory.tsx#L287).
- `ShotMap`, `PassMap`, and `PassNetwork` repeat a second pattern with `model.layout.order` plus local `regions` maps: [ShotMap](https://github.com/withqwerty/campos/blob/main/packages/react/src/ShotMap.tsx#L250), [PassMap](https://github.com/withqwerty/campos/blob/main/packages/react/src/PassMap.tsx#L216), [PassNetwork](https://github.com/withqwerty/campos/blob/main/packages/react/src/PassNetwork.tsx#L684).

Why it smells:

- Pitch charts are clearly a family, but the renderer code still behaves like six one-offs.
- The family already shares `Pitch`, `EmptyState`, `ChartTooltip`, `ChartScaleBar`, and pitch-contrast logic. The missing shell is now the obvious seam.

Direction:

- Add a `PitchChartFrame` that owns max-width, padding, optional header/legend/scale-bar slots, and empty-state overlay placement.
- Let each chart own only the underlay/marks and chart-specific legend grammar.

### P1 — `Heatmap` and `Territory` duplicate the same projected-cell geometry seam

Evidence:

- `Heatmap.projectRect`: [packages/react/src/Heatmap.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/Heatmap.tsx#L108)
- `Territory.projectRect`, with an explicit comment that it "mirrors" Heatmap: [packages/react/src/Territory.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/Territory.tsx#L84)

Why it smells:

- The code already admits it is duplicated.
- `Territory` is a thin wrapper on the same underlying heatmap geometry anyway: [packages/react/src/Territory.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/Territory.tsx#L227).

Direction:

- Extract `projectPitchRect()` into a small pitch-surface utility.
- Consider a package-private `PitchGridSurface` if more rectangular-cell charts are coming.

### P1 — `PassNetwork` duplicates its expensive scene prep between static and interactive paths

Evidence:

- Static path rebuilds `radiusById`, `projectedById`, `pairOffsets`, and directed-edge marker defs: [packages/react/src/PassNetwork.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/PassNetwork.tsx#L391).
- Interactive path does the same work again inside a second render branch: [packages/react/src/PassNetwork.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/PassNetwork.tsx#L716).

Why it smells:

- This is not just duplicated JSX. It is duplicated scene preparation.
- If directed-edge behavior changes, one path will get missed.

Direction:

- Build one shared SVG scene helper for nodes/edges/defs.
- Keep hover/focus behavior outside that helper.

### P1 — `KDE` is still a snowflake renderer

Evidence:

- It rasterizes in the component with `document.createElement("canvas")`: [packages/react/src/KDE.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/KDE.tsx#L48).
- It owns bespoke reverse-projection and density lookup math inside an event handler: [packages/react/src/KDE.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/KDE.tsx#L247).
- It also hand-rolls the same shell as `Heatmap`: [packages/react/src/KDE.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/KDE.tsx#L208).

Why it smells:

- It cannot participate cleanly in the same static/export story as the other pitch charts.
- Too much of the chart's real behavior lives in renderer-only browser code.

Direction:

- Move rasterization and inverse-projection helpers out of the component body.
- Decide whether KDE is intentionally browser-only, or whether it should converge on the same shared scene/export path as the other pitch overlays.

### P2 — `ShotMap` still duplicates shape drawing between plot marks and legend swatches

Evidence:

- `renderMarker`: [packages/react/src/ShotMap.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/ShotMap.tsx#L40)
- `LegendShapeSwatch`: [packages/react/src/ShotMap.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/ShotMap.tsx#L107)

Why it smells:

- This is not the highest-value cleanup, but it is classic "same idea, slightly different math" drift bait.

Direction:

- Extract a tiny shared `shapePath` or `renderShapeGlyph` helper.

## Non-pitch family

### P1 — `build*Model` helpers are only half-real abstractions

Evidence:

- `ShotMap`, `Heatmap`, `PassMap`, `RadarChart`, `PizzaChart`, `BumpChart`, and `XGTimeline` all define a `buildFooModel` helper, then still reconstruct the same option object again in `useMemo`: [ShotMap](https://github.com/withqwerty/campos/blob/main/packages/react/src/ShotMap.tsx#L153), [Heatmap](https://github.com/withqwerty/campos/blob/main/packages/react/src/Heatmap.tsx#L207), [PassMap](https://github.com/withqwerty/campos/blob/main/packages/react/src/PassMap.tsx#L105), [RadarChart](https://github.com/withqwerty/campos/blob/main/packages/react/src/RadarChart.tsx#L353), [PizzaChart](https://github.com/withqwerty/campos/blob/main/packages/react/src/PizzaChart.tsx#L441), [BumpChart](https://github.com/withqwerty/campos/blob/main/packages/react/src/BumpChart.tsx#L397), [XGTimeline](https://github.com/withqwerty/campos/blob/main/packages/react/src/XGTimeline.tsx#L456).

Why it smells:

- The helper is supposed to be the single render-model seam.
- Instead, the object-shaping logic now exists twice.

Direction:

- Either call `buildFooModel(props)` everywhere and keep the seam real, or delete the helper and inline the compute call honestly.
- Do not keep "abstraction for exports only" as the default pattern.

### P1 — Tooltip row identity mapping is everywhere

Evidence:

- `ShotMap`: [packages/react/src/ShotMap.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/ShotMap.tsx#L390)
- `PassMap`: [packages/react/src/PassMap.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/PassMap.tsx#L311)
- `PassNetwork`: [packages/react/src/PassNetwork.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/PassNetwork.tsx#L678)
- `ScatterPlot`: [packages/react/src/ScatterPlot.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/ScatterPlot.tsx#L597)

Why it smells:

- The rows are already `{ label, value }`.
- Re-wrapping them over and over is friction, not abstraction.

Direction:

- Share the tooltip-row shape between core and renderer, or make `ChartTooltip` accept the core row type directly.

### P2 — `BumpChart` and `XGTimeline` still show "this render function needs help" symptoms

Evidence:

- Both rely on numbered section comments to make the render order legible: [BumpChart](https://github.com/withqwerty/campos/blob/main/packages/react/src/BumpChart.tsx#L577), [XGTimeline](https://github.com/withqwerty/campos/blob/main/packages/react/src/XGTimeline.tsx#L582).

Why it smells:

- Numbered comments are not the problem.
- They are the smoke coming off a function that wants one more extraction pass.

Direction:

- Not urgent, but once the shared static/interactive scene path is cleaned up, these functions should shrink naturally.

## What looks healthy

- `ScatterPlotSvg` is the cleanest current model for shared static + interactive SVG rendering: [packages/react/src/ScatterPlot.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/ScatterPlot.tsx#L321).
- `ChartFrame` is the right kind of abstraction: it represents a real chart-shell concept and stays small: [packages/react/src/primitives/ChartFrame.tsx](https://github.com/withqwerty/campos/blob/main/packages/react/src/primitives/ChartFrame.tsx#L36).
- The repo has already improved since the older scratchpad; this audit should not reopen already-fixed seams just to feel busy.

## Cleanup order

1. Introduce `PitchChartFrame` and stop hand-rolling pitch chart shells.
2. Normalize the static-vs-interactive pattern chart by chart, starting with `PassNetwork`, `BumpChart`, and `XGTimeline`.
3. Split `Formation.tsx` into package-private modules.
4. Kill half-abstractions in the `buildFooModel` pattern.
5. Extract the small geometry seam (`projectPitchRect`) and the shared tooltip-row type.

## Execution source

The actionable packet work now lives in [docs/plans/react-renderer-convergence-plan.md](https://github.com/withqwerty/campos/blob/main/docs/plans/react-renderer-convergence-plan.md).

This scratchpad stays focused on:

- findings
- prioritization
- cleanup order

The plan doc now owns:

- pickup packets
- blocking dependencies
- concurrency rules
- adversarial-review fixes

## Current handoff note

Because foundation extraction is already underway elsewhere, the convergence plan is now intentionally dependency-aware rather than pretending everything can start at once.

Directionally:

1. let the active point, line, heatmap, and density-surface extractions settle
2. land the `PitchChartFrame` scaffold
3. adopt the shell chart-family by chart-family
4. land shared-scene convergence in narrow packets
5. split `Formation`
6. do small seam cleanups last

That is stricter than the earlier draft, and better. The earlier version was still too willing to treat “cleanup” as a license for overlapping rewrites.
