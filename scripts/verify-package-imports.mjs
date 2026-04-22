import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const packages = [
  {
    name: "@withqwerty/campos-schema",
    entry: "packages/schema/dist/index.js",
    validate(module) {
      assert.equal(typeof module.clampToCamposRange, "function");
      assert.ok("CAMPOS_COORDINATE_BOUNDS" in module);
    },
  },
  {
    name: "@withqwerty/campos-adapters",
    entry: "packages/adapters/dist/index.js",
    validate(module) {
      assert.equal(typeof module.fromOpta?.shots, "function");
      assert.equal(typeof module.fromStatsBomb?.shots, "function");
      assert.equal(typeof module.fromWhoScored?.events, "function");
    },
  },
  {
    name: "@withqwerty/campos-react",
    entry: "packages/react/dist/index.js",
    validate(module) {
      assert.equal(typeof module.ShotMap, "function");
      assert.equal(typeof module.computeShotMap, "function");
    },
  },
  {
    name: "@withqwerty/campos-stadia",
    entry: "packages/stadia/dist/index.js",
    validate(module) {
      assert.equal(typeof module.Pitch, "function");
      assert.equal(typeof module.createPitchProjection, "function");
      assert.equal(typeof module.computeViewBox, "function");
    },
  },
  {
    name: "@withqwerty/campos-static",
    entry: "packages/static/dist/index.js",
    validate(module) {
      assert.equal(typeof module.renderStaticSvg, "function");
      assert.equal(typeof module.renderStaticPng, "function");
    },
  },
];

for (const pkg of packages) {
  const resolvedEntry = resolve(pkg.entry);
  await access(resolvedEntry);
  const module = await import(pathToFileURL(resolvedEntry).href);
  pkg.validate(module);
  console.log(`verified ${pkg.name} -> ${pkg.entry}`);
}
