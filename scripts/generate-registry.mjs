#!/usr/bin/env node
/**
 * Campos agent-facing registry generator.
 *
 * Reads source truth from:
 *   - packages/react/src/*.tsx           (chart components + peerDeps)
 *   - packages/react/src/*Recipes.ts     (named presets per chart)
 *   - packages/adapters/src/<provider>/  (adapter methods + JSDoc)
 *   - docs/specs/*-spec.md               (per-chart purpose + invariants)
 *   - docs/standards/adapter-gap-matrix.md  (provider x chart capability grid)
 *
 * Writes JSON to registry/dist/ for consumption by agents (nutmeg, others)
 * via https://campos.withqwerty.com/r/*.
 *
 * Fault tolerance:
 *   - Non-featured chart parse failure: warn, emit minimal degraded shape, exit 0.
 *   - Featured chart parse failure: warn, emit minimal, exit non-zero.
 *   - Missing docs/specs or matrix: preflight throws, exit non-zero.
 *
 * Run: `pnpm generate:registry`
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  rmSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REACT_SRC = resolve(ROOT, "packages/react/src");
const ADAPTERS_SRC = resolve(ROOT, "packages/adapters/src");
const SPECS_DIR = resolve(ROOT, "docs/specs");
const MATRIX_PATH = resolve(ROOT, "docs/standards/adapter-gap-matrix.md");
const OUT = resolve(ROOT, "registry/dist");

const SCHEMA_VERSION = 1;
const STATUS_VOCABULARY = ["supported", "partial", "unsupported", "unknown", "aggregate"];
const SITE_URL = "https://campos.withqwerty.com";
const GITHUB_SPECS = "https://github.com/withqwerty/campos/blob/main/docs/specs";
const GITHUB_STANDARDS = "https://github.com/withqwerty/campos/blob/main/docs/standards";

const FEATURED = new Set([
  "ShotMap",
  "PassMap",
  "PassNetwork",
  "Formation",
  "XGTimeline",
  "RadarChart",
]);

const CHARTS = [
  { name: "Beeswarm", spec: null, recipes: null },
  { name: "BumpChart", spec: "bumpchart-spec.md", recipes: "bumpChartRecipes.ts" },
  { name: "CometChart", spec: "cometchart-spec.md", recipes: null },
  { name: "DistributionChart", spec: "distribution-chart-spec.md", recipes: null },
  { name: "DistributionComparison", spec: "distribution-chart-spec.md", recipes: null },
  { name: "Formation", spec: "formation-spec.md", recipes: null },
  { name: "GoalMouthShotChart", spec: null, recipes: null },
  { name: "Heatmap", spec: "heatmap-spec.md", recipes: null },
  { name: "KDE", spec: "kde-spec.md", recipes: null },
  { name: "LineChart", spec: null, recipes: null },
  { name: "PassFlow", spec: "passflow-spec.md", recipes: "passFlowRecipes.ts" },
  { name: "PassMap", spec: "passmap-spec.md", recipes: "passMapRecipes.ts" },
  { name: "PassNetwork", spec: "passnetwork-spec.md", recipes: null },
  { name: "PassSonar", spec: "passsonar-spec.md", recipes: null },
  {
    name: "PercentileBar",
    spec: "percentile-surfaces-spec.md",
    recipes: "percentileSurfaceRecipes.ts",
  },
  {
    name: "PercentilePill",
    spec: "percentile-surfaces-spec.md",
    recipes: "percentileSurfaceRecipes.ts",
  },
  { name: "PizzaChart", spec: "pizzachart-spec.md", recipes: "pizzaChartRecipes.ts" },
  { name: "RadarChart", spec: "radarchart-spec.md", recipes: "radarChartRecipes.ts" },
  { name: "ScatterPlot", spec: "scatterplot-spec.md", recipes: "scatterPlotRecipes.ts" },
  { name: "ShotMap", spec: "shotmap-spec.md", recipes: "shotMapRecipes.ts" },
  { name: "SmallMultiples", spec: "smallmultiples-spec.md", recipes: null },
  { name: "StatBadge", spec: "statbadge-spec.md", recipes: null },
  { name: "Territory", spec: "territory-spec.md", recipes: null },
  { name: "XGTimeline", spec: "xgtimeline-spec.md", recipes: "xgTimelineRecipes.ts" },
];

const warnings = [];
const failures = [];

function warn(msg) {
  warnings.push(msg);
  console.warn(`[generate-registry] warn: ${msg}`);
}

function fail(msg) {
  failures.push(msg);
  console.error(`[generate-registry] FAIL: ${msg}`);
}

function preflight() {
  if (!existsSync(SPECS_DIR)) {
    throw new Error(
      `docs/specs/ missing at ${SPECS_DIR} - the generator requires the full campos monorepo, not an exported package tree.`,
    );
  }
  const specCount = readdirSync(SPECS_DIR).filter((f) => f.endsWith("-spec.md")).length;
  if (specCount < 20) {
    throw new Error(`docs/specs/ has only ${specCount} *-spec.md files; expected >= 20.`);
  }
  if (!existsSync(MATRIX_PATH)) {
    throw new Error(`docs/standards/adapter-gap-matrix.md missing at ${MATRIX_PATH}.`);
  }
  if (!existsSync(resolve(REACT_SRC, "index.ts"))) {
    throw new Error(`packages/react/src/index.ts missing at ${REACT_SRC}`);
  }
}

function splitPipeRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());
}

function parseMatrix(markdown) {
  const lines = markdown.split("\n");
  const tables = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes("|") && lines[i + 1] && /^\|[-\s|]+\|$/.test(lines[i + 1].trim())) {
      const headerCells = splitPipeRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitPipeRow(lines[i]));
        i += 1;
      }
      tables.push({ header: headerCells, rows });
    } else {
      i += 1;
    }
  }

  const fields = {};
  const components = {};

  if (tables.length >= 1) {
    const t = tables[0];
    const providers = t.header.slice(1, -1);
    for (const row of t.rows) {
      const fieldName = row[0];
      const note = row[row.length - 1] || "";
      const cells = {};
      for (let p = 0; p < providers.length; p++) {
        const raw = row[p + 1] || "";
        cells[providers[p]] = { status: raw.trim(), note: "" };
      }
      fields[fieldName] = { note: note.trim(), providers: cells };
    }
  }

  if (tables.length >= 2) {
    const t = tables[1];
    const providers = t.header.slice(1, -1);
    for (const row of t.rows) {
      const compName = row[0].replace(/`/g, "");
      const note = row[row.length - 1] || "";
      const cells = {};
      for (let p = 0; p < providers.length; p++) {
        const raw = row[p + 1] || "";
        cells[providers[p]] = { status: raw.trim(), note: "" };
      }
      components[compName] = { note: note.trim(), providers: cells };
    }
  }

  const adapters = { narrow: {}, partial: {}, feasibility: {} };
  for (const t of tables.slice(2)) {
    for (const row of t.rows) {
      if (row.length < 3) continue;
      const provider = row[0].trim();
      if (!provider || provider === "Provider") continue;
      const landed = row[1] || "";
      const status = row[2] ? row[2].trim() : "";
      const note = row[row.length - 1] || "";
      const entry = { landed: landed.trim(), status, note: note.trim() };
      if (status === "partial") {
        adapters.partial[provider] = entry;
      } else if (
        status.startsWith("not landed") ||
        status === "unsupported" ||
        status === "unknown"
      ) {
        adapters.feasibility[provider] = entry;
      } else {
        adapters.narrow[provider] = entry;
      }
    }
  }

  return { fields, components, adapters };
}

function splitByHeading(md, level) {
  const marker = "#".repeat(level) + " ";
  const sections = {};
  let current = null;
  let buf = [];
  for (const line of md.split("\n")) {
    if (line.startsWith(marker) && !line.startsWith(marker + "#")) {
      if (current) sections[current] = buf.join("\n");
      current = line.slice(marker.length).trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (current) sections[current] = buf.join("\n");
  return sections;
}

function sliceSubSection(md, heading) {
  const marker = `### ${heading}`;
  const start = md.indexOf(marker);
  if (start === -1) return "";
  const after = md.slice(start + marker.length);
  const nextHeading = after.search(/\n### /);
  return nextHeading === -1 ? after : after.slice(0, nextHeading);
}

function extractBullets(block) {
  const items = [];
  let buf = null;
  for (const line of block.split("\n")) {
    const m = line.match(/^\s*-\s+(.*)$/);
    if (m) {
      if (buf) items.push(buf);
      buf = m[1].trim();
    } else if (/^\s{2,}\S/.test(line) && buf) {
      buf += " " + line.trim();
    } else if (buf) {
      items.push(buf);
      buf = null;
    }
  }
  if (buf) items.push(buf);
  return items;
}

function extractFirstBullet(block, labelRegex) {
  const bullets = extractBullets(block);
  for (let i = 0; i < bullets.length; i++) {
    if (labelRegex.test(bullets[i]) && i + 1 < bullets.length) {
      return bullets[i + 1];
    }
  }
  return bullets[0] || null;
}

function parseSpec(path) {
  if (!existsSync(path)) return null;
  const md = readFileSync(path, "utf8");
  const sections = splitByHeading(md, 2);
  const header = sections["Header"] || "";
  const purposeBlock = sections["Purpose"] || "";
  const domainBlock = sections["Domain framing"] || "";
  const purpose = extractFirstBullet(purposeBlock, /What user task this solves:/i);
  const invariantsBlock = sliceSubSection(domainBlock, "Invariants");
  const invariants = extractBullets(invariantsBlock);
  const inputModel = sliceSubSection(domainBlock, "Canonical input model");
  const dataContract = {
    source: "canonical Campos types",
    description: inputModel.trim() || null,
    requiredHints: invariants.filter((x) => /required/i.test(x)),
  };
  return { purpose, invariants, dataContract, header: header.trim() };
}

function parseRecipes(path) {
  if (!existsSync(path)) return null;
  const src = readFileSync(path, "utf8");
  const pattern =
    /defineChartRecipe<[^>]+>\s*\(\s*\{\s*name:\s*"([^"]+)"\s*,\s*description:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g;
  const recipes = [];
  let match;
  while ((match = pattern.exec(src)) !== null) {
    recipes.push({ name: match[1], description: match[2].replace(/\\"/g, '"') });
  }
  return recipes;
}

function extractPeerDeps(tsxPath) {
  if (!existsSync(tsxPath)) return [];
  const src = readFileSync(tsxPath, "utf8");
  const imports = new Set();
  const importRegex = /^import\s+(?:type\s+)?[^"']+from\s+["']([^"']+)["'];?$/gm;
  let match;
  while ((match = importRegex.exec(src)) !== null) {
    const spec = match[1];
    if (!spec.startsWith(".") && !spec.startsWith("/")) {
      const parts = spec.split("/");
      const pkg = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
      imports.add(pkg);
    }
  }
  return [...imports].sort();
}

function discoverAdapters() {
  const entries = readdirSync(ADAPTERS_SRC, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory() && e.name !== "shared")
    .map((e) => e.name)
    .sort();

  return dirs.map((dir) => {
    const indexPath = resolve(ADAPTERS_SRC, dir, "index.ts");
    const methods = existsSync(indexPath) ? extractAdapterMethods(indexPath) : [];
    return { name: dir, methods, indexPath };
  });
}

function extractAdapterMethods(indexPath) {
  const src = readFileSync(indexPath, "utf8");
  const openMatch = src.match(/export const from[A-Z]\w*\s*=\s*\{/);
  if (!openMatch) return [];
  const openIdx = openMatch.index + openMatch[0].length;
  // Walk braces from after the opening `{` until balanced.
  let depth = 1;
  let closeIdx = openIdx;
  while (closeIdx < src.length && depth > 0) {
    const ch = src[closeIdx];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    closeIdx += 1;
  }
  if (depth !== 0) return [];
  const body = src.slice(openIdx, closeIdx - 1);
  const methods = [];

  // Method shorthand: `name(args): Type {` — args may span multiple lines, so use [\s\S] for the param body.
  const methodRegex =
    /(?:\/\*\*([\s\S]*?)\*\/\s*\n)?^ {2}(\w+)\s*\(([\s\S]*?)\)\s*:\s*([^{]+?)\s*\{/gm;
  let m;
  while ((m = methodRegex.exec(body)) !== null) {
    const name = m[2];
    if (/^(if|for|while|switch|return|function|const|let|var)$/.test(name)) continue;
    methods.push({
      name,
      returnType: m[4].trim(),
      jsdoc: formatJsdoc(m[1]),
    });
  }

  // Property-assignment delegates: `name: externalFn,`  → we can't see the signature here,
  // but we still want to report the method name + that it delegates.
  const assignRegex =
    /(?:\/\*\*([\s\S]*?)\*\/\s*\n)?^ {2}(\w+)\s*:\s*([A-Za-z_][\w]*)\s*,/gm;
  let a;
  while ((a = assignRegex.exec(body)) !== null) {
    const name = a[2];
    if (/^(if|for|while|switch|return|function|const|let|var)$/.test(name)) continue;
    methods.push({
      name,
      returnType: null,
      delegatesTo: a[3],
      jsdoc: formatJsdoc(a[1]),
    });
  }

  const seen = new Set();
  return methods.filter((x) => (seen.has(x.name) ? false : seen.add(x.name)));
}

function formatJsdoc(raw) {
  if (!raw) return null;
  const out = raw
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trimEnd())
    .filter((l) => l.length > 0)
    .join("\n")
    .trim();
  return out || null;
}

function buildChartJson(chart, matrix) {
  const tsxPath = resolve(REACT_SRC, `${chart.name}.tsx`);
  const specPath = chart.spec ? resolve(SPECS_DIR, chart.spec) : null;
  const recipesPath = chart.recipes ? resolve(REACT_SRC, chart.recipes) : null;

  const peerDependencies = extractPeerDeps(tsxPath);
  const recipes = recipesPath ? parseRecipes(recipesPath) : null;
  const spec = specPath ? parseSpec(specPath) : null;

  const capabilities =
    (matrix.components[chart.name] && matrix.components[chart.name].providers) || null;

  const status = spec ? "active" : "degraded";
  if (!spec) {
    warn(
      `chart "${chart.name}" has no spec file mapped; emitting degraded entry ` +
        `(featured=${FEATURED.has(chart.name)})`,
    );
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    name: chart.name,
    status,
    featured: FEATURED.has(chart.name),
    package: "@withqwerty/campos-react",
    peerDependencies,
    purpose: spec ? spec.purpose : null,
    dataContract: spec ? spec.dataContract : null,
    invariants: spec ? spec.invariants : null,
    recipes,
    capabilities,
    specUrl: chart.spec ? `${GITHUB_SPECS}/${chart.spec}` : null,
    _generated_from: chart.spec ? `docs/specs/${chart.spec}` : null,
    _generated_at: new Date().toISOString(),
  };
}

const TITLE_CASE_MAP = {
  opta: "Opta",
  statsbomb: "StatsBomb",
  wyscout: "Wyscout",
  whoscored: "WhoScored",
  understat: "Understat",
  fbref: "FBref",
  sofascore: "Sofascore",
  statsperform: "Stats Perform",
  impect: "Impect",
  sportec: "Sportec",
};

function buildAdapterJson(adapter, matrix) {
  const matrixKey = TITLE_CASE_MAP[adapter.name] || adapter.name;
  let tier = "unknown";
  let notes = "";

  if (["Opta", "StatsBomb", "Wyscout", "WhoScored"].includes(matrixKey)) {
    tier = "main";
  } else if (matrix.adapters.narrow[matrixKey]) {
    tier = "narrow";
    notes = matrix.adapters.narrow[matrixKey].note;
  } else if (matrix.adapters.partial[matrixKey]) {
    tier = "partial";
    notes = matrix.adapters.partial[matrixKey].note;
  } else if (matrix.adapters.feasibility[matrixKey]) {
    tier = "feasibility";
    notes = matrix.adapters.feasibility[matrixKey].note;
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    name: adapter.name,
    matrixKey,
    tier,
    package: "@withqwerty/campos-adapters",
    exportName: `from${matrixKey.replace(/\s+/g, "")}`,
    methods: adapter.methods,
    notes,
    _generated_from: `packages/adapters/src/${adapter.name}/index.ts`,
    _generated_at: new Date().toISOString(),
  };
}

function main() {
  console.log("[generate-registry] starting");
  preflight();

  if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(OUT, "charts"), { recursive: true });
  mkdirSync(join(OUT, "adapters"), { recursive: true });
  mkdirSync(join(OUT, "recipes"), { recursive: true });

  const matrixMd = readFileSync(MATRIX_PATH, "utf8");
  const matrix = parseMatrix(matrixMd);

  const adapterMatrixJson = {
    schemaVersion: SCHEMA_VERSION,
    statusVocabulary: STATUS_VOCABULARY,
    generated: new Date().toISOString(),
    fields: matrix.fields,
    components: matrix.components,
    adapters: matrix.adapters,
    _generated_from: "docs/standards/adapter-gap-matrix.md",
    _source_url: `${GITHUB_STANDARDS}/adapter-gap-matrix.md`,
  };
  writeFileSync(
    join(OUT, "adapter-matrix.json"),
    JSON.stringify(adapterMatrixJson, null, 2),
  );

  const chartIndex = [];
  for (const chart of CHARTS) {
    let json;
    try {
      json = buildChartJson(chart, matrix);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      warn(`chart "${chart.name}" parse failure: ${reason}`);
      json = {
        schemaVersion: SCHEMA_VERSION,
        name: chart.name,
        status: "degraded",
        featured: FEATURED.has(chart.name),
        package: "@withqwerty/campos-react",
        peerDependencies: [],
        recipes: null,
        error: reason.slice(0, 200),
        _generated_at: new Date().toISOString(),
      };
    }

    if (json.status === "degraded" && FEATURED.has(chart.name)) {
      fail(`featured chart "${chart.name}" degraded - registry build must not ship this`);
    }

    writeFileSync(
      join(OUT, "charts", `${chart.name}.json`),
      JSON.stringify(json, null, 2),
    );
    chartIndex.push({
      name: chart.name,
      status: json.status,
      featured: json.featured,
      package: json.package,
      peerDependencies: json.peerDependencies,
    });

    if (json.recipes !== null && json.recipes !== undefined) {
      writeFileSync(
        join(OUT, "recipes", `${chart.name}.json`),
        JSON.stringify(
          { schemaVersion: SCHEMA_VERSION, chart: chart.name, recipes: json.recipes },
          null,
          2,
        ),
      );
    }
  }

  const adapters = discoverAdapters();
  const adapterIndex = [];
  for (const adapter of adapters) {
    let json;
    try {
      json = buildAdapterJson(adapter, matrix);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      warn(`adapter "${adapter.name}" parse failure: ${reason}`);
      json = {
        schemaVersion: SCHEMA_VERSION,
        name: adapter.name,
        tier: "unknown",
        package: "@withqwerty/campos-adapters",
        methods: [],
        error: reason.slice(0, 200),
        _generated_at: new Date().toISOString(),
      };
    }
    writeFileSync(
      join(OUT, "adapters", `${adapter.name}.json`),
      JSON.stringify(json, null, 2),
    );
    adapterIndex.push({
      name: adapter.name,
      tier: json.tier,
      exportName: json.exportName,
    });
  }

  const registry = {
    schemaVersion: SCHEMA_VERSION,
    statusVocabulary: STATUS_VOCABULARY,
    generated: new Date().toISOString(),
    siteUrl: SITE_URL,
    catalogueUrl: `${SITE_URL}/r/`,
    charts: chartIndex,
    adapters: adapterIndex,
    _generated_from: "scripts/generate-registry.mjs",
  };
  writeFileSync(join(OUT, "registry.json"), JSON.stringify(registry, null, 2));

  console.log(
    `[generate-registry] wrote ${chartIndex.length} charts, ${adapterIndex.length} adapters to ${OUT}`,
  );
  if (warnings.length) {
    console.warn(`[generate-registry] ${warnings.length} warning(s) - see above`);
  }
  if (failures.length) {
    console.error(
      `[generate-registry] ${failures.length} failure(s) - a featured chart degraded or a fatal error occurred`,
    );
    process.exit(1);
  }
  console.log("[generate-registry] ok");
}

main();
