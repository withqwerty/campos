# Static Export Composition Spec

**Status:** active draft
**Owner:** Codex
**Target version:** v0.3+
**Depends on:** `docs/architecture-decision.md`, `docs/component-composition-standard.md`, `docs/component-extension-standard.md`, `docs/specs/export-style-parity-spec.md`

## Purpose

This packet defines how Campos should support:

- user-owned chart composition such as titles, subtitles, notes, logos, badges, and multi-chart cards
- export of that composed surface to static SVG first, then PNG
- export-safe chart rendering without forcing each chart to own its own screenshot logic

For style-injection parity rules inside that export surface, use `docs/specs/export-style-parity-spec.md` as the active source of truth.

This belongs in Campos because the user task is not "save this bare chart node." The real task is "compose a finished football graphic and export it."

This should be a **public composition surface plus public static export API**, not a one-off internal helper, because:

- export is a user-facing outcome, not just an implementation detail
- the export unit is larger than an individual chart
- users need a stable, documented path for titles, credits, and editorial framing

This should **not** become a free-form scene graph or arbitrary low-level layout system. The public surface should stay chart-shaped and card/report-shaped.

## Problem statement

Campos charts are mostly SVG-first in spirit, but export support is still packet-partial. The architecture now has a real `@withqwerty/campos-static` package, a React-side export authoring surface, and chart render paths for the full Phase 1 supported list. The remaining gap is release hardening: demo surface, fixture breadth, schema decision, and review close-out.

More importantly, a chart-level export API is the wrong primary abstraction for many real use cases:

- users often need titles, subtitles, source lines, methodology notes, or sponsor/club branding outside the plot area
- users may want two or more charts in one image
- export-safe content should not depend on hover state
- some current charts mix SVG with HTML overlays, which makes whole-card export inconsistent

Campos therefore needs a composition-first model:

1. charts render plot content
2. a constrained export-safe composition surface arranges the content
3. export runs on the composed surface as a whole

## Current implementation state

The architecture and Phase 1 chart render paths are now implemented:

- `@withqwerty/campos-react` ships `createExportFrameSpec`, `ExportFrame`, and `StaticExportSvg`
- `@withqwerty/campos-static` ships `renderStaticSvg(spec)` and `renderStaticPng(spec)`
- current chart support covers `BumpChart`, `PizzaChart`, `Formation`, `PassNetwork`, `Territory`, `ShotMap`, `PassMap`, `Heatmap`, `ScatterPlot`, `XGTimeline`, and `RadarChart`
- `version`, `preset`, and `theme` are present in the shipped schema
- `eyebrow` is an additive shipped field on the frame spec
- `background` is currently a plain solid-color string, not a tagged background union

Still missing from the intended Phase 1 surface:

- the export demo page in `apps/site`
- the broader fixture and review-loop coverage expected by the packet
- the final schema decision on `background` / `eyebrow` before the export API is treated as stable

## Composition Model

### Public component

- `ExportFrame`
- chart-level `staticMode` prop or equivalent chart option

### Internal coordinate space

- `StaticCardFrame`
- fixed-pixel export viewport
- SVG-first composition root

### Internal mark layers

- existing chart mark layers (`PointLayer`, `LineLayer`, `HeatmapLayer`, `RadarPolygon`, `StepLine`, pitch layers)
- new `StaticTextBlock`
- new `StaticLogoImage`
- new `StaticMetaRow`

### Internal annotation and layout layers

- `TitleBlock`
- `SubtitleBlock`
- `FooterBlock`
- `LegendBlock`
- `Credits / SourceBlock`
- `Grid / Stack layout`

### Shared encoding utilities

- export-safe typography tokens
- fixed-size spacing scale
- image inlining / asset resolution
- theme token resolution for light / dark / branded presets

### Chart-specific logic

- chart-level static fallback rules
- chart-level export-safe legend/header choices
- chart-level "hide hover-only affordances" behavior

### Primitive extraction plan

- `StaticCardFrame`
  First consumer: single-chart share cards
  Second expected consumer: social preview / OG images
- `ExportGrid`
  First consumer: two-chart cards
  Second expected consumer: report pages / comparison layouts
- `StaticTextBlock`
  First consumer: export title/subtitle/footer
  Second expected consumer: methodology notes / source labels

### Explicit non-goals

- arbitrary React subtree capture with pixel-perfect fidelity
- browser-only screenshotting as the main story
- public low-level SVG scene assembly API
- interactive export state replay
- WYSIWYG general presentation-builder tooling

## Product position

Campos should treat **the composed card** as the primary export unit.

This means:

- per-chart image export may still exist as a convenience
- but the main supported path should be "compose a static card/report surface, then export that"

The composition surface should be intentionally constrained:

- finite layout primitives
- finite typography slots
- export-safe asset types
- documented size presets

This is stricter than "render arbitrary JSX and hope `html-to-image` works." The stricter surface is what makes reliable SVG and PNG export feasible.

## Public API

### Proposed public exports

- Phase 1
  - `@withqwerty/campos-react`
    - `ExportFrame`
  - `@withqwerty/campos-static`
    - `renderStaticSvg()`
    - `renderStaticPng()`

### Zero-config happy path

```tsx
<ExportFrame
  preset="share-card"
  title="Arsenal shot map"
  subtitle="Premier League 2025/26"
  footer="Data: Opta"
  chart={<ShotMap shots={shots} staticMode />}
/>
```

```ts
const svg = await renderStaticSvg({
  width: 1200,
  height: 630,
  frame: exportFrameSpec,
});

const png = await renderStaticPng({
  width: 1200,
  height: 630,
  frame: exportFrameSpec,
});
```

### Proposed component API shape

Phase 1 is **Node-first** and aligns with the architecture decision for `@withqwerty/campos-static`.

That means:

- `@withqwerty/campos-react` provides the authoring / preview composition component
- `@withqwerty/campos-static` provides Node-side SVG and PNG generation
- browser-side export support is deferred until the Node-first contract is proven

The first stable export contract should therefore be:

- a serializable export frame definition produced from export-safe props
- Node-side rendering to standalone SVG
- PNG rasterization derived from that SVG

The spec does **not** commit Phase 1 to arbitrary React-element input on the static side.

`ExportFrame`

| Prop         | Required | Purpose                   | Notes                                             |
| ------------ | -------- | ------------------------- | ------------------------------------------------- |
| `chart`      | yes      | single chart export input | exactly one Campos chart component in static mode |
| `preset`     | no       | named size/layout preset  | `share-card`, `article-inline`, `square`, `story` |
| `width`      | no       | explicit export width     | used when not driven by preset                    |
| `height`     | no       | explicit export height    | used when not driven by preset                    |
| `title`      | no       | main editorial title      | plain string or constrained rich text             |
| `subtitle`   | no       | secondary title line      | plain string or constrained rich text             |
| `footer`     | no       | source/credit/footer line | plain string or constrained rich text             |
| `theme`      | no       | export theme tokens       | current implementation supports `light` / `dark`  |
| `background` | no       | background treatment      | current implementation uses a solid color string  |
| `padding`    | no       | frame spacing override    | token or bounded numeric                          |

`staticMode`

All public chart components should support a static-safe rendering mode, either as:

- a shared `staticMode?: boolean` prop, or
- a more explicit `renderMode?: "interactive" | "static"` prop

Static mode should:

- remove dependence on hover for core meaning
- disable transient crosshairs, hover outlines, and tooltip-only emphasis
- prefer always-visible end labels / legends / captions where needed
- remain visually publishable without extra user work

### Supported composition subset

Phase 1 should support a deliberately narrow child surface inside `ExportFrame`:

- exactly one Campos chart component passed via the `chart` prop and rendered in static mode
- built-in title / subtitle / footer slots on `ExportFrame`
- tokenized background and spacing options

Phase 1 should explicitly **not** support:

- arbitrary JSX child composition
- arbitrary HTML blocks
- user-authored CSS inside the export surface
- multi-panel layout
- free-form image placement

Phase 2 may widen this surface with multi-panel layout and dedicated export-safe text/image blocks, but those should be introduced only after the single-chart contract is stable.

### Filtering

This packet does not define end-user filtering behavior. Export uses the already-filtered chart state that the caller passes in.

### Explicit non-goals

- `chartRef.current.toPng()` on every component as the primary API
- exposing browser screenshot libraries directly as the user contract
- supporting arbitrary CSS features that are difficult to serialize or rasterize consistently

## Required normalized data

This packet introduces no new adapter-level data requirements.

The export system consumes already-prepared chart props and optional static composition metadata.

| Field         | Required | Why                          | Fallback if missing |
| ------------- | -------- | ---------------------------- | ------------------- |
| chart props   | yes      | render chart content         | no export           |
| title         | no       | editorial framing            | omit title block    |
| subtitle      | no       | secondary context            | omit subtitle block |
| footer/source | no       | attribution                  | omit footer block   |
| logos/images  | no       | branding/editorial treatment | omit image block    |

Also state:

- all providers supported by the underlying chart remain supported
- export adds no new provider widening requirement
- asset URLs may need inlining or local resolution to be export-safe

## Default visual contract

### Layout

- `ExportFrame` is a single bounded card/report surface with fixed export dimensions
- title/subtitle live above the content area by default
- footer/source lives below the content area by default
- the main content area contains exactly one chart in Phase 1

### Encodings

- export should preserve the chart’s existing visual encodings
- static mode may promote supporting context such as legends or end labels when hover is unavailable

### Legend behavior

- legends that carry meaning should be present in static mode
- legends that only duplicate obvious encodings may remain optional

### Tooltip behavior

- tooltips are not part of export
- any chart whose essential meaning currently depends on tooltip must define an export-safe fallback

### Empty state

- empty cards should render a valid title/footer plus an explicit empty-state message
- empty export should still be honest and shareable

### Fallback mode when key fields are absent

- if a chart lacks optional logos/images, export should fall back to text-only framing
- if an asset is referenced by the export payload but cannot be resolved or inlined, export should fail explicitly

## Static rendering / export

Campos should remain **SVG-first** for export.

The intended pipeline is:

1. render an export-safe composition surface
2. serialize that surface to standalone SVG with required assets inlined
3. optionally rasterize the SVG to PNG

The main public contract should be about deterministic output, not DOM screenshots.

### Why SVG-first

- matches most current chart implementations
- supports crisp text and lines
- preserves print/publication quality better than screenshot-first approaches
- aligns with the planned `@withqwerty/campos-static` package

### PNG export

PNG should be derived from the SVG path, not designed as a separate rendering system.

### Asset inlining rules

Export infrastructure must handle:

- fonts used by the export preset
- raster assets referenced by SVG `<image>`
- local logos/badges used in cards

If an asset is referenced by the export payload and cannot be made standalone, export should fail explicitly rather than silently producing incomplete output.

If an optional asset is simply not provided in the payload, the export should omit that slot cleanly.

## Internal primitives required

| Primitive                     | State | Why                                           |
| ----------------------------- | ----- | --------------------------------------------- |
| `StaticCardFrame`             | new   | single export-safe root surface               |
| `StaticTextBlock`             | new   | deterministic title/subtitle/footer rendering |
| `AssetResolver`               | new   | inline or resolve images/fonts for export     |
| `Static render mode contract` | new   | chart-level export-safe behavior              |
| `SVG serializer`              | new   | convert composition output to standalone SVG  |
| `PNG rasterizer`              | new   | derive PNG from serialized SVG                |

State whether each is existing, needs extraction, or new:

- all are **new**
- some current chart seams can be reused, but the composition root is still partial rather than packet-complete

## Current implementation blockers

The current renderer still has release blockers that the remaining packet work must address or explicitly fence off:

- `ChartFrame` is an HTML wrapper, not a single export-safe SVG/card surface
- `BumpChart` needed an export-specific SVG/text-only fallback and now has one in the partial implementation
- `Formation` is exportable only through the pitch lineup path; photo markers and substitute benches are explicitly gated out
- `PassNetwork` is exportable only as a stable full-network view; ego-highlight interaction is excluded
- `Territory` is exportable as SVG pitch cells, but richer hover-only zone readouts remain outside the export surface
- unsupported external `<image>` asset branches remain gated or deferred until an asset resolver exists
- some charts still omit tooltip-only detail from export; if exact value readout becomes product-critical, that belongs in a later caption/table companion rather than blocking the current chart render path

## Deferred Phase 2

These are intentionally out of scope for the first implementation packet:

- multi-panel `ExportGrid`
- free-form export-safe image blocks
- richer title/subtitle/footer content than the constrained Phase 1 text contract
- browser-side export runtime
- report-style cards with multiple charts or mixed chart/text panels

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo        | Why relevant                            | What it covers                                                                          | What Campos should keep                                                           | What Campos should change                                                                                                  |
| ----------- | --------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `mplsoccer` | strongest local static-export reference | figure-first composition with title/endnote/grid helpers and static output expectations | the idea that the exported unit is a composed figure/card, not just a single plot | do not inherit matplotlib axes/figure APIs; keep the public surface React/card-shaped and renderer-agnostic where possible |
| `d3-soccer` | strongest local browser-SVG reference   | SVG-first chart rendering and manual composition inside a shared SVG root               | browser-side SVG composition and explicit width/height/viewBox discipline         | avoid pushing composition burden entirely onto ad hoc manual SVG assembly by end users                                     |

Campos should deliberately diverge from both:

- from `mplsoccer`: avoid exposing figure/axes mechanics as the public API
- from `d3-soccer`: avoid making users hand-build every title/header/footer arrangement in raw SVG

## Edge-case matrix

- empty chart in export frame
  Expected: title/footer still render; chart area shows honest empty state
  Test shape: React static render + exported SVG snapshot
- one chart with long title/subtitle
  Expected: wrapping/truncation rules remain deterministic and non-overlapping
  Test shape: snapshot + visual regression
- dense multi-panel export
  Expected: deferred to Phase 2, not part of the Phase 1 packet
  Test shape: none in Phase 1
- chart with tooltip-only detail
  Expected: static mode promotes enough visible labels/legend/caption to keep output honest
  Test shape: per-chart static-mode assertions
- external image/logo asset unavailable
  Expected: explicit export error, not broken image icon
  Test shape: mocked resolver failure
- chart with current HTML overlay content
  Expected: either static-safe fallback path or documented unsupported-in-export status until fixed
  Test shape: BumpChart-specific export case
- long / multilingual text
  Expected: deterministic wrap and no card overflow
  Test shape: multilingual title/footer fixture
- dark / light themes
  Expected: tokenized theme output remains readable and contrast-safe
  Test shape: dual-theme export fixtures
- local and remote asset mix
  Expected: asset resolver produces standalone export output
  Test shape: local logo + remote image fixture

## Pre-implementation prep

Before opening the implementation packet:

- collect 6-10 real target compositions users actually want to share
- separate single-chart cards from multi-chart report panels
- identify which existing chart components already survive static mode cleanly
- identify which charts need export-safe fallback work before export can be called supported
- prepare real fixtures using current site demo data where possible
- record any asset source paths used in demos or tests
- decide whether the first implementation packet targets browser-only export, Node-only export, or both
  Decision for this spec: Node-only export in Phase 1; browser export deferred

## Demo requirements

- required page path under `apps/site/src/pages/`
  - `apps/site/src/pages/export-composition.astro`
- baseline scenario
  - one chart + title + footer share card
- fallback scenario
  - empty-state share card
- stress / dense scenario
  - long title / subtitle / footer single-card case
- additional scenario cards
  - constrained `ShotMap` single-card
  - constrained `PassMap` single-card
  - constrained `Heatmap` single-card
  - constrained `ScatterPlot` single-card
  - constrained `XGTimeline` single-card
  - constrained `RadarChart` single-card
  - constrained `PizzaChart` single-card with text/initials center content
  - constrained `BumpChart` single-card with text-only end labels
  - constrained `Formation` pitch-only lineup card
  - constrained `PassNetwork` full-network card
  - constrained `Territory` zone-control card
  - constrained long-text editorial single-card

## Test requirements

- core/static tests
  - serializer output is standalone and stable
- React tests
  - `ExportFrame` layout invariants
  - chart `staticMode` behavior where applicable
- integration tests
  - SVG export of single-chart card
  - PNG export of the same card
- accessibility checks
  - composition surface has sensible text ordering and labels before export
- regression fixtures
  - golden SVG fixtures for baseline presets

## Review plan

- loop 1 scope / spec adversarial review
  - challenge whether the public API is too open-ended
- loop 2 implementation adversarial review
  - challenge asset resolution, chart fallback honesty, and SVG determinism
- loop 3 release-readiness adversarial review
  - challenge whether the first shipped presets are enough for real user workflows

## Recommended delivery order

1. Define export-safe composition primitives and presets.
2. Ship `ExportFrame` for one-chart cards only.
3. Ship Node-side SVG export for one-chart cards.
4. Ship PNG rasterization on top of SVG export.
5. Backfill chart-level static-mode fixes where current charts are not export-safe.
6. Open a separate Phase 2 packet for multi-panel composition.

## Open questions

- Which asset sources are allowed in Phase 1: bundled/local only, or remote URLs too?
- Should `staticMode` be a universal chart prop or an opt-in only for charts that need behavior changes?
