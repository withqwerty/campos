# @withqwerty/campos-react

## 0.1.0-alpha.3

### Patch Changes

- c84e1b1: chore: switch publishing to npm trusted publishers (OIDC) with provenance attestations
- Updated dependencies [c84e1b1]
  - @withqwerty/campos-schema@0.1.0-alpha.3
  - @withqwerty/campos-stadia@0.1.0-alpha.3

## 0.1.0-alpha.2

### Minor Changes

- 267dd72: Three user-visible improvements to the React charts:
  - **Keyboard activation on interactive markers.** `PassMap`, `ShotMap`,
    `DistributionChart`, `DistributionComparison`, and `PassNetwork` markers
    (which already have `role="button"`) now also respond to Enter and Space
    when focused, not just to mouse click. Shared via a new
    `triggerButtonActionOnKeyDown` helper.
  - **Sibling charts no longer collide on SVG ids in static SSR.**
    `PizzaChartStaticSvg`, `RadarChartStaticSvg`, and the static-export scale
    legend previously minted `id` attributes from hardcoded strings or
    coordinate arithmetic, which meant rendering the same chart twice on a
    page broke the second chart's label paths, clip paths, and gradient
    fills. All three now use `useId()` for stable, unique ids.
  - **KDE density surface now renders in server-side output.** `<KDE>`
    previously deferred the density-to-image conversion to a browser-only
    `canvas` path inside `useEffect`, so SSR and static-export snapshots
    produced KDE charts missing their heat layer. A new pure-JS PNG encoder
    in `kdeRaster.ts` (no Node APIs, no new deps) runs without a `document`
    and produces byte-identical output to the canvas path, letting the
    density surface ship with the initial SSR markup.

### Patch Changes

- @withqwerty/campos-schema@0.1.0-alpha.2
- @withqwerty/campos-stadia@0.1.0-alpha.2
