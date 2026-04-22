import { describe, expect, it } from "vitest";

import { computeCometChart } from "../../src/compute/comet-chart";

type TeamSeason = {
  team: string;
  season: string;
  npxg: number;
  npxga: number;
  league?: string;
};

function makePoints(
  overrides: Array<Partial<TeamSeason> & { team: string; npxg: number; npxga: number }>,
): TeamSeason[] {
  return overrides.map((o, i) => ({
    season: `S${i}`,
    league: "PL",
    ...o,
  }));
}

describe("computeCometChart", () => {
  // ---- empty state -------------------------------------------------------

  it("returns emptyState when points array is empty", () => {
    const model = computeCometChart({
      points: [] as TeamSeason[],
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    expect(model.meta.empty).toBe(true);
    expect(model.meta.component).toBe("CometChart");
    expect(model.emptyState).toEqual({ message: "No data" });
    expect(model.plot.entities).toHaveLength(0);
    expect(model.plot.guides).toHaveLength(0);
    expect(model.plot.labels).toHaveLength(0);
    expect(model.legends).toHaveLength(0);
  });

  // ---- single entity, 2 points ------------------------------------------

  it("produces 1 trail segment and 2 markers for a single entity with 2 points", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "Arsenal", npxg: 1.0, npxga: 1.5 },
        { team: "Arsenal", npxg: 1.5, npxga: 1.0 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    expect(model.meta.empty).toBe(false);
    expect(model.meta.totalEntities).toBe(1);
    expect(model.plot.entities).toHaveLength(1);

    const entity = model.plot.entities[0]!;
    expect(entity.id).toBe("Arsenal");
    expect(entity.trail).toHaveLength(1);
    expect(entity.points).toHaveLength(2);

    // Latest point should be larger
    const latest = entity.points.find((p) => p.isLatest);
    const other = entity.points.find((p) => !p.isLatest);
    expect(latest).toBeTruthy();
    expect(other).toBeTruthy();
    expect(latest!.r).toBeGreaterThan(other!.r);

    // No legend for single entity
    expect(model.legends).toHaveLength(0);
  });

  // ---- multi-entity grouping --------------------------------------------

  it("groups points by entityKey correctly", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "Arsenal", npxg: 1.0, npxga: 1.5 },
        { team: "Chelsea", npxg: 1.2, npxga: 1.3 },
        { team: "Arsenal", npxg: 1.5, npxga: 1.0 },
        { team: "Chelsea", npxg: 1.8, npxga: 0.9 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    expect(model.meta.totalEntities).toBe(2);
    expect(model.plot.entities.map((e) => e.id).sort()).toEqual(["Arsenal", "Chelsea"]);

    // Each entity gets 2 points and 1 trail segment
    for (const entity of model.plot.entities) {
      expect(entity.points).toHaveLength(2);
      expect(entity.trail).toHaveLength(1);
    }

    // Legend shown for multi-entity
    expect(model.legends).toHaveLength(1);
    expect(model.legends[0]!.items).toHaveLength(2);
  });

  // ---- temporal ordering by timeKey -------------------------------------

  it("sorts points within entity by timeKey", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "Arsenal", season: "2022-23", npxg: 1.5, npxga: 1.0 },
        { team: "Arsenal", season: "2020-21", npxg: 1.0, npxga: 1.5 },
        { team: "Arsenal", season: "2021-22", npxg: 1.2, npxga: 1.3 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
      timeKey: "season",
      showTimeLabels: true,
    });

    const entity = model.plot.entities[0]!;
    expect(entity.points).toHaveLength(3);

    // The latest point should be the one from 2022-23
    const latest = entity.points.find((p) => p.isLatest);
    expect(latest!.timeLabel).toBe("2022-23");

    // Time labels should be in order
    const timeLabels = entity.points.map((p) => p.timeLabel);
    expect(timeLabels).toEqual(["2020-21", "2021-22", "2022-23"]);
  });

  // ---- barely-moved detection -------------------------------------------

  it("marks barely-moved entities with no trail", () => {
    // Two points very close together
    const model = computeCometChart({
      points: makePoints([
        { team: "Arsenal", npxg: 1.0, npxga: 1.0 },
        { team: "Arsenal", npxg: 1.001, npxga: 1.001 },
        // A mover for scale context
        { team: "Chelsea", npxg: 0.5, npxga: 2.0 },
        { team: "Chelsea", npxg: 2.0, npxga: 0.5 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    const arsenal = model.plot.entities.find((e) => e.id === "Arsenal")!;
    expect(arsenal.barelyMoved).toBe(true);
    expect(arsenal.trail).toHaveLength(0);
    expect(arsenal.points).toHaveLength(1); // Only latest shown

    const chelsea = model.plot.entities.find((e) => e.id === "Chelsea")!;
    expect(chelsea.barelyMoved).toBe(false);
    expect(chelsea.trail.length).toBeGreaterThan(0);
  });

  // ---- inverted axes ----------------------------------------------------

  it("inverts axis scale when invertY is true", () => {
    const normal = computeCometChart({
      points: makePoints([
        { team: "A", npxg: 1.0, npxga: 0.5 },
        { team: "A", npxg: 1.0, npxga: 1.5 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    const inverted = computeCometChart({
      points: makePoints([
        { team: "A", npxg: 1.0, npxga: 0.5 },
        { team: "A", npxg: 1.0, npxga: 1.5 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
      invertY: true,
    });

    expect(inverted.axes.y.inverted).toBe(true);
    expect(normal.axes.y.inverted).toBe(false);

    // With invertY, higher data values should map to higher SVG y (lower on screen)
    const normalEntity = normal.plot.entities[0]!;
    const invertedEntity = inverted.plot.entities[0]!;

    // In normal: higher npxga (1.5) → lower SVG y (higher on screen)
    // In inverted: higher npxga (1.5) → higher SVG y (lower on screen)
    const normalLatest = normalEntity.points.find((p) => p.isLatest)!;
    const invertedLatest = invertedEntity.points.find((p) => p.isLatest)!;
    const normalFirst = normalEntity.points.find((p) => !p.isLatest)!;
    const invertedFirst = invertedEntity.points.find((p) => !p.isLatest)!;

    // The relative direction should flip
    const normalDirection = normalLatest.cy - normalFirst.cy;
    const invertedDirection = invertedLatest.cy - invertedFirst.cy;
    expect(Math.sign(normalDirection)).toBe(-Math.sign(invertedDirection));
  });

  it("inverts axis with guides correctly", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "A", npxg: 1.0, npxga: 0.8 },
        { team: "A", npxg: 2.0, npxga: 1.2 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
      invertY: true,
      guides: [{ axis: "y", value: "median" }],
    });

    expect(model.plot.guides).toHaveLength(1);
    const guide = model.plot.guides[0]!;
    // Guide should be a valid horizontal line
    expect(guide.axis).toBe("y");
    expect(guide.x1).toBeLessThan(guide.x2);
    expect(guide.y1).toBe(guide.y2);
  });

  // ---- guide line computation -------------------------------------------

  it("computes guide lines for fixed, median, and mean values", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "A", npxg: 1.0, npxga: 1.0 },
        { team: "B", npxg: 2.0, npxga: 2.0 },
        { team: "A", npxg: 1.5, npxga: 1.5 },
        { team: "B", npxg: 2.5, npxga: 2.5 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
      guides: [
        { axis: "x", value: 1.5, label: "Fixed x" },
        { axis: "y", value: "median", label: "Median y" },
        { axis: "x", value: "mean" },
      ],
    });

    expect(model.plot.guides).toHaveLength(3);

    const fixedGuide = model.plot.guides.find((g) => g.label === "Fixed x");
    expect(fixedGuide).toBeTruthy();
    expect(fixedGuide!.axis).toBe("x");

    const medianGuide = model.plot.guides.find((g) => g.label === "Median y");
    expect(medianGuide).toBeTruthy();
    expect(medianGuide!.axis).toBe("y");
  });

  // ---- null/missing field handling --------------------------------------

  it("excludes rows with null/NaN x or y values", () => {
    const points = [
      { team: "A", season: "S0", npxg: 1.0, npxga: 1.0 },
      { team: "A", season: "S1", npxg: NaN, npxga: 1.5 },
      { team: "A", season: "S2", npxg: 1.5, npxga: 1.5 },
    ] as TeamSeason[];

    const model = computeCometChart({
      points,
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    // NaN row should be filtered out, leaving 2 valid points
    const entity = model.plot.entities[0]!;
    expect(entity.points).toHaveLength(2);
  });

  it("excludes rows with null entityKey", () => {
    const points = [
      { team: null as unknown as string, season: "S0", npxg: 1.0, npxga: 1.0 },
      { team: "A", season: "S1", npxg: 1.5, npxga: 1.5 },
    ] as TeamSeason[];

    const model = computeCometChart({
      points,
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    expect(model.meta.totalEntities).toBe(1);
  });

  // ---- single point per entity ------------------------------------------

  it("renders single-point entities as dot only with no trail", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "Arsenal", npxg: 1.0, npxga: 1.0 },
        { team: "Chelsea", npxg: 1.5, npxga: 1.5 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    // Each entity has 1 point, no trail
    for (const entity of model.plot.entities) {
      expect(entity.points).toHaveLength(1);
      expect(entity.trail).toHaveLength(0);
      expect(entity.points[0]!.isLatest).toBe(true);
    }
  });

  // ---- accessible label -------------------------------------------------

  it("generates meaningful accessible label", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "A", npxg: 1.0, npxga: 1.0 },
        { team: "A", npxg: 1.5, npxga: 1.5 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
      xLabel: "npxG per 90",
      yLabel: "npxGA per 90",
    });

    expect(model.meta.accessibleLabel).toContain("npxG per 90");
    expect(model.meta.accessibleLabel).toContain("npxGA per 90");
    expect(model.meta.accessibleLabel).toContain("1 entity");
  });

  // ---- tooltip delta computation ----------------------------------------

  it("includes change delta in tooltip for non-first points", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "A", npxg: 1.0, npxga: 1.5 },
        { team: "A", npxg: 1.5, npxga: 1.0 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    const entity = model.plot.entities[0]!;
    const latest = entity.points.find((p) => p.isLatest)!;
    const changeRow = latest.tooltip.rows.find((r) => r.label === "Change");
    expect(changeRow).toBeTruthy();
    expect(changeRow!.value).toContain("+0.5");
    expect(changeRow!.value).toContain("-0.5");

    // First point should not have a Change row
    const first = entity.points.find((p) => !p.isLatest)!;
    const firstChangeRow = first.tooltip.rows.find((r) => r.label === "Change");
    expect(firstChangeRow).toBeUndefined();
  });

  // ---- label strategy ---------------------------------------------------

  it("labels all entities by default", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "Arsenal", npxg: 1.0, npxga: 1.0 },
        { team: "Chelsea", npxg: 2.0, npxga: 2.0 },
        { team: "Arsenal", npxg: 1.5, npxga: 1.5 },
        { team: "Chelsea", npxg: 2.5, npxga: 2.5 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    expect(model.plot.labels).toHaveLength(2);
  });

  it("shows no labels when labelStrategy is none", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "Arsenal", npxg: 1.0, npxga: 1.0 },
        { team: "Arsenal", npxg: 1.5, npxga: 1.5 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
      labelStrategy: "none",
    });

    expect(model.plot.labels).toHaveLength(0);
  });

  it("only labels specified entities when labelStrategy is manual", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "Arsenal", npxg: 1.0, npxga: 1.0 },
        { team: "Chelsea", npxg: 2.0, npxga: 2.0 },
        { team: "Liverpool", npxg: 1.5, npxga: 0.8 },
        { team: "Arsenal", npxg: 1.5, npxga: 1.5 },
        { team: "Chelsea", npxg: 2.5, npxga: 2.5 },
        { team: "Liverpool", npxg: 2.0, npxga: 0.6 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
      labelStrategy: "manual",
      labelIds: ["Arsenal", "Liverpool"],
    });

    expect(model.plot.labels).toHaveLength(2);
    expect(model.plot.labels.map((l) => l.entityId).sort()).toEqual([
      "Arsenal",
      "Liverpool",
    ]);
  });

  // ---- trail style ------------------------------------------------------

  it("uses gradient opacity for trails by default", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "A", npxg: 1.0, npxga: 1.0 },
        { team: "A", npxg: 1.5, npxga: 1.5 },
        { team: "A", npxg: 2.0, npxga: 2.0 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    const entity = model.plot.entities[0]!;
    expect(entity.trail).toHaveLength(2);
    // Earlier segment should have lower opacity than later
    expect(entity.trail[0]!.opacity).toBeLessThan(entity.trail[1]!.opacity);
  });

  it("uses gradient opacity by default", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "A", npxg: 1.0, npxga: 1.0 },
        { team: "A", npxg: 1.5, npxga: 1.5 },
        { team: "A", npxg: 2.0, npxga: 2.0 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    const entity = model.plot.entities[0]!;
    expect(entity.trail).toHaveLength(2);
    expect(entity.trail[0]!.opacity).toBeLessThan(entity.trail[1]!.opacity);
  });

  // ---- entity color grouping ---------------------------------------------

  it("assigns distinct default colors per entity and keeps one legend item per entity", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "Arsenal", npxg: 1.0, npxga: 1.0, league: "PL" },
        { team: "Barcelona", npxg: 2.0, npxga: 2.0, league: "La Liga" },
        { team: "Chelsea", npxg: 1.5, npxga: 1.5, league: "PL" },
        { team: "Arsenal", npxg: 1.5, npxga: 0.8 },
        { team: "Barcelona", npxg: 2.5, npxga: 1.5 },
        { team: "Chelsea", npxg: 2.0, npxga: 1.0 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    const arsenal = model.plot.entities.find((e) => e.id === "Arsenal")!;
    const chelsea = model.plot.entities.find((e) => e.id === "Chelsea")!;
    const barcelona = model.plot.entities.find((e) => e.id === "Barcelona")!;

    expect(arsenal.fill).not.toBe(chelsea.fill);
    expect(barcelona.fill).not.toBe(arsenal.fill);
    expect(barcelona.fill).not.toBe(chelsea.fill);

    // Legend should show 3 items, one per entity
    expect(model.legends).toHaveLength(1);
    expect(model.legends[0]!.items).toHaveLength(3);
  });

  // ---- degenerate axis domain -------------------------------------------

  it("handles degenerate axis domain (all same values)", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "A", npxg: 1.5, npxga: 1.0 },
        { team: "B", npxg: 1.5, npxga: 2.0 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    // Should not crash — niceTicks pads degenerate domains
    expect(model.meta.empty).toBe(false);
    expect(model.axes.x.domain[0]).toBeLessThan(model.axes.x.domain[1]);
  });

  // ---- deduplication of entityKey + timeKey pairs -----------------------

  it("deduplicates rows with same entityKey + timeKey (last wins)", () => {
    const model = computeCometChart({
      points: [
        { team: "A", season: "2021", npxg: 1.0, npxga: 1.0 },
        { team: "A", season: "2021", npxg: 999, npxga: 999 },
        { team: "A", season: "2022", npxg: 2.0, npxga: 2.0 },
      ] as TeamSeason[],
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
      timeKey: "season",
    });

    const entity = model.plot.entities[0]!;
    // Should have 2 points (deduplicated), not 3
    expect(entity.points).toHaveLength(2);
  });

  // ---- label collision produces non-overlapping labels ------------------

  it("labels do not share identical positions for nearby entities", () => {
    const model = computeCometChart({
      points: makePoints([
        { team: "Arsenal", npxg: 1.0, npxga: 1.0 },
        { team: "Chelsea", npxg: 1.05, npxga: 1.05 },
        { team: "Arsenal", npxg: 1.5, npxga: 1.5 },
        { team: "Chelsea", npxg: 1.55, npxga: 1.55 },
      ]),
      entityKey: "team",
      xKey: "npxg",
      yKey: "npxga",
    });

    expect(model.plot.labels).toHaveLength(2);
    const [l1, l2] = model.plot.labels;
    // Labels should not be at the exact same position
    expect(l1!.x === l2!.x && l1!.y === l2!.y).toBe(false);
  });
});
