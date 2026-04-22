import { describe, expect, it } from "vitest";

import { computeScatterPlot } from "../../src/compute/index";
import {
  playerFinishingSample,
  type PlayerFinishingPoint,
} from "./fixtures/scatterplot/player-finishing-sample";

type PlayerStat = {
  name: string;
  xg: number;
  shots: number;
  team: string;
  minutes: number;
  goals: number;
};

const samplePoints: PlayerStat[] = [
  { name: "Saka", xg: 8.2, shots: 60, team: "Arsenal", minutes: 2800, goals: 14 },
  { name: "Salah", xg: 12.5, shots: 85, team: "Liverpool", minutes: 2600, goals: 18 },
  { name: "Haaland", xg: 18.1, shots: 95, team: "Man City", minutes: 2200, goals: 27 },
  { name: "Watkins", xg: 10.3, shots: 72, team: "Villa", minutes: 2700, goals: 13 },
  { name: "Palmer", xg: 11.8, shots: 78, team: "Chelsea", minutes: 2900, goals: 16 },
];

describe("computeScatterPlot", () => {
  it("returns empty state for empty points", () => {
    const model = computeScatterPlot({
      points: [] as PlayerStat[],
      xKey: "xg",
      yKey: "shots",
    });

    expect(model.meta.empty).toBe(true);
    expect(model.emptyState).toEqual({ message: "No plottable data" });
    expect(model.plot.markers).toEqual([]);
    expect(model.plot.labels).toEqual([]);
    expect(model.plot.guides).toEqual([]);
    expect(model.plot.regions).toEqual([]);
  });

  it("computes markers for a single point", () => {
    const model = computeScatterPlot({
      points: [samplePoints[0] as PlayerStat],
      xKey: "xg",
      yKey: "shots",
    });

    expect(model.meta.empty).toBe(false);
    expect(model.plot.markers).toHaveLength(1);
    // Axes should have nice domains that contain the value
    expect(model.axes.x.domain[0]).toBeLessThanOrEqual(8.2);
    expect(model.axes.x.domain[1]).toBeGreaterThanOrEqual(8.2);
    expect(model.axes.y.domain[0]).toBeLessThanOrEqual(60);
    expect(model.axes.y.domain[1]).toBeGreaterThanOrEqual(60);
  });

  it("computes correct marker positions for multiple points", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      xKey: "xg",
      yKey: "shots",
    });

    expect(model.meta.empty).toBe(false);
    expect(model.plot.markers).toHaveLength(5);

    // Markers should have finite cx/cy values within the frame (the outer
    // visible rect). With axis-padding, plotArea is inset from frame and a
    // marker at the data domain edge draws with its outer radius bleeding
    // into the gutter between plotArea and frame — that's the whole point.
    for (const marker of model.plot.markers) {
      expect(Number.isFinite(marker.cx)).toBe(true);
      expect(Number.isFinite(marker.cy)).toBe(true);
      expect(marker.cx - marker.r).toBeGreaterThanOrEqual(model.layout.frame.x);
      expect(marker.cx + marker.r).toBeLessThanOrEqual(
        model.layout.frame.x + model.layout.frame.width,
      );
      expect(marker.cy - marker.r).toBeGreaterThanOrEqual(model.layout.frame.y);
      expect(marker.cy + marker.r).toBeLessThanOrEqual(
        model.layout.frame.y + model.layout.frame.height,
      );
    }
  });

  it("handles degenerate domain (all same x value)", () => {
    const sameX = samplePoints.map((p) => ({ ...p, xg: 10 }));
    const model = computeScatterPlot({
      points: sameX,
      xKey: "xg",
      yKey: "shots",
    });

    expect(model.meta.empty).toBe(false);
    // All markers should have the same cx (center of plot area horizontally)
    const cxValues = new Set(model.plot.markers.map((m) => m.cx));
    expect(cxValues.size).toBe(1);
    // cx should be in the middle area
    expect(
      Number.isFinite((model.plot.markers[0] as (typeof model.plot.markers)[0]).cx),
    ).toBe(true);
  });

  it("uses the fixed zero-config fill when no React-side style encoding is supplied", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      xKey: "xg",
      yKey: "shots",
    });

    expect(model.legends).toHaveLength(0);
    for (const marker of model.plot.markers) {
      expect(marker.fill).toBe("#4665d8");
    }
  });

  it("keeps a uniform radius when no React-side size encoding is supplied", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      xKey: "xg",
      yKey: "shots",
    });

    for (const marker of model.plot.markers) {
      expect(marker.r).toBe(3.5);
    }
  });

  it("does not emit legends for color or size encodings in the core default path", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      xKey: "xg",
      yKey: "shots",
    });

    expect(model.legends).toEqual([]);
  });

  it("keeps tooltips focused on the canonical point fields", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      xKey: "xg",
      yKey: "shots",
      labelKey: "name",
    });

    const tooltipRows = model.plot.markers[0]?.tooltip.rows ?? [];
    expect(tooltipRows.some((row) => row.label === "xg")).toBe(true);
    expect(tooltipRows.some((row) => row.label === "shots")).toBe(true);
  });

  it("populates tooltip rows with xKey and yKey values", () => {
    const model = computeScatterPlot({
      points: [samplePoints[0] as PlayerStat],
      xKey: "xg",
      yKey: "shots",
    });

    const tooltip = (model.plot.markers[0] as (typeof model.plot.markers)[0]).tooltip;
    expect(tooltip.rows.some((r: { label: string }) => r.label === "xg")).toBe(true);
    expect(tooltip.rows.some((r: { label: string }) => r.label === "shots")).toBe(true);
  });

  it("uses custom axis labels when provided", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      xKey: "xg",
      yKey: "shots",
      xLabel: "Expected Goals",
      yLabel: "Total Shots",
    });

    expect(model.axes.x.label).toBe("Expected Goals");
    expect(model.axes.y.label).toBe("Total Shots");
  });

  it("produces a reference line when referenceLine is y=x", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      xKey: "xg",
      yKey: "goals",
      referenceLine: "y=x",
    });

    expect(model.plot.referenceLine).not.toBeNull();
    const refLine = model.plot.referenceLine as NonNullable<
      typeof model.plot.referenceLine
    >;
    expect(refLine.x1).toBeLessThan(refLine.x2);
    expect(refLine.y1).toBeGreaterThan(refLine.y2);
  });

  it("filters out points with non-finite values", () => {
    const withBad = [
      ...samplePoints,
      { name: "Bad", xg: NaN, shots: 10, team: "X", minutes: 0, goals: 0 },
      { name: "Inf", xg: Infinity, shots: 10, team: "X", minutes: 0, goals: 0 },
    ];
    const model = computeScatterPlot({
      points: withBad,
      xKey: "xg",
      yKey: "shots",
    });

    expect(model.plot.markers).toHaveLength(samplePoints.length);
  });

  it("sets labelKey on markers and tooltip", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      xKey: "xg",
      yKey: "shots",
      labelKey: "name",
    });

    const marker0 = model.plot.markers[0] as (typeof model.plot.markers)[0];
    expect(marker0.label).toBe("Saka");
    expect((marker0.tooltip.rows[0] as (typeof marker0.tooltip.rows)[0]).label).toBe(
      "Label",
    );
  });

  it("provides a valid accessible label", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      xKey: "xg",
      yKey: "shots",
    });

    expect(model.meta.accessibleLabel).toContain("5 points");
    expect(model.meta.accessibleLabel).toContain("xg");
    expect(model.meta.accessibleLabel).toContain("shots");
  });

  it("creates visible labels and emphasized markers when labelIds are provided", () => {
    const model = computeScatterPlot({
      points: playerFinishingSample,
      idKey: "playerId",
      xKey: "xg",
      yKey: "goals",
      labelKey: "name",
      labelIds: ["salah", "haaland"],
    });

    expect(model.plot.labels).toHaveLength(2);
    expect(model.plot.labels.map((label) => label.text)).toEqual(
      expect.arrayContaining(["Mohamed Salah", "Erling Haaland"]),
    );
    expect(model.plot.markers.filter((marker) => marker.emphasized)).toHaveLength(2);
  });

  it("uses manual labeling by default", () => {
    const model = computeScatterPlot({
      points: playerFinishingSample,
      idKey: "playerId",
      xKey: "xg",
      yKey: "goals",
      labelKey: "name",
      labelIds: ["salah", "haaland"],
    });

    expect(model.plot.labels.map((label) => label.id)).toEqual(
      expect.arrayContaining(["salah", "haaland"]),
    );
  });

  it("labels edge points when labelStrategy is extremes", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      idKey: "name",
      xKey: "xg",
      yKey: "shots",
      labelKey: "name",
      labelStrategy: "extremes",
      autoLabelCount: 4,
    });

    const ids = model.plot.labels.map((label) => label.id);
    expect(ids).toContain("Saka");
    expect(ids).toContain("Haaland");
  });

  it("labels top performers when labelStrategy is outliers", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      idKey: "name",
      xKey: "xg",
      yKey: "shots",
      labelKey: "name",
      labelStrategy: "outliers",
      autoLabelCount: 2,
    });

    const ids = model.plot.labels.map((label) => label.id);
    // Outliers selects highest x, highest y, and highest combined — not distance from center
    expect(ids).toContain("Haaland");
    expect(ids).toContain("Salah");
  });

  it("maps guide and region inputs into plot geometry", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      idKey: "name",
      xKey: "xg",
      yKey: "shots",
      labelKey: "name",
      labelIds: ["Salah"],
      guides: [
        { axis: "x", value: 10, label: "Median xG" },
        { axis: "y", value: 75, label: "Median shots" },
      ],
      regions: [
        {
          x1: 0,
          x2: 10,
          y1: 0,
          y2: 75,
          fill: "#f59e0b",
          label: "Lower-left",
        },
      ],
    });

    expect(model.plot.guides).toHaveLength(2);
    expect(model.plot.guides.every((guide) => Number.isFinite(guide.x1))).toBe(true);
    expect(model.plot.regions).toHaveLength(1);
    expect(model.plot.regions[0]?.label).toBe("Lower-left");
    expect(model.plot.regions[0]?.labelMode).toBe("none");
  });

  it("preserves explicit region label modes", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      xKey: "xg",
      yKey: "shots",
      regions: [
        {
          x1: 0,
          x2: 10,
          y1: 0,
          y2: 75,
          fill: "#dbeafe",
          label: "Buffered",
          labelMode: "buffer",
        },
        {
          x1: 10,
          x2: 20,
          y1: 0,
          y2: 75,
          fill: "#fee2e2",
          label: "Avoid",
          labelMode: "avoid",
        },
      ],
    });

    expect(model.plot.regions[0]?.labelMode).toBe("buffer");
    expect(model.plot.regions[1]?.labelMode).toBe("avoid");
  });

  it("uses a stable marker id when idKey is provided", () => {
    const model = computeScatterPlot({
      points: playerFinishingSample,
      idKey: "playerId",
      xKey: "xg",
      yKey: "goals",
      labelKey: "name",
    });

    expect((model.plot.markers[0] as (typeof model.plot.markers)[0]).id).toBe("haaland");
    expect((model.plot.markers[1] as (typeof model.plot.markers)[0]).id).toBe("salah");
  });

  it("preserves marker identity across reordering when idKey is provided", () => {
    const reordered = [...playerFinishingSample].reverse();
    const original = computeScatterPlot({
      points: playerFinishingSample,
      idKey: "playerId",
      xKey: "xg",
      yKey: "goals",
      labelKey: "name",
    });
    const next = computeScatterPlot({
      points: reordered,
      idKey: "playerId",
      xKey: "xg",
      yKey: "goals",
      labelKey: "name",
    });

    const originalById = new Map(
      original.plot.markers.map((marker) => [marker.id, marker]),
    );
    for (const marker of next.plot.markers) {
      const before = originalById.get(marker.id);
      expect(before).toBeDefined();
      expect((before as NonNullable<typeof before>).label).toBe(marker.label);
    }
  });

  it("still falls back to index-based ids when idKey is omitted", () => {
    const model = computeScatterPlot<PlayerFinishingPoint>({
      points: playerFinishingSample,
      xKey: "xg",
      yKey: "goals",
      labelKey: "name",
    });

    expect((model.plot.markers[0] as (typeof model.plot.markers)[0]).id).toBe("0");
    expect((model.plot.markers[1] as (typeof model.plot.markers)[0]).id).toBe("1");
  });

  it("resolves guide value 'median' from data", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      xKey: "xg",
      yKey: "shots",
      guides: [{ axis: "x", value: "median", label: "Median xG" }],
    });

    expect(model.plot.guides).toHaveLength(1);
    // Median of [8.2, 10.3, 11.8, 12.5, 18.1] = 11.8
    const guide = model.plot.guides[0] as (typeof model.plot.guides)[0];
    expect(guide.label).toBe("Median xG");
    expect(Number.isFinite(guide.x1)).toBe(true);
  });

  it("resolves guide value 'mean' from data", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      xKey: "xg",
      yKey: "shots",
      guides: [{ axis: "y", value: "mean", label: "Avg Shots" }],
    });

    expect(model.plot.guides).toHaveLength(1);
    const guide = model.plot.guides[0] as (typeof model.plot.guides)[0];
    expect(guide.label).toBe("Avg Shots");
    expect(Number.isFinite(guide.y1)).toBe(true);
  });

  it("produces ghost markers in explicit mode", () => {
    const allPlayers = playerFinishingSample;
    const filtered = allPlayers.slice(0, 2); // just Haaland and Salah

    const model = computeScatterPlot({
      points: filtered,
      ghost: { mode: "explicit", points: allPlayers },
      idKey: "playerId",
      xKey: "xg",
      yKey: "goals",
    });

    expect(model.plot.markers).toHaveLength(2);
    expect(model.plot.ghostMarkers).toHaveLength(5);
    // Ghost markers should have ghost- prefixed ids
    expect(model.plot.ghostMarkers[0]?.id).toMatch(/^ghost-/);
  });

  it("expands domain to include explicit ghost points", () => {
    const filtered = [playerFinishingSample[0] as PlayerFinishingPoint]; // just Haaland
    const ghostPoints = [
      {
        playerId: "far",
        name: "Far Away",
        team: "X",
        xg: 50,
        goals: 50,
        shots: 10,
        minutes: 900,
      },
    ];

    const model = computeScatterPlot({
      points: filtered,
      ghost: { mode: "explicit", points: ghostPoints },
      idKey: "playerId",
      xKey: "xg",
      yKey: "goals",
    });

    // Domain should be wide enough to include the ghost point at xg=50
    expect(model.axes.x.domain[1]).toBeGreaterThanOrEqual(50);
    expect(model.axes.y.domain[1]).toBeGreaterThanOrEqual(50);
  });

  it("moves unlabeled markers to ghostMarkers in unlabeled mode", () => {
    const model = computeScatterPlot({
      points: playerFinishingSample,
      ghost: { mode: "unlabeled" },
      idKey: "playerId",
      xKey: "xg",
      yKey: "goals",
      labelKey: "name",
      labelIds: ["salah", "haaland"],
    });

    // 2 labeled → main markers, 3 unlabeled → ghost
    expect(model.plot.markers).toHaveLength(2);
    expect(model.plot.ghostMarkers).toHaveLength(3);
    const mainIds = model.plot.markers.map((m) => m.id);
    expect(mainIds).toContain("salah");
    expect(mainIds).toContain("haaland");
  });

  it("moves below-guide markers to ghostMarkers in below-guides mode", () => {
    const model = computeScatterPlot({
      points: playerFinishingSample,
      ghost: { mode: "below-guides" },
      idKey: "playerId",
      xKey: "xg",
      yKey: "goals",
      guides: [
        { axis: "x", value: "median" },
        { axis: "y", value: "median" },
      ],
    });

    // Points below median on both axes should be ghosts
    expect(model.plot.ghostMarkers.length).toBeGreaterThan(0);
    expect(model.plot.markers.length).toBeGreaterThan(0);
    expect(model.plot.ghostMarkers.length + model.plot.markers.length).toBe(
      playerFinishingSample.length,
    );
  });

  it("produces empty ghostMarkers when no ghost config is provided", () => {
    const model = computeScatterPlot({
      points: samplePoints,
      xKey: "xg",
      yKey: "shots",
    });

    expect(model.plot.ghostMarkers).toEqual([]);
  });
});
