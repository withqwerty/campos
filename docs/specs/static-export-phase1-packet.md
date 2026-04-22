# Static Export Phase 1 Packet

**Status:** implemented, reviewed
**Owner:** Codex
**Target version:** v0.3+
**Depends on:** `docs/specs/static-export-composition-spec.md`, `docs/architecture-decision.md`

## Header

- Component / primitive: static export Phase 1
- Status: implemented, reviewed
- Owner: Codex
- Target version: v0.3+
- Depends on:
  - `docs/specs/static-export-composition-spec.md`
  - `docs/architecture-decision.md`
  - existing chart compute + React renderer packages

## Purpose

Ship the first honest, supportable export slice:

- one-chart card export only
- Node-first SVG export
- PNG derived from SVG
- explicit supported-chart list
- explicit blocked-chart list

This packet exists to remove the remaining ambiguity from the architecture-level export spec. It answers two implementation questions:

1. what exact data shape crosses from `@withqwerty/campos-react` authoring to `@withqwerty/campos-static` rendering
2. which current charts are in scope for the first supported export release

## Product scope

Phase 1 is intentionally narrow.

Supported user story:

- author a single share card with title, subtitle, footer, and one Campos chart
- preview that card in React
- export the same card from Node as standalone SVG or PNG

Out of scope:

- multi-panel layout
- arbitrary JSX composition
- browser-side export runtime
- free-form text/image blocks beyond the frame slots
- "best effort" export of every existing chart

## Current shipped state

The architecture and all Phase 1 chart-kind render paths are landed, the background-schema decision is implemented, and the review loops are recorded.

Shipped now:

- `@withqwerty/campos-react`
  - `createExportFrameSpec`
  - `ExportFrame`
  - `StaticExportSvg`
- `@withqwerty/campos-static`
  - `renderStaticSvg(spec)`
  - `renderStaticPng(spec)`
- chart support
  - `BumpChart`
  - `PizzaChart`
  - `Formation`
  - `PassNetwork`
  - `Territory`
  - `ShotMap`
  - `PassMap`
  - `Heatmap`
  - `ScatterPlot`
  - `XGTimeline`
  - `RadarChart`
- verification
  - `pnpm typecheck`
  - targeted React/static export tests
  - golden SVG fixture coverage across all 11 supported chart kinds
  - long-text stress fixture
  - empty-state export fixture
  - unsupported-kind rejection coverage
  - dual-theme regression fixtures
  - `pnpm lint` (warnings only)
  - `pnpm format:check`
  - `pnpm build`
  - `pnpm --filter @withqwerty/campos-site build`
- site/demo
  - `apps/site/src/pages/export-composition.astro`
  - `apps/site/src/data/export-composition-demo.ts`

Not shipped yet:

- no known Phase 1 blockers remain in this packet

## Public API

### Proposed public exports

- `@withqwerty/campos-react`
  - `ExportFrame`
  - `createExportFrameSpec`
- `@withqwerty/campos-static`
  - `renderStaticSvg`
  - `renderStaticPng`

### Current authoring flow

```tsx
import { ExportFrame, createExportFrameSpec } from "@withqwerty/campos-react";

const frame = createExportFrameSpec({
  preset: "share-card",
  title: "Forward profile",
  subtitle: "Premier League 2025/26",
  footer: "Data: internal",
  chart: {
    kind: "pizza-chart",
    props: {
      rows,
    },
  },
});

<ExportFrame spec={frame} />;
```

```ts
import { renderStaticSvg, renderStaticPng } from "@withqwerty/campos-static";

const svg = renderStaticSvg(frame);
const png = await renderStaticPng(frame);
```

### Why `spec` instead of React-element serialization

Phase 1 should not attempt to serialize arbitrary React trees.

Using a shared `ExportFrameSpec`:

- keeps the Node runtime contract deterministic
- prevents React-only props from leaking into the static package
- makes tests stable and fixtureable
- keeps browser preview and Node export on the same data contract

## Current shipped schema

The current implementation now ships this contract:

```ts
export type ExportFrameSpec = {
  version: 1;
  width: number;
  height: number;
  preset: "share-card" | "article-inline" | "square" | "story";
  theme: "light" | "dark";
  padding: number;
  background: ExportBackgroundSpec;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  footer?: string;
  chart: ExportChartSpec;
};

export type ExportBackgroundSpec =
  | { kind: "theme"; token: "canvas" | "surface" }
  | { kind: "solid"; color: string };

export type ExportChartSpec =
  | { kind: "bump-chart"; props: ExportBumpChartProps }
  | { kind: "pizza-chart"; props: ExportPizzaChartProps }
  | { kind: "formation"; props: ExportFormationProps }
  | { kind: "pass-network"; props: ExportPassNetworkProps }
  | { kind: "territory"; props: ExportTerritoryProps }
  | { kind: "shot-map"; props: ExportShotMapProps }
  | { kind: "pass-map"; props: ExportPassMapProps }
  | { kind: "heatmap"; props: ExportHeatmapProps }
  | { kind: "scatter-plot"; props: ExportScatterPlotProps }
  | { kind: "xg-timeline"; props: ExportXGTimelineProps }
  | { kind: "radar-chart"; props: ExportRadarChartProps };
```

Notable divergence from the broader target:

- `eyebrow` is supported
- the current shipped kind names are kebab-case and now cover all Phase 1 chart kinds: `bump-chart`, `pizza-chart`, `formation`, `pass-network`, `territory`, `shot-map`, `pass-map`, `heatmap`, `scatter-plot`, `xg-timeline`, and `radar-chart`

## Phase 1 schema decision

The Phase 1 decision is now explicit:

- keep `theme` as a first-class export field
- keep additive `eyebrow` support in Phase 1
- migrate `background` from a raw color string to a tagged union
- support at least theme-token and solid-color background branches

This keeps charts and exports themeable without reopening the broader export contract.

## Phase 1 target schema

> **Implemented for Phase 1.** The shipped code now exports all chart kinds below via `packages/react/src/export/types.ts`, with a tagged background union and first-class theme selection.

```ts
export type ExportFrameSpec = {
  version: 1;
  width: number;
  height: number;
  preset?: "share-card" | "article-inline" | "square" | "story";
  theme?: "light" | "dark";
  background?: ExportBackgroundSpec;
  padding?: number;
  title?: string;
  subtitle?: string;
  footer?: string;
  chart: ExportChartSpec;
};

export type ExportBackgroundSpec =
  | { kind: "theme"; token: "canvas" | "surface" }
  | { kind: "solid"; color: string };

export type ExportChartSpec =
  | { kind: "shot-map"; props: ExportShotMapProps }
  | { kind: "pass-map"; props: ExportPassMapProps }
  | { kind: "heatmap"; props: ExportHeatmapProps }
  | { kind: "scatter-plot"; props: ExportScatterPlotProps }
  | { kind: "xg-timeline"; props: ExportXGTimelineProps }
  | { kind: "radar-chart"; props: ExportRadarChartProps }
  | { kind: "pizza-chart"; props: ExportPizzaChartProps }
  | { kind: "bump-chart"; props: ExportBumpChartProps }
  | { kind: "formation"; props: ExportFormationProps }
  | { kind: "pass-network"; props: ExportPassNetworkProps }
  | { kind: "territory"; props: ExportTerritoryProps };
```

### Schema rules

- `version` is required so the spec can evolve without hidden breakage
- `width` and `height` are explicit even when a preset is present
- `theme` remains first-class so exports can resolve light/dark or brand token choices at render time
- `background` should express intent, not only resolved color, via `theme` tokens or a solid override
- `title`, `subtitle`, and `footer` are plain strings only in Phase 1
- `chart` is a tagged union over explicitly supported chart kinds
- Phase 1 export does not accept `ReactNode`, render functions, or arbitrary nested content

## Exportable chart prop subsets

Each supported chart gets a **serializable export subset** of its current public props, not the full React prop surface.

Phase 1 rules:

- omit any `ReactNode` prop such as methodology note slots
- omit render callbacks
- omit props that only matter for interaction
- omit props that rely on unresolved external assets unless the packet explicitly supports them
- static export always renders in static mode, so interactive-only toggles are not carried in the schema

Exact Phase 1 subsets:

```ts
type ExportShotMapProps = Pick<
  ShotMapProps,
  "shots" | "preset" | "colorBy" | "shapeBy" | "colorScale" | "pitchTheme" | "pitchColors"
>;

type ExportPassMapProps = Pick<
  PassMapProps,
  "passes" | "colorBy" | "crop" | "orientation" | "pitchTheme" | "pitchColors"
>;

type ExportHeatmapProps = Pick<
  HeatmapProps,
  | "events"
  | "gridX"
  | "gridY"
  | "colorScale"
  | "colorStops"
  | "orientation"
  | "crop"
  | "metricLabel"
  | "pitchTheme"
  | "pitchColors"
>;

type ExportScatterPlotProps<T> = Pick<
  ScatterPlotProps<T>,
  | "points"
  | "ghost"
  | "idKey"
  | "xKey"
  | "yKey"
  | "colorKey"
  | "colorLabel"
  | "sizeKey"
  | "sizeLabel"
  | "labelKey"
  | "labelStrategy"
  | "autoLabelCount"
  | "labelIds"
  | "guides"
  | "regions"
  | "xLabel"
  | "yLabel"
  | "referenceLine"
>;

type ExportXGTimelineProps = Pick<
  XGTimelineProps,
  | "shots"
  | "homeTeam"
  | "awayTeam"
  | "layout"
  | "showAreaFill"
  | "showScoreStrip"
  | "showShotDots"
  | "teamColors"
>;

type ExportRadarChartProps = Pick<
  RadarChartProps,
  | "rows"
  | "metricOrder"
  | "categoryOrder"
  | "valueMode"
  | "showLegend"
  | "showVertexMarkers"
  | "showAxisLabels"
  | "ringStyle"
  | "ringSteps"
  | "bandSteps"
  | "ringColors"
  | "seriesColors"
  | "categoryColors"
>;

type ExportPizzaChartCenterContent = {
  kind: "initials";
  label?: string;
} | null;

type ExportPizzaChartProps = Pick<
  PizzaChartProps,
  | "rows"
  | "metricOrder"
  | "categoryOrder"
  | "showValueBadges"
  | "showAxisLabels"
  | "showLegend"
  | "categoryColors"
  | "sliceStroke"
> & {
  centerContent?: ExportPizzaChartCenterContent;
};

type ExportBumpChartProps = Pick<
  BumpChartProps,
  | "rows"
  | "highlightTeams"
  | "interpolation"
  | "showMarkers"
  | "showEndLabels"
  | "showStartLabels"
  | "showGridLines"
  | "rankDomain"
  | "teamColors"
  | "timepointLabel"
  | "rankLabel"
  | "markerRadius"
  | "backgroundOpacity"
>;

type ExportFormationProps = FormationProps;

type ExportPassNetworkProps = Omit<PassNetworkProps, "egoHighlight">;

type ExportTerritoryProps = Omit<TerritoryProps, "ariaLabel">;
```

### Notes on omissions

- `ScatterPlotProps["methodologyNotes"]` is excluded because it is `ReactNode`-based frame chrome, not serializable chart content.
- `XGTimelineProps["methodologyNotes"]` is excluded for the same reason.
- `XGTimelineProps["showCrosshair"]` is excluded intentionally because crosshair is a transient interactive affordance that should never be part of static export.
- `RadarChartProps["methodologyNotes"]` is excluded because it is `ReactNode`-based frame chrome.
- `PizzaChartProps["methodologyNotes"]` is excluded because it is `ReactNode`-based frame chrome.
- `PizzaChartProps["centerContent"]` is narrowed to text/initials-only export content. Image and crest center content are not supported in Phase 1 export.
- `BumpChartProps["teamLogos"]` is excluded from export.
- `BumpChartProps["renderEndLabel"]` is excluded from export because arbitrary React end-label renderers are not serializable and the current implementation path is HTML-based.
- `BumpChartProps["methodologyNotes"]` is excluded because it is `ReactNode`-based frame chrome.
- `FormationProps["marker"].glyph === "photo"` and custom marker glyph render functions are rejected because marker photos/custom renderers introduce an asset/rendering pipeline that Phase 1 does not support.
- `FormationProps["marker"].slots` is rejected because marker slot renderers can contain arbitrary React nodes that are not serializable in Phase 1.
- `FormationProps["substitutes"]` and dual-team `home.substitutes` / `away.substitutes` are rejected because the current static SVG export renders the pitch lineup only, not the bench strip.
- `PassNetworkProps["egoHighlight"]` is excluded because ego highlighting is an interactive analysis affordance and static export should render the stable network state.
- `TerritoryProps["ariaLabel"]` is omitted from the serializable export subset; static export derives the label from the computed model.
- Phase 1 does not support any prop branch that introduces arbitrary external assets or render callbacks.

### Serialization constraint

For generic charts such as `ScatterPlot<T>`, the row payload must be JSON-serializable at the point `createExportFrameSpec()` is called.

That means:

- plain data objects and arrays are allowed
- functions, class instances, symbols, and cyclic structures are not

## Current shipped support

| Chart         | Current status | Notes                                                                                                 |
| ------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `PizzaChart`  | shipped        | export rejects image/crest center content and keeps text/initials-only center content                 |
| `BumpChart`   | shipped        | export rejects `teamLogos` and `renderEndLabel`, and uses SVG text end labels instead of HTML overlay |
| `Formation`   | shipped        | export renders pitch-only lineup SVG and rejects photo markers/substitute benches                     |
| `PassNetwork` | shipped        | export renders static nodes/edges and disables ego-highlight interaction                              |
| `Territory`   | shipped        | export renders territory cells inside the shared pitch SVG and keeps empty-state text SVG-native      |
| `ShotMap`     | shipped        | export renders pitch markers and legend context without tooltip dependency                            |
| `PassMap`     | shipped        | export renders static pitch arrows and pass-outcome legend context                                    |
| `Heatmap`     | shipped        | export renders heatmap grid cells inside the shared pitch SVG and derives scale-bar legend context    |
| `ScatterPlot` | shipped        | export renders SVG-only points, axes, guides, labels, regions, and empty-state text                   |
| `XGTimeline`  | shipped        | export renders step lines, shot markers, end labels, and score-strip context with crosshair disabled  |
| `RadarChart`  | shipped        | export renders rings, polygons, labels, and legend context without hover targets                      |

## Phase 1 target support

The list below remains the target packet scope. All entries are now implemented as chart render paths; the packet remains partial because fixture/demo/review coverage is not closed.

| Chart         | Phase 1 status | Why                                                                                                                                                       |
| ------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ShotMap`     | supported      | simple plot semantics, no external image dependency, strong baseline component                                                                            |
| `PassMap`     | supported      | on-pitch SVG geometry, no required external assets                                                                                                        |
| `Heatmap`     | supported      | simple rect-based plot model, static story remains meaningful without hover                                                                               |
| `ScatterPlot` | supported      | standard Cartesian SVG marks and labels, no required external assets                                                                                      |
| `XGTimeline`  | supported      | static story is strong once crosshair/tooltip affordances are disabled                                                                                    |
| `RadarChart`  | supported      | pure SVG chart with no required external assets; suitable for a first non-pitch export case                                                               |
| `PizzaChart`  | supported      | remains a valid export card when `centerContent` is gated to initials/text-only content                                                                   |
| `BumpChart`   | supported      | remains a valid export card by rendering text-only SVG end labels from the existing `model.endLabels` positions and disallowing HTML/logo end-label paths |
| `Formation`   | supported      | pitch-only lineup cards are SVG-native once photo/substitute branches are gated                                                                           |
| `PassNetwork` | supported      | on-pitch SVG geometry, static node labels, and directed edge markers are export-safe without hover                                                        |
| `Territory`   | supported      | heatmap-derived pitch bins are pure SVG and remain meaningful without hover                                                                               |

## Phase 1 blocked charts

Blocked charts are not "bad"; they just impose extra scope that the first packet should not absorb.

| Chart        | Phase 1 status | Why blocked                                                                                               |
| ------------ | -------------- | --------------------------------------------------------------------------------------------------------- |
| `KDE`        | blocked        | current renderer depends on browser canvas and `toDataURL`, which is not Phase 1 Node-safe as implemented |
| `CometChart` | blocked        | optional external logo `<image>` path adds asset-resolution scope that the first packet does not need     |

### Phase 1 support constraints

Even for supported charts:

- current HTML wrapper concerns like `ChartFrame` are not accepted as-is
- tooltip overlays are not part of export
- hover-only affordances must be removed or replaced by static-safe context
- `PizzaChart` export must reject `centerContent.kind === "image"` and `centerContent.kind === "crest"`
- `BumpChart` export must reject `teamLogos` and `renderEndLabel`
- `BumpChart` export must not reuse the current HTML end-label overlay path; it should render export-safe SVG text labels from `model.endLabels`
- `Formation` export must reject photo/custom marker glyphs, marker slot renderers, and substitute benches until an asset/bench/static-slot path is deliberately scoped
- `PassNetwork` export must omit ego-highlight interaction and render a stable full network

This packet now assumes the current React-SSR static path stays in place and remaining charts are added onto that path unless a chart proves it needs a dedicated fallback.

## Static rendering contract per supported chart

### `ShotMap`

- export keeps pitch, markers, and export-safe legend context
- tooltip-only detail is not required for the main story

### `PassMap`

- export keeps pitch, arrows, and basic legend/context
- no hover-only information should be required to understand directionality

### `Heatmap`

- export keeps grid, pitch, and scale bar
- tooltip values are not required for baseline interpretation

### `ScatterPlot`

- export keeps points, axes, guides, and labels that are already part of the static view
- if exact value readout matters, a later caption/table companion is a follow-up, not a Phase 1 blocker

### `XGTimeline`

- export keeps step lines, goals, end labels, and score-strip context
- crosshair and hover pills are removed

### `RadarChart`

- export keeps rings, polygons, labels, and any legend needed to interpret series
- vertex hover state is removed

### `PizzaChart`

- export keeps slices, labels, badges, and any legend needed to interpret series/category meaning
- center content is allowed only when it is text/initials-based
- image and crest center content are rejected in Phase 1 export

### `BumpChart`

- export keeps lines, markers, grid, and label context needed to identify teams
- export uses text-only SVG end labels derived from the existing `model.endLabels` layout
- logo-based or custom React end-label rendering is rejected in Phase 1 export

### `Formation`

- export keeps the pitch lineup, formation slots, labels, names, and team legend context
- photo markers and substitute benches are rejected in Phase 1
- the static renderer does not reuse the HTML card/bench wrapper

### `PassNetwork`

- export keeps pitch, nodes, edges, direction markers, node labels, and stable legend context
- hover, focus, and ego-highlight states are removed
- directed reciprocal edges are offset in SVG so both directions remain visible

### `Territory`

- export keeps pitch, zone cells, labels, and empty-state copy
- hover-only zone detail is omitted
- dark color scales may force lighter pitch lines to preserve readability

### `BumpChart` export implementation note

The current interactive renderer uses:

- SVG start labels via `model.startLabels`
- HTML overlay end labels via `model.endLabels`

Phase 1 export should add a dedicated SVG end-label renderer that mirrors the existing start-label treatment:

- iterate `model.endLabels`
- render SVG `<text>` at `x={label.x}` and `y={label.y + 4}`
- use `textAnchor="start"`, `fontSize={10}`, `fontWeight={700}`, and `fill={label.color}`
- use `label.teamLabel` only; never logos or arbitrary custom content

This keeps the export path aligned with the already-computed overlap-resolved label positions from core, without needing an asset pipeline or HTML serialization.

## React package responsibilities

`@withqwerty/campos-react` Phase 1 responsibilities:

- validate and normalize `ExportFrame` authoring props
- produce `ExportFrameSpec`
- render `<ExportFrame spec={...} />` for local preview
- reject unsupported chart kinds or unsupported prop combinations before export

It should **not**:

- own SVG serialization
- own PNG rasterization
- attempt browser screenshot export as the primary path

## Static package responsibilities

`@withqwerty/campos-static` Phase 1 responsibilities:

- accept `ExportFrameSpec`
- render standalone SVG for supported chart kinds
- inline required assets for supported scenarios
- rasterize the SVG to PNG

It should **not**:

- accept arbitrary React elements
- depend on browser DOM APIs
- silently degrade unresolved referenced assets

## File-level implementation plan

The first implementation packet should use the following file ownership.

### Workspace and package wiring

- `package.json`
  - add `@withqwerty/campos-static` to the root `build` pipeline
- root `tsconfig.json`
  - include the new package if required by the current project references layout
- `packages/static/package.json`
  - create package metadata and build script
- `packages/static/tsconfig.json`
  - create package TS build config

### React package: authoring and preview

- `packages/react/src/export/types.ts`
  - define `ExportFrameSpec`
  - define `ExportChartSpec`
  - define supported export prop subset types
  - define validation helpers for blocked prop branches
- `packages/react/src/export/createExportFrameSpec.ts`
  - implement `createExportFrameSpec()`
  - normalize authoring input into the serializable spec
  - reject unsupported chart kinds and unsupported prop combinations
- `packages/react/src/export/ExportFrame.tsx`
  - implement React preview of `ExportFrameSpec`
  - render title / subtitle / footer slots
  - dispatch supported chart kinds to preview renderers
- `packages/react/src/export/StaticExportSvg.tsx`
  - render the standalone SVG export frame
  - dispatch supported chart kinds to chart-specific static SVG renderers
  - resolve static legend context and chart aspect ratios
- `packages/react/src/index.ts`
  - export `ExportFrame`
  - export `createExportFrameSpec`
  - export `ExportFrameSpec` and related export types

### Static package: rendering and serialization

- `packages/static/src/index.ts`
  - export `renderStaticSvg`
  - export `renderStaticPng`
- `packages/static/src/render/renderStaticSvg.ts`
  - main Node-side SVG renderer from `ExportFrameSpec`
- `packages/static/src/render/renderStaticPng.ts`
  - PNG derivation from rendered SVG
- `packages/static/src/index.ts`
  - delegates SVG rendering to `StaticExportSvg` and `renderToStaticMarkup`
  - derives PNG output from the rendered SVG with `sharp`

### Tests

- `packages/react/test/ExportFrame.test.tsx`
  - preview rendering tests
  - authoring validation tests
- `packages/static/test/render-static-svg.test.ts`
  - standalone SVG rendering tests for all supported chart kinds
- `packages/static/test/render-static-png.test.ts`
  - PNG smoke tests from the same fixtures
- `packages/static/test/fixtures/*.ts`
  - golden export specs and expected output fixtures

### Demo/docs surface

- `apps/site/src/pages/export-composition.astro`
  - Phase 1 export demo page
- `apps/site/src/data/export-composition-demo.ts`
  - export frame specs / demo fixtures for supported charts

### Optional extraction only if needed during implementation

- `packages/react/src/primitives/ChartFrame.tsx`
  - only touch if shared frame styling needs to be aligned with `ExportFrame`
- `packages/react/src/compute/index.ts`
  - only touch if additional compute-layer types need re-exporting for the static package

## Implementation order

1. Shipped: create `packages/static` and wire it into the workspace build.
2. Shipped: add `types.ts` and `createExportFrameSpec()` in `@withqwerty/campos-react`.
3. Shipped: add `ExportFrame.tsx` preview in `@withqwerty/campos-react`.
4. Shipped: implement `renderStaticSvg()` and `renderStaticPng()` in `@withqwerty/campos-static`.
5. Shipped: add Pizza/Bump static gating and Bump SVG end labels.
6. Shipped: add Formation, PassNetwork, and Territory static SVG support.
7. Shipped: implement ShotMap, PassMap, Heatmap, ScatterPlot, XGTimeline, and RadarChart static renderers.
8. Remaining: add demo page and regression fixtures.

## Asset policy for Phase 1

To keep the first packet honest, asset policy should be narrow:

- support theme/background tokens
- support charts with no required external images
- do not support arbitrary remote image fetches by default

Recommended rule:

- Phase 1 allows zero required external assets for the supported chart set
- `PizzaChart` and `BumpChart` are supported only through non-asset fallback paths
- remote URL asset resolution is deferred

This keeps the first export release deterministic in CI and local builds.

## Demo requirements

- required page path under `apps/site/src/pages/`
  - `apps/site/src/pages/export-composition.astro`
- baseline scenario
  - `ShotMap` share card
- secondary supported scenarios
  - `PassMap` share card
  - `Heatmap` share card
  - `ScatterPlot` share card
  - `XGTimeline` share card
  - `RadarChart` share card
  - `PizzaChart` share card with initials/text center content
  - `BumpChart` share card with text-only SVG end labels
  - `Formation` pitch-only lineup share card
  - `PassNetwork` full-network share card
  - `Territory` zone-control share card
- blocked scenario card
  - explicit unsupported `KDE` example or note
- edge scenario cards
  - long title/subtitle/footer
  - empty-state export card

## Test requirements

- schema tests
  - `createExportFrameSpec` rejects unsupported chart kinds and unsupported prop branches
- static rendering tests
  - `renderStaticSvg` returns standalone SVG for each supported chart kind
  - `renderStaticPng` returns PNG for the same fixtures
- regression fixtures
  - one golden SVG fixture per supported chart kind
- edge tests
  - missing optional title/subtitle/footer
  - empty-state supported chart
  - unsupported chart kind throws explicit error
- chart-specific gating tests
  - `PizzaChart` export rejects `centerContent.kind === "image" | "crest"`
  - `BumpChart` export rejects `teamLogos`
  - `BumpChart` export rejects `renderEndLabel`
  - `BumpChart` export renders `model.endLabels` as SVG text labels
  - `Formation` export rejects photo markers and substitute benches
  - `PassNetwork` export omits ego-highlight state
- asset tests
  - referenced unsupported asset source throws explicit error

## Edge-case matrix

- empty supported chart
  Expected: valid card with honest empty-state content
  Test shape: per-chart export fixture
- long text in title/subtitle/footer
  Expected: deterministic wrapping or clipping with no overlap
  Test shape: text-stress fixture
- chart with hover-only interaction state
  Expected: export strips transient affordances and stays interpretable
  Test shape: per-chart static render assertion
- unsupported chart kind
  Expected: explicit validation error before rendering
  Test shape: schema validation test
- unsupported asset source
  Expected: explicit validation or render error
  Test shape: asset policy test
- theme switch
  Expected: light/dark cards remain readable and stable
  Test shape: dual-theme regression fixtures

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo        | Why relevant                            | What it covers                                               | What Campos should keep                              | What Campos should change                             |
| ----------- | --------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------- |
| `mplsoccer` | strongest local static export reference | single-figure static storytelling with title/endnote framing | the exported unit should be the finished card/figure | do not inherit figure/axes APIs                       |
| `d3-soccer` | strongest local browser SVG reference   | explicit SVG composition discipline                          | width/height/viewBox clarity and SVG-first rendering | do not require users to hand-assemble raw SVG layouts |

## Review plan

- loop 1 scope / packet adversarial review
  - challenge the supported-chart list and schema boundary
- loop 2 implementation adversarial review
  - challenge serializer correctness, static-mode honesty, and unsupported-chart handling
- loop 3 release-readiness adversarial review
  - challenge whether the blocked-chart story is documented clearly enough for users

## Review log

### Loop 2: implementation adversarial review

- Date: 2026-04-14
- Inputs reviewed:
  - `packages/react/src/export/`
  - `packages/static/index.ts`
  - `packages/react/test/ExportFrame.test.tsx`
  - `packages/static/test/renderStatic.test.ts`
  - `apps/site/src/pages/export-composition.astro`
  - `apps/site/src/data/export-composition-demo.ts`
- Method:
  - serializer correctness challenge
  - blocked-branch rejection challenge
  - fallback and empty-state challenge
  - demo/test coverage challenge
- Findings:
  - Tightening unsupported-kind handling exposed a hidden `territory` legend fallback gap in `StaticExportSvg`. Fixed by making `territory` an explicit empty-legend branch.
  - Fixture coverage was incomplete for release claims. Fixed by landing 11 golden SVG fixtures plus long-text, empty-state, unsupported-kind, and dual-theme regression coverage.
- Outcome:
  - no remaining implementation blockers

### Loop 3: release-readiness adversarial review

- Date: 2026-04-14
- Inputs reviewed:
  - `docs/specs/static-export-phase1-packet.md`
  - `docs/roadmap-v0.3.md`
  - `docs/status/matrix.md`
  - `apps/site/src/pages/export-composition.astro`
  - `apps/site/src/data/export-composition-demo.ts`
- Method:
  - docs-to-code drift challenge
  - blocked-chart messaging challenge
  - release-claim proof challenge
- Findings:
  - Docs drifted after the theme-aware background schema was implemented. Fixed by updating the packet, roadmap, and matrix so they describe the shipped union-based background contract and closed demo/fixture gaps.
  - The blocked-chart story is now explicit on the demo page and in the packet, with gating called out for Pizza image/crest content, Bump logo/custom end labels, and Formation photo/substitute branches.
- Outcome:
  - release-readiness review passed

## Open questions

- Should `ExportFrame` preview use `spec` only, or also accept authoring props directly and derive `spec` internally?
- Should `RadarChart` remain in Phase 1, or be deferred if curved-label serialization proves fragile in practice?
- Should Phase 1 bundled/local asset support be present at launch, or should the first release support zero external assets only?
- Do supported-chart static renderers live in `@withqwerty/campos-react`, `@withqwerty/campos-static`, or as shared export-specific helpers between them?
