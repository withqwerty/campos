# Export Style Parity Spec

**Status:** active
**Owner:** campos team
**Target version:** Wave R1 close-out
**Depends on:** `docs/architecture-decision.md`, `docs/specs/static-export-composition-spec.md`, `docs/standards/source-meta-standard.md`

## Purpose

Wave R1 makes callback-first style injection the default React API. Static export still matters, but it does not support the entire interactive styling surface with equal guarantees.

This document is the source of truth for which style paths are:

- export-safe
- degraded / best-effort only
- unsupported

It also makes the `sourceMeta` boundary explicit: provenance stays in data, style intent stays in component props.

## Rule of thumb

There are three relevant environments:

1. **Interactive / SSR React rendering**
   - full style surface available
   - constants, object-map shorthands, and callbacks are all valid

2. **`ExportFrameSpec` as the stable export contract**
   - treat the spec as serializable
   - only constant style values are guaranteed safe

3. **In-process Node export execution**
   - some callback-driven props may appear to work because the spec is still a live JS object
   - this is not the stable contract and must be treated as best-effort, not guaranteed parity

## Chosen D1d strategy

Campos will harden the stable export contract with a **parallel export-only type layer plus runtime guards**.

That means:

- interactive chart props stay callback-friendly
- `ExportFrameSpec` gets dedicated export prop types rather than aliasing broad chart prop types
- export prop types admit only the constant-value subset of style props
- existing runtime guards remain as defense-in-depth for unsupported structural branches and plain-JS callers

Campos will **not** rely on documentation alone, and it will **not** try to infer export-safety purely from a generic deep mapped type over all chart props.

### Why this strategy

- It matches the documented rule that the stable export contract is serializable.
- It keeps the React runtime API flexible without dragging export restrictions back into chart components.
- It makes unsupported branches explicit per chart family instead of hiding them inside a generic utility type.
- It gives type-level feedback to TypeScript users while preserving runtime validation for non-TypeScript callers.

### Rough implementation cost estimate

**Cost:** medium, roughly 2-4 focused implementation days.

Expected touch points:

- `packages/react/src/export/types.ts`
- chart-specific export prop aliases for each currently supported chart kind
- export tests covering rejected callback/object-map paths
- docs/examples updated to use the narrowed export types honestly

The broadest part is not the helper type itself; it is writing and testing the per-chart export prop shapes without accidentally re-admitting unsupported branches.

## Export safety matrix

| Style path                           | Interactive / SSR React | `ExportFrameSpec` stable contract | Notes                                                                                     |
| ------------------------------------ | ----------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| Constant style values                | supported               | export-safe                       | Preferred export path for all migrated style families                                     |
| `StyleValueMap` object-map shorthand | supported               | unsupported                       | The `by` resolver is a function and is not serializable as a stable export spec           |
| Callback style functions             | supported               | unsupported                       | Best-effort only if a caller keeps everything in-process; not a supported export contract |
| Theme-driven defaults                | supported               | export-safe                       | Zero-config defaults are the baseline parity target                                       |
| `sourceMeta`-derived styling         | avoid                   | unsupported                       | Not a valid library contract in any environment                                           |

## Component-level status

### Export-safe in the stable contract

These components support export when their style props use constants only:

- `ShotMap`
  - `markers`
  - `trajectories`
- `PassMap`
  - `lines`
  - `dots`
- `PassNetwork`
  - `nodeStyle`
  - `edgeStyle`
- `ScatterPlot`
  - `markers`
  - `guideStyle`
  - `regionStyle`
  - `labelStyle`
- `XGTimeline`
  - `lines`
  - `areas`
  - `markers`
  - `guides`
- `BumpChart`
  - `lines`
  - `points`
  - `labels`
  - `guides`
- `Heatmap`
  - `cells`
- `Territory`
  - `cells`
  - `labels`
- `RadarChart`
  - `areas`
  - `guides`
  - `text`
- `PizzaChart`
  - `areas`
  - `guides`
  - `text`
  - `badges`
- `Formation`
  - `markers`
  - `markerLabels`

The current stable `ExportFrameSpec` chart union is the 11 chart kinds in
`packages/react/src/export/chart-kind.ts`:

- `bump-chart`
- `pizza-chart`
- `formation`
- `pass-network`
- `territory`
- `shot-map`
- `pass-map`
- `heatmap`
- `scatter-plot`
- `xg-timeline`
- `radar-chart`

### Degraded / best-effort only

These paths may work when export is executed in-process against a live object graph, but they are not part of the stable export contract:

- callback style functions on any of the style families above
- object-map shorthand styles that depend on a `by` resolver function

Do not document or promise these as stable export behavior. If reliable export is required, convert them to constants before building the frame spec.

### Unsupported

These paths are explicitly blocked or intentionally outside Phase 1 export:

- `Formation`
  - `markerComposition.slots`
  - `markerComposition.glyph` when it is a render function
  - photo / photo-cutout glyph export path
  - substitutes benches
  - `markerBadges` is rejected at runtime when present as a non-empty object — the entire badges surface is outside Phase 1, not just the `prefix` callback
- `CometChart`
  - the chart is not yet part of the stable `ExportFrameSpec` union
  - static SVG composition and export-only prop shape have not been hardened yet
- `KDE`
  - the chart itself is outside the current stable export contract
  - canvas-backed density-raster styling is interactive / SSR only for now
- `BumpChart`
  - `renderEndLabel`
  - `teamLogos`
- `PizzaChart`
  - `centerContent.kind === "image"`
  - `centerContent.kind === "crest"`
- `StatBadge`
  - the primitive is not part of the stable `ExportFrameSpec` chart-card surface
  - export support should be reconsidered only if a real card/frame use case appears

If export support for these paths becomes necessary later, it should land as a documented packet with explicit parity rules rather than as an accidental side effect.

## Practical guidance

### Good

```tsx
<PassMap passes={passes} lines={{ stroke: "#c8102e", strokeWidth: 0.7 }} />
```

```ts
createExportFrameSpec({
  chart: {
    kind: "formation",
    props: {
      formation: "4-3-3",
      markers: { fill: "#c8102e" },
      markerLabels: { background: "#111827", color: "#ffffff" },
    },
  },
});
```

### Degraded / not guaranteed

```tsx
<ShotMap
  shots={shots}
  trajectories={{
    stroke: ({ shot }) => (shot.xg != null && shot.xg > 0.4 ? "#d33" : "#2563eb"),
  }}
/>
```

### Bad

```ts
sourceMeta: {
  stroke: "#d33",
  dashArray: "4 3",
}
```

## Live `staticMode` injection

`createExportFrameSpec` no longer injects `staticMode: true` into `bump-chart` or `pizza-chart` props. The flag is now applied at render time by `ExportFrame.tsx` for the live React path and by the dedicated `BumpChartStaticSvg` / `PizzaChartStaticSvg` paths for the SSR/static path.

Implication: callers that build a spec with `createExportFrameSpec` and render it through `ExportFrame` or `renderStaticSvg` get the right behavior. Callers that bypass those entry points and render the chart components directly from a spec do not get `staticMode` for free and must set it themselves.

## SourceMeta boundary

`sourceMeta` is never the export-style channel.

- Good: provider provenance, debugging metadata, app-owned namespaced annotations
- Bad: final render tokens, chart presets, style buckets, marker shapes, dash arrays

See `docs/standards/source-meta-standard.md` for the normative rule.
