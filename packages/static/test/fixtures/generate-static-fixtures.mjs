import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createExportFrameSpec } from "../../../react/dist/index.js";
import { renderStaticSvg } from "../../dist/index.js";
import {
  buildEmptyStateSpec,
  buildGoldenSpecs,
  buildLongTextSpec,
  buildThemeSpecs,
} from "./export-fixtures.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgDir = path.join(__dirname, "svg");

fs.mkdirSync(svgDir, { recursive: true });

for (const fixture of buildGoldenSpecs(createExportFrameSpec)) {
  fs.writeFileSync(path.join(svgDir, `${fixture.id}.svg`), renderStaticSvg(fixture.spec));
}

fs.writeFileSync(
  path.join(svgDir, "long-text.svg"),
  renderStaticSvg(buildLongTextSpec(createExportFrameSpec)),
);
fs.writeFileSync(
  path.join(svgDir, "empty-state.svg"),
  renderStaticSvg(buildEmptyStateSpec(createExportFrameSpec)),
);

const themes = buildThemeSpecs(createExportFrameSpec);
fs.writeFileSync(path.join(svgDir, "theme-light.svg"), renderStaticSvg(themes.light));
fs.writeFileSync(path.join(svgDir, "theme-dark.svg"), renderStaticSvg(themes.dark));
