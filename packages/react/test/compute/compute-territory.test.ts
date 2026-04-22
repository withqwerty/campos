import { describe, expect, it } from "vitest";

import { computeTerritory, type TerritoryEvent } from "../../src/compute/index";

function makeEvents(coords: Array<{ x: number; y: number }>): TerritoryEvent[] {
  return coords.map((c) => ({ x: c.x, y: c.y }));
}

describe("computeTerritory", () => {
  // ─── Defaults & shape ────────────────────────────────────────────

  it("returns the empty state when events array is empty", () => {
    const model = computeTerritory({ events: [] });

    expect(model.meta.empty).toBe(true);
    expect(model.emptyState).toEqual({ message: "No event data" });
    expect(model.meta.totalEvents).toBe(0);
    expect(model.grid.cells.every((c) => c.count === 0)).toBe(true);
    expect(model.grid.cells.every((c) => c.share === 0)).toBe(true);
    expect(model.grid.cells.every((c) => c.label === null)).toBe(true);
  });

  it("default grid is 3x3 producing exactly 9 cells", () => {
    const model = computeTerritory({ events: makeEvents([{ x: 50, y: 50 }]) });

    expect(model.meta.grid).toBe("3x3");
    expect(model.grid.columns).toBe(3);
    expect(model.grid.rows).toBe(3);
    expect(model.grid.cells).toHaveLength(9);
  });

  it("5x3 grid produces exactly 15 cells", () => {
    const model = computeTerritory({
      events: makeEvents([{ x: 50, y: 50 }]),
      grid: "5x3",
    });

    expect(model.meta.grid).toBe("5x3");
    expect(model.grid.columns).toBe(5);
    expect(model.grid.rows).toBe(3);
    expect(model.grid.cells).toHaveLength(15);
  });

  it("20-zone preset produces exactly 20 cells", () => {
    const model = computeTerritory({
      events: makeEvents([{ x: 50, y: 50 }]),
      zonePreset: "20",
    });

    expect(model.meta.grid).toBe("20");
    expect(model.grid.columns).toBe(4);
    expect(model.grid.rows).toBe(5);
    expect(model.grid.cells).toHaveLength(20);
  });

  it("18-zone preset produces exactly 18 cells", () => {
    const model = computeTerritory({
      events: makeEvents([{ x: 50, y: 50 }]),
      zonePreset: "18",
    });

    expect(model.meta.grid).toBe("18");
    expect(model.grid.columns).toBe(6);
    expect(model.grid.rows).toBe(3);
    expect(model.grid.cells).toHaveLength(18);
  });

  it("default orientation is vertical (broadcast convention)", () => {
    const model = computeTerritory({ events: makeEvents([{ x: 50, y: 50 }]) });

    expect(model.meta.attackingDirection).toBe("up");
    expect(model.pitch.attackingDirection).toBe("up");
  });

  // ─── Cell geometry ────────────────────────────────────────────────

  it("cells tile the full 0-100 coordinate space without gaps (3x3)", () => {
    const model = computeTerritory({ events: [] });

    // Three columns of width 100/3, three rows of height 100/3
    for (const cell of model.grid.cells) {
      expect(cell.width).toBeCloseTo(100 / 3, 5);
      expect(cell.height).toBeCloseTo(100 / 3, 5);
      expect(cell.centerX).toBeCloseTo(cell.x + cell.width / 2, 5);
      expect(cell.centerY).toBeCloseTo(cell.y + cell.height / 2, 5);
    }
  });

  it("cells tile the full 0-100 coordinate space without gaps (5x3)", () => {
    const model = computeTerritory({ events: [], grid: "5x3" });

    for (const cell of model.grid.cells) {
      expect(cell.width).toBeCloseTo(100 / 5, 5);
      expect(cell.height).toBeCloseTo(100 / 3, 5);
    }
  });

  // ─── Binning & share math ─────────────────────────────────────────

  it("places a single event into the correct cell with share=1", () => {
    // x=50, y=50 → middle third, center channel for 3x3
    const model = computeTerritory({ events: makeEvents([{ x: 50, y: 50 }]) });

    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    expect(nonZero).toHaveLength(1);
    const cell = nonZero[0]!;
    expect(cell.count).toBe(1);
    expect(cell.share).toBe(1);
    expect(cell.col).toBe(1); // middle third
    expect(cell.row).toBe(1); // center channel
  });

  it("concentrates 100 events into the attacking-third center cell", () => {
    const events = makeEvents(Array.from({ length: 100 }, () => ({ x: 90, y: 50 })));
    const model = computeTerritory({ events });

    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    expect(nonZero).toHaveLength(1);
    expect(nonZero[0]!.col).toBe(2); // attacking third
    expect(nonZero[0]!.row).toBe(1); // center channel
    expect(nonZero[0]!.share).toBe(1);
    expect(nonZero[0]!.count).toBe(100);
  });

  it("balanced 9-event input produces equal shares (3x3)", () => {
    // One event in each of the 9 cells
    const events: TerritoryEvent[] = [];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        // Center each event inside its cell
        events.push({ x: col * (100 / 3) + 100 / 6, y: row * (100 / 3) + 100 / 6 });
      }
    }
    const model = computeTerritory({ events });

    expect(model.meta.totalEvents).toBe(9);
    expect(model.grid.cells.every((c) => c.count === 1)).toBe(true);
    expect(model.grid.cells.every((c) => Math.abs(c.share - 1 / 9) < 1e-6)).toBe(true);
  });

  it("populates all 15 cells when balanced 5x3 input is provided", () => {
    const events: TerritoryEvent[] = [];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        events.push({ x: col * 20 + 10, y: row * (100 / 3) + 100 / 6 });
      }
    }
    const model = computeTerritory({ events, grid: "5x3" });

    expect(model.meta.totalEvents).toBe(15);
    expect(model.grid.cells.every((c) => c.count === 1)).toBe(true);
  });

  // ─── Boundaries / edges ──────────────────────────────────────────

  it("clamps boundary events at corners", () => {
    const model = computeTerritory({
      events: makeEvents([
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 100, y: 0 },
      ]),
    });

    const totalCount = model.grid.cells.reduce((sum, c) => sum + c.count, 0);
    expect(totalCount).toBe(4);

    // Four distinct corner cells
    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    expect(nonZero).toHaveLength(4);
  });

  it("clamps out-of-range coordinates into boundary cells", () => {
    const model = computeTerritory({
      events: makeEvents([
        { x: -5, y: 50 },
        { x: 105, y: 50 },
        { x: 50, y: -10 },
        { x: 50, y: 200 },
      ]),
    });

    const totalCount = model.grid.cells.reduce((sum, c) => sum + c.count, 0);
    expect(totalCount).toBe(4);
  });

  it("excludes non-finite coordinates and warns", () => {
    const events: TerritoryEvent[] = [
      { x: 50, y: 50 },
      { x: Number.NaN, y: 50 },
      { x: 50, y: Number.POSITIVE_INFINITY },
    ];
    const model = computeTerritory({ events });

    expect(model.meta.totalEvents).toBe(1);
    expect(model.meta.warnings.some((w) => /excluded/i.test(w))).toBe(true);
  });

  it("excludes events with null x or y", () => {
    const events = [
      { x: 50, y: 50 },
      { x: null, y: 50 },
      { x: 50, y: null },
    ] as TerritoryEvent[];
    const model = computeTerritory({ events });

    expect(model.meta.totalEvents).toBe(1);
  });

  // ─── teamFilter ───────────────────────────────────────────────────

  it("teamFilter excludes events with non-matching team", () => {
    const events: TerritoryEvent[] = [
      { x: 30, y: 30, team: "Arsenal" },
      { x: 70, y: 70, team: "Arsenal" },
      { x: 50, y: 50, team: "Wolves" },
      { x: 60, y: 60, team: "Wolves" },
    ];
    const model = computeTerritory({ events, teamFilter: "Arsenal" });

    expect(model.meta.totalEvents).toBe(2);
    expect(model.meta.empty).toBe(false);
  });

  it("teamFilter that matches nothing returns empty state", () => {
    const events: TerritoryEvent[] = [
      { x: 30, y: 30, team: "Arsenal" },
      { x: 70, y: 70, team: "Arsenal" },
    ];
    const model = computeTerritory({ events, teamFilter: "Liverpool" });

    expect(model.meta.empty).toBe(true);
    expect(model.emptyState).not.toBeNull();
    expect(
      model.meta.warnings.some((w) => w.includes('"Liverpool"') && w.includes("0 of 2")),
    ).toBe(true);
  });

  // ─── crop ─────────────────────────────────────────────────────────

  it('crop="half" keeps only attacking-half events and positions cells in the attacking half', () => {
    const model = computeTerritory({
      events: makeEvents([
        { x: 20, y: 50 }, // defensive half — excluded
        { x: 70, y: 30 }, // attacking half
        { x: 90, y: 70 }, // attacking half
      ]),
      crop: "half",
    });

    expect(model.meta.totalEvents).toBe(2);
    expect(model.grid.cells.every((c) => c.x >= 50)).toBe(true);
  });

  it('falls back to the uniform grid when a tactical zone preset is used with crop="half"', () => {
    const model = computeTerritory({
      events: makeEvents([{ x: 75, y: 50 }]),
      crop: "half",
      zonePreset: "20",
    });

    expect(model.meta.grid).toBe("3x3");
    expect(model.grid.cells).toHaveLength(9);
    expect(model.meta.warnings[0]).toMatch(/full-pitch only/);
  });

  it("warns when zonePreset overrides grid", () => {
    const model = computeTerritory({
      events: makeEvents([{ x: 50, y: 50 }]),
      grid: "3x3",
      zonePreset: "20",
    });

    expect(model.meta.warnings).toContain(
      "Both zonePreset and grid supplied — zonePreset wins; grid is ignored.",
    );
  });

  // ─── Labels ───────────────────────────────────────────────────────

  it("populates cell labels when count > 0 and showLabels is true (default)", () => {
    const events = makeEvents(
      Array.from({ length: 4 }, () => ({ x: 50, y: 50 })).concat([{ x: 90, y: 90 }]),
    );
    const model = computeTerritory({ events });

    const labeled = model.grid.cells.filter((c) => c.label != null);
    expect(labeled.length).toBeGreaterThan(0);
    for (const cell of labeled) {
      expect(cell.label).toMatch(/^\d+%$/);
    }
  });

  it("returns null labels for all cells when showLabels is false", () => {
    const model = computeTerritory({
      events: makeEvents([
        { x: 30, y: 30 },
        { x: 70, y: 70 },
      ]),
      showLabels: false,
    });

    expect(model.grid.cells.every((c) => c.label === null)).toBe(true);
  });

  it("rounds the label percentage", () => {
    // 3 events: 2 in one cell, 1 in another -> shares are ~67% and ~33%
    const events = makeEvents([
      { x: 90, y: 90 },
      { x: 90, y: 90 },
      { x: 10, y: 10 },
    ]);
    const model = computeTerritory({ events });

    const labels = model.grid.cells.filter((c) => c.label != null).map((c) => c.label);
    expect(labels).toContain("67%");
    expect(labels).toContain("33%");
  });

  // ─── Color & opacity ───────────────────────────────────────────────

  it("non-empty cells render at full opacity with hex fill", () => {
    const model = computeTerritory({
      events: makeEvents([
        { x: 30, y: 30 },
        { x: 70, y: 70 },
      ]),
    });

    const nonZero = model.grid.cells.filter((c) => c.count > 0);
    expect(nonZero.every((c) => c.opacity === 1)).toBe(true);
    expect(nonZero.every((c) => c.fill.startsWith("#"))).toBe(true);
  });

  it("empty cells are transparent", () => {
    const model = computeTerritory({
      events: makeEvents([{ x: 50, y: 50 }]),
    });

    const zeroCells = model.grid.cells.filter((c) => c.count === 0);
    expect(zeroCells.every((c) => c.fill === "rgba(0,0,0,0)")).toBe(true);
    expect(zeroCells.every((c) => c.opacity === 0)).toBe(true);
  });

  // ─── Metric label ──────────────────────────────────────────────────

  it("metricLabel flows into meta", () => {
    const model = computeTerritory({
      events: makeEvents([{ x: 50, y: 50 }]),
      metricLabel: "passes",
    });

    expect(model.meta.metricLabel).toBe("passes");
  });

  it('metricLabel defaults to "events"', () => {
    const model = computeTerritory({ events: makeEvents([{ x: 50, y: 50 }]) });

    expect(model.meta.metricLabel).toBe("events");
  });

  // ─── Orientation invariance ───────────────────────────────────────

  it("orientation is recorded in meta but does not change cell geometry", () => {
    const events = makeEvents([
      { x: 30, y: 30 },
      { x: 70, y: 70 },
    ]);
    const vertical = computeTerritory({ events, attackingDirection: "up" });
    const horizontal = computeTerritory({ events, attackingDirection: "right" });

    expect(vertical.meta.attackingDirection).toBe("up");
    expect(horizontal.meta.attackingDirection).toBe("right");
    // Cell geometry should be identical — orientation is a renderer concern
    expect(vertical.grid.cells.length).toBe(horizontal.grid.cells.length);
    for (let i = 0; i < vertical.grid.cells.length; i += 1) {
      expect(vertical.grid.cells[i]!.count).toBe(horizontal.grid.cells[i]!.count);
      expect(vertical.grid.cells[i]!.x).toBeCloseTo(horizontal.grid.cells[i]!.x, 5);
      expect(vertical.grid.cells[i]!.y).toBeCloseTo(horizontal.grid.cells[i]!.y, 5);
    }
  });
});
