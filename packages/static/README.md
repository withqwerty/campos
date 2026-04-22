# @withqwerty/campos-static

Node-side static export for Campos charts.

Render chart specs to SVG strings or PNG buffers on the server, without a browser. Intended for OG images, match report PDFs, scheduled image generation jobs, and any workflow where you need a chart on disk or in a response body.

## Status

`@withqwerty/campos-static` is the Node-side export companion to
`@withqwerty/campos-react`.

The current stable export surface supports these chart kinds through
`ExportFrameSpec`:

- `BumpChart`
- `Formation`
- `Heatmap`
- `PassMap`
- `PassNetwork`
- `PassSonar`
- `PercentileBar`
- `PizzaChart`
- `RadarChart`
- `ScatterPlot`
- `ShotMap`
- `Territory`
- `XGTimeline`

Some interactive React-only seams remain intentionally outside the export
contract. For example:

- callback and mapped style values
- browser-only label/render callbacks
- unsupported chart families such as `CometChart` and `KDE`

## API

Two functions:

```ts
import {
  renderStaticSvg,
  renderStaticPng,
  type ExportFrameSpec,
} from "@withqwerty/campos-static";

// SVG string — no native dependencies
const svg: string = renderStaticSvg(spec);

// PNG buffer — requires sharp to be installed
const png: Buffer = await renderStaticPng(spec);
```

`ExportFrameSpec` is produced by helpers in `@withqwerty/campos-react`
(`createExportFrameSpec`, `ExportFrame`). See the
[static export spec](https://github.com/withqwerty/campos/blob/main/docs/specs/static-export-composition-spec.md)
for the composition contract.

## Optional sharp dependency

`renderStaticPng` requires [`sharp`](https://sharp.pixelplumbing.com/) to be installed. It is declared as an optional peer dependency — if you only need `renderStaticSvg`, you do not need sharp. If you call `renderStaticPng` without sharp installed, you will get a clear error directing you to install it.

```bash
# SVG only
pnpm add @withqwerty/campos-static

# SVG + PNG
pnpm add @withqwerty/campos-static sharp
```

See `https://campos.withqwerty.com` for docs and examples, and the main
[Campos](https://github.com/withqwerty/campos) repository for source and issue
tracking.
