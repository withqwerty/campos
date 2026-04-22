import { describe, expect, it } from "vitest";

import type { Shot } from "@withqwerty/campos-schema";

import { computeShotMap } from "../../src/compute/index";

const baseShots: Shot[] = [
  {
    kind: "shot" as const,
    id: "1",
    matchId: "m1",
    teamId: "t1",
    playerId: "p1",
    playerName: "Eriksen",
    minute: 4,
    addedMinute: null,
    second: 0,
    period: 1,
    x: 90.2,
    y: 39,
    xg: 0.12,
    outcome: "off-target",
    bodyPart: "left-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: "regular-play",
    provider: "opta",
    providerEventId: "75",
  },
  {
    kind: "shot" as const,
    id: "2",
    matchId: "m1",
    teamId: "t1",
    playerId: "p2",
    playerName: "Walker",
    minute: 17,
    addedMinute: null,
    second: 0,
    period: 1,
    x: 93.6,
    y: 64.7,
    xg: 0.31,
    outcome: "saved",
    bodyPart: "right-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: "regular-play",
    provider: "opta",
    providerEventId: "203",
  },
  {
    kind: "shot" as const,
    id: "3",
    matchId: "m1",
    teamId: "t1",
    playerId: "p3",
    playerName: "Alderweireld",
    minute: 11,
    addedMinute: null,
    second: 0,
    period: 1,
    x: 86.6,
    y: 50.3,
    xg: 0.18,
    outcome: "goal",
    bodyPart: "head",
    isOwnGoal: false,
    isPenalty: false,
    context: "from-corner",
    provider: "opta",
    providerEventId: "138",
  },
];

describe("computeShotMap — opta preset (default)", () => {
  it("uses opta encoding: size=xG, filled goals, hollow non-goals, all circles", () => {
    const model = computeShotMap({ shots: baseShots });

    expect(model.meta).toMatchObject({
      component: "ShotMap",
      preset: "opta",
      empty: false,
      hasXg: true,
    });
    expect(model.headerStats?.items).toEqual([
      { label: "Shots", value: "3" },
      { label: "Goals", value: "1" },
      { label: "xG", value: "0.61" },
    ]);
    // Opta shows size scale, not color bar
    expect(model.sizeScale?.label).toBe("xG");
    expect(model.scaleBar).toBeNull();
    // All shapes are circles in opta preset
    expect(model.plot.markers.every((m) => m.shapeKey === "circle")).toBe(true);
    // Goals are filled, non-goals are hollow
    const goal = model.plot.markers.find((m) => m.outlineKey === "goal")!;
    const shot = model.plot.markers.find((m) => m.outlineKey === "shot")!;
    expect(goal.fillOpacity).toBe(1);
    expect(shot.fill).toBe("transparent");
    expect(shot.fillOpacity).toBe(0);
    // Size varies by xG
    const sizes = model.plot.markers.map((m) => m.visualSize);
    expect(new Set(sizes).size).toBeGreaterThan(1);
  });

  it("uses fixed size and no size scale when xG is absent", () => {
    const shotsWithoutXg = baseShots.map((shot) => ({ ...shot, xg: null }));
    const model = computeShotMap({ shots: shotsWithoutXg });

    expect(model.meta.hasXg).toBe(false);
    expect(model.sizeScale).toBeNull();
    expect(model.scaleBar).toBeNull();
    // All markers same size
    const sizes = new Set(model.plot.markers.map((m) => m.visualSize));
    expect(sizes.size).toBe(1);
  });

  it("returns an empty-state model when there are no plottable shots", () => {
    const model = computeShotMap({ shots: [] });

    expect(model.meta.empty).toBe(true);
    expect(model.emptyState).toEqual({ message: "No shot data" });
    expect(model.legend).toBeNull();
    expect(model.sizeScale).toBeNull();
    expect(model.scaleBar).toBeNull();
    expect(model.plot.markers).toEqual([]);
  });

  it("supports full horizontal pitch framing for analyst-style dense grids", () => {
    const model = computeShotMap({
      shots: baseShots,
      crop: "full",
      attackingDirection: "right",
    });

    expect(model.plot.pitch.crop).toBe("full");
    expect(model.plot.pitch.attackingDirection).toBe("right");
    expect(model.layout.aspectRatio).toBe("3:2");
  });

  it("uses a provided shared size domain when sizing markers", () => {
    const defaultModel = computeShotMap({ shots: baseShots });
    const sharedDomainModel = computeShotMap({
      shots: baseShots,
      sharedScale: { sizeDomain: [0, 0.5] },
    });

    expect(sharedDomainModel.plot.markers[0]?.visualSize).toBeGreaterThan(
      defaultModel.plot.markers[0]?.visualSize ?? 0,
    );
    expect(sharedDomainModel.sizeScale?.samples[0]?.xg).toBe(0);
    expect(sharedDomainModel.sizeScale?.samples.at(-1)?.xg).toBe(0.5);
  });

  it("keeps null-xG markers on the fallback radius even when a shared size domain is present", () => {
    const mixedShots: Shot[] = [
      { ...(baseShots[0] as Shot), id: "known", xg: 0.5 },
      { ...(baseShots[1] as Shot), id: "missing", xg: null },
    ];
    const model = computeShotMap({
      shots: mixedShots,
      sharedScale: { sizeDomain: [0, 1] },
    });

    const missing = model.plot.markers.find((marker) => marker.shotId === "missing")!;
    expect(missing.visualSize).toBeCloseTo(model.sizeScale?.samples[0]?.size ?? 0);
  });

  it("scales marker area linearly with xG instead of scaling radius linearly", () => {
    const scaledShots: Shot[] = [
      { ...(baseShots[0] as Shot), id: "low", xg: 0 },
      { ...(baseShots[0] as Shot), id: "mid", xg: 0.25 },
      { ...(baseShots[0] as Shot), id: "high", xg: 1 },
    ];
    const model = computeShotMap({ shots: scaledShots, preset: "opta" });
    const low = model.plot.markers.find((marker) => marker.shotId === "low")!;
    const mid = model.plot.markers.find((marker) => marker.shotId === "mid")!;
    const high = model.plot.markers.find((marker) => marker.shotId === "high")!;

    const lowArea = low.visualSize ** 2;
    const midArea = mid.visualSize ** 2;
    const highArea = high.visualSize ** 2;

    expect((midArea - lowArea) / (highArea - lowArea)).toBeCloseTo(0.25, 2);
  });

  it("attaches trajectory end coordinates when endX/endY are present", () => {
    const withEnd: Shot[] = [
      {
        ...(baseShots[0] as Shot),
        id: "traj-1",
        x: 80,
        y: 50,
        endX: 95,
        endY: 52,
      },
    ];
    const model = computeShotMap({ shots: withEnd });
    const m = model.plot.markers[0]!;
    expect(m.endX).toBe(95);
    expect(m.endY).toBe(52);
  });

  it("omits trajectory when end coordinates duplicate the shot origin", () => {
    const withEnd: Shot[] = [
      {
        ...(baseShots[0] as Shot),
        id: "traj-dup",
        x: 80,
        y: 50,
        endX: 80,
        endY: 50,
      },
    ];
    const model = computeShotMap({ shots: withEnd });
    const m = model.plot.markers[0]!;
    expect(m.endX).toBeUndefined();
    expect(m.endY).toBeUndefined();
  });

  it("z-orders goals on top of non-goal shots", () => {
    const mixedShots: Shot[] = [
      { ...(baseShots[0] as Shot), id: "a", outcome: "goal" },
      { ...(baseShots[1] as Shot), id: "b", outcome: "saved" },
      { ...(baseShots[2] as Shot), id: "c", outcome: "goal" },
      { ...(baseShots[0] as Shot), id: "d", outcome: "off-target" },
    ];

    const model = computeShotMap({ shots: mixedShots });
    const outlineKeys = model.plot.markers.map((m) => m.outlineKey);
    expect(outlineKeys).toEqual(["shot", "shot", "goal", "goal"]);
  });

  it("legend shows filled (goal) vs hollow (shot) distinction", () => {
    const model = computeShotMap({ shots: baseShots });

    const outlineGroup = model.legend?.groups.find((g) => g.kind === "outline");
    expect(outlineGroup).toBeDefined();
    const keys = outlineGroup!.items.map((i) => i.key);
    expect(keys).toEqual(["goal", "shot"]);
    // Goal has accent color, shot does not
    expect(outlineGroup!.items[0]!.color).toBeDefined();
    expect(outlineGroup!.items[1]!.color).toBeUndefined();
  });

  it("clamps out-of-range xG to [0, 1] when sizing markers", () => {
    const hostileShots: Shot[] = [
      { ...(baseShots[0] as Shot), id: "huge", xg: 5 },
      { ...(baseShots[0] as Shot), id: "negative", xg: -1 },
      { ...(baseShots[0] as Shot), id: "max", xg: 1 },
    ];
    const model = computeShotMap({ shots: hostileShots });
    const sizes = model.plot.markers.map((m) => m.visualSize);

    // xg=5 must not exceed xg=1 visual size; xg=-1 must not be negative
    const max = sizes[2]!;
    expect(sizes[0]).toBeCloseTo(max);
    expect(sizes[1]).toBeGreaterThan(0);
    expect(sizes.every((s) => Number.isFinite(s) && s > 0)).toBe(true);
  });

  it("treats NaN xG as the no-xG branch when other shots have real xG", () => {
    const mixedShots: Shot[] = [
      { ...(baseShots[0] as Shot), id: "real", xg: 0.3 },
      { ...(baseShots[0] as Shot), id: "nan", xg: NaN },
    ];
    const model = computeShotMap({ shots: mixedShots });

    expect(model.meta.hasXg).toBe(true);
    const nanMarker = model.plot.markers.find((m) => m.shotId === "nan")!;
    expect(Number.isFinite(nanMarker.visualSize)).toBe(true);
    expect(nanMarker.visualSize).toBeGreaterThan(0);
  });
});

describe("computeShotMap — statsbomb preset", () => {
  it("uses statsbomb encoding: xG gradient color, context-based shapes", () => {
    const model = computeShotMap({ shots: baseShots, preset: "statsbomb" });

    expect(model.meta.preset).toBe("statsbomb");
    // StatsBomb shows color bar, not size scale
    expect(model.scaleBar?.label).toBe("xG");
    expect(model.sizeScale).toBeNull();
    // Shapes based on context + bodyPart (context takes priority)
    const shapes = model.plot.markers.map((m) => m.shapeKey);
    expect(shapes).toContain("hexagon"); // foot shots (regular-play)
    expect(shapes).toContain("triangle"); // header from corner (context wins)
    // All markers are filled (not hollow)
    expect(model.plot.markers.every((m) => m.fillOpacity > 0)).toBe(true);
  });

  it("defaults the statsbomb color bar to the safer magma ramp", () => {
    const model = computeShotMap({ shots: baseShots, preset: "statsbomb" });

    expect(model.scaleBar?.stops).toEqual([
      { offset: 0, color: "#000004" },
      { offset: 0.2, color: "#3b0f70" },
      { offset: 0.4, color: "#8c2981" },
      { offset: 0.6, color: "#de4968" },
      { offset: 0.8, color: "#fe9f6d" },
      { offset: 1, color: "#fcfdbf" },
    ]);
  });

  it("uses the same resolver for legend samples and live marker radii", () => {
    const scaledShots: Shot[] = [
      { ...(baseShots[0] as Shot), id: "quarter", xg: 0.25 },
      { ...(baseShots[0] as Shot), id: "half", xg: 0.5 },
    ];
    const model = computeShotMap({
      shots: scaledShots,
      sharedScale: { sizeDomain: [0, 1] },
    });

    const halfMarker = model.plot.markers.find((marker) => marker.shotId === "half")!;
    const halfLegendSample = model.sizeScale?.samples.find((sample) => sample.xg === 0.5);
    expect(halfLegendSample?.size).toBeCloseTo(halfMarker.visualSize);
  });

  it("clamps out-of-range xG to the scale domain when colouring statsbomb markers", () => {
    const hostileShots: Shot[] = [
      { ...(baseShots[0] as Shot), id: "low", xg: -0.25 },
      { ...(baseShots[0] as Shot), id: "high", xg: 2 },
    ];
    const model = computeShotMap({ shots: hostileShots, preset: "statsbomb" });
    const low = model.plot.markers.find((marker) => marker.shotId === "low")!;
    const high = model.plot.markers.find((marker) => marker.shotId === "high")!;

    expect(low.colorValue).toBe(0);
    expect(high.colorValue).toBe(1);
  });

  it("maps context to shapes correctly", () => {
    const contextShots: Shot[] = [
      {
        ...(baseShots[0] as Shot),
        id: "fk",
        context: "direct-free-kick",
        bodyPart: "right-foot",
      },
      {
        ...(baseShots[0] as Shot),
        id: "pen",
        context: "penalty",
        bodyPart: "right-foot",
      },
      {
        ...(baseShots[0] as Shot),
        id: "corner",
        context: "from-corner",
        bodyPart: "head",
      },
      {
        ...(baseShots[0] as Shot),
        id: "foot",
        context: "regular-play",
        bodyPart: "left-foot",
      },
      {
        ...(baseShots[0] as Shot),
        id: "other",
        context: "regular-play",
        bodyPart: "other",
      },
    ];

    const model = computeShotMap({ shots: contextShots, preset: "statsbomb" });
    const shapeMap = Object.fromEntries(
      model.plot.markers.map((m) => [m.shotId, m.shapeKey]),
    );

    expect(shapeMap["fk"]).toBe("square");
    expect(shapeMap["pen"]).toBe("square");
    expect(shapeMap["corner"]).toBe("triangle");
    expect(shapeMap["foot"]).toBe("hexagon");
    expect(shapeMap["other"]).toBe("diamond");
  });

  it("includes shape legend when multiple shapes are present", () => {
    const model = computeShotMap({ shots: baseShots, preset: "statsbomb" });

    const shapeGroup = model.legend?.groups.find((g) => g.kind === "shape");
    expect(shapeGroup).toBeDefined();
    expect(shapeGroup!.items.length).toBeGreaterThan(1);
  });
});

describe("computeShotMap — fixed zero-config encodings", () => {
  it("keeps the Opta preset on outline-focused circles", () => {
    const model = computeShotMap({ shots: baseShots, preset: "opta" });

    expect(model.scaleBar).toBeNull();
    expect(model.plot.markers.every((m) => m.shapeKey === "circle")).toBe(true);
  });
});
