import { describe, expect, it } from "vitest";

import { computeHeatmap, type HeatmapEvent } from "../../src/compute/index";

function makeEvents(coords: Array<{ x: number; y: number }>): HeatmapEvent[] {
  return coords.map((c) => ({ x: c.x, y: c.y }));
}

describe("computeHeatmap", () => {
  it("returns emptyState when events array is empty", () => {
    const model = computeHeatmap({ events: [] });

    expect(model.meta.empty).toBe(true);
    expect(model.emptyState).toEqual({ message: "No event data" });
    expect(model.scaleBar).toBeNull();
    expect(model.grid.cells.every((c) => c.count === 0)).toBe(true);
  });

  it("bins a single event into the correct cell", () => {
    const model = computeHeatmap({ events: makeEvents([{ x: 50, y: 50 }]) });

    expect(model.meta.empty).toBe(false);
    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    expect(nonZero).toHaveLength(1);
    const cell = nonZero[0] as (typeof nonZero)[0];
    expect(cell.count).toBe(1);
    expect(cell.intensity).toBe(1);

    // All zero-count cells should be transparent
    const zeroCells = model.grid.cells.filter((c) => c.count === 0);
    expect(zeroCells.every((c) => c.fill === "rgba(0,0,0,0)")).toBe(true);
    expect(zeroCells.every((c) => c.opacity === 0)).toBe(true);
  });

  it("bins boundary events correctly — x=0 goes to col 0", () => {
    const model = computeHeatmap({
      events: makeEvents([{ x: 0, y: 0 }]),
    });

    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    expect(nonZero).toHaveLength(1);
    const cell = nonZero[0] as (typeof nonZero)[0];
    expect(cell.col).toBe(0);
    expect(cell.row).toBe(0);
  });

  it("bins boundary events correctly — x=100 goes to last col", () => {
    const model = computeHeatmap({
      events: makeEvents([{ x: 100, y: 100 }]),
    });

    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    expect(nonZero).toHaveLength(1);
    const cell = nonZero[0] as (typeof nonZero)[0];
    expect(cell.col).toBe(11); // default gridX=12
    expect(cell.row).toBe(7); // default gridY=8
  });

  it("bins boundary events correctly — y=0, y=100", () => {
    const model = computeHeatmap({
      events: makeEvents([
        { x: 50, y: 0 },
        { x: 50, y: 100 },
      ]),
    });

    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    expect(nonZero).toHaveLength(2);
    const rows = nonZero.map((c) => c.row).sort();
    expect(rows).toEqual([0, 7]);
  });

  it("accumulates dense clusters", () => {
    // All events in the same small area
    const events = makeEvents(Array.from({ length: 20 }, () => ({ x: 75, y: 25 })));
    const model = computeHeatmap({ events });

    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    expect(nonZero).toHaveLength(1);
    const cell = nonZero[0] as (typeof nonZero)[0];
    expect(cell.count).toBe(20);
    expect(cell.intensity).toBe(1);
  });

  it("puts all events in the same spot into one cell", () => {
    const events = makeEvents(Array.from({ length: 5 }, () => ({ x: 10, y: 10 })));
    const model = computeHeatmap({ events });

    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    expect(nonZero).toHaveLength(1);
    const cell = nonZero[0] as (typeof nonZero)[0];
    expect(cell.count).toBe(5);
  });

  it("filters out non-finite coordinates", () => {
    const events: HeatmapEvent[] = [
      { x: 50, y: 50 },
      { x: Number.NaN, y: 50 },
      { x: 50, y: Number.POSITIVE_INFINITY },
      { x: Number.NEGATIVE_INFINITY, y: 20 },
    ];
    const model = computeHeatmap({ events });

    const totalCount = model.grid.cells.reduce((sum, c) => sum + c.count, 0);
    expect(totalCount).toBe(1);
    expect(model.meta.warnings).toContain(
      "3 events excluded due to non-finite coordinates.",
    );
  });

  it("filters out null x or y", () => {
    const events = [
      { x: 50, y: 50 },
      { x: null as unknown as number, y: 50 },
      { x: 50, y: null as unknown as number },
    ] as HeatmapEvent[];
    const model = computeHeatmap({ events });

    const totalCount = model.grid.cells.reduce((sum, c) => sum + c.count, 0);
    expect(totalCount).toBe(1);
  });

  it("clamps out-of-range coordinates into boundary bins", () => {
    const events = makeEvents([
      { x: 50, y: 50 },
      { x: -1, y: 50 },
      { x: 101, y: 50 },
      { x: 50, y: -5 },
      { x: 50, y: 200 },
    ]);
    const model = computeHeatmap({ events });

    const totalCount = model.grid.cells.reduce((sum, c) => sum + c.count, 0);
    expect(totalCount).toBe(5);
  });

  it('applies crop="half" to the binned data model, not just the viewport', () => {
    const model = computeHeatmap({
      events: makeEvents([
        { x: 20, y: 20 },
        { x: 60, y: 20 },
        { x: 100, y: 80 },
      ]),
      crop: "half",
      gridX: 5,
      gridY: 2,
    });

    const totalCount = model.grid.cells.reduce((sum, c) => sum + c.count, 0);
    expect(totalCount).toBe(2);
    expect(model.grid.cells.every((cell) => cell.x >= 50)).toBe(true);
    expect(model.grid.cells[0]?.width).toBeCloseTo(10, 5);
    expect(
      model.grid.cells
        .filter((cell) => cell.count > 0)
        .map((cell) => cell.col)
        .sort(),
    ).toEqual([1, 4]);
  });

  it("uses custom grid size", () => {
    const model = computeHeatmap({
      events: makeEvents([{ x: 50, y: 50 }]),
      gridX: 6,
      gridY: 4,
    });

    expect(model.grid.columns).toBe(6);
    expect(model.grid.rows).toBe(4);
    expect(model.grid.cells).toHaveLength(24);
  });

  it("computes intensity as count / maxCount", () => {
    const events = makeEvents([
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 80, y: 80 },
    ]);
    const model = computeHeatmap({ events });

    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    // The cell with 3 events should have intensity=1
    // The cell with 1 event should have intensity=1/3
    const maxCell = nonZero.find((c) => c.intensity === 1);
    expect(maxCell).toBeDefined();
    expect((maxCell as NonNullable<typeof maxCell>).count).toBe(3);

    const minCell = nonZero.find((c) => c.intensity < 1);
    expect(minCell).toBeDefined();
    expect((minCell as NonNullable<typeof minCell>).count).toBe(1);
    expect((minCell as NonNullable<typeof minCell>).intensity).toBeCloseTo(1 / 3, 5);
  });

  it("exposes scaleBar label via metricLabel prop", () => {
    const model = computeHeatmap({
      events: makeEvents([{ x: 50, y: 50 }]),
      metricLabel: "Passes",
    });
    expect(model.scaleBar?.label).toBe("Passes");
  });

  it('scaleBar label defaults to "Events" when metricLabel is not provided', () => {
    const model = computeHeatmap({ events: makeEvents([{ x: 50, y: 50 }]) });
    expect(model.scaleBar?.label).toBe("Events");
  });

  it("gives zero-count cells transparent fill", () => {
    const model = computeHeatmap({
      events: makeEvents([{ x: 50, y: 50 }]),
    });

    const zeroCells = model.grid.cells.filter((c) => c.count === 0);
    expect(zeroCells.length).toBeGreaterThan(0);
    expect(zeroCells.every((c) => c.fill === "rgba(0,0,0,0)")).toBe(true);
  });

  it("returns a scale bar with domain [0, maxCount] for non-empty data", () => {
    const events = makeEvents([
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 80, y: 80 },
    ]);
    const model = computeHeatmap({ events });

    expect(model.scaleBar).not.toBeNull();
    const scaleBar = model.scaleBar as NonNullable<typeof model.scaleBar>;
    expect(scaleBar.domain).toEqual([0, 2]);
    expect(scaleBar.stops.length).toBeGreaterThan(0);
  });

  it("renders non-empty cells at full opacity", () => {
    const model = computeHeatmap({
      events: makeEvents([
        { x: 10, y: 10 },
        { x: 10, y: 10 },
        { x: 80, y: 80 },
      ]),
    });

    expect(
      model.grid.cells
        .filter((cell) => cell.count > 0)
        .every((cell) => cell.opacity === 1),
    ).toBe(true);
  });

  it("normalizes invalid grid sizes to valid integers", () => {
    const model = computeHeatmap({
      events: makeEvents([{ x: 50, y: 50 }]),
      gridX: 0,
      gridY: 3.6,
    });

    expect(model.grid.columns).toBe(1);
    expect(model.grid.rows).toBe(4);
    expect(model.meta.warnings).toContain("gridX was adjusted to 1.");
    expect(model.meta.warnings).toContain("gridY was adjusted to 4.");
  });

  it("falls back to defaults for non-finite grid sizes", () => {
    const model = computeHeatmap({
      events: makeEvents([{ x: 50, y: 50 }]),
      gridX: Number.NaN,
      gridY: Number.POSITIVE_INFINITY,
    });

    expect(model.grid.columns).toBe(12);
    expect(model.grid.rows).toBe(8);
    expect(model.meta.warnings).toContain("gridX was non-finite and fell back to 12.");
    expect(model.meta.warnings).toContain("gridY was non-finite and fell back to 8.");
  });

  it("default grid is 12x8 producing 96 cells", () => {
    const model = computeHeatmap({ events: makeEvents([{ x: 50, y: 50 }]) });

    expect(model.grid.columns).toBe(12);
    expect(model.grid.rows).toBe(8);
    expect(model.grid.cells).toHaveLength(96);
  });

  it("non-zero cells have viridis-like hex fills", () => {
    const model = computeHeatmap({
      events: makeEvents([{ x: 50, y: 50 }]),
    });

    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    expect(nonZero.every((c) => c.fill.startsWith("#"))).toBe(true);
  });

  // ─── valueMode ──────────────────────────────────────────────────────

  it("defaults valueMode to 'count'", () => {
    const model = computeHeatmap({ events: makeEvents([{ x: 50, y: 50 }]) });
    expect(model.meta.valueMode).toBe("count");
    expect(model.scaleBar?.valueMode).toBe("count");
    // count mode with maxCount=1 produces domain [0, 1]
    expect(model.scaleBar?.domain).toEqual([0, 1]);
  });

  it("count mode: scale bar domain is [0, maxCount]", () => {
    const events = makeEvents([
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 80, y: 80 },
    ]);
    const model = computeHeatmap({ events, valueMode: "count" });
    expect(model.scaleBar?.domain).toEqual([0, 3]);
  });

  it("intensity mode: scale bar domain is [0, 1]", () => {
    const events = makeEvents([
      { x: 10, y: 10 },
      { x: 80, y: 80 },
    ]);
    const model = computeHeatmap({ events, valueMode: "intensity" });
    expect(model.scaleBar?.domain).toEqual([0, 1]);
  });

  it("share mode: cells expose share field and domain is [0, maxShare]", () => {
    // OQ1: share domain is [0, maxShare], not [0, 1]
    const events = makeEvents([
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 10 }, // 3 in one cell
      { x: 80, y: 80 }, // 1 in another cell (total=4)
    ]);
    const model = computeHeatmap({ events, valueMode: "share" });
    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    const maxCell = nonZero.find((c) => c.count === 3);
    const minCell = nonZero.find((c) => c.count === 1);
    expect(maxCell).toBeDefined();
    expect(minCell).toBeDefined();
    expect((maxCell as NonNullable<typeof maxCell>).share).toBeCloseTo(0.75, 5);
    expect((minCell as NonNullable<typeof minCell>).share).toBeCloseTo(0.25, 5);
    expect(model.scaleBar?.domain).toEqual([0, 0.75]);
  });

  it("share mode: denominator uses cropped total not full total", () => {
    // OQ2: crop is a data filter, share denominator follows the crop
    const events = makeEvents([
      { x: 20, y: 50 }, // defensive half — excluded by crop
      { x: 70, y: 50 }, // attacking half — included
      { x: 80, y: 50 }, // attacking half — included
    ]);
    const model = computeHeatmap({
      events,
      valueMode: "share",
      crop: "half",
    });
    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    // 2 cropped events, so each visible cell should be 0.5 not 1/3
    expect(nonZero.length).toBe(2);
    expect(nonZero.every((c) => c.share === 0.5)).toBe(true);
  });

  it("color ramp is invariant across valueMode", () => {
    // OQ1: the color ramp always uses intensity regardless of mode
    const events = makeEvents([
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 80, y: 80 },
    ]);
    const count = computeHeatmap({ events, valueMode: "count" });
    const intensity = computeHeatmap({ events, valueMode: "intensity" });
    const share = computeHeatmap({ events, valueMode: "share" });

    for (let i = 0; i < count.grid.cells.length; i++) {
      expect(count.grid.cells[i]!.fill).toBe(intensity.grid.cells[i]!.fill);
      expect(count.grid.cells[i]!.fill).toBe(share.grid.cells[i]!.fill);
    }
  });

  it("share mode: empty events still echoes valueMode in meta", () => {
    const model = computeHeatmap({ events: [], valueMode: "share" });
    expect(model.meta.valueMode).toBe("share");
    expect(model.meta.empty).toBe(true);
    expect(model.scaleBar).toBeNull();
    // Cell still carries a share field, zero for empty
    expect(model.grid.cells.every((c) => c.share === 0)).toBe(true);
  });

  it("inferno colorscale produces hex fills", () => {
    const model = computeHeatmap({
      events: makeEvents([{ x: 50, y: 50 }]),
      colorScale: "inferno",
    });
    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    expect(nonZero[0]!.fill.startsWith("#")).toBe(true);
  });

  describe("explicit xEdges / yEdges", () => {
    it("uses custom edges to produce non-uniform bins", () => {
      const model = computeHeatmap({
        events: makeEvents([
          { x: 10, y: 50 },
          { x: 60, y: 50 },
        ]),
        xEdges: [0, 25, 75, 100],
        yEdges: [0, 50, 100],
      });
      expect(model.grid.columns).toBe(3);
      expect(model.grid.rows).toBe(2);
      const byColRow = new Map(
        model.grid.cells.map((c) => [`${c.col}:${c.row}`, c] as const),
      );
      expect(byColRow.get("0:1")?.count).toBe(1);
      expect(byColRow.get("1:1")?.count).toBe(1);
    });

    it("assigns boundary values to the lower-index bin, last edge to final", () => {
      const model = computeHeatmap({
        events: makeEvents([
          { x: 25, y: 50 }, // exactly on inner edge → bin 1
          { x: 100, y: 100 }, // last edge, max row → final bin
        ]),
        xEdges: [0, 25, 75, 100],
        yEdges: [0, 50, 100],
      });
      const nonZero = model.grid.cells.filter((c) => c.count > 0);
      expect(nonZero.map((c) => `${c.col}:${c.row}`).sort()).toEqual(["1:1", "2:1"]);
    });

    it("throws on non-monotonic xEdges", () => {
      expect(() => computeHeatmap({ events: [], xEdges: [0, 50, 40, 100] })).toThrow(
        /strictly increasing/,
      );
    });

    it("throws when first edge does not match crop boundary", () => {
      expect(() =>
        computeHeatmap({ events: [], crop: "half", xEdges: [0, 75, 100] }),
      ).toThrow(/must equal 50/);
    });

    it("accepts zoneEdgesInCampos() output", async () => {
      const { zoneEdgesInCampos } = await import("@withqwerty/campos-stadia");
      const { xEdges, yEdges } = zoneEdgesInCampos("20");
      const model = computeHeatmap({
        events: makeEvents([
          { x: 50, y: 50 }, // centre zone
          { x: 90, y: 10 }, // opposition wide-right
        ]),
        xEdges,
        yEdges,
      });
      // 20-zone: 4 bins along length (rows-in-compute = x-axis bins) × 5
      // positional columns on width (rows-in-compute = y-axis bins).
      expect(model.grid.columns).toBe(4); // quarter-length strips on x
      expect(model.grid.rows).toBe(5); // positional: wide | hs | c | hs | wide
      expect(model.grid.cells.filter((c) => c.count > 0).length).toBe(2);
    });
  });
});
