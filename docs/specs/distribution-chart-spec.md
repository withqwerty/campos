# Distribution Chart Spec

**Status:** active
**Last updated:** 2026-04-16

## Header

- Component / primitive: `DistributionChart` with companion `DistributionComparison`
- Status: active spec
- Owner: Campos team
- Target version: v0.3 alpha follow-on
- Depends on:
  - `@withqwerty/campos-react` compute layer
  - `@withqwerty/campos-react` cartesian chart primitives
  - shared style-value callback seams in `@withqwerty/campos-react`

## Purpose

- What user task this solves:
  - compare the shape of one or more one-dimensional football metric distributions
  - show where a team, player group, or profile sits inside those distributions
- Why it belongs in Campos:
  - football analysis repeatedly needs non-pitch distribution views for scalar metrics such as shots per match, non-penalty xG, xG per shot, keeper shot-stopping deltas, league-rank distributions, and similar rate or count measures
- Why it should be public:
  - bandwidth defaults, sparse-sample honesty, marker semantics, and comparison-row layout are chart-level product behavior rather than app-local glue

## Domain framing

### Football concept

`DistributionChart` is a univariate metric-shape chart. It shows how a scalar football metric is distributed within one or more samples.

It is not:

- a histogram-only primitive
- a percentile bar
- a time series
- a pitch or event-location chart

`DistributionComparison` is the stacked companion for repeated row-wise comparisons across several metrics.

### Bounded-context ownership

- `schema` owns football entities and normalized event/shot types upstream
- `adapters` may prepare the raw source packets upstream, but these charts consume already-shaped numeric arrays
- `react` owns:
  - density estimation defaults
  - per-series marker behavior
  - row stacking and comparison layout
  - tooltip and warning behavior
- primitives own chart chrome only, not the statistical semantics

### Canonical input model

The public chart consumes arrays of numbers grouped into named series:

- `DistributionChart` expects `series: { id, label, values[] }[]`
- `DistributionComparison` expects `rows: { id, label, series[] }[]`

Provider parsing and metric derivation are upstream responsibilities.

### Invariants

- density curves are derived only from finite numeric values
- invalid values are excluded honestly with warnings
- the chart defaults compare shape, not raw observation count
- sparse samples warn rather than pretending smooth certainty
- row-wise stacked comparison defaults to independent row y-scales unless explicitly changed

## Public API

### Proposed public exports

- `DistributionChart`
- `DistributionComparison`
- `computeDistributionChart`
- `computeDistributionComparison`

### Zero-config happy path

```tsx
import { DistributionChart } from "@withqwerty/campos-react";

<DistributionChart
  series={[
    { id: "liv", label: "Liverpool", values: liverpoolShotsPerMatch },
    { id: "mci", label: "Manchester City", values: cityShotsPerMatch },
  ]}
  xLabel="Shots per match"
/>;
```

Companion stacked usage:

```tsx
import { DistributionComparison } from "@withqwerty/campos-react";

<DistributionComparison
  rows={[
    {
      id: "npxg",
      label: "Non-penalty xG",
      series: [
        { id: "liv", label: "Liverpool", values: livNpxg },
        { id: "mci", label: "Manchester City", values: cityNpxg },
      ],
    },
  ]}
/>;
```

### Advanced customization points

- `bandwidth`
  - `"scott"`
  - `"silverman"`
  - numeric bandwidth
- `bandwidthAdjust`
- `domain`
- `samplePoints`
- `defaultMarker`
  - `"none"`
  - `"median"`
  - `"mean"`
- first-class style seams
  - `areas`
  - `lines`
  - `markers`
  - `labels` (`DistributionComparison` row labels only)
- `valueFormatter`
- `rowScale`
  - `"independent"`
  - `"shared"`

### Filtering

Filtering stays upstream:

- the chart does not own end-user filtering
- consumers pass already-selected samples
- view rules such as bandwidth, domain, and marker mode are not filter dimensions

### Explicit non-goals

- histogram bin controls in the initial public packet
- violin or ridgeline-only API forks
- stable `ExportFrameSpec` support in this first packet
- inferring football semantics from raw provider blobs inside the chart

## Required normalized data

No new adapter contract is required. The minimum input is already-shaped numeric arrays.

| Field    | Required | Why                         | Fallback if missing        |
| -------- | -------- | --------------------------- | -------------------------- |
| `id`     | yes      | stable series identity      | chart should fail loudly   |
| `label`  | yes      | legend / accessibility text | falls back to `id` if safe |
| `values` | yes      | density estimation input    | series is excluded         |

Also state:

- provider support now:
  - any source that can be shaped into numeric arrays upstream
- partial / unsupported:
  - none at the adapter layer; the component is adapter-agnostic
- acceptable lossy mappings:
  - excluding null / non-finite values with explicit warnings

## Default visual contract

### Layout

- `DistributionChart`
  - one cartesian plot
  - x-axis visible
  - y-axis visible and labeled `Density`
  - categorical legend below the chart when multiple series are visible
- `DistributionComparison`
  - stacked rows
  - left row labels
  - x-axis ticks per row
  - one shared legend for repeated series labels

### Encodings

- filled area = distribution shape
- line = series silhouette
- marker = reference statistic (`median` / `mean`) or explicit series marker value

### Tooltip behavior

- hover over the plot reports x-value plus sampled density per visible series
- markers are keyboard-focusable and reveal their stat/value

### Empty state

- no valid data:
  - plot shell stays visible
  - honest empty-state copy
  - no fake density paths

### Fallback mode

- sparse series:
  - chart still renders
  - warnings explain that smoothing may not be meaningful
- degenerate domain:
  - pad the x-domain rather than collapsing to a line

## Internal primitives required

| Primitive / seam                 | Status   | Notes                                                    |
| -------------------------------- | -------- | -------------------------------------------------------- |
| cartesian chart frame            | existing | `ChartFrame`, `ChartCartesianAxes`, `ChartTooltip`       |
| univariate density path renderer | new      | shared SVG layer used by both public components          |
| numeric axis helpers             | existing | shared axis and scale utilities in `src/compute/scales/` |
| warning chrome                   | existing | chart-frame warnings below the plot                      |

## Reference code consulted

Start with `/Volumes/WQ/ref_code/INDEX.md`.

| Repo / source                                                                  | Why relevant                                        | What it covers                                           | What Campos should keep                             | What Campos should change                                                           |
| ------------------------------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `/Volumes/WQ/ref_code/football_viz/kde/univariate-kde-liv-mci-kde-1d.png`      | direct visual target for basic overlay usage        | overlaid 1D KDEs with simple stat markers                | clear shape comparison and restrained styling       | expose honest sparse-sample warnings, keyboard focus, and React-first customization |
| `/Volumes/WQ/ref_code/football_viz/radar/cannonstats-comparison-kde-radar.jpg` | direct visual target for stacked comparison grammar | repeated row-wise metric distributions with markers      | row-wise comparison grammar and metric-label column | keep it as a cartesian chart family, not a radar-specific one-off                   |
| `/Volumes/WQ/ref_code/football_viz/research/heatmap_research.md`               | KDE policy guidance                                 | Scott vs Silverman, multimodality warning, low-N caution | explicit bandwidth rule choice and low-N caution    | adapt the guidance to 1D scalar metrics instead of pitch-space surfaces             |

## Edge-case matrix

- empty data:
  - show empty shell with honest copy
- one mark / one row:
  - single-row comparison still reads as a chart, not a broken layout
- dense overlap:
  - overlapping series stay legible through line + area contrast
- all-null encoded field:
  - series excluded with warning
- mixed-null encoded field:
  - valid numbers retained, invalid values excluded with warning
- degenerate legend or scale domain:
  - single-value samples widen the domain safely
- weird values:
  - negative or large values are allowed; only non-finite values are excluded
- mobile/touch:
  - hover target remains full-width; legend and row labels do not collapse into unreadable clutter
- long text / multilingual text:
  - legend items and row labels should remain intact without clipping

## Demo requirements

- required page path:
  - `apps/site/src/pages/distributionchart.astro`
- minimum story coverage:
  - overlaid two-series hero
  - stacked comparison row set
  - marker-mode variant
  - sparse-data warning
  - empty state
  - multilingual / long-label stress
  - dark-theme story
  - explicit export-deferred note

## Test requirements

- core tests:
  - empty
  - degenerate domains
  - sparse warnings
  - mixed invalid values
  - explicit marker values
  - row-scale behavior in comparison mode
- React tests:
  - shell labeling
  - tooltip behavior
  - legend rendering
  - row labels and marker focus
- accessibility checks:
  - figure labels
  - focusable markers

## Review plan

- loop 1:
  - challenge bandwidth defaults, sparse-data honesty, and whether the comparison chart is truly a separate component
- loop 2:
  - challenge row layout, marker semantics, and tooltip readability
- loop 3:
  - challenge docs/demo honesty and export posture

## Open questions

- whether a later generic grid/facet wrapper should absorb parts of `DistributionComparison` layout behavior
- whether histogram / rug overlays deserve first-class support later
- whether static export should be promoted once the component has real consumer usage
