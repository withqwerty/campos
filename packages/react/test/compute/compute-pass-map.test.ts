import { describe, expect, it } from "vitest";

import type { PassEvent } from "@withqwerty/campos-schema";

import { computePassMap } from "../../src/compute/index";

const basePasses: PassEvent[] = [
  {
    kind: "pass" as const,
    id: "p1",
    matchId: "m1",
    teamId: "t1",
    playerId: "pl1",
    playerName: "Kroos",
    minute: 5,
    addedMinute: null,
    second: 12,
    period: 1,
    x: 35.2,
    y: 22.4,
    endX: 55.8,
    endY: 40.1,
    length: 24.5,
    angle: 0.85,
    recipient: "Modric",
    passType: "ground",
    passResult: "complete",
    isAssist: false,
    provider: "opta",
    providerEventId: "100",
  },
  {
    kind: "pass" as const,
    id: "p2",
    matchId: "m1",
    teamId: "t1",
    playerId: "pl2",
    playerName: "Modric",
    minute: 12,
    addedMinute: null,
    second: 33,
    period: 1,
    x: 62.1,
    y: 44.8,
    endX: 78.3,
    endY: 68.2,
    length: 28.1,
    angle: 1.15,
    recipient: "Vinicius",
    passType: "through-ball",
    passResult: "complete",
    isAssist: true,
    provider: "opta",
    providerEventId: "200",
  },
  {
    kind: "pass" as const,
    id: "p3",
    matchId: "m1",
    teamId: "t1",
    playerId: "pl3",
    playerName: "Valverde",
    minute: 23,
    addedMinute: null,
    second: 5,
    period: 1,
    x: 48.0,
    y: 75.2,
    endX: 30.0,
    endY: 55.0,
    length: 25.0,
    angle: -2.3,
    recipient: null,
    passType: "high",
    passResult: "incomplete",
    isAssist: false,
    provider: "opta",
    providerEventId: "300",
  },
];

describe("computePassMap", () => {
  it("returns an empty-state model when there are no passes", () => {
    const model = computePassMap({ passes: [] });

    expect(model.meta.empty).toBe(true);
    expect(model.emptyState).toEqual({ message: "No pass data" });
    expect(model.legend).toBeNull();
    expect(model.plot.markers).toEqual([]);
    expect(model.headerStats?.items).toEqual([
      { label: "Passes", value: "0" },
      { label: "Completion", value: "—" },
    ]);
  });

  it("computes correct model for a single complete pass", () => {
    const model = computePassMap({ passes: [basePasses[0] as PassEvent] });

    expect(model.meta.empty).toBe(false);
    expect(model.meta.component).toBe("PassMap");
    expect(model.plot.markers).toHaveLength(1);
    const marker = model.plot.markers[0] as (typeof model.plot.markers)[0];
    expect(marker.isDot).toBe(false);
    expect(marker.color).toBe("#7ce2a1");
    expect(model.headerStats?.items).toEqual([
      { label: "Passes", value: "1" },
      { label: "Completion", value: "100%" },
    ]);
    expect(model.legend).toBeNull();
  });

  it("assigns correct colors for mixed completion results", () => {
    const model = computePassMap({ passes: basePasses });

    const m = model.plot.markers;
    expect((m[0] as (typeof m)[0]).color).toBe("#7ce2a1"); // complete
    expect((m[1] as (typeof m)[0]).color).toBe("#7ce2a1"); // complete
    expect((m[2] as (typeof m)[0]).color).toBe("#f27068"); // incomplete

    expect(model.headerStats?.items).toEqual([
      { label: "Passes", value: "3" },
      { label: "Completion", value: "67%" },
    ]);
  });

  it("generates legend items only for observed completion values", () => {
    const model = computePassMap({ passes: basePasses });

    expect(model.legend).not.toBeNull();
    const legend = model.legend as NonNullable<typeof model.legend>;
    expect(legend.title).toBe("Result");
    const keys = legend.items.map((item) => item.key);
    expect(keys).toContain("complete");
    expect(keys).toContain("incomplete");
    expect(keys).not.toContain("offside");
    expect(keys).not.toContain("out");
  });

  it("hides completion legend when all passes share the same encoded value", () => {
    const allComplete = basePasses.map((pass) => ({
      ...pass,
      passResult: "complete" as const,
    }));

    const model = computePassMap({ passes: allComplete });

    expect(model.legend).toBeNull();
  });

  it("orders completion legend items canonically", () => {
    const model = computePassMap({
      passes: [
        { ...(basePasses[0] as PassEvent), id: "u1", passResult: null },
        { ...(basePasses[0] as PassEvent), id: "u2", passResult: "out" },
        { ...(basePasses[0] as PassEvent), id: "u3", passResult: "complete" },
        { ...(basePasses[0] as PassEvent), id: "u4", passResult: "incomplete" },
      ],
    });

    expect(model.legend?.items.map((item) => item.key)).toEqual([
      "complete",
      "incomplete",
      "out",
      "unknown",
    ]);
  });

  it("hides legend and shows neutral gray when all passResults are null", () => {
    const nullResultPasses = basePasses.map((pass) => ({
      ...pass,
      passResult: null as PassEvent["passResult"],
    }));
    const model = computePassMap({ passes: nullResultPasses });

    expect(model.legend).toBeNull();
    expect(model.plot.markers.every((m) => m.color === "#b8c0cc")).toBe(true);
    expect(model.headerStats?.items).toEqual([
      { label: "Passes", value: "3" },
      { label: "Completion", value: "—" },
    ]);
  });

  it("marks passes with missing endX/endY as dots", () => {
    const dotPass: PassEvent = {
      ...(basePasses[0] as PassEvent),
      id: "dot1",
      endX: null,
      endY: null,
      length: null,
      angle: null,
    };
    const model = computePassMap({ passes: [dotPass] });

    const marker = model.plot.markers[0] as (typeof model.plot.markers)[0];
    expect(marker.isDot).toBe(true);
    expect(marker.endX).toBe(marker.x);
    expect(marker.endY).toBe(marker.y);
  });

  it("excludes dot passes from completion rate denominator when passResult is null", () => {
    const dotPass: PassEvent = {
      ...(basePasses[0] as PassEvent),
      id: "dot-null",
      endX: null,
      endY: null,
      length: null,
      angle: null,
      passResult: null,
    };
    const completePass = basePasses[0] as PassEvent;
    const model = computePassMap({ passes: [completePass, dotPass] });

    // Only the complete pass has a result, so 100%
    expect(model.headerStats?.items[1]).toEqual({
      label: "Completion",
      value: "100%",
    });
  });

  it("excludes dot passes from completion rate denominator even when they have a result", () => {
    const dotPass: PassEvent = {
      ...(basePasses[0] as PassEvent),
      id: "dot-complete",
      endX: null,
      endY: null,
      length: null,
      angle: null,
      passResult: "complete",
    };
    const incompletePass: PassEvent = {
      ...(basePasses[2] as PassEvent),
      id: "incomplete-pass",
    };
    const model = computePassMap({ passes: [dotPass, incompletePass] });

    expect(model.headerStats?.items[1]).toEqual({
      label: "Completion",
      value: "0%",
    });
  });

  it("clamps out-of-range coordinates to [0, 100]", () => {
    const oobPass: PassEvent = {
      ...(basePasses[0] as PassEvent),
      id: "oob",
      x: 105,
      y: -5,
      endX: 120,
      endY: -10,
    };
    const model = computePassMap({ passes: [oobPass] });

    const marker = model.plot.markers[0] as (typeof model.plot.markers)[0];
    expect(marker.x).toBe(100);
    expect(marker.y).toBe(0);
    expect(marker.endX).toBe(100);
    expect(marker.endY).toBe(0);
  });

  it("uses completion colors by default", () => {
    const model = computePassMap({ passes: basePasses });

    expect(model.meta.colorBy).toBe("completion");
    const markers = model.plot.markers;
    expect((markers[0] as (typeof markers)[0]).color).toBe("#7ce2a1"); // complete
    expect((markers[1] as (typeof markers)[0]).color).toBe("#7ce2a1"); // complete
    expect((markers[2] as (typeof markers)[0]).color).toBe("#f27068"); // incomplete

    const legend = model.legend as NonNullable<typeof model.legend>;
    expect(legend.title).toBe("Result");
    const keys = legend.items.map((item) => item.key);
    expect(keys).toContain("complete");
    expect(keys).toContain("incomplete");
  });

  it("filters to attacking half when crop is half", () => {
    // p1 endX=55.8 (in), p2 endX=78.3 (in), p3 endX=30 (out)
    const model = computePassMap({ passes: basePasses, crop: "half" });

    expect(model.meta.crop).toBe("half");
    expect(model.plot.markers).toHaveLength(2);
    expect(model.plot.markers.map((m) => m.passId)).toEqual(["p1", "p2"]);
    expect(model.plot.pitch.crop).toBe("half");
    expect(model.layout.aspectRatio).toBe("4:5");
  });

  it("handles dense pass data without errors", () => {
    const dense = Array.from({ length: 60 }, (_, i) => ({
      ...(basePasses[0] as PassEvent),
      id: `dense-${i}`,
      providerEventId: `dense-${i}`,
      x: Math.random() * 100,
      y: Math.random() * 100,
      endX: Math.random() * 100,
      endY: Math.random() * 100,
    }));
    const model = computePassMap({ passes: dense });

    expect(model.plot.markers).toHaveLength(60);
    expect(model.meta.empty).toBe(false);
  });

  it("skips passes with non-finite start coordinates", () => {
    const badPass: PassEvent = {
      ...(basePasses[0] as PassEvent),
      id: "bad",
      x: NaN,
      y: 50,
    };
    const model = computePassMap({ passes: [badPass] });

    expect(model.meta.empty).toBe(true);
    expect(model.plot.markers).toHaveLength(0);
  });

  it("generates correct accessible label with completion rate", () => {
    const model = computePassMap({ passes: basePasses });

    expect(model.meta.accessibleLabel).toBe("Pass map: 3 passes, 67% completion");
  });

  it("generates correct accessible label without completion rate", () => {
    const nullResultPasses = basePasses.map((pass) => ({
      ...pass,
      passResult: null as PassEvent["passResult"],
    }));
    const model = computePassMap({ passes: nullResultPasses });

    expect(model.meta.accessibleLabel).toBe("Pass map: 3 passes");
  });
});
