export const bumpRows = [
  { team: "LIV", label: "Liverpool", timepoint: 1, rank: 1 },
  { team: "LIV", label: "Liverpool", timepoint: 2, rank: 1 },
  { team: "MCI", label: "Man City", timepoint: 1, rank: 2 },
  { team: "MCI", label: "Man City", timepoint: 2, rank: 3 },
];

export const pizzaRows = [
  { metric: "Goals", percentile: 92, category: "Attacking", displayValue: "92" },
  { metric: "Shots", percentile: 78, category: "Attacking", displayValue: "78" },
  { metric: "Passes", percentile: 45, category: "Possession", displayValue: "45" },
  { metric: "Tackles", percentile: 24, category: "Defending", displayValue: "24" },
];

export const territoryEvents = [
  { x: 12, y: 18, team: "Arsenal" },
  { x: 75, y: 62, team: "Arsenal" },
  { x: 50, y: 50, team: "Wolves" },
];

export const passNetworkNodes = [
  { id: "gk", label: "Raya", x: 10, y: 50, passCount: 30 },
  { id: "cb", label: "Saliba", x: 30, y: 45, passCount: 42 },
];

export const passNetworkEdges = [{ sourceId: "gk", targetId: "cb", passCount: 12 }];

export const shots = [
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
  {
    kind: "shot",
    id: "shot-2",
    matchId: "m1",
    teamId: "away",
    playerId: "p2",
    playerName: "Solanke",
    minute: 64,
    addedMinute: null,
    second: 0,
    period: 2,
    x: 84,
    y: 57,
    xg: 0.12,
    outcome: "saved",
    bodyPart: "right-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: "regular-play",
    provider: "opta",
    providerEventId: "shot-2",
  },
];

export const passes = [
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

export const heatmapEvents = [
  { x: 20, y: 30 },
  { x: 55, y: 44 },
];

export const scatterPoints = [
  { id: "saka", player: "Saka", xg: 8.2, goals: 14, team: "Arsenal" },
  { id: "salah", player: "Salah", xg: 12.5, goals: 18, team: "Liverpool" },
];

export const radarRows = [
  { metric: "Goals", value: 14, percentile: 92, category: "Attack" },
  { metric: "Assists", value: 9, percentile: 88, category: "Creation" },
  { metric: "Pressures", value: 40, percentile: 71, category: "Defending" },
];

export function buildGoldenSpecs(createExportFrameSpec) {
  return [
    {
      id: "bump-chart",
      spec: createExportFrameSpec({
        title: "Table trend",
        chart: { kind: "bump-chart", props: { rows: bumpRows } },
      }),
    },
    {
      id: "pizza-chart",
      spec: createExportFrameSpec({
        title: "Forward profile",
        subtitle: "Premier League sample",
        chart: {
          kind: "pizza-chart",
          props: {
            rows: pizzaRows,
            centerContent: { kind: "initials", label: "RW" },
          },
        },
      }),
    },
    {
      id: "formation",
      spec: createExportFrameSpec({
        title: "Lineup",
        chart: {
          kind: "formation",
          props: {
            formation: "4-3-3",
            teamLabel: "Arsenal",
          },
        },
      }),
    },
    {
      id: "pass-network",
      spec: createExportFrameSpec({
        title: "Pass network",
        chart: {
          kind: "pass-network",
          props: { nodes: passNetworkNodes, edges: passNetworkEdges },
        },
      }),
    },
    {
      id: "territory",
      spec: createExportFrameSpec({
        title: "Territory",
        chart: { kind: "territory", props: { events: territoryEvents } },
      }),
    },
    {
      id: "shot-map",
      spec: createExportFrameSpec({
        title: "Shots",
        chart: { kind: "shot-map", props: { shots } },
      }),
    },
    {
      id: "pass-map",
      spec: createExportFrameSpec({
        title: "Passes",
        chart: { kind: "pass-map", props: { passes } },
      }),
    },
    {
      id: "pass-flow",
      spec: createExportFrameSpec({
        title: "Pass flow",
        chart: { kind: "pass-flow", props: { passes, minCountForArrow: 1 } },
      }),
    },
    {
      id: "heatmap",
      spec: createExportFrameSpec({
        title: "Heat",
        chart: { kind: "heatmap", props: { events: heatmapEvents } },
      }),
    },
    {
      id: "scatter-plot",
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
    },
    {
      id: "xg-timeline",
      spec: createExportFrameSpec({
        title: "Timeline",
        chart: {
          kind: "xg-timeline",
          props: { shots, homeTeam: "home", awayTeam: "away" },
        },
      }),
    },
    {
      id: "radar-chart",
      spec: createExportFrameSpec({
        title: "Radar",
        chart: { kind: "radar-chart", props: { rows: radarRows } },
      }),
    },
  ];
}

export function buildLongTextSpec(createExportFrameSpec) {
  return createExportFrameSpec({
    eyebrow:
      "Elite Scouting Department / Multi-Competition Sample / Long-Form Editorial Export",
    title:
      "Forward profile with intentionally overlong titling to stress the bounded export frame without introducing arbitrary JSX composition",
    subtitle:
      "Premier League plus European competitions, percentile context, stylistic notes, and secondary metadata in one deliberately dense subtitle string",
    footer:
      "Source: internal model + committed demo fixture. This footer is intentionally long to test the lower frame copy path under export constraints.",
    chart: {
      kind: "pizza-chart",
      props: {
        rows: pizzaRows,
        centerContent: { kind: "initials", label: "RW" },
      },
    },
  });
}

export function buildEmptyStateSpec(createExportFrameSpec) {
  return createExportFrameSpec({
    title: "Empty export state",
    subtitle: "No event data available for this card",
    chart: {
      kind: "heatmap",
      props: {
        events: [],
        metricLabel: "Touches",
      },
    },
  });
}

export function buildThemeSpecs(createExportFrameSpec) {
  const base = {
    title: "Theme regression",
    subtitle: "Same chart, different frame theme",
    chart: {
      kind: "pizza-chart",
      props: {
        rows: pizzaRows,
        centerContent: { kind: "initials", label: "RW" },
      },
    },
  };

  return {
    light: createExportFrameSpec(base),
    dark: createExportFrameSpec({
      ...base,
      theme: "dark",
    }),
  };
}
