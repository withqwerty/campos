# @withqwerty/campos-react

## 0.1.0-beta.4

### Minor Changes

- 256bb33: Pitch presets, single-install type surface, and publishable defaults.

  **New: `pitchPreset` prop on every chart.** `<ShotMap pitchPreset="outline" />` (or `"green"` / `"dark"`) replaces the need to combine `pitchTheme` + `pitchColors`. The default is `"outline"` (white pitch with dark lines), tuned for editorial / docs surfaces. Existing `pitchTheme` / `pitchColors` props still work and override the preset when set.

  **New: schema types re-exported from `@withqwerty/campos-react`.** `import { ShotMap, type Shot } from "@withqwerty/campos-react"` now works in a single install — `@withqwerty/campos-schema` only needs a direct dep when using the schema without React (e.g. a Node data pipeline).

  **New exports from `@withqwerty/campos-stadia`:** `PitchPreset`, `DEFAULT_PITCH_PRESET`, `resolvePitchPreset`. Re-exported from `@withqwerty/campos-react` for one-stop access.

  **Visual change: theme palettes brought in line with the publishable presets.** `theme="primary"` is now `#2d8a4e` (was `#1a472a`) and `theme="secondary"` is `#1e293b` / `#f8fafc` (was `#12141a` / `#2a2e38`). Charts using only `theme=` will look polished by default; consumers pinning the previous greens/blacks should set explicit `pitchColors`.

  **Fixes:**
  - `Territory` no longer assumes a dark pitch when picking auto line colors — it now reads the resolved fill luminance, so the white outline default produces dark lines instead of invisible white-on-white.
  - `PassNetwork` no longer emits a "Merged duplicate/reversed edge pair" warning for every reversed pair in undirected mode (expected behaviour). It now only warns on literal duplicates (same `sourceId → targetId` twice).
  - Static SVG legend (`circle-range` / `line-range` blocks) widened so `Fewer passes` / `More passes` labels no longer overlap the arrow.

### Patch Changes

- Updated dependencies [256bb33]
  - @withqwerty/campos-stadia@0.1.0-beta.4
  - @withqwerty/campos-schema@0.1.0-beta.4

## 0.1.0-beta.3

### Minor Changes

- 4f336f5: First beta release. Public preview — APIs may still shift before 1.0, but breaking changes will be called out in CHANGELOGs.

### Patch Changes

- 7da83fb: chore: switch publishing to npm trusted publishers (OIDC) with provenance attestations
- Updated dependencies [4f336f5]
- Updated dependencies [7da83fb]
  - @withqwerty/campos-schema@0.1.0-beta.3
  - @withqwerty/campos-stadia@0.1.0-beta.3

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
