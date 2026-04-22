# XGTimeline Component Spec

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `XGTimeline` (public chart component)
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha
- Depends on:
  - `@withqwerty/campos-react` compute layer (`computeXGTimeline`)
  - `@withqwerty/campos-react` renderer seams (`ChartFrame`, shared cartesian guides/labels/tooltip seams)
  - `@withqwerty/campos-adapters` optionally, when raw provider shots are normalized upstream

## Purpose

- What user task this solves:
  - show cumulative chance quality across a match rather than final totals alone
  - answer when each team generated danger and how the match-flow changed over time
- Why it belongs in Campos:
  - this is one of the most common football editorial/scouting storytelling charts and it exercises the shared cartesian/time-series seams Campos now owns
- Why it should be public:
  - cumulative-step construction, halftime/full-time guides, score-strip behavior, and shot-marker semantics are chart-level product decisions, not consumer glue

## Domain framing

### Football concept

`XGTimeline` models a **match-flow view of cumulative chance quality** for two
teams over time.

It is not:

- a generic step chart disconnected from football match state
- a raw provider shot-feed viewer
- the owner of xG model computation

### Bounded-context ownership

- `schema` owns canonical shot and team-assignment semantics upstream
- `adapters` own translation from provider shot/event feeds into canonical shot
  data
- `react` owns:
  - cumulative-step construction
  - halftime/full-time guide behavior
  - score-strip and marker presentation
  - layout/read defaults
- `stadia` is not involved; this is a cartesian match-flow surface

### Canonical input model

The public component expects canonical shot data plus home/away team context
already resolved upstream.

### Invariants

- cumulative lines depend on canonical team assignment and shot ordering
- xG values are upstream model outputs, not something the chart derives
- halftime/full-time guides and score-strip behavior enrich the read without
  changing the underlying shot chronology
- sparse shooting should degrade honestly to a low-event match-flow view, not a
  fabricated narrative

## Public API

### Zero-config happy path

```tsx
import { XGTimeline } from "@withqwerty/campos-react";

<XGTimeline shots={shots} homeTeam={homeTeam} awayTeam={awayTeam} />;
```

This renders a publishable cumulative xG step chart with:

- ascending layout by default
- team-coloured cumulative lines
- shot markers and halftime/full-time guides
- optional score-strip support
- shared chart-frame methodology-note support in the live React path

### Current public surface

`XGTimelineProps` combines the compute input with live renderer seams:

- base data/layout inputs from `ComputeXGTimelineInput`
  - `shots`
  - `homeTeam`
  - `awayTeam`
  - `layout`
  - `showAreaFill`
  - `showScoreStrip`
  - `showShotDots`
  - `showCrosshair`
  - `teamColors`
- first-class style injection seams
  - `markers`
  - `lines`
  - `guides`
  - `areas`
- shared chart chrome
  - `methodologyNotes`

### Advanced customization points

- `layout` chooses between:
  - `"ascending"` for the neutral default shared upward read
  - `"mirrored"` for a stronger home/away split
- `showScoreStrip` adds the running scoreline strip above the plot
- `showCrosshair` is a live interaction aid only; it is not part of the stable export contract
- `markers` styles shot markers:
  - `show`
  - `fill`
  - `stroke`
  - `strokeWidth`
  - `radius`
  - `opacity`
- `lines` styles cumulative step lines:
  - `show`
  - `stroke`
  - `strokeWidth`
  - `strokeDasharray`
  - `opacity`
- `guides` styles halftime/full-time/extra-time guides and labels:
  - `stroke`
  - `strokeWidth`
  - `strokeDasharray`
  - `opacity`
  - `labelColor`
- `areas` styles the fill layer:
  - `show`
  - `fill`
  - `opacity`

### Export / static posture

- `XGTimeline` is part of the stable `ExportFrameSpec` chart union
- the export-safe subset is narrower than the live React surface:
  - constant-only `markers`
  - constant-only `lines`
  - constant-only `guides`
  - constant-only `areas`
  - no `showCrosshair`
  - no `methodologyNotes`
- callback and object-map styling remain valid in-process React usage, but are not the stable serialized export contract

### Filtering

Filtering is upstream of the chart for v0.3 alpha:

- consumers pass the already-selected shot array
- future canonical filter dimensions come from normalized shot fields such as `teamId`, `outcome`, and context/body-part metadata
- built-in shared filtering is outside this packet

### Explicit non-goals

- chart-local filter props such as `showOnlyGoals`
- arbitrary event overlays unrelated to shot flow
- smoothing or non-step interpolation
- multi-match aggregation in the base component
- implying that live callback styling is automatically export-safe

## Required normalized data

`XGTimeline` expects canonical Campos shot events. Provider parsing belongs in adapters or consumer code upstream.

| Field       | Required | Why it matters                   | Fallback if missing                    |
| ----------- | -------- | -------------------------------- | -------------------------------------- |
| `minute`    | yes      | time ordering                    | shot excluded                          |
| `teamId`    | yes      | home/away grouping               | shot excluded                          |
| `xg`        | yes      | cumulative value                 | shot excluded                          |
| `outcome`   | no       | goal markers / score strip       | treated as non-goal                    |
| `player`    | no       | tooltip row                      | generic fallback                       |
| `addedTime` | no       | stoppage-time placement          | minute used as linear match time       |
| `period`    | no       | halftime / extra-time guide math | regular-time assumptions stay explicit |

Also state:

- provider support now:
  - adapters or fixtures with normalized shot locations/outcomes/xG, primarily Opta- and StatsBomb-shaped feeds
- partial / unsupported:
  - providers without xG are outside this chart contract
- acceptable lossy mappings:
  - linear stoppage-time flattening is acceptable if the chart remains explicit about the match-time read

## Default visual contract

### Layout

- wide cartesian chart with cumulative step lines as the primary read
- halftime/full-time guides on by default
- optional score strip sits above the plot and remains secondary to the step geometry
- mirrored layout is valid, but not the default

### Encodings

- x position encodes match time
- y position encodes cumulative xG
- line geometry is always stepped
- markers encode shot events without replacing the cumulative line read
- shared methodology notes belong in the chart frame, not hand-built prose around the card

### Interaction / accessibility behavior

- live markers remain keyboard-focusable
- hover/focus supports tooltip and crosshair behavior in the live component
- the base chart still tells the story without hover because the line/marker geometry remains visible

### Empty / fallback behavior

- no plottable shots:
  - honest empty-state copy, no invented line
- one-team-only shots:
  - dominant team line plus honest flat opponent baseline
- sparse timelines:
  - still valid, with the cumulative step read preserved

### Fallback / degraded behavior

- dense matches should preserve the cumulative read before annotation density
- long or multilingual labels stay in tooltip/chart-frame note seams, not as persistent plot clutter
- static/export mode must degrade to the bounded constant-only contract

## Internal primitives required

| Primitive / seam     | Status   | Notes                                                               |
| -------------------- | -------- | ------------------------------------------------------------------- |
| `computeXGTimeline`  | existing | owns cumulative steps, guides, totals, and score-strip segmentation |
| shared `ChartFrame`  | existing | owns methodology-note regions and chart chrome                      |
| shared cartesian UI  | existing | guides, labels, tooltip, and marker interaction layers              |
| export frame helpers | existing | bounded export-only prop contract with constant-style guards        |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                                      | Why relevant                 | What it covers                            | What Campos should keep                               | What Campos should change                                                                                 |
| -------------------------------------------------- | ---------------------------- | ----------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/Volumes/WQ/ref_code/mplsoccer` timeline examples | match-flow chart grammar     | cumulative shot-story conventions         | direct football time-flow read and team split options | diverge with explicit export-safe subset, shared methodology-note seam, and accessible interaction        |
| `/Volumes/WQ/ref_code/d3-soccer`                   | SVG/cartesian implementation | thin-line chart grammar and match-time UI | clean step/guideline read                             | keep Campos-specific chart frame and review-grade contract honesty instead of generic example-driven APIs |

## Edge-case matrix

- empty data:
  - honest empty-state copy
- sparse data:
  - valid minimal timeline
- one-team-dominant match:
  - flat opponent baseline, no invented events
- unrecognised teamId:
  - shots whose `teamId` matches neither `homeTeam` nor `awayTeam` are dropped with a warning naming the unrecognised IDs. This is a common adapter misconfiguration (e.g. mismatched team ID casing) and must surface as a visible diagnostic rather than silently producing two flat zero-xG lines
- annotation tiers:
  - the compute layer uses a three-tier annotation policy: Tier 1 shows goals (always labelled), Tier 2 shows non-goal shots above a threshold (`TIER_2_XG_THRESHOLD = 0.3`) with a per-window cap (`TIER_2_MAX_PER_WINDOW = 3` per 15-minute window), Tier 3 is tooltip-only. These thresholds are internal constants at `compute/xg-timeline.ts` — not user-configurable, but documented here as the behavioral contract
- end-label spacing:
  - end labels maintain a minimum gap of 12 px (`END_LABEL_MIN_GAP`) to avoid overlap. Labels stack away from collisions rather than rendering on top of each other
- extra time:
  - deterministic guide/scale handling; axis extends to match minute; ET FT guide placed at 120
- long / multilingual text:
  - handled via tooltips and chart-frame notes
- touch/mobile interaction:
  - markers remain focusable/usable without hover-only meaning; on narrow viewports the line read and time guides should survive before score-strip and annotation density do
- export/static:
  - bounded constant-only style surfaces; no crosshair or methodology notes

## Demo requirements

- required page path:
  - `apps/site/src/pages/xgtimeline.astro`
- minimum story coverage:
  - hero/default
  - empty
  - sparse
  - mirrored
  - one-team dominant
  - extra time
  - score strip
  - dark theme
  - static export
  - methodology notes
  - responsive pressure

## Test requirements

- React tests:
  - zero-config shell
  - empty state
  - mirrored layout behavior
  - score-strip behavior
  - keyboard/focus access
  - constant, object-map, and callback style injection
  - methodology-note support
- export tests:
  - stable contract excludes `showCrosshair` and `methodologyNotes`
  - constant-only style surfaces remain accepted
- site verification:
  - page builds cleanly
  - desktop/mobile visual verification remain publishable
  - no console or hydration noise on `/xgtimeline`

## Review plan

- loop 1:
  - keep the active spec aligned with the current React-first surface and bounded export-safe subset
- loop 2:
  - verify page stories cover current match-flow and chart-frame seams honestly
- loop 3:
  - rerun tests, site build, and browser verification against current standards

## Open questions

- whether a later cartesian consistency pass should unify page-level language for methodology notes and wide-chart responsiveness across `XGTimeline`, `ScatterPlot`, `BumpChart`, and `CometChart`
