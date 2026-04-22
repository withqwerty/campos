# React Renderer Conventions

**Status:** active
**Scope:** shared behavior and primitive boundaries for `@withqwerty/campos-react` chart components
**Purpose:** keep chart components coherent as one library by defining which concerns must be shared, which divergences are acceptable, and how static/export-safe output should behave

> **React-first note:** Campos is now a React-first library. React is the renderer — there is no multi-renderer abstraction. All styling and visual decision logic lives in `@withqwerty/campos-react` via callback-first style props. Core provides math and coordinate transforms only.

Use this document when extracting shared renderer seams, reviewing chart consistency, or deciding whether a chart-specific block should stay local.

## Core Rule

Share renderer code only when it represents a stable chart concept that should behave the same way across the library.

Good shared seams:

- plot-area background and chart chrome
- Cartesian axes and grid/guide systems
- legend families
- empty-state rendering
- static SVG accessibility and export-safe behavior

Bad shared seams:

- chart-specific geometry
- sport-specific annotations that do not recur elsewhere
- abstractions that only save a few lines but hide different semantics

## Current Shared Primitive Families

These primitives define the current renderer seam map:

- Chart shells: `ChartFrame`, `PitchChartFrame`
- Cartesian chrome: `ChartCartesianAxes`, `ChartGuideLines`, `ChartPlotAreaBackground`, `ChartSvgEmptyState`
- Pitch-overlay geometry: `ChartPointMark`, `ChartLineMark`, `ChartHeatmapCellLayer`, `ChartDensitySurfaceImage`
- Legend family: `ChartLegend`, `ChartGradientLegend`, `ChartSizeLegend`, `ChartScaleBar`
- Tooltip family: `ChartTooltip`

If a new chart needs one of these behaviors, prefer using the shared primitive before adding a local implementation.

## Frame Rule

- Use `ChartFrame` for card-style charts whose layout is primarily chart chrome, notes, legends, and Cartesian or radial SVG content.
- Use `PitchChartFrame` for pitch overlays whose main concern is a pitch plot plus optional header/legend/scale-bar regions.
- Keep both shells shell-only. They should not absorb chart-specific legend grammar, tooltip state, pitch projection, or mark rendering.
- If a chart cannot fit either shell honestly, document the divergence in `docs/status/react-renderer-audit.md` instead of bending one shell until it stops meaning anything.

## Chart Anatomy Convention

Public charts should expose a stable, documented anatomy even when their
internal renderer implementation changes.

At minimum, chart docs and renderers should agree on these conceptual regions
where they exist:

- `root`
- `frame`
- `plot`
- `legend`
- `scale-bar`
- `empty-state`
- `tooltip`
- `overlay`

The public goal is not to expose compound components. The goal is to keep the
DOM/SVG structure predictable enough for styling, tests, docs, and export
inspection.

### Styling and test hooks

When a region is stable and meaningful, prefer explicit hooks such as:

- `data-chart-kind`
- `data-empty`
- `data-static`
- `data-slot="<region>"`
- existing `data-campos="<region-family>"` hooks where they already map to a
  stable renderer seam

Do not add hooks for every internal wrapper. Only expose hooks for regions that
library consumers, docs, or tests can rely on honestly.

## Primitive Ownership Rule

- Geometry primitives should take projected coordinates and style, then render only that geometry.
- Geometry primitives should not own chart selection state, tooltip state, active-id bookkeeping, or semantic chart copy unless multiple charts genuinely need the exact same behavior contract.
- Interactive charts should usually keep `role`, `tabIndex`, ARIA labels, and event handlers at the chart layer, wrapping shared geometry primitives in chart-owned groups.
- Move behavior into a shared primitive only when the behavior itself is a stable library concept, not just repeated glue code.

## Public State Exposure Rule

- Keep ephemeral hover/focus bookkeeping local unless external control has real
  product value.
- Hover state, tooltip state, active marker ids, and similar cursor-following
  affordances should stay internal by default. Do not expose `hovered*` or
  `focused*` props just because the renderer happens to track them.
- When a chart does expose public interactive state, use one consistent
  controlled/uncontrolled contract keyed to the real state concept:
  `selectedSeries`, `defaultSelectedSeries`, `onSelectedSeriesChange`; not
  chart-local one-off naming.
- Public change handlers should carry both the next value and a narrow details
  object. The details object should include a `reason` field and any stable
  chart-specific identifiers that explain why the state changed.
- Expose public state only for product-level concepts such as selection,
  synchronized focus, open detail panels, or filter state. Do not promote
  renderer bookkeeping into API surface.
- Stateful renderer regions should expose stable state hooks when helpful,
  typically via `data-state`, `data-active`, or another narrowly scoped
  attribute that reflects a real public state concept.
- Do not add public state APIs just because an internal renderer happens to
  track that state.

## Extraction Threshold

Before extracting a new renderer seam, confirm all three:

1. The seam represents a stable chart concept rather than one chart's local grammar.
2. At least two charts either already need it or are credibly about to need it.
3. The extraction removes real drift or review risk, not just repeated lines.

If any of those are false, keep the code local and document the divergence.

## Static SVG Contract

Any chart that exposes a dedicated static SVG path should follow the same baseline contract:

1. The root `<svg>` uses `role="img"`.
2. The root `<svg>` exposes the core model `accessibleLabel` via `aria-label`.
3. Empty states render inside the SVG, not via hover-only or HTML-only affordances.
4. Static output reuses the same chart chrome primitives as the interactive renderer where practical.
5. Static-only fallbacks are allowed when the interactive renderer depends on HTML or image assets, but those fallbacks must remain semantically equivalent.

### Callback-style props and export compatibility

`StyleValue` callback props work for both interactive rendering and in-process SSR export because they are executed as pure TypeScript at render time. Two constraints apply:

- **Callbacks must be pure.** They must not read browser globals (`window`, `document`, DOM measurements) or live component state. A callback that touches browser-only APIs will throw in a Node.js export environment.
- **Callbacks cannot be used in `ExportFrameSpec`.** The static export spec (`createExportFrameSpec`) is designed to be serializable — functions cannot pass through it. Campos is hardening this through dedicated export-only prop types plus runtime guards, not by weakening the main interactive chart prop surface.

## Empty-State Convention

- Empty chart copy comes from the core model when available.
- Empty-state text should use the shared SVG or frame-level empty-state primitive, not inline ad hoc text styling.
- Empty-state behavior should match between interactive and static render paths.

## Legend Convention

- Hide legends only when the chart still remains understandable without them.
- If chart-local labels are removed, add a legend fallback rather than silently dropping identification.
- Continuous, categorical, and size legends should use the shared legend family unless the chart has a materially different visual grammar.

## Preset And Variant Convention

- Prefer presets, helper factories, and recipe docs before adding more boolean
  or mode props to a public chart.
- A chart prop should represent a stable chart concept.
- An editorial workflow variant should usually ship as a named preset or helper
  unless it changes the chart’s core semantic contract.
- Shared primitives should not absorb benchmark-specific styling just because a
  preset needs it.

## Cartesian Family Convention

The Cartesian family currently includes:

- `ScatterPlot`
- `CometChart`
- `XGTimeline`
- `BumpChart`

These charts should converge on:

- shared plot-area background
- shared Cartesian axes
- shared guide/grid treatment where the semantics match
- shared SVG empty-state behavior
- shared static SVG accessibility contract

Accepted divergences:

- `XGTimeline` time guides and score-story affordances remain chart-specific
- `BumpChart` rank-grid treatment remains chart-specific
- annotation/reference layers may stay local until a real shared pattern exists

## Pitch Overlay Convention

The pitch-overlay family currently includes:

- `ShotMap`
- `PassMap`
- `Heatmap`
- `Territory`
- `KDE`
- `PassNetwork`

These charts should converge on:

- shared `PitchChartFrame` shell behavior
- shared pitch foundation from `@withqwerty/campos-stadia`
- chart-owned interaction policy wrapped around shared geometry primitives
- shared empty-state and tooltip primitives where the semantics match

Accepted divergences:

- `Territory` remains intentionally label-first and tooltip-free
- `KDE` keeps renderer-local rasterization and reverse-projection until a broader export/runtime seam is justified
- legend composition may stay chart-specific when the visual grammar differs materially

## Review Rule

When a chart diverges from these conventions, record whether the divergence is:

- `accepted`: chart-specific semantics justify the difference
- `temporary`: cleanup should be scheduled
- `incorrect`: fix now because the library behavior is inconsistent

The audit log for those decisions lives in `docs/status/react-renderer-audit.md`.
