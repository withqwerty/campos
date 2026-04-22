# Demo Page Standard

**Status:** active
**Scope:** component-library demo page patterns for Campos docs and showcase pages
**Purpose:** define reusable component-library demo page patterns for Campos

Campos demo pages are not marketing pages. They are component-library documentation: the page should let a user understand the default, inspect variants, copy good TypeScript usage, and verify cross-cutting behavior without reading implementation files.

Use this standard together with `component-state-review-standard.md`.

## Design Goals

Every component demo page should answer:

1. What do I import?
2. What is the smallest good usage?
3. What data shape does it expect?
4. Which props are safe first-class customization?
5. What stories/states prove the component works?
6. What cross-cutting concerns does it support: accessibility, responsive layout, theme, export/static rendering, interaction, composition?
7. What is intentionally out of scope?
8. When should I use this component instead of a neighboring Campos component?

The page should feel closer to a curated Storybook docs page than a bespoke product demo.

## Page Archetypes

Choose one archetype before building or reviewing the page. Do not force every page into the same visual shape.

### 1. Pitch Surface Primitive

Use for `@withqwerty/campos-stadia` and future pitch surfaces.

Primary job: teach the surface contract: coordinate projection, crop/orientation/side, viewBox frame, underlay vs foreground children, responsive aspect ratio, and export-safe SVG behavior.

Required sections:

- default pitch or surface story
- best-practice component-only TypeScript example
- surface API tables, including secondary surfaces such as `Goal`
- helper API notes for projection and geometry
- interactive controls for crop/orientation/side/theme/markings where applicable
- responsive scaling story
- export/accessibility/composition notes

Layout guidance:

- vertical pitches can fit in normal story cards
- horizontal pitches should usually be wide stories
- avoid decorative card-in-card framing around the main pitch; use a boundary only when it is the functional SVG viewport

### 2. Pitch-Based Chart Component

Use for `ShotMap`, `PassMap`, `PassNetwork`, `Heatmap`, `KDE`, `Territory`, `Formation`, and future pitch charts.

Primary job: show how the chart interprets football data on a pitch.

Required sections:

- hero default story using realistic data
- best-practice component-only TypeScript example
- API table for public chart props
- data contract or adapter note
- usage guidance / neighboring-chart boundaries when relevant
- story matrix covering empty, sparse, dense, fallback/missing, out-of-bounds or clipped data, theme, responsive size, and export/static view
- interaction story if hover/focus/tap changes meaning
- composition story when the chart commonly lives beside another chart

Layout guidance:

- use a wide hero for horizontal pitch charts
- use two-column story cards only when the chart remains readable around 540px
- use `wide` stories for dense, horizontal, dual-team, or control-heavy variants
- controls should manipulate chart props, not hidden app state, and should use shared control patterns when available

### 3. Non-Pitch Chart Component

Use for cartesian, polar, ranking, timeline, and metric components such as `ScatterPlot`, `XGTimeline`, `RadarChart`, `PizzaChart`, `BumpChart`, `CometChart`, `StatBadge`, and future scouting widgets.

Primary job: show scales, labels, legends, comparison semantics, and responsive degradation.

Required sections:

- hero default story
- best-practice component-only TypeScript example
- API table
- usage guidance / neighboring-chart boundaries when relevant
- story matrix covering empty, sparse, dense, degenerate domain, long/multilingual text, theme, responsive size, and export/static view
- scale/legend or metric semantics when they are part of the public contract
- interaction story when hover/focus/tap changes meaning

Layout guidance:

- circular charts need small-container stories because labels often fail first
- timeline/ranking charts usually need wide stories
- table/cell primitives need dense-grid stories, not only single examples

### 4. Primitive Catalogue

Use for marker primitives and future general primitives.

Primary job: show inventory, composition rules, and realistic host contexts.

Required sections:

- catalogue grid with every primitive or preset
- best-practice component-only TypeScript example
- API summary grouped by primitive family
- host-context stories that show the primitives inside real components
- density/overlap story
- long text / multilingual / icon fallback story where relevant
- theme/export/accessibility notes

Layout guidance:

- catalogue grids should span the full content width
- host-context stories should be wide when the host component is wide, such as horizontal Formation
- repeated primitive examples may use cards; do not put the entire catalogue inside an additional decorative card

### 5. Cross-Cutting Guide Or Utility

Use for export composition, adapters, theming, or other workflows that are not one visual component.

Primary job: teach a workflow and its supported scope.

Required sections:

- minimal working example
- supported/unsupported matrix
- failure modes and blocked cases
- API or schema table
- realistic composition examples

## Required Page Anatomy

Every component page should be built from these blocks, with archetype-specific ordering when needed.

### Hero Story

The hero is the default or most representative story. It should be realistic and publishable.

The hero must include:

- actual rendered component
- short description of what the story proves
- fixture provenance when the data is real or provider-derived

Do not repeat the hero unchanged in the story matrix.

### Best-Practice Code

Every page needs a collapsible TypeScript example.

Rules:

- show only component code
- omit data fetching, provider parsing, routing, and page boilerplate
- prefer realistic prop names and typed data
- show the zero-config path first when the component has one
- show one or two important customizations, not every prop
- prefer presets/recipes where that is the intended workflow, instead of
  encoding the page’s local prop pile-up as “best practice”
- include export/static and accessibility props when they are best practice for that component
- avoid examples that import unexported internals

### Controls

Controls are Storybook-like knobs for high-value props. They are optional, not decorative.

Use controls when:

- the prop materially changes the visual contract
- a reader benefits from comparing choices in one place
- the control exercises cross-cutting behavior such as theme, crop, orientation, or label density

Avoid controls when:

- a fixed story communicates the variant better
- the prop is rare or expert-only
- the control would require custom state machinery unrelated to the component API

Standard control groups:

- `Data`: empty/sparse/dense/fixture
- `Layout`: orientation, crop, side, frame, size tier
- `Encoding`: color mode, size mode, scale mode
- `Labels`: labels on/off, label strategy, long text
- `Theme`: primary/secondary/custom colors
- `Interaction`: hover/focus/selection where testable
- `Export`: static mode, interactive off, unsupported features hidden
- `Browser hygiene`: no component-generated console warnings, hydration mismatches, or missing-key noise

### Story Matrix

Stories are named, purposeful variants. A story card should not just be another random example.

Each story should define:

- `title`: short label
- `purpose`: what behavior this story proves
- `variant`: props/data being varied
- `expected behavior`: what a reviewer should look for

Required story categories:

- `Default`: covered by hero
- `Empty`: no plottable data or no items
- `Sparse`: one mark/row/item
- `Dense`: enough marks/items to expose overlap or layout pressure
- `Fallback`: missing optional fields or degraded data
- `Extreme`: out-of-range coordinates, degenerate domains, or clipping stress
- `Responsive`: small and wide containers
- `Theme`: supported theme/color combinations
- `Interaction`: hover/focus/tap/selection, if interactive
- `Export/static`: meaningful without hover and with `interactive={false}` where applicable
- `Composition`: common host-context or side-by-side use
- `Usage boundary`: when users might confuse this component with a neighboring
  one, include a story or note that makes the boundary legible
- `Browser hygiene`: page runs without component-generated console warnings; dev-server/tooling noise should be called out separately, not ignored

When public benchmark or prior-art idioms materially shape user expectation,
include at least one story that shows Campos’ equivalent pattern honestly.

If a category does not apply, document why in the component spec or page notes.

### API Tables

API tables should make the first useful props obvious.

Rules:

- required props first
- common customization props next
- expert props last
- group secondary component APIs separately
- include defaults and ownership notes
- include data contract shape separately when the data object is complex

### Cross-Cutting Notes

Every page should explicitly cover:

- accessibility label and keyboard/touch policy
- responsive behavior and minimum honest size
- theme and color override policy
- static export readiness and unsupported export features
- composition boundaries and what the component does not own
- usage boundaries and what the component is not the right tool for
- any measurement/registration requirements for custom slotted children
- deterministic SVG policy where SSR + hydration both render the same geometry

These notes should be short and concrete. Avoid generic claims like "fully responsive" unless the stories prove it.

## Shared Infrastructure

Current shared pieces:

- `ComponentPage.astro`: nav, footer, hero slot, story slot, usage code, API table, AI prompt block, and shared page spacing
- `DemoCard.astro`: story card chrome with optional `wide` layout
- per-component preview wrappers: thin React components that bridge Astro hydration and typed props

Near-term reusable pieces to prefer over page-specific wiring:

- `StoryGrid`: responsive grid with story-card sizing rules
- `StoryCard`: replacement or extension of `DemoCard` with `purpose`, `expected`, and optional code excerpt
- `ControlsPanel`: shared control groups for common prop families
- `ApiTable`: reusable table for primary props, secondary props, and data contracts
- `CrossCuttingGrid`: standard accessibility/responsive/theme/export/composition notes
- `UsageGuidance`: standard “when to use / when not to use / neighboring chart”
  block
- `PrimitiveCatalogue`: full-width catalogue layout for marker/general primitive families

Until those pieces exist, page-specific markup should still follow the same information architecture so it can be lifted into shared components later.

## Boilerplate Patterns

### Pitch-Based Chart Page

```astro
---
import ComponentPage from "../layouts/ComponentPage.astro";
import DemoCard from "../components/DemoCard.astro";
import { MyPitchChartPreview } from "../components/MyPitchChartPreview";

const code = `<MyPitchChart events={events} />`;
const props = [
  { name: "events", type: "readonly Event[]", default: "required", description: "..." },
  {
    name: "orientation",
    type: '"vertical" | "horizontal"',
    default: '"vertical"',
    description: "...",
  },
];
---

<ComponentPage
  name="MyPitchChart"
  description="..."
  currentPath="/mypitchchart"
  code={code}
  props={props}
>
  <MyPitchChartPreview slot="hero" client:load variant="default" />

  <Fragment slot="states">
    <DemoCard title="Empty" note="No events; shell remains stable.">
      <MyPitchChartPreview client:load variant="empty" />
    </DemoCard>
    <DemoCard title="Dense" note="High event count; overlap remains readable." wide>
      <MyPitchChartPreview client:load variant="dense" />
    </DemoCard>
    <DemoCard title="Export static" note="No hover-only meaning; interactive off." wide>
      <MyPitchChartPreview client:load variant="export" />
    </DemoCard>
  </Fragment>
</ComponentPage>
```

### Primitive Catalogue Page

```astro
---
import ComponentPage from "../layouts/ComponentPage.astro";
import DemoCard from "../components/DemoCard.astro";
import { PrimitiveCatalogue } from "../components/PrimitiveCatalogue";
import { HostContextPreview } from "../components/HostContextPreview";

const code = `<PrimitiveName requiredProp="..." />`;
const props = [
  { name: "PrimitiveName", type: "family", default: "-", description: "..." },
];
---

<ComponentPage
  name="Primitive Family"
  description="..."
  currentPath="/primitives"
  code={code}
  props={props}
>
  <Fragment slot="states">
    <div class="catalogue-full-width">
      <PrimitiveCatalogue client:load />
    </div>
    <DemoCard title="Host context" note="Primitive family inside a real component." wide>
      <HostContextPreview client:load />
    </DemoCard>
  </Fragment>
</ComponentPage>
```

## Quality Rubric

A demo page is ready when:

- a new user can copy the code block without needing hidden imports or page state
- every visible control maps to a public prop or documented story variant
- story titles describe behavior, not styling
- stories cover the component's real failure modes, not just happy-path variants
- pitch and non-pitch components use layouts that preserve readability
- primitive catalogues show both inventory and realistic host usage
- cross-cutting notes are specific enough to guide export, accessibility, responsive, and theme decisions
- page-specific layout hacks are either absent or clearly pointing to a shared component that should be extracted

## Anti-Patterns

- demo pages that are prettier than they are explanatory
- controls that mutate demo-only state unrelated to public API
- code blocks that include data fetching or provider normalization
- examples that use unexported internals
- story cards titled only by prop name, with no behavior claim
- showing only default and cosmetic variants
- forcing horizontal pitch charts into narrow two-column cards
- primitive pages that show inventory but no real host context
- generic "responsive/export-ready/accessibility" copy without a story or concrete policy
