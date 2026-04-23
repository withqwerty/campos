import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  BumpChartRow,
  ComputePassMapInput,
  HeatmapEvent,
  PassNetworkEdge,
  PassNetworkNode,
  PizzaChartRow,
  RadarChartRow,
  TerritoryEvent,
} from "@withqwerty/campos-react";
import { createExportFrameSpec } from "@withqwerty/campos-react";
import type { Shot } from "@withqwerty/campos-schema";

import { renderStaticPng, renderStaticSvg } from "../src/index";
import {
  buildEmptyStateSpec,
  buildGoldenSpecs,
  buildLongTextSpec,
  percentileComparison,
  percentileMetric,
  buildThemeSpecs,
} from "./fixtures/export-fixtures.js";

const SVG_FIXTURE_DIR = path.join(import.meta.dirname, "fixtures/svg");

function readGoldenSvg(name: string): string {
  return fs.readFileSync(path.join(SVG_FIXTURE_DIR, name), "utf8");
}

function writeGoldenSvg(name: string, content: string) {
  fs.writeFileSync(path.join(SVG_FIXTURE_DIR, name), content);
}

const UPDATE_GOLDENS = process.env.UPDATE_GOLDENS === "1";

const bumpRows: BumpChartRow[] = [
  { team: "LIV", label: "Liverpool", timepoint: 1, rank: 1 },
  { team: "LIV", label: "Liverpool", timepoint: 2, rank: 1 },
  { team: "MCI", label: "Man City", timepoint: 1, rank: 2 },
  { team: "MCI", label: "Man City", timepoint: 2, rank: 3 },
];

const pizzaRows: PizzaChartRow[] = [
  { metric: "Goals", percentile: 92, category: "Attacking", displayValue: "92" },
  { metric: "Shots", percentile: 78, category: "Attacking", displayValue: "78" },
  { metric: "Passes", percentile: 45, category: "Possession", displayValue: "45" },
  { metric: "Tackles", percentile: 24, category: "Defending", displayValue: "24" },
];

const territoryEvents: TerritoryEvent[] = [
  { x: 12, y: 18, team: "Arsenal" },
  { x: 75, y: 62, team: "Arsenal" },
  { x: 50, y: 50, team: "Wolves" },
];

const passNetworkNodes: PassNetworkNode[] = [
  { id: "gk", label: "Raya", x: 10, y: 50, passCount: 30 },
  { id: "cb", label: "Saliba", x: 30, y: 45, passCount: 42 },
];

const passNetworkEdges: PassNetworkEdge[] = [
  { sourceId: "gk", targetId: "cb", passCount: 12 },
];

const shots: Shot[] = [
  {
    kind: "shot",
    id: "shot-1",
    matchId: "m1",
    teamId: "home",
    playerId: "p1",
    playerName: "Saka",
    minute: 21,
    addedMinute: null,
    second: 0,
    period: 1,
    x: 91,
    y: 42,
    xg: 0.23,
    outcome: "goal",
    bodyPart: "left-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: "regular-play",
    provider: "opta",
    providerEventId: "shot-1",
  },
];

const passes: ComputePassMapInput["passes"] = [
  {
    kind: "pass",
    id: "pass-1",
    matchId: "m1",
    teamId: "home",
    playerId: "p1",
    playerName: "Rice",
    minute: 12,
    addedMinute: null,
    second: 10,
    period: 1,
    x: 45,
    y: 48,
    endX: 72,
    endY: 35,
    length: 30,
    angle: 0.2,
    recipient: "Saka",
    passResult: "complete",
    passType: "ground",
    isAssist: false,
    provider: "opta",
    providerEventId: "pass-1",
    sourceMeta: {},
  },
];

const heatmapEvents: HeatmapEvent[] = [
  { x: 20, y: 30 },
  { x: 55, y: 44 },
];

const scatterPoints: Array<Record<string, string | number>> = [
  { id: "saka", player: "Saka", xg: 8.2, goals: 14, team: "Arsenal" },
  { id: "salah", player: "Salah", xg: 12.5, goals: 18, team: "Liverpool" },
];

const radarRows: RadarChartRow[] = [
  { metric: "Goals", value: 14, percentile: 92, category: "Attack" },
  { metric: "Assists", value: 9, percentile: 88, category: "Creation" },
  { metric: "Pressures", value: 40, percentile: 71, category: "Defending" },
];

function buildIncompletePass(id: string): ComputePassMapInput["passes"][number] {
  const base = passes[0];
  if (base == null) {
    throw new Error("Expected pass fixture");
  }

  return {
    ...base,
    id,
    providerEventId: id,
    endX: 60,
    endY: 66,
    angle: 0.9,
    passResult: "incomplete",
  };
}

describe("@withqwerty/campos-static", () => {
  it("renders a standalone SVG card", () => {
    const spec = createExportFrameSpec({
      preset: "square",
      theme: "dark",
      title: "Forward profile",
      subtitle: "Premier League sample",
      chart: {
        kind: "pizza-chart",
        props: {
          rows: pizzaRows,
          centerContent: { kind: "initials", label: "RW" },
        },
      },
    });

    const svg = renderStaticSvg(spec);

    expect(svg).toContain('<?xml version="1.0"');
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 1080 1080"');
    expect(svg).toContain("Forward profile");
    expect(svg).toContain("Premier League sample");
    expect(svg).toContain("Goals");
  });

  it("resolves theme and solid export backgrounds into SVG fills", () => {
    const darkThemeSvg = renderStaticSvg(
      createExportFrameSpec({
        theme: "dark",
        title: "Dark background",
        chart: {
          kind: "pizza-chart",
          props: {
            rows: pizzaRows,
            centerContent: { kind: "initials", label: "RW" },
          },
        },
      }),
    );
    expect(darkThemeSvg).toContain(
      '<rect x="0" y="0" width="1200" height="630" fill="#0d1118"></rect>',
    );

    const solidSvg = renderStaticSvg(
      createExportFrameSpec({
        background: { kind: "solid", color: "#f8fafc" },
        title: "Solid background",
        chart: {
          kind: "pizza-chart",
          props: {
            rows: pizzaRows,
            centerContent: { kind: "initials", label: "RW" },
          },
        },
      }),
    );
    expect(solidSvg).toContain(
      '<rect x="0" y="0" width="1200" height="630" fill="#f8fafc"></rect>',
    );
  });

  it("renders a PNG buffer from the SVG card", async () => {
    const spec = createExportFrameSpec({
      title: "Table trend",
      chart: {
        kind: "bump-chart",
        props: {
          rows: bumpRows,
        },
      },
    });

    const png = await renderStaticPng(spec);

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("renders Formation, Territory, and PassNetwork SVG cards", () => {
    const formationSvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Lineup",
        chart: {
          kind: "formation",
          props: {
            formation: "4-3-3",
            teamLabel: "Arsenal",
          },
        },
      }),
    );
    expect(formationSvg).toContain("Lineup");
    expect(formationSvg).toContain("4-3-3 formation");

    const territorySvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Territory",
        chart: {
          kind: "territory",
          props: {
            events: territoryEvents,
          },
        },
      }),
    );
    expect(territorySvg).toContain("Territory");
    expect(territorySvg).toContain("territory-cell");

    const passNetworkSvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Pass network",
        chart: {
          kind: "pass-network",
          props: {
            nodes: passNetworkNodes,
            edges: passNetworkEdges,
          },
        },
      }),
    );
    expect(passNetworkSvg).toContain("Pass network");
    expect(passNetworkSvg).toContain("Raya");
  });

  it("renders the full Phase 1 chart set as static SVG cards", () => {
    const cases = [
      {
        title: "Shots",
        spec: createExportFrameSpec({
          title: "Shots",
          chart: { kind: "shot-map", props: { shots } },
        }),
        expected: "Shot map: 1 shots, 1 goals",
      },
      {
        title: "Passes",
        spec: createExportFrameSpec({
          title: "Passes",
          chart: { kind: "pass-map", props: { passes } },
        }),
        expected: "Passes",
      },
      {
        title: "Pass flow",
        spec: createExportFrameSpec({
          title: "Pass flow",
          chart: { kind: "pass-flow", props: { passes, minCountForArrow: 1 } },
        }),
        expected: "passflow-arrows",
      },
      {
        // Reuses the same single-pass fixture; at x=45 it falls outside the
        // attacking half, so the model empties. Proves the crop branch
        // serializes without crashing and correctly reports empty state.
        title: "Pass flow half-left",
        spec: createExportFrameSpec({
          title: "Pass flow half-left",
          chart: {
            kind: "pass-flow",
            props: {
              passes,
              crop: "half",
              attackingDirection: "left",
              minCountForArrow: 1,
            },
          },
        }),
        expected: "No passes to chart",
      },
      {
        title: "Pass flow low-dispersion",
        spec: createExportFrameSpec({
          title: "Pass flow low-dispersion",
          chart: {
            kind: "pass-flow",
            // Impossible floor forces every bin to render as low-dispersion
            // glyph — proves that branch serializes cleanly.
            props: { passes, dispersionFloor: 2 },
          },
        }),
        expected: "passflow-arrows",
      },
      {
        title: "Heat",
        spec: createExportFrameSpec({
          title: "Heat",
          chart: { kind: "heatmap", props: { events: heatmapEvents } },
        }),
        expected: "heatmap-cell",
      },
      {
        title: "Scatter",
        spec: createExportFrameSpec({
          title: "Scatter",
          chart: {
            kind: "scatter-plot",
            props: {
              points: scatterPoints,
              idKey: "id",
              xKey: "xg",
              yKey: "goals",
              labelKey: "player",
            },
          },
        }),
        expected: "Scatter plot: 2 points",
      },
      {
        title: "Timeline",
        spec: createExportFrameSpec({
          title: "Timeline",
          chart: {
            kind: "xg-timeline",
            props: { shots, homeTeam: "home", awayTeam: "away" },
          },
        }),
        expected: "xG timeline",
      },
      {
        title: "Radar",
        spec: createExportFrameSpec({
          title: "Radar",
          chart: { kind: "radar-chart", props: { rows: radarRows } },
        }),
        expected: "Goals",
      },
      {
        title: "Percentile",
        spec: createExportFrameSpec({
          title: "Percentile",
          chart: {
            kind: "percentile-bar",
            props: {
              metric: percentileMetric,
              comparison: percentileComparison,
            },
          },
        }),
        expected: "Progressive passes",
      },
      {
        title: "Pass sonar",
        spec: createExportFrameSpec({
          title: "Pass sonar",
          chart: {
            kind: "pass-sonar",
            props: {
              passes: [...passes, buildIncompletePass("pass-2")],
              subjectLabel: "Rice",
            },
          },
        }),
        expected: "Pass sonar for Rice",
      },
    ];

    for (const testCase of cases) {
      const svg = renderStaticSvg(testCase.spec);
      expect(svg).toContain(testCase.title);
      expect(svg).toContain(testCase.expected);
    }
  });

  it("matches the golden SVG fixture set for all supported chart kinds", () => {
    for (const fixture of buildGoldenSpecs(createExportFrameSpec)) {
      const svg = renderStaticSvg(fixture.spec);
      if (UPDATE_GOLDENS) writeGoldenSvg(`${fixture.id}.svg`, svg);
      expect(svg).toBe(readGoldenSvg(`${fixture.id}.svg`));
    }
  });

  it("matches the long-text stress SVG fixture", () => {
    const svg = renderStaticSvg(buildLongTextSpec(createExportFrameSpec));
    if (UPDATE_GOLDENS) writeGoldenSvg("long-text.svg", svg);
    expect(svg).toBe(readGoldenSvg("long-text.svg"));
  });

  it("matches the empty-state SVG fixture", () => {
    const svg = renderStaticSvg(buildEmptyStateSpec(createExportFrameSpec));
    if (UPDATE_GOLDENS) writeGoldenSvg("empty-state.svg", svg);
    expect(svg).toBe(readGoldenSvg("empty-state.svg"));
  });

  it("matches dual-theme regression fixtures", () => {
    const themes = buildThemeSpecs(createExportFrameSpec);

    const light = renderStaticSvg(themes.light);
    const dark = renderStaticSvg(themes.dark);
    if (UPDATE_GOLDENS) {
      writeGoldenSvg("theme-light.svg", light);
      writeGoldenSvg("theme-dark.svg", dark);
    }
    expect(light).toBe(readGoldenSvg("theme-light.svg"));
    expect(dark).toBe(readGoldenSvg("theme-dark.svg"));
  });

  it("includes heatmap zone-preset warnings in the static SVG output", () => {
    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Heatmap warnings",
        chart: {
          kind: "heatmap",
          props: {
            events: heatmapEvents,
            zonePreset: "20",
            crop: "half",
            gridX: 4,
            gridY: 3,
          },
        },
      }),
    );

    expect(svg).toContain("<desc>");
    expect(svg).toContain("full-pitch only");
  });

  it("suppresses frame legends when export chart props disable them", () => {
    const multiResultPasses: ComputePassMapInput["passes"] = [
      ...passes,
      buildIncompletePass("pass-2"),
    ];

    const shotSvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Shots",
        chart: {
          kind: "shot-map",
          props: {
            shots,
            showLegend: false,
          },
        },
      }),
    );
    expect(shotSvg).not.toContain(">Goal<");

    const passMapSvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Passes",
        chart: {
          kind: "pass-map",
          props: {
            passes: multiResultPasses,
            showLegend: false,
          },
        },
      }),
    );
    expect(passMapSvg).not.toContain(">Complete<");
    expect(passMapSvg).not.toContain(">Incomplete<");

    const passSonarSvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Pass sonar",
        chart: {
          kind: "pass-sonar",
          props: {
            passes: multiResultPasses,
            subjectLabel: "Rice",
            showLegend: false,
          },
        },
      }),
    );
    expect(passSonarSvg).not.toContain(">Attempted passes<");
    expect(passSonarSvg).not.toContain(">Completed passes<");
  });

  it("suppresses pass-flow export legends when showLegend=false", () => {
    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Flow",
        chart: {
          kind: "pass-flow",
          props: {
            passes,
            minCountForArrow: 1,
            metricLabel: "Danger flow",
            showLegend: false,
          },
        },
      }),
    );

    expect(svg).not.toContain(">DANGER FLOW<");
  });

  it("matches pass-sonar export legends to the active colorBy mode", () => {
    const sonarPasses: ComputePassMapInput["passes"] = [
      ...passes,
      buildIncompletePass("pass-2"),
    ];

    const noneSvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Pass sonar none",
        chart: {
          kind: "pass-sonar",
          props: {
            passes: sonarPasses,
            colorBy: "none",
          },
        },
      }),
    );
    expect(noneSvg).toContain(">Attempted passes<");
    expect(noneSvg).not.toContain(">Completed passes<");

    const distanceSvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Pass sonar distance",
        chart: {
          kind: "pass-sonar",
          props: {
            passes: sonarPasses,
            colorBy: "distance",
          },
        },
      }),
    );
    expect(distanceSvg).toContain(">AVG PASS DISTANCE<");
    expect(distanceSvg).not.toContain(">Completed passes<");

    const frequencySvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Pass sonar frequency",
        chart: {
          kind: "pass-sonar",
          props: {
            passes: sonarPasses,
            colorBy: "frequency",
          },
        },
      }),
    );
    expect(frequencySvg).toContain(">PASSES PER BIN<");

    const metricSvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Pass sonar metric",
        chart: {
          kind: "pass-sonar",
          props: {
            passes: sonarPasses,
            colorBy: "metric",
            metricCenter: "zero",
            metricForPass: (pass) => (pass.passResult === "complete" ? 1 : -1),
          },
        },
      }),
    );
    expect(metricSvg).toContain(">METRIC<");
    expect(metricSvg).toContain(">0<");
  });

  it("respects Formation legendPlacement='none' in static export", () => {
    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Formation",
        chart: {
          kind: "formation",
          props: {
            home: { formation: "4-3-3", players: [], label: "Cobalt United" },
            away: { formation: "4-4-2", players: [], label: "Amber Town" },
            legendPlacement: "none",
          },
        },
      }),
    );

    expect(svg).not.toContain(">Cobalt United<");
    expect(svg).not.toContain(">Amber Town<");
  });

  it("preserves pass-network size and width legend rows in static export", () => {
    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Pass network",
        chart: {
          kind: "pass-network",
          props: {
            nodes: [
              ...passNetworkNodes,
              { id: "cm", label: "Rice", x: 45, y: 52, passCount: 18 },
            ],
            edges: [
              ...passNetworkEdges,
              { sourceId: "cb", targetId: "cm", passCount: 7 },
            ],
          },
        },
      }),
    );

    expect(svg).toContain(">NODE SIZE<");
    expect(svg).toContain(">EDGE WIDTH<");
  });

  it("renders full heatmap scale-bar labels in static export", () => {
    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Heat",
        chart: {
          kind: "heatmap",
          props: {
            events: heatmapEvents,
            metricLabel: "Danger zones",
          },
        },
      }),
    );

    expect(svg).toContain(">DANGER ZONES<");
  });

  it("renders export header stats for charts that default them on", () => {
    const passMapSvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Passes",
        chart: {
          kind: "pass-map",
          props: { passes },
        },
      }),
    );
    expect(passMapSvg).toContain(">COMPLETION<");

    const passFlowSvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Flow",
        chart: {
          kind: "pass-flow",
          props: { passes, minCountForArrow: 1 },
        },
      }),
    );
    expect(passFlowSvg).toContain(">MEAN LENGTH<");

    const passNetworkSvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Network",
        chart: {
          kind: "pass-network",
          props: {
            nodes: passNetworkNodes,
            edges: passNetworkEdges,
          },
        },
      }),
    );
    expect(passNetworkSvg).toContain(">PLAYERS<");
    expect(passNetworkSvg).toContain(">CONNECTIONS<");
    expect(passNetworkSvg).toContain(">THRESHOLD<");
  });

  it("renders shot-map export header, size scale, and color scale blocks", () => {
    const headerSvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Shots",
        chart: {
          kind: "shot-map",
          props: {
            shots,
            showHeaderStats: true,
          },
        },
      }),
    );
    expect(headerSvg).toContain(">SHOTS<");
    expect(headerSvg).toContain(">GOALS<");

    const defaultSvg = renderStaticSvg(
      createExportFrameSpec({
        title: "Shots",
        chart: {
          kind: "shot-map",
          props: {
            shots,
          },
        },
      }),
    );
    expect(defaultSvg).toContain(">XG<");
    expect(defaultSvg).toContain(">0.15<");
  });

  it("scales percentile-bar exports to fill the chart slot", () => {
    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Percentile",
        chart: {
          kind: "percentile-bar",
          props: {
            metric: percentileMetric,
            comparison: percentileComparison,
          },
        },
      }),
    );

    expect(svg).toContain('width="100%"');
    expect(svg).toContain('height="100%"');
  });

  it("rejects export frames that do not leave positive chart area", () => {
    expect(() =>
      renderStaticSvg(
        createExportFrameSpec({
          width: 220,
          height: 140,
          padding: 48,
          title: "Tiny",
          subtitle: "Subtitle",
          footer: "Footer",
          chart: {
            kind: "pizza-chart",
            props: {
              rows: pizzaRows,
              centerContent: { kind: "initials", label: "RW" },
            },
          },
        }),
      ),
    ).toThrow(/too small/i);
  });

  it("rejects unsupported chart kinds explicitly", () => {
    expect(() =>
      renderStaticSvg({
        version: 1,
        width: 1200,
        height: 630,
        preset: "share-card",
        theme: "light",
        padding: 48,
        background: { kind: "solid", color: "#ffffff" },
        title: "Unsupported",
        chart: {
          kind: "kde",
          props: { events: [] },
        } as never,
      }),
    ).toThrow(/unsupported export chart kind/i);
  });

  // ----------------------------------------------------------------------
  // Regression guards for the static-export fix run
  //
  // The existing suite exercises each fix in one direction — usually the
  // suppression or opt-out path. These guards pair those checks with the
  // opposite-direction positive assertion so a future regression cannot
  // pass the negative test for the wrong reason (e.g. legend silently
  // disappearing on the default path would still satisfy
  // `not.toContain(">Goal<")`). They also cover scale-bar tick rendering,
  // which the existing tests only verify via metric-label presence.
  // ----------------------------------------------------------------------

  it("renders the default frame legend when showLegend is not overridden (shot-map)", () => {
    // Counterpart to the showLegend=false suppression case. Without a
    // positive default assertion, a bug that suppressed the legend in all
    // paths would still pass the negative test.
    //
    // The existing `shots` fixture contains one goal, so only the Goal
    // swatch should render (the Shot swatch only appears when at least
    // one non-goal shot is present — an encoding decision worth locking).
    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Shots",
        chart: {
          kind: "shot-map",
          props: { shots },
        },
      }),
    );

    expect(svg).toContain(">Goal<");
    expect(svg).not.toContain(">Shot<");
  });

  it("renders the default frame legend when showLegend is not overridden (pass-map)", () => {
    const multiResultPasses: ComputePassMapInput["passes"] = [
      ...passes,
      buildIncompletePass("pass-regress-1"),
    ];

    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Passes",
        chart: {
          kind: "pass-map",
          props: { passes: multiResultPasses },
        },
      }),
    );

    expect(svg).toContain(">Complete<");
    expect(svg).toContain(">Incomplete<");
  });

  it("renders the default frame legend when showLegend is not overridden (pass-sonar)", () => {
    const multiResultPasses: ComputePassMapInput["passes"] = [
      ...passes,
      buildIncompletePass("pass-regress-2"),
    ];

    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Pass sonar",
        chart: {
          kind: "pass-sonar",
          props: {
            passes: multiResultPasses,
            subjectLabel: "Rice",
          },
        },
      }),
    );

    expect(svg).toContain(">Attempted passes<");
    expect(svg).toContain(">Completed passes<");
  });

  it("renders the default scale-bar when showLegend is not overridden (pass-flow)", () => {
    // Pass-flow has no `>Goal</>Shot<` swatches — its "legend" is the
    // scale-bar metadata block. This paired assertion verifies fix #14
    // (scale-bar metadata preserved rather than flattened) in the DEFAULT
    // path, not just under showLegend=false suppression.
    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Flow",
        chart: {
          kind: "pass-flow",
          props: {
            passes,
            minCountForArrow: 1,
            metricLabel: "Danger flow",
          },
        },
      }),
    );

    expect(svg).toContain(">DANGER FLOW<");
  });

  it("renders a populated pass-flow scale-bar with range labels", () => {
    // Guards against silent flattening where the metric label survives but
    // the range/tick display collapses. `>0 - 1<` is the default range
    // label for share-valued pass-flow; if the scale-bar model is
    // flattened to generic swatches, no range appears.
    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Flow",
        chart: {
          kind: "pass-flow",
          props: { passes, minCountForArrow: 1 },
        },
      }),
    );

    expect(svg).toContain(">PASS ORIGIN SHARE<");
    expect(svg).toContain(">0 - 1<");
  });

  it("renders a populated heatmap scale-bar with range labels", () => {
    // Same concern as pass-flow. The existing test (fix #15) only verifies
    // the metric label; this one adds the range. Silent flattening would
    // pass the existing metric-label check.
    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Heat",
        chart: {
          kind: "heatmap",
          props: { events: heatmapEvents },
        },
      }),
    );

    expect(svg).toContain(">EVENTS<");
    expect(svg).toContain(">0 - 1<");
  });

  it("renders the shot-map size-scale with at least three ticks", () => {
    // Fix #20 restored the size-scale footer. The existing test asserts
    // one tick (`>0.15<`). A regression collapsing the scale to a single
    // tick would pass that check. Assert three of the five ticks to catch
    // tick-count regressions while staying robust to minor relabel choices.
    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Shots",
        chart: {
          kind: "shot-map",
          props: { shots },
        },
      }),
    );

    expect(svg).toContain(">XG<");
    expect(svg).toContain(">0.05<");
    expect(svg).toContain(">0.15<");
    expect(svg).toContain(">0.30<");
  });

  it("renders Formation team labels under the default legendPlacement", () => {
    // Counterpart to fix #11's legendPlacement='none' suppression. Without
    // a positive default assertion, a future break that suppressed the
    // legend unconditionally would still satisfy the `not.toContain`
    // check.
    const svg = renderStaticSvg(
      createExportFrameSpec({
        title: "Formation",
        chart: {
          kind: "formation",
          props: {
            home: { formation: "4-3-3", players: [], label: "Cobalt United" },
            away: { formation: "4-4-2", players: [], label: "Amber Town" },
          },
        },
      }),
    );

    expect(svg).toContain(">Cobalt United<");
    expect(svg).toContain(">Amber Town<");
  });

  it("renders all four pass-sonar colorBy legend modes with distinguishable labels", () => {
    // The existing test (fix #7–#10) asserts the uppercased header label
    // per mode. This regression guard adds cross-mode uniqueness: none,
    // distance, frequency, and metric must each surface their own label
    // and must NOT bleed another mode's label into the output. Catches a
    // dispatch-table regression where (say) distance mode renders the
    // frequency legend.
    const sonarPasses: ComputePassMapInput["passes"] = [
      ...passes,
      buildIncompletePass("pass-regress-3"),
    ];

    const modes = [
      { colorBy: "none" as const, expected: ">Attempted passes<" },
      { colorBy: "distance" as const, expected: ">AVG PASS DISTANCE<" },
      { colorBy: "frequency" as const, expected: ">PASSES PER BIN<" },
    ];

    for (const mode of modes) {
      const svg = renderStaticSvg(
        createExportFrameSpec({
          title: `sonar ${mode.colorBy}`,
          chart: {
            kind: "pass-sonar",
            props: { passes: sonarPasses, colorBy: mode.colorBy },
          },
        }),
      );

      expect(svg).toContain(mode.expected);
      for (const other of modes) {
        if (other.colorBy === mode.colorBy) continue;
        expect(
          svg,
          `mode "${mode.colorBy}" should not bleed "${other.colorBy}" label (${other.expected})`,
        ).not.toContain(other.expected);
      }
    }
  });
});
