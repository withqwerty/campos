# @withqwerty/campos-react

React chart components for football visualizations.

`@withqwerty/campos-react` is the main runtime package in Campos. Install this
package first if you want ready-made chart components for apps, docs pages, and
reports.

Docs and examples live at `https://campos.withqwerty.com`.

## Install

```bash
npm install @withqwerty/campos-react react react-dom
```

If your data still needs provider normalization, also install
`@withqwerty/campos-adapters`.

For the first alpha, prefer `npm install` over `pnpm add` for published Campos
packages. npm resolves the live scoped publish metadata correctly, while npm's
abbreviated metadata endpoint can still return temporary `404` responses to
other package managers immediately after publish.

## Quick start

```tsx
import { ShotMap } from "@withqwerty/campos-react";
import { fromStatsBomb } from "@withqwerty/campos-adapters";

const shots = fromStatsBomb.shots(events, matchInfo);

export function Example() {
  return <ShotMap shots={shots} />;
}
```

Zero-config defaults are the main product goal. Start with the smallest
possible chart call, then add styling or annotation props only when you need
them.

## Current surface

- task-shaped React chart components such as `ShotMap`, `PassMap`,
  `PassNetwork`, `ScatterPlot`, `Heatmap`, `RadarChart`, and `Formation`
- shared chart-adjacent primitives exported from the main package barrel
- static-export helpers such as `createExportFrameSpec` and `ExportFrame`
- transitional compute/model helpers such as `computeShotMap`,
  `aggregatePassNetwork`, `createLinearScale`, and `niceTicks`

Use companion packages when you need:

- `@withqwerty/campos-adapters` for provider normalization
- `@withqwerty/campos-schema` for canonical football types
- `@withqwerty/campos-stadia` for low-level pitch and goal primitives
- `@withqwerty/campos-static` for server-side SVG/PNG export

Chart/model helpers currently live inside this package rather than in a
separate consumer-facing core package. During alpha they remain publicly
importable from the main barrel as a transitional advanced-use surface. The old
`@withqwerty/campos-core` package name is retired.

## Notes

- Keep public props task-shaped.
- Avoid leaking raw provider assumptions into the renderer.
- Keep the public package story centered on `@withqwerty/campos-react` plus
  companion packages.
