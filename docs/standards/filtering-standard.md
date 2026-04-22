# Filtering Standard

**Status:** active
**Scope:** ownership and behavior of filterable semantics across core and React components
**Purpose:** standardize how Campos components expose filterable semantics without turning filtering into ad hoc chart-local props

## Why this exists

Campos needs a consistent answer to:

- where filterable categories come from
- who decides what filter UI exists
- whether legend clicks and external toggles are the same state
- how single-select and multi-select behavior work
- how filtering stays coherent across a React-first component library

This document defines that boundary.

For the future shared core input/output shape, see [filtering-model-contract.md](https://github.com/withqwerty/campos/blob/main/docs/filtering-model-contract.md).

## Core distinction

Campos uses the word "filtering" for three different concerns that must stay separate:

1. **Product projection**
   Raw provider data is reduced to a canonical event or chart input set.
   Example: adapter `shots()` drops own goals, penalty shootout events, and events without coordinates.
2. **Chart view rules**
   The chart computes a specific visual slice or framing rule from already-normalized data.
   Example: `PassMap` half-pitch crop keeps attacking-half passes in the plotted view.
3. **Interactive end-user filtering**
   The end user changes which marks are visible through legend clicks, toggle groups, chips, or other controls.
   Example: show only goals, show headers plus foot shots, or show only big chances.

Only the third concern is the shared filtering system.

## Layer ownership

### Adapters

Adapters own:

- normalization of canonical filterable fields such as `outcome`, `bodyPart`, `context`, `passResult`, and `passType`
- provider-specific derivation when a football concept must become canonical
- collapsing raw provider taxonomies into stable Campos enums or booleans

Adapters do **not** own:

- legend models
- UI-facing filter groups
- selection state
- chart-local visibility logic

If a concept matters across providers and users will reasonably filter on it, it should become a canonical field in schema/adapters rather than a renderer-only convention.

### Core

Core owns:

- which filter dimensions are semantically available for a given chart
- how raw normalized values collapse into user-facing options
- labels for those options
- counts based on the currently plotted dataset
- the relationship between legend semantics and filter semantics
- recomputing chart summaries, legends, and empty states from the filtered subset

Core does **not** own:

- browser event wiring
- toggle UI components
- whether selection is controlled or uncontrolled in React

### Renderer / app layer

Renderers and host apps own:

- how filter controls are presented
- whether controls are legend clicks, checkboxes, radio buttons, chips, or menus
- current selection state
- syncing external controls and legend interactions to the same filter state

Legend-click filtering and a dedicated filter panel should be two views over the same underlying state, not separate systems.

## Public API rule

Do not add chart-specific public props like:

- `filterGoals`
- `filterBodyPart`
- `filterPassType`
- `showOnlyBigChances`

Do not make an opaque predicate function the primary filtering API.

Opaque predicates are hard to serialize, hard to mirror in legends and counts, and weak for headless-core contracts.

If Campos later exposes built-in filtering, it should be through structured dimensions and selected option keys, not one-off booleans or arbitrary predicates.

## Shared filter semantics

The shared filtering model should follow these rules:

- filters operate on **dimensions**
- each dimension exposes **options**
- selection mode is either `single` or `multiple`
- within one dimension, multiple selected options behave as **OR**
- across dimensions, active dimensions combine as **AND**

That means:

- `outcome = ["goal"]` shows goals only
- `bodyPart = ["foot", "head"]` shows either foot shots or headers
- `bodyPart = ["foot"]` and `bigChance = ["true"]` shows only foot shots that are big chances

## Inference vs configuration

Campos should infer some things from the data, but not everything.

Core may infer:

- which dimensions are available for this chart
- which options are present in the current dataset
- user-facing labels
- counts per option
- whether a legend group is informative enough to show

The consumer decides:

- whether filtering is enabled at all
- which inferred dimensions are exposed to end users
- whether a dimension is single-select or multi-select
- whether the UI is shown as legend interaction, explicit controls, or both

## Legend relationship

Legend semantics and filter semantics should align when the legend corresponds to a filterable encoding.

That means:

- clicking a legend item should map to the same option key used by any external filter controls
- a legend should never invent a second taxonomy that filtering cannot understand
- if a legend item is not a stable semantic option, it should not pretend to be a filter control

Not every legend is necessarily filterable, but every filterable legend item must map to a stable semantic option key.

## Chart guidance

Typical filter dimensions by chart:

- `ShotMap`: raw dimensions such as `outcome`, `bodyPart`, `context`, plus chart-level collapsed dimensions such as `goalState` and `bodyPartFamily` when those are what the legend actually exposes
- `PassMap`: `passResult`, `passType`, future canonical booleans such as `isAssist`
- `ScatterPlot`: categorical grouping dimensions already present in the configured dataset, especially active color or label categories

Some chart options are **not** interactive filters:

- `crop`
- `orientation`
- axis-domain overrides
- metric selection

Those are chart configuration or view rules, not end-user filtering dimensions.

## v0.2 guidance

Built-in shared filtering is deferred.

In v0.2:

- consumers pre-filter the input array before passing it to the chart
- specs should still name the canonical future filter dimensions for the chart
- specs should not introduce chart-local filter props in the meantime

## Spec requirement

When a component can reasonably participate in shared filtering, its spec should say:

- which canonical fields make it filterable
- which chart options are view rules rather than filters
- that built-in filter UI is not zero-config default chrome
- that any future built-in filtering follows this standard
