import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type {
  BumpChartRow,
  ComputePassMapInput,
  HeatmapEvent,
  PassNetworkEdge,
  PassNetworkNode,
  PizzaChartRow,
  RadarChartRow,
  TerritoryEvent,
} from "../src/compute/index.js";
import type { Shot } from "@withqwerty/campos-schema";

import { ExportFrame, createExportFrameSpec } from "../src/index";
import {
  buildEmptyStateSpec,
  buildLongTextSpec,
} from "../../static/test/fixtures/export-fixtures.js";

afterEach(cleanup);

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

const scatterPoints = [
  { id: "saka", player: "Saka", xg: 8.2, goals: 14, team: "Arsenal" },
  { id: "salah", player: "Salah", xg: 12.5, goals: 18, team: "Liverpool" },
];

const radarRows: RadarChartRow[] = [
  { metric: "Goals", value: 14, percentile: 92, category: "Attack" },
  { metric: "Assists", value: 9, percentile: 88, category: "Creation" },
  { metric: "Pressures", value: 40, percentile: 71, category: "Defending" },
];

describe("createExportFrameSpec", () => {
  it("forces staticMode on BumpChart exports", () => {
    const spec = createExportFrameSpec({
      title: "Table trend",
      chart: {
        kind: "bump-chart",
        props: {
          rows: bumpRows,
        },
      },
    });

    expect(spec.chart.kind).toBe("bump-chart");
    expect(spec.version).toBe(1);
    expect(spec.preset).toBe("share-card");
    expect(spec.theme).toBe("light");
    expect(spec.chart.kind).toBe("bump-chart");
  });

  it("derives dimensions and dark background from preset and theme", () => {
    const spec = createExportFrameSpec({
      preset: "story",
      theme: "dark",
      chart: {
        kind: "bump-chart",
        props: {
          rows: bumpRows,
        },
      },
    });

    expect(spec.width).toBe(1080);
    expect(spec.height).toBe(1920);
    expect(spec.background).toEqual({ kind: "theme", token: "canvas" });
  });

  it("preserves explicit solid background overrides", () => {
    const spec = createExportFrameSpec({
      background: { kind: "solid", color: "#f8fafc" },
      chart: {
        kind: "bump-chart",
        props: {
          rows: bumpRows,
        },
      },
    });

    expect(spec.background).toEqual({ kind: "solid", color: "#f8fafc" });
  });

  it("rejects unsupported BumpChart HTML/logo label features", () => {
    expect(() =>
      createExportFrameSpec({
        chart: {
          kind: "bump-chart",
          props: {
            rows: bumpRows,
            teamLogos: { LIV: "https://example.com/liv.png" },
          } as never,
        },
      }),
    ).toThrow(/teamLogos/i);

    expect(() =>
      createExportFrameSpec({
        chart: {
          kind: "bump-chart",
          props: {
            rows: bumpRows,
            renderEndLabel: () => "Liverpool",
          } as never,
        },
      }),
    ).toThrow(/renderEndLabel/i);
  });

  it("rejects unsupported PizzaChart center images", () => {
    expect(() =>
      createExportFrameSpec({
        chart: {
          kind: "pizza-chart",
          props: {
            rows: pizzaRows,
            centerContent: {
              kind: "crest",
              src: "https://example.com/crest.png",
            },
          } as never,
        } as never,
      }),
    ).toThrow(/centerContent/i);
  });

  it("rejects unsupported Formation export asset and bench branches", () => {
    expect(() =>
      createExportFrameSpec({
        chart: {
          kind: "formation",
          props: {
            formation: "4-3-3",
            markerComposition: { glyph: "photo" },
          } as never,
        } as never,
      }),
    ).toThrow(/photo/i);

    expect(() =>
      createExportFrameSpec({
        chart: {
          kind: "formation",
          props: {
            formation: "4-3-3",
            substitutes: [{ label: "Trossard", number: 19 }],
          } as never,
        } as never,
      }),
    ).toThrow(/substitutes/i);
  });

  it("rejects callback and map style values in the stable export contract", () => {
    expect(() =>
      createExportFrameSpec({
        chart: {
          kind: "shot-map",
          props: {
            shots,
            trajectories: {
              stroke: () => "#d33",
            },
          } as never,
        } as never,
      }),
    ).toThrow(/callback style values/i);

    expect(() =>
      createExportFrameSpec({
        chart: {
          kind: "pass-map",
          props: {
            passes,
            lines: {
              stroke: {
                by: () => "complete",
                values: { complete: "#2563eb" },
              },
            },
          } as never,
        } as never,
      }),
    ).toThrow(/mapped style values/i);
  });

  it("rejects unsupported Formation badge and cutout photo branches", () => {
    expect(() =>
      createExportFrameSpec({
        chart: {
          kind: "formation",
          props: {
            formation: "4-3-3",
            markerComposition: { glyph: "photo-cutout" },
          } as never,
        } as never,
      }),
    ).toThrow(/photo/i);

    expect(() =>
      createExportFrameSpec({
        chart: {
          kind: "formation",
          props: {
            formation: "4-3-3",
            markerBadges: {
              prefix: () => "C",
            },
          } as never,
        } as never,
      }),
    ).toThrow(/markerBadges/i);
  });

  it("rejects Formation markerComposition.slots in export", () => {
    expect(() =>
      createExportFrameSpec({
        chart: {
          kind: "formation",
          props: {
            formation: "4-3-3",
            markerComposition: { slots: { bottomRight: () => null } },
          } as never,
        } as never,
      }),
    ).toThrow(/slot/i);
  });

  it("rejects dual-Formation substitutes in export", () => {
    expect(() =>
      createExportFrameSpec({
        chart: {
          kind: "formation",
          props: {
            home: {
              formation: "4-3-3",
              players: [],
              substitutes: [{ label: "Trossard", number: 19 }],
            },
            away: { formation: "4-4-2", players: [] },
          } as never,
        } as never,
      }),
    ).toThrow(/substitutes/i);
  });

  it("forces XGTimeline exports into the static no-crosshair branch", () => {
    const spec = createExportFrameSpec({
      chart: {
        kind: "xg-timeline",
        props: {
          shots,
          homeTeam: "home",
          awayTeam: "away",
        },
      },
    });

    expect(spec.chart.kind).toBe("xg-timeline");
  });

  it("rejects unsupported chart kinds explicitly", () => {
    expect(() =>
      createExportFrameSpec({
        chart: {
          kind: "kde",
          props: { events: [] },
        } as never,
      }),
    ).toThrow(/unsupported export chart kind/i);
  });
});

describe("<ExportFrame />", () => {
  it("renders export card copy and chart preview from a spec", () => {
    const spec = createExportFrameSpec({
      eyebrow: "Scouting",
      theme: "dark",
      title: "Forward profile",
      subtitle: "Premier League sample",
      footer: "Data: internal",
      chart: {
        kind: "pizza-chart",
        props: {
          rows: pizzaRows,
          centerContent: { kind: "initials", label: "RW" },
        },
      },
    });

    const { getByText, getByLabelText } = render(<ExportFrame spec={spec} />);

    expect(getByText("Scouting")).toBeInTheDocument();
    expect(getByText("Forward profile")).toBeInTheDocument();
    expect(getByText("Premier League sample")).toBeInTheDocument();
    expect(getByText("Data: internal")).toBeInTheDocument();
    expect(getByLabelText("Pizza chart: 4 metrics")).toBeInTheDocument();
  });

  it("previews newly exportable chart kinds", () => {
    const formation = createExportFrameSpec({
      title: "Lineup",
      chart: {
        kind: "formation",
        props: {
          formation: "4-3-3",
          teamLabel: "Arsenal",
        },
      },
    });
    const territory = createExportFrameSpec({
      title: "Territory",
      chart: {
        kind: "territory",
        props: {
          events: territoryEvents,
        },
      },
    });
    const passNetwork = createExportFrameSpec({
      title: "Pass network",
      chart: {
        kind: "pass-network",
        props: {
          nodes: passNetworkNodes,
          edges: passNetworkEdges,
        },
      },
    });

    const { getByLabelText: getFormationLabel, unmount } = render(
      <ExportFrame spec={formation} />,
    );
    expect(getFormationLabel(/4-3-3 formation/)).toBeInTheDocument();
    unmount();

    const { getByLabelText: getTerritoryLabel, unmount: unmountTerritory } = render(
      <ExportFrame spec={territory} />,
    );
    expect(getTerritoryLabel(/Territory:/)).toBeInTheDocument();
    unmountTerritory();

    const { getByLabelText: getPassNetworkLabel } = render(
      <ExportFrame spec={passNetwork} />,
    );
    expect(getPassNetworkLabel(/Passing network:/)).toBeInTheDocument();
  });

  it("previews the remaining Phase 1 export chart kinds", () => {
    const specs = [
      createExportFrameSpec({
        title: "Shots",
        chart: { kind: "shot-map", props: { shots } },
      }),
      createExportFrameSpec({
        title: "Passes",
        chart: { kind: "pass-map", props: { passes } },
      }),
      createExportFrameSpec({
        title: "Heat",
        chart: { kind: "heatmap", props: { events: heatmapEvents } },
      }),
      createExportFrameSpec({
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
      createExportFrameSpec({
        title: "Timeline",
        chart: {
          kind: "xg-timeline",
          props: { shots, homeTeam: "home", awayTeam: "away" },
        },
      }),
      createExportFrameSpec({
        title: "Radar",
        chart: { kind: "radar-chart", props: { rows: radarRows } },
      }),
    ];

    for (const spec of specs) {
      const { getByLabelText, unmount } = render(<ExportFrame spec={spec} />);
      expect(getByLabelText("Export frame preview")).toBeInTheDocument();
      unmount();
    }
  });

  it("renders long-text export copy without dropping the bounded frame surface", () => {
    const spec = buildLongTextSpec(createExportFrameSpec);

    const { getByText } = render(<ExportFrame spec={spec} />);

    expect(
      getByText(/Forward profile with intentionally overlong titling/i),
    ).toBeInTheDocument();
    expect(getByText(/Premier League plus European competitions/i)).toBeInTheDocument();
    expect(getByText(/Source: internal model/i)).toBeInTheDocument();
  });

  it("renders a supported empty-state export card", () => {
    const spec = buildEmptyStateSpec(createExportFrameSpec);

    const { getByText, getByLabelText } = render(<ExportFrame spec={spec} />);

    expect(getByText("Empty export state")).toBeInTheDocument();
    expect(getByText("No event data available for this card")).toBeInTheDocument();
    expect(getByText("No event data")).toBeInTheDocument();
    expect(getByLabelText("Heatmap: no events")).toBeInTheDocument();
    expect(getByLabelText("Export frame preview")).toBeInTheDocument();
  });
});
