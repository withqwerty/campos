# Coordinate Standardisation

**Status:** active decision
**Last updated:** 2026-04-09 — note added 2026-04-15

> **Note:** This decision was written alongside early adapter development. The coordinate model (provider space → canonical Campos space → renderer projection) is still correct and still implemented in `@withqwerty/campos-adapters`. Core still assumes canonical Campos space on input.

## Decision summary

Campos should separate coordinate handling into three layers:

1. **Provider space**
   Raw provider-specific coordinate systems such as StatsBomb, Opta, Wyscout, Tracab, or custom tracking feeds.
2. **Canonical Campos space**
   One shared football visualization space that all event components consume by default.
3. **Renderer projection**
   The final mapping from canonical Campos space into SVG, Canvas, or other render targets.

The recommended default is:

- adapters parse raw provider space and attach source-space metadata
- a shared standardizer converts provider coordinates into **one canonical Campos standardized pitch space**
- components and renderers assume canonical Campos space only

This means coordinate standardization is primarily an **adapters + shared transform** concern, not a component concern.

## Why this exists

Two distinct problems are easy to conflate:

- **provider parsing**
  StatsBomb, Opta, Wyscout, Tracab, Metricasports, SkillCorner, and others all differ in origin, axis direction, units, and pitch extents
- **football-space standardization**
  even after provider parsing, naively rescaling one pitch definition into another can squeeze or expand regions incorrectly relative to football markings

The mplsoccer references make both points clearly:

- the pitch types page shows that providers use materially different coordinate systems
- the standardizer explanation shows that simple global scaling can distort football-space semantics across pitch definitions

References:

- [Pitch Types — mplsoccer](https://mplsoccer.readthedocs.io/en/latest/gallery/pitch_setup/plot_pitch_types.html)
- [Explain the Standardizer — mplsoccer](https://mplsoccer.readthedocs.io/en/latest/gallery/pitch_setup/plot_explain_standardizer.html)
- [/Volumes/WQ/ref_code/football_viz/pitch_setup/NOTES.md](/Volumes/WQ/ref_code/football_viz/pitch_setup/NOTES.md)

## The problem

Campos currently normalizes provider coordinates into `0..100` on both axes with simple linear scaling, while `@withqwerty/campos-stadia` draws pitch markings from a real-world `105 x 68m` pitch definition.

That is underspecified.

It does not answer:

- whether Campos `0..100` is meant to preserve football markings or physical meters
- whether two providers mapped to `0..100` are truly comparable
- whether components may assume pitch markings and event locations are already aligned

Concrete example:

- StatsBomb uses a `120 x 80` standardized pitch with inverted `y`
- Opta uses `0..100 x 0..100`
- Wyscout also uses `0..100 x 0..100` but with inverted `y`
- Tracab and similar tracking providers use centered metric spaces

These are not the same problem with different constants. They are different coordinate spaces.

## Provider space is not canonical space

Provider space should be treated as explicit input metadata, not silently collapsed into Campos semantics.

Representative provider families:

| Provider family  | Typical extents         | Origin / direction notes             | Space type   |
| ---------------- | ----------------------- | ------------------------------------ | ------------ |
| StatsBomb        | `0..120`, `80..0`       | inverted `y`                         | standardized |
| Opta / WhoScored | `0..100`, `0..100`      | square-ish event grid                | standardized |
| Wyscout          | `0..100`, `0..100`      | inverted `y`                         | standardized |
| Metricasports    | `0..1`, `1..0`          | normalized, inverted `y`             | standardized |
| Tracab           | centered metric extents | usually centimeters, centered origin | metric       |
| SkillCorner      | centered metric extents | meters, centered origin              | metric       |
| Second Spectrum  | centered metric extents | meters, centered origin              | metric       |

Adapter code should parse these differences. Components should not know or care about them.

## Canonical Campos space

Campos should adopt one default canonical space for visualization components:

```ts
type CamposCanonicalSpace = {
  kind: "campos-standardized";
  xRange: [0, 100];
  yRange: [0, 100];
  origin: "bottom-left";
  attackDirection: "increasing-x";
  pitchDefinition: "standardized";
  units: "canonical";
};
```

Interpretation:

- `x = 0` is the defensive goal line
- `x = 100` is the attacking goal line
- `y = 0` is the left touchline in Campos football space
- `y = 100` is the right touchline
- components read these as **football-space coordinates**, not provider-native units and not physical meters

This canonical space should be designed for:

- `ShotMap`
- `PassMap`
- `Heatmap`
- `PassNetwork`
- other event-location visualizations

It is **not** a promise that distances in Campos units are true metric distances.

## Recommended default

Campos should default to **standardized football space**, not metric football space.

Reasoning:

- football visualizations care first about event-to-marking alignment and cross-provider consistency
- true pitch dimensions are often unavailable in event data
- components need one stable, chart-friendly coordinate contract
- metric truth can be added later as a secondary mode for distance-heavy analysis

So the default should be:

- standardized canonical visualization space now
- metric mode deferred unless a concrete use case requires it and pitch dimensions are known

## Layer responsibilities

### Adapters

Adapters own:

- parsing provider-native origin, extents, units, and axis direction
- recording source coordinate metadata
- supplying any known pitch dimensions from the feed or match context

Adapters should not:

- decide renderer projection
- embed provider-specific coordinate logic in components
- hand-roll incompatible one-off standardizers per provider

### Shared standardizer

A shared transform layer should own:

- conversion from provider space into canonical Campos space
- warnings when a transform is lossy or dimension assumptions are missing
- a single implementation path for standardized football-space mapping

This should live in shared adapter/core infrastructure, not in React components.

### Core

Core should assume:

- incoming event coordinates are already in canonical Campos space
- chart logic never needs to branch on `provider === "statsbomb"` or similar

### Components and renderers

Components should assume:

- coordinates are already canonical
- `Pitch`, `ScatterPlot`, `Heatmap`, and similar render canonical Campos space only

Renderer projection is a separate problem:

- viewBox sizing
- full-pitch vs half-pitch crop
- horizontal vs vertical orientation
- screen-space transforms

That is not provider standardization.

## Proposed contract types

```ts
type ProviderCoordinateSpace =
  | {
      provider: "statsbomb";
      xRange: [0, 120];
      yRange: [0, 80];
      origin: "top-left";
      invertY: true;
      centered: false;
      units: "provider";
      pitchDefinition: "standardized";
    }
  | {
      provider: "opta";
      xRange: [0, 100];
      yRange: [0, 100];
      origin: "bottom-left";
      invertY: false;
      centered: false;
      units: "provider";
      pitchDefinition: "standardized";
    }
  | {
      provider: "tracab";
      xRange: [number, number];
      yRange: [number, number];
      origin: "center";
      invertY: false;
      centered: true;
      units: "centimeters";
      pitchDefinition: "metric";
      pitchLength: number;
      pitchWidth: number;
    };

type CamposCanonicalSpace = {
  kind: "campos-standardized";
  xRange: [0, 100];
  yRange: [0, 100];
  origin: "bottom-left";
  attackDirection: "increasing-x";
  pitchDefinition: "standardized";
  units: "canonical";
};
```

Shared transform sketch:

```ts
type StandardizeCoordinatesInput = {
  x: number | null;
  y: number | null;
  from: ProviderCoordinateSpace;
  to: CamposCanonicalSpace;
};

type StandardizeCoordinatesResult = {
  x: number | null;
  y: number | null;
  warnings?: string[];
};
```

This is illustrative. The exact type locations belong in implementation.

## Component assumptions

Event-location components should assume:

- coordinates are already canonical Campos space
- pitch orientation is resolved at render time, not adapter time
- cross-provider overlays become possible only because provider-native differences were removed earlier in the pipeline

Bad pattern:

```ts
computeShotMap(shots, { provider: "statsbomb" });
```

Preferred pattern:

```ts
const shots = fromStatsBomb.shots(rawEvents, matchContext);
const model = computeShotMap({ shots });
```

## Non-goals

This decision does **not** yet define:

- the exact region-aware math for every provider pair
- a public metric-space API
- distance-computation guarantees in canonical Campos units
- tracking-specific high-frequency transforms for Voronoi or speed models

Those should follow after the canonical contract is accepted.

## Current gap

Today the codebase still has places where:

- adapters linearly rescale provider space into `0..100`
- `@withqwerty/campos-stadia` assumes a metric pitch model
- the exact meaning of Campos `0..100` is not formally specified

That gap should be treated as architectural debt, not as the long-term contract.

## Recommended next steps

1. Align `docs/adapters-contract.md` and `docs/core-output-contract.md` to this split.
2. Introduce coordinate-space types shared by adapters and the standardizer.
3. Implement a shared `standardizeCoordinates(...)` path.
4. Migrate StatsBomb, Opta, and Wyscout adapters to it first.
5. Add boundary and cross-provider equivalence tests around penalty area, six-yard box, and goal-center positions.

## References

- [Pitch Types — mplsoccer](https://mplsoccer.readthedocs.io/en/latest/gallery/pitch_setup/plot_pitch_types.html)
- [Explain the Standardizer — mplsoccer](https://mplsoccer.readthedocs.io/en/latest/gallery/pitch_setup/plot_explain_standardizer.html)
- [/Volumes/WQ/ref_code/football_viz/pitch_setup/NOTES.md](/Volumes/WQ/ref_code/football_viz/pitch_setup/NOTES.md)
- FIFA Laws of the Game: pitch markings are fixed dimensions while overall pitch size varies within a range
